// Motion polish for the 3D athletes (presentation only: the plays still decide where everyone is).
// On top of the Arena's pose (position, facing, arm pose) it adds:
//   * foot planting: a two-bone leg IK keeps the stance foot on the floor; the stride advances with the distance actually
//     travelled (not a clock), so feet do not slide; the swing foot lifts and reaches forward
//   * stances: an athletic crouch at rest, a lower one while dribbling, a wide low one on defence, tucked legs in the air
//   * weight: a slow side-to-side weight shift when standing, hip and shoulder counter-twist and torso lean when running
//   * arms swing opposite the legs; the dribble hand pumps in time with the ball; the head turns toward the ball
//   * every channel eases (critically damped), so poses blend instead of snapping
// The classic figure is not touched.
import * as THREE from 'three';

/* Two-bone leg in the sagittal plane. The hip sits `drop` above the ankle target and the target is `forward` ahead of the hip.
   Returns rotations about x for the hip (negative = thigh forward) and knee (positive = shin back), with the leg straight
   when the target is out of reach. */
export function solveLeg(thigh, shin, forward, drop) {
  const reach = thigh + shin - 1e-6,
    d = Math.min(Math.hypot(forward, drop), reach),
    cosK = (thigh * thigh + shin * shin - d * d) / (2 * thigh * shin);
  const knee = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
  const toTarget = Math.atan2(forward, Math.max(drop, 1e-4)),
    cosB = (thigh * thigh + d * d - shin * shin) / (2 * thigh * Math.max(d, 1e-4));
  const beta = Math.acos(Math.max(-1, Math.min(1, cosB)));
  return { hip: -(toTarget + beta), knee };
}
/* Where the ankle ends up (forward, down from the hip) for given hip/knee rotations: the forward check of solveLeg. */
export function ankleOf(thigh, shin, hip, knee) {
  const a = -hip,
    b = a - knee;
  return {
    forward: thigh * Math.sin(a) + shin * Math.sin(b),
    drop: thigh * Math.cos(a) + shin * Math.cos(b),
  };
}
/* Stride length for a speed (game units per second): short steps when shuffling, long ones at a sprint. */
export const strideFor = speed => Math.min(1.5, 0.42 + speed * 0.2);
/* The gait for a ground speed (units/s: a walk is about 1.2, a jog 3, a run 5, a sprint 7; 1 unit = 1 ft x 3.02):
   stride  - distance per step (one foot to the other); real runners lengthen it with speed (a sprint step is ~2 m)
   duty    - the part of the cycle each foot is planted: over half when walking (both feet down in between), under half
             when running, which leaves a flight phase with both feet up. A planted foot covers only duty x 2 x stride of
             ground, so even a sprint's long strides stay within the leg's reach and the feet do not slide.
   lift    - how high the swinging foot comes up (a heel kick at a sprint)
   bob     - how far the pelvis rises and falls (units)
   arm     - arm swing (radians) and elbow bend, from a loose walk to a sprinter's 90-degree pump
   lean    - forward lean of the trunk (radians) */
export function gaitFor(speed) {
  const s = Math.max(0, Math.min(9, speed || 0)),
    k = x => Math.max(0, Math.min(1, x)),
    run = k((s - 1.6) / 4.4); // 0 at a walk, 1 at a sprint
  return {
    stride: Math.min(2.0, 0.42 + s * 0.24),
    duty: 0.62 - 0.3 * run,
    lift: 0.07 + 0.2 * run,
    bob: 0.025 + 0.03 * run,
    arm: 0.22 + 0.55 * run,
    elbow: 0.3 + 1.15 * k((s - 1.2) / 3),
    lean: 0.03 + 0.2 * run,
    run,
  };
}
/* Fits a gait to a body: a planted foot can only be as far ahead of or behind the hip as the leg reaches at the hip's
   height (we have no toes to roll over), so a stance longer than that would leave the foot short of its spot and sliding.
   Running shortens the stance (a longer flight, down to a quarter of the cycle); walking takes quicker, shorter steps.
   leg = {thigh, shin, ankleY}, hipY = the hip's height now (units of the body). */
export function fitGait(g, leg, hipY) {
  const reach = (leg.thigh + leg.shin) * 0.985,
    drop = Math.max(0.2, hipY - leg.ankleY),
    cmax = Math.sqrt(Math.max(0.0025, reach * reach - drop * drop));
  if (g.duty * g.stride <= cmax) return g;
  let duty = g.duty,
    stride = g.stride;
  if (g.run > 0.05) duty = Math.max(0.25, Math.min(duty, cmax / stride));
  if (duty * stride > cmax) stride = cmax / duty;
  return { ...g, duty, stride };
}
/* Foot target in the stride cycle. phase 0..2π is one cycle: two steps, 2 x stride of travel. The foot is planted for the
   first duty x 2π, moving back exactly as far as the body moves forward (from +duty x stride to -duty x stride), then
   swings forward to the next contact, lifting `lift` (earlier in the swing at a run: the heel comes up first). duty 0.5 is
   the old half-and-half cycle. */
export function footAt(phase, stride, lift, duty = 0.5) {
  const T = 2 * Math.PI,
    p = ((phase % T) + T) % T,
    c = duty * stride,
    st = duty * T;
  if (p < st) return { forward: c - (p / Math.PI) * stride, up: 0 };
  const s = (p - st) / (T - st),
    e = s * s * (3 - 2 * s),
    q = duty < 0.5 ? Math.pow(s, 0.75) : s; // a running swing lifts early
  return { forward: -c + e * 2 * c, up: lift * Math.sin(q * Math.PI) };
}
/* The pelvis's rise and fall over the cycle (-1..1, times gait.bob). Walking vaults over the planted leg: highest at
   mid-stance. Running sinks as the leg takes the weight and rises through the flight. */
export function gaitBob(phase, duty) {
  const T = 2 * Math.PI,
    p = ((phase % T) + T) % T,
    st = duty * T;
  let walk = 0,
    run = 0;
  for (const q of [p, (p + Math.PI) % T])
    if (q < st) {
      const s = q / st;
      walk = Math.max(walk, Math.sin(Math.PI * s));
      run -= Math.sin(Math.PI * s);
    }
  if (duty < 0.5) {
    const q = p % Math.PI,
      gap = Math.PI - st;
    if (q >= st && gap > 1e-6) run += Math.sin((Math.PI * (q - st)) / gap);
  }
  const w = Math.max(0, Math.min(1, (0.5 - duty) / 0.12 + 0.5));
  return walk * (1 - w) + run * w;
}
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth01 = x => ((x = Math.max(0, Math.min(1, x))), x * x * (3 - 2 * x));

/* ---- Personal space: players keep about 3 ft apart, and go round each other instead of through ---- */
export const SPACE = { min: 0.95, contest: 0.85, block: 0.5 }; // game units centre to centre (1 ft = 0.33); a shot
// contest comes closer, and a shot-blocker jumps right at the shooter
/* One frame of keeping players apart. desired = where the play puts each player ([{x, z}]); state = {drawn, off} from the
   previous frame (or a new {}); pinned = indexes that never move (the player with the ball); gap(i, j) = the distance
   two players keep. Returns where to draw them.
   Each player is drawn at desired + an offset that eases back to zero. Two players too close are separated along the line
   between where they were drawn last frame (they were apart then, so the push never flips side as it would if taken from
   this frame's positions alone), and a player the play sends straight through another slides round him on the side he is
   heading for. Without a previous frame (or with dt 0) it is a plain push apart. */
export function keepApart(state, desired, { pinned = new Set(), gap = () => SPACE.min, dt = 0 } = {}) {
  const n = desired.length,
    prev = state.drawn?.length === n ? state.drawn : null,
    off = state.off?.length === n ? state.off : desired.map(() => ({ x: 0, z: 0 })),
    relax = Math.exp(-3 * dt),
    q = desired.map((d, i) => ({ x: d.x + off[i].x * relax, z: d.z + off[i].z * relax }));
  for (let round = 0; round < 3; round++)
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const need = gap(i, j),
          d = Math.hypot(q[j].x - q[i].x, q[j].z - q[i].z);
        if (d >= need) continue;
        // separation direction: from last frame's drawn positions when they were apart, else from now, else fixed
        let nx = q[j].x - q[i].x,
          nz = q[j].z - q[i].z;
        if (prev) {
          const px = prev[j].x - prev[i].x,
            pz = prev[j].z - prev[i].z;
          if (Math.hypot(px, pz) > 1e-3) {
            nx = px;
            nz = pz;
          }
        }
        let l = Math.hypot(nx, nz);
        if (l < 1e-6) {
          nx = Math.cos(i * 7 + j);
          nz = Math.sin(i * 7 + j);
          l = 1;
        }
        nx /= l;
        nz /= l;
        // where the play wants j relative to i: if that is through i (behind the separation line), slide round him
        const rx = desired[j].x - desired[i].x,
          rz = desired[j].z - desired[i].z,
          through = Math.max(0, -(rx * nx + rz * nz)) / Math.max(need, Math.hypot(rx, rz)),
          s = nx * rz - nz * rx >= 0 ? 1 : -1, // the side he is heading for
          tx = nx - s * nz * through * 1.5,
          tz = nz + s * nx * through * 1.5,
          tl = Math.hypot(tx, tz);
        const push = need - d,
          pi = pinned.has(i),
          pj = pinned.has(j);
        if (pi && pj) continue;
        const ki = pi ? 0 : pj ? 1 : 0.5,
          kj = 1 - ki;
        q[i].x -= (tx / tl) * push * ki;
        q[i].z -= (tz / tl) * push * ki;
        q[j].x += (tx / tl) * push * kj;
        q[j].z += (tz / tl) * push * kj;
      }
  state.drawn = q.map(p => ({ ...p }));
  state.off = q.map((p, i) => ({ x: p.x - desired[i].x, z: p.z - desired[i].z }));
  return q;
}

/* ---- Facing: where a player's body points while the play moves him (both player models) ---- */
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
/* The angle a fraction w of the way from a to b, the short way round. */
export const mixAngle = (a, b, w) => a + wrap(b - a) * w;
/* Turns `current` toward `target` like a body does: quickly at first, easing in, never faster than maxRate radians per second
   (about one and a half turns a second, a hard plant-and-pivot). */
export function steerYaw(current, target, dt, maxRate = 9, rate = 10) {
  const d = wrap(target - current),
    step = d * (1 - Math.exp(-rate * dt)),
    cap = maxRate * dt;
  return current + Math.max(-cap, Math.min(cap, step));
}
/* How much a player turns to face the way he is running (1) rather than where the play points him (0), from his ground
   speed in game units per second (a jog is about 3, a sprint about 7), what his arms are doing (pose.arms) and `off`, the
   angle in radians (0..π) between where he runs and where the play points him.
   - Aimed actions (a shot, a block, a screen, a pass, a rebound) keep the play's facing: they point at something.
   - Defenders slide and backpedal square to their man; only a sprint turns them to run.
   - A ball handler half-turns toward the drive and keeps the rim in view.
   - Anyone else running faces the way he runs, more the faster he goes.
   - Moving backwards (a step-back, a retreat) is a backpedal, not a turn round, until it becomes a sprint.
   Weights ramp smoothly with speed so a player near a threshold does not flick between facings. */
const AIMED = new Set(['shoot', 'hook', 'block', 'screen', 'pass', 'rebound']);
export function facingWeight(speed, arms, off = 0) {
  if (AIMED.has(arms)) return 0;
  const ramp = (a, b) => {
    const x = Math.max(0, Math.min(1, (speed - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  const w = arms === 'defend' ? ramp(4.5, 7) : arms === 'dribble' ? 0.7 * ramp(1.5, 5) : ramp(1, 4);
  return off > 2.2 ? w * ramp(5.5, 7.5) : w;
}

/* Two-bone arm IK in the chest's space. S = shoulder, T = wrist target, L1/L2 = upper arm and forearm, pole = where the elbow
   should point. Returns the upper-arm direction u, the forearm bend direction b (both unit) and the elbow bend angle
   (0 = straight), or null if the target sits on the shoulder. */
export function solveArm(S, T, L1, L2, pole) {
  const d = T.clone().sub(S),
    len = d.length();
  if (len < 1e-5) return null;
  const D = Math.min(Math.max(len, Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-6),
    dn = d.multiplyScalar(1 / len);
  const p = pole.clone().sub(dn.clone().multiplyScalar(pole.dot(dn)));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1).sub(dn.clone().multiplyScalar(dn.z));
  p.normalize();
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)))),
    u = dn
      .clone()
      .multiplyScalar(Math.cos(a))
      .add(p.clone().multiplyScalar(Math.sin(a)));
  const E = S.clone().add(u.clone().multiplyScalar(L1)),
    f = dn.clone().multiplyScalar(D).add(S).sub(E).normalize();
  const b = f.clone().sub(u.clone().multiplyScalar(f.dot(u)));
  if (b.lengthSq() < 1e-8) b.copy(p);
  b.normalize();
  const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2))));
  return { u, b, bend, elbow: E };
}
/* Arm poses for each play situation, per side (j: 0 = right, 1 = left): shoulder flex x (negative = forward/up), abduction z
   (positive = away from the body) and elbow flex e (negative = bent). */
const ARM = {
  relax: () => [0, 0.1, -0.25],
  shoot: (j, m) => (j === 0 ? [-2.75, 0.05, -0.15] : [-1.75, 0.45, -0.6]), // follow-through: shooting arm up and through, guide hand falls away
  hook: j => (j === 0 ? [-2.9, 0.55, -0.2] : [-1.2, 0.7, -0.9]), // hook over the top, off arm up to shield
  block: (j, m) => (j === m.high ? [-2.85, 0.15, -0.12] : [-2.2, 0.32, -0.55]), // one hand high on the ball, the other up beside it
  rebound: () => [-2.55, 0.3, -0.45], // both up, elbows soft
  // a starting point only: the defensive stance itself is placed by hand targets (DEFEND, animateArms)
  defend: () => [-0.85, 0.3, -1.1],
  pass: () => [-1.35, -0.08, -0.35], // chest pass: arms through, hands together
  screen: () => [-0.6, -0.38, -1.5], // arms crossed in front, braced
  dribble: () => [-0.7, 0.35, -1.0], // off arm out front as a guard; the dribble hand is set by IK
};
/* The defensive stance, as wrist targets from each shoulder in the chest's space (+x his left, +y up, +z forward), with
   side = +1 for the left arm. On the ball: the hand on the ball's side low and out front to trace the dribble, the other
   up at face height in the passing lane, elbows bent and in front of the body. Help (off the ball): both hands up in
   front at chest height, a little wider than the shoulders ("pistols"). Never the arms straight out to the side.
   Scaled by the arm's length (rest L1 + L2), so the same stance fits the guard and the center. */
export const DEFEND = {
  low: [0.16, -0.66, 0.55], // traces the dribble
  high: [0.1, 0.36, 0.62], // in the passing lane
  help: [0.06, -0.62, 0.48], // pistols: hands in front at the hips, just outside the shoulders
  onBall: [2.0, 3.2], // distance to the ball (units): fully on-ball inside the first, help beyond the second
  pole: { low: [0.35, -0.8, -0.3], high: [0.5, -0.7, -0.1], help: [0.25, -0.8, -0.5] }, // elbows down, a little out
};
const quatFrom = (() => {
  const m0 = new THREE.Matrix4(),
    m1 = new THREE.Matrix4(),
    c = new THREE.Vector3(),
    c0 = new THREE.Vector3();
  return (u0, b0, u, b, out) => {
    c0.crossVectors(u0, b0);
    c.crossVectors(u, b);
    m0.makeBasis(u0, b0, c0);
    m1.makeBasis(u, b, c);
    return out.setFromRotationMatrix(m1.multiply(m0.transpose()));
  };
})();
const _v = new THREE.Vector3(),
  _w = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _e = new THREE.Euler();

/* Rest measurements of an athlete body, taken once from its bone offsets (the skeleton's own units; the rest pose is
   unrotated, so heights are sums of the bones' local offsets and do not depend on the current pose). */
function rest(body) {
  if (body.motionRest) return body.motionRest;
  const b = body.bones,
    pelvis = b.pelvis.position.clone(),
    legs = {};
  for (const s of ['L', 'R']) {
    const hip = b['hip_' + s].position,
      knee = b['knee_' + s].position,
      ankle = b['ankle_' + s].position,
      hipY = pelvis.y + hip.y;
    legs[s] = { thigh: knee.length(), shin: ankle.length(), hipY, ankleY: hipY + knee.y + ankle.y };
  }
  const arms = [];
  for (const s of ['R', 'L']) {
    const sh = b['shoulder_' + s],
      el = b['elbow_' + s],
      wr = b['wrist_' + s];
    if (!sh || !el || !wr) {
      arms.push(null);
      continue;
    }
    const u0 = el.position.clone().normalize(),
      b0 = new THREE.Vector3(0, 0, 1);
    b0.sub(u0.clone().multiplyScalar(b0.dot(u0))).normalize();
    arms.push({ L1: el.position.length(), L2: wr.position.length(), u0, b0 });
  }
  return (body.motionRest = { legs, pelvis, arms });
}

/* Called by the Arena after its own pose for an athlete. ctx = {dt, motion, ball (world position or null), holder,
   dribbleHand (the dribbling hand height, basketball.js dribbleAt), perform (a move's pose in world space, from
   src/moves/stage.js worldFrame: planted feet, hand targets, wrist, torso and head; null when not performing)}.
   A performance blends in and out over a few tenths of a second, so starting or stopping one never snaps. */
export function animateAthlete(player, pose, ctx) {
  const u = player.userData,
    body = u.body,
    b = body?.bones;
  if (!b?.hip_L || !b.knee_L || !b.ankle_L) return;
  const R = rest(body),
    m = (u.motionState ??= {
      phase: 0,
      speed: 0,
      crouch: 0.06,
      lean: 0,
      wide: 0,
      sway: 0,
      last: null,
      headYaw: 0,
      t: Math.random() * 10,
    }),
    dt = Math.min(ctx.dt || 0, 0.05);
  // measured ground speed from the pose positions (teleports are ignored)
  const here = player.position;
  let moved = 0,
    dir = 0;
  if (m.last) {
    const dx = here.x - m.last.x,
      dz = here.z - m.last.z;
    moved = Math.hypot(dx, dz);
    if (moved > 1.5) moved = 0;
    // direction of travel relative to facing: 0 = forward, ±π/2 = sliding sideways (defence), π = backpedal
    if (moved > 1e-5) {
      dir = Math.atan2(dx, dz) - player.rotation.y;
      dir = Math.atan2(Math.sin(dir), Math.cos(dir));
      m.dir = dir;
    } else dir = m.dir || 0;
  }
  m.last = { x: here.x, z: here.z };
  // a player drawn taller or shorter than his model (the Arena scales him, players.js bodyFor): his stride is measured in
  // his own body's units, so the planted foot moves back exactly as far as he moves
  moved /= player.scale.x || 1;
  const speed = dt > 0 ? moved / dt : 0;
  m.speed = damp(m.speed, Math.min(speed, 9), 6, dt);
  m.t += dt;
  // a move being performed (src/moves): its weight eases in and out; when it stops the last pose fades
  const perf = ctx.perform || null;
  m.perfW = damp(m.perfW ?? 0, perf ? 1 : 0, perf ? 10 : 5, dt || (perf ? 1 : 0));
  if (perf) m.lastPerf = perf;
  const PF = perf || (m.perfW > 0.01 ? m.lastPerf : null),
    pw = PF ? m.perfW : 0,
    pb = PF?.body || {};
  const run = Math.min(1, m.speed / 5),
    airborne = Math.min(1, Math.max(0, pose.y) / 0.18) * (PF && !PF.gait ? 1 - pw : 1);
  const g = fitGait(gaitFor(m.speed), R.legs.L, R.legs.L.hipY - m.crouch * R.legs.L.hipY),
    stride = g.stride,
    gw = smooth01((m.speed - 0.1) / 0.8); // how much of the gait shows: none standing, all of it from a slow walk
  if (ctx.motion) m.phase += (moved / Math.max(stride, 0.2)) * Math.PI;
  // starts, stops and cuts: the speed along his facing and its change (lean into a start, back on a stop), and how fast
  // he is turning (lean into the turn, more the faster he runs)
  if (dt > 0) {
    const vf = (moved / dt) * Math.cos(dir),
      yaw = player.rotation.y,
      turn = m.yawLast == null ? 0 : Math.atan2(Math.sin(yaw - m.yawLast), Math.cos(yaw - m.yawLast)) / dt;
    m.acc = damp(m.acc ?? 0, Math.max(-25, Math.min(25, (vf - (m.vf ?? vf)) / dt)), 5, dt);
    m.vf = vf;
    m.turn = damp(m.turn ?? 0, Math.max(-12, Math.min(12, turn)), 6, dt);
    m.yawLast = yaw;
    m.exert = damp(m.exert ?? 0, run, run > (m.exert ?? 0) ? 0.4 : 0.12, dt); // breathing deepens after a hard run
  }
  // stance targets by what the player is doing
  const arms = pose.arms || 'relax',
    dribble = arms === 'dribble',
    defend = arms === 'defend';
  const crouchT = airborne > 0 ? 0.02 : defend ? 0.17 : dribble ? 0.13 : 0.07 + run * 0.07,
    wideT = defend ? 0.2 : dribble ? 0.08 : 0.03,
    leanT =
      g.lean * gw +
      (dribble ? 0.22 : 0) +
      (defend ? 0.12 : 0) +
      (airborne > 0 ? 0 : Math.max(-0.14, Math.min(0.18, (m.acc ?? 0) * 0.02)) * gw);
  m.crouch = damp(m.crouch, crouchT, 7, dt);
  m.wide = damp(m.wide, wideT, 7, dt);
  m.lean = damp(m.lean, leanT, 6, dt);
  const still = 1 - run;
  // a slow weight shift from foot to foot when standing, never quite periodic
  m.sway = (0.7 * Math.sin(m.t * 0.9) + 0.3 * Math.sin(m.t * 2.3 + 1.7)) * still * (ctx.motion ? 1 : 0);
  // pelvis: crouch, the gait's rise and fall, weight shift to one side
  const bob = ctx.motion ? gaitBob(m.phase, g.duty) * g.bob * gw : 0,
    h = R.legs.L.hipY;
  const pdrop = (pb.drop || 0) * pw;
  b.pelvis.position.set(
    R.pelvis.x + m.sway * 0.025 * (1 - pw),
    R.pelvis.y - m.crouch * h + bob - pdrop,
    R.pelvis.z,
  );
  b.pelvis.rotation.set(0, ctx.motion ? -Math.sin(m.phase) * (0.06 + 0.08 * g.run) * gw : 0, -m.sway * 0.03);
  // legs: stride targets, planted while in stance; in the air the knees tuck
  for (const [j, s] of [
    [0, 'R'],
    [1, 'L'],
  ]) {
    const L = R.legs[s],
      hipBone = b['hip_' + s],
      knee = b['knee_' + s],
      ankle = b['ankle_' + s];
    // the gait's foot, faded into the standing stance as he slows (no snap when he stops)
    const rest = { forward: (j ? 0.06 : -0.04) * (1 - m.wide * 2), up: 0 },
      walk = ctx.motion && gw > 0 ? footAt(m.phase + (j ? Math.PI : 0), stride, g.lift, g.duty) : rest,
      foot = { forward: rest.forward + (walk.forward - rest.forward) * gw, up: walk.up * gw };
    // the stride runs along the direction of travel: forward/back in the leg's plane, sideways through the hip (a shuffle)
    // the pelvis twists with the stride: it carries the hip forward or back and turns the leg's plane with it. The target
    // (relative to the body's root, under the hip) is taken from the twisted hip and turned into the pelvis's frame, so a
    // planted foot stays exactly where it is on the floor
    const th = b.pelvis.rotation.y,
      ct = Math.cos(th),
      sn = Math.sin(th),
      hipX = R.pelvis.x + hipBone.position.x,
      rx = foot.forward * Math.sin(dir) + hipX * (1 - ct),
      rz = foot.forward * Math.cos(dir) + hipX * sn,
      fwd = rx * sn + rz * ct,
      side = rx * ct - rz * sn;
    const hipWorldY = L.hipY - m.crouch * h + bob - pdrop,
      drop = hipWorldY - L.ankleY - foot.up + (s === 'L' ? -1 : 1) * m.sway * 0.012;
    let sol = solveLeg(
      L.thigh,
      L.shin,
      fwd,
      Math.sqrt(Math.max(drop * drop - side * side, drop * drop * 0.5)),
    );
    if (airborne > 0) {
      const tuck = jumpLegs(arms, ctx.family, s, ctx.airLegs, ctx.airLead);
      sol = {
        hip: sol.hip + (tuck.hip - sol.hip) * airborne,
        knee: sol.knee + (tuck.knee - sol.knee) * airborne,
        toe: tuck.toe,
      };
    }
    let abduct = (s === 'L' ? 1 : -1) * m.wide + Math.asin(Math.max(-0.6, Math.min(0.6, side / drop))),
      twist = 0;
    // performing: the leg reaches the move's planted foot (world target -> this player's space), the foot turned its way
    if (PF && !PF.gait && pw > 0 && PF.feet?.[s]) {
      const F = PF.feet[s],
        lf = (player.updateMatrixWorld(), player.worldToLocal(_w.copy(F.p))),
        hip = hipBone.position,
        hx = R.pelvis.x + hip.x,
        hz = R.pelvis.z + hip.z,
        hy = L.hipY - m.crouch * h - (pb.drop || 0), // the hip where the move puts it (the blend is on the angles)
        fs = lf.x - hx,
        dp = Math.max(0.2, hy - L.ankleY - lf.y),
        sp = solveLeg(L.thigh, L.shin, lf.z - hz, Math.sqrt(Math.max(dp * dp - fs * fs, dp * dp * 0.5))),
        ab = Math.asin(Math.max(-0.6, Math.min(0.6, fs / dp))),
        tw = Math.atan2(Math.sin(F.yaw - player.rotation.y), Math.cos(F.yaw - player.rotation.y));
      sol = {
        hip: sol.hip + (sp.hip - sol.hip) * pw,
        knee: sol.knee + (sp.knee - sol.knee) * pw,
        toe: sol.toe,
      };
      abduct += (ab - abduct) * pw;
      twist = tw * pw;
    }
    hipBone.rotation.order = 'XZY'; // the foot's turn first, about the leg; then out to the side; then forward
    hipBone.rotation.set(sol.hip, twist, abduct);
    knee.rotation.set(sol.knee, 0, 0);
    ankle.rotation.set(
      -(sol.hip + sol.knee) * (1 - airborne) + (sol.toe || 0) * airborne,
      0,
      -abduct * (1 - airborne),
    ); // flat on the floor; toes point in the air
  }
  // torso: lean into the run, shoulders counter-twist against the hips
  // banking: into a turn (his left is +x; turning left tilts the trunk left), more the faster he runs
  const bank = ctx.motion ? Math.max(-0.22, Math.min(0.22, -(m.turn ?? 0) * m.speed * 0.018)) * gw : 0,
    breath = ctx.motion
      ? Math.sin(m.t * (1.3 + 1.6 * (m.exert ?? 0))) * (0.012 + 0.025 * (m.exert ?? 0)) * (1 - gw * 0.7)
      : 0;
  b.spine.rotation.set(
    m.lean * 0.55 + (pb.lean || 0) * 0.6 * pw,
    (ctx.motion ? Math.sin(m.phase) * (0.08 + 0.08 * g.run) * gw : 0) + (pb.twist || 0) * 0.4 * pw,
    m.sway * 0.025 * (1 - pw) + bank * (1 - pw) + (pb.side || 0) * pw,
  );
  b.chest.rotation.set(
    m.lean * 0.35 + (pb.lean || 0) * 0.4 * pw - breath,
    (ctx.motion ? Math.sin(m.phase) * (0.05 + 0.06 * g.run) * gw : 0) + (pb.twist || 0) * 0.6 * pw,
    0,
  );
  animateArms(player, pose, ctx, m, R, run, dt, PF, pw, g, gw);
  // head: turn toward the ball (limited), eyes level against the torso lean
  if (b.head) {
    let yaw = 0;
    if (ctx.ball) {
      const dx = ctx.ball.x - here.x,
        dz = ctx.ball.z - here.z;
      if (dx * dx + dz * dz > 0.04) {
        yaw = Math.atan2(dx, dz) - player.rotation.y;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        yaw = Math.max(-1, Math.min(1, yaw));
      }
    }
    let pitch = 0;
    if (PF) {
      // performing: eyes up the floor (a good handler does not watch the ball), or on the move's look target
      let py = -(pb.twist || 0) * 0.8,
        pp = 0;
      if (PF.look) {
        const l = (player.updateMatrixWorld(), player.worldToLocal(_w.copy(PF.look)));
        py = Math.max(-1.1, Math.min(1.1, Math.atan2(l.x, l.z)));
        pp = Math.max(-0.6, Math.min(0.5, Math.atan2(l.y - 1.75, Math.hypot(l.x, l.z))));
      }
      yaw += (py - yaw) * pw;
      pitch = pp * pw;
    }
    m.headYaw = damp(m.headYaw, yaw, PF ? 9 : 5, dt);
    const leanAll = m.lean + (pb.lean || 0) * pw;
    b.head.rotation.set(-leanAll * 0.6 - pitch * 0.7, m.headYaw * 0.7, 0);
    if (b.neck) b.neck.rotation.set(-pitch * 0.3, m.headYaw * 0.3, 0);
  }
}

/* Leg shapes in the air for the finishes (src/finishes.js names one per moment; lead = the side of the knee that drives
   up, the shooting hand's): hip flexion (- = thigh forward), knee bend, toe point. */
export const AIR_LEGS = {
  kneeR: { lead: { hip: -1.35, knee: 1.65, toe: 0.35 }, trail: { hip: 0.18, knee: 0.55, toe: 0.6 } }, // a layup's knee drive
  hook: { lead: { hip: -1.05, knee: 1.35, toe: 0.4 }, trail: { hip: 0.08, knee: 0.4, toe: 0.6 } },
  tuck: { lead: { hip: -0.6, knee: 1.05, toe: 0.45 }, trail: { hip: -0.5, knee: 0.95, toe: 0.45 } }, // two feet, knees up
  softTuck: { lead: { hip: -0.4, knee: 0.75, toe: 0.5 }, trail: { hip: -0.25, knee: 0.6, toe: 0.55 } },
  dunk: { lead: { hip: -0.45, knee: 1.25, toe: 0.5 }, trail: { hip: -0.3, knee: 1.15, toe: 0.5 } }, // knees bent, feet back
};
/* Leg shape in the air, by move: jump shooters keep the legs long with toes pointed; on drives and dunks the lead knee drives
   up and the trail leg folds back; blocks and rebounds tuck both knees. A finish (ctx.airLegs) names its own shape. */
function jumpLegs(arms, family, side, air = null, lead = 'R') {
  if (air && AIR_LEGS[air]) return AIR_LEGS[air][side === lead ? 'lead' : 'trail'];
  if (arms === 'shoot' && ['drive', 'dunk', 'roll', 'floater'].includes(family))
    return side === 'R' ? { hip: -1.25, knee: 1.5, toe: 0.35 } : { hip: 0.12, knee: 0.6, toe: 0.6 };
  if (arms === 'shoot' || arms === 'hook') return { hip: -0.12, knee: 0.28, toe: 0.65 };
  return { hip: -0.42, knee: 0.8, toe: 0.45 };
}

/* Arms for the athletes (the classic figure keeps the Arena's own arm poses). Each arm eases toward the pose for the play
   situation; the ball handler's hands reach the ball with arm IK: one hand on top while dribbling, both hands while
   holding, gathering and shooting. When the ball leaves (a shot or pass), the IK fades and the follow-through takes over.
   The dribbling hand leads the ball rather than chasing it: it follows the dribble's hand height (ctx.dribbleHand), the
   forearm turns the palm down onto the ball and the wrist works on the dribble's beat (dribbleWrist). */
function animateArms(player, pose, ctx, m, R, run, dt, PF = null, pw = 0, g = gaitFor(0), gw = 0) {
  const u = player.userData,
    b = u.body.bones,
    chest = b.chest;
  if (!chest) return;
  let arms = pose.arms || 'relax';
  if (arms === 'run') arms = 'relax';
  m.high ??= (u.slot ?? 0) % 2;
  m.arm ??= [
    [0, 0.1, -0.25],
    [0, 0.1, -0.25],
  ];
  m.ik ??= [0, 0];
  m.ikT ??= [null, null];
  const t = ctx.motion ? m.t : 0;
  // where the ball is relative to this player, and which hands should be on it
  const ball = ctx.ball,
    holder = !!ctx.holder && !!ball,
    yaw = player.rotation.y,
    fw = _v.set(Math.sin(yaw), 0, Math.cos(yaw)).clone(),
    left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const r = ctx.ballRadius || 0.13,
    up = new THREE.Vector3(0, 1, 0);
  let normals = [null, null];
  if (holder) {
    if (arms === 'dribble') {
      const j = ball.clone().sub(player.position).dot(left) > 0 ? 1 : 0;
      normals[j] = up.clone();
    } else if (arms === 'shoot' || arms === 'hook') {
      normals[0] = fw
        .clone()
        .negate()
        .multiplyScalar(0.75)
        .add(up.clone().multiplyScalar(-0.35))
        .add(left.clone().multiplyScalar(-0.3))
        .normalize();
      if (arms === 'shoot') normals[1] = left.clone();
    } else {
      normals[0] = left.clone().negate();
      normals[1] = left.clone();
    }
  }
  u.arms.forEach((a, j) => {
    const rest = R.arms[j],
      side = j ? 1 : -1;
    let [x, z, e] = (ARM[arms] || ARM.relax)(j, m, t);
    if (arms === 'relax') {
      // the arms swing against the legs: loose and low at a walk, bent to 90 degrees and pumping at a sprint
      x = ctx.motion ? -Math.sin(m.phase + (j ? Math.PI : 0)) * g.arm * gw - 0.08 * g.run * gw : 0;
      z = 0.1 + 0.08 * m.crouch * 4 - 0.04 * g.run * gw;
      e = -0.25 - (g.elbow - 0.25) * gw;
    }
    const st = m.arm[j];
    st[0] = damp(st[0], x, 10, dt);
    st[1] = damp(st[1], z, 9, dt);
    st[2] = damp(st[2], e, 10, dt);
    a.rotation.set(st[0], 0, side * st[1]);
    a.userData.elbow.rotation.set(st[2], 0, 0);
    // hand on the ball
    const n = normals[j];
    let want = 0,
      T = null;
    const S = a.position;
    if (n && rest) {
      chest.updateWorldMatrix(true, false);
      // the dribbling hand goes where the dribble puts it (ctx.dribbleHand, basketball.js dribbleAt), over the ball: on it
      // in the push, waiting above it while it bounces. Every other hand on the ball goes to the ball.
      const at = arms === 'dribble' && ctx.dribbleHand != null ? ball.clone().setY(ctx.dribbleHand) : ball;
      T = chest.worldToLocal(at.add(n.clone().multiplyScalar(r + 0.07)));
      if (T.distanceTo(S) < (rest.L1 + rest.L2) * 1.2) {
        want = 1;
        m.ikT[j] = T.clone();
      }
    }
    m.ik[j] = damp(m.ik[j], want, want ? 14 : 7, dt);
    if (!want) T = m.ikT[j]; // the ball just left the hand: ease out from where it was
    if (rest && T && m.ik[j] > 0.01) {
      {
        const pole =
          arms === 'dribble'
            ? new THREE.Vector3(side * 0.3, -0.2, -1) // dribbling: the elbow points back, close to the body
            : T.y > S.y + 0.1
              ? new THREE.Vector3(side * 0.45, -0.1, 1)
              : new THREE.Vector3(side * 0.6, -0.25, -1);
        const sol = solveArm(S, T, rest.L1, rest.L2, pole.normalize());
        if (sol) {
          quatFrom(rest.u0, rest.b0, sol.u, sol.b, _q);
          a.quaternion.slerp(_q, m.ik[j]);
          const el = a.userData.elbow.rotation;
          el.x = el.x + (-sol.bend - el.x) * m.ik[j];
        }
      }
    }
    // the dribbling hand: forearm turned palm-down, wrist cocked to receive and snapping down through the push
    const wrist = b[j ? 'wrist_L' : 'wrist_R'],
      dribbling = arms === 'dribble' && n && ctx.dribble ? m.ik[j] : 0;
    if (wrist) {
      wrist.rotation.order = 'YZX';
      wrist.rotation.set(0, 0, dribbling ? -side * dribbleWrist(ctx.dribble) * dribbling : 0);
    }
    if (dribbling) a.userData.elbow.rotation.y = -side * 1.35 * dribbling; // pronation (palms face the body at rest)
    // the defensive stance: hands placed in front of the body by IK, between the on-ball and the help stance
    m.defW = damp(m.defW ?? 0, arms === 'defend' ? 1 : 0, 8, dt);
    if (m.defW > 0.01 && rest) defendArm(player, a, j, side, rest, m, ctx, t, S);
    // going up to block: the high hand goes for the ball when it is close (a swat when the play is a block, a swipe that
    // misses when it is not), its arm reaching straight at it when it is just out of reach
    if (arms === 'block' && ball && !holder && j === m.high && rest) {
      chest.updateWorldMatrix(true, false);
      const B = chest.worldToLocal(ball.clone()),
        reach = rest.L1 + rest.L2,
        toBall = B.clone().sub(S),
        dist = toBall.length(),
        near = Math.max(0, Math.min(1, (reach * 1.9 - dist) / (reach * 0.7)));
      m.swat = damp(m.swat ?? 0, near, 12, dt);
      if (m.swat > 0.01 && dist > 1e-3) {
        const T2 = S.clone().add(toBall.multiplyScalar(Math.min(1, (reach * 0.98) / dist))),
          sol = solveArm(S, T2, rest.L1, rest.L2, new THREE.Vector3(side * 0.5, -0.2, 1).normalize());
        if (sol) {
          quatFrom(rest.u0, rest.b0, sol.u, sol.b, _q);
          a.quaternion.slerp(_q, m.swat);
          const el = a.userData.elbow.rotation;
          el.x += (-sol.bend - el.x) * m.swat;
        }
      }
    }
    // performing a move: the hand goes to the move's target, the elbow where the move points it, the wrist as it says
    const H = PF?.hands?.[j ? 'L' : 'R'],
      wt = H ? Math.max(0, Math.min(1, (H.w ?? 1) * pw)) : 0;
    if (wt > 0.001 && rest) {
      chest.updateWorldMatrix(true, false);
      // (own vectors: the target and the elbow direction must not share the scratch vector)
      const Tp = chest.worldToLocal(H.p.clone()),
        pole = H.pole
          ? chest
              .worldToLocal(H.pole.clone().add(chest.getWorldPosition(new THREE.Vector3())))
              .sub(chest.worldToLocal(chest.getWorldPosition(new THREE.Vector3())))
              .normalize()
          : Tp.y > S.y + 0.1
            ? new THREE.Vector3(side * 0.5, -0.15, 1)
            : new THREE.Vector3(side * 0.3, -0.2, -1);
      const sol = solveArm(S, Tp, rest.L1, rest.L2, pole.normalize());
      if (sol) {
        quatFrom(rest.u0, rest.b0, sol.u, sol.b, _q);
        a.quaternion.slerp(_q, wt);
        const el = a.userData.elbow.rotation;
        el.x += (-sol.bend - el.x) * wt;
        el.y += (-side * (H.pron ?? 0) - el.y) * wt;
      }
      if (wrist) wrist.rotation.z += (-side * (H.flex ?? 0) - wrist.rotation.z) * wt;
    }
  });
}
/* One arm of the defensive stance (DEFEND): the wrist target eases (so hands never snap between stances), then arm IK.
   m.onBall: 1 near the ball, 0 in help; m.lowHand: which hand traces the ball (the ball's side, with some hysteresis). */
const _d = new THREE.Vector3(),
  _p = new THREE.Vector3();
function defendArm(player, a, j, side, rest, m, ctx, t, S) {
  const reach = rest.L1 + rest.L2;
  if (j === 0) {
    // once per frame (the right arm comes first): how close the ball is, and which side it is on
    let near = 0,
      lateral = 0;
    if (ctx.ball) {
      const dx = ctx.ball.x - player.position.x,
        dz = ctx.ball.z - player.position.z,
        y = player.rotation.y;
      lateral = dx * Math.cos(y) - dz * Math.sin(y); // + = his left
      const d = Math.hypot(dx, dz),
        [a0, a1] = DEFEND.onBall;
      near = Math.max(0, Math.min(1, (a1 - d) / (a1 - a0)));
    }
    m.onBall = damp(m.onBall ?? near, near, 4, ctx.dt || 0);
    m.ballSide = lateral;
    if (m.lowHand == null || Math.abs(lateral) > 0.25) m.lowHand = lateral > 0 ? 1 : 0;
  }
  const ob = m.onBall ?? 0,
    low = j === m.lowHand,
    on = low ? DEFEND.low : DEFEND.high,
    poleOn = low ? DEFEND.pole.low : DEFEND.pole.high,
    // active hands: the low hand drifts toward the ball and works on a quick beat, the high hand moves a little
    lean = low ? Math.max(-0.12, Math.min(0.12, (m.ballSide || 0) * 0.15)) * ob : 0,
    beat = ctx.motion ? (low ? Math.sin(t * 6.3 + j) * 0.035 : Math.sin(t * 2.9 + 1) * 0.025) : 0,
    want = [0, 1, 2].map(k => (DEFEND.help[k] + (on[k] - DEFEND.help[k]) * ob) * reach);
  want[0] = want[0] * side + lean;
  want[1] += beat;
  const pole = [0, 1, 2].map(k => DEFEND.pole.help[k] + (poleOn[k] - DEFEND.pole.help[k]) * ob);
  m.defT ??= [null, null];
  const T = (m.defT[j] ??= new THREE.Vector3()),
    goal = _d.set(S.x + want[0], S.y + want[1], S.z + want[2]);
  if (m.defT[j].lengthSq() === 0) T.copy(goal);
  else T.lerp(goal, 1 - Math.exp(-12 * (ctx.dt || 0)));
  const sol = solveArm(S, T, rest.L1, rest.L2, _p.set(pole[0] * side, pole[1], pole[2]).normalize());
  if (!sol) return;
  quatFrom(rest.u0, rest.b0, sol.u, sol.b, _q);
  a.quaternion.slerp(_q, m.defW);
  const el = a.userData.elbow.rotation;
  el.x += (-sol.bend - el.x) * m.defW;
}
/* Wrist flex while dribbling (radians, + = toward the palm), from a dribbleAt result. The wrist stays cocked back so the
   palm lies on the ball, with a small flick (about 15 degrees) through the push, easing back while the ball bounces. */
export function dribbleWrist(d) {
  const s = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return d.contact ? -0.7 + 0.25 * s(0, 1, d.progress) : -0.45 - 0.25 * s(0, 0.5, d.progress);
}
