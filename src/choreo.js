// Motion version 3: the team around the ball (presentation only; the engine decided the play). The off-ball players'
// intentions, which src/playsim.js turns into bodies moving at a body's limits:
//
//   offense   four players spaced round the ball (a weak-side wing who drifts to the corner as the drive comes, a strong-side
//             corner who lifts out of the driver's way, a safety who gets back on the shot), never standing on a mark: a
//             V-cut (in slowly, plant, out hard), a backdoor cut, a curl round a pin-down screen; a ball screen set and held
//             before the handler arrives, then a roll to the rim or a pop to the arc; on a fast break the lanes filled wide
//             with a trailer and a rim runner arriving late
//   defense   ball-you-man: one pass away he denies (off his man toward the ball), two passes away he sags into the help
//             line; on a drive the low man helps at the rim and another rotates down to his man; the pin-down is switched
//             or trailed, the ball screen fought over or gone under while the screener's man drops; on the shot each finds
//             his man and boxes him out (back into him, between him and the rim); in transition they sprint to the paint
//             first and then find a man, at their own speeds
//   steal     the play flips: the robbed team sprints back, the stealers' team runs the break the other way
//
// Everything is in the attack frame (x toward the rim the offense attacks, 12.15 at the rim; z as the court) and in clip
// fractions u (0..1 of the play); basketball.js puts it on the court (x * side) and gives each player's facing (`look`).
// The play's hard moments stay the play's: the shooter, his man's contest and block, the pass, the steal, the loose ball,
// the rebounder are placed by basketball.js on top of this.

const RIM = [12.15, 0];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
  sm = x => ((x = clamp(x, 0, 1)), x * x * (3 - 2 * x));
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A timed path through waypoints [u, x, z, stop?]: a smooth curve (cubic Hermite, Catmull-Rom tangents) that passes each
   point at its moment; a `stop` point is reached at rest (a plant, a screen). Before the first and after the last, there. */
export function timedPath(keys) {
  const n = keys.length,
    tan = keys.map((k, i) => {
      if (k[3] || i === 0 || i === n - 1) return [0, 0];
      const a = keys[i - 1],
        b = keys[i + 1],
        du = b[0] - a[0] || 1e-6;
      return [((b[1] - a[1]) / du) * 0.85, ((b[2] - a[2]) / du) * 0.85];
    });
  return (u, out) => {
    if (u <= keys[0][0]) {
      out[0] = keys[0][1];
      out[1] = keys[0][2];
      return out;
    }
    for (let i = 1; i < n; i++)
      if (u <= keys[i][0]) {
        const a = keys[i - 1],
          b = keys[i],
          d = b[0] - a[0] || 1e-6,
          s = (u - a[0]) / d,
          s2 = s * s,
          s3 = s2 * s,
          h00 = 2 * s3 - 3 * s2 + 1,
          h10 = s3 - 2 * s2 + s,
          h01 = -2 * s3 + 3 * s2,
          h11 = s3 - s2;
        out[0] = h00 * a[1] + h10 * d * tan[i - 1][0] + h01 * b[1] + h11 * d * tan[i][0];
        out[1] = h00 * a[2] + h10 * d * tan[i - 1][1] + h01 * b[2] + h11 * d * tan[i][1];
        return out;
      }
    out[0] = keys[n - 1][1];
    out[1] = keys[n - 1][2];
    return out;
  };
}

/* Where a defender stands on his man M with the ball at B (ball-you-man): one pass away (the ball within about 5 units) he
   denies, a step off his man toward the ball and the rim; two passes away he sags toward the ball into the help line.
   Never beyond the rim side's room. */
export function ballYouMan(M, B, out) {
  const rx = RIM[0] - M[0],
    rz = RIM[1] - M[1],
    dR = Math.hypot(rx, rz) || 1,
    bx = B[0] - M[0],
    bz = B[1] - M[1],
    dB = Math.hypot(bx, bz) || 1,
    away = sm((dB - 5) / 6), // 0 one pass away .. 1 two passes away
    wr = 0.85 - 0.3 * away,
    wb = 0.35 + 0.45 * away;
  let dx = (rx / dR) * wr + (bx / dB) * wb,
    dz = (rz / dR) * wr + (bz / dB) * wb;
  const dl = Math.hypot(dx, dz) || 1,
    gap = Math.min(1.25 + 1.7 * away, dR - 0.7, dB * 0.55);
  dx /= dl;
  dz /= dl;
  out[0] = M[0] + dx * Math.max(0.6, gap);
  out[1] = M[1] + dz * Math.max(0.6, gap);
  if (out[0] > 11.5) out[0] = 11.5; // in front of the rim, never under the board
  return out;
}

/* Waypoints a body can keep up with: a segment that asks for more than `vmax` units per second on average (75% of it out
   of a stop, which starts from rest) is given the time it needs, and everything after it moves later by as much. */
export function retime(keys, S, vmax = 4.0) {
  let shift = 0;
  const out = [];
  for (let n = 0; n < keys.length; n++) {
    const w = keys[n].slice();
    w[0] += shift;
    if (n > 0) {
      const a = out[n - 1],
        d = Math.hypot(w[1] - a[1], w[2] - a[2]),
        need = d / ((a[3] ? 0.75 : 1) * vmax * S);
      if (w[0] - a[0] < need) {
        shift += need - (w[0] - a[0]);
        w[0] = a[0] + need;
      }
    }
    out.push(w);
  }
  return out;
}

const PLANS = new Map();
/* The play's plan: what each off-ball player does and when, the screens and how they are defended, who helps and who
   rotates, who crashes the board, and the contacts it allows (screens and box-outs). ctx: {key, seed, fam, T, rel, at(u)
   (the shooter in the attack frame), lane, outcome, points, afterSteal, S}. */
export function choreoPlan(ctx) {
  const hit = PLANS.get(ctx.key);
  if (hit) return hit;
  const r = rng(ctx.seed),
    { fam, rel, lane: s, T } = ctx,
    drives = fam === 'drive' || fam === 'floater' || fam === 'roll' || fam === 'hook',
    jumper = fam === 'pullup' || fam === 'stepback' || fam === 'catch',
    brk = fam === 'dunk',
    steal = ctx.outcome === 'steal',
    shot = !steal && ctx.outcome !== 'block',
    k = {}, // waypoints per offensive player (1..4)
    action = {};
  // the moment the shooter is closest to a point (scan): for the screens
  const nearest = (p, u0 = 0, u1 = rel) => {
    let best = u0,
      bd = Infinity;
    for (let u = u0; u <= u1; u += 0.005) {
      const a = ctx.at(u),
        d = Math.hypot(a[0] - p[0], a[1] - p[1]);
      if (d < bd) ((bd = d), (best = u));
    }
    return best;
  };
  const after = rel + 0.04; // the shot is up: crash or get back
  let screen = null, // the ball screen (roll): {u0 set, u1 released, p, kind}
    pin = null; // the pin-down: {u0, u1, coverage}
  if (brk) {
    // the fast break: lanes filled wide, a trailer, a rim runner last
    k[2] = [
      [0, -0.8, -5.2 * s],
      [0.4, 6.2, -5.9 * s],
      [0.68, 10.4, -5.7 * s],
      [1, 10.9, -5.6 * s],
    ];
    k[3] = [
      [0, -3.4, 0.6 * s],
      [0.5, 3.4, 0.4 * s],
      [0.8, 5.6, -0.6 * s],
    ];
    k[4] = [
      [0, -4.6, -1.8 * s],
      [0.55, 3.6, -2.6 * s],
      [0.9, 7.6, -2.8 * s],
    ];
    // the outlet passer: the play's own until the pass (basketball.js), then he trails the play to the top of the key
    k[1] = [
      [0, -4.5, 3 * s],
      [0.55, 0.8, 1.6 * s],
      [1, 3.4, 1.0 * s],
    ];
    action[1] = 'outlet, trail';
    action[2] = 'lane';
    action[3] = 'trailer';
    action[4] = 'rim run';
  } else {
    // the safety (or the passer, or the ball screener)
    if (fam === 'roll') {
      // the screen: on the defender's side of the handler's run, a body's width (1.05) off it where he passes
      const p0 = [4.8, 2.6 * s],
        u1 = nearest(p0, 0.05),
        h = ctx.at(u1),
        dx = p0[0] - h[0],
        dz = p0[1] - h[1],
        dl = Math.hypot(dx, dz) || 1,
        p = [h[0] + (dx / dl) * 1.05, h[1] + (dz / dl) * 1.05],
        pop = r() < 0.3;
      screen = {
        u0: Math.max(0.06, u1 - 0.14),
        u1: u1 + 0.03,
        p,
        kind: pop ? 'pop' : 'roll',
        cover: r() < 0.6 ? 'over' : 'under',
      };
      // from the top of the key up to the handler's side, set (still) before he arrives, held until he is past, then a
      // roll to the rim (down the middle, away from the handler's finish) or a pop out behind the arc
      k[1] = [
        [0, 5.5, 1.7 * s],
        [screen.u0, p[0], p[1], 1],
        [screen.u1, p[0], p[1], 1],
        ...(pop
          ? [
              [screen.u1 + 0.18, 4.4, 0.8 * s],
              [screen.u1 + 0.4, 4.6, -0.6 * s],
            ]
          : [
              [screen.u1 + 0.2, 7.4, 0.6 * s],
              [screen.u1 + 0.4, 9.8, -1.9 * s],
            ]),
      ];
      action[1] = `screen and ${screen.kind}`;
    } else if (fam === 'catch' && !ctx.afterSteal) {
      // the passer (the play's own until the pass): then relocates toward the top, and is the safety on the shot
      k[1] = [
        [0.3, 3, -5.5],
        [0.5, 4.4, -3.6],
        [after, 4.7, -3.0],
        [after + 0.25, 1.8, -2.8],
      ];
      action[1] = 'pass and relocate';
    } else {
      k[1] = [
        [0, 3.2, -4.6 * s],
        [0.42, 3.8, -5.6 * s],
        [after, 3.9, -5.7 * s],
        [after + 0.26, 1.2, -4.0 * s],
      ];
      action[1] = 'safety';
    }
    // the cutter (weak side): a V-cut, a backdoor cut (not in a driver's lane), or a curl off a pin-down by the slot
    const roll = r(),
      cut = !jumper
        ? roll < 0.55
          ? 'vcut'
          : 'curl'
        : roll < 0.4
          ? 'vcut'
          : roll < 0.7
            ? 'backdoor'
            : 'curl';
    action[2] = cut;
    if (cut === 'vcut')
      k[2] = [
        [0, 5.2, -3.4 * s],
        [0.07, 5.5, -3.5 * s],
        [0.22, 7.5, -2.4 * s, 1], // in slowly, plant
        [0.33, 7.6, -4.7 * s], // out hard
        [0.5, 7.2, -5.1 * s],
        [after, 7.2, -5.1 * s],
      ];
    else if (cut === 'backdoor')
      k[2] = [
        [0, 7.4, -4.4 * s],
        [0.1, 6.8, -5.2 * s, 1], // up the floor to sell it, plant
        [0.25, 9.6, -2.6 * s], // the cut behind his man
        [0.33, 10.8, -1.2 * s],
        [0.46, 10.8, -2.8 * s], // through, to the weak-side dunker spot
        [after, 10.7, -2.9 * s],
      ];
    else {
      // the curl: the slot comes down and sets the pin-down; the cutter waits on the block, comes off it and curls
      pin = { u0: 0.16, u1: 0.32, coverage: r() < 0.5 ? 'switch' : 'trail' };
      k[2] = [
        [0, 10.4, -2.6 * s],
        [0.14, 10.6, -2.9 * s, 1],
        [0.3, 8.5, -2.6 * s],
        [0.42, 7.2, -1.0 * s],
        [0.56, 6.0, -2.6 * s],
        [after, 6.0, -2.8 * s],
      ];
      k[4] = [
        [0, 7.0, -1.6 * s],
        [pin.u0, 9.0, -3.4 * s, 1],
        [pin.u1, 9.0, -3.4 * s, 1],
        [pin.u1 + 0.18, 10.4, -3.8 * s],
        [after, 10.4, -3.8 * s],
      ];
      action[4] = 'pin-down screen';
    }
    // the weak wing: drifts to the corner as the play goes to the rim (his man has further to help)
    k[3] = drives
      ? [
          [0, 8.4, -5.4 * s],
          [0.18, 8.6, -5.6 * s],
          [0.46, 11.0, -6.1 * s],
          [after, 11.0, -6.1 * s],
        ]
      : [
          [0, 9.2, -5.6 * s],
          [0.4, 10.2, -6.0 * s],
          [0.6, 10.8, -6.1 * s],
          [after, 10.8, -6.1 * s],
        ];
    action[3] = 'drift';
    // the strong side: the corner lifts to the wing as the drive comes baseline; for a jumper the slot drifts opposite
    if (!k[4]) {
      if (drives) {
        k[4] = [
          [0, 11.1, 6.0 * s],
          [0.25, 11.1, 6.1 * s],
          [0.5, 9.0, 5.8 * s],
          [after, 8.8, 5.7 * s],
        ];
        action[4] = 'corner lift';
      } else {
        k[4] = [
          [0, 6.2, -0.4 * s],
          [0.25, 6.6, -1.2 * s],
          [0.5, 6.0, -2.0 * s],
          [after, 6.0, -2.0 * s],
        ];
        action[4] = 'slot drift';
      }
    }
  }
  // after the shot: who crashes the board, who gets back (a made or missed shot; a block has its own scramble)
  const crash = { 1: false, 2: false, 3: false, 4: false };
  if (shot) {
    crash[3] = !brk;
    crash[brk ? 4 : action[2] === 'backdoor' || action[2] === 'curl' ? 4 : 2] = r() < 0.75;
    // a crasher heads for the rim from where he is (2 units out, on his own line to it); the rest drift back out
    for (const j of [2, 3, 4]) {
      const ks = k[j];
      if (!ks) continue;
      const last = ks[ks.length - 1],
        from = Math.max(after, last[0]);
      if (crash[j]) {
        const dx = last[1] - RIM[0],
          dz = last[2] - RIM[1],
          dl = Math.hypot(dx, dz) || 1,
          q = [RIM[0] + (dx / dl) * 2.0, RIM[1] + (dz / dl) * 2.0];
        // from a corner his line runs along the baseline: he comes up in front of the rim instead
        if (q[0] > 10.9) ((q[0] = 10.9), (q[1] = Math.sign(q[1] || -s) * 1.8));
        ks.push([
          from + Math.max(0.12, Math.hypot(q[0] - last[1], q[1] - last[2]) / (3.6 * ctx.S)),
          q[0],
          q[1],
        ]);
      } else if (j !== 3) {
        const q = [Math.min(last[1], 6.2) - 1.2, last[2] * 0.8];
        ks.push([
          from + Math.max(0.15, Math.hypot(q[0] - last[1], q[1] - last[2]) / (3.2 * ctx.S)),
          q[0],
          q[1],
        ]);
      }
    }
  }
  if (steal) {
    // the play flips at the steal: the robbed team sprints back, the other runs it the other way
    for (const j of [1, 2, 3, 4]) {
      if (!k[j]) continue;
      const cut = k[j].filter(w => w[0] < 0.34),
        p = timedPath(k[j])(0.34, [0, 0]);
      k[j] = [...cut, [0.34, p[0], p[1]], [1, p[0] - 7 - j * 0.6, p[1] * 0.6]];
    }
  }
  // at a pace a body keeps
  for (const j of [1, 2, 3, 4]) if (k[j]) k[j] = retime(k[j], ctx.S);
  // the defense's men (who guards whom: a switch swaps two), the low helper on a drive and the man who rotates for him
  const men = [0, 1, 2, 3, 4],
    switchAt = pin && pin.coverage === 'switch' ? pin.u0 + 0.06 : Infinity,
    // on a drive, the help comes from the weak side's man nearest the rim at the finish
    finishU = T.arrive - 0.05,
    weak = [2, 3].filter(j => k[j]),
    near = j => {
      const p = timedPath(k[j])(finishU, [0, 0]);
      return Math.hypot(p[0] - RIM[0], p[1] - RIM[1]);
    },
    helper = (drives || brk) && weak.length ? weak.reduce((a, b) => (near(a) <= near(b) ? a : b)) : null,
    rotator = helper == null ? null : helper === 2 ? 3 : 2;
  const paths = {};
  for (const j of [1, 2, 3, 4]) if (k[j]) paths[j] = timedPath(k[j]);
  // contacts the play allows (pairs of [offense index, defense index] relative to each team, from, to (u), the gap)
  const contacts = [];
  if (pin) contacts.push([4, pin.coverage === 'switch' ? 4 : 2, pin.u0 - 0.04, pin.u1 + 0.06, 0.62]);
  if (shot)
    for (const j of [1, 2, 3, 4]) if (crash[j] && j !== 1) contacts.push([j, j, after + 0.06, 1.01, 0.62]);
  const plan = {
    keys: k,
    paths,
    action,
    crash,
    screen,
    pin,
    helper,
    rotator,
    switchAt,
    men,
    contacts,
    brk,
    steal,
    shot,
    after,
  };
  if (PLANS.size > 64) PLANS.delete(PLANS.keys().next().value);
  PLANS.set(ctx.key, plan);
  return plan;
}

const P = [0, 0],
  Q = [0, 0],
  M = [0, 0];
/* The off-ball players at clip fraction u, in place in A (actors, court frame): the offense's four (not the shooter) and
   the defense's five base spots (the shooter's man is placed by basketball.js on top). ball: [x, z] attack frame, where
   the ball is (the handler, or the pass on its way); rebounder: his index (his run to the rebound is the play's). Writes
   A[i].look: who he watches (a player's index, or 10 for the ball). */
export function choreograph(A, plan, ctx, u, ball) {
  const { side, offense: off, defense: def, rel, lane: s } = ctx,
    at = ctx.at(u),
    put = (i, x, z) => {
      A[i].x = x * side;
      A[i].z = z;
    },
    mine = i => [A[i].x * side, A[i].z];
  // the offense
  for (const j of [1, 2, 3, 4]) {
    const path = plan.paths[j];
    if (!path) continue;
    path(u, P);
    put(off + j, P[0], P[1]);
    A[off + j].look = 10;
  }
  if (plan.screen && u > plan.screen.u0 - 0.04 && u < plan.screen.u1) A[off + 1].arms = 'screen';
  if (plan.pin && u > plan.pin.u0 - 0.02 && u < plan.pin.u1) A[off + 4].arms = 'screen';
  // the defense: base spots on their men (ball-you-man), the switch, the help and the rotation, the box-outs
  const dyn = u >= plan.switchAt;
  for (let j = 1; j < 5; j++) {
    const man = dyn && (j === 2 || j === 4) ? 6 - j : j, // a switch on the pin-down: 2 <-> 4
      m = mine(off + man);
    ballYouMan(m, ball, Q);
    // trailing the pin-down: on his man's hip, a step behind him as he comes off the screen
    if (plan.pin && plan.pin.coverage === 'trail' && j === 2 && u > plan.pin.u0 && u < plan.pin.u1 + 0.12) {
      const w = sm((u - plan.pin.u0) / 0.06) * (1 - sm((u - plan.pin.u1 - 0.04) / 0.08));
      Q[0] += (m[0] - 0.6 - Q[0]) * w;
      Q[1] += (m[1] + 0.5 * s - Q[1]) * w;
    }
    // the ball screen's man drops: in the paint at the screen's level, then back to the roller
    if (plan.screen && j === 1 && u > plan.screen.u0 - 0.1 && u < plan.screen.u1 + 0.2) {
      const w = sm((u - plan.screen.u0 + 0.1) / 0.08) * (1 - sm((u - plan.screen.u1 - 0.08) / 0.12)),
        dx = [8.2, 1.4 * s];
      Q[0] += (dx[0] - Q[0]) * w;
      Q[1] += (dx[1] - Q[1]) * w;
    }
    // a fast break: from up the floor with his man, a sprint back to the paint first, then a man (each at his own
    // moment)
    if (plan.brk) {
      const paint =
          j === 2 ? [10.2, -1.2 * s] : j === 3 ? [9.6, 1.4 * s] : j === 4 ? [10.6, 0.2 * s] : [8.4, -2.4 * s],
        w = sm(u / (0.3 + j * 0.03)) * (1 - sm((u - 0.38 - j * 0.05) / 0.25));
      Q[0] += (paint[0] - Q[0]) * w;
      Q[1] += (paint[1] - Q[1]) * w;
    }
    A[def + j].look = off + man;
    // the shot is up: find your man and put your back into him, between him and the rim
    if (plan.shot && u > rel + 0.02) {
      const w = sm((u - rel - 0.02) / 0.12),
        rx = RIM[0] - m[0],
        rz = RIM[1] - m[1],
        d = Math.hypot(rx, rz) || 1,
        g = Math.min(0.66, d - 0.4);
      Q[0] += (m[0] + (rx / d) * g - Q[0]) * w;
      Q[1] += (m[1] + (rz / d) * g - Q[1]) * w;
      if (w > 0.5) A[def + j].look = 10;
    }
    put(def + j, Q[0], Q[1]);
  }
  // the help at the rim on a drive (and the rotation behind it), until the shot is up
  if (plan.helper != null) {
    const d = Math.hypot(at[0] - RIM[0], at[1] - RIM[1]),
      h = sm((5.5 - d) / 2.5) * (1 - sm((u - rel - 0.02) / 0.1)),
      hp = def + plan.helper;
    if (h > 0) {
      const bx = at[0] - RIM[0],
        bz = at[1] - RIM[1],
        bl = Math.hypot(bx, bz) || 1,
        reach = clamp(bl - 0.6, 1.0, 1.7),
        // in front of the rim, off the ball's line to the weak side (the driver's own man is on the line: room for both)
        flip = (bx / bl) * s > 0 ? -1 : 1, // the perpendicular (-bz, bx) * flip: its z (bx * flip) on the weak side (-s)
        hx = RIM[0] + (bx / bl) * reach - (bz / bl) * 1.25 * flip,
        hz = RIM[1] + (bz / bl) * reach + (bx / bl) * 1.25 * flip;
      const cur = mine(hp);
      put(hp, cur[0] + (Math.min(11.2, hx) - cur[0]) * h, cur[1] + (hz - cur[1]) * h);
      A[hp].look = 10;
      // the rotation: the other weak-side defender sinks toward the helper's man
      const rt = def + plan.rotator,
        hm = mine(off + plan.helper),
        rc = mine(rt);
      ballYouMan(hm, at, M);
      put(rt, rc[0] + (M[0] - rc[0]) * 0.55 * h, rc[1] + (M[1] - rc[1]) * 0.55 * h);
    }
  }
  if (plan.steal && u > 0.34) {
    // the stealers' team runs the break the other way: wide lanes, a trailer
    const w = sm((u - 0.34) / 0.2),
      lanes = { 1: [-0.5, -1.8 * s], 2: [-3.4, -5.6 * s], 3: [-2.8, 5.6 * s], 4: [1.2, 0.6 * s] };
    for (const j of [1, 2, 3, 4]) {
      const cur = mine(def + j),
        L = lanes[j],
        q = sm((u - 0.34) / (0.62 - j * 0.04));
      put(def + j, cur[0] + (L[0] - cur[0]) * w * q, cur[1] + (L[1] - cur[1]) * w * q);
      A[def + j].look = 10;
    }
  }
}
