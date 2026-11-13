"""Cloud-meshed player parts: the anatomical hands, the basketball sneakers and the clumped afro, defined as SDFs in numpy
and meshed here (marching cubes + quadric decimation), with no Houdini.

Interface (fixed; the bake's detail functions are written against it):
    part_sdf(variant, name, P)  -> signed distance in metres at body points P (N x 3): feet at y = 0, +y up, +z forward,
                                   +x the player's left (the OBJ frame of assets-src/players)
    part_frame(variant, name)   -> (origin (3,), R (3 x 3)): R's columns are the part's local x, y, z axes in body space
    part_mesh(variant, name)    -> dict V (n x 3), F (m x 3, CCW seen from outside), N (n x 3, SDF gradient), group
                                   (the OBJ group build_players.py files it under), mat (per face: the glTF material),
                                   weight ('wrist_L' etc. for rigid parts, None = copy the skin's weights)
Names: hand_L, hand_R, shoe_L, shoe_R, hair_afro. Local frames:
    hand: origin at the wrist joint centre; +y toward the fingertips along the hand's straight axis; +z dorsal; +x toward
          the thumb (both hands, so the right hand's R is a mirror, det -1)
    shoe: origin on the ground under the back of the heel; +z toward the toe; +y up; +x lateral (outward, both feet)
    hair_afro: the head-local frame (origin midway between the ear canals, axes = body axes; body_shapes.json head_about)
Meshes: the hand is meshed closed, with a cap inside the forearm behind HAND_START, which is dropped (buried); the
sneaker is an upper (material 'shoes') and a midsole ('sole'), each meshed closed, minus the faces buried in the other;
the afro is closed, its cut through the skull is dropped by build_players as buried in the head.
Extras: part_sdf(..., component='sole'|'upper') for the sneaker's midsole or upper alone; local_sdf(variant, name, Q) in
the part's own frame; arm_sdf(variant, side, P), the forearm as the GLB has it near the wrist (the bake needs it for arm
texels past ARM_BLEND); shoe_covers(variant, P), the body points a sneaker hides; head_mesh(variant) for renders.
Build dependencies: numpy, scikit-image (marching cubes), fast-simplification (quadric decimation).
"""
import functools, json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PLAYERS = os.path.dirname(HERE)
if PLAYERS not in sys.path: sys.path.insert(0, PLAYERS)

from . import hand, shoe, afro, mesher  # noqa: E402
from .prims import to_local, to_world, smax, smooth, gradient  # noqa: E402

PARTS = ('hand_L', 'hand_R', 'shoe_L', 'shoe_R', 'hair_afro')
SPEC_PATH = os.path.join(PLAYERS, 'body_shapes.json')
# Mesh settings: voxel (metres) and the target triangle count per part (decimation).
VOXEL = {'hand': .0012, 'shoe': .002, 'hair_afro': .003}
TRIS = {'hand': 630, 'shoe_upper': 300, 'shoe_sole': 140, 'hair_afro': 1380}   # shoes: faces kept (after the overlap)
# The wrist. Hands are rigid on wrist_<side>; the forearm's mesh blends from elbow to wrist over +-.0075 H round the joint.
# So the hand may only reach back to where the forearm is (almost) all wrist, or a wrist flex would open a crack. The
# Houdini forearm swells into a paddle hand there, so build_players reshapes the forearm's vertices from ARM_BLEND on onto
# arm_sdf (the Houdini arm blending into the anatomical wrist by the joint), sinks them INSET under the hand's surface
# just before HAND_START and clips the arm at ARM_CUT. The hand's surface comes out from under the forearm's over the
# last SEAM metres before HAND_START (it dives DIVE under it behind that), so the two cross without a ledge, and the hand
# mesh is capped inside the forearm (build_players drops the cap as buried). All along the hand axis, fractions of H.
ARM_BLEND, HAND_START, ARM_CUT = -.03, .0075, .013
INSET, DIVE, SEAM = .002, .003, .004    # metres


@functools.lru_cache(maxsize=None)
def spec():
    return json.load(open(SPEC_PATH))


def _v(variant):
    return spec()['variants'][variant]


@functools.lru_cache(maxsize=None)
def _shapes(variant):
    import preview_body as pb
    return pb.shapes_for(spec(), _v(variant))


@functools.lru_cache(maxsize=None)
def joints(variant):
    v = _v(variant); H, SH = v['height_m'], v['shoulder']; s = spec()
    return {k: np.array([p[0] * (SH if k in s['shoulder_joints'] else 1) * H, p[1] * H, p[2] * H]) for k, p in s['joints'].items()}


def head_origin(variant):
    h = _v(variant)['head']
    return np.array([0.0, _v(variant)['height_m'] - h['origin_from_top'], h['origin_z']])


@functools.lru_cache(maxsize=None)
def part_frame(variant, name):
    v = _v(variant); H = v['height_m']; J = joints(variant)
    if name in ('hand_L', 'hand_R'):
        side = name[-1]
        o = J['wrist_' + side].copy()
        y = J['hand_end_' + side] - o; y /= np.linalg.norm(y)
        z = np.array([1.0 if side == 'L' else -1.0, 0, 0]); z -= y * (z @ y); z /= np.linalg.norm(z)   # dorsal: away from the body
        x = np.cross(y, z); x *= np.sign(x[2])                                                        # thumb: forward
        return o, np.stack([x, y, z], 1)
    if name in ('shoe_L', 'shoe_R'):
        sd = 1.0 if name[-1] == 'L' else -1.0
        o = np.array([sd * shoe.FOOT_X * H, 0.0, shoe.HEEL_Z * H])
        return o, np.diag([sd, 1.0, 1.0])
    if name == 'hair_afro':
        return head_origin(variant), np.eye(3)
    raise KeyError(name)


def _arm_sdf(variant, side, P, paddle=True):
    """The Houdini arm part (as meshed in the OBJ); paddle=False leaves out its paddle hand, so the forearm ends at the wrist."""
    import preview_body as pb
    d = None
    for sh in _shapes(variant):
        if sh['part'] != 'arm_' + side or (not paddle and sh['name'] == 'hand_' + side): continue
        s = pb.sdf(P, sh); d = s if d is None else pb.smin(d, s, .03)
    return d


def _hand_t(variant, side, P):
    o, R = part_frame(variant, 'hand_' + side)
    return to_local(P, o, R)


def anatomical(variant, side, P):
    """The anatomical hand with its wrist tube, body-space points."""
    return hand.hand_local_sdf(_hand_t(variant, side, P), _v(variant)['height_m'])


def arm_sdf(variant, side, P):
    """The forearm as the GLB has it: the Houdini arm, blending into the anatomical wrist from ARM_BLEND to the joint (the
    paddle hand is gone). The bake must use this, not the Houdini arm, for arm texels past ARM_BLEND along the hand axis."""
    H = _v(variant)['height_m']; P = np.asarray(P, float)
    t = _hand_t(variant, side, P)[..., 1]
    w = smooth(ARM_BLEND * H, 0, t)
    out = _arm_sdf(variant, side, P)
    m = w > 0
    if m.any(): out[m] = out[m] * (1 - w[m]) + anatomical(variant, side, P[m]) * w[m]
    return out


def arm_inset(variant, side, P):
    """How far (m) build_players sinks the forearm's vertices under the hand: 0 up to the seam, INSET from HAND_START."""
    s = HAND_START * _v(variant)['height_m']
    return INSET * smooth(s - SEAM, s, _hand_t(variant, side, P)[..., 1])


def hand_sdf(variant, side, P):
    """The hand in body space: the anatomical hand from HAND_START on; behind it the surface dives DIVE under the forearm
    and is capped there (that part is inside the forearm, build_players drops it)."""
    s = HAND_START * _v(variant)['height_m']
    Q = _hand_t(variant, side, P); t = Q[..., 1]
    d = hand.hand_local_sdf(Q, _v(variant)['height_m']) + DIVE * (1 - smooth(s - SEAM, s, t))
    return smax(d, (s - SEAM - .003) - t, .001)


def _shoe_world(variant, name, P, component=None):
    o, R = part_frame(variant, name)
    return shoe.shoe_local_sdf(to_local(P, o, R), _v(variant)['height_m'], component)


def shoe_covers(variant, P):
    """True where a body point is hidden by a sneaker: inside it, or within its outline below the collar (the bare foot
    of the body is a little taller than the toe box, and nobody sees it)."""
    H = _v(variant)['height_m']; SL = shoe.LENGTH * H; mm = shoe._mm(H)
    P = np.asarray(P, float); out = np.zeros(P.shape[:-1], bool)
    for name in ('shoe_L', 'shoe_R'):
        o, R = part_frame(variant, name); Q = to_local(P, o, R)
        x, y, z = Q[..., 0], Q[..., 1], Q[..., 2]
        out |= shoe.shoe_local_sdf(Q, H) < -BURIED
        out |= (shoe.footprint(x, z, SL) < .01) & (y < shoe.topline(z, SL, mm) - 22 * mm)
    return out


BURIED = .0015   # as build_players.BURIED and bake/mesh_uv.BURIED


def buried_mask(V, F, other):
    """Faces whose corners and centroid are all more than BURIED inside `other` (an SDF of points)."""
    d = other(np.vstack([V, V[F].mean(1)]))
    inside = d < -BURIED
    return inside[F].all(1) & inside[len(V):]


def part_sdf(variant, name, P, component=None):
    """Signed distance (metres) of one part at body-space points P (..., 3)."""
    P = np.asarray(P, float)
    if name in ('hand_L', 'hand_R'): return hand_sdf(variant, name[-1], P)
    if name in ('shoe_L', 'shoe_R'): return _shoe_world(variant, name, P, component)
    if name == 'hair_afro': return afro.afro_sdf(variant, P)
    raise KeyError(name)


def local_sdf(variant, name, Q, component=None):
    o, R = part_frame(variant, name)
    return part_sdf(variant, name, to_world(Q, o, R), component)


def _place(V, F, N, o, R):
    """Local mesh -> body space; a mirror frame flips the winding so faces still face outward."""
    W = to_world(V, o, R); NW = N @ R.T
    if np.linalg.det(R) < 0: F = F[:, ::-1]
    return W, F.copy(), NW


@functools.lru_cache(maxsize=None)
def _hand_local_mesh(variant, target=None):
    """Meshed once in the left hand's local frame, used for both hands (the right one through its mirror frame)."""
    o, R = part_frame(variant, 'hand_L'); H = _v(variant)['height_m']; HL = hand.HAND_LENGTH * H
    f = lambda Q: hand_sdf(variant, 'L', to_world(Q, o, R))
    lo = np.array([-.3 * HL, HAND_START * H - SEAM - .006, -.42 * HL])
    hi = np.array([.36 * HL, 1.06 * HL, .3 * HL])
    return mesher.mesh(f, lo, hi, VOXEL['hand'], target or TRIS['hand'])


@functools.lru_cache(maxsize=None)
def _hand_target(variant):
    """Decimation target such that about TRIS['hand'] faces remain once the cap inside the forearm is dropped."""
    o, R = part_frame(variant, 'hand_L')
    inside = lambda Q: arm_sdf(variant, 'L', to_world(Q, o, R))
    want = TRIS['hand']; target = want
    for _ in range(4):
        V, F, N = _hand_local_mesh(variant, target)
        kept = int((~buried_mask(V, F, inside)).sum())
        if abs(kept - want) <= .02 * want: break
        target = int(round(target * want / max(kept, 1)))
    return target


@functools.lru_cache(maxsize=None)
def _hand_part(variant):
    """The hand without its cap and dive inside the forearm (faces buried in arm_sdf)."""
    o, R = part_frame(variant, 'hand_L')
    V, F, N = _hand_local_mesh(variant, _hand_target(variant))
    keep = ~buried_mask(V, F, lambda Q: arm_sdf(variant, 'L', to_world(Q, o, R)))
    return V, F[keep], N


@functools.lru_cache(maxsize=None)
def _shoe_local_mesh(variant, component, target=None):
    H = _v(variant)['height_m']
    f = lambda Q: shoe.shoe_local_sdf(Q, H, component)
    lo, hi = shoe.bounds(H)
    return mesher.mesh(f, lo, hi, VOXEL['shoe'], target or TRIS['shoe_' + component])


@functools.lru_cache(maxsize=None)
def _shoe_target(variant, component):
    """Decimation target for one shoe component such that about TRIS faces remain once the faces buried in the other
    component are dropped (decimation spends a varying share on those)."""
    H = _v(variant)['height_m']; other = 'sole' if component == 'upper' else 'upper'
    f = lambda X: shoe.shoe_local_sdf(X, H, other)
    want = TRIS['shoe_' + component]; target = want
    for _ in range(4):
        V, F, N = _shoe_local_mesh(variant, component, target)
        kept = int((~buried_mask(V, F, f)).sum())
        if abs(kept - want) <= .03 * want: break
        target = int(round(target * want / max(kept, 1)))
    return target


@functools.lru_cache(maxsize=None)
def _shoe_parts(variant):
    """Upper and midsole, each closed, minus the faces buried in the other (the upper's bottom inside the midsole, the
    midsole's top under the upper): two open surfaces that meet along their intersection."""
    H = _v(variant)['height_m']; out = []
    for comp, mat, other in (('upper', 'shoes', 'sole'), ('sole', 'sole', 'upper')):
        V, F, N = _shoe_local_mesh(variant, comp, _shoe_target(variant, comp))
        keep = ~buried_mask(V, F, lambda X: shoe.shoe_local_sdf(X, H, other))
        out.append((V, F[keep], N, mat))
    return out


@functools.lru_cache(maxsize=None)
def _afro_mesh(variant):
    lo, hi = afro.bounds(variant)
    f = lambda P: afro.afro_sdf(variant, P)
    return mesher.mesh(f, lo, hi, VOXEL['hair_afro'], TRIS['hair_afro'])


def part_mesh(variant, name):
    """Mesh of one part in body space (see the module doc)."""
    o, R = part_frame(variant, name)
    if name in ('hand_L', 'hand_R'):
        V, F, N = _hand_part(variant)
        W, F2, N2 = _place(V, F, N, o, R)
        return {'V': W, 'F': F2, 'N': N2, 'group': name, 'mat': np.array(['skin'] * len(F2)), 'weight': 'wrist_' + name[-1]}
    if name in ('shoe_L', 'shoe_R'):
        parts = _shoe_parts(variant)
        V = np.vstack([p[0] for p in parts]); N = np.vstack([p[2] for p in parts])
        F = np.vstack([parts[0][1], parts[1][1] + len(parts[0][0])])
        mat = np.array([parts[0][3]] * len(parts[0][1]) + [parts[1][3]] * len(parts[1][1]))
        W, F2, N2 = _place(V, F, N, o, R)
        return {'V': W, 'F': F2, 'N': N2, 'group': 'shoes', 'mat': mat, 'weight': None,
                'component': np.array(['upper'] * len(parts[0][1]) + ['sole'] * len(parts[1][1]))}
    if name == 'hair_afro':
        V, F, N = _afro_mesh(variant)
        return {'V': V.copy(), 'F': F.copy(), 'N': N.copy(), 'group': 'hair_afro', 'mat': np.array(['hair'] * len(F)), 'weight': None}
    raise KeyError(name)


@functools.lru_cache(maxsize=None)
def head_mesh(variant, voxel=.004):
    """The scalp (head block without the ears) in head-local metres, for renders only."""
    O = head_origin(variant)
    f = lambda L: afro.head_sdf(variant, L + O)
    V, F = mesher.marching(f, (-.13, -.16, -.15), (.13, .17, .16), voxel)
    return V, F, gradient(f, V)
