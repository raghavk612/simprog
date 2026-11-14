"""SDF -> triangle mesh: sample on a voxel grid, marching cubes (scikit-image), quadric decimation (fast-simplification),
then vertex normals from the SDF gradient.

The grid is padded with one layer of 'outside' so every part comes out closed. Faces are wound counter-clockwise seen from
outside (positive signed volume), the OBJ/glTF convention build_players.py writes.
"""
import numpy as np

from .prims import gradient


def sample(f, lo, hi, voxel, chunk=400_000):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.maximum(np.ceil((hi - lo) / voxel).astype(int) + 1, 2)
    axes = [lo[i] + voxel * np.arange(n[i]) for i in range(3)]
    d = np.empty(tuple(n), np.float32)
    X, Y = np.meshgrid(axes[0], axes[1], indexing='ij')
    XY = np.stack([X, Y], -1).reshape(-1, 2)
    per = max(1, chunk // len(XY))
    for k0 in range(0, n[2], per):
        zs = axes[2][k0:k0 + per]
        P = np.concatenate([np.column_stack([XY, np.full(len(XY), z)]) for z in zs])
        d[:, :, k0:k0 + len(zs)] = f(P).reshape(len(zs), n[0], n[1]).transpose(1, 2, 0)
    return d, lo


def signed_volume(V, F):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6)


def clean(V, F):
    """Drops degenerate faces and unused vertices."""
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 2] != F[:, 0])]
    A = np.linalg.norm(np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]), axis=1)
    F = F[A > 1e-14]
    used, inv = np.unique(F, return_inverse=True)
    return V[used], inv.reshape(-1, 3)


def marching(f, lo, hi, voxel):
    from skimage.measure import marching_cubes
    d, lo = sample(f, lo, hi, voxel)
    d = np.pad(d, 1, constant_values=1.0)
    V, F, _, _ = marching_cubes(d, 0.0, spacing=(voxel,) * 3, allow_degenerate=False)
    V = V + lo - voxel
    F = F.astype(np.int64)
    if signed_volume(V, F) < 0: F = F[:, ::-1]
    return clean(V, F)


def decimate(V, F, target):
    import fast_simplification
    if len(F) <= target: return V, F
    V2, F2 = fast_simplification.simplify(V.astype(np.float64), F.astype(np.int32), target_count=int(target), agg=5)
    V2, F2 = clean(np.asarray(V2, float), np.asarray(F2, np.int64))
    if signed_volume(V2, F2) < 0: F2 = F2[:, ::-1]
    return V2, F2


def project(f, V, iters=3):
    """Moves vertices onto the zero set along the SDF gradient (decimation leaves them a little off it)."""
    for _ in range(iters):
        d = f(V); g = gradient(f, V)
        V = V - g * d[:, None]
    return V


def mesh(f, lo, hi, voxel, target, snap=True):
    """Closed triangle mesh of {f < 0} inside the box lo..hi: (V, F, N) with N the SDF gradient (outward)."""
    V, F = marching(f, lo, hi, voxel)
    V, F = decimate(V, F, target)
    if snap: V = project(f, V)
    return V, F, gradient(f, V)


# --- checks used by the tests ---------------------------------------------------------------------------------------
def edge_use(F):
    e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    u, c = np.unique(e, axis=0, return_counts=True)
    return u, c


def is_watertight(F):
    """Every edge is shared by exactly two faces, with opposite directions (closed, consistently oriented)."""
    _, c = edge_use(F)
    if not (c == 2).all(): return False
    d = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    _, cd = np.unique(d, axis=0, return_counts=True)
    return bool((cd == 1).all())


def is_vertex_manifold(F, nv):
    """Every vertex's faces form a single fan (no two cones touching at a point)."""
    from collections import defaultdict
    ring = defaultdict(list)
    for a, b, c in F:
        ring[a].append((b, c)); ring[b].append((c, a)); ring[c].append((a, b))
    for v, edges in ring.items():
        nxt = dict(edges)
        if len(nxt) != len(edges): return False
        start = edges[0][0]; cur = start; n = 0
        while True:
            cur = nxt.get(cur)
            n += 1
            if cur is None or cur == start or n > len(edges): break
        if n != len(edges): return False
    return True


def euler_genus(V, F):
    E = len(edge_use(F)[0])
    chi = len(np.unique(F)) - E + len(F)
    return chi
