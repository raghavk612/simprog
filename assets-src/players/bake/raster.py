"""UV rasteriser, tangent frames and the tangent-space normal encoding the bake shares with three.js.

Conventions (see the report, .superpowers/players-detail-bake-proto.md):
* UVs are OBJ style, v up: texel (row, col) of a W x H image has its centre at u = (col + .5) / W, v = 1 - (row + .5) / H.
  Row 0 is the top of the PNG. glTF TEXCOORD_0 = (u, 1 - v), so row 0 is glTF v = 0, which is what GLTFLoader
  (texture.flipY = false) samples.
* Tangent frame per vertex, MikkTSpace style: T = dP/du, bitangent along dP/dv (v up, i.e. towards the top of the image),
  angle-weighted over the corners, T orthogonalised against the vertex normal, w = sign(dot(cross(N, T), dP/dv)).
  This is the glTF TANGENT (xyz, w) and the frame three.js builds from it: vTangent = T, vBitangent = cross(N, T) * w,
  both interpolated and normalised per pixel, normal = normalize(mat3(T, B, N) * (rgb * 2 - 1)).
* Normal map: OpenGL / glTF style, +X along T (u), +Y along B (image up, green up), +Z along N.
"""
import numpy as np

# --- tangents ------------------------------------------------------------------------------------------------
def tangents(P, N, UV, tris):
    """Per-vertex tangent (n, 3) and handedness w (n,), MikkTSpace-like (angle-weighted, Gram-Schmidt)."""
    p0, p1, p2 = P[tris[:, 0]], P[tris[:, 1]], P[tris[:, 2]]
    t0, t1, t2 = UV[tris[:, 0]], UV[tris[:, 1]], UV[tris[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    du1, dv1 = t1[:, 0] - t0[:, 0], t1[:, 1] - t0[:, 1]
    du2, dv2 = t2[:, 0] - t0[:, 0], t2[:, 1] - t0[:, 1]
    det = du1 * dv2 - du2 * dv1
    ok = np.abs(det) > 1e-14
    r = np.where(ok, 1.0 / np.where(ok, det, 1), 0)
    fT = (e1 * dv2[:, None] - e2 * dv1[:, None]) * r[:, None]     # dP/du
    fB = (e2 * du1[:, None] - e1 * du2[:, None]) * r[:, None]     # dP/dv
    Tacc = np.zeros_like(P); Bacc = np.zeros_like(P)
    for k in range(3):
        a, b, c = tris[:, k], tris[:, (k + 1) % 3], tris[:, (k + 2) % 3]
        u1, u2 = P[b] - P[a], P[c] - P[a]
        cosang = (u1 * u2).sum(1) / np.maximum(np.linalg.norm(u1, axis=1) * np.linalg.norm(u2, axis=1), 1e-20)
        ang = np.arccos(np.clip(cosang, -1, 1)) * ok
        n = N[a]
        for src, acc in ((fT, Tacc), (fB, Bacc)):
            v = src - n * (src * n).sum(1, keepdims=True)
            v /= np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-20)
            np.add.at(acc, a, v * ang[:, None])
    T = Tacc - N * (Tacc * N).sum(1, keepdims=True)
    bad = np.linalg.norm(T, axis=1) < 1e-12
    if bad.any():   # no usable UV gradient: any vector perpendicular to N
        helper = np.where(np.abs(N[bad, :1]) < .9, [[1.0, 0, 0]], [[0, 1.0, 0]])
        T[bad] = np.cross(N[bad], helper)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    w = np.where((np.cross(N, T) * Bacc).sum(1) < 0, -1.0, 1.0)
    return T, w

def bitangents(N, T, w):
    """What three.js's vertex shader computes: normalize(cross(N, T) * w)."""
    B = np.cross(N, T) * w[:, None]
    return B / np.maximum(np.linalg.norm(B, axis=1, keepdims=True), 1e-20)

# --- tangent-space encode / decode --------------------------------------------------------------------------------
def _unit(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-20)

def encode(n, T, B, N):
    """World normal n -> tangent-space vector m with normalize(T m.x + B m.y + N m.z) == n, for the per-pixel frame
    three.js uses (T, B, N each normalised but not necessarily orthogonal). Returns unit m (z >= 0 where n faces out)."""
    M = np.stack([_unit(T), _unit(B), _unit(N)], -1)      # columns
    m = np.linalg.solve(M, n[..., None])[..., 0]
    return _unit(m)

def decode(m, T, B, N):
    """three.js normal_fragment_maps: normalize(mat3(T, B, N) * m)."""
    return _unit(_unit(T) * m[..., :1] + _unit(B) * m[..., 1:2] + _unit(N) * m[..., 2:3])

def to_rgb8(m):
    return np.clip(np.round((m * .5 + .5) * 255), 0, 255).astype(np.uint8)

def from_rgb8(rgb):
    return rgb.astype(np.float64) / 255 * 2 - 1

# --- rasteriser ---------------------------------------------------------------------------------------------------
def to_pixels(UV, W, H):
    """UV (v up) -> continuous pixel coordinates where texel (row, col) has its centre at (col, row)."""
    return np.stack([UV[:, 0] * W - .5, (1 - UV[:, 1]) * H - .5], 1)

def rasterize(UV, tris, W, H=None, eps=1e-7, count=False, chunk=4_000_000):
    """Texel centres inside each UV triangle. Returns (tri_id image (H, W) int32, -1 = empty, barycentrics (H, W, 3)
    float32), the first triangle winning a shared texel. With count=True returns the number of triangles that strictly
    contain each texel centre (overlap test: shared edges do not count)."""
    H = H or W
    X = to_pixels(UV, W, H)[tris]          # (m, 3, 2)
    x0 = np.ceil(X[:, :, 0].min(1)).astype(np.int64); x1 = np.floor(X[:, :, 0].max(1)).astype(np.int64)
    y0 = np.ceil(X[:, :, 1].min(1)).astype(np.int64); y1 = np.floor(X[:, :, 1].max(1)).astype(np.int64)
    x0 = np.maximum(x0, 0); y0 = np.maximum(y0, 0); x1 = np.minimum(x1, W - 1); y1 = np.minimum(y1, H - 1)
    nx = np.maximum(x1 - x0 + 1, 0); ny = np.maximum(y1 - y0 + 1, 0); cnt = nx * ny
    tri_id = np.full(H * W, -1, np.int32); bary = np.zeros((H * W, 3), np.float32)
    counts = np.zeros(H * W, np.int32)
    order = np.arange(len(tris)); start = 0
    csum = np.cumsum(cnt)
    while start < len(tris):
        stop = int(np.searchsorted(csum, (csum[start - 1] if start else 0) + chunk, 'right'))
        stop = max(stop, start + 1)
        ids = order[start:stop]; c = cnt[ids]
        if c.sum():
            t = np.repeat(ids, c); off = np.repeat(np.cumsum(c) - c, c); l = np.arange(c.sum()) - off
            px = x0[t] + l % nx[t]; py = y0[t] + l // nx[t]
            a, b, cc = X[t, 0], X[t, 1], X[t, 2]
            den = (b[:, 1] - cc[:, 1]) * (a[:, 0] - cc[:, 0]) + (cc[:, 0] - b[:, 0]) * (a[:, 1] - cc[:, 1])
            good = np.abs(den) > 1e-12
            den = np.where(good, den, 1)
            l0 = ((b[:, 1] - cc[:, 1]) * (px - cc[:, 0]) + (cc[:, 0] - b[:, 0]) * (py - cc[:, 1])) / den
            l1 = ((cc[:, 1] - a[:, 1]) * (px - cc[:, 0]) + (a[:, 0] - cc[:, 0]) * (py - cc[:, 1])) / den
            l2 = 1 - l0 - l1
            flat = py * W + px
            if count:
                inside = good & (l0 > eps) & (l1 > eps) & (l2 > eps)
                np.add.at(counts, flat[inside], 1)
            else:
                inside = good & (l0 >= -eps) & (l1 >= -eps) & (l2 >= -eps)
                flat, t, L = flat[inside], t[inside], np.stack([l0, l1, l2], 1)[inside]
                free = tri_id[flat] < 0
                flat, t, L = flat[free], t[free], L[free]
                uf, first = np.unique(flat, return_index=True)
                tri_id[uf] = t[first]; bary[uf] = L[first]
        start = stop
    if count:
        return counts.reshape(H, W)
    return tri_id.reshape(H, W), bary.reshape(H, W, 3)

def interpolate(attr, tris, tri_id, bary):
    """Per covered texel (flattened in row-major order of the mask tri_id >= 0): sum of barycentric * vertex attribute."""
    m = tri_id >= 0
    t = tri_id[m]; b = bary[m].astype(np.float64)
    return (attr[tris[t, 0]] * b[:, :1] + attr[tris[t, 1]] * b[:, 1:2] + attr[tris[t, 2]] * b[:, 2:3])

# --- dilation -----------------------------------------------------------------------------------------------------
def dilate(img, mask):
    """Fill every texel outside mask with the value of the nearest texel inside it (unlimited dilation past the UV
    seams, so bilinear filtering and mip levels at chart borders read the chart's own values)."""
    from scipy.ndimage import distance_transform_edt
    if mask.all(): return img
    idx = distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return img[idx[0], idx[1]]
