"""Fast preview of a Kangs body without Houdini: evaluates the same smooth-union SDF as the Houdini builder
(houdini/build_players.py) on a grid and meshes it with marching cubes. For tuning body_shapes.json only;
the shipped meshes come from Houdini.
Usage: python3 preview_body.py <variant> <out.obj> [voxel_m]   (needs numpy and scikit-image)
"""
import json, math, os, sys
import numpy as np
from skimage.measure import marching_cubes

HERE = os.path.dirname(os.path.abspath(__file__))
BOX = {'core': ((0, .5, .02), (.34, 1.04, .26), False), 'arm_L': ((.123, .61, .005), (.11, .5, .12), True), 'arm_R': ((-.123, .61, .005), (.11, .5, .12), True)}

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
            out.append(dict(part=s['part'], kind=0, c=pos(s['c'], s['sx']), basis=rot_matrix(s['rot']).T, r=r))
        else:
            a, b = pos(s['a'], s['sx']), pos(s['b'], s['sx'])
            ra, rb = s['ra'] * k * H, s['rb'] * k * H
            if s['sx']: ra *= SH ** .25; rb *= SH ** .25
            d = b - a; L = np.linalg.norm(d); d = d / L
            xa = np.array([1., 0, 0]) if abs(d[1]) > .7 else (np.array([0., 1, 0]) if abs(d[0]) < .7 else np.array([0., 0, 1]))
            xa = xa - d * xa.dot(d); xa /= np.linalg.norm(xa); za = np.cross(xa, d); za /= np.linalg.norm(za)
            if za[2] < 0 and abs(d[1]) > .7: za = -za
            out.append(dict(part=s['part'], kind=1, c=a, basis=np.stack([xa, d, za], 1), ra=ra, rb=rb, L=L, aspect=s['aspect']))
    return out

def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * .25

def sdf(P, sh):
    q = (P - sh['c']) @ sh['basis']
    if sh['kind'] == 0:
        r = sh['r']; k0 = np.linalg.norm(q / r, axis=-1); k1 = np.linalg.norm(q / (r * r), axis=-1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-6)
    q = q.copy(); q[..., 2] /= sh['aspect']
    r1, r2, h = sh['ra'], sh['rb'], max(sh['L'], 1e-4)
    b = (r1 - r2) / h; a = math.sqrt(max(1 - b * b, 1e-6))
    w0 = np.hypot(q[..., 0], q[..., 2]); w1 = q[..., 1]
    k = -b * w0 + a * w1
    d1 = np.hypot(w0, w1) - r1; d2 = np.hypot(w0, w1 - h) - r2; d3 = a * w0 + b * w1 - r1
    return np.where(k < 0, d1, np.where(k > a * h, d2, d3))

def mesh_part(spec, v, part, voxel, blend=.03):
    H, SH = v['height_m'], v['shoulder']
    (cx, cy, cz), (sx, sy, sz), side = BOX[part]
    f = SH if side else 1
    c = np.array([cx * H * f, cy * H, cz * H]); size = np.array([sx * H * f, sy * H, sz * H])
    n = np.maximum((size / voxel).astype(int), 2)
    axes = [np.linspace(c[i] - size[i] / 2, c[i] + size[i] / 2, n[i]) for i in range(3)]
    P = np.stack(np.meshgrid(*axes, indexing='ij'), -1)
    d = None
    for sh in shapes_for(spec, v):
        if sh['part'] != part: continue
        s = sdf(P, sh); d = s if d is None else smin(d, s, blend)
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
