// Finger spin (showtime): he gathers the dribble into both hands, flips the ball up with a twist and catches it spinning on
// the tip of his right index finger, arm raised; his left hand slaps its side twice to keep it going while he admires it;
// then he lets it roll off the finger, takes the bounce on top and pushes it back into his right-hand dribble.
// Written for the right hand (mirrored for the left). Everything is in the base frame (his body never moves off the spot).
import {
  BALL_R,
  GUARD,
  PALM,
  STANCE,
  freeFlight,
  prepare,
  sample,
  topOf,
  add,
  sub,
  mul,
  norm,
} from './core.js';

const R0 = topOf('R');
/* Wrist to ball centre with the ball balanced on the fingertips: the hand is about 0.21 long. */
const TIP = BALL_R + 0.205;

/* The beats (seconds from the start). */
const B = {
  both: 0.16, // the left hand arrives: both hands on the ball
  set: 0.4, // the ball held still in front of his face
  load: 0.45, // a small dip before the flip
  release: 0.53, // the flip: the ball leaves both hands spinning
  perch: 0.85, // it lands on the fingertip
  slap1: 1.16,
  slap2: 1.62,
  drop: 2.2, // the finger slips out from under it
  catch: 3.1, // the right hand meets the bounce on top
  push: 3.31, // and pushes it back down
  end: 3.78, // the ball arrives at the top of the dribble
};
const SLAP = 0.1; // how long the left palm brushes the ball

/* Where the ball is at the main beats. */
const GATHER = [-0.3, 1.19, 0.29],
  SET = [-0.15, 1.64, 0.36],
  LOAD = [-0.155, 1.615, 0.36],
  REL = [-0.19, 1.72, 0.35],
  PERCH = [-0.28, 1.97, 0.3], // up over his right shoulder: the forearm can stand straight up under it, finger on the ball
  CATCH = [-0.35, 1.38, 0.38],
  PUSHED = [-0.36, 0.93, 0.27];

/* A bounce on the floor in line with the ball's flight (a real bounce keeps its sideways speed): the hit time depends only
   on the heights and the flight time. */
function bounceOn(p0, p1, T) {
  const k = freeFlight(p0, p1, T, [0, 0]).hit / T;
  return [p0[0] + (p1[0] - p0[0]) * k, p0[2] + (p1[2] - p0[2]) * k];
}

/* The ball balanced on the finger (relative to the perch): it sinks a little as it lands, is raised to show it off and
   wobbles in small circles as the finger keeps it balanced. */
const FINGER = [
  { t: 0, p: PERCH },
  { t: 0.1, p: [-0.282, 1.955, 0.302] },
  { t: 0.36, p: [-0.29, 2.015, 0.31] },
  { t: 0.62, p: [-0.296, 2.01, 0.319] },
  { t: 0.88, p: [-0.286, 2.016, 0.308] },
  { t: 1.12, p: [-0.294, 2.011, 0.315] },
  { t: B.drop - B.perch, p: [-0.29, 2.006, 0.31] },
];
const DROP_FROM = FINGER[FINGER.length - 1].p;

const ball = [
  // the dribble comes up into the right hand, which rolls round to the outside of the ball and lifts it
  {
    hold: 'R',
    until: B.both,
    frame: 'base',
    keys: [
      { t: 0, p: R0 },
      { t: B.both, p: GATHER },
    ],
    d0: [0, 0.6, 0],
    d1: [0.75, 2.2, 0.35],
    n: [
      { t: 0, v: [0, 1, 0] },
      { t: B.both, v: [-0.75, 0.5, -0.2] },
    ],
  },
  // both hands: up to the set in front of his face, a small dip, and the flip (right hand back, left hand forward)
  {
    hold: 'both',
    until: B.release,
    frame: 'base',
    keys: [
      { t: 0, p: GATHER },
      { t: B.set - B.both, p: SET },
      { t: B.load - B.both, p: LOAD },
      { t: B.release - B.both, p: REL },
    ],
    d0: [0.75, 2.2, 0.35],
    nR: [
      { t: B.both, v: [-0.75, 0.5, -0.2] },
      { t: B.set, v: [-0.95, -0.15, -0.1] },
      { t: B.release, v: [-0.85, -0.45, 0.2] },
    ],
    nL: [
      { t: B.both, v: [0.95, -0.1, -0.2] },
      { t: B.set, v: [0.95, -0.15, -0.1] },
      { t: B.release, v: [0.9, -0.2, -0.35] },
    ],
  },
  // the toss up to the finger
  { free: true, until: B.perch },
  // on the fingertip: no palm on it (the wrist is TIP below it), the right hand follows it (see hands)
  {
    hold: 'other',
    until: B.drop,
    frame: 'base',
    keys: FINGER.map(k => ({ t: k.t, p: k.p })),
  },
  // it rolls off the finger, falls, bounces and comes up into the right hand
  { free: true, until: B.catch, bounce: bounceOn(DROP_FROM, CATCH, B.catch - B.drop) },
  // palm on top at the top of the bounce: ride it up, push it down
  {
    hold: 'R',
    until: B.push,
    frame: 'base',
    keys: [
      { t: 0, p: CATCH },
      { t: 0.07, p: [-0.353, 1.4, 0.36] },
      { t: B.push - B.catch, p: PUSHED },
    ],
    n: [0, 1, 0],
    flex: -0.65,
  },
  // one dribble back to the top
  { free: true, until: B.end, bounce: bounceOn(PUSHED, R0, B.end - B.push) },
  { hold: 'R', until: B.end, frame: 'base', keys: [{ t: 0, p: R0 }], n: [0, 1, 0] },
];

/* His body: up out of the crouch and a little upright to show the ball, shoulders turned a touch toward it; back down into
   the dribbling crouch to take the bounce. */
const body = [
  { t: 0, drop: 0, lean: 0, twist: 0, side: 0 },
  { t: B.set, drop: -0.05, lean: -0.08, twist: -0.05, side: 0.01 },
  { t: B.perch, drop: -0.08, lean: -0.12, twist: -0.1, side: 0.04 },
  { t: 1.5, drop: -0.08, lean: -0.12, twist: -0.06, side: 0.04 },
  { t: B.drop, drop: -0.07, lean: -0.1, twist: -0.08, side: 0.03 },
  { t: B.catch, drop: 0.04, lean: 0.05, twist: -0.02, side: -0.01 },
  { t: B.end, drop: 0, lean: 0, twist: 0, side: 0 },
];

/* The ball and the hands that hold it, solved without the free hands: the free hands' keys are laid along it below. */
const P0 = prepare({ id: 'fingerSpin', duration: B.end, start: 'R', end: 'R', ball, body });
const at = t => sample(P0, t);
const span = (a, b, dt = 0.03) => {
  const n = Math.max(1, Math.round((b - a) / dt));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
};
/* Keys that keep a hand on the ball while it holds it (so the free path and the hold agree at every blend). */
const onBall = (h, a, b) => span(a, b).map(t => ({ t, p: at(t).hands[h].p }));
/* The wrist under the ball on the fingertip. */
const underBall = (a, b) => span(a, b, 0.04).map(t => ({ t, p: add(at(t).ball, [0, -TIP, 0]) }));

/* A slap of the left palm along the left side of the ball, back to front (the way it spins), from t for SLAP seconds:
   the wrist is PALM off the ball the whole time it brushes it. */
const SPIN = -17; // rad/s about +y: seen from above the ball turns clockwise (its left side moves forward)
function slap(t) {
  const n0 = [0.8, -0.22, -0.55],
    n1 = [0.85, -0.22, 0.45],
    keys = [];
  for (let i = 0; i <= 4; i++) {
    const u = i / 4,
      n = norm(add(mul(n0, 1 - u), mul(n1, u)));
    keys.push({ t: t + SLAP * u, p: add(at(t + SLAP * u).ball, mul(n, PALM)) });
  }
  const first = keys[0].p,
    last = keys[keys.length - 1].p;
  return [
    { t: t - 0.13, p: READY_L },
    { t: t - 0.06, p: add(first, [0.04, -0.06, -0.08]) }, // coming up from behind the ball
    ...keys,
    { t: t + SLAP + 0.07, p: add(last, [0.07, -0.07, 0.01]) }, // through and away to his left
    { t: t + SLAP + 0.2, p: READY_L },
  ];
}
/* Where the left hand waits between slaps: up by his chin, palm toward the ball. */
const READY_L = [0.06, 1.62, 0.3];

const fingerSpin = {
  id: 'fingerSpin',
  label: 'Finger spin',
  family: 'show',
  start: 'R',
  end: 'R',
  duration: B.end,
  ball,
  hands: {
    R: {
      frame: 'base',
      keys: [
        ...onBall('R', 0, B.release),
        // after the flip the hand turns in under the ball, index finger up, and meets it as it comes down
        { t: B.release + 0.1, p: [-0.32, 1.56, 0.32] },
        { t: B.release + 0.22, p: [-0.29, 1.62, 0.3], flex: 0, pron: 0.2 },
        ...underBall(B.perch, B.drop),
        // the finger slips back out from under it; the hand comes down over the ball for the bounce
        { t: B.drop + 0.12, p: [-0.3, 1.55, 0.2] },
        { t: B.drop + 0.45, p: [-0.38, 1.5, 0.22], flex: -0.3, pron: 0.9 },
        ...onBall('R', B.catch, B.end),
      ].concat([
        { t: 0, flex: -0.6, pron: 1.35, pole: [-0.3, -0.2, -1] },
        { t: B.release, flex: 0, pron: 0, pole: [-0.5, -0.4, -0.6] },
        { t: B.perch, flex: 0, pron: 0.2, pole: [-0.1, -1, 0.1] }, // elbow straight under the hand: the forearm stands up
        { t: B.drop, flex: 0, pron: 0.2, pole: [-0.1, -1, 0.1] },
        { t: B.catch, flex: -0.65, pron: 1.35, pole: [-0.3, -0.2, -1] },
      ]),
    },
    L: {
      frame: 'base',
      keys: [
        { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
        { t: 0.08, p: [0.06, 1.18, 0.34] },
        ...onBall('L', B.both, B.release),
        // the flip pushes the left hand forward and off; then it waits by his chin
        { t: B.release + 0.1, p: [0.0, 1.66, 0.46] },
        { t: B.release + 0.3, p: READY_L, flex: 0, pron: 0 },
        ...slap(B.slap1),
        ...slap(B.slap2),
        { t: B.drop - 0.2, p: [0.16, 1.4, 0.36] },
        { t: B.drop + 0.3, p: GUARD.L, flex: 0, pron: 0.2 },
        { t: B.end, p: GUARD.L },
      ].concat([
        { t: B.both, flex: 0, pron: 0, pole: [0.6, -0.4, -0.6] },
        { t: B.slap1, flex: 0, pron: 0, pole: [0.7, -1, 0.1] },
        { t: B.drop + 0.3, flex: 0, pron: 0.2, pole: [0.3, -0.2, -1] },
      ]),
    },
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body,
  // eyes on the ball as it goes up and while he admires it, then back up the floor to take the bounce
  look: [
    { t: 0, p: [0, 1.75, 6] },
    { t: B.set, p: [-0.15, 1.75, 2.5] },
    { t: B.perch, p: PERCH },
    { t: 1.8, p: [-0.29, 2.01, 0.31] },
    { t: B.drop, p: [0, 1.8, 6] },
    { t: B.end, p: [0, 1.75, 6] },
  ],
  // it spins from the flip until he catches it again; each slap speeds it up a little
  spin: [
    { from: B.release, to: B.slap1, w: [0, SPIN, 0] },
    { from: B.slap1, to: B.slap2, w: [0, SPIN * 1.12, 0] },
    { from: B.slap2, to: B.catch, w: [0, SPIN * 1.2, 0] },
  ],
};

export default [fingerSpin];
