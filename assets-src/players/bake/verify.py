"""Looks at a bake without the game: renders the low-poly player with and without the baked maps in three.js (headless
Chromium, SwiftShader), next to a reference mesh of the high-detail SDF itself, and measures how close the normal-mapped
low-poly shading normal gets to the reference.

  python3 assets-src/players/bake/verify.py [variant] [--shots DIR]      (after bake.py; needs playwright + chromium)

It writes, to a temporary folder it serves over http: <variant>.glb (POSITION, NORMAL, TEXCOORD_0 = (u, 1 - v),
TANGENT = the bake's tangents.npy, one mesh per OBJ group, hidden faces as <group>_hidden), ref.glb (marching cubes of
the high-detail SDF round the torso and the jersey, normals = SDF gradient) and the baked PNGs, then verify_page.html
assigns the maps exactly as the game would (separate textures, flipY = false, glTF UVs):
  tangent     the TANGENT attribute, normalScale (1, 1)
  derivative  no TANGENT (three derives the frame from screen derivatives), normalScale (1, -1): the UVs are glTF
              (v down) and the map is green-up, which is what GLTFLoader does for its own derivative-tangent materials
  wrong       derivative frame, normalScale (1, 1): the inverted-green mistake, as a control the check must catch
Output: bake_proto_<variant>_*.png sheets and bake_proto_<variant>_check.json.
"""
import argparse, functools, http.server, json, os, shutil, struct, sys, tempfile, threading, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mesh_uv, sdf_hi, detail as detail_mod  # noqa: E402

ROOT = mesh_uv.ROOT
OUT = os.path.join(HERE, 'out')

# --- glb ------------------------------------------------------------------------------------------------------
def write_glb(path, meshes):
    """meshes: list of (name, {attr: array}, indices). Plain static meshes, no materials (the page assigns them)."""
    blob = bytearray(); views, accessors, gl_meshes, nodes = [], [], [], []
    def add(arr, comp, typ, target, minmax=False):
        data = np.ascontiguousarray(arr).tobytes(); off = len(blob); blob.extend(data)
        while len(blob) % 4: blob.append(0)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target})
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if minmax: acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        accessors.append(acc); return len(accessors) - 1
    TYPES = {2: 'VEC2', 3: 'VEC3', 4: 'VEC4'}
    for name, attrs, idx in meshes:
        a = {}
        for k, arr in attrs.items():
            arr = arr.astype(np.float32); a[k] = add(arr, 5126, TYPES[arr.shape[1]], 34962, k == 'POSITION')
        prim = {'attributes': a, 'indices': add(idx.astype(np.uint32).reshape(-1), 5125, 'SCALAR', 34963)}
        gl_meshes.append({'name': name, 'primitives': [prim]}); nodes.append({'name': name, 'mesh': len(gl_meshes) - 1})
    gltf = {'asset': {'version': '2.0', 'generator': 'kangs bake verify.py'}, 'scene': 0,
            'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gl_meshes,
            'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + \
        struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    open(path, 'wb').write(out)

def baked_meshes(variant, out=OUT):
    """The baked OBJ as glTF-ready meshes: one per group and visibility, every corner its own vt (seams split)."""
    stem = os.path.join(out, 'kangs_%s_uv' % variant)
    pos, vt, vn, tris = mesh_uv.read_obj(stem + '.obj')
    tan = np.load(stem + '.tangents.npy'); hidden = np.load(stem + '.hidden.npy')
    meshes = []
    groups = list(dict.fromkeys(g for _, g, _ in tris))
    C = np.array([[c for c in corners] for corners, _, _ in tris])     # (m, 3, 3): pi, ti, ni (ti == ni per vertex)
    G = np.array([g for _, g, _ in tris])
    for g in groups:
        for hid in (False, True):
            m = (G == g) & (hidden == hid)
            if not m.any(): continue
            ti = C[m][:, :, 1]
            used, inv = np.unique(ti, return_inverse=True)
            pi = np.zeros(len(used), int); ni = np.zeros(len(used), int)
            pi[inv.reshape(-1)] = C[m][:, :, 0].reshape(-1); ni[inv.reshape(-1)] = C[m][:, :, 2].reshape(-1)
            uv = vt[used].copy(); uv[:, 1] = 1 - uv[:, 1]         # glTF: v down
            attrs = {'POSITION': pos[pi], 'NORMAL': vn[ni], 'TEXCOORD_0': uv, 'TANGENT': tan[used]}
            meshes.append((g + ('_hidden' if hid else ''), attrs, inv.reshape(-1, 3)))
    return meshes

def reference_meshes(variant, voxel=.002):
    """Marching cubes of the high-detail SDF (the thing the maps should reproduce) in a box round the chest, shoulders
    and abs (core, both arms) and round the jersey; vertex normals are the SDF gradient there."""
    from skimage.measure import marching_cubes
    spec = sdf_hi.load_spec(); S = sdf_hi.PlayerSDF(spec, variant, detail_mod.detail); H = S.H
    lo = np.array([-.17 * H * S.SH, .57 * H, -.01 * H]); hi = np.array([.17 * H * S.SH, .86 * H, .13 * H])
    n = np.ceil((hi - lo) / voxel).astype(int) + 1
    axes = [np.linspace(lo[i], lo[i] + voxel * (n[i] - 1), n[i]) for i in range(3)]
    P = np.stack(np.meshgrid(*axes, indexing='ij'), -1).reshape(-1, 3)
    out = []
    for part in ('core', 'arm_L', 'arm_R', 'jersey'):
        f = lambda Q: S.sdf_hi(part, Q, np.zeros_like(Q))
        d = np.concatenate([f(P[k:k + 400000]) for k in range(0, len(P), 400000)]).reshape(n)
        V, F, _, _ = marching_cubes(d, 0.0, spacing=(voxel,) * 3)
        V += lo
        N = sdf_hi.gradient(f, V)
        # wind so the face normal agrees with the gradient (outward)
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        if (fn * N[F].mean(1)).sum() < 0: F = F[:, ::-1]
        # drop the box walls (the SDF is cut there, the faces would be flat caps)
        keep = ~((np.abs(V[F] - lo) < voxel * .6) | (np.abs(V[F] - hi) < voxel * .6)).any(2).any(1)
        out.append(('ref_' + part, {'POSITION': V, 'NORMAL': N}, F[keep]))
    return out

# --- browser --------------------------------------------------------------------------------------------------------
def serve(root):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
    handler.log_message = lambda *a: None
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def run(variant, shots, out=OUT):
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageDraw
    os.makedirs(shots, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='kangs_bake_verify_')
    t = time.time()
    write_glb(os.path.join(tmp, 'player.glb'), baked_meshes(variant, out))
    write_glb(os.path.join(tmp, 'ref.glb'), reference_meshes(variant))
    print('  glbs %.1f s' % (time.time() - t))
    for k in ('normal', 'ao'):
        shutil.copy(os.path.join(out, 'kangs_%s_%s.png' % (variant, k)), os.path.join(tmp, '%s.png' % k))
    shutil.copy(os.path.join(HERE, 'verify_page.html'), os.path.join(tmp, 'index.html'))
    os.symlink(os.path.join(ROOT, 'node_modules', 'three'), os.path.join(tmp, 'three'))
    H = sdf_hi.load_spec()['variants'][variant]['height_m']
    httpd = serve(tmp)
    url = 'http://127.0.0.1:%d/index.html' % httpd.server_address[1]
    sheets = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        page = b.new_page(viewport={'width': 600, 'height': 600})
        logs = []; page.on('console', lambda m: logs.append(m.text)); page.on('pageerror', lambda e: logs.append('ERROR ' + str(e)))
        page.goto(url); page.wait_for_function('window.ready === true || window.failed', timeout=180000)
        if page.evaluate('window.failed || null'): raise RuntimeError(page.evaluate('window.failed') + '\n' + '\n'.join(logs))
        page.evaluate('H => window.setHeight(H)', H)
        def shot(cfg):
            data = page.evaluate('cfg => window.render(cfg)', cfg)
            import base64, io
            return Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
        L = {'left': [-1, .35, .55], 'right': [1, .35, .55], 'top': [0, 1, .45]}
        # sheet 1: bare torso (skin, hidden skin included), three lights x before/after/reference
        rows = []
        for mode, label in (('before', 'low-poly, no maps'), ('after', 'low-poly + baked normal map'), ('reference', 'high-detail SDF (marching cubes)')):
            rows.append((label, [shot({'view': 'torso', 'mode': mode, 'light': L[k], 'size': 420}) for k in ('left', 'right', 'top')]))
        sheets['torso'] = grid(rows, ['key light from the left', 'from the right', 'from above'], 'Muscle grooves (deltopectoral, linea alba): %s' % variant)
        rows = []
        for mode, label in (('before', 'low-poly, no maps'), ('after', 'low-poly + baked normal map'), ('reference', 'high-detail SDF (marching cubes)')):
            rows.append((label, [shot({'view': 'jersey', 'mode': mode, 'light': L[k], 'size': 420}) for k in ('left', 'right', 'top')]))
        sheets['jersey'] = grid(rows, ['key light from the left', 'from the right', 'from above'], 'Jersey folds (waist, armholes): %s' % variant)
        rows = [('no maps', [shot({'view': v, 'mode': 'before', 'light': [-.6, .5, .8], 'size': 460}) for v in ('full', 'full_back', 'face')]),
                ('normal + AO maps', [shot({'view': v, 'mode': 'after_ao', 'light': [-.6, .5, .8], 'size': 460}) for v in ('full', 'full_back', 'face')]),
                ('AO map only (ambient light)', [shot({'view': v, 'mode': 'ao_only', 'light': [-.6, .5, .8], 'size': 460}) for v in ('full', 'full_back', 'face')])]
        sheets['full'] = grid(rows, ['front', 'back', 'head'], 'Before / after, kit on: %s' % variant)
        # numbers: view-space normals vs the reference, per tangent mode
        check = {}
        for view in ('torso', 'jersey'):
            check[view] = page.evaluate('v => window.normalCheck(v)', view)
        rows = [('view-space normal', [shot({'view': 'torso', 'mode': m, 'normals': True, 'size': 300}) for m in ('before', 'after', 'derivative', 'wrong', 'reference')])]
        sheets['normals'] = grid(rows, ['no map', 'map, TANGENT', 'map, derivative frame', 'map, green inverted', 'reference'], 'Normal check: %s' % variant)
        b.close()
    httpd.shutdown()
    paths = {}
    for k, img in sheets.items():
        paths[k] = os.path.join(shots, 'bake_proto_%s_%s.png' % (variant, k)); img.save(paths[k])
    check['console'] = [l for l in logs if 'ERROR' in l or 'rror' in l][:20]
    json.dump(check, open(os.path.join(shots, 'bake_proto_%s_check.json' % variant), 'w'), indent=1)
    shutil.rmtree(tmp, ignore_errors=True)
    return paths, check

def grid(rows, cols, title):
    from PIL import Image, ImageDraw
    w, h = rows[0][1][0].size; lw = 210; th = 34; ch = 24
    img = Image.new('RGB', (lw + w * len(cols), th + ch + h * len(rows)), (18, 18, 22))
    d = ImageDraw.Draw(img)
    d.text((10, 10), title, fill=(235, 235, 235))
    for j, c in enumerate(cols): d.text((lw + j * w + 8, th + 4), c, fill=(200, 200, 200))
    for i, (label, ims) in enumerate(rows):
        d.text((10, th + ch + i * h + h // 2), label, fill=(220, 220, 220))
        for j, im in enumerate(ims): img.paste(im, (lw + j * w, th + ch + i * h))
    return img

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('variant', nargs='?', default='guard')
    ap.add_argument('--shots', default=os.path.join(tempfile.gettempdir(), 'kangs_bake_shots'))
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    paths, check = run(a.variant, a.shots, a.out)
    print(json.dumps(paths, indent=1)); print(json.dumps(check, indent=1))
