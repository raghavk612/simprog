// Pure 3D shot physics for the practice drills (no Three.js, no DOM, so it can be unit-tested).
// Units are feet and seconds. The rim centre is the origin of the floor plane at height RIM_H.
//   +x is to the right of a player who is facing the basket from the court, -z points at the baseline,
//   so a shooter stands at positive z and the backboard face is the plane z = BOARD_Z.
export const G = 32.2, REL_H = 7, RIM_H = 10, RIM_R = 0.75, BALL_R = 0.39, TUBE = 0.03;
export const BOARD_Z = -1.25, BOARD = { halfW: 3, y0: 8.75, y1: 12.25 }, BASELINE_Z = -5.25;
export const ARC_MIN = 40, ARC_MAX = 66, AIM_MAX = 18;
export const LEAD = 0.35; // the ball leaves the hands this far in front of the feet
const DT = 1 / 240, R2D = Math.PI / 180;

export const speedFor = power => 17 + power / 100 * 21; // ft/s from a 0-100 power setting
export const powerFor = speed => (speed - 17) / 21 * 100;

// Shooting spots (feet from the rim centre). Three-point spots stand just behind the 19 ft 9 in line.
const polar = (id, bearing, dist) => ({ id, bearing, x: +(dist * Math.sin(bearing * R2D)).toFixed(2), z: +(dist * Math.cos(bearing * R2D)).toFixed(2) });
const corner = (id, side) => ({ id, x: side * 20.4, z: -3.4, bearing: side * Math.atan2(20.4, -3.4) / R2D });
export const THREE_SPOTS = [polar('top', 0, 20.6), polar('slotL', -32, 20.6), polar('slotR', 32, 20.6), polar('wingL', -62, 20.6), polar('wingR', 62, 20.6), corner('cornerL', -1), corner('cornerR', 1)];
export const FT_SPOT = { id: 'line', bearing: 0, x: 0, z: 14.4 };
for (const s of [...THREE_SPOTS, FT_SPOT]) s.dist = +Math.hypot(s.x, s.z).toFixed(2);

// Resolve a spot given as {x,z} or as {dist,bearing}: floor position, distance and the yaw that faces the rim.
export function placeShooter({ spot, dist, bearing = 0 }) {
  let x, z;
  if (spot && Number.isFinite(spot.x)) { x = spot.x; z = spot.z; }
  else { x = dist * Math.sin(bearing * R2D); z = dist * Math.cos(bearing * R2D); }
  const d = Math.hypot(x, z) || 1e-6;
  return { x, z, dist: d, faceYaw: Math.atan2(-x, -z) }; // yaw measured from +z toward +x, as Three.js rotation.y
}

// Closed-form power that drops the ball through the middle of the swish window for a straight-on shot at the given arc.
// The window is not centred on the rim: the front iron is the tighter side, so the target sits 0.1 ft past the centre.
export const BEYOND = 0.1;
export function idealPower(dist, angle) {
  const th = angle * R2D, D = dist - LEAD + BEYOND, den = 2 * Math.cos(th) ** 2 * (REL_H + D * Math.tan(th) - RIM_H);
  if (!(den > 0)) return NaN;
  return powerFor(Math.sqrt(G * D * D / den));
}

// Unobstructed trajectory for the aim guide: the first `frac` of the flight to the rim plane, as [x,y,z] points.
export function guidePoints({ spot, dist, bearing = 0, angle, aim = 0, power, frac = 0.3, steps = 18 }) {
  const p = placeShooter({ spot, dist, bearing }), yaw = p.faceYaw - aim * R2D, th = angle * R2D, v = speedFor(power);
  const vh = v * Math.cos(th), vy = v * Math.sin(th), disc = vy * vy - 2 * G * (RIM_H - REL_H);
  const T = disc > 0 ? (vy + Math.sqrt(disc)) / G : 1;
  const sx = p.x + Math.sin(yaw) * LEAD, sz = p.z + Math.cos(yaw) * LEAD, out = [];
  for (let i = 0; i <= steps; i++) {
    const t = T * frac * i / steps;
    out.push([sx + Math.sin(yaw) * vh * t, REL_H + vy * t - G * t * t / 2, sz + Math.cos(yaw) * vh * t]);
  }
  return out;
}

// Full flight with rim (a torus of tube radius TUBE), backboard and floor. Deterministic: same input, same path.
// aim: degrees, positive = right of the line to the rim centre. Returns
//   { made, reason, miss, path, events, rimHits, board, scoreT, flight, offset }
// reason: 'swish' | 'bank' | 'rattle' when made; 'short' | 'long' | 'left' | 'right' when missed. miss is the size of the miss in feet.
export function simulateShot({ spot, dist, bearing = 0, angle, aim = 0, power }) {
  const p = placeShooter({ spot, dist, bearing }), yaw = p.faceYaw - aim * R2D, th = angle * R2D, v = speedFor(power);
  let x = p.x + Math.sin(yaw) * LEAD, y = REL_H, z = p.z + Math.cos(yaw) * LEAD;
  let vx = Math.sin(yaw) * v * Math.cos(th), vy = v * Math.sin(th), vz = Math.cos(yaw) * v * Math.cos(th);
  const path = [{ x, y, z, t: 0 }], events = [];
  let t = 0, scored = false, scoreT = null, rimHits = 0, board = false, cross = null, floorT = null, firstContact = null, apex = { x, y, z }, lastHit = -1;
  while (t < 5) {
    const py = y;
    vy -= G * DT; x += vx * DT; y += vy * DT; z += vz * DT; t += DT;
    if (y > apex.y) apex = { x, y, z };
    if (!scored) {
      // backboard: front face at z = BOARD_Z, 6 ft wide
      if (vz < 0 && z - BALL_R < BOARD_Z && z > BOARD_Z - 0.3 && Math.abs(x) < BOARD.halfW + BALL_R * 0.5 && y > BOARD.y0 && y < BOARD.y1) {
        z = BOARD_Z + BALL_R; vz *= -0.55; vy *= 0.85; vx *= 0.92;
        if (!board) { board = true; firstContact ??= { x, z }; events.push({ type: 'board', t }); }
      }
      // rim: nearest point of the circle to the ball centre
      const r = Math.hypot(x, z) || 1e-6, qx = x / r * RIM_R, qz = z / r * RIM_R;
      const dx = x - qx, dy = y - RIM_H, dz = z - qz, d = Math.hypot(dx, dy, dz);
      if (d < BALL_R + TUBE && d > 1e-6) {
        const nx = dx / d, ny = dy / d, nz = dz / d, dot = vx * nx + vy * ny + vz * nz;
        if (dot < 0) {
          vx -= 1.6 * dot * nx; vy -= 1.6 * dot * ny; vz -= 1.6 * dot * nz; vx *= 0.8; vy *= 0.8; vz *= 0.8;
          if (-dot > 2 && t - lastHit > 0.05) { rimHits++; lastHit = t; events.push({ type: 'rim', t, speed: -dot }); firstContact ??= { x: qx, z: qz }; }
        }
        x = qx + nx * (BALL_R + TUBE); y = RIM_H + ny * (BALL_R + TUBE); z = qz + nz * (BALL_R + TUBE);
      }
      // through the hoop: the centre crosses rim height going down inside the ring
      if (py >= RIM_H && y < RIM_H && vy < 0) {
        const f = (py - RIM_H) / (py - y || 1), cx = x - vx * DT * (1 - f), cz = z - vz * DT * (1 - f);
        if (Math.hypot(cx, cz) < RIM_R - BALL_R * 0.55) { scored = true; scoreT = t; vx *= 0.25; vz *= 0.25; vy *= 0.8; events.push({ type: 'net', t }); }
        else cross ??= { x: cx, z: cz, t };
      }
    }
    let done = false;
    if (y < BALL_R) {
      y = BALL_R;
      if (Math.abs(vy) > 4 && t < 4) { vy = -vy * 0.5; vx *= 0.7; vz *= 0.7; if (floorT === null) { floorT = t; events.push({ type: 'floor', t }); } }
      else done = true;
    }
    path.push({ x, y, z, t });
    if (done) break;
    if (Math.abs(x) > 45 || z > 60 || z < -30) break;
    if (scored && t > scoreT + 0.85) break;
    if (floorT !== null && t > floorT + 0.9) break;
  }
  // Classify in the shooter's frame: "long" is past the rim centre, "right" is to the shooter's right.
  const fx = -p.x / p.dist, fz = -p.z / p.dist, rx = -fz, rz = fx;
  const rel = q => ({ along: q.x * fx + q.z * fz, lat: q.x * rx + q.z * rz });
  let reason, miss = 0, offset;
  if (scored) { reason = rimHits ? 'rattle' : board ? 'bank' : 'swish'; offset = rel(path.find(q => q.t >= scoreT) || path.at(-1)); }
  else {
    offset = rel(firstContact || cross || apex);
    const dom = Math.abs(offset.along) >= Math.abs(offset.lat);
    reason = dom ? (offset.along < 0 ? 'short' : 'long') : (offset.lat < 0 ? 'left' : 'right');
    miss = +Math.abs(dom ? offset.along : offset.lat).toFixed(1);
  }
  const air = !scored && rimHits === 0 && !board;
  return { made: scored, reason, miss, air, path, events, rimHits, board, scoreT, flight: path.at(-1).t, offset, start: path[0] };
}

// Sample the path at time t (linear interpolation) for animation.
export function sampleAt(path, t) {
  if (t <= 0) return path[0];
  const i = Math.min(path.length - 1, Math.floor(t / DT));
  const a = path[i], b = path[Math.min(path.length - 1, i + 1)], f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, t };
}

// What the drill does with a raw meter reading (0-100) and the stored arc: the meter is damped around the sweet spot so a
// human can hit it (about +-6 meter points, roughly 80 ms of timing, still swishes), and the damping eases further with timing assist. Returns the effective power for simulateShot.
export const METER_SENS = 0.15, METER_SENS_ASSIST = 0.09;
export const effectivePower = (meter, ideal, assist = false) => ideal + (meter - ideal) * (assist ? METER_SENS_ASSIST : METER_SENS);
// Half-widths on the meter (0-100) of the gold sweet spot: inside `swish` a straight shot is clean, inside `made` it still goes in.
export const SWEET = { swish: 4, made: 8 }, SWEET_ASSIST = { swish: 6.5, made: 12 };
// Triangle wave: the meter fills for `fill` seconds, then falls for the same time, forever.
export function meterAt(hold, fill = 1.3) { const u = (hold / fill) % 2; return 100 * (u < 1 ? u : 2 - u); }
