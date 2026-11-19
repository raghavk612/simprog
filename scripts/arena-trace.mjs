// A trace of what the 3D gym shows, frame by frame, to prove a refactor of src/arena.js (or anything it calls) changes
// nothing. Rendered pixels are no proof (they differ a little run to run on the GPU), so this records the state the pixels
// are drawn from: every object under each player (position, rotation, scale, visibility: the bones and parts), the ball,
// the shot trail, the nets, the camera and its target, the director's shot, the crowd's and the classic batch's instance
// matrices. Each frame is stepped at a fixed 1/60 s (scripts/gym-harness.mjs) and reduced to a hash.
//   node scripts/arena-trace.mjs --out ui-shots/trace-before.json
//   node scripts/arena-trace.mjs --out ui-shots/trace-after.json --compare ui-shots/trace-before.json
// Scenes: the title (the hero's show), a live possession in each camera mode, a replay, and plays covering every finish,
// pass, steal, block and reaction; at High with the athletes and at Low with the classic figures.
import fs from 'node:fs';
import path from 'node:path';
import {
  serve,
  launch,
  fixture,
  restage,
  openGym,
  takeOver,
  toGame,
  stagePlay,
  fullFrame,
} from './gym-harness.mjs';

const root = new URL('..', import.meta.url).pathname,
  argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1];
  },
  out = path.resolve(root, opt('out', 'ui-shots/trace.json'));

/* Before the page loads: the gym never runs a frame on its own (it would run on the wall clock while assets load, so
   each run would start from a different state); the harness steps every frame. */
const holdLoop = page =>
  page.addInitScript(() => {
    let arena;
    Object.defineProperty(window, '__kangsArena', {
      configurable: true,
      get: () => arena,
      set(a) {
        arena = a;
        a.renderer?.setAnimationLoop(null);
      },
    });
  });
/* In the page: one hash of everything drawn from the gym's state this frame. The random numbers restart here (loading
   draws an uneven number of them: three.js ids). */
function installDigest() {
  const a = window.__kangsArena;
  let seed = 12345;
  Math.random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let h = 2166136261 >>> 0;
  const buf = new Float64Array(1),
    bytes = new Uint8Array(buf.buffer),
    num = v => {
      buf[0] = typeof v === 'number' ? v : v ? 1 : 0;
      for (let i = 0; i < 8; i++) h = Math.imul(h ^ bytes[i], 16777619) >>> 0;
    },
    obj = o => {
      (num(o.position.x), num(o.position.y), num(o.position.z));
      (num(o.quaternion.x), num(o.quaternion.y), num(o.quaternion.z), num(o.quaternion.w));
      (num(o.scale.x), num(o.scale.y), num(o.scale.z), num(o.visible));
    },
    arr = x => {
      for (let i = 0; i < x.length; i++) num(x[i]);
    };
  window.__digest = () => {
    h = 2166136261 >>> 0;
    for (const p of a.people) p.traverse(obj);
    if (a.ball) obj(a.ball);
    for (const d of a.trail || []) obj(d);
    for (const n of a.nets || []) obj(n.mesh);
    if (a.focusRing) obj(a.focusRing);
    obj(a.camera);
    num(a.camera.fov);
    const t = a.controls.target;
    (num(t.x), num(t.y), num(t.z));
    for (const c of (a.director?.shot || '') + (a.mode || '')) num(c.charCodeAt(0));
    a.scene.traverse(o => {
      if (o.isInstancedMesh && o.visible) {
        num(o.count);
        arr(o.instanceMatrix.array.subarray(0, o.count * 16));
      }
    });
    (num(a.playTime), num(a.gait), num(a.shake), num(a.cheer || 0));
    return h.toString(16);
  };
}
const steps = (page, n) =>
  page.evaluate(n => {
    const out = [];
    for (let i = 0; i < n; i++) {
      __gym.step(1);
      out.push(__digest());
    }
    return out;
  }, n);

const { save, event } = fixture(),
  play = (home, away = { kind: 'pullup', outcome: 'miss', points: 0 }) => restage(event, home, away),
  PLAYS = {
    drive: play({ kind: 'drive', outcome: 'made', points: 2, contest: 'contested' }),
    dunk: play(
      { kind: 'dunk', outcome: 'made', points: 2 },
      { kind: 'catch', outcome: 'made', points: 3, assisted: true },
    ),
    block: play(
      { kind: 'pullup', outcome: 'block', points: 0 },
      { kind: 'euro', outcome: 'made', points: 2 },
    ),
    steal: play({ kind: 'spin', outcome: 'steal', points: 0 }, { kind: 'alley', outcome: 'made', points: 2 }),
    hook: play({ kind: 'hook', outcome: 'miss', points: 0 }, { kind: 'floater', outcome: 'made', points: 2 }),
  },
  CONFIGS = [
    { level: 'high', players: 'athletes' },
    { level: 'low', players: 'classic' },
  ];

const srv = await serve('dev'),
  browser = await launch(),
  trace = {};
try {
  for (const cfg of CONFIGS) {
    const { page, context, errors } = await openGym(browser, srv.url, { ...cfg, save, before: holdLoop });
    await fullFrame(page);
    await takeOver(page);
    await page.evaluate(installDigest);
    const key = `${cfg.level}/${cfg.players}`;
    trace[`${key} title`] = await steps(page, 240);
    await toGame(page, null);
    await fullFrame(page);
    for (const [name, e] of Object.entries(PLAYS)) {
      await stagePlay(page, e, { mode: 'auto' });
      trace[`${key} ${name}`] = await steps(page, 560);
    }
    for (const mode of ['follow', 'court', 'player', 'broadcast']) {
      await stagePlay(page, PLAYS.drive, { mode });
      trace[`${key} drive ${mode}`] = await steps(page, 300);
    }
    await stagePlay(page, PLAYS.dunk, { replay: true, mode: 'auto' });
    trace[`${key} dunk replay`] = await steps(page, 400);
    if (errors.length) trace[`${key} errors`] = errors;
    await context.close();
  }
} finally {
  await browser.close();
  await srv.close();
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(trace));
const frames = Object.values(trace).reduce((n, v) => n + v.length, 0);
console.log(`${out}: ${Object.keys(trace).length} scenes, ${frames} frames`);

const against = opt('compare');
if (against) {
  const ref = JSON.parse(fs.readFileSync(path.resolve(root, against), 'utf8'));
  let bad = 0;
  for (const [scene, list] of Object.entries(ref)) {
    const mine = trace[scene] || [],
      i = list.findIndex((h, k) => mine[k] !== h);
    if (i >= 0 || mine.length !== list.length) {
      bad++;
      console.log(`${scene}: differs from frame ${i < 0 ? mine.length : i}`);
    }
  }
  console.log(bad ? `${bad} scenes differ` : 'identical: every frame of every scene');
  process.exitCode = bad ? 1 : 0;
}
