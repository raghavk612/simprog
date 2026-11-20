// Motion QA: every play the 3D gym can show, sampled at 60 Hz and checked (docs/MOTION-BRIEF.md, M0).
//   npm run motion:qa                         # check; prints the metrics table
//   npm run motion:qa -- --label before       # also save the metrics to docs/motion/qa-<label>.json
//   npm run motion:qa -- --freeze             # write docs/motion/qa-baseline.json (old versions' hashes and anchors);
//                                             # refuses to change an existing hash (old plays must replay bit-identical)
// Clips: every shot kind x outcome x contest x team x lane (936, scripts/motion-lib.mjs) plus 120 plays of seeded engine
// games. Each is sampled as motion version 1 (no v), 2, and the current MOTION_VERSION.
// Always checked: no NaN; determinism (the current version sampled again backwards in time gives the same frames); v1 and
// v2 bit-identical to the frozen baseline. For the current version from 3 on (the physical motion): speed, acceleration
// and jerk caps; no two players closer than they may be (motion.js SPACE, or a contact the pose declares: a screen, a
// box-out); the ball never jumps, never below the floor or through the backboard, within reach of the hand that holds it;
// floor bounces keep 0.78-0.92 of their speed; the anchors (phases, resolved and flying frames, the shooter's release
// spot, the ball at the release, at the rim, at the block and at the end) as in version 2.
import fs from 'node:fs';
import path from 'node:path';
import * as B from '../src/basketball.js';
import * as L from './motion-lib.mjs';

const root = new URL('..', import.meta.url).pathname,
  argv = process.argv.slice(2),
  opt = k => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? null : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
  },
  BASE = path.join(root, 'docs/motion/qa-baseline.json'),
  CUR = B.MOTION_VERSION;
// the caps for the physical motion (version 3 on), in metres and seconds
export const CAPS = {
  speed: 9.5, // m/s: a sprint is 7-9
  accel: 12, // m/s^2 (99.9th percentile of every player's frames): starts 4-6, plants 6-9, a contact's shove a little more
  jerk: 900, // m/s^3 (99.9th percentile): the authored motion runs to tens of thousands at its corners
  ballJump: 0.45, // game units in one frame (27 u/s, faster than any pass or shot)
  handDist: 0.26, // game units from the hand to the ball's centre while held (the palm sits 0.2 off it)
  restitution: [0.78, 0.92],
};

const t0 = performance.now(),
  set = [...L.clipSet(), ...(await L.engineClips(120))],
  base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : { clips: {} },
  fails = [],
  fail = (id, what) => fails.length < 400 && fails.push(`${id}: ${what}`),
  rows = { v2: [], cur: [] },
  frozen = { version: CUR, clips: {} };
let sampled = 0;
for (const { id, clip } of set) {
  const v1 = L.samples({ ...clip }),
    v2 = L.samples({ ...clip, v: 2 }),
    h1 = L.hashSamples(v1),
    h2 = L.hashSamples(v2),
    a2 = L.anchors(clip, v2);
  sampled += 2 * L.FRAMES;
  for (const [v, S] of [
    [1, v1],
    [2, v2],
  ]) {
    const m = L.metrics(clip, S);
    if (m.nan) fail(id, `v${v}: ${m.nan} NaN values`);
    if (v === 2) rows.v2.push({ id, clip, m });
  }
  const b = base.clips[id];
  if (b && (b.h1 !== h1 || b.h2 !== h2))
    fail(
      id,
      `old version changed (v1 ${b.h1 === h1 ? 'same' : 'differs'}, v2 ${b.h2 === h2 ? 'same' : 'differs'})`,
    );
  frozen.clips[id] = { h1, h2, anchors: a2 };
  if (CUR >= 3) {
    const c = { ...clip, v: CUR },
      S = L.samples(c),
      back = L.samples(c, (cl, t) => B.sampleClip(cl, (L.FRAMES - 1) / L.FPS - t)).reverse(),
      m = L.metrics(c, S);
    sampled += 2 * L.FRAMES;
    if (L.hashSamples(S) !== L.hashSamples(back))
      fail(id, 'not deterministic (sampling order changes the frames)');
    if (m.nan) fail(id, `${m.nan} NaN values`);
    if (m.speed > CAPS.speed) fail(id, `speed ${m.speed.toFixed(1)} m/s`);
    if (m.accel > CAPS.accel) fail(id, `acceleration ${m.accel.toFixed(1)} m/s2`);
    if (m.jerk > CAPS.jerk) fail(id, `jerk ${m.jerk.toFixed(0)} m/s3`);
    if (m.overlapFrames)
      fail(id, `players overlap in ${m.overlapFrames} pair-frames (closest ${m.minSep.toFixed(2)})`);
    if (m.ballJump > CAPS.ballJump) fail(id, `ball jumps ${m.ballJump.toFixed(2)} in a frame`);
    if (m.ballBelowFloor) fail(id, `ball below the floor in ${m.ballBelowFloor} frames`);
    if (m.ballThroughBoard) fail(id, `ball through the backboard in ${m.ballThroughBoard} frames`);
    if (m.handDist > CAPS.handDist) fail(id, `ball ${m.handDist.toFixed(2)} from the hand holding it`);
    for (const e of m.bounces)
      if (e < CAPS.restitution[0] || e > CAPS.restitution[1])
        fail(id, `bounce keeps ${e.toFixed(2)} of its speed`);
    for (const d of L.anchorDiff(L.anchors(c, S), a2)) fail(id, `anchor ${d}`);
    rows.cur.push({ id, clip: c, m });
  }
}
const secs = (performance.now() - t0) / 1000;

/* The metrics table: the mean over clips and the worst clip, per metric. */
const KEYS = [
  ['speed', 'max speed (m/s)'],
  ['accel', 'acceleration p99.9 (m/s²)'],
  ['jerk', 'jerk p99.9 (m/s³)'],
  ['accelP95', 'acceleration p95 (m/s²)'],
  ['jerkP95', 'jerk p95 (m/s³)'],
  ['curvature', 'turn rate while moving (rad/s)'],
  ['corners', 'sharp corners at speed (share of moving frames)'],
  ['minSep', 'closest two players (units)'],
  ['overlapFrames', 'overlapping pair-frames'],
  ['ballJump', 'largest ball move in a frame (units)'],
  ['ballSpeed', 'ball top speed (m/s)'],
  ['handDist', 'ball to hand while held, max (units)'],
  ['handDistMean', 'ball to hand while held, mean (units)'],
  ['ballBelowFloor', 'ball below the floor (frames)'],
  ['ballThroughBoard', 'ball through the backboard (frames)'],
];
export function summary(rs) {
  const out = {};
  for (const [k] of KEYS) {
    const v = rs.map(r => r.m[k]).filter(Number.isFinite);
    out[k] = {
      mean: v.reduce((a, b) => a + b, 0) / (v.length || 1),
      worst: k === 'minSep' ? Math.min(...v) : Math.max(...v),
    };
  }
  const e = rs.flatMap(r => r.m.bounces);
  out.restitution = {
    mean: e.reduce((a, b) => a + b, 0) / (e.length || 1),
    worst: e.length ? Math.min(...e) : 0,
    n: e.length,
  };
  return out;
}
const sums = { v2: summary(rows.v2), ...(rows.cur.length ? { [`v${CUR}`]: summary(rows.cur) } : {}) },
  cols = Object.keys(sums),
  fmt = x => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(2));
console.log(`| metric | ${cols.map(c => `${c} mean | ${c} worst`).join(' | ')} |`);
console.log(`|---|${cols.map(() => '---|---').join('|')}|`);
for (const [k, label] of [...KEYS, ['restitution', 'floor bounce restitution']])
  console.log(
    `| ${label} | ${cols.map(c => `${fmt(sums[c][k].mean)} | ${fmt(sums[c][k].worst)}`).join(' | ')} |`,
  );
console.log(
  `\n${set.length} clips (${L.clipSet().length} combinations + ${set.length - L.clipSet().length} engine plays), ${sampled} frames sampled in ${secs.toFixed(1)} s; current motion version ${CUR}`,
);

if (opt('label')) {
  const file = path.join(root, `docs/motion/qa-${opt('label')}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: CUR, clips: set.length, summary: sums }, null, 1) + '\n');
  console.log(`saved ${path.relative(root, file)}`);
}
if (opt('freeze')) {
  const changed = Object.keys(frozen.clips).filter(
    id =>
      base.clips[id] &&
      (base.clips[id].h1 !== frozen.clips[id].h1 || base.clips[id].h2 !== frozen.clips[id].h2),
  );
  if (changed.length) {
    console.error(
      `refusing to freeze: ${changed.length} old-version clips changed (${changed.slice(0, 3).join(', ')})`,
    );
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE, JSON.stringify(frozen) + '\n');
  console.log(`froze ${Object.keys(frozen.clips).length} clips in ${path.relative(root, BASE)}`);
}
if (!fs.existsSync(BASE))
  fail('baseline', 'docs/motion/qa-baseline.json is missing (npm run motion:qa -- --freeze)');
if (fails.length) {
  console.error(`\nmotion:qa FAILED (${fails.length}${fails.length >= 400 ? '+' : ''}):`);
  for (const f of fails.slice(0, 40)) console.error('  ' + f);
  process.exit(1);
}
console.log('\nmotion:qa passed');
