// Shared by the motion QA (scripts/motion-qa.mjs) and the motion renderers (scripts/motion-render.mjs): the clip set,
// sampling a clip at 60 Hz, and the metrics, so both read the plays the same way.
//
// Units: game units (1 ft = 0.328, so 1 unit = 0.929 m; BALL in src/basketball.js). Speeds below are reported in m/s.
import fs from 'node:fs';
import * as B from '../src/basketball.js';
import { SPACE } from '../src/motion.js';

export const M = 0.929; // metres per game unit
export const FPS = 60;
export const FRAMES = Math.round(B.CLIP_SECONDS * FPS) + 1; // 265: 0 .. 4.4 s
export const KINDS = Object.keys(B.SHOTS);
export const FAMILIES = [...new Set(KINDS.map(B.family))];

/* A small seeded RNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OUTCOMES = [
  { outcome: 'made' },
  { outcome: 'miss' },
  { outcome: 'block', recovery: 'defense' },
  { outcome: 'block', recovery: 'offense', putback: 'made' },
  { outcome: 'block', recovery: 'offense', putback: 'miss' },
  { outcome: 'steal' },
];
/* A clip as the engine writes it (only the fields the 3D reads). */
export function clipOf(kind, o, contest, team, lane, extra = {}) {
  const spec = B.SHOTS[kind],
    points = o.outcome === 'made' ? (spec.three ? 3 : 2) : o.putback === 'made' ? 2 : 0;
  return {
    kind,
    team,
    lane,
    contest,
    points,
    ...o,
    three: !!spec.three,
    assisted: o.outcome === 'made' && ['catch', 'dunk'].includes(B.family(kind)),
    ...extra,
  };
}
/* The clip set: every shot kind x outcome x contest x team x lane (936), with a seeded quarter of them as the second
   play after a steal (afterSteal). Without a version field (v); the caller stamps one. engineClips() adds the plays of
   seeded engine games (the kinds and outcomes a season really gives). */
export function clipSet() {
  const r = rng(20261119),
    out = [];
  for (const kind of KINDS)
    for (const o of OUTCOMES)
      for (const contest of ['open', 'contested', 'tight'])
        for (const team of ['home', 'away'])
          for (const lane of [1, -1])
            out.push({
              id: `${kind}/${o.outcome}${o.recovery ? '-' + o.recovery : ''}${o.putback ? '-' + o.putback : ''}/${contest}/${team}/${lane}`,
              clip: clipOf(
                kind,
                o,
                contest,
                team,
                lane,
                r() < 0.25 && o.outcome !== 'steal' ? { afterSteal: true } : {},
              ),
            });
  return out;
}
/* The plays of four seeded engine seasons' first games, as the engine wrote them (without their version field). */
export async function engineClips(n = 120) {
  const E = await import('../src/engine.js'),
    root = new URL('..', import.meta.url).pathname,
    data = JSON.parse(fs.readFileSync(`${root}public/data/kangs.json`, 'utf8')),
    out = [];
  for (const seed of [3, 7, 11, 19]) {
    const s = E.createGame(data, 'QA', 'standard', seed);
    E.autoLineup(s);
    E.endBreak(s);
    E.startMatch(s);
    while (s.match) E.possession(s);
    for (const ev of s.results.at(-1).events)
      for (const [k, p] of (ev.plays || []).entries()) {
        const { v, ...clip } = p;
        out.push({ id: `engine/${seed}/${out.length}/${k}`, clip });
      }
  }
  return out.slice(0, n);
}

/* Samples a clip at 60 Hz: [{actors, ball, phase, resolved, flying, ...}] (the pose objects as sampleClip returns them). */
export function samples(clip, sample = B.sampleClip) {
  const out = new Array(FRAMES);
  for (let f = 0; f < FRAMES; f++) out[f] = sample(clip, f / FPS);
  return out;
}
/* A hash of everything a clip's samples hold, for bit-identical comparisons (FNV-1a over the JSON text). */
export function hashSamples(S) {
  let h = 2166136261 >>> 0;
  for (const p of S) {
    const s = JSON.stringify(p);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h.toString(16);
}

/* The moments a play promises (the hard anchors of docs/MOTION-BRIEF.md): the phase at every frame (as runs), when it
   resolves and when the ball flies, the shooter's spot at the release, the ball at the release, at the rim (0.86) and at
   the end of the clip (the landing spot / who has it), and the block's contact. */
export function anchors(clip, S) {
  const T = B.shotTiming(clip.kind),
    at = u => S[Math.min(FRAMES - 1, Math.round(u * (FRAMES - 1)))],
    off = clip.team === 'home' ? 0 : 5,
    runs = [];
  for (let f = 0; f < FRAMES; f++)
    if (!runs.length || runs.at(-1)[1] !== S[f].phase) runs.push([f, S[f].phase]);
  const first = key => {
    const f = S.findIndex(p => p[key]);
    return f;
  };
  const r = v => Math.round(v * 1000) / 1000,
    pt = p => [r(p.x), r(p.y), r(p.z)],
    rel = at(T.release),
    out = {
      phases: runs.map(([f, s]) => `${f}:${s}`).join('|'),
      resolvedAt: first('resolved'),
      flyingAt: first('flying'),
      shooterAtRelease: pt({ ...rel.actors[off], y: rel.actors[off].y }),
      ballAtRelease: pt(rel.ball),
      ballAtRim: pt(at(B.BALL.arrive).ball),
      ballAtEnd: pt(S[FRAMES - 1].ball),
    };
  // a block never reaches the rim: what it promises is the contact (and who ends with the ball, below)
  if (clip.outcome === 'block') {
    out.ballAtBlock = pt(at(B.blockHit(clip.kind)).ball);
    delete out.ballAtRim;
  }
  // the end of the play: a miss lands on its rebound spot (exact); after a made basket or putback the ball is free (it
  // drops through the net; nothing is promised about where it rolls); a block the defence wins ends in the winner's hands
  // (the player nearest the ball at the end, within reach, is on the defence)
  if (clip.points > 0 || (clip.outcome === 'block' && clip.putback)) delete out.ballAtEnd;
  if (clip.outcome === 'block' && !clip.putback) {
    const end = S[FRAMES - 1];
    let best = 9,
      who = -1;
    end.actors.forEach((a, i) => {
      const d = Math.hypot(end.ball.x - a.x, end.ball.z - a.z);
      if (d < best) [best, who] = [d, i];
    });
    delete out.ballAtEnd;
    out.defenceHasBall =
      best < 0.9 && (who < off || who >= off + 5) ? 'yes' : `no (${who}, ${best.toFixed(2)} away)`;
  }
  // a steal has no shot: what it promises is the ball taken when it is, and the stealer ending with it
  if (clip.outcome === 'steal') {
    const end = S[FRAMES - 1],
      d = Math.hypot(end.ball.x - end.actors[5 - off].x, end.ball.z - end.actors[5 - off].z);
    delete out.shooterAtRelease;
    delete out.ballAtRelease;
    delete out.ballAtRim;
    delete out.ballAtEnd;
    out.stealerHasBall = d < 0.9 ? 'yes' : `no (${d.toFixed(2)} away)`;
  }
  return out;
}
/* Compares anchors: phases, resolved and flying frames exactly; points within tol (game units). Returns the differences. */
export function anchorDiff(a, b, tol = 0.05) {
  const out = [];
  for (const k of ['phases', 'resolvedAt', 'flyingAt', 'stealerHasBall', 'defenceHasBall'])
    if (a[k] !== b[k]) out.push(`${k}: ${a[k]} vs ${b[k]}`);
  for (const k of Object.keys(a))
    if (Array.isArray(a[k]) && Array.isArray(b[k])) {
      const d = Math.hypot(...a[k].map((v, i) => v - b[k][i]));
      if (d > tol) out.push(`${k}: off by ${d.toFixed(3)}`);
    }
  return out;
}

/* Rim, backboard and floor (game units). The backboard's face is 15 in (1.25 ft) behind the rim's centre, 6 ft wide and
   3.5 ft tall, its bottom 1 ft below the rim. */
export const RIM = { x: 12.15, y: B.BALL.rim, r: 0.75 * 0.328 }, // 18 in across
  BOARD = { x: 12.15 + 1.25 * 0.328, half: 3 * 0.328, lo: B.BALL.rim - 0.328, hi: B.BALL.rim + 2.5 * 0.328 },
  BALL_R = 0.13; // the drawn ball (24 cm across)

/* Who holds the ball in a frame and where his hand is: the pose's own fields when it has them (motion version 3:
   holder, hand), otherwise the Arena's old guess (the nearest player within 0.85 of the ball, below 2.9) and a nominal
   hand (his side, a little ahead, at the ball's height). */
export function holderOf(p) {
  if (p.holder !== undefined) return p.holder >= 0 ? { i: p.holder, hand: p.hand } : null;
  const b = p.ball;
  if (!b || b.y > 2.9) return null;
  let best = 0.85,
    who = -1;
  p.actors.forEach((a, i) => {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < best) {
      best = d;
      who = i;
    }
  });
  if (who < 0) return null;
  const a = p.actors[who],
    c = Math.cos(a.yaw),
    s = Math.sin(a.yaw),
    // his right side, 0.3 out and 0.25 ahead, at the ball's height (his hand on top of it while dribbling)
    hx = a.x - 0.3 * c + 0.25 * s,
    hz = a.z + 0.3 * s + 0.25 * c;
  return { i: who, hand: [hx, b.y + 0.12, hz] };
}

/* Whether player i is in contact in frame f: within 8 cm of the closest another player may come (motion.js SPACE, or a
   contact the pose declares). */
function touchAt(S, clip, i, f, off, def) {
  const a = S[f].actors[i];
  for (let j = 0; j < 10; j++) {
    if (j === i) continue;
    const b = S[f].actors[j],
      d = Math.hypot(a.x - b.x, a.z - b.z),
      decl = S[f].contacts?.find(([p, q]) => (p === i && q === j) || (p === j && q === i)),
      onBall = (i === off && j === def) || (i === def && j === off),
      floor = decl ? decl[2] : onBall ? (clip.outcome === 'block' ? SPACE.block : SPACE.contest) : SPACE.min;
    if (d < floor + 0.08) return true;
  }
  return false;
}
/* The metrics of one clip's samples. Speeds and accelerations in metres and seconds. */
export function metrics(clip, S) {
  const dt = 1 / FPS,
    off = clip.team === 'home' ? 0 : 5,
    def = 5 - off,
    pl = [],
    out = {
      nan: 0,
      speed: 0,
      accel: 0,
      jerk: 0,
      accelP95: 0,
      jerkP95: 0,
      curvature: 0, // mean |turn rate| (rad/s) while moving above 1 m/s: higher is curvier, 0 is straight lines
      corners: 0, // share of frames above 3 m/s turning faster than 4 rad/s: a sharp corner taken at speed
      minSep: Infinity,
      minSepPair: null,
      overlapFrames: 0,
      ballSpeed: 0,
      ballJump: 0, // the largest ball move in one frame (game units): a teleport if large
      ballBelowFloor: 0,
      ballThroughBoard: 0,
      heldFrames: 0,
      handDist: 0, // the largest ball-to-hand distance while held (game units)
      handDistMean: 0,
      bounces: [],
    };
  const accs = [],
    jerks = [],
    accsContact = [],
    jerksContact = [];
  for (let i = 0; i < 10; i++) {
    const P = S.map(p => p.actors[i]);
    for (const a of P) if (![a.x, a.y, a.z, a.yaw].every(Number.isFinite)) out.nan++;
    const vx = [],
      vz = [];
    for (let f = 1; f < FRAMES; f++) {
      vx.push((P[f].x - P[f - 1].x) / dt);
      vz.push((P[f].z - P[f - 1].z) / dt);
    }
    let curv = 0,
      moving = 0,
      corners = 0;
    for (let f = 0; f < vx.length; f++) {
      const sp = Math.hypot(vx[f], vz[f]) * M;
      if (Math.hypot(P[f + 1].x - P[f].x, P[f + 1].z - P[f].z) > 1.2) continue; // a jump (transit), not a movement
      out.speed = Math.max(out.speed, sp);
      if (f > 0 && sp > 1 && Math.hypot(vx[f - 1], vz[f - 1]) * M > 1) {
        const a0 = Math.atan2(vz[f - 1], vx[f - 1]),
          a1 = Math.atan2(vz[f], vx[f]),
          d = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
        curv += d / dt;
        moving++;
        if (sp > 3 && d / dt > 4) corners++;
      }
    }
    if (moving) {
      out.curvature += curv / moving / 10;
      out.corners += corners / moving / 10;
    }
    const touchFrames = new Uint8Array(FRAMES);
    for (let g = 0; g < FRAMES; g++) touchFrames[g] = touchAt(S, clip, i, g, off, def) ? 1 : 0;
    const touchNear = f => {
      for (let g = Math.max(0, f - 9); g <= Math.min(FRAMES - 1, f + 9); g++) if (touchFrames[g]) return true;
      return false;
    };
    for (let f = 1; f < vx.length; f++) {
      const ax = (vx[f] - vx[f - 1]) / dt,
        az = (vz[f] - vz[f - 1]) / dt,
        a = Math.hypot(ax, az) * M,
        // in contact around this frame: within 8 cm of the closest another player may come (a bump is not his own
        // running: its acceleration is reported apart, as contact)
        // (within the 0.15 s either side over which the motion's last smoothing spreads a bump: src/playsim.js)
        touching = touchNear(f);
      (touching ? accsContact : accs).push(a);
      if (f > 1) {
        const ax0 = (vx[f - 1] - vx[f - 2]) / dt,
          az0 = (vz[f - 1] - vz[f - 2]) / dt;
        (touching ? jerksContact : jerks).push(Math.hypot(ax - ax0, az - az0) * (M / dt));
      }
    }
    pl.push(P);
  }
  const pct = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0;
  };
  out.accel = pct(accs, 0.999);
  out.jerk = pct(jerks, 0.999);
  out.accelContact = accsContact.length ? Math.max(...accsContact) : 0;
  out.jerkContact = jerksContact.length ? Math.max(...jerksContact) : 0;
  out.contactShare = accsContact.length / (accs.length + accsContact.length || 1);
  out.accelP95 = pct(accs, 0.95);
  out.jerkP95 = pct(jerks, 0.95);
  // separation: every pair, every frame; the on-ball pair (shooter and his defender) may come to SPACE.contest
  for (let f = 0; f < FRAMES; f++)
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++) {
        const d = Math.hypot(pl[i][f].x - pl[j][f].x, pl[i][f].z - pl[j][f].z),
          contact = S[f].contacts?.find(([a, b]) => (a === i && b === j) || (a === j && b === i)),
          onBall = (i === off && j === def) || (i === def && j === off),
          floor = contact
            ? contact[2]
            : onBall
              ? clip.outcome === 'block'
                ? SPACE.block
                : SPACE.contest
              : SPACE.min;
        if (d < out.minSep) {
          out.minSep = d;
          out.minSepPair = [i, j, f];
        }
        if (d < floor - 0.02) out.overlapFrames++;
      }
  // the ball
  let handSum = 0;
  for (let f = 0; f < FRAMES; f++) {
    const b = S[f].ball;
    if (![b.x, b.y, b.z].every(Number.isFinite)) out.nan++;
    if (b.y < (S[f].ballRadius ?? B.BALL.floor) - 0.005) out.ballBelowFloor++;
    if (Math.abs(b.x) > BOARD.x - BALL_R && Math.abs(b.z) < BOARD.half && b.y > BOARD.lo && b.y < BOARD.hi)
      out.ballThroughBoard++;
    if (f > 0) {
      const a = S[f - 1].ball,
        d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      out.ballJump = Math.max(out.ballJump, d);
      out.ballSpeed = Math.max(out.ballSpeed, (d / dt) * M);
    }
    const h = holderOf(S[f]);
    if (h?.hand) {
      const d = Math.hypot(b.x - h.hand[0], b.y - h.hand[1], b.z - h.hand[2]);
      out.heldFrames++;
      handSum += d;
      out.handDist = Math.max(out.handDist, d);
    }
  }
  out.handDistMean = out.heldFrames ? handSum / out.heldFrames : 0;
  // bounces: the ball reaching the floor and going back up; restitution = speed up / speed down (vertical)
  const floorY = S[0].ballRadius ?? B.BALL.floor;
  for (let f = 2; f < FRAMES - 2; f++) {
    const y0 = S[f - 1].ball.y,
      y1 = S[f].ball.y,
      y2 = S[f + 1].ball.y;
    if (y1 <= y0 && y1 < y2 && y1 < floorY + 0.06) {
      const down = (S[f - 2].ball.y - S[f - 1].ball.y) * FPS,
        up = (S[f + 2].ball.y - S[f + 1].ball.y) * FPS;
      const fell = Math.max(...S.slice(Math.max(0, f - 18), f).map(p => p.ball.y)) - floorY;
      if (down > 1.5 && up > 0.3 && fell > 0.25) out.bounces.push(up / down);
    }
  }
  return out;
}
