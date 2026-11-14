"""Tests for the production bake (atlas_bake.py): atlas assignment, the D1 parts wired into the SDF, the trim tube, the
image resampling, and the unwrap's layout (UVs in range, no overlap, deterministic)."""
import os, sys, unittest
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BAKE = os.path.dirname(HERE)
sys.path.insert(0, BAKE)
import atlas_bake as ab, raster  # noqa: E402
import cloudmesh as cm  # noqa: E402  (atlas_bake puts assets-src/players on the path)

GLB_GROUPS = ('core', 'arm_L', 'arm_R', 'hand_L', 'hand_R', 'jersey', 'shorts', 'sleeve_arm', 'sleeve_leg', 'headband',
              'trim', 'shoes', 'shoes_sole', 'hair_buzz', 'hair_crop', 'hair_afro', 'hair_rows')


class Atlases(unittest.TestCase):
    def test_every_group_in_exactly_one_atlas(self):
        seen = [g for gs in ab.ATLASES.values() for g in gs]
        self.assertEqual(len(seen), len(set(seen)))
        self.assertEqual(set(seen), set(GLB_GROUPS))
        self.assertEqual(ab.atlas_of('hand_R'), 'skin')
        self.assertEqual(ab.atlas_of('trim'), 'kit')
        self.assertEqual(ab.atlas_of('shoes_sole'), 'gear')
        self.assertEqual((ab.SIZE['skin'], ab.SIZE['kit'], ab.SIZE['gear'], ab.SMALL['skin']), (2048, 1024, 1024, 1024))
        self.assertEqual(ab.PADDING, 8)
        self.assertEqual(ab.map_file('guard', 'skin', True), 'guard_skin_1k.png')

    def test_sneaker_texels_bake_per_foot(self):
        P = np.array([[.08, .02, .1], [-.08, .02, .1]])
        self.assertEqual(list(ab.bake_part('shoes_sole', P)), ['shoe_L', 'shoe_R'])
        self.assertEqual(list(ab.bake_part('jersey', P)), ['jersey', 'jersey'])

    def test_occluders(self):
        self.assertEqual(ab.ao_parts('hand_L'), ('hand_L', 'arm_L'))         # not the thigh it hangs by in the rest pose
        self.assertNotIn('core', ab.ao_parts('shoe_R'))                       # the bare foot pokes through the toe box
        self.assertIn('legs', ab.ao_parts('shoe_R'))
        self.assertIn('headband', ab.ao_parts('headband'))
        self.assertEqual(ab.ao_parts('core').count('core'), 1)
        for part in ('core', 'jersey', 'shorts', 'trim', 'sleeve_leg', 'shoe_L'):     # the arms swing: no rest-pose imprint
            self.assertFalse({'arm_L', 'arm_R', 'hand_L', 'hand_R'} & set(ab.ao_parts(part)), part)
        self.assertNotIn('core', ab.ao_parts('arm_L'))


class Parts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.S = ab.player_sdf('forward')
        rng = np.random.default_rng(3)
        cls.rng = rng

    def near(self, name, n=400, r=.03):
        """Points within r of the part's mesh."""
        V = cm.part_mesh('forward', name)['V']
        return V[self.rng.integers(0, len(V), n)] + self.rng.normal(0, r / 2, (n, 3))

    def test_local_parts_are_d1s(self):
        for name in ('hand_L', 'hand_R', 'hair_afro'):
            P = self.near(name)
            np.testing.assert_allclose(self.S.sdf(name, P), cm.part_sdf('forward', name, P), atol=1e-9)
        for name in ('shoe_L', 'shoe_R'):
            P = self.near(name)
            np.testing.assert_allclose(self.S.sdf(name, P), cm.part_sdf('forward', name, P), atol=1e-9)
        P = np.vstack([self.near('shoe_L'), self.near('shoe_R')])
        np.testing.assert_allclose(self.S.sdf('shoes', P), np.minimum(cm.part_sdf('forward', 'shoe_L', P),
                                                                      cm.part_sdf('forward', 'shoe_R', P)), atol=1e-9)

    def test_arms_are_the_reshaped_forearm(self):
        o, R = cm.part_frame('forward', 'hand_R')
        P = o + self.rng.normal(0, .05, (300, 3))
        np.testing.assert_allclose(self.S.sdf('arm_R', P), cm.arm_sdf('forward', 'R', P), atol=1e-12)

    def test_detail_reaches_the_hands_and_shoes(self):
        """The hand's knuckles and the sneaker's laces are in the high-detail SDF, at their layout's places."""
        for name in ('hand_L', 'shoe_R'):
            m = cm.part_mesh('forward', name)
            d = self.S.detail_at(name, m['V'], m['N'])
            self.assertGreater(np.abs(d).max(), .0008, name)
            self.assertLess(np.abs(d).max(), .0031, name)

    def test_hand_layout_follows_d1_capsules(self):
        H = self.S.H; HL = cm.hand.HAND_LENGTH * H
        lay = ab.hand_layout(H)
        J, R = cm.hand.finger_chain('ring', HL)
        np.testing.assert_allclose(lay.digits['ring']['joints'], J)
        for name, dg in lay.digits.items():
            a = np.diff(dg['joints'], axis=0); a /= np.linalg.norm(a, axis=1, keepdims=True)
            np.testing.assert_allclose((a * dg['dorsal']).sum(1), 0, atol=1e-9)          # square to the bone
            np.testing.assert_allclose(np.linalg.norm(dg['dorsal'], axis=1), 1, atol=1e-9)
            if name != 'thumb': self.assertTrue((dg['dorsal'][:, 2] > .3).all(), name)    # the nail side is the back (little: 63 deg curl)

    def test_sneaker_layout_follows_d1_midsole(self):
        H = self.S.H; lay = ab.SneakerLayout(H); SL = cm.shoe.LENGTH * H
        z = np.linspace(0, SL, 20)
        np.testing.assert_allclose(lay.sole_y(z), cm.shoe.stack_top(z, SL, cm.shoe._mm(H)))
        self.assertTrue(.08 < lay.instep_y < .12, lay.instep_y)
        self.assertAlmostEqual(lay.length, SL)


class Trim(unittest.TestCase):
    def test_round_tube(self):
        c = np.stack([np.linspace(0, 1, 11), np.zeros(11), np.zeros(11)], 1)
        f = ab.TrimSDF([(c, False, .01)])
        P = np.array([[.5, .03, 0], [.5, 0, -.01], [.33, .0, .0], [-.02, 0, 0]])
        np.testing.assert_allclose(f(P), [.02, 0, -.01, .01], atol=1e-12)
        ring = np.stack([np.cos(np.linspace(0, 2 * np.pi, 40, endpoint=False)), np.sin(np.linspace(0, 2 * np.pi, 40, endpoint=False)), np.zeros(40)], 1)
        g = ab.TrimSDF([(ring, True, .01)])
        self.assertLess(abs(g(np.array([[1.0, 0, .01]]))[0]), 1e-9)                    # closed: the last segment exists
        self.assertAlmostEqual(g(np.array([[0.0, 0, 0]]))[0], np.cos(np.pi / 40) - .01, places=6)


class Images(unittest.TestCase):
    def test_downsample_keeps_flat_and_unit(self):
        rng = np.random.default_rng(1)
        n = raster._unit(np.concatenate([rng.normal(0, .3, (8, 8, 2)), np.ones((8, 8, 1))], -1))
        rgba = np.concatenate([raster.to_rgb8(n), rng.integers(0, 256, (8, 8, 1), dtype=np.uint8)], -1)
        out = ab.downsample(rgba)
        self.assertEqual(out.shape, (4, 4, 4))
        m = raster.from_rgb8(out[..., :3])
        np.testing.assert_allclose(np.linalg.norm(m, axis=-1), 1, atol=.02)
        np.testing.assert_allclose(out[..., 3], rgba[..., 3].astype(float).reshape(4, 2, 4, 2).mean((1, 3)), atol=.51)
        flat = np.zeros((4, 4, 4), np.uint8); flat[..., :3] = (128, 128, 255); flat[..., 3] = 200
        self.assertTrue((ab.downsample(flat) == flat[:2, :2]).all())

    def test_upsample_aligns_texel_centres(self):
        img = np.arange(16, dtype=float).reshape(4, 4)
        up = ab.upsample(img, 8)
        self.assertEqual(up.shape, (8, 8))
        np.testing.assert_allclose(up.reshape(4, 2, 4, 2).mean((1, 3))[1:3, 1:3], img[1:3, 1:3])
        np.testing.assert_allclose(ab.upsample(np.full((4, 4), .7), 16), .7)


class Unwrap(unittest.TestCase):
    def test_layout(self):
        """A box in the skin group and a sphere in the kit group: one atlas each, UVs in range without overlap, tangents
        square to the normals, the same layout twice."""
        from skimage.measure import marching_cubes
        g = np.linspace(-1.2, 1.2, 14)
        X = np.stack(np.meshgrid(g, g, g, indexing='ij'), -1)
        V, F, Nn, _ = marching_cubes(np.linalg.norm(X, axis=-1) - 1, 0, spacing=(g[1] - g[0],) * 3)
        V = V - 1.2; Nn = -Nn
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        if (fn * V[F].mean(1)).sum() < 0: F = F[:, ::-1]
        P = np.vstack([V * .1, V * .1 + [.5, 0, 0]]); N = np.vstack([V, V]) / np.linalg.norm(np.vstack([V, V]), axis=1, keepdims=True)
        T = np.vstack([F, F + len(V)]); grp = np.array(['core'] * len(F) + ['jersey'] * len(F))
        G = np.array(['core'] * len(V) + ['jersey'] * len(V))
        a = ab.unwrap(P, N, G, T, grp, log=lambda *x: None)
        b = ab.unwrap(P, N, G, T, grp, log=lambda *x: None)
        self.assertEqual(a.uv_hash(), b.uv_hash())
        self.assertEqual(a.tris.shape, T.shape)
        np.testing.assert_allclose(P[a.src][a.tris], P[T])                         # same triangles, same order
        self.assertTrue((a.uv >= 0).all() and (a.uv <= 1).all())
        self.assertEqual(set(a.atlas[a.tris[:len(F)]].ravel().tolist()), {0})
        self.assertEqual(set(a.atlas[a.tris[len(F):]].ravel().tolist()), {1})
        np.testing.assert_allclose((a.T * N[a.src]).sum(1), 0, atol=1e-6)
        self.assertTrue(set(np.unique(a.w)) <= {-1.0, 1.0})
        for ai, name in enumerate(ab.ATLAS_NAMES[:2]):
            tris = a.tris[a.atlas[a.tris[:, 0]] == ai]
            cover = raster.rasterize(a.uv, tris, 256, count=True)
            self.assertLessEqual(cover.max(), 1, name)


if __name__ == '__main__':
    unittest.main()
