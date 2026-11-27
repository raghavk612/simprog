import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareCloth } from '../src/clothFit.js';

const load = v => {
  const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
  return new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
};
test('cloth fit: skin under the kit and sleeves is marked, skin at the openings and on the face and hands is not', async () => {
  for (const v of ['guard', 'forward', 'center']) {
    // its own CPU time, not the wall clock (the suite runs files in parallel: a busy machine is not a slow fit)
    const g = await load(v),
      c0 = process.cpuUsage(),
      r = prepareCloth(g),
      c = process.cpuUsage(c0),
      ms = (c.user + c.system) / 1000;
    // GitHub's shared runners (CI=true) run this fit about 1.7x slower than a dev machine (420-450 ms against
    // 230-270 ms), so they get 1.5x the budget; a real regression still fails both
    const budget = process.env.CI ? 600 : 400;
    assert.ok(ms < budget, `${v}: worked out at load in ${ms.toFixed(0)} ms of CPU (budget ${budget})`);
    assert.equal(prepareCloth(g), r, 'once per template');
    const named = {};
    g.scene.traverse(o => o.isMesh && (named[o.name] = o));
    const cover = named.body_mesh.geometry.attributes.kCover,
      pos = named.body_mesh.geometry.attributes.position,
      skin = named.body_mesh.geometry.attributes.skinIndex,
      bones = named.body_mesh.skeleton.bones.map(b => b.name),
      at = (i, s) => cover.getComponent(i, s);
    let kit = 0,
      wrongly = 0;
    for (let i = 0; i < cover.count; i++) {
      if (at(i, 0)) kit++;
      // a hand or a forearm (skinned to the wrist or elbow) is never under the kit
      const b = bones[skin.getX(i)];
      if (at(i, 0) && /wrist|elbow|head|neck/.test(b)) wrongly++;
    }
    assert.ok(kit > 300, `${v}: the torso and hips under the kit (${kit})`);
    assert.equal(wrongly, 0, `${v}: no arm, hand or head skin is hidden by the kit`);
    void pos;
    assert.ok(named.body_mesh_lod1.geometry.attributes.kCover, 'the far mesh has it too');
  }
});
test('hand fit: each wrist, its knuckle line part-way down the hand, and the fingers below it', async () => {
  const { handFit } = await import('../src/clothFit.js');
  for (const v of ['guard', 'center']) {
    const g = await load(v),
      named = {};
    g.scene.traverse(o => o.isMesh && (named[o.name] = o));
    const h = handFit(named.body_mesh),
      bones = named.body_mesh.skeleton.bones;
    assert.equal(bones[h.R.wrist].name, 'wrist_R');
    assert.equal(bones[h.L.wrist].name, 'wrist_L');
    assert.ok(h.R.knuckle[0] < 0 && h.L.knuckle[0] > 0, 'right hand on his right (-x)');
    assert.ok(h.R.length > 0.08 && h.R.length < 0.18, `${v}: finger length ${h.R.length.toFixed(3)}`);
  }
});

test('binding: lifted off the body along the skin (not fattened), only real openings kept, scraps gone', async () => {
  const { trimOpenings } = await import('../src/clothFit.js');
  for (const v of ['guard', 'forward', 'center']) {
    const g = await load(v),
      named = {};
    g.scene.traverse(o => o.isMesh && (named[o.name] = o));
    const before = trimOpenings(named.trim_mesh),
      scraps = before.length - before.reduce((s, x) => s + x, 0);
    assert.ok(scraps > 0 && scraps < before.length * 0.3, `${v}: a few scraps (${scraps} vertices)`);
    prepareCloth(g);
    const trim = named.trim_mesh,
      push = trim.geometry.attributes.kPush,
      pos = trim.geometry.attributes.position,
      skin = named.body_mesh.geometry.attributes.position,
      used = new Set(trim.geometry.index.array);
    assert.ok(push, `${v}: kPush on the binding`);
    assert.equal(named.trim_mesh_lod1.geometry.attributes.kPush, push, `${v}: the far mesh shares it`);
    // the push agrees with the outward normal of the nearest skin the kit lies on (torso and thighs; a hand hangs beside
    // the shorts in the rest pose, palm in, and would push the binding into the body)
    const body = named.body_mesh,
      bones = body.skeleton.bones.map(b => b.name),
      si = body.geometry.attributes.skinIndex,
      sw = body.geometry.attributes.skinWeight,
      sn = body.geometry.attributes.normal,
      main = i => [0, 1, 2, 3].reduce((b, k) => (sw.getComponent(i, k) > sw.getComponent(i, b) ? k : b), 0),
      onTorso = i =>
        ['pelvis', 'spine', 'chest', 'hip_L', 'hip_R'].includes(bones[si.getComponent(i, main(i))]),
      S = Array.from({ length: skin.count }, (_, i) => i).filter(onTorso),
      at = i => new THREE.Vector3().fromBufferAttribute(skin, i);
    let away = 0,
      n = 0;
    for (const i of used) {
      assert.equal(before[i], 1, `${v}: vertex ${i} of a scrap still drawn`);
      if (n >= 200 || i % 3) continue; // a sample is enough
      const p = new THREE.Vector3().fromBufferAttribute(pos, i),
        d = new THREE.Vector3().fromBufferAttribute(push, i),
        q = S.reduce((b, j) => (at(j).distanceTo(p) < at(b).distanceTo(p) ? j : b), S[0]);
      assert.ok(Math.abs(d.length() - 1) < 1e-3);
      if (d.dot(new THREE.Vector3().fromBufferAttribute(sn, q)) > 0.5) away++;
      n++;
    }
    assert.ok(
      away / n > 0.95,
      `${v}: ${((100 * away) / n).toFixed(0)}% of the binding lifted out from the body`,
    );
  }
});

test('sleeves: one plane at each end, the sleeve whole between them; the skin of the sleeved limb is marked', async () => {
  const { sleeveRims } = await import('../src/clothFit.js');
  for (const v of ['guard', 'forward', 'center']) {
    const g = await load(v),
      named = {};
    g.scene.traverse(o => o.isMesh && (named[o.name] = o));
    const r = prepareCloth(g).sleeves;
    for (const [k, mesh] of [
      ['arm', named.sleeve_arm_mesh],
      ['leg', named.sleeve_leg_mesh],
    ]) {
      const p = mesh.geometry.attributes.position;
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 0; i < p.count; i++) ((lo = Math.min(lo, p.getY(i))), (hi = Math.max(hi, p.getY(i))));
      assert.deepEqual(r[k], sleeveRims(mesh));
      assert.ok(r[k].top <= hi && r[k].top > hi - 0.1, `${v} ${k}: top plane at the top rim`);
      assert.ok(r[k].bottom >= lo && r[k].bottom < lo + 0.1, `${v} ${k}: bottom plane at the bottom rim`);
      assert.ok(r[k].top - r[k].bottom > 0.25, `${v} ${k}: most of the sleeve kept`);
    }
    // marked skin: on the right arm for the arm sleeve, the left leg for the leg sleeve (by position in the bind pose)
    const c = named.body_mesh.geometry.attributes.kCover,
      bp = named.body_mesh.geometry.attributes.position;
    let arm = 0,
      wrongArm = 0,
      leg = 0,
      wrongLeg = 0;
    for (let i = 0; i < c.count; i++) {
      if (c.getY(i)) (arm++, bp.getX(i) > -0.1 && wrongArm++); // his right is -x
      if (c.getZ(i)) (leg++, (bp.getX(i) < -0.02 || bp.getY(i) > 1.2) && wrongLeg++);
    }
    assert.ok(arm > 100 && wrongArm === 0, `${v}: arm skin marked (${arm}, ${wrongArm} elsewhere)`);
    assert.ok(leg > 100 && wrongLeg === 0, `${v}: leg skin marked (${leg}, ${wrongLeg} elsewhere)`);
  }
});
