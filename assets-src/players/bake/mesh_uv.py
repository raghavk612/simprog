"""OBJ in and out, and the UV unwrap (xatlas) of a Houdini player OBJ.

The Houdini OBJ has one vertex position per point, one normal per corner and one `vt` per point (point UVs, so no seams
can exist and closed parts overlap themselves; see analyse_source_uvs). We ignore those UVs and unwrap again:

* render vertices are (position, normal) pairs, as scripts/build_players.py makes them (normals rounded to 3 decimals);
* each face is classed visible or hidden by the game build's own drop rules (scripts/build_players.py is imported, not
  changed): garment triangles the opening clip removes, the jersey/shorts inner wall (inside_body), skin under the kit
  (covered_body), the feet inside the shoes and the paddle hand the modelled hand replaces. Hidden faces keep UVs, packed
  at HIDDEN_SCALE linear density, so every face stays valid if the build rules change;
* every OBJ group is a separate xatlas mesh (charts never cross parts) and all of them share one atlas, padded.
  About half the charts come back mirrored (UV winding opposite to the 3D winding); their tangents get w = -1, which glTF
  and three.js support. Reflecting them in place inside their bounding boxes was tried and overlaps other charts
  (xatlas nests small charts in the concavities of big ones), so they stay as packed.
"""
import importlib.util, math, os, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
HIDDEN_SCALE = .25

def game_build():
    """scripts/build_players.py as a module (its main block does not run on import)."""
    spec = importlib.util.spec_from_file_location('game_build_players', os.path.join(ROOT, 'scripts', 'build_players.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

# --- OBJ ----------------------------------------------------------------------------------------------------
def read_obj(path):
    """Positions (n, 3), source vt (m, 2) or None, normals (k, 3), and triangles as a list of
    (corner (pi, ti, ni) x 3, group, source face index). Polygons are fanned like build_players.read_obj."""
    v, vt, vn, tris, group = [], [], [], [], ''
    fi = 0
    with open(path) as fh:
        lines = fh.readlines()
    for line in lines:
        if line.startswith('v '): v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): vt.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('vn '): vn.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '): group = (line.split() + [''])[1]
        elif line.startswith('f '):
            idx = [tuple(int(x) - 1 if x else -1 for x in (t.split('/') + ['', ''])[:3]) for t in line.split()[1:]]
            for k in range(1, len(idx) - 1): tris.append(((idx[0], idx[k], idx[k + 1]), group, fi))
            fi += 1
    return np.array(v), (np.array(vt) if vt else None), np.array(vn), tris

class Mesh:
    """Render mesh: per vertex P, N, pos index (into the OBJ positions), group; per triangle indices, group, hidden."""
    def __init__(self, positions, normals, src_tris):
        key, P, N, pid, G = {}, [], [], [], []
        tris, tg, face = [], [], []
        for corners, g, fi in src_tris:
            t = []
            for (pi, ti, ni) in corners:
                n = normals[ni]
                k = (g, pi, tuple(np.round(n, 3)))
                if k not in key:
                    key[k] = len(P); P.append(positions[pi]); N.append(n); pid.append(pi); G.append(g)
                t.append(key[k])
            tris.append(t); tg.append(g); face.append(fi)
        self.positions = positions
        self.P = np.array(P, float); self.N = np.array(N, float)
        self.N /= np.maximum(np.linalg.norm(self.N, axis=1, keepdims=True), 1e-12)
        self.pid = np.array(pid); self.G = np.array(G)
        self.tris = np.array(tris, np.int64); self.tg = np.array(tg); self.face = np.array(face)
        self.hidden = np.zeros(len(tris), bool)
        self.groups = list(dict.fromkeys(tg))

def classify_hidden(mesh, spec, variant, sdf=None):
    """Marks the faces the game build drops (see module doc). Returns a dict of counts per reason."""
    bp = game_build()
    v = spec['variants'][variant]; H, SH = v['height_m'], v['shoulder']
    P, N, G = mesh.P, mesh.N, mesh.G
    tris = [(list(t), g) for t, g in zip(mesh.tris, mesh.tg)]
    hidden = np.zeros(len(tris), bool); why = {}
    # 1. clip_openings removes a garment triangle whose corners are all outside one opening shape
    clipped = np.zeros(len(tris), bool)
    for g, shapes in bp.opening_shapes(H, SH).items():
        m = mesh.tg == g
        for f in shapes:
            vals = f(P)[mesh.tris[m]]
            clipped[np.where(m)[0][(vals < 0).all(1)]] = True
    why['opening_clip'] = int(clipped.sum()); hidden |= clipped
    # 2. the paddle hand beyond the wrist (replaced by the modelled hand)
    J = bp.joints_for(spec, v)
    for side in ('L', 'R'):
        wr = J['wrist_' + side]; ax = J['hand_end_' + side] - wr; ax /= np.linalg.norm(ax)
        beyond = (P - wr) @ ax > .02 * H
        m = (mesh.tg == 'arm_' + side) & beyond[mesh.tris].all(1)
        why['hand_' + side] = int(m.sum()); hidden |= m
    # 3. garment inner wall, 4. skin under the kit, 5. feet inside the shoes
    inner = np.zeros(len(tris), bool); inner[list(bp.inside_body(P, N, G, tris, H))] = True
    why['inner_wall'] = int((inner & ~hidden).sum()); hidden |= inner
    gone = set(np.where(hidden)[0].tolist())
    cov = bp.covered_body(P, N, G, tris, H, .81 * H, gone)
    covered = (mesh.tg == 'core') & cov[mesh.tris].all(1)
    why['skin_under_kit'] = int((covered & ~hidden).sum()); hidden |= covered
    feet = (mesh.tg == 'core') & (P[mesh.tris].mean(1)[:, 1] < .07 * H)
    why['feet_in_shoes'] = int((feet & ~hidden).sum()); hidden |= feet
    # 6. buried in another part (not a game drop rule today, but nobody can see it): every corner and the centroid more
    # than BURIED metres inside a part that is always on the player. Catches the hairline cap of the short hair styles
    # and the headband (they are solids cut through the skull), the arm roots inside the shoulders, the tucked-in jersey.
    if sdf is not None:
        buried = buried_faces(mesh, sdf)
        why['buried_in_other_part'] = int((buried & ~hidden).sum()); hidden |= buried
    mesh.hidden = hidden
    return why

BURIED = .0015

def buried_faces(mesh, S):
    """Faces whose corners and centroid all lie more than BURIED inside the union of the other always-on parts."""
    from sdf_hi import AO_OCCLUDERS
    out = np.zeros(len(mesh.tris), bool)
    for g in mesh.groups:
        ids = np.where(mesh.tg == g)[0]
        others = tuple(p for p in AO_OCCLUDERS if p != g)
        pts = np.concatenate([mesh.P[mesh.tris[ids]].reshape(-1, 3), mesh.P[mesh.tris[ids]].mean(1)])
        d = S.scene(pts, others)
        inside = d < -BURIED
        out[ids] = inside[:3 * len(ids)].reshape(-1, 3).all(1) & inside[3 * len(ids):]
    return out

# --- unwrap ---------------------------------------------------------------------------------------------------
class Unwrapped:
    """The unwrapped mesh: vertices split at UV seams. src = render-mesh vertex each new vertex came from."""
    def __init__(self, mesh, src, uv, tris):
        self.src = src; self.UV = uv; self.tris = tris
        self.P = mesh.P[src]; self.N = mesh.N[src]; self.G = mesh.G[src]; self.pid = mesh.pid[src]
        self.tg = mesh.tg; self.hidden = mesh.hidden; self.face = mesh.face; self.groups = mesh.groups

def _generate(meshes, size, padding, tpu, chart_iters, max_cost=None, brute=False):
    import xatlas
    atlas = xatlas.Atlas()
    for pos, idx, nrm in meshes:
        atlas.add_mesh(pos.astype(np.float32), idx.astype(np.uint32), nrm.astype(np.float32))
    co = xatlas.ChartOptions(); co.max_iterations = chart_iters
    if max_cost is not None: co.max_cost = max_cost
    po = xatlas.PackOptions(); po.resolution = size; po.padding = padding; po.bilinear = True
    po.rotate_charts = True; po.texels_per_unit = tpu; po.bruteForce = bool(brute)
    atlas.generate(co, po)
    return atlas

def unwrap(mesh, size=2048, padding=4, hidden_scale=HIDDEN_SCALE, chart_iters=1, groups=None, log=print, max_cost=None,
           brute=False):
    """xatlas over every group (visible and hidden faces as separate meshes, hidden ones scaled down), packed into ONE
    size x size atlas: starts from xatlas's own density estimate and lowers it until everything fits one atlas.
    max_cost: xatlas's chart growth limit (default 2; larger = fewer, bigger charts, less padding); brute: xatlas's
    brute-force packing (denser, ~10x slower)."""
    groups = groups or mesh.groups
    parts = []   # (triangle ids, scale)
    for g in groups:
        for hid, s in ((False, 1.0), (True, hidden_scale)):
            ids = np.where((mesh.tg == g) & (mesh.hidden == hid))[0]
            if len(ids): parts.append((ids, s))
    meshes, local = [], []
    for ids, s in parts:
        used, inv = np.unique(mesh.tris[ids], return_inverse=True)
        meshes.append((mesh.P[used] * s, inv.reshape(-1, 3), mesh.N[used])); local.append(used)
    t0 = time.time(); tries = 0
    fits = lambda a: a.atlas_count == 1 and a.width <= size and a.height <= size
    atlas = _generate(meshes, size, padding, 0.0, chart_iters, max_cost, brute); tries += 1   # xatlas's own estimate
    if not fits(atlas):
        hi = atlas.texels_per_unit; tpu = hi
        while True:   # step down until it fits, then bisect between the last miss and the fit
            tpu *= .93
            atlas = _generate(meshes, size, padding, tpu, chart_iters, max_cost, brute); tries += 1
            if fits(atlas): break
            hi = tpu
        lo, best = tpu, atlas
        for _ in range(3):
            mid = .5 * (lo + hi)
            a = _generate(meshes, size, padding, mid, chart_iters, max_cost, brute); tries += 1
            if fits(a): lo, best = mid, a
            else: hi = mid
        atlas = best
    log('  xatlas: one %dx%d atlas at %.1f texels/m after %d runs' % (atlas.width, atlas.height, atlas.texels_per_unit, tries))
    src, uvs, tris = [], [], np.zeros((len(mesh.tris), 3), np.int64)
    base = 0
    for i, (ids, s) in enumerate(parts):
        vmap, idx, uv = atlas[i]
        src.append(local[i][vmap]); uvs.append(uv)
        tris[ids] = idx.reshape(-1, 3) + base; base += len(vmap)
    src = np.concatenate(src); uv = np.concatenate(uvs).astype(np.float64)
    # xatlas packs into width x height texels; express UVs in the full size x size texture
    uv[:, 0] *= atlas.width / size; uv[:, 1] *= atlas.height / size
    out = Unwrapped(mesh, src, uv, tris)
    out.stats = {'xatlas_s': round(time.time() - t0, 1), 'xatlas_runs': tries, 'charts': int(atlas.chart_count),
                 'atlas_px': [int(atlas.width), int(atlas.height)], 'texture_px': size, 'padding_px': padding,
                 'utilization': round(float(atlas.utilization), 3), 'texels_per_m_visible': round(float(atlas.texels_per_unit), 1),
                 'hidden_scale': hidden_scale}
    return out

def charts(uv, tris):
    """Chart label per triangle: connected components of the unwrapped mesh (UV vertices are not shared across charts)."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    n = len(uv); r = np.concatenate([tris[:, 0], tris[:, 1]]); c = np.concatenate([tris[:, 1], tris[:, 2]])
    _, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(n, n)), directed=False)
    return lab[tris[:, 0]], lab

# --- stats ----------------------------------------------------------------------------------------------------
def tri_areas(P, tris):
    return .5 * np.linalg.norm(np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]]), axis=1)

def uv_signed_areas(UV, tris):
    a, b, c = UV[tris[:, 0]], UV[tris[:, 1]], UV[tris[:, 2]]
    return .5 * ((b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (c[:, 0] - a[:, 0]) * (b[:, 1] - a[:, 1]))

def seam_stats(u, positions):
    """UV seams: interior mesh edges (by OBJ position index) whose two faces do not share both UV vertices. Edges split
    only for a hard normal (garment hems) are not counted: their UVs still match."""
    e = {}
    for t in u.tris:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            k = (min(u.pid[a], u.pid[b]), max(u.pid[a], u.pid[b]))
            e.setdefault(k, []).append(frozenset((int(a), int(b))))
    n = 0; length = 0.0; interior = 0
    for (pa, pb), uses in e.items():
        if len(uses) != 2: continue
        interior += 1
        if uses[0] != uses[1]:
            n += 1; length += float(np.linalg.norm(positions[pa] - positions[pb]))
    return {'seam_edges': n, 'interior_edges': interior, 'seam_length_m': round(length, 2)}

def density_stats(u, size):
    """Texel density per face: sqrt(texel area / surface area), texels per metre."""
    A = tri_areas(u.P, u.tris); UA = np.abs(uv_signed_areas(u.UV, u.tris)) * size * size
    ok = A > 1e-10
    dens = np.sqrt(UA[ok] / A[ok]); hid = u.hidden[ok]
    def summ(x, w):
        if not len(x): return None
        order = np.argsort(x); cw = np.cumsum(w[order]) / w.sum()
        q = lambda f: float(x[order][np.searchsorted(cw, f)])
        return {'p10': round(q(.1), 1), 'median': round(q(.5), 1), 'p90': round(q(.9), 1), 'mm_per_texel': round(1000 / q(.5), 2)}
    out = {'visible': summ(dens[~hid], A[ok][~hid]), 'hidden': summ(dens[hid], A[ok][hid]),
           'area_m2_visible': round(float(A[~u.hidden].sum()), 3), 'area_m2_hidden': round(float(A[u.hidden].sum()), 3),
           'per_group': {}}
    for g in u.groups:
        m = (u.tg[ok] == g) & ~hid
        if m.any(): out['per_group'][g] = summ(dens[m], A[ok][m])['median']
    return out

# --- write ----------------------------------------------------------------------------------------------------
def write_obj(path, u, positions, header=''):
    """OBJ with the source positions (same indices as the Houdini OBJ, so build_players welds the same points), one vt and
    one vn per unwrapped vertex, the source groups and the source face order. vt is OpenGL style (v up)."""
    lines = ['# Kangs player with baked-atlas UVs (assets-src/players/bake/bake.py). ' + header,
             '# vt: v up (OBJ/OpenGL). glTF TEXCOORD_0 = (u, 1 - v). Tangents (MikkTSpace-style, w = handedness) per vt',
             '# are in the matching .tangents.npy (float32 [n_vt, 4]).']
    lines += ['v %.7g %.7g %.7g' % tuple(p) for p in positions]
    lines += ['vt %.7f %.7f' % tuple(t) for t in u.UV]
    lines += ['vn %.5f %.5f %.5f' % tuple(n) for n in u.N]
    order = np.argsort(u.face, kind='stable')
    group = None
    for ti in order:
        g = u.tg[ti]
        if g != group: lines.append('g ' + g); group = g
        lines.append('f ' + ' '.join('%d/%d/%d' % (u.pid[k] + 1, k + 1, k + 1) for k in u.tris[ti]))
    with open(path, 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
