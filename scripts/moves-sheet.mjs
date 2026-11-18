// Renders a ball-handling move (src/moves) as a contact sheet: rows are moments, columns are cameras, through the same code
// the game uses (preview-moves.html). Also prints the move's measurements (src/moves/check.js) and any problems.
//
//   node scripts/moves-sheet.mjs --move crossover                      # every 0.05 s, cameras front,left,top
//   node scripts/moves-sheet.mjs --move crossover --hand L --every 0.03 --cams front,low --out /tmp/x.png
//   node scripts/moves-sheet.mjs --move crossover --times 0,0.13,0.3,0.55
//   node scripts/moves-sheet.mjs --move stepbackJumper --ctx title --cams wide,front
//   node scripts/moves-sheet.mjs --routine 7 --from 0 --to 12 --every 0.4 --cams title --follow
//   node scripts/moves-sheet.mjs --file between --move betweenLegs   # load one family file only (src/moves/between.js)
//
// Cameras (he stands at the origin facing the camera "front"): front, title, left (his left side), right, back, top,
// low (knee height, for between-the-legs), wide; b-<camera> (e.g. b-front) turns with him; with --ctx title also rim. Output defaults to ui-shots/moves/<move>-<hand>.png (git-ignored).
// Needs Google Chrome (playwright-core, channel "chrome"); starts its own Vite server.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (a, v, i, all) =>
        v.startsWith('--')
          ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]]]
          : a,
      [],
    ),
);
const root = new URL('..', import.meta.url).pathname;
const move = args.move || (args.routine ? null : 'crossover'),
  hand = args.hand || 'R',
  cams = String(args.cams || 'front,left,top').split(',');
const { MOVES, mirrorMove, dribbleMove } = await import(`${root}src/moves/index.js`);
const { analyse, summary } = await import(`${root}src/moves/check.js`);
let ctx = null;
if (args.ctx === 'title') {
  const { HERO, heroYaw } = await import(`${root}src/title.js`);
  const { courtContext } = await import(`${root}src/moves/context.js`);
  const c = courtContext({ x: HERO.x, z: HERO.z, yaw: heroYaw() });
  ctx = { rim: c.rim, feeder: c.feeder };
}
let duration = +(args.to || 0);
// --file: one family file on its own, so a half-written file elsewhere cannot break this
const lib = args.file ? (await import(`${root}src/moves/${args.file}.js?t=${Date.now()}`)).default : MOVES;
if (move) {
  const def = move === 'dribble' ? dribbleMove('R') : lib.find(m => m.id === move);
  if (!def) {
    console.error(`No move "${move}". Moves: ${lib.map(m => m.id).join(', ')}`);
    process.exit(2);
  }
  const a = analyse(hand === def.start ? def : mirrorMove(def), { ctx });
  console.log(summary(a));
  duration = a.duration;
}
const from = +(args.from || 0),
  to = args.to != null ? +args.to : duration,
  every = +(args.every || 0.05);
const times = args.times
  ? String(args.times).split(',').map(Number)
  : Array.from(
      { length: Math.floor((to - from) / every + 1e-6) + 1 },
      (_, i) => +(from + i * every).toFixed(4),
    );
if (move && !times.includes(+duration.toFixed(4)) && !args.times) times.push(+duration.toFixed(4));
const out =
  args.out || path.join(root, 'ui-shots', 'moves', `${move || `routine-${args.routine}`}-${hand}.png`);
fs.mkdirSync(path.dirname(out), { recursive: true });

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${port}/preview-moves.html${args.variant ? `?variant=${args.variant}` : ''}`,
  );
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const res = await page.evaluate(o => window.renderSheet(o), {
    move,
    hand,
    routine: args.routine
      ? { seed: +args.routine, entrance: args.entrance ? { from: [0.5, -3.4] } : null }
      : null,
    ctx: args.ctx || null,
    file: args.file || null,
    times,
    cams,
    follow: !!args.follow,
    label: `${move || 'routine ' + args.routine} (${hand})`,
  });
  await page.locator('#sheet').screenshot({ path: out });
  if (args.report) for (const r of res.report) console.log(JSON.stringify(r)); // --report: where the wrists really went
  if (errors.length) console.log('Page errors:\n' + errors.join('\n'));
  console.log(`Sheet: ${out} (${res.width}x${res.height}, ${times.length} moments x ${cams.length} cameras)`);
} finally {
  await browser.close();
  await server.close();
}
