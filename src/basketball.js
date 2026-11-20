// Shared, deterministic basketball presentation. No rendering or wall-clock RNG here.
import {
  simulatePlay,
  playersOf,
  runProfile,
  along,
  roundCorners,
  GAP,
  playKey,
  SIM_FPS,
  seedOf,
} from './playsim.js';
import { simulateBall, BALL_R } from './ballsim.js';
import { choreoPlan, choreograph } from './choreo.js';
export const CLIP_SECONDS = 4.4; // one side's play; the run between plays happens before it (Arena.startTransit)
/* The motion version stamped on every new play (engine.js makePlay, field v). sampleClip moves the players of a play with
   no version (recorded before it existed) exactly as it always did, so old saves and replays never change:
     1 (no v)  off-ball players sway on a sine wave around their spots
     2         off-ball players move with purpose: a basket cut with a plant, a jab-and-pop V-cut, filling the corner as the
               drive comes, a safety getting back, crashing the boards after the shot; they watch the ball; the
               catch-and-shoot's defender sags into help and closes out (a sprint, then chopping steps)
     3         physical movement (src/playsim.js): version 2's movement becomes what each player intends, and he follows it
               with a body's limits (speed, acceleration, braking, turning, reaction time); the play's promises (the
               release spot and moment, the ball at the rim, the block, the rebound, who has the ball) are kept exactly */
export const MOTION_VERSION = 3;
export const SHOTS = {
  catch: { label: 'Catch-and-shoot three', three: true, base: -0.035, finish: [4.2, 5.5], arc: 3.8 },
  pullup: { label: 'Pull-up jumper', three: false, base: 0.015, finish: [7, 2.7], arc: 3 },
  stepback: { label: 'Step-back three', three: true, base: -0.075, finish: [3.8, 3.8], arc: 4 },
  drive: { label: 'Crossover layup', three: false, base: 0.13, finish: [11.5, 1], arc: 1 },
  floater: { label: 'Running floater', three: false, base: 0.045, finish: [9.5, 1.8], arc: 2.3 },
  hook: { label: 'Post hook', three: false, base: 0.055, finish: [10, 1.8], arc: 2.1 },
  dunk: { label: 'Fast-break dunk', three: false, base: 0.2, finish: [12, 0], arc: 0.25 },
  roll: { label: 'Pick-and-roll finish', three: false, base: 0.11, finish: [11.2, 0.8], arc: 1.2 },
  // Variations: 'like' names the move whose animation and special cases they share.
  euro: { label: 'Euro-step layup', three: false, base: 0.1, finish: [11.2, 1.3], arc: 1.1, like: 'drive' },
  fadeaway: {
    label: 'Fadeaway jumper',
    three: false,
    base: -0.02,
    finish: [8, 2.6],
    arc: 3.2,
    like: 'pullup',
  },
  alley: { label: 'Alley-oop dunk', three: false, base: 0.19, finish: [12, 0], arc: 0.3, like: 'dunk' },
  corner: { label: 'Corner three', three: true, base: -0.07, finish: [4.6, 6.3], arc: 3.8, like: 'catch' },
  spin: { label: 'Spin-move finish', three: false, base: 0.06, finish: [10.4, 1.7], arc: 1.9, like: 'hook' },
};
/* The move whose animation a shot shares, and whether it finishes with a dunk. */
export const family = kind => SHOTS[kind]?.like || kind;
export const isDunk = kind => family(kind) === 'dunk';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * clamp(t);
const smooth = t => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
/* A route through its waypoints as a smooth curve (centripetal Catmull-Rom, which never loops or overshoots on a sharp cut),
   as a dense polyline: players round their cuts the way real ones do instead of turning on the spot at each waypoint. */
export function smoothRoute(points, steps = 10) {
  if (points.length < 3) return points;
  const P = [points[0], ...points, points[points.length - 1]],
    out = [points[0]],
    knot = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]],
      t1 = knot(p0, p1),
      t2 = t1 + knot(p1, p2),
      t3 = t2 + knot(p2, p3);
    for (let k = 1; k <= steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps,
        L = (a, b, ta, tb) => [0, 1].map(j => ((tb - t) * a[j] + (t - ta) * b[j]) / (tb - ta)),
        A1 = L(p0, p1, 0, t1),
        A2 = L(p1, p2, t1, t2),
        A3 = L(p2, p3, t2, t3),
        B1 = L(A1, A2, 0, t2),
        B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  return out;
}
/* A point along a route at fraction t of its length: an even speed through the waypoints (no stop at each corner), so the
   overall run curve alone decides how a player speeds up and slows down. */
function path(points, t) {
  const seg = points.slice(1).map((q, i) => Math.hypot(q[0] - points[i][0], q[1] - points[i][1])),
    total = seg.reduce((a, b) => a + b, 0) || 1;
  let d = clamp(t) * total,
    i = 0;
  while (i < seg.length - 1 && d > seg[i]) {
    d -= seg[i];
    i++;
  }
  const u = seg[i] ? Math.min(1, d / seg[i]) : 1;
  return [lerp(points[i][0], points[i + 1][0], u), lerp(points[i][1], points[i + 1][1], u)];
}
/* The moves a tactic and pace call for: the perimeter bag, the fast bag, or the steady bag. choosePlay draws from it unless the caller passes a narrower bag (the Kangs' bag is limited to the moves they have learned, see skills.js). */
export const moveBag = (tactic, pace) =>
  tactic === 'perimeter'
    ? ['catch', 'catch', 'corner', 'stepback', 'pullup', 'fadeaway', 'drive', 'euro', 'roll']
    : pace === 'fast'
      ? ['dunk', 'alley', 'drive', 'euro', 'roll', 'catch', 'floater', 'pullup']
      : [
          'catch',
          'pullup',
          'stepback',
          'corner',
          'drive',
          'euro',
          'floater',
          'hook',
          'spin',
          'fadeaway',
          'roll',
        ];
export function choosePlay(rng, tactic, pace, last, bag = moveBag(tactic, pace)) {
  let kind = bag[Math.floor(rng() * bag.length)];
  if (kind === last) kind = bag[(bag.indexOf(kind) + 1 + Math.floor(rng() * (bag.length - 1))) % bag.length];
  return kind;
}
// English commentary templates. Other languages provide the same structure under "cm" in their locale file; {{name}}-style slots are filled from the play.
// Announcer-style lines (after how play-by-play is really called: short phrases, present tense, where on the floor, the
// shooter's name up front, inversions like "up goes the shot", and calls that rise on the finish). The ellipses and dashes are
// pauses for the spoken commentary. Every language has the same number of variants (tests/i18n.test.js).
export const COMMENTARY = {
  join: ' ',
  side: { right: 'right', left: 'left' },
  lead: {
    catch: [
      '{{helper}} swings it to {{name}}, {{side}} wing…',
      '{{name}} drifts to the {{side}} wing… {{helper}} finds him.',
      'Ball movement… {{helper}} to {{name}}, catch and shoot…',
      '{{name}}, wide open on the {{side}} side… lets it go…',
    ],
    pullup: [
      '{{name}} stops on a dime at the elbow… pull-up…',
      '{{name}}, the hesitation… rises from fifteen…',
      '{{name}} into the lane, stops short… up goes the jumper…',
      '{{name}} with the step-in, pulls up…',
    ],
    stepback: [
      '{{name}} crosses… steps back… from deep…',
      '{{name}} sells the drive… step-back three…',
      '{{name}} isolates on {{def}}… step-back, fires…',
      '{{name}} creates space on {{def}}… lets it fly…',
    ],
    drive: [
      '{{name}}, right hand, left hand… past {{def}}…',
      '{{name}} attacks the gap… crossover, gets downhill…',
      '{{name}} blows by {{def}}… to the rim…',
      '{{name}}, first step… he’s in the lane…',
    ],
    floater: [
      '{{name}} snakes into the lane… floater…',
      '{{name}} over the help… the runner…',
      '{{name}} into the teeth of the defense… lofts it…',
      '{{name}} gets a step on {{def}}… throws up the teardrop…',
    ],
    hook: [
      '{{name}} backs down {{def}}… turns over the shoulder…',
      '{{name}} seals on the block… jump hook…',
      '{{name}} on the left block… drop step, hook shot…',
      'Post feed to {{name}}… one dribble, the hook…',
    ],
    dunk: [
      'Steal, and {{name}} is gone… nobody back…',
      '{{helper}} with the outlet… {{name}} in transition…',
      '{{name}} out in the open floor… all alone…',
      'Long rebound… {{name}} takes off…',
    ],
    roll: [
      '{{helper}} sets the pick… {{name}} rolls hard…',
      'Pick-and-roll… {{name}} turns the corner…',
      '{{name}} comes off {{helper}}’s screen… downhill…',
      '{{helper}} slips the screen… pocket pass to {{name}}…',
    ],
    euro: [
      '{{name}}, the euro step around {{def}}…',
      '{{name}} with two long strides… euro step…',
      '{{name}} goes left… back right… the euro…',
      '{{name}} splits the defense… gather, euro step…',
    ],
    fadeaway: [
      '{{name}} on the baseline… fades away…',
      '{{name}} turns on {{def}}… leaning fadeaway…',
      '{{name}} over the top of {{def}}… the fadeaway…',
      '{{name}} faces up… a jab, falling away…',
    ],
    alley: [
      '{{name}} cuts backdoor… the lob is up…',
      '{{helper}} looks… lobs it for {{name}}…',
      'Alley-oop look… {{helper}} to {{name}}…',
      '{{name}} sneaks behind {{def}}… here comes the lob…',
    ],
    corner: [
      '{{helper}} kicks it to {{name}} in the corner…',
      '{{name}} spotting up in the {{side}} corner…',
      'Drive and kick… {{name}}, corner three…',
      '{{name}} lifts to the corner… catch… shot…',
    ],
    spin: [
      '{{name}} spins off {{def}} on the block…',
      '{{name}}, the spin move… goes up strong…',
      '{{name}} fakes left, spins right…',
      '{{name}} with the reverse pivot… up and under…',
    ],
  },
  steal: [
    'Picked off! {{def}} strips {{name}}… turnover.',
    '{{def}} reads it… pokes it away from {{name}}!',
    '{{name}} loses the handle… {{def}} scoops it up.',
    'Swiped! {{def}} takes it right from {{name}}.',
  ],
  block: [
    'Up goes the shot… and {{def}} sends it back!',
    'Rejected! {{def}} meets it at the top!',
    '{{def}} rotates over… blocked!',
    'Get that out of here! {{def}} with the swat!',
  ],
  loose: [
    '{{rebounder}} chases down the loose ball.',
    'Loose ball… {{rebounder}} comes up with it.',
    '{{rebounder}} dives on it.',
  ],
  putbackMade: [
    '{{helper}} grabs the loose ball and puts it right back up… good!',
    'Loose ball… {{helper}} gets there first and scores!',
    '{{helper}} hustles it down and lays it in!',
  ],
  putbackMiss: [
    '{{helper}} grabs the loose ball, goes back up… no good.',
    '{{helper}} wins the scramble, but the putback rims out.',
    'Second chance for {{helper}}… off the iron.',
  ],
  finish: {
    three: [
      'Got it! Three!',
      'Bang! From downtown!',
      'Nothing but net… three!',
      'Splash! Knocks it down from deep!',
      'Count it! Three-pointer!',
    ],
    dunk: [
      'Throws it down! Slam!',
      'Two hands… flush!',
      'Oh, he hammered that one home!',
      'Rises… and slams it!',
    ],
    two: [
      'Good! Two.',
      'Soft touch… in.',
      'Drops! Two points.',
      'Puts it in off the glass.',
      'Gets the roll… good!',
    ],
    miss: ['No good… off the rim.', 'Short… front rim.', 'In and out!', 'Off the back iron.', 'Won’t fall.'],
  },
  assist: ['Nice dish from {{helper}}.', '{{helper}} with the assist.', 'Great feed by {{helper}}.'],
  rebound: ['{{rebounder}} pulls down the board.', 'Rebound… {{rebounder}}.', '{{rebounder}} cleans it up.'],
};
const fill = (text, p) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => p[k] ?? m);
// Builds the commentary for a play from template choices (cm). Returns null if a choice does not exist in the template set, so callers can fall back to the stored English text.
export function renderCommentary(c, cm, T = COMMENTARY) {
  if (!Array.isArray(cm) || !T?.lead) return null;
  const p = {
      name: c.player,
      def: c.defender,
      helper: c.helper,
      rebounder: c.rebounder,
      side: c.lane > 0 ? T.side?.right : T.side?.left,
    },
    f = t => (typeof t === 'string' ? fill(t, p) : null),
    join = T.join ?? ' ';
  // one-line tags (assist, loose ball, rebound) vary by the play itself, without extra random draws
  const at = (list, i) => (Array.isArray(list) ? list[i] : undefined); // out of range (an old save): null, so callers show the stored text
  const h = [...(String(c.player) + String(c.kind) + String(c.lane))].reduce(
      (a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0,
      7,
    ),
    tag = x => (Array.isArray(x) ? x[h % x.length] : x);
  let parts;
  if (c.outcome === 'steal') parts = [f(at(T.steal, cm[0]))];
  else if (c.outcome === 'block')
    parts = [
      f(at(T.lead[c.kind], cm[0])),
      f(at(T.block, cm[1])),
      // the loose ball: the defense comes up with it, or the shooting team keeps it and goes back up
      f(tag(c.recovery === 'offense' ? (c.putback === 'made' ? T.putbackMade : T.putbackMiss) : T.loose)),
    ];
  else {
    const group = c.points ? (c.three ? 'three' : isDunk(c.kind) ? 'dunk' : 'two') : 'miss';
    parts = [
      f(at(T.lead[c.kind], cm[1])),
      f(at(T.finish?.[group], cm[0])),
      c.points ? (c.assisted ? f(tag(T.assist)) : '') : f(tag(T.rebound)),
    ];
  }
  return parts.some(x => x === null) ? null : parts.filter(Boolean).join(join);
}
// Picks the template variants with the same random draws, in the same order, as the original single-language version, so seeded games are unchanged.
export function describePlay(c, rng) {
  const idx = n => Math.floor(rng() * n);
  let cm;
  if (c.outcome === 'steal') cm = [idx(COMMENTARY.steal.length)];
  else if (c.outcome === 'block') {
    const lead = idx(COMMENTARY.lead[c.kind].length),
      block = idx(COMMENTARY.block.length);
    cm = [lead, block];
  } else {
    const finish = idx(
        COMMENTARY.finish[c.points ? (c.three ? 'three' : isDunk(c.kind) ? 'dunk' : 'two') : 'miss'].length,
      ),
      lead = idx(COMMENTARY.lead[c.kind].length);
    cm = [finish, lead];
  }
  return { text: renderCommentary(c, cm), cm };
}
/* ---- Ball physics for the plays (game units: the rim is 10 ft up at y 3.28, so 1 ft = 0.328) ---- */
export const BALL = {
  g: 32.2 * 0.328, // gravity in game units per second squared
  floor: 0.3, // the ball's centre when it touches the floor (the plays place the classic ball, see Arena.settleBall)
  rim: 3.28,
  bounce: 0.82, // speed kept off a hardwood floor: a ball dropped from 6 ft comes back to about 49-54 in (sqrt 51/72 = 0.84)
  arrive: 0.86, // fraction of the clip at which every shot reaches the rim (the score is shown then)
  hand: 2.3, // shooting pocket height before the jump
};
/* Where a thrown or bouncing ball is `tau` seconds after leaving p with velocity v: gravity, and bounces off the floor that
   keep BALL.bounce of the speed. Horizontal speed is constant (the plays are too short for floor friction to show). */
export function fly(p, v, tau) {
  const g = BALL.g;
  let y = Math.max(BALL.floor, p.y),
    vy = v.y,
    t = Math.max(0, tau);
  for (let n = 0; n < 24; n++) {
    const hit = (vy + Math.sqrt(vy * vy + 2 * g * (y - BALL.floor))) / g; // time until it reaches the floor
    if (t <= hit) {
      y += vy * t - 0.5 * g * t * t;
      break;
    }
    t -= hit;
    vy = (g * hit - vy) * BALL.bounce;
    y = BALL.floor;
    if (vy < 0.4) break; // settled
  }
  return { x: p.x + v.x * tau, y: Math.max(BALL.floor, y), z: p.z + v.z * tau };
}
/* The launch velocity that carries a ball from p to q in T seconds under gravity. */
export const launch = (p, q, T) => ({
  x: (q.x - p.x) / T,
  y: (q.y - p.y + 0.5 * BALL.g * T * T) / T,
  z: (q.z - p.z) / T,
});
/* ---- The dribble: the hand leads, the ball follows physics ----
   The hand makes one smooth loop per bounce: a push down from `top` through 2 x `reach`, then a slow rise back to the top.
   Both strokes start and end gently (smootherstep: no sudden snap at the top and no hard stop at the bottom). The ball
   rides the hand from the top and leaves it `at` of the way through the push, at the hand's speed; the hand eases to a stop
   while the ball falls on under gravity, bounces off the floor (BALL.bounce) and comes back up into the hand as the hand
   reaches the top again, slowly (`arrive` units/s), so the catch is soft. The push is only as quick as it has to be for
   that: its length and the rhythm (DRIBBLE.period) are worked out from the bounce, not picked.
   Heights are ball-centre heights; the hand height is where the ball's centre is when the hand is on it. */
const smoother = s => s * s * s * (s * (6 * s - 15) + 10), // 0..1 with zero speed and acceleration at both ends
  smootherSpeed = s => 30 * s * s * (1 - s) * (1 - s);
/* A dribble for a hand that works between `top` and top - 2 x reach (the moves in src/moves use other heights than the
   plays). Returns the solved timings and at(phase) -> {ball, hand, contact, progress}. */
export function makeDribble({ top = 1.0, reach = 0.11, at = 0.6, arrive = 0.6 } = {}) {
  const D = { top, reach, at, arrive, mid: top - reach },
    g = BALL.g,
    travel = 2 * reach;
  D.releaseY = top - travel * smoother(at);
  // the speed the ball must leave the hand with to bounce back up to the top arriving at `arrive`
  const upOff = Math.sqrt(arrive ** 2 + 2 * g * (top - BALL.floor)),
    hit = upOff / BALL.bounce;
  D.releaseV = Math.sqrt(hit * hit - 2 * g * (D.releaseY - BALL.floor));
  D.push = (travel * smootherSpeed(at)) / D.releaseV; // seconds for the whole down stroke
  D.release = at * D.push;
  D.period = D.release + (hit - D.releaseV) / g + (upOff - arrive) / g;
  /* Ball and hand heights at a point in the dribble (phase in bounces: 0..1 is one, starting with the hand at the top and
     the ball arriving in it; any number works). contact: the ball is in the hand; progress: 0..1 through that part. */
  D.at = phase => {
    const t = (phase - Math.floor(phase)) * D.period,
      hand =
        t < D.push
          ? top - travel * smoother(t / D.push) // the push down
          : top - travel + travel * smoother((t - D.push) / (D.period - D.push)); // the slow rise back to the top
    if (t < D.release) return { ball: hand, hand, contact: true, progress: t / D.release };
    const ball = fly({ x: 0, y: D.releaseY, z: 0 }, { x: 0, y: -D.releaseV, z: 0 }, t - D.release).y;
    return { ball, hand, contact: false, progress: (t - D.release) / (D.period - D.release) };
  };
  return D;
}
/* The game's dribble: the hand between 1.0 and 0.78, about 1.9 bounces a second. */
export const DRIBBLE = makeDribble();
export const dribbleAt = phase => DRIBBLE.at(phase);
/* How far the drawn 24 cm ball sits below its play position near the floor (the plays place the classic 0.28 ball, so its
   floor contact is at 0.3; the real ball touches at 0.13). Nothing in the hand: zero above about knee height. */
export const ballDrop = y => (0.28 - 0.13) * Math.max(0, Math.min(1, 1 - (y - 0.28) / 0.45));
/* A shot's timeline as fractions of the clip. The ball rises `rise` above the rim (higher arcs for jump shots, almost none
   for a dunk), so its flight time follows from gravity; the release comes that long before the ball reaches the rim, at the
   top of the jump, and the run, the gather and the jump are placed around it. */
export function shotTiming(kind) {
  const fam = family(kind),
    spec = SHOTS[kind] || SHOTS.pullup,
    jumper = JUMPERS.has(fam),
    // how high he rises: a jump shooter about 18 in, a layup a little more, a dunk a lot
    jump = fam === 'dunk' ? 1.2 : fam === 'drive' || fam === 'roll' ? 0.65 : jumper ? 0.55 : 0.6,
    y0 = (jumper ? SHOT.release[1] : BALL.hand) + jump,
    apex = Math.max(y0, BALL.rim) + spec.arc * 0.45,
    flight = Math.sqrt((2 * (apex - y0)) / BALL.g) + Math.sqrt((2 * (apex - BALL.rim)) / BALL.g),
    release = BALL.arrive - flight / CLIP_SECONDS,
    hang = (2 * Math.sqrt((2 * jump) / BALL.g)) / CLIP_SECONDS, // time in the air (clip fraction), real gravity
    takeoff = release - hang / 2; // the release comes at the top of the jump
  return {
    flight,
    release,
    jump,
    jumper,
    y0,
    hang,
    gather: release - 0.18,
    takeoff,
    land: takeoff + hang,
    // a jump shooter is set (feet down) before he rises; a driver is still moving when he takes off
    arrive: jumper ? release - 0.12 : takeoff + 0.02,
  };
}
/* ---- The jump shot's form (the same as the title screen's step-back jumper, src/moves/jumper.js) ----
   Ball and hands in the shooter's own frame (+x his left, +z the way he faces, y up from the floor; his jump is added):
   the ball comes into the shooting pocket in front of his chest, rises to the release above his forehead with the
   shooting hand behind and under it and the guide hand on its side; after the release the shooting arm stays long, up and
   out at the rim with the wrist snapped down, and comes down with him; the guide hand drifts up with the shot and falls
   away; then his elbows go back down and the arms are his own again. */
export const JUMPERS = new Set(['catch', 'pullup', 'stepback']);
export const SHOT = {
  pocket: [0, 1.18, 0.36],
  release: [0, 2.22, 0.24],
  nPocket: { R: [-0.55, -0.45, -0.55], L: [0.9, 0, -0.2] },
  nRelease: { R: [0.02, -0.5, -0.85], L: [0.9, -0.35, 0] },
  follow: [-0.2, 2.16, 0.46], // the shooting wrist after the release (he is in the air)
  followDown: [-0.2, 1.88, 0.5], // still long as he lands
  guideUp: [0.16, 2.22, 0.32],
  guideOut: [0.34, 1.78, 0.5],
  guideDown: [0.34, 1.46, 0.46],
  pole: [-0.4, -0.8, 0.2], // the shooting elbow: down and out, the arm long
};
const PALM_OFF = 0.2; // wrist to ball centre with the hand on the ball
const turnY = (p, yaw) => [
  p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw),
  p[1],
  -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw),
];
const unit = v => {
  const l = Math.hypot(...v) || 1;
  return v.map(x => x / l);
};
const mixV = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
/* The jump shooter's hands (world) at clip fraction t, or null outside the shot: hands on the ball from the gather to the
   release, the follow-through after it, fading back to his own arms after the landing. at = {x, z, yaw, y (his jump)}. */
function shotHands(t, T, at, ballW) {
  if (t < T.gather || t > T.land + 0.14) return null;
  const W = p => {
      const r = turnY(p, at.yaw);
      return [at.x + r[0], r[1] + at.y, at.z + r[2]];
    },
    D = n => unit(turnY(n, at.yaw)),
    sm = x => ((x = clamp(x)), x * x * (3 - 2 * x)),
    out = {};
  if (t < T.release) {
    const k = sm((t - (T.release - 0.07)) / 0.07); // the hands roll into the shooting grip as it rises
    for (const h of ['R', 'L']) {
      const n = D(mixV(SHOT.nPocket[h], SHOT.nRelease[h], k));
      out[h] = {
        p: ballW.map((v, i) => v + n[i] * PALM_OFF),
        flex: h === 'R' ? -0.8 : 0,
        pron: h === 'R' ? 0.5 : 0,
        pole: h === 'R' ? D(SHOT.pole) : null,
        w: sm((t - T.gather) / 0.05),
      };
    }
    return out;
  }
  const sec = (t - T.release) * CLIP_SECONDS,
    landS = (T.land - T.release) * CLIP_SECONDS,
    fade = 1 - sm((t - T.land - 0.06) / 0.08), // back to his own arms after the landing
    relHand = h => {
      const n = D(SHOT.nRelease[h]),
        b = W(SHOT.release);
      return b.map((v, i) => v + n[i] * PALM_OFF);
    };
  const r =
    sec < 0.12
      ? mixV(relHand('R'), W(SHOT.follow), sm(sec / 0.12))
      : mixV(W(SHOT.follow), W(SHOT.followDown), sm((sec - landS) / 0.25));
  const l =
    sec < 0.07
      ? mixV(relHand('L'), W(SHOT.guideUp), sm(sec / 0.07))
      : sec < 0.3
        ? mixV(W(SHOT.guideUp), W(SHOT.guideOut), sm((sec - 0.07) / 0.23))
        : mixV(W(SHOT.guideOut), W(SHOT.guideDown), sm((sec - landS) / 0.25));
  out.R = { p: r, flex: 1.0, pron: 0.5, pole: D(SHOT.pole), w: fade };
  out.L = { p: l, flex: 0, pron: 0, pole: null, w: fade };
  return out;
}
/* A shot's flight as a function of time (seconds into the play), worked out once per play: the same parabola sampleClip
   follows (from the play's release point to the rim), held at the release point before it. The Arena's ball trail uses it
   instead of sampling the whole play several times a frame. */
const FLIGHTS = new WeakMap();
export function flightPath(clip) {
  let f = FLIGHTS.get(clip);
  if (f) return f;
  const T = shotTiming(clip.kind),
    side = clip.team === 'home' ? 1 : -1,
    release = sampleClip(clip, T.release * CLIP_SECONDS + 1e-9).ball,
    v = launch(release, { x: 12.15 * side, y: BALL.rim, z: 0 }, T.flight);
  f = time => {
    const t = Math.max(0, Math.min(1, time / CLIP_SECONDS));
    return t < T.release
      ? { ...release }
      : fly(release, v, (Math.min(t, BALL.arrive) - T.release) * CLIP_SECONDS);
  };
  FLIGHTS.set(clip, f);
  return f;
}
/* When a block meets the ball (clip fraction): just out of the shooter's hand. */
export const blockHit = kind => shotTiming(kind).release + 0.015;
/* ---- Spacing (game units; 1 ft = 0.33) ---- */
/* A defender's spot for a man at {x,z}: `gap` units from him toward the rim. Without a gap: a third of the way to the rim,
   at least 4 ft and at most 8 ft off him, the way an off-ball defender sits between his man and the basket. */
export function guardSpot(man, side, gap = null) {
  const dx = 12.15 * side - man.x,
    dz = -man.z,
    d = Math.hypot(dx, dz) || 1,
    // near the rim the gap shrinks with the room left, but never to nothing: the defender stays on the rim side of his man
    g = Math.min(Math.max(0.3, d - 0.4), gap ?? Math.max(1.3, Math.min(2.6, d * 0.33)));
  return { x: man.x + (dx / d) * g, z: man.z + (dz / d) * g };
}
/* Version 2 off-ball movement (MOTION_VERSION). Each player holds his spot in an athletic stance and moves with a purpose at
   a moment of the play: ease-in-out moves with holds between them, never a sway. t = clip fraction, T = shotTiming. */
function offBallV2(A, offense, side, lane, t, fam, T) {
  const path = (keys, u) => {
      if (u <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++)
        if (u <= keys[i][0]) {
          const [u0, a] = keys[i - 1],
            [u1, b] = keys[i],
            k = smooth((u - u0) / (u1 - u0));
          return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
        }
      return keys[keys.length - 1][1];
    },
    put = (k, p, mirror = false) => {
      A[offense + k].x = p[0] * side;
      A[offense + k].z = p[1] * (mirror ? lane : 1);
    },
    rel = T.release,
    usesScreen = fam === 'roll' || fam === 'dunk' || fam === 'catch';
  // the cutter: holds, a hard basket cut off a plant, curls to the dunker spot and waits there
  put(
    2,
    path(
      [
        [0.1, [4, -5]],
        [0.22, [4.6, -4.4]],
        [0.42, [9.4, -1.2]],
        [0.6, [10.3, 2.6]],
      ],
      t,
    ),
    true,
  );
  // the wing fills the corner as the drive comes (spacing), then crashes the weak-side board after the shot
  put(
    3,
    path(
      [
        [0.24, [9, -4.4]],
        [0.48, [10.9, -6.1]],
        [rel + 0.03, [10.9, -6.1]],
        [rel + 0.22, [10.2, -3.2]],
      ],
      t,
    ),
  );
  // the slot: a jab in, a pop back out wider to give the ball handler an outlet, then to the free-throw line on the shot
  put(
    4,
    path(
      [
        [0.12, [6, 0]],
        [0.21, [7.1, 0.5]],
        [0.38, [5.1, 1.4]],
        [rel + 0.03, [5.1, 1.4]],
        [rel + 0.2, [7.6, 0.6]],
      ],
      t,
    ),
  );
  // the safety (when the play does not use him): a step along the arc, then back toward half court as the shot goes up
  if (!usesScreen)
    put(
      1,
      path(
        [
          [0.3, [3, -5.5]],
          [0.46, [3.9, -6.2]],
          [rel, [3.9, -6.2]],
          [rel + 0.25, [1.2, -4.8]],
        ],
        t,
      ),
    );
}

/* ---- Motion version 3: the team around the ball (src/choreo.js) ----
   The plan's inputs for a play, once per clip object (sampleAuthored runs every frame). */
const CTXS = new WeakMap();
function choreoCtx(c) {
  let ctx = CTXS.get(c);
  if (!ctx) {
    const key = playKey(c),
      run = shooterRun(c),
      T = shotTiming(c.kind);
    ctx = {
      key,
      seed: seedOf(key + '|choreo'),
      fam: family(c.kind),
      T,
      rel: T.release,
      at: u => run.at(u * CLIP_SECONDS),
      lane: c.lane || 1,
      side: c.team === 'home' ? 1 : -1,
      offense: c.team === 'home' ? 0 : 5,
      defense: c.team === 'home' ? 5 : 0,
      outcome: c.outcome,
      points: c.points,
      afterSteal: !!c.afterSteal,
      S: CLIP_SECONDS,
    };
    CTXS.set(c, ctx);
  }
  return ctx;
}
/* A version-3 play's team plan (src/choreo.js): each off-ball player's action and waypoints, the screens, the help, the
   box-outs. For the motion pictures and checks. */
export const choreoOf = c => choreoPlan(choreoCtx(c));
/* Version 3, the shooter's man: beside a finisher at the rim instead of between him and it (from under the rim he would
   be pushed through the backboard), and on a ball screen over it (on the handler's hip, a step behind) or under it (the
   rim side, giving room). */
function markerV3(marker, shooter, side, c, t, separation) {
  const ctx = choreoCtx(c),
    plan = choreoPlan(ctx),
    sx = shooter.x * side,
    sz = shooter.z,
    rx = 12.15 - sx,
    rz = -sz,
    d = Math.hypot(rx, rz) || 1;
  let mx = marker.x * side,
    mz = marker.z;
  const sc = plan.screen;
  if (sc && t > sc.u0 - 0.06 && t < sc.u1 + 0.16) {
    const w = smooth((t - sc.u0 + 0.06) / 0.06) * (1 - smooth((t - sc.u1 - 0.06) / 0.1));
    if (sc.cover === 'under') {
      const g = guardSpot(shooter, side, separation + 1.4);
      mx += (g.x * side - mx) * w;
      mz += (g.z - mz) * w;
    } else {
      // over the top: on his screen-side hip, chasing him through the gap (caught on the screen if it is tight)
      const a = ctx.at(Math.max(0, t - 0.02)),
        vx = sx - a[0],
        vz = sz - a[1],
        vl = Math.hypot(vx, vz) || 1,
        ux = vx / vl,
        uz = vz / vl,
        k = (sc.p[0] - sx) * -uz + (sc.p[1] - sz) * ux > 0 ? 1 : -1; // the screen's side of his run
      mx += (sx - ux * 0.45 - uz * 0.9 * k - mx) * w;
      mz += (sz - uz * 0.45 + ux * 0.9 * k - mz) * w;
    }
  }
  // a drive beats him: from the first step he is on the driver's hip (beside him, half a step behind, on the floor's
  // side), not in front of him; on a fast break he chases from behind
  const fam = ctx.fam;
  if (fam === 'drive' || fam === 'floater' || fam === 'roll' || fam === 'dunk') {
    const a = ctx.at(Math.max(0, t - 0.02)),
      vx = sx - a[0],
      vz = sz - a[1],
      vl = Math.hypot(vx, vz);
    if (vl > 1e-4) {
      const ux = vx / vl,
        uz = vz / vl;
      let px = -uz,
        pz = ux;
      if (px > 0 || (px === 0 && pz * sz > 0)) ((px = -px), (pz = -pz));
      const brk = fam === 'dunk',
        hx = sx + px * (brk ? 0.6 : 0.85) - ux * (brk ? 1.3 : 0.35),
        hz = sz + pz * (brk ? 0.6 : 0.85) - uz * (brk ? 1.3 : 0.35),
        wh = smooth((t - (brk ? 0.05 : 0.22)) / 0.14);
      mx += (hx - mx) * wh;
      mz += (hz - mz) * wh;
    }
  }
  // near the rim: beside him, on the floor's side (toward half court), not under the board (a fast break's chaser stays
  // a stride behind: at a sprint, sent beside the dunker he would run on under the rim)
  const w = fam === 'dunk' ? 0 : smooth((2.6 - d) / 1.1);
  if (w > 0) {
    let px = -rz / d,
      pz = rx / d;
    if (px > 0) ((px = -px), (pz = -pz));
    mx += (sx + px * 0.95 - mx) * w;
    mz += (sz + pz * 0.95 - mz) * w;
  }
  marker.x = Math.min(11.6, mx) * side;
  marker.z = mz;
}

/* A spot under or behind a backboard, moved out in front of it (version 3: where a body can stand). Court frame. */
function frontOfBoard(p, side) {
  const x = p.x * side,
    az = Math.abs(p.z);
  if (x < 11.4 || az > 4.2) return p;
  const z = (p.z < 0 ? -1 : 1) * Math.max(az, 2.4);
  return { ...p, x: Math.min(x, 11.4 - Math.max(0, 2.4 - az) * 0.3) * side, z };
}
/* ---- A block, worked out once per play (sampleClip uses it at every moment) ----
   Everything about a block that does not depend on the moment: where the ball meets the blocker's hand, how hard and where
   it is swatted, which two players go for the loose ball and where they meet it (from where the same play unblocked has
   everyone at the contact), and the putback when the shooting team keeps it. release = the play's release point (for a
   jump shooter it follows his feet until he is set, so it is part of the key). Cached: a play is sampled every frame. */
const PLANS = new Map(),
  UNBLOCKED = new Map(),
  clipKey = c =>
    [
      c.kind,
      c.team,
      c.lane,
      c.contest,
      c.outcome,
      c.recovery,
      c.putback,
      c.afterSteal ? 1 : 0,
      c.points,
      c.v ?? 0,
    ].join('|');
const remember = (cache, key, value) => {
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
};
export function blockPlan(c, release) {
  const key = `${clipKey(c)}|${release.x}|${release.y}|${release.z}`,
    hit = PLANS.get(key);
  if (hit) return hit;
  const S = CLIP_SECONDS,
    side = c.team === 'home' ? 1 : -1,
    lane = c.lane || 1,
    T = shotTiming(c.kind),
    rel = T.release,
    HIT = blockHit(c.kind),
    offense = c.team === 'home' ? 0 : 5,
    defense = c.team === 'home' ? 5 : 0,
    rim = { x: 12.15 * side, y: BALL.rim, z: 0 },
    shot = launch(release, rim, T.flight),
    contact = fly(release, shot, (Math.min(HIT, BALL.arrive) - rel) * S),
    rimX = 12.15 * side,
    flat = (x, z) => {
      const l = Math.hypot(x, z) || 1;
      return { x: x / l, z: z / l };
    },
    toRim = flat(rimX - contact.x, -contact.z),
    // higher than he needs: his fingers (2.4 standing) get above the ball and come down through it
    H = clamp(contact.y - 2.4 + 0.15, 0.55, 1.05),
    spot = { x: contact.x + toRim.x * 0.22, z: contact.z + toRim.z * 0.22 },
    hang = Math.sqrt((2 * H) / BALL.g) / S;
  // the swat: to the side (the near sideline of the play), a little back toward the shooter, and down
  const sideZ = lane >= 0 ? 1 : -1;
  let perp = { x: -toRim.z, z: toRim.x };
  if (perp.z * sideZ < 0) perp = { x: -perp.x, z: -perp.z };
  const dir = flat(perp.x * 0.85 - toRim.x * 0.45, perp.z * 0.85 - toRim.z * 0.45),
    kept = c.recovery === 'offense',
    // the time it may take to come up with it: time to spare for the putback (or to turn up the floor) after
    endTau = (0.995 - HIT) * S,
    want = clamp(endTau - (kept ? 0.62 : 0.2), 0.3, 0.62),
    chest = 1.15,
    tauFor = vy => {
      const down = (vy + Math.sqrt(vy * vy + 2 * BALL.g * (contact.y - BALL.floor))) / BALL.g,
        up = (BALL.g * down - vy) * BALL.bounce;
      return down + (up - Math.sqrt(Math.max(0, up * up - 2 * BALL.g * (chest - BALL.floor)))) / BALL.g;
    };
  // a harder swat down reaches the floor sooner: find the one that comes up into his hands when it should
  let lo = -14,
    hi = -1.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (tauFor(mid) > want) hi = mid;
    else lo = mid;
  }
  const vy = (lo + hi) / 2,
    catchTau = tauFor(vy),
    // as hard as 4.8 units/s across, but it is won inbounds (inside the sidelines and the baseline)
    room = Math.min(
      dir.z ? (7.3 - Math.sign(dir.z) * contact.z) / Math.abs(dir.z) : Infinity,
      dir.x ? (13.2 - Math.sign(dir.x) * contact.x) / Math.abs(dir.x) : Infinity,
    ),
    speed = clamp(Math.min(4.8, room / catchTau), 1.2, 4.8),
    CATCH = HIT + catchTau / S;
  let v = { x: dir.x * speed, y: vy, z: dir.z * speed },
    at = fly(contact, v, catchTau);
  // the scramble: each team's nearest player goes for it, from where he is at the block (the same play unblocked moves
  // everyone else the same way)
  const ukey = clipKey(c),
    there =
      UNBLOCKED.get(ukey) ??
      remember(
        UNBLOCKED,
        ukey,
        // the play's own spots (version 3's team movement is presentation on top: the block's plan stays the play's)
        sampleAuthored(
          {
            ...c,
            outcome: 'made',
            points: 2,
            recovery: undefined,
            putback: undefined,
            v: Math.min(c.v ?? 1, 2),
          },
          HIT * S,
        ).actors,
      ),
    nearest = list =>
      list.map(o => ({ ...o, d: Math.hypot(o.p.x - at.x, o.p.z - at.z) })).sort((a, b) => a.d - b.d)[0],
    offP = nearest([1, 2, 3, 4].map(k => ({ i: offense + k, p: there[offense + k] }))),
    defP = nearest([1, 2, 3, 4].map(k => ({ i: defense + k, p: there[defense + k] }))),
    win0 = kept ? offP : defP;
  // a real sprint (6.5 units/s) must get the winner there: if he could not, the swat goes more his way
  {
    const reach = 6.5 * catchTau,
      far = Math.hypot(win0.p.x - at.x, win0.p.z - at.z);
    if (far > reach) {
      const k = (far - reach * 0.9) / far, // how far along from the ball's spot toward him it must come down
        tx = at.x + (win0.p.x - at.x) * k,
        tz = at.z + (win0.p.z - at.z) * k;
      v = { x: (tx - contact.x) / catchTau, y: vy, z: (tz - contact.z) / catchTau };
      at = fly(contact, v, catchTau);
    }
  }
  const win = win0,
    lose = kept ? defP : offP,
    meet = { x: at.x + dir.x * 0.3, z: at.z + dir.z * 0.3 },
    fromL = flat(lose.p.x - at.x, lose.p.z - at.z),
    beaten = { x: at.x + fromL.x * 0.8, z: at.z + fromL.z * 0.8 };
  // the putback: he rises straight away and lays it up at the rim
  let putback = null;
  if (kept) {
    const rimP = { x: rimX, y: BALL.rim, z: 0 },
      spare = (0.997 - CATCH) * S,
      GO = CATCH + Math.min(0.22, spare * 0.3) / S, // gathers it up into his shooting hands
      lift = 0.45,
      from = { x: at.x, y: 2.35 + lift, z: at.z },
      ARR = Math.min(0.997, GO + Math.max(0.42, Math.hypot(rimP.x - at.x, rimP.z) / 7.5) / S);
    putback = { GO, ARR, from, v: launch(from, rimP, (ARR - GO) * S), rimP, lift };
  }
  // the blocker's hand: on top of the ball on his side at the contact, cocked above it before, through after
  const n = unit([toRim.x * 0.72, 0.7, toRim.z * 0.72]), // from the ball to his palm: on top, on his side
    onBall = [contact.x + n[0] * PALM_OFF, contact.y + n[1] * PALM_OFF, contact.z + n[2] * PALM_OFF],
    hand = {
      h: lane > 0 ? 'R' : 'L',
      onBall,
      cocked: [onBall[0] + toRim.x * 0.3, onBall[1] + 0.25, onBall[2] + toRim.z * 0.3],
      through: unit([v.x, v.y, v.z]),
    };
  return remember(PLANS, key, {
    HIT,
    contact,
    rimX,
    toRim,
    H,
    spot,
    hang,
    dir,
    kept,
    CATCH,
    v,
    at,
    win: { i: win.i, p: win.p },
    lose: { i: lose.i, p: lose.p },
    meet,
    beaten,
    putback,
    hand,
  });
}
// Sample any point in a recorded clip. Same clip + time always gives the same pose.
// Coordinates are mirrored for the visitors, so both baskets are used.
// Contract (the gym, the drills, the golden test in tests/golden.test.js and saved replays depend on it): pure and
// deterministic (no clock, no Math.random, the clip is not changed); returns {actors, ball, phase, bounce, blockHands,
// shotHands, resolved, flying, net, ...} where actors is always 10 entries (0-4 home, 5-9 away; the offence's
// ball handler at its first slot) of {x, y, z, yaw, run, arms}. A clip with no motion version (c.v) moves exactly as it
// did when it was recorded; new behaviour goes behind a new MOTION_VERSION.
/* The shooter's run (in the home team's frame: x toward the rim at 12.15, z across): its waypoints and where it ends. */
function shooterRoute(c) {
  const fam = family(c.kind),
    lane = c.lane || 1,
    spec = SHOTS[c.kind] || SHOTS.pullup,
    end = [spec.finish[0], spec.finish[1] * lane],
    start = [fam === 'dunk' ? -1.5 : 2.2, 4.7 * lane]; // the fast break starts at half court: the transition run brings him there
  const route =
    fam === 'stepback'
      ? [start, [6, 2.5 * lane], [7, 2 * lane], end]
      : fam === 'hook'
        ? [[8, 3 * lane], [9.8, 2.8 * lane], [10.5, 1.5 * lane], end]
        : fam === 'catch'
          ? [[4, 6.5 * lane], [2, 6 * lane], end]
          : fam === 'dunk'
            ? [start, [1, 2.5 * lane], [6, 1.4 * lane], end]
            : [start, [5, 4.6 * lane], [6.6, 1.5 * lane], [8.2, 3 * lane], end];
  return { route, end };
}
/* A play at a moment (seconds into it). Motion versions 1 and 2 are the authored play itself (sampleAuthored); from version 3
   the players move physically (src/playsim.js), worked out once per play. Same play + time always gives the same pose. */
export function sampleClip(c, time) {
  const p = sampleAuthored(c, time);
  return (c.v ?? 1) >= 3 ? physical(c, time, p) : p;
}
function sampleAuthored(c, time) {
  const fam = family(c.kind),
    t = clamp(time / CLIP_SECONDS),
    side = c.team === 'home' ? 1 : -1,
    lane = c.lane || 1;
  const { route, end } = shooterRoute(c);
  // the shot's timeline (shotTiming): rel = release at the top of the jump; d shifts the old fixed beats (release at 0.61)
  const T = shotTiming(c.kind),
    rel = T.release,
    d = rel - 0.61;
  // the jump: a real one under gravity, at its top as he lets the ball go
  const hop = u => {
    if (u < T.takeoff || u > T.land) return 0;
    const tau = (u - T.release) * CLIP_SECONDS;
    return Math.max(0, T.jump - 0.5 * BALL.g * tau * tau);
  };
  const m0 = clamp(t / T.arrive),
    movement = 0.35 * m0 + 0.65 * smooth(m0),
    // an even run with a gentle start and finish (peak speed 1.3x the average); version 3: his run at a body's pace
    // (shooterRun), so everything placed from him (his defender, the dribble, the gather, a steal) follows where he is
    at = (c.v ?? 1) >= 3 ? shooterRun(c).at(time) : path(smoothRoute(route), movement),
    gather = clamp((t - T.gather) / 0.14),
    jump = hop(t);
  const offense = c.team === 'home' ? 0 : 5,
    defense = c.team === 'home' ? 5 : 0;
  // The offense spreads round the arc (spots in units from half court, the rim at x 12.15) and drifts as the play develops.
  const SPOTS = [
    [2, 4.7],
    [3, -5.5],
    [8, 5.7],
    [9, -4.4],
    [6, 0],
  ];
  const v2 = (c.v ?? 1) >= 2;
  const actors = Array.from({ length: 10 }, (_, i) => {
    const k = i % 5,
      off = i >= offense && i < offense + 5,
      base = SPOTS[k];
    return {
      x: (base[0] + (off && !v2 ? Math.sin(t * 3 + k) * 0.7 : 0)) * side,
      y: 0,
      z: base[1],
      yaw: (side * Math.PI) / 2,
      run: off ? 0.35 : 0.25,
      arms: off ? 'run' : 'defend',
      jump: 0,
    };
  });
  // Motion version 2: the off-ball offense moves with purpose (offBallV2), before the defenders take their spots on them
  if (v2) offBallV2(actors, offense, side, lane, t, fam, T);
  // Defenders start on their man's guard spot (guardSpot): between him and the basket.
  for (let k = 0; k < 5; k++) Object.assign(actors[defense + k], guardSpot(actors[offense + k], side));
  // Motion version 3: the team around the ball (src/choreo.js) replaces the off-ball spots and the defenders' base spots
  const v3 = (c.v ?? 1) >= 3;
  if (v3) {
    const ctx = choreoCtx(c),
      lane0 = c.lane || 1,
      ballNow =
        fam === 'catch' && !c.afterSteal && t < 0.3
          ? [lerp(3, at[0], smooth(t / 0.3)), lerp(-5.5, at[1], smooth(t / 0.3))]
          : fam === 'dunk' && !c.afterSteal && t < 0.2
            ? [lerp(-4.5, at[0], smooth(t / 0.2)), lerp(3 * lane0, at[1], smooth(t / 0.2))]
            : at;
    choreograph(actors, choreoPlan(ctx), ctx, t, ballNow);
  }
  // Every value below is continuous in t: actors and ball ease between beats instead of snapping.
  const shooter = actors[offense],
    marker = actors[defense];
  Object.assign(shooter, {
    x: at[0] * side,
    y: jump,
    z: at[1],
    run: 1 - smooth((t - T.arrive + 0.08) / 0.08),
    arms: t < T.gather ? 'dribble' : t < rel + 0.19 ? (fam === 'hook' ? 'hook' : 'shoot') : 'relax',
    yaw: Math.atan2((12.15 - at[0]) * side, -at[1]),
  });
  // the on-ball defender: between the shooter and the rim, 3 ft off on a tight contest, 4.5 ft normally, 7.5 ft when open
  const separation = c.contest === 'open' ? 2.5 : c.contest === 'tight' ? 1 : 1.5;
  // version 2, the catch-and-shoot: he sags into help while the ball is elsewhere, then closes out as it swings to his
  // man (fast, then short chopping steps)
  const closeout = v2 && fam === 'catch' ? 1 - Math.pow(1 - clamp((t - 0.1) / 0.24), 2.4) : 1;
  Object.assign(marker, guardSpot(shooter, side, separation + (3.1 - separation) * (1 - closeout)));
  if (v3) markerV3(marker, shooter, side, c, t, separation);
  marker.run = 0.85 - 0.75 * smooth((t - 0.45 - d) / 0.08);
  // the contest: a real jump under gravity, at its top just as the ball leaves the shooter's hand (a block is timed to
  // the ball itself, below)
  const HIT = blockHit(c.kind), // when a block meets the ball: just out of the shooter's hand
    leap = (u, H, peakU) => {
      const tau = (u - peakU) * CLIP_SECONDS;
      return Math.max(0, H - 0.5 * BALL.g * tau * tau);
    };
  const defenseJump = c.outcome === 'block' ? 0 : leap(t, c.contest === 'open' ? 0.22 : 0.62, HIT);
  marker.y = defenseJump;
  marker.arms = t > 0.48 + d && t < 0.82 + d ? 'block' : 'defend';
  if (!v3 && (fam === 'drive' || fam === 'floater' || fam === 'roll')) {
    marker.z += Math.sin(t * 12) * 0.35; // slides with the driver's moves
    marker.x += Math.sin(t * Math.PI) * side * 0.3; // and gives ground toward the basket
  }
  // A second defender slides from the weak side to help at the basket.
  const help = actors[defense + 2];
  if (!v3) {
    help.x = lerp(9, 11, t) * side;
    help.z = lerp(-4 * lane, -0.9 * lane, smooth(t / 0.6));
  }
  help.arms = t > 0.48 + d && t < 0.8 + d ? 'block' : 'defend';
  help.y = defenseJump * 0.6;
  const screen = actors[offense + 1];
  if (fam === 'roll' && !v3) {
    // set beside the handler's path (about 3.5 ft off it), so he runs off the screener's shoulder instead of through him
    screen.x = 4.8 * side;
    screen.z = 2.5 * lane;
    screen.run = 0;
    screen.arms = 'screen';
  }
  // The dunk outlet comes from deep in the backcourt; the passer then trails the play up the floor.
  if (fam === 'dunk') {
    const q = smooth((t - 0.12) / 0.5);
    screen.x = lerp(-4.5 * side, screen.x, q);
    screen.z = lerp(3 * lane, screen.z, q);
    screen.run = 0.35 + 0.65 * Math.sin(q * Math.PI);
    if (t < 0.2 && !c.afterSteal) screen.arms = 'pass';
  }
  // Off-ball cuts and closeouts: players do not just oscillate in place.
  if (!v2) {
    actors[offense + 2].x = lerp(4, 10, smooth(t)) * side;
    actors[offense + 2].z = lerp(-5, 3, smooth(t)) * lane;
  }
  // the cutter's man trails him; the weak-side defender sags into the lane, then closes out to his man
  if (!v3)
    Object.assign(actors[defense + 3], {
      x: lerp(10.2 * side, actors[defense + 3].x, smooth(t)),
      z: lerp(-1.8 * lane, actors[defense + 3].z, smooth(t)),
    });
  const mix = (a, b, w) => ({ x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: lerp(a.z, b.z, w) });
  const bounce = (t * CLIP_SECONDS) / DRIBBLE.period; // the dribble's clock, in bounces
  let ball = { x: shooter.x + 0.38 * side, y: dribbleAt(bounce).ball, z: shooter.z + 0.15 };
  // c.afterSteal: the shooter stole the ball on the play before, so he already has it (no pass in to him)
  if (fam === 'catch' && !c.afterSteal) {
    const q = smooth(t / 0.3);
    ball = mix(
      { x: lerp(3, at[0], q) * side, y: 1.4 + Math.sin(q * Math.PI) * 0.35, z: lerp(-5.5, at[1], q) },
      ball,
      smooth((t - 0.25) / 0.1),
    );
    if (t < 0.3) screen.arms = 'pass';
  }
  if (fam === 'dunk' && !c.afterSteal) {
    // the outlet: thrown from the passer's hands (he starts deep in the backcourt) up to the man running the break
    const q = smooth(t / 0.2);
    ball = mix(
      { x: lerp(-4.5, at[0], q) * side, y: 1.6 + Math.sin(q * Math.PI) * 0.7, z: lerp(3 * lane, at[1], q) },
      ball,
      smooth((t - 0.17) / 0.08),
    );
  }
  const pickup = dribbleAt((T.gather * CLIP_SECONDS) / DRIBBLE.period).ball;
  // the shooter's frame, for the jump shot's form (shotHands): where he stands, which way he faces, how high he is
  const me = { x: shooter.x, z: shooter.z, yaw: shooter.yaw, y: jump },
    inFrame = p => {
      const r = turnY(p, me.yaw);
      return { x: me.x + r[0], y: r[1] + me.y, z: me.z + r[2] };
    };
  if (t >= T.gather && t < rel) {
    if (T.jumper) {
      // off the dribble into the pocket in front of his chest, then up to the release above his forehead as he rises
      const pocket = inFrame(SHOT.pocket),
        up = inFrame(SHOT.release),
        k = smooth((t - (rel - 0.07)) / 0.07),
        g = smooth(gather),
        from = { x: shooter.x + 0.38 * side, y: pickup + jump, z: shooter.z + 0.15 };
      ball = mix(mix(from, pocket, g), up, k);
    } else
      ball = {
        x: shooter.x + lerp(0.38, 0.28, gather) * side,
        y: lerp(pickup, BALL.hand, gather) + jump,
        z: shooter.z + lerp(0.15, 0, gather),
      };
  }
  // In flight the ball follows a true parabola under gravity from the release to the rim (constant speed across the floor).
  const sec = CLIP_SECONDS,
    release = T.jumper
      ? (() => {
          const r = turnY(SHOT.release, me.yaw);
          return { x: me.x + r[0], y: r[1] + hop(rel), z: me.z + r[2] };
        })()
      : { x: (end[0] + 0.28) * side, y: BALL.hand + hop(rel), z: end[1] },
    rim = { x: 12.15 * side, y: BALL.rim, z: 0 },
    shot = launch(release, rim, T.flight),
    flight = u => fly(release, shot, (Math.min(u, BALL.arrive) - rel) * sec);
  if (t >= rel) ball = flight(t);
  // A make slows in the net, drops and bounces; a miss caroms off the rim towards the rebound.
  const land =
    c.outcome === 'block'
      ? { x: 7 * side, y: 1.3, z: -3 * lane }
      : { x: 9 * side, y: BALL.rim - 1.8, z: -2 * lane };
  if (t > BALL.arrive) {
    const tau = (t - BALL.arrive) * sec,
      NET = 0.12; // seconds in the net, at 3 units/s
    if (c.points)
      ball =
        tau < NET
          ? { x: rim.x, y: BALL.rim - 3 * tau, z: 0 }
          : fly(
              { x: rim.x, y: BALL.rim - 3 * NET, z: 0 },
              { x: -1.2 * side, y: -3, z: 0.5 * lane },
              tau - NET,
            );
    else ball = fly(rim, launch(rim, land, (1 - BALL.arrive) * sec), tau);
  }
  // A block (c.recovery / c.putback from the engine): the blocker explodes up and swings his hand through the ball just
  // out of the shooter's hand; it is knocked hard to the side, bounces loose, and the nearest player from each team goes
  // for it. The side the engine chose comes up with it: the defense turns up the floor; the shooting team goes straight
  // back up (the putback), in time for the ball to land before the play ends.
  let blockHands = null,
    blockEnd = null;
  if (c.outcome === 'block') {
    const S = CLIP_SECONDS,
      { contact, rimX, toRim, H, spot, hang, dir, kept, CATCH, v, at, win, lose, putback, hand } = blockPlan(
        c,
        release,
      ),
      plan0 = blockPlan(c, release),
      w = smooth((t - (HIT - hang - 0.1)) / 0.08); // in place before he takes off
    marker.x = lerp(marker.x, spot.x, w);
    marker.z = lerp(marker.z, spot.z, w);
    marker.y = leap(t, H, HIT);
    const chest = 1.15,
      W = actors[win.i],
      Lp = actors[lose.i],
      wm = smooth((t - HIT + 0.01) / (CATCH - HIT + 0.01));
    // version 3: the loose ball is met in front of the backboard (bodies cannot stand under or behind it)
    // and a body's width off the shooter (held to his landing until he is down)
    const clear = p => {
        const dx = p.x - shooter.x,
          dz = p.z - shooter.z,
          dl = Math.hypot(dx, dz);
        return dl >= 1.15 || dl < 1e-6
          ? p
          : { ...p, x: shooter.x + (dx / dl) * 1.15, z: shooter.z + (dz / dl) * 1.15 };
      },
      meet = v3 ? clear(frontOfBoard(plan0.meet, side)) : plan0.meet,
      beaten = v3 ? clear(frontOfBoard(plan0.beaten, side)) : plan0.beaten,
      // where he holds it: the swat's landing; version 3, at his own meeting spot (a step on from it toward the landing)
      hold = (() => {
        if (!v3 || (meet.x === plan0.meet.x && meet.z === plan0.meet.z)) return at;
        const dx = at.x - meet.x,
          dz = at.z - meet.z,
          dl = Math.hypot(dx, dz) || 1,
          k = Math.min(1, 0.3 / dl);
        return { x: meet.x + dx * k, z: meet.z + dz * k };
      })();
    W.x = lerp(W.x, meet.x, wm);
    W.z = lerp(W.z, meet.z, wm);
    W.run = Math.max(W.run, Math.sin(wm * Math.PI) * 0.95);
    W.yaw = Math.atan2(at.x - meet.x, at.z - meet.z);
    Lp.x = lerp(Lp.x, beaten.x, wm);
    Lp.z = lerp(Lp.z, beaten.z, wm);
    Lp.run = Math.max(Lp.run, Math.sin(wm * Math.PI) * 0.95);
    Lp.yaw = Math.atan2(at.x - beaten.x, at.z - beaten.z);
    if (t > CATCH - 0.04) {
      W.arms = 'rebound';
      Lp.arms = 'rebound';
    }
    // the putback: he rises straight away and lays it up at the rim; made goes through the net, missed comes off the iron
    if (kept) {
      blockEnd = putback.ARR;
      if (t > CATCH) {
        W.yaw = Math.atan2(rimX - W.x, -W.z);
        W.arms = t < putback.ARR ? 'shoot' : 'relax';
        W.y = leap(t, putback.lift, putback.GO);
      }
    } else if (t > CATCH + 0.03) W.yaw = Math.atan2(-side, 0); // the defense has it: he turns up the floor
    if (t > HIT) {
      if (t < CATCH) ball = fly(contact, v, (t - HIT) * S);
      else if (!putback) ball = { x: hold.x, y: chest, z: hold.z };
      else if (t < putback.GO) {
        const k = smooth((t - CATCH) / (putback.GO - CATCH));
        ball = { x: hold.x, y: lerp(chest, putback.from.y, k), z: hold.z };
      } else if (t < putback.ARR) ball = fly(putback.from, putback.v, (t - putback.GO) * S);
      else {
        const tau = (t - putback.ARR) * S;
        ball =
          c.putback === 'made'
            ? { x: rimX, y: Math.max(BALL.floor, BALL.rim - 3 * tau), z: 0 } // through the net
            : fly(putback.rimP, { x: -toRim.x * 2.2, y: 2.4, z: -toRim.z * 2.2 }, tau); // off the iron
      }
    }
    // the blocker's hand: cocked high on his side of the ball, a fast swing down through it at the contact, and on
    // through after the ball; his own arm again once he comes down
    {
      const since = (t - HIT) * S;
      if (t > HIT - 0.12 && since < 0.45) {
        const swing = smooth((t - (HIT - 0.03)) / 0.03),
          p =
            t <= HIT
              ? mixV(hand.cocked, hand.onBall, swing)
              : hand.onBall.map(
                  (x, i) => x + hand.through[i] * 0.6 * Math.sin((Math.min(1, since / 0.12) * Math.PI) / 2),
                ),
          wgt = smooth((t - (HIT - 0.12)) / 0.04) * (1 - smooth((since - 0.3) / 0.15));
        blockHands = { [hand.h]: { p, flex: t > HIT ? 1.0 : -0.4, pron: 1.1, pole: null, w: wgt } };
      }
    }
  }
  if (c.outcome === 'steal') {
    const q = clamp((t - 0.32) / 0.68),
      w = smooth((t - 0.27) / 0.09);
    marker.x = lerp(marker.x, lerp(at[0] + 0.4, -3, q) * side, w);
    marker.z = lerp(marker.z, lerp(at[1], -2 * lane, q), w);
    marker.y = lerp(marker.y, 0, w);
    marker.run = lerp(marker.run, 1, w);
    if (t > 0.3) {
      marker.arms = 'dribble';
      shooter.y = 0;
      shooter.arms = 'defend';
    }
    ball = mix(ball, { x: marker.x - 0.35 * side, y: dribbleAt(bounce).ball, z: marker.z }, w);
  }
  // The rebounder reads the shot and arrives where the ball comes down rather than appearing there.
  const rebounder = actors[defense + (c.team === 'home' ? 4 : 0)];
  if (!c.points && c.outcome !== 'steal' && c.outcome !== 'block') {
    const w = smooth((t - 0.64) / 0.22);
    rebounder.x = lerp(rebounder.x, land.x, w);
    rebounder.z = lerp(rebounder.z, land.z, w);
    rebounder.run = Math.max(rebounder.run, Math.sin(w * Math.PI) * 0.9);
    if (t > 0.84) rebounder.arms = 'rebound';
  }
  // Defenders face their man (or the ball once the shot is up). Personal space is kept frame by frame by the Arena
  // (motion.js keepApart), which remembers which side players pass each other on.
  // version 2: the off-ball offense watches the ball (the Arena turns them to run when they move)
  if (v2)
    for (let k = 1; k < 5; k++) {
      const a = actors[offense + k];
      if (a.arms === 'run' && Math.hypot(ball.x - a.x, ball.z - a.z) > 0.05)
        a.yaw = Math.atan2(ball.x - a.x, ball.z - a.z);
    }
  for (let k = 0; k < 5; k++) {
    const dfd = actors[defense + k];
    if (dfd === marker && c.outcome === 'steal' && t > 0.3) continue; // he is dribbling the other way
    const look = t >= rel && dfd !== marker ? ball : actors[offense + k];
    if (Math.hypot(look.x - dfd.x, look.z - dfd.z) > 0.05)
      dfd.yaw = Math.atan2(look.x - dfd.x, look.z - dfd.z);
  }
  return {
    actors,
    ball,
    phase:
      t < T.gather
        ? fam === 'catch'
          ? 'Pass & relocate'
          : 'Attack & dribble'
        : t < rel
          ? 'Gather & contest'
          : t < BALL.arrive
            ? c.outcome === 'block'
              ? 'Shot blocked'
              : c.outcome === 'steal'
                ? 'Turnover'
                : 'Shot in flight'
            : blockEnd && t < blockEnd
              ? 'Putback'
              : c.points
                ? 'Basket'
                : 'Rebound',
    bounce, // the dribble's clock (dribbleAt), for the dribbling hand
    // the blocker's hand (world) on a block, for his arm (as shotHands), or null
    blockHands,
    // the jump shooter's hands (world), for his arms (motion.js plays them like a move's), or null
    shotHands:
      T.jumper && c.outcome !== 'steal'
        ? shotHands(t, T, me, ball && t < rel ? [ball.x, ball.y, ball.z] : null)
        : null,
    resolved: t >= (blockEnd ?? BALL.arrive), // a putback after a block resolves when it lands
    flying: c.outcome !== 'steal' && t >= rel && (c.outcome === 'block' ? t < HIT : t < BALL.arrive),
    net: c.points && t > BALL.arrive ? Math.sin(((t - BALL.arrive) * Math.PI) / 0.14) * 0.12 : 0,
  };
}

/* ---- Motion version 3: the players move physically (src/playsim.js) ----
   Worked out once per play (cached: the last plays by their key, and per clip object), then read at any moment. */
const MOTIONS = new Map(),
  BY_CLIP = new WeakMap();
/* Where the play's ball leaves the shooter's hands (the release point sampleAuthored computes), for the block's plan. */
export function releaseOf(c) {
  const T = shotTiming(c.kind),
    side = c.team === 'home' ? 1 : -1,
    { end } = shooterRoute(c),
    yaw = Math.atan2((12.15 - end[0]) * side, -end[1]);
  if (T.jumper) {
    const r = turnY(SHOT.release, yaw);
    return { x: end[0] * side + r[0], y: r[1] + T.jump, z: end[1] + r[2] };
  }
  return { x: (end[0] + 0.28) * side, y: BALL.hand + T.jump, z: end[1] };
}
/* The shooter's run in version 3 (cached per play): his authored waypoints, rounded, at a body's acceleration, braking and
   grip (playsim.js runProfile), reaching the release spot exactly when the play says he gets there. A waypoint within 0.7
   of the spot is a back-step too small to see and too sharp to run: dropped. If the route cannot be run in the time the
   play gives (the pull-up's reversal into his spot at the authored pace asks two or three times the braking a player has),
   the sharpest waypoint between the start and the spot goes, then the next, until it can. at(time) -> [x, z] in the home
   team's frame (as `at` in sampleAuthored); shooterAt(time) -> [x, z] on the court. */
const RUNS = new Map();
function shooterRun(c) {
  const key = playKey(c);
  let r = RUNS.get(key);
  if (r) return r;
  const S = CLIP_SECONDS,
    T = shotTiming(c.kind),
    fam = family(c.kind),
    side = c.team === 'home' ? 1 : -1,
    off = c.team === 'home' ? 0 : 5,
    body = playersOf(c, off)[off],
    { route: authored } = shooterRoute(c),
    e = authored[authored.length - 1];
  let route = authored.filter(
      (p, i) => i === 0 || i === authored.length - 1 || Math.hypot(p[0] - e[0], p[1] - e[1]) >= 0.7,
    ),
    dense,
    run;
  for (;;) {
    dense = roundCorners(smoothRoute(route, 12), 3);
    // a fast break starts at speed (the run up the floor before the play): 70% of his top speed
    run = runProfile(dense, T.arrive * S, body, { v0: fam === 'dunk' ? 0.7 * body.top : 0 });
    if (runProfile.stretch <= 1.0001 || route.length <= 2) break;
    let worst = 1,
      sharp = -1;
    for (let i = 1; i < route.length - 1; i++) {
      const a = route[i - 1],
        b = route[i],
        d = route[i + 1],
        turn = Math.abs(
          Math.atan2(
            (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]),
            (b[0] - a[0]) * (d[0] - b[0]) + (b[1] - a[1]) * (d[1] - b[1]),
          ),
        );
      if (turn > sharp) {
        sharp = turn;
        worst = i;
      }
    }
    // first pulled halfway to the line through its neighbours (a milder weave), and dropped if that is not enough
    const a = route[worst - 1],
      d = route[worst + 1],
      mid = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2],
      p = route[worst],
      // a reversal (turning back by more than 120 degrees) is not a weave: it goes
      flat = sharp > 2.1 || Math.hypot(p[0] - mid[0], p[1] - mid[1]) < 0.15;
    route = flat
      ? route.filter((_, i) => i !== worst)
      : route.map((q, i) => (i === worst ? [(q[0] + mid[0]) / 2, (q[1] + mid[1]) / 2] : q));
  }
  // his run as a 120 Hz table (looked up every frame and by every player dodging him: walking the route each time cost
  // tens of milliseconds a play)
  const HZ = 120,
    n = Math.ceil(T.arrive * S * HZ) + 1,
    tab = new Float64Array(n * 2);
  for (let k = 0; k < n; k++) {
    const p = along(dense, run(Math.min(k / HZ, T.arrive * S)));
    tab[k * 2] = p[0];
    tab[k * 2 + 1] = p[1];
  }
  const at = time => {
    const x = Math.min(n - 1, Math.max(0, time * HZ)),
      k = Math.min(n - 2, Math.floor(x)),
      u = x - k;
    if (n < 2) return [tab[0], tab[1]];
    return [
      tab[k * 2] + (tab[k * 2 + 2] - tab[k * 2]) * u,
      tab[k * 2 + 1] + (tab[k * 2 + 3] - tab[k * 2 + 1]) * u,
    ];
  };
  r = {
    at,
    shooterAt: time => {
      const p = at(time);
      return [p[0] * side, p[1]];
    },
  };
  if (RUNS.size > 48) RUNS.delete(RUNS.keys().next().value);
  RUNS.set(key, r);
  return r;
}
export function motionOf(c) {
  const hit = BY_CLIP.get(c);
  if (hit) return hit;
  const key = playKey(c);
  let m = MOTIONS.get(key);
  if (!m) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0,
      S = CLIP_SECONDS,
      T = shotTiming(c.kind),
      fam = family(c.kind),
      side = c.team === 'home' ? 1 : -1,
      off = c.team === 'home' ? 0 : 5,
      def = 5 - off,
      players = playersOf(c, off),
      { shooterAt } = shooterRun(c),
      anchors = Array.from({ length: 10 }, () => []),
      sec = u => u * S;
    // the moments the play needs a player at its spot (seconds): the contest, the block, the loose ball, the rebound, the
    // steal, the pass
    let loose = null;
    if (c.outcome === 'block') {
      const plan = blockPlan(c, releaseOf(c));
      loose = [plan.win.i, plan.lose.i];
      anchors[def].push([sec(T.takeoff - 0.06), sec(blockHit(c.kind) + 0.06)]);
      // the two going for the loose ball: there by the catch (the play gives them a third of a second from the swat; a body
      // needs longer, so they read it and go early), then held
      anchors[plan.win.i].push([sec(plan.CATCH), S]);
      anchors[plan.lose.i].push([sec(plan.CATCH), S]);
    } else if (c.outcome !== 'steal' && c.contest !== 'open')
      anchors[def].push([sec(T.release - 0.08), sec(T.release + 0.06)]);
    if (c.outcome === 'steal') anchors[def].push([sec(0.26), sec(0.38)]);
    if (!c.points && c.outcome !== 'steal' && c.outcome !== 'block')
      anchors[def + (c.team === 'home' ? 4 : 0)].push([sec(0.86), S]);
    if (!c.afterSteal && fam === 'catch') anchors[off + 1].push([0, sec(0.27)]);
    if (!c.afterSteal && fam === 'dunk') anchors[off + 1].push([0, sec(0.18)]);
    // how close two may come (game units): 0.95 (motion.js SPACE.min); the shooter and his man 0.85 (a contest), 0.5
    // while a block is in the air, 0.55 for a steal's reach; a screener and the man he screens 0.6
    // the team's contacts (src/choreo.js): a pin-down screen, box-outs on the shot (offense, defense, from, to, gap)
    const team = choreoPlan(choreoCtx(c)).contacts.map(([a, b, u0, u1, g]) => [
      off + a,
      def + b,
      sec(u0),
      sec(u1),
      g,
    ]);
    const blockFrom = sec(T.takeoff - 0.08),
      gapOf = (i, j, t) => {
        const onBall = (i === off && j === def) || (i === def && j === off);
        if (onBall) {
          // eased in and out over 0.3 s: a gap that snaps back with two players inside it is a shove
          const ramp = (a, b) => smooth((t - a) / 0.3) * (1 - smooth((t - b) / 0.3));
          if (c.outcome === 'block') return 0.85 - 0.35 * smooth((t - blockFrom + 0.3) / 0.3);
          if (c.outcome === 'steal') return 0.85 - 0.3 * ramp(sec(0.2) - 0.3, sec(0.45));
          return 0.85;
        }
        if (fam === 'roll' && ((i === off + 1 && j === def) || (i === def && j === off + 1))) return 0.6;
        for (const [a, b, t0, t1, g] of team)
          if ((i === a && j === b) || (i === b && j === a)) {
            const w = smooth((t - t0) / 0.3) * (1 - smooth((t - t1) / 0.3));
            if (w > 0) return GAP - (GAP - g) * w;
          }
        // the two going for a blocked shot's loose ball fight for it, shoulder to shoulder
        if (
          loose &&
          t > blockFrom &&
          ((i === loose[0] && j === loose[1]) || (i === loose[1] && j === loose[0]))
        )
          return 0.6;
        return GAP;
      };
    const sim = simulatePlay({
      duration: S,
      authored: t => sampleAuthored(c, t),
      shooter: off,
      shooterAt,
      // a steal: he stops running his play when the ball is taken and chases the man who took it
      ...(c.outcome === 'steal'
        ? { shooterUntil: sec(0.3), chase: { who: off, target: def, from: sec(0.3) } }
        : {}),
      // a block: once he lands he is a free player (often he goes after his own blocked shot)
      ...(c.outcome === 'block' ? { shooterUntil: sec(T.land) } : {}),
      offense: off,
      players,
      anchors,
      gapOf,
      // the ball screen (src/choreo.js): the screener holds his spot as the handler comes off it
      screens: (() => {
        const sc = choreoPlan(choreoCtx(c)).screen;
        return sc ? [[off + 1, sec(sc.u0 - 0.08), sec(sc.u1 + 0.02)]] : [];
      })(),
    });
    // the ball (src/ballsim.js), on the simulated players
    const fr = SIM_FPS,
      at = (arr, i, t) => {
        const x = Math.min(sim.frames - 1, Math.max(0, t * fr)),
          f = Math.min(sim.frames - 2, Math.floor(x)),
          u = x - f;
        return arr[f * 10 + i] + (arr[(f + 1) * 10 + i] - arr[f * 10 + i]) * u;
      },
      plan = c.outcome === 'block' ? blockPlan(c, releaseOf(c)) : null,
      pr = seedOf(playKey(c) + '|pass');
    const ball = simulateBall({
      duration: S,
      g: BALL.g,
      off,
      def,
      lane: c.lane || 1,
      pos: (i, t) => [at(sim.x, i, t), at(sim.z, i, t)],
      vel: (i, t) => [at(sim.vx, i, t), at(sim.vz, i, t)],
      yaw: (i, t) => sim.authoredAt.yaw(i, t),
      authoredBall: t => sim.authoredAt.ball(t),
      // exact, for the gather into the shot pocket (the 30 Hz table smooths over the release)
      exactBall: t => {
        const b = sampleAuthored(c, t).ball;
        return [b.x, b.y, b.z];
      },
      authoredPos: (i, t) => sim.authoredAt.pos(i, t),
      pass: c.afterSteal
        ? null
        : fam === 'catch'
          ? { from: off + 1, at: sec(0.3), kind: pr % 10 < 3 ? 'bounce' : 'chest' }
          : fam === 'dunk'
            ? { from: off + 1, at: sec(0.2), kind: 'overhead' }
            : null,
      gather: sec(T.gather),
      release: sec(T.release),
      arrive: sec(BALL.arrive),
      releasePoint: releaseOf(c),
      flightT: T.flight,
      rim: { x: 12.15 * side, y: BALL.rim, z: 0 },
      outcome: c.outcome,
      points: c.points,
      land: { x: 9 * side, y: BALL.rim - 1.8, z: -2 * (c.lane || 1) },
      rebounder: def + (c.team === 'home' ? 4 : 0),
      steal: c.outcome === 'steal' ? { poke: sec(0.3), secure: sec(0.37) } : null,
      block: plan
        ? {
            hit: sec(blockHit(c.kind)),
            catch: sec(plan.CATCH),
            win: plan.win.i,
            kept: !!plan.kept,
            go: plan.putback ? sec(plan.putback.GO) : 0,
            arr: plan.putback ? sec(plan.putback.ARR) : 0,
            made: c.putback === 'made',
          }
        : null,
      board: 12.15 + 1.25 * 0.328,
      boardHalf: 3 * 0.328,
      boardLo: BALL.rim - 0.328,
      boardHi: BALL.rim + 2.5 * 0.328,
      seed: seedOf(playKey(c) + '|ball'),
    });
    // the pairs that can ever come closer than SPACE.min (the rest never do: checked once here)
    const contactPairs = [];
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++) {
        let close = false;
        for (let t = 0; t <= S && !close; t += 0.1) close = gapOf(i, j, t) < GAP;
        if (close) contactPairs.push([i, j]);
      }
    m = {
      sim,
      ball,
      contactPairs,
      anchors,
      off,
      def,
      fam,
      T,
      gapOf,
      ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0,
    };
    if (MOTIONS.size > 48) MOTIONS.delete(MOTIONS.keys().next().value);
    MOTIONS.set(key, m);
  }
  BY_CLIP.set(c, m);
  return m;
}
/* The version-3 pose at `time`: the authored pose p with each player where his simulated body is (blended to the authored
   spot at the play's anchors, from the exact authored pose), his velocity and acceleration (vx, vz, ax, az: units per
   second, for the animation), and the ball moved with the player holding it. */
const DX = new Float64Array(10),
  DZ = new Float64Array(10); // scratch for physical() (every frame: no allocation)
function physical(c, time, p) {
  const m = motionOf(c),
    { sim, anchors, off, def, fam, T } = m,
    S = CLIP_SECONDS,
    x = Math.min(sim.frames - 1, Math.max(0, time * SIM_FPS)),
    f = Math.min(sim.frames - 2, Math.floor(x)),
    u = x - f,
    L = (arr, i) => arr[f * 10 + i] + (arr[(f + 1) * 10 + i] - arr[f * 10 + i]) * u,
    dx = DX,
    dz = DZ;
  for (let i = 0; i < 10; i++) {
    const a = p.actors[i],
      nx = L(sim.x, i),
      nz = L(sim.z, i);
    dx[i] = nx - a.x;
    dz[i] = nz - a.z;
    a.x = nx;
    a.z = nz;
    a.vx = L(sim.vx, i);
    a.vz = L(sim.vz, i);
    a.ax = L(sim.ax, i);
    a.az = L(sim.az, i);
    if (i !== off)
      a.run = Math.max(
        a.arms === 'run' || a.arms === 'defend' ? 0 : a.run,
        Math.min(1, Math.hypot(a.vx, a.vz) / 5.9),
      );
  }
  // the contacts the play allows now (closer than motion.js SPACE.min): [i, j, closest], from the few pairs that can be
  p.contacts = [];
  for (const [i, j] of m.contactPairs) {
    const g = m.gapOf(i, j, time);
    if (g < GAP) p.contacts.push([i, j, g]);
  }
  // the ball (src/ballsim.js): where it is, who has it, the hand on it, the dribbling hand's height
  const B = m.ball,
    bx = Math.min(B.frames - 1, Math.max(0, time * SIM_FPS)),
    bf = Math.min(B.frames - 2, Math.floor(bx)),
    bu = bx - bf,
    near = bu < 0.5 ? bf : bf + 1,
    LB = arr => arr[bf] + (arr[bf + 1] - arr[bf]) * bu;
  p.ball = { x: LB(B.x), y: LB(B.y), z: LB(B.z) };
  p.ballModel = 'physical';
  p.ballRadius = BALL_R;
  p.holder = B.holder[near];
  p.hand = B.held[near] ? [B.handX[near], B.handY[near], B.handZ[near]] : null;
  if (B.dribbling[near]) {
    const contact = !!B.held[near] && B.holder[near] >= 0;
    p.dribble = { ball: p.ball.y, hand: B.dribbleY[near], contact, progress: contact ? 0.5 : bu };
  } else p.dribble = null;
  // who each player watches (src/choreo.js `look`: a player, or 10 the ball), from where the bodies really are
  for (let i = 0; i < 10; i++) {
    const a = p.actors[i],
      k = a.look;
    if (k === undefined) continue;
    const tx = k === 10 ? p.ball.x : p.actors[k].x,
      tz = k === 10 ? p.ball.z : p.actors[k].z;
    if (Math.hypot(tx - a.x, tz - a.z) > 0.05) a.yaw = Math.atan2(tx - a.x, tz - a.z);
  }
  return p;
}
