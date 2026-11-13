"""The Kangs player SDF in numpy, every part the Houdini recipe meshes (houdini/build_players.py), plus a detail hook.

Body parts (core, arm_L, arm_R) and the head block come from preview_body.py (the same formulas as the VEX HEADER). The
clothing and hair are line-for-line ports of GARMENT_VEX. A part's high-detail SDF is
    sdf_hi(part, P, n) = sdf(part, P) - detail(part, p_local, n)          (detail > 0 pushes the surface out)
where detail comes from detail.py. Garments are offsets of the plain core (no skin detail), so muscle grooves do not
print through the jersey.

All positions are body metres (y up, +z forward, feet at y = 0, x > 0 the player's left). Arrays are (..., 3).
"""
import json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PLAYERS = os.path.dirname(HERE)
sys.path.insert(0, PLAYERS)
import preview_body as pb  # noqa: E402

SPEC_PATH = os.path.join(PLAYERS, 'body_shapes.json')
BLEND = 0.03   # Houdini 'Blend radius' default
GARMENTS = ('jersey', 'shorts', 'shoes', 'hair_buzz', 'hair_crop', 'hair_afro', 'hair_rows', 'headband', 'sleeve_arm', 'sleeve_leg')
PARTS = ('core', 'arm_L', 'arm_R') + GARMENTS
HAIRLINES = {'hair_buzz': (90.0, 88.0, 80.0, 52.0, 6.0, 0.0, -16.0, -32.0, -38.0),
             'hair_crop': (93.0, 91.0, 83.0, 55.0, 8.0, 2.0, -14.0, -30.0, -36.0),
             'hair_rows': (91.0, 89.0, 81.0, 53.0, 7.0, 1.0, -15.0, -31.0, -37.0)}
# The parts that are always on a player together: they occlude each other in the AO bake. Hair styles and the
# optional pieces add themselves only when their own texels are baked.
AO_OCCLUDERS = ('core', 'arm_L', 'arm_R', 'jersey', 'shorts', 'shoes')

smin, smax = pb.smin, pb.smax

def smooth(a, b, x):
    """Houdini smooth(): Hermite smoothstep from a to b."""
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def sdell(q, r):
    return pb.sd_ellipsoid(q, np.asarray(r, float))

def roundcone(q, r1, r2, h):
    return pb.sd_roundcone(q, r1, r2, h)

def load_spec(path=SPEC_PATH):
    return json.load(open(path))


class PlayerSDF:
    """Evaluates every part of one variant. The head block (25 shapes) is only evaluated near the head: far from it,
    smin(body, head, neck_k) is exactly the body (see _head_needed), so culling it changes no value."""

    def __init__(self, spec, variant, detail=None, blend=BLEND):
        self.spec, self.name = spec, variant
        self.v = v = spec['variants'][variant]
        self.H, self.SH, self.M = v['height_m'], v['shoulder'], v['mass']
        self.blend = blend
        shapes = pb.shapes_for(spec, v)
        self.body = {p: [s for s in shapes if s['part'] == p] for p in ('core', 'arm_L', 'arm_R')}
        self.head = pb.head_shapes(v)
        self.scalp = [s for s in self.head if s['name'] != 'ear']
        self.neck_k = v['head']['neck_k']
        self.HO = pb.head_origin(v)
        self.HW = v['head']['params']['breadth'] / 2000.0
        # bounding sphere of the head block (head-local): every shape lies inside it, so outside it the head SDF is at
        # least the distance to the sphere minus the blend shrink (each smin lowers by at most k/4, gauss adds subtract amp)
        self.head_c, self.head_r = self._head_bound()
        self.detail = detail

    def _head_bound(self):
        """A sphere containing the whole head block, measured by sampling the head SDF on a coarse grid."""
        g = np.linspace(-.35, .35, 36)
        P = np.stack(np.meshgrid(g, g + .0, g, indexing='ij'), -1).reshape(-1, 3) + self.HO + [0, -.08, 0]
        d = pb.head_sdf(P, self.head)
        inside = P[d < .01]
        c = inside.mean(0)
        r = np.linalg.norm(inside - c, axis=1).max() + .03
        return c, r

    # --- body parts ----------------------------------------------------------------------------------------
    def body_part(self, P, part):
        d = None
        for sh in self.body[part]:
            s = pb.sdf(P, sh); d = s if d is None else smin(d, s, self.blend)
        return d

    def _head_needed(self, P, body):
        # A lower bound of the head SDF outside its bounding sphere. IQ's ellipsoid approximation underestimates the true
        # distance far from the shape (by about a third at 0.3 m), so the bound is halved; when it exceeds body + neck_k
        # the smin returns body exactly. tests: culled == full on random points round the body.
        lb = .5 * (np.linalg.norm(P - self.head_c, axis=-1) - self.head_r) - .05
        return lb < body + self.neck_k

    def _join_head(self, P, body, shapes):
        out = body.copy()
        m = self._head_needed(P, body)
        if m.any():
            out[m] = smin(body[m], pb.head_sdf(P[m], shapes), self.neck_k)
        return out

    def core(self, P, body=None):
        body = self.body_part(P, 'core') if body is None else body
        return self._join_head(P, body, self.head)

    def scalp_sdf(self, P, body=None):
        body = self.body_part(P, 'core') if body is None else body
        return self._join_head(P, body, self.scalp)

    # --- garments and hair (GARMENT_VEX ports) -----------------------------------------------------------------
    def hairline(self, L, keys):
        k = np.asarray(keys); n = len(k)
        t = np.clip(np.degrees(np.arctan2(np.abs(L[..., 0]), L[..., 2] - .005)) / 180.0, 0, 1) * (n - 1)
        i = np.minimum(np.floor(t).astype(int), n - 2); u = t - i
        p0 = k[np.where(i == 0, 1, i - 1)]; p1 = k[i]; p2 = k[i + 1]; p3 = k[np.where(i + 2 > n - 1, n - 2, i + 2)]
        h = .5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
        return h * .001 - L[..., 1]

    def earcuts(self, d, L, t):
        for sd in (-1.0, 1.0):
            d = smax(d, -sdell(L - [sd * (self.HW + .004), 0, -.015], (.026, .042, .03)), t)
        return d

    def garment(self, P, part, core=None):
        H, SH = self.H, self.SH
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        if part == 'jersey':
            body = self.core(P) if core is None else core
            q = P - [0, .55 * H, .004 * H]; q = q * [1, 1, 1 / .64]
            drape = roundcone(q, .084 * H, .095 * H * SH ** .25, .2 * H)
            d = smin(body - .007, drape, .02)
            d = smax(d, .545 * H - y, .004)
            d = smax(d, y - .875 * H, .004)
            for sd in (-1.0, 1.0):
                d = smax(d, -sdell(P - [sd * .118 * H * SH, .762 * H, -.006 * H], (.05 * H, .072 * H, .075 * H)), .006)
            d = smax(d, -sdell(P - [0, .835 * H, .03 * H], (.048 * H, .06 * H, .06 * H)), .005)
            d = smax(d, -sdell(P - [0, .85 * H, -.035 * H], (.045 * H, .035 * H, .05 * H)), .005)
            return smax(d, -(body + .004), .002)
        if part == 'shorts':
            body = self.core(P) if core is None else core
            d = body - .012
            for sd in (-1.0, 1.0):
                d = smin(d, roundcone(P - [sd * .057 * H, .33 * H, .004 * H], .061 * H, .058 * H, .2 * H), .015)
            wq = (P - [0, .522 * H, .004 * H]) * [1, 1, 1 / .66]
            d = smin(d, roundcone(wq, .088 * H, .09 * H * SH ** .25, .055 * H), .01)
            d = smax(d, -sdell(P - [0, .325 * H, .004 * H], (.011 * H, .13 * H, .2 * H)), .006)
            d = smax(d, .325 * H - y, .004)
            d = smax(d, y - .578 * H, .004)
            d = d - .0018 * np.sin(np.arctan2(z, x) * 18.0) * smooth(.53 * H, .57 * H, y)
            return smax(d, -(body + .004), .002)
        if part == 'shoes':
            d = None
            for sd in (-1.0, 1.0):
                q = P - [sd * .045 * H, .026 * H, -.022 * H]
                qq = np.stack([q[..., 0], q[..., 2], q[..., 1] / .72], -1)
                foot = roundcone(qq, .028 * H, .024 * H, .132 * H)
                collar = roundcone(P - [sd * .044 * H, .02 * H, -.01 * H], .033 * H, .029 * H, .06 * H)
                s = smin(foot, collar, .02)
                d = s if d is None else smin(d, s, .001)
            return smax(d, -y, .002)
        L = P - self.HO
        if part in ('hair_buzz', 'hair_rows', 'hair_crop'):
            scalp = self.scalp_sdf(P)
            if part == 'hair_buzz':
                d = scalp - .0035; t = .003
            elif part == 'hair_crop':
                d = scalp - (.004 + .011 * smooth(-.005, .105, L[..., 1])); t = .004
            else:
                ridge = np.maximum(0.0, np.sin(L[..., 0] / .036 * 3.14159))
                d = scalp - (.0035 + .0045 * ridge); t = .003
            d = smax(d, self.hairline(L, HAIRLINES[part]), t)
            return self.earcuts(d, L, .003)
        if part == 'hair_afro':
            head = self.core(P) if core is None else core
            d = smin(head - .022, sdell(L - [0, .058, -.014], (self.HW + .0675, .125, .145)), .035)
            d = d - .0008 * np.sin(L[..., 0] * 420.0) * np.sin(L[..., 1] * 400.0) * np.sin(L[..., 2] * 440.0)
            return smax(d, (.087 - .70 * (.088 - L[..., 2])) - L[..., 1], .008)
        if part == 'headband':
            d = self.scalp_sdf(P) - .007
            lo = .044 + .15 * L[..., 2]
            d = smax(d, lo - L[..., 1], .002)
            return smax(d, L[..., 1] - (lo + .028), .002)
        if part == 'sleeve_arm':
            d = self.body_part(P, 'arm_R') - .0035
            d = smax(d, .505 * H - y, .003)
            return smax(d, y - .745 * H, .003)
        if part == 'sleeve_leg':
            d = (self.core(P) if core is None else core) - .0035
            d = smax(d, .105 * H - y, .003)
            d = smax(d, y - .315 * H, .003)
            return smax(d, .015 * H - x, .002)
        raise KeyError(part)

    # --- public -------------------------------------------------------------------------------------------
    def sdf(self, part, P):
        """The base SDF of one part (what Houdini meshes)."""
        P = np.asarray(P, float)
        if part == 'core': return self.core(P)
        if part in ('arm_L', 'arm_R'): return self.body_part(P, part)
        return self.garment(P, part)

    def local(self, part, P):
        """p_local for the detail functions: head-local metres for hair and the headband (heads do not scale with height),
        otherwise body fractions (x / (H * shoulder), y / H, z / H), so one detail function fits every variant."""
        if part.startswith('hair_') or part == 'headband':
            return P - self.HO
        return P / [self.H * self.SH, self.H, self.H]

    def sdf_hi(self, part, P, n):
        """The high-detail SDF: base minus the part's detail displacement (metres, + = outward). n is the low-poly normal
        along which the texel searches; it is held fixed for one texel, so finite differences see only P."""
        d = self.sdf(part, P)
        if self.detail is not None:
            d = d - self.detail(part, self.local(part, P), n, self)
        return d

    def scene(self, P, parts=AO_OCCLUDERS, hi_part=None, n=None):
        """Union (hard min) of several parts, for ambient occlusion. The core is evaluated once and shared by the garments
        that are offsets of it. hi_part (with n) uses its high-detail SDF, so baked grooves get their cavity AO."""
        P = np.asarray(P, float)
        body = self.body_part(P, 'core')
        core = None; d = None
        for part in parts:
            if part == 'core' or part in ('jersey', 'shorts', 'hair_afro', 'sleeve_leg'):
                core = self._join_head(P, body, self.head) if core is None else core
            if part == 'core': s = core
            elif part in ('arm_L', 'arm_R'): s = self.body_part(P, part)
            else: s = self.garment(P, part, core=core)
            if part == hi_part and self.detail is not None:
                s = s - self.detail(part, self.local(part, P), n, self)
            d = s if d is None else np.minimum(d, s)
        return d


def gradient(f, P, eps=2.5e-4):
    """Tetrahedral finite-difference gradient of f at P (..., 3): 4 evaluations. Returns the normalised gradient."""
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    g = np.zeros_like(P)
    for kk in k:
        g = g + kk * f(P + kk * eps)[..., None]
    return g / np.maximum(np.linalg.norm(g, axis=-1, keepdims=True), 1e-12)
