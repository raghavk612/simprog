import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleClip, shotTiming, blockHit, CLIP_SECONDS as S } from '../src/basketball.js';
import { actionFrames } from '../src/actions.js';

const clipOf = (kind, o = {}) => ({
  kind,
  team: 'home',
  lane: 1,
  contest: 'contested',
  outcome: 'made',
  points: 2,
  ...o,
});
const frames = (c, t) => actionFrames(c, t, sampleClip(c, t));
test('actions: the passer follows through toward the receiver, the receiver reaches for the ball before it arrives', () => {
  const c = clipOf('catch'),
    p = frames(c, 0.2).find(a => a.actor === 1);
  assert.ok(p && p.weight > 0.5, 'the passer performs right after the release');
  const r = sampleClip(c, 0.2).actors[0],
    passer = sampleClip(c, 0.2).actors[1],
    toward = [r.x - passer.x, r.z - passer.z],
    hand = p.hands.R.p,
    out = [hand[0] - passer.x, hand[2] - passer.z];
  assert.ok(out[0] * toward[0] + out[1] * toward[1] > 0, 'the follow-through points at the receiver');
  const catchT = 0.3 * S - 0.25,
    rec = frames(c, catchT).find(a => a.actor === 0);
  assert.ok(rec && rec.weight > 0.3, 'the receiver shows his hands before the catch');
  assert.equal(
    frames(c, 3).find(a => a.actor === 1),
    undefined,
    'the pass is over',
  );
});
test('actions: the steal reaches for the ball, the rebound boxes out then rises, the contest peaks at the block moment', () => {
  const st = clipOf('drive', { outcome: 'steal', points: 0 }),
    lunge = frames(st, 0.29 * S).find(a => a.actor === 5);
  assert.ok(lunge.weight > 0.9 && lunge.body.lean > 0.25, 'a real lunge at the ball');
  const miss = clipOf('pullup', { outcome: 'miss', points: 0 }),
    box = frames(miss, 0.8 * S).find(a => a.actor === 9),
    rise = frames(miss, 0.965 * S).find(a => a.actor === 9);
  assert.ok(box.body.drop > 0.1, 'boxing out: low');
  assert.ok(rise.lift > 0.2 && rise.legs === 'tuck', 'rising to the ball');
  const made = clipOf('pullup'),
    peak = blockHit('pullup') * S,
    w = t => frames(made, t).find(a => a.actor === 5)?.weight ?? 0;
  assert.ok(
    w(peak) > 0.9 && w(peak - 0.5) < 0.2 && w(peak + 0.9) < 0.1,
    'the contest is timed to the shot, not held',
  );
  assert.ok(
    w(peak) > (frames(made, peak).find(a => a.actor === 7)?.weight ?? 0),
    'the help defender contests less',
  );
  assert.equal(
    frames(clipOf('pullup', { outcome: 'block', points: 0 }), peak).find(a => a.actor === 5),
    undefined,
    'a block has its own swat',
  );
  void shotTiming;
});
