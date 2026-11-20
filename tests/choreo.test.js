import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/basketball.js';
import { timedPath, retime, ballYouMan } from '../src/choreo.js';
import * as L from '../scripts/motion-lib.mjs';

test('a timed path passes each waypoint at its moment and comes to rest on a stop', () => {
  const keys = [
      [0, 0, 0],
      [0.2, 2, 1, 1],
      [0.5, 4, -1],
    ],
    path = timedPath(keys),
    p = [0, 0];
  for (const [u, x, z] of keys) {
    path(u, p);
    assert.ok(Math.hypot(p[0] - x, p[1] - z) < 1e-9, `at ${u}`);
  }
  // at rest on the stop: the moments either side are as close to it as each other, and very close
  const a = path(0.199, [0, 0]),
    b = path(0.201, [0, 0]);
  assert.ok(Math.hypot(a[0] - 2, a[1] - 1) < 1e-3 && Math.hypot(b[0] - 2, b[1] - 1) < 1e-3);
});

test('retiming gives a body the time a run needs, and moves the rest of the plan later', () => {
  const S = 4.4,
    out = retime(
      [
        [0, 0, 0],
        [0.1, 8, 0], // 8 units in 0.44 s: no
        [0.2, 8, 1],
      ],
      S,
      4,
    );
  assert.ok((out[1][0] - out[0][0]) * S >= 2 - 1e-9, 'at most 4 units a second');
  assert.ok(Math.abs(out[2][0] - out[1][0] - 0.1) < 1e-9, 'the next segment keeps its own length');
});

test('ball-you-man: a step off his man one pass away, sagging toward the ball two passes away', () => {
  const near = ballYouMan([8, -4], [7, 1], [0, 0]),
    far = ballYouMan([10, -6], [3, 5], [0, 0]),
    off = (p, m) => Math.hypot(p[0] - m[0], p[1] - m[1]);
  assert.ok(off(near, [8, -4]) < 1.6, 'denies close');
  assert.ok(off(far, [10, -6]) > 2, 'sags off');
  // and always on the rim side of his man
  for (const [m, q] of [
    [[8, -4], near],
    [[10, -6], far],
  ])
    assert.ok(Math.hypot(12.15 - q[0], -q[1]) < Math.hypot(12.15 - m[0], -m[1]));
});

test('version 3 team plan: deterministic, a held ball screen the handler comes off, box-outs on the shot', () => {
  const c = { ...L.clipOf('roll', { outcome: 'miss' }, 'contested', 'home', 1), v: 3 },
    plan = B.choreoOf(c),
    again = B.choreoOf({ ...c });
  assert.deepEqual(plan.action, again.action);
  assert.ok(plan.screen && plan.screen.u1 > plan.screen.u0);
  const S = L.samples(c),
    hold = S.filter((_, f) => {
      const u = f / (L.FRAMES - 1);
      return u > (plan.screen.u0 + plan.screen.u1) / 2 && u < plan.screen.u1; // set by then, as the handler arrives
    }),
    [px, pz] = plan.screen.p;
  // the screener is set on his spot (still), and the handler passes him close (a body's width or so)
  for (const p of hold) assert.ok(Math.hypot(p.actors[1].x - px, p.actors[1].z - pz) < 0.35);
  const closest = Math.min(
    ...S.slice(0, 160).map(p => Math.hypot(p.actors[1].x - p.actors[0].x, p.actors[1].z - p.actors[0].z)),
  );
  assert.ok(closest < 1.6, `the handler comes off the screen (${closest.toFixed(2)})`);
  // box-outs: declared contacts on the shot
  assert.ok(plan.contacts.some(([, , u0, , g]) => u0 > plan.after && g < 0.7));
});

test('version 3: nobody goes behind a backboard (beyond its face) on a play at the rim', () => {
  for (const kind of ['drive', 'floater', 'roll', 'hook', 'dunk']) {
    const c = { ...L.clipOf(kind, { outcome: 'made' }, 'contested', 'home', 1), v: 3 },
      S = L.samples(c);
    for (const p of S)
      for (const a of p.actors) assert.ok(!(a.x > 12.56 && Math.abs(a.z) < 3.2), `${kind}: behind the board`);
  }
});
