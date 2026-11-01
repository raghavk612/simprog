"""Tests for the procedural player head (the `head` block of body_shapes.json) and its numpy evaluation.

Run from the repo root:  python3 -m unittest discover assets-src/players/tests      (stdlib unittest + numpy only)

Landmark targets are the research table (docs/superpowers/notes/2026-11-01-player-head-research.md), head-local mm:
origin midway between the ear canals, +y up, +z forward, x>0 the player's left.
"""
import copy, json, os, sys, unittest
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import preview_body as pb          # noqa: E402
import head_landmarks as hl        # noqa: E402
import make_body_shapes as mbs     # noqa: E402

SPEC = json.load(open(os.path.join(HERE, 'body_shapes.json')))
VARIANTS = list(SPEC['variants'])
_LM = {}
def landmarks(name):
    if name not in _LM:
        _LM[name] = hl.measure(SPEC, SPEC['variants'][name])
    return _LM[name]


class BlendOps(unittest.TestCase):
    def test_smin_is_hard_min_outside_k(self):
        a = np.array([0.0, 0.0, 0.1]); b = np.array([0.05, -0.04, 0.2])
        np.testing.assert_allclose(pb.smin(a, b, 0.03), np.minimum(a, b))

    def test_smin_dips_k_over_4_at_the_seam(self):
        self.assertAlmostEqual(float(pb.smin(np.array(0.02), np.array(0.02), 0.04)), 0.02 - 0.01, places=9)
        x = np.linspace(-.1, .1, 401)
        d = np.minimum(x, -x) - pb.smin(x, -x, 0.04)
        self.assertLessEqual(d.max(), 0.01 + 1e-12)
        self.assertGreaterEqual(d.min(), 0.0)

    def test_smax_is_dual_of_smin(self):
        a = np.linspace(-.05, .05, 11); b = a[::-1] * .7
        np.testing.assert_allclose(pb.smax(a, b, .02), -pb.smin(-a, -b, .02))
        self.assertTrue(np.all(pb.smax(a, b, .02) >= np.maximum(a, b) - 1e-12))

    def test_ellipsoid_sign_and_surface(self):
        r = np.array([.078, .1, .102])
        on = np.array([[.078, 0, 0], [0, .1, 0], [0, 0, -.102], [.078 / 3 ** .5, .1 / 3 ** .5, .102 / 3 ** .5]])
        np.testing.assert_allclose(pb.sd_ellipsoid(on, r), 0, atol=1e-9)
        self.assertLess(float(pb.sd_ellipsoid(np.array([[0.01, 0.02, 0]]), r)[0]), 0)
        self.assertGreater(float(pb.sd_ellipsoid(np.array([[0.2, 0, 0]]), r)[0]), 0)

    def test_ellipsoid_is_exact_for_a_sphere(self):
        P = np.random.default_rng(1).normal(size=(200, 3)) * .1
        np.testing.assert_allclose(pb.sd_ellipsoid(P, np.array([.05, .05, .05])), np.linalg.norm(P, axis=1) - .05, atol=1e-9)

    def test_roundbox_exact(self):
        b = np.array([.02, .01, .03])
        P = np.array([[.05, 0, 0], [0, 0, 0], [.03, .02, 0]])
        np.testing.assert_allclose(pb.sd_roundbox(P, b, .005), [.03, -.01, np.hypot(.015, .015) - .005], atol=1e-9)


class Spec(unittest.TestCase):
    def test_json_is_fresh(self):
        self.assertEqual(json.loads(json.dumps(mbs.build_spec())), SPEC, 'run python3 assets-src/players/make_body_shapes.py')

    def test_old_head_shapes_left_the_core(self):
        names = {s['name'] for s in SPEC['shapes']}
        for n in ('cranium', 'jaw', 'chin', 'cheeks', 'nose', 'brow', 'ear_L', 'ear_R'):
            self.assertNotIn(n, names)

    def test_every_variant_has_a_head_block(self):
        for name in VARIANTS:
            h = SPEC['variants'][name]['head']
            self.assertTrue(.035 <= h['neck_k'] <= .058, 'head<->body blend from the k table')
            self.assertGreater(len(h['shapes']), 10)
            for s in h['shapes']:
                self.assertIn(s['kind'], hl.KINDS)
                self.assertIn(s['op'], hl.OPS)
                self.assertEqual(len(s['basis']), 9)
                self.assertTrue(0 < s['k'] <= .06, s['name'])
                self.assertTrue(np.all(np.abs(s['c']) < .3), 'head-local metres: ' + s['name'])

    def test_face_blends_are_small(self):
        for name in VARIANTS:
            for s in SPEC['variants'][name]['head']['shapes']:
                if s['name'] in ('neck', 'muzzle', 'face_block', 'cranium') or s['kind'] == 'plane': continue
                self.assertLessEqual(s['k'], .02, s['name'] + ': facial features blend at 5-18 mm')


class HeadScale(unittest.TestCase):
    def test_head_does_not_scale_with_height(self):
        rng = np.random.default_rng(3)
        Q = rng.uniform([-.12, -.25, -.12], [.12, .15, .16], size=(4000, 3))
        for name in VARIANTS:
            v = SPEC['variants'][name]
            ds = []
            for H in (1.7, 2.3):
                w = copy.deepcopy(v); w['height_m'] = H
                ds.append(pb.head_sdf(Q + pb.head_origin(w), pb.head_shapes(w)))
            np.testing.assert_allclose(ds[0], ds[1], atol=1e-9)

    def test_crown_sits_at_standing_height(self):
        for name in VARIANTS:
            v = SPEC['variants'][name]
            top = pb.head_origin(v)[1] + landmarks(name)['crown_y'] / 1000
            self.assertAlmostEqual(top, v['height_m'], delta=.004)

    def test_head_height_is_absolute(self):
        frac = {}
        for name in VARIANTS:
            lm = landmarks(name)
            hh = lm['crown_y'] - lm['menton_y']
            self.assertTrue(222 <= hh <= 246, '%s head height %.1f' % (name, hh))
            frac[name] = hh / 1000 / SPEC['variants'][name]['height_m']
        self.assertLess(frac['center'], frac['guard'])


class FaceIsolation(unittest.TestCase):
    def test_body_blend_does_not_reach_the_face(self):
        rng = np.random.default_rng(5)
        for name in VARIANTS:
            v = SPEC['variants'][name]
            Q = rng.uniform([-.1, -.11, .02], [.1, .15, .16], size=(20000, 3)) + pb.head_origin(v)
            head = pb.head_sdf(Q, pb.head_shapes(v))
            L = Q - pb.head_origin(v)
            face = (np.abs(head) < .01) & ((L[:, 1] > -.06) | (L[:, 2] > .082))   # face surface down to the jaw corners, and the chin
            Q, head = Q[face], head[face]   # (the throat under the jaw is the neck junction, where the body may blend)
            self.assertGreater(len(Q), 500)
            np.testing.assert_allclose(pb.core_sdf(Q, SPEC, v), head, atol=1e-6)

    def test_head_joins_the_body_at_the_neck(self):
        for name in VARIANTS:
            v = SPEC['variants'][name]
            o = pb.head_origin(v)
            ys = np.linspace(o[1] - .22, o[1] - .05, 60)
            P = np.stack([np.zeros_like(ys), ys, np.full_like(ys, o[2] - .02)], 1)
            self.assertTrue(np.all(pb.core_sdf(P, SPEC, v) < -.02), 'solid neck column from the shoulders into the skull')


class Landmarks(unittest.TestCase):
    TOL = {'crown_y': 5, 'parietal_half': 4, 'temple_half': 5, 'zyg_half': 4, 'gonion_half': 5, 'menton_y': 5,
           'glabella_z': 6, 'back_z': 6, 'length': 8, 'ear_top': 6, 'ear_bottom': 6, 'ear_protrusion': 5, 'neck_half': 6,
           'eye_y': 5}

    def test_forward_matches_the_research_table(self):
        lm = landmarks('forward')
        for key, tol in self.TOL.items():
            self.assertAlmostEqual(lm[key], hl.TARGETS[key], delta=tol, msg='%s %.1f vs %.1f' % (key, lm[key], hl.TARGETS[key]))

    def test_every_variant_is_a_plausible_adult_male_head(self):
        for name in VARIANTS:
            lm = landmarks(name)
            msg = name + ' ' + json.dumps({k: round(x, 1) for k, x in lm.items()})
            self.assertTrue(.72 <= lm['parietal_half'] * 2 / lm['length'] <= .84, msg)    # cephalic index
            self.assertTrue(195 <= lm['length'] <= 216, msg)
            self.assertGreater(lm['parietal_half'], lm['temple_half'] + 12, msg)          # temple pinch
            self.assertGreater(lm['zyg_half'], lm['gonion_half'] + 12, msg)               # face tapers to the jaw corners
            self.assertTrue(.70 <= lm['gonion_half'] / lm['zyg_half'] <= .82, msg)
            self.assertGreaterEqual(lm['socket_depth'], 7, msg)                           # brow shelf over the eyes
            self.assertGreaterEqual(lm['nose_proj'], 10, msg)                             # nose wedge stands proud of the brow
            self.assertTrue(-24 <= lm['nose_tip_y'] <= -4, msg)
            self.assertGreaterEqual(lm['chin_flat_half'], 13, msg)                        # squared chin
            self.assertLess(lm['ear_centre_z'], 0, msg)                                   # ears behind the midline
            self.assertTrue(16 <= lm['ear_protrusion'] <= 30, msg)
            self.assertLess(lm['neck_top_z'], -5, msg)                                    # neck enters behind the jaw
            self.assertGreater(lm['lower_face'] / (lm['lower_face'] + lm['mid_face']), .53, msg)  # long lower third

    def test_variants_differ(self):
        g, f, c = (landmarks(n) for n in ('guard', 'forward', 'center'))
        self.assertGreater(c['gonion_half'], g['gonion_half'] + 3)
        self.assertGreater(c['parietal_half'] * 2 / c['length'], g['parietal_half'] * 2 / g['length'] + .03)
        self.assertGreater(c['neck_half'], g['neck_half'] + 2)


if __name__ == '__main__':
    unittest.main()
