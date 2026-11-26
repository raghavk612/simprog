// Shared by scripts/perf.mjs and scripts/contact-sheet.mjs: serve the game (Vite dev server or the built dist/), open it in
// Google Chrome with a save and graphics settings, and drive the 3D gym (window.__kangsArena, exposed in dev builds and
// in any build opened with ?perf) one frame at a time at a fixed time step, so every run sees the same frames.
//
// Nothing here changes the game: the page's own animation loop is stopped and arena.frame() is called directly with a
// fixed dt (the arena's clock is stubbed). A frame's cost is timed up to a 1-pixel readPixels, which waits for the GPU,
// so the number is the real CPU + GPU cost of the frame and is not capped by the display's refresh rate.
import fs from 'node:fs';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright-core';
import * as E from '../src/engine.js';

export const root = new URL('..', import.meta.url).pathname;

/* A Vite server: 'dev' (source, fast, no build) or 'build' (dist/, as shipped). Returns {url, close}. */
export async function serve(kind = 'dev') {
  if (kind === 'build') {
    const s = await preview({ root, logLevel: 'error', preview: { port: 0, host: '127.0.0.1' } });
    const url = s.resolvedUrls.local[0];
    return { url, close: () => new Promise(r => s.httpServer.close(r)) };
  }
  const s = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
  await s.listen();
  return { url: s.resolvedUrls.local[0], close: () => s.close() };
}

export async function launch() {
  return chromium.launch({
    channel: 'chrome',
    args: [
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-precise-memory-info',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
    ],
  });
}

/* A season one game in (the same fixture as scripts/ui-check.mjs), and one of its recorded possessions to restage. */
export function fixture() {
  const data = JSON.parse(fs.readFileSync(`${root}public/data/kangs.json`, 'utf8'));
  const pre = E.createGame(data, 'Taylor', 'standard', 7);
  E.autoLineup(pre);
  const save = structuredClone(pre);
  E.endBreak(save);
  E.startMatch(save);
  while (save.match) E.possession(save);
  return { save, event: save.results.at(-1).events[3] };
}

/* A possession with its two plays replaced: plays = [homeOverrides, awayOverrides] over the recorded ones. */
export function restage(event, home = {}, away = {}) {
  const [h, a] = event.plays;
  return {
    ...event,
    plays: [
      { ...h, ...home },
      { ...a, ...away },
    ],
  };
}

/* Opens the game with a save and settings. level: graphics level; players: 'athletes' | 'classic'. The page is on the title
   screen when this returns, with the gym stopped (stepped by the harness from now on) and its assets loaded. */
export async function openGym(browser, url, o = {}) {
  // a page that does not come up (seen now and then with a fresh Chrome context) is retried once
  try {
    return await openOnce(browser, url, o);
  } catch (e) {
    console.warn(`openGym: retrying after ${e.message.split('\n')[0]}`);
    return openOnce(browser, url, o);
  }
}
async function openOnce(
  browser,
  url,
  {
    level = 'high',
    players = 'athletes',
    size = [1440, 900],
    dpr = 1,
    save,
    block = true,
    before = null,
    look = null,
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width: size[0], height: size[1] },
    deviceScaleFactor: dpr,
    serviceWorkers: block ? 'block' : 'allow',
  });
  const page = await context.newPage();
  if (before) await before(page, context);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(
    ([s, level, players, look]) => {
      if (s) localStorage.setItem('kangs-three-season-v2', s);
      if (look) globalThis.__kangsLook = look; // broadcast-look overrides for experiments (src/broadcast.js)
      localStorage.setItem(
        'kangs_accessibility',
        JSON.stringify({ graphics: level, players, reducedMotion: false, modelsVersion: 2 }),
      );
      globalThis.__kangsShowSeed = 7; // the title hero's show: the same routine every run
      // the same "random" numbers every run (idle sway phases, camera shake)
      let seed = 12345;
      Math.random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    },
    [save ? JSON.stringify(save) : null, level, players, look],
  );
  try {
    await page.goto(`${url}?perf`);
    await page.waitForFunction(() => !!window.__kangsArena, null, { timeout: 60000 });
    // a level Auto can reach but Settings does not offer (Lite): set it on the gym directly
    if (!['auto', 'low', 'medium', 'high'].includes(level))
      await page.evaluate(l => window.__kangsArena.setQuality(l), level);
    await waitReady(page);
  } catch (e) {
    const state = await page
      .evaluate(() => {
        const a = window.__kangsArena;
        return a
          ? { level: a.level, style: a.playerStyle, templates: !!a.templates, look: a.look?.key }
          : 'no arena';
      })
      .catch(() => 'page gone');
    await context.close();
    throw Error(
      `${e.message.split('\n')[0]} (${JSON.stringify(state)}; errors: ${errors.join(' | ') || 'none'})`,
    );
  }
  return { context, page, errors };
}

/* Waits until the bodies the level shows (and their detail maps) and the broadcast look are in. */
export async function waitReady(page) {
  await page.waitForFunction(
    () => {
      const a = window.__kangsArena;
      if (!a || a.failed) return true;
      const want = a.playerStyle === 'athletes';
      if (want && !a.templates) return false;
      if (want && a.level !== 'low' && a.look?.key !== a.level) return false;
      return true;
    },
    null,
    { timeout: 60000 },
  );
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/* In-page helpers, installed once per page: stop the loop, step frames at a fixed dt, time them. */
export async function takeOver(page) {
  await page.evaluate(() => {
    const a = window.__kangsArena;
    if (window.__gym) return;
    a.renderer.setAnimationLoop(null);
    let dt = 1 / 60;
    a.clock.getDelta = () => dt;
    const gl = a.renderer.getContext(),
      px = new Uint8Array(4),
      info = a.renderer.info;
    info.autoReset = false;
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    /* makes arena.look.render a no-op until the returned function is called */
    const skipDraw = () => {
      const had = Object.prototype.hasOwnProperty.call(a.look, 'render'),
        old = a.look.render;
      a.look.render = () => {};
      return () => {
        if (had) a.look.render = old;
        else delete a.look.render;
      };
    };
    window.__gym = {
      setDt: d => (dt = d),
      /* steps until pred(arena) is true (or max frames); returns the frames stepped. fast: the frames are simulated and
         posed (updateLods, the Math.random draws, everything but the draw call) without drawing them: on a software
         renderer a frame costs about a second, and only the captured frames need to be drawn */
      until(pred, max = 2000, fast = false) {
        let n = 0;
        const draw = fast ? skipDraw() : null;
        try {
          while (n < max && !pred(a)) {
            a.frame();
            n++;
          }
        } finally {
          draw?.();
        }
        sync();
        return n;
      },
      step(n = 1, fast = false) {
        const draw = fast ? skipDraw() : null;
        try {
          for (let i = 0; i < n; i++) a.frame();
        } finally {
          draw?.();
        }
        sync();
      },
      measure(n = 120) {
        const times = [],
          calls = [],
          tris = [];
        for (let i = 0; i < n; i++) {
          info.reset();
          const t0 = performance.now();
          a.frame();
          sync();
          times.push(performance.now() - t0);
          calls.push(info.render.calls);
          tris.push(info.render.triangles);
        }
        const q = (arr, f) =>
          [...arr].sort((x, y) => x - y)[Math.min(arr.length - 1, Math.floor(arr.length * f))];
        return {
          frames: n,
          medianMs: q(times, 0.5),
          p95Ms: q(times, 0.95),
          calls: q(calls, 0.5),
          callsMax: Math.max(...calls),
          triangles: q(tris, 0.5),
          trianglesMax: Math.max(...tris),
          heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
          level: a.level,
          players: a.playerStyle,
          pixelRatio: a.renderer.getPixelRatio(),
          canvas: [a.renderer.domElement.width, a.renderer.domElement.height],
        };
      },
    };
  });
}

/* Makes the gym fill the window, whatever page is showing, so every scene renders the same number of pixels. */
export async function fullFrame(page) {
  await page.addStyleTag({
    content:
      '#scene{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483000!important;visibility:visible!important;display:block!important}',
  });
  await page.evaluate(() => {
    const h = document.querySelector('#scene');
    if (h) h.hidden = false;
  });
}

/* Continue the saved season and replay a possession on the Game day page (the game's own replay path). */
export async function toGame(page, event) {
  await page.waitForSelector('[data-action="continue"]');
  await page.click('[data-action="continue"]');
  await page.waitForTimeout(300);
  // replay the first stored possession through the real UI path (opens Game day with the gym), then swap in ours
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.dataset.action = 'replay';
    b.dataset.index = '0';
    b.dataset.event = '0';
    document.querySelector('#app').append(b);
    b.click();
    b.remove();
  });
  await page.waitForTimeout(300);
  if (event) await stagePlay(page, event);
}

/* A level Auto can reach but Settings does not offer (Lite) is set on the gym directly, and again after a page that
   re-applies the settings (Game day). */
export async function forceLevel(page, level) {
  if (['auto', 'low', 'medium', 'high'].includes(level)) return;
  await page.evaluate(l => window.__kangsArena.setQuality(l), level);
  await waitReady(page);
}
/* Plays an event in the gym (replay = the director's replay close-up angles). mode: camera mode ('auto', 'court', ...). */
export async function stagePlay(page, event, { replay = false, mode = 'auto' } = {}) {
  await page.evaluate(
    ([e, replay, mode]) => {
      const a = window.__kangsArena;
      a.setView(mode);
      a.play(e, { replay });
      a.speed = 1;
    },
    [event, replay, mode],
  );
}
