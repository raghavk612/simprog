"""Writes body_shapes.json: the Kangs player body as a table of shapes, shared by the Houdini builder
(assets-src/players/houdini/build_players.py) and the rig/glTF step (scripts/build_players.py).

All positions and radii are fractions of standing height. y is up, +z is forward, feet at y=0; x>0 is the player's left.
Shape kinds:
  ell  ellipsoid: centre c, radii r, rotation rot (degrees, xyz)
  cap  tapered capsule from a to b with radii ra -> rb; cross-section depth = radius * aspect
Scaling per variant: radii *= mass**m; shapes/joints flagged sx have x (and capsule ends) scaled by the shoulder factor.
Run: python3 make_body_shapes.py   (writes body_shapes.json next to this file)
"""
import json, os

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
cap('core', 'neck', (0, .808, -.008), (0, .878, .002), .029, .026, 1.05, m=.4)
cap('core', 'thigh', (.05, .5, .004), (.045, .3, .007), .056, .035, 1.0, m=1, mirror=True)
cap('core', 'shin', (.046, .29, .004), (.044, .062, -.002), .033, .019, .95, m=.5, mirror=True)
cap('core', 'foot', (.044, .028, -.014), (.045, .018, .102), .022, .019, .72, mirror=True)
cap('arm*', 'upper_arm', (.117, .8, -.002), (.121, .636, -.006), .036, .025, .95, m=1, sx=True, mirror=True)
cap('arm*', 'forearm', (.121, .632, -.006), (.127, .478, .002), .028, .016, .82, m=.7, sx=True, mirror=True)
cap('arm*', 'hand', (.127, .487, .003), (.13, .392, .008), .0135, .011, 1.9, sx=True, mirror=True)
# --- head -----------------------------------------------------------------------------------------
ell('core', 'cranium', (0, .94, -.006), (.04, .056, .05))
ell('core', 'jaw', (0, .905, .011), (.033, .035, .037))
ell('core', 'chin', (0, .885, .025), (.017, .013, .016))
ell('core', 'cheeks', (0, .918, .022), (.035, .02, .025))
ell('core', 'nose', (0, .915, .046), (.0075, .013, .01), (-10, 0, 0))
ell('core', 'brow', (0, .932, .033), (.032, .008, .012))
ell('core', 'ear', (.04, .922, -.004), (.007, .015, .011), mirror=True)
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

spec = {
    'about': __doc__.strip().splitlines()[0],
    'variants': {'guard': {'height_m': 1.91, 'shoulder': .96, 'mass': .88},
                 'forward': {'height_m': 2.01, 'shoulder': 1.02, 'mass': 1.0},
                 'center': {'height_m': 2.11, 'shoulder': 1.06, 'mass': 1.14}},
    'shoulder_joints': [k for k in joints if k.split('_')[0] in ('shoulder', 'elbow', 'wrist', 'hand')],
    'joints': joints, 'shapes': S}
json.dump(spec, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'body_shapes.json'), 'w'), indent=1)
print(len(S), 'shapes')
