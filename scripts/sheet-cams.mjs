// Shared by scripts/contact-sheet.mjs and scripts/players-shots.mjs: the fixed plays and the fixed cameras.
import { sampleClip, shotTiming, CLIP_SECONDS, SHOTS } from '../src/basketball.js';

export const S = CLIP_SECONDS;
/* Plays: [home, away] overrides of the fixture possession. clip 0 is the home play, clip 1 the visitors'. */
export const HOME = (kind, o = {}) => [
  { kind, outcome: 'made', points: SHOTS[kind]?.three ? 3 : 2, contest: 'contested', lane: 1, ...o },
  { kind: 'pullup', outcome: 'miss', points: 0, lane: -1, contest: 'contested' },
];
/* Moments of a shot (seconds): approach, gather, takeoff, release, top of the fall, landing. */
export function shotMoments(kind) {
  const T = shotTiming(kind),
    s = x => +(x * S).toFixed(3);
  return [
    s(T.gather - 0.1),
    s(T.gather + 0.04),
    s(T.takeoff),
    s(T.release),
    s((T.release + T.land) / 2),
    s(T.land + 0.04),
  ];
}
export const even = (a, b, n = 6) =>
  Array.from({ length: n }, (_, i) => +(a + ((b - a) * i) / (n - 1)).toFixed(3));
/* The camera for a row: it keeps a fixed offset from the subject (so he stays the same size in every moment and his
   travel shows against the floor), from the side of his travel or facing, turned `angle` degrees toward his front. The
   direction is the one nearest that, among 24 round him, that keeps every other player out of the lens and off the line
   of sight at all the row's moments and stays inside the gym. fixed: the camera stays put instead (aimed at the middle).
   face: placed by the way he faces instead of the way he travels. include: [x, z], a point the fixed camera frames
   with him (the rim for a putback). */
const FOV = 43;
export function sideCam(
  clip,
  idx,
  moments,
  { dist = 4.6, height = 1.45, angle = 25, aimY = 1.05, fixed = false, face = false, include = null } = {},
) {
  const S = moments.map(m => sampleClip(clip, m).actors),
    at = S.map(A => A[idx]),
    travel = [at.at(-1).x - at[0].x, at.at(-1).z - at[0].z],
    moved = Math.hypot(...travel),
    mid = at[Math.floor(at.length / 2)],
    // face: by the way he faces, not the way he travels (a defender backpedals: "toward his front" along his travel is
    // his back)
    fwd =
      moved > 1 && !face ? [travel[0] / moved, travel[1] / moved] : [Math.sin(mid.yaw), Math.cos(mid.yaw)],
    r = (angle * Math.PI) / 180;
  let best = null;
  for (let k = 0; k < 24; k++) {
    const th = (k / 24) * Math.PI * 2,
      u = [Math.cos(th), Math.sin(th)],
      // how far from the wanted side (either side), plus a small preference for the broadcast (+z) side
      ideal = Math.max(
        ...[1, -1].map(sg => {
          const w = [
            fwd[1] * sg * Math.cos(r) + fwd[0] * Math.sin(r),
            -fwd[0] * sg * Math.cos(r) + fwd[1] * Math.sin(r),
          ];
          return u[0] * w[0] + u[1] * w[1];
        }),
      );
    let pen = (1 - ideal) * 3 - (u[1] > 0 ? 0.3 : 0);
    S.forEach((A, mi) => {
      const p = at[mi],
        c = [p.x + u[0] * dist, p.z + u[1] * dist];
      if (Math.abs(c[0]) > 14.6 || Math.abs(c[1]) > 7.9) pen += 2;
      A.forEach((o, j) => {
        if (j === idx) return;
        const dc = Math.hypot(o.x - c[0], o.z - c[1]);
        if (dc < 1.6) pen += 4;
        // on the line of sight: between the camera and him, close to the line
        const vx = p.x - c[0],
          vz = p.z - c[1],
          L = Math.hypot(vx, vz),
          tt = ((o.x - c[0]) * vx + (o.z - c[1]) * vz) / (L * L);
        if (tt > 0.05 && tt < 0.9) {
          const q = Math.hypot(c[0] + vx * tt - o.x, c[1] + vz * tt - o.z);
          if (q < 0.6) pen += 1.5 * (1 - q / 0.6);
        }
      });
    });
    if (!best || pen < best.pen) best = { pen, u };
  }
  const off = [best.u[0] * dist, height - aimY, best.u[1] * dist];
  if (fixed) {
    const xs = [...at.map(a => a.x), ...(include ? [include[0]] : [])],
      zs = [...at.map(a => a.z), ...(include ? [include[1]] : [])],
      c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
    return { position: [c[0] + off[0], height, c[1] + off[2]], target: [c[0], aimY, c[1]] };
  }
  return { follow: true, offset: off, aimY };
}
