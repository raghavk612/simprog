import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleClip, shotTiming, CLIP_SECONDS as S, BALL } from '../src/basketball.js';
import { finishFrame, finishTimes, FINISHES, track, dunkLift, putbackFrame } from '../src/finishes.js';

const clipOf = (kind, o = {}) => ({
  kind,
  team: 'home',
  lane: 1,
  contest: 'contested',
  outcome: 'made',
  points: 2,
  ...o,
});
const run = (c, visit) => {
  const T = shotTiming(c.kind),
    rel = sampleClip(c, T.release * S + 1e-9).ball;
  for (let f = 0; f <= Math.round(S * 60); f++) {
    const t = f / 60,
      p = sampleClip(c, t),
      a = p.actors[c.team === 'home' ? 0 : 5];
    visit(finishFrame(c, t, { x: a.x, z: a.z, yaw: a.yaw, y: a.y, scale: 1 }, p.ball, rel), t, p, rel, T);
  }
};
test('finishes: the held ball leaves the hands exactly where the play releases it, and never jumps', () => {
  for (const kind of FINISHES)
    for (const team of ['home', 'away'])
      for (const lane of [1, -1]) {
        const c = clipOf(kind, { team, lane });
        let prev = null,
          frames = 0;
        run(c, (f, t, p, rel, T) => {
          if (!f) return (prev = null);
          frames++;
          const b = f.ball || [p.ball.x, p.ball.y, p.ball.z];
          assert.ok(b.every(Number.isFinite), `${kind} ${team} ${lane}: finite ball at ${t}`);
          for (const h of Object.values(f.hands)) assert.ok(h.p.every(Number.isFinite));
          if (prev) {
            const step = Math.hypot(b[0] - prev[0], b[1] - prev[1], b[2] - prev[2]);
            assert.ok(
              step < 0.25,
              `${kind} ${team} ${lane}: ball jumps ${step.toFixed(3)} at ${t.toFixed(3)}`,
            );
          }
          prev = b;
          // just before the release the ball is on the play's release point
          const tr = t - T.release * S;
          if (tr < 0 && tr > -1 / 60 && f.ball)
            assert.ok(
              Math.hypot(f.ball[0] - rel.x, f.ball[1] - rel.y, f.ball[2] - rel.z) < 0.09,
              `${kind}: lands on the release`,
            );
        });
        assert.ok(frames > 60, `${kind}: performed`);
      }
});
test('finishes are distinct: the hook turns side-on, the spin turns all the way round, the euro steps both ways, the dunk hangs on the rim', () => {
  const at = (kind, tr, o = {}) => {
    const c = clipOf(kind, o),
      T = shotTiming(kind),
      t = T.release * S + tr,
      p = sampleClip(c, t),
      a = p.actors[0];
    return finishFrame(
      c,
      t,
      { x: a.x, z: a.z, yaw: a.yaw, y: a.y, scale: 1 },
      p.ball,
      sampleClip(c, T.release * S + 1e-9).ball,
    );
  };
  assert.ok(Math.abs(at('hook', 0).yaw) > 1, 'hook: side-on at the release');
  assert.ok(Math.abs(at('drive', 0).yaw) < 1e-9, 'layup: square');
  const F = finishTimes('spin');
  assert.ok(
    Math.abs(Math.abs(at('spin', F.takeoffS + 0.03).yaw) - 2 * Math.PI) < 0.05,
    'spin: a full turn by the take-off',
  );
  // the euro: a step to one side on the gather, then back across (sideways along his left, (cos yaw, -sin yaw))
  const E = finishTimes('euro'),
    yaw = sampleClip(clipOf('euro'), 2).actors[0].yaw,
    lateral = tr => {
      const f = at('euro', tr);
      return f.shift[0] * Math.cos(yaw) - f.shift[2] * Math.sin(yaw);
    };
  assert.ok(
    lateral(E.gatherS + 0.3) > 0.2 && lateral(E.takeoffS) < -0.15,
    'euro: the two steps go opposite ways',
  );
  const d = at('dunk', 0.12);
  for (const h of ['R', 'L'])
    assert.ok(Math.abs(d.hands[h].p[1] - BALL.rim) < 0.1, 'dunk: hands on the rim during the hang');
  assert.ok(d.lift > 0.3, 'dunk: hangs above where the play has him');
  const blocked = at('dunk', 0.12, { outcome: 'block', points: 0, recovery: 'defense' });
  assert.ok(blocked.lift < d.lift - 0.15, 'a blocked dunk never reaches the rim, so he does not hang on it');
  const DL = dunkLift(shotTiming('dunk'), 10);
  assert.ok(DL.land < 0.8, 'he is down within the play');
  // the layup's off hand comes off the ball to shield; a power (two-hand) finish keeps both on it
  assert.ok(
    Math.abs(at('drive', 0.05).hands.L.p[1] - at('drive', 0.05).hands.R.p[1]) > 0.3,
    'layup: the off hand shields below the shooting hand',
  );
  assert.equal(
    track(
      [
        [0, 0],
        [1, 10],
      ],
      0.5,
    ),
    5,
  );
  assert.deepEqual(
    track(
      [
        [0, [0, 0]],
        [1, [2, 4]],
      ],
      2,
    ),
    [2, 4],
  );
});
test('putback: the loose ball winner dips, goes up with both feet, and is let go after it lands', () => {
  const c = clipOf('pullup', { outcome: 'block', points: 0, recovery: 'offense', putback: 'made' }),
    rel = sampleClip(c, shotTiming('pullup').release * S + 1e-9).ball;
  let seen = 0,
    tuck = 0;
  for (let t = 0; t <= S; t += 1 / 60) {
    const f = putbackFrame(c, t, rel);
    if (!f) continue;
    seen++;
    if (f.legs === 'tuck') tuck++;
    assert.ok(f.actor >= 1 && f.actor <= 4);
  }
  assert.ok(seen > 20 && tuck > 5);
  assert.equal(putbackFrame(clipOf('pullup', { outcome: 'block', recovery: 'defense' }), 4, rel), null);
});
