import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { classicBody, attachBody } from '../src/players.js';
import { ClassicBatch, HIDDEN_LAYER } from '../src/classicBatch.js';

const kit = {
  mat: (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, ...extra }),
  textTexture: () => new THREE.Texture(),
  capMat: new THREE.MeshBasicMaterial(),
};
function team(n, x0 = 0) {
  return Array.from({ length: n }, (_, i) => {
    const p = new THREE.Group();
    p.position.set(x0 + i * 2, 0, 0);
    attachBody(p, classicBody(kit, i, 0x6832ab));
    return p;
  });
}
const posOf = (im, i) => new THREE.Vector3().setFromMatrixPosition(matAt(im, i));
// instance matrices are stored as 32-bit floats
const same = (a, b) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-5);
const matAt = (im, i) => {
  const m = new THREE.Matrix4();
  im.getMatrixAt(i, m);
  return m;
};

test('classic batch: one instance per classic player, each part where the figure has it, in its colour', () => {
  const scene = new THREE.Scene(),
    people = team(3),
    batch = new ClassicBatch(scene);
  people.forEach(p => scene.add(p));
  people[1].position.set(5, 0, -3);
  people[1].rotation.y = 0.7;
  batch.update(people);
  assert.ok(batch.meshes.length > 10, 'one instanced mesh per untextured part');
  for (const im of batch.meshes) assert.equal(im.count, 3);
  // the figures' own meshes leave the camera's layer; the textured ones (number, nameplate) stay
  let hidden = 0,
    kept = 0;
  people[0].traverse(o => {
    if (!o.isMesh) return;
    if (o.material.map) (kept++, assert.ok(o.layers.isEnabled(0)));
    else (hidden++, assert.ok(o.layers.isEnabled(HIDDEN_LAYER) && !o.layers.isEnabled(0)));
  });
  assert.equal(hidden, batch.meshes.length);
  assert.ok(kept >= 2);
  // instance k of part j is part j of the k-th player, world matrix and colour
  const parts = people[1].userData.body.batchParts;
  parts.forEach((m, j) => {
    let shown = true; // a part the figure hides (a headband this player does not wear) is drawn at zero scale
    for (let o = m; o && o !== people[1]; o = o.parent) shown &&= o.visible;
    const want = shown ? m.matrixWorld : new THREE.Matrix4().makeScale(0, 0, 0);
    assert.ok(same(matAt(batch.meshes[j], 1), want), `part ${j}`);
    const c = new THREE.Color();
    batch.meshes[j].getColorAt(1, c);
    assert.ok(
      Math.abs(c.r - m.material.color.r) +
        Math.abs(c.g - m.material.color.g) +
        Math.abs(c.b - m.material.color.b) <
        1e-5,
    );
  });
  assert.ok(posOf(batch.meshes[0], 1).distanceTo(new THREE.Vector3(5, 0, -3)) < 2.5);
});

test('classic batch: a hidden part (the head in Player view) is drawn at zero scale; other bodies take no slot', () => {
  const scene = new THREE.Scene(),
    people = team(2),
    batch = new ClassicBatch(scene);
  people[0].userData.head.visible = false;
  const other = new THREE.Group();
  other.userData.body = { style: 'athlete' };
  batch.update([other, ...people]);
  const j = people[0].userData.body.batchParts.indexOf(people[0].userData.head),
    s = new THREE.Vector3();
  assert.ok(j >= 0);
  matAt(batch.meshes[j], 0).decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  assert.equal(s.length(), 0);
  matAt(batch.meshes[j], 1).decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  assert.ok(s.length() > 0);
  for (const im of batch.meshes) assert.equal(im.count, 2);
  // no classic player at all: nothing is drawn
  batch.update([other]);
  for (const im of batch.meshes) assert.equal(im.visible, false);
});

test('classic batch: given a camera, players out of its view take no slot (none drawn when none is in view)', () => {
  const scene = new THREE.Scene(),
    near = team(2, -1),
    far = team(2, 60),
    batch = new ClassicBatch(scene),
    cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 200);
  cam.position.set(0, 1.5, 12);
  cam.lookAt(0, 1, 0);
  cam.updateMatrixWorld();
  batch.update([...near, ...far], cam);
  for (const im of batch.meshes) assert.equal(im.count, 2);
  assert.ok(same(matAt(batch.meshes[0], 1), near[1].userData.body.batchParts[0].matrixWorld));
  // without a camera (shadows on) every classic player is drawn
  batch.update([...near, ...far]);
  for (const im of batch.meshes) assert.equal(im.count, 4);
  cam.lookAt(0, 1, 30); // away from everyone
  cam.updateMatrixWorld();
  batch.update([...near, ...far], cam);
  for (const im of batch.meshes) assert.equal(im.visible, false);
});
