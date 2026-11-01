"""Fast preview of a Kangs body without Houdini: evaluates the same SDF as the Houdini builder
(houdini/build_players.py) on a grid and meshes it with marching cubes. For tuning body_shapes.json only;
the shipped meshes come from Houdini.
Usage: python3 preview_body.py <variant> <out.obj> [voxel_m]   (needs numpy and scikit-image)

The body parts are a smooth union (one global blend radius) of the height-scaled shapes. The core part is then joined
to the head block (absolute head-local metres, per-shape blend k and op; see body_shapes.json 'head_about'):
    core(P) = smin(body_core(P), head(P), neck_k)
Formulas (identical in the VEX):
    smin(a, b, k) = min(a, b) - h^2 k / 4,  h = max(k - |a - b|, 0) / k        smax(a, b, k) = -smin(-a, -b, k)
    ellipsoid (IQ approximation)  k0 = |q / r|, k1 = |q / r^2|, d = k0 (k0 - 1) / k1
    round cone along +y from 0 (radius ra) to len (radius rb); cross-section z divided by aspect
    round box (IQ)  w = |q| - r + round, d = |max(w, 0)| + min(max(w.x, w.y, w.z), 0) - round
    plane  d = q.z        Gaussian bump  d -= amp exp(-|q / r|^2)
"""
import json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BOX = {'core': ((0, .5, .02), (.34, 1.04, .26), False), 'arm_L': ((.123, .61, .005), (.11, .5, .12), True), 'arm_R': ((-.123, .61, .005), (.11, .5, .12), True)}
KIND = {'ell': 0, 'cone': 1, 'box': 2, 'plane': 3, 'gauss': 4}
OP = {'union': 0, 'subtract': 1, 'intersect': 2, 'add': 3}

def rot_matrix(deg):  # Houdini buildRotate, xyz order, row-vector convention (v * R)
    rx, ry, rz = [math.radians(a) for a in deg]
    X = np.array([[1, 0, 0], [0, math.cos(rx), math.sin(rx)], [0, -math.sin(rx), math.cos(rx)]])
    Y = np.array([[math.cos(ry), 0, -math.sin(ry)], [0, 1, 0], [math.sin(ry), 0, math.cos(ry)]])
    Z = np.array([[math.cos(rz), math.sin(rz), 0], [-math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return X @ Y @ Z

def shapes_for(spec, v):
    H, SH, M = v['height_m'], v['shoulder'], v['mass']
    pos = lambda p, sx: np.array([p[0] * (SH if sx else 1) * H, p[1] * H, p[2] * H])
    out = []
    for s in spec['shapes']:
        k = M ** s['m']
        if s['kind'] == 'ell':
            r = np.array(s['r']) * k * H
            if s['sx']: r[0] *= SH ** .5
            out.append(dict(part=s['part'], name=s['name'], kind=0, c=pos(s['c'], s['sx']), basis=rot_matrix(s['rot']).T, r=r))
        else:
            a, b = pos(s['a'], s['sx']), pos(s['b'], s['sx'])
            ra, rb = s['ra'] * k * H, s['rb'] * k * H
            if s['sx']: ra *= SH ** .25; rb *= SH ** .25
            d = b - a; L = np.linalg.norm(d); d = d / L
            xa = np.array([1., 0, 0]) if abs(d[1]) > .7 else (np.array([0., 1, 0]) if abs(d[0]) < .7 else np.array([0., 0, 1]))
            xa = xa - d * xa.dot(d); xa /= np.linalg.norm(xa); za = np.cross(xa, d); za /= np.linalg.norm(za)
            if za[2] < 0 and abs(d[1]) > .7: za = -za
            out.append(dict(part=s['part'], name=s['name'], kind=1, c=a, basis=np.stack([xa, d, za], 1), ra=ra, rb=rb, L=L, aspect=s['aspect']))
    return out

# --- distance primitives and blends ----------------------------------------------------------------
def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * .25

def smax(a, b, k):
    return -smin(-a, -b, k)

def sd_ellipsoid(q, r):
    k0 = np.linalg.norm(q / r, axis=-1); k1 = np.linalg.norm(q / (r * r), axis=-1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-6)

def sd_roundcone(q, r1, r2, h):
    b = (r1 - r2) / h; a = math.sqrt(max(1 - b * b, 1e-6))
    w0 = np.hypot(q[..., 0], q[..., 2]); w1 = q[..., 1]
    k = -b * w0 + a * w1
    d1 = np.hypot(w0, w1) - r1; d2 = np.hypot(w0, w1 - h) - r2; d3 = a * w0 + b * w1 - r1
    return np.where(k < 0, d1, np.where(k > a * h, d2, d3))

def sd_roundbox(q, b, rr):
    w = np.abs(q) - b + rr
    return np.linalg.norm(np.maximum(w, 0), axis=-1) + np.minimum(w.max(-1), 0) - rr

def sdf(P, sh):  # body shapes (ellipsoid / tapered capsule)
    q = (P - sh['c']) @ sh['basis']
    if sh['kind'] == 0:
        return sd_ellipsoid(q, sh['r'])
    q = q.copy(); q[..., 2] /= sh['aspect']
    return sd_roundcone(q, sh['ra'], sh['rb'], max(sh['L'], 1e-4))

# --- head block ---------------------------------------------------------------------------------------
def head_origin(v):
    h = v['head']
    return np.array([0.0, v['height_m'] - h['origin_from_top'], h['origin_z']])

def head_shapes(v):
    """The variant's head shapes, resolved to body metres (centre + origin) with integer kind/op, as the VEX gets them."""
    o = head_origin(v)
    out = []
    for s in v['head']['shapes']:
        d = dict(s); d['kind'] = KIND[s['kind']]; d['op'] = OP[s['op']]
        d['c'] = np.array(s['c']) + o; d['basis'] = np.array(s['basis'], float).reshape(3, 3)
        d['r'] = np.array(s['r'], float); d['taper'] = np.array(s.get('taper', (0, 0)), float)
        out.append(d)
    return out

def head_prim(P, s):
    """Distance of one head shape (before its op) at body points P (..., 3)."""
    if s['mirror']:
        P = P.copy(); P[..., 0] = np.abs(P[..., 0])
    q = (P - s['c']) @ s['basis']
    kind, r = s['kind'], s['r']
    if s['taper'][0] or s['taper'][1]:
        q = q.copy()
        q[..., 0] /= 1 + s['taper'][0] * np.clip(q[..., 2] / r[2], -1, 1) + s['taper'][1] * np.clip(q[..., 1] / r[1], -1, 1)
    if kind == 0: return sd_ellipsoid(q, r)
    if kind == 1:
        q = q.copy(); q[..., 2] /= s['aspect']
        return sd_roundcone(q, s['ra'], s['rb'], max(s['len'], 1e-4))
    if kind == 2: return sd_roundbox(q, r, s['round'])
    if kind == 3: return q[..., 2]
    return s['amp'] * np.exp(-np.sum((q / r) ** 2, -1))

def head_sdf(P, shapes):
    d = None
    for s in shapes:
        x = head_prim(P, s); op = s['op']
        if op == 0: d = x if d is None else smin(d, x, s['k'])
        elif op == 1: d = smax(d, -x, s['k'])
        elif op == 2: d = smax(d, x, s['k'])
        else: d = d - x
    return d

def body_sdf(P, spec, v, part='core', blend=.03, shapes=None):
    d = None
    for sh in (shapes if shapes is not None else shapes_for(spec, v)):
        if sh['part'] != part: continue
        s = sdf(P, sh); d = s if d is None else smin(d, s, blend)
    return d

def core_sdf(P, spec, v, blend=.03, body_shapes=None, hshapes=None):
    """The core part: body (global blend) joined to the head block at the neck with the head's own neck_k."""
    body = body_sdf(P, spec, v, 'core', blend, body_shapes)
    head = head_sdf(P, hshapes if hshapes is not None else head_shapes(v))
    return smin(body, head, v['head']['neck_k'])

def part_sdf(P, spec, v, part, blend=.03):
    return core_sdf(P, spec, v, blend) if part == 'core' else body_sdf(P, spec, v, part, blend)

def mesh_part(spec, v, part, voxel, blend=.03):
    from skimage.measure import marching_cubes
    H, SH = v['height_m'], v['shoulder']
    (cx, cy, cz), (sx, sy, sz), side = BOX[part]
    f = SH if side else 1
    c = np.array([cx * H * f, cy * H, cz * H]); size = np.array([sx * H * f, sy * H, sz * H])
    n = np.maximum((size / voxel).astype(int), 2)
    axes = [np.linspace(c[i] - size[i] / 2, c[i] + size[i] / 2, n[i]) for i in range(3)]
    P = np.stack(np.meshgrid(*axes, indexing='ij'), -1)
    d = part_sdf(P, spec, v, part, blend)
    verts, faces, normals, _ = marching_cubes(d, 0.0, spacing=tuple((size / (n - 1))))
    verts += c - size / 2
    return verts, faces

if __name__ == '__main__':
    spec = json.load(open(os.path.join(HERE, 'body_shapes.json')))
    variant, out = sys.argv[1], sys.argv[2]; voxel = float(sys.argv[3]) if len(sys.argv) > 3 else .01
    v = spec['variants'][variant]
    lines, base = [], 1
    for part in ('core', 'arm_L', 'arm_R'):
        verts, faces = mesh_part(spec, v, part, voxel)
        lines.append('g ' + part)
        lines += ['v %.5f %.5f %.5f' % tuple(p) for p in verts]
        lines += ['f %d %d %d' % tuple(fc + base) for fc in faces]
        base += len(verts)
    open(out, 'w').write('\n'.join(lines) + '\n')
    print(out, base - 1, 'verts')
