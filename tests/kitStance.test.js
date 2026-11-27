// The shorts in a wide stance: the athlete GLBs posed with their own skeleton and skin weights (three.js skinning, as the
// game draws them), legs bent and spread as on defence and in a stride. The cloth must turn with the thighs: no edge of
// the shorts stretches more than STRETCH times its rest length (the skin of the hips stretches up to 12 times there, so
// this is not a free pass), and no thigh skin that the shorts cover comes out through them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const STRETCH = 4;
// hip flexion (x, negative = thigh forward), abduction (z, out to the side) and knee bend per leg, as motion.js sets them
// (hip order XZY); the defensive stance is about 0.2 abduction plus the foot's reach, up to 0.8
const POSES = {
  deep: { L: [-0.8, 0.45, 1.3], R: [-0.8, 0.45, 1.3] },
  wide: { L: [-0.5, 0.65, 0.9], R: [-0.5, 0.65, 0.9] },
  stride: { L: [-1.0, 0.15, 1.2], R: [0.35, 0.05, 0.3] },
};

const load = v => {
  const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
  return new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
};
function pose(named, scene, p) {
  for (const [s, sg] of [
    ['L', 1],
    ['R', -1],
  ]) {
    const [hx, ab, kn] = p[s],
      hip = named['hip_' + s];
    hip.rotation.order = 'XZY';
    hip.rotation.set(hx, 0, sg * ab);
    named['knee_' + s].rotation.set(kn, 0, 0);
  }
  scene.updateMatrixWorld(true);
}
function positions(mesh) {
  mesh.skeleton.update();
  const a = mesh.geometry.attributes.position,
    out = new Float64Array(a.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) {
    mesh.getVertexPosition(i, v);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}
/* Signed distance of point p from the closest point of a triangle soup (positive: on the side its normal points to). */
function signedToMesh(p, Q, idx) {
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    tri = new THREE.Triangle(),
    q = new THREE.Vector3(),
    n = new THREE.Vector3();
  let best = Infinity,
    side = 0;
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(Q, idx[t] * 3);
    b.fromArray(Q, idx[t + 1] * 3);
    c.fromArray(Q, idx[t + 2] * 3);
    tri.set(a, b, c);
    tri.closestPointToPoint(p, q);
    const d = q.distanceToSquared(p);
    if (d < best) {
      best = d;
      tri.getNormal(n);
      side = n.dot(q.sub(p).negate());
    }
  }
  return side;
}

for (const v of ['guard', 'forward', 'center'])
  test(`${v}: in a wide stance the shorts turn with the thighs (no streaks, no skin through them)`, async () => {
    const g = await load(v),
      named = {};
    g.scene.traverse(o => o.name && (named[o.name] = o));
    const shorts = named.shorts_mesh,
      body = named.body_mesh,
      H = g.scene.getObjectByName('player').userData.height,
      idx = shorts.geometry.index.array,
      R = positions(shorts);
    // the skin the shorts cover: the hips and thighs (skinned mostly to the pelvis or a leg) from 1 cm over the hems
    // (.334 H) to the crotch, drawn (used by a triangle)
    const bones = body.skeleton.bones.map(b => b.name),
      si = body.geometry.attributes.skinIndex,
      sw = body.geometry.attributes.skinWeight,
      used = new Set(body.geometry.index.array),
      B0 = positions(body),
      covered = [...used].filter(i => {
        const y = B0[i * 3 + 1] / H,
          main = [0, 1, 2, 3].reduce((m, k) => (sw.getComponent(i, k) > sw.getComponent(i, m) ? k : m), 0);
        return (
          y > 0.345 &&
          y < 0.45 &&
          Math.abs(B0[i * 3]) < 0.15 * H &&
          /^(pelvis|hip_|knee_)/.test(bones[si.getComponent(i, main)])
        );
      });
    assert.ok(covered.length > 100, `${v}: ${covered.length} skin vertices under the shorts`);
    for (const [name, p] of Object.entries(POSES)) {
      pose(named, g.scene, p);
      const Q = positions(shorts),
        B = positions(body),
        len = (A, a, b) =>
          Math.hypot(A[a * 3] - A[b * 3], A[a * 3 + 1] - A[b * 3 + 1], A[a * 3 + 2] - A[b * 3 + 2]);
      let worst = 0;
      for (let t = 0; t < idx.length; t += 3)
        for (let e = 0; e < 3; e++) {
          const a = idx[t + e],
            b = idx[t + ((e + 1) % 3)],
            r = len(R, a, b);
          if (r > 0.011) worst = Math.max(worst, len(Q, a, b) / r); // edges of 1 cm or more
        }
      assert.ok(worst < STRETCH, `${v} ${name}: a shorts edge stretches ${worst.toFixed(2)} times`);
      const out = covered.filter(i => signedToMesh(new THREE.Vector3().fromArray(B, i * 3), Q, idx) > 0.002);
      assert.ok(out.length <= 2, `${v} ${name}: ${out.length} thigh skin vertices out through the shorts`);
    }
  });
