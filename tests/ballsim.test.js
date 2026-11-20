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
    assert.ok(
      S.every(p => p.ballModel === 'physical' && p.ballRadius === BALL_R),
      id,
    );
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
    assert.ok(
      S.every(p => Number.isInteger(p.holder)),
      id,
    );
  }
});

test('motion version 3 ball: a made shot passes through the rim, near the play arrival moment', () => {
  const c = { ...L.clipOf('catch', { outcome: 'made' }, 'open', 'home', 1), v: 3 },
    a2 = L.anchors(c, L.samples({ ...c, v: 2 })),
    a3 = L.anchors(c, L.samples(c));
  assert.deepEqual(a3.ballAtRim, a2.ballAtRim);
  assert.deepEqual(a3.ballAtRelease, a2.ballAtRelease);
});

test('motion version 3 pass: in the passer’s hands until he throws it, a line drive, caught with give', async () => {
  const { actionFrames } = await import('../src/actions.js'),
    c = { ...L.clipOf('catch', { outcome: 'made' }, 'contested', 'home', 1), v: 3 },
    throwAt = B.sampleClip(c, 0).passThrow;
  assert.ok(throwAt > 0 && throwAt < 0.3 * 4.4);
  for (const t of [0, throwAt * 0.5, throwAt - 0.02]) {
    const p = B.sampleClip(c, t),
      act = actionFrames(c, t, p).find(a => a.actor === 1);
    assert.equal(p.holder, 1);
    for (const h of ['R', 'L']) {
      const q = act.hands[h].p;
      assert.ok(Math.hypot(q[0] - p.ball.x, q[1] - p.ball.y, q[2] - p.ball.z) < 0.2, `${h} hand on the ball`);
    }
  }
  // a long pass flies low (no lob), and the ball does not stop dead in the hands
  const S = L.samples(c),
    flight = S.filter(p => p.holder < 0 && p.phase.startsWith('Pass'));
  assert.ok(Math.max(...flight.map(p => p.ball.y)) < 2.6);
  const f = S.findIndex((p, k) => k > 0 && p.holder === 0 && S[k - 1].holder < 0),
    v = k =>
      Math.hypot(
        S[k].ball.x - S[k - 1].ball.x,
        S[k].ball.y - S[k - 1].ball.y,
        S[k].ball.z - S[k - 1].ball.z,
      ) * 60;
  assert.ok(v(f) > 1 && v(f) < 8, 'the hands give with it (neither dead nor flying on)');
});
