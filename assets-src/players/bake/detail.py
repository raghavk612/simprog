"""Surface detail for the bake: small displacements added to the base SDF (sdf_hi.PlayerSDF.sdf_hi).

    detail(part, p_local, n, S) -> displacement in metres (+ = outward), shape p_local.shape[:-1]

  part     the part being baked: an OBJ group ('core', 'arm_L', 'jersey', 'shoes', 'hair_rows', ...) or a part that lives in
           its own frame ('hand_L', 'hand_R', 'shoe_L', 'shoe_R', 'hair_afro'; see sdf_hi.PlayerSDF.add_local_part)
  p_local  where the point is, from S.local(part, P):
             body and kit (core, arms, jersey, shorts, sleeves)  body fractions (x / (H * shoulder), y / H, z / H)
             hair_* and headband                                 head-local metres (P - head origin), body axes
             hand_L / hand_R                                     hand-local metres: origin the wrist joint centre, +y to the
                                                                 fingertips, +z the back of the hand, +x the thumb (the right
                                                                 hand's frame is the mirror image, so both read the same)
             shoe_L / shoe_R and the current two-foot 'shoes'    shoe-local metres: origin on the ground under the back of the
                                                                 heel, +z the toe, +y up, +x lateral (away from the midline)
  n        the low-poly normal of the texel, in the same axes as p_local (held fixed during a texel's search; used only to
           fade or orient detail, e.g. laces on the top of the shoe). May be None or zeros: then n-gated detail is off.
  S        the PlayerSDF (H, SH, HO, HW, and S.layouts: part -> HandLayout / ShoeLayout, set by D3 for D1's real parts)

Every function in the DETAILS registry carries .box (its support in p_local units: exactly zero outside it), .max_mm (its
largest displacement) and .kind. Amplitudes are physical millimetres: muscle grooves and folds 0.5-3 mm, seams about
1 mm, stitches 0.3-0.5 mm. Positions scale with the body (fractions of H) or come from the part's layout; widths and
depths do not. Everything random is drawn from fixed seeds at import, so the bake is deterministic, and the cloth and
hair are irregular by construction (no single spatial frequency; see tests/test_detail.py).

Keep displacements smooth (they are differentiated numerically, eps 0.25 mm) and within 3 mm: the bake searches +-8 mm
along the low-poly normal. Features are no narrower than about 1.5 texels of the production atlases (0.7-1.6 mm).
"""
import math
import numpy as np

TAU = 2 * math.pi
MM = 1e-3

# ================================================================================================================
# basic shapes
# ================================================================================================================
def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def window(x, a, b, ramp):
    """1 inside [a, b], easing to 0 over `ramp` outside it (C1)."""
    return smooth(a - ramp, a, x) * smooth(b + ramp, b, x)

def kernel(x):
    """Compact C1 bump: (1 - x^2)^2 inside |x| < 1, 0 outside."""
    t = np.clip(1 - x * x, 0, None)
    return t * t

def seg_dist2d(px, py, a, b):
    """Distance from points (px, py) to the 2D segment a-b, and the position t (0..1) along it."""
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(px - (ax + t * dx), py - (ay + t * dy)), t

def polyline_dist(px, py, pts):
    """Distance to a 2D polyline and the arc position (0..1) of the nearest point."""
    pts = np.asarray(pts, float)
    seg = np.hypot(*np.diff(pts, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)])
    best = np.full(np.shape(px), np.inf); tb = np.zeros(np.shape(px))
    for i in range(len(pts) - 1):
        d, t = seg_dist2d(px, py, pts[i], pts[i + 1])
        m = d < best
        best = np.where(m, d, best); tb = np.where(m, (cum[i] + t * seg[i]) / cum[-1], tb)
    return best, tb

def spline(pts, n=12):
    """Catmull-Rom through the control points, n samples per span (smooth polylines for grooves and veins)."""
    P = np.asarray(pts, float); P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return np.array(out)

def groove(dist, depth, width):
    """A smooth Gaussian valley: -depth at the centre line, half depth at about 0.83 * width."""
    return -depth * np.exp(-(dist / width) ** 2)

def ridge(dist, height, width):
    return height * np.exp(-(dist / width) ** 2)

def wrap(a):
    return (a + math.pi) % TAU - math.pi

class Deepest:
    """Combines overlapping grooves (each <= 0) as minus the 4-norm of their depths: the deepest one where one
    dominates, about 1.2x where two equal ones cross, exactly 0 where there are none (a smooth min would bias it)."""
    def __init__(self, shape):
        self.s = np.zeros(shape)

    def add(self, g):
        self.s += np.maximum(-g, 0) ** 4

    def value(self):
        return -self.s ** .25

def soft_limit(x, lim):
    """x unchanged up to 80 % of lim, then eased toward lim (C1), so overlapping features never exceed it."""
    a = .8 * lim; ax = np.abs(x)
    return np.sign(x) * np.where(ax > a, a + (lim - a) * np.tanh((ax - a) / (lim - a)), ax)

def smax_k(a, b, k):
    h = np.clip(.5 + .5 * (a - b) / k, 0, 1)
    return a * h + b * (1 - h) + k * h * (1 - h)

# ================================================================================================================
# noise (seeded, deterministic)
# ================================================================================================================
class Perlin:
    """3D gradient noise (quintic fade, C2), about [-1, 1], features about one unit across."""
    def __init__(self, seed):
        rng = np.random.default_rng(seed)
        self.perm = rng.permutation(256).astype(np.int64)
        g = rng.normal(size=(256, 3)); self.grad = g / np.linalg.norm(g, axis=1, keepdims=True)

    def __call__(self, p):
        p = np.asarray(p, float)
        fl = np.floor(p); f = p - fl; i = fl.astype(np.int64)
        u = f * f * f * (f * (f * 6 - 15) + 10)
        P = self.perm
        out = np.zeros(p.shape[:-1])
        for dx in (0, 1):
            hx = P[(i[..., 0] + dx) & 255]
            wx = u[..., 0] if dx else 1 - u[..., 0]
            for dy in (0, 1):
                hy = P[(hx + i[..., 1] + dy) & 255]
                wy = wx * (u[..., 1] if dy else 1 - u[..., 1])
                for dz in (0, 1):
                    g = self.grad[P[(hy + i[..., 2] + dz) & 255]]
                    w = wy * (u[..., 2] if dz else 1 - u[..., 2])
                    out += w * (g[..., 0] * (f[..., 0] - dx) + g[..., 1] * (f[..., 1] - dy) + g[..., 2] * (f[..., 2] - dz))
        return out * 1.1

_NOISE = {}
def noise(seed, p):
    if seed not in _NOISE: _NOISE[seed] = Perlin(seed)
    return _NOISE[seed](p)

def hash3(c, seed):
    """32-bit integer hash of integer cells (..., 3)."""
    c = c.astype(np.int64).astype(np.uint64)
    h = (c[..., 0] * np.uint64(0x8da6b343)) ^ (c[..., 1] * np.uint64(0xd8163841)) ^ (c[..., 2] * np.uint64(0xcb1ab31f)) ^ np.uint64(seed * 0x165667b1 & 0xffffffff)
    h &= np.uint64(0xffffffff)
    h = ((h ^ (h >> np.uint64(15))) * np.uint64(0x2c1b3c6d)) & np.uint64(0xffffffff)
    h = ((h ^ (h >> np.uint64(12))) * np.uint64(0x297a2d39)) & np.uint64(0xffffffff)
    return h ^ (h >> np.uint64(15))

def clumps(q, seed, R=.85, k=.09):
    """Round clumps, one per unit cell at a jittered point with its own height: the smooth max of domes
    h_i (1 - d_i^2 / R^2), so neighbouring clumps meet in soft creases. About [-0.1, 1.1]."""
    i0 = np.floor(q).astype(np.int64)
    vals = []
    for ox in (-1, 0, 1):
        for oy in (-1, 0, 1):
            for oz in (-1, 0, 1):
                c = i0 + np.array([ox, oy, oz])
                h = hash3(c, seed)
                jit = np.stack([((h >> np.uint64(s)) & np.uint64(1023)).astype(float) / 1023 for s in (0, 10, 20)], -1)
                hgt = .62 + .38 * ((h >> np.uint64(5)) & np.uint64(255)).astype(float) / 255
                f = c + .12 + .76 * jit
                d2 = ((q - f) ** 2).sum(-1)
                vals.append(hgt * (1 - d2 / (R * R)))
    V = np.stack(vals, -1)
    m = V.max(-1, keepdims=True)
    return (m + k * np.log(np.exp((V - m) / k).sum(-1, keepdims=True)))[..., 0]

# ================================================================================================================
# cloth folds: seeded sets of soft, tapered ridges and valleys on a 2D chart (s along the surface, y up, metres)
# ================================================================================================================
class Folds:
    """Each fold k: a Gaussian ridge (amp > 0) or valley (amp < 0) of half-width w along a straight segment of length L
    centred at (s, y) at angle ang (radians from +s), tapered to zero at both ends; skew > 0 makes it strongest at its
    start (the end at -L/2). Positions in fractions of H (s as an angle times radius R), sizes and amps in metres.
    period: the chart wraps in s (an angle round the body)."""
    def __init__(self, rows, R, period=True):
        a = np.array(rows, float).reshape(-1, 7)
        self.th, self.y, self.ang, self.L, self.w, self.amp, self.skew = a.T
        self.period = period; self.Rr = R

    def __call__(self, th, y, H):
        """th: angle round the chart (radians), y: metres. Returns metres."""
        out = np.zeros(np.shape(th))
        R = self.Rr * H
        for k in range(len(self.th)):
            L = self.L[k] * H; w = self.w[k]; ca, sa = math.cos(self.ang[k]), math.sin(self.ang[k])
            dy = y - self.y[k] * H
            reach_y = .5 * L * abs(sa) + 3 * w
            m = np.abs(dy) < reach_y
            if not m.any(): continue
            dth = th[m] - self.th[k]
            if self.period: dth = wrap(dth)
            ds = dth * R
            u = ds * ca + dy[m] * sa; v = -ds * sa + dy[m] * ca
            x = u / (.5 * L)
            env = kernel(x) * (1 - self.skew[k] * x) / (1 + self.skew[k])
            out[m] += self.amp[k] * env * np.exp(-(v / w) ** 2)
        return out

def _fold_rows(rng, n, th, y, ang, L, w, amp, skew=0.0):
    """n folds; each argument is a callable rng -> value (or an array of n values)."""
    rows = []
    for i in range(n):
        g = lambda f: f(rng, i) if callable(f) else (f[i] if hasattr(f, '__len__') else f)
        rows.append([g(th), g(y), g(ang), g(L), g(w), g(amp), g(skew)])
    return rows

def _strat(n, lo, hi, jitter=.4):
    """Stratified positions: n slots over [lo, hi), each jittered within its slot."""
    return lambda rng, i: lo + (hi - lo) * (i + .5 + jitter * rng.uniform(-1, 1)) / n

def _sign(rng, p_valley):
    return -1.0 if rng.random() < p_valley else 1.0

# ================================================================================================================
# registry
# ================================================================================================================
DETAILS = {}
FUNCTIONS = []

def register(parts, box, max_mm, kind):
    """Adds fn to DETAILS for each part. The wrapper evaluates fn only inside box (lo, hi) and returns 0 outside."""
    lo, hi = np.array(box[0], float), np.array(box[1], float)
    def deco(fn):
        def wrapped(part, p, n, S):
            p = np.asarray(p, float)
            out = np.zeros(p.shape[:-1])
            m = ((p >= lo) & (p <= hi)).all(-1)
            if m.any():
                nn = n[m] if (n is not None and np.shape(n) == p.shape) else None
                out[m] = fn(part, p[m], nn, S)
            return out
        wrapped.__name__ = fn.__name__; wrapped.__doc__ = fn.__doc__
        wrapped.box = (lo, hi); wrapped.max_mm = max_mm; wrapped.kind = kind; wrapped.parts = tuple(parts); wrapped.raw = fn
        for p in parts: DETAILS.setdefault(p, []).append(wrapped)
        FUNCTIONS.append(wrapped)
        return wrapped
    return deco

def detail(part, p_local, n, S):
    fns = DETAILS.get(part)
    if not fns:
        return np.zeros(np.shape(p_local)[:-1])
    return sum(fn(part, p_local, n, S) for fn in fns)

def to_m(p, S):
    """Body fractions -> body metres."""
    return p * np.array([S.H * S.SH, S.H, S.H])

def n_comp(n, k, default=0.0):
    """Component k of the normal, or `default` where no normal is given."""
    return n[..., k] if n is not None else default

# ================================================================================================================
# SKIN
# ================================================================================================================
# --- torso (prototype): deltopectoral groove and linea alba ----------------------------------------------------
DELTOPEC = ((.079, .806), (.101, .748))
DELTOPEC_DEPTH, DELTOPEC_WIDTH = .003, .0075      # metres
LINEA = (.603, .712)
LINEA_DEPTH, LINEA_WIDTH = .0025, .0055

@register(('core', 'arm_L', 'arm_R'), ([-.2, .55, -.1], [.2, .85, .15]), 3.0, 'groove')
def muscle_grooves(part, p, n, S):
    """Deltopectoral groove (clavicle to the front of the armpit) and the linea alba (core only)."""
    H, SH = S.H, S.SH
    x, y, z = np.abs(p[..., 0]), p[..., 1], p[..., 2]
    out = np.zeros(p.shape[:-1])
    d, t = seg_dist2d(x * H * SH, y * H, (DELTOPEC[0][0] * H * SH, DELTOPEC[0][1] * H), (DELTOPEC[1][0] * H * SH, DELTOPEC[1][1] * H))
    ends = smooth(0, .15, t) * smooth(1, .8, t)
    out += groove(d, DELTOPEC_DEPTH, DELTOPEC_WIDTH) * ends * smooth(-.004, .014, z)
    if part == 'core':
        fade = smooth(LINEA[0], LINEA[0] + .02, y) * smooth(LINEA[1], LINEA[1] - .02, y)
        out += groove(np.abs(p[..., 0]) * H * SH, LINEA_DEPTH, LINEA_WIDTH) * fade * smooth(.01, .03, z)
    return out

# --- arms ---------------------------------------------------------------------------------------------------------
# The arms hang at the sides, palms toward the thighs, thumbs forward (body_shapes: upper arm .80 -> .636 H, forearm
# .632 -> .478 H). Arm coordinates: y (metres), phi round the limb axis (0 lateral, +90 deg front, -90 back, 180
# medial), r the distance from the axis. Curves are given as (phi in degrees, y fraction) and measured as arc length
# phi * r against height, so they follow the arm's own surface.
UPPER = ((.117, .800, -.002), (.121, .636, -.006))
FORE = ((.121, .632, -.006), (.127, .478, .002))

def arm_coords(p, S):
    """phi (radians), r (m), y (m), side (+1 left / -1 right) for points in body fractions on an arm."""
    side = np.where(p[..., 0] >= 0, 1.0, -1.0)
    X = np.abs(p[..., 0]) * S.H * S.SH; Y = p[..., 1] * S.H; Z = p[..., 2] * S.H
    cx = np.zeros_like(Y); cz = np.zeros_like(Y)
    for (a, b) in (UPPER, FORE):
        ya, yb = a[1] * S.H, b[1] * S.H
        t = np.clip((Y - ya) / (yb - ya), 0, 1)
        m = (Y <= ya + .004 * S.H) & (Y >= yb - .004 * S.H)
        cx = np.where(m, (a[0] + t * (b[0] - a[0])) * S.H * S.SH, cx)
        cz = np.where(m, (a[2] + t * (b[2] - a[2])) * S.H, cz)
    dx, dz = X - cx, Z - cz
    return np.arctan2(dz, dx), np.hypot(dx, dz), Y, side

def _limb_dist(phi, r, Y, c):
    """Surface distance from points (phi, r, Y) on a limb to a curve c = [(phi, y metres), ...] round it: arc length
    phi * r (each point's own radius) against height. Also the arc position (0..1) of the nearest point."""
    best = np.full(np.shape(phi), np.inf); tb = np.zeros(np.shape(phi))
    rm = float(np.median(r)) if np.size(r) else .05
    seg = np.hypot(np.diff(c[:, 0]) * rm, np.diff(c[:, 1]))
    cum = np.concatenate([[0], np.cumsum(seg)])
    for i in range(len(c) - 1):
        # the segment's far end is its near end plus the segment's own (small) turn, so a segment never wraps round
        # the limb (wrapping each end separately draws a ghost of every curve on the opposite side)
        w0 = wrap(c[i, 0] - phi)
        a0 = w0 * r; a1 = (w0 + wrap(c[i + 1, 0] - c[i, 0])) * r
        ax, ay, bx, by = a0, c[i, 1], a1, c[i + 1, 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy + 1e-12
        t = np.clip(((0 - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
        d = np.hypot(ax + t * dx, Y - (ay + t * dy))
        m = d < best
        best = np.where(m, d, best); tb = np.where(m, (cum[i] + t * seg[i]) / max(cum[-1], 1e-12), tb)
    return best, tb

class LimbCurve:
    """A curve round a limb from (phi deg, y fraction of H) control points, splined once. dist() only measures points
    within `reach` metres of the curve's height range (inf elsewhere), which keeps the many curves cheap."""
    def __init__(self, pts, n=6):
        self.c = spline([(math.radians(a), b) for a, b in pts], n)
        self.ylo, self.yhi = self.c[:, 1].min(), self.c[:, 1].max()

    def dist(self, phi, r, Y, H, reach):
        d = np.full(np.shape(Y), np.inf); t = np.zeros(np.shape(Y))
        m = (Y > self.ylo * H - reach) & (Y < self.yhi * H + reach)
        if m.any():
            d[m], t[m] = _limb_dist(phi[m], r[m], Y[m], self.c * [1, H])
        return d, t

def limb_grooves(table, phi, r, Y, H):
    """Sum of a table of (LimbCurve, depth mm, width mm, end fade) grooves, combined so crossings are not deeper."""
    acc = Deepest(np.shape(Y))
    for curve, depth, width, fade in table:
        d, t = curve.dist(phi, r, Y, H, 3.5 * width * MM)
        f = 1.0 if fade == 0 else smooth(0, fade, t) * smooth(1, 1 - fade, t)
        acc.add(groove(d, depth * MM, width * MM) * f)
    return acc.value()

def limb_bumps(table, phi, r, Y, H):
    out = np.zeros(np.shape(Y))
    for a, b, h, rp, ry in table:
        ds = wrap(phi - math.radians(a)) * r; dy = Y - b * H
        out += h * MM * kernel(np.hypot(ds / (rp * MM * 1.6), dy / (ry * MM * 1.6)))
    return out

ARM_GROOVES = [(LimbCurve(c), d, w, f) for c, d, w, f in [
    # (curve [(phi deg, y frac)], depth mm, width mm, end fade (fraction of the curve))
    # deltoid's lower border: from the front (deltopectoral line) down to the insertion on the outside of the arm and
    # back up behind
    ([(80, .768), (45, .738), (12, .712), (0, .706), (-15, .713), (-50, .738), (-85, .768)], 2.4, 10, .12),
    # deltoid heads: faint lines between the anterior, middle and posterior heads
    ([(38, .79), (30, .765), (20, .738)], .8, 8, .3),
    ([(-36, .79), (-30, .765), (-22, .741)], .8, 8, .3),
    # lateral intermuscular groove: biceps / brachialis in front, triceps behind, from the insertion to the elbow
    ([(-4, .706), (-8, .685), (-12, .664), (-16, .648)], 2.0, 8.5, .2),
    # medial groove between biceps and triceps (the inner arm, toward the body)
    ([(178, .745), (172, .71), (166, .675), (160, .648)], 1.6, 8, .2),
    # triceps: line between the lateral and long heads, and the bottom of the horseshoe above the tendon plate
    ([(-40, .742), (-55, .71), (-70, .688)], 1.1, 8, .25),
    ([(-48, .678), (-70, .668), (-95, .668), (-120, .676)], 1.2, 9, .2),
    # bottom of the biceps belly in front, into the elbow
    ([(55, .672), (78, .664), (100, .667)], 1.0, 9, .25),
    # antecubital crease (front of the elbow)
    ([(48, .638), (75, .634), (105, .637)], .6, 3.5, .25),
    # forearm: brachioradialis / flexors in front, brachioradialis / extensors at the side, the ulna ridge behind
    ([(62, .628), (66, .595), (72, .56), (80, .53)], 1.4, 8, .2),
    ([(8, .625), (0, .595), (-6, .565), (-10, .54)], 1.2, 8, .2),
    ([(-118, .615), (-112, .58), (-104, .54), (-98, .505)], .9, 7, .2),
]]
ARM_BUMPS = [
    # (phi deg, y frac, height mm, radius mm (phi direction), radius mm (y))
    (-90, .641, 1.0, 14, 12),   # olecranon (point of the elbow)
    (-150, .645, .9, 8, 8),     # medial epicondyle
    (-10, .642, .7, 8, 8),      # lateral epicondyle
    (45, .700, 1.2, 16, 26),    # biceps peak
]

@register(('arm_L', 'arm_R'), ([-.2, .47, -.08], [.2, .84, .08]), 3.0, 'groove')
def arm_muscles(part, p, n, S):
    """Deltoid border and heads, biceps / triceps separations, elbow (olecranon, epicondyles, creases), forearm
    muscle grooves, and a few skin creases behind the elbow."""
    H = S.H
    phi, r, Y, side = arm_coords(p, S)
    out = limb_grooves(ARM_GROOVES, phi, r, Y, H) + limb_bumps(ARM_BUMPS, phi, r, Y, H)
    # skin creases over the back of the elbow (arm straight): short, faint, slightly curved lines, offset sideways so
    # they do not stack into a target round the olecranon
    ds = wrap(phi + math.pi / 2) * r
    for k, (dy0, ln, off) in enumerate(((-.014, .013, -.003), (-.006, .017, .002), (.006, .012, -.001))):
        yy = Y - (.636 * H + dy0) - .9 * ((ds - off) / .02) ** 2 * .004 * (1 + .3 * k)
        out += groove(yy, .3 * MM, 1.1 * MM) * kernel((ds - off) / ln)
    return soft_limit(out, 3 * MM)

# forearm veins: seeded, slightly wandering lines down the front and inside of the forearm, with a different seed per
# side so the two arms differ
def _veins(seed):
    rng = np.random.default_rng(seed)
    out = []
    # (phi start deg, phi end deg, y start, y end, height mm)
    for a0, a1, y0, y1, h in ((70, 95, .618, .50, .55), (115, 140, .60, .505, .5), (35, 55, .585, .515, .4)):
        ys = np.linspace(y0, y1, 6)
        ph = np.linspace(a0, a1, 6) + rng.normal(0, 5, 6)
        out.append((list(zip(ph, ys)), h * rng.uniform(.85, 1.1)))
    # a branch joining the first two
    yb = rng.uniform(.545, .565)
    out.append(([(out[0][0][3][0] + 2, yb + .012), (100 + rng.normal(0, 4), yb), (out[1][0][4][0] - 3, yb - .02)], .4))
    return [(LimbCurve(c), h) for c, h in out]
VEINS = {1.0: _veins(11), -1.0: _veins(12)}

@register(('arm_L', 'arm_R'), ([-.2, .48, -.08], [.2, .635, .08]), .8, 'vein')
def forearm_veins(part, p, n, S):
    """Subtle raised veins (0.4-0.6 mm, 2.5 mm wide) on the front and inside of the forearm, different on each arm."""
    H = S.H
    phi, r, Y, side = arm_coords(p, S)
    out = np.zeros(p.shape[:-1])
    for sd in (1.0, -1.0):
        m = side == sd
        if not m.any(): continue
        acc = np.zeros(m.sum())
        for curve, h in VEINS[sd]:
            d, t = curve.dist(phi[m], r[m], Y[m], H, 5 * MM)
            acc = np.maximum(acc, h * MM * np.exp(-(d / (1.25 * MM)) ** 2) * smooth(0, .18, t) * smooth(1, .82, t))
        out[m] = acc
    return out * window(Y / H, .49, .625, .01)

# --- neck and collarbones ------------------------------------------------------------------------------------------
@register(('core',), ([-.12, .78, -.06], [.12, .95, .1]), 2.5, 'groove')
def neck_clavicle(part, p, n, S):
    """Clavicles (a ridge with the hollow above it), the sternal notch, and the sternocleidomastoid from behind the
    ear to the top of the sternum, with the hollows in front of and behind it. Only the part inside the neckline is
    ever seen."""
    H, SH = S.H, S.SH
    X = np.abs(p[..., 0]) * H * SH; Y = p[..., 1] * H; Z = p[..., 2] * H
    out = np.zeros(p.shape[:-1])
    front = smooth(.0, .02, p[..., 2])
    # clavicle ridge in the frontal plane: from the sternal end out and slightly up (fractions -> metres)
    cl = spline([(.016 * H * SH, .808 * H), (.04 * H * SH, .81 * H), (.07 * H * SH, .816 * H), (.095 * H * SH, .822 * H)], 6)
    d, t = polyline_dist(X, Y, cl)
    out += ridge(d, 1.0 * MM, 6 * MM) * smooth(0, .12, t) * smooth(1, .7, t) * front
    out += .6 * MM * kernel(np.hypot(X - .02 * H * SH, Y - .807 * H) / (14 * MM)) * front       # sternal end of the clavicle
    # supraclavicular hollow above it
    sh = spline([(.03 * H * SH, .822 * H), (.055 * H * SH, .826 * H), (.075 * H * SH, .832 * H)], 6)
    d, t = polyline_dist(X, Y, sh)
    out += groove(d, 1.5 * MM, 9 * MM) * smooth(0, .3, t) * smooth(1, .7, t) * front
    # sternal (jugular) notch
    out += groove(np.hypot(X / 1.4, Y - .813 * H), 1.6 * MM, 10 * MM) * front
    # sternocleidomastoid in neck cylinder coordinates (psi round the vertical neck axis, 0 = front): the band, the
    # hollow in front of it (toward the windpipe) and the one behind it, which part from the band going up
    psi = np.arctan2(X, Z + .008 * H); rn = np.hypot(X, Z + .008 * H)
    hy = S.HO[1]
    pts = [(14, .812 * H), (30, .84 * H), (55, hy - .075), (82, hy - .045), (98, hy - .03)]
    for dpsi, kind in ((0, 'band'), (-17, 'front'), (20, 'back')):
        c = spline([(math.radians(a + dpsi * smooth(0, .3, (y - .812 * H) / (hy - .812 * H))), y) for a, y in pts], 6)
        d, t = _limb_dist(psi, rn, Y, c)
        ends = smooth(0, .12, t) * smooth(1, .8, t)
        if kind == 'band': out += ridge(d, 1.3 * MM, 10 * MM) * ends
        elif kind == 'front': out += groove(d, .8 * MM, 7 * MM) * ends * smooth(.1, .3, t)
        else: out += groove(d, .7 * MM, 9 * MM) * ends * smooth(.2, .4, t)
    return out

# --- legs ------------------------------------------------------------------------------------------------------------
# The legs are seen from the shorts' hem (.334 H) to the shoe collar. Leg coordinates as for the arms: phi round the
# shin / thigh axis (0 lateral, +90 front, -90 back, 180 medial). body_shapes: thigh .50 -> .30 H at x .05 -> .045 H,
# shin .29 -> .062 H at x .046 -> .044 H (not scaled by shoulder width).
THIGH = ((.05, .50, .004), (.045, .30, .007))
SHIN = ((.046, .29, .004), (.044, .062, -.002))

def leg_coords(p, S):
    H = S.H
    side = np.where(p[..., 0] >= 0, 1.0, -1.0)
    X = np.abs(p[..., 0]) * H * S.SH; Y = p[..., 1] * H; Z = p[..., 2] * H
    cx = np.zeros_like(Y); cz = np.zeros_like(Y)
    for (a, b) in (THIGH, SHIN):
        t = np.clip((Y - a[1] * H) / ((b[1] - a[1]) * H), 0, 1)
        m = (Y <= a[1] * H + .005 * H) & (Y >= b[1] * H - .05 * H)
        cx = np.where(m, (a[0] + t * (b[0] - a[0])) * H, cx); cz = np.where(m, (a[2] + t * (b[2] - a[2])) * H, cz)
    dx, dz = X - cx, Z - cz
    return np.arctan2(dz, dx), np.hypot(dx, dz), Y, side

LEG_GROOVES = [(LimbCurve(c), d, w, f) for c, d, w, f in [
    # the soft edge round the sides and bottom of the kneecap (open at the top, where the quadriceps tendon runs in),
    # and the hollows either side of the patellar tendon
    ([(58, .314), (62, .299), (72, .287), (90, .282), (108, .287), (118, .299), (122, .314)], .9, 6.5, .2),
    ([(66, .276), (64, .262), (66, .25)], 1.4, 7, .3),
    ([(114, .276), (116, .262), (114, .25)], 1.4, 7, .3),
    # lower edge of the vastus medialis teardrop, and the vastus lateralis / iliotibial band line above the knee
    ([(160, .334), (145, .318), (128, .306), (118, .3)], 1.3, 8, .2),
    ([(28, .334), (24, .318), (30, .305)], 1.0, 7, .25),
    # calf: split between the gastrocnemius heads (slightly medial of the back), and the W where they meet the tendon
    ([(-96, .272), (-95, .245), (-93, .215), (-92, .195)], 1.4, 7, .2),
    ([(-150, .2), (-125, .178), (-100, .186), (-80, .196), (-55, .205)], 1.3, 9, .15),
    # soleus edges at the sides of the lower calf
    ([(-28, .205), (-22, .17), (-25, .13)], .8, 7, .25),
    ([(-160, .19), (-162, .155), (-158, .125)], .8, 7, .25),
    # tibialis anterior / tibia: the groove lateral to the shin bone
    ([(76, .245), (74, .2), (78, .15), (84, .11)], .9, 7, .2),
    # Achilles tendon: hollows either side
    ([(-62, .15), (-66, .12), (-70, .085)], 1.3, 6.5, .2),
    ([(-122, .15), (-118, .12), (-112, .085)], 1.3, 6.5, .2),
]]
LEG_BUMPS = [
    (90, .301, 1.2, 20, 20),    # kneecap
    (90, .262, .8, 6, 12),      # patellar tendon
    (90, .252, .9, 9, 7),       # tibial tuberosity
    (100, .2, .6, 5, 50),       # shin bone crest
    (-90, .115, .9, 7, 30),     # Achilles tendon
    (-125, .225, 1.0, 22, 30),  # medial gastrocnemius head
    (-62, .232, .8, 18, 26),    # lateral head
]

@register(('core',), ([-.2, .05, -.09], [.2, .345, .09]), 3.0, 'groove')
def leg_muscles(part, p, n, S):
    """Knee (kneecap, its tendon and the hollows either side), the teardrop and lateral lines above it, the calf's two
    heads and their tendon edge, soleus edges, the shin and the Achilles tendon."""
    H = S.H
    phi, r, Y, side = leg_coords(p, S)
    out = limb_grooves(LEG_GROOVES, phi, r, Y, H) + limb_bumps(LEG_BUMPS, phi, r, Y, H)
    return soft_limit(out, 3 * MM) * window(Y / H, .065, .334, .01)

# ================================================================================================================
# KIT
# ================================================================================================================
# --- jersey ------------------------------------------------------------------------------------------------------------
# Chart round the torso: th = atan2(z / .66, x) (0 the player's left side, +pi/2 the front, pi the right side), s = th
# * .12 H, y in metres. The jersey is tucked into the shorts at .578 H. Openings (build_players.opening_shapes, the
# visible cut edge): armholes, the front and back neck scoops and the shoulder line.
JR = .12
ARMHOLE_C, ARMHOLE_R, ARMHOLE_GROW = (.118, .762, -.006), (.05, .072, .075), 1.09
NECK_F = ((0, .835, .03), (.048, .06, .06), 1.09)
NECK_B = ((0, .85, -.035), (.045, .035, .05), 1.1)
NECK_TOP = .866

def ell_dist(P, c, r):
    """IQ ellipsoid distance (positive outside)."""
    q = P - c
    k0 = np.linalg.norm(q / r, axis=-1); k1 = np.linalg.norm(q / (r * r), axis=-1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)

def jersey_edges(P, S):
    """Distance (m, along the fabric, approximate) to the armhole edges (per side) and the neckline."""
    H, SH = S.H, S.SH
    arm = []
    for sd in (-1.0, 1.0):
        c = np.array([sd * ARMHOLE_C[0] * H * SH, ARMHOLE_C[1] * H, ARMHOLE_C[2] * H])
        arm.append(ell_dist(P, c, np.array(ARMHOLE_R) * H * ARMHOLE_GROW))
    neck = np.minimum(ell_dist(P, np.array(NECK_F[0]) * H, np.array(NECK_F[1]) * H * NECK_F[2]),
                      ell_dist(P, np.array(NECK_B[0]) * H, np.array(NECK_B[1]) * H * NECK_B[2]))
    neck = np.minimum(neck, NECK_TOP * H - P[..., 1])
    return arm[0], arm[1], neck

def torso_theta(P, S):
    return np.arctan2(P[..., 2] / .66, P[..., 0])

def _jersey_folds():
    rng = np.random.default_rng(2026_11_13)
    anywhere = lambda r, i: r.uniform(-math.pi, math.pi)
    rows = []
    # waist gathering: folds converging into the waistband where the jersey is tucked, placed at random round the
    # waist, irregular in length and depth
    n = 38
    rows += _fold_rows(rng, n, anywhere, lambda r, i: .578 + r.uniform(.006, .02),
                       lambda r, i: math.pi / 2 + r.normal(0, .35), lambda r, i: r.uniform(.018, .05),
                       lambda r, i: r.uniform(.003, .0065), lambda r, i: (1.0 + 1.6 * r.random() ** 1.3) * MM * _sign(r, .3), .45)
    # blousing: the slack above the waistband sags into broad soft folds (these carry to game distance) ...
    n = 30
    rows += _fold_rows(rng, n, anywhere, lambda r, i: .588 + .06 * r.random() ** 1.3,
                       lambda r, i: r.normal(0, .3), lambda r, i: r.uniform(.04, .09),
                       lambda r, i: r.uniform(.006, .012), lambda r, i: (1.6 + 1.2 * r.random()) * MM * _sign(r, .45))
    # ... crossed by finer creases at looser angles
    n = 34
    rows += _fold_rows(rng, n, anywhere, lambda r, i: .584 + .075 * r.random() ** 1.5,
                       lambda r, i: r.normal(0, .5), lambda r, i: r.uniform(.018, .045),
                       lambda r, i: r.uniform(.0025, .0045), lambda r, i: (.8 + .8 * r.random()) * MM * _sign(r, .3))
    # armhole drape: folds fanning down from under each arm, strongest at the armpit
    for th0 in (0.0, math.pi):
        for ang in -math.pi / 2 + np.sort(rng.uniform(-1.1, 1.1, 8)):
            L = rng.uniform(.04, .1)
            # start just under the armhole edge; centre half a length along the fold
            y0 = .688 - rng.uniform(0, .008)
            # starts spread along the bottom of the armhole (about +-3 cm), not from one point
            rows.append([th0 + (.5 * L * math.cos(ang)) / JR + rng.normal(0, .14), y0 + .5 * L * math.sin(ang), ang, L,
                         rng.uniform(.0045, .009), (1.1 + 1.7 * rng.random() ** 2) * MM * _sign(rng, .25), .6])   # a few dominate
        # a lip of short folds following the bottom of the armhole
        for k in range(3):
            rows.append([th0 + rng.normal(0, .12), .70 + rng.uniform(-.004, .006), rng.normal(0, .25), rng.uniform(.012, .022),
                         rng.uniform(.004, .006), rng.uniform(1.0, 1.6) * MM, 0])
    # drag lines pulling diagonally off the side-panel seams
    for th0 in (0.0, math.pi):
        for sd in (-1, 1):
            for k in range(3):
                ang = sd * rng.uniform(.5, .95) + (math.pi if rng.random() < .5 else 0)
                rows.append([th0 + sd * .3 + rng.normal(0, .06), rng.uniform(.6, .675), ang, rng.uniform(.018, .035),
                             rng.uniform(.0035, .006), rng.uniform(1.0, 1.8) * MM * _sign(rng, .3), 0])
    # broad vertical drape on the chest and back, from under the pecs and blades to the waist
    for th0 in (math.pi / 2, -math.pi / 2):
        for k in range(5):
            rows.append([th0 + rng.uniform(-1.1, 1.1), rng.uniform(.63, .73), math.pi / 2 + rng.normal(0, .15),
                         rng.uniform(.08, .16), rng.uniform(.009, .016), rng.uniform(1.2, 2.2) * MM * _sign(rng, .4), 0])
    return Folds(rows, JR)
JERSEY_FOLDS = _jersey_folds()

@register(('jersey',), ([-.2, .54, -.12], [.2, .88, .12]), 3.0, 'fold')
def jersey_drape(part, p, n, S):
    """Cloth folds: irregular waist gathering where it is tucked, broad blousing above it crossed by finer creases,
    drape fanning from under each armhole, drag lines off the side-panel seams, broad vertical drape front and back.
    Fades out at the bindings."""
    P = to_m(p, S)
    aL, aR, nk = jersey_edges(P, S)
    clear = smooth(.008, .022, np.minimum(np.minimum(aL, aR), nk))
    folds = JERSEY_FOLDS(torso_theta(P, S), P[..., 1], S.H)
    return soft_limit(folds, 3 * MM) * clear * smooth(.574 * S.H, .58 * S.H, P[..., 1])

def stitch_row(e, along, e0, depth=.4 * MM, width=.6 * MM, pitch=3.4 * MM):
    """A row of stitches e0 from an edge (e = distance from the edge across the row, along = position along it): a
    fine groove whose depth pulses with each stitch."""
    return -depth * (.58 + .42 * np.cos(TAU * along / pitch)) * np.exp(-((e - e0) / width) ** 2)

def seam(ds, along, toward=1.0):
    """A sewn seam at ds = 0: the seam allowance underneath lifts a soft ridge, the join itself is a crease, and a
    topstitch runs 3.5 mm to one side."""
    return (ridge(ds, .45 * MM, 2.2 * MM) + groove(ds, .55 * MM, .7 * MM)
            + stitch_row(ds * toward, along, 3.5 * MM))

def binding(e, along, width, rows=(.55, .85), ribs=None):
    """A binding band along an opening (e = distance from the cut edge): the band sits .35 mm proud of the body
    fabric, two rows of coverstitch run along it, and an optional rib knit crosses it (ribs = (count phase, depth))."""
    out = .35 * MM * smooth(width + .8 * MM, width - .8 * MM, e) * smooth(0, 1.5 * MM, e)
    out += groove(e - width, .45 * MM, .8 * MM)
    for f in rows:
        out += stitch_row(e, along, f * width)
    if ribs is not None:
        ph, dep = ribs
        out += -dep * (.5 - .5 * np.cos(ph)) * smooth(width - 1 * MM, width - 3 * MM, e)
    return out

PANEL_TH = .3    # side panels: seams .3 rad either side of each side line

@register(('jersey',), ([-.2, .54, -.12], [.2, .88, .12]), 1.3, 'seam')
def jersey_seams(part, p, n, S):
    """Side panels (two seams per side, armpit to hem), armhole bindings with a double coverstitch, and a rib collar
    binding with its double stitch."""
    H, SH = S.H, S.SH
    P = to_m(p, S); Y = P[..., 1]
    aL, aR, nk = jersey_edges(P, S)
    th = torso_theta(P, S)
    out = np.zeros(p.shape[:-1])
    for th_side in (0.0, math.pi):
        for sd in (-1.0, 1.0):
            ds = wrap(th - (th_side + sd * PANEL_TH)) * JR * H
            toward = -sd if th_side == 0 else sd       # topstitch on the side panel
            m = np.abs(ds) < .012
            if m.any():
                out[m] += seam(ds[m], Y[m], toward) * smooth(.004, .012, np.minimum(aL[m], aR[m])) * smooth(.574 * H, .58 * H, Y[m])
    for sd, a in ((-1.0, aR), (1.0, aL)):
        c = np.array([sd * ARMHOLE_C[0] * H * SH, ARMHOLE_C[1] * H, ARMHOLE_C[2] * H])
        along = np.arctan2(Y - c[1], P[..., 2] - c[2]) * .07 * H
        m = a < .02
        if m.any(): out[m] += binding(a[m], along[m], 13 * MM)
    psi = np.arctan2(P[..., 0], P[..., 2] + .005 * H)
    m = nk < .024
    if m.any():
        out[m] += binding(nk[m], psi[m] * .06 * H, 17 * MM, rows=(.62, .9), ribs=(psi[m] * 150, .3 * MM))
    return out

# --- shorts ---------------------------------------------------------------------------------------------------------
# Leg tubes centred at x = +-.057 H, z = .004 H, radius about .06 H; waistband .572 H down to WB; hem .334 H.
SHORTS_WAIST, SHORTS_HEM, SHORTS_LEG_X, SHORTS_LEG_R = .572, .334, .057, .06
WB = 36 * MM          # elastic waistband depth

def shorts_leg_coords(P, S):
    H = S.H
    side = np.where(P[..., 0] >= 0, 1.0, -1.0)
    dx = (np.abs(P[..., 0]) - SHORTS_LEG_X * H); dz = P[..., 2] - .004 * H
    return np.arctan2(dz, dx), side

def _shorts_folds():
    rng = np.random.default_rng(2026_11_14)
    band, legs = [], []
    # elastic gathers: short vertical puckers across the waistband, irregular in pitch, length and depth
    n = 64
    bunch = lambda i: .55 + .45 * math.sin(3 * TAU * i / n + 1.1)        # the elastic gathers more in places
    band += _fold_rows(rng, n, _strat(n, -math.pi, math.pi, .7), lambda r, i: .572 - r.uniform(.006, .011),
                       lambda r, i: math.pi / 2 + r.normal(0, .12), lambda r, i: r.uniform(.008, .016),
                       lambda r, i: r.uniform(.0028, .0045), lambda r, i: (.4 + 1.0 * r.random() ** 1.5) * bunch(i) * MM * _sign(r, .45))
    for sd in (1.0, -1.0):
        # long drape folds hanging from the hip down the leg tube
        n = 8
        legs += [[sd, *row] for row in _fold_rows(rng, n, _strat(n, -math.pi, math.pi, .35), lambda r, i: r.uniform(.39, .45),
                 lambda r, i: -math.pi / 2 + r.normal(0, .12), lambda r, i: r.uniform(.07, .13),
                 lambda r, i: r.uniform(.005, .01), lambda r, i: (1.0 + 1.5 * r.random() ** 1.5) * MM * _sign(r, .35))]
        # leg-opening folds: short ones rising from the hem where it flares
        n = 9
        legs += [[sd, *row] for row in _fold_rows(rng, n, lambda r, i: r.uniform(-math.pi, math.pi), lambda r, i: .334 + r.uniform(.012, .028),
                 lambda r, i: math.pi / 2 + r.normal(0, .25), lambda r, i: r.uniform(.022, .055),
                 lambda r, i: r.uniform(.0035, .007), lambda r, i: (.9 + 1.2 * r.random() ** 1.5) * MM * _sign(r, .4), .3)]
        # creases from the crotch fork, front and back, down and outward
        for fb in (1, -1):
            for k in range(2):
                ang = -math.pi / 2 + fb * rng.uniform(.5, .8) * -1
                legs.append([sd, fb * rng.uniform(2.2, 2.6), rng.uniform(.43, .47), ang, rng.uniform(.04, .07),
                             rng.uniform(.004, .007), rng.uniform(1.2, 2.0) * MM, .5])
    leg = {sd: Folds([r[1:] for r in legs if r[0] == sd], SHORTS_LEG_R) for sd in (1.0, -1.0)}
    return Folds(band, JR), leg
SHORTS_BAND, SHORTS_LEGS = _shorts_folds()

@register(('shorts',), ([-.2, .32, -.12], [.2, .6, .12]), 3.0, 'fold')
def shorts_folds(part, p, n, S):
    """Elastic waistband gathers, drape folds down each leg, folds rising from the leg openings, crotch creases."""
    H = S.H
    P = to_m(p, S); Y = P[..., 1]
    out = SHORTS_BAND(torso_theta(P, S), Y, H) * window(Y, SHORTS_WAIST * H - WB + 2 * MM, SHORTS_WAIST * H - 4 * MM, 2 * MM)
    phi, side = shorts_leg_coords(P, S)
    legs = np.zeros_like(out)
    for sd in (1.0, -1.0):
        m = (side == sd) & (Y < .52 * H)
        if m.any(): legs[m] = SHORTS_LEGS[sd](phi[m], Y[m], H)
    out += legs * smooth(SHORTS_WAIST * H - WB - 2 * MM, SHORTS_WAIST * H - WB - 10 * MM, Y) * smooth(SHORTS_HEM * H + 5 * MM, SHORTS_HEM * H + 12 * MM, Y)
    return out

@register(('shorts',), ([-.2, .32, -.12], [.2, .6, .12]), 1.3, 'seam')
def shorts_seams(part, p, n, S):
    """Waistband: three stitched elastic channels and the band's lower seam; a double-stitched hem; the side seam
    down the outside of each leg."""
    H = S.H
    P = to_m(p, S); Y = P[..., 1]
    th = torso_theta(P, S)
    out = np.zeros(p.shape[:-1])
    top = SHORTS_WAIST * H
    along = th * JR * H
    for k in (1, 2, 3):
        out += stitch_row(top - Y, along, k * 9 * MM, depth=.38 * MM)
    e = top - WB - Y                                 # below the band: the band overlaps the leg fabric
    out += .45 * MM * smooth(.8 * MM, -.8 * MM, e) + groove(e, .5 * MM, .9 * MM) + stitch_row(e, along, 3 * MM)
    phi, side = shorts_leg_coords(P, S)
    hem = Y - SHORTS_HEM * H
    out += binding(hem, phi * SHORTS_LEG_R * H, 20 * MM, rows=(.55, .85)) * smooth(.03, .02, hem)
    ds = wrap(phi) * SHORTS_LEG_R * H
    m = np.abs(ds) < .012
    if m.any():
        out[m] += seam(ds[m], Y[m], 1.0) * smooth(top - WB - 1 * MM, top - WB - 6 * MM, Y[m]) * smooth(SHORTS_HEM * H + 18 * MM, SHORTS_HEM * H + 24 * MM, Y[m])
    return out

# --- compression sleeves -------------------------------------------------------------------------------------------
@register(('sleeve_arm', 'sleeve_leg'), ([-.2, .09, -.1], [.2, .76, .1]), 1.0, 'rib')
def sleeve_knit(part, p, n, S):
    """Compression knit: fine lengthwise ribs, a panel of transverse flex ribs over the back of the elbow (arm) or the
    front of the knee (leg), cuffs at both ends with a stitch row, and a flatlock seam down the inside."""
    H = S.H
    if part == 'sleeve_arm':
        phi, r, Y, side = arm_coords(p, S); lo, hi = .505 * H, .745 * H
        joint, jphi = .634 * H, -math.pi / 2
    else:
        phi, r, Y, side = leg_coords(p, S); lo, hi = .105 * H, .315 * H
        joint, jphi = .292 * H, math.pi / 2
    out = -.18 * MM * (.5 - .5 * np.cos(phi * 64))                       # wales: 64 round the limb
    ds = wrap(phi - jphi) * r; dy = Y - joint
    patch = kernel(np.hypot(ds / .05, dy / .04) * .9) ** .5
    out += patch * (-.42 * MM * (.5 - .5 * np.cos(TAU * dy / (5.5 * MM)))) + .25 * MM * patch
    for edge in (Y - lo, hi - Y):
        out += .3 * MM * smooth(18 * MM, 16 * MM, edge) + stitch_row(edge, phi * r, 16 * MM, depth=.35 * MM)
    dm = wrap(phi - math.pi) * r                                         # flatlock seam down the medial side
    out += ridge(dm, .35 * MM, 1.8 * MM) + stitch_row(np.abs(dm), Y, 2.4 * MM, depth=.3 * MM)
    return out * window(Y, lo + 4 * MM, hi - 4 * MM, 3 * MM)        # gone 1 mm before each cut end

# --- headband --------------------------------------------------------------------------------------------------------
@register(('headband',), ([-.15, -.03, -.18], [.15, .16, .18]), .8, 'rib')
def headband_terry(part, p, n, S):
    """Terry headband: 120 vertical ribs round the band, a looped pile on them, and a stitched edge top and bottom."""
    th = np.arctan2(p[..., 0], p[..., 2])
    lo = .044 + .15 * p[..., 2]
    v = p[..., 1] - lo                                                    # 0 at the bottom edge, .028 at the top
    rib = .45 * MM * ((.5 + .5 * np.cos(th * 120)) ** 1.5 - .45)
    pile = .12 * MM * noise(7, p / (2.6 * MM))
    edge = stitch_row(v, th * .09, 3 * MM, depth=.3 * MM) + stitch_row(.028 - v, th * .09, 3 * MM, depth=.3 * MM)
    return (rib + pile) * window(v, 4.5 * MM, 23.5 * MM, 1.5 * MM) + edge

# ================================================================================================================
# GEAR
# ================================================================================================================
# --- hair (head-local metres: x left, y up, z forward, origin the head origin) -------------------------------------------
HAIR_C = np.array([0, .03, -.012])                 # centre of the skull for the polar coordinates
HAIR_R = .095                                      # arc lengths use this fixed radius, so patterns do not stretch
                                                   # along the normal (the bake searches along it)
WHORL = np.array([.12, .88, -.46]) / np.linalg.norm([.12, .88, -.46])   # the crown whorl, back of the top, off-centre

def hair_polar(p):
    """theta: angle from the crown whorl, phi: azimuth round it, r: distance from the skull centre."""
    d = p - HAIR_C; r = np.linalg.norm(d, axis=-1); u = d / np.maximum(r, 1e-9)[..., None]
    e1 = np.cross(WHORL, [0, 0, 1.0]); e1 /= np.linalg.norm(e1); e2 = np.cross(WHORL, e1)
    th = np.arccos(np.clip(u @ WHORL, -1, 1))
    return th, np.arctan2(u @ e2, u @ e1), r

def strands(p, across, along, seed):
    """Hair strands flowing away from the crown whorl (along the meridians): noise that varies fast across the flow
    (about `across` metres) and slowly along it. Rings round the whorl hold 2^b strands; neighbouring bands cross-fade
    so the spacing stays within a factor of two everywhere."""
    th, ph, r = hair_polar(p)
    need = np.log2(np.maximum(TAU * HAIR_R * np.sin(th) / across, 1.0))
    out = np.zeros(np.shape(th))
    for b in range(3, 10):
        w = kernel((need - b) / 1.0)
        m = w > 0
        if not m.any(): continue
        rho = 2 ** b / TAU * .55
        q = np.stack([rho * np.cos(ph[m]), rho * np.sin(ph[m]), th[m] * HAIR_R / along + 13.7 * b], -1)
        out[m] += w[m] * noise(seed + b, q)
    norm = sum(kernel((need - b) / 1.0) for b in range(3, 10))
    return out / np.maximum(norm, 1e-6) * smooth(.12, .3, th)

@register(('hair_buzz', 'hair_crop'), ([-.2, -.15, -.25], [.2, .3, .25]), .8, 'hair')
def hair_strands(part, p, n, S):
    """Strand direction for the buzz (fine) and the crop (coarser), clumped by a slow noise."""
    if part == 'hair_buzz':
        a, across, along = .6 * MM, 2.6 * MM, 9 * MM
    else:
        a, across, along = .6 * MM, 3.4 * MM, 14 * MM
    clump = .7 + .3 * noise(31, p / .025)
    return a * clump * strands(p, across, along, 40 if part == 'hair_buzz' else 50)

@register(('hair_crop',), ([-.2, -.15, -.25], [.2, .3, .25]), 1.2, 'hair')
def hair_waves(part, p, n, S):
    """360 waves on the crop: ripples in rings round the crown, about 17 mm apart, wobbling and zig-zagging so no two
    crests are alike; deeper where the hair is longer (the top)."""
    th, ph, r = hair_polar(p)
    s = th * HAIR_R
    phase = s / (17 * MM) + .35 * noise(61, p / .035) + .1 * np.sin(ph * 11 + 3 * th)
    wave = np.sin(TAU * phase) - .22 * np.sin(2 * TAU * phase + .6)
    depth = (.5 + .45 * smooth(-.01, .09, p[..., 1])) * MM
    return depth * wave / 1.1 * smooth(.15, .35, th)

@register(('hair_rows',), ([-.2, -.15, -.25], [.2, .3, .25]), 2.6, 'hair')
def cornrows(part, p, n, S):
    """Cornrow braids along the style's rows (front to back, 36 mm apart, raised every other row by the geometry):
    plaits in a herringbone, alternating left and right every 11 mm, each row offset at random, with a parting groove
    between rows."""
    W, pitch = .036, 11 * MM
    x = p[..., 0]
    k = np.floor(x / W); u = x - (k + .5) * W
    # along the row, over the head: the angle round an axis 13 cm below the skull centre (one through the centre would
    # be singular over the ears), times a fixed radius
    al = np.arctan2(p[..., 2] - HAIR_C[2], p[..., 1] - HAIR_C[1] + .13) * .17
    off = (hash3(np.stack([k, k * 0, k * 0], -1).astype(np.int64), 5) & np.uint64(1023)).astype(float) / 1023 * pitch
    s = al + off
    j0 = np.floor(s / pitch)
    h = np.zeros(np.shape(x))
    for dj in (-1, 0, 1, 2):
        j = j0 + dj
        lr = np.where(np.mod(j, 2) == 0, 1.0, -1.0)
        cu = lr * .2 * W; cs = j * pitch
        ang = lr * .75
        du, dsv = u - cu, s - cs
        ca, sa = np.cos(ang), np.sin(ang)
        l1 = du * ca + dsv * sa; l2 = -du * sa + dsv * ca
        h = np.maximum(h, kernel(np.hypot(l1 / (.36 * W), l2 / (.42 * pitch))))
    plait = 2.0 * MM * (h - .45)
    part_ = groove(np.abs(u) - .5 * W, 1.2 * MM, 2.3 * MM)
    return plait * smooth(.5 * W, .38 * W, np.abs(u)) + part_

@register(('hair_afro',), ([-.25, -.15, -.3], [.25, .32, .3]), 3.0, 'hair')
def afro_curl(part, p, n, S):
    """Afro texture on the dome: coarse coil clumps (about 22 mm, 1.8 mm high, soft creases between them) and fine
    curl (ridged noise at 4.8 mm, the coils, plus a 2.6 mm octave)."""
    coarse = 1.8 * MM * (clumps(p / .022, 91) - .55) / .55
    f1 = noise(92, p / (4.8 * MM)); f2 = noise(93, p / (2.6 * MM) + 7.1)
    fine = .8 * MM * (.6 - np.sqrt(f1 * f1 + .02)) / .6 + .2 * MM * f2      # ridged: worm-like coils
    return np.clip(coarse, -2.3 * MM, 2.3 * MM) * .9 + fine

# --- hands (hand-local metres) --------------------------------------------------------------------------------------------
class HandLayout:
    """The hand's skeleton in hand-local metres: per digit, joint centres from the base joint (MCP, or the thumb's
    CMC) to the tip centre, the capsule radius at each, and the dorsal (nail side) direction of each segment.
    anatomical(H) follows the plan (hand length .112 H, palm breadth .45 L, finger segments 22/15/10 % of L for the
    middle finger, relaxed curl index 20/25/10 deg to little 35/40/15 deg). D3 builds one from D1's capsules."""
    def __init__(self, digits):
        self.digits = digits    # name -> dict(joints (k+1, 3), radii (k+1,), dorsal (k, 3))

    @classmethod
    def anatomical(cls, H):
        L = .112 * H; B = .45 * L; Lp = .53 * L
        digits = {}
        spec = {  # name: (x / B, y / Lp, length scale, radius / L, splay deg, curl MCP/PIP/DIP deg)
            'index': (.33, .97, .92, .043, 4, (20, 25, 10)), 'middle': (.11, 1.0, 1.0, .045, 0, (24, 30, 12)),
            'ring': (-.11, .97, .95, .042, -3, (29, 35, 13)), 'little': (-.32, .88, .76, .037, -8, (35, 40, 15))}
        for name, (fx, fy, ls, rr, splay, curl) in spec.items():
            J = [np.array([fx * B, fy * Lp, .002])]
            R = [rr * L]; D = []
            ang = 0.0; sp = math.radians(splay)
            for seg, c in zip((.22, .15, .10), curl):
                ang += math.radians(c)
                a = np.array([math.sin(sp) * math.cos(ang), math.cos(sp) * math.cos(ang), -math.sin(ang)])
                d = np.array([0, 0, 1.0]) - a * a[2]; d /= np.linalg.norm(d)
                J.append(J[-1] + a * seg * ls * L); R.append(R[-1] * .88); D.append(d)
            digits[name] = dict(joints=np.array(J), radii=np.array(R), dorsal=np.array(D))
        # thumb: from the CMC at the base of the palm, opposed (in front of the palm, toward the fingers)
        J = [np.array([.42 * B, .2 * Lp, -.008])]; R = [.06 * L]; D = []
        dirs = [np.array([.48, .78, -.4]), np.array([.25, .86, -.45]), np.array([.05, .88, -.47])]
        for seg, a in zip((.2, .14, .12), dirs):
            a = a / np.linalg.norm(a)
            d = np.array([.75, 0, .66]) - a * (a @ np.array([.75, 0, .66])); d /= np.linalg.norm(d)
            J.append(J[-1] + a * seg * L); R.append(R[-1] * .86); D.append(d)
        digits['thumb'] = dict(joints=np.array(J), radii=np.array(R), dorsal=np.array(D))
        return cls(digits)

    def segments(self):
        for name, dg in self.digits.items():
            for i in range(len(dg['dorsal'])):
                yield name, i, dg['joints'][i], dg['joints'][i + 1], dg['radii'][i], dg['radii'][i + 1], dg['dorsal'][i]

class ShoeLayout:
    """A sneaker's landmarks in shoe-local metres (origin on the ground under the back of the heel, +z to the toe, +y
    up, +x lateral). for_height(H) is the plan's sneaker; D3 builds one from D1's sneaker dimensions."""
    def __init__(self, length, half_width, heel_stack, fore_stack, outsole, toe_spring, instep_y, collar_y,
                 throat=(.42, .78), throat_hw=.014, eyelets=6):
        self.length, self.half_width = length, half_width
        self.heel_stack, self.fore_stack, self.outsole, self.toe_spring = heel_stack, fore_stack, outsole, toe_spring
        self.instep_y, self.collar_y, self.throat, self.throat_hw, self.eyelets = instep_y, collar_y, throat, throat_hw, eyelets

    @classmethod
    def for_height(cls, H):
        L = 1.1 * .153 * H
        return cls(L, .19 * L, .030, .021, .004, .011, .075 * L / .32 + .03, .10)

    def sole_y(self, z):
        L = self.length
        return (self.heel_stack + (self.fore_stack - self.heel_stack) * smooth(.3 * L, .7 * L, z)
                + self.toe_spring * smooth(.86 * L, L, z))

def layout_for(part, S):
    lay = getattr(S, 'layouts', {}).get(part)
    if lay is not None: return lay
    if part.startswith('hand'): return HandLayout.anatomical(S.H)
    return ShoeLayout.for_height(S.H)

def _seg_frame(p, J0, J1, d):
    """Along (metres from J0), across angle psi from the dorsal direction, radial distance, for one segment."""
    a = J1 - J0; ln = np.linalg.norm(a); a = a / ln
    l = np.cross(a, d)
    q = p - J0; t = q @ a
    rv = q - t[..., None] * a
    return t, np.arctan2(rv @ l, rv @ d), np.linalg.norm(rv, axis=-1), ln

@register(('hand_L', 'hand_R'), ([-.12, -.04, -.12], [.12, .32, .1]), 2.0, 'groove')
def hand_knuckles(part, p, n, S):
    """Back of the hand: the four MCP knuckles with dips between them, extensor tendons fanning from the wrist to
    each knuckle, PIP and DIP knuckles with their skin wrinkles."""
    lay = layout_for(part, S)
    out = np.zeros(p.shape[:-1])
    dorsal_side = smooth(-.002, .006, p[..., 2])
    tops = []
    for name, dg in lay.digits.items():
        if name == 'thumb': continue
        J, R, D = dg['joints'], dg['radii'], dg['dorsal']
        # MCP knuckle: the metacarpal head, on the back of the hand above the joint
        K = J[0] + np.array([0, 0, 1.0]) * (R[0] + .004) + D[0] * .001
        tops.append(K)
        out += 1.6 * MM * np.exp(-((p - K) ** 2).sum(-1) / (7 * MM) ** 2)
        # extensor tendon from the middle of the wrist to the knuckle (top view), on the back of the hand only
        d, t = seg_dist2d(p[..., 0], p[..., 1], (K[0] * .35, .02), (K[0], K[1] - .004))
        out += ridge(d, .55 * MM, 2.2 * MM) * smooth(0, .25, t) * smooth(1, .85, t) * dorsal_side
        # PIP and DIP: knuckle bump plus wrinkles across the back of the joint
        for i, (amp, nw) in ((1, (1.0, 3)), (2, (.5, 2))):
            a = J[i + 1] - J[i - 1]; a /= np.linalg.norm(a)
            d_ = D[i - 1] + D[i]; d_ /= np.linalg.norm(d_)
            K2 = J[i] + d_ * R[i]
            out += amp * MM * np.exp(-((p - K2) ** 2).sum(-1) / ((5 if i == 1 else 3.5) * MM) ** 2)
            q = p - J[i]; t = q @ a
            rv = q - t[..., None] * a; rr = np.linalg.norm(rv, axis=-1)
            cosd = (rv @ d_) / np.maximum(rr, 1e-9)
            near = smooth(1.6 * R[i], 1.2 * R[i], rr) * smooth(.25, .65, cosd)
            for k in range(nw):
                tk = (k - (nw - 1) / 2) * 2.4 * MM
                out += groove(t - tk, .38 * MM, .85 * MM) * near
    # dips between neighbouring knuckles
    for a_, b_ in zip(tops[:-1], tops[1:]):
        mid = .5 * (a_ + b_)
        out += -.6 * MM * np.exp(-((p - mid) ** 2).sum(-1) / (5 * MM) ** 2)
    return out * dorsal_side

@register(('hand_L', 'hand_R'), ([-.12, -.04, -.12], [.12, .32, .1]), .7, 'groove')
def hand_creases(part, p, n, S):
    """Palm side: the flexion creases across the base, middle and end joints of each finger and the thumb."""
    lay = layout_for(part, S)
    out = np.zeros(p.shape[:-1])
    for name, dg in lay.digits.items():
        J, R, D = dg['joints'], dg['radii'], dg['dorsal']
        for i in range(len(D)):
            # crease positions: the base crease sits a quarter of the way along the first segment, the others on the
            # joints (with a fainter second line)
            a = J[i + 1] - J[i]; ln = np.linalg.norm(a); a /= ln
            C = J[i] + a * (.25 if i == 0 else 0.0) * ln
            q = p - C; t = q @ a; rv = q - t[..., None] * a; rr = np.linalg.norm(rv, axis=-1)
            cosd = (rv @ D[i]) / np.maximum(rr, 1e-9)
            palmar = smooth(-.35, -.75, cosd) * smooth(1.6 * R[i], 1.2 * R[i], rr)
            out += groove(t, .45 * MM, 1.2 * MM) * palmar
            if i > 0:
                out += groove(t - 2.2 * MM, .3 * MM, 1.0 * MM) * palmar
    return out

@register(('hand_L', 'hand_R'), ([-.12, -.04, -.12], [.12, .32, .1]), .6, 'nail')
def hand_nails(part, p, n, S):
    """Nails on the last segment of each digit: a plate standing .25 mm proud, a groove round its proximal and lateral
    folds, wrapping slightly over the tip."""
    lay = layout_for(part, S)
    out = np.zeros(p.shape[:-1])
    for name, dg in lay.digits.items():
        J, R, D = dg['joints'], dg['radii'], dg['dorsal']
        t, psi, rr, ln = _seg_frame(p, J[-2], J[-1], D[-1])
        r = R[-1]
        near = smooth(1.7 * r, 1.25 * r, rr) * smooth(-.4 * ln, -.2 * ln, t)
        if not (near > 0).any(): continue
        # the plate runs from 45 % along the segment to a little over the tip
        half_l = .5 * (.55 * ln + .45 * r)
        along = t - (.45 * ln + half_l)
        across = psi * np.maximum(rr, .5 * r)
        half_w = .58 * r * (1.15 if name == 'thumb' else 1.0)
        qx = np.abs(across) - (half_w - .25 * r); qy = np.abs(along) - (half_l - .25 * r)
        sd = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - .25 * r
        plate = .25 * MM * smooth(.5 * MM, -.5 * MM, sd)
        fold = groove(sd - .55 * MM, .45 * MM, .65 * MM) * smooth(half_l * .6, half_l * .2, along)    # not at the free edge
        out += (plate + fold) * near * smooth(-.1, .3, np.cos(psi))
    return out

# --- sneakers (shoe-local metres) ------------------------------------------------------------------------------------
def _top_face(n):
    return smooth(.12, .45, n_comp(n, 1))

@register(('shoes', 'shoe_L', 'shoe_R'), ([-.12, -.01, -.03], [.12, .32, .45]), 2.0, 'groove')
def shoe_sole(part, p, n, S):
    """Outsole: tread notches wrapping its edge and a herringbone underneath; the outsole/midsole joint; midsole: a
    moulded channel and a fine foam stipple; the lip where the upper meets the midsole."""
    lay = layout_for(part, S)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    L = lay.length; ys = lay.sole_y(z); os_ = lay.outsole
    out = np.zeros(p.shape[:-1])
    # position round the sole's outline, for anything that runs along the edge
    ga = np.arctan2(x / max(lay.half_width, 1e-3), (z - .5 * L) / (.5 * L))
    perim = ga * .5 * (.5 * L + lay.half_width) * 1.25
    side = smooth(-.3, .1, -np.abs(n_comp(n, 1))) if n is not None else 1.0
    notch = -.85 * MM * ((.5 + .5 * np.cos(TAU * (perim + .5 * y) / (6.5 * MM))) ** 3) * smooth(os_ + .5 * MM, os_ - .5 * MM, y)
    out += notch * side
    out += groove(y - os_, .7 * MM, .8 * MM)
    mid = os_ + .45 * (ys - os_)
    out += groove(y - mid, .6 * MM, 1.5 * MM) * smooth(.06 * L, .14 * L, z) * smooth(.97 * L, .9 * L, z)
    out += .12 * MM * noise(81, p / (3.2 * MM)) * window(y, os_ + 1 * MM, ys - 1.5 * MM, .8 * MM)
    out += ridge(y - (ys - 1 * MM), .55 * MM, 1.1 * MM) + groove(y - (ys + 1.2 * MM), .75 * MM, 1.0 * MM)
    if n is not None:
        bottom = smooth(-.45, -.8, n[..., 1])
        hb = z + .55 * np.abs(((x / (8 * MM)) % 2) - 1) * 8 * MM
        out += -.9 * MM * ((.5 + .5 * np.cos(TAU * hb / (5 * MM))) ** 2) * bottom
    return out * smooth(ys + 8 * MM, ys + 3 * MM, y)

@register(('shoes', 'shoe_L', 'shoe_R'), ([-.12, -.01, -.03], [.12, .32, .45]), 1.0, 'seam')
def shoe_panels(part, p, n, S):
    """Upper panels: toe cap, mudguard round the forefoot, vamp / quarter join on both sides, heel counter, each an
    overlap step with a stitch row beside it; padded collar channels."""
    lay = layout_for(part, S)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    L = lay.length; ys = lay.sole_y(z)
    out = np.zeros(p.shape[:-1])
    upper = smooth(ys + 1.5 * MM, ys + 3.5 * MM, y)
    def overlap(e, along):     # e > 0 on the overlaying panel
        return .6 * MM * smooth(-.7 * MM, .7 * MM, e) - .3 * MM + stitch_row(e, along, 2.6 * MM, depth=.38 * MM)
    # toe cap: a line across the toe box, curving forward over the middle
    e = z - (.84 * L - 8 * x * x)
    out += overlap(e, x + y) * smooth(.7 * L, .76 * L, z) + .3 * MM * smooth(.72 * L, .7 * L, z)
    # mudguard: a band 13 mm high round the forefoot, overlaying the upper
    e2 = (ys + 13 * MM) - y
    out += (overlap(e2, z) + .3 * MM) * smooth(.5 * L, .58 * L, z)
    # vamp / quarter: a line on each side from the eyestay down and back to the sole
    d, t = seg_dist2d(z, y, (.56 * L, lay.instep_y), (.44 * L, lay.sole_y(.44 * L) + 2 * MM))
    sgn = np.sign((z - .56 * L) * (lay.sole_y(.44 * L) + 2 * MM - lay.instep_y) - (y - lay.instep_y) * (.44 * L - .56 * L))
    sidef = smooth(lay.throat_hw + 8 * MM, lay.throat_hw + 14 * MM, np.abs(x))
    out += (overlap(-sgn * d, y) + .3 * MM) * smooth(6 * MM, 3 * MM, d) * sidef * smooth(.05, .25, t) * smooth(1, .9, t)
    # heel counter: from the sole at .3 L, up and back to 65 % of the collar height at the back
    zc = .3 * L - (.3 * L) * smooth(lay.sole_y(.3 * L), .66 * lay.collar_y, y) ** .7
    e3 = zc - z
    out += overlap(e3, y) * smooth(.66 * lay.collar_y + 4 * MM, .66 * lay.collar_y, y)
    # collar padding: two soft channels below the topline at the back
    for k in (1, 2):
        out += groove(y - (lay.collar_y - k * 11 * MM), .8 * MM, 1.6 * MM) * smooth(.45 * L, .3 * L, z)
    return out * upper

@register(('shoes', 'shoe_L', 'shoe_R'), ([-.12, -.01, -.03], [.12, .32, .45]), 2.6, 'lace')
def shoe_laces(part, p, n, S):
    """Eyestays either side of the throat with eyelets, the tongue between them, and laces criss-crossing from eyelet
    to eyelet (each a rounded band 8 mm wide, 2.2 mm proud), on the top of the shoe only."""
    lay = layout_for(part, S)
    x, z = p[..., 0], p[..., 2]
    L = lay.length; hw = lay.throat_hw
    z0, z1 = lay.throat[0] * L, lay.throat[1] * L
    zs = np.linspace(z0, z1, lay.eyelets)
    ex = hw + 5 * MM
    ax = np.abs(x)
    inz = window(z, z0 - 5 * MM, z1 + 5 * MM, 6 * MM)
    base = (1.1 * MM * window(ax, hw + .5 * MM, hw + 11 * MM, 1.5 * MM) - .4 * MM * smooth(hw, hw - 2 * MM, ax)) * inz
    for zk in zs:
        base += -.9 * MM * kernel(np.hypot(ax - ex, z - zk) / (2.6 * MM)) * inz
    rng = np.random.default_rng(77)
    # the two laces of each crossing combine as a 4-norm (the upper one 12 % higher), so a crossing is not a spike
    acc = np.zeros(p.shape[:-1])
    for k in range(len(zs) - 1):
        for sgn in (1, -1):
            j = rng.uniform(-1, 1, 2) * MM
            d, t = seg_dist2d(x, z, (-sgn * ex, zs[k] + j[0]), (sgn * ex, zs[k + 1] + j[1]))
            band = (np.clip(1 - (d / (4 * MM)) ** 2, 0, None)) ** 1.5           # a flat lace 8 mm wide
            acc += (band * (1 + .12 * (sgn == (1 if k % 2 else -1)))) ** 4
    lace = np.minimum(acc ** .25, 1.12) / 1.12 * inz
    # laces lie over the tongue and eyestays: the surface is the higher layer (exactly the base away from the laces)
    out = smax_k(base, 2.2 * MM * lace - .4 * MM, .4 * MM)
    return out * _top_face(n)

@register(('shoes', 'shoe_L', 'shoe_R'), ([-.12, -.01, -.03], [.12, .32, .45]), .7, 'perforation')
def shoe_perfs(part, p, n, S):
    """Perforations in the toe box: dimples 2.2 mm across on a staggered 6.5 mm grid, above the mudguard."""
    lay = layout_for(part, S)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    L = lay.length
    pitch = 6.5 * MM
    row = np.round(z / (pitch * .866))
    xs = x - (np.round(x / pitch - .5 * (row % 2)) + .5 * (row % 2)) * pitch
    zs = z - row * pitch * .866
    holes = -.6 * MM * np.exp(-(np.hypot(xs, zs) / (1.1 * MM)) ** 2)
    region = window(z, .77 * L, .95 * L, 4 * MM) * smooth(lay.sole_y(z) + 15 * MM, lay.sole_y(z) + 19 * MM, y)
    return holes * region * smooth(-.05, .3, n_comp(n, 1))
