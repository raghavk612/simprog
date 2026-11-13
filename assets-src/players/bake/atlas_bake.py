"""Production bake of the game's players: the final GLB triangles (scripts/build_players.py), unwrapped into three atlases
per variant, with a tangent-space normal map and ambient occlusion baked from the high-detail SDF (sdf_hi + detail.py) and
D1's cloud-meshed parts (cloudmesh: hands, sneakers, afro, the reshaped forearm).

scripts/build_players.py calls this; it is not run on its own:
    unwrap(P, N, G, tris, groups)       -> Layout: per output vertex its source vertex, atlas, UV (v up) and tangent (xyz, w)
    bake(variant, P, N, layout, trim)   -> writes public/models/players/maps/<variant>_<atlas>[_1k].png

Atlases (one RGBA PNG each: normal in RGB, OpenGL / glTF green up, AO in A; 8 px padding between charts):
    skin  2048 (High) and a 1024 copy (_1k, Medium): body, head, arms, hands
    kit   1024: jersey, shorts, sleeves, headband, the binding trim
    gear  1024: sneakers (upper and midsole) and all four hair styles
The normal is baked at the atlas size, the AO at half of it and upsampled (it is low-frequency). Tangents are computed
once, here, on the final triangles, and written to the GLB as they are: the map is only right for the frame it was baked
in, so nothing may recompute them afterwards (scripts/player_lods.mjs reuses the vertex buffers).
Deterministic: xatlas, the seeded detail functions and the chunked worker pool give the same bytes on every run (the
results do not depend on --jobs).
"""
import hashlib, json, os, sys, time, types
import multiprocessing as mp
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PLAYERS = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(PLAYERS))
for p in (HERE, PLAYERS):
    if p not in sys.path: sys.path.insert(0, p)
import bake as proto, mesh_uv, raster, sdf_hi  # noqa: E402  (bake.py: the prototype's search and AO)
import detail as dt  # noqa: E402

MAPS = os.path.join(ROOT, 'public', 'models', 'players', 'maps')
ATLASES = {'skin': ('core', 'arm_L', 'arm_R', 'hand_L', 'hand_R'),
           'kit': ('jersey', 'shorts', 'sleeve_arm', 'sleeve_leg', 'headband', 'trim'),
           'gear': ('shoes', 'shoes_sole', 'hair_buzz', 'hair_crop', 'hair_afro', 'hair_rows')}
ATLAS_NAMES = tuple(ATLASES)
SIZE = {'skin': 2048, 'kit': 1024, 'gear': 1024}
SMALL = {'skin': 1024}       # extra downsampled copies (<variant>_<atlas>_1k.png) for Medium
PADDING = 8
AO_DIV = 2                   # AO resolution = atlas size / AO_DIV
CHUNK = 20000
MIN_FACING = .3              # a baked normal more than ~73 deg off the low-poly one (thin slivers, cut caps) is not used
FOOT_CUT = .05               # of H: the bare foot inside the sneaker is not an occluder (it pokes through the toe box)


def atlas_of(group):
    for a, gs in ATLASES.items():
        if group in gs: return a
    raise KeyError(group)


def map_file(variant, atlas, small=False):
    return '%s_%s%s.png' % (variant, atlas, '_1k' if small else '')


# --- unwrap ----------------------------------------------------------------------------------------------------------------
class Layout:
    """The unwrapped mesh. Per output vertex: src (index into the build's vertex arrays), atlas (index into ATLAS_NAMES),
    uv (v up, 0..1 in its atlas), T (tangent) and w (handedness); tris (m, 3) into the output vertices, in the build's
    triangle order."""
    def __init__(self, src, atlas, uv, T, w, tris, stats):
        self.src, self.atlas, self.uv, self.T, self.w, self.tris, self.stats = src, atlas, uv, T, w, tris, stats

    def uv_hash(self):
        """A fingerprint of the layout (UVs, triangles, atlas per vertex). The GLB and the maps' manifest both carry it, so
        a test can tell when the GLB was rebuilt without re-baking the maps."""
        h = hashlib.sha1()
        for a in (np.round(self.uv, 6).astype(np.float32), self.tris.astype(np.int32), self.atlas.astype(np.int8)):
            h.update(np.ascontiguousarray(a).tobytes())
        return h.hexdigest()[:16]


MAX_COST = 4.0               # xatlas chart growth (default 2): fewer, larger charts lose less to the padding
BRUTE = {'kit': True, 'gear': True}   # brute-force packing: +5-8 % density there for ~15 s; nothing on skin for ~4 min

def buried_faces(P, tris, groups, variant):
    """Faces the game keeps but nobody sees, packed at mesh_uv.HIDDEN_SCALE density: every corner and the centroid more than
    mesh_uv.BURIED inside another always-on part (skin under the jersey and shorts, the tucked jersey, the arm roots in the
    shoulders, the inside of the trim tube). Not the hands: the strip past the forearm's cut is inside the forearm's field
    but in front of its sunk mesh."""
    S = player_sdf(variant, use_detail=False)
    out = np.zeros(len(tris), bool)
    for g in np.unique(groups):
        if g.startswith('hand_'): continue
        ids = np.where(groups == g)[0]
        others = tuple(p for p in OCCLUDERS if p != g and not (g.startswith('shoes') and p == 'shoes'))
        pts = np.concatenate([P[tris[ids]].reshape(-1, 3), P[tris[ids]].mean(1)])
        inside = S.scene(pts, others) < -mesh_uv.BURIED
        out[ids] = inside[:3 * len(ids)].reshape(-1, 3).all(1) & inside[3 * len(ids):]
    return out


def unwrap(P, N, G, tris, groups, variant=None, log=print):
    """xatlas per atlas (each OBJ group a separate mesh, so charts never cross parts), packed with PADDING at the largest
    density that fits (mesh_uv.unwrap), buried faces at a quarter density, then MikkTSpace-style tangents
    (raster.tangents) per atlas. P, N, G: the build's vertex arrays; tris (m, 3); groups (m,) the group of each triangle;
    variant: for the buried test (None: every face counts as seen)."""
    tris = np.asarray(tris, np.int64); groups = np.asarray(groups).astype(str)
    hidden = buried_faces(P, tris, groups, variant) if variant else np.zeros(len(tris), bool)
    out_src, out_atlas, out_uv, out_T, out_w = [], [], [], [], []
    out_tris = np.zeros((len(tris), 3), np.int64); base = 0; stats = {}
    for ai, name in enumerate(ATLAS_NAMES):
        ids = np.where(np.isin(groups, ATLASES[name]))[0]
        if not len(ids): continue
        present = [g for g in ATLASES[name] if (groups[ids] == g).any()]
        m = types.SimpleNamespace(P=P, N=N, G=np.asarray(G), pid=np.arange(len(P)), tris=tris[ids], tg=groups[ids],
                                  hidden=hidden[ids], face=np.arange(len(ids)), groups=present)
        u = mesh_uv.unwrap(m, SIZE[name], padding=PADDING, log=lambda s, name=name: log('  [%s]%s' % (name, s)),
                           max_cost=MAX_COST, brute=BRUTE.get(name, False))
        T, w = raster.tangents(u.P, u.N, u.UV, u.tris)
        out_src.append(u.src); out_atlas.append(np.full(len(u.src), ai)); out_uv.append(u.UV); out_T.append(T); out_w.append(w)
        out_tris[ids] = u.tris + base; base += len(u.src)
        dens = mesh_uv.density_stats(u, SIZE[name])
        stats[name] = dict(u.stats, density=dens['per_group'], hidden_faces=int(hidden[ids].sum()),
                           mm_per_texel=dens['visible']['mm_per_texel'], handedness_w_minus=int((w < 0).sum()))
    return Layout(np.concatenate(out_src), np.concatenate(out_atlas), np.concatenate(out_uv), np.concatenate(out_T),
                  np.concatenate(out_w), out_tris, stats)


# --- the SDF the bake searches -----------------------------------------------------------------------------------------------
def cloud():
    import cloudmesh
    return cloudmesh


def hand_layout(H):
    """detail.HandLayout from D1's capsules (cloudmesh.hand), so knuckles, creases and nails sit on the meshed joints."""
    from cloudmesh import hand
    HL = hand.HAND_LENGTH * H; digits = {}
    for name in hand.FINGERS:
        J, R = hand.finger_chain(name, HL)
        D = []
        for i in range(3):   # each finger flexes in the plane of its splay direction and +z: dorsal = +z square to the bone
            a = J[i + 1] - J[i]; a /= np.linalg.norm(a)
            d = np.array([0, 0, 1.0]) - a * a[2]; D.append(d / np.linalg.norm(d))
        digits[name] = dict(joints=J, radii=R, dorsal=np.array(D))
    J, R = hand.thumb_chain(HL); D = []
    for i in range(3):
        a = J[i + 1] - J[i]; a /= np.linalg.norm(a)
        d = np.array([.75, 0, .66]) - a * (a @ np.array([.75, 0, .66])); D.append(d / np.linalg.norm(d))
    digits['thumb'] = dict(joints=J, radii=R, dorsal=np.array(D))
    return dt.HandLayout(digits)


class SneakerLayout(dt.ShoeLayout):
    """detail.ShoeLayout for D1's sneaker: its exact midsole top line (cloudmesh.shoe.stack_top) and dimensions."""
    def __init__(self, H):
        from cloudmesh import shoe
        self._shoe, self._H = shoe, H
        SL = shoe.LENGTH * H; mm = shoe._mm(H)
        upper = lambda y, z: shoe.upper_sdf(np.stack([np.full_like(y, .014 + 14 * mm), y, np.full_like(y, z)], -1), H)
        ys = np.linspace(.2, 0, 2001); d = upper(ys, .56 * SL)
        instep = float(ys[np.argmax(d < 0)])         # the upper's surface beside the throat, at .56 of the length
        super().__init__(length=SL, half_width=.18 * SL, heel_stack=shoe.HEEL_STACK * mm, fore_stack=shoe.FORE_STACK * mm,
                         outsole=4 * mm, toe_spring=shoe.TOE_SPRING * mm, instep_y=instep - 8 * mm,
                         collar_y=shoe.COLLAR['back'] * mm)

    def sole_y(self, z):
        return self._shoe.stack_top(np.asarray(z, float), self.length, self._shoe._mm(self._H))


class TrimSDF:
    """The binding round the jersey and shorts openings (build_players.add_trim): round tubes along the swept centre lines.
    Its 5-sided mesh bakes round."""
    def __init__(self, tubes):
        from scipy.spatial import cKDTree
        A, B, R = [], [], []
        for c, closed, r in tubes:
            c = np.asarray(c, float); nxt = np.roll(c, -1, 0) if closed else c[1:]
            A.append(c[:len(nxt)]); B.append(nxt); R.append(np.full(len(nxt), r))
        self.A, self.B, self.R = np.vstack(A), np.vstack(B), np.concatenate(R)
        self.tree = cKDTree(.5 * (self.A + self.B))

    def __call__(self, P):
        P = np.asarray(P, float); sh = P.shape[:-1]; Q = P.reshape(-1, 3)
        _, k = self.tree.query(Q, k=min(8, len(self.A)))
        a, b = self.A[k], self.B[k]; ab = b - a
        t = np.clip(((Q[:, None] - a) * ab).sum(-1) / np.maximum((ab * ab).sum(-1), 1e-12), 0, 1)
        d = np.linalg.norm(Q[:, None] - (a + ab * t[..., None]), axis=-1) - self.R[k]
        return d.min(1).reshape(sh)


def player_sdf(variant, trim_tubes=None, use_detail=True):
    """sdf_hi.PlayerSDF with D1's parts wired in: the arms as the GLB has them (arm_sdf), the hands, sneakers and afro in
    their own frames with their layouts, the sneakers' union as the 'shoes' occluder, the bare leg above the shoes, and
    the trim tube."""
    cm = cloud()
    S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), variant, dt.detail if use_detail else None)
    H = S.H
    for side in ('L', 'R'):
        S.add_override('arm_' + side, lambda P, side=side: cm.arm_sdf(variant, side, P))
    hl = hand_layout(H)
    for name in ('hand_L', 'hand_R'):
        o, R = cm.part_frame(variant, name)
        S.add_local_part(name, lambda Q, name=name: cm.local_sdf(variant, name, Q), o, R.T, layout=hl)
    sl = SneakerLayout(H)
    for name in ('shoe_L', 'shoe_R'):
        o, R = cm.part_frame(variant, name)
        S.add_local_part(name, lambda Q: cm.shoe.shoe_local_sdf(Q, H), o, R.T, layout=sl)
    O, _ = cm.part_frame(variant, 'hair_afro')
    S.add_local_part('hair_afro', lambda Q: cm.part_sdf(variant, 'hair_afro', Q + O), O, np.eye(3))
    S.add_override('shoes', lambda P: np.minimum(S.sdf('shoe_L', P), S.sdf('shoe_R', P)))
    S.add_override('legs', lambda P: np.maximum(S.core(P), FOOT_CUT * H - np.asarray(P)[..., 1]))
    if trim_tubes:
        S.add_override('trim', TrimSDF(trim_tubes))
    return S


def bake_part(group, P0):
    """The SDF part a texel of an OBJ group is baked against: the sneakers per foot (x > 0 is the player's left)."""
    if group in ('shoes', 'shoes_sole'):
        return np.where(P0[:, 0] >= 0, 'shoe_L', 'shoe_R')
    return np.full(len(P0), group, dtype=object)


OCCLUDERS = ('core', 'arm_L', 'arm_R', 'jersey', 'shorts', 'shoes')

STILL = ('core', 'jersey', 'shorts', 'shoes')   # what stays put relative to itself in every pose

def ao_parts(part):
    """What occludes a texel of `part` (the part itself with its detail, for cavity AO). The arms and hands swing freely in
    the game, so they occlude only themselves: baked from the rest pose they would print an arm and a hand on the shorts
    and the jersey's sides, and darken the inside of the arm against the torso, whatever the pose (GTAO adds the contact
    shadows that really are there on High). A sneaker is occluded by both sneakers and the leg above them."""
    if part.startswith('hand_'): return (part, 'arm_' + part[-1])
    if part in ('arm_L', 'arm_R'): return (part, 'jersey')
    if part == 'sleeve_arm': return ('arm_R', 'jersey', part)
    if part.startswith('shoe_'): return ('legs', 'jersey', 'shorts', 'shoe_L', 'shoe_R')
    return STILL + (() if part in STILL else (part,))


# --- worker pool ----------------------------------------------------------------------------------------------------------
_S, _SETUP = None, None

def _init():
    global _S
    variant, tubes, use_detail = _SETUP
    _S = player_sdf(variant, tubes, use_detail)


def _work(task):
    kind, part, P0, N0 = task
    S = _S
    t, hit, Ph, nh = proto.surface_normals(lambda P, n: S.sdf_hi(part, P, n), P0, N0)
    if kind == 'normal':
        return t, hit, nh
    ao = proto.ambient_occlusion(lambda Q: S.scene(Q, ao_parts(part), hi_part=part, n=N0), Ph, nh)
    return t, hit, ao


def run(kind, parts, P0, N0, pool):
    tasks, where = [], []
    for part in sorted(set(parts.tolist())):
        idx = np.where(parts == part)[0]
        for k in range(0, len(idx), CHUNK):
            sel = idx[k:k + CHUNK]; tasks.append((kind, str(part), P0[sel], N0[sel])); where.append(sel)
    res = pool.map(_work, tasks, chunksize=1) if pool else [_work(t) for t in tasks]
    n = len(P0); t = np.zeros(n); hit = np.zeros(n, bool)
    val = np.zeros((n, 3)) if kind == 'normal' else np.zeros(n)
    for sel, (tt, hh, vv) in zip(where, res):
        t[sel], hit[sel], val[sel] = tt, hh, vv
    return t, hit, val


# --- images ----------------------------------------------------------------------------------------------------------------
def upsample(img, size):
    """Bilinear, texel centres aligned: a (s, s) image to (size, size)."""
    from scipy.ndimage import map_coordinates
    s = img.shape[0]; f = s / size
    c = (np.arange(size) + .5) * f - .5
    rr, cc = np.meshgrid(c, c, indexing='ij')
    return map_coordinates(img, [rr, cc], order=1, mode='nearest')


def downsample(rgba):
    """Half size: the tangent-space normals averaged and renormalised, the AO averaged."""
    n = rgba[..., :3].astype(np.float64) / 255 * 2 - 1
    a = rgba[..., 3].astype(np.float64)
    h = rgba.shape[0] // 2
    n = n.reshape(h, 2, h, 2, 3).mean((1, 3)); n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)
    a = a.reshape(h, 2, h, 2).mean((1, 3))
    return np.concatenate([raster.to_rgb8(n), np.clip(np.round(a), 0, 255).astype(np.uint8)[..., None]], -1)


def save_png(path, rgba):
    from PIL import Image
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(path, optimize=True, compress_level=9)
    return os.path.getsize(path)


# --- the bake -------------------------------------------------------------------------------------------------------------
def bake(variant, P, N, G, layout, trim_tubes=None, out=MAPS, jobs=None, use_detail=True, log=print):
    """Bakes and writes the three atlases (and the Medium copy of skin) for one variant. P, N, G: the build's vertex arrays
    (the layout's src indexes them). Returns stats (also merged into out/manifest.json)."""
    global _SETUP
    T0 = time.time(); times = {}
    def lap(name, t):
        times[name] = round(time.time() - t, 1); log('  %-16s %6.1f s   (peak RSS %.0f MB)' % (name, times[name], proto.maxrss_mb()))
    V = P[layout.src]; Nv = N[layout.src]; Gv = np.asarray(G)[layout.src]
    Bv = raster.bitangents(Nv, layout.T, layout.w)
    tri_atlas = layout.atlas[layout.tris[:, 0]]
    tri_group = Gv[layout.tris[:, 0]]
    t = time.time(); R = {}
    for ai, name in enumerate(ATLAS_NAMES):
        sel = np.where(tri_atlas == ai)[0]
        if not len(sel): continue
        tris = layout.tris[sel]; size = SIZE[name]
        r = {}
        for key, sz in (('n', size), ('ao', size // AO_DIV)):
            tid, bary = raster.rasterize(layout.uv, tris, sz)
            mask = tid >= 0
            P0 = raster.interpolate(V, tris, tid, bary); N0 = raster._unit(raster.interpolate(Nv, tris, tid, bary))
            g = tri_group[sel][tid[mask]]
            parts = np.empty(len(P0), dtype=object)
            for gg in np.unique(g):
                m = g == gg; parts[m] = bake_part(gg, P0[m])
            r[key] = dict(mask=mask, P0=P0, N0=N0, parts=parts.astype(str))
            if key == 'n':
                r[key]['T'] = raster.interpolate(layout.T, tris, tid, bary); r[key]['B'] = raster.interpolate(Bv, tris, tid, bary)
        R[name] = r
    lap('rasterise', t)
    _SETUP = (variant, trim_tubes, use_detail)
    jobs = jobs or os.cpu_count()
    pool = mp.get_context('fork').Pool(jobs, _init) if jobs > 1 else None
    if pool is None: _init()
    stats = {'variant': variant, 'unwrap': layout.stats, 'atlases': {}}
    try:
        cat = lambda key, f: np.concatenate([R[a][key][f] for a in R])
        cut = np.cumsum([0] + [len(R[a]['n']['P0']) for a in R])
        t = time.time(); tt, hit, nh = run('normal', cat('n', 'parts'), cat('n', 'P0'), cat('n', 'N0'), pool); lap('normal search', t)
        cut2 = np.cumsum([0] + [len(R[a]['ao']['P0']) for a in R])
        t = time.time(); _, hit2, ao = run('ao', cat('ao', 'parts'), cat('ao', 'P0'), cat('ao', 'N0'), pool); lap('ao', t)
    finally:
        if pool: pool.close(); pool.join()
    files = {}
    for k, name in enumerate(R):
        r = R[name]['n']; size = SIZE[name]; s = slice(cut[k], cut[k + 1])
        n_hi, ok_hit, N0 = nh[s], hit[s], r['N0']
        facing = (n_hi * N0).sum(1)
        bad = ~ok_hit | (facing < MIN_FACING)
        n_use = np.where(bad[:, None], N0, n_hi)
        rgb = raster.to_rgb8(raster.encode(n_use, r['T'], r['B'], N0))
        img = np.zeros((size, size, 3), np.uint8); img[:] = (128, 128, 255); img[r['mask']] = rgb
        img = raster.dilate(img, r['mask'])
        a = R[name]['ao']; s2 = slice(cut2[k], cut2[k + 1]); sz = size // AO_DIV
        aoimg = np.ones((sz, sz)); aoimg[a['mask']] = ao[s2]
        aoimg = upsample(raster.dilate(aoimg, a['mask']), size)
        rgba = np.concatenate([img, np.clip(np.round(aoimg * 255), 0, 255).astype(np.uint8)[..., None]], -1)
        files[map_file(variant, name)] = save_png(os.path.join(out, map_file(variant, name)), rgba)
        if name in SMALL:
            small = rgba
            while small.shape[0] > SMALL[name]: small = downsample(small)
            files[map_file(variant, name, True)] = save_png(os.path.join(out, map_file(variant, name, True)), small)
        vis = np.ones(len(N0), bool)
        stats['atlases'][name] = {
            'px': size, 'texels': int(r['mask'].sum()), 'coverage': round(float(r['mask'].mean()), 3),
            'search_miss': round(float((~ok_hit).mean()), 5), 'flat_fallback': round(float(bad.mean()), 5),
            'offset_mm_p50_p99': [round(float(np.percentile(np.abs(tt[s][vis]) * 1000, q)), 2) for q in (50, 99)],
            'deviation_deg_p50_p99': [round(float(np.percentile(np.degrees(np.arccos(np.clip(facing, -1, 1))), q)), 2) for q in (50, 99)],
            'ao_px': sz, 'ao_mean_p5_p50': [round(float(x), 3) for x in (ao[s2].mean(), np.percentile(ao[s2], 5), np.percentile(ao[s2], 50))],
            'ao_per_part_mean': {p: round(float(ao[s2][a['parts'] == p].mean()), 3) for p in sorted(set(a['parts'].tolist()))}}
    stats.update(files=files, uvHash=layout.uv_hash(), times_s=times, total_s=round(time.time() - T0, 1), jobs=jobs,
                 peak_rss_mb=proto.maxrss_mb())
    write_manifest(out, variant, {'uvHash': stats['uvHash'], 'files': files,
                                  'sizes': {a: SIZE[a] for a in R}, 'small': {a: SMALL[a] for a in SMALL if a in R}})
    log('  total %.1f s' % stats['total_s'])
    return stats


def write_manifest(out, variant, entry):
    path = os.path.join(out, 'manifest.json')
    m = json.load(open(path)) if os.path.exists(path) else {}
    m[variant] = entry
    os.makedirs(out, exist_ok=True)
    with open(path, 'w') as fh:
        json.dump(dict(sorted(m.items())), fh, indent=1, sort_keys=True); fh.write('\n')


def manifest(out=MAPS):
    path = os.path.join(out, 'manifest.json')
    return json.load(open(path)) if os.path.exists(path) else {}
