import test from 'node:test';
import assert from 'node:assert/strict';
import { BALL } from '../src/basketball.js';
import { MOVES, Routine, mirrorMove, dribbleMove, prepare, sample, topOf } from '../src/moves/index.js';
import { track, freeFlight, STANCE, PALM } from '../src/moves/core.js';
import { analyse, summary } from '../src/moves/check.js';
import { courtContext } from '../src/moves/context.js';
import { HERO, heroYaw } from '../src/title.js';

const title = courtContext({ x: HERO.x, z: HERO.z, yaw: heroYaw() }),
  ctx = { rim: title.rim, feeder: title.feeder };
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('tracks pass through every key without overshooting between them', () => {
  const f = track([
    { t: 0, v: 0 },
    { t: 1, v: 1 },
    { t: 2, v: 1 },
    { t: 3, v: 0 },
  ]);
  for (const k of [0, 1, 2, 3]) assert.ok(Math.abs(f(k) - [0, 1, 1, 0][k]) < 1e-9);
  for (let t = 0; t <= 3; t += 0.01) assert.ok(f(t) >= -1e-9 && f(t) <= 1 + 1e-9, `overshoot at ${t}`);
});

test('a free flight bounces like a real floor when it can, and lands where it is sent on time', () => {
  const p0 = [-0.3, 0.8, 0.3],
    p1 = [0.36, 1.0, 0.24],
    F = freeFlight(p0, p1, 0.42, [0, 0.35]);
  assert.ok(Math.abs(F.e - BALL.bounce) < 0.01, `e = ${F.e}`);
  assert.ok(dist(F.at(0).p, p0) < 1e-9 && dist(F.at(0.42).p, p1) < 1e-6);
  assert.ok(Math.abs(F.at(F.hit).p[1] - BALL.floor) < 1e-6);
});

test('the plain dribble move is exactly the game dribble', () => {
  const P = prepare(dribbleMove('R'));
  for (let t = 0; t < P.duration; t += 0.02) {
    const f = sample(P, t);
    assert.ok(f.ball[1] >= BALL.floor - 1e-9);
    if (f.hands.R.onBall > 0.999) assert.ok(Math.abs(dist(f.hands.R.p, f.ball) - PALM) < 1e-6);
  }
});

test('every move, in both hands, keeps the rules that make it look right (src/moves/check.js)', () => {
  assert.ok(MOVES.length >= 1);
  for (const m of MOVES)
    for (const mm of [m, mirrorMove(m)]) {
      const a = analyse(mm, { ctx });
      assert.deepEqual(a.problems, [], summary(a));
    }
});

test('moves are written for the right hand, have unique ids, and mirror back to themselves', () => {
  const ids = new Set();
  for (const m of MOVES) {
    assert.equal(m.start, 'R', `${m.id} starts in the right hand`);
    assert.ok(['handle', 'show'].includes(m.family), m.id);
    assert.ok(!ids.has(m.id), `duplicate id ${m.id}`);
    ids.add(m.id);
    const P = prepare(m, ctx),
      Q = prepare(mirrorMove(mirrorMove(m)), ctx);
    for (let t = 0; t <= P.duration; t += 0.05)
      assert.ok(dist(sample(P, t).ball, sample(Q, t).ball) < 1e-9, m.id);
  }
});

test('a routine walks up to the spot, then plays moves back to back with nothing jumping between them', () => {
  for (const seed of [1, 2, 3, 11]) {
    const R = new Routine({ library: MOVES, seed, ctx, entrance: { from: [0.5, -3.4] } }),
      dt = 1 / 240;
    let prev = R.frame(0);
    assert.ok(Math.hypot(prev.body.x - 0.5, prev.body.z + 3.4) < 1e-6); // he starts back there
    let walked = false;
    for (let t = dt; t < 40; t += dt) {
      const f = R.frame(t);
      if (prev.move === 'walkUp' && f.move !== 'walkUp') {
        walked = true;
        assert.ok(Math.hypot(prev.body.x, prev.body.z) < 0.01, 'arrives on the spot');
      }
      const jump = dist(f.ball, prev.ball);
      assert.ok(
        jump < 15 * dt + 1e-3,
        `ball jumps ${jump.toFixed(3)} at ${t.toFixed(3)}s into ${f.move} (seed ${seed})`,
      );
      for (const h of ['R', 'L']) {
        const hj = dist(f.hands[h].p, prev.hands[h].p);
        assert.ok(
          hj < 12 * dt + 1e-3,
          `${h} hand jumps ${hj.toFixed(3)} at ${t.toFixed(3)}s into ${f.move} (seed ${seed})`,
        );
      }
      for (const h of ['R', 'L'])
        assert.ok(dist(f.feet[h].p, prev.feet[h].p) < 10 * dt + 1e-3, `${h} foot jumps (seed ${seed})`);
      prev = f;
    }
    assert.ok(walked);
  }
});

test('the shuffle favours the showtime moves as asked, never repeats a move back to back, and is repeatable', () => {
  // every move as it is scheduled (the routine itself forgets moves long played)
  class Logged extends Routine {
    push(def, id) {
      (this.log ??= []).push(id ?? def.id);
      super.push(def, id);
    }
  }
  const picks = id => {
    const R = new Logged({ library: MOVES, seed: id, ctx, dribbleChance: 0 });
    for (let t = 0; t < 600; t += 1) R.fill(t);
    return R.log;
  };
  const a = picks(5),
    b = picks(5);
  assert.deepEqual(a, b);
  if (MOVES.length >= 3) for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1]);
  // each move's share of the picks follows its weight (its own, or its family's: handle 1, show 3)
  const w = m => m.weight ?? (m.family === 'show' ? 3 : 1),
    total = MOVES.reduce((n, m) => n + w(m), 0),
    heavy = MOVES.filter(m => w(m) > 1),
    share = a.filter(id => heavy.some(m => m.id === id)).length / a.length,
    expected = heavy.reduce((n, m) => n + w(m), 0) / total;
  assert.ok(
    Math.abs(share - expected) < 0.08,
    `weighted share ${share.toFixed(2)} vs ${expected.toFixed(2)}`,
  );
});

test('every move begins and ends in the canonical dribble state', () => {
  for (const m of MOVES) {
    const P = prepare(m, ctx),
      a = sample(P, 0),
      z = sample(P, P.duration);
    assert.ok(dist(a.ball, topOf(m.start)) < 0.01, m.id);
    assert.ok(dist(z.ball, topOf(m.end)) < 0.01, m.id);
    for (const h of ['R', 'L'])
      assert.ok(Math.hypot(z.feet[h].p[0] - STANCE[h][0], z.feet[h].p[2] - STANCE[h][1]) < 0.02, m.id);
  }
});
