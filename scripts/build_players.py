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

def blob(center, ax, ay, az, ra, rb, rc, segs=8, rings=6, e=.7):
    """A rounded box / ellipsoid (superellipsoid with exponent e) along the unit axes ax (length ra), ay (rb), az (rc).
    Returns points, normals and triangles (local indices)."""
    pts, nrms, tris = [], [], []
    f = lambda w, m: np.sign(w) * np.abs(w) ** m
    for i in range(rings + 1):
        v = -np.pi / 2 + np.pi * i / rings
        for j in range(segs):
            u = 2 * np.pi * j / segs
            cv, sv, cu, su = np.cos(v), np.sin(v), np.cos(u), np.sin(u)
            x, y, z = f(sv, e) * ra, f(cv, e) * f(cu, e) * rb, f(cv, e) * f(su, e) * rc
            nx, ny, nz = f(sv, 2 - e) / ra, f(cv, 2 - e) * f(cu, 2 - e) / rb, f(cv, 2 - e) * f(su, 2 - e) / rc
            pts.append(center + ax * x + ay * y + az * z)
            nv = ax * nx + ay * ny + az * nz; nrms.append(nv / max(np.linalg.norm(nv), 1e-9))
    for i in range(rings):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            c, d = a + segs, b + segs
            tris += [(a, c, b), (b, c, d)]
    return np.array(pts), np.array(nrms), tris

def hand_parts(J, side, H):
    """A relaxed hand hanging from the wrist: palm, four slightly curled fingers and a thumb (metres).
    Palms face the body, thumbs point forward, as in the rest pose."""
    W = J['wrist_' + side]; down = J['hand_end_' + side] - W; down /= np.linalg.norm(down)
    inward = np.array([-1.0 if side == 'L' else 1.0, 0, 0]); inward -= down * (inward @ down); inward /= np.linalg.norm(inward)
    fwd = np.cross(down, inward); fwd *= np.sign(fwd[2]) if fwd[2] else 1
    unit = lambda v: v / np.linalg.norm(v)
    # palm: starts inside the end of the forearm so the wrist blends, a little thicker at the heel of the hand
    parts = [blob(W + down * .032 * H, down, fwd, inward, .042 * H, .0215 * H, .0122 * H, 10, 8, .6)]
    for k, (off, length) in enumerate(((.0126, .038), (.0042, .042), (-.0042, .04), (-.0124, .032))):
        curl = .36 + .025 * k                     # fingers side by side, curling gently toward the palm
        axis = unit(down * np.cos(curl) + inward * np.sin(curl))
        base = W + down * .064 * H + fwd * off * H + inward * .003 * H
        parts.append(blob(base + axis * length * H * .5, axis, fwd, np.cross(axis, fwd), length * H * .5, .0047 * H, .0056 * H, 8, 6, .85))
    taxis = unit(down * .8 + fwd * .35 + inward * .5)   # thumb along the front of the palm, tip toward the fingers
    parts.append(blob(W + down * .024 * H + fwd * .017 * H + inward * .006 * H + taxis * .02 * H, taxis, fwd, np.cross(taxis, fwd), .022 * H, .006 * H, .0064 * H, 8, 6, .8))
    return parts

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

def add_trim(P, N, UV, JI, JW, G, tris, H, groups=('jersey', 'shorts'), radius=.0042, sides=5, step=.025):
    """Binding round every opening of the jersey (neck, armholes) and shorts (legs, waist): a thin tube swept along each
    open edge loop, smoothed and resampled, skinned like the fabric under it. Covers the uneven cut edge and adds the trim
    real jerseys have; it is drawn in the team's lettering colour (material 'trim')."""
    key = {}; wid = np.empty(len(P), int)
    for i, p in enumerate(np.round(P, 6)): wid[i] = key.setdefault(tuple(p), len(key))
    rep = {}
    for i, w in enumerate(wid): rep.setdefault(w, i)
    add_p, add_n, add_src, new = [], [], [], []
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
            r = radius * H; start = base + len(add_p)
            for i in range(M):
                t = q[(i + 1) % M if closed else min(i + 1, M - 1)] - q[i - 1 if closed else max(i - 1, 0)]; t /= max(np.linalg.norm(t), 1e-9)
                n = qn[i] - t * (qn[i] @ t); n /= max(np.linalg.norm(n), 1e-9); b = np.cross(t, n); c = q[i] + n * r * .6
                for k in range(sides):
                    a = 2 * np.pi * k / sides; d = np.cos(a) * n + np.sin(a) * b
                    add_p.append(c + d * r); add_n.append(d); add_src.append(rep[loop[idx[i]]])
            for i in range(M if closed else M - 1):
                for k in range(sides):
                    a = start + i * sides + k; b2 = start + i * sides + (k + 1) % sides
                    c2 = start + ((i + 1) % M) * sides + k; d2 = start + ((i + 1) % M) * sides + (k + 1) % sides
                    new += [([a, c2, b2], 'trim'), ([b2, c2, d2], 'trim')]
    if not add_p: return P, N, UV, JI, JW, G, tris
    add_p, add_n, src = np.array(add_p), np.array(add_n), np.array(add_src)
    allP = np.vstack([P, add_p])
    # wind every trim triangle so it faces outward (along the tube normal)
    fixed = []
    for tri, g in new:
        a, b, c = allP[tri]; fn = np.cross(b - a, c - a)
        nn = add_n[tri[0] - base] + add_n[tri[1] - base] + add_n[tri[2] - base]
        fixed.append((tri if fn @ nn >= 0 else [tri[0], tri[2], tri[1]], g))
    return (allP, np.vstack([N, add_n]), np.vstack([UV, np.zeros((len(add_p), 2))]), np.vstack([JI, JI[src]]), np.vstack([JW, JW[src]]),
            np.concatenate([G, np.array(['trim'] * len(add_p))]), tris + fixed)

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

def clip_openings(P, N, UV, G, tris, shapes):
    """Cuts each garment along its opening shapes: triangles are clipped exactly where a shape's value crosses zero
    (new vertices interpolated along the edges), so every neckline, armhole and hem is a smooth edge."""
    P, N, UV, G = list(P), list(N), list(UV), list(G); cache = {}; out = []
    def cut(a, b, fa, fb, g, k):
        key = (min(a, b), max(a, b), k)
        if key not in cache:
            t = fa / (fa - fb)
            P.append(P[a] + (P[b] - P[a]) * t); n = N[a] + (N[b] - N[a]) * t; N.append(n / max(np.linalg.norm(n), 1e-9))
            UV.append(UV[a] + (UV[b] - UV[a]) * t); G.append(g); cache[key] = len(P) - 1
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
    return np.array(P), np.array(N), np.array(UV), np.array(G), out

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
    # clean openings: cut the jersey and shorts along smooth neckline, armhole, hem and waistband shapes
    P, N, UV, G, tris = clip_openings(P, N, UV, G, tris, opening_shapes(H, v['shoulder']))

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

    # hands: the Houdini hand is a thin rounded paddle; replace it with a modelled hand (palm, fingers, thumb) on the wrist
    drop = set()
    for side in ('L', 'R'):
        wr = J['wrist_' + side]; ax = J['hand_end_' + side] - wr; ax /= np.linalg.norm(ax)
        beyond = ((P - wr) @ ax > .02 * H) & (G == 'arm_' + side)   # keep the end of the forearm; the palm covers it
        for ti, (tri, g) in enumerate(tris):
            if g == 'arm_' + side and beyond[tri].all(): drop.add(ti)
        for pts, nrms, ptris in hand_parts(J, side, H):
            base = len(P)
            P = np.vstack([P, pts]); N = np.vstack([N, nrms]); UV = np.vstack([UV, np.zeros((len(pts), 2))])
            JI = np.vstack([JI, np.tile([BI['wrist_' + side], 0, 0, 0], (len(pts), 1))]); JW = np.vstack([JW, np.tile([1.0, 0, 0, 0], (len(pts), 1))])
            G = np.concatenate([G, np.array(['hand_' + side] * len(pts))])
            tris += [([base + a, base + b, base + c], 'hand_' + side) for a, b, c in ptris]
    # skin hidden under the jersey and shorts is removed (no poke-through, fewer triangles)
    drop |= inside_body(P, N, G, tris, H)
    hidden = covered_body(P, N, G, tris, H, J['neck'][1], drop)
    tris = [(tri, g) for ti, (tri, g) in enumerate(tris) if ti not in drop and not (g == 'core' and hidden[tri].all())]
    P, N, UV, JI, JW, G, tris = add_trim(P, N, UV, JI, JW, G, tris, H)
    core = G == 'core'
    # materials and meshes by region (heights as fractions of H)
    y = lambda f: f * H
    def region(tri, g):
        if g == 'trim': return ('trim', 'trim')
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
