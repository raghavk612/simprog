// Step-back jumper (showtime): a real shot at a real hoop, a rebounder, and the pass back. Written for the right hand
// (the Routine mirrors it for the left). Built from the court context: ctx.rim (the ring's centre) and ctx.feeder (the
// rebounder's feet), both in the move's base frame. See README.md.
//
// He turns to face the rim with a dribble, jabs at it with a hard dribble, steps back (both feet hop back), gathers into
// his shooting pocket, rises and shoots at the top of his jump; the ball arcs in through the middle of the ring with
// backspin, drops through the net, bounces once to the rebounder, who catches it and fires a chest pass back; the shooter,
// who held his follow-through and came down, catches it at his chest, turns back square and dribbles on.
import { BALL } from '../basketball.js';
import { GUARD, PALM, STANCE, topOf, yawRot, add, sub, mul, norm } from './core.js';

const R0 = topOf('R');
const G = BALL.g;
/* A stance (both feet, [x, z, yaw]) centred on c = [x, z], turned by yaw. */
const stance = (c, yaw) =>
  Object.fromEntries(
    ['R', 'L'].map(h => {
      const o = yawRot([STANCE[h][0], 0, STANCE[h][1]], yaw);
      return [h, [c[0] + o[0], c[1] + o[2], yaw]];
    }),
  );

function build(ctx) {
  const rim = ctx.rim,
    feeder = ctx.feeder,
    face = Math.atan2(rim[0], rim[2]), // yaw that faces the rim from the spot
    back = yawRot([0, 0, -0.6], face), // the step-back: 0.6 straight away from the rim
    C = [back[0], back[2]];
  // the jump: off the floor at UP, a 0.45 rise (a real ballistic hop), down at DOWN
  const RISE = 0.45,
    hang = Math.sqrt((2 * RISE) / G),
    UP = 1.36,
    TOP = UP + hang,
    DOWN = TOP + hang,
    REL = TOP - 0.02; // released just before the top
  const jumpY = t => (t <= UP || t >= DOWN ? 0 : RISE - 0.5 * G * (t - TOP) ** 2);
  // the shot: from the release (above his forehead) to the ring, rising about 1.5 above it (a high, soft arc)
  const relBody = [-0.06, 2.22, 0.24], // ball centre at release, body frame (includes nothing of the jump: the frame adds it)
    relBase = add(add(yawRot(relBody, face), [C[0], 0, C[1]]), [0, jumpY(REL), 0]),
    apex = rim[1] + 1.5,
    shotT = Math.sqrt((2 * (apex - relBase[1])) / G) + Math.sqrt((2 * (apex - rim[1])) / G),
    RIM = REL + shotT,
    NET = RIM + 0.16,
    under = [rim[0], rim[1] - 0.45, rim[2]];
  // the rebound: it bounces once on the way to the rebounder and comes up into his hands at his chest
  const toHero = norm(sub([C[0], 0, C[1]], [feeder[0], 0, feeder[2]])),
    chest = add([feeder[0], 1.18, feeder[2]], mul(toHero, 0.3)),
    hit = add(under, mul(sub(chest, under), 0.42)),
    FCATCH = NET + 0.72,
    FPASS = FCATCH + 0.42,
    pulled = add(chest, mul(toHero, -0.08)), // he brings it into his chest before the pass
    HCATCH = FPASS + 0.82, // a crisp chest pass
    TURN = HCATCH + 0.12, // he turns back square and steps back to the spot as he brings the ball down
    PUSH = HCATCH + 0.42,
    END = PUSH + 0.46;
  const faceFeeder = Math.atan2(feeder[0] - C[0], feeder[2] - C[1]);
  const backspin = (() => {
    const d = norm([rim[0] - relBase[0], 0, rim[2] - relBase[2]]);
    return mul([d[2], 0, -d[0]], -12); // about the horizontal axis across the flight, top spinning back toward him
  })();

  // ---- body: turn to the rim, jab, hop back, dip, jump, land, turn to the pass, then back square on the spot
  const body = [
    { t: 0, x: 0, z: 0, yaw: 0, drop: 0, lean: 0, twist: 0, side: 0 },
    { t: 0.42, x: 0, z: 0, yaw: face, drop: 0.05, lean: 0.06 },
    { t: 0.66, drop: 0.12, lean: 0.16, twist: 0.08 }, // the jab: low, leaning at the rim
    { t: 0.86, x: 0, z: 0, drop: 0.1, lean: 0.1, twist: 0 },
    { t: 1.08, x: C[0] * 0.3, z: C[1] * 0.3, drop: 0.06, lean: 0.02 }, // pushing off back
    { t: 1.26, x: C[0], z: C[1], yaw: face, drop: 0.13, lean: 0.03 }, // lands the step-back, low and balanced
    { t: UP, drop: 0.15, lean: 0.02 }, // the dip
    { t: TOP, drop: -0.04, lean: -0.03 }, // tall at the top
    { t: DOWN, drop: 0.02, lean: 0 },
    { t: DOWN + 0.12, drop: 0.1, lean: 0.03 }, // lands soft
    { t: DOWN + 0.6, x: C[0], z: C[1], yaw: face, drop: 0.03, lean: 0 },
    { t: FCATCH, yaw: faceFeeder, drop: 0.04 }, // turns a little to the rebounder for the pass
    { t: HCATCH, x: C[0], z: C[1], yaw: faceFeeder, drop: 0.07, lean: 0.05 },
    { t: END - 0.08, x: 0, z: 0, yaw: 0, drop: 0.02, lean: 0.01, twist: 0, side: 0 },
    { t: END, x: 0, z: 0, yaw: 0, drop: 0, lean: 0, twist: 0, side: 0 },
  ];
  for (let t = UP; t <= DOWN + 1e-9; t += 0.03) body.push({ t: +t.toFixed(3), y: jumpY(t) });
  body.push({ t: 0, y: 0 }, { t: UP - 0.01, y: 0 }, { t: DOWN + 0.01, y: 0 }, { t: END, y: 0 });

  // ---- feet (base frame)
  const S0 = stance([0, 0], 0),
    S1 = stance([0, 0], face),
    jab = (() => {
      const o = yawRot([STANCE.R[0], 0, STANCE.R[1] + 0.38], face);
      return [o[0], o[2], face];
    })(),
    S2 = stance(C, face),
    S3 = stance(C, faceFeeder);
  const feet = [
    { t: 0, ...S0 },
    { t: 0.12, R: S0.R },
    { t: 0.3, R: S1.R }, // turn to the rim: right foot, then left
    { t: 0.22, L: S0.L },
    { t: 0.42, L: S1.L },
    { t: 0.5, R: S1.R },
    { t: 0.64, R: jab }, // the jab step at the rim
    { t: 0.82, R: jab },
    { t: 0.98, R: S1.R }, // back from the jab
    { t: 1.05, L: S1.L },
    { t: 1.26, R: S2.R, L: S2.L, lift: { R: 0.1, L: 0.1 } }, // the step-back hop
    { t: DOWN + 0.6, ...S2 },
    { t: FCATCH - 0.25, ...S3 }, // squares up to the rebounder (a small turn of both feet)
    { t: HCATCH + 0.05, ...S3 },
    { t: HCATCH + 0.3, R: stance([C[0] * 0.5, C[1] * 0.5], faceFeeder * 0.4).R }, // steps back to the spot, turning square
    { t: HCATCH + 0.5, L: STANCE.L },
    { t: PUSH, R: STANCE.R }, // planted before the last dribble bounces beside it
    { t: END - 0.06, R: STANCE.R, L: STANCE.L },
    { t: END, R: STANCE.R, L: STANCE.L },
  ];

  // ---- the ball
  const ball = [
    // a dribble as he turns to face the rim
    {
      hold: 'R',
      until: 0.1,
      keys: [
        { t: 0, p: R0 },
        { t: 0.1, p: [-0.36, 0.8, 0.26] },
      ],
      n: [0, 1, 0],
    },
    {
      free: true,
      until: 0.5,
      bounce: (() => {
        const o = yawRot([-0.36, 0, 0.27], face * 0.6);
        return [o[0], o[2]];
      })(),
    },
    // the jab: caught at the top, pounded hard into the floor ahead
    {
      hold: 'R',
      until: 0.6,
      keys: [
        { t: 0, p: R0 },
        { t: 0.1, p: [-0.3, 0.72, 0.4] },
      ],
      n: [
        { t: 0.5, v: [0, 1, 0] },
        { t: 0.6, v: [-0.2, 0.9, -0.3] },
      ],
    },
    {
      free: true,
      until: 1.0,
      bounce: (() => {
        const o = yawRot([-0.22, 0, 0.62], face);
        return [o[0], o[2]];
      })(),
    },
    // gathered off the bounce into both hands as he hops back; dips with him; rises to the release above his forehead
    {
      hold: 'both',
      until: REL,
      keys: [
        { t: 0, p: [-0.12, 1.02, 0.38] },
        { t: 0.18, p: [-0.06, 1.12, 0.36] },
        { t: UP - 1.0, p: [-0.06, 1.18, 0.36] }, // the pocket, out in front of his chest, at the bottom of the dip
        { t: REL - 1.0 - 0.14, p: [-0.06, 1.8, 0.3] },
        { t: REL - 1.0, p: relBody },
      ],
      nR: [
        { t: 1.0, v: [-0.85, -0.1, -0.3] },
        { t: UP, v: [-0.55, -0.45, -0.55] },
        { t: REL, v: [0.02, -0.5, -0.85] }, // the shooting hand behind and under it
      ],
      nL: [
        { t: 1.0, v: [0.9, 0, -0.2] },
        { t: REL, v: [0.9, -0.35, 0] }, // the guide hand on its side
      ],
      flexR: -0.8, // the shooting wrist cocked back under the ball
      pronR: 0.5,
      flexL: 0,
      pronL: 0,
    },
    // the shot: in through the middle of the ring, through the net, one bounce to the rebounder
    { free: true, until: RIM, to: rim },
    { free: true, until: NET, from: rim, to: under },
    { free: true, until: FCATCH, from: under, bounce: [hit[0], hit[2]] },
    // the rebounder has it: brings it in to his chest, then the chest pass back
    {
      hold: 'other',
      until: FPASS,
      frame: 'base',
      keys: [
        { t: 0, p: chest },
        { t: FPASS - FCATCH, p: pulled },
      ],
    },
    { free: true, until: HCATCH },
    // caught at his chest with both hands, brought down to the right hip as he turns back square
    {
      hold: 'both',
      until: PUSH - 0.12,
      keys: [
        { t: 0, p: [0, 1.22, 0.42] },
        { t: 0.1, p: [0, 1.18, 0.34] },
        { t: PUSH - 0.12 - HCATCH, p: [-0.3, 1.0, 0.27] },
      ],
      nR: [
        { t: HCATCH, v: [-0.95, 0, -0.2] },
        { t: PUSH - 0.12, v: [-0.3, 0.9, -0.1] },
      ],
      nL: [0.95, 0, -0.2],
    },
    {
      hold: 'R',
      until: PUSH,
      keys: [
        { t: 0, p: [-0.3, 1.0, 0.27] },
        { t: 0.12, p: [-0.35, 0.8, 0.25] },
      ],
      // the palm rolls from the side of the ball onto its top as it pushes (it was on the side-top in the catch)
      n: [
        { t: PUSH - 0.12, v: [-0.3, 0.9, -0.1] },
        { t: PUSH - 0.04, v: [0, 1, 0] },
      ],
    },
    { free: true, until: END, bounce: [R0[0], R0[2]] },
    { hold: 'R', until: END, keys: [{ t: 0, p: R0 }], n: [0, 1, 0] },
  ];

  // ---- the free hands
  const ready = { R: [-0.13, 1.2, 0.5], L: [0.13, 1.2, 0.5] }; // hands up, waiting for the pass
  const hands = {
    R: [
      { t: 0, p: [R0[0], R0[1] + PALM, R0[2]], flex: -0.6, pron: 1.35 },
      { t: 0.1, p: [-0.36, 0.8 + PALM, 0.26], flex: -0.4, pron: 1.35 },
      { t: 0.32, p: [-0.36, 0.98 + PALM, 0.27], flex: -0.6, pron: 1.35 },
      { t: 0.7, p: [-0.3, 0.78 + PALM, 0.42], flex: 0.1, pron: 1.35 },
      { t: 0.9, p: [-0.2, 1.05, 0.38], flex: -0.3, pron: 0.6 },
      // the follow-through: arm up and out at the rim, wrist snapped down ("in the cookie jar"), held
      { t: REL + 0.12, p: [-0.2, 2.16, 0.46], flex: 1.0, pron: 0.5, pole: [-0.4, -0.8, 0.2] }, // arm long, up and out at the rim
      { t: DOWN + 0.04, p: [-0.2, 1.99, 0.46], flex: 1.0, pron: 0.5, pole: [-0.4, -0.8, 0.2] }, // lands, arm still long
      { t: DOWN + 0.25, p: [-0.2, 1.88, 0.5], flex: 0.9, pron: 0.5, pole: [-0.4, -0.8, 0.2] }, // and down with him
      { t: DOWN + 0.75, p: [-0.24, 1.2, 0.32], flex: 0, pron: 0.2, pole: [-0.4, -0.6, -0.7] }, // elbow back down at his side
      { t: HCATCH - 0.25, p: ready.R, flex: 0, pron: 0, pole: [-0.6, -0.8, -0.2] }, // elbows down and out to catch
      { t: PUSH + 0.1, p: [-0.36, 0.8 + PALM, 0.25], flex: 0.1, pron: 1.35 },
      { t: END, p: [R0[0], R0[1] + PALM, R0[2]], flex: -0.6, pron: 1.35 },
    ],
    L: [
      { t: 0, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: 0.8, p: [0.2, 1.15, 0.36], flex: 0, pron: 0 },
      // the guide hand comes off the ball at the release and falls away, forward and to the side
      { t: REL + 0.07, p: [0.16, 2.22, 0.32], flex: 0, pron: 0 }, // drifts on up with the shot for a moment
      { t: REL + 0.3, p: [0.34, 1.78, 0.5], flex: 0, pron: 0 },
      { t: DOWN + 0.25, p: [0.34, 1.46, 0.46], flex: 0, pron: 0 },
      { t: DOWN + 0.75, p: GUARD.L, flex: 0, pron: 0.2 },
      { t: HCATCH - 0.25, p: ready.L, flex: 0, pron: 0 },
      { t: PUSH - 0.12, p: [-0.1, 1.02, 0.26], flex: 0, pron: 0 }, // comes off the ball at his right hip
      { t: PUSH + 0.12, p: [0.24, 1.14, 0.32], flex: 0, pron: 0.2 },
      { t: END, p: GUARD.L, flex: 0, pron: 0.2 },
    ],
  };

  return {
    ...stepbackJumper,
    build: undefined,
    duration: END,
    ball,
    hands,
    feet,
    body,
    // eyes on the rim from the jab to the ball going in, on the rebounder for the pass, then up the floor
    lookFrame: 'base',
    look: [
      { t: 0, p: [0, 1.75, 8] },
      { t: 0.45, p: rim },
      { t: RIM + 0.1, p: rim },
      { t: FCATCH - 0.3, p: add(feeder, [0, 1.3, 0]) },
      { t: HCATCH, p: add(feeder, [0, 1.3, 0]) },
      { t: END, p: yawRot([0, 1.75, 8], 0) },
    ],
    spin: [{ from: REL, to: RIM, w: backspin }],
    // the rebounder's arms: up for the rebound as it comes off the net, the pass, then relaxed
    extra: t => ({
      feeder: t > NET - 0.25 && t < FCATCH ? 'rebound' : t >= FCATCH && t < FPASS + 0.25 ? 'pass' : 'relax',
    }),
  };
}

export const stepbackJumper = {
  id: 'stepbackJumper',
  label: 'Step-back jumper',
  family: 'show',
  start: 'R',
  end: 'R',
  needs: ['rim', 'feeder'],
  duration: 6, // set by build from the rim's distance
  build,
};

export default [stepbackJumper];
