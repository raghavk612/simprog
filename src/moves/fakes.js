// Fakes: moves that sell one thing and do another, the ball staying in the right hand. Written for the right hand
// (the Routine mirrors them for the left). The ball and the dribbling hand are written in the base frame (where they are
// over the floor), the off hand in the body frame (it travels with him).
import { GUARD, STANCE, handOn, topOf } from './core.js';

const R0 = topOf('R'), // the ball at the top of the right-hand dribble
  TOP = [0, 1, 0]; // palm on top of the ball
// No `pole` keys: the default elbow (back, close to the body) is right for these moves.

/* In-and-out: the right hand rides the ball in toward the middle as if crossing over (palm on the outside of the ball),
   shoulders and head dipping left to sell it; the ball bounces in front of him toward the middle, the hand rolls over the
   top to the inside of the ball, catches it on the rise and pushes it back out to the right. */
export const inAndOut = {
  id: 'inAndOut',
  label: 'In-and-out',
  family: 'handle',
  start: 'R',
  end: 'R',
  duration: 0.86,
  ball: [
    {
      // the hand comes over the outside of the ball and drives it down and in
      hold: 'R',
      until: 0.1,
      frame: 'base',
      keys: [
        { t: 0, p: R0 },
        { t: 0.05, p: [-0.37, 0.95, 0.27] },
        { t: 0.1, p: [-0.3, 0.82, 0.32] },
      ],
      n: [
        { t: 0, v: TOP },
        { t: 0.1, v: [-0.5, 0.85, -0.05] },
      ],
      pron: 0.95,
    },
    // in: one low bounce in front of him, heading for the middle
    { free: true, until: 0.35, bounce: [-0.215, 0.37] },
    {
      // the hand, now on the inside of the ball, meets it on the rise and pushes it back down and out
      hold: 'R',
      until: 0.46,
      frame: 'base',
      keys: [
        { t: 0, p: [-0.16, 0.78, 0.38] },
        { t: 0.04, p: [-0.17, 0.81, 0.375] },
        { t: 0.11, p: [-0.25, 0.72, 0.33] },
      ],
      n: [
        { t: 0.35, v: [0.56, 0.82, 0.1] },
        { t: 0.46, v: [0.6, 0.78, 0.05] },
      ],
      pron: 1.6,
      flex: -0.3,
    },
    // out: the bounce carries it back out to the right hip, up into the hand
    { free: true, until: 0.86, bounce: [-0.27, 0.31] },
    { hold: 'R', until: 0.86, frame: 'base', keys: [{ t: 0, p: R0 }], n: TOP },
  ],
  hands: {
    R: {
      frame: 'base',
      keys: [
        { t: 0, p: handOn(R0), flex: -0.6, pron: 1.35 },
        { t: 0.1, p: handOn([-0.3, 0.82, 0.32], [-0.5, 0.85, -0.05]), flex: 0.1, pron: 0.95 },
        { t: 0.16, p: [-0.36, 0.98, 0.36], flex: 0.15, pron: 1.1 }, // follows through, then rolls over the top
        { t: 0.24, p: [-0.24, 1.0, 0.4], flex: -0.2, pron: 1.4 },
        { t: 0.31, p: [-0.06, 0.96, 0.41], flex: -0.3, pron: 1.6 }, // waiting on the inside
        { t: 0.52, p: [-0.3, 0.95, 0.32], flex: 0.2, pron: 1.3 }, // follow-through out
        { t: 0.62, p: [-0.37, 1.0, 0.28], flex: -0.3, pron: 1.35 },
        { t: 0.76, p: [-0.36, 1.15, 0.25], flex: -0.5, pron: 1.35 },
        { t: 0.86, p: handOn(R0), flex: -0.6, pron: 1.35 },
      ],
    },
    // the off hand drops a little and in, as if to take the crossover, then back to guard
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.28, p: [0.24, 1.12, 0.36], flex: -0.1, pron: 0.4 },
      { t: 0.55, p: GUARD.L, flex: 0, pron: 0.2 },
    ],
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body: [
    { t: 0, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
    { t: 0.1, x: 0.01, drop: 0.03, side: 0.03, twist: 0.06, lean: 0.04 },
    { t: 0.28, x: 0.05, drop: 0.1, side: 0.1, twist: 0.14, lean: 0.08 }, // the sell: weight, shoulders and head go left
    { t: 0.4, x: 0.03, drop: 0.1, side: 0.02, twist: 0.02, lean: 0.08 },
    { t: 0.52, x: -0.04, drop: 0.08, side: -0.06, twist: -0.1, lean: 0.1 }, // and back out with the ball
    { t: 0.7, x: -0.02, drop: 0.03, side: -0.02, twist: -0.04, lean: 0.04 },
    { t: 0.86, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
  ],
};

/* Stutter step: quick choppy steps in place (small fast alternating foot taps), a little more upright, two quick dribbles;
   then the "go": a sudden lower, harder dribble pushed out in front and a lean forward as if to explode past his man, and
   he settles back. */
const tap = 0.015, // how far a tapping foot moves (it lifts and comes down almost where it was)
  tapLift = 0.045;
const stutterFeet = () => {
  const keys = [{ t: 0, R: STANCE.R, L: STANCE.L }];
  // eight taps, left foot first, one every 0.08 s, each 0.06 s off the floor; each foot four times (forward, back...)
  for (let i = 0; i < 8; i++) {
    const t = 0.04 + i * 0.08,
      h = i % 2 ? 'R' : 'L',
      out = Math.floor(i / 2) % 2 === 0,
      [x, z] = STANCE[h];
    keys.push({ t, [h]: [x, out ? z : z + tap] });
    keys.push({ t: t + 0.06, [h]: [x, out ? z + tap : z], lift: { [h]: tapLift } });
  }
  return keys;
};
export const stutterHesi = {
  id: 'stutterHesi',
  label: 'Stutter step',
  family: 'handle',
  start: 'R',
  end: 'R',
  duration: 1.36,
  ball: [
    // two quick dribbles while the feet chop
    {
      hold: 'R',
      until: 0.06,
      frame: 'base',
      keys: [
        { t: 0, p: R0 },
        { t: 0.06, p: [-0.36, 0.88, 0.25] },
      ],
      n: TOP,
    },
    { free: true, until: 0.33, bounce: [-0.36, 0.25] },
    {
      hold: 'R',
      until: 0.39,
      frame: 'base',
      keys: [
        { t: 0, p: [-0.36, 0.9, 0.25] },
        { t: 0.03, p: [-0.36, 0.92, 0.25] },
        { t: 0.06, p: [-0.36, 0.87, 0.25] },
      ],
      n: TOP,
    },
    { free: true, until: 0.66, bounce: [-0.36, 0.25] },
    {
      // go: the hand gets behind the ball and drives it low and out in front
      hold: 'R',
      until: 0.72,
      frame: 'base',
      keys: [
        { t: 0, p: [-0.36, 0.92, 0.25] },
        { t: 0.03, p: [-0.36, 0.93, 0.27] },
        { t: 0.06, p: [-0.37, 0.8, 0.31] },
      ],
      n: [
        { t: 0.66, v: TOP },
        { t: 0.72, v: [0, 0.85, -0.5] },
      ],
    },
    { free: true, until: 0.89, bounce: [-0.385, 0.4] },
    {
      // he gathers it back: the hand comes round the front of the ball and pulls it in
      hold: 'R',
      until: 0.97,
      frame: 'base',
      keys: [
        { t: 0, p: [-0.39, 0.74, 0.43] },
        { t: 0.04, p: [-0.385, 0.77, 0.4] },
        { t: 0.08, p: [-0.375, 0.74, 0.34] },
      ],
      n: [
        { t: 0.89, v: [0, 0.9, 0.4] },
        { t: 0.97, v: [0, 0.95, 0.3] },
      ],
    },
    { free: true, until: 1.36, bounce: [-0.37, 0.29] },
    { hold: 'R', until: 1.36, frame: 'base', keys: [{ t: 0, p: R0 }], n: TOP },
  ],
  hands: {
    R: {
      frame: 'base',
      keys: [
        { t: 0, p: handOn(R0), flex: -0.6, pron: 1.35 },
        { t: 0.1, p: [-0.36, 1.03, 0.25], flex: -0.45, pron: 1.35 },
        { t: 0.27, p: [-0.36, 1.08, 0.25], flex: -0.6, pron: 1.35 },
        { t: 0.43, p: [-0.36, 1.02, 0.25], flex: -0.45, pron: 1.35 },
        { t: 0.6, p: [-0.36, 1.08, 0.24], flex: -0.6, pron: 1.35 },
        { t: 0.76, p: [-0.38, 0.92, 0.36], flex: 0.1, pron: 1.35 }, // the hard push, followed through
        { t: 0.84, p: [-0.39, 0.95, 0.42], flex: -0.3, pron: 1.35 },
        { t: 1.02, p: [-0.37, 0.96, 0.32], flex: 0.0, pron: 1.35 },
        { t: 1.2, p: [-0.36, 1.12, 0.25], flex: -0.5, pron: 1.35 },
        { t: 1.36, p: handOn(R0), flex: -0.6, pron: 1.35 },
      ],
    },
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.84, p: [0.26, 1.1, 0.4], flex: 0, pron: 0.3 }, // out in front as he lunges
      { t: 1.2, p: GUARD.L, flex: 0, pron: 0.2 },
    ],
  },
  feet: stutterFeet(),
  body: [
    { t: 0, drop: 0, lean: 0, z: 0, side: 0, twist: 0 },
    { t: 0.12, drop: -0.04, lean: -0.04 }, // up a little out of the crouch while the feet chop
    { t: 0.6, drop: -0.04, lean: -0.04, z: 0 },
    { t: 0.8, drop: 0.14, lean: 0.26, z: 0.11, side: -0.04, twist: -0.05 }, // go: down and forward
    { t: 0.92, drop: 0.15, lean: 0.28, z: 0.12, side: -0.04, twist: -0.05 },
    { t: 1.36, drop: 0, lean: 0, z: 0, side: 0, twist: 0 },
  ],
};

/* Rocker step: he jabs the right foot forward with a low hard dribble out in front and leans in, selling the drive; rocks
   back up to the stance, tall, as if he might pull up; then jabs forward again and settles. */
const JAB = [-0.2, 0.36, -0.1], // the right foot's jab spot (a foot forward, toes a little out)
  jabBall = [-0.4, 0.74, 0.5], // the low dribble out in front, beside the jab foot
  jabPush = [-0.38, 0.86, 0.31], // where the hand lets it go, down and forward
  pullBack = [
    { t: 0, p: jabBall },
    { t: 0.035, p: [-0.4, 0.77, 0.46] },
    { t: 0.07, p: [-0.4, 0.75, 0.38] },
  ],
  pushN = [0, 0.9, -0.4], // palm over the back of the ball, pushing it forward
  pullN = [0, 0.95, 0.3]; // palm over the front of the ball, pulling it back
const lunge = { z: 0.17, x: -0.02, drop: 0.15, lean: 0.24, side: -0.03, twist: -0.06 };
export const rocker = {
  id: 'rocker',
  label: 'Rocker step',
  family: 'handle',
  start: 'R',
  end: 'R',
  duration: 1.44,
  ball: [
    {
      hold: 'R',
      until: 0.07,
      frame: 'base',
      keys: [
        { t: 0, p: R0 },
        { t: 0.07, p: jabPush },
      ],
      n: [
        { t: 0, v: TOP },
        { t: 0.07, v: pushN },
      ],
    },
    { free: true, until: 0.28, bounce: [-0.4, 0.44] }, // low and hard, out in front
    { hold: 'R', until: 0.35, frame: 'base', keys: pullBack, n: pullN },
    { free: true, until: 0.7, bounce: [-0.395, 0.31] }, // back in the pocket as he rocks back
    {
      hold: 'R',
      until: 0.76,
      frame: 'base',
      keys: [
        { t: 0, p: [-0.37, 0.94, 0.26] },
        { t: 0.06, p: jabPush },
      ],
      n: [
        { t: 0.7, v: TOP },
        { t: 0.76, v: pushN },
      ],
    },
    { free: true, until: 0.97, bounce: [-0.4, 0.44] }, // the second jab: low and hard again
    { hold: 'R', until: 1.04, frame: 'base', keys: pullBack, n: pullN },
    { free: true, until: 1.44, bounce: [-0.395, 0.31] },
    { hold: 'R', until: 1.44, frame: 'base', keys: [{ t: 0, p: R0 }], n: TOP },
  ],
  hands: {
    R: {
      frame: 'base',
      keys: [
        { t: 0, p: handOn(R0), flex: -0.6, pron: 1.35 },
        { t: 0.12, p: [-0.39, 1.0, 0.36], flex: 0.1, pron: 1.35 }, // after the push: low, reaching forward
        { t: 0.23, p: [-0.4, 0.97, 0.5], flex: -0.4, pron: 1.35 },
        { t: 0.42, p: [-0.39, 0.98, 0.36], flex: 0, pron: 1.35 },
        { t: 0.62, p: [-0.37, 1.12, 0.26], flex: -0.55, pron: 1.35 },
        { t: 0.81, p: [-0.39, 1.0, 0.36], flex: 0.1, pron: 1.35 },
        { t: 0.92, p: [-0.4, 0.97, 0.5], flex: -0.4, pron: 1.35 },
        { t: 1.11, p: [-0.39, 0.98, 0.36], flex: 0, pron: 1.35 },
        { t: 1.32, p: [-0.36, 1.15, 0.25], flex: -0.5, pron: 1.35 },
        { t: 1.44, p: handOn(R0), flex: -0.6, pron: 1.35 },
      ],
    },
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.25, p: [0.26, 1.12, 0.42], flex: 0, pron: 0.3 },
      { t: 0.55, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.94, p: [0.26, 1.12, 0.42], flex: 0, pron: 0.3 },
      { t: 1.3, p: GUARD.L, flex: 0, pron: 0.2 },
    ],
  },
  feet: [
    { t: 0, R: STANCE.R, L: STANCE.L },
    { t: 0.03, R: STANCE.R },
    { t: 0.22, R: JAB, lift: { R: 0.07 } }, // jab
    { t: 0.36, R: JAB },
    { t: 0.56, R: STANCE.R, lift: { R: 0.06 } }, // rock back
    { t: 0.74, R: STANCE.R },
    { t: 0.93, R: JAB, lift: { R: 0.07 } }, // jab again
    { t: 1.15, R: JAB },
    { t: 1.35, R: STANCE.R, lift: { R: 0.06 } }, // settle (after the last bounce has gone by)
  ],
  body: [
    { t: 0, z: 0, x: 0, drop: 0, lean: 0, side: 0, twist: 0 },
    { t: 0.24, ...lunge }, // leaning in on the jab
    { t: 0.34, ...lunge },
    { t: 0.6, z: -0.02, x: 0, drop: -0.04, lean: -0.04, side: 0, twist: 0 }, // rocked back, tall
    { t: 0.74, z: -0.01, x: 0, drop: -0.02, lean: 0, side: 0, twist: 0 },
    { t: 0.95, ...lunge },
    { t: 1.1, ...lunge },
    { t: 1.44, z: 0, x: 0, drop: 0, lean: 0, side: 0, twist: 0 },
  ],
};

export default [inAndOut, stutterHesi, rocker];
