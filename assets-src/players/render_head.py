"""Cloud renders of a Kangs player head without Houdini or a browser: numpy sphere tracing of the same SDF the preview
and the Houdini VEX evaluate (head block + the body's core near the neck), Lambert key/fill + rim, SDF ambient occlusion
and a soft key shadow. Orthographic camera, lights fixed to the camera so every view is lit the same way.

    python3 render_head.py [--out DIR] [--variant NAME ...] [--old OLD_body_shapes.json] [--size PX]

Writes into DIR (default ./shots):
  head_<variant>_views.png   front / 3/4 / side / top, head and neck
  head_<variant>_tiny.png    front / 3/4 / side at 15, 25 and 35 px head height (shown x6, nearest) + the same at 1:1
  head_variants.png          guard / forward / center side by side (front, 3/4, side)
  head_before_after.png      old head (--old spec, height-scaled, one global blend) above the new one, same scale
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import preview_body as pb  # noqa: E402

SKIN = np.array([.36, .2, .12])          # linear albedo, a medium-brown skin
BG = np.array([.62, .66, .7])
VIEWS = {'front': (0, 0), '3/4': (38, 6), 'side': (90, 0), 'top': (0, 89.9)}

def scene_new(spec, v, blend=.03):
    o = pb.head_origin(v)
    body = [s for s in pb.shapes_for(spec, v) if s['part'] == 'core']
    hs = pb.head_shapes(v)
    fn = lambda P: pb.smin(pb.body_sdf(P, spec, v, 'core', blend, body), pb.head_sdf(P, hs), v['head']['neck_k'])
    return fn, o

def scene_old(spec, v, blend=.03):
    """The pre-H1 head: every core shape near the head, height-scaled, smooth-unioned at the body's one blend radius."""
    H = v['height_m']
    o = np.array([0, H - .134, -.01])   # same framing as the new head (crown at standing height)
    body = [s for s in pb.shapes_for(spec, v) if s['part'] == 'core']
    return (lambda P: pb.body_sdf(P, spec, v, 'core', blend, body)), o

def camera(yaw, pitch):
    """Unit vectors (right, up, back) of a camera looking at the head from direction (yaw about y from +z, pitch up)."""
    y, p = math.radians(yaw), math.radians(pitch)
    back = np.array([math.sin(y) * math.cos(p), math.sin(p), math.cos(y) * math.cos(p)])   # from target toward camera
    up0 = np.array([0, 1.0, 0]) if abs(back[1]) < .99 else np.array([0, 0, -1.0])
    right = np.cross(up0, back); right /= np.linalg.norm(right)
    up = np.cross(back, right)
    return right, up, back

def normal(fn, P, e=.0004):
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = sum(kk * fn(P + kk * e)[:, None] for kk in k)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)

def trace(fn, ro, rd, tmax, eps=.00015, iters=320, relax=.6):
    t = np.zeros(len(ro)); hit = np.zeros(len(ro), bool); live = np.ones(len(ro), bool)
    for _ in range(iters):
        idx = np.where(live)[0]
        if not len(idx): break
        d = fn(ro[idx] + rd[idx] * t[idx, None])
        done = d < eps
        hit[idx[done]] = True; live[idx[done]] = False
        t[idx[~done]] += np.maximum(d[~done] * relax, eps * .5)
        far = t > tmax; live &= ~far
    # the body's flattened capsules overestimate distance (|grad| up to 1/aspect), so a step can land inside: walk back
    idx = np.where(hit)[0]
    for _ in range(6):
        t[idx] += fn(ro[idx] + rd[idx] * t[idx, None]) * .9
    return t, hit

def shade(fn, P, N, V, L):
    """Lambert key (soft shadow) + fill + sky ambient (AO) + rim, lights given in world space."""
    key, fill, rim = L
    ao = np.zeros(len(P))
    for i, h in enumerate((.003, .007, .012, .02, .032)):
        ao += (h - fn(P + N * h)) * (.7 ** i) / h
    ao = np.clip(1 - .28 * ao, 0, 1)
    sh = np.ones(len(P)); t = np.full(len(P), .002)
    for _ in range(40):   # march toward the key light far enough to reach the head from the chest
        d = fn(P + N * .0006 + key * t[:, None])
        sh = np.minimum(sh, 10 * d / t); t += np.clip(d, .005, .04)
    sh = np.clip(sh, 0, 1)
    kd = np.clip(N @ key, 0, 1) * sh
    fd = np.clip(N @ fill, 0, 1)
    sky = .5 + .5 * N[:, 1]
    fres = (1 - np.clip(N @ V, 0, 1)) ** 3
    rd = np.clip(N @ rim, 0, 1)
    col = SKIN[None] * (1.25 * kd[:, None] + .32 * fd[:, None] * np.array([1, .95, .9]) + .32 * (sky * ao)[:, None] * np.array([.8, .9, 1.05]))
    col += (.55 * rd * fres)[:, None] * np.array([1, .95, .88]) * .5
    col *= (.55 + .45 * ao)[:, None]
    return col

def render(fn, target, yaw, pitch, px, half, ss=1):
    """Orthographic render: `half` metres from the image centre to its edge, px x px pixels (ss x ss supersampled)."""
    right, up, back = camera(yaw, pitch)
    n = px * ss
    u = (np.arange(n) + .5) / n * 2 - 1
    U, Vv = np.meshgrid(u, -u)
    ro = target + (U.ravel()[:, None] * right + Vv.ravel()[:, None] * up) * half + back * .45
    rd = np.tile(-back, (len(ro), 1))
    t, hit = trace(fn, ro, rd, .9)
    img = np.tile(BG, (len(ro), 1)) * (1 - .25 * (Vv.ravel()[:, None] + 1) / 2)
    if hit.any():
        P = ro[hit] + rd[hit] * t[hit, None]
        N = normal(fn, P)
        # lights relative to the camera: key upper left-front, fill right, rim behind upper right
        key = back * .75 + up * .55 - right * .45; key /= np.linalg.norm(key)
        fill = back * .6 + right * .7 - up * .1; fill /= np.linalg.norm(fill)
        rim = -back * .8 + up * .35 + right * .5; rim /= np.linalg.norm(rim)
        img[hit] = shade(fn, P, N, back, (key, fill, rim))
    img = img.reshape(n, n, 3)
    if ss > 1: img = img.reshape(px, ss, px, ss, 3).mean((1, 3))
    return np.clip(img, 0, 1) ** (1 / 2.2)

def to_im(a): return Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))

def label(im, text, xy=(6, 4)):
    ImageDraw.Draw(im).text(xy, text, fill=(20, 20, 24))
    return im

def row(images, pad=4, bg=(255, 255, 255)):
    w = sum(i.width for i in images) + pad * (len(images) - 1); h = max(i.height for i in images)
    out = Image.new('RGB', (w, h), bg); x = 0
    for i in images: out.paste(i, (x, 0)); x += i.width + pad
    return out

def col(images, pad=4, bg=(255, 255, 255)):
    w = max(i.width for i in images); h = sum(i.height for i in images) + pad * (len(images) - 1)
    out = Image.new('RGB', (w, h), bg); y = 0
    for i in images: out.paste(i, (0, y)); y += i.height + pad
    return out

HEAD_H = .234   # crown to chin, for framing
def views(fn, o, px, names=('front', '3/4', 'side', 'top'), tag=''):
    target = o + np.array([0, -.025, .01])
    ims = []
    for name in names:
        yaw, pitch = VIEWS[name]
        tg = o + np.array([0, .0, .0]) if name == 'top' else target
        ims.append(label(to_im(render(fn, tg, yaw, pitch, px, .175, 1)), (tag + ' ' + name).strip()))
    return row(ims)

def tiny(fn, o, sizes=(15, 25, 35), names=('front', '3/4', 'side'), zoom=6):
    """Head at `s` px from crown to chin, in a frame twice the head height, 4x4 supersampled."""
    big, small = [], []
    for s in sizes:
        px = 2 * s; half = HEAD_H                      # frame = 2 head heights
        target = o + np.array([0, -.04, .01])
        ims = [to_im(render(fn, target, *VIEWS[n], px, half, 4)) for n in names]
        small.append(row(ims, 2))
        big.append(label(row([i.resize((i.width * zoom, i.height * zoom), Image.NEAREST) for i in ims], 6), '%d px head' % s))
    return col(big, 8), col(small, 4)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'shots'))
    ap.add_argument('--variant', nargs='*', default=None)
    ap.add_argument('--old', default=None, help='an older body_shapes.json to render as the "before" head')
    ap.add_argument('--size', type=int, default=320)
    ap.add_argument('--r1', default=None, help='a first-version body_shapes.json (with head blocks) for head_r1_compare.png')
    ap.add_argument('--skip', nargs='*', default=[], help='skip outputs: views tiny variants before')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    spec = json.load(open(os.path.join(HERE, 'body_shapes.json')))
    names = a.variant if a.variant is not None else list(spec['variants'])
    for name in names:
        fn, o = scene_new(spec, spec['variants'][name])
        if 'views' not in a.skip:
            views(fn, o, a.size, tag=name).save(os.path.join(a.out, 'head_%s_views.png' % name))
        if 'tiny' not in a.skip:
            big, small = tiny(fn, o)
            big.save(os.path.join(a.out, 'head_%s_tiny.png' % name)); small.save(os.path.join(a.out, 'head_%s_tiny_1x.png' % name))
        print('rendered', name, flush=True)
    if 'variants' not in a.skip and a.variant is None:
        rows = [views(*scene_new(spec, spec['variants'][n]), a.size * 3 // 4, ('front', '3/4', 'side'), n) for n in spec['variants']]
        row(rows, 10).save(os.path.join(a.out, 'head_variants.png'))
    if a.r1:
        first = json.load(open(a.r1)); v = spec['variants']['forward']
        f1 = scene_new(first, first['variants']['forward']); f2 = scene_new(spec, v)
        r1 = views(*f1, a.size, ('front', '3/4', 'side'), 'first version')
        r2 = views(*f2, a.size, ('front', '3/4', 'side'), 'fix round 1')
        t1, _ = tiny(*f1, sizes=(25,)); t2, _ = tiny(*f2, sizes=(25,))
        row([col([r1, label(t1, 'first version, 25 px', (6, 16))], 8), col([r2, label(t2, 'fix round 1, 25 px', (6, 16))], 8)], 16).save(
            os.path.join(a.out, 'head_r1_compare.png'))
        print('rendered r1 compare', flush=True)
    if a.old and 'before' not in a.skip:
        old = json.load(open(a.old)); v = spec['variants']['forward']
        before = views(*scene_old(old, old['variants']['forward']), a.size, ('front', '3/4', 'side'), 'before')
        after = views(*scene_new(spec, v), a.size, ('front', '3/4', 'side'), 'after')
        ob, osm = tiny(*scene_old(old, old['variants']['forward']), sizes=(25,))
        nb, nsm = tiny(*scene_new(spec, v), sizes=(25,))
        col([before, after, label(row([ob, nb], 12), 'tiny, 25 px head: before (left) / after (right)', (6, 16))], 8).save(os.path.join(a.out, 'head_before_after.png'))
        print('rendered before/after')
