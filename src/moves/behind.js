// Behind the back: the ball wrapped around behind the hips, hand to hand. Written for the right hand (mirrored for the left).
import { GUARD, PALM, STANCE, topOf, norm, combo } from './core.js';
import { crossover } from './crossovers.js';

const R0 = topOf('R'),
  L1 = topOf('L'),
  onTop = p => [p[0], p[1] + PALM, p[2]];

/* Behind the back, right to left: the right hand takes the ball back past the right hip, its palm sliding round to the
   ball's outside and back, and sweeps it across behind the hips; it leaves the hand behind him moving left and down,
   bounces once outside his left foot, a little ahead of it, and comes up into the left hand. The right shoulder turns back
   and dips with the wrap, then the shoulders come round to the left with the ball. */
export const behindBack = {
  id: 'behindBack',
  label: 'Behind the back',
  family: 'handle',
  start: 'R',
  end: 'L',
  duration: 0.88,
  ball: [
    {
      hold: 'R',
      until: 0.34,
      keys: [
        { t: 0, p: R0 },
        { t: 0.1, p: [-0.43, 0.88, 0.08] }, // ridden down and back beside the right hip
        { t: 0.22, p: [-0.33, 0.82, -0.22] }, // round behind the right hip
        { t: 0.34, p: [-0.03, 0.8, -0.34] }, // swept across behind the hips: let go
      ],
      n: [
        { t: 0, v: [0, 1, 0] },
        { t: 0.1, v: norm([-0.35, 0.6, 0.7]) }, // the palm slides to the front-outside to pull it back
        { t: 0.22, v: norm([-0.85, 0.35, 0.15]) }, // on the outside as it goes round the hip
        { t: 0.34, v: norm([-0.9, 0.35, -0.2]) }, // on the back-outside, pushing it across
      ],
      flex: -0.45, // wrist cocked back the whole way (a push), so it never snaps as the palm turns
    },
    { free: true, until: 0.88, bounce: [0.5, 0.05] },
    { hold: 'L', until: 0.88, keys: [{ t: 0, p: L1 }], n: [0, 1, 0] },
  ],
  hands: {
    R: [
      { t: 0, p: onTop(R0), flex: -0.6, pron: 1.35 },
      { t: 0.34, p: [-0.2, 0.86, -0.36], flex: 0.3, pron: 0 },
      { t: 0.44, p: [-0.16, 0.9, -0.36], flex: 0.2, pron: 0 }, // follow-through behind him
      { t: 0.62, p: [-0.42, 0.98, -0.04], flex: 0, pron: 0.1 }, // back round the hip
      { t: 0.84, p: GUARD.R, flex: 0, pron: 0.2 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.34, p: [0.3, 1.17, 0.31], flex: -0.1, pron: 0.5 }, // still protecting while the ball is behind him
      { t: 0.6, p: [0.42, 1.1, 0.27], flex: -0.5, pron: 1.3 }, // out over where it comes up
      { t: 0.8, p: [0.38, 1.18, 0.25], flex: -0.6, pron: 1.35 }, // waiting on top for it
    ],
  },
  feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  body: [
    { t: 0, x: 0, yaw: 0, drop: 0, side: 0, twist: 0, lean: 0 },
    { t: 0.12, x: -0.02, yaw: -0.02, drop: 0.08, side: -0.04, twist: -0.12, lean: 0.03 }, // weight over the ball
    { t: 0.24, x: -0.02, yaw: -0.06, drop: 0.12, side: -0.07, twist: -0.26, lean: -0.02 }, // right shoulder back and down
    { t: 0.36, x: 0.01, yaw: -0.03, drop: 0.12, side: -0.02, twist: -0.16, lean: 0 }, // the right shoulder still back as he lets go
    { t: 0.56, x: 0.035, yaw: 0.04, drop: 0.08, side: 0.06, twist: 0.12, lean: 0.05 }, // weight goes left with the ball
    { t: 0.74, x: 0.02, yaw: 0.02, drop: 0.04, side: 0.03, twist: 0.06, lean: 0.03 },
    { t: 0.88, x: 0, yaw: 0, drop: 0, side: 0, twist: 0, lean: 0 },
  ],
};

/* Behind the back to crossover: behind the back right to left, and straight back across in front with a low crossover. */
export const behindBackCross = combo(
  { id: 'behindBackCross', label: 'Behind the back to crossover', family: 'handle' },
  [behindBack, crossover],
);

export default [behindBack, behindBackCross];
