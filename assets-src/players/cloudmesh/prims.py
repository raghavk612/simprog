"""Distance primitives and blends for the cloud-meshed parts (numpy, metres, points (..., 3)).

The blends are the Houdini/preview_body ones (polynomial smin, k = blend width), so a part blends the same way here, in the
baker and in Houdini. Shapes are exact or near-exact distances (|grad| = 1 at the surface), which the marching cubes, the
SDF-gradient normals and the baker's secant search all rely on.
"""
import math
import numpy as np


def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * .25


def smax(a, b, k):
    return -smin(-a, -b, k)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def capsule(P, a, b, ra, rb=None):
    """Round cone from a (radius ra) to b (radius rb): exact distance (IQ's sdRoundCone between two points)."""
    rb = ra if rb is None else rb
    a, b = np.asarray(a, float), np.asarray(b, float)
    ba = b - a; l2 = ba @ ba
    if l2 < 1e-14: return np.linalg.norm(P - a, axis=-1) - max(ra, rb)
    rr = ra - rb; a2 = l2 - rr * rr; il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba; z = y - l2
    x = pa * l2 - y[..., None] * ba
    x2 = (x * x).sum(-1); y2 = y * y * l2; z2 = z * z * l2
    k = math.copysign(1.0, rr) * rr * rr * x2
    out = np.where(np.sign(z) * a2 * z2 > k, np.sqrt(x2 + z2) * il2 - rb,
                   np.where(np.sign(y) * a2 * y2 < k, np.sqrt(x2 + y2) * il2 - ra,
                            (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra))
    return out


def ellipsoid(P, c, r):
    """IQ's ellipsoid approximation (good near the surface)."""
    q = (P - np.asarray(c, float)) / np.asarray(r, float)
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / np.asarray(r, float), axis=-1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)


def roundbox(P, c, half, rr):
    q = np.abs(P - np.asarray(c, float)) - np.asarray(half, float) + rr
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - rr


def rot(axis, ang):
    """Rotation matrix about a unit axis by ang radians (right hand rule)."""
    axis = np.asarray(axis, float); axis = axis / np.linalg.norm(axis)
    x, y, z = axis; c, s = math.cos(ang), math.sin(ang); C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def to_local(P, origin, R):
    """World points -> part-local coordinates (R's columns are the local axes in world space; R may be a reflection)."""
    return (np.asarray(P, float) - origin) @ R


def to_world(Q, origin, R):
    return np.asarray(Q, float) @ R.T + origin


def gradient(f, P, eps=2e-4):
    """Normalised tetrahedral finite-difference gradient of f at P (..., 3)."""
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    g = np.zeros_like(P, dtype=float)
    for kk in k:
        g = g + kk * f(P + kk * eps)[..., None]
    return g / np.maximum(np.linalg.norm(g, axis=-1, keepdims=True), 1e-12)


def value_noise3(P, seed, cell):
    """Smooth 3D value noise in about -1..1 with feature size `cell` metres (deterministic per seed)."""
    rng = np.random.default_rng(seed)
    table = rng.uniform(-1, 1, 4096)
    perm = rng.permutation(4096)
    Q = np.asarray(P, float) / cell
    i = np.floor(Q).astype(np.int64); f = Q - i
    u = f * f * (3 - 2 * f)
    def h(dx, dy, dz):
        a = (i[..., 0] + dx) * 73856093 ^ (i[..., 1] + dy) * 19349663 ^ (i[..., 2] + dz) * 83492791
        return table[perm[np.abs(a) % 4096]]
    out = 0
    for dx in (0, 1):
        wx = u[..., 0] if dx else 1 - u[..., 0]
        for dy in (0, 1):
            wy = u[..., 1] if dy else 1 - u[..., 1]
            for dz in (0, 1):
                wz = u[..., 2] if dz else 1 - u[..., 2]
                out = out + wx * wy * wz * h(dx, dy, dz)
    return out
