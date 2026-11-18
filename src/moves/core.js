// Ball-handling moves ("set pieces"): what the ball, the hands, the feet and the body do, as data plus physics. Pure: no
// Three.js and no DOM, so every move can be checked in Node (tests/moves.test.js) and reused anywhere (the title screen
// today; a play's ball handler later). src/moves/README.md explains how to write one.
//
// Space. A move is written in its BASE frame: origin on the floor under the player where the move starts, +z the way he
// faces, +x his LEFT, +y up, in game units (1 ft = 0.33). Ball heights are ball-centre heights in the plays' convention
// (BALL.floor 0.3 = touching the floor; the drawn 24 cm ball is lowered near the floor by ballDrop).
// The BODY frame is the base frame moved by the body track (x, y, z offset and yaw): a hand or a held ball written in the
// body frame turns and travels with him (a spin move); one written in the base frame stays put (a foot, a bounce spot).
//
// Moves are written for the RIGHT hand starting (ball at his right hip, x < 0) and mirrored for the left (mirrorMove).
// Every move starts and ends with the ball arriving at the top of a dribble in its start / end hand (topOf), the hands and
// feet in the ready stance and the body square, so any move can follow any other.
import { BALL, DRIBBLE, launch } from '../basketball.js';

export const BALL_R = 0.13; // the drawn ball's radius
export const PALM = BALL_R + 0.07; // wrist target to ball centre with the hand on the ball
/* Where he dribbles with the right hand: beside the right hip, a little ahead. */
export const POCKET = { x: -0.36, z: 0.24 };
/* Planted feet in the ready stance between moves: [x, z, yaw], square, a little wider than the hips (moves that want a
   stagger step into it and back out). */
export const STANCE = { R: [-0.17, 0.03, 0], L: [0.17, 0.03, 0] };
/* The off hand held out front to protect the ball (wrist target, body frame). */
export const GUARD = { R: [-0.28, 1.2, 0.32], L: [0.28, 1.2, 0.32] };
/* The ball at the top of the dribble in hand h, and the hand on it (base frame, body square). */
export const topOf = h => [h === 'L' ? -POCKET.x : POCKET.x, DRIBBLE.top, POCKET.z];
export const handOn = (ball, n = [0, 1, 0], off = PALM) => add(ball, mul(norm(n), off));

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => ((x = clamp(x)), x * x * (3 - 2 * x));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map(v => v * k);
const len = a => Math.hypot(...a);
const norm = a => {
  const l = len(a);
  return l > 1e-9 ? mul(a, 1 / l) : [0, 1, 0];
};
const lerpA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
/* Rotate [x, y, z] about +y by yaw (Three.js rotation.y: +z turns toward +x). */
const yawRot = (p, yaw) => {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};

/* ---- Interpolation ----
   A track through keys [{t, v}] (v a number or an array): a piecewise cubic through every key with shape-preserving
   tangents (PCHIP: no overshoot between keys, so a hand never swings past where it was sent and a ball never dips through
   the floor). The first and last tangents are zero (eases in and out) unless ends {d0, d1} gives them (units per second).
   Outside the keys it holds the end values. */
export function track(keys, ends = {}) {
  if (!keys?.length) return () => undefined;
  const ks = [...keys].sort((a, b) => a.t - b.t),
    ts = ks.map(k => k.t),
    isArr = Array.isArray(ks[0].v),
    dims = isArr ? ks[0].v.length : 1,
    n = ks.length,
    val = (i, j) => (isArr ? ks[i].v[j] : ks[i].v),
    end = (d, j) => (d == null ? 0 : Array.isArray(d) ? d[j] : d);
  const M = [];
  for (let j = 0; j < dims; j++) {
    const m = new Array(n).fill(0),
      h = [],
      del = [];
    for (let i = 0; i < n - 1; i++) {
      h.push(Math.max(1e-6, ts[i + 1] - ts[i]));
      del.push((val(i + 1, j) - val(i, j)) / h[i]);
    }
    for (let i = 1; i < n - 1; i++) {
      if (del[i - 1] * del[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * h[i] + h[i - 1],
          w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / del[i - 1] + w2 / del[i]);
      }
    }
    m[0] = end(ends.d0, j);
    m[n - 1] = end(ends.d1, j);
    M.push(m);
  }
  return t => {
    if (n === 1 || t <= ts[0]) return isArr ? [...ks[0].v] : ks[0].v;
    if (t >= ts[n - 1]) return isArr ? [...ks[n - 1].v] : ks[n - 1].v;
    let i = 0;
    while (i < n - 2 && t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i],
      u = (t - ts[i]) / h,
      h00 = 2 * u ** 3 - 3 * u ** 2 + 1,
      h10 = u ** 3 - 2 * u ** 2 + u,
      h01 = -2 * u ** 3 + 3 * u ** 2,
      h11 = u ** 3 - u ** 2,
      at = j => h00 * val(i, j) + h10 * h * M[j][i] + h01 * val(i + 1, j) + h11 * h * M[j][i + 1];
    return isArr ? Array.from({ length: dims }, (_, j) => at(j)) : at(0);
  };
}

/* ---- Ball physics ---- */
const arc = (p, v, tau) => [
  p[0] + v[0] * tau,
  p[1] + v[1] * tau - 0.5 * BALL.g * tau * tau,
  p[2] + v[2] * tau,
];
const arcV = (v, tau) => [v[0], v[1] - BALL.g * tau, v[2]];
const L3 = (p, q, T) => {
  const v = launch({ x: p[0], y: p[1], z: p[2] }, { x: q[0], y: q[1], z: q[2] }, T);
  return [v.x, v.y, v.z];
};
/* A free flight from p0 to p1 in T seconds, through one bounce at floor point [bx, bz] or none. With a bounce, the moment it
   hits the floor is chosen so the bounce keeps BALL.bounce of the vertical speed (a real floor) when that is possible; `e`
   reports the restitution it really has (the tests check it is believable). Returns {at(tau) -> {p, v}, v0, v1, e, hit}. */
export function freeFlight(p0, p1, T, bounce = null) {
  if (!bounce) {
    const v0 = L3(p0, p1, T);
    return {
      at: tau => ({ p: arc(p0, v0, tau), v: arcV(v0, tau) }),
      v0,
      v1: arcV(v0, T),
      e: null,
      hit: null,
    };
  }
  const b = [bounce[0], BALL.floor, bounce[1]],
    g = BALL.g,
    rest = t1 => {
      const t2 = T - t1,
        vin = (b[1] - p0[1]) / t1 - 0.5 * g * t1, // vertical speed reaching the floor (< 0)
        vout = (p1[1] - b[1]) / t2 + 0.5 * g * t2; // vertical speed leaving it
      return vin < 0 && vout > 0 ? vout / -vin : NaN;
    };
  // the hit time whose restitution is closest to the real one: scan, then refine where it crosses
  let t1 = T / 2,
    best = Infinity;
  const N = 600;
  for (let i = 1; i < N; i++) {
    const t = (T * i) / N,
      e = rest(t);
    if (Number.isFinite(e) && Math.abs(e - BALL.bounce) < best) {
      best = Math.abs(e - BALL.bounce);
      t1 = t;
    }
  }
  let lo = Math.max(1e-4, t1 - T / N),
    hi = Math.min(T - 1e-4, t1 + T / N);
  const f = t => rest(t) - BALL.bounce;
  if (f(lo) * f(hi) < 0) {
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (f(lo) * f(mid) <= 0) hi = mid;
      else lo = mid;
    }
    t1 = (lo + hi) / 2;
  }
  const va = L3(p0, b, t1),
    vb = L3(b, p1, T - t1);
  return {
    at: tau =>
      tau < t1
        ? { p: arc(p0, va, tau), v: arcV(va, tau) }
        : { p: arc(b, vb, tau - t1), v: arcV(vb, tau - t1) },
    v0: va,
    v1: arcV(vb, T - t1),
    e: rest(t1),
    hit: t1,
    point: b,
  };
}

/* ---- Mirroring: a move written for the right hand, played with the left ---- */
const swapHand = h => (h === 'R' ? 'L' : h === 'L' ? 'R' : h);
const mx = p => [-p[0], ...p.slice(1)];
const mirrorFn = fn => (fn ? (...a) => mx(fn(...a)) : fn);
/* A palm normal: fixed [x, y, z] or keys [{t, v}]. */
const mirrorN = n => (!n ? n : typeof n[0] === 'number' ? mx(n) : n.map(k => ({ ...k, v: mx(k.v) })));
export function mirrorMove(m) {
  const handKeys = keys =>
    keys?.map(k => ({ ...k, ...(k.p ? { p: mx(k.p) } : {}), ...(k.pole ? { pole: mx(k.pole) } : {}) }));
  const hands = {};
  for (const h of ['R', 'L']) {
    const src = m.hands?.[h];
    if (!src) continue;
    hands[swapHand(h)] = Array.isArray(src)
      ? handKeys(src)
      : { ...src, keys: handKeys(src.keys), fn: mirrorFn(src.fn) };
  }
  return {
    ...m,
    mirrored: !m.mirrored,
    start: swapHand(m.start),
    end: swapHand(m.end),
    ball: m.ball?.map(s => ({
      ...s,
      ...(s.hold ? { hold: swapHand(s.hold) } : {}),
      ...(s.keys ? { keys: s.keys.map(k => ({ ...k, p: mx(k.p) })) } : {}),
      ...(s.fn ? { fn: mirrorFn(s.fn) } : {}),
      ...(s.bounce ? { bounce: [-s.bounce[0], s.bounce[1]] } : {}),
      ...(s.from ? { from: mx(s.from) } : {}),
      ...(s.to ? { to: mx(s.to) } : {}),
      n: mirrorN(s.n),
      nR: mirrorN(s.nL),
      nL: mirrorN(s.nR),
      offR: s.offL,
      offL: s.offR,
    })),
    hands,
    feet: m.feet?.map(k => {
      const o = { ...k };
      delete o.R;
      delete o.L;
      if (k.L) o.R = [-k.L[0], k.L[1], -(k.L[2] || 0), k.L[3] || 0];
      if (k.R) o.L = [-k.R[0], k.R[1], -(k.R[2] || 0), k.R[3] || 0];
      if (k.lift) o.lift = { R: k.lift.L, L: k.lift.R };
      return o;
    }),
    body: m.body?.map(k => {
      const o = { ...k };
      for (const c of ['x', 'yaw', 'twist', 'side', 'look']) if (o[c] != null) o[c] = -o[c];
      return o;
    }),
    look: m.look?.map(k => ({ ...k, p: mx(k.p) })),
    spin: m.spin?.map(s => ({ ...s, w: [s.w[0], -s.w[1], -s.w[2]] })),
    extra: m.extra,
    build: m.build ? ctx => mirrorMove(m.build(mirrorCtx(ctx))) : undefined,
  };
}
/* Context points (base frame) mirrored, for moves built from the context (the step-back jumper's rim and feeder). */
export const mirrorCtx = ctx =>
  ctx
    ? Object.fromEntries(
        Object.entries(ctx).map(([k, v]) => [k, Array.isArray(v) && v.length === 3 ? mx(v) : v]),
      )
    : ctx;

/* ---- Preparing and sampling a move ---- */
const PALM_DOWN = 1.35; // forearm turn that puts the palm on top of the ball (palms face the body at rest)
const pronFor = n => PALM_DOWN * clamp(n[1] * 1.4, 0, 1);
const flexFor = n => (n[1] > 0.5 ? -0.55 : 0); // wrist cocked back with the palm on top
const nTrack = n => (!n ? null : typeof n[0] === 'number' ? () => n : track(n));
export const CATCH_SOFT = 0.3; // a catching hand moves on at this share of the arriving speed (it absorbs the rest)
export const CONTACT_BLEND = 0.06; // seconds a hand takes to settle onto, or come away from, the ball

const BODY_KEYS = ['x', 'y', 'z', 'yaw', 'drop', 'lean', 'twist', 'side', 'look'];
function bodyTrack(keys) {
  const tracks = {};
  for (const c of BODY_KEYS) {
    const ks = keys.filter(k => k[c] != null).map(k => ({ t: k.t, v: k[c] }));
    tracks[c] = ks.length ? track(ks) : () => 0;
  }
  return t => Object.fromEntries(BODY_KEYS.map(c => [c, tracks[c](t)]));
}
/* Body frame -> base frame for a body pose: turn by yaw, then move by (x, y, z). */
export const bodyTransform = b => p => add(yawRot(p, b.yaw), [b.x, b.y, b.z]);

/* Feet: positions [x, z, yaw, y] (base frame) at key times; y (height off the floor) defaults to 0, planted. Between two
   planted keys where a foot moves it steps: it lifts (lift, default from the distance) and comes down; between keys with
   a height it travels through the air along them (a foot swinging round in a spin); otherwise it stays planted. A key may
   give one foot or both. */
function feetTrack(keys) {
  const per = { R: [], L: [] };
  for (const k of [...keys].sort((a, b) => a.t - b.t))
    for (const h of ['R', 'L'])
      if (k[h])
        per[h].push({ t: k.t, v: [k[h][0], k[h][1], k[h][2] || 0], y: k[h][3] || 0, lift: k.lift?.[h] });
  for (const h of ['R', 'L']) if (!per[h].length) per[h].push({ t: 0, v: STANCE[h] });
  return t => {
    const out = {};
    for (const h of ['R', 'L']) {
      const ks = per[h];
      let i = 0;
      while (i < ks.length - 1 && t > ks[i + 1].t) i++;
      const a = ks[i],
        b = ks[i + 1];
      if (!b || t <= a.t) {
        out[h] = { p: [a.v[0], a.y, a.v[1]], yaw: a.v[2], lift: a.y, planted: !a.y };
        continue;
      }
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t),
        moved = Math.hypot(b.v[0] - a.v[0], b.v[1] - a.v[1]),
        airborne = a.y > 0 || b.y > 0,
        // in the air along keys: an even pace through them (eased only where it leaves or reaches the floor)
        e = airborne
          ? a.y > 0 && b.y > 0
            ? u
            : a.y > 0
              ? 1 - (1 - u) * (1 - u)
              : u * u
          : u * u * u * (u * (6 * u - 15) + 10),
        lift = airborne
          ? a.y + (b.y - a.y) * e
          : moved > 1e-4
            ? (b.lift ?? Math.min(0.14, 0.05 + moved * 0.18)) * Math.sin(Math.PI * u)
            : 0;
      out[h] = {
        p: [a.v[0] + (b.v[0] - a.v[0]) * e, lift, a.v[1] + (b.v[1] - a.v[1]) * e],
        yaw: a.v[2] + (b.v[2] - a.v[2]) * e,
        lift,
        planted: !airborne && moved <= 1e-4 && Math.abs(b.v[2] - a.v[2]) < 1e-4,
      };
    }
    return out;
  };
}

/* Prepares a move for sampling: builds it from the context if it needs one, solves its free flights (gravity and a real
   bounce) and makes its tracks. Held-ball tracks leave the hand at the flight's launch velocity, so a release never kinks,
   and take a catch at CATCH_SOFT of the arriving speed. */
export function prepare(move, ctx = null) {
  const m = move.build ? move.build(ctx || {}) : move,
    D = m.duration,
    body = bodyTrack(m.body || []),
    T = t => bodyTransform(body(t)),
    toBase = (p, t, frame) => (frame === 'base' ? p : T(t)(p)),
    segs = [];
  let t0 = 0;
  for (const s of m.ball || []) {
    const t1 = s.until ?? D;
    segs.push({ ...s, t0, t1 });
    t0 = t1;
  }
  const keyTrack = (s, ends) =>
    track(
      s.keys.map(k => ({ t: s.t0 + k.t, v: k.p })),
      ends,
    );
  for (const s of segs) if (s.hold) s.pos = s.fn ? t => s.fn(t - s.t0) : keyTrack(s);
  const holdAt = (s, t) => toBase(s.pos(t), t, s.frame);
  segs.forEach((s, i) => {
    if (s.hold) return;
    if (s.fn) {
      // a procedural free flight (the rhythm dribble): positions from fn, velocity by difference
      const at = tau => {
        const p = toBase(s.fn(tau), s.t0 + tau, s.frame),
          q = toBase(s.fn(tau + 0.002), s.t0 + tau + 0.002, s.frame);
        return { p, v: mul(sub(q, p), 1 / 0.002) };
      };
      s.flight = { at, v0: at(0).v, v1: at(s.t1 - s.t0).v, e: null, hit: null };
      return;
    }
    // endpoints: given (from / to, base frame), or the neighbouring hold, or where the previous flight ended
    const prev = segs[i - 1],
      next = segs[i + 1],
      p0 =
        s.from ||
        (prev?.hold ? holdAt(prev, s.t0) : prev?.flight ? prev.flight.at(prev.t1 - prev.t0).p : null),
      p1 = s.to || (next?.hold ? holdAt(next, s.t1) : next?.from || null);
    if (!p0 || !p1) throw new Error(`move ${m.id}: a free flight at ${s.t0}s has no start or end point`);
    s.flight = freeFlight(p0, p1, s.t1 - s.t0, s.bounce || null);
  });
  const bodyVel = t => {
    const a = body(t - 0.005),
      b = body(t + 0.005);
    return [(b.x - a.x) / 0.01, (b.y - a.y) / 0.01, (b.z - a.z) / 0.01];
  };
  const toFrame = (v, t, frame) => (frame === 'base' ? v : yawRot(sub(v, bodyVel(t)), -body(t).yaw));
  segs.forEach((s, i) => {
    if (!s.hold) return;
    if (!s.fn) {
      const before = segs[i - 1]?.flight,
        after = segs[i + 1]?.flight;
      s.pos = keyTrack(s, {
        d0: before ? toFrame(mul(before.v1, CATCH_SOFT), s.t0, s.frame) : s.d0,
        d1: after ? toFrame(after.v0, s.t1, s.frame) : s.d1,
      });
    }
    s.normals = {
      R: nTrack(s.nR || (s.hold !== 'L' ? s.n : null)),
      L: nTrack(s.nL || (s.hold !== 'R' ? s.n : null)),
    };
  });
  const hands = {};
  for (const h of ['R', 'L']) {
    const src = m.hands?.[h],
      keys = Array.isArray(src) ? src : src?.keys || [],
      frame = Array.isArray(src) ? 'body' : src?.frame || 'body',
      sub1 = c =>
        keys.some(k => k[c] != null)
          ? track(keys.filter(k => k[c] != null).map(k => ({ t: k.t, v: k[c] })))
          : null;
    hands[h] = !src
      ? null
      : {
          frame,
          p: src.fn ? src.fn : sub1('p'),
          flex: sub1('flex'),
          pron: sub1('pron'),
          w: sub1('w'),
          pole: sub1('pole'),
        };
  }
  return {
    move: m,
    id: m.id,
    duration: D,
    start: m.start,
    end: m.end,
    segs,
    body,
    T,
    hands,
    feet: feetTrack(m.feet || []),
    look: m.look?.length ? track(m.look.map(k => ({ t: k.t, v: k.p }))) : null,
    lookFrame: m.lookFrame || 'body',
    spin: m.spin || [],
    extra: m.extra || null,
  };
}

/* The pose of a prepared move at time t (seconds from its start), everything in the base frame:
   {ball, ballVel, spin, holder, hands: {R, L: {p, w, flex, pron, pole, onBall, n}}, feet: {R, L: {p, yaw, lift, planted}},
    body: {x, y, z, yaw, drop, lean, twist, side, look}, look, extra}. */
export function sample(P, t) {
  t = clamp(t, 0, P.duration);
  const body = P.body(t),
    T = P.T(t),
    toBase = (p, frame) => (frame === 'base' ? p : T(p)),
    dirToBase = (n, frame) => (frame === 'base' ? n : yawRot(n, body.yaw));
  // at a boundary the later segment wins (the ball is caught at the instant the flight ends)
  const seg = P.segs.find(s => t >= s.t0 && t < s.t1) || P.segs[P.segs.length - 1];
  const holds = h => P.segs.filter(s => s.hold && (s.hold === h || s.hold === 'both'));
  const ballOf = (s, tt) => (s.frame === 'base' ? s.pos(tt) : P.T(tt)(s.pos(tt)));
  let ball, ballVel;
  if (seg.hold) {
    const dt = 0.003;
    ball = toBase(seg.pos(t), seg.frame);
    ballVel = mul(sub(ballOf(seg, t + dt), ballOf(seg, t - dt)), 1 / (2 * dt));
  } else ({ p: ball, v: ballVel } = seg.flight.at(t - seg.t0));
  const hands = {};
  for (const h of ['R', 'L']) {
    // the hold this hand is on, or the nearest one in time (it settles onto it and comes away from it over CONTACT_BLEND)
    let hs = null,
      c = 0,
      gap = Infinity;
    for (const s of holds(h)) {
      const a = s.t0 <= 0 ? 1 : smooth((t - (s.t0 - CONTACT_BLEND)) / CONTACT_BLEND),
        b = s.t1 >= P.duration ? 1 : 1 - smooth((t - s.t1) / CONTACT_BLEND),
        k = Math.min(a, b),
        d = t < s.t0 ? s.t0 - t : t > s.t1 ? t - s.t1 : 0;
      if (k > c || (k === c && d < gap)) {
        c = k;
        hs = s;
        gap = d;
      }
    }
    const free = P.hands[h];
    let n = hs?.normals?.[h]?.(clamp(t, hs.t0, hs.t1)) || [0, 1, 0];
    n = norm(dirToBase(n, hs?.frame));
    const atBall = hs ? (t < hs.t0 ? ballOf(hs, hs.t0) : t > hs.t1 ? ballOf(hs, hs.t1) : ball) : ball,
      off = (h === 'R' ? hs?.offR : hs?.offL) ?? hs?.off ?? PALM,
      onBall = add(atBall, mul(n, off)),
      freeP = free?.p ? toBase(free.p(t), free.frame) : toBase(GUARD[h], 'body'),
      flex = free?.flex?.(t) ?? 0,
      pron = free?.pron?.(t) ?? 0,
      flexBall = (h === 'R' ? hs?.flexR : hs?.flexL) ?? hs?.flex ?? flexFor(n),
      pronBall = (h === 'R' ? hs?.pronR : hs?.pronL) ?? hs?.pron ?? pronFor(n);
    hands[h] = {
      p: c > 0 ? lerpA(freeP, onBall, c) : freeP,
      w: free?.w ? free.w(t) : 1,
      flex: flex * (1 - c) + flexBall * c,
      pron: pron * (1 - c) + pronBall * c,
      pole: free?.pole ? dirToBase(free.pole(t), free.frame) : null,
      onBall: c,
      n,
    };
  }
  const sp = P.spin.find(s => t >= s.from && t <= s.to);
  return {
    t,
    ball,
    ballVel,
    spin: sp ? dirToBase(sp.w, sp.frame || 'base') : null,
    holder: seg.hold || null,
    hands,
    feet: P.feet(t),
    body,
    look: P.look ? toBase(P.look(t), P.lookFrame) : null,
    extra: typeof P.extra === 'function' ? P.extra(t) : P.extra,
  };
}

/* ---- Combos: moves played back to back as one set piece (every move ends where the next begins) ----
   combo({id, label, family}, [moveA, moveB, ...]): each move is mirrored as needed to start in the hand the ball is in. */
export function combo(meta, parts) {
  let hand = 'R',
    off = 0;
  const out = {
    ...meta,
    start: 'R',
    ball: [],
    hands: { R: [], L: [] },
    feet: [],
    body: [],
    look: [],
    spin: [],
  };
  const shift = k => ({ ...k, t: k.t + off });
  const shiftN = n => (!n || typeof n[0] === 'number' ? n : n.map(shift));
  for (const raw of parts) {
    const m = raw.start === hand ? raw : mirrorMove(raw);
    if (m.build) throw new Error(`combo ${meta.id}: ${m.id} needs a context and cannot be chained`);
    for (const s of m.ball || [])
      out.ball.push({
        ...s,
        until: (s.until ?? m.duration) + off,
        n: shiftN(s.n),
        nR: shiftN(s.nR),
        nL: shiftN(s.nL),
      });
    for (const h of ['R', 'L']) {
      const src = m.hands?.[h];
      if (!src) continue;
      if (Array.isArray(src)) out.hands[h].push(...src.map(shift));
      else if (src.fn)
        throw new Error(`combo ${meta.id}: ${m.id}'s ${h} hand is a function and cannot be chained`);
      else out.hands[h].push(...src.keys.map(shift)); // (a body-frame default is assumed for chained hands)
    }
    out.feet.push(...(m.feet || []).map(shift));
    out.body.push(...(m.body || []).map(shift));
    if (m.look?.length) out.look.push(...m.look.map(shift));
    out.lookFrame ??= m.lookFrame;
    out.spin.push(...(m.spin || []).map(s => ({ ...s, from: s.from + off, to: s.to + off })));
    off += m.duration;
    hand = m.end;
  }
  out.end = hand;
  out.duration = off;
  if (!out.look.length) delete out.look;
  return out;
}

/* ---- The rhythm dribble as a move: one bounce in hand h, in place, exactly the game's dribble (basketball.js) ---- */
export function dribbleMove(h = 'R', D = DRIBBLE) {
  const x = h === 'L' ? -POCKET.x : POCKET.x,
    z = POCKET.z,
    other = h === 'R' ? 'L' : 'R';
  const at = t => D.at(t / D.period);
  return {
    id: 'dribble',
    label: 'Dribble',
    family: 'base',
    start: h,
    end: h,
    duration: D.period,
    ball: [
      { hold: h, until: D.release, fn: t => [x, at(t).ball, z], n: [0, 1, 0], flex: -0.7 },
      { free: true, until: D.period - 1e-4, fn: tau => [x, at(D.release + tau).ball, z], frame: 'base' },
      { hold: h, until: D.period, fn: () => [x, D.top, z], n: [0, 1, 0], flex: -0.7 },
    ],
    hands: {
      [h]: {
        frame: 'body',
        fn: t => [x, at(t).hand + PALM, z],
        keys: [
          { t: 0, flex: -0.7, pron: PALM_DOWN },
          { t: D.release, flex: -0.45, pron: PALM_DOWN },
          { t: D.release + 0.12, flex: -0.6, pron: PALM_DOWN },
          { t: D.period, flex: -0.7, pron: PALM_DOWN },
        ],
      },
      [other]: [{ t: 0, p: GUARD[other] }],
    },
    feet: [{ t: 0, R: STANCE.R, L: STANCE.L }],
  };
}

export { yawRot, add, sub, mul, len, norm, lerpA, smooth, clamp, swapHand };
