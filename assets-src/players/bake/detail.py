"""Pluggable surface detail for the bake: small displacements added to the base SDF (sdf_hi.PlayerSDF.sdf_hi).

A detail function is   fn(part, p_local, n, S) -> displacement in metres (+ = outward), shape p_local.shape[:-1]
  part     the OBJ group being baked ('core', 'arm_L', 'jersey', ...)
  p_local  body fractions (x / (H * shoulder), y / H, z / H) for the body and kit, head-local metres for hair and headband
           (see PlayerSDF.local), so one function fits every variant
  n        the low-poly normal of the texel (held fixed during its search; use it only to fade or orient detail)
  S        the PlayerSDF (H, SH, HO, ... for converting back to metres)
Keep displacements smooth (they are differentiated numerically, eps 0.25 mm) and within a few mm: the bake searches
+-8 mm along the low-poly normal for the detailed surface.

DETAILS maps a part to its functions; `detail` is what the baker calls. The production bake adds entries here
(hands and fingers, shoe stitching and sole tread, hair strands, more muscle separations, kit seams).
"""
import numpy as np

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def seg_dist2d(px, py, a, b):
    """Distance from points (px, py) to the 2D segment a-b, and the position t (0..1) along it."""
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(px - (ax + t * dx), py - (ay + t * dy)), t

def groove(dist, depth, width):
    """A smooth Gaussian valley: -depth at the centre line, half depth at about 0.83 * width."""
    return -depth * np.exp(-(dist / width) ** 2)

# --- (a) muscle separation --------------------------------------------------------------------------------
# Deltopectoral groove: from the clavicle down and out to the front of the armpit, between the pec (core part,
# body_shapes 'pec', centre x .045 y .76) and the deltoid (arm part, centre x .117 y .797). Seen from the front, on both
# sides (|x|). Linea alba: down the centre of the abs (body_shapes 'abs', y .604-.720).
DELTOPEC = ((.079, .806), (.101, .748))
DELTOPEC_DEPTH, DELTOPEC_WIDTH = .003, .0075      # metres
LINEA = (.603, .712)
LINEA_DEPTH, LINEA_WIDTH = .0025, .0055

def muscle_grooves(part, p, n, S):
    H, SH = S.H, S.SH
    x, y, z = np.abs(p[..., 0]), p[..., 1], p[..., 2]
    out = np.zeros(p.shape[:-1])
    # deltopectoral: 2D distance in the frontal plane (metres), on the front of the body only
    d, t = seg_dist2d(x * H * SH, y * H, (DELTOPEC[0][0] * H * SH, DELTOPEC[0][1] * H), (DELTOPEC[1][0] * H * SH, DELTOPEC[1][1] * H))
    ends = smooth(0, .15, t) * smooth(1, .8, t)
    out += groove(d, DELTOPEC_DEPTH, DELTOPEC_WIDTH) * ends * smooth(-.004, .014, z)
    if part == 'core':
        fade = smooth(LINEA[0], LINEA[0] + .02, y) * smooth(LINEA[1], LINEA[1] - .02, y)
        out += groove(np.abs(p[..., 0]) * H * SH, LINEA_DEPTH, LINEA_WIDTH) * fade * smooth(.01, .03, z)
    return out

# --- (b) jersey folds -------------------------------------------------------------------------------------
# Soft, roughly horizontal folds where the jersey bunches: above the waistband (it is tucked into the shorts at .578 H)
# and in rings round the armholes (the cut ellipsoids of GARMENT_VEX 'jersey'), strongest under the arm.
WAIST = (.575, .665)            # y fractions: the folds fade out upward
WAIST_WAVE, WAIST_AMP = .017, .0018
ARM_C, ARM_R = (.118, .762, -.006), (.05, .072, .075)   # armhole ellipsoid (x scaled by shoulder), fractions of H
ARM_WAVE, ARM_AMP = .16, .0015  # wavelength in ellipsoid radius units; amplitude metres

def jersey_folds(part, p, n, S):
    H, SH = S.H, S.SH
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    th = np.arctan2(z, x)
    # waist: phase climbs with height, wobbling round the body so the folds are not perfect rings
    ph = 2 * np.pi * (y - WAIST[0]) / WAIST_WAVE + .9 * np.sin(2 * th + .7) + .5 * np.sin(5 * th + 2.0)
    a = WAIST_AMP * smooth(WAIST[0] - .01, WAIST[0] + .005, y) * smooth(WAIST[1], WAIST[0] + .03, y) * (.65 + .35 * np.sin(3 * th + 1.3))
    out = a * (np.sin(ph) + .3 * np.sin(2 * ph + 1.0)) / 1.3
    # armholes: rings of the ellipsoid radius outside the cut (rho = 1)
    for sd in (-1.0, 1.0):
        q = np.stack([(x - sd * ARM_C[0]) * SH, y - ARM_C[1], z - ARM_C[2]], -1) / ARM_R   # p_local x is / SH: undo it
        rho = np.linalg.norm(q, axis=-1)
        ang = np.arctan2(q[..., 1], q[..., 2])
        ph = 2 * np.pi * (rho - 1) / ARM_WAVE + .8 * np.sin(3 * ang + sd)
        under = .45 + .55 * smooth(.3, -.7, q[..., 1] / np.maximum(rho, 1e-6))
        a = ARM_AMP * smooth(1.0, 1.1, rho) * smooth(1.6, 1.15, rho) * under
        out = out + a * np.sin(ph)
    return out

DETAILS = {'core': [muscle_grooves], 'arm_L': [muscle_grooves], 'arm_R': [muscle_grooves], 'jersey': [jersey_folds]}

def detail(part, p_local, n, S):
    fns = DETAILS.get(part)
    if not fns:
        return np.zeros(p_local.shape[:-1])
    return sum(fn(part, p_local, n, S) for fn in fns)
