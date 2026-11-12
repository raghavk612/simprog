// Shared, deterministic basketball presentation. No rendering or wall-clock RNG here.
export const CLIP_SECONDS = 4.4; // one side's play; the run between plays happens before it (Arena.startTransit)
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
    parts = [f(at(T.lead[c.kind], cm[0])), f(at(T.block, cm[1])), f(tag(T.loose))];
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
export const DRIBBLE = { top: 1.0, reach: 0.11, at: 0.6, arrive: 0.6 };
const smoother = s => s * s * s * (s * (6 * s - 15) + 10), // 0..1 with zero speed and acceleration at both ends
  smootherSpeed = s => 30 * s * s * (1 - s) * (1 - s);
{
  const D = DRIBBLE,
    g = BALL.g,
    travel = 2 * D.reach;
  D.releaseY = D.top - travel * smoother(D.at);
  // the speed the ball must leave the hand with to bounce back up to the top arriving at `arrive`
  const upOff = Math.sqrt(D.arrive ** 2 + 2 * g * (D.top - BALL.floor)),
    hit = upOff / BALL.bounce;
  D.releaseV = Math.sqrt(hit * hit - 2 * g * (D.releaseY - BALL.floor));
  D.push = (travel * smootherSpeed(D.at)) / D.releaseV; // seconds for the whole down stroke
  D.release = D.at * D.push;
  D.period = D.release + (hit - D.releaseV) / g + (upOff - D.arrive) / g;
}
/* Ball and hand heights at a point in the dribble (phase in bounces: 0..1 is one, starting with the hand at the top and the
   ball arriving in it; any number works). contact: the ball is in the hand; progress: 0..1 through that part. */
export function dribbleAt(phase) {
  const D = DRIBBLE,
    t = (phase - Math.floor(phase)) * D.period,
    travel = 2 * D.reach,
    hand =
      t < D.push
        ? D.top - travel * smoother(t / D.push) // the push down
        : D.top - travel + travel * smoother((t - D.push) / (D.period - D.push)); // the slow rise back to the top
  if (t < D.release) return { ball: hand, hand, contact: true, progress: t / D.release };
  const ball = fly({ x: 0, y: D.releaseY, z: 0 }, { x: 0, y: -D.releaseV, z: 0 }, t - D.release).y;
  return { ball, hand, contact: false, progress: (t - D.release) / (D.period - D.release) };
}
/* A shot's timeline as fractions of the clip. The ball rises `rise` above the rim (higher arcs for jump shots, almost none
   for a dunk), so its flight time follows from gravity; the release comes that long before the ball reaches the rim, at the
   top of the jump, and the run, the gather and the jump are placed around it. */
export function shotTiming(kind) {
  const fam = family(kind),
    spec = SHOTS[kind] || SHOTS.pullup,
    jump = fam === 'dunk' ? 1.2 : fam === 'drive' || fam === 'roll' ? 0.65 : 0.8,
    y0 = BALL.hand + jump,
    apex = Math.max(y0, BALL.rim) + spec.arc * 0.45,
    flight = Math.sqrt((2 * (apex - y0)) / BALL.g) + Math.sqrt((2 * (apex - BALL.rim)) / BALL.g),
    release = BALL.arrive - flight / CLIP_SECONDS;
  return {
    flight,
    release,
    jump,
    y0,
    gather: release - 0.18,
    takeoff: release - 0.15,
    arrive: release - 0.13,
  };
}
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
// Sample any point in a recorded clip. Same clip + time always gives the same pose.
// Coordinates are mirrored for the visitors, so both baskets are used.
export function sampleClip(c, time) {
  const fam = family(c.kind),
    t = clamp(time / CLIP_SECONDS),
    side = c.team === 'home' ? 1 : -1,
    lane = c.lane || 1,
    spec = SHOTS[c.kind] || SHOTS.pullup;
  const end = [spec.finish[0], spec.finish[1] * lane],
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
  // the shot's timeline (shotTiming): rel = release at the top of the jump; d shifts the old fixed beats (release at 0.61)
  const T = shotTiming(c.kind),
    rel = T.release,
    d = rel - 0.61;
  const hop = u =>
    u >= T.takeoff && u <= T.takeoff + 0.3 ? Math.sin(((u - T.takeoff) / 0.3) * Math.PI) * T.jump : 0;
  const m0 = clamp(t / T.arrive),
    movement = 0.35 * m0 + 0.65 * smooth(m0),
    at = path(smoothRoute(route), movement), // an even run with a gentle start and finish (peak speed 1.3x the average)
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
  const actors = Array.from({ length: 10 }, (_, i) => {
    const k = i % 5,
      off = i >= offense && i < offense + 5,
      base = SPOTS[k];
    return {
      x: (base[0] + (off ? Math.sin(t * 3 + k) * 0.7 : 0)) * side,
      y: 0,
      z: base[1],
      yaw: (side * Math.PI) / 2,
      run: off ? 0.35 : 0.25,
      arms: off ? 'run' : 'defend',
      jump: 0,
    };
  });
  // Defenders start on their man's guard spot (guardSpot): between him and the basket.
  for (let k = 0; k < 5; k++) Object.assign(actors[defense + k], guardSpot(actors[offense + k], side));
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
  Object.assign(marker, guardSpot(shooter, side, separation));
  marker.run = 0.85 - 0.75 * smooth((t - 0.45 - d) / 0.08);
  const defenseJump =
    t >= 0.5 + d && t <= 0.81 + d
      ? Math.sin(((t - 0.5 - d) / 0.31) * Math.PI) *
        (c.outcome === 'block' ? 1.05 : c.contest === 'open' ? 0.22 : 0.7)
      : 0;
  marker.y = defenseJump;
  marker.arms = t > 0.48 + d && t < 0.82 + d ? 'block' : 'defend';
  if (fam === 'drive' || fam === 'floater' || fam === 'roll') {
    marker.z += Math.sin(t * 12) * 0.35; // slides with the driver's moves
    marker.x += Math.sin(t * Math.PI) * side * 0.3; // and gives ground toward the basket
  }
  // A second defender slides from the weak side to help at the basket.
  const help = actors[defense + 2];
  help.x = lerp(9, 11, t) * side;
  help.z = lerp(-4 * lane, -0.9 * lane, smooth(t / 0.6));
  help.arms = t > 0.48 + d && t < 0.8 + d ? 'block' : 'defend';
  help.y = defenseJump * 0.6;
  const screen = actors[offense + 1];
  if (fam === 'roll') {
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
    if (t < 0.2) screen.arms = 'pass';
  }
  // Off-ball cuts and closeouts: players do not just oscillate in place.
  actors[offense + 2].x = lerp(4, 10, smooth(t)) * side;
  actors[offense + 2].z = lerp(-5, 3, smooth(t)) * lane;
  // the cutter's man trails him; the weak-side defender sags into the lane, then closes out to his man
  Object.assign(actors[defense + 3], {
    x: lerp(10.2 * side, actors[defense + 3].x, smooth(t)),
    z: lerp(-1.8 * lane, actors[defense + 3].z, smooth(t)),
  });
  const mix = (a, b, w) => ({ x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: lerp(a.z, b.z, w) });
  const bounce = (t * CLIP_SECONDS) / DRIBBLE.period; // the dribble's clock, in bounces
  let ball = { x: shooter.x + 0.38 * side, y: dribbleAt(bounce).ball, z: shooter.z + 0.15 };
  if (fam === 'catch') {
    const q = smooth(t / 0.3);
    ball = mix(
      { x: lerp(3, at[0], q) * side, y: 1.4 + Math.sin(q * Math.PI) * 0.35, z: lerp(-5.5, at[1], q) },
      ball,
      smooth((t - 0.25) / 0.1),
    );
    if (t < 0.3) screen.arms = 'pass';
  }
  if (fam === 'dunk') {
    const q = smooth(t / 0.2);
    ball = mix(
      { x: lerp(-10, at[0], q) * side, y: 1.6 + Math.sin(q * Math.PI) * 0.7, z: lerp(3 * lane, at[1], q) },
      ball,
      smooth((t - 0.17) / 0.08),
    );
  }
  const pickup = dribbleAt((T.gather * CLIP_SECONDS) / DRIBBLE.period).ball;
  if (t >= T.gather && t < rel) {
    ball = {
      x: shooter.x + lerp(0.38, 0.28, gather) * side,
      y: lerp(pickup, BALL.hand, gather) + jump,
      z: shooter.z + lerp(0.15, 0, gather),
    };
  }
  // In flight the ball follows a true parabola under gravity from the release to the rim (constant speed across the floor).
  const sec = CLIP_SECONDS,
    release = { x: (end[0] + 0.28) * side, y: BALL.hand + hop(rel), z: end[1] },
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
  if (c.outcome === 'block') {
    const w = smooth((t - 0.52 - d) / 0.13),
      hit = rel + 0.04; // the block meets the ball just after the release and swats it down and away
    const up = guardSpot(shooter, side, 0.85); // right up on the shooter to reach the ball
    marker.x = lerp(marker.x, up.x, w);
    marker.z = lerp(marker.z, up.z, w);
    if (t > hit) {
      const from = flight(hit),
        span = (1 - hit) * sec;
      ball = fly(from, { x: (land.x - from.x) / span, y: -2, z: (land.z - from.z) / span }, (t - hit) * sec);
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
  if (!c.points && c.outcome !== 'steal') {
    const w = smooth((t - 0.64) / 0.22);
    rebounder.x = lerp(rebounder.x, land.x, w);
    rebounder.z = lerp(rebounder.z, land.z, w);
    rebounder.run = Math.max(rebounder.run, Math.sin(w * Math.PI) * 0.9);
    if (t > 0.84) rebounder.arms = 'rebound';
  }
  // Defenders face their man (or the ball once the shot is up). Personal space is kept frame by frame by the Arena
  // (motion.js keepApart), which remembers which side players pass each other on.
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
            : c.points
              ? 'Basket'
              : 'Rebound',
    bounce, // the dribble's clock (dribbleAt), for the dribbling hand
    resolved: t >= BALL.arrive,
    flying: c.outcome !== 'steal' && t >= rel && (c.outcome === 'block' ? t < rel + 0.04 : t < BALL.arrive),
    net: c.points && t > BALL.arrive ? Math.sin(((t - BALL.arrive) * Math.PI) / 0.14) * 0.12 : 0,
  };
}
