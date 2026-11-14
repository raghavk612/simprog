"""Before / after sheets of the detail bake, per area, rendered in three.js (headless Chromium, SwiftShader) the way the
game assigns the maps; plus the stand-in hand, sneaker and afro (standins.py) baked through the same path.

  python3 assets-src/players/bake/detail_sheets.py [variant] [--out DIR] [--before DIR] [--shots DIR] [--sheets a,b]
          [--standins] [--prefix d2]

--out     the bake to show (kangs_<v>_uv.obj, .tangents.npy, _normal.png, _ao.png; default bake/out)
--before  a folder with an earlier bake's kangs_<v>_normal.png on the same UVs (the prototype's maps, bc0d3e1)
Sheets: arm, legs, jersey, shorts, hair, gear (shoes, sleeves, headband), distance (the whole player at about 150 px,
the in-game size). Rows: no map / before / after (normal) / after (normal + AO). Writes <prefix>_<variant>_<sheet>.png.
--standins bakes and renders <prefix>_standin_{hand,shoe,afro}.png (no map / detail map / detail map + AO).
"""
import argparse, base64, io, os, shutil, sys, tempfile, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bake, mesh_uv, raster, sdf_hi, standins, verify  # noqa: E402
import detail as dt  # noqa: E402

SKIN, KIT, SHOE, HAIR, SLEEVE, BAND = 0x7a4a32, 0x5b2d96, 0xe6e6e6, 0x1a1411, 0x26262c, 0xf0f0f0
BODY = ['core', 'arm_L', 'arm_R']
KIT_ON = [('jersey', KIT), ('shorts', KIT), ('shoes', SHOE)]

def items(names_colors, normal, ao):
    out = []
    for name, col in names_colors:
        out.append({'glb': 'player', 'names': [name], 'normal': normal, 'ao': ao, 'color': col,
                    'roughness': .75 if col in (KIT, SLEEVE) else (.85 if col == HAIR else .55)})
    return out

def base(extra=(), hair='hair_crop', kit=True):
    nc = [(b, SKIN) for b in BODY] + (KIT_ON if kit else [])
    if hair: nc.append((hair, HAIR))
    return nc + list(extra)

# view: (camera, target, light) in units of H (camera and target), light a direction
VIEWS = {
    'arm': (base(), [('front', (.22, .68, .7), (.125, .66, .0), (-.3, .6, .9)),
                     ('side', (.72, .68, .1), (.11, .66, .0), (.5, .7, .6)),
                     ('back', (.32, .68, -.62), (.11, .66, .0), (.4, .7, -.8))]),
    'legs': (base(), [('front', (.12, .2, .62), (.02, .2, .0), (-.4, .6, .9)),
                      ('side', (.62, .2, .1), (.02, .2, .0), (.6, .6, .5)),
                      ('back', (.12, .2, -.62), (.02, .2, .0), (.3, .6, -.9))]),
    'jersey': (base(), [('front', (.1, .72, .72), (0, .7, 0), (-.5, .7, .8)),
                        ('side', (.72, .7, .1), (0, .69, 0), (.6, .8, .3)),
                        ('back', (-.1, .72, -.72), (0, .7, 0), (.4, .7, -.8))]),
    'shorts': (base(), [('front', (.1, .46, .72), (0, .45, 0), (-.5, .7, .8)),
                        ('side', (.72, .46, .05), (0, .45, 0), (.6, .8, .3)),
                        ('back', (-.1, .46, -.72), (0, .45, 0), (.4, .7, -.8))]),
    'gear': (base([('sleeve_arm', SLEEVE), ('sleeve_leg', SLEEVE), ('headband', BAND)]),
             [('shoes', (.3, .14, .36), (.04, .04, .03), (-.4, .8, .6)),
              ('sleeve', (-.4, .62, .34), (-.12, .6, 0), (-.5, .6, .7)),
              ('knee', (.2, .24, .45), (.05, .22, .0), (-.3, .6, .8)),
              ('headband', (.14, .94, .26), (0, .935, 0), (-.4, .6, .8))]),
}
HAIR_STYLES = ['hair_buzz', 'hair_crop', 'hair_rows', 'hair_afro']
HAIR_VIEWS = [('front 3/4', (.17, .955, .27), (0, .935, -.005), (-.5, .7, .7)),
              ('top', (.02, 1.2, .1), (0, .95, -.01), (-.3, 1, .4)),
              ('back', (-.12, .97, -.3), (0, .94, -.01), (.3, .8, -.7))]

def shot(page, cfg):
    from PIL import Image
    data = page.evaluate('cfg => window.render(cfg)', cfg)
    return Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')

def cfg_for(it, cam, tgt, light, H, size=380, **kw):
    c = {'items': it, 'cam': [v * H for v in cam], 'target': [v * H for v in tgt], 'light': list(light), 'size': [size, size],
         'fov': 30, 'rim': .6}
    c.update(kw)
    return c

MODES = [('no map', None, None), ('before (prototype map)', 'before_n', None), ('after (D2 normal map)', 'after_n', None),
         ('after (normal + AO)', 'after_n', 'after_ao')]

def body_sheets(page, variant, H, which, have_before, title):
    sheets = {}
    modes = [m for m in MODES if have_before or m[1] != 'before_n']
    for name in which:
        if name == 'hair':
            for style in HAIR_STYLES:
                nc = [('core', SKIN), ('jersey', KIT), (style, HAIR)]
                rows = [(lab, [shot(page, cfg_for(items(nc, n, a), c, t, l, H)) for _, c, t, l in HAIR_VIEWS]) for lab, n, a in modes]
                sheets['hair_' + style[5:]] = verify.grid(rows, [v[0] for v in HAIR_VIEWS], '%s: %s, %s' % (title, style, variant))
            continue
        if name == 'distance':
            # the whole player at the in-game size: ~150 px tall (camera 2.5 H away, 30 deg), shown again at 3x
            nc = base()
            angles = [('front', (.35, .55, 2.45)), ('side', (2.45, .55, .3)), ('back', (-.35, .55, -2.45)), ('high follow cam', (.9, 1.6, 2.1))]
            rows = []
            for lab, n, a in modes:
                ims = []
                for _, cam in angles:
                    im = shot(page, cfg_for(items(nc, n, a), cam, (0, .5, 0), (-.5, .8, .6), H, size=200))
                    ims.append(im.resize((400, 400), 0))
                rows.append((lab, ims))
            sheets['distance'] = verify.grid(rows, [a[0] + ' (200 px, shown 2x)' for a in angles], '%s: game distance, %s' % (title, variant))
            continue
        nc, views = VIEWS[name]
        rows = [(lab, [shot(page, cfg_for(items(nc, n, a), c, t, l, H)) for _, c, t, l in views]) for lab, n, a in modes]
        sheets[name] = verify.grid(rows, [v[0] for v in views], '%s: %s, %s' % (title, name, variant))
    return sheets

# --- stand-ins: meshed coarse, unwrapped and baked through the same code as the player ------------------------------
def marching(f, lo, hi, voxel):
    from skimage.measure import marching_cubes
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / voxel).astype(int) + 1
    ax = [np.linspace(lo[i], lo[i] + voxel * (n[i] - 1), n[i]) for i in range(3)]
    P = np.stack(np.meshgrid(*ax, indexing='ij'), -1).reshape(-1, 3)
    d = np.concatenate([f(P[k:k + 300000]) for k in range(0, len(P), 300000)]).reshape(n)
    V, F, _, _ = marching_cubes(d, 0.0, spacing=(voxel,) * 3)
    V += lo
    N = standins.gradient(f, V)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    if (fn * N[F].mean(1)).sum() < 0: F = F[:, ::-1]
    return V, N, F

def bake_standin(S, part, f_local, lo, hi, voxel=.0028, size=768, log=print):
    """Mesh the stand-in in its local frame, place it in the body with the part's frame (S.local_parts), unwrap, then
    search and encode exactly as bake.py does. Returns the glb meshes (body space), the normal map and the AO map."""
    lp = S.local_parts[part]
    V, N, F = marching(f_local, lo, hi, voxel)
    P = lp.to_body(V); Nb = N @ lp.axes
    if np.linalg.det(lp.axes) < 0: F = F[:, ::-1]           # a mirrored frame flips the winding
    src = [(((a, 0, a), (b, 0, b), (c, 0, c)), part, i) for i, (a, b, c) in enumerate(F)]
    mesh = mesh_uv.Mesh(P, Nb, src)
    u = mesh_uv.unwrap(mesh, size, padding=4, log=lambda *a: None)
    T, w = raster.tangents(u.P, u.N, u.UV, u.tris); Bv = raster.bitangents(u.N, T, w)
    tid, bary = raster.rasterize(u.UV, u.tris, size); mask = tid >= 0
    P0 = raster.interpolate(u.P, u.tris, tid, bary); N0 = raster._unit(raster.interpolate(u.N, u.tris, tid, bary))
    Tt = raster.interpolate(T, u.tris, tid, bary); Bt = raster.interpolate(Bv, u.tris, tid, bary)
    t0 = time.time()
    t, hit, Ph, nh = bake.surface_normals(lambda Q, n: S.sdf_hi(part, Q, n), P0, N0)
    ao = bake.ambient_occlusion(lambda Q: S.sdf_hi(part, Q, N0), Ph, nh)
    log('  %s: %d tris, %d texels, search+AO %.1f s, misses %d' % (part, len(u.tris), mask.sum(), time.time() - t0, (~hit).sum()))
    img = np.zeros((size, size, 3), np.uint8); img[:] = (128, 128, 255); img[mask] = bake.encode_texels(nh, Tt, Bt, N0)
    img = raster.dilate(img, mask)
    aoimg = np.ones((size, size)); aoimg[mask] = ao; aoimg = raster.dilate(aoimg, mask)
    uv = u.UV.copy(); uv[:, 1] = 1 - uv[:, 1]
    meshes = [('standin', {'POSITION': u.P, 'NORMAL': u.N, 'TEXCOORD_0': uv, 'TANGENT': np.concatenate([T, w[:, None]], 1)}, u.tris)]
    return meshes, img, (np.round(aoimg * 255)).astype(np.uint8)

def standin_setup(variant='guard'):
    S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), variant, dt.detail)
    hl = dt.HandLayout.anatomical(S.H); sl = dt.ShoeLayout.for_height(S.H)
    # placed as in the rest pose: the right hand hanging at the side, palm to the thigh (local +x thumb -> forward,
    # +y fingertips -> down, +z back of the hand -> outward: a mirrored frame), the left shoe on the floor
    S.add_local_part('hand_R', standins.hand_sdf(hl), [-.25, .93, .0], [[0, 0, 1.0], [0, -1.0, 0], [-1.0, 0, 0]])
    S.add_local_part('shoe_L', standins.shoe_sdf(sl), [.09, 0, -.1], np.eye(3))
    S.add_local_part('hair_afro', standins.afro_sdf(), S.HO, np.eye(3))
    return S, hl, sl

STANDINS = {
    # part: (local box lo, hi, colour, views [(label, cam offset from centre in local-scaled units, light)])
    'hand_R': ([-.07, -.045, -.06], [.085, .245, .04], SKIN),
    'shoe_L': ([-.07, -.004, -.012], [.07, .13, .345], SHOE),
    'hair_afro': ([-.2, -.12, -.2], [.2, .25, .2], HAIR),
}

def standin_sheets(page, S, tmp, prefix, log=print):
    from PIL import Image
    sheets = {}
    for part, (lo, hi, col) in STANDINS.items():
        f = S.local_parts[part].sdf_local
        meshes, nimg, aoimg = bake_standin(S, part, f, lo, hi, voxel=.0045 if part == 'hair_afro' else .0028, log=log)
        verify.write_glb(os.path.join(tmp, part + '.glb'), meshes)
        Image.fromarray(nimg, 'RGB').save(os.path.join(tmp, part + '_n.png'))
        Image.fromarray(aoimg, 'L').save(os.path.join(tmp, part + '_ao.png'))
        r = page.evaluate('s => window.load(s)', {'glbs': {part: part + '.glb'}, 'textures': {part + '_n': part + '_n.png', part + '_ao': part + '_ao.png'}})
        if isinstance(r, str): raise RuntimeError(r)
        lp = S.local_parts[part]
        c = lp.to_body((np.array(lo) + np.array(hi)) / 2)
        ext = np.linalg.norm(np.array(hi) - np.array(lo))
        if part == 'hand_R':
            views = [('back of hand', [-.2, 0, .1]), ('palm', [.2, 0, .1]), ('fingers close', [-.09, -.06, .1]), ('thumb side', [0, 0, .25])]
        elif part == 'shoe_L':
            views = [('lateral', [.3, .1, .02]), ('top', [.06, .35, .05]), ('front 3/4', [.2, .12, .25]), ('back 3/4', [.15, .12, -.25])]
        else:
            views = [('front', [.15, .05, .45]), ('side', [.47, .05, 0]), ('top', [.05, .47, .05]), ('close', [.12, .1, .26])]
        rows = []
        for lab, n, a in (('no map', None, None), ('detail normal map', part + '_n', None), ('normal + AO', part + '_n', part + '_ao')):
            ims = []
            for _, off in views:
                it = [{'glb': part, 'names': ['standin'], 'normal': n, 'ao': a, 'color': col, 'roughness': .85 if col == HAIR else .55}]
                cam = (c + np.array(off) * (ext / .2)).tolist()
                ims.append(shot(page, {'items': it, 'cam': cam, 'target': c.tolist(), 'light': [-.4, .7, .6], 'size': [380, 380], 'fov': 30, 'rim': .5}))
            rows.append((lab, ims))
        sheets['standin_' + {'hand_R': 'hand', 'shoe_L': 'shoe', 'hair_afro': 'afro'}[part]] = verify.grid(rows, [v[0] for v in views], 'Stand-in %s (local frame), detail baked through the bake path' % part)
    return sheets

def run(variant, out, before, shots, which, do_standins, prefix):
    from playwright.sync_api import sync_playwright
    os.makedirs(shots, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='kangs_sheets_')
    textures = {}
    if which:
        verify.write_glb(os.path.join(tmp, 'player.glb'), verify.baked_meshes(variant, out))
        shutil.copy(os.path.join(out, 'kangs_%s_normal.png' % variant), os.path.join(tmp, 'after_n.png'))
        shutil.copy(os.path.join(out, 'kangs_%s_ao.png' % variant), os.path.join(tmp, 'after_ao.png'))
        textures = {'after_n': 'after_n.png', 'after_ao': 'after_ao.png'}
        if before:
            shutil.copy(os.path.join(before, 'kangs_%s_normal.png' % variant), os.path.join(tmp, 'before_n.png'))
            textures['before_n'] = 'before_n.png'
    shutil.copy(os.path.join(HERE, 'sheets_page.html'), os.path.join(tmp, 'index.html'))
    os.symlink(os.path.join(mesh_uv.ROOT, 'node_modules', 'three'), os.path.join(tmp, 'three'))
    H = sdf_hi.load_spec()['variants'][variant]['height_m']
    httpd = verify.serve(tmp)
    url = 'http://127.0.0.1:%d/index.html' % httpd.server_address[1]
    sheets, logs = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        page = b.new_page(viewport={'width': 800, 'height': 800})
        page.on('console', lambda m: logs.append(m.text)); page.on('pageerror', lambda e: logs.append('ERROR ' + str(e)))
        page.goto(url); page.wait_for_function('window.ready === true', timeout=120000)
        if which:
            r = page.evaluate('s => window.load(s)', {'glbs': {'player': 'player.glb'}, 'textures': textures})
            if isinstance(r, str): raise RuntimeError(r)
            sheets.update(body_sheets(page, variant, H, which, bool(before), 'Detail'))
        if do_standins:
            S, _, _ = standin_setup(variant)
            sheets.update(standin_sheets(page, S, tmp, prefix))
        b.close()
    httpd.shutdown()
    paths = []
    for k, img in sheets.items():
        path = os.path.join(shots, '%s_%s.png' % (prefix, k if k.startswith('standin') else '%s_%s' % (variant, k)))
        img.save(path); paths.append(path)
    shutil.rmtree(tmp, ignore_errors=True)
    errs = [l for l in logs if 'rror' in l]
    return paths, errs

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('variant', nargs='?', default='guard')
    ap.add_argument('--out', default=bake.OUT)
    ap.add_argument('--before', default=None)
    ap.add_argument('--shots', default=os.path.join(tempfile.gettempdir(), 'kangs_detail_shots'))
    ap.add_argument('--sheets', default='arm,legs,jersey,shorts,hair,gear,distance')
    ap.add_argument('--standins', action='store_true')
    ap.add_argument('--prefix', default='d2')
    a = ap.parse_args()
    which = [s for s in a.sheets.split(',') if s]
    paths, errs = run(a.variant, a.out, a.before, a.shots, which, a.standins, a.prefix)
    print('\n'.join(paths))
    if errs: print('console errors:', errs[:10])
