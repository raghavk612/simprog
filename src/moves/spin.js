// Spin move (showtime): a full turn with the ball, out on the other hand. Written for the right hand (the Routine mirrors
// it for the left). See README.md.
//
// A right-hand dribbler spins to his RIGHT (a reverse pivot): he plants his left foot and turns his back to the defender,
// so the ball, pulled round at his right hip, stays on the far side of his body the whole way. Here the left foot is the
// pivot for the whole turn (it stays planted and turns on the spot); the right foot swings round behind him, touches down
// half way, and swings on round to the stance; the hips orbit the pivot foot. Coming out of the spin the right hand pushes
// the ball low across to the left, and he dribbles on with the left.
import { GUARD, PALM, STANCE, topOf, yawRot, track } from './core.js';

const R0 = topOf('R'),
  L1 = topOf('L');

/* The beats (seconds). */
const LOAD = 0.2, // weight onto the left foot, the ball pulled in to the right hip
  SPIN0 = 0.24,
  SPIN1 = 1.09, // the turn: a full circle to the right (yaw 0 -> -2 pi), quickest in the middle
  PUSH = 1.19, // out of the spin, the right hand drives the ball low across to the left
  END = 1.62;

/* How far round he has turned at time t (radians, negative = to his right), easing in and out of the turn. */
const turn = t => {
  const u = Math.max(0, Math.min(1, (t - SPIN0) / (SPIN1 - SPIN0)));
  return -2 * Math.PI * (u * u * u * (u * (6 * u - 15) + 10));
};
/* The pivot (left foot) and where the hips are relative to it: the weight comes over the pivot for the turn. */
const PIVOT = [STANCE.L[0], 0, STANCE.L[1]],
  reach = track([
    { t: 0, v: 1 },
    { t: LOAD, v: 0.62 },
    { t: SPIN1, v: 0.62 },
    { t: PUSH + 0.15, v: 1 },
  ]),
  hips = t => {
    const off = yawRot([-STANCE.L[0] * reach(t), 0, -STANCE.L[1]], turn(t)); // from the pivot to the hips, turning
    return [PIVOT[0] + off[0], PIVOT[2] + off[2]];
  };
/* Where the right foot is when he has turned by a (it keeps its stance place relative to the pivot, turning with him). */
const rightFoot = a => {
  const off = yawRot([STANCE.R[0] - STANCE.L[0], 0, STANCE.R[1] - STANCE.L[1]], a);
  return [PIVOT[0] + off[0], PIVOT[2] + off[2], a];
};
/* The time at which he has turned by a (inverse of turn, by search). */
const when = a => {
  let lo = SPIN0,
    hi = SPIN1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (turn(m) > a) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};

const body = [];
for (let t = 0; t <= END + 1e-9; t += 0.03) {
  const [x, z] = hips(t),
    a = turn(t),
    spinning = t > SPIN0 && t < SPIN1,
    k = Math.sin(Math.PI * Math.max(0, Math.min(1, (t - SPIN0) / (SPIN1 - SPIN0))));
  body.push({
    t: +t.toFixed(3),
    x: Math.abs(x) < 1e-9 ? 0 : x,
    z: Math.abs(z) < 1e-9 ? 0 : z,
    yaw: a,
    // low through the turn, the shoulders leading it and the head whipping round first
    drop:
      t < LOAD ? 0.12 * (t / LOAD) : t < SPIN1 ? 0.12 : 0.12 * Math.max(0, 1 - (t - SPIN1) / (END - SPIN1)),
    lean:
      t < LOAD ? 0.12 * (t / LOAD) : t < SPIN1 ? 0.12 : 0.12 * Math.max(0, 1 - (t - SPIN1) / (END - SPIN1)),
    twist: spinning ? -0.3 * k : 0,
    side: spinning ? 0.06 * k : 0,
  });
}
body[body.length - 1] = { t: END, x: 0, z: 0, yaw: -2 * Math.PI, drop: 0, lean: 0, twist: 0, side: 0 };

/* The right foot: lifts as the turn starts, swings round behind him, touches down half way round, swings on round in front
   and lands back in the stance. The left foot pivots on the spot. */
const swing = [];
for (const [a, y] of [
  [-0.25 * Math.PI, 0.1],
  [-0.55 * Math.PI, 0.13],
  [-0.85 * Math.PI, 0.07],
  [-Math.PI, 0], // touch down, half way
  [-1.12 * Math.PI, 0],
  [-1.3 * Math.PI, 0.09],
  [-1.6 * Math.PI, 0.12],
  [-1.85 * Math.PI, 0.06],
])
  swing.push({ t: +when(a).toFixed(3), R: [...rightFoot(a), y] });
const feet = [
  { t: 0, R: STANCE.R, L: STANCE.L },
  { t: SPIN0, R: STANCE.R, L: [...STANCE.L.slice(0, 2), 0] },
  ...swing,
  ...[0.25, 0.5, 0.75].map(f => ({
    t: +when(-2 * Math.PI * f).toFixed(3),
    L: [STANCE.L[0], STANCE.L[1], -2 * Math.PI * f],
  })),
  { t: SPIN1, R: [STANCE.R[0], STANCE.R[1], -2 * Math.PI], L: [STANCE.L[0], STANCE.L[1], -2 * Math.PI] },
  { t: END, R: [STANCE.R[0], STANCE.R[1], -2 * Math.PI], L: [STANCE.L[0], STANCE.L[1], -2 * Math.PI] },
];

export const spinMove = {
  id: 'spinMove',
  label: 'Spin move',
  family: 'show',
  start: 'R',
  end: 'L',
  duration: END,
  ball: [
    {
      // pulled down to the right hip and carried round with him, the palm on its outside (body frame: it turns with him)
      hold: 'R',
      until: PUSH,
      keys: [
        { t: 0, p: R0 },
        { t: LOAD, p: [-0.4, 0.86, 0.12] },
        { t: (SPIN0 + SPIN1) / 2, p: [-0.42, 0.88, 0.02] }, // tucked at the hip, a little back, as his back passes the defender
        { t: SPIN1, p: [-0.4, 0.86, 0.14] },
        { t: PUSH, p: [-0.24, 0.72, 0.3] }, // out of the turn: driven down and across
      ],
      n: [
        { t: 0, v: [0, 1, 0] },
        { t: LOAD, v: [-0.55, 0.8, 0.1] },
        { t: SPIN1, v: [-0.6, 0.78, 0] },
        { t: PUSH, v: [-0.55, 0.8, -0.05] },
      ],
    },
    { free: true, until: END, bounce: [0.02, 0.36] },
    { hold: 'L', until: END, keys: [{ t: 0, p: L1 }], n: [0, 1, 0] },
  ],
  hands: {
    R: [
      { t: 0, p: [R0[0], R0[1] + PALM, R0[2]], flex: -0.6, pron: 1.35 },
      { t: PUSH, p: [-0.35, 0.86, 0.29], flex: 0.1, pron: 1.35 },
      { t: PUSH + 0.1, p: [-0.24, 0.9, 0.34], flex: 0.25, pron: 1.0 }, // follows through toward the middle
      { t: END - 0.08, p: GUARD.R, flex: 0, pron: 0.2 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: LOAD, p: [0.26, 1.2, 0.22], flex: 0, pron: 0.1 }, // the left arm up, fending, tucked in for the turn
      { t: SPIN1, p: [0.3, 1.18, 0.28], flex: -0.2, pron: 0.5 },
      { t: PUSH + 0.12, p: [0.42, 1.12, 0.28], flex: -0.35, pron: 1.0 }, // out to meet the ball
      { t: END - 0.05, p: [L1[0], L1[1] + PALM + 0.01, L1[2]], flex: -0.6, pron: 1.35 },
    ],
  },
  feet,
  body,
};

export default [spinMove];
