import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/basketball.js';
import { dribbleFlight, BALL_R, E_FLOOR } from '../src/ballsim.js';
import * as L from '../scripts/motion-lib.mjs';

// a spread of plays (the full set is npm run motion:qa)
const SAMPLE = L.clipSet().filter((_, i) => i % 29 === 0);

test('the dribble flight: one bounce keeping 0.85 of the speed lands the ball back in the hand on time', () => {
  const g = 9.81 / 0.929 / 0.929; // the play's gravity in game units (as the engine's clips use it)
  for (const flight of [0.3, 0.4, 0.5]) {
    const f = dribbleFlight(flight, g);
    assert.ok(Math.abs(f.total - flight) < 1e-3, `flight ${flight}: ${f.total}`);
    assert.ok(f.v0 >= 0 && f.down > 0 && f.up > 0);
    // the speed off the floor is 0.85 of the speed into it
    const vi = Math.sqrt(f.v0 * f.v0 + 2 * g * (0.82 - BALL_R));
    assert.ok(Math.abs(f.vb / vi - E_FLOOR) < 1e-9);
  }
  // a faster rhythm needs a harder push
  assert.ok(dribbleFlight(0.3, 20).v0 > dribbleFlight(0.45, 20).v0);
});

test('motion version 3 ball: physical, never under the floor or through the board, no jumps, in the hand while held', () => {
  for (const { id, clip } of SAMPLE) {
    const c = { ...clip, v: 3 },
      S = L.samples(c),
      m = L.metrics(c, S);
    assert.ok(S.every(p => p.ballModel === 'physical' && p.ballRadius === BALL_R), id);
    assert.equal(m.ballBelowFloor, 0, `${id}: below the floor`);
    assert.equal(m.ballThroughBoard, 0, `${id}: through the board`);
    assert.ok(m.ballJump <= 0.45, `${id}: ball jumps ${m.ballJump.toFixed(2)}`);
    assert.ok(m.handDist <= 0.26, `${id}: ball ${m.handDist.toFixed(2)} from the hand`);
    for (const e of m.bounces) assert.ok(e >= 0.78 && e <= 0.92, `${id}: bounce keeps ${e.toFixed(2)}`);
  }
});

test('motion version 3 ball: who has it at the end follows the outcome', () => {
  for (const { id, clip } of SAMPLE) {
    const c = { ...clip, v: 3 },
      o = clip.outcome,
      S = L.samples(c),
      end = S[S.length - 1];
    if (o === 'steal') assert.ok(end.holder >= 0, `${id}: the stealer has it`);
    if (o === 'miss') assert.ok(end.holder >= 0, `${id}: the rebounder has it`);
    if (o === 'made') assert.equal(end.holder, -1, `${id}: a make ends loose under the net`);
    assert.ok(S.every(p => Number.isInteger(p.holder)), id);
  }
});

test('motion version 3 ball: a made shot passes through the rim, near the play arrival moment', () => {
  const c = { ...L.clipOf('catch', { outcome: 'made' }, 'open', 'home', 1), v: 3 },
    a2 = L.anchors(c, L.samples({ ...c, v: 2 })),
    a3 = L.anchors(c, L.samples(c));
  assert.deepEqual(a3.ballAtRim, a2.ballAtRim);
  assert.deepEqual(a3.ballAtRelease, a2.ballAtRelease);
});
