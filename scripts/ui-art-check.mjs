// Checks the still renders in public/images/ui (src/ui/art.js) in Chrome: which image files each page asks for (a hidden
// render must not be downloaded), that the coin and whistle fall back to their SVG when the image fails, in high contrast
// and in forced colours, and a screenshot of each place a render is wired. Prints one line per scenario and exits 1 on a
// problem.  npm run check:art [-- --out ui-shots/game-nav-t4]
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import * as E from '../src/engine.js';

const args = process.argv.slice(2),
  root = new URL('..', import.meta.url).pathname,
  out = `${root}${args.find(a => a.startsWith('--out='))?.slice(6) ?? 'ui-shots/game-nav-t4'}`;
fs.mkdirSync(out, { recursive: true });
const data = JSON.parse(fs.readFileSync(`${root}public/data/kangs.json`, 'utf8'));
const fresh = E.createGame(data, 'Taylor', 'standard', 7);
E.autoLineup(fresh);
const live = structuredClone(fresh);
E.endBreak(live);
E.startMatch(live);
for (let i = 0; i < 6; i++) E.possession(live);
const saves = { pre: fresh, live };

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0],
  browser = await chromium.launch({ channel: 'chrome' }),
  problems = [];

// Opens the app with a save and settings, goes to each view and returns the image files asked for, per view.
async function run(
  name,
  { save = 'pre', size = [1440, 900], settings = {}, ctx = {}, views, abort, shotViews = [] },
) {
  const page = await browser.newPage({
      viewport: { width: size[0], height: size[1] },
      reducedMotion: 'reduce',
      ...ctx,
    }),
    asked = [],
    every = new Set();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('request', r => {
    const m = /\/images\/ui\/([^?]+)/.exec(r.url());
    if (m) {
      asked.push(m[1]);
      every.add(m[1]);
    }
  });
  if (abort) await page.route(abort, r => r.abort());
  await page.addInitScript(
    ([s, set]) => {
      localStorage.setItem('kangs-three-season-v2', s);
      localStorage.setItem(
        'kangs_accessibility',
        JSON.stringify({ reducedMotion: true, graphics: 'low', ...set }),
      );
    },
    [JSON.stringify(saves[save]), settings],
  );
  await page.goto(url);
  await page.waitForSelector('[data-action="continue"]');
  await page.click('[data-action="continue"]');
  const result = {};
  for (const v of views) {
    asked.length = 0;
    await page.evaluate(v => {
      const b = document.createElement('button');
      b.dataset.view = v;
      document.querySelector('#app').append(b);
      b.click();
    }, v);
    await page.waitForTimeout(700);
    result[v] = {
      files: [...new Set(asked)],
      hero: await page.evaluate(() => !!document.querySelector('.page-head .ph-hero')),
      glyphs: await page.evaluate(() =>
        [...document.querySelectorAll('.art-glyph')].map(g => {
          const vis = e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
          return {
            img: vis(g.querySelector('picture')),
            svg: vis(g.querySelector('svg')),
            loaded: g.querySelector('img')?.complete && g.querySelector('img')?.naturalWidth > 0,
          };
        }),
      ),
    };
    if (shotViews.includes(v)) await page.screenshot({ path: `${out}/${name}-${v}.png`, fullPage: true });
  }
  result.all = [...every];
  await page.close();
  return result;
}
const expect = (ok, msg) => ok || problems.push(msg);
const has = (r, v, re) => r[v].files.some(f => re.test(f));

// 1. A desktop: every render is fetched where it is shown (AVIF, one of 1x or 2x), nothing for the live game's header.
for (const theme of ['dark', 'light']) {
  const r = await run(`desk-${theme}`, {
    settings: { lightTheme: theme === 'light' },
    views: ['season', 'bracket', 'skills', 'practice', 'roster', 'recruit', 'game'],
    shotViews: ['season', 'bracket', 'skills', 'practice'],
  });
  expect(has(r, 'season', /^empty-journal\.avif$/), `${theme}: Journal empty render not fetched`);
  expect(has(r, 'bracket', /^empty-bracket\.avif$/), `${theme}: Bracket render not fetched`);
  expect(has(r, 'skills', /^empty-skills\.avif$/), `${theme}: Skills render not fetched`);
  expect(has(r, 'practice', /^hero-week\.avif$/), `${theme}: header render not fetched`);
  expect(
    r.season.glyphs.length === 2 && r.season.glyphs.every(g => g.img && !g.svg && g.loaded),
    `${theme}: coin and whistle render`,
  );
  console.log(
    `desk-${theme}`,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(r)
          .filter(([v]) => v !== 'all')
          .map(([v, x]) => [v, x.files]),
      ),
    ),
  );
}
// 2. A wide screen (the floor and its grain in the margins), and a phone (no header render, no bracket render).
await run('wide-dark', { size: [1920, 1000], views: ['season'], shotViews: ['season'] });
await run('wide-light', {
  size: [1920, 1000],
  settings: { lightTheme: true },
  views: ['season'],
  shotViews: ['season'],
});
for (const theme of ['dark', 'light']) {
  const r = await run(`phone-${theme}`, {
    size: [390, 844],
    settings: { lightTheme: theme === 'light' },
    views: ['season', 'bracket', 'skills', 'practice'],
    shotViews: ['season', 'bracket', 'skills'],
  });
  for (const v of ['season', 'bracket', 'skills', 'practice'])
    expect(!has(r, v, /^hero-/), `phone ${theme} ${v}: header render fetched`);
  expect(!has(r, 'bracket', /^empty-bracket/), `phone ${theme}: hidden bracket render fetched`);
  console.log(
    `phone-${theme}`,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(r)
          .filter(([v]) => v !== 'all')
          .map(([v, x]) => [v, x.files]),
      ),
    ),
  );
}
// 3. The live game at 1440: the header is hidden, so its render must not be fetched. Control: Game day before tip-off asks.
{
  const r = await run('live', { save: 'live', views: ['game'], shotViews: ['game'] }),
    c = await run('pretip', { save: 'pre', views: ['game'] });
  expect(
    r.game.hero === false && !has(r, 'game', /^hero-/),
    `live game fetched or drew the header render: ${r.game.files}`,
  );
  expect(
    c.game.hero && has(c, 'game', /^hero-week\./),
    `control: Game day before tip-off should fetch the render: ${c.game.files}`,
  );
  console.log(
    'live game: every image file the page asked for from load to the Game page',
    JSON.stringify(r.all),
    'header render in DOM:',
    r.game.hero,
  );
  console.log('control (Game day before tip-off), same run', JSON.stringify(c.all));
}
// 4. High contrast and forced colours: SVG glyphs, no render shown, and forced colours fetch no decoration.
{
  const hc = await run('hc', {
    settings: { highContrast: true },
    views: ['season', 'bracket', 'skills'],
    shotViews: ['season', 'skills'],
  });
  expect(
    hc.season.glyphs.every(g => g.svg && !g.img),
    'high contrast: glyphs must be the SVG',
  );
  const fc = await run('forced', {
    ctx: { forcedColors: 'active' },
    views: ['season', 'bracket', 'skills'],
    shotViews: ['season', 'skills'],
  });
  expect(
    fc.season.glyphs.length === 2 && fc.season.glyphs.every(g => g.svg && !g.img),
    'forced colours: glyphs must be the SVG',
  );
  for (const v of ['season', 'bracket', 'skills'])
    expect(!has(fc, v, /^(hero|empty|coin|whistle)/), `forced colours ${v}: fetched ${fc[v].files}`);
  console.log(
    'forced colours files',
    JSON.stringify(
      Object.fromEntries(
        Object.entries(fc)
          .filter(([v]) => v !== 'all')
          .map(([v, x]) => [v, x.files]),
      ),
    ),
  );
}
// 5. An image that fails: the glyph box shows its SVG, never an empty box, and a second render does not ask again.
{
  const f = await run('broken', {
    abort: /\/(coin|whistle)-/,
    views: ['season', 'bracket', 'season'],
    shotViews: ['season'],
  });
  for (const v of ['season', 'bracket'])
    expect(
      f[v].glyphs.length === 2 && f[v].glyphs.every(g => g.svg && !g.img),
      `broken images ${v}: ${JSON.stringify(f[v].glyphs)}`,
    );
  expect(
    !f.bracket.files.some(x => /^(coin|whistle)/.test(x)),
    `a later render asked again: ${f.bracket.files}`,
  );
  console.log(
    'broken: requests of the first render',
    JSON.stringify(f.all.filter(x => /^(coin|whistle)/.test(x))),
  );
}
await browser.close();
await server.close();
console.log(problems.length ? problems.join('\n') : 'ui-art-check: no problems found');
process.exit(problems.length ? 1 : 0);
