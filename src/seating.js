/* Bleacher layout for the arena (pure: no Three, no DOM). Six-row stands on both sidelines and matching four-row stands behind both baselines, kept clear of what
   already stands there (src/arena.js): the coach's office corner and its camera (+x, -z), the locker corner and its camera (-x, -z), and the wall bars, ball rack and cones in the -x near corner. Rows rise
   away from the court; every fan faces it. Boxes are [w,h,d,x,y,z] (sizes along x,y,z and centre), ready for Arena.box(). */
export const RISE = 0.5,
  DEEP = 0.85,
  PITCH = 0.64,
  EMPTY = 0.05,
  CAMERA_CLEAR = 0.8;
/* axis 'z' = a sideline stand (rows step out along z, seats run along x), 'x' = a baseline stand. from/to bound the seats' run; id seeds each seat's look. */
export const SECTIONS = [
  { axis: 'z', side: -1, front: 10.3, back: 16, rows: 6, from: -13, to: 13, aisles: [13, 26], id: -1000 },
  { axis: 'z', side: 1, front: 10.3, back: 16, rows: 6, from: -13, to: 13, aisles: [13, 26], id: 1000 },
  { axis: 'x', side: 1, front: 16.2, back: 19.5, rows: 4, from: -3.6, to: 9.6, id: 3000 }, // +x: stops short of the office corner, whose camera hangs over z -6
  { axis: 'x', side: -1, front: 16.2, back: 19.5, rows: 4, from: -3.6, to: 9.6, id: 4000 },
]; // -x: the mirror image (the locker camera would see a stand further toward -z); its wall bars, ball rack and cones stand in the near corner past z 10
/* Stable 0..1 hash per seat number: which seats are empty, each fan's jitter, and (in arena.js) shirt and skin colours. */
export const hash = n => {
    const s = Math.sin(n * 91.7) * 43758.5453;
    return s - Math.floor(s);
  },
  R = hash;
/* Boxes [w, h, d, x, y, z] that bound a seated fan (src/crowd.js), at the largest a fan is drawn (1.08x) with room for
   the small turn each fan has: his body and arms, his head and hair (up and leaning toward the court), and his legs, down
   over the step in front. ry turns him to face the court (axis-aligned: every stand faces along x or z). */
export function fanBoxes({ x, y, z, h, ry = 0 }) {
  const fx = Math.round(Math.sin(ry)),
    fz = Math.round(Math.cos(ry)),
    // [width across him, height, depth toward the court, centre forward, centre up]
    parts = [
      [0.66, 0.86, 0.63, 0.185, 0.37], // body and arms (back 0.13 behind the seat), forearms on the knees
      [0.36, 0.34, 0.38, 0.08, 0.88], // head and hair (the hair tops out at 1.05)
      [0.42, 0.8, 0.52, 0.55, -0.17], // shins over the step, feet on the row below (toes reach 0.81)
    ];
  return parts.map(([w, hh, d, f, up]) => [fx ? d : w, hh, fx ? w : d, x + fx * f, y + h + up, z + fz * f]);
}
/* stations: camera positions [x,y,z] the stands must keep clear; a seat with any part of its fan closer than CAMERA_CLEAR to one stays empty. */
export function seatLayout(stations = []) {
  const risers = [],
    rails = [],
    slots = [],
    gap = (b, lo, hi) =>
      Math.hypot(
        ...[0, 1, 2].map(a => Math.max(lo[a] - b[a + 3] - b[a] / 2, b[a + 3] - b[a] / 2 - hi[a], 0)),
      ),
    lo = [0, 1, 2].map(a => Math.min(...stations.map(p => p[a]))),
    hi = [0, 1, 2].map(a => Math.max(...stations.map(p => p[a]))),
    near = b =>
      stations.length > 0 && gap(b, lo, hi) < CAMERA_CLEAR && stations.some(p => gap(b, p, p) < CAMERA_CLEAR); // the stations' bounding box rules out most seats at once
  for (const { axis, side, front, back, rows, from, to, aisles = [], id } of SECTIONS) {
    const len = to - from,
      mid = (from + to) / 2,
      n = Math.floor((len - 0.9) / PITCH) + 1,
      off = (len - (n - 1) * PITCH) / 2,
      ry = axis === 'z' ? (side > 0 ? Math.PI : 0) : (-side * Math.PI) / 2,
      put = (across, along) => (axis === 'z' ? [across, along] : [along, across]),
      size = (a, b) => (axis === 'z' ? [a, b] : [b, a]);
    {
      const [w, d] = size(len, 0.05),
        [x, z] = put(mid, side * (front - 0.03));
      rails.push([w, 0.26, d, x, 0.32, z]);
    }
    for (let r = 0; r < rows; r++) {
      const d = r === rows - 1 ? back - front - r * DEEP : DEEP,
        [w, dd] = size(len, d),
        [x, z] = put(mid, side * (front + r * DEEP + d / 2));
      risers.push([w, (r + 1) * RISE, dd, x, ((r + 1) * RISE) / 2, z, r % 2]);
      for (let i = 0; i < n; i++) {
        const k = id + r * 50 + i,
          [sx, sz] = put(
            from + off + i * PITCH + (R(k + 0.5) - 0.5) * 0.1,
            side * (front + r * DEEP + DEEP * 0.72), // seated toward the back of the step: the legs hang over its front edge
          ),
          s = {
            x: sx,
            y: (r + 1) * RISE,
            z: sz,
            ry,
            h: (R(k + 0.3) - 0.5) * 0.08,
            n: k,
            axis,
            aisle: aisles.includes(i),
          };
        s.taken = !s.aisle && R(k) >= EMPTY && !fanBoxes(s).some(near);
        slots.push(s);
      }
    }
  }
  return { risers, rails, slots, seats: slots.filter(s => s.taken) };
}
