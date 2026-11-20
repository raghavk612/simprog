// Pictures of the plays' motion, to judge it by eye (docs/MOTION-BRIEF.md, M0): for each play family
//   <family>-paths.png  top-down half court, every player's path coloured by speed (blue slow, yellow, red fast),
//                       the ball's path dotted, a mark every 0.5 s, a ring where each player starts
//   <family>-strip.png  eight top-down moments with each player's velocity arrow (a time-lapse)
//   <family>-ball.png   the ball's height, its distance to the hand holding it, and the speed of the shooter, his
//                       defender and a cutter, against time
// plus the same for the outcomes that move the ball differently (a miss and its rebound, a block, a steal).
//   npm run motion:render -- --out docs/motion/before            # the current motion version
//   npm run motion:render -- --out docs/motion/after --v 3
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './gym-harness.mjs';
import * as B from '../src/basketball.js';
import * as L from './motion-lib.mjs';

const root = new URL('..', import.meta.url).pathname,
  argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1];
  },
  out = path.resolve(root, opt('out', 'ui-shots/motion')),
  V = +opt('v', B.MOTION_VERSION);
fs.mkdirSync(out, { recursive: true });

const KIND_OF = {
    catch: 'catch',
    pullup: 'pullup',
    stepback: 'stepback',
    drive: 'drive',
    floater: 'floater',
    hook: 'hook',
    dunk: 'dunk',
    roll: 'roll',
  },
  CASES = [
    ...L.FAMILIES.map(f => ({
      name: f,
      clip: L.clipOf(KIND_OF[f] || f, { outcome: 'made' }, 'contested', 'home', 1),
    })),
    { name: 'pullup-miss', clip: L.clipOf('pullup', { outcome: 'miss' }, 'contested', 'home', 1) },
    {
      name: 'pullup-block',
      clip: L.clipOf(
        'pullup',
        { outcome: 'block', recovery: 'offense', putback: 'made' },
        'tight',
        'home',
        1,
      ),
    },
    { name: 'drive-steal', clip: L.clipOf('drive', { outcome: 'steal' }, 'tight', 'home', 1) },
    { name: 'catch-away', clip: L.clipOf('catch', { outcome: 'miss' }, 'open', 'away', -1) },
  ];

// the court, top down: x along the court (half court at 0, the home rim at 12.15), z across (sidelines at +-7.6)
const W = 900,
  H = 440,
  X0 = -2.5,
  X1 = 14.6,
  Z0 = -7.9,
  Z1 = 7.9,
  sx = x => ((x - X0) / (X1 - X0)) * W,
  sz = z => ((z - Z0) / (Z1 - Z0)) * H,
  speedColor = v => {
    // m/s: 0 blue, 3 cyan, 5 yellow, 7 orange, 9 red
    const k = Math.max(0, Math.min(1, v / 9)),
      stops = [
        [0, [40, 80, 220]],
        [0.33, [30, 190, 220]],
        [0.55, [235, 215, 40]],
        [0.78, [245, 130, 30]],
        [1, [220, 30, 40]],
      ];
    let i = 0;
    while (i < stops.length - 2 && k > stops[i + 1][0]) i++;
    const [a, ca] = stops[i],
      [b, cb] = stops[i + 1],
      u = (k - a) / (b - a);
    return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * u)).join(',')})`;
  };
function court(mirror = 1) {
  const rx = 12.15 * mirror,
    key = 19 * 0.328,
    lane = 6 * 0.328,
    arc = 22.15 * 0.328;
  return `<rect x="0" y="0" width="${W}" height="${H}" fill="#f3ead8"/>
<line x1="${sx(0)}" y1="0" x2="${sx(0)}" y2="${H}" stroke="#b9a98a" stroke-width="2"/>
<circle cx="${sx(0)}" cy="${sz(0)}" r="${(6 * 0.328 * W) / (X1 - X0)}" fill="none" stroke="#b9a98a" stroke-width="2"/>
<rect x="${sx(Math.min(rx, rx - key * mirror))}" y="${sz(-lane)}" width="${(key * W) / (X1 - X0)}" height="${sz(lane) - sz(-lane)}" fill="#e2d4f2" stroke="#b9a98a" stroke-width="2"/>
<path d="M ${sx(rx - 4.4 * mirror)} ${sz(-6.9)} A ${(arc * W) / (X1 - X0)} ${(arc * H) / (Z1 - Z0)} 0 0 ${mirror > 0 ? 0 : 1} ${sx(rx - 4.4 * mirror)} ${sz(6.9)}" fill="none" stroke="#b9a98a" stroke-width="2"/>
<circle cx="${sx(rx)}" cy="${sz(0)}" r="5" fill="none" stroke="#e05a00" stroke-width="2.5"/>
<line x1="${sx(rx + 0.41 * mirror)}" y1="${sz(-0.98)}" x2="${sx(rx + 0.41 * mirror)}" y2="${sz(0.98)}" stroke="#555" stroke-width="3"/>`;
}
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif">${body}</svg>`;

function pathsSVG(name, clip, S) {
  const off = clip.team === 'home' ? 0 : 5,
    mirror = clip.team === 'home' ? 1 : -1;
  let body = court(mirror);
  for (let i = 0; i < 10; i++) {
    const offense = i >= off && i < off + 5;
    for (let f = 1; f < S.length; f++) {
      const a = S[f - 1].actors[i],
        b = S[f].actors[i],
        d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d > 1.2) continue;
      body += `<line x1="${sx(a.x).toFixed(1)}" y1="${sz(a.z).toFixed(1)}" x2="${sx(b.x).toFixed(1)}" y2="${sz(b.z).toFixed(1)}" stroke="${speedColor(d * L.FPS * L.M)}" stroke-width="${offense ? 3.2 : 2.2}" stroke-linecap="round"${offense ? '' : ' stroke-dasharray="5 3"'}/>`;
    }
    for (let f = 0; f < S.length; f += 30) {
      const a = S[f].actors[i];
      body += `<circle cx="${sx(a.x).toFixed(1)}" cy="${sz(a.z).toFixed(1)}" r="2.2" fill="#222"/>`;
    }
    const a0 = S[0].actors[i],
      a1 = S.at(-1).actors[i];
    body += `<circle cx="${sx(a0.x)}" cy="${sz(a0.z)}" r="7" fill="none" stroke="${offense ? '#6832ab' : '#1d5fbf'}" stroke-width="2"/>`;
    body += `<text x="${sx(a1.x) + 7}" y="${sz(a1.z) - 6}" font-size="12" fill="${offense ? '#6832ab' : '#1d5fbf'}" font-weight="700">${i === off ? 'S' : i === 5 - off ? 'D' : i}</text>`;
  }
  let d = '';
  for (let f = 0; f < S.length; f++)
    d += `${f ? 'L' : 'M'}${sx(S[f].ball.x).toFixed(1)} ${sz(S[f].ball.z).toFixed(1)} `;
  body += `<path d="${d}" fill="none" stroke="#e8740c" stroke-width="2" stroke-dasharray="2 4"/>`;
  // legend
  body += `<rect x="8" y="8" width="356" height="46" fill="#fff" opacity="0.85"/><text x="14" y="25" font-size="14" font-weight="700">${name} (v${V}): ${clip.kind}, ${clip.outcome}, ${clip.contest}</text>`;
  for (let k = 0; k <= 9; k++)
    body += `<rect x="${14 + k * 22}" y="33" width="22" height="12" fill="${speedColor(k)}"/><text x="${17 + k * 22}" y="43" font-size="9" fill="#000">${k}</text>`;
  body += `<text x="238" y="43" font-size="11">m/s · offence solid, defence dashed · dot 0.5 s</text>`;
  return svg(W, H, body);
}

function stripSVG(name, clip, S) {
  const n = 8,
    w = 300,
    h = (w * H) / W,
    cols = 4,
    rows = 2,
    off = clip.team === 'home' ? 0 : 5,
    mirror = clip.team === 'home' ? 1 : -1;
  let body = `<rect width="${w * cols}" height="${(h + 18) * rows}" fill="#fff"/>`;
  for (let k = 0; k < n; k++) {
    const f = Math.round((k / (n - 1)) * (S.length - 1)),
      p = S[f],
      ox = (k % cols) * w,
      oy = Math.floor(k / cols) * (h + 18),
      tx = x => ox + (sx(x) * w) / W,
      tz = z => oy + 18 + (sz(z) * h) / H;
    body += `<g transform="translate(${ox},${oy + 18}) scale(${w / W})">${court(mirror)}</g>`;
    body += `<text x="${ox + 4}" y="${oy + 13}" font-size="12" font-weight="700">${(f / L.FPS).toFixed(2)} s · ${p.phase}</text>`;
    const prev = S[Math.max(0, f - 6)];
    for (let i = 0; i < 10; i++) {
      const a = p.actors[i],
        b = prev.actors[i],
        offense = i >= off && i < off + 5,
        vx = (a.x - b.x) * (L.FPS / Math.max(1, f - Math.max(0, f - 6))),
        vz = (a.z - b.z) * (L.FPS / Math.max(1, f - Math.max(0, f - 6)));
      body += `<line x1="${tx(a.x)}" y1="${tz(a.z)}" x2="${tx(a.x + vx * 0.3)}" y2="${tz(a.z + vz * 0.3)}" stroke="#333" stroke-width="1.5"/>`;
      body += `<circle cx="${tx(a.x)}" cy="${tz(a.z)}" r="${(0.45 * w) / (X1 - X0)}" fill="${offense ? '#6832ab' : '#1d5fbf'}" opacity="0.85"/>`;
      if (i === off) body += `<text x="${tx(a.x) - 3}" y="${tz(a.z) + 4}" font-size="9" fill="#fff">S</text>`;
    }
    body += `<circle cx="${tx(p.ball.x)}" cy="${tz(p.ball.z)}" r="${2 + p.ball.y * 1.2}" fill="#e8740c" stroke="#000" stroke-width="0.6"/>`;
  }
  return svg(w * cols, (h + 18) * rows, body);
}

function ballSVG(name, clip, S) {
  const w = 900,
    ph = 150,
    pad = 40,
    off = clip.team === 'home' ? 0 : 5,
    def = 5 - off,
    T = B.shotTiming(clip.kind),
    tx = f => pad + (f / (S.length - 1)) * (w - pad - 10),
    panel = (k, title, ymax, series, unit) => {
      const y0 = 10 + k * (ph + 26),
        ty = v => y0 + 20 + (ph - 20) * (1 - Math.min(1, Math.max(0, v / ymax)));
      let b = `<text x="${pad}" y="${y0 + 12}" font-size="13" font-weight="700">${title}</text>`;
      b += `<rect x="${pad}" y="${y0 + 20}" width="${w - pad - 10}" height="${ph - 20}" fill="#fafafa" stroke="#ccc"/>`;
      for (let g = 0; g <= 4; g++) {
        const v = (ymax * g) / 4;
        b += `<line x1="${pad}" x2="${w - 10}" y1="${ty(v)}" y2="${ty(v)}" stroke="#e6e6e6"/><text x="4" y="${ty(v) + 4}" font-size="10">${v.toFixed(v < 10 ? 1 : 0)}${g === 4 ? ' ' + unit : ''}</text>`;
      }
      for (const [u, label] of [
        [T.gather, 'gather'],
        [T.release, 'release'],
        [B.BALL.arrive, 'rim'],
      ])
        b += `<line x1="${tx(u * (S.length - 1))}" x2="${tx(u * (S.length - 1))}" y1="${y0 + 20}" y2="${y0 + ph}" stroke="#999" stroke-dasharray="3 3"/><text x="${tx(u * (S.length - 1)) + 3}" y="${y0 + 32}" font-size="10" fill="#666">${label}</text>`;
      for (const [vals, color, lab, li] of series) {
        let d = '';
        vals.forEach((v, f) => {
          if (v == null) return;
          d += `${d && vals[f - 1] != null ? 'L' : 'M'}${tx(f).toFixed(1)} ${ty(v).toFixed(1)} `;
        });
        b += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/><text x="${w - 200}" y="${y0 + 34 + li * 13}" font-size="11" fill="${color}">${lab}</text>`;
      }
      return b;
    };
  const hand = S.map(p => {
      const h = L.holderOf(p);
      return h?.hand ? Math.hypot(p.ball.x - h.hand[0], p.ball.y - h.hand[1], p.ball.z - h.hand[2]) : null;
    }),
    sp = i =>
      S.map((p, f) => {
        if (!f) return 0;
        const a = p.actors[i],
          b = S[f - 1].actors[i],
          d = Math.hypot(a.x - b.x, a.z - b.z);
        return d > 1.2 ? null : d * L.FPS * L.M;
      });
  let body = `<rect width="${w}" height="${3 * (ph + 26) + 10}" fill="#fff"/>`;
  body += panel(
    0,
    `${name} (v${V}): ball height (units; rim 3.28, floor ${S[0].ballRadius ?? B.BALL.floor})`,
    4.2,
    [[S.map(p => p.ball.y), '#e8740c', 'ball centre height', 0]],
    'u',
  );
  body += panel(
    1,
    'ball to the hand holding it (units; blank when nobody holds it)',
    1.2,
    [[hand, '#c0392b', 'ball to hand', 0]],
    'u',
  );
  body += panel(
    2,
    'player speed (m/s)',
    10,
    [
      [sp(off), '#6832ab', 'shooter', 0],
      [sp(def), '#1d5fbf', 'his defender', 1],
      [sp(off + 2), '#2e9e57', 'cutter', 2],
    ],
    'm/s',
  );
  return svg(w, 3 * (ph + 26) + 10, body);
}

const browser = await launch();
/* One page per picture, sized to it before anything is drawn (resizing a page between pictures captured half-drawn
   frames). */
async function png(file, s) {
  const [, w, h] = s.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/),
    size = { width: Math.ceil(+w), height: Math.ceil(+h) },
    page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;overflow:hidden">${s}</body></html>`);
  await page.screenshot({ path: file });
  await page.close();
}
for (const { name, clip } of CASES) {
  const c = { ...clip, v: V },
    S = L.samples(c);
  await png(`${out}/${name}-paths.png`, pathsSVG(name, c, S));
  await png(`${out}/${name}-strip.png`, stripSVG(name, c, S));
  await png(`${out}/${name}-ball.png`, ballSVG(name, c, S));
}
await browser.close();
console.log(`${CASES.length * 3} images in ${path.relative(root, out)}`);
