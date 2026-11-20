// The ball in motion version 3 (presentation only): who has it and what it does, worked out once per play after the
// players' movement (src/playsim.js), at 60 Hz. The play's promises stay exact: the release point and moment, the flight
// to the rim and its arrival (0.86 of the play), a miss's rebound spot, the block's contact, who ends with the ball.
//
//   hold     in the hands at the chest (a passer before he throws, a rebounder, the block's winner)
//   dribble  a real dribble with the real ball (radius 0.13): pushed down from the hand, falling under gravity, bouncing
//            off the floor keeping 0.85 of its speed (a dropped ball comes back to about 72% of its height), back up into
//            the hand; the push is as hard as the rhythm needs, the rhythm (1.5-2.5 bounces a second) follows the
//            dribbler's speed, and the ball is on the hand away from his defender: when the defender comes to that side
//            it changes hands with a crossover, between the legs or behind the back (seeded per play)
//   pass     thrown from the passer's hands to where the receiver's hands will be (a chest pass, a bounce pass, the fast
//            break's overhead outlet), caught and given with
//   shot     the gather into the shot pocket and the flight to the rim are the play's own (exact)
//   rim      a make swishes or rattles and drops through the net; a miss clanks, caroms long off the floor, or rolls round
//            the rim and off, and comes down into the rebounder's hands on the rebound spot when the play ends
//   loose    a blocked shot is swatted and bounces until it is gathered; a steal is a poke that deflects the ball into
//            the stealer's dribble
//   floor    bounces keep 0.85 of the speed; rolling, it slows
// The pose then says who holds the ball (holder), where the hand on it is (hand), and the dribbling hand's height.

export const BALL_R = 0.13, // the ball's radius (game units: 24 cm across)
  E_FLOOR = 0.85; // the speed a bounce off hardwood keeps
const FPS = 60,
  ROLL = 1.4, // units/s^2: rolling on the floor slows it
  CHEST = [0, 1.22, 0.36], // a two-handed hold, in the holder's frame (x his left, y up, z forward)
  DRIB = { top: 1.0, release: 0.82, catch: 0.84, side: 0.3, ahead: 0.3 }, // the dribble's hand, ball-centre heights
  PALM = BALL_R + 0.07; // a hand on top of the ball: its palm this far above the ball's centre

const clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
  sm = x => ((x = clamp(x, 0, 1)), x * x * (3 - 2 * x));
/* A point in a player's frame (x his left, y up, z forward) on the court. */
function inFrame(pos, yaw, p) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [pos[0] + p[0] * c + p[2] * s, p[1], pos[1] - p[0] * s + p[2] * c];
}
/* Cubic Hermite between two values with end velocities (u in 0..1 over `dur` seconds). */
function hermite(a, va, b, vb, u, dur) {
  const u2 = u * u,
    u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * va * dur + (-2 * u3 + 3 * u2) * b + (u3 - u2) * vb * dur
  );
}
/* A seeded RNG (mulberry32). */
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

/* The dribble's flight for a cycle: the push speed down from the release height that brings the ball back up into the
   hand at the catch height `flight` seconds later, after one bounce. Returns {v0, down, up} (the push speed and the times
   down to the floor and back up), or the slowest dribble that can reach (a push of at least what the bounce needs). */
export function dribbleFlight(flight, g, rel = DRIB.release, cat = DRIB.catch) {
  const timeFor = v0 => {
    const vi = Math.sqrt(v0 * v0 + 2 * g * (rel - BALL_R)),
      down = (vi - v0) / g,
      vb = E_FLOOR * vi,
      disc = vb * vb - 2 * g * (cat - BALL_R);
    if (disc < 0) return { total: Infinity, down, up: Infinity, vi, vb };
    const up = (vb - Math.sqrt(disc)) / g;
    return { total: down + up, down, up, vi, vb };
  };
  let lo = 0,
    hi = 30;
  for (let it = 0; it < 50; it++) {
    const mid = (lo + hi) / 2;
    if (timeFor(mid).total > flight) lo = mid;
    else hi = mid;
  }
  const r = timeFor(hi);
  return { v0: hi, down: r.down, up: r.up, vb: r.vb, total: r.total };
}

/* The simulation. o: {
     duration, g, side (+1 home attacks +x), off, def (the shooter's and his man's indexes), pos(i, t) -> [x, z] (the
     simulated players), vel(i, t) -> [vx, vz], yaw(i, t) (facing), authoredBall(t) -> [x, y, z], authoredPos(i, t),
     pass: {from, at, throwBy, kind} | null (a pass to the shooter caught at `at` seconds),
     gather, release, arrive (seconds), releasePoint {x, y, z}, flightT (seconds), rim {x, y, z},
     outcome, points, land {x, y, z} (a miss's rebound spot), rebounder,
     steal: {poke, secure} | null, block: {hit, catch, win, go, arr, kept, made} | null, seed }
   Returns {frames, x, y, z, holder, held, handX, handY, handZ, dribbleY, dribbling, moves}. */
export function simulateBall(o) {
  const N = Math.round(o.duration * FPS) + 1,
    X = new Float32Array(N),
    Y = new Float32Array(N),
    Z = new Float32Array(N),
    HOLD = new Int8Array(N).fill(-1),
    HELD = new Uint8Array(N),
    HX = new Float32Array(N),
    HY = new Float32Array(N),
    HZ = new Float32Array(N),
    DY = new Float32Array(N).fill(-1),
    DRB = new Uint8Array(N),
    moves = [],
    r = rng(o.seed),
    g = o.g,
    // the first frame at or after a moment: a segment that starts at a moment owns the frames from it on (the play's own
    // ball switches exactly there too)
    frameOf = t => clamp(Math.ceil(t * FPS - 1e-9), 0, N - 1),
    put = (f, p, holder = -1, hand = null) => {
      X[f] = p[0];
      Y[f] = Math.max(BALL_R, p[1]);
      Z[f] = p[2];
      HOLD[f] = holder;
      if (hand) {
        HELD[f] = 1;
        HX[f] = hand[0];
        HY[f] = hand[1];
        HZ[f] = hand[2];
      }
    },
    chest = (i, t) => inFrame(o.pos(i, t), o.yaw(i, t), CHEST);

  // ---- the dribble: player i from t0 (ball in his hand at p0) to t1 (ball back in his hand) ----
  const dribble = (i, t0, t1, p0) => {
    // a frame bound: a dribble that runs past the play's end fills its last frame too
    const upTo = t => (t > (N - 1) / FPS + 1e-9 ? N : frameOf(t)),
      f0 = frameOf(t0),
      f1 = upTo(t1);
    if (f1 <= f0) return null;
    // the rhythm follows his speed as he goes: 1.5 bounces a second standing to 2.5 at a sprint, each bounce its own
    // length (the beat integrated over the stretch and scaled so a whole number of bounces ends in his hand at t1)
    const rateAt = t => {
        const v = o.vel(i, t);
        return clamp(1.5 + Math.hypot(v[0], v[1]) * 0.2, 1.5, 2.5);
      },
      steps = Math.max(8, Math.round((t1 - t0) / 0.02)),
      phase = [0];
    for (let k = 1; k <= steps; k++)
      phase.push(phase[k - 1] + (rateAt(t0 + ((k - 0.5) * (t1 - t0)) / steps) * (t1 - t0)) / steps);
    const n = Math.max(1, Math.round(phase[steps])),
      bounds = [t0];
    for (let k = 1, j = 0; k < n; k++) {
      const want = (k * phase[steps]) / n;
      while (j < steps && phase[j + 1] < want) j++;
      const u = (want - phase[j]) / Math.max(1e-9, phase[j + 1] - phase[j]);
      bounds.push(t0 + ((j + u) * (t1 - t0)) / steps);
    }
    bounds.push(t1);
    const cyc = bounds.slice(0, n).map((ts, k) => {
      const P = bounds[k + 1] - ts,
        contact = 0.36 * P;
      return { ts, P, contact, fl: dribbleFlight(P - contact, g) };
    });
    // which hand: away from his man (lateral of the defender); a change is a move
    const lateral = t => {
      const me = o.pos(i, t),
        dm = o.pos(o.dribbleMan(i), t),
        y = o.yaw(i, t);
      return (dm[0] - me[0]) * Math.cos(y) - (dm[1] - me[1]) * Math.sin(y); // + his left
    };
    const near = t => {
      const me = o.pos(i, t),
        dm = o.pos(o.dribbleMan(i), t);
      return Math.hypot(dm[0] - me[0], dm[1] - me[1]);
    };
    let side = lateral(t0) > 0 ? -1 : 1, // the hand away from him (+1 his left)
      lastSwitch = -9;
    const sides = [],
      kinds = [];
    for (let k = 0; k <= n; k++) {
      const tk = bounds[k],
        want = lateral(tk) > 0 ? -1 : 1;
      let kind = null;
      if (k > 0 && want !== side && k - lastSwitch >= 2 && near(tk) < 2.2) {
        const roll = r(),
          tight = near(tk) < 1.5;
        kind = !tight || roll < 0.5 ? 'crossover' : roll < 0.8 ? 'between the legs' : 'behind the back';
        side = want;
        lastSwitch = k;
        moves.push({ t: tk, kind, who: i });
      }
      sides.push(side);
      kinds.push(kind);
    }
    // the hand's point for a cycle's contact (in his frame), at a moment
    const handPoint = (t, s, kind = null, y = DRIB.top) => {
      const fwd = kind === 'behind the back' ? -0.28 : kind === 'between the legs' ? -0.04 : DRIB.ahead,
        lat = kind === 'behind the back' ? 0.24 : kind === 'between the legs' ? 0.16 : DRIB.side,
        v = o.vel(i, t),
        p = inFrame(o.pos(i, t), o.yaw(i, t), [s * lat, y, fwd]);
      // the ball runs a little ahead of a moving dribbler (within an arm's reach: at most 0.15 more)
      const sp = Math.hypot(v[0], v[1]),
        lead = sp > 1e-6 ? Math.min(0.06 * sp, 0.15) / sp : 0;
      return [p[0] + v[0] * lead, y, p[2] + v[1] * lead];
    };
    for (let k = 0; k < n; k++) {
      const { ts, P, contact, fl } = cyc[k], // ts: the catch (the ball arrives going up; the first cycle starts in the hand)
        tr = ts + contact, // the release
        te = ts + P,
        s = sides[k],
        nextS = sides[k + 1],
        move = kinds[k + 1], // the move that takes it to the other hand happens on this cycle's bounce
        vUp = k === 0 ? 0 : cyc[k - 1].fl.vb - g * cyc[k - 1].fl.up, // arriving speed at the catch (upward)
        cY = k === 0 ? p0[1] : DRIB.catch;
      // contact: rise to the top, then push down to the release (its point, for a move, is where the move starts)
      for (let f = frameOf(ts); f < upTo(tr); f++) {
        const t = f / FPS,
          u = (t - ts) / contact,
          top = 0.45, // the share of contact spent rising to the top
          y =
            u < top
              ? hermite(cY, vUp, DRIB.top, 0, u / top, contact * top)
              : hermite(DRIB.top, 0, DRIB.release, -fl.v0, (u - top) / (1 - top), contact * (1 - top)),
          h0 = handPoint(t, s, null, y),
          h1 = move ? handPoint(t, s, move, y) : h0,
          w = move ? sm((u - top) / (1 - top)) : 0,
          mx = h0[0] + (h1[0] - h0[0]) * w, // the hand's point (moving toward a move's start as it pushes)
          mz = h0[2] + (h1[2] - h0[2]) * w,
          // the first push starts from wherever the ball is (in his hands after a catch)
          e0 = k === 0 && p0 ? 1 - sm(u) : 0,
          bx = mx + (k === 0 && p0 ? (p0[0] - mx) * e0 : 0),
          bz = mz + (k === 0 && p0 ? (p0[2] - mz) * e0 : 0);
        put(f, [bx, y, bz], i, [bx, y + PALM, bz]);
        DY[f] = y;
        DRB[f] = 1;
      }
      // flight: down, bounce, up into the hand where it will be (the next cycle's side) at the next catch
      const rel = handPoint(tr, s, move, DRIB.release),
        cat = handPoint(te, nextS ?? s, null, DRIB.catch);
      for (let f = frameOf(tr); f < upTo(te); f++) {
        const t = f / FPS,
          tau = t - tr,
          u = tau / (P - contact),
          y =
            tau < fl.down
              ? DRIB.release - fl.v0 * tau - 0.5 * g * tau * tau
              : BALL_R + fl.vb * (tau - fl.down) - 0.5 * g * (tau - fl.down) ** 2,
          bx = rel[0] + (cat[0] - rel[0]) * u,
          bz = rel[2] + (cat[2] - rel[2]) * u;
        put(f, [bx, y, bz], i);
        // the hand waits for it: down a little after the push and back up to meet it
        DY[f] = DRIB.release - 0.06 * Math.sin(Math.PI * u) + (DRIB.catch - DRIB.release) * u;
        DRB[f] = 1;
      }
    }
    return { end: [X[f1 - 1], Y[f1 - 1], Z[f1 - 1]] };
  };

  // ---- the floor: a ball in flight from p with velocity v, bouncing and rolling, frames [fa, fb) ----
  const loose = (fa, fb, p, v, lead = 0) => {
    let [x, y, z] = p,
      [vx, vy, vz] = v;
    const dt = 1 / FPS;
    // `lead`: seconds from p to the first frame (p is where the ball is at a moment between frames)
    if (lead > 0) {
      x += vx * lead;
      z += vz * lead;
      y += vy * lead - 0.5 * g * lead * lead;
      vy -= g * lead;
    }
    for (let f = fa; f < fb; f++) {
      put(f, [x, y, z]);
      vy -= g * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (y < BALL_R) {
        y = BALL_R + (BALL_R - y) * E_FLOOR;
        vy = -vy * E_FLOOR;
        vx *= 0.92; // the floor's grip on a bounce
        vz *= 0.92;
        if (vy < 0.5) vy = 0; // settled: it rolls
      }
      if (y <= BALL_R + 1e-3 && vy === 0) {
        const s = Math.hypot(vx, vz),
          d = ROLL * dt;
        if (s > d) {
          vx -= (vx / s) * d;
          vz -= (vz / s) * d;
        } else vx = vz = 0;
      }
      // the backboard and the stanchion side: it does not go behind the board
      const bx = o.board - BALL_R;
      if (Math.abs(x) > bx && Math.abs(z) < o.boardHalf && y > o.boardLo && y < o.boardHi) {
        x = Math.sign(x) * bx;
        vx = -vx * 0.5;
      }
    }
    return { p: [x, y, z], v: [vx, vy, vz] };
  };
  // whether a plain arc from p to q in T seconds passes through a backboard
  const arcHitsBoard = (p, q, T) => {
    const vy = (q[1] - p[1] + 0.5 * g * T * T) / T;
    for (let k = 1; k < 20; k++) {
      const tau = (k / 20) * T,
        x = p[0] + ((q[0] - p[0]) * k) / 20,
        z = p[2] + ((q[2] - p[2]) * k) / 20,
        y = p[1] + vy * tau - 0.5 * g * tau * tau;
      if (
        Math.abs(x) > o.board - BALL_R &&
        Math.abs(z) < o.boardHalf + BALL_R &&
        y > o.boardLo - BALL_R &&
        y < o.boardHi + BALL_R
      )
        return true;
    }
    return false;
  };
  // a ballistic arc from p to q in T seconds, optionally with one floor bounce on the way; frames [fa, fb)
  // p is where the ball is at `t0` (by default frame fa's moment) and q where it is T seconds later
  const arc = (fa, fb, p, q, T, bounce = false, t0 = fa / FPS) => {
    if (bounce) {
      // the floor bounce: horizontal velocity carries through it; the second hop leaves at E_FLOOR of the impact speed and
      // arrives at q on time. For a bounce at tb the first hop must reach the floor exactly at tb: miss(tb) = 0, found by
      // a scan for a change of sign and bisection; if there is none, a plain arc
      const hop = tb => {
          const T2 = T - tb,
            vy2 = (q[1] - BALL_R + 0.5 * g * T2 * T2) / T2,
            vi = vy2 / E_FLOOR,
            vy1 = g * tb - vi;
          return { vy1, vy2, miss: p[1] + vy1 * tb - 0.5 * g * tb * tb - BALL_R };
        },
        lo0 = 0.15 * T,
        hi0 = 0.9 * T;
      let tb = null;
      for (let k = 0; k < 30 && tb === null; k++) {
        const a = lo0 + ((hi0 - lo0) * k) / 30,
          b = lo0 + ((hi0 - lo0) * (k + 1)) / 30;
        if (hop(a).miss * hop(b).miss <= 0) {
          let l = a,
            h = b;
          for (let it = 0; it < 40; it++) {
            const m = (l + h) / 2;
            if (hop(l).miss * hop(m).miss <= 0) h = m;
            else l = m;
          }
          tb = (l + h) / 2;
        }
      }
      if (tb !== null) {
        const { vy1, vy2 } = hop(tb);
        for (let f = fa; f < fb; f++) {
          const tau = f / FPS - t0,
            u = tau / T,
            x = p[0] + (q[0] - p[0]) * u,
            z = p[2] + (q[2] - p[2]) * u,
            y =
              tau < tb
                ? p[1] + vy1 * tau - 0.5 * g * tau * tau
                : BALL_R + vy2 * (tau - tb) - 0.5 * g * (tau - tb) ** 2;
          put(f, [x, y, z]);
        }
        return true;
      }
    }
    const vy = (q[1] - p[1] + 0.5 * g * T * T) / T;
    for (let f = fa; f < fb; f++) {
      const tau = f / FPS - t0,
        u = tau / T;
      put(f, [p[0] + (q[0] - p[0]) * u, p[1] + vy * tau - 0.5 * g * tau * tau, p[2] + (q[2] - p[2]) * u]);
    }
    return false;
  };

  const S = o.duration,
    off = o.off;
  // whose man a dribbler watches: the shooter's defender (after a steal, set below: the man he took it from)
  o.dribbleMan ??= i => (i === off ? o.def : off);
  // ---- before the shot: the pass in, the dribble, a steal ----
  let tDribble = 0,
    p0 = null;
  if (o.pass) {
    const { from, at, kind } = o.pass,
      catchP = chest(off, at),
      fromP = (t, h = 1.22) =>
        inFrame(o.pos(from, t), o.yaw(from, t), [0, kind === 'overhead' ? 2.1 : h, 0.32]),
      speed = kind === 'overhead' ? 11 : 9.5,
      dist = Math.hypot(catchP[0] - fromP(at)[0], catchP[2] - fromP(at)[2]),
      T = clamp(dist / speed, 0.28, at - 0.1),
      tThrow = at - T;
    for (let f = 0; f < frameOf(tThrow); f++) {
      const p = fromP(f / FPS);
      put(f, p, from, p);
    }
    arc(frameOf(tThrow), frameOf(at), fromP(tThrow), catchP, T, kind === 'bounce', tThrow);
    tDribble = at;
    p0 = catchP;
  }
  const dribbleEnd = o.steal ? o.steal.poke : o.gather;
  if (!p0) p0 = null;
  if (p0 && dribbleEnd - tDribble < 0.5) {
    // caught with no time to dribble (a catch and shoot): the ball stays in his hands, brought in to the chest
    for (let f = frameOf(tDribble); f < frameOf(dribbleEnd); f++) {
      const t = f / FPS,
        w = sm((t - tDribble) / 0.18),
        c = chest(off, t),
        p = [p0[0] + (c[0] - p0[0]) * w, p0[1] + (c[1] - p0[1]) * w, p0[2] + (c[2] - p0[2]) * w];
      put(f, p, off, p);
    }
  } else
    dribble(
      off,
      tDribble,
      dribbleEnd,
      p0 || inFrame(o.pos(off, 0), o.yaw(off, 0), [DRIB.side, DRIB.top, DRIB.ahead]),
    );

  if (o.steal) {
    // the poke: the ball knocked from the dribble into the stealer's reach, gathered into his own dribble
    const fp = frameOf(o.steal.poke),
      from = [X[Math.max(0, fp - 1)], Y[Math.max(0, fp - 1)], Z[Math.max(0, fp - 1)]],
      to = inFrame(o.pos(o.def, o.steal.secure), o.yaw(o.def, o.steal.secure), [0.2, 0.9, 0.35]);
    // `from` is the frame before the poke's: the arc leaves from that moment and arrives at the secure moment
    const t0 = Math.max(0, fp - 1) / FPS;
    arc(fp, frameOf(o.steal.secure), from, to, o.steal.secure - t0, from[1] < 0.6, t0);
    o.dribbleMan = i => (i === o.def ? off : o.def);
    dribble(o.def, o.steal.secure, S + 1 / FPS, to);
    return out();
  }

  // ---- the gather (the play's own, in his hands) and the shot ----
  const fg = frameOf(o.gather),
    fr = frameOf(o.release),
    last = [X[Math.max(0, fg - 1)], Y[Math.max(0, fg - 1)], Z[Math.max(0, fg - 1)]];
  // the play's own path into the shot, offset to start where the ball is (in his hands, not the play's low pocket) and
  // converging on it by the release (exact there)
  const a0 = o.exactBall(o.gather),
    off0 = [last[0] - a0[0], last[1] - a0[1], last[2] - a0[2]];
  for (let f = fg; f < fr; f++) {
    const t = f / FPS,
      a = o.exactBall(t),
      k = 1 - sm((t - o.gather) / Math.max(1e-6, o.release - o.gather)),
      p = [a[0] + off0[0] * k, a[1] + off0[1] * k, a[2] + off0[2] * k];
    put(f, p, off, p);
  }
  const rp = o.releasePoint,
    v = {
      x: (o.rim.x - rp.x) / o.flightT,
      y: (o.rim.y - rp.y + 0.5 * g * o.flightT ** 2) / o.flightT,
      z: (o.rim.z - rp.z) / o.flightT,
    },
    flightAt = t => {
      const tau = t - o.release;
      return [rp.x + v.x * tau, rp.y + v.y * tau - 0.5 * g * tau * tau, rp.z + v.z * tau];
    },
    endFlight = o.block ? o.block.hit : o.arrive;
  // through the frame at the rim's moment (the arrival is part of the flight); a block's flight ends where the swat starts
  const fEnd = o.block ? frameOf(endFlight) : Math.floor(endFlight * FPS + 1e-9) + 1;
  for (let f = fr; f < fEnd; f++) put(f, flightAt(f / FPS));

  // ---- a block: swatted, bouncing loose until the winner gathers it; his putback, or he keeps it ----
  if (o.block) {
    const B = o.block,
      fh = frameOf(B.hit),
      contact = flightAt(B.hit),
      // the swat's velocity: the play's own (read off the authored ball just after the contact)
      a1 = o.authoredBall(B.hit + 0.02),
      sv = [
        (a1[0] - contact[0]) / 0.02,
        (a1[1] - contact[1]) / 0.02 + 0.5 * g * 0.02,
        (a1[2] - contact[2]) / 0.02,
      ],
      fc = frameOf(B.catch);
    // swatted: the ball flies from the contact to where the winner is when he gathers it (a blocked shot's direction is
    // not a promise; the contact and who ends with it are), off the floor once on the way when it is a long way
    const W = B.win,
      held = t => {
        // in his hands as the play has them (the authored ball relative to where the play has him), where he is; held out
        // in front of the backboard's plane if he is behind it (his putback must not start behind the board)
        const a = o.exactBall(t), // exact: the 30 Hz table would blend the swat's flight into the hold across the catch
          wa = o.authoredPos(W, t),
          wp = o.pos(W, t),
          p = [a[0] + wp[0] - wa[0], a[1], a[2] + wp[1] - wa[1]],
          lim = o.board - BALL_R - 0.08;
        // in front of the board, fading out past its edge (no jump as he walks out from behind it)
        if (Math.abs(p[0]) > lim) {
          const w = sm((o.boardHalf + 0.6 - Math.abs(p[2])) / 0.4);
          p[0] += (Math.sign(p[0]) * lim - p[0]) * w;
        }
        return p;
      },
      catchAt = held(B.catch),
      far = Math.hypot(catchAt[0] - contact[0], catchAt[2] - contact[2]) > 2.5,
      T = (fc - fh) / FPS;
    // low, off the floor, if a high arc would go through the backboard (the man who gets it is beside or behind it)
    arc(fh, fc, contact, catchAt, T, far || arcHitsBoard(contact, catchAt, T));
    void sv;
    if (!B.kept) {
      for (let f = fc; f < N; f++) {
        const p = held(f / FPS);
        put(f, p, W, p);
      }
      return out();
    }
    // the putback: rises with it, lays it up (the flight starts from his hands and ends exactly at the play's rim)
    const fgo = frameOf(B.go),
      farr = frameOf(B.arr);
    for (let f = fc; f < fgo; f++) {
      const p = held(f / FPS);
      put(f, p, W, p);
    }
    // the putback itself: an arc from his hands to the rim, arriving when the play's does
    const start = held(B.go - 1e-4), // as he held it (at the moment itself the play's ball is its own flight)
      rimAt = o.authoredBall(B.arr);
    arc(fgo, farr, start, [o.rim.x, rimAt[1], o.rim.z], (farr - fgo) / FPS);
    if (B.made) afterRim(farr, true, [o.rim.x, rimAt[1], o.rim.z]);
    else {
      // a missed putback comes off the iron, back the way it came and up, and bounces loose (nobody has it yet)
      const back = [-(o.rim.x - X[farr - 2]) * 8, 2.4, -(o.rim.z - Z[farr - 2]) * 8];
      loose(farr, N, [o.rim.x, rimAt[1], o.rim.z], back);
    }
    return out();
  }
  afterRim(Math.floor(o.arrive * FPS + 1e-9) + 1, o.points > 0, [o.rim.x, o.rim.y, o.rim.z]);
  return out();

  /* At the rim: a make drops through the net (a swish, or a rattle on the back of the rim first) and bounces on the
     floor; a miss caroms (a clank, a long one off the floor, or a roll round the rim and off) and comes down into the
     rebounder's hands on the rebound spot as the play ends. */
  function afterRim(fa, made, at) {
    const side = Math.sign(o.rim.x) || 1;
    if (made) {
      let p = [...at];
      const rattle = r() < 0.3;
      let f = fa;
      if (rattle) {
        // onto the back of the rim and up a little, then down through
        for (; f < Math.min(N, fa + 9); f++) {
          const u = (f - fa) / 9;
          put(f, [at[0] + side * 0.11 * Math.sin(u * Math.PI), at[1] + 0.1 * Math.sin(u * Math.PI), at[2]]);
        }
        p = [at[0], at[1], at[2]];
      }
      // the net: it slows the ball to 3 units/s for 0.12 s, then it drops out and bounces
      const fn = Math.min(N, f + Math.round(0.12 * FPS));
      for (let k = f; k < fn; k++) put(k, [p[0], p[1] - 3 * ((k - f) / FPS), p[2]]);
      loose(fn, N, [p[0], p[1] - 0.36, p[2]], [-side * 0.5, -3, 0.25 * (o.lane || 1)]);
      return;
    }
    // a miss: into the rebounder's hands on the spot as the play ends
    const q = [o.land.x, o.land.y, o.land.z],
      kind = r(),
      fe = N - 1,
      tSecure = Math.max(fa + 6, fe - 6);
    let f = fa,
      from = [...at];
    if (kind < 0.25) {
      // rolls round the rim (a quarter turn) and drops off its edge
      const ang0 = Math.atan2(q[2] - at[2], q[0] - at[0]) + Math.PI / 2,
        R = 0.246 + BALL_R * 0.4,
        fr2 = Math.min(fe - 20, fa + 15);
      for (; f < fr2; f++) {
        const u = (f - fa) / (fr2 - fa),
          a = ang0 - (Math.PI / 2) * u;
        put(f, [o.rim.x + Math.cos(a) * R * sm(u * 3), at[1] + 0.03, o.rim.z + Math.sin(a) * R * sm(u * 3)]);
      }
      from = [X[f - 1], Y[f - 1], Z[f - 1]];
    }
    arc(f, tSecure, from, q, (tSecure - f) / FPS, kind > 0.7);
    for (let k = tSecure; k < N; k++) put(k, q, o.rebounder, q);
  }

  function out() {
    // anything not written (cannot happen in a play; a guard): where the frame before was
    for (let f = 1; f < N; f++)
      if (X[f] === 0 && Y[f] === 0 && Z[f] === 0) put(f, [X[f - 1], Y[f - 1], Z[f - 1]]);
    return {
      frames: N,
      x: X,
      y: Y,
      z: Z,
      holder: HOLD,
      held: HELD,
      handX: HX,
      handY: HY,
      handZ: HZ,
      dribbleY: DY,
      dribbling: DRB,
      moves,
    };
  }
}
