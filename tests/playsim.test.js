import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/basketball.js';
import * as L from '../scripts/motion-lib.mjs';

// a spread of plays: every shot kind, each outcome, both teams (the full set is npm run motion:qa)
const SAMPLE = L.clipSet().filter((_, i) => i % 23 === 0);

test('motion version 3 is the current one; versions 1 and 2 are unchanged by it', () => {
  assert.equal(B.MOTION_VERSION, 3);
  const c = L.clipOf('drive', { outcome: 'made' }, 'contested', 'home', 1);
  // version 2 has no simulated fields; version 3 adds them without changing the shape
  const p2 = B.sampleClip({ ...c, v: 2 }, 1.2),
    p3 = B.sampleClip({ ...c, v: 3 }, 1.2);
  assert.equal(p2.actors[3].vx, undefined);
  assert.ok(Number.isFinite(p3.actors[3].vx) && Number.isFinite(p3.actors[3].ax));
  assert.equal(p3.actors.length, 10);
  for (const k of ['ball', 'phase', 'bounce', 'resolved', 'flying', 'net']) assert.ok(k in p3, k);
});

test('motion version 3: deterministic whatever order it is sampled in, and the same for a fresh copy of the play', () => {
  for (const { clip } of SAMPLE.slice(0, 12)) {
    const c = { ...clip, v: 3 },
      fwd = L.hashSamples(L.samples(c)),
      back = L.hashSamples(
        Array.from({ length: L.FRAMES }, (_, k) => B.sampleClip(c, (L.FRAMES - 1 - k) / L.FPS)).reverse(),
      ),
      copy = L.hashSamples(L.samples({ ...clip, v: 3 }));
    assert.equal(back, fwd);
    assert.equal(copy, fwd);
  }
});

test('motion version 3: bodies move within human limits and never overlap', () => {
  for (const { id, clip } of SAMPLE) {
    const c = { ...clip, v: 3 },
      m = L.metrics(c, L.samples(c));
    assert.ok(m.speed <= 9.5, `${id}: top speed ${m.speed.toFixed(1)} m/s`);
    assert.ok(m.accel <= 12, `${id}: acceleration ${m.accel.toFixed(1)} m/s2`);
    assert.ok(m.jerk <= 900, `${id}: jerk ${m.jerk.toFixed(0)} m/s3`);
    assert.equal(m.overlapFrames, 0, `${id}: overlaps`);
  }
});

test('motion version 3: the play keeps its promises (phases, flags, the release spot, the ball at release, rim and end)', () => {
  for (const { id, clip } of SAMPLE) {
    const a2 = L.anchors(clip, L.samples({ ...clip, v: 2 })),
      a3 = L.anchors(clip, L.samples({ ...clip, v: 3 }));
    assert.deepEqual(L.anchorDiff(a3, a2), [], id);
  }
});

test('motion version 3: a play is worked out once, in a few milliseconds', () => {
  const c = {
    ...L.clipOf('hook', { outcome: 'block', recovery: 'offense', putback: 'made' }, 'tight', 'away', -1),
    v: 3,
    fresh: 1,
  };
  B.sampleClip(c, 0);
  const m = B.motionOf(c);
  assert.ok(m.ms < 40, `worked out in ${m.ms.toFixed(1)} ms`);
  const t0 = performance.now();
  for (let f = 0; f < 265; f++) B.sampleClip(c, f / 60);
  assert.ok((performance.now() - t0) / 265 < 0.2, 'then each frame only reads it');
});
