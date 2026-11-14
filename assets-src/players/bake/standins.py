"""Stand-in shapes for the parts D1 is building (hands, sneakers, the clump afro), written in the same local frames, so
the detail functions for them can be tested and looked at before D1's real SDFs are wired in (task D3).

  hand_sdf(layout)   capsule fingers and thumb on a rounded palm, from a detail.HandLayout (hand-local metres)
  shoe_sdf(layout)   a box-ish sneaker: a rounded upper on a sole slab, from a detail.ShoeLayout (shoe-local metres)
  afro_sdf()         a lumpy sphere over the head (head-local metres)

surface_points() projects random points onto a stand-in (Newton steps along the gradient) and returns them with the
SDF normal, which is what the bake would hand the detail functions as the texel normal.
"""
import numpy as np

import detail as dt
import sdf_hi


def _capsule(p, a, b, ra, rb):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[..., None] * ab), axis=-1) - (ra + t * (rb - ra))


def _roundbox(p, c, half, rr):
    q = np.abs(p - c) - (np.asarray(half) - rr)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - rr


def hand_sdf(layout):
    digits = layout.digits
    mids = np.array([d['joints'][0] for k, d in digits.items() if k != 'thumb'])
    x0, x1 = mids[:, 0].min(), mids[:, 0].max(); ytop = mids[:, 1].mean()
    def f(p):
        p = np.asarray(p, float)
        palm = _roundbox(p, np.array([(x0 + x1) / 2, .52 * ytop, .0]), [(x1 - x0) / 2 + .011, .5 * ytop + .004, .014], .011)
        wrist = _capsule(p, np.array([0, -.04, 0.0]), np.array([0, .015, 0.0]), .024, .026)
        d = sdf_hi.smin(palm, wrist, .02)
        for name, dg in digits.items():
            J, R = dg['joints'], dg['radii']
            fd = None
            for i in range(len(J) - 1):
                s = _capsule(p, J[i], J[i + 1], R[i], R[i + 1])
                fd = s if fd is None else sdf_hi.smin(fd, s, .004)
            d = sdf_hi.smin(d, fd, .01 if name == 'thumb' else .006)
        return d
    return f


def shoe_sdf(lay):
    L, hw = lay.length, lay.half_width
    def f(p):
        p = np.asarray(p, float)
        z = p[..., 2]
        ys = lay.sole_y(np.clip(z, 0, L))
        # the sole: the outline in plan (y ignored) between the ground and the sole line
        sole = _roundbox(p * [1, 0, 1], np.array([0, 0, L / 2]), [hw + .003, 1.0, L / 2], .03)
        sole = sdf_hi.smax(sole, np.maximum(-p[..., 1], p[..., 1] - ys), .002)
        top = lay.instep_y + (.055 - lay.instep_y) * dt.smooth(.5 * L, .95 * L, z)
        upper = _roundbox(p, np.array([0, .5 * lay.instep_y, L / 2 - .004]), [hw - .002, .5 * lay.instep_y, L / 2 - .004], .03)
        upper = sdf_hi.smax(upper, p[..., 1] - top, .015)
        collar = _capsule(p, np.array([0, .02, .32 * L * .5]), np.array([0, lay.collar_y - .03, .3 * L * .5]), hw - .004, hw - .008)
        collar = sdf_hi.smax(collar, p[..., 1] - lay.collar_y, .01)
        return sdf_hi.smin(sdf_hi.smin(upper, collar, .03), sole, .004)
    return f


AFRO_C = np.array([0, .06, -.015])


def afro_sdf():
    def f(p):
        p = np.asarray(p, float)
        return np.linalg.norm(p - AFRO_C, axis=-1) - .15 - .007 * dt.noise(5, p / .07) - .004 * dt.noise(6, p / .03)
    return f


def gradient(f, p, eps=1e-4):
    g = np.stack([(f(p + e) - f(p - e)) / (2 * eps) for e in np.eye(3) * eps], -1)
    return g / np.maximum(np.linalg.norm(g, axis=-1, keepdims=True), 1e-12)


def surface_points(f, lo, hi, n, seed=0, keep=None):
    """n points on the zero set of f inside the box [lo, hi] (fewer if some do not converge), with unit normals."""
    rng = np.random.default_rng(seed)
    p = rng.uniform(lo, hi, (n * 3, 3))
    for _ in range(12):
        p = p - f(p)[:, None] * gradient(f, p)
    ok = (np.abs(f(p)) < 2e-5) & ((p >= lo) & (p <= hi)).all(1)
    if keep is not None: ok &= keep(p)
    p = p[ok][:n]
    return p, gradient(f, p)
