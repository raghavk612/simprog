"""The anatomical hand: palm, four separate three-segment fingers and an opposed thumb, as SDF capsules.

Hand-local frame (metres): origin at the wrist joint centre, +y toward the fingertips along the hand's straight axis, +z to
the back of the hand (dorsal), +x toward the thumb. The same local hand serves both sides; the right hand's frame is a
mirror (det R = -1), so one SDF and one mesh fit both.

Proportions (docs/superpowers/notes/2026-11-12-player-detail-references.md §2, §4): hand length (wrist crease to the middle
fingertip, straight) HL = .112 H; palm breadth .45 HL at the knuckles; middle finger bones .22 / .15 / .10 HL; index and
ring .93 / .95 and little .78 of the middle; a relaxed hanging curl rising from the index to the little finger (MCP / PIP /
DIP, degrees); fingers slightly fanned so there are real gaps (2-5 mm at the roots, wider toward the tips); the thumb
opposed along the front of the palm, its pad facing the index, tip level with the index's proximal phalanx.

The curl. FINGERS holds the reference hanging curl (index 20/25/10 degrees to little 35/40/15). The hand is rigid on the
wrist, and src/motion.js puts the wrist .13 + .07 model units from the ball's centre whatever the pose; in the center's
dribble the ball then sits under the middle of the fingers (hand-local about (0, .61 HL, -.7 HL)), so the full curl sinks
the ring and middle fingers about 25 mm into the ball. CURL scales the joints down to MCP x.45, PIP x.8, DIP x1 (index
9/20/10 to little 16/32/15): the knuckle bend that pushes the fingers into the ball goes, the curl at the finger ends
stays, and every pose clears the ball (tests/test_cloudmesh.py, tests/players.test.js). The full curl needs the dribble
wrist pose in motion.js to change, not only its .07 offset (at .10 the center's dribble still sinks 7 mm).
"""
import math
import numpy as np

from .prims import capsule, ellipsoid, smin, smax, smooth, rot

HAND_LENGTH = .112            # of height
# per finger: MCP x, MCP y (fractions of HL), length factor, radius factor, splay (deg, + toward the thumb), curl MCP/PIP/DIP
FINGERS = {
    'index':  (.165, .515, .93, 1.0, 5.0, (20, 25, 10)),
    'middle': (.055, .535, 1.0, 1.02, 0.5, (25, 30, 12)),
    'ring':   (-.055, .52, .95, .97, -4.0, (30, 35, 15)),
    'little': (-.158, .48, .80, .86, -10.0, (35, 40, 15)),
}
SEGMENTS = (.22, .15, .10)    # middle finger bones, of HL
RADII = (.046, .042, .038, .033)   # finger radius at MCP, PIP, DIP, tip (of HL), before the finger's factor
CURL = (.45, .8, 1.0)         # scales on the MCP, PIP and DIP angles above (see the note in the module doc)


def finger_chain(name, HL, curl=None):
    """Joint centres (MCP, PIP, DIP, tip centre) and radii of one finger, hand-local metres."""
    curl = CURL if curl is None else curl
    x, y, lf, rf, splay, ang = FINGERS[name]
    p = np.array([x * HL, y * HL, 0.0])
    Rs = rot((0, 0, 1), -math.radians(splay))      # splay in the palm plane: + toward the thumb (+x)
    d = Rs @ np.array([0.0, 1.0, 0.0]); axis = Rs @ np.array([1.0, 0.0, 0.0])
    pts = [p]; total = 0.0
    lengths = [SEGMENTS[0] * lf, SEGMENTS[1] * lf, SEGMENTS[2] * lf - RADII[3] * rf]
    for L, a, c in zip(lengths, ang, curl):
        total += math.radians(a) * c
        dd = rot(axis, -total) @ d                # flexion turns the finger toward the palm (-z)
        pts.append(pts[-1] + dd * L * HL)
    radii = [r * rf * HL for r in RADII]
    return np.array(pts), np.array(radii)


def thumb_chain(HL, curl=None):
    """CMC, MCP, IP and tip centre of the opposed thumb, and radii (hand-local metres)."""
    curl = CURL if curl is None else curl
    cmc = np.array([.15, .10, -.025]) * HL
    dm = np.array([.3, .9, -.2]); dm /= np.linalg.norm(dm)
    # the thumb's own flexion axis lies across the thumbnail; MCP and IP flex the thumb toward the palm and the index
    ax = np.cross(dm, np.array([-.8, .15, -.55])); ax /= np.linalg.norm(ax)
    p1 = rot(ax, math.radians(22 * curl[1])) @ dm
    p2 = rot(ax, math.radians(42 * curl[1])) @ dm
    mcp = cmc + dm * .2 * HL
    ip = mcp + p1 * .145 * HL
    tip = ip + p2 * (.115 - .036) * HL
    return np.array([cmc, mcp, ip, tip]), np.array([.058, .049, .043, .036]) * HL


def hand_local_sdf(Q, H, curl=None):
    """Signed distance (metres) of the anatomical hand at hand-local points Q (..., 3), without the wrist blend."""
    HL = HAND_LENGTH * H
    Q = np.asarray(Q, float)
    k = HL * .018                                 # finger roots: a small blend (about 4 mm), so the webbing stays shallow
    # palm: four metacarpals side by side, smooth-unioned into one arched plate, plus the wrist (carpus) block
    palm = None
    for name, (x, y, *_r) in FINGERS.items():
        base = np.array([x * .5 * HL, .11 * HL, -.004 * HL])
        head = np.array([x * HL, (y - .015) * HL, 0.0])
        s = capsule(Q, base, head, .068 * HL, .056 * HL)
        palm = s if palm is None else smin(palm, s, .05 * HL)
    carpus = ellipsoid(Q, (0, .06 * HL, -.012 * HL), (.15 * HL, .12 * HL, .1 * HL))
    palm = smin(palm, carpus, .05 * HL)
    # the wrist and the end of the forearm: an oval tube, wider across (thumb to little finger) than deep, that the arm's own
    # mesh is reshaped onto just before the joint (cloudmesh.arm_sdf)
    S = np.array([1.0, 1.0, 1.42])
    palm = smin(palm, capsule(Q * S, (0, -.5 * HL, -.012 * HL * 1.42), (0, .05 * HL, -.012 * HL * 1.42), .158 * HL, .142 * HL) / 1.2, .04 * HL)
    # flatten the back of the hand a little and keep the palm a plate, not a tube (thickness about .13 HL at the centre)
    palm = smax(palm, Q[..., 2] - .052 * HL, .03 * HL)
    # thenar and hypothenar eminences on the palm side, the heel of the hand
    thenar = ellipsoid(Q, (.105 * HL, .2 * HL, -.04 * HL), (.085 * HL, .14 * HL, .052 * HL))
    hypo = ellipsoid(Q, (-.115 * HL, .24 * HL, -.03 * HL), (.065 * HL, .16 * HL, .048 * HL))
    palm = smin(palm, smin(thenar, hypo, .03 * HL), .04 * HL)
    # knuckles: the metacarpal heads stand 1-2 mm proud on the back of the hand
    for name, (x, y, *_r) in FINGERS.items():
        palm = smin(palm, ellipsoid(Q, (x * HL, (y - .02) * HL, .022 * HL), (.042 * HL, .04 * HL, .036 * HL)), .012 * HL)
    d = palm
    for name in FINGERS:
        pts, r = finger_chain(name, HL, curl)
        f = capsule(Q, pts[0], pts[1], r[0], r[1])
        f = smin(f, capsule(Q, pts[1], pts[2], r[1] * .97, r[2]), .006 * HL)
        f = smin(f, capsule(Q, pts[2], pts[3], r[2] * .97, r[3]), .005 * HL)
        # PIP and DIP knuckles: slight bulges (under 1 mm), the creases go in the normal map
        f = smin(f, capsule(Q, pts[1], pts[1], r[1] * 1.05), .004 * HL)
        f = smin(f, capsule(Q, pts[2], pts[2], r[2] * 1.04), .004 * HL)
        d = smin(d, f, k)
    pts, r = thumb_chain(HL, curl)
    t = capsule(Q, pts[0], pts[1], r[0], r[1])
    t = smin(t, capsule(Q, pts[1], pts[2], r[1], r[2]), .008 * HL)
    t = smin(t, capsule(Q, pts[2], pts[3], r[2] * .98, r[3]), .006 * HL)
    d = smin(d, t, .06 * HL)                       # the thumb's root is the thenar: a wide blend
    return d


def tips(H, curl=None):
    """Fingertip and thumb-tip skin points (hand-local): the tip centre pushed out by its radius along the last bone."""
    HL = HAND_LENGTH * H; out = {}
    for name in FINGERS:
        p, r = finger_chain(name, HL, curl)
        d = p[3] - p[2]; out[name] = p[3] + d / np.linalg.norm(d) * r[3]
    p, r = thumb_chain(HL, curl)
    d = p[3] - p[2]; out['thumb'] = p[3] + d / np.linalg.norm(d) * r[3]
    return out
