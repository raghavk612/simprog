"""A small numpy rasteriser for close-up checks of the cloud-meshed parts (orthographic, z-buffer, two lights).

    python3 -m cloudmesh.render OUT_DIR          (from assets-src/players)  # hands, sneakers and afro of every variant

Writes d1_<part>_<variant>.png contact sheets: hand front/side/palm, sneaker side/3-4, afro front/side/top. Shading is
flat-ish Lambert plus a rim term with the mesh's own vertex normals, and faint wireframe so the triangle budget shows.
"""
import os, sys
import numpy as np


def look(view):
    """Camera basis (right, up, toward viewer) for a named view, in the part's world frame."""
    def basis(fwd, up=(0, 1, 0)):
        f = np.asarray(fwd, float); f /= np.linalg.norm(f)
        r = np.cross(np.asarray(up, float), f); r /= np.linalg.norm(r)
        return np.stack([r, np.cross(f, r), f])
    return basis(view[0], view[1] if len(view) > 1 else (0, 1, 0))


def raster(V, F, N, cam, size=420, colors=None, wire=True, pad=.08, bounds=None):
    """Renders triangles (V, F) with vertex normals N seen along cam (3x3 rows: right, up, toward viewer)."""
    Q = V @ cam.T
    if bounds is None:
        lo, hi = Q[:, :2].min(0), Q[:, :2].max(0)
    else:
        lo, hi = bounds
    span = (hi - lo).max() * (1 + 2 * pad); c = (lo + hi) / 2
    s = size / span
    X = (Q[:, 0] - c[0]) * s + size / 2; Y = size / 2 - (Q[:, 1] - c[1]) * s; Z = Q[:, 2]
    img = np.ones((size, size, 3)) * np.array([.93, .93, .95]); zb = np.full((size, size), -np.inf)
    Nc = N @ cam.T
    L1 = np.array([-.5, .6, .62]); L1 /= np.linalg.norm(L1)
    L2 = np.array([.7, .1, .3]); L2 /= np.linalg.norm(L2)
    base = np.ones((len(F), 3)) * .72 if colors is None else np.asarray(colors, float)
    edge = np.zeros((size, size), bool)
    for t, (a, b, cc) in enumerate(F):
        xs, ys = X[[a, b, cc]], Y[[a, b, cc]]
        x0, x1 = int(max(0, np.floor(xs.min()))), int(min(size - 1, np.ceil(xs.max())))
        y0, y1 = int(max(0, np.floor(ys.min()))), int(min(size - 1, np.ceil(ys.max())))
        if x1 < x0 or y1 < y0: continue
        px, py = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        d = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0])
        if abs(d) < 1e-12: continue
        w1 = ((px - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (py - ys[0])) / d
        w2 = ((xs[1] - xs[0]) * (py - ys[0]) - (px - xs[0]) * (ys[1] - ys[0])) / d
        w0 = 1 - w1 - w2
        m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not m.any(): continue
        z = w0 * Z[a] + w1 * Z[b] + w2 * Z[cc]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        m &= z > sub
        if not m.any(): continue
        n = w0[..., None] * Nc[a] + w1[..., None] * Nc[b] + w2[..., None] * Nc[cc]
        n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)
        lam = .25 + .62 * np.clip(n @ L1, 0, 1) + .25 * np.clip(n @ L2, 0, 1) + .12 * (1 - np.clip(n[..., 2], 0, 1)) ** 2
        col = base[t] * lam[..., None]
        sub[m] = z[m]
        img[y0:y1 + 1, x0:x1 + 1][m] = col[m]
        if wire:
            e = (np.minimum(np.minimum(w0, w1), w2) * abs(d) / max(np.hypot(*(np.ptp(xs), np.ptp(ys))), 1e-6)) < .5
            edge[y0:y1 + 1, x0:x1 + 1][m] = e[m]
    if wire: img[edge] = img[edge] * .82
    return np.clip(img, 0, 1)


def sheet(images, path, labels=None):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, axs = plt.subplots(1, len(images), figsize=(3.4 * len(images), 3.6), dpi=110)
    axs = np.atleast_1d(axs)
    for i, (ax, im) in enumerate(zip(axs, images)):
        ax.imshow(im); ax.set_xticks([]); ax.set_yticks([])
        if labels: ax.set_title(labels[i], fontsize=9)
    fig.tight_layout(); fig.savefig(path); plt.close(fig)


def main(out, variants=None):
    import json
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here)
    import cloudmesh as cm
    os.makedirs(out, exist_ok=True)
    spec = json.load(open(os.path.join(here, 'body_shapes.json')))
    for v in variants or spec['variants']:
        m = cm.part_mesh(v, 'hand_L'); o, R = cm.part_frame(v, 'hand_L')
        V = (m['V'] - o) @ R; N = m['N'] @ R   # hand-local: +y fingers, +z dorsal, +x thumb
        views = [((0, 0, 1), (0, 1, 0)), ((1, 0, 0), (0, 1, 0)), ((0, 0, -1), (0, 1, 0)), ((.5, -.4, -.7), (0, 1, 0))]
        ims = [raster(V * [1, -1, 1], m['F'], N * [1, -1, 1], look(vw)) for vw in views]   # fingers down, as it hangs
        sheet(ims, os.path.join(out, 'd1_hand_%s.png' % v), ['back (dorsal)', 'side (thumb)', 'palm', '3/4 palm'])
        m = cm.part_mesh(v, 'shoe_L'); o, R = cm.part_frame(v, 'shoe_L')
        V = (m['V'] - o) @ R; N = m['N'] @ R
        col = np.where((m['mat'] == 'sole')[:, None], [.95, .95, .93], [.25, .3, .62])
        views = [((1, 0, 0),), ((-1, 0, 0),), ((.75, .35, .6),), ((-.6, .3, .75),), ((0, 1, 0), (0, 0, 1))]
        ims = [raster(V, m['F'], N, look(vw), colors=col) for vw in views]
        sheet(ims, os.path.join(out, 'd1_shoe_%s.png' % v), ['lateral side', 'medial side', '3/4 front lateral', '3/4 front medial', 'top'])
        m = cm.part_mesh(v, 'hair_afro'); o, R = cm.part_frame(v, 'hair_afro')
        V = (m['V'] - o) @ R; N = m['N'] @ R
        hv, hf, hn = cm.head_mesh(v)
        Vs = np.vstack([V, hv]); Fs = np.vstack([m['F'], hf + len(V)]); Ns = np.vstack([N, hn])
        col = np.vstack([np.tile([.22, .17, .14], (len(m['F']), 1)), np.tile([.62, .44, .33], (len(hf), 1))])
        views = [((0, 0, 1),), ((1, 0, 0),), ((0, 1, 0), (0, 0, -1)), ((-.7, .2, .7),), ((0, 0, -1),)]
        ims = [raster(Vs, Fs, Ns, look(vw), colors=col) for vw in views]
        sheet(ims, os.path.join(out, 'd1_afro_%s.png' % v), ['front', 'side', 'top', '3/4', 'back'])
        print(v, 'rendered')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:] or None)
