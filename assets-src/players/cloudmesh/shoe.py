"""The basketball sneaker: a midsole band (sole material) under a mid-top upper (shoe material), as SDFs.

Shoe-local frame (metres): origin on the ground under the back of the heel, +z toward the toe, +y up, +x lateral (outward
from the body's midline, both feet; the right shoe's frame is a mirror). Sizes follow the references (notes §3): outsole about
1.1 x the bare foot (.172 H against the foot's .153 H), heel stack about 30 mm, forefoot about 20 mm (an 8-10 mm drop, so the
heel is lifted), toe spring about 10 mm, the midsole flared a few mm wider than the upper, a padded mid-top collar at or just
over the ankle bone (lower at the ankle, higher at the heel tab and the tongue) round a recessed ankle opening.
Absolute heights (mm) are for a 1.95 m player and scale with height; plan sizes are fractions of the shoe length SL.
"""
import numpy as np

from .prims import ellipsoid, smin, smax, smooth

FOOT_X = .0445        # shoe centre line, of H (the foot's own centre is .044-.045 H)
HEEL_Z = -.046        # back of the heel, of H (the bare heel ends at about -.036 H)
LENGTH = .172         # outsole length, of H
REF_H = 1.95

# side profile, millimetres at REF_H (z in fractions of SL)
HEEL_STACK, FORE_STACK, TOE_SPRING = 30.0, 20.0, 10.0
FLAT = (.08, .66)     # the outsole is flat on the floor between these (heel bevel behind, toe spring in front)
COLLAR = {'back': 114.0, 'ankle': 97.0, 'tongue': 112.0}   # topline heights: heel tab, sides over the ankle bone, tongue
INSET = 4.5           # the upper sits this far inside the midsole's edge (the midsole flares out)


def _mm(H):
    return H / REF_H / 1000.0


def footprint(x, z, SL):
    """2D signed distance of the outsole outline in the (x, z) plane, metres (lateral +x)."""
    def circle(cx, cz, r): return np.hypot(x - cx * SL, z - cz * SL) - r * SL
    # heel circle to the ball of the foot: a tapered 2D capsule (straight sides), then the rounded toe; the ball and toe sit
    # a little toward the big toe (medial, -x)
    a, b = np.array([0.0, .135]) * SL, np.array([-.012, .66]) * SL; ra, rb = .132 * SL, .182 * SL
    pa = np.stack([x - a[0], z - a[1]], -1); ba = b - a; L = np.linalg.norm(ba); u = ba / L
    t = pa @ u; nrm = np.array([-u[1], u[0]]); s = np.abs(pa @ nrm)
    # exact 2D round cone
    rr = (ra - rb) / L; c = np.sqrt(max(1 - rr * rr, 1e-9))
    k = -rr * s + c * t
    cone = np.where(k < 0, np.hypot(s, t) - ra, np.where(k > c * L, np.hypot(s, t - L) - rb, c * s + rr * t - ra))
    toe = circle(-.025, .865, .135)
    return smin(cone, toe, .06 * SL)


def bottom(z, SL, mm):
    """Outsole underside height: a heel bevel behind FLAT[0], flat, then the toe spring rising to TOE_SPRING at the tip."""
    f = z / SL
    heel = 6.0 * np.clip(1 - f / FLAT[0], 0, 1) ** 2
    spring = TOE_SPRING * np.clip((f - FLAT[1]) / (1 - FLAT[1]), 0, 1) ** 2
    return (heel + spring) * mm


def stack_top(z, SL, mm):
    """Top of the midsole band (where the upper sits): heel stack at the back, forefoot stack ahead, riding the toe spring."""
    f = z / SL
    thick = FORE_STACK + (HEEL_STACK - FORE_STACK) * (1 - smooth(.22, .62, f)) - 4.0 * smooth(.8, 1.0, f)
    return bottom(z, SL, mm) + thick * mm


def topline(z, SL, mm):
    """Collar height round the ankle opening: the heel tab at the back, dipping at the ankle bones, the tongue in front."""
    f = z / SL
    dip = COLLAR['back'] + (COLLAR['ankle'] - COLLAR['back']) * smooth(.06, .25, f)
    return (dip + (COLLAR['tongue'] - COLLAR['ankle']) * smooth(.27, .42, f)) * mm


OPENING = ((0.0, .27), (.118, .142))   # ankle opening centre (x, z) and half sizes (x, z), of SL


def opening(x, z, SL):
    (cx, cz), (rx, rz) = OPENING
    q = np.stack([(x - cx * SL) / (rx * SL), (z - cz * SL) / (rz * SL)], -1)
    k0 = np.linalg.norm(q, axis=-1)
    return (k0 - 1) * min(rx, rz) * SL


def sole_sdf(Q, H):
    SL = LENGTH * H; mm = _mm(H)
    x, y, z = Q[..., 0], Q[..., 1], Q[..., 2]
    d = footprint(x, z, SL)
    d = smax(d, bottom(z, SL, mm) - y, 5 * mm)           # rounded lower edge
    d = smax(d, y - stack_top(z, SL, mm), 2.5 * mm)      # crisp upper edge: the band line
    # a rubber toe bumper: the sole wraps up round the front of the toe box
    bump = smax(footprint(x, z, SL), y - (bottom(z, SL, mm) + 30 * mm), 6 * mm)
    bump = smax(bump, .9 * SL - z, 10 * mm)
    return smin(d, smax(bump, bottom(z, SL, mm) - y, 3 * mm), 3 * mm)


def upper_sdf(Q, H):
    SL = LENGTH * H; mm = _mm(H)
    x, y, z = Q[..., 0], Q[..., 1], Q[..., 2]
    vol = ellipsoid(Q, (-.014 * SL, 16 * mm, .82 * SL), (.172 * SL, 50 * mm, .2 * SL))        # toe box: a rounded dome
    vol = smin(vol, ellipsoid(Q, (-.004 * SL, 34 * mm, .48 * SL), (.17 * SL, 78 * mm, .28 * SL)), 30 * mm)    # vamp, instep
    vol = smin(vol, ellipsoid(Q, (0.0, 50 * mm, .2 * SL), (.156 * SL, 74 * mm, .21 * SL)), 30 * mm)           # quarter, heel
    d = smax(vol, footprint(x, z, SL) + INSET * mm, 6 * mm)         # side walls follow the outsole outline
    d = smax(d, stack_top(z, SL, mm) - 6 * mm - y, 2 * mm)          # sits 6 mm down into the midsole
    top = topline(z, SL, mm)
    d = smax(d, y - top, 6 * mm)                                     # cut at the topline
    # padded collar roll along the topline, round the opening
    ring = np.hypot(opening(x, z, SL) - 9 * mm, y - (top - 7 * mm)) - 11 * mm
    d = smin(d, smax(ring, -opening(x, z, SL) + 1 * mm, 2 * mm), 6 * mm)
    # the ankle opening: a recess round the leg, 28 mm deep
    hole = smax(opening(x, z, SL), (top - 28 * mm) - y, 4 * mm)
    d = smax(d, -hole, 3 * mm)
    # the tongue stands a little above the topline in the front of the opening
    tongue = ellipsoid(Q, (0.0, float(topline(.42 * SL, SL, mm)) - 6 * mm, .42 * SL), (.075 * SL, 17 * mm, .04 * SL))
    return smin(d, tongue, 6 * mm)


def shoe_local_sdf(Q, H, component=None):
    Q = np.asarray(Q, float)
    if component == 'sole': return sole_sdf(Q, H)
    if component == 'upper': return upper_sdf(Q, H)
    return np.minimum(sole_sdf(Q, H), upper_sdf(Q, H))


def bounds(H):
    SL = LENGTH * H; mm = _mm(H)
    return np.array([-.25 * SL, -2 * mm, -.03 * SL]), np.array([.25 * SL, 140 * mm, 1.03 * SL])
