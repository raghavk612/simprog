// How the shoes read at the Auto camera (the broadcast view): the possession of scripts/players-shots.mjs, Game day opened
// through the UI, at its fixed moments. Each moment is drawn as the player sees it, then once more as a mask (players in
// flat colours, one per player, shoes apart from the rest of the body, nothing else drawn), and per player:
//   contrast  |mean luminance of his shoe pixels - mean luminance of the floor round them| (relative luminance, 0..1;
//             the floor: within 4 px (desktop) of the shoe and not on any player)
//   colour    the mean colour of his shoe pixels (CIE L*a*b*, hue angle)
// Prints per team and overall, and writes JSON with --out.
//   node scripts/shoe-contrast.mjs [--level medium] [--sizes desktop] [--out ui-shots/shoe-contrast.json]
// Use flock /tmp/kangs-browser.lock when another job shares the machine.
import fs from 'node:fs';
import path from 'node:path';
import { root, serve, launch, fixture, openGym, takeOver, toGame, forceLevel } from './gym-harness.mjs';

const argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1];
  },
  level = opt('level', 'medium'),
  sizes = opt('sizes', 'desktop').split(','),
  out = opt('out');
const SIZES = {
    desktop: { size: [1440, 900], dpr: 1, ring: 4 },
    phone: { size: [390, 844], dpr: 2, ring: 6 },
  },
  AUTO = [0.8, 2.2, 3.6, 5.9, 7.6];

/* In the page: the frame, then the mask, then the numbers. */
function measure(ring) {
  const a = window.__kangsArena,
    g = window.__gym,
    src = a.renderer.domElement,
    W = src.width,
    H = src.height,
    grab = () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0);
      return x.getImageData(0, 0, W, H).data;
    };
  g.setDt(0);
  a.frame();
  g.setDt(1 / 60);
  const frame = grab();
  // the mask: every player mesh in a flat colour (shoes rgb(255, 10 + 20k, 0), the rest rgb(0, 10 + 20k, 255)), all else hidden
  const saved = [],
    inPlayer = new Map();
  a.people.forEach((p, k) => p.traverse(o => inPlayer.set(o, k)));
  const flat = css => {
    const m = a.capMat.clone(); // a MeshBasicMaterial of the page's own three.js, not tone mapped
    m.map = null;
    m.color.setStyle(css);
    return m;
  };
  a.scene.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    const k = inPlayer.get(o);
    saved.push([o, o.visible, o.material]);
    if (k == null) o.visible = false;
    else {
      const shoe = /^(shoes|sole)$/.test(o.material?.name || '') || o.parent?.name === 'shoes_mesh';
      o.material = flat(shoe ? `rgb(255, ${10 + 20 * k}, 0)` : `rgb(0, ${10 + 20 * k}, 255)`);
    }
  });
  const bg = a.scene.background,
    fog = a.scene.fog,
    clear = a.renderer.getClearColor(a.capMat.color.clone()),
    alpha = a.renderer.getClearAlpha();
  a.scene.background = null;
  a.scene.fog = null;
  a.renderer.setClearColor(0x000000, 1);
  a.renderer.setRenderTarget(null);
  a.renderer.render(a.scene, a.camera);
  const mask = grab();
  for (const [o, v, m] of saved) {
    if (o.material !== m) o.material.dispose();
    o.visible = v;
    o.material = m;
  }
  a.scene.background = bg;
  a.scene.fog = fog;
  a.renderer.setClearColor(clear, alpha);
  // classify: 0 nothing, 1 body, 2 shoe; who
  const kind = new Uint8Array(W * H),
    who = new Int8Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    const r = mask[i * 4],
      gg = mask[i * 4 + 1],
      b = mask[i * 4 + 2],
      k = Math.round((gg - 10) / 20);
    if (r < 8 && gg < 8 && b < 8) continue;
    kind[i] = 1; // anything drawn is a player (edges included), never floor
    if (k >= 0 && k < 10 && Math.abs(gg - (10 + 20 * k)) <= 5) {
      if (r > 235 && b < 20) ((kind[i] = 2), (who[i] = k));
    }
  }
  const lin = v => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4),
    Y = i => 0.2126 * lin(frame[i * 4]) + 0.7152 * lin(frame[i * 4 + 1]) + 0.0722 * lin(frame[i * 4 + 2]);
  const players = [];
  for (let k = 0; k < 10; k++) {
    let n = 0,
      sy = 0,
      sr = 0,
      sg = 0,
      sb = 0,
      rn = 0,
      ry = 0;
    const ringSeen = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (who[i] !== k) continue;
      n++;
      sy += Y(i);
      sr += lin(frame[i * 4]);
      sg += lin(frame[i * 4 + 1]);
      sb += lin(frame[i * 4 + 2]);
      const x0 = i % W,
        y0 = (i / W) | 0;
      for (let dy = -ring; dy <= ring; dy++)
        for (let dx = -ring; dx <= ring; dx++) {
          const x = x0 + dx,
            y = y0 + dy;
          if (x < 0 || y < 0 || x >= W || y >= H || dx * dx + dy * dy > ring * ring) continue;
          const j = y * W + x;
          if (kind[j] || ringSeen[j]) continue;
          ringSeen[j] = 1;
          rn++;
          ry += Y(j);
        }
    }
    if (n < 4 || rn < 4) continue;
    const look = a.people[k].userData.body?.look;
    players.push({
      k,
      look: look ? `${look.socks ?? ''}${look.shoe ?? ''}` : '',
      pixels: n,
      shoeY: sy / n,
      floorY: ry / rn,
      rgb: [sr / n, sg / n, sb / n],
    });
  }
  return players;
}

/* CIE L*a*b* of a linear RGB colour (D65). */
const lab = ([r, g, b]) => {
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116),
    x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047),
    y = f(0.2126 * r + 0.7152 * g + 0.0722 * b),
    z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

const srv = await serve('dev'),
  browser = await launch(),
  { save, event } = fixture(),
  result = { level, moments: AUTO, sizes: {} };
try {
  for (const sz of sizes) {
    const { size, dpr, ring } = SIZES[sz];
    const { page, context, errors } = await openGym(browser, srv.url, {
      level,
      players: 'athletes',
      save,
      size,
      dpr,
    });
    await page.addStyleTag({ content: '.perf-hud{display:none!important}' });
    await takeOver(page);
    await toGame(page, null);
    await forceLevel(page, level);
    await page.evaluate(e => {
      const a = window.__kangsArena;
      a.clear();
      a.setView('auto');
      a.play(e, { replay: false });
      a.speed = 1;
      window.__gym.setDt(1 / 60);
    }, event);
    const rows = [];
    for (const t of AUTO) {
      await page.evaluate(t => window.__gym.until(x => x.playTime >= t, 3000, true), t);
      for (const p of await page.evaluate(measure, ring)) rows.push({ t, ...p });
    }
    if (errors.length) console.warn(`${sz}: page errors\n  ${errors.join('\n  ')}`);
    await context.close();
    const team = home => rows.filter(r => r.k < 5 === home),
      sum = list => {
        const L = list.map(r => lab(r.rgb)),
          a = mean(L.map(l => l[1])),
          b = mean(L.map(l => l[2]));
        return {
          samples: list.length,
          pixels: Math.round(mean(list.map(r => r.pixels))),
          contrast: +mean(list.map(r => Math.abs(r.shoeY - r.floorY))).toFixed(4),
          shoeY: +mean(list.map(r => r.shoeY)).toFixed(4),
          floorY: +mean(list.map(r => r.floorY)).toFixed(4),
          lab: [mean(L.map(l => l[0])), a, b].map(v => +v.toFixed(1)),
          chroma: +Math.hypot(a, b).toFixed(1),
          hue: +(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360).toFixed(1),
        };
      };
    const s = { all: sum(rows), home: sum(team(true)), visitors: sum(team(false)), rows };
    s.teamColourDistance = +Math.hypot(
      s.home.lab[1] - s.visitors.lab[1],
      s.home.lab[2] - s.visitors.lab[2],
    ).toFixed(1);
    s.colourSpread = +mean(
      rows.map(r => {
        const l = lab(r.rgb);
        return Math.hypot(l[1] - s.all.lab[1], l[2] - s.all.lab[2]);
      }),
    ).toFixed(1);
    result.sizes[sz] = s;
    for (const k of ['all', 'home', 'visitors'])
      console.log(`${level} ${sz} ${k.padEnd(8)} ${JSON.stringify(s[k])}`);
    console.log(
      `${level} ${sz} home vs visitors a*b* distance ${s.teamColourDistance}; mean a*b* distance of a player's shoes from all players' mean ${s.colourSpread}`,
    );
  }
} finally {
  await browser.close();
  await srv.close();
}
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
  fs.writeFileSync(path.resolve(root, out), JSON.stringify(result, null, 1));
  console.log(`-> ${out}`);
}
