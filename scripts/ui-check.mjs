// Opens every page in a real browser and reports what tests cannot see: script errors, text with too little
// contrast, and pages wider than a phone. With --shots it also saves a screenshot of each page for review.
//
//   npm run check:ui                 # report only; exits 1 if anything is found
//   npm run check:ui -- --shots      # also save screenshots to ui-shots/ (git-ignored)
//   npm run check:ui -- --only=light # only the runs whose name contains "light" (e.g. phone, desktop, dark, pre)
//
// It starts its own Vite server and builds its saves from the engine, so nothing needs to be running. It drives
// the installed Google Chrome through playwright-core (no browser download).
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import * as E from '../src/engine.js';

const args = process.argv.slice(2),
  shots = args.includes('--shots'),
  only = args.find(a => a.startsWith('--only='))?.slice(7);
const root = new URL('..', import.meta.url).pathname,
  out = `${root}ui-shots`;
const VIEWS = [
  'home',
  'roster',
  'practice',
  'game',
  'season',
  'bracket',
  'standings',
  'data',
  'recruit',
  'staff',
  'skills',
  'locker',
];
const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const MIN_CONTRAST = 4.5; // WCAG AA for normal text; large text needs 3 (see required() in lowContrast)

// Saves to open: preseason (break pages open), and one game into the season.
function fixtures() {
  const data = JSON.parse(fs.readFileSync(`${root}public/data/kangs.json`, 'utf8'));
  const pre = E.createGame(data, 'Taylor', 'standard', 7);
  E.autoLineup(pre);
  const mid = structuredClone(pre);
  E.endBreak(mid);
  E.startMatch(mid);
  while (mid.match) E.possession(mid);
  return { pre, mid };
}

// Runs in the page: visible text under MIN_CONTRAST against the nearest opaque background behind it.
function lowContrast(min) {
  const parse = c => {
    // color-mix() computes to color(srgb r g b / a) with channels from 0 to 1.
    const s = /color\(srgb ([^)]+)\)/.exec(c);
    if (s) {
      const [r, g, b, a = 1] = s[1].split(/[ /]+/).filter(Boolean).map(Number);
      return { r: r * 255, g: g * 255, b: b * 255, a };
    }
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = el => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return null; // over an image or gradient: cannot judge
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.85) return c;
    }
    return parse(getComputedStyle(document.body).backgroundColor);
  };
  // The contrast a piece of text needs, from its computed style (cs.fontSize is like '14px', cs.fontWeight like '700').
  // WCAG AA: large text (24px, or 18.66px bold) needs 3:1; anything smaller needs `min` (4.5:1 for full AA).
  const required = cs => {
    const px = parseFloat(cs.fontSize),
      bold = +cs.fontWeight >= 700;
    return px >= 24 || (bold && px >= 18.66) ? 3 : min;
  };
  const found = new Map();
  for (const el of document.querySelectorAll('main *, .subnav *, .topbar *, dialog[open] *')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(),
      cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (el.closest('#arena, button:disabled, [aria-hidden="true"], .sr-only')) continue;
    const fg = parse(cs.color),
      bg = bgOf(el);
    if (!fg || !bg) continue;
    const [a, b] = [lum(fg), lum(bg)],
      ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const key = `${el.tagName.toLowerCase()}${[...el.classList].map(c => '.' + c).join('')}`;
    if (ratio < required(cs) && !found.has(key))
      found.set(key, `${ratio.toFixed(2)}:1 "${el.textContent.trim().slice(0, 40)}"`);
  }
  return [...found].map(([k, v]) => `low contrast ${v} on ${k}`);
}

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0];
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
} catch (e) {
  await server.close();
  console.error(
    'ui-check needs Google Chrome installed (it uses playwright-core with channel "chrome").\n' + e.message,
  );
  process.exit(2);
}
if (shots) fs.mkdirSync(out, { recursive: true });
const saves = fixtures(),
  problems = [];
for (const [device, [w, h]] of Object.entries(VIEWPORTS))
  for (const theme of ['dark', 'light'])
    for (const [name, save] of Object.entries(saves)) {
      const run = `${device}-${theme}-${name}`;
      if (only && !run.includes(only)) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      page.on('pageerror', e => problems.push(`${run}: script error: ${e.message}`));
      await page.addInitScript(
        ([s, light]) => {
          localStorage.setItem('kangs-three-season-v2', s);
          localStorage.setItem(
            'kangs_accessibility',
            JSON.stringify({ lightTheme: light, reducedMotion: true }),
          );
        },
        [JSON.stringify(save), theme === 'light'],
      );
      await page.goto(url);
      await page.waitForSelector('[data-action="continue"]');
      await page.click('[data-action="continue"]');
      for (const v of VIEWS) {
        // Open the page the way a data-view button would (break pages fall back to Home outside a break).
        await page.evaluate(v => {
          const b = document.createElement('button');
          b.dataset.view = v;
          document.querySelector('#app').append(b);
          b.click();
        }, v);
        await page.waitForTimeout(200);
        const shown = await page.evaluate(() => document.body.dataset.view);
        if (shown !== v) continue;
        for (const p of await page.evaluate(lowContrast, MIN_CONTRAST)) problems.push(`${run}/${v}: ${p}`);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (wide > 1) problems.push(`${run}/${v}: page is ${wide}px wider than the screen`);
        if (shots) await page.screenshot({ path: `${out}/${run}-${v}.png`, fullPage: true });
      }
      await page.close();
    }
await browser.close();
await server.close();
console.log(problems.length ? problems.join('\n') : 'ui-check: no problems found');
if (shots) console.log(`Screenshots: ${out}`);
process.exit(problems.length ? 1 : 0);
