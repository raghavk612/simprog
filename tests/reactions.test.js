import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionsFor, reactionFrame, REACTIONS } from '../src/reactions.js';

const c = o => ({
  kind: 'pullup',
  team: 'home',
  lane: 1,
  contest: 'contested',
  outcome: 'made',
  points: 2,
  ...o,
});
test('reactions: who reacts to a play, and each reaction eases in and out within its time', () => {
  assert.deepEqual(
    reactionsFor(c({ kind: 'catch', points: 3, assisted: true })).map(r => r.kind),
    ['three', 'clap', 'hips'],
  );
  assert.equal(reactionsFor(c({ kind: 'dunk' }))[0].kind, 'flex');
  assert.deepEqual(reactionsFor(c({ outcome: 'miss', points: 0 })), [{ role: 'shooter', kind: 'shake' }]);
  assert.equal(reactionsFor(c({ outcome: 'block', points: 0, recovery: 'defense' }))[0].role, 'marker');
  for (const [kind, dur] of Object.entries(REACTIONS)) {
    const me = { x: 1, z: 2, yaw: 0.5, y: 0 };
    assert.equal(reactionFrame(kind, dur + 0.01, me), null);
    assert.ok(reactionFrame(kind, 0, me).weight < 0.01, `${kind} eases in`);
    const mid = reactionFrame(kind, dur / 2, me);
    assert.ok(mid.weight > 0.9, `${kind} at full weight mid-way`);
    for (const h of Object.values(mid.hands)) assert.ok(h.p.every(Number.isFinite));
  }
});
