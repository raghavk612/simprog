// The finishes at the rim, as performances (presentation only: the play still decides where everyone is, when the ball
// leaves the hand and where it goes). Every finish that is not a jump shot (those use the title jumper's form, see
// basketball.js shotHands) gets its own technique here:
//   layup (drive)  two hands secure it at the hip on the gather, the right knee drives up off the left foot, the right
//                  hand carries the ball up under it to full extension, the left arm comes off to shield
//   euro step      the layup, with a long step to one side on the gather and a second one back across
//   floater        upright, two hands to the forehead, a one-hand push released early and high with a soft wrist
//   hook           the body turns side-on (the off shoulder to the rim), the off arm up to shield, the shooting arm
//                  sweeps from the hip out and over the head
//   spin           a full spin on the gather with the ball held at the chest, into a layup
//   dunk           a two-foot power take-off, the ball cocked behind the head with both hands, thrown down through the rim,
//                  the hands on the rim and a short hang before he drops and absorbs the landing
//   alley-oop      caught overhead with both hands at the top of the jump, then the same slam
//   roll           a two-hand power layup off two feet
//   putback        (after a block) both hands catch the loose ball, a dip to gather and a two-hand putback straight up
// A finish is authored in the shooter's frame (x his left, y up from his feet, z the way he faces) in seconds from the
// release, mirrored for the left hand (the hand away from the defender: the right on the right of the rim). The ball he
// holds is drawn on the finish's path, which blends in from the play's dribble at the gather and lands exactly on the
// play's release point at the release, so the flight that follows is the play's own.
import { SHOTS, CLIP_SECONDS, shotTiming, family, BALL, blockPlan } from './basketball.js';

const S = CLIP_SECONDS,
  PALM = 0.2, // wrist to ball centre with the hand on the ball (basketball.js PALM_OFF)
  clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  sm = x => ((x = clamp(x)), x * x * (3 - 2 * x)),
  mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k),
  unit = v => {
    const l = Math.hypot(...v) || 1;
    return v.map(x => x / l);
  };
/* A value along keyframes [[time, value], ...] (value a number or an array), eased between keys and held outside. */
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1],
        [t1, b] = keys[i],
        k = sm((t - t0) / Math.max(1e-6, t1 - t0));
      return Array.isArray(a) ? mix(a, b, k) : a + (b - a) * k;
    }
  return keys[keys.length - 1][1];
}
/* The finish a play's shooter performs, or null (jump shots keep their own form). */
export const FINISHES = ['drive', 'euro', 'floater', 'hook', 'spin', 'dunk', 'alley', 'roll'];
export const finishOf = kind => (FINISHES.includes(kind) ? kind : null);

/* ---- The finishes (right-handed; times in seconds from the release, negative before it) ----
   ball: where the ball is held. R, L: per hand, {n: from the ball to the palm} while on the ball, or {p: a wrist
   position} off it; pole: where the elbow points; flex: wrist (+ toward the palm); w: weight. body: lean (+ forward),
   drop (pelvis, units), side (+ toward his left), twist. legs: the shape in the air. yaw: the body's turn (radians,
   + toward his left). */
const POCKET = [-0.24, 1.05, 0.28];
function layupKeys(T, opts = {}) {
  const off = opts.twoHand;
  return {
    ball: [
      [T.gatherS + 0.1, POCKET],
      [T.takeoffS, [-0.16, 1.32, 0.32]],
      [T.takeoffS * 0.4, [-0.2, 1.95, 0.32]],
      [0, [-0.18, 2.4, 0.36]],
    ],
    R: {
      n: [[0, [-0.25, -0.75, -0.6]]],
      pole: [0.2, -0.6, -0.4],
      flex: [
        [-0.2, 0.3],
        [0.05, 1.0],
      ],
    },
    L: off
      ? { n: [[0, [0.95, -0.1, -0.2]]] }
      : {
          n: [[0, [0.95, 0.05, -0.15]]],
          off: T.takeoffS * 0.3, // the off hand comes off the ball to shield
          p: [[0, [0.38, 1.62, 0.3]]],
          pole: [0.8, -0.4, -0.2],
        },
    follow: [
      [0.06, [-0.18, 2.3, 0.48]],
      [T.landS, [-0.2, 1.95, 0.5]],
    ],
    body: {
      lean: [
        [T.gatherS, 0.05],
        [T.takeoffS - 0.05, -0.12],
        [T.takeoffS + 0.15, 0.06],
        [T.landS, 0.08],
        [T.landS + 0.3, 0],
      ],
      drop: [
        [T.gatherS, 0],
        [T.takeoffS - 0.12, 0.09],
        [T.takeoffS + 0.06, 0],
        [T.landS, 0],
        [T.landS + 0.1, 0.12],
        [T.landS + 0.4, 0],
      ],
    },
    legs: off ? 'tuck' : 'kneeR',
  };
}
function floaterKeys(T) {
  return {
    ball: [
      [T.gatherS + 0.1, [-0.12, 1.15, 0.3]],
      [T.takeoffS, [-0.05, 1.62, 0.34]],
      [T.takeoffS * 0.3, [-0.12, 2.08, 0.38]],
      [0, [-0.14, 2.3, 0.46]],
    ],
    R: {
      n: [[0, [-0.15, -0.8, -0.55]]],
      pole: [0.15, -0.7, -0.2],
      flex: [
        [-0.15, 0.2],
        [0.08, 0.9],
      ],
    },
    L: { n: [[0, [0.95, 0, -0.2]]], off: -0.1, p: [[0, [0.3, 1.75, 0.38]]], pole: [0.7, -0.6, -0.1] },
    follow: [
      [0.08, [-0.12, 2.18, 0.55]],
      [T.landS, [-0.14, 1.85, 0.5]],
    ],
    body: {
      lean: [
        [T.gatherS, 0.05],
        [T.takeoffS, -0.04],
        [0, -0.06],
        [T.landS + 0.3, 0],
      ],
      drop: [
        [T.gatherS, 0],
        [T.takeoffS - 0.1, 0.07],
        [T.takeoffS + 0.05, 0],
        [T.landS, 0],
        [T.landS + 0.1, 0.09],
        [T.landS + 0.35, 0],
      ],
    },
    legs: 'softTuck',
  };
}
function hookKeys(T) {
  return {
    yaw: [
      [T.gatherS + 0.15, 0],
      [T.takeoffS, -1.2],
      [T.landS + 0.15, -1.2],
      [T.landS + 0.55, 0],
    ],
    ball: [
      [T.gatherS + 0.1, [-0.05, 1.25, 0.3]],
      [T.takeoffS, [-0.35, 1.25, 0.12]],
      [T.takeoffS * 0.45, [-0.55, 1.95, 0.02]],
      [0, [-0.22, 2.55, 0.02]],
    ],
    R: {
      n: [[0, [-0.55, -0.8, -0.1]]],
      pole: [-0.7, -0.5, -0.2],
      flex: [
        [-0.15, 0.1],
        [0.05, 1.0],
      ],
    },
    L: {
      n: [[0, [0.9, 0, -0.3]]],
      off: T.takeoffS + 0.05,
      p: [[0, [0.42, 1.88, 0.12]]],
      pole: [1, -0.15, -0.2],
    },
    follow: [
      [0.08, [0.05, 2.45, 0.1]],
      [T.landS, [0.12, 2.0, 0.2]],
    ],
    body: {
      lean: [
        [T.gatherS, 0.08],
        [T.takeoffS, -0.02],
        [T.landS + 0.3, 0],
      ],
      side: [
        [T.takeoffS - 0.1, 0],
        [T.takeoffS + 0.1, 0.16],
        [T.landS, 0.1],
        [T.landS + 0.35, 0],
      ],
      drop: [
        [T.gatherS, 0],
        [T.takeoffS - 0.1, 0.1],
        [T.takeoffS + 0.05, 0],
        [T.landS, 0],
        [T.landS + 0.1, 0.1],
        [T.landS + 0.4, 0],
      ],
    },
    legs: 'hook',
  };
}
function dunkKeys(T, opts = {}) {
  const lob = opts.lob,
    cocked = [0, 2.62, -0.06];
  return {
    ball: lob
      ? [
          [T.gatherS + 0.1, [-0.1, 1.2, 0.3]],
          [T.takeoffS + 0.05, [0, 1.9, 0.35]],
          [T.takeoffS * 0.45, [0, 2.7, 0.22]],
          [-0.08, cocked],
          [0, [0, 2.45, 0.48]],
        ]
      : [
          [T.gatherS + 0.1, [-0.1, 1.15, 0.3]],
          [T.takeoffS - 0.05, [0, 1.25, 0.34]],
          [T.takeoffS * 0.5, [0, 2.1, 0.25]],
          [-0.1, cocked],
          [0, [0, 2.45, 0.48]],
        ],
    R: {
      n: [[0, [-0.95, 0.1, -0.25]]],
      pole: [-0.8, -0.3, -0.3],
      flex: [
        [-0.1, -0.5],
        [0.04, 0.9],
      ],
    },
    L: {
      n: [[0, [0.95, 0.1, -0.25]]],
      pole: [0.8, -0.3, -0.3],
      flex: [
        [-0.1, -0.5],
        [0.04, 0.9],
      ],
    },
    hang: { from: 0.05, to: 0.4 }, // hands on the rim
    // when it never reaches the rim (a blocked dunk), the hands come down from the throw
    follow: [
      [0.06, [0, 2.3, 0.45]],
      [T.landS, [0, 1.75, 0.4]],
    ],
    body: {
      lean: [
        [T.gatherS, 0.1],
        [T.takeoffS - 0.05, -0.05],
        [T.takeoffS * 0.4, -0.16],
        [0, 0.18],
        [0.4, 0.05],
        [T.landS + 0.25, 0.1],
        [T.landS + 0.6, 0],
      ],
      drop: [
        [T.gatherS, 0],
        [T.takeoffS - 0.15, 0.16],
        [T.takeoffS + 0.02, 0],
        [T.landS + 0.2, 0],
        [T.landS + 0.3, 0.16],
        [T.landS + 0.7, 0],
      ],
    },
    legs: 'dunk',
  };
}
const KEYS = {
  drive: T => layupKeys(T),
  euro: T => ({
    ...layupKeys(T),
    shift: [
      [T.gatherS + 0.05, 0],
      [T.gatherS + 0.3, 0.38],
      [T.takeoffS - 0.02, -0.3],
      [0, -0.18],
      [T.landS + 0.3, 0],
    ],
  }),
  roll: T => layupKeys(T, { twoHand: true }),
  floater: floaterKeys,
  hook: T => hookKeys(T),
  // the spin move: a full turn on the gather with the ball held at the chest in both hands, into a layup
  spin: T => ({
    ...layupKeys(T),
    yaw: [
      [T.gatherS + 0.04, 0],
      [T.takeoffS + 0.02, -2 * Math.PI],
    ],
    ball: [
      [T.gatherS + 0.1, [-0.05, 1.22, 0.3]],
      [T.takeoffS - 0.02, [-0.08, 1.3, 0.3]],
      [T.takeoffS * 0.4, [-0.2, 1.95, 0.32]],
      [0, [-0.18, 2.4, 0.36]],
    ],
  }),
  dunk: T => dunkKeys(T),
  alley: T => dunkKeys(T, { lob: true }),
};
/* Seconds of the shot's beats from the release, for a kind. */
export function finishTimes(kind) {
  const T = shotTiming(kind);
  return {
    T,
    gatherS: (T.gather - T.release) * S,
    takeoffS: (T.takeoff - T.release) * S,
    landS: (T.land - T.release) * S,
  };
}

/* The dunker's drawn height above the play's jump (presentation): he rises `boost` higher so his hands reach over the
   rim, hangs on it for `hang` seconds (sagging a little), then falls under gravity from there. Returns {lift, land}: the
   height to add to the play's jump at tr seconds from the release, and when he lands (seconds from the release). */
export function dunkLift(T, tr, { boost = 0.28, hang = 0.18 } = {}) {
  const J = T.jump,
    playY = tr => Math.max(0, J - 0.5 * BALL.g * tr * tr),
    takeoffS = (T.takeoff - T.release) * S,
    top = J + boost,
    hangY = top - 0.06,
    land = hang + Math.sqrt((2 * hangY) / BALL.g);
  let y;
  if (tr < 0) y = playY(tr) + boost * sm((tr - takeoffS) / -takeoffS);
  else if (tr < hang) y = top - 0.06 * sm(tr / hang);
  else y = Math.max(0, hangY - 0.5 * BALL.g * (tr - hang) ** 2);
  return { lift: y - playY(tr), land };
}

/* A finish at a moment of its play. me = the shooter as drawn {x, z, yaw, y (the play's jump), scale}; playBall = the
   play's ball (world); release = the play's release point (world {x, y, z}). Returns null outside the finish, or
   {hands, body, legs, yaw, shift, lift, ball, look, weight}: hands and ball in world space, yaw added to his facing,
   shift (world) and lift added to where he is drawn. */
export function finishFrame(clip, time, me, playBall, release) {
  const kind = finishOf(clip.kind);
  if (!kind || clip.outcome === 'steal') return null;
  const F = finishTimes(clip.kind),
    T = F.T,
    tr = time - T.release * S,
    dunk = kind === 'dunk' || kind === 'alley',
    hangs = dunk && clip.outcome !== 'block', // a blocked dunk never reaches the rim
    DL = dunk ? dunkLift(T, tr, hangs ? {} : { hang: 0, boost: 0.18 }) : null,
    landS = dunk ? DL.land : F.landS,
    K = KEYS[kind]({ ...F, landS });
  if (tr < F.gatherS - 0.05 || tr > landS + 0.7) return null;
  // the hand away from the defender: the right on the right of the rim (as he faces it), mirrored for the left
  const right = (clip.lane || 1) * (clip.team === 'home' ? 1 : -1) >= 0,
    mx = right ? 1 : -1,
    sc = me.scale || 1,
    M = p => [p[0] * mx * sc, p[1] * sc, p[2] * sc],
    yawAdd = K.yaw ? track(K.yaw, tr) * mx : 0,
    yaw = me.yaw + yawAdd,
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    shiftL = K.shift ? track(K.shift, tr) * mx * sc : 0,
    shift = [shiftL * Math.cos(me.yaw), 0, -shiftL * Math.sin(me.yaw)],
    lift = DL ? DL.lift : 0,
    // his frame: x his left = (cos, -sin), z forward = (sin, cos); y up from his drawn feet
    base = [me.x + shift[0], me.y + lift, me.z + shift[2]],
    W = p => [base[0] + p[0] * c + p[2] * s, base[1] + p[1], base[2] - p[0] * s + p[2] * c],
    D = n => {
      const u = unit(n);
      return [u[0] * c + u[2] * s, u[1], -u[0] * s + u[2] * c];
    },
    held = tr < 0;
  // the ball in his hands: from the play's dribble at the gather onto the finish's path, onto the release point exactly
  let ball = null;
  if (held) {
    const path = W(M(track(K.ball, tr))),
      atRel = W(M(track(K.ball, 0))),
      k = sm((tr + 0.2) / 0.2),
      inn = sm((tr - F.gatherS) / 0.12),
      onPath = [0, 1, 2].map(i => path[i] + ([release.x, release.y, release.z][i] - atRel[i]) * k);
    ball = mix([playBall.x, playBall.y, playBall.z], onPath, inn);
  }
  const grip = (spec, h) => {
    const n = D(M(track(spec.n, tr)));
    return ball.map((v, i) => v + n[i] * PALM * sc);
  };
  // hands: the shooting hand (R, mirrored) and the off hand (L, mirrored)
  const hands = {},
    fade = 1 - sm((tr - (landS + 0.2)) / 0.3),
    on = sm((tr - F.gatherS) / 0.1),
    rimX = 12.15 * (clip.team === 'home' ? 1 : -1);
  for (const role of ['R', 'L']) {
    const h = right ? role : role === 'R' ? 'L' : 'R',
      spec = K[role];
    let p = null,
      w = on * fade;
    if (held && (spec.off == null || tr < spec.off)) p = grip(spec, h);
    else if (held) p = mix(grip(spec, h), W(M(track(spec.p, tr))), sm((tr - spec.off) / 0.12));
    else if (hangs) {
      // after the throw both hands go to the front of the rim and hang on it, then let go
      const rimFront = [
          rimX - Math.sign(rimX) * 0.21,
          BALL.rim + 0.02,
          (h === 'R' ? -1 : 1) * 0.11 * Math.sign(rimX),
        ],
        onRim = sm(tr / 0.06) * (1 - sm((tr - 0.18) / 0.08));
      p = mix(W(M([0, 2.3, 0.5])), rimFront, onRim);
      w *= 1 - sm((tr - 0.24) / 0.3);
    } else if (role === 'R') p = W(M(track(K.follow, tr)));
    else if (spec.p) p = W(M(track(spec.p, tr)));
    if (!p) continue;
    hands[h] = {
      p,
      flex: spec.flex ? track(spec.flex, tr) : 0,
      pron: role === 'R' ? 0.45 : 0.2,
      pole: spec.pole ? D(M(spec.pole)) : null,
      w,
    };
  }
  // body and legs
  const body = {};
  for (const k of ['lean', 'drop', 'side', 'twist'])
    if (K.body[k])
      body[k] = track(K.body[k], tr) * (k === 'side' || k === 'twist' ? mx : 1) * (k === 'drop' ? sc : 1);
  if (K.shift) {
    // leaning into the euro's lateral steps
    const v = (track(K.shift, tr + 0.04) - track(K.shift, tr - 0.04)) / 0.08;
    body.side = (body.side || 0) - clamp(v * 0.12, -0.18, 0.18) * mx;
  }
  const inAir = tr > F.takeoffS + 0.02 && tr < landS - 0.02;
  return {
    hands,
    body,
    legs: inAir ? K.legs : null,
    legSide: right ? 'R' : 'L',
    yaw: yawAdd,
    shift,
    lift,
    ball,
    look: [rimX, BALL.rim, 0],
    weight: on * fade,
  };
}

/* The putback after a block: the player who wins the loose ball (blockPlan) catches it with both hands, dips to gather and
   goes straight back up with both hands under it. Returns null when there is none at this moment. */
export function putbackFrame(clip, time, release) {
  if (clip.outcome !== 'block' || clip.recovery !== 'offense') return null;
  const P = blockPlan(clip, release),
    u = time / S;
  if (!P.putback || u < P.CATCH - 0.08 || u > P.putback.ARR + 0.16) return null;
  const tg = (u - P.putback.GO) * S, // from the take-off
    tc = (u - P.CATCH) * S, // from the catch
    tl = (u - P.putback.ARR) * S;
  return {
    actor: P.win.i,
    body: {
      drop:
        track(
          [
            [-0.3, 0],
            [-0.05, 0.12],
            [0.08, 0],
            [0.42, 0],
            [0.5, 0.1],
            [0.8, 0],
          ],
          tg,
        ) * (tc > -0.3 ? 1 : 0),
      lean: track(
        [
          [-0.3, 0.12],
          [-0.05, 0.08],
          [0.15, -0.05],
          [0.5, 0],
          [0.8, 0],
        ],
        tg,
      ),
    },
    legs: tg > 0 && tl < 0 ? 'tuck' : null,
    weight: sm((tc + 0.2) / 0.15) * (1 - sm((tl - 0.1) / 0.25)),
  };
}
export const isFinish = kind => !!finishOf(kind);
export const finishFamily = kind => family(kind);
export { SHOTS };
