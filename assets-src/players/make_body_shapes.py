"""Writes body_shapes.json: the Kangs player body as a table of shapes, shared by the Houdini builder
(assets-src/players/houdini/build_players.py) and the rig/glTF step (scripts/build_players.py).

Body ('shapes'): all positions and radii are fractions of standing height. y is up, +z is forward, feet at y=0; x>0 is the
player's left. The head is NOT in that list: each variant has a 'head' block in absolute head-local metres (see the
head block section below and 'head_about' in the JSON); the core part is smin(body core, head, head.neck_k).
Body shape kinds:
  ell  ellipsoid: centre c, radii r, rotation rot (degrees, xyz)
  cap  tapered capsule from a to b with radii ra -> rb; cross-section depth = radius * aspect
Scaling per variant: radii *= mass**m; shapes/joints flagged sx have x (and capsule ends) scaled by the shoulder factor.
Run: python3 make_body_shapes.py   (writes body_shapes.json next to this file)
"""
import json, math, os

S = []
def side_copy(d, side, suf):
    d = json.loads(json.dumps(d))
    d['part'] = d['part'].replace('*', suf); d['name'] += suf
    for k in ('c', 'a', 'b'):
        if k in d: d[k][0] *= side
    if 'rot' in d: d['rot'][1] *= side; d['rot'][2] *= side
    return d
def add(d, mirror):
    if mirror:
        S.append(side_copy(d, -1, '_R')); S.append(side_copy(d, 1, '_L'))
    else: S.append(d)
def ell(part, name, c, r, rot=(0, 0, 0), m=0, sx=False, mirror=False):
    add(dict(kind='ell', part=part, name=name, c=list(c), r=list(r), rot=list(rot), m=m, sx=sx), mirror)
def cap(part, name, a, b, ra, rb, aspect=1.0, m=0, sx=False, mirror=False):
    add(dict(kind='cap', part=part, name=name, a=list(a), b=list(b), ra=ra, rb=rb, aspect=aspect, m=m, sx=sx), mirror)

# --- skeleton-following base volumes -------------------------------------------------------------
cap('core', 'pelvis_waist', (0, .545, -.004), (0, .645, .006), .079, .071, .66, m=.3)
cap('core', 'torso', (0, .645, .006), (0, .755, -.002), .072, .097, .62, m=.4, sx=True)
cap('core', 'chest', (0, .742, -.002), (0, .79, -.008), .1, .1, .56, m=.4, sx=True)
cap('core', 'clavicles', (-.1, .806, -.01), (.1, .806, -.01), .036, .036, 1.1, m=.5, sx=True)
cap('core', 'neck', (0, .808, -.008), (0, .825, -.006), .029, .027, 1.05, m=.4)   # base of the neck; the head block's neck runs on into the skull
cap('core', 'thigh', (.05, .5, .004), (.045, .3, .007), .056, .035, 1.0, m=1, mirror=True)
cap('core', 'shin', (.046, .29, .004), (.044, .062, -.002), .033, .019, .95, m=.5, mirror=True)
cap('core', 'foot', (.044, .028, -.014), (.045, .018, .102), .022, .019, .72, mirror=True)
cap('arm*', 'upper_arm', (.117, .8, -.002), (.121, .636, -.006), .036, .025, .95, m=1, sx=True, mirror=True)
cap('arm*', 'forearm', (.121, .632, -.006), (.127, .478, .002), .028, .016, .82, m=.7, sx=True, mirror=True)
cap('arm*', 'hand', (.127, .487, .003), (.13, .392, .008), .0135, .011, 1.9, sx=True, mirror=True)
# (the head is no longer part of 'core': it is the head block below, in absolute head-local metres)
# --- muscles layered on top -----------------------------------------------------------------------
ell('core', 'trap', (.042, .83, -.016), (.052, .022, .032), (0, 0, -20), m=1, sx=True, mirror=True)
ell('core', 'pec', (.045, .76, .03), (.05, .033, .027), (0, 0, 12), m=1, sx=True, mirror=True)
ell('core', 'lat', (.068, .72, -.018), (.04, .075, .036), (0, 0, -14), m=1, sx=True, mirror=True)
ell('core', 'abs', (0, .662, .018), (.056, .058, .036), m=.6)
ell('core', 'oblique', (.054, .62, .004), (.024, .045, .036), m=.6, mirror=True)
ell('core', 'glute', (.034, .518, -.03), (.038, .04, .034), m=1, mirror=True)
ell('core', 'quad', (.05, .41, .018), (.038, .075, .037), (0, 0, 3), m=1, mirror=True)
ell('core', 'vastus_medial', (.035, .335, .014), (.022, .03, .024), m=1, mirror=True)
ell('core', 'hamstring', (.047, .42, -.014), (.03, .066, .03), m=1, mirror=True)
ell('core', 'calf', (.046, .22, -.016), (.032, .056, .03), m=1, mirror=True)
ell('arm*', 'deltoid', (.117, .797, 0), (.034, .04, .036), m=1, sx=True, mirror=True)
ell('arm*', 'biceps', (.119, .726, .011), (.024, .048, .024), m=1, sx=True, mirror=True)
ell('arm*', 'triceps', (.12, .745, -.011), (.022, .052, .021), m=1, sx=True, mirror=True)
ell('arm*', 'forearm_muscle', (.122, .597, .002), (.023, .04, .021), m=1, sx=True, mirror=True)
ell('arm*', 'thumb', (.124, .458, .022), (.007, .019, .008), (-20, 0, 0), sx=True, mirror=True)

joints = {  # bone heads; _L at x>0 (player's left), mirrored to _R
    'pelvis': [0, .53, 0], 'spine': [0, .62, 0], 'chest': [0, .72, 0], 'neck': [0, .81, -.008], 'head': [0, .875, 0],
    'hip_L': [.049, .5, .002], 'knee_L': [.046, .292, .005], 'ankle_L': [.044, .052, -.002], 'toe_L': [.045, .016, .085],
    'shoulder_L': [.117, .8, -.002], 'elbow_L': [.121, .634, -.006], 'wrist_L': [.127, .486, 0], 'hand_end_L': [.13, .385, .008]}
for k in list(joints):
    if k.endswith('_L'): joints[k[:-2] + '_R'] = [-joints[k][0], joints[k][1], joints[k][2]]

# --- head block -----------------------------------------------------------------------------------
# The head is NOT a fraction of height (heads barely grow with stature): it is built in absolute millimetres in a
# head-local frame (origin midway between the ear canals, +y up, +z forward, x>0 the player's left), then stored in
# metres. It sits on the body with its origin at (0, H - crown, HEAD_Z) so the crown is at standing height.
# Each shape is evaluated in order into one distance d (see HEAD_ABOUT); per-variant variety comes from HEAD_PARAMS.
HEAD_ABOUT = ("Head block: shapes in head-local metres (origin midway between the ear canals, +y up, +z forward), placed at "
              "origin = (0, height_m - origin_from_top, origin_z). Evaluated in list order at body point P: X = P - origin; "
              "if mirror, X.x = |X.x|; q = (X - c) * basis (row vector times row-major 3x3); if taper (tz, ty): "
              "q.x /= 1 + tz*clamp(q.z/r.z,-1,1) + ty*clamp(q.y/r.y,-1,1). kind ell: IQ ellipsoid k0*(k0-1)/k1, k0=|q/r|, k1=|q/r^2|; "
              "cone: q.z /= aspect, round cone along local +y from 0 to len, radii ra->rb; box: IQ round box, half-size r, rounding round; "
              "plane: q.z (half-space, outward normal = local +z); gauss: amp*exp(-|q/r|^2). op union: d = first ? s : smin(d, s, k); "
              "subtract: d = smax(d, -s, k); intersect: d = smax(d, s, k); add (gauss): d -= s. smin(a,b,k) = min(a,b) - h*h*k/4, "
              "h = max(k-|a-b|,0)/k; smax(a,b,k) = -smin(-a,-b,k). The body core joins the head with smin(core, head, neck_k).")
KINDS = ('ell', 'cone', 'box', 'plane', 'gauss')
OPS = ('union', 'subtract', 'intersect', 'add')
HEAD_Z = -.010   # head-local origin (ear canals) sits 1 cm behind the body's centre line

# Research table values (mm); see docs/superpowers/notes/2026-11-01-player-head-research.md
HEAD_BASE = dict(crown=134, length=205, breadth=155, bizyg=144, bigonial=105, menton=-100, chin_half=16, brow=1.0,
                 nose_w=38, ear_len=66, neck_top=46, neck_base=80, gonion_z=8)
HEAD_PARAMS = {  # archetypes (research step 8), mild so all stay inside +-2 SD
    'guard': dict(HEAD_BASE, breadth=153, length=206, bizyg=140, bigonial=101, menton=-103, chin_half=14, brow=.9,
                  nose_w=36, ear_len=64, neck_top=44, neck_base=76),                    # long and lean
    'forward': dict(HEAD_BASE),                                                           # the table head
    'center': dict(HEAD_BASE, breadth=161, length=203, bizyg=150, bigonial=114, menton=-101, chin_half=19, brow=1.25,
                   nose_w=42, ear_len=67, neck_top=50, neck_base=85, gonion_z=10)}        # broad and square

def _rot(deg):  # Houdini buildRotate, xyz order, row-vector convention (v_world = v_local * R); same as preview_body.rot_matrix
    rx, ry, rz = [math.radians(a) for a in deg]
    X = [[1, 0, 0], [0, math.cos(rx), math.sin(rx)], [0, -math.sin(rx), math.cos(rx)]]
    Y = [[math.cos(ry), 0, -math.sin(ry)], [0, 1, 0], [math.sin(ry), 0, math.cos(ry)]]
    Z = [[math.cos(rz), math.sin(rz), 0], [-math.sin(rz), math.cos(rz), 0], [0, 0, 1]]
    mul = lambda A, B: [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mul(mul(X, Y), Z)
def _norm(v):
    l = math.sqrt(sum(x * x for x in v)); return [x / l for x in v]
def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def _basis_cols(xa, ya, za):  # row-major 3x3 whose columns are the local axes, so (P - c) * basis = local coords
    return [xa[0], ya[0], za[0], xa[1], ya[1], za[1], xa[2], ya[2], za[2]]
def _basis_rot(rot):  # local axes = rows of R; basis = R^T
    R = _rot(rot); return _basis_cols(R[0], R[1], R[2])
def _basis_axes(xd, yd):  # local y along yd, local x along xd (orthogonalised), z = x cross y
    ya = _norm(yd); xa = _norm([xd[i] - ya[i] * sum(xd[j] * ya[j] for j in range(3)) for i in range(3)])
    return _basis_cols(xa, ya, _cross(xa, ya))
def _r6(v): return round(v, 6)

def build_head(p):
    """Shapes for one head from its parameters (mm in, metres out)."""
    out = []
    m = lambda v: [_r6(x / 1000) for x in v]
    def put(name, kind, op, k, c, basis, mirror=False, **kw):
        d = dict(name=name, kind=kind, op=op, k=_r6(k / 1000), mirror=mirror, c=m(c), basis=[_r6(x) for x in basis])
        for key, val in kw.items():
            d[key] = m(val) if key == 'r' else ([_r6(x) for x in val] if key == 'taper' else (_r6(val / 1000) if key in ('ra', 'rb', 'len', 'round', 'amp') else _r6(val)))
        d.setdefault('r', [0, 0, 0]); d.setdefault('taper', [0, 0])
        out.append(d)
    def ell(name, c, r, rot=(0, 0, 0), op='union', k=10, mirror=False, taper=(0, 0), axes=None):
        put(name, 'ell', op, k, c, _basis_axes(*axes) if axes else _basis_rot(rot), mirror, r=r, taper=taper)
    def box(name, c, r, rnd, rot=(0, 0, 0), op='union', k=10, mirror=False, taper=(0, 0)):
        put(name, 'box', op, k, c, _basis_rot(rot), mirror, r=r, round=rnd, taper=taper)
    def gauss(name, c, r, amp, rot=(0, 0, 0), mirror=False):
        put(name, 'gauss', 'add', 1, c, _basis_rot(rot), mirror, r=r, amp=amp)
    def plane(name, c, n, op='intersect', k=20, mirror=False):
        za = _norm(n); xa = _norm(_cross([0, 1, 0], za) if abs(za[1]) < .9 else _cross(za, [1, 0, 0])); ya = _cross(za, xa)
        put(name, 'plane', op, k, c, _basis_cols(xa, ya, za), mirror)
    def cone(name, a, b, ra, rb, aspect=1.0, up=(0, 0, 1), op='union', k=10, mirror=False):
        d = [b[i] - a[i] for i in range(3)]; L = math.sqrt(sum(x * x for x in d)); ya = [x / L for x in d]
        za = [up[i] - ya[i] * sum(up[j] * ya[j] for j in range(3)) for i in range(3)]; za = _norm(za); xa = _cross(ya, za)
        put(name, 'cone', op, k, a, _basis_cols(xa, ya, za), mirror, ra=ra, rb=rb, len=L, aspect=aspect)

    W = p['breadth'] / 2; G = 110 + (p['length'] - 205) * .4          # half-breadth; glabella z (brow front)
    front = G - 5; back = G - p['length']; cz = (front + back) / 2; rz = (front - back) / 2
    cy = 34
    # cranium: parietal ellipsoid, broader toward the crown and narrower toward the skull base (taper ty) so the dome is
    # broad in front view, and a little narrower toward the forehead (taper tz) so the widest point stays parietal
    ell('cranium', (0, cy, cz), (W / 1.0, p['crown'] - cy, rz), k=30, taper=(0, .12))
    # side planes (Loomis): flatten the sides, more toward the skull base, so the temporal/jaw region reads as a plane
    plane('side_plane', (W + 4, 34, 0), (1, -.22, .1), k=16, mirror=True)
    # neck: round cone leaning forward, entering the skull behind the jaw
    cone('neck', (0, -230, -32), (0, -40, -20), p['neck_base'], p['neck_top'], aspect=.86, k=36)
    # face masses: maxilla/muzzle and the lower face, joined to the cranium at 28 mm
    ell('muzzle', (0, -40, 62), (50, 30, 38), k=28)
    Zg = p['gonion_z']; Jw = p['bigonial'] / 2; Mn = p['menton']
    # lower face: one rounded box, its bottom along the jawline (pitched 24 deg), tapering to the jaw corners and the chin
    box('face_block', (0, -27, 48), (Jw - 8, 52, 46), 18, rot=(24, 0, 0), k=28, taper=(-.2, .2))
    # mandible: ramus up to the ear, body bar from the jaw corner to the chin (tall, thin cross-section)
    cone('ramus', (Jw - 14, -56, Zg - 4), (Jw - 6, -12, Zg - 14), 8, 8, aspect=1.3, up=(1, 0, 0), k=10, mirror=True)
    cone('jaw_bar', (Jw - 12, -58, Zg - 2), (p['chin_half'] + 6, Mn + 14, 80), 9, 9, aspect=1.5, up=(0, 1, 0), k=12, mirror=True)
    ell('jaw_angle', (Jw - 11, -58, Zg + 2), (5.5, 10, 12), k=16, mirror=True)   # soft: the corner shows in silhouette, not as a bump
    ell('chin_mass', (0, -80, 74), (30, 20, 24), k=16)   # mentalis: fills from the lower lip to the chin
    box('chin_pad', (0, Mn + 12, 91), (p['chin_half'], 11, 8), 7, rot=(-8, 0, 0), k=12)
    # cheekbones: the malar mass under the eye (fills up to the lower lid), swept back toward the ear
    zx = p['bizyg'] / 2
    ell('malar', (zx - 34, 4, 66), (28, 20, 22), rot=(0, -20, 0), k=18, mirror=True)
    # cheek pad: the muscle and fat layer over the buccal hollow and the masseter, so the lower cheek is flat to slightly
    # convex from the side and 3/4 (a young face) instead of sinking under the cheekbone (a gaunt, older face)
    ell('cheek_pad', (34, -18, 56), (26, 34, 28), k=20, mirror=True)
    # brow ridge: just proud of the cranium, outer ends swept back
    b = p['brow']
    ell('brow', (0, 38, G - 32), (56, 8 + 1.5 * b, 29 + 3 * b), k=12)   # one bar whose front follows the forehead curve
    gauss('glabella', (0, 36, G - 3), (13, 9, 8), 2.0 * b)
    # eye sockets carved under the brow (smooth subtraction), closed-lid surface inside
    ell('eye_socket', (33, 25, G - 5), (18, 10, 12), op='subtract', k=15, mirror=True)
    ell('eye_lid', (32, 26, G - 24), (14, 8, 9.5), k=7, mirror=True)   # eyeball under a closed lid: the painted eye sits on it
    # nose wedge: bridge pitched ~30 deg from sellion to tip, tip ball, alae
    cone('nose', (0, 24, G - 9), (0, -14, G + 8), 5, 7.5, aspect=1.0, k=8)
    ell('nose_tip', (0, -16, G + 6), (8.5, 7.5, 8.5), k=10)
    ell('nose_ala', (p['nose_w'] / 2 - 9, -21, G + 1), (7.5, 7, 9), k=13, mirror=True)   # soft wings, no smile-line crease
    ell('nose_base', (0, -23, G - 4), (13, 4, 9), k=8)   # fills the undercut under the tip and wings (no moustache shadow)
    # lips and the mouth line
    ell('upper_lip', (0, -41, 97), (21, 7, 8), k=8)    # a touch forward of the lower lip
    ell('lower_lip', (0, -57, 94), (19, 7, 8), k=8)
    ell('mouth_line', (0, -49, 106), (23, 1.2, 5), op='subtract', k=3)   # shallow lip line, under 2 mm
    # ears: flattened ellipsoids behind the midline, tilted back 15 deg and flared out, wider at the top
    ell('ear', (W + 4, 0, -14), (17, p['ear_len'] / 2, 5.5), axes=((.42, 0, -.91), (.1, .97, -.26)), taper=(0, .25), k=5, mirror=True)
    gauss('adams_apple', (0, -112, 34), (9, 12, 9), 3.0)
    return out

def head_block(name):
    p = HEAD_PARAMS[name]
    return dict(params=p, origin_from_top=_r6(p['crown'] / 1000), origin_z=HEAD_Z, neck_k=.04, shapes=build_head(p))

def build_spec():
    variants = {'guard': {'height_m': 1.91, 'shoulder': .96, 'mass': .88},
                'forward': {'height_m': 2.01, 'shoulder': 1.02, 'mass': 1.0},
                'center': {'height_m': 2.11, 'shoulder': 1.06, 'mass': 1.14}}
    for name, v in variants.items(): v['head'] = head_block(name)
    return {
        'about': __doc__.strip().splitlines()[0], 'head_about': HEAD_ABOUT, 'head_kinds': list(KINDS), 'head_ops': list(OPS),
        'variants': variants,
        'shoulder_joints': [k for k in joints if k.split('_')[0] in ('shoulder', 'elbow', 'wrist', 'hand')],
        'joints': joints, 'shapes': S}

if __name__ == '__main__':
    spec = build_spec()
    json.dump(spec, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'body_shapes.json'), 'w'), indent=1)
    print(len(S), 'body shapes;', ', '.join('%s head %d shapes' % (n, len(v['head']['shapes'])) for n, v in spec['variants'].items()))
