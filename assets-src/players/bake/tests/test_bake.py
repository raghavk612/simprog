"""Tests for the prototype texture baker (assets-src/players/bake).

Run from the repo root:  python3 -m unittest discover assets-src/players/bake/tests      (numpy, scipy, xatlas, Pillow)
"""
import os, sys, unittest
import numpy as np

BAKE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BAKE)
import bake, mesh_uv, raster, sdf_hi  # noqa: E402

OBJ = os.path.join(os.path.dirname(BAKE), 'houdini', 'export', 'kangs_guard.obj')
OUT_OBJ = os.path.join(BAKE, 'out', 'kangs_guard_uv.obj')


def unit(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


class TangentSpace(unittest.TestCase):
    def frames(self, n, rng):
        N = unit(rng.normal(size=(n, 3)))
        T = unit(np.cross(N, unit(rng.normal(size=(n, 3)))))
        w = np.where(rng.random(n) < .5, -1.0, 1.0)
        B = raster.bitangents(N, T, w)
        # per-pixel frames are interpolated, so not exactly orthogonal: skew them a little
        return N, unit(T + .15 * rng.normal(size=(n, 3))), unit(B + .15 * rng.normal(size=(n, 3)))

    def test_encode_decode_round_trip(self):
        rng = np.random.default_rng(1)
        N, T, B = self.frames(5000, rng)
        n = unit(N + .6 * rng.normal(size=N.shape))
        n[(n * N).sum(1) < .05] = N[(n * N).sum(1) < .05]          # keep to the front hemisphere
        m = raster.encode(n, T, B, N)
        np.testing.assert_allclose(raster.decode(m, T, B, N), n, atol=1e-9)
        # through 8-bit PNG values: within a degree
        back = raster.decode(raster.from_rgb8(raster.to_rgb8(m)), T, B, N)
        err = np.degrees(np.arccos(np.clip((back * n).sum(1), -1, 1)))
        self.assertLess(np.percentile(err, 99), 1.0)

    def test_unperturbed_normal_is_flat_blue(self):
        rng = np.random.default_rng(2)
        N = unit(rng.normal(size=(100, 3))); T = unit(np.cross(N, [0.3, 0.9, 0.1])); B = raster.bitangents(N, T, np.ones(100))
        rgb = raster.to_rgb8(raster.encode(N, T, B, N))
        self.assertTrue((np.abs(rgb.astype(int) - [128, 128, 255]) <= 1).all())


class GroovedPlane(unittest.TestCase):
    """A 20 cm square facing +z, UV u = x, v = y (v up = image up), carved with a Gaussian groove. Baked with the same
    steps as bake.py: rasterise, interpolate, search along the low-poly normal, gradient, encode."""
    SIZE, DEPTH, WIDTH = 64, .003, .012

    def bake(self, groove_axis, mirror_u=False):
        L = .1
        P = np.array([[-L, -L, 0], [L, -L, 0], [L, L, 0], [-L, L, 0]], float)
        N = np.tile([0, 0, 1.0], (4, 1))
        UV = (P[:, :2] + L) / (2 * L)
        if mirror_u: UV[:, 0] = 1 - UV[:, 0]
        tris = np.array([[0, 1, 2], [0, 2, 3]]) if not mirror_u else np.array([[0, 2, 1], [0, 3, 2]])
        if mirror_u: P[:, 2] = 0   # same plane; winding flipped with the UVs, normals still +z
        T, w = raster.tangents(P, N, UV, tris)
        B = raster.bitangents(N, T, w)
        tid, bary = raster.rasterize(UV, tris, self.SIZE)
        mask = tid >= 0
        P0 = raster.interpolate(P, tris, tid, bary); N0 = unit(raster.interpolate(N, tris, tid, bary))
        Tt = raster.interpolate(T, tris, tid, bary); Bt = raster.interpolate(B, tris, tid, bary)
        a = groove_axis
        g = lambda Q: -self.DEPTH * np.exp(-(Q[..., a] / self.WIDTH) ** 2)
        f = lambda Q, n: Q[..., 2] - g(Q)
        _, hit, Ph, nh = bake.surface_normals(f, P0, N0)
        self.assertTrue(hit.all())
        rgb = np.zeros((self.SIZE, self.SIZE, 3), int); rgb[mask] = bake.encode_texels(nh, Tt, Bt, N0)
        # expected world normal: (-dz/dx, -dz/dy, 1) normalised
        x = Ph[:, a]; slope = -self.DEPTH * np.exp(-(x / self.WIDTH) ** 2) * (-2 * x / self.WIDTH ** 2)
        exp_n = np.zeros_like(Ph); exp_n[:, a] = -slope; exp_n[:, 2] = 1; exp_n = unit(exp_n)
        frame = (Tt, Bt, N0)
        return rgb, mask, exp_n, Ph, w, frame

    def test_groove_across_u_shades_red(self):
        rgb, mask, exp_n, Ph, _, _ = self.bake(0)
        self.assertTrue(mask.all())
        # the expected texel values: R from the x slope, G flat, B the rest
        exp = raster.to_rgb8(exp_n).astype(int)
        np.testing.assert_allclose(rgb[mask], exp, atol=2)
        row = rgb[self.SIZE // 2]
        left, right = row[29], row[34]      # texel centres 7.8 mm either side of the groove, near its steepest slope
        # left of the groove the floor rises towards -x, so the normal leans +x (R > 128); right of it, R < 128
        self.assertGreater(left[0], 145); self.assertLess(right[0], 111)
        self.assertTrue((np.abs(rgb[mask][:, 1] - 128) <= 1).all())
        self.assertTrue((rgb[mask][:, 2] > 230).all())

    def test_groove_across_v_is_green_up(self):
        """OpenGL / glTF convention: +Y of the map points up the image. Above the groove (top rows of the PNG) the
        surface leans toward -y, so green < 128 there; below it, green > 128."""
        rgb, mask, exp_n, Ph, _, _ = self.bake(1)
        np.testing.assert_allclose(rgb[mask], raster.to_rgb8(exp_n).astype(int), atol=2)
        col = rgb[:, self.SIZE // 2]
        top, bottom = col[29], col[34]      # row 0 is the top of the image (v = 1): row 29 is 7.8 mm above the groove
        self.assertLess(top[1], 111); self.assertGreater(bottom[1], 145)

    def test_mirrored_uvs_flip_handedness_not_the_image(self):
        """Mirror u: the tangent frames get w = -1, the texture (slopes in image space) is the same image, and decoding
        it with the mirrored frames still gives the world normal."""
        rgb, mask, exp_n, Ph, w, _ = self.bake(0)
        rgb_m, mask_m, exp_m, Ph_m, w_m, (Tt, Bt, N0) = self.bake(0, mirror_u=True)
        self.assertTrue((w > 0).all()); self.assertTrue((w_m < 0).all())
        self.assertLessEqual(np.abs(rgb_m - rgb).max(), 1)
        back = raster.decode(raster.from_rgb8(rgb_m[mask_m].astype(np.uint8)), Tt, Bt, N0)
        err = np.degrees(np.arccos(np.clip((back * exp_m).sum(1), -1, 1)))
        self.assertLess(err.max(), 1.0)


class Unwrap(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pos, vt, vn, tris = mesh_uv.read_obj(OBJ)
        keep = [t for t in tris if t[1] in ('hair_afro', 'shoes', 'arm_L', 'headband')]
        cls.mesh = mesh_uv.Mesh(pos, vn, keep)
        cls.mesh.hidden[:len(cls.mesh.hidden) // 7] = True      # some faces packed small, as the bake does
        cls.u = mesh_uv.unwrap(cls.mesh, 512, padding=4, log=lambda *a: None)

    def check(self, UV, tris, size):
        self.assertGreaterEqual(UV.min(), 0.0); self.assertLessEqual(UV.max(), 1.0)
        counts = raster.rasterize(UV, tris, size, count=True)
        self.assertGreater((counts > 0).sum(), 0)
        self.assertEqual(int((counts > 1).sum()), 0, 'texel centres strictly inside two UV triangles')

    def test_uvs_in_unit_square_without_overlap(self):
        self.check(self.u.UV, self.u.tris, 512)
        # finer than the atlas, too: overlaps smaller than a texel would show here
        self.check(self.u.UV, self.u.tris, 2048)

    def test_every_face_kept_and_groups_separate(self):
        self.assertEqual(len(self.u.tris), len(self.mesh.tris))
        lab, _ = mesh_uv.charts(self.u.UV, self.u.tris)
        for k in np.unique(lab):
            self.assertEqual(len(set(self.u.tg[lab == k])), 1, 'a chart spans two parts')

    def test_charts_have_consistent_orientation(self):
        lab, _ = mesh_uv.charts(self.u.UV, self.u.tris)
        sa = mesh_uv.uv_signed_areas(self.u.UV, self.u.tris)
        for k in np.unique(lab):
            s = sa[lab == k]
            self.assertFalse((s > 1e-12).any() and (s < -1e-12).any(), 'chart %d folds over itself' % k)

    @unittest.skipUnless(os.path.exists(OUT_OBJ), 'run bake.py first')
    def test_baked_obj(self):
        pos, vt, vn, tris = mesh_uv.read_obj(OUT_OBJ)
        ti = np.array([[c[1] for c in cs] for cs, _, _ in tris])
        self.check(vt, ti, 2048)


class AmbientOcclusion(unittest.TestCase):
    def test_range_and_open_surfaces(self):
        sphere = lambda Q: np.linalg.norm(Q, axis=-1) - .1
        rng = np.random.default_rng(3)
        n = unit(rng.normal(size=(200, 3)))
        ao = bake.ambient_occlusion(sphere, n * .1, n)
        np.testing.assert_allclose(ao, 1.0, atol=1e-6)
        # points anywhere (even inside): still in [0, 1]
        P = rng.normal(size=(500, 3)) * .1
        ao = bake.ambient_occlusion(sphere, P, unit(rng.normal(size=(500, 3))))
        self.assertTrue(((ao >= 0) & (ao <= 1)).all())

    def test_darker_inside_a_concave_corner(self):
        # floor (y < 0) and a wall (x < 0): the open space is the quadrant x > 0, y > 0
        corner = lambda Q: np.minimum(Q[..., 0], Q[..., 1])        # union of the two half-spaces
        xs = np.array([.005, .02, .05, .1, .3])
        P = np.stack([xs, np.zeros_like(xs), np.zeros_like(xs)], 1); n = np.tile([0, 1.0, 0], (len(xs), 1))
        ao = bake.ambient_occlusion(corner, P, n)
        self.assertTrue((np.diff(ao) >= -1e-9).all(), ao)          # brighter away from the wall
        self.assertLess(ao[0], .6); self.assertAlmostEqual(ao[-1], 1.0, places=6)

    def test_crease_between_two_bodies(self):
        # two spheres almost touching: the facing sides are darker than the far sides
        S = lambda Q: np.minimum(np.linalg.norm(Q - [.105, 0, 0], axis=-1) - .1, np.linalg.norm(Q + [.105, 0, 0], axis=-1) - .1)
        n = unit(np.array([[-1.0, .3, 0], [1.0, .3, 0]]))      # on the right sphere: towards the other one, and away
        P = np.array([.105, 0, 0]) + n * .1
        ao = bake.ambient_occlusion(S, P, n)
        self.assertLess(ao[0], ao[1] - .2)


class Sdf(unittest.TestCase):
    def test_head_culling_is_exact(self):
        import preview_body as pb
        S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), 'center')
        P = np.random.default_rng(4).uniform([-.4, 0, -.3], [.4, 2.2, .3], (60000, 3))
        body = S.body_part(P, 'core')
        np.testing.assert_array_equal(S.core(P), pb.smin(body, pb.head_sdf(P, S.head), S.neck_k))

    def test_parts_fit_the_houdini_mesh(self):
        pos, vt, vn, tris = mesh_uv.read_obj(OBJ)
        S = sdf_hi.PlayerSDF(sdf_hi.load_spec(), 'guard')
        for g in ('core', 'arm_R', 'jersey', 'shorts', 'hair_afro', 'headband', 'sleeve_leg'):
            ids = sorted({c[0] for cs, gg, _ in tris if gg == g for c in cs})
            d = np.abs(S.sdf(g, pos[ids]))
            self.assertLess(np.median(d), .001, g)


if __name__ == '__main__':
    unittest.main()
