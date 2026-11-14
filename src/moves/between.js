// Between the legs: the ball bounced through the gap of a split or wide stance, hand to hand. Written for the right hand
// (mirrored for the left). See README.md.
import { GUARD, PALM, STANCE, topOf, combo } from './core.js';

const R0 = topOf('R'),
  L1 = topOf('L');

/* Between the legs, right to left. He steps his left foot forward into a split stance; the right hand winds the ball out
   in front of the right thigh and pushes it down and back through the gap; it bounces between his feet and comes up behind
   the left leg into the left hand, which pumps it forward into a dribble at the left side while the left foot steps back. */
export const betweenLegs = {
  id: 'betweenLegs',
  label: 'Between the legs',
  family: 'handle',
  weight: 3, // between the legs comes up three times as often as the other handles (as often as the showtime moves)
  start: 'R',
  end: 'L',
  duration: 0.95,
  ball: [
    {
      hold: 'R',
      until: 0.15,
      keys: [
        { t: 0, p: R0 },
        { t: 0.07, p: [-0.36, 0.87, 0.27] }, // rides down, out in front of the right thigh
        { t: 0.15, p: [-0.24, 0.66, 0.24] }, // pushed down and in toward the gap
      ],
      n: [
        { t: 0, v: [0, 1, 0] },
        { t: 0.15, v: [-0.45, 0.8, 0.4] }, // the palm on the top-front-outside of the ball, pushing it back and in
      ],
    },
    { free: true, until: 0.42, bounce: [0.02, 0.19] }, // through the gap: one bounce between his feet
    {
      hold: 'L',
      until: 0.53,
      keys: [
        { t: 0, p: [0.38, 0.66, -0.19] }, // caught behind the left hip, low
        { t: 0.11, p: [0.42, 0.66, 0.0] }, // pumped forward and down into a dribble
      ],
      n: [
        { t: 0.42, v: [-0.1, 0.9, -0.3] },
        { t: 0.53, v: [0.05, 0.85, -0.5] },
      ],
    },
    { free: true, until: 0.95, bounce: [0.44, 0.2] },
    { hold: 'L', until: 0.95, keys: [{ t: 0, p: L1 }], n: [0, 1, 0] },
  ],
  hands: {
    R: [
      { t: 0, p: [R0[0], R0[1] + PALM, R0[2]], flex: -0.6, pron: 1.35 },
      { t: 0.2, p: [-0.22, 0.84, 0.2], flex: 0.2, pron: 1.1 }, // follow-through toward the gap
      { t: 0.45, p: [-0.3, 1.05, 0.3], flex: 0, pron: 0.4 },
      { t: 0.85, p: GUARD.R, flex: 0, pron: 0.2 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.18, p: [0.4, 1.0, 0.06], flex: -0.2, pron: 0.6 }, // drops back to wait behind the hip
      { t: 0.36, p: [0.37, 0.85, -0.24], flex: -0.4, pron: 1.1 },
      { t: 0.7, p: [0.36, 1.05, 0.22], flex: -0.4, pron: 1.2 },
      { t: 0.9, p: [L1[0], L1[1] + PALM, L1[2]], flex: -0.6, pron: 1.35 },
    ],
  },
  feet: [
    { t: 0, R: STANCE.R, L: STANCE.L },
    { t: 0.2, L: [0.23, 0.44, 0.08] }, // left foot forward into the split
    { t: 0.5, L: [0.23, 0.44, 0.08] },
    { t: 0.76, L: STANCE.L }, // and back
  ],
  body: [
    { t: 0, x: 0, z: 0, drop: 0, lean: 0, twist: 0, side: 0 },
    { t: 0.14, x: -0.01, z: 0.1, drop: 0.11, lean: 0.1, twist: -0.08, side: -0.02 }, // loads over the ball as he steps
    { t: 0.27, x: 0.01, z: 0.14, drop: 0.17, lean: 0.14, twist: 0, side: 0 }, // lowest as it bounces through
    { t: 0.42, x: 0.03, z: 0.13, drop: 0.15, lean: 0.12, twist: 0.08, side: 0.03 }, // weight follows it left
    { t: 0.6, x: 0.02, z: 0.08, drop: 0.1, lean: 0.07, twist: 0.05, side: 0.02 },
    { t: 0.8, x: 0, z: 0, drop: 0.02, lean: 0.01, twist: 0, side: 0 },
    { t: 0.95, x: 0, z: 0, drop: 0, lean: 0, twist: 0, side: 0 },
  ],
  lookFrame: 'base',
  look: [{ t: 0, p: [0, 1.7, 8] }], // eyes up the floor throughout
};

/* Between the legs and back: through the legs right to left, and straight back left to right, the other foot forward
   (the mirrored move): the "tween" series. */
export const tweenBack = combo(
  { id: 'tweenBack', label: 'Between the legs and back', family: 'handle', weight: 3 },
  [betweenLegs, betweenLegs],
);

/* Figure eight: he steps out into a wide, low stance and weaves the ball in an eight through and around his legs with
   quick low dribbles: in front of the right leg, back through the legs to the left hand behind the left leg, round the
   outside of the left leg to the front, back through the legs to the right hand behind the right leg, round the outside of
   the right leg and up into the dribble as his feet come back in. Chest up, eyes up, butt down. */
const WIDE = { R: [-0.38, 0.03, -0.12], L: [0.38, 0.03, 0.12] }; // toes turned out a little
const UP = [0, 1, 0],
  BACK = [0, 0.8, 0.6], // the palm on the top-front of the ball, pushing it back
  FWD = [0, 0.92, -0.4]; // the palm on the top-back of the ball, pushing it forward
const on = (p, n) => [p[0] + n[0] * PALM, p[1] + n[1] * PALM, p[2] + n[2] * PALM]; // the wrist on a ball at p
// where the ball is caught and let go at each beat (right side; the left side is the same with x flipped)
const FRONT = [-0.34, 0.66, 0.34], // caught in front of the leg
  THRU = [-0.07, 0.56, 0.24], // let go into the gap, pushed back
  BEHIND = [-0.32, 0.62, -0.22], // caught just behind the calf
  ROUND = [-0.46, 0.55, 0.02]; // let go round the outside of the leg, pushed forward
const flip = p => [-p[0], p[1], p[2]];
export const figure8 = {
  id: 'figure8',
  label: 'Figure eight',
  family: 'handle',
  weight: 3, // between the legs comes up three times as often as the other handles (as often as the showtime moves)
  start: 'R',
  end: 'R',
  duration: 2.0,
  ball: [
    // one low dribble in front of the right foot as he steps out wide
    {
      hold: 'R',
      until: 0.1,
      keys: [
        { t: 0, p: R0 },
        { t: 0.1, p: [-0.38, 0.78, 0.32] },
      ],
      n: UP,
    },
    { free: true, until: 0.4, bounce: [-0.4, 0.36] },
    // in front of the right leg: pushed back through the legs
    {
      hold: 'R',
      until: 0.48,
      keys: [
        { t: 0, p: FRONT },
        { t: 0.08, p: THRU },
      ],
      n: BACK,
    },
    { free: true, until: 0.78, bounce: [0.0, -0.18] }, // under him, behind his heels: it comes up behind the legs
    // behind the left leg: the left hand takes it and pushes it forward round the outside of the left leg
    {
      hold: 'L',
      until: 0.86,
      keys: [
        { t: 0, p: flip(BEHIND) },
        { t: 0.08, p: flip(ROUND) },
      ],
      n: FWD,
    },
    { free: true, until: 1.12, bounce: [0.5, 0.22] },
    // in front of the left leg: back through the legs
    {
      hold: 'L',
      until: 1.2,
      keys: [
        { t: 0, p: flip(FRONT) },
        { t: 0.08, p: flip(THRU) },
      ],
      n: BACK,
    },
    { free: true, until: 1.5, bounce: [0.0, -0.18] },
    // behind the right leg: forward round the outside of the right leg, and up into the dribble
    {
      hold: 'R',
      until: 1.58,
      keys: [
        { t: 0, p: BEHIND },
        { t: 0.08, p: ROUND },
      ],
      n: FWD,
    },
    { free: true, until: 2.0, bounce: [-0.48, 0.24] },
    { hold: 'R', until: 2.0, keys: [{ t: 0, p: R0 }], n: UP },
  ],
  hands: {
    // each hand comes away from the ball where it let go of it, and gets to its next catch a beat early
    R: [
      { t: 0, p: on(R0, UP), flex: -0.6, pron: 1.35 },
      { t: 0.1, p: on([-0.38, 0.78, 0.32], UP), flex: -0.3, pron: 1.35 },
      { t: 0.34, p: on(FRONT, BACK), flex: -0.3, pron: 1.1 },
      { t: 0.48, p: on(THRU, BACK), flex: 0.2, pron: 1.1 },
      { t: 0.75, p: [-0.24, 0.92, 0.22], flex: 0, pron: 0.5 },
      { t: 1.2, p: [-0.32, 0.86, -0.12], flex: -0.2, pron: 0.9 },
      { t: 1.46, p: on(BEHIND, FWD), flex: -0.3, pron: 1.2 }, // waiting behind the right leg
      { t: 1.58, p: on(ROUND, FWD), flex: 0.2, pron: 1.2 },
      { t: 1.78, p: [-0.44, 1.0, 0.14], flex: -0.4, pron: 1.2 },
      { t: 1.96, p: on(R0, UP), flex: -0.6, pron: 1.35 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.4, p: [0.32, 0.9, -0.06], flex: -0.2, pron: 0.9 },
      { t: 0.74, p: on(flip(BEHIND), FWD), flex: -0.3, pron: 1.2 }, // waiting behind the left leg
      { t: 0.86, p: on(flip(ROUND), FWD), flex: 0.2, pron: 1.2 },
      { t: 1.06, p: on(flip(FRONT), BACK), flex: -0.3, pron: 1.1 },
      { t: 1.2, p: on(flip(THRU), BACK), flex: 0.2, pron: 1.1 },
      { t: 1.5, p: [0.24, 0.98, 0.24], flex: 0, pron: 0.5 },
      { t: 1.95, p: GUARD.L, flex: 0, pron: 0.2 },
    ],
  },
  feet: [
    { t: 0, R: STANCE.R, L: STANCE.L },
    { t: 0.05, L: STANCE.L },
    { t: 0.22, L: WIDE.L }, // out into the wide stance: left, then right
    { t: 0.14, R: STANCE.R },
    { t: 0.32, R: WIDE.R },
    { t: 1.62, R: WIDE.R },
    { t: 1.8, R: STANCE.R }, // and back in
    { t: 1.72, L: WIDE.L },
    { t: 1.92, L: STANCE.L },
    { t: 2.0, R: STANCE.R, L: STANCE.L },
  ],
  body: [
    { t: 0, drop: 0, lean: 0, side: 0, twist: 0, x: 0 },
    { t: 0.35, drop: 0.2, lean: 0.16, side: 0, twist: 0 },
    { t: 0.62, drop: 0.22, lean: 0.18, side: 0.04, twist: 0.06, x: 0.02 }, // with the ball as it goes left
    { t: 0.95, drop: 0.22, lean: 0.18, side: 0.05, twist: 0.08, x: 0.03 },
    { t: 1.3, drop: 0.22, lean: 0.18, side: -0.04, twist: -0.06, x: -0.02 }, // and right
    { t: 1.6, drop: 0.2, lean: 0.16, side: -0.05, twist: -0.08, x: -0.03 },
    { t: 1.88, drop: 0.04, lean: 0.04, side: 0, twist: 0, x: 0 },
    { t: 2.0, drop: 0, lean: 0, side: 0, twist: 0, x: 0 },
  ],
  lookFrame: 'base',
  look: [{ t: 0, p: [0, 1.7, 8] }],
};

export default [betweenLegs, tweenBack, figure8];
