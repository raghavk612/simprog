"""The afro: a union of hair clumps over the head, with low-frequency, asymmetric noise on the outline (notes §6).

Head-local metres (origin midway between the ear canals, +y up, +z forward). The volume keeps the old afro's envelope (the
Houdini recipe's ellipsoid over the skull, hugging the head 20 mm out near the hairline) and its hairline cut over the
forehead and ears, but the surface is CLUMPS spheres of 34-62 mm radius whose centres sit on that envelope, pushed in and out
by a smooth noise of the direction (wavelength about 10 cm, about +-5 % of the radius), unioned with a small blend so the
scallops between clumps stay. The layout is seeded per variant, so it is fixed from build to build.
"""
import functools, zlib
import numpy as np

from .prims import ellipsoid, smin, smax, smooth

CLUMPS = 60
SEED = 'kangs-afro'
BLEND = .0045         # smooth union between clumps (keeps the scallops)
NOISE = .07           # radius noise amplitude (fraction)
LIFT = .09            # height over the hairline (m) over which the hair grows from 22 mm thick to the full dome


@functools.lru_cache(maxsize=None)
def _head(variant):
    """The scalp: the head block without the ears (as the bake's scalp_sdf), its origin and half breadth."""
    import cloudmesh as cm
    import preview_body as pb
    v = cm._v(variant)
    return [s for s in pb.head_shapes(v) if s['name'] != 'ear'], cm.head_origin(variant), v['head']['params']['breadth'] / 2000.0


def head_sdf(variant, P):
    """The scalp (body-space points): the head block without the ears, which the hair covers or lets through; the neck's
    blend into the body is not needed this high up (the Houdini afro used the full core, which only differs below the
    hairline at the nape)."""
    import preview_body as pb
    shapes, _, _ = _head(variant)
    return pb.head_sdf(np.asarray(P, float), shapes)


def envelope(variant):
    _, _, HW = _head(variant)
    return np.array([0, .058, -.014]), np.array([HW + .0675, .125, .145])


def _noise_terms(seed):
    rng = np.random.default_rng(seed)
    dirs = rng.normal(size=(7, 3)); dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    freq = rng.uniform(2.2, 4.2, 7)   # cycles over the unit sphere: about 10-20 cm wavelength on a 14 cm dome
    phase = rng.uniform(0, 2 * np.pi, 7); amp = rng.uniform(.5, 1, 7)
    return dirs * freq[:, None], phase, amp / amp.sum()


def radius_noise(u, seed):
    """Smooth noise of a unit direction, -1..1 (sum of a few random plane waves on the sphere: low frequency, no symmetry)."""
    k, ph, a = _noise_terms(seed)
    return (np.sin(u @ k.T + ph) * a).sum(-1) / .6


@functools.lru_cache(maxsize=None)
def clumps(variant):
    """Clump centres (head-local) and radii."""
    seed = zlib.crc32((SEED + variant).encode())
    rng = np.random.default_rng(seed)
    c, r = envelope(variant)
    # directions: a jittered Fibonacci sphere, only those whose envelope point is above the hairline (with some slack)
    n = 140; i = np.arange(n) + .5
    phi = np.arccos(1 - 2 * i / n); th = np.pi * (1 + 5 ** .5) * i
    u = np.stack([np.sin(phi) * np.cos(th), np.cos(phi), np.sin(phi) * np.sin(th)], -1)
    u = u + rng.normal(scale=.12, size=u.shape); u /= np.linalg.norm(u, axis=1, keepdims=True)
    E = c + u * r                                  # on the ellipsoid's axis-scaled sphere (close enough for placement)
    keep = hairline(E) > -.02
    u, E = u[keep], E[keep]
    order = rng.permutation(len(u))[:CLUMPS]
    u, E = u[order], E[order]
    rad = rng.uniform(.026, .056, len(u))
    grow = 1 + NOISE * radius_noise(u, seed)
    # the clump's outer edge lands on the noisy envelope high up, and comes down to the head near the hairline (the hair
    # is about 22 mm thick there, the clumps smaller), so the afro rounds in to the hairline instead of overhanging it
    O = _head(variant)[1]
    t = np.linspace(0, .3, 301)[:, None, None]
    ray = c + u[None] * t
    inside = head_sdf(variant, ray.reshape(-1, 3) + O).reshape(len(t), len(u)) < 0
    hit = c + u * t[np.maximum(len(t) - 1 - np.argmax(inside[::-1], 0), 0), 0]      # last point inside the head along u
    s = smooth(0, LIFT, hairline(E))[:, None]
    out = (hit + u * .022) * (1 - s) + (c + (E - c) * grow[:, None]) * s
    rad = rad * (.45 + .55 * s[:, 0])
    centres = out - u * rad[:, None]
    return centres, rad


def hairline(L):
    """> 0 above the hairline (the Houdini afro's cut: high over the forehead, low at the nape, over the ears)."""
    return L[..., 1] - (.087 - .70 * (.088 - L[..., 2]))


def afro_local_sdf(variant, L, head=None):
    c, r = envelope(variant)
    if head is None: head = head_sdf(variant, L + _head(variant)[1])
    cen, rad = clumps(variant)
    # the inside is solid hair: the head grown by 14 mm at the hairline up to 32 mm high on the dome (the clumps stand out)
    d = head - (.014 + .018 * smooth(0, LIFT, hairline(L)))
    for p, s in zip(cen, rad):
        d = smin(d, np.linalg.norm(L - p, axis=-1) - s, BLEND)
    return smax(d, -hairline(L), .016)   # the edge rolls under


def afro_sdf(variant, P):
    P = np.asarray(P, float)
    return afro_local_sdf(variant, P - _head(variant)[1])


def bounds(variant):
    O = _head(variant)[1]
    return O + np.array([-.2, -.08, -.21]), O + np.array([.2, .23, .17])
