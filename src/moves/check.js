// Measurements of a move that tell whether it can look right, before anyone renders it (tests/moves.test.js holds every
// move to them; scripts/moves-sheet.mjs prints them next to the pictures). Body sizes are the guard athlete's
// (public/models/players/guard.glb) in his dribbling crouch.
import { BALL, DRIBBLE, ballDrop } from '../basketball.js';
import { prepare, sample, topOf, BALL_R, PALM, STANCE, GUARD, yawRot, add, sub, len } from './core.js';

export const BODY = {
  shoulder: { x: 0.243, y: 1.657 - 0.135, z: 0.055 }, // shoulder joint, standing height less the crouch (measured on the rig)
  reach: 0.65, // shoulder to wrist with the arm straight (upper arm 0.344 + forearm 0.306)
  hip: { x: 0.102, y: 1.036 - 0.135 },
  thigh: 0.075, // leg radius for clearance
  torso: { y0: 0.98, y1: 1.5, r: 0.17 },
};
const CROUCH = 0.135;

/* Distance from point p to segment ab. */
function segDist(p, a, b) {
  const ab = sub(b, a),
    t = Math.max(
      0,
      Math.min(
        1,
        (sub(p, a)[0] * ab[0] + sub(p, a)[1] * ab[1] + sub(p, a)[2] * ab[2]) /
          Math.max(1e-9, ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2),
      ),
    );
  return len(
    sub(
      p,
      add(
        a,
        ab.map(v => v * t),
      ),
    ),
  );
}

/* Analyses a move (definition, played with hand) every dt seconds. Returns numbers and a list of problems found. */
export function analyse(move, { ctx = null, dt = 1 / 480 } = {}) {
  const P = prepare(move, ctx),
    out = {
      id: P.id,
      start: P.start,
      end: P.end,
      duration: P.duration,
      maxBallSpeed: 0,
      maxHandSpeed: 0,
      bounces: [],
      maxContactError: 0,
      maxReach: 0,
      minClearance: Infinity,
      clearanceAt: null,
      minBallY: Infinity,
      arriveSpeed: 0,
      problems: [],
    };
  // bounces and their restitution, straight from the solved flights
  for (const s of P.segs)
    if (s.flight?.hit != null)
      out.bounces.push({
        t: +(s.t0 + s.flight.hit).toFixed(3),
        e: +s.flight.e.toFixed(3),
        at: s.flight.point,
      });
  let prev = null,
    crouch = CROUCH; // the dribbling crouch, eased like motion.js eases it (almost none in the air)
  for (let t = 0; t <= P.duration + 1e-9; t += dt) {
    const f = sample(P, t),
      b = f.body,
      Tb = p => add(yawRot(p, b.yaw), [b.x, b.y, b.z]),
      _c = (crouch += ((b.y > 0 ? 0.02 * 1.036 : CROUCH) - crouch) * (1 - Math.exp(-7 * dt))),
      drop = b.drop || 0;
    out.minBallY = Math.min(out.minBallY, f.ball[1]);
    if (prev) {
      out.maxBallSpeed = Math.max(out.maxBallSpeed, len(sub(f.ball, prev.ball)) / dt);
      for (const h of ['R', 'L'])
        out.maxHandSpeed = Math.max(out.maxHandSpeed, len(sub(f.hands[h].p, prev.hands[h].p)) / dt);
    }
    // a hand fully on the ball must be where the ball is
    for (const h of ['R', 'L']) {
      const H = f.hands[h];
      if (H.onBall > 0.999) {
        const err = Math.abs(len(sub(H.p, f.ball)) - PALM);
        out.maxContactError = Math.max(out.maxContactError, err);
      }
      // reach from the shoulder: lowered by the drop, tilted forward about the hips by the lean and turned by the twist
      // (motion.js bends the spine and chest by them), then moved with the body
      const pivot = BODY.hip.y + CROUCH - crouch - drop,
        up = BODY.shoulder.y - BODY.hip.y,
        lean = b.lean || 0,
        sh0 = [
          h === 'L' ? BODY.shoulder.x : -BODY.shoulder.x,
          pivot + up * Math.cos(lean),
          BODY.shoulder.z + up * Math.sin(lean),
        ],
        sh = Tb(yawRot(sh0, b.twist || 0));
      const rr = len(sub(H.p, sh)) / BODY.reach;
      if (rr > out.maxReach) {
        out.maxReach = rr;
        out.reachAt = `${t.toFixed(3)}s ${h}`;
      }
    }
    // the drawn ball against the legs (hip to ankle) and the torso
    const drawn = [f.ball[0], f.ball[1] - ballDrop(f.ball[1]), f.ball[2]];
    const legs = ['R', 'L'].map(h => {
        const hip = Tb([h === 'L' ? BODY.hip.x : -BODY.hip.x, BODY.hip.y - drop, 0]),
          ft = f.feet[h].p;
        return [hip, [ft[0], ft[1] + 0.09 + b.y * 0.9, ft[2]]];
      }),
      torso = [Tb([0, BODY.torso.y0 - drop, 0.02]), Tb([0, BODY.torso.y1 - drop, 0.02])],
      c = Math.min(
        ...legs.map(([a, z]) => segDist(drawn, a, z) - BALL_R - BODY.thigh),
        segDist(drawn, ...torso) - BALL_R - BODY.torso.r,
      );
    if (c < out.minClearance) {
      out.minClearance = c;
      out.clearanceAt = +t.toFixed(3);
    }
    prev = f;
  }
  // how fast the ball arrives into the last catch (the next move starts as if from a soft dribble catch)
  const last = sample(P, P.duration),
    before = sample(P, Math.max(0, P.duration - 0.01));
  out.arriveSpeed = len(sub(last.ball, before.ball)) / 0.01;
  // the canonical start and end
  const first = sample(P, 0),
    s0 = topOf(P.start),
    s1 = topOf(P.end),
    endErr = len(sub(last.ball, s1)),
    startErr = len(sub(first.ball, s0));
  const stanceErr = f =>
    Math.max(
      ...['R', 'L'].map(h => Math.hypot(f.feet[h].p[0] - STANCE[h][0], f.feet[h].p[2] - STANCE[h][1])),
    );
  const wrap = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); // a full turn faces the same way as none
  const bodyErr = f =>
    Math.max(
      ...['x', 'y', 'z', 'drop', 'twist', 'side', 'lean'].map(k => Math.abs(f.body[k] || 0)),
      wrap(f.body.yaw || 0),
    );
  const guardErr = (f, h) => len(sub(f.hands[h].p, GUARD[h]));
  out.startError = startErr;
  out.endError = endErr;
  const P_ = out.problems;
  if (startErr > 0.01)
    P_.push(`does not start with the ball at the top of the ${P.start} dribble (${startErr.toFixed(3)} off)`);
  if (endErr > 0.01)
    P_.push(`does not end with the ball at the top of the ${P.end} dribble (${endErr.toFixed(3)} off)`);
  if (first.holder !== P.start && first.holder !== 'both')
    P_.push(`starts with the ball in ${first.holder}, not ${P.start}`);
  if (last.holder !== P.end && last.holder !== 'both')
    P_.push(`ends with the ball in ${last.holder}, not ${P.end}`);
  if (stanceErr(first) > 0.02 || stanceErr(last) > 0.02)
    P_.push('feet do not start and end in the ready stance');
  if (bodyErr(first) > 0.01 || bodyErr(last) > 0.01)
    P_.push('body does not start and end square (offsets back to 0)');
  const off = h => (h === 'R' ? 'L' : 'R');
  if (guardErr(first, off(P.start)) > 0.06) P_.push(`the off hand (${off(P.start)}) does not start at guard`);
  if (guardErr(last, off(P.end)) > 0.06) P_.push(`the off hand (${off(P.end)}) does not end at guard`);
  if (out.minBallY < BALL.floor - 1e-6)
    P_.push(`the ball goes through the floor (${out.minBallY.toFixed(3)})`);
  for (const bn of out.bounces)
    if (bn.e < 0.65 || bn.e > 0.95)
      P_.push(`bounce at ${bn.t}s keeps ${bn.e} of its speed (a floor keeps about ${BALL.bounce})`);
  if (out.maxContactError > 0.005)
    P_.push(`a hand slips off the ball while holding it (${out.maxContactError.toFixed(3)})`);
  if (out.maxReach > 1.04)
    P_.push(`a hand is sent out of reach (${(out.maxReach * 100).toFixed(0)}% of arm length)`);
  if (out.minClearance < -0.03)
    P_.push(`the ball passes through his body at ${out.clearanceAt}s (${out.minClearance.toFixed(3)})`);
  if (out.arriveSpeed > 1.6)
    P_.push(
      `the last catch is hard (${out.arriveSpeed.toFixed(2)} units/s; a dribble arrives at ${DRIBBLE.arrive})`,
    );
  if (out.maxHandSpeed > 12)
    P_.push(`a hand moves implausibly fast (${out.maxHandSpeed.toFixed(1)} units/s)`);
  return out;
}

/* A one-line summary for reports. */
export const summary = a =>
  `${a.id} ${a.start}->${a.end} ${a.duration.toFixed(2)}s | ball max ${a.maxBallSpeed.toFixed(1)} u/s, hand max ${a.maxHandSpeed.toFixed(1)} | bounces ${a.bounces.map(b => `${b.t}s e=${b.e}`).join(', ') || 'none'} | reach ${(a.maxReach * 100).toFixed(0)}% @${a.reachAt} | clearance ${a.minClearance.toFixed(3)} @${a.clearanceAt}s | catch ${a.arriveSpeed.toFixed(2)} u/s` +
  (a.problems.length ? `\n  PROBLEMS: ${a.problems.join('; ')}` : '\n  ok');
