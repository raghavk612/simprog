// Puts a move's pose (base frame, src/moves/core.js sample) on a player standing at `base` ({x, z, yaw} in the world):
// where his root goes and turns, and every target in world space for motion.js (ctx.perform). Shared by the Arena and the
// move preview (preview-moves.html), so what the preview shows is what the game plays.
import * as THREE from 'three';
import { yawRot } from './core.js';

export const toWorld = (p, base) => {
  const r = yawRot(p, base.yaw);
  return new THREE.Vector3(base.x + r[0], r[1], base.z + r[2]);
};
const dirToWorld = (d, base) => new THREE.Vector3(...yawRot(d, base.yaw));

/* The player's root (position and facing) for a frame. */
export function rootPose(f, base) {
  const p = toWorld([f.body.x, f.body.y, f.body.z], base);
  return { x: p.x, y: Math.max(0, f.body.y), z: p.z, yaw: base.yaw + f.body.yaw };
}

/* Every target of a frame in world space. In a jump the planted feet come off the floor with him (most of the way: the
   legs hang long, toes down). */
export function worldFrame(f, base) {
  const W = p => toWorld(p, base),
    air = f.gait ? 0 : Math.max(0, f.body.y) * 0.9;
  const hands = {},
    feet = {};
  for (const h of ['R', 'L']) {
    const H = f.hands[h];
    hands[h] = { ...H, p: W(H.p), pole: H.pole ? dirToWorld(H.pole, base) : null };
    const F = f.feet[h];
    feet[h] = { p: W([F.p[0], F.p[1] + air, F.p[2]]), yaw: base.yaw + F.yaw };
  }
  return {
    ball: W(f.ball),
    spin: f.spin ? dirToWorld(f.spin, base) : null,
    gait: !!f.gait,
    hands,
    feet,
    body: f.body,
    look: f.look ? W(f.look) : null,
    holder: f.holder,
    extra: f.extra,
    move: f.move,
  };
}
