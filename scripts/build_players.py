"""Turns the Houdini player meshes (OBJ) into rigged glTF bodies for the game.

Houdini Apprentice can only export OBJ, so the skeleton and skin weights are added here, from the same
body_shapes.json the Houdini builder used (assets-src/players/). Output: public/models/players/<variant>.glb and, with
--bake, the variant's normal + AO maps in public/models/players/maps/ (see assets-src/players/bake/atlas_bake.py).

Full rebuild (deterministic: the same inputs give the same files):
  pip install numpy scipy pillow scikit-image xatlas fast-simplification --break-system-packages
  python3 scripts/build_players.py --bake guard     # each variant ~6-8 min and ~1 GB RAM on 2 cores; one at a time
  python3 scripts/build_players.py --bake forward
  python3 scripts/build_players.py --bake center
  node scripts/player_lods.mjs                      # adds the far meshes (LOD1) to the GLBs just written
  npm test                                          # checks the GLBs carry the UV layout the maps were baked for
Without --bake only the GLBs are written; that is enough after a change that keeps the triangles (weights, extras), and
the build warns when the UV layout no longer matches the maps (any geometry change: re-bake).

Pipeline per variant: geometry (the OBJ + the cloud parts - buried faces, openings clipped, trim) -> unwrap (three
atlases: skin, kit, gear) -> bake (normal + AO from the high-detail SDF, in the tangent frames of the unwrap) -> rig ->
GLB with TEXCOORD_0 = (u, 1 - v) and TANGENT exactly as baked (never recomputed).

What is in each .glb (one scene, game units, y up, +z forward, feet at y=0):
  * a skeleton whose bones rest with no rotation (so the game's hip/knee/shoulder/elbow swings work unchanged):
    pelvis > spine > chest > neck > head, chest > shoulder > elbow > wrist (per side), pelvis > hip > knee > ankle (per side)
  * skinned meshes sharing that skeleton: "body_mesh" and "head_mesh" (skin), "jersey_mesh" and "shorts_mesh" (kit, recoloured
    per team), "shoes_mesh" (shoes, sole), four hair styles "hair_buzz/crop/afro/rows_mesh", and the options "headband_mesh",
    "sleeve_arm_mesh" (right arm) and "sleeve_leg_mesh" (left leg). The game keeps one hair style and the options it wants.
  * every primitive has POSITION, NORMAL, TANGENT, TEXCOORD_0 (the atlas of its material: skin, kit or gear), JOINTS_0, WEIGHTS_0
  * scene extras: decal anchors (chest number, back nameplate, captain badge) relative to the chest bone, and the height;
    maps.uvHash, the fingerprint of the UV layout (the maps' manifest.json carries the one they were baked for);
    the painted face: "face" (frame centre relative to the head bone), "faceSize" (absolute: heads do not scale with height)
    and "faceMarks" (brow, eye, nose, mouth and chin rows as fractions of the frame from its top; pupil, mouth and nose
    half-widths as fractions of its width), measured on the head SDF (assets-src/players/head_landmarks.py)
  * head rig: the head joint sits at the top of the spine, head-local (0, -35, -10) mm, the neck joint at the base of the
    neck; the head mesh is the fine Houdini head piece (above the H2 seam plane) and moves rigidly above the jaw line
  * hands, sneakers and the afro are not Houdini's: they come from assets-src/players/cloudmesh (SDFs meshed here; needs
    scikit-image and fast-simplification). The Houdini shoes and afro groups are replaced, the paddle hand is cut off and
    the forearm reshaped into the new wrist, and faces buried inside another part (feet in the shoes, the short-hair caps
    and the afro's cut inside the skull, the headband's cut caps) are dropped
"""
import json, math, os, struct, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'players')
OUT = os.path.join(ROOT, 'public', 'models', 'players')
UNITS_PER_M = 0.3306 / 0.3048  # the court is drawn at 0.3306 units per foot
BURIED = .0015   # a face whose corners and centroid all lie this far inside another part is never seen (bake/mesh_uv.py)

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
            'headband': ('core', 'band'), 'sleeve_arm': ('arm_R', 'sleeve'), 'sleeve_leg': ('core', 'sleeve'),
            'shoes_sole': ('core', 'sole')}   # the sneaker's midsole: drawn in the shoes mesh with the sole material
CLOUD = ('shoe_L', 'shoe_R', 'hair_afro')   # cloud-meshed parts that replace an OBJ group (the hands come after the rig)
REPLACED = ('shoes', 'hair_afro')

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
    # The head is built in absolute metres round its own origin (midway between the ear canals, body_shapes.json
    # variants.<v>.head) and does not scale with height, so its joints come from that origin, not from fractions of H.
    O = head_origin(v)
    out['head'] = O + HEAD_JOINT    # the top of the spine (occipital condyles): head turns and nods pivot here
    out['neck'] = O + NECK_JOINT    # the base of the neck, inside the neck column just above the shoulders
    return out

# Head-local frame (metres): origin midway between the ear canals, +y up, +z forward.
HEAD_JOINT = np.array([0, -.035, -.010])
NECK_JOINT = np.array([0, -.175, -.020])

def head_origin(v):
    h = v['head']
    return np.array([0.0, v['height_m'] - h['origin_from_top'], h['origin_z']])

def head_local(P, v):
    return P - head_origin(v)

def above_seam(L):
    """The head/body seam of the Houdini mesh (H2): the fine head piece is everything above this tilted plane, about 97 mm
    under the origin at the throat and 64 mm at the nape. L: head-local points."""
    return L[..., 1] > -.085 - .3 * L[..., 2]

def head_weight(L):
    """Share of the head bone (0..1) for head-local points: everything above the jaw line (y > -60 mm) and the underside of
    the jaw in front of the neck move rigidly with the head; below that the skin blends into the neck."""
    w_y = smooth(-.125, -.06, L[..., 1])
    w_front = smooth(.03, .058, L[..., 2]) * smooth(-.118, -.098, L[..., 1]) * (1 - smooth(.05, .075, np.abs(L[..., 0])))
    return np.maximum(w_y, w_front)

def face_layout(spec, v):
    """Where the painted face goes: a frame in head-local metres and the landmark rows inside it, measured on the head SDF
    (assets-src/players/head_landmarks.py, the same zero set the mesh is made from)."""
    sys.path.insert(0, SRC)
    import head_landmarks as hl
    lm = hl.measure(spec, v); f = hl.local_fn(v)
    eye, nose, mouth, chin = lm['eye_y'] / 1000, lm['subnasale_y'] / 1000, lm['stomion_y'] / 1000, lm['menton_y'] / 1000
    brow = eye + .0115                                   # brow line about +38 mm
    top, bottom, half = .066, chin - .018, .072          # frame: above the brows to just under the chin (jaw shadow)
    sellion_z = float(hl.front_z(f, [0], [lm['sellion_y']])[0]) / 1000
    rows = lambda y: (top - y) / (top - bottom)          # 0 at the top of the frame, 1 at the bottom
    return {'centre': np.array([0, (top + bottom) / 2, sellion_z]), 'size': (2 * half, top - bottom),
            'marks': {'brow': rows(brow), 'eye': rows(eye), 'nose': rows(nose), 'mouth': rows(mouth), 'chin': rows(chin),
                      'pupil': .033 / (2 * half), 'mouthHalf': .026 / (2 * half), 'noseHalf': lm['alae_half'] / 1000 / (2 * half)},
            'landmarks': lm}

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

def cloud():
    if SRC not in sys.path: sys.path.insert(0, SRC)
    import cloudmesh
    return cloudmesh

def reshape_wrists(P, N, G, variant):
    """The Houdini forearm swells into a paddle hand past the wrist. Its vertices from cloudmesh.ARM_BLEND on are moved onto
    cloudmesh.arm_sdf (the forearm blending into the anatomical wrist by the joint), sunk cloudmesh.arm_inset under where
    the hand will be (Newton steps along the gradient), with normals from arm_sdf without the inset: the field the hand's
    normals come from, so the seam where the hand comes out from under the forearm does not shade."""
    cm = cloud(); H = cm._v(variant)['height_m']
    def grad(f, X, e=1e-4):
        g = np.zeros_like(X)
        for k in range(3):
            dx = np.zeros(3); dx[k] = e; g[:, k] = (f(X + dx) - f(X - dx)) / (2 * e)
        return g
    for side in ('L', 'R'):
        o, R = cm.part_frame(variant, 'hand_' + side)
        m = np.where((G == 'arm_' + side) & (((P - o) @ R[:, 1]) > cm.ARM_BLEND * H))[0]
        if not len(m): continue
        f = lambda X: cm.arm_sdf(variant, side, X) + cm.arm_inset(variant, side, X)
        X = P[m].copy()
        for _ in range(6):
            d = f(X); g = grad(f, X)
            X = X - g * (d / np.maximum((g * g).sum(1), 1e-9))[:, None]
        g = grad(lambda Y: cm.arm_sdf(variant, side, Y), X)
        P[m] = X; N[m] = g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
    return P, N

def buried(P, tris, rules):
    """Triangles (indices into tris) whose corners and centroid all lie more than BURIED inside another part. rules: group ->
    function giving the other parts' SDF at points (n x 3)."""
    out = set()
    for g, sdf in rules.items():
        ids = [ti for ti, (tri, gg) in enumerate(tris) if gg == g]
        if not ids: continue
        T = np.array([tris[ti][0] for ti in ids]); C = P[T].mean(1)
        d = sdf(np.vstack([P[T].reshape(-1, 3), C]))
        inside = d < -BURIED
        hit = inside[:3 * len(ids)].reshape(-1, 3).all(1) & inside[3 * len(ids):]
        out |= {ids[k] for k in np.where(hit)[0]}
    return out

def covered_body(P, N, G, tris, H, neck_y, gone=()):
    """Skin vertices hidden under the jersey or shorts: fabric lies directly over them (within a few centimetres along the
    skin normal, not off to the side) and faces the same way. Triangles made only of these are dropped, so skin can never
    poke through the kit; at the neck, armholes and hems the nearest fabric is the rounded rim, so the skin there stays."""
    gone = set(gone)   # garment triangles already dropped (the hidden inner wall): only the visible fabric counts
    garment = np.array(sorted({v for ti, (tri, g) in enumerate(tris) if g in ('jersey', 'shorts') and ti not in gone for v in tri}))
    body = np.where((G == 'core') & (P[:, 1] < neck_y))[0]
    hidden = np.zeros(len(P), bool)
    for k in range(0, len(body), 512):
        idx = body[k:k + 512]
        d = ((P[idx, None, :] - P[None, garment, :]) ** 2).sum(-1); near = garment[d.argmin(1)]
        off = P[near] - P[idx]; along = (off * N[idx]).sum(1); lateral = np.linalg.norm(off - N[idx] * along[:, None], axis=1)
        facing = (N[near] * N[idx]).sum(1) > .6
        hidden[idx] = (along > -.004 * H) & (along < .04 * H) & (lateral < .012 * H) & facing
    return hidden

def inside_body(P, N, G, tris, H):
    """Clothing triangles that lie inside the body. Houdini builds each garment as a solid that contains the body, so the
    carved neck scoop, armholes and the flat cut caps run through the skin and show as ragged patches. Dropping them leaves
    a clean fabric edge at every opening."""
    skin = np.where((G == 'core') | (G == 'arm_L') | (G == 'arm_R'))[0]
    out = set(); items = [(ti, tri) for ti, (tri, g) in enumerate(tris) if g in ('jersey', 'shorts')]
    C = np.array([P[tri].mean(0) for _, tri in items])
    F = np.array([np.cross(P[tri[1]] - P[tri[0]], P[tri[2]] - P[tri[0]]) for _, tri in items]); F /= np.maximum(np.linalg.norm(F, axis=1, keepdims=True), 1e-12)
    for k in range(0, len(C), 512):
        c = C[k:k + 512]; d = ((c[:, None, :] - P[None, skin, :]) ** 2).sum(-1); near = skin[d.argmin(1)]
        depth = ((c - P[near]) * N[near]).sum(1); facing = (F[k:k + 512] * N[near]).sum(1)
        # the inner wall sits ~4 mm inside the skin and faces inward; outer fabric is never dropped, even where skin is close
        for j in np.where((depth < -.0012 * H) & (facing < 0))[0]: out.add(items[k + j][0])
    return out

def smooth_openings(P, tris, groups=('jersey', 'shorts'), iterations=10):
    """Smooths the open edges of the clothing (left by inside_body) into clean curves: each edge vertex moves toward the
    middle of its two neighbours along the edge. Render vertices that share a position move together."""
    key = {}; wid = np.empty(len(P), int)
    for i, p in enumerate(np.round(P, 6)):
        wid[i] = key.setdefault(tuple(p), len(key))
    members = {}
    for i, w in enumerate(wid): members.setdefault(w, []).append(i)
    for g in groups:
        count = {}
        for tri, gg in tris:
            if gg != g: continue
            for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
                k = (min(wid[a], wid[b]), max(wid[a], wid[b])); count[k] = count.get(k, 0) + 1
        nb = {}
        for (a, b), n in count.items():
            if n == 1: nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
        ring = [w for w, ns in nb.items() if len(ns) == 2]
        if not ring: continue
        pos = {w: P[members[w][0]].copy() for w in nb}
        for _ in range(iterations):
            new = {w: .5 * pos[w] + .25 * (pos[nb[w][0]] + pos[nb[w][1]]) for w in ring}
            pos.update(new)
        for w in ring:
            for i in members[w]: P[i] = pos[w]
    return P

def add_trim(P, N, G, tris, H, groups=('jersey', 'shorts'), radius=.0042, sides=5, step=.028):
    """Binding round every opening of the jersey (neck, armholes) and shorts (legs, waist): a thin tube swept along each
    open edge loop, smoothed and resampled, skinned like the fabric under it (rig copies the weights of src). Covers the
    uneven cut edge and adds the trim real jerseys have; it is drawn in the team's lettering colour (material 'trim').
    Returns P, N, G, tris, src (the fabric vertex each new vertex follows) and the tubes (centre line, closed, radius) the
    bake makes its round SDF from."""
    key = {}; wid = np.empty(len(P), int)
    for i, p in enumerate(np.round(P, 6)): wid[i] = key.setdefault(tuple(p), len(key))
    rep = {}
    for i, w in enumerate(wid): rep.setdefault(w, i)
    add_p, add_n, add_src, new, tubes = [], [], [], [], []
    base = len(P)
    for g in groups:
        count, nsum = {}, {}
        for tri, gg in tris:
            if gg != g: continue
            for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
                k = (min(wid[a], wid[b]), max(wid[a], wid[b])); count[k] = count.get(k, 0) + 1
            for v in tri: nsum[wid[v]] = nsum.get(wid[v], 0) + N[v]
        nb = {}
        for (a, b), n in count.items():
            if n == 1: nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
        # walk the open edges into loops; where two loops touch at one point, carry on along the straightest edge
        used = set(); chains = []
        for (a0, b0), n in count.items():
            if n != 1 or (a0, b0) in used: continue
            loop = [a0, b0]; used.add((a0, b0)); closed = False
            while True:
                cur, prev = loop[-1], loop[-2]
                d0 = P[rep[cur]] - P[rep[prev]]
                options = [m for m in nb[cur] if (min(cur, m), max(cur, m)) not in used]
                if not options: break
                m = max(options, key=lambda m: (P[rep[m]] - P[rep[cur]]) @ d0 / max(np.linalg.norm(P[rep[m]] - P[rep[cur]]), 1e-9))
                used.add((min(cur, m), max(cur, m)))
                if m == loop[0]: closed = True; break
                loop.append(m)
            chains.append((loop, closed))
        for loop, closed in chains:
            if len(loop) < 10: continue
            if g == 'jersey' and np.mean([P[rep[w]][1] for w in loop]) < .6 * H: continue   # tucked into the shorts
            if np.linalg.norm(np.diff(np.array([P[rep[w]] for w in loop]), axis=0), axis=1).sum() < .2 * H: continue   # small hidden scraps
            pts = np.array([P[rep[w]] for w in loop]); nrm = np.array([nsum[w] for w in loop], float)
            nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
            for _ in range(30):
                sm = .5 * pts + .25 * (np.roll(pts, 1, 0) + np.roll(pts, -1, 0))
                if not closed: sm[0], sm[-1] = pts[0], pts[-1]   # open edge: keep its ends
                pts = sm
            nxt = np.roll(pts, -1, 0) if closed else np.vstack([pts[1:], pts[-1:]])
            seg = np.linalg.norm(nxt - pts, axis=1); total = seg.sum(); cum = np.concatenate([[0], np.cumsum(seg)])
            M = max(6, int(total / (step * H)))
            at = np.linspace(0, total, M, endpoint=not closed); idx = np.minimum(np.searchsorted(cum, at, side='right') - 1, len(pts) - 1); f = (at - cum[idx]) / np.maximum(seg[idx], 1e-9)
            q = pts[idx] + (nxt[idx] - pts[idx]) * np.clip(f, 0, 1)[:, None]; qn = nrm[idx]
            r = radius * H; start = base + len(add_p); centres = []
            for i in range(M):
                t = q[(i + 1) % M if closed else min(i + 1, M - 1)] - q[i - 1 if closed else max(i - 1, 0)]; t /= max(np.linalg.norm(t), 1e-9)
                n = qn[i] - t * (qn[i] @ t); n /= max(np.linalg.norm(n), 1e-9); b = np.cross(t, n); c = q[i] + n * r * .6
                centres.append(c)
                for k in range(sides):
                    a = 2 * np.pi * k / sides; d = np.cos(a) * n + np.sin(a) * b
                    add_p.append(c + d * r); add_n.append(d); add_src.append(rep[loop[idx[i]]])
            for i in range(M if closed else M - 1):
                for k in range(sides):
                    a = start + i * sides + k; b2 = start + i * sides + (k + 1) % sides
                    c2 = start + ((i + 1) % M) * sides + k; d2 = start + ((i + 1) % M) * sides + (k + 1) % sides
                    new += [([a, c2, b2], 'trim'), ([b2, c2, d2], 'trim')]
            tubes.append((np.array(centres), closed, r))
    if not add_p: return P, N, G, tris, np.zeros(0, int), tubes
    add_p, add_n, src = np.array(add_p), np.array(add_n), np.array(add_src)
    allP = np.vstack([P, add_p])
    # wind every trim triangle so it faces outward (along the tube normal)
    fixed = []
    for tri, g in new:
        a, b, c = allP[tri]; fn = np.cross(b - a, c - a)
        nn = add_n[tri[0] - base] + add_n[tri[1] - base] + add_n[tri[2] - base]
        fixed.append((tri if fn @ nn >= 0 else [tri[0], tri[2], tri[1]], g))
    return allP, np.vstack([N, add_n]), np.concatenate([G, np.array(['trim'] * len(add_p))]), tris + fixed, src, tubes

def opening_shapes(H, SH):
    """The jersey and shorts openings as smooth shapes, the same ones the Houdini recipe carves (GARMENT_VEX), a little
    larger so the fabric is cut cleanly before the ragged voxel rims. Each returns > 0 where fabric is kept."""
    def ell(c, r, grow):
        c, r = np.array(c, float), np.array(r, float) * grow
        return lambda p: np.sqrt((((p - c) / r) ** 2).sum(-1)) - 1
    below = lambda y0: (lambda p: y0 - p[..., 1])   # keep below y0
    above = lambda y0: (lambda p: p[..., 1] - y0)   # keep above y0
    jersey = [ell((sd * .118 * H * SH, .762 * H, -.006 * H), (.05 * H, .072 * H, .075 * H), 1.09) for sd in (-1, 1)]
    jersey += [ell((0, .835 * H, .03 * H), (.048 * H, .06 * H, .06 * H), 1.09), ell((0, .85 * H, -.035 * H), (.045 * H, .035 * H, .05 * H), 1.1),
               below(.866 * H)]
    shorts = [above(.334 * H), below(.572 * H)]   # the inseam stays as Houdini carved it (each leg stays a closed tube)
    return {'jersey': jersey, 'shorts': shorts}

def clip_openings(P, N, G, tris, shapes):
    """Cuts each garment along its opening shapes: triangles are clipped exactly where a shape's value crosses zero
    (new vertices interpolated along the edges), so every neckline, armhole and hem is a smooth edge. (UVs and tangents
    come later, from the unwrap of the final triangles, so there is nothing else to carry.)"""
    P, N, G = list(P), list(N), list(G); cache = {}; out = []
    def cut(a, b, fa, fb, g, k):
        key = (min(a, b), max(a, b), k)
        if key not in cache:
            t = fa / (fa - fb)
            P.append(P[a] + (P[b] - P[a]) * t); n = N[a] + (N[b] - N[a]) * t; N.append(n / max(np.linalg.norm(n), 1e-9))
            G.append(g); cache[key] = len(P) - 1
        return cache[key]
    for tri, g in tris:
        polys = [list(tri)]
        for k, f in enumerate(shapes.get(g, [])):
            nxt = []
            for poly in polys:
                vals = [float(f(P[v])) for v in poly]
                if min(vals) >= 0: nxt.append(poly); continue
                if max(vals) < 0: continue
                res = []
                for i, a in enumerate(poly):
                    b = poly[(i + 1) % len(poly)]; fa, fb = vals[i], vals[(i + 1) % len(poly)]
                    if fa >= 0: res.append(a)
                    if (fa >= 0) != (fb >= 0): res.append(cut(a, b, fa, fb, g, k))
                if len(res) >= 3: nxt.append(res)
            polys = nxt
        for poly in polys:
            for i in range(1, len(poly) - 1): out.append(([poly[0], poly[i], poly[i + 1]], g))
    return np.array(P), np.array(N), np.array(G), out

def geometry(name, spec, objpath):
    """Stage 1: the final triangles. The Houdini OBJ, the cloud-meshed sneakers, afro and hands, the forearm reshaped into
    the wrist, the openings clipped, buried and covered faces dropped, the trim added and the headband's normals averaged
    (before the bake, which must see the normals the GLB carries). Returns the vertex arrays (P, N, G), the triangles
    [(indices, group)], the trim's weight sources and centre lines, and the joints."""
    v = spec['variants'][name]; H = v['height_m']
    J = joints_for(spec, v)
    J['top'] = np.array([0, H, 0]); J['hand_L'] = J['hand_end_L']; J['hand_R'] = J['hand_end_R']
    pos, uv, nrm, faces = read_obj(objpath)
    # unique render vertices (position/normal pairs) per part group; the OBJ's own point UVs are not used (they fold
    # every island over itself; bake/README: the atlas comes from the unwrap below)
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
    G = np.array(groups, dtype=object)
    cm = cloud()
    # the sneakers and the afro are cloud-meshed (cloudmesh): their Houdini groups go, the new meshes come in under the same
    # group names (the midsole as 'shoes_sole') and take their skin weights from the body under them like any garment
    tris = [(t, g) for t, g in tris if g not in REPLACED]
    for part in CLOUD:
        m = cm.part_mesh(name, part); base = len(P)
        gname = np.where(m['mat'] == 'sole', 'shoes_sole', m['group'])
        vg = np.full(len(m['V']), m['group'], dtype=object)
        for f, gg in zip(m['F'], gname): vg[f] = gg
        P = np.vstack([P, m['V']]); N = np.vstack([N, m['N']])
        G = np.concatenate([G, vg])
        tris += [([base + int(a), base + int(b), base + int(c)], str(gg)) for (a, b, c), gg in zip(m['F'], gname)]
    G = G.astype(str)
    # the forearm ends in the new wrist, and is cut cleanly just past the joint, where the hand takes over
    P, N = reshape_wrists(P, N, G, name)
    shapes = opening_shapes(H, v['shoulder'])
    for side in ('L', 'R'):
        o, R = cm.part_frame(name, 'hand_' + side)
        shapes['arm_' + side] = [lambda p, o=o, ax=R[:, 1]: cm.ARM_CUT * H - (p - o) @ ax]
    # clean openings: cut the jersey and shorts along smooth neckline, armhole, hem and waistband shapes, the arms at the hand
    P, N, G, tris = clip_openings(P, N, G, tris, shapes)
    # hands: the anatomical cloud-meshed hand (palm, fingers, thumb), rigid on the wrist bone (rig), over the end of the forearm
    for side in ('L', 'R'):
        m = cm.part_mesh(name, 'hand_' + side); base = len(P); n = len(m['V'])
        P = np.vstack([P, m['V']]); N = np.vstack([N, m['N']])
        G = np.concatenate([G, np.array([m['group']] * n)])
        tris += [([base + int(a), base + int(b), base + int(c)], m['group']) for a, b, c in m['F']]
    # faces nobody sees: the feet inside the shoes, the short-hair caps and the afro's cut inside the skull, the headband's
    # cut caps, the hand's cap inside the forearm and the forearm's end under the hand
    low = np.where(P[:, 1] < .2 * H)[0]; covered = np.zeros(len(P), bool); covered[low] = cm.shoe_covers(name, P[low])
    drop = {ti for ti, (tri, g) in enumerate(tris) if g == 'core' and covered[tri].all()}
    if os.path.join(SRC, 'bake') not in sys.path: sys.path.insert(0, os.path.join(SRC, 'bake'))
    import sdf_hi
    S = sdf_hi.PlayerSDF(spec, name)
    rules = {g: S.core for g in ('hair_buzz', 'hair_crop', 'hair_rows', 'hair_afro', 'headband')}
    for side in ('L', 'R'):
        rules['hand_' + side] = lambda X, side=side: cm.arm_sdf(name, side, X)
        rules['arm_' + side] = lambda X, side=side: cm.hand_sdf(name, side, X)
    drop |= buried(P, tris, rules)
    # skin hidden under the jersey and shorts is removed (no poke-through, fewer triangles)
    drop |= inside_body(P, N, G, tris, H)
    hidden = covered_body(P, N, G, tris, H, .81 * H, drop)   # skin below the old neck height only (the collar stays)
    tris = [(tri, g) for ti, (tri, g) in enumerate(tris) if ti not in drop and not (g == 'core' and hidden[tri].all())]
    n_before_trim = len(P)
    P, N, G, tris, trim_src, tubes = add_trim(P, N, G, tris, H)
    # the headband is pushed out along its normals in the game (materials.js inflate); with split normals at its edges the
    # pieces part and open dark cracks, so every corner at one position gets the same, averaged normal
    band = np.where(G == 'headband')[0]
    if len(band):
        groups = {}
        for i in band: groups.setdefault(tuple(np.round(P[i], 5)), []).append(i)
        for ids in groups.values():
            n = N[ids].sum(0); N[ids] = n / max(np.linalg.norm(n), 1e-9)
    return {'name': name, 'v': v, 'H': H, 'J': J, 'P': P, 'N': N, 'G': G, 'tris': tris,
            'trim_first': n_before_trim, 'trim_src': trim_src, 'trim_tubes': tubes}

def rig(geo):
    """Stage 4: skin weights (4 influences) for every vertex of the geometry: arms down the chest > shoulder > elbow >
    wrist chain, legs, the torso chain and the head, garments and hair copying the skin under them, the hands rigid on the
    wrist and the trim following the fabric it binds. Weights depend only on position and group, so a vertex split by a UV
    seam gets the same weights on both sides."""
    v, H, J, P, G = geo['v'], geo['H'], geo['J'], geo['P'], geo['G']
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
    # torso chain: redistribute the pelvis share up the spine by height (pelvis > spine > chest > neck), then the head
    # takes everything above the jaw line (head_weight), blending into the neck below it
    torso = W[:, BI['pelvis']].copy()
    ys = P[:, 1]
    tb = ['pelvis', 'spine', 'chest', 'neck']
    jy = [J['pelvis'][1], J['spine'][1], J['chest'][1], J['neck'][1]]
    widths = [0, .02 * H, .02 * H, .035]
    tw = np.zeros((len(P), len(tb) + 1)); tw[:, 0] = 1
    for i in range(1, len(tb)):
        w = smooth(jy[i] - widths[i], jy[i] + widths[i], ys); tw[:, i] = tw[:, i - 1] * w; tw[:, i - 1] *= (1 - w)
    hw = head_weight(head_local(P, v))
    tw[:, :len(tb)] *= (1 - hw)[:, None]; tw[:, len(tb)] = hw
    tb = tb + ['head']
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
    # hands: rigid on the wrist bone
    for side in ('L', 'R'):
        m = G == 'hand_' + side
        JI[m] = [BI['wrist_' + side], 0, 0, 0]; JW[m] = [1.0, 0, 0, 0]
    # the trim follows the fabric vertex it was swept from
    t0 = geo['trim_first']
    if len(geo['trim_src']):
        JI[t0:] = JI[geo['trim_src']]; JW[t0:] = JW[geo['trim_src']]
    return JI, JW

def layout(geo, log=print):
    """Stage 2: the unwrap of the final triangles into the skin, kit and gear atlases (bake/atlas_bake.py)."""
    if os.path.join(SRC, 'bake') not in sys.path: sys.path.insert(0, os.path.join(SRC, 'bake'))
    import atlas_bake
    T = np.array([t for t, _ in geo['tris']], np.int64); g = np.array([gg for _, gg in geo['tris']])
    return atlas_bake.unwrap(geo['P'], geo['N'], geo['G'], T, g, geo['name'], log=log)

def build_variant(name, spec, objpath, do_bake=False, jobs=None, log=print):
    geo = geometry(name, spec, objpath)
    lay = layout(geo, log)
    import atlas_bake
    if do_bake:   # stage 3: normal + AO maps from the high-detail SDF, in the tangent frames written below
        atlas_bake.bake(name, geo['P'], geo['N'], geo['G'], lay, geo['trim_tubes'], jobs=jobs, log=log)
    elif atlas_bake.manifest().get(name, {}).get('uvHash') != lay.uv_hash():
        log('  WARNING: %s: the maps in public/models/players/maps were baked for another UV layout; run with --bake' % name)
    JI, JW = rig(geo)   # stage 4
    v, H, J, P, N, G = geo['v'], geo['H'], geo['J'], geo['P'], geo['N'], geo['G']
    core = G == 'core'
    # materials and meshes by region (heights as fractions of H)
    y = lambda f: f * H
    def region(tri, g):
        if g == 'trim': return ('trim', 'trim')
        c = P[tri].mean(0)
        if g == 'shoes_sole': return ('shoes', 'sole')
        if g in GARMENTS: return (g, GARMENTS[g][1])
        if g == 'core' and above_seam(head_local(c, v)): return ('head', 'skin')   # the fine Houdini head piece
        return ('body', 'skin')
    meshes = {}
    for (tri, g), utri in zip(geo['tris'], lay.tris):
        mesh, mat = region(tri, g)
        meshes.setdefault(mesh, {}).setdefault(mat, []).append(utri.tolist())   # indices into the unwrapped vertices

    S = UNITS_PER_M
    chest = J['chest']
    jersey = (G == 'jersey') if (G == 'jersey').any() else core
    z_front = P[(np.abs(P[:, 0]) < .03 * H) & (np.abs(P[:, 1] - y(.71)) < .015 * H) & jersey][:, 2].max()
    z_back = P[(np.abs(P[:, 0]) < .03 * H) & (np.abs(P[:, 1] - y(.765)) < .015 * H) & jersey][:, 2].min()
    extras = {'variant': name, 'height': H * S,
              'number': [0, (y(.705) - chest[1]) * S, (z_front - chest[2] + .009) * S],
              'nameplate': [0, (y(.775) - chest[1]) * S, (z_back - chest[2] - .003) * S],
              'capBadge': [-.06 * H * S, (y(.792) - chest[1]) * S, (z_back - chest[2] - .006) * S],
              'decalScale': H * S / 2.15,
              'maps': {'uvHash': lay.uv_hash()}}
    # face: where the painted face sits on the head (relative to the head bone, game units), its size (absolute: heads do not
    # grow with height) and the landmark rows the painted features line up with (fractions of the frame, from the top)
    fl = face_layout(spec, v)
    O = head_origin(v)
    extras['face'] = [float(x) for x in (O + fl['centre'] + [0, 0, .0015] - J['head']) * S]
    extras['faceSize'] = [float(fl['size'][0] * S), float(fl['size'][1] * S)]
    extras['faceMarks'] = {k: round(float(x), 4) for k, x in fl['marks'].items()}
    # how much the face curves across the eye line (ellipse curvature at the centre line)
    L = head_local(P, v); band = L[core & above_seam(L) & (np.abs(L[:, 1] - fl['landmarks']['eye_y'] / 1000) < .006)]
    a = np.abs(band[band[:, 2] > 0][:, 0]).max(); b = band[:, 2].max() - band[:, 2].min()
    extras['faceRadius'] = float(a * a / max(b / 2, 1e-3) * S * .9)
    # how much the jersey curves across the chest and back (ellipse curvature at the centre line), so decals can follow it
    for key, yy, sel in (('chestRadius', y(.705), lambda z: z > 0), ('backRadius', y(.775), lambda z: z < 0)):
        band = P[(np.abs(P[:, 1] - yy) < .01 * H) & jersey]
        a = np.abs(band[:, 0]).max(); zs = band[:, 2]; b = (zs.max() - zs.min()) / 2
        extras[key] = float(a * a / max(b, 1e-3) * S * .8)  # a little tighter than the fabric so the edges never float
    # stage 5: the GLB, per unwrapped vertex. glTF UVs run down the image: TEXCOORD_0 = (u, 1 - v) of the atlas (v up)
    s = lay.src
    UV = np.stack([lay.uv[:, 0], 1 - lay.uv[:, 1]], 1)
    TAN = np.concatenate([lay.T, lay.w[:, None]], 1)
    return write_glb(os.path.join(OUT, name + '.glb'), P[s] * S, N[s], UV, TAN, JI[s], JW[s], meshes,
                     {k: J[BONES[i][2]] * S for i, (k, _, _) in enumerate(BONES)}, extras)

def write_glb(path, P, N, UV, TAN, JI, JW, meshes, joint_pos, extras):
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
           'hair': ([.07, .06, .06, 1], .8), 'band': ([1, 1, 1, 1], .8), 'sleeve': ([.06, .06, .07, 1], .6), 'trim': ([.91, .72, .35, 1], .6)}
    gl_meshes = []
    for mesh_name in ['body', 'head'] + [g for g in GARMENTS if g in meshes] + (['trim'] if 'trim' in meshes else []):
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
                     'TANGENT': add(TAN[u].astype(np.float32), 5126, 'VEC4', 34962),
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
    import argparse
    ap = argparse.ArgumentParser(description='Build the rigged player GLBs (and, with --bake, their normal + AO maps).')
    ap.add_argument('variants', nargs='*')
    ap.add_argument('--bake', action='store_true', help='also bake public/models/players/maps/<variant>_<atlas>.png (~6 min/variant)')
    ap.add_argument('--jobs', type=int, default=None, help='worker processes for the bake (default: the CPU count)')
    a = ap.parse_args()
    spec = json.load(open(os.path.join(SRC, 'body_shapes.json')))
    for name in (a.variants or list(spec['variants'])):
        print(build_variant(name, spec, os.path.join(SRC, 'houdini', 'export', 'kangs_%s.obj' % name), a.bake, a.jobs))
