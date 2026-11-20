// Physical movement for a play (motion version 3; presentation only, like the rest of the 3D). The authored play
// (basketball.js sampleClip as version 2: where each player means to be, and when) becomes an intention that every player
// follows with a body's limits: top speed, acceleration that tapers as he speeds up, braking, a turn radius that grows
// with speed, and a jerk limit (no instant change of acceleration), so players visibly accelerate out of a stop, round
// their cuts, plant and brake. Defenders react a moment late (0.15-0.25 s). Each player's limits vary a little, seeded
// from the play, guards quicker than bigs. Nobody passes through anybody (a soft push and a hard floor on distance).
//
// The play's promises stay exact: the shooter runs his authored route on an acceleration-limited speed profile that reaches
// the release spot at the release moment (the route is a smooth curve already); players the play needs somewhere at a
// moment (a block's leap and the two going for the loose ball, the rebounder, the stealer, a passer) are blended back to
// the authored spot around that moment (anchorWeight), from the exact authored pose at the time asked.
//
// Pure from the caller's side: simulatePlay(clip) depends only on the clip's fields, runs once per play at a fixed 60 Hz
// step and is cached; sampleClip interpolates it. Units: game units (1 unit = 0.929 m) and seconds.

export const SIM_FPS = 60;
export { GAP };
const M = 0.929, // metres per unit
  MS = v => v / M; // m/s (or m/s^2, m/s^3) to units
/* Each slot's body (0 the ball handler and guards ... 4 the big), in m/s and m/s^2: top speed, acceleration from a
   standstill, braking at a plant, the sideways grip that sets the turn radius (r = v^2 / lateral). */
const BODY = [
  { top: 8.3, acc: 5.8, brake: 8.5, lat: 7.5 },
  { top: 8.1, acc: 5.6, brake: 8.3, lat: 7.3 },
  { top: 7.9, acc: 5.4, brake: 8.2, lat: 7.1 },
  { top: 7.6, acc: 5.1, brake: 7.8, lat: 6.8 },
  { top: 7.2, acc: 4.7, brake: 7.4, lat: 6.4 },
];
export const JERK = 110; // m/s^3: how fast a player's acceleration can change (a plant takes about a tenth of a second)
const COURT = { x: 13.85, z: 7.9 }, // units: the baselines (5.25 ft behind the rims) and sidelines
  SPACING = 1.9, // units: how far a teammate stays off the ball handler
  SLACK = 0.012, // units: how far two may press into each other's space before the floor moves them (QA allows 0.02)
  EFFORT = 11.8, // units/s^2 (11 m/s^2): the most a player's legs can change his velocity, all forces together
  PUSH = 11, // units/s^2: the push off a player at the closest he may come (a firm shove; it rises smoothly from 0.6 out)
  LOOK = 0.3, // s: how far ahead of now a player aims along where the play wants him (he cuts corners, like a person)
  STEER = 0.22, // s: how quickly he closes the gap between his velocity and the one he wants
  GAP = 0.95; // units: the closest two players come (motion.js SPACE.min); a declared contact (gapOf) may come closer

/* A small hash of a string to a seed, and a seeded RNG (mulberry32): the same play always gets the same players. */
function seedOf(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
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
/* The key a play's motion depends on (the fields sampleClip reads). */
export const playKey = c =>
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

/* Each player's limits for a play, in units: slot body, seeded +-5% top speed and +-8% acceleration, and a reaction lag for
   defenders (seconds). */
export function playersOf(c, offense) {
  const r = rng(seedOf(playKey(c)));
  return Array.from({ length: 10 }, (_, i) => {
    const k = i % 5,
      b = BODY[k],
      fast = 0.95 + r() * 0.1,
      quick = 0.92 + r() * 0.16;
    return {
      top: MS(b.top * fast),
      acc: MS(b.acc * quick),
      brake: MS(b.brake * quick),
      lat: MS(b.lat),
      lag: i >= offense && i < offense + 5 ? 0 : 0.15 + r() * 0.1,
    };
  });
}

/* ---- the shooter's run: his authored route at an acceleration-limited speed ----
   A time-optimal speed along the route (a forward and a backward pass in distance: accelerate as hard as the body allows,
   brake to stop at the end, slow where the route bends so the sideways pull stays within the grip), capped at the speed
   that makes the whole run take exactly `T` seconds (found by bisection), then smoothed in time so acceleration changes
   gradually. Returns position along the route against time: s(t), 0 at t = 0, the route's length at t >= T. */
export function runProfile(route, T, body, { v0 = 0 } = {}) {
  const n = route.length,
    cum = [0];
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const L = cum[n - 1];
  if (L < 1e-3 || T <= 0) return () => 0;
  // the route's radius of curvature at each point (from three neighbours)
  const radius = route.map((p, i) => {
    if (i === 0 || i === n - 1) return Infinity;
    const a = route[i - 1],
      c = route[i + 1],
      ab = Math.hypot(p[0] - a[0], p[1] - a[1]),
      bc = Math.hypot(c[0] - p[0], c[1] - p[1]),
      ca = Math.hypot(c[0] - a[0], c[1] - a[1]),
      cross = Math.abs((p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0]));
    return cross < 1e-9 ? Infinity : (ab * bc * ca) / (2 * cross);
  });
  const STEPS = 240,
    ds = L / STEPS,
    rAt = s => {
      let i = 1;
      while (i < n - 1 && cum[i] < s) i++;
      return Math.min(radius[i - 1], radius[i]);
    },
    // the bend's speed limit at each step, worked out once (half the grip: the smoothing below lifts speed back into it)
    bendCap = Float64Array.from({ length: STEPS + 1 }, (_, k) => Math.sqrt(0.5 * body.lat * rAt(k * ds))),
    profile = cap => {
      const v = new Float64Array(STEPS + 1);
      for (let k = 0; k <= STEPS; k++) v[k] = Math.min(cap, bendCap[k]);
      v[0] = Math.min(v0, v[0]);
      v[STEPS] = 0;
      for (let k = 1; k <= STEPS; k++) {
        const taper = Math.max(0.2, 1 - v[k - 1] / body.top);
        v[k] = Math.min(v[k], Math.sqrt(v[k - 1] ** 2 + 2 * body.acc * taper * ds));
      }
      for (let k = STEPS - 1; k >= 0; k--)
        v[k] = Math.min(v[k], Math.sqrt(v[k + 1] ** 2 + 2 * 0.7 * body.brake * ds));
      let t = 0;
      const ts = [0];
      for (let k = 1; k <= STEPS; k++) {
        const vm = (v[k] + v[k - 1]) / 2;
        t += ds / Math.max(vm, 1e-3);
        ts.push(t);
      }
      return ts;
    };
  // the slowest cap that still finishes in T (a faster cap finishes sooner); beyond the body's top speed, the top speed
  let lo = 0.2,
    hi = body.top,
    ts = profile(hi);
  if (ts[STEPS] > T) {
    // too far for the time at his top speed: run at the speed it takes (rare: the authored routes fit)
    hi = (body.top * ts[STEPS]) / T;
    ts = profile(hi);
  } else {
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2,
        tm = profile(mid);
      if (tm[STEPS] > T) lo = mid;
      else hi = mid;
    }
    ts = profile(hi);
  }
  // speed against time on the 60 Hz grid (stretched to end exactly at T), then smoothed with the player at rest before
  // the start and after the end (a 0.18 s window, twice), and integrated back to distance, scaled to end at L: the
  // acceleration changes gradually and he starts and stops without a jolt
  const F = Math.round(T * SIM_FPS),
    k0 = ts[STEPS] / T,
    s = new Float64Array(F + 1);
  for (let f = 0, k = 0; f <= F; f++) {
    const t = (f / SIM_FPS) * k0;
    while (k < STEPS - 1 && ts[k + 1] < t) k++;
    const u = Math.min(1, Math.max(0, (t - ts[k]) / Math.max(1e-9, ts[k + 1] - ts[k])));
    s[f] = (k + u) * ds;
  }
  let v = new Float64Array(F);
  for (let f = 0; f < F; f++) v[f] = s[f + 1] - s[f];
  const before = v0 / SIM_FPS; // what he was doing before the play: at rest, or (a fast break) already running
  const w = Math.max(1, Math.round(0.09 * SIM_FPS));
  for (let pass = 0; pass < 2; pass++) {
    const src = v,
      out = new Float64Array(F);
    for (let f = 0; f < F; f++) {
      let sum = 0;
      for (let d = -w; d <= w; d++) {
        const g = f + d;
        if (g >= 0 && g < F) sum += src[g];
        else if (g < 0) sum += before;
      }
      out[f] = sum / (2 * w + 1);
    }
    v = out;
  }
  // the last 0.2 s ease to rest (the smoothing leaves a little speed in the last frames, a jolt as he stops)
  const ease = Math.round(0.25 * SIM_FPS);
  for (let f = Math.max(0, F - ease); f < F; f++) {
    const x = (F - f) / ease;
    v[f] *= x * x * x * (x * (6 * x - 15) + 10);
  }
  const smooth = new Float64Array(F + 1);
  for (let f = 0; f < F; f++) smooth[f + 1] = smooth[f] + v[f];
  const S0 = smooth[F] || 1;
  for (let f = 0; f <= F; f++) smooth[f] = (smooth[f] * L) / S0;
  runProfile.stretch = k0; // > 1: the route does not fit in T within the body's limits (its accelerations scale by k0^2)
  return t => {
    const x = Math.min(F, Math.max(0, t * SIM_FPS)),
      f = Math.floor(x),
      u = x - f;
    return f >= F ? L : smooth[f] + (smooth[f + 1] - smooth[f]) * u;
  };
}
/* A route with its corners rounded (Chaikin's corner cutting, `n` times; the two ends stay where they are): only the end of
   the shooter's run is a promise (the release spot), and a crossover's zig-zag taken at the authored pace asks more grip
   than a body has. */
export function roundCorners(route, n = 3) {
  let r = route;
  for (let k = 0; k < n; k++) {
    const out = [r[0]];
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i],
        b = r[i + 1];
      if (i > 0) out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      if (i < r.length - 2) out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(r[r.length - 1]);
    r = out;
  }
  return r;
}
/* The point at distance s along a route. */
export function along(route, s) {
  let d = Math.max(0, s);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === route.length - 1) {
      const u = l ? Math.min(1, d / l) : 0;
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    }
    d -= l;
  }
  return route[0];
}

/* ---- the simulation ----
   authored(t) -> {actors} (the version-2 pose; called at 30 Hz), shooterAt(t) -> [x, z] (his run, exact),
   anchors[i] = [[t0, t1]...] windows (seconds): player i must be at the authored spot by t0 and stay there to t1 (he gets
   there by running, going early if he has to), gapOf(i, j, t) -> the closest the two may come (GAP, or less for a declared
   contact: the contest, a block, a steal's reach, a screen). Returns {frames, x, z, vx, vz, ax,
   az} with arrays of frames x 10. */
export function simulatePlay({
  duration,
  authored,
  shooter,
  shooterAt,
  shooterUntil = Infinity,
  chase = null,
  offense,
  players,
  anchors,
  gapOf,
}) {
  const N = Math.round(duration * SIM_FPS) + 1,
    dt = 1 / SIM_FPS,
    TG = 30, // the authored pose is sampled at 30 Hz and interpolated (it is smooth, and sampling it is the cost)
    NT = Math.round(duration * TG) + 1,
    gx = new Float64Array(NT * 10),
    gz = new Float64Array(NT * 10);
  for (let k = 0; k < NT; k++) {
    const A = authored(Math.min(duration, k / TG)).actors;
    for (let i = 0; i < 10; i++) {
      gx[k * 10 + i] = A[i].x;
      gz[k * 10 + i] = A[i].z;
    }
  }
  const goal = (i, t, out) => {
    const x = Math.min(NT - 1, Math.max(0, t * TG)),
      k = Math.min(NT - 2, Math.floor(x)),
      u = x - k;
    out[0] = gx[k * 10 + i] + (gx[(k + 1) * 10 + i] - gx[k * 10 + i]) * u;
    out[1] = gz[k * 10 + i] + (gz[(k + 1) * 10 + i] - gz[k * 10 + i]) * u;
    // his teammates space off the ball handler: a spot within 1.5 of where he is (or will finish) moves out to 1.5, on
    // the same side (a cutter clears the driver's lane instead of standing in it)
    if (shooterAt && i !== shooter && i >= offense && i < offense + 5 && t <= shooterUntil) {
      const [sx, sz] = shooterAt(t),
        ex = out[0] - sx,
        ez = out[1] - sz,
        d = Math.hypot(ex, ez);
      if (d < SPACING) {
        const nx = d > 1e-4 ? ex / d : 1,
          nz = d > 1e-4 ? ez / d : 0;
        out[0] = sx + nx * SPACING;
        out[1] = sz + nz * SPACING;
      }
    }
    return out;
  };
  const X = new Float32Array(N * 10),
    Z = new Float32Array(N * 10),
    VX = new Float32Array(N * 10),
    VZ = new Float32Array(N * 10),
    AX = new Float32Array(N * 10),
    AZ = new Float32Array(N * 10),
    px = new Float64Array(10),
    pz = new Float64Array(10),
    vx = new Float64Array(10),
    vz = new Float64Array(10),
    ax = new Float64Array(10),
    az = new Float64Array(10),
    g = [0, 0],
    q = [0, 0],
    ext = [0, 0],
    pinned = new Float64Array(10),
    jmax = MS(JERK) * dt;
  for (let i = 0; i < 10; i++) {
    goal(i, 0, g);
    px[i] = g[0];
    pz[i] = g[1];
  }
  // everyone starts the play moving as the play has him moving (the run before it), not from a standstill
  for (let i = 0; i < 10; i++) {
    goal(i, 0, g);
    goal(i, 0.1, q);
    vx[i] = (q[0] - g[0]) / 0.1;
    vz[i] = (q[1] - g[1]) / 0.1;
    const sp = Math.hypot(vx[i], vz[i]);
    if (sp > players[i].top) {
      vx[i] *= players[i].top / sp;
      vz[i] *= players[i].top / sp;
    }
  }
  if (shooterAt) {
    [px[shooter], pz[shooter]] = shooterAt(0);
    const [x1, z1] = shooterAt(dt);
    vx[shooter] = (x1 - px[shooter]) / dt;
    vz[shooter] = (z1 - pz[shooter]) / dt;
  }
  // where the play starts them, apart (a defender placed on his man's guard spot can stand in him): no shove on frame one
  for (let it = 0; it < 12; it++)
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++) {
        const gap = gapOf(i, j, 0),
          ex = px[j] - px[i],
          ez = pz[j] - pz[i],
          d = Math.hypot(ex, ez) || 1e-6;
        if (d >= gap) continue;
        const wi = i === shooter ? 0 : 1,
          wj = j === shooter ? 0 : 1,
          sum = wi + wj || 1,
          push = gap - d;
        px[i] -= (ex / d) * push * (wi / sum);
        pz[i] -= (ez / d) * push * (wi / sum);
        px[j] += (ex / d) * push * (wj / sum);
        pz[j] += (ez / d) * push * (wj / sum);
      }
  const anchorAt = (i, t) => {
    let w = 0;
    for (const [a, b] of anchors[i] || []) w = Math.max(w, windowWeight(t, a, b, duration));
    return w;
  };
  for (let f = 0; f < N; f++) {
    const t = f * dt;
    if (f > 0) {
      for (let i = 0; i < 10; i++) {
        const P = players[i];
        if (i === shooter && t <= shooterUntil) {
          const [x, z] = shooterAt(t),
            nvx = (x - px[i]) / dt,
            nvz = (z - pz[i]) / dt;
          ax[i] = (nvx - vx[i]) / dt;
          az[i] = (nvz - vz[i]) / dt;
          vx[i] = nvx;
          vz[i] = nvz;
          px[i] = x;
          pz[i] = z;
          continue;
        }
        // where the play wants him a moment from now (later for a defender: he reacts to what he saw); near an anchor,
        // where the play needs him, now, with no lag
        const anc = anchorAt(i, t);
        let look = LOOK,
          dvx,
          dvz;
        // a defender reacts late: he acts on where the play had him heading P.lag ago, carried on at that speed (late on
        // every change of direction, not behind on a straight run)
        if (P.lag > 0) {
          const seen = Math.max(0, t - P.lag);
          goal(i, seen, g);
          goal(i, Math.max(0, seen - 0.1), q);
          const k = P.lag / 0.1; // carried on over the lag only (further, and he overshoots every stop in loops)
          q[0] = g[0] + (g[0] - q[0]) * k;
          q[1] = g[1] + (g[1] - q[1]) * k;
          // and from there, where the play takes him in the next `look` (as for anyone)
          goal(i, seen + look, g);
          goal(i, seen, ext);
          q[0] += g[0] - ext[0];
          q[1] += g[1] - ext[1];
        } else goal(i, t + look, q);
        // after a steal the robbed shooter turns and chases the man who took it: a step behind him, on his heels
        if (chase && i === chase.who && t > chase.from) {
          const j = chase.target,
            sp = Math.hypot(vx[j], vz[j]) || 1;
          q[0] = px[j] - (vx[j] / sp) * 1.3 + vx[j] * look;
          q[1] = pz[j] - (vz[j] / sp) * 1.3 + vz[j] * look;
        }
        // a spot the play needs him at: inside its window, the spot now; before it, if getting there in time takes more
        // than a third of his top speed from here, the spot (he reads the play and goes early). Either way he arrives the
        // way a body does: as fast as he can while still able to brake to a stop on it
        let target = null;
        if (anc >= 1) target = goal(i, t, g);
        else
          for (const [a] of anchors[i] || [])
            if (a > t) {
              goal(i, a, g);
              const need = Math.hypot(g[0] - px[i], g[1] - pz[i]) / Math.max(0.05, a - t);
              if (need > 0.33 * P.top || anc > 0) target = g;
              break;
            }
        if (target) {
          const ex = target[0] - px[i],
            ez = target[1] - pz[i],
            d = Math.hypot(ex, ez),
            sp = Math.min(P.top, Math.sqrt(2 * 0.7 * P.brake * d), d / 0.12);
          dvx = d > 1e-6 ? (ex / d) * sp : 0;
          dvz = d > 1e-6 ? (ez / d) * sp : 0;
        } else {
          dvx = (q[0] - px[i]) / look;
          dvz = (q[1] - pz[i]) / look;
        }
        const dv = Math.hypot(dvx, dvz);
        if (dv > P.top) {
          dvx *= P.top / dv;
          dvz *= P.top / dv;
        }
        let rx = 0,
          rz = 0;
        // the others: a soft push from anyone close, and steering round anyone he would run into in the next 0.8 s (the
        // time and distance of their closest approach at the speeds they have now): he goes round on the side he is
        // already on, and eases off, the way people avoid each other without touching
        for (let j = 0; j < 10; j++) {
          if (j === i) continue;
          const ex = px[i] - px[j],
            ez = pz[i] - pz[j],
            d = Math.hypot(ex, ez),
            gap = gapOf(i, j, t),
            // the push starts where he would have to start braking to stop short of him (plus 0.6): at a run that is
            // well out, standing next to him it is close
            closing = Math.max(0, -((vx[i] - vx[j]) * ex + (vz[i] - vz[j]) * ez) / (d || 1)),
            reach = gap + 0.6 + (closing * closing) / (2 * 0.5 * P.brake);
          if (d < reach && d > 1e-6) {
            // a body pushing off another is a force, not a change of plan: an acceleration away that rises smoothly as
            // they close (zero at reach, PUSH at the gap), added after the jerk limit
            const x = Math.min(1, (reach - d) / (reach - gap)),
              k = PUSH * x * x * (3 - 2 * x);
            rx += (ex / d) * k;
            rz += (ez / d) * k;
          }
          // the shooter's run is known: dodge where he will be (sampled every 0.1 s for a second), not a straight guess
          if (j === shooter && t <= shooterUntil && shooterAt) {
            let hit = -1;
            for (let k = 1; k <= 10 && hit < 0; k++) {
              const tk = t + k * 0.1,
                [sx2, sz2] = shooterAt(tk),
                mx = px[i] + dvx * k * 0.1 - sx2,
                mz = pz[i] + dvz * k * 0.1 - sz2;
              if (Math.hypot(mx, mz) < gap + 0.5) hit = k;
            }
            if (hit > 0) {
              const [sx2, sz2] = shooterAt(t + hit * 0.1),
                [sx1, sz1] = shooterAt(t + hit * 0.1 - 0.05),
                hx = sx2 - sx1,
                hz = sz2 - sz1,
                hl = Math.hypot(hx, hz) || 1,
                // step off his line, to the side he is already on
                sideSign = Math.sign(((px[i] - sx2) * -hz) / hl + ((pz[i] - sz2) * hx) / hl) || 1,
                urgency = 1 - (hit - 1) / 10;
              dvx += (-hz / hl) * sideSign * urgency * P.top;
              dvz += (hx / hl) * sideSign * urgency * P.top;
            }
            continue;
          }
          const rvx = dvx - vx[j],
            rvz = dvz - vz[j],
            rv2 = rvx * rvx + rvz * rvz;
          if (rv2 < 1e-6) continue;
          const tc = -(ex * rvx + ez * rvz) / rv2; // when they are closest
          if (tc <= 0 || tc > 1) continue;
          const cx = ex + rvx * tc,
            cz = ez + rvz * tc,
            miss = Math.hypot(cx, cz),
            want = gap + 0.35;
          if (miss >= want) continue;
          // sideways, away from where he would meet him, harder the sooner and the closer
          const urgency = (1 - tc / 1) * (1 - miss / want),
            sx = miss > 1e-4 ? cx / miss : -rvz / Math.sqrt(rv2),
            sz = miss > 1e-4 ? cz / miss : rvx / Math.sqrt(rv2);
          dvx += sx * urgency * P.top * 0.9;
          dvz += sz * urgency * P.top * 0.9;
          dvx -= (rvx / Math.sqrt(rv2)) * urgency * Math.sqrt(rv2) * 0.35;
          dvz -= (rvz / Math.sqrt(rv2)) * urgency * Math.sqrt(rv2) * 0.35;
        }
        // the court: a push back in from the baselines and sidelines (nobody runs out of bounds to make room)
        const wx = Math.abs(px[i]) - (COURT.x - 0.6),
          wz = Math.abs(pz[i]) - (COURT.z - 0.6);
        if (wx > 0) rx -= Math.sign(px[i]) * PUSH * Math.min(1, wx / 0.6) ** 2;
        if (wz > 0) rz -= Math.sign(pz[i]) * PUSH * Math.min(1, wz / 0.6) ** 2;
        let wax = (dvx - vx[i]) / STEER,
          waz = (dvz - vz[i]) / STEER;
        // along and across his motion: speed up within the tapering acceleration, slow down within the braking, turn
        // within the grip
        const sp = Math.hypot(vx[i], vz[i]);
        let ux = sp > 0.05 ? vx[i] / sp : wax,
          uz = sp > 0.05 ? vz[i] / sp : waz;
        const ul = Math.hypot(ux, uz) || 1;
        ux /= ul;
        uz /= ul;
        let al = wax * ux + waz * uz,
          nx = wax - al * ux,
          nz = waz - al * uz;
        al = al > 0 ? Math.min(al, P.acc * Math.max(0.25, 1 - sp / P.top)) : Math.max(al, -P.brake);
        const an = Math.hypot(nx, nz);
        if (an > P.lat) {
          nx *= P.lat / an;
          nz *= P.lat / an;
        }
        wax = al * ux + nx;
        waz = al * uz + nz;
        // the jerk limit: acceleration changes at most JERK per second
        let jx = wax - ax[i],
          jz = waz - az[i];
        const jl = Math.hypot(jx, jz);
        if (jl > jmax) {
          jx *= jmax / jl;
          jz *= jmax / jl;
        }
        ax[i] += jx;
        az[i] += jz;
        // what he does and the push he gets share one body: the total is capped at a firm effort
        let tx = ax[i] + rx,
          tz = az[i] + rz;
        const tl = Math.hypot(tx, tz);
        if (tl > EFFORT) {
          tx *= EFFORT / tl;
          tz *= EFFORT / tl;
        }
        vx[i] += tx * dt;
        vz[i] += tz * dt;
        const s2 = Math.hypot(vx[i], vz[i]);
        if (s2 > P.top) {
          vx[i] *= P.top / s2;
          vz[i] *= P.top / s2;
        }
        px[i] += vx[i] * dt;
        pz[i] += vz[i] * dt;
      }
      // the hard floor: two players closer than they may be are moved apart, the one held to the play (the shooter, a
      // player at an anchor) staying put; velocities lose the closing part
      for (let i = 0; i < 10; i++) pinned[i] = i === shooter && t <= shooterUntil ? 1 : 0.85 * anchorAt(i, t);
      for (let it = 0; it < 3; it++)
        for (let i = 0; i < 10; i++)
          for (let j = i + 1; j < 10; j++) {
            const gap = gapOf(i, j, t),
              ex = px[j] - px[i],
              ez = pz[j] - pz[i],
              d = Math.hypot(ex, ez);
            if (d >= gap - SLACK || d < 1e-9) continue; // a real overlap only: pressing at the gap is the push's job
            // a third of the overlap a frame (bodies press, they do not teleport apart)
            const push = gap - SLACK - d,
              wi = 1 - pinned[i],
              wj = 1 - pinned[j],
              sum = wi + wj;
            if (sum < 1e-6) continue;
            const nx = ex / d,
              nz = ez / d;
            if (simulatePlay.debug) simulatePlay.debug.push([f, i, j, push]);
            px[i] -= nx * push * (wi / sum);
            pz[i] -= nz * push * (wi / sum);
            px[j] += nx * push * (wj / sum);
            pz[j] += nz * push * (wj / sum);
            const closing = (vx[j] - vx[i]) * nx + (vz[j] - vz[i]) * nz;
            if (closing < 0) {
              vx[i] += nx * closing * (wi / sum);
              vz[i] += nz * closing * (wi / sum);
              vx[j] -= nx * closing * (wj / sum);
              vz[j] -= nz * closing * (wj / sum);
            }
          }
    } else if (shooterAt) {
      const [x, z] = shooterAt(0);
      px[shooter] = x;
      pz[shooter] = z;
    }
    for (let i = 0; i < 10; i++) {
      const o = f * 10 + i;
      X[o] = px[i];
      Z[o] = pz[i];
      VX[o] = vx[i];
      VZ[o] = vz[i];
      AX[o] = ax[i];
      AZ[o] = az[i];
    }
  }
  // a last smoothing of every path but the shooter's (a Gaussian of 0.05 s, both ways in time, the ends extended in a
  // straight line): the odd one-frame correction where two bodies met becomes a few frames of give instead of a jolt.
  // Velocity and acceleration are read back from the smoothed path
  const sigma = 0.05 * SIM_FPS,
    R = Math.ceil(3 * sigma),
    kern = Array.from({ length: 2 * R + 1 }, (_, k) => Math.exp(-((k - R) ** 2) / (2 * sigma * sigma))),
    ksum = kern.reduce((a, b) => a + b, 0),
    tmp = new Float64Array(N);
  for (const arr of [X, Z])
    for (let i = 0; i < 10; i++) {
      // the shooter keeps his exact run (after a steal he is a free player, and his whole path is smoothed: his run before
      // it is smooth already, and smoothing only after it would leave a kink where it ends)
      if (i === shooter && shooterUntil >= duration) continue;
      const at = f =>
        f < 0
          ? 2 * arr[i] - arr[Math.min(N - 1, -f) * 10 + i]
          : f >= N
            ? 2 * arr[(N - 1) * 10 + i] - arr[Math.max(0, 2 * (N - 1) - f) * 10 + i]
            : arr[f * 10 + i];
      for (let f = 0; f < N; f++) {
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += at(f + k) * kern[k + R];
        tmp[f] = sum / ksum;
      }
      for (let f = 0; f < N; f++) arr[f * 10 + i] = tmp[f];
    }
  for (let i = 0; i < 10; i++)
    for (let f = 0; f < N; f++) {
      const o = f * 10 + i,
        a = Math.max(0, f - 1),
        b = Math.min(N - 1, f + 1);
      VX[o] = ((X[b * 10 + i] - X[a * 10 + i]) / (b - a)) * SIM_FPS;
      VZ[o] = ((Z[b * 10 + i] - Z[a * 10 + i]) / (b - a)) * SIM_FPS;
    }
  for (let i = 0; i < 10; i++)
    for (let f = 0; f < N; f++) {
      const o = f * 10 + i,
        a = Math.max(0, f - 1),
        b = Math.min(N - 1, f + 1);
      AX[o] = ((VX[b * 10 + i] - VX[a * 10 + i]) / (b - a)) * SIM_FPS;
      AZ[o] = ((VZ[b * 10 + i] - VZ[a * 10 + i]) / (b - a)) * SIM_FPS;
    }
  return { frames: N, x: X, z: Z, vx: VX, vz: VZ, ax: AX, az: AZ };
}
/* How much of a window [a, b] (seconds) holds at time t: 0 well before, 1 inside, easing in over the 0.45 s before it and
   out over the 0.35 s after it (smootherstep: no jump in speed or acceleration), and held to the end of the play if the
   window runs to it. */
export function windowWeight(t, a, b, duration) {
  const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
  if (t >= a && t <= b) return 1;
  if (t < a) return ease(1 - (a - t) / 0.45);
  return b >= duration - 1e-6 ? 1 : ease(1 - (t - b) / 0.35);
}
