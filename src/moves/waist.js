// Around the waist: the warm-up drill as a show piece. Written for the right hand (mirrored for the left). See README.md.
import { GUARD, PALM, STANCE, topOf, track } from './core.js';

const R0 = topOf('R');
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => ((x = clamp01(x)), x * x * (3 - 2 * x));
const norm = v => {
  const l = Math.hypot(...v);
  return v.map(c => c / l);
};
const lerp = (a, b, k) => a + (b - a) * k;
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map(v => v * k);

/* The circle: an ellipse round his hips at belt height, wider side to side (hips and shorts) than front to back. Angle phi:
   0 in front, -pi/2 at his right hip, -pi behind; the ball goes front -> right -> back -> left -> front (phi falling). */
const Y = 1.03,
  RX = 0.36,
  RZ = 0.33,
  CZ = 0.01;
const ring = phi => [RX * Math.sin(phi), Y, CZ + RZ * Math.cos(phi)];

/* Palms: each hand stays on its own side of the ball, on its upper outside (palm in and a little down, fingers round it).
   Kept above n.y 0.5 so the wrist (cocked back, as when it catches the dribble) never changes while holding. */
const NR = norm([-1, 0.7, 0]),
  NL = norm([1, 0.7, 0]),
  UP = [0, 1, 0];

/* ---- Timing ----
   q counts half-laps from the set in front (q = 0): odd q is a handover behind his back, even q one in front. Its pace
   eases in from the set and then grows a little every lap. The ball's angle is phi = -pi * S(q); S slows the ball at each
   handover (so the hands can meet it) and lets it run round the hips. */
const T_SET = 0.24, // the ball reaches his belly and both hands are on it
  RAMP = 0.32, // seconds for the pace to build from the set
  RATE0 = 2.5, // half-laps per second once going
  ACC = 0.55, // and how much that grows per second
  HALF = 6, // three laps
  MOD = 0.6, // at a handover the ball runs at (1 - MOD) of its pace, round the hips at (1 + MOD)
  W = 0.08; // half-width of a handover (both hands on the ball), in half-laps
const S = q => q - (MOD / (2 * Math.PI)) * Math.sin(2 * Math.PI * q);

const DT = 1 / 2000,
  QS = [0];
for (let i = 1; QS[i - 1] < HALF + 0.5; i++) {
  const rate = u => smooth(u / RAMP) * (RATE0 + ACC * u);
  QS.push(QS[i - 1] + ((rate((i - 1) * DT) + rate(i * DT)) / 2) * DT);
}
const qAt = t => {
  if (t <= T_SET) return 0;
  const f = (t - T_SET) / DT,
    i = Math.min(QS.length - 2, Math.floor(f));
  return lerp(QS[i], QS[i + 1], f - i);
};
const tAt = q => {
  let lo = 0,
    hi = QS.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (QS[mid] < q) lo = mid;
    else hi = mid;
  }
  return T_SET + (lo + (q - QS[lo]) / (QS[hi] - QS[lo])) * DT;
};
const phiAt = t => -Math.PI * S(qAt(t));

/* The ball's path up to the push back into the dribble: the gather (catch the dribble, bring it to the belly), then the
   circle. One function, cut into holds below, so nothing kinks where one hand gives it to the other. */
const gather = track(
  [
    { t: 0, v: R0 },
    { t: 0.13, v: [-0.2, 1.035, 0.32] },
    { t: T_SET, v: ring(0) },
  ],
  { d0: [0, 0.18, 0] }, // it arrives up into the hand softly, as a dribble does
);
const path = t => (t <= T_SET ? gather(t) : ring(phiAt(t)));
const velAt = t => mul(add(path(t + 0.001), mul(path(t - 0.001), -1)), 1 / 0.002);

const tq = q => tAt(q),
  T_LAST = tq(HALF + W), // the right hand has it alone again in front, after three laps
  CARRY = 0.2, // carries it out to his right hip, rolling his hand on top, and pushes it down
  T_REL = T_LAST + CARRY,
  FLIGHT = 0.46,
  D = T_REL + FLIGHT;

/* ---- Ball segments ---- */
const along = (hold, t0, t1, extra) => ({ hold, until: t1, fn: tau => path(t0 + tau), ...extra });
const ball = [
  // catch the dribble and bring it in to the belly; the hand rolls from on top to the outside
  {
    hold: 'R',
    until: T_SET - 0.03,
    fn: tau => path(tau),
    n: [
      { t: 0, v: UP },
      { t: T_SET - 0.03, v: NR },
    ],
  },
  // the left hand joins it there: the set
  along('both', T_SET - 0.03, tq(W), { nR: NR, nL: NL }),
];
let t0 = tq(W);
for (let k = 1; k <= HALF; k++) {
  // one hand carries it round its hip; the other meets it at the next handover
  const carrier = k % 2 ? 'R' : 'L',
    a = tq(k - W),
    b = tq(k + W);
  ball.push(along(carrier, t0, a, { n: carrier === 'R' ? NR : NL }));
  ball.push(along('both', a, b, { nR: NR, nL: NL }));
  t0 = b;
}
const p0 = path(T_LAST),
  v0 = velAt(T_LAST),
  P_REL = [-0.36, 0.86, 0.27]; // where it leaves his hand
ball.push(
  // the right hand takes it on round to his right hip, rolls over the top of it and pushes it down
  {
    hold: 'R',
    until: T_REL,
    d0: v0,
    keys: [
      { t: 0, p: p0 },
      { t: 0.1, p: [-0.27, 1.04, 0.3] },
      { t: 0.15, p: [-0.34, 1.0, 0.28] },
      { t: CARRY, p: P_REL },
    ],
    n: [
      { t: T_LAST, v: NR },
      { t: T_LAST + 0.13, v: norm([-0.2, 1, 0.05]) },
      { t: T_REL, v: UP },
    ],
  },
  { free: true, until: D, bounce: [-0.37, 0.27] },
  { hold: 'R', until: D, keys: [{ t: 0, p: R0 }], n: UP },
);

/* ---- Hands ---- */
const onBall = (t, n) => add(path(t), mul(n, PALM));
const cyl = p => ({ th: Math.atan2(p[0], p[2] - CZ), r: Math.hypot(p[0], p[2] - CZ), y: p[1] });
/* A free hand swinging round its hip from where it let go (A, at ta) to where it meets the ball next (B, at tb): round the
   outside of the hip, a little lower in the middle of the swing, like a pendulum. */
const swing = (A, ta, B, tb) => t => {
  const e = smooth((t - ta) / (tb - ta)),
    a = cyl(A),
    b = cyl(B),
    th = lerp(a.th, b.th, e),
    r = lerp(a.r, b.r, e) + 0.11 * Math.sin(Math.PI * e),
    y = lerp(a.y, b.y, e) - 0.04 * Math.sin(Math.PI * e);
  return [r * Math.sin(th), y, CZ + r * Math.cos(th)];
};
/* Where the elbow points: back and close for a hand beside or in front of him, out to the side for one behind his back. */
const poleFor = (p, side) => {
  const bk = smooth((Math.abs(Math.atan2(p[0], p[2] - CZ)) - 1.65) / 0.85);
  return norm([side * (0.3 + 0.75 * bk), -0.2, -1 + 0.65 * bk]);
};

// the free stretches of each hand: [let go at, from, meet at, to]
const freeR = [],
  freeL = [];
for (let k = 1; k <= HALF; k++) {
  const giver = k % 2 ? 'R' : 'L', // gives at the handover k
    taker = giver === 'R' ? 'L' : 'R';
  const rel = tq(k + W),
    next = k + 1 <= HALF ? tq(k + 1 - W) : null;
  if (next) (giver === 'R' ? freeR : freeL).push([rel, next, giver]);
  void taker;
}
freeL.unshift([tq(W), tq(1 - W), 'L']); // after the set the left hand goes back to meet it behind
const handFn = (h, list) => t => {
  const n = h === 'R' ? NR : NL;
  for (const [ta, tb] of list) if (t >= ta && t <= tb) return swing(onBall(ta, n), ta, onBall(tb, n), tb)(t);
  if (h === 'L') {
    // before the set: from guard onto the ball; after the last handover: back to guard
    if (t < T_SET)
      return add(GUARD.L, mul(add(onBall(T_SET - 0.03, NL), mul(GUARD.L, -1)), smooth((t - 0.06) / 0.15)));
    if (t > T_LAST)
      return add(
        onBall(T_LAST, NL),
        mul(add(GUARD.L, mul(onBall(T_LAST, NL), -1)), smooth((t - T_LAST) / 0.3)),
      );
  }
  if (h === 'R' && t >= T_REL) {
    // after the push: follows through a little, then back up to the top to meet the ball
    const A = add(P_REL, mul(UP, PALM)),
      top = [R0[0], R0[1] + PALM, R0[2]],
      k = (t - T_REL) / (D - T_REL),
      down = 0.06 * Math.sin(Math.PI * Math.min(1, k * 1.6));
    return [
      lerp(A[0], top[0], smooth(k)),
      lerp(A[1], top[1], smooth(k)) - down,
      lerp(A[2], top[2], smooth(k)),
    ];
  }
  return onBall(Math.min(t, T_REL), n);
};
const fnR = handFn('R', freeR),
  fnL = handFn('L', freeL);
const handKeys = (fn, side, rest) => {
  const keys = [];
  for (let t = 0; t <= D + 1e-9; t += 0.03) {
    const p = fn(t);
    keys.push({ t, pole: poleFor(p, side), flex: -0.4, pron: 0.9 });
  }
  return keys.map(k => (rest && rest(k.t) ? { ...k, flex: 0, pron: 0.2 } : k));
};

/* ---- Body: upright with soft knees, shoulders turning a little with the ball, eyes up the floor ---- */
const env = t => smooth(t / 0.35) * (1 - smooth((t - (T_REL - 0.1)) / (D - 0.08 - (T_REL - 0.1))));
const body = [];
for (let t = 0; t <= D + 1e-9; t += 0.04) {
  const tt = Math.min(t, D),
    e = env(tt),
    ph = tt <= T_SET ? 0 : phiAt(Math.min(tt, T_LAST));
  body.push({
    t: tt,
    drop: -0.05 * e,
    lean: -0.12 * e,
    twist: -0.07 * Math.sin(2 * ph) * e,
    side: 0.025 * Math.sin(ph) * e,
    x: 0,
  });
}
body.push({ t: D, drop: 0, lean: 0, twist: 0, side: 0, x: 0 });

export const aroundWaist = {
  id: 'aroundWaist',
  label: 'Around the waist',
  family: 'show',
  start: 'R',
  end: 'R',
  duration: D,
  ball,
  hands: {
    R: { frame: 'body', fn: fnR, keys: handKeys(fnR, -1) },
    L: {
      frame: 'body',
      fn: fnL,
      keys: handKeys(fnL, 1, t => t < 0.06 || t > T_LAST + 0.3),
    },
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body,
};

export default [aroundWaist];
