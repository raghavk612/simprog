"""Turns the Houdini player meshes (OBJ) into rigged glTF bodies for the game.

Houdini Apprentice can only export OBJ, so the skeleton and skin weights are added here, from the same
body_shapes.json the Houdini builder used (assets-src/players/). Output: public/models/players/<variant>.glb

  python3 scripts/build_players.py            # all variants (needs numpy)

What is in each .glb (one scene, game units, y up, +z forward, feet at y=0):
  * a skeleton whose bones rest with no rotation (so the game's hip/knee/shoulder/elbow swings work unchanged):
    pelvis > spine > chest > neck > head, chest > shoulder > elbow > wrist (per side), pelvis > hip > knee > ankle (per side)
  * skinned meshes sharing that skeleton: "body_mesh" and "head_mesh" (skin), "jersey_mesh" and "shorts_mesh" (kit, recoloured
    per team), "shoes_mesh" (shoes, sole), four hair styles "hair_buzz/crop/afro/rows_mesh", and the options "headband_mesh",
    "sleeve_arm_mesh" (right arm) and "sleeve_leg_mesh" (left leg). The game keeps one hair style and the options it wants.
  * scene extras: decal anchors (chest number, back nameplate, captain badge) relative to the chest bone, and the height
"""
import json, math, os, struct, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'players')
OUT = os.path.join(ROOT, 'public', 'models', 'players')
UNITS_PER_M = 0.3306 / 0.3048  # the court is drawn at 0.3306 units per foot

BONES = [  # name, parent, joint key in body_shapes.json
    ('pelvis', None, 'pelvis'), ('spine', 'pelvis', 'spine'), ('chest', 'spine', 'chest'), ('neck', 'chest', 'neck'), ('head', 'neck', 'head'),
    ('shoulder_L', 'chest', 'shoulder_L'), ('elbow_L', 'shoulder_L', 'elbow_L'), ('wrist_L', 'elbow_L', 'wrist_L'),
    ('shoulder_R', 'chest', 'shoulder_R'), ('elbow_R', 'shoulder_R', 'elbow_R'), ('wrist_R', 'elbow_R', 'wrist_R'),
    ('hip_L', 'pelvis', 'hip_L'), ('knee_L', 'hip_L', 'knee_L'), ('ankle_L', 'knee_L', 'ankle_L'),
    ('hip_R', 'pelvis', 'hip_R'), ('knee_R', 'hip_R', 'knee_R'), ('ankle_R', 'knee_R', 'ankle_R')]
BI = {b[0]: i for i, b in enumerate(BONES)}
# Clothing and hair from Houdini (OBJ group -> body part its skin weights are copied from, material).
GARMENTS = {'jersey': ('core', 'kit'), 'shorts': ('core', 'kit'), 'shoes': ('core', 'shoes'),
            'hair_buzz': ('core', 'hair'), 'hair_crop': ('core', 'hair'), 'hair_afro': ('core', 'hair'), 'hair_rows': ('core', 'hair'),
            'headband': ('core', 'band'), 'sleeve_arm': ('arm_R', 'sleeve'), 'sleeve_leg': ('core', 'sleeve')}

def read_obj(path):
    v, vt, vn, faces, group = [], [], [], [], ''
    for line in open(path):
        if line.startswith('v '): v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): vt.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('vn '): vn.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '): group = (line.split() + [''])[1]
        elif line.startswith('f '):
            idx = [tuple(int(x) - 1 if x else -1 for x in (t.split('/') + ['', ''])[:3]) for t in line.split()[1:]]
            for k in range(1, len(idx) - 1): faces.append((idx[0], idx[k], idx[k + 1], group))
    return np.array(v), np.array(vt) if vt else None, np.array(vn) if vn else None, faces

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def joints_for(spec, v):
    H, SH = v['height_m'], v['shoulder']
    out = {}
    for k, p in spec['joints'].items():
        out[k] = np.array([p[0] * (SH if k in spec['shoulder_joints'] else 1) * H, p[1] * H, p[2] * H])
    return out

def chain_weights(P, joints_xyz, bones, widths):
    """Blends weights down a chain of bones (bones[i] starts at joints_xyz[i]) by each point's position along
    the chain: at every joint the weight passes from the parent bone to the child over +-width (metres)."""
    n = len(P); W = np.zeros((n, len(bones)))
    W[:, 0] = 1.0
    for i in range(1, len(bones)):
        J = joints_xyz[i]; nxt = joints_xyz[i + 1] if i + 1 < len(joints_xyz) else J + (J - joints_xyz[i - 1])
        axis = nxt - J; axis /= np.linalg.norm(axis)
        t = (P - J) @ axis
        w = smooth(-widths[i], widths[i], t)
        W[:, i] = W[:, i - 1] * w
        W[:, i - 1] *= (1 - w)
    return W

def build_variant(name, spec, objpath):
    v = spec['variants'][name]; H = v['height_m']
    J = joints_for(spec, v)
    J['top'] = np.array([0, H, 0]); J['hand_L'] = J['hand_end_L']; J['hand_R'] = J['hand_end_R']
    pos, uv, nrm, faces = read_obj(objpath)
    # unique render vertices (position/uv/normal triples) per part group
    key_index, verts, groups = {}, [], []
    tris = []
    for (a, b, c, g) in faces:
        tri = []
        for (pi, ti, ni) in (a, b, c):
            # Houdini writes one normal per corner: merge corners whose normals match, keep splits at sharp edges
            key = (pi, ti, tuple(np.round(nrm[ni], 3)) if nrm is not None and ni >= 0 else ni)
            if key not in key_index:
                key_index[key] = len(verts); verts.append(key); groups.append(g)
            tri.append(key_index[key])
        tris.append((tri, g))
    P = np.array([pos[k[0]] for k in verts])
    N = np.array([k[2] if isinstance(k[2], tuple) else [0, 1, 0] for k in verts], float); N /= np.linalg.norm(N, axis=1, keepdims=True)
    UV = np.array([uv[k[1]] if uv is not None and k[1] >= 0 else [0, 0] for k in verts])
    G = np.array(groups)

    W = np.zeros((len(P), len(BONES)))
    # arms: chest > shoulder > elbow > wrist
    for side in ('L', 'R'):
        m = G == 'arm_' + side
        bones = ['chest', 'shoulder_' + side, 'elbow_' + side, 'wrist_' + side]
        jx = [J['chest'], J['shoulder_' + side], J['elbow_' + side], J['wrist_' + side], J['hand_' + side]]
        w = chain_weights(P[m], jx, bones, [0, .045 * H / 2, .03 * H / 2, .015 * H / 2])
        for i, b in enumerate(bones): W[m, BI[b]] = w[:, i]
    # body: legs below the hip, torso and head above
    core = G == 'core'
    side_L = P[:, 0] >= 0
    for side, sm in (('L', side_L), ('R', ~side_L)):
        hip, knee = J['hip_' + side], J['knee_' + side]
        thigh = (knee - hip) / np.linalg.norm(knee - hip)
        t = (P - hip) @ thigh
        legness = smooth(-.03 * H, .045 * H, t)  # 0 = pelvis, 1 = leg
        m = core & sm
        bones = ['hip_' + side, 'knee_' + side, 'ankle_' + side]
        jx = [hip, knee, J['ankle_' + side], J['toe_' + side]]
        w = chain_weights(P[m], jx, bones, [0, .022 * H, .012 * H])
        for i, b in enumerate(bones): W[m, BI[b]] += w[:, i] * legness[m][:, None].ravel()
        W[m, BI['pelvis']] += 1 - legness[m]
    # torso chain: redistribute the pelvis share up the spine by height
    torso = W[:, BI['pelvis']].copy()
    ys = P[:, 1]
    tb = ['pelvis', 'spine', 'chest', 'neck', 'head']
    jy = [J['pelvis'][1], J['spine'][1], J['chest'][1], J['neck'][1], J['head'][1]]
    tw = np.zeros((len(P), len(tb))); tw[:, 0] = 1
    for i in range(1, len(tb)):
        w = smooth(jy[i] - .02 * H, jy[i] + .02 * H, ys); tw[:, i] = tw[:, i - 1] * w; tw[:, i - 1] *= (1 - w)
    for i, b in enumerate(tb): W[core, BI[b]] = 0
    for i, b in enumerate(tb): W[core, BI[b]] += torso[core] * tw[core, i]
    # keep the 4 strongest influences, normalised
    order = np.argsort(-W, axis=1)[:, :4]
    JW = np.take_along_axis(W, order, 1); JW[JW < 1e-3] = 0
    JW /= np.maximum(JW.sum(1, keepdims=True), 1e-9)
    JI = np.where(JW > 0, order, 0)
    # clothing and hair follow the skin under them: copy the weights of the nearest body vertex of their source part
    for g, (srcpart, _) in GARMENTS.items():
        m = np.where(G == g)[0]
        if not len(m): continue
        src = np.where(G == srcpart)[0]
        near = np.empty(len(m), int)
        for k in range(0, len(m), 512):
            d = ((P[m[k:k + 512], None, :] - P[None, src, :]) ** 2).sum(-1)
            near[k:k + 512] = src[d.argmin(1)]
        JW[m] = JW[near]; JI[m] = JI[near]
        if g == 'shorts':
            # the crotch panel follows the pelvis, not one thigh, so the shorts never split down the middle on a wide stride
            mid = (1 - smooth(.012 * H, .05 * H, np.abs(P[m, 0]))) * smooth(.43 * H, .49 * H, P[m, 1])
            for k, vi in enumerate(m):
                if mid[k] <= 0: continue
                w = dict(zip(JI[vi].tolist(), (JW[vi] * (1 - mid[k])).tolist()))
                w[BI['pelvis']] = w.get(BI['pelvis'], 0) + mid[k]
                top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
                JI[vi] = [t[0] for t in top] + [0] * (4 - len(top)); JW[vi] = [t[1] for t in top] + [0] * (4 - len(top))
                JW[vi] /= max(JW[vi].sum(), 1e-9)
        # cylindrical UVs round the body axis (or the limb) so a fabric pattern can tile on them
        c = P[m].mean(0)
        UV[m, 0] = np.arctan2(P[m, 0] - c[0], P[m, 2] - c[2]) / (2 * np.pi) + .5
        UV[m, 1] = P[m, 1] / H * 4

    # materials and meshes by region (heights as fractions of H)
    y = lambda f: f * H
    def region(tri, g):
        c = P[tri].mean(0)
        if g in GARMENTS:
            mat = GARMENTS[g][1]
            if g == 'shoes' and c[1] < y(.011): mat = 'sole'
            return (g, mat)
        if g == 'core' and c[1] > J['neck'][1] + .012 * H: return ('head', 'skin')
        if g == 'core' and c[1] < y(.07) and 'shoes' in GARMENTS and (G == 'shoes').any(): return (None, None)  # feet are inside the shoes
        return ('body', 'skin')
    meshes = {}
    for tri, g in tris:
        mesh, mat = region(tri, g)
        if mesh is None: continue
        meshes.setdefault(mesh, {}).setdefault(mat, []).append(tri)

    S = UNITS_PER_M
    chest = J['chest']
    jersey = (G == 'jersey') if (G == 'jersey').any() else core
    z_front = P[(np.abs(P[:, 0]) < .03 * H) & (np.abs(P[:, 1] - y(.71)) < .015 * H) & jersey][:, 2].max()
    z_back = P[(np.abs(P[:, 0]) < .03 * H) & (np.abs(P[:, 1] - y(.765)) < .015 * H) & jersey][:, 2].min()
    extras = {'variant': name, 'height': H * S,
              'number': [0, (y(.705) - chest[1]) * S, (z_front - chest[2] + .009) * S],
              'nameplate': [0, (y(.775) - chest[1]) * S, (z_back - chest[2] - .003) * S],
              'capBadge': [-.06 * H * S, (y(.792) - chest[1]) * S, (z_back - chest[2] - .006) * S],
              'decalScale': H * S / 2.15}
    # face: where the painted face sits on the head (relative to the head bone) and how much the face curves
    headv = P[core & (P[:, 1] > J['neck'][1] + .012 * H)]
    eye = headv[np.abs(headv[:, 1] - y(.912)) < .006 * H]
    zf = eye[np.abs(eye[:, 0]) < .006 * H][:, 2].max()
    a = np.abs(eye[eye[:, 2] > 0][:, 0]).max(); b = zf - eye[:, 2].min()
    extras['face'] = [0, (y(.91) - J['head'][1]) * S, (zf - J['head'][2] + .0015) * S]
    extras['faceSize'] = [.072 * H * S, .062 * H * S]
    extras['faceRadius'] = float(a * a / max(b / 2, 1e-3) * S * .9)
    # how much the jersey curves across the chest and back (ellipse curvature at the centre line), so decals can follow it
    for key, yy, sel in (('chestRadius', y(.705), lambda z: z > 0), ('backRadius', y(.775), lambda z: z < 0)):
        band = P[(np.abs(P[:, 1] - yy) < .01 * H) & jersey]
        a = np.abs(band[:, 0]).max(); zs = band[:, 2]; b = (zs.max() - zs.min()) / 2
        extras[key] = float(a * a / max(b, 1e-3) * S * .8)  # a little tighter than the fabric so the edges never float
    return write_glb(os.path.join(OUT, name + '.glb'), P * S, N, UV, JI, JW, meshes, {k: J[BONES[i][2]] * S for i, (k, _, _) in enumerate(BONES)}, extras)

def write_glb(path, P, N, UV, JI, JW, meshes, joint_pos, extras):
    blob = bytearray(); views, accessors = [], []
    def add(arr, comp, typ, target=None, minmax=False):
        data = arr.tobytes(); off = len(blob); blob.extend(data)
        while len(blob) % 4: blob.append(0)
        view = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: view['target'] = target
        views.append(view)
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if minmax: acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        accessors.append(acc); return len(accessors) - 1
    names = [b[0] for b in BONES]
    nodes = []
    for i, (bname, parent, _) in enumerate(BONES):
        p = joint_pos[bname] - (joint_pos[parent] if parent else 0)
        nodes.append({'name': bname, 'translation': [float(x) for x in p], 'children': []})
    for i, (bname, parent, _) in enumerate(BONES):
        if parent: nodes[BI[parent]]['children'].append(i)
    for n in nodes:
        if not n['children']: del n['children']
    ibm = np.zeros((len(BONES), 16), np.float32)
    for i, (bname, _, _) in enumerate(BONES):
        m = np.eye(4, dtype=np.float32); m[:3, 3] = -joint_pos[bname]
        ibm[i] = m.T.reshape(-1)  # column-major
    ibm_acc = add(ibm, 5126, 'MAT4')
    skin = {'joints': list(range(len(BONES))), 'inverseBindMatrices': ibm_acc, 'skeleton': 0}
    materials = []
    mat_index = {}
    MAT = {'skin': ([.55, .36, .25, 1], .55), 'kit': ([.41, .2, .67, 1], .7), 'shoes': ([.95, .95, .95, 1], .45), 'sole': ([.12, .12, .14, 1], .6),
           'hair': ([.07, .06, .06, 1], .8), 'band': ([1, 1, 1, 1], .8), 'sleeve': ([.06, .06, .07, 1], .6)}
    gl_meshes = []
    for mesh_name in ['body', 'head'] + [g for g in GARMENTS if g in meshes]:
        prims = []
        for mat, tris in meshes.get(mesh_name, {}).items():
            used = sorted({i for t in tris for i in t}); remap = {o: n for n, o in enumerate(used)}
            idx = np.array([[remap[i] for i in t] for t in tris], np.uint16 if len(used) < 65536 else np.uint32).reshape(-1)
            u = np.array(used)
            if mat not in mat_index:
                col, rough = MAT[mat]; mat_index[mat] = len(materials)
                materials.append({'name': mat, 'pbrMetallicRoughness': {'baseColorFactor': col, 'metallicFactor': 0, 'roughnessFactor': rough}})
            attrs = {'POSITION': add(P[u].astype(np.float32), 5126, 'VEC3', 34962, True),
                     'NORMAL': add(N[u].astype(np.float32), 5126, 'VEC3', 34962),
                     'TEXCOORD_0': add(UV[u].astype(np.float32), 5126, 'VEC2', 34962),
                     'JOINTS_0': add(JI[u].astype(np.uint8), 5121, 'VEC4', 34962),
                     'WEIGHTS_0': add(JW[u].astype(np.float32), 5126, 'VEC4', 34962)}
            prims.append({'attributes': attrs, 'indices': add(idx, 5123 if idx.dtype == np.uint16 else 5125, 'SCALAR', 34963), 'material': mat_index[mat]})
        gl_meshes.append({'name': mesh_name, 'primitives': prims})
        nodes.append({'name': mesh_name + '_mesh', 'mesh': len(gl_meshes) - 1, 'skin': 0})  # bones own the plain names
    root = {'name': 'player', 'children': [0] + list(range(len(BONES), len(nodes))), 'extras': extras}
    nodes.append(root)
    gltf = {'asset': {'version': '2.0', 'generator': 'Kangs build_players.py (Houdini OBJ + rig)'}, 'scene': 0,
            'scenes': [{'nodes': [len(nodes) - 1]}], 'nodes': nodes, 'meshes': gl_meshes, 'materials': materials,
            'skins': [skin], 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(out)
    return {'file': os.path.relpath(path, ROOT), 'bytes': len(out), 'verts': int(len(P)), 'tris': {m: sum(len(t) for t in d.values()) for m, d in meshes.items()}}

if __name__ == '__main__':
    spec = json.load(open(os.path.join(SRC, 'body_shapes.json')))
    for name in (sys.argv[1:] or list(spec['variants'])):
        print(build_variant(name, spec, os.path.join(SRC, 'houdini', 'export', 'kangs_%s.obj' % name)))
