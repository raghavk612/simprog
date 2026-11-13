"""Tests for the cloud-meshed hands, sneakers and afro (assets-src/players/cloudmesh).

    python3 -m unittest discover assets-src/players/cloudmesh/tests        (about a minute: it meshes every part)
"""
import json, math, os, sys, unittest
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PLAYERS = os.path.dirname(os.path.dirname(HERE))
ROOT = os.path.dirname(os.path.dirname(PLAYERS))
sys.path.insert(0, PLAYERS)
import cloudmesh as cm  # noqa: E402
from cloudmesh import hand, shoe, afro, mesher  # noqa: E402
from cloudmesh.prims import capsule, to_local  # noqa: E402

VARIANTS = ('guard', 'forward', 'center')
UNITS_PER_M = 0.3306 / 0.3048
OLD = {'shoes': 930, 'hair_afro': 1440}   # the Houdini parts these replace (triangles, the largest variant)


def H(v): return cm._v(v)['height_m']


class Primitives(unittest.TestCase):
    def test_capsule_is_an_exact_distance(self):
        P = np.random.default_rng(1).uniform(-.2, .2, (500, 3))
        d = capsule(P, (0, -.05, 0), (0, .05, 0), .03)
        ref = np.hypot(np.hypot(P[:, 0], P[:, 2]), np.maximum(np.abs(P[:, 1]) - .05, 0)) - .03
        self.assertLess(np.abs(d - ref).max(), 1e-9)
        self.assertLess(np.abs(capsule(P, (0, 0, 0), (0, 0, 0), .04) - (np.linalg.norm(P, axis=1) - .04)).max(), 1e-12)


class Frames(unittest.TestCase):
    def test_hand_frames(self):
        for v in VARIANTS:
            J = cm.joints(v)
            for side, sx in (('L', 1), ('R', -1)):
                o, R = cm.part_frame(v, 'hand_' + side)
                self.assertTrue(np.allclose(R.T @ R, np.eye(3), atol=1e-12))
                self.assertAlmostEqual(np.linalg.det(R), 1.0 if side == 'L' else -1.0, places=9)   # the right hand is a mirror
                self.assertTrue(np.allclose(o, J['wrist_' + side]))
                y = J['hand_end_' + side] - o
                self.assertGreater(R[:, 1] @ y / np.linalg.norm(y), .9999)       # +y toward the fingertips
                self.assertGreater(R[:, 2][0] * sx, .99)                         # +z dorsal: away from the body
                self.assertGreater(R[:, 0][2], .99)                              # +x thumb: forward

    def test_shoe_frames(self):
        for v in VARIANTS:
            for side, sx in (('L', 1), ('R', -1)):
                o, R = cm.part_frame(v, 'shoe_' + side)
                self.assertEqual(o[1], 0.0)
                self.assertTrue(np.allclose(R, np.diag([sx, 1, 1])))
                self.assertAlmostEqual(o[0], sx * shoe.FOOT_X * H(v))

    def test_afro_frame_is_the_head_frame(self):
        for v in VARIANTS:
            o, R = cm.part_frame(v, 'hair_afro')
            self.assertTrue(np.allclose(o, cm.head_origin(v)) and np.allclose(R, np.eye(3)))


class Meshes(unittest.TestCase):
    def test_triangle_counts(self):
        for v in VARIANTS:
            for side in 'LR':
                n = len(cm.part_mesh(v, 'hand_' + side)['F'])
                self.assertTrue(600 <= n <= 800, '%s hand_%s %d' % (v, side, n))
            shoes = sum(len(cm.part_mesh(v, 'shoe_' + s)['F']) for s in 'LR')
            self.assertTrue(700 <= shoes <= OLD['shoes'], '%s shoes %d' % (v, shoes))
            n = len(cm.part_mesh(v, 'hair_afro')['F'])
            self.assertTrue(1000 <= n <= OLD['hair_afro'], '%s afro %d' % (v, n))

    def test_closed_manifold(self):
        """Every part as meshed is closed, consistently wound outward, one piece with no handles (fingers that touched at
        the tips would make a loop: Euler characteristic 0)."""
        for v in VARIANTS:
            meshes = {'hand': cm._hand_local_mesh(v, cm._hand_target(v)), 'upper': cm._shoe_local_mesh(v, 'upper', cm._shoe_target(v, 'upper')),
                      'sole': cm._shoe_local_mesh(v, 'sole', cm._shoe_target(v, 'sole')), 'afro': cm._afro_mesh(v)}
            for name, (V, F, N) in meshes.items():
                self.assertTrue(mesher.is_watertight(F), '%s %s watertight' % (v, name))
                self.assertTrue(mesher.is_vertex_manifold(F, len(V)), '%s %s vertex manifold' % (v, name))
                self.assertEqual(mesher.euler_genus(V, F), 2, '%s %s is one sphere-like piece' % (v, name))
                self.assertGreater(mesher.signed_volume(V, F), 0, '%s %s faces point outward' % (v, name))

    def test_meshes_lie_on_their_sdf(self):
        """The bake searches along the normal for part_sdf's zero: the mesh must sit on it."""
        for v in VARIANTS:
            for name in cm.PARTS:
                m = cm.part_mesh(v, name)
                if name.startswith('shoe'):
                    o, R = cm.part_frame(v, name)
                    up = np.unique(m['F'][m['component'] == 'upper']); so = np.unique(m['F'][m['component'] == 'sole'])
                    d = np.concatenate([shoe.upper_sdf(to_local(m['V'][up], o, R), H(v)),
                                        shoe.sole_sdf(to_local(m['V'][so], o, R), H(v))])
                else:
                    d = cm.part_sdf(v, name, m['V'])
                self.assertLess(np.median(np.abs(d)), 3e-4, '%s %s median |sdf| %.5f' % (v, name, np.median(np.abs(d))))
                self.assertLess(np.abs(d).max(), 2.5e-3, '%s %s max |sdf| %.5f' % (v, name, np.abs(d).max()))
                # normals: the SDF gradient, unit, outward
                self.assertTrue(np.allclose(np.linalg.norm(m['N'], axis=1), 1, atol=1e-6))

    def test_shoe_parts_meet(self):
        """Upper and midsole are each closed; where they overlap the hidden faces go, so the shoe is two open surfaces whose
        borders lie on the other one (no gap to see through) and no edge has more than two faces."""
        for v in VARIANTS:
            m = cm.part_mesh(v, 'shoe_L'); o, R = cm.part_frame(v, 'shoe_L')
            u, c = mesher.edge_use(m['F'])
            self.assertTrue((c <= 2).all())
            border = u[c == 1]
            mid = to_local(m['V'][border].mean(1), o, R)
            on_other = np.minimum(np.abs(shoe.upper_sdf(mid, H(v))), np.abs(shoe.sole_sdf(mid, H(v))))
            inside_other = np.minimum(shoe.upper_sdf(mid, H(v)), shoe.sole_sdf(mid, H(v))) < .004
            self.assertTrue(inside_other.all(), '%s shoe border edges off the other part: %d' % (v, (~inside_other).sum()))
            self.assertGreater(len(border), 0)
            self.assertEqual(set(m['mat']), {'shoes', 'sole'})


class Hands(unittest.TestCase):
    def test_proportions(self):
        for v in VARIANTS:
            HL = hand.HAND_LENGTH * H(v)
            V = cm._hand_part(v)[0]
            # palm breadth across the knuckles about .45 HL
            band = V[np.abs(V[:, 1] - .5 * HL) < .02 * HL]
            self.assertTrue(.4 * HL < np.ptp(band[:, 0]) < .52 * HL, '%s palm breadth %.3f' % (v, np.ptp(band[:, 0]) / HL))
            # straightened, the middle finger reaches HL: its bones are .22/.15/.10 HL from a knuckle at .535 HL
            x, y, lf = hand.FINGERS['middle'][:3]
            self.assertAlmostEqual(y + sum(hand.SEGMENTS) * lf, 1.005, places=2)
            # the curl rises from the index to the little finger at every joint
            angles = [hand.FINGERS[n][5] for n in ('index', 'middle', 'ring', 'little')]
            for j in range(3): self.assertEqual([a[j] for a in angles], sorted(a[j] for a in angles))

    def test_fingers_are_separate(self):
        """Neighbouring fingers do not touch: a real gap (over 1.5 mm) between them from the middle of the first bone to the
        tips, which the 1.2 mm voxels resolve."""
        for v in VARIANTS:
            HL = hand.HAND_LENGTH * H(v)
            names = ('index', 'middle', 'ring', 'little')
            chains = {n: hand.finger_chain(n, HL) for n in names}
            for a, b in zip(names, names[1:]):
                (pa, ra), (pb, rb) = chains[a], chains[b]
                for t in np.linspace(.5, 3, 11):
                    i = min(int(t), 2); f = t - i
                    qa = pa[i] + (pa[i + 1] - pa[i]) * f; qb = pb[i] + (pb[i + 1] - pb[i]) * f
                    rra = ra[i] + (ra[i + 1] - ra[i]) * f; rrb = rb[i] + (rb[i + 1] - rb[i]) * f
                    gap = np.linalg.norm(qa - qb) - rra - rrb
                    self.assertGreater(gap, .0015, '%s %s-%s gap %.4f at %.1f' % (v, a, b, gap, t))
                    mid = (qa * rrb + qb * rra) / (rra + rrb)
                    self.assertGreater(float(hand.hand_local_sdf(mid[None], H(v))[0]), 0, '%s %s-%s fused' % (v, a, b))
            self.assertGreater(cm.VOXEL['hand'], 0)
            self.assertLessEqual(cm.VOXEL['hand'], .0015)

    def test_fingertip_clearance(self):
        """The ball rule of src/motion.js: a hand on the ball puts its wrist .13 + .07 (model units) from the ball's centre.
        Ball centres relative to the hand come from the game's own animation (ball_samples.mjs: dribble, hold, shot, every
        variant). No part of the hand mesh may come within 2 mm of the ball."""
        S = json.load(open(os.path.join(HERE, 'ball_samples.json')))
        r = S['ballRadius'] / UNITS_PER_M
        for v in VARIANTS:
            for side in 'LR':
                o, R = cm.part_frame(v, 'hand_' + side)
                V = (cm.part_mesh(v, 'hand_' + side)['V'] - o)       # rest-space offset from the wrist, metres
                for pose, sides in S['variants'][v].items():
                    q = np.array(sides[side]) / UNITS_PER_M
                    if not len(q): continue
                    self.assertGreater(np.linalg.norm(q, axis=1).min(), (S['ballRadius'] + .065) / UNITS_PER_M)   # the rule holds
                    c = np.linalg.norm(V[None] - q[:, None], axis=2).min() - r
                    self.assertGreater(c, .002, '%s hand_%s %s: %.1f mm from the ball' % (v, side, pose, c * 1000))

    def test_wrist(self):
        """The hand starts past the joint, where the forearm is all wrist-weighted (build_players chain_weights: elbow to
        wrist over +-.0075 H), and covers the forearm's cut edge: the forearm, as build_players reshapes it, lies inside the
        hand from HAND_START to ARM_CUT."""
        self.assertGreaterEqual(cm.HAND_START, 0)
        self.assertGreater(cm.ARM_CUT, cm.HAND_START)
        self.assertGreaterEqual(cm.ARM_CUT, .0075)
        for v in VARIANTS:
            o, R = cm.part_frame(v, 'hand_L'); h = H(v)
            g = np.linspace(-.08, .08, 81)
            for t in np.linspace(cm.HAND_START + .001, cm.ARM_CUT, 4) * h:
                X, Z = np.meshgrid(g, g); Q = np.stack([X.ravel(), np.full(X.size, t), Z.ravel()], -1)
                P = Q @ R.T + o
                arm = cm.arm_sdf(v, 'L', P) + cm.arm_inset(v, 'L', P)       # where build_players puts the forearm
                inside_arm = arm < 0
                self.assertTrue(inside_arm.any())
                self.assertTrue((cm.hand_sdf(v, 'L', P)[inside_arm] < 0).all(), '%s forearm pokes out of the hand at %.3f' % (v, t))
            # the forearm reshaping starts from the Houdini arm itself
            Q = np.array([[0, cm.ARM_BLEND * h - .01, 0.0]]); P = Q @ R.T + o
            self.assertAlmostEqual(float(cm.arm_sdf(v, 'L', P)[0]), float(cm._arm_sdf(v, 'L', P)[0]), places=9)

    def test_rigid_on_the_wrist(self):
        for v in VARIANTS:
            for side in 'LR':
                self.assertEqual(cm.part_mesh(v, 'hand_' + side)['weight'], 'wrist_' + side)

    def test_mirror(self):
        for v in VARIANTS:
            a, b = cm.part_mesh(v, 'hand_L'), cm.part_mesh(v, 'hand_R')
            self.assertTrue(np.allclose(a['V'] * [-1, 1, 1], b['V']))
            for m in (a, b):   # faces wound outward on both (the mirror frame flips the winding back)
                T = m['V'][m['F']]; fn = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
                self.assertGreater(((fn * m['N'][m['F']].sum(1)).sum(1) > 0).mean(), .99)


class Sneakers(unittest.TestCase):
    def profile(self, v, z_frac, x=0.0):
        """(bottom, top) of the midsole and the upper's top at a fraction of the shoe length, shoe-local metres."""
        h = H(v); SL = shoe.LENGTH * h
        ys = np.linspace(-.005, .16, 3301)
        Q = np.stack([np.full_like(ys, x), ys, np.full_like(ys, z_frac * SL)], -1)
        sole = ys[shoe.sole_sdf(Q, h) < 0]; up = ys[shoe.upper_sdf(Q, h) < 0]
        return sole.min(), sole.max(), (up.max() if len(up) else None)

    def test_stack_and_toe_spring(self):
        for v in VARIANTS:
            s = H(v) / shoe.REF_H            # the shoe's size against the 1.95 m reference
            lo, hi, _ = self.profile(v, .12)
            heel = (hi - lo) * 1000 / s
            lo2, hi2, _ = self.profile(v, .6)
            fore = (hi2 - lo2) * 1000 / s
            self.assertTrue(27 <= heel <= 33, '%s heel stack %.1f mm' % (v, heel))
            self.assertTrue(17 <= fore <= 23, '%s forefoot stack %.1f mm' % (v, fore))
            self.assertTrue(6 <= heel - fore <= 12, '%s drop %.1f mm' % (v, heel - fore))     # the heel is lifted
            self.assertLess(lo * 1000, .5)                                                     # flat on the floor
            toe = self.profile(v, .985)[0] * 1000 / s
            self.assertTrue(7 <= toe <= 13, '%s toe spring %.1f mm' % (v, toe))
            # the midsole is a band all round: thicker than the upper's edge, and flared past it
            for zf in (.15, .5, .75):
                SL = shoe.LENGTH * H(v)
                xs = np.linspace(0, .12, 1201); y = float(shoe.stack_top(np.array(zf * SL), SL, s / 1000)) - .004
                Q = np.stack([xs, np.full_like(xs, y), np.full_like(xs, zf * SL)], -1)
                xs_sole = xs[shoe.sole_sdf(Q, H(v)) < 0].max()
                Q[:, 1] += .008
                xs_up = xs[shoe.upper_sdf(Q, H(v)) < 0].max()
                self.assertGreater(xs_sole - xs_up, .002, '%s midsole flare at %.2f' % (v, zf))

    def test_collar_and_size(self):
        for v in VARIANTS:
            h = H(v); SL = shoe.LENGTH * h; mm = h / shoe.REF_H / 1000
            ankle_bone = .0413 * h
            # mid-top: the topline at the sides is at or just over the ankle bone; the heel tab and the tongue stand higher
            side = float(shoe.topline(np.array(.27 * SL), SL, mm))
            self.assertTrue(ankle_bone <= side <= ankle_bone + .03, '%s collar %.3f, ankle bone %.3f' % (v, side, ankle_bone))
            self.assertGreater(float(shoe.topline(np.array(.02 * SL), SL, mm)), side + .008)
            self.assertGreater(self.profile(v, .42)[2], side + .008)     # the tongue
            # the outsole is about 1.1 x the bare foot (.153 H) and covers the body's own foot
            self.assertTrue(1.08 <= shoe.LENGTH / .153 <= 1.15)
            V = cm.part_mesh(v, 'shoe_L')['V']
            self.assertTrue(.98 * SL <= np.ptp(V[:, 2]) <= 1.02 * SL)    # decimation rounds the toe and heel a little

    def test_covers_the_foot(self):
        """Every vertex of the Houdini body below the ankle bone is inside a shoe (the build drops those faces)."""
        sys.path.insert(0, os.path.join(ROOT, 'scripts'))
        import build_players as bp
        for v in VARIANTS:
            pos, _, _, faces = bp.read_obj(os.path.join(PLAYERS, 'houdini', 'export', 'kangs_%s.obj' % v))
            core = sorted({c[0] for f in faces if f[3] == 'core' for c in f[:3]})
            P = pos[core]; P = P[P[:, 1] < .04 * H(v)]
            self.assertGreater(len(P), 50)
            self.assertTrue(cm.shoe_covers(v, P).all(), '%s: %d foot vertices show' % (v, (~cm.shoe_covers(v, P)).sum()))


class Afro(unittest.TestCase):
    def outline(self, V, axes, n=72):
        """Silhouette radius per angle in a view plane (head-local), from the outline's centre."""
        a, b = V[:, axes[0]], V[:, axes[1]]
        c = np.array([(a.max() + a.min()) / 2, (b.max() + b.min()) / 2])
        ang = np.arctan2(b - c[1], a - c[0]); rad = np.hypot(a - c[0], b - c[1])
        bins = ((ang + np.pi) / (2 * np.pi) * n).astype(int) % n
        r = np.zeros(n)
        np.maximum.at(r, bins, rad)
        return r

    def test_clumps(self):
        for v in VARIANTS:
            cen, rad = afro.clumps(v)
            self.assertTrue(25 <= len(cen) <= 60)
            self.assertTrue(.01 < rad.min() and rad.max() <= .07)

    def test_irregular_outline(self):
        """The silhouette is not an ellipse: from the front and from above, the outline radius departs from a smooth
        (second-order Fourier) fit by over 1.5 % on average, and the left and right sides differ (asymmetric)."""
        for v in VARIANTS:
            o, _ = cm.part_frame(v, 'hair_afro')
            V = cm.part_mesh(v, 'hair_afro')['V'] - o
            for name, axes in (('front', (0, 1)), ('top', (0, 2))):
                r = self.outline(V, axes)
                ok = r > 0
                th = (np.arange(len(r)) + .5) / len(r) * 2 * np.pi - np.pi
                if name == 'front': ok &= np.sin(th) > -.2      # above the hairline only
                A = np.stack([np.ones_like(th), np.cos(th), np.sin(th), np.cos(2 * th), np.sin(2 * th)], 1)[ok]
                coef, *_ = np.linalg.lstsq(A, r[ok], rcond=None)
                resid = r[ok] - A @ coef
                rough = np.sqrt((resid ** 2).mean()) / r[ok].mean()
                self.assertTrue(.015 < rough < .1, '%s %s outline roughness %.3f' % (v, name, rough))
                mirror = r[(len(r) // 2 - 1 - np.arange(len(r))) % len(r)]      # angle pi - theta
                both = ok & (mirror > 0)
                asym = np.abs(r - mirror)[both].mean()
                self.assertGreater(asym, .003, '%s %s left/right difference %.4f m' % (v, name, asym))

    def test_hairline(self):
        """No hair below the hairline the Houdini afro had (forehead and over the ears), and the hair is near the head
        there (it rounds in, no brim)."""
        for v in VARIANTS:
            o, _ = cm.part_frame(v, 'hair_afro')
            V = cm.part_mesh(v, 'hair_afro')['V'] - o
            self.assertGreater(afro.hairline(V).min(), -.004)
            low = V[afro.hairline(V) < .01]
            d = afro.head_sdf(v, low + o)
            self.assertLess(np.percentile(d, 95), .04, '%s hair at the hairline stands %.3f off the head' % (v, np.percentile(d, 95)))

    def test_fixed_layout(self):
        a = afro.clumps('guard'); afro.clumps.cache_clear(); b = afro.clumps('guard')
        self.assertTrue(np.array_equal(a[0], b[0]))


if __name__ == '__main__':
    unittest.main()
