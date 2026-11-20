// The Auto quality ladder (src/graphics.js autoStep) on emulated weak hardware: the built game on Auto, real frames (not
// stepped), plays running, the CPU slowed with Chrome's own throttling (CDP Emulation.setCPUThrottlingRate), then
// released. Prints a timeline of the level Auto picks and the frame rate, and checks it steps down under load and back
// up once the load is gone.
//   node scripts/auto-ladder.mjs                       # 4x and 6x, 1366x768 at 1x
//   node scripts/auto-ladder.mjs --rates 6 --size 1024x600 --dpr 1 --phase 45
//   node scripts/auto-ladder.mjs --gpu                 # also a GPU that many times slower (see below)
// CDP cannot slow the GPU, and on a fast GPU even 6x CPU leaves High well above the step-down threshold. --gpu emulates a
// GPU `rate` times slower as well: each frame's render is synced (a 1-pixel read) and timed, then the page waits
// (rate - 1) times as long, so the extra cost scales with what the level draws, as on a weak device.
import { execSync } from 'node:child_process';
import { serve, launch, fixture, restage, openGym, toGame, stagePlay, fullFrame } from './gym-harness.mjs';

const root = new URL('..', import.meta.url).pathname,
  argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1];
  },
  rates = String(opt('rates', '4,6')).split(',').map(Number),
  size = String(opt('size', '1366x768')).split('x').map(Number),
  dpr = +opt('dpr', 1),
  phase = +opt('phase', 45) * 1000, // ms under load, and again after it
  gpu = argv.includes('--gpu');
if (!opt('no-build')) execSync('npm run build', { cwd: root, stdio: 'ignore' });

const srv = await serve('build'),
  browser = await launch(),
  { save, event } = fixture(),
  live = restage(
    event,
    { kind: 'drive', outcome: 'made', points: 2, contest: 'contested' },
    { kind: 'pullup', outcome: 'miss', points: 0 },
  ),
  results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  for (const rate of rates) {
    const { page, context, errors } = await openGym(browser, srv.url, { level: 'auto', save, size, dpr });
    const cdp = await context.newCDPSession(page);
    await toGame(page, null);
    await fullFrame(page);
    await page.addStyleTag({ content: '.perf-hud{display:none!important}' });
    // frame times measured in the page (requestAnimationFrame, the browser's own loop)
    await page.evaluate(() => {
      const t = [];
      let last = 0;
      const tick = now => {
        if (last) t.push(now - last);
        if (t.length > 240) t.shift();
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.__fps = () => {
        const a = [...t].sort((x, y) => x - y);
        return a.length ? 1000 / a[a.length >> 1] : 0;
      };
    });
    // the slow GPU (--gpu): the render waits (__gpuX - 1) times its own synced time
    await page.evaluate(() => {
      const a = window.__kangsArena,
        gl = a.renderer.getContext(),
        px = new Uint8Array(4),
        render = a.look.render.bind(a.look);
      window.__gpuX = 1;
      a.look.render = cam => {
        const t = performance.now();
        render(cam);
        if (window.__gpuX <= 1) return;
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const until = performance.now() + (performance.now() - t) * (window.__gpuX - 1);
        while (performance.now() < until);
      };
    });
    const timeline = [],
      t0 = Date.now(),
      sample = async label => {
        const s = await page.evaluate(() => {
          const a = window.__kangsArena;
          if (!a.isPlaying()) {
            a.play(window.__live, {});
            a.speed = 1;
          }
          return { level: a.level, fps: window.__fps(), locked: !!a.probe?.state?.locked };
        });
        const last = timeline.at(-1);
        timeline.push({ t: (Date.now() - t0) / 1000, label, ...s });
        if (!last || last.level !== s.level || last.label !== label)
          console.log(
            `  ${rate}x ${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${label.padEnd(9)} ${s.level.padEnd(6)} ${s.fps.toFixed(0).padStart(4)} fps${s.locked ? '  (step up locked)' : ''}`,
          );
      };
    await page.evaluate(e => (window.__live = e), live);
    await stagePlay(page, live, { mode: 'auto' });
    const run = async (label, ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        await sample(label);
        await sleep(500);
      }
    };
    console.log(
      `${rate}x CPU throttling${gpu ? ` and a ${rate}x slower GPU` : ''}, ${size.join('x')} at ${dpr}x:`,
    );
    await run('normal', 15000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    if (gpu) await page.evaluate(r => (window.__gpuX = r), rate);
    await run(`${rate}x CPU`, phase);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => (window.__gpuX = 1));
    await run('released', phase + 15000);
    const levels = label => timeline.filter(s => s.label === label),
      fpsOf = arr => (arr.length ? arr.reduce((s, x) => s + x.fps, 0) / arr.length : 0),
      under = levels(`${rate}x CPU`),
      after = levels('released'),
      r = {
        rate,
        gpu,
        start: levels('normal').at(-1)?.level,
        lowest: under.reduce(
          (m, s) =>
            ['low', 'lite', 'medium', 'high'].indexOf(s.level) < ['low', 'lite', 'medium', 'high'].indexOf(m)
              ? s.level
              : m,
          'high',
        ),
        endUnder: under.at(-1)?.level,
        fpsUnderLast10s: fpsOf(under.filter(s => s.t > under.at(-1).t - 10)),
        endAfter: after.at(-1)?.level,
        fpsAfterLast10s: fpsOf(after.filter(s => s.t > after.at(-1).t - 10)),
        locked: after.at(-1)?.locked,
        errors: errors.length,
      };
    results.push(r);
    console.log(
      `  -> started ${r.start}; under ${rate}x stepped down to ${r.lowest} (${r.fpsUnderLast10s.toFixed(0)} fps at the end); released: back to ${r.endAfter} (${r.fpsAfterLast10s.toFixed(0)} fps)${r.locked ? ', step up locked' : ''}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await srv.close();
}
console.log(JSON.stringify(results));
