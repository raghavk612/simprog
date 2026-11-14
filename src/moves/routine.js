// A Routine strings moves together for one player: an optional walk-up entrance, then moves picked at random (weighted,
// never the same one twice in a row, always starting from the hand the ball is in), with a plain dribble or two now and then.
// It is a pure function of time, so the same seed always plays the same show (the preview and the tests rely on that).
import { DRIBBLE } from '../basketball.js';
import { prepare, sample, mirrorMove, dribbleMove, track, POCKET, PALM, GUARD, STANCE } from './core.js';

/* Small fast seeded random numbers (mulberry32). */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The walk-up: he dribbles in from `from` (base-frame [x, z]) to the spot, facing the way he will play, a whole number of
   bounces long at about walking pace; his legs walk by themselves (gait), the ball bounces at his side as he goes. */
export function walkUpMove(from, speed = 1.5, h = 'R') {
  const dist = Math.hypot(from[0], from[1]),
    D = DRIBBLE,
    n = Math.max(3, Math.round(dist / speed / D.period)),
    dur = n * D.period,
    x = h === 'L' ? -POCKET.x : POCKET.x,
    other = h === 'R' ? 'L' : 'R',
    at = t => D.at(t / D.period),
    // how far along: moving off, an even walking pace, easing to a stop on the spot (smooth throughout)
    k = track([
      { t: 0, v: 0 },
      { t: 0.15, v: 0.09 },
      { t: 0.8, v: 0.9 },
      { t: 1, v: 1 },
    ]);
  return {
    id: 'walkUp',
    label: 'Walk up',
    family: 'base',
    start: h,
    end: h,
    duration: dur,
    gait: true,
    ball: [{ hold: h, until: dur, fn: t => [x, at(t).ball, POCKET.z], n: [0, 1, 0], frame: 'body' }],
    hands: {
      [h]: { frame: 'body', fn: t => [x, at(t).hand + PALM, POCKET.z] },
      [other]: [{ t: 0, p: GUARD[other] }],
    },
    body: Array.from({ length: 21 }, (_, i) => {
      const t = (dur * i) / 20,
        f = k(i / 20);
      return { t, x: from[0] * (1 - f), z: from[1] * (1 - f) };
    }),
    feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  };
}

export class Routine {
  /* library: move definitions (right-hand start); weights by family ({handle, show}); ctx: context points for moves that
     need them (moves whose needs are missing are skipped); entrance: {from: [x, z]} to walk up first; dribbleChance: how
     often a plain dribble or two comes between moves. */
  constructor({
    library,
    seed = 1,
    weights = { handle: 1, show: 3 },
    ctx = null,
    hand = 'R',
    entrance = null,
    dribbleChance = 0.3,
  }) {
    this.rng = seeded(seed);
    this.library = library.filter(m => !(m.needs || []).some(k => !ctx?.[k]));
    this.weights = weights;
    this.ctx = ctx;
    this.hand = hand;
    this.dribbleChance = dribbleChance;
    this.items = [];
    this.recent = [];
    this.end = 0;
    if (entrance) this.push(walkUpMove(entrance.from, entrance.speed, hand), 'walkUp');
  }
  push(def, id = def.id) {
    const m = def.start === this.hand ? def : mirrorMove(def),
      P = prepare(m, this.ctx);
    this.items.push({ P, id, t0: this.end, t1: this.end + P.duration });
    this.end += P.duration;
    this.hand = P.end;
  }
  /* The next pick: weighted by family, never the move just played (a wider exclusion would starve the small, heavily
     weighted showtime group). */
  pick() {
    const pool = this.library.filter(m => !this.recent.includes(m.id)),
      list = pool.length ? pool : this.library,
      w = list.map(m => m.weight ?? this.weights[m.family] ?? 1),
      total = w.reduce((a, b) => a + b, 0);
    let r = this.rng() * total;
    for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) return list[i];
    return list[list.length - 1];
  }
  /* Schedules moves until the show covers time t. */
  fill(t) {
    while (this.end <= t + 0.5) {
      if (this.items.length && this.rng() < this.dribbleChance) {
        const n = this.rng() < 0.6 ? 1 : 2;
        for (let i = 0; i < n; i++) this.push(dribbleMove(this.hand));
        continue;
      }
      if (!this.library.length) {
        this.push(dribbleMove(this.hand));
        continue;
      }
      const def = this.pick();
      this.recent = [def.id];
      this.push(def);
    }
    // forget what is long done (keeps memory flat on a title screen left open for hours)
    while (this.items.length > 8 && this.items[0].t1 < t - 5) this.items.shift();
  }
  /* The pose at time t (seconds since the routine began), plus which move it is in. */
  frame(t) {
    this.fill(t);
    const it = this.items.find(i => t >= i.t0 && t < i.t1) || this.items[this.items.length - 1],
      f = sample(it.P, t - it.t0);
    f.move = it.id;
    f.moveT = t - it.t0;
    f.gait = !!it.P.move.gait;
    return f;
  }
}
