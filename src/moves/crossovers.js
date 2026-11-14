// Crossovers: the ball snapped across the body, hand to hand, in front. Written for the right hand (mirrored for the left).
import { GUARD, PALM, STANCE, topOf } from './core.js';

const R0 = topOf('R'),
  L1 = topOf('L');
/* The wrist on top of a ball at p (palm down). */
const onTop = p => [p[0], p[1] + PALM, p[2]];

/* Single crossover: the right hand rides the ball down and drives it low across the body; it bounces once in front of him,
   in the middle, and comes up into the left hand near the top of its bounce. His weight goes with it. */
export const crossover = {
  id: 'crossover',
  label: 'Crossover',
  family: 'handle',
  start: 'R',
  end: 'L',
  duration: 0.55,
  ball: [
    {
      hold: 'R',
      until: 0.15,
      keys: [
        { t: 0, p: R0 },
        { t: 0.07, p: [-0.4, 0.9, 0.25] }, // sell: the ball rides down and out to the right
        { t: 0.15, p: [-0.24, 0.7, 0.3] }, // then driven down and across, low
      ],
      n: [
        { t: 0, v: [0, 1, 0] },
        { t: 0.12, v: [-0.55, 0.8, -0.05] }, // the palm comes over the outside of the ball to push it in
      ],
    },
    { free: true, until: 0.55, bounce: [0.0, 0.34] },
    { hold: 'L', until: 0.55, keys: [{ t: 0, p: L1 }], n: [0, 1, 0] },
  ],
  hands: {
    R: [
      { t: 0, p: onTop(R0), flex: -0.6, pron: 1.35 },
      { t: 0.15, p: [-0.35, 0.86, 0.29], flex: 0.1, pron: 1.35 },
      { t: 0.24, p: [-0.22, 0.88, 0.36], flex: 0.3, pron: 1.1 }, // follows through toward the middle, fingers down
      { t: 0.36, p: [-0.25, 1.06, 0.36], flex: 0.1, pron: 0.5 }, // back up to protect
      { t: 0.5, p: GUARD.R, flex: 0, pron: 0.2 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.2, p: [0.33, 1.14, 0.32], flex: -0.2, pron: 0.7 },
      { t: 0.36, p: [0.42, 1.12, 0.28], flex: -0.35, pron: 1.0 }, // out to the side to meet it
      { t: 0.5, p: [L1[0] + 0.01, L1[1] + PALM + 0.01, L1[2]], flex: -0.6, pron: 1.35 }, // on top as it arrives
    ],
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body: [
    { t: 0, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
    { t: 0.07, x: -0.03, drop: 0.05, side: -0.04, twist: -0.1, lean: 0.06 }, // sells right
    { t: 0.15, x: -0.01, drop: 0.09, side: -0.02, twist: -0.04, lean: 0.1 }, // low as it goes
    { t: 0.32, x: 0.04, drop: 0.09, side: 0.06, twist: 0.12, lean: 0.09 }, // weight goes left with it
    { t: 0.45, x: 0.03, drop: 0.05, side: 0.03, twist: 0.06, lean: 0.05 },
    { t: 0.55, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
  ],
};

/* Double crossover: a low crossover to the left hand and, the moment it lands, straight back to the right with a second,
   quicker one. Bang-bang: the left hand catches it on the outside and pushes it right back down; two bounces a third of a
   second apart; the shoulders sway with the ball each time. */
export const doubleCross = {
  id: 'doubleCross',
  label: 'Double crossover',
  family: 'handle',
  start: 'R',
  end: 'R',
  duration: 0.92,
  ball: [
    {
      hold: 'R',
      until: 0.14,
      keys: [
        { t: 0, p: R0 },
        { t: 0.06, p: [-0.4, 0.91, 0.25] }, // a short sell to the right
        { t: 0.14, p: [-0.24, 0.7, 0.3] }, // driven low across
      ],
      n: [
        { t: 0, v: [0, 1, 0] },
        { t: 0.11, v: [-0.55, 0.8, -0.05] },
      ],
    },
    { free: true, until: 0.38, bounce: [0.0, 0.33] },
    {
      hold: 'L',
      until: 0.48,
      keys: [
        { t: 0, p: [0.3, 0.8, 0.29] }, // caught on the way up, on its outside half
        { t: 0.04, p: [0.33, 0.82, 0.28] }, // gives with it for an instant
        { t: 0.1, p: [0.23, 0.69, 0.31] }, // and snaps it straight back down and across
      ],
      n: [
        { t: 0.38, v: [0.6, 0.78, 0] },
        { t: 0.48, v: [0.55, 0.8, -0.05] },
      ],
    },
    { free: true, until: 0.92, bounce: [0.0, 0.33] },
    { hold: 'R', until: 0.92, keys: [{ t: 0, p: R0 }], n: [0, 1, 0] },
  ],
  hands: {
    R: [
      { t: 0, p: onTop(R0), flex: -0.6, pron: 1.35 },
      { t: 0.14, p: [-0.35, 0.86, 0.29], flex: 0.1, pron: 1.35 },
      { t: 0.22, p: [-0.22, 0.88, 0.36], flex: 0.3, pron: 1.1 }, // follow-through
      { t: 0.36, p: [-0.27, 1.08, 0.34], flex: 0.05, pron: 0.6 }, // up to protect while it is on the left
      { t: 0.56, p: [-0.4, 1.12, 0.28], flex: -0.35, pron: 1.0 }, // out to the side for the return
      { t: 0.86, p: [R0[0] - 0.01, R0[1] + PALM + 0.01, R0[2]], flex: -0.6, pron: 1.35 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.18, p: [0.34, 1.1, 0.32], flex: -0.3, pron: 0.9 },
      { t: 0.32, p: [0.45, 0.98, 0.29], flex: -0.4, pron: 1.0 }, // low and out, waiting for it
      { t: 0.48, p: [0.35, 0.86, 0.29], flex: 0.1, pron: 1.35 },
      { t: 0.56, p: [0.22, 0.88, 0.36], flex: 0.3, pron: 1.1 }, // follow-through
      { t: 0.72, p: [0.26, 1.1, 0.34], flex: 0.05, pron: 0.5 },
      { t: 0.9, p: GUARD.L, flex: 0, pron: 0.2 },
    ],
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body: [
    { t: 0, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
    { t: 0.06, x: -0.03, drop: 0.05, side: -0.04, twist: -0.09, lean: 0.06 },
    { t: 0.14, x: -0.01, drop: 0.09, side: -0.02, twist: -0.03, lean: 0.1 },
    { t: 0.32, x: 0.04, drop: 0.1, side: 0.06, twist: 0.12, lean: 0.1 }, // weight left
    { t: 0.46, x: 0.02, drop: 0.1, side: 0.02, twist: 0.04, lean: 0.1 },
    { t: 0.64, x: -0.04, drop: 0.09, side: -0.06, twist: -0.12, lean: 0.09 }, // and right again
    { t: 0.8, x: -0.02, drop: 0.04, side: -0.02, twist: -0.05, lean: 0.04 },
    { t: 0.92, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
  ],
};

/* Hesitation crossover: on the right he rises out of his stance, head and chest up, eyes on the rim as if he might pull
   up; the ball comes up higher off a slower dribble and hangs a beat in his hand at the top. Then he drops and explodes
   into a low, fast crossover to the left. The slow rise and the sudden drop sell it. */
const RIM_LOOK = [0, 3.28, 5.5], // where his eyes go in the hesitation (a rim ahead of him)
  /* Eyes up the floor: straight ahead at eye level, the head turned against the shoulders' twist. */
  ahead = tw => [Math.tan(-0.8 * tw) * 8, 1.75, 8];
export const hesiCross = {
  id: 'hesiCross',
  label: 'Hesitation crossover',
  family: 'handle',
  start: 'R',
  end: 'L',
  duration: 1.2,
  ball: [
    {
      hold: 'R',
      until: 0.12,
      keys: [
        { t: 0, p: R0 },
        { t: 0.12, p: [-0.37, 0.84, 0.26] }, // an easy push: a slower, higher dribble
      ],
      n: [0, 1, 0],
    },
    { free: true, until: 0.58, bounce: [-0.38, 0.3] },
    {
      hold: 'R',
      until: 0.8,
      keys: [
        { t: 0, p: [-0.37, 1.07, 0.27] }, // caught at the top of the high bounce
        { t: 0.09, p: [-0.38, 1.08, 0.26] }, // and hung there
        { t: 0.15, p: [-0.4, 1.0, 0.26] },
        { t: 0.22, p: [-0.24, 0.7, 0.3] }, // then driven down and across, hard
      ],
      n: [
        { t: 0.58, v: [0, 1, 0] },
        { t: 0.68, v: [-0.25, 0.95, 0] },
        { t: 0.78, v: [-0.55, 0.8, -0.05] },
      ],
    },
    { free: true, until: 1.2, bounce: [0.0, 0.34] },
    { hold: 'L', until: 1.2, keys: [{ t: 0, p: L1 }], n: [0, 1, 0] },
  ],
  hands: {
    R: [
      { t: 0, p: onTop(R0), flex: -0.6, pron: 1.35 },
      { t: 0.12, p: onTop([-0.37, 0.84, 0.26]), flex: -0.4, pron: 1.35 },
      { t: 0.22, p: [-0.37, 1.02, 0.26], flex: -0.5, pron: 1.35 },
      { t: 0.53, p: onTop([-0.37, 1.07, 0.27]), flex: -0.65, pron: 1.35 }, // waits on top for it
      { t: 0.8, p: [-0.35, 0.86, 0.29], flex: 0.1, pron: 1.35 },
      { t: 0.89, p: [-0.22, 0.88, 0.36], flex: 0.3, pron: 1.1 }, // follow-through
      { t: 1.04, p: [-0.25, 1.06, 0.36], flex: 0.1, pron: 0.5 },
      { t: 1.16, p: GUARD.R, flex: 0, pron: 0.2 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.45, p: [0.27, 1.27, 0.3], flex: 0, pron: 0.2 }, // up with him
      { t: 0.76, p: [0.29, 1.16, 0.33], flex: -0.1, pron: 0.5 },
      { t: 0.98, p: [0.42, 1.12, 0.28], flex: -0.35, pron: 1.0 }, // out to the side to meet it
      { t: 1.15, p: [L1[0] + 0.01, L1[1] + PALM + 0.01, L1[2]], flex: -0.6, pron: 1.35 },
    ],
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body: [
    { t: 0, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
    { t: 0.3, x: -0.01, drop: -0.05, side: 0, twist: 0, lean: -0.06 }, // rising up out of the stance
    { t: 0.6, x: -0.02, drop: -0.07, side: -0.01, twist: -0.02, lean: -0.08 }, // tall, chest up: the hesitation
    { t: 0.68, x: -0.02, drop: -0.06, side: -0.01, twist: -0.03, lean: -0.06 },
    { t: 0.8, x: -0.01, drop: 0.1, side: -0.03, twist: -0.05, lean: 0.12 }, // drops hard
    { t: 0.95, x: 0.05, drop: 0.1, side: 0.07, twist: 0.14, lean: 0.1 }, // and goes left with the ball
    { t: 1.1, x: 0.03, drop: 0.05, side: 0.03, twist: 0.06, lean: 0.05 },
    { t: 1.2, x: 0, drop: 0, side: 0, twist: 0, lean: 0 },
  ],
  look: [
    { t: 0, p: ahead(0) },
    { t: 0.15, p: ahead(0) },
    { t: 0.4, p: RIM_LOOK }, // eyes up to the rim
    { t: 0.68, p: RIM_LOOK },
    { t: 0.82, p: ahead(-0.05) }, // back down the floor as he goes
    { t: 0.95, p: ahead(0.14) },
    { t: 1.1, p: ahead(0.06) },
    { t: 1.2, p: ahead(0) },
  ],
};

export default [crossover, doubleCross, hesiCross];
