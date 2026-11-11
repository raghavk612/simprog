// The seated crowd in the bleachers: one figure shape drawn as four instanced meshes (shirt, skin, hair, legs), so every fan
// gets his own colours in four draw calls. Each fan sits on the riser with his forearms on his knees and his shins over the
// step, feet on the row below (src/seating.js puts the seat 0.47 behind the row's front edge, with the next row 0.5 lower).
// The sway is done on the GPU: a slow breathing shift for everyone, and a bounce for a while after the Kangs score.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* A capsule from a to b (local points [x,y,z]), radius r. */
function limb(a, b, r) {
  const A = new THREE.Vector3(...a),
    B = new THREE.Vector3(...b),
    len = A.distanceTo(B),
    g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, 7);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()),
  );
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
const both = fn => [-1, 1].map(fn);
const merge = list => mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)));

/* The figure's parts in its own space: origin on the riser top under the hips, +z toward the court. Sized like the players. */
export function fanParts() {
  const torso = new THREE.CylinderGeometry(0.2, 0.165, 0.48, 12, 1);
  torso.scale(1, 1, 0.62);
  torso.rotateX(0.1); // leaning in a little toward the game
  torso.translate(0, 0.36, 0.02);
  const shoulders = new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  shoulders.scale(1, 0.32, 0.62);
  shoulders.translate(0, 0.6, 0.045);
  const clothes = merge([
    torso,
    shoulders,
    ...both(s => limb([s * 0.2, 0.58, 0.05], [s * 0.22, 0.34, 0.16], 0.058)), // upper arms
  ]);
  const head = new THREE.SphereGeometry(0.125, 14, 10);
  head.scale(0.92, 1.1, 1);
  head.translate(0, 0.81, 0.07);
  const skin = merge([
    head,
    limb([0, 0.62, 0.05], [0, 0.72, 0.06], 0.05), // neck
    ...both(s => limb([s * 0.22, 0.34, 0.16], [s * 0.13, 0.22, 0.4], 0.045)), // forearms down to the knees
    ...both(s => {
      const h = new THREE.SphereGeometry(0.048, 8, 6);
      h.translate(s * 0.12, 0.2, 0.44);
      return h;
    }),
  ]);
  const hair = new THREE.SphereGeometry(0.133, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
  hair.scale(0.94, 1.12, 1.02);
  hair.translate(0, 0.825, 0.06);
  const legs = merge([
    ...both(s => limb([s * 0.1, 0.1, 0.04], [s * 0.11, 0.13, 0.43], 0.078)), // thighs on the seat
    ...both(s => limb([s * 0.11, 0.13, 0.43], [s * 0.12, -0.4, 0.58], 0.062)), // shins over the step
    ...both(s => {
      const f = new THREE.BoxGeometry(0.1, 0.08, 0.22);
      f.translate(s * 0.12, -0.46, 0.63);
      return f;
    }),
  ]);
  return { clothes, skin, hair, legs };
}

const SHIRTS = [
  0x6832ab, 0x6832ab, 0x7541b0, 0x3d1d66, 0xf3ecff, 0xe9b858, 0x2b2b31, 0x8b8b94, 0xf2f2f2, 0x6832ab,
];
const SKIN = [0xca9e79, 0x8c5f41, 0xf2cbab, 0x6b4430, 0xe0b48c, 0xa8754f, 0x4a3022];
const HAIR = [0x161210, 0x161210, 0x2b1d14, 0x4a3020, 0x6e4e30, 0xb8925a, 0x8a8a8a];
const PANTS = [0x26354f, 0x1b1b1f, 0x3a3f4a, 0x2e3b5c, 0x7d705a, 0x1f2a40];

/* The crowd for the seats from seatLayout. hash(n) gives each seat its stable 0..1 values. Returns the meshes and
   update(dt, cheer) to drive the sway (cheer 0..1: how hard they bounce). */
export function buildCrowd(seats, hash) {
  const parts = fanParts(),
    uniforms = { kTime: { value: 0 }, kCheer: { value: 0 } },
    material = () => {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
      m.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float kTime; uniform float kCheer;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
#ifdef USE_INSTANCING
 float kPh = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
 float kUp = clamp((position.y + 0.1) / 0.5, 0.0, 1.0); // the feet stay on the step
 transformed.z += sin(kTime * 0.6 + kPh * 1.7) * 0.025 * position.y;
 transformed.y += kUp * (sin(kTime * 1.3 + kPh) * 0.008 + kCheer * max(0.0, sin(kTime * 9.0 + kPh)) * 0.14);
#endif`,
          );
      };
      return m;
    };
  const meshes = {};
  for (const k of ['clothes', 'skin', 'hair', 'legs']) {
    meshes[k] = new THREE.InstancedMesh(parts[k], material(), seats.length);
    meshes[k].castShadow = true;
    meshes[k].receiveShadow = true;
  }
  const m = new THREE.Matrix4(),
    zero = new THREE.Matrix4().makeScale(0, 0, 0),
    col = new THREE.Color(),
    pick = (list, v) => list[Math.floor(v * list.length) % list.length];
  seats.forEach(({ x, y, z, ry, h, n }, i) => {
    const size = 0.94 + hash(n + 0.15) * 0.14; // people differ in size
    m.makeRotationY(ry + (hash(n + 0.25) - 0.5) * 0.3)
      .scale(new THREE.Vector3(size, size, size))
      .setPosition(x, y + h, z);
    for (const k of ['clothes', 'skin', 'legs']) meshes[k].setMatrixAt(i, m);
    meshes.hair.setMatrixAt(i, hash(n + 0.45) < 0.12 ? zero : m); // some fans have shaved heads
    meshes.clothes.setColorAt(i, col.set(pick(SHIRTS, hash(n + 0.7))));
    meshes.skin.setColorAt(i, col.set(pick(SKIN, hash(n + 0.9))));
    meshes.hair.setColorAt(i, col.set(pick(HAIR, hash(n + 0.35))));
    meshes.legs.setColorAt(i, col.set(pick(PANTS, hash(n + 0.55))));
  });
  return {
    meshes: Object.values(meshes),
    update(dt, cheer) {
      uniforms.kTime.value += dt;
      uniforms.kCheer.value = cheer;
    },
  };
}
