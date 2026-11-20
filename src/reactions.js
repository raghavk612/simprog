// Reactions after a play is decided (presentation only): short, tasteful, and carried into the run back to the other end.
//   fist   a quick fist pump (a basket, a stop)
//   three  the shooting arm raised high and held (a three)
//   flex   both fists up, elbows out, looking up (a dunk)
//   clap   a teammate claps twice (an assisted basket)
//   hips   hands on hips, eyes down (scored on, or blocked)
//   shake  a shake of the head, hands on hips (a miss)
// A reaction is a performance for animateAthlete (hands in world space, a look target), worked out each frame from where
// the player is now, so it plays over his jog (the legs keep their gait). reactionsFor() picks who reacts to a play.
import { SHOTS, isDunk } from './basketball.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  sm = x => ((x = clamp(x)), x * x * (3 - 2 * x));
export const REACTIONS = { fist: 0.9, three: 1.3, flex: 1.2, clap: 1.1, hips: 1.5, shake: 1.2 }; // seconds

/* Who reacts to a resolved play, as [{role, kind}] with role 'shooter' | 'helper' | 'marker' | 'winner' (the putback's).
   Pure, so it is tested without the gym. */
export function reactionsFor(clip) {
  const made = clip.points > 0,
    out = [];
  if (clip.outcome === 'block') {
    if (clip.putback === 'made') out.push({ role: 'winner', kind: 'fist' }, { role: 'marker', kind: 'hips' });
    else out.push({ role: 'marker', kind: 'fist' }, { role: 'shooter', kind: 'hips' });
  } else if (clip.outcome === 'steal') out.push({ role: 'shooter', kind: 'hips' });
  else if (made) {
    out.push({
      role: 'shooter',
      kind: SHOTS[clip.kind]?.three ? 'three' : isDunk(clip.kind) ? 'flex' : 'fist',
    });
    if (clip.assisted) out.push({ role: 'helper', kind: 'clap' });
    out.push({ role: 'marker', kind: 'hips' });
  } else out.push({ role: 'shooter', kind: 'shake' });
  return out;
}

/* One reaction at `since` seconds, for a player at me = {x, z, yaw, y}: {hands, body, look, weight} or null when over. */
export function reactionFrame(kind, since, me) {
  const dur = REACTIONS[kind];
  if (!dur || since < 0 || since > dur) return null;
  const c = Math.cos(me.yaw),
    s = Math.sin(me.yaw),
    W = p => [me.x + p[0] * c + p[2] * s, (me.y || 0) + p[1], me.z - p[0] * s + p[2] * c],
    D = p => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c],
    weight = sm(since / 0.15) * (1 - sm((since - (dur - 0.3)) / 0.3)),
    hand = (p, pole, flex = 0, pron = 0.3, grip = 0.35) => ({
      p: W(p),
      pole: pole ? D(pole) : null,
      flex,
      pron,
      grip,
      w: weight,
    }),
    hips = {
      R: hand([-0.27, 1.0, 0.0], [-1, 0, -0.2], -0.6, 1.2, 0.55),
      L: hand([0.27, 1.0, 0.0], [1, 0, -0.2], -0.6, 1.2, 0.55),
    };
  let hands = {},
    body = {},
    look = null;
  if (kind === 'fist') {
    // two quick pumps of the right fist, elbow bent
    const pump = Math.abs(Math.sin(clamp(since / 0.55) * Math.PI * 2));
    hands = { R: hand([-0.24, 1.22 + 0.5 * pump, 0.28], [-0.6, -0.8, 0.1], 0.6, 0.3, 1) };
    body = { lean: 0.06 * pump };
  } else if (kind === 'three') {
    hands = { R: hand([-0.14, 2.45, 0.12], [-0.8, 0, -0.3], -0.2, 0.3, 0.9) };
    look = W([0, 3.2, 3]);
  } else if (kind === 'flex') {
    hands = {
      R: hand([-0.42, 1.58, 0.06], [-0.4, -1, 0], 0.8, 0.3, 1),
      L: hand([0.42, 1.58, 0.06], [0.4, -1, 0], 0.8, 0.3, 1),
    };
    body = { lean: -0.1 * sm(since / 0.3) };
    look = W([0, 3.4, 2]);
  } else if (kind === 'clap') {
    const k = 0.5 + 0.5 * Math.cos(clamp((since - 0.15) / 0.7) * Math.PI * 4); // twice
    hands = {
      R: hand([-0.04 - 0.16 * k, 1.32, 0.34], [-1, -0.4, -0.3], 0, 1.4, 0.05),
      L: hand([0.04 + 0.16 * k, 1.32, 0.34], [1, -0.4, -0.3], 0, 1.4, 0.05),
    };
  } else if (kind === 'hips' || kind === 'shake') {
    hands = hips;
    const turn = kind === 'shake' ? Math.sin(clamp((since - 0.15) / 0.8) * Math.PI * 3) * 0.6 : 0;
    look = W([turn, 0.4, 2.2]); // eyes down at the floor, shaking his head on a miss
    body = { lean: 0.05 };
  }
  return { hands, body, look, weight };
}
