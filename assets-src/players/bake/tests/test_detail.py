"""Tests for the production detail functions (assets-src/players/bake/detail.py) and the local-frame parts in sdf_hi.

Run from the repo root:  python3 -m unittest discover assets-src/players/bake/tests
"""
import importlib, math, os, sys, unittest
import numpy as np

BAKE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BAKE)
import detail as dt  # noqa: E402
import mesh_uv, sdf_hi, standins  # noqa: E402

OBJ = os.path.join(os.path.dirname(BAKE), 'houdini', 'export', 'kangs_guard.obj')
MM = 1e-3
LOCAL_PARTS = ('hand_L', 'hand_R', 'shoe_L', 'shoe_R')


def rotation(seed):
    q = np.random.default_rng(seed).normal(size=4); q /= np.linalg.norm(q)
    w, x, y, z = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


class Fixture:
    """The guard's SDF, its OBJ surface points per group (p_local, n in the same axes) and stand-in surfaces for the
    parts D1 is building, registered as local parts at a random placement."""
    _done = None

    @classmethod
    def get(cls):
        if cls._done: return cls._done
        f = cls()
        f.S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), 'guard', dt.detail)
        pos, vt, vn, tris = mesh_uv.read_obj(OBJ)
        pts = {}
        for cs, g, _ in tris:
            for pi, _, ni in cs: pts.setdefault(g, {})[pi] = ni
        f.surf = {}
        for g, d in pts.items():
            ids = np.array(sorted(d)); P = pos[ids]; N = vn[[d[i] for i in ids]]
            N = N / np.linalg.norm(N, axis=1, keepdims=True)
            f.surf[g] = (f.S.local(g, P), f.S.local_dir(g, N, P), P, N)
        H = f.S.H
        f.hand = dt.HandLayout.anatomical(H); f.shoe = dt.ShoeLayout.for_height(H)
        f.hand_f = standins.hand_sdf(f.hand); f.shoe_f = standins.shoe_sdf(f.shoe); f.afro_f = standins.afro_sdf()
        hp, hn = standins.surface_points(f.hand_f, [-.07, -.03, -.05], [.08, .24, .04], 6000, 1)
        sp, sn = standins.surface_points(f.shoe_f, [-.07, -.002, -.01], [.07, .2, .36], 6000, 2)
        ap, an = standins.surface_points(f.afro_f, [-.2, -.05, -.2], [.2, .25, .2], 6000, 3)
        R = rotation(7)
        for name, fn, o, ax in (('hand_L', f.hand_f, [.25, .9, .02], R), ('hand_R', f.hand_f, [-.25, .9, .02], R @ np.diag([-1.0, 1, 1])),
                                ('shoe_L', f.shoe_f, [.09, 0, -.1], np.eye(3)), ('shoe_R', f.shoe_f, [-.09, 0, -.1], np.diag([-1.0, 1, 1]))):
            f.S.add_local_part(name, fn, o, ax)
        for g, (p, n) in (('hand_L', (hp, hn)), ('hand_R', (hp, hn)), ('shoe_L', (sp, sn)), ('shoe_R', (sp, sn))):
            lp = f.S.local_parts[g]
            f.surf[g] = (p, n, lp.to_body(p), n @ lp.axes)
        f.surf['hair_afro_standin'] = (ap, an, ap + f.S.HO, an)
        cls._done = f
        return f


class Registry(unittest.TestCase):
    def test_every_visible_part_has_detail(self):
        for part in ('core', 'arm_L', 'arm_R', 'jersey', 'shorts', 'sleeve_arm', 'sleeve_leg', 'headband', 'shoes',
                     'hair_buzz', 'hair_crop', 'hair_rows', 'hair_afro', 'hand_L', 'hand_R', 'shoe_L', 'shoe_R'):
            self.assertTrue(dt.DETAILS.get(part), part)

    def test_metadata(self):
        for fn in dt.FUNCTIONS:
            lo, hi = fn.box
            self.assertTrue((lo < hi).all(), fn.__name__)
            self.assertTrue(0 < fn.max_mm <= 3.0, fn.__name__)
            self.assertIn(fn.kind, ('groove', 'vein', 'fold', 'seam', 'rib', 'hair', 'nail', 'lace', 'perforation'), fn.__name__)


class Support(unittest.TestCase):
    """Each function is zero away from its region: exactly 0 outside its box, and already ~0 at the box's faces."""

    def test_zero_outside_box(self):
        F = Fixture.get(); rng = np.random.default_rng(1)
        for fn in dt.FUNCTIONS:
            lo, hi = fn.box; span = hi - lo
            p = rng.uniform(lo - span, hi + span, (20000, 3))
            out = ~((p >= lo) & (p <= hi)).all(1)
            n = rng.normal(size=p.shape); n /= np.linalg.norm(n, axis=1, keepdims=True)
            for part in fn.parts:
                v = fn(part, p[out], n[out], F.S)
                self.assertEqual(np.abs(v).max(), 0.0, '%s on %s' % (fn.__name__, part))

    def test_fades_out_at_the_box_faces(self):
        """No seams where the support ends: within a thin shell inside each face of the box the value is tiny."""
        F = Fixture.get(); rng = np.random.default_rng(2)
        for fn in dt.FUNCTIONS:
            lo, hi = fn.box; eps = (hi - lo) * .002
            for part in fn.parts:
                surf = F.surf.get(part) or F.surf.get('hair_afro_standin')
                p, n = surf[0], surf[1]
                inside = ((p >= lo) & (p <= hi)).all(1)
                near = inside & ((np.abs(p - lo) < eps) | (np.abs(p - hi) < eps)).any(1)
                if near.any():
                    self.assertLess(np.abs(fn(part, p[near], n[near], F.S)).max(), 1e-5, '%s on %s' % (fn.__name__, part))

    def test_zero_far_from_region(self):
        """Spot checks on the real surface, well away from where each piece of detail belongs."""
        F = Fixture.get(); S = F.S
        def vals(fn, part, mask):
            p, n = F.surf[part][0], F.surf[part][1]
            return fn(part, p[mask(p)], n[mask(p)], S)
        checks = [
            (dt.forearm_veins, 'arm_L', lambda p: p[:, 1] > .66),                  # veins: forearm only
            (dt.arm_muscles, 'arm_L', lambda p: p[:, 1] < .46),                    # nothing on the (hidden) paddle hand
            (dt.leg_muscles, 'core', lambda p: p[:, 1] > .36),                     # legs: below the shorts only
            (dt.neck_clavicle, 'core', lambda p: (p[:, 1] < .76) | (p[:, 1] > .97)),
            (dt.jersey_drape, 'jersey', lambda p: (p[:, 1] > .8) & (np.abs(p[:, 0]) < .03)),   # the chest under the collar
            (dt.shorts_folds, 'shorts', lambda p: p[:, 1] < .3355),             # not in the hem band
            (dt.sleeve_knit, 'sleeve_arm', lambda p: (p[:, 1] < .5052) | (p[:, 1] > .7448)),   # the cut ends
            (dt.shoe_laces, 'shoe_L', lambda p: p[:, 2] < .25 * F.shoe.length),     # no laces on the heel
            (dt.shoe_perfs, 'shoe_L', lambda p: p[:, 2] < .6 * F.shoe.length),      # perforations: toe box only
            (dt.hand_nails, 'hand_L', lambda p: p[:, 1] < .07),                     # nails: not on the palm or wrist
            (dt.hand_knuckles, 'hand_L', lambda p: p[:, 2] < -.012),                # knuckles: the back of the hand
        ]
        for fn, part, mask in checks:
            v = vals(fn, part, mask)
            self.assertGreaterEqual(len(v), 10, fn.__name__)
            self.assertLess(np.abs(v).max(), 1e-6, '%s on %s' % (fn.__name__, part))


class Amplitude(unittest.TestCase):
    """Physical amplitudes: within each function's declared maximum (at most 3 mm), and each one does something."""

    def test_bounds_on_the_surface(self):
        F = Fixture.get()
        for fn in dt.FUNCTIONS:
            for part in fn.parts:
                key = part if part in F.surf else 'hair_afro_standin'
                if part == 'hair_afro': key = 'hair_afro_standin'
                p, n = F.surf[key][0], F.surf[key][1]
                v = fn(part, p, n, F.S)
                self.assertLessEqual(np.abs(v).max(), fn.max_mm * MM + 1e-9, '%s on %s: %.2f mm' % (fn.__name__, part, np.abs(v).max() / MM))
                if part not in ('shoes',):      # today's shoes are too round for the lace / perforation gates everywhere
                    self.assertGreater(np.abs(v).max(), .25 * fn.max_mm * MM, '%s on %s does nothing (%.3f mm)' % (fn.__name__, part, np.abs(v).max() / MM))

    def test_bounds_anywhere_in_the_box(self):
        """Off the surface too (the bake searches +-8 mm and the AO marches outward), with any normal."""
        F = Fixture.get(); rng = np.random.default_rng(3)
        for fn in dt.FUNCTIONS:
            lo, hi = fn.box
            p = rng.uniform(lo, hi, (40000, 3))
            n = rng.normal(size=p.shape); n /= np.linalg.norm(n, axis=1, keepdims=True)
            for part in fn.parts:
                self.assertLessEqual(np.abs(fn(part, p, n, F.S)).max(), 3 * MM + 1e-9, fn.__name__)

    def test_stitches(self):
        e = np.linspace(-3, 3, 601) * MM
        along = np.linspace(0, 20, 601)[:, None] * MM
        v = dt.stitch_row(e[None, :], along, 0.0)
        self.assertTrue(.3 * MM <= np.abs(v).max() <= .5 * MM)
        self.assertLess(np.abs(dt.stitch_row(np.array([5 * MM]), np.array([0.0]), 0.0)).max(), 1e-6)

    def test_slopes(self):
        """Detail is a gentle relief, not noise: the displacement's slope along the surface stays under 1 (45 degrees)."""
        F = Fixture.get()
        for fn in dt.FUNCTIONS:
            for part in fn.parts:
                key = 'hair_afro_standin' if part == 'hair_afro' else part
                if key not in F.surf: continue
                p, n = F.surf[key][0][:3000], F.surf[key][1][:3000]
                metres = part in LOCAL_PARTS or part.startswith('hair') or part in ('headband', 'shoes')
                scale = np.ones(3) if metres else np.array([F.S.H * F.S.SH, F.S.H, F.S.H])
                h = .1 * MM
                g = np.stack([(fn(part, p + e / scale, n, F.S) - fn(part, p - e / scale, n, F.S)) / (2 * h) for e in np.eye(3) * h], -1)
                g = g - (g * n).sum(1, keepdims=True) * n          # along the surface: what shading sees
                slope = np.linalg.norm(g, axis=1)
                self.assertLess(np.percentile(slope, 99.5), 1.0, '%s on %s: slope p99.5 %.2f' % (fn.__name__, part, np.percentile(slope, 99.5)))


def band_fraction(sig, skip=3, band=2):
    """Share of a line profile's power in the +-band frequency bins round its strongest frequency, leaving out the `skip`
    lowest frequencies (the slow change from front to side). A regular rib puts nearly all of its power in one band."""
    s = np.asarray(sig) - np.mean(sig)
    P = (np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2)[skip + 1:]
    k = P.argmax()
    return P[max(0, k - band):k + band + 1].sum() / P.sum()

def crests(sig):
    """Number of crests (local maxima above the mean), the CV of their heights and the CV of their spacing."""
    s = np.asarray(sig) - np.mean(sig)
    k = np.where((s[1:-1] > s[:-2]) & (s[1:-1] > s[2:]) & (s[1:-1] > .05 * np.abs(s).max()))[0] + 1
    sp = np.diff(k)
    return len(k), (np.std(s[k]) / np.mean(s[k]) if len(k) > 1 else 0.0), (np.std(sp) / np.mean(sp) if len(sp) > 1 else 0.0)


def proto_jersey_folds(th, y):
    """The prototype's waist folds (bc0d3e1), as a control: the irregularity checks must reject it."""
    ph = 2 * np.pi * (y - .575) / .017 + .9 * np.sin(2 * th + .7) + .5 * np.sin(5 * th + 2.0)
    a = .0018 * dt.smooth(.565, .58, y) * dt.smooth(.665, .605, y) * (.65 + .35 * np.sin(3 * th + 1.3))
    return a * (np.sin(ph) + .3 * np.sin(2 * ph + 1.0)) / 1.3


class Irregularity(unittest.TestCase):
    """Folds read as cloth, not ribbing: along lines through them no single frequency holds most of the power, and the
    crests differ in height and spacing. The prototype's waist folds are the control the checks must reject."""

    def ring(self, fn, part, y, r=.11, z_scale=.66, n=2048):
        S = Fixture.get().S
        th = np.linspace(-np.pi, np.pi, n, endpoint=False)
        P = np.stack([r * np.cos(th) / S.SH, np.full_like(th, y), z_scale * r * np.sin(th)], -1)     # body fractions
        return fn(part, P, None, S)

    def column(self, fn, part, th, y0, y1, r=.11, z_scale=.66):
        S = Fixture.get().S
        y = np.linspace(y0, y1, 1024)
        P = np.stack([np.full_like(y, r * math.cos(th) / S.SH), y, np.full_like(y, z_scale * r * math.sin(th))], -1)
        return fn(part, P, None, S)

    def assertIrregular(self, v, what, band_max=.5, min_crests=5):
        n, hcv, scv = crests(v)
        self.assertGreater(np.abs(v).max(), .4 * MM, what)
        self.assertGreaterEqual(n, min_crests, what)
        self.assertLess(band_fraction(v), band_max, '%s: one frequency band holds %.2f of the power' % (what, band_fraction(v)))
        self.assertGreater(hcv, .3, '%s: crest heights too even (CV %.2f)' % (what, hcv))
        self.assertGreater(scv, .3, '%s: crest spacing too even (CV %.2f)' % (what, scv))

    def test_control_is_rejected(self):
        y = np.linspace(.575, .665, 1024)
        for t in np.linspace(-3, 3, 7):
            c = proto_jersey_folds(np.full_like(y, t), y)
            self.assertGreater(band_fraction(c, skip=1), .85)
            self.assertLess(crests(c)[2], .05)              # evenly spaced crests: what test_jersey_columns rejects
            with self.assertRaises(AssertionError):
                self.assertIrregular(c, 'control')

    def test_jersey_waist_rings(self):
        for y in (.585, .6, .62, .64):
            self.assertIrregular(self.ring(dt.jersey_drape, 'jersey', y), 'jersey ring at %.3f H' % y)

    def test_jersey_columns(self):
        """Up the front, sides and back through the waist folds: the crests are unevenly spaced (pooled over all the
        columns; the control's spacing is uniform) and no column is a rib."""
        spacings, bands = [], []
        for th in np.linspace(-3, 3, 25):
            v = self.column(dt.jersey_drape, 'jersey', th, .576, .7)
            if np.abs(v).max() < .3 * MM: continue
            s = v - v.mean()
            k = np.where((s[1:-1] > s[:-2]) & (s[1:-1] > s[2:]) & (s[1:-1] > .05 * np.abs(s).max()))[0]
            spacings += list(np.diff(k)); bands.append(band_fraction(v, skip=1))
        self.assertGreater(len(bands), 18)
        self.assertGreater(len(spacings), 25)
        self.assertGreater(np.std(spacings) / np.mean(spacings), .4)
        self.assertLess(np.median(bands), .85)

    def test_armhole_drape(self):
        """Round the side under the armpit the drape folds differ in spacing and depth."""
        S = Fixture.get().S
        th = np.linspace(-1.2, 1.2, 1024)
        for y in (.655, .665):
            P = np.stack([.12 * np.cos(th) / S.SH, np.full_like(th, y), .66 * .12 * np.sin(th)], -1)
            self.assertIrregular(dt.jersey_drape('jersey', P, None, S), 'armhole drape at %.2f H' % y, band_max=.6, min_crests=4)

    def test_shorts(self):
        S = Fixture.get().S
        self.assertIrregular(self.ring(dt.shorts_folds, 'shorts', .572 - .016 / S.H, r=.12, n=4096), 'waistband gathers')
        for y in (.35, .42):
            ph = np.linspace(-np.pi, np.pi, 2048, endpoint=False)
            P = np.stack([(.057 + .06 * np.cos(ph)) / S.SH, np.full_like(ph, y), .004 + .06 * np.sin(ph)], -1)
            self.assertIrregular(dt.shorts_folds('shorts', P, None, S), 'shorts leg at %.2f H' % y)

    def test_afro_is_not_a_lattice(self):
        S = Fixture.get().S
        t = np.linspace(0, 2 * np.pi, 4096, endpoint=False)
        p = standins.AFRO_C + .15 * np.stack([np.cos(t), .3 * np.ones_like(t), np.sin(t)], -1) / np.sqrt(1.09)
        self.assertIrregular(dt.afro_curl('hair_afro', p, None, S), 'afro', band_max=.35)


class Frames(unittest.TestCase):
    """Local-frame parts: the detail is written once in the local frame and comes out the same wherever (and however
    mirrored) the part is placed."""

    def test_sdf_hi_is_the_local_sdf_minus_local_detail(self):
        F = Fixture.get(); S = F.S
        for part in LOCAL_PARTS:
            p, n, P, N = F.surf[part]
            lp = S.local_parts[part]
            np.testing.assert_allclose(lp.to_local(P), p, atol=1e-12)
            want = lp.sdf_local(p) - dt.detail(part, p, n, S)
            np.testing.assert_allclose(S.sdf_hi(part, P, N), want, atol=1e-12)
            self.assertGreater(np.abs(dt.detail(part, p, n, S)).max(), .5 * MM, part)

    def test_same_detail_under_any_placement(self):
        F = Fixture.get(); S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), 'guard', dt.detail)
        p, n = F.surf['hand_L'][0], F.surf['hand_L'][1]
        vals = []
        for seed, o in ((1, [.3, .8, .1]), (2, [-.1, 1.2, -.3]), (3, [0, 0, 0])):
            R = rotation(seed)
            lp = S.add_local_part('hand_L', F.hand_f, o, R)
            P = lp.to_body(p); N = n @ R
            vals.append((S.sdf_hi('hand_L', P, N), S.sdf('hand_L', P)))
        for a, b in zip(vals[1:], vals[:-1]):
            np.testing.assert_allclose(a[0], b[0], atol=1e-12); np.testing.assert_allclose(a[1], b[1], atol=1e-12)

    def test_mirrored_hand_is_the_mirror_image(self):
        F = Fixture.get(); S = F.S
        L, R = S.local_parts['hand_L'], S.local_parts['hand_R']
        p, n = F.surf['hand_L'][0], F.surf['hand_L'][1]
        PL, NL = L.to_body(p), n @ L.axes
        M = np.diag([-1.0, 1, 1])
        PR, NR = PL @ M, NL @ M                        # hand_R is placed as the mirror of hand_L in x
        np.testing.assert_allclose(R.to_local(PR), p, atol=1e-12)
        np.testing.assert_allclose(S.sdf_hi('hand_R', PR, NR), S.sdf_hi('hand_L', PL, NL), atol=1e-12)
        self.assertLess(np.linalg.det(R.axes), 0)

    def test_normals_transform_with_the_frame(self):
        F = Fixture.get(); S = F.S
        for part in ('hand_L', 'hand_R', 'shoe_R'):
            p, n, P, N = F.surf[part]
            lp = S.local_parts[part]
            # a tiny stencil; the stand-ins' smooth blends are only C1, so a stencil turned with the frame straddles
            # their curvature jumps differently: agree to 0.2 degrees (the values themselves agree to 1e-12 above)
            gl = sdf_hi.gradient(lambda q: lp.sdf_local(q) - dt.detail(part, q, n[:500], S), p[:500], eps=2e-6)
            gb = sdf_hi.gradient(lambda Q: S.sdf_hi(part, Q, N[:500]), P[:500], eps=2e-6)
            np.testing.assert_allclose(gb, gl @ lp.axes, atol=3.5e-3)

    def test_current_shoes_use_shoe_local_frames(self):
        """Today's two-foot 'shoes' part reads the same detail in each foot's frame: the right foot mirrors the left."""
        F = Fixture.get(); S = F.S
        p, n, P, N = F.surf['shoes']
        left = P[:, 0] > 0
        PL, NL = P[left], N[left]
        M = np.array([-1.0, 1, 1])
        a = S.detail_at('shoes', PL, NL); b = S.detail_at('shoes', PL * M, NL * M)
        np.testing.assert_allclose(a, b, atol=1e-12)
        self.assertGreater(np.abs(a).max(), .5 * MM)
        loc = S.local('shoes', P)
        self.assertGreater(loc[:, 2].min(), -.01); self.assertLess(loc[:, 2].max(), .2 * S.H)
        self.assertGreater(loc[:, 1].min(), -.001)

    def test_afro_detail_is_head_local(self):
        F = Fixture.get(); spec = sdf_hi.load_spec()
        a, b = sdf_hi.PlayerSDF(spec, 'guard', dt.detail), sdf_hi.PlayerSDF(spec, 'center', dt.detail)
        p = F.surf['hair_afro_standin'][0]
        np.testing.assert_allclose(a.detail_at('hair_afro', p + a.HO, None), b.detail_at('hair_afro', p + b.HO, None), atol=1e-12)


class Determinism(unittest.TestCase):
    def test_reload_gives_the_same_values(self):
        F = Fixture.get()
        samples = {g: F.surf[g] for g in ('jersey', 'shorts', 'arm_L', 'hair_rows', 'hand_L', 'shoe_L')}
        before = {g: dt.detail(g, s[0], s[1], F.S) for g, s in samples.items()}
        importlib.reload(dt)
        after = {g: dt.detail(g, s[0], s[1], F.S) for g, s in samples.items()}
        for g in samples:
            np.testing.assert_array_equal(before[g], after[g], g)

    def test_veins_differ_between_arms(self):
        F = Fixture.get(); S = F.S
        p, n = F.surf['arm_L'][0], F.surf['arm_L'][1]
        a = dt.forearm_veins('arm_L', p, n, S)
        b = dt.forearm_veins('arm_R', p * [-1, 1, 1], n * [-1, 1, 1], S)
        self.assertGreater(np.abs(a - b).max(), .2 * MM)


class BakeHook(unittest.TestCase):
    def test_sdf_hi_matches_the_mesh_with_detail(self):
        """The detail stays small next to the mesh: the high-detail surface is within the bake's +-8 mm search of the
        Houdini vertices (median under 2 mm)."""
        F = Fixture.get(); S = F.S
        for g in ('core', 'arm_L', 'jersey', 'shorts', 'hair_rows', 'hair_afro', 'headband', 'sleeve_arm', 'shoes'):
            P, N = F.surf[g][2], F.surf[g][3]
            d = np.abs(S.sdf_hi(g, P, N))
            self.assertLess(np.median(d), 2 * MM, g); self.assertLess(np.percentile(d, 99), 7 * MM, g)


if __name__ == '__main__':
    unittest.main()
