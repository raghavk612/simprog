// The other actions of a play, as performances (presentation only, like src/finishes.js: the play decides where everyone is
// and where the ball goes; this decides what their bodies do about it):
//   pass      the passer steps into it, hands on the ball until it leaves, then a follow-through toward the receiver
//             (arms long, thumbs turned down); the dunk's outlet is a two-hand overhead throw
//   catch     the receiver shows a target and his hands meet the ball before it arrives
//   steal     the defender lunges and pokes the near hand at the ball
//   rebound   a box-out (low, wide, back to the basket) as the shot comes off, then a two-hand rise to the ball, a hop
//   contest   the on-ball defender's high hand rises with his jump to its full reach at the release, a hand in the shot's
//             path rather than two arms held up for a second and a half; the help defender's is smaller
// Each returns {actor, hands, body, lift, legs, arms, weight}: hands in world space ([x, y, z]), lift added to his drawn
// height, arms (optional) overriding the play's arm pose for the body underneath.
import { CLIP_SECONDS, family, blockHit, sampleClip } from './basketball.js';

const S = CLIP_SECONDS,
  clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  sm = x => ((x = clamp(x)), x * x * (3 - 2 * x)),
  bell = (t, a, b, c) => sm((t - a) / (b - a)) * (1 - sm((t - b) / (c - b))), // 0 -> 1 at b -> 0
  unit = v => {
    const l = Math.hypot(...v) || 1;
    return v.map(x => x / l);
  };
/* A frame on a player: x his left, z the way he faces, y up from his feet. */
function frameOf(a) {
  const c = Math.cos(a.yaw),
    s = Math.sin(a.yaw);
  return {
    W: p => [a.x + p[0] * c + p[2] * s, (a.y || 0) + p[1], a.z - p[0] * s + p[2] * c],
    toLocal: (x, z) => {
      const dx = x - a.x,
        dz = z - a.z;
      return [dx * c - dz * s, dx * s + dz * c]; // [left, forward]
    },
  };
}
const contestCache = new WeakMap();
/* Where the ball is when a contest is closest to it (the block moment of the same play). */
function contestBall(clip) {
  let b = contestCache.get(clip);
  if (!b) contestCache.set(clip, (b = sampleClip(clip, blockHit(clip.kind) * S).ball));
  return b;
}

export function actionFrames(clip, time, pose) {
  const out = [],
    t = time / S,
    fam = family(clip.kind),
    home = clip.team === 'home',
    off = home ? 0 : 5,
    def = home ? 5 : 0,
    A = pose.actors,
    ball = pose.ball,
    HIT = blockHit(clip.kind);
  // ---- the pass: the catch-and-shoot's swing pass, the dunk's outlet ----
  const passer = off + 1,
    receiver = off,
    passWindow = fam === 'catch' ? [0, 0.3] : fam === 'dunk' ? [0, 0.2] : null;
  if (passWindow && !clip.afterSteal && clip.outcome !== 'steal') {
    const p = A[passer],
      r = A[receiver],
      F = frameOf(p),
      [lx, lz] = F.toLocal(r.x, r.z),
      d = Math.hypot(lx, lz) || 1,
      dir = [lx / d, 0, lz / d],
      overhead = fam === 'dunk',
      tp = time, // seconds into the play: the ball leaves his hands at the start
      w = 1 - sm((tp - 0.55) / 0.3),
      reach = overhead
        ? [dir[0] * 0.35, 2.15, Math.max(0.2, dir[2] * 0.35)]
        : [dir[0] * 0.55, 1.32, dir[2] * 0.55],
      hands = {};
    for (const [h, sx] of [
      ['R', -1],
      ['L', 1],
    ]) {
      // across his body: the hands a little apart, square to the receiver
      const lat = [dir[2] * sx * 0.12, 0, -dir[0] * sx * 0.12],
        follow = [reach[0] + lat[0], reach[1] - (overhead ? 0 : 0.05), reach[2] + lat[2]];
      hands[h] = {
        p: F.W(follow),
        flex: overhead ? 0.9 : 0.6,
        pron: overhead ? 0.2 : 1.1,
        pole: null,
        w: w * sm(tp / 0.08),
      };
    }
    if (w > 0.01)
      out.push({
        actor: passer,
        hands,
        body: { lean: 0.16 * bell(tp, 0, 0.12, 0.6), twist: Math.atan2(dir[0], dir[2]) * 0.4 * w },
        weight: w,
      });
    // the catch: the receiver's hands come up to meet it
    const tc = t - passWindow[1],
      cw = bell(tc, -0.16, -0.01, 0.04);
    if (cw > 0.01) {
      const R = frameOf(r),
        [bx, bz] = R.toLocal(ball.x, ball.z),
        to = unit([bx, 0, Math.max(0.3, bz)]),
        target = [
          to[0] * 0.45,
          Math.max(1.1, Math.min(1.7, ball.y - (r.y || 0))),
          Math.max(0.3, to[2] * 0.45),
        ],
        hands = {};
      for (const [h, sx] of [
        ['R', -1],
        ['L', 1],
      ])
        hands[h] = {
          p: R.W([target[0] + sx * 0.13, target[1], target[2]]),
          flex: -0.3,
          pron: 0.6,
          pole: null,
          w: cw,
        };
      out.push({ actor: receiver, hands, body: { lean: 0.06 * cw }, weight: cw });
    }
  }
  // ---- the steal: the on-ball defender lunges and pokes the near hand at the ball ----
  if (clip.outcome === 'steal') {
    const m = A[def],
      F = frameOf(m),
      [bx] = F.toLocal(ball.x, ball.z),
      h = bx > 0 ? 'L' : 'R',
      w = bell(t, 0.2, 0.29, 0.36);
    out.push({
      actor: def,
      hands: { [h]: { p: [ball.x, ball.y + 0.05, ball.z], flex: 0.4, pron: 1.2, pole: null, w } },
      body: { lean: 0.32 * w, drop: 0.1 * w, side: (h === 'L' ? 0.1 : -0.1) * w },
      weight: w,
    });
    // the player he took it from straightens up and turns to chase (not into a defensive stance)
    if (t > 0.3) out.push({ actor: off, arms: 'relax', hands: {}, body: {}, weight: 1 });
  }
  // ---- the rebound (a miss): box out, then rise to it ----
  if (!clip.points && clip.outcome !== 'steal' && clip.outcome !== 'block') {
    const ri = def + (home ? 4 : 0),
      r = A[ri],
      F = frameOf(r),
      box = bell(t, 0.7, 0.8, 0.9),
      rise = sm((t - 0.88) / 0.06),
      hop = Math.max(0, Math.sin(clamp((t - 0.925) / 0.075) * Math.PI)) * 0.32,
      hands = {};
    for (const [h, sx] of [
      ['R', -1],
      ['L', 1],
    ]) {
      const wide = F.W([sx * 0.5, 1.05, 0.12]),
        up = [ball.x + sx * 0.12 * Math.cos(r.yaw), ball.y, ball.z - sx * 0.12 * Math.sin(r.yaw)];
      hands[h] = {
        p: wide.map((v, i) => v + (up[i] - v) * rise),
        flex: rise > 0.5 ? -0.3 : 0,
        pron: 0.5,
        pole: null,
        w: Math.max(box, rise),
      };
    }
    out.push({
      actor: ri,
      hands,
      body: { drop: 0.13 * box, lean: 0.12 * box - 0.05 * rise },
      lift: hop,
      legs: hop > 0.03 ? 'tuck' : null,
      weight: Math.max(box, rise),
    });
  }
  // ---- the contest: the high hand rises with the jump to its full reach at the release ----
  if (clip.outcome !== 'block' && clip.outcome !== 'steal') {
    const target = contestBall(clip);
    for (const [i, k] of [
      [def, 1],
      [def + 2, 0.55],
    ]) {
      const m = A[i],
        F = frameOf(m),
        [tx] = F.toLocal(target.x, target.z),
        h = tx > 0 ? 'L' : 'R',
        sx = h === 'L' ? 1 : -1,
        // up over the last 0.35 s before the ball would be reached, down again as he lands (clip fractions)
        w = bell(t, HIT - 0.35 / S, HIT - 0.003, HIT + 0.4 / S) * k,
        // a hand in the shot's path short of the ball (a contest, not a foul): from him toward the ball, a little below it
        to = unit([target.x - m.x, 0, target.z - m.z]),
        p = [target.x - to[0] * 0.38, target.y - 0.12, target.z - to[2] * 0.38],
        other = F.W([-sx * 0.28, 1.95, 0.25]);
      if (w > 0.01)
        out.push({
          actor: i,
          hands: {
            [h]: { p, flex: 0.2, pron: 0.9, pole: null, w },
            [h === 'L' ? 'R' : 'L']: { p: other, flex: 0, pron: 0.4, pole: null, w: w * 0.8 },
          },
          body: { lean: 0.05 * w },
          weight: w,
        });
    }
  }
  return out;
}
