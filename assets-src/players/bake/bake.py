"""Prototype texture baker for the Kangs players: UV atlas, tangent-space normal map and AO, from the SDF, in numpy.

  python3 assets-src/players/bake/bake.py [variant ...] [--size 2048] [--ao-size 1024] [--jobs N]

For each variant (default: all three) it reads assets-src/players/houdini/export/kangs_<variant>.obj and writes to
assets-src/players/bake/out/:
  kangs_<variant>_uv.obj            the same mesh, groups and face order, with atlas UVs (vt, v up)
  kangs_<variant>_uv.tangents.npy   float32 [n_vt, 4]: tangent xyz and handedness w for each vt (the frame the maps use)
  kangs_<variant>_uv.hidden.npy     bool [n_faces]: faces the game never shows (packed small; see mesh_uv.classify_hidden)
  kangs_<variant>_normal.png        tangent-space normal map (RGB, OpenGL/glTF: green up), size x size
  kangs_<variant>_ao.png            ambient occlusion (grey), ao-size x ao-size
  kangs_<variant>_uvlayout.png      the atlas coloured by part (for looking at)
  kangs_<variant>_bake.json         stats: timings, memory, texel density, seams, search misses, round-trip error
Steps: unwrap (mesh_uv) -> rasterise (raster) -> per texel search along the low-poly normal for the high-detail SDF
surface (sdf_hi + detail) within +-8 mm, its gradient = high-detail normal -> encode in the texel's tangent frame ->
AO by marching the SDF -> dilate past the seams -> PNG. Needs numpy, scipy, Pillow, xatlas.
"""
import argparse, json, os, resource, sys, time
import multiprocessing as mp
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import detail as detail_mod  # noqa: E402
import mesh_uv, raster, sdf_hi  # noqa: E402

SRC = os.path.join(os.path.dirname(HERE), 'houdini', 'export')
OUT = os.path.join(HERE, 'out')
SEARCH = .008      # metres either side of the low-poly surface
HIT_TOL = 2e-5     # |sdf| at an accepted hit (20 microns)
CHUNK = 20000

# --- surface search ------------------------------------------------------------------------------------------------
def find_surface(f, P0, n, max_t=SEARCH, iters=8, tol=HIT_TOL):
    """Per point, a root of g(t) = f(P0 + t n) in [-max_t, max_t], normally the one nearest t = 0: a unit-slope step
    t = -g(0), then secant steps, safeguarded by bisection once samples of both signs bracket a root.
    f(P, n) -> sdf. Returns t, |g(t)| and the hit mask |g| <= tol."""
    k = len(P0)
    g = lambda idx, t: f(P0[idx] + t[:, None] * n[idx], n[idx])
    all_ = np.arange(k)
    ta = np.zeros(k); fa = g(all_, ta)
    tb = np.clip(-fa, -max_t, max_t); fb = g(all_, tb)
    best_t = np.where(np.abs(fb) < np.abs(fa), tb, ta); best_f = np.minimum(np.abs(fa), np.abs(fb))
    lo = np.where(fb < 0, tb, np.where(fa < 0, ta, np.nan))     # latest sample with g < 0
    hi = np.where(fb >= 0, tb, np.where(fa >= 0, ta, np.nan))   # latest sample with g >= 0
    act = np.where(best_f > tol)[0]
    for _ in range(iters):
        if not len(act): break
        a, fa_, b, fb_ = ta[act], fa[act], tb[act], fb[act]
        den = fb_ - fa_
        ok = np.abs(den) > 1e-12
        t = np.where(ok, b - fb_ * (b - a) / np.where(ok, den, 1), b - fb_)
        l, h = lo[act], hi[act]
        br = ~np.isnan(l) & ~np.isnan(h)
        out = br & ~((t - l) * (t - h) < 0)                     # secant left the bracket: bisect
        t = np.where(out, .5 * (l + h), t)
        t = np.clip(t, -max_t, max_t)
        ft = g(act, t)
        ta[act], fa[act], tb[act], fb[act] = b, fb_, t, ft
        lo[act] = np.where(ft < 0, t, l); hi[act] = np.where(ft >= 0, t, h)
        better = np.abs(ft) < best_f[act]
        best_t[act[better]] = t[better]; best_f[act[better]] = np.abs(ft[better])
        act = act[best_f[act] > tol]
    return best_t, best_f, best_f <= tol

def surface_normals(f, P0, N0):
    """The high-detail surface point and normal for texels at P0 with low-poly normals N0: search along N0 for the
    zero of f(P, n), then the normalised gradient of f there. Returns t, hit mask, the point and the normal."""
    t, _, hit = find_surface(f, P0, N0)
    Ph = P0 + t[:, None] * N0
    return t, hit, Ph, sdf_hi.gradient(lambda Q: f(Q, N0), Ph)

def encode_texels(nh, Tt, Bt, N0):
    """High-detail normals -> 8-bit RGB in each texel's tangent frame (three.js / glTF convention, see raster.py)."""
    return raster.to_rgb8(raster.encode(nh, Tt, Bt, N0))

# --- ambient occlusion -----------------------------------------------------------------------------------------------
AO_STEPS = (.006, .012, .02, .03, .045)   # classic SDF AO: samples along the normal (metres), weights .75^i
AO_CONE_TILT = np.radians(55)             # long-range cones round the normal (under the arms, between the legs)
AO_CONE_DIRS = 6
AO_CONE_DIST = (.04, .08, .14)
AO_CONE_TAN = .5                          # cone half-angle ~27 deg: visibility = min(d / (tan * s))

def frame(n):
    helper = np.where(np.abs(n[:, :1]) < .9, [[1.0, 0, 0]], [[0, 1.0, 0]])
    t1 = np.cross(n, helper); t1 /= np.linalg.norm(t1, axis=1, keepdims=True)
    return t1, np.cross(n, t1)

def ambient_occlusion(f, P, n):
    """AO in [0, 1] (1 = open) at surface points P with normals n, f(P) the scene SDF. Short range: how far the SDF along
    the normal falls short of the distance travelled. Long range: soft cone visibility along tilted directions."""
    w = .75 ** np.arange(len(AO_STEPS))
    occ = np.zeros(len(P))
    for wi, h in zip(w, AO_STEPS):
        occ += wi * np.clip((h - f(P + n * h)) / h, 0, 1)
    short = 1 - occ / w.sum()
    t1, t2 = frame(n)
    vis = np.zeros(len(P))
    for k in range(AO_CONE_DIRS):
        phi = 2 * np.pi * (k + .5) / AO_CONE_DIRS
        d = n * np.cos(AO_CONE_TILT) + np.sin(AO_CONE_TILT) * (np.cos(phi) * t1 + np.sin(phi) * t2)
        v = np.ones(len(P))
        for s in AO_CONE_DIST:
            v = np.minimum(v, np.clip(f(P + d * s) / (AO_CONE_TAN * s), 0, 1))
        vis += v
    return np.clip(short * vis / AO_CONE_DIRS, 0, 1)

# --- per-chunk work (runs in worker processes) ----------------------------------------------------------------------
_S = None

def _init(variant, use_detail):
    global _S
    _S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), variant, detail_mod.detail if use_detail else None)

def _work(task):
    kind, part, P0, N0 = task
    S = _S
    t, hit, Ph, nh = surface_normals(lambda P, n: S.sdf_hi(part, P, n), P0, N0)
    flip = (nh * N0).sum(1) < 0            # the gradient points out of the part's solid; the low-poly normal should agree
    if kind == 'normal':
        return t, hit, nh, flip
    parts = sdf_hi.AO_OCCLUDERS + ((part,) if part not in sdf_hi.AO_OCCLUDERS else ())
    ao = ambient_occlusion(lambda Q: S.scene(Q, parts, hi_part=part, n=N0), Ph, nh)
    # buried: the texel lies inside another always-on part (cut caps of hair and sleeves, arm roots): never seen
    others = tuple(p for p in sdf_hi.AO_OCCLUDERS if p != part)
    buried = S.scene(Ph, others) < -mesh_uv.BURIED
    return t, hit, ao, buried

def run_tasks(kind, parts_of_texel, P0, N0, pool):
    tasks, where = [], []
    for part in np.unique(parts_of_texel):
        idx = np.where(parts_of_texel == part)[0]
        for k in range(0, len(idx), CHUNK):
            sel = idx[k:k + CHUNK]; tasks.append((kind, str(part), P0[sel], N0[sel])); where.append(sel)
    res = pool.map(_work, tasks, chunksize=1) if pool else list(map(_work, tasks))
    n = len(P0)
    t = np.zeros(n); hit = np.zeros(n, bool); flip = np.zeros(n, bool)
    val = np.zeros((n, 3)) if kind == 'normal' else np.zeros(n)
    for sel, (tt, hh, vv, ff) in zip(where, res):
        t[sel], hit[sel], val[sel], flip[sel] = tt, hh, vv, ff
    return t, hit, val, flip

# --- the bake -------------------------------------------------------------------------------------------------------
PALETTE = {'core': (196, 140, 110), 'arm_L': (220, 170, 130), 'arm_R': (170, 120, 95), 'jersey': (120, 70, 190),
           'shorts': (80, 60, 160), 'shoes': (235, 235, 235), 'hair_buzz': (60, 50, 45), 'hair_crop': (90, 70, 50),
           'hair_afro': (40, 35, 30), 'hair_rows': (110, 90, 60), 'headband': (250, 250, 120), 'sleeve_arm': (40, 160, 160),
           'sleeve_leg': (40, 120, 200)}

def maxrss_mb():
    return round(max(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss) / 1024, 1)

def bake(variant, size=2048, ao_size=1024, jobs=None, use_detail=True, out=OUT, log=print):
    from PIL import Image
    os.makedirs(out, exist_ok=True)
    T0 = time.time(); times = {}
    def lap(name, t):
        times[name] = round(time.time() - t, 1); log('  %-14s %6.1f s   (peak RSS %.0f MB)' % (name, times[name], maxrss_mb()))
    spec = sdf_hi.load_spec()
    t = time.time()
    pos, vt, vn, tris = mesh_uv.read_obj(os.path.join(SRC, 'kangs_%s.obj' % variant))
    mesh = mesh_uv.Mesh(pos, vn, tris)
    hidden = mesh_uv.classify_hidden(mesh, spec, variant, sdf_hi.PlayerSDF(spec, variant))
    src_uv = analyse_source_uvs(mesh, vt, tris)
    lap('read+classify', t)
    t = time.time()
    u = mesh_uv.unwrap(mesh, size, log=log)
    T, w = raster.tangents(u.P, u.N, u.UV, u.tris)
    Bv = raster.bitangents(u.N, T, w)
    stem = os.path.join(out, 'kangs_%s_uv' % variant)
    mesh_uv.write_obj(stem + '.obj', u, pos, 'variant %s, atlas %d px' % (variant, size))
    np.save(stem + '.tangents.npy', np.concatenate([T, w[:, None]], 1).astype(np.float32))
    np.save(stem + '.hidden.npy', u.hidden[np.argsort(u.face, kind='stable')])   # per OBJ face, in file order
    lap('unwrap+write', t)

    pool = mp.get_context('fork').Pool(jobs or os.cpu_count(), _init, (variant, use_detail)) if (jobs or os.cpu_count()) > 1 else None
    if pool is None: _init(variant, use_detail)
    try:
        # normal map
        t = time.time()
        tid, bary = raster.rasterize(u.UV, u.tris, size)
        mask = tid >= 0
        P0 = raster.interpolate(u.P, u.tris, tid, bary)
        N0 = raster._unit(raster.interpolate(u.N, u.tris, tid, bary))
        Tt = raster.interpolate(T, u.tris, tid, bary); Bt = raster.interpolate(Bv, u.tris, tid, bary)
        part = u.tg[tid[mask]]; hid = u.hidden[tid[mask]]
        lap('rasterise', t)
        t = time.time()
        tt, hit, nh, flip = run_tasks('normal', part, P0, N0, pool)
        lap('normal search', t)
        rgb = encode_texels(nh, Tt, Bt, N0)
        back = raster.decode(raster.from_rgb8(rgb), Tt, Bt, N0)
        rt_err = np.degrees(np.arccos(np.clip((back * nh).sum(1), -1, 1)))
        dev = np.degrees(np.arccos(np.clip((nh * N0).sum(1), -1, 1)))
        img = np.zeros((size, size, 3), np.uint8); img[:] = (128, 128, 255); img[mask] = rgb
        img = raster.dilate(img, mask)
        Image.fromarray(img, 'RGB').save(os.path.join(out, 'kangs_%s_normal.png' % variant), optimize=True)
        # ambient occlusion
        t = time.time()
        tid2, bary2 = raster.rasterize(u.UV, u.tris, ao_size)
        mask2 = tid2 >= 0
        P2 = raster.interpolate(u.P, u.tris, tid2, bary2)
        N2 = raster._unit(raster.interpolate(u.N, u.tris, tid2, bary2))
        part2 = u.tg[tid2[mask2]]; hid2 = u.hidden[tid2[mask2]]
        _, hit2, ao, buried2 = run_tasks('ao', part2, P2, N2, pool)
        lap('ao', t)
    finally:
        if pool: pool.close(); pool.join()
    aoimg = np.ones((ao_size, ao_size)); aoimg[mask2] = ao
    aoimg = raster.dilate(aoimg, mask2)
    Image.fromarray(np.round(aoimg * 255).astype(np.uint8), 'L').save(os.path.join(out, 'kangs_%s_ao.png' % variant), optimize=True)
    # UV layout picture (hidden faces darker)
    lay = np.zeros((size, size, 3), np.uint8); lay[:] = 24
    col = np.array([PALETTE.get(g, (200, 0, 200)) for g in u.tg], np.uint8)
    shade = np.where(u.hidden, .45, 1.0)[:, None]
    lay[mask] = (col[tid[mask]] * shade[tid[mask]]).astype(np.uint8)
    Image.fromarray(lay, 'RGB').resize((1024, 1024), Image.NEAREST).save(os.path.join(out, 'kangs_%s_uvlayout.png' % variant), optimize=True)

    vis = ~hid; seen = ~hid2 & ~buried2
    stats = {'variant': variant, 'triangles': int(len(u.tris)), 'vertices_in': int(len(mesh.P)), 'vertices_out': int(len(u.P)),
             'hidden_faces': int(u.hidden.sum()), 'hidden_by_rule': hidden, 'source_uvs': src_uv,
             'unwrap': u.stats, 'seams': mesh_uv.seam_stats(u, pos), 'density': mesh_uv.density_stats(u, size),
             'handedness_w_minus': int((w < 0).sum()),
             'normal_map': {'px': size, 'texels': int(mask.sum()), 'coverage': round(float(mask.mean()), 3),
                            'search_miss_visible': round(float((~hit & vis).sum() / max(vis.sum(), 1)), 5),
                            'search_miss_hidden': round(float((~hit & hid).sum() / max(hid.sum(), 1)), 5),
                            'offset_mm_visible_p50_p99': [round(float(np.percentile(np.abs(tt[vis]) * 1000, q)), 2) for q in (50, 99)],
                            'gradient_against_lowpoly_normal_visible': int((flip & vis).sum()),
                            'gradient_against_lowpoly_normal_hidden': int((flip & hid).sum()),
                            'deviation_deg_visible_p50_p99': [round(float(np.percentile(dev[vis], q)), 2) for q in (50, 99)],
                            'roundtrip_err_deg_p50_p99_max': [round(float(x), 3) for x in (np.percentile(rt_err, 50), np.percentile(rt_err, 99), rt_err.max())]},
             'ao': {'px': ao_size, 'texels': int(mask2.sum()), 'search_miss': round(float((~hit2).mean()), 5),
                    'buried_texels_of_visible_faces': round(float((buried2 & ~hid2).sum() / max((~hid2).sum(), 1)), 3),
                    'seen': {'mean': round(float(ao[seen].mean()), 3), 'p5': round(float(np.percentile(ao[seen], 5)), 3),
                             'p50': round(float(np.percentile(ao[seen], 50)), 3)},
                    'per_part_mean_seen': {g: round(float(ao[seen & (part2 == g)].mean()), 3) for g in u.groups if (seen & (part2 == g)).any()}},
             'detail': sorted(detail_mod.DETAILS) if use_detail else [],
             'times_s': times, 'total_s': round(time.time() - T0, 1), 'jobs': jobs or os.cpu_count(), 'peak_rss_mb': maxrss_mb()}
    json.dump(stats, open(os.path.join(out, 'kangs_%s_bake.json' % variant), 'w'), indent=1)
    log('  total %.1f s' % stats['total_s'])
    return stats

def analyse_source_uvs(mesh, vt, tris):
    """How usable the Houdini OBJ's own UVs are: point UVs (one vt per point) cannot have seams, so closed parts fold
    over themselves. Reports UV area vs rasterised coverage (> 1 = overlap) and the share of flipped triangles."""
    if vt is None: return None
    ti = np.array([[c[1] for c in corners] for corners, _, _ in tris])
    uv = vt[:, :2]
    sa = mesh_uv.uv_signed_areas(uv, ti)
    if uv.min() < 0 or uv.max() > 1: rng = [float(uv.min()), float(uv.max())]
    else: rng = [0.0, 1.0]
    cov = raster.rasterize(np.clip(uv, 0, 1), ti, 1024, count=True)
    area_px = np.abs(sa).sum() * 1024 * 1024
    return {'vt_count': int(len(vt)), 'one_vt_per_point': bool(len(vt) == len(mesh.positions)),
            'uv_area_over_coverage': round(float(area_px / max((cov > 0).sum(), 1)), 2),
            'overlapping_texels_share': round(float((cov > 1).sum() / max((cov > 0).sum(), 1)), 3),
            'flipped_share': round(float((sa < 0).mean()), 3), 'range': rng}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('variants', nargs='*', default=None)
    ap.add_argument('--size', type=int, default=2048)
    ap.add_argument('--ao-size', type=int, default=1024)
    ap.add_argument('--jobs', type=int, default=None)
    ap.add_argument('--no-detail', action='store_true', help='bake the plain SDF (detail functions off)')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    for v in a.variants or list(sdf_hi.load_spec()['variants']):
        print(v)
        s = bake(v, a.size, a.ao_size, a.jobs, not a.no_detail, a.out)
        print(json.dumps({k: s[k] for k in ('unwrap', 'seams', 'normal_map', 'ao', 'total_s', 'peak_rss_mb')}))
