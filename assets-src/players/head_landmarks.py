"""Measures a Kangs head against the research landmark table by casting rays at the head SDF (numpy only).

Everything is in the head-local frame, in millimetres: origin midway between the ear canals, +y up, +z forward,
x>0 the player's left. Each ray marches at 1 mm until the distance changes sign, then bisects the crossing, so the
numbers are the zero set of the same SDF the mesh is made from (to well under a voxel).

    python3 head_landmarks.py [variant ...]      prints measured vs target
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import preview_body as pb  # noqa: E402

KINDS = tuple(pb.KIND)
OPS = tuple(pb.OP)
# research table (docs/superpowers/notes/2026-11-01-player-head-research.md), head-local mm
TARGETS = {'crown_y': 134, 'parietal_half': 77.8, 'parietal_y': 40, 'temple_half': 58, 'zyg_half': 72.3, 'gonion_half': 52.5,
           'menton_y': -100, 'glabella_z': 110, 'back_z': -95, 'length': 205, 'ear_top': 33, 'ear_bottom': -33,
           'ear_protrusion': 23.6, 'neck_half': 65, 'eye_y': 27, 'subnasale_y': -27, 'stomion_y': -50, 'alae_half': 16.5}   # alae: polish round (narrow young nose; research 17-22)
NOTES = {'crown_y': 'vertex, tragion-to-top', 'parietal_half': 'max breadth / 2 (above the ears)', 'parietal_y': 'height of max breadth',
         'temple_half': 'min forehead half-width 40 mm behind glabella (ft-ft/2)', 'zyg_half': 'cheekbone half-width (bizygomatic/2)',
         'gonion_half': 'jaw-corner half-width (bigonial/2)', 'menton_y': 'chin bottom', 'glabella_z': 'brow front',
         'back_z': 'back of skull', 'length': 'glabella to back', 'ear_top': 'ear top', 'ear_bottom': 'ear lobe',
         'ear_protrusion': 'ear rim beyond the head side', 'neck_half': 'neck half-width at y=-140', 'eye_y': 'eye line: the closed-lid bulge in the socket at x=33',
         'subnasale_y': 'nose base (midline notch under the tip)', 'stomion_y': 'mouth line', 'alae_half': 'nostril wing half-width'}

def local_fn(v, drop=(), keep=None):
    """Head SDF of a variant in head-local metres (optionally without, or with only, some named shapes)."""
    o = pb.head_origin(v)
    shapes = [s for s in pb.head_shapes(v) if s['name'] not in drop and (keep is None or s['name'] in keep)]
    return lambda Q: pb.head_sdf(Q + o, shapes)

def cast(fn, origins, direction, tmax=.3, step=.001, iters=12):
    """Distance along `direction` from each origin (metres) to the first outside->inside crossing; nan if none."""
    origins = np.asarray(origins, float); direction = np.asarray(direction, float)
    ts = np.arange(0, tmax + step, step)
    P = origins[:, None, :] + ts[None, :, None] * direction
    d = fn(P.reshape(-1, 3)).reshape(len(origins), len(ts))
    inside = d <= 0
    first = np.where(inside.any(1), inside.argmax(1), -1)
    out = np.full(len(origins), np.nan)
    ok = first > 0
    lo = ts[np.maximum(first - 1, 0)][ok]; hi = ts[np.maximum(first, 0)][ok]; o = origins[ok]
    for _ in range(iters):
        mid = (lo + hi) / 2
        dm = fn(o + mid[:, None] * direction)
        lo = np.where(dm > 0, mid, lo); hi = np.where(dm > 0, hi, mid)
    out[ok] = (lo + hi) / 2
    return out

def grid(a, b):
    A, B = np.meshgrid(a, b, indexing='ij'); return A.ravel(), B.ravel()

def half_width(fn, ys, zs):  # rays from x=+160 mm toward the midline; returns x (mm) per (y, z)
    o = np.stack([np.full(len(ys), .16), np.asarray(ys) / 1000, np.asarray(zs) / 1000], 1)
    return 160 - cast(fn, o, (-1, 0, 0)) * 1000

def front_z(fn, xs, ys):  # rays from z=+200 mm backward
    o = np.stack([np.asarray(xs) / 1000, np.asarray(ys) / 1000, np.full(len(xs), .2)], 1)
    return 200 - cast(fn, o, (0, 0, -1)) * 1000

def back_z(fn, xs, ys):
    o = np.stack([np.asarray(xs) / 1000, np.asarray(ys) / 1000, np.full(len(xs), -.2)], 1)
    return -200 + cast(fn, o, (0, 0, 1)) * 1000

def top_y(fn, xs, zs, start=.25):
    o = np.stack([np.asarray(xs) / 1000, np.full(len(xs), start), np.asarray(zs) / 1000], 1)
    return start * 1000 - cast(fn, o, (0, -1, 0), tmax=start + .25) * 1000

def bottom_y(fn, xs, zs, start=-.25):
    o = np.stack([np.asarray(xs) / 1000, np.full(len(xs), start), np.asarray(zs) / 1000], 1)
    return start * 1000 + cast(fn, o, (0, 1, 0), tmax=.5) * 1000

def measure(spec, v):
    f = local_fn(v)
    lm = {}
    zs = np.arange(-60, 61, 2.0)
    lm['crown_y'] = np.nanmax(top_y(f, np.zeros_like(zs), zs))
    y, z = grid(np.arange(36, 57, 2.0), np.arange(-70, 31, 2.0))
    w = half_width(f, y, z); i = np.nanargmax(w)
    lm['parietal_half'], lm['parietal_y'] = w[i], y[i]
    ys = np.arange(28, 47, 0.5)
    prof = front_z(f, np.zeros_like(ys), ys)
    lm['glabella_z'] = np.nanmax(prof)
    ys = np.arange(-20, 91, 2.0)
    lm['back_z'] = np.nanmin(back_z(f, np.zeros_like(ys), ys))
    lm['length'] = lm['glabella_z'] - lm['back_z']
    ys = np.arange(36, 57, 1.0)
    lm['temple_half'] = np.nanmin(half_width(f, ys, np.full_like(ys, lm['glabella_z'] - 40)))
    y, z = grid(np.arange(-2, 21, 2.0), np.arange(15, 71, 2.0))
    lm['zyg_half'] = np.nanmax(half_width(f, y, z))
    y, z = grid(np.arange(-62, -51, 1.0), np.arange(0, 31, 2.0))
    lm['gonion_half'] = np.nanmax(half_width(f, y, z))
    zs = np.arange(70, 111, 1.0)
    lm['menton_y'] = np.nanmin(bottom_y(f, np.zeros_like(zs), zs))
    xs = np.arange(0, 31, 0.5)
    cz = front_z(f, xs, np.full_like(xs, lm['menton_y'] + 12))
    flat = xs[cz >= cz[0] - 5]
    lm['chin_flat_half'] = flat.max() if len(flat) else 0
    # eye socket under the brow shelf (profile at the pupil line x = 33)
    ys = np.arange(10, 47, 0.5)
    pz = front_z(f, np.full_like(ys, 33), ys)
    lid = np.nanargmax(np.where((ys >= 18) & (ys <= 32), pz, -np.inf))          # closed-lid bulge = eye line
    above = (ys > ys[lid]) & (ys < 40)
    lm['eye_y'] = ys[lid]; lm['socket_depth'] = np.nanmax(pz[ys >= 34]) - np.nanmin(pz[above])   # recess under the brow
    # midline profile: sellion, nose tip, subnasale, mouth line
    ys = np.arange(-70, 36, 0.5)
    mz = front_z(f, np.zeros_like(ys), ys)
    t = np.nanargmax(np.where((ys > -30) & (ys < 10), mz, -np.inf))
    lm['nose_tip_y'], lm['nose_tip_z'] = ys[t], mz[t]
    lm['nose_proj'] = mz[t] - lm['glabella_z']
    s = np.nanargmin(np.where((ys > 5) & (ys < 33), mz, np.inf)); lm['sellion_y'] = ys[s]
    drop = np.where((ys[1:] > ys[t] - 20) & (ys[1:] <= ys[t]), np.diff(mz), -np.inf)   # nose base: steepest step under the tip
    lm['subnasale_y'] = float(ys[np.argmax(drop)] + ys[np.argmax(drop) + 1]) / 2
    notch = (ys > -62) & (ys < -40)
    notch[1:-1] &= (mz[1:-1] < mz[:-2]) & (mz[1:-1] <= mz[2:]); notch[[0, -1]] = False   # local minima only
    st = np.nanargmin(np.where(notch, mz, np.inf)) if notch.any() else np.nanargmin(np.where((ys > -62) & (ys < -40), mz, np.inf))
    lm['stomion_y'] = ys[st]
    lm['mid_face'] = lm['sellion_y'] - lm['subnasale_y']; lm['lower_face'] = lm['subnasale_y'] - lm['menton_y']
    # nostril wings: the alar crease, where the wing meets the cheek, seen from the front. Along each front-depth profile
    # z(x) across the body of the wings (y -22..-16; lower, at the nostril sill, the crease is ambiguous) it is the point
    # of strongest concavity (max d2z/dx2) beyond the bridge; the half-width is the widest crease over those heights.
    # (Depth-independent: a window set back from the tip would slide into the cheek when the tip moves.)
    xs = np.arange(6, 34.01, 0.5); cr = []
    for yy in np.arange(-22, -15.9, 1.0):
        zz = front_z(f, xs, np.full_like(xs, yy))
        d2 = np.r_[np.nan, zz[2:] - 2 * zz[1:-1] + zz[:-2], np.nan]
        cr.append(xs[np.nanargmax(np.where((xs > 8) & (xs < 32), d2, -np.inf))])
    lm['alae_half'] = max(cr)
    # ears: extent from the ear shape alone, protrusion against the head without its ears
    fe = local_fn(v, keep=('ear',))
    x, z = grid(np.arange(60, 111, 1.0), np.arange(-50, 21, 1.0))
    ty = top_y(fe, x, z, start=.1); by = bottom_y(fe, x, z, start=-.1)
    lm['ear_top'], lm['ear_bottom'] = np.nanmax(ty), np.nanmin(by)
    lm['ear_centre_z'] = np.nanmean(z[~np.isnan(ty)])
    y, z = grid(np.arange(-30, 31, 2.0), np.arange(-45, 11, 2.0))
    w = half_width(f, y, z); i = np.nanargmax(w)
    side = half_width(local_fn(v, drop=('ear',)), y[i:i + 1], z[i:i + 1])[0]
    lm['ear_out'] = w[i]; lm['ear_protrusion'] = w[i] - side
    # lips: depth of the lip line below the lower of the two lips; how far the upper lip stands ahead of the lower
    sti = np.argmin(np.abs(ys - lm['stomion_y']))
    up = np.nanmax(np.where((ys > ys[sti]) & (ys <= ys[sti] + 12), mz, -np.inf))
    low = np.nanmax(np.where((ys < ys[sti]) & (ys >= ys[sti] - 12), mz, -np.inf))
    lm['lip_line_depth'] = min(up, low) - mz[sti]; lm['upper_lip_ahead'] = up - low
    # cheek hollow: rays aimed at the head's vertical axis from bearings 30-60 deg (front-side, the 3/4 view), at
    # heights from the cheekbone (y = +8) down to just above the jaw (y = -50): how far the cheek surface sinks below
    # the straight chord between those two heights. <= 0 means flat or convex.
    hol = []
    ys2 = np.arange(8, -50.5, -1.0)
    for a in (30, 40, 50, 60):
        n = np.array([np.cos(np.radians(a)), 0, np.sin(np.radians(a))])
        o = np.stack([np.full_like(ys2, .2 * n[0]), ys2 / 1000, np.full_like(ys2, .2 * n[2])], 1)
        rr = 200 - cast(f, o, -n) * 1000
        chord = rr[0] + (rr[-1] - rr[0]) * (ys2 - ys2[0]) / (ys2[-1] - ys2[0])
        hol.append(np.nanmax(chord - rr))
    lm['cheek_hollow'] = max(hol)
    # neck
    zs = np.arange(-110, 81, 2.0)
    lm['neck_half'] = np.nanmax(half_width(f, np.full_like(zs, -140), zs))
    lm['neck_top_z'] = (front_z(f, [0], [-120])[0] + back_z(f, [0], [-120])[0]) / 2
    return {k: float(x) for k, x in lm.items()}

def report(name, lm):
    lines = ['%s head (mm, head-local)' % name, '%-15s %8s %8s %7s  %s' % ('landmark', 'measured', 'target', 'diff', 'what')]
    for k, x in lm.items():
        t = TARGETS.get(k)
        lines.append('%-15s %8.1f %8s %7s  %s' % (k, x, '' if t is None else '%.1f' % t, '' if t is None else '%+.1f' % (x - t), NOTES.get(k, '')))
    lines.append('ratios: cephalic %.3f  gonion/zyg %.3f  lower face %.2f of (mid+lower)  head height %.1f' % (
        lm['parietal_half'] * 2 / lm['length'], lm['gonion_half'] / lm['zyg_half'], lm['lower_face'] / (lm['lower_face'] + lm['mid_face']),
        lm['crown_y'] - lm['menton_y']))
    return '\n'.join(lines)

if __name__ == '__main__':
    spec = json.load(open(os.path.join(HERE, 'body_shapes.json')))
    for name in (sys.argv[1:] or list(spec['variants'])):
        print(report(name, measure(spec, spec['variants'][name])), '\n')
