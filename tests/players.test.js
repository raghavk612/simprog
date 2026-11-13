import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { classicBody, attachBody, disposeBody, validBody, variantFor, BODY_PARTS } from '../src/players.js';
const kit = {
  mat: (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, ...extra }),
  textTexture: () => new THREE.Texture(),
  capMat: new THREE.MeshBasicMaterial(),
};

test('classic body: same figure as before (mesh count, joints, sizes) and every part the Arena drives', () => {
  const b = classicBody(kit, 0, 0x6832ab);
  assert.ok(validBody(b));
  let meshes = 0;
  b.root.traverse(o => {
    if (o.isMesh) {
      meshes++;
      assert.equal(o.castShadow, true);
    }
  });
  assert.equal(
    meshes,
    20,
    'torso, head, hair, number, nameplate, badge + 2×(thigh, shorts, shin, shoe, upper arm, forearm, hand)',
  );
  assert.deepEqual(
    b.parts.legs.map(l => [l.position.x, l.position.y]),
    [
      [-0.15, 0.86],
      [0.15, 0.86],
    ],
  );
  assert.deepEqual(
    b.parts.arms.map(a => [a.position.x, a.position.y]),
    [
      [-0.3, 1.46],
      [0.3, 1.46],
    ],
  );
  assert.equal(b.parts.legs[0].userData.knee.position.y, -0.38);
  assert.equal(b.parts.arms[1].userData.elbow.position.y, -0.29);
  const box = new THREE.Box3().setFromObject(b.root);
  assert.ok(Math.abs(box.max.y - 2.03) < 0.01, `head top ${box.max.y}`);
  assert.ok(Math.abs(box.min.y - 0.39) < 0.02 || box.min.y < 0.5);
  assert.equal(b.parts.capBadge.material, kit.capMat, 'badge material is shared');
});
test('attachBody: points the player at the new parts, carries the pose over and returns the old body', () => {
  const p = new THREE.Group(),
    a = classicBody(kit, 1, 0x111111),
    b = classicBody(kit, 2, 0x222222);
  assert.equal(attachBody(p, a), null);
  for (const k of BODY_PARTS) assert.equal(p.userData[k], a.parts[k], k);
  a.parts.legs[0].rotation.x = 0.5;
  a.parts.legs[0].userData.knee.rotation.x = 0.3;
  a.parts.arms[1].rotation.set(-2.7, 0, 0.12);
  a.parts.arms[1].userData.elbow.rotation.x = -0.25;
  a.parts.head.visible = false;
  assert.equal(attachBody(p, b), a);
  assert.equal(p.children.length, 1);
  assert.equal(p.children[0], b.root);
  for (const k of BODY_PARTS) assert.equal(p.userData[k], b.parts[k], k);
  assert.equal(b.parts.legs[0].rotation.x, 0.5);
  assert.equal(b.parts.legs[0].userData.knee.rotation.x, 0.3);
  assert.equal(b.parts.arms[1].rotation.x, -2.7);
  assert.equal(b.parts.arms[1].rotation.z, 0.12);
  assert.equal(b.parts.arms[1].userData.elbow.rotation.x, -0.25);
  assert.equal(b.parts.head.visible, false, 'first-person hiding survives a swap');
  disposeBody(a, new Set([kit.capMat]));
});
test('validBody rejects bodies missing a part, and positions map to body variants', () => {
  const b = classicBody(kit, 0, 0);
  for (const k of ['jersey', 'number', 'head'])
    assert.equal(validBody({ ...b, parts: { ...b.parts, [k]: undefined } }), false, k);
  assert.equal(validBody({ ...b, parts: { ...b.parts, legs: [b.parts.legs[0]] } }), false);
  assert.equal(validBody(null), false);
  assert.equal(variantFor('Guard'), 'guard');
  assert.equal(variantFor('Point Guard'), 'guard');
  assert.equal(variantFor('Center'), 'center');
  assert.equal(variantFor('Forward'), 'forward');
  assert.equal(variantFor(undefined), 'forward');
});
test('athlete bodies: every variant file loads as a rigged body the Arena can drive', async () => {
  const fs = await import('node:fs');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { athleteBody, BODY_VARIANTS } = await import('../src/players.js');
  for (const v of BODY_VARIANTS) {
    const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
    );
    const look = { hair: 'afro', hairColor: 0x221813, headband: true, armSleeve: true, legSleeve: false };
    const b = athleteBody(gltf, kit, 3, 0x6832ab, v, look);
    assert.ok(validBody(b), v);
    assert.equal(b.variant, v);
    assert.equal(b.key, `${v}|afro+band+arm`);
    assert.ok(b.parts.head.isMesh && !b.parts.head.isBone, 'head is the mesh, not the bone');
    assert.deepEqual(
      b.parts.hair.children.map(o => o.name).sort(),
      ['headband_mesh', 'hair_afro_mesh'].sort(),
      'one hair style plus the headband, hidden together in Player view',
    );
    const names = [];
    b.root.traverse(o => {
      if (o.isSkinnedMesh || (o.isGroup && o.name.endsWith('_mesh'))) names.push(o.name);
    });
    for (const n of ['jersey_mesh', 'shorts_mesh', 'shoes_mesh', 'sleeve_arm_mesh'])
      assert.ok(names.includes(n), n);
    for (const n of ['hair_buzz_mesh', 'hair_crop_mesh', 'hair_rows_mesh', 'sleeve_leg_mesh'])
      assert.ok(!names.includes(n), `${n} is dropped`);
    const kitMeshes = [];
    b.root.traverse(o => {
      if (o.isSkinnedMesh && o.material === b.parts.jersey) kitMeshes.push(o.name);
    });
    assert.deepEqual(
      kitMeshes.sort(),
      ['jersey_mesh', 'shorts_mesh'],
      'team colour reaches jersey and shorts',
    );
    assert.deepEqual(
      b.parts.legs.map(l => l.name),
      ['hip_R', 'hip_L'],
    );
    assert.deepEqual(
      b.parts.arms.map(a => a.name),
      ['shoulder_R', 'shoulder_L'],
    );
    for (const bone of [...b.parts.legs, ...b.parts.arms])
      assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1], 'bones rest unrotated');
    assert.ok(
      b.parts.legs[0].position.x < 0 && b.parts.arms[0].getWorldPosition(new THREE.Vector3()).x < 0,
      'x<0 side first, like the classic figure',
    );
    let tris = 0;
    b.root.traverse(o => {
      if (o.isSkinnedMesh) {
        tris += o.geometry.index.count / 3;
        assert.equal(o.frustumCulled, false);
      }
    });
    assert.ok(tris > 10000 && tris < 15000, `${v}: ${tris} triangles in budget`);
    {
      const d = athleteBody(gltf, kit, 3, 0x6832ab, v, look);
      d.setLettering(3, 'KANGS', '#ffffff', '#2a1050', 'home');
      const U = d.parts.jersey.userData.print,
        tex = [U.kPrintF.value, U.kPrintB.value];
      let freed = 0;
      tex.forEach(t => t.addEventListener('dispose', () => freed++));
      disposeBody(d, new Set([kit.capMat]));
      assert.equal(freed, 2, `${v}: disposeBody frees the jersey print textures`);
    }
    {
      const w = athleteBody(gltf, kit, 3, 0x6832ab, v, { ...look, legSleeve: true });
      let t = 0;
      w.root.traverse(o => {
        if (o.isSkinnedMesh) t += o.geometry.index.count / 3;
      });
      assert.ok(t < 15000, `${v}: worst-case look (afro, band, both sleeves) ${t} triangles in budget`);
    }
    // one shared skeleton per body, and a far-distance version (about a third of the triangles) swapped in by setLod
    const skels = new Set();
    b.root.traverse(o => {
      if (o.isSkinnedMesh) skels.add(o.skeleton);
    });
    assert.equal(skels.size, 1, 'all meshes share one skeleton');
    assert.ok(!names.some(n => n.endsWith('_lod1')), 'LOD meshes are not separate objects');
    const count = () => {
      let t = 0;
      b.root.traverse(o => {
        if (o.isSkinnedMesh) t += o.geometry.index.count / 3;
      });
      return t;
    };
    b.setLod(1);
    const far = count();
    assert.ok(far > tris * 0.2 && far < tris * 0.45, `${v}: far ${far} of ${tris}`);
    b.root.traverse(o => {
      if (o.isSkinnedMesh && o.userData.lods)
        assert.equal(
          o.geometry.attributes.position,
          o.userData.lods[0].attributes.position,
          'same vertices, only fewer triangles',
        );
    });
    b.setLod(0);
    assert.equal(count(), tris);
    const box = new THREE.Box3().setFromObject(b.root);
    const h = box.max.y;
    assert.ok(h > 2.0 && h < 2.4, `${v} height ${h}`);
  }
});
test('athlete heads: the head joint sits inside the head above the chin, and the painted face sits on the head', async () => {
  const fs = await import('node:fs');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { BODY_VARIANTS } = await import('../src/players.js');
  const BONES = [
    'pelvis',
    'spine',
    'chest',
    'neck',
    'head',
    'shoulder_L',
    'elbow_L',
    'wrist_L',
    'shoulder_R',
    'elbow_R',
    'wrist_R',
    'hip_L',
    'knee_L',
    'ankle_L',
    'hip_R',
    'knee_R',
    'ankle_R',
  ];
  const sizes = {};
  for (const v of BODY_VARIANTS) {
    const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
    );
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const bones = {};
    let info = null,
      head = null;
    root.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.userData?.face) info = o.userData;
      if (o.isSkinnedMesh && o.name === 'head_mesh') head = o;
    });
    assert.deepEqual(
      Object.keys(bones).sort(),
      [...BONES].sort(),
      `${v}: bone names unchanged (animations target them)`,
    );
    assert.ok(head && info, `${v}: head mesh and face extras`);
    const at = k => bones[k].getWorldPosition(new THREE.Vector3());
    const hj = at('head'),
      nj = at('neck'),
      cj = at('chest');
    // rest pose: the skinned head mesh's own positions are model space (bones rest unrotated, mesh nodes untransformed)
    const pos = head.geometry.attributes.position,
      box = new THREE.Box3().setFromBufferAttribute(pos);
    // chin: the lowest point of the face front (near the midline, within 6 cm of the nose tip's depth, under 15 cm below the tip)
    let tipY = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) >= box.max.z - 1e-6) tipY = pos.getY(i);
    let chin = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 0.03 && pos.getZ(i) > box.max.z - 0.06 && pos.getY(i) > tipY - 0.15)
        chin = Math.min(chin, pos.getY(i));
    }
    const inside = (p, b, pad = 0) =>
      p.x > b.min.x - pad &&
      p.x < b.max.x + pad &&
      p.y > b.min.y - pad &&
      p.y < b.max.y + pad &&
      p.z > b.min.z - pad &&
      p.z < b.max.z + pad;
    assert.ok(
      inside(hj, box),
      `${v}: head joint ${hj.toArray().map(n => n.toFixed(3))} inside the head ${box.min.toArray().map(n => n.toFixed(3))}..${box.max.toArray().map(n => n.toFixed(3))}`,
    );
    assert.ok(
      hj.y > chin + 0.04,
      `${v}: head joint ${hj.y.toFixed(3)} well above the chin ${chin.toFixed(3)}`,
    );
    assert.ok(
      hj.y < box.max.y - 0.12 && Math.abs(hj.x) < 1e-4 && hj.z < box.max.z - 0.08,
      `${v}: head joint low in the skull, behind the face (near the top of the spine)`,
    );
    assert.ok(
      nj.y < hj.y - 0.08 && nj.y > cj.y + 0.1 && nj.y > box.min.y - 0.15,
      `${v}: neck joint ${nj.y.toFixed(3)} in the neck, between the chest ${cj.y.toFixed(3)} and the head ${hj.y.toFixed(3)}`,
    );
    // the painted face: its centre and frame lie on the head, and the eye and mouth lines land between the brow and the chin
    const c = hj.clone().add(new THREE.Vector3().fromArray(info.face)),
      [fw, fh] = info.faceSize;
    sizes[v] = [fw, fh];
    assert.ok(inside(c, box), `${v}: face centre ${c.toArray().map(n => n.toFixed(3))} inside the head`);
    assert.ok(
      c.z > box.max.z - 0.05,
      `${v}: face centre on the front of the face (z ${c.z.toFixed(3)}, nose tip ${box.max.z.toFixed(3)})`,
    );
    assert.ok(
      c.x - fw / 2 > box.min.x &&
        c.x + fw / 2 < box.max.x &&
        c.y + fh / 2 < box.max.y &&
        c.y - fh / 2 > box.min.y - 0.03,
      `${v}: face frame ${fw.toFixed(3)} x ${fh.toFixed(3)} within the head`,
    );
    const m = info.faceMarks;
    assert.ok(m, `${v}: face landmarks for the painted features`);
    const row = f => c.y + (0.5 - f) * fh; // texture rows run from the top of the frame (0) to the bottom (1)
    assert.ok(
      row(m.brow) > row(m.eye) &&
        row(m.eye) > row(m.nose) &&
        row(m.nose) > row(m.mouth) &&
        row(m.mouth) > row(m.chin),
      `${v}: brow > eye > nose > mouth > chin`,
    );
    assert.ok(
      row(m.eye) > hj.y && row(m.eye) < box.max.y - 0.09,
      `${v}: eye line ${row(m.eye).toFixed(3)} in the upper face`,
    );
    assert.ok(
      Math.abs(row(m.chin) - chin) < 0.012,
      `${v}: painted chin line ${row(m.chin).toFixed(3)} on the chin ${chin.toFixed(3)}`,
    );
    assert.ok(
      m.pupil > 0 && m.pupil < 0.5 && Math.abs(m.pupil * fw - 0.0358) < 0.004,
      `${v}: pupils about 33 mm from the midline`,
    );
  }
  // heads are absolute sizes: the painted face is (almost) the same size on the guard and the center
  assert.ok(
    Math.abs(sizes.guard[0] - sizes.center[0]) < 0.006 && Math.abs(sizes.guard[1] - sizes.center[1]) < 0.01,
    `face size does not scale with height: ${JSON.stringify(sizes)}`,
  );
});
test('looks: the same player always gets the same hair and options, and players differ', async () => {
  const { lookFor, lookKey, HAIR_STYLES } = await import('../src/players.js');
  assert.deepEqual(lookFor(42), lookFor(42));
  const keys = new Set(),
    hair = new Set();
  for (let i = 0; i < 60; i++) {
    const l = lookFor('player' + i);
    keys.add(lookKey(l));
    hair.add(l.hair);
    assert.ok(HAIR_STYLES.includes(l.hair));
  }
  assert.equal(hair.size, 4, 'every hair style is used');
  assert.ok(keys.size > 8, 'plenty of different looks');
});
test('athlete hands: rigid on the wrist, and the fingers stay off the ball when dribbling, holding and shooting', async () => {
  // the game's own animation (motion.js animateAthlete) with the ball where the Arena puts it; the hand is skinned to the
  // wrist bone only, so its vertices are found by weight. The rule (motion.js): wrist at ball radius .13 + .07 from the centre.
  const { loadBody, drive, POSES, BALL_RADIUS } =
    await import('../assets-src/players/cloudmesh/ball_samples.mjs');
  const { BODY_VARIANTS } = await import('../src/players.js');
  for (const v of BODY_VARIANTS) {
    const { body, player } = await loadBody(v);
    let mesh;
    body.root.traverse(o => {
      if (o.isSkinnedMesh && o.name === 'body_mesh') mesh = o;
    });
    const sk = mesh.skeleton,
      wrists = ['wrist_R', 'wrist_L'].map(n => sk.bones.findIndex(b => b.name === n)),
      ji = mesh.geometry.attributes.skinIndex,
      jw = mesh.geometry.attributes.skinWeight,
      hand = [];
    for (let i = 0; i < ji.count; i++) if (jw.getX(i) > 0.999 && wrists.includes(ji.getX(i))) hand.push(i);
    assert.ok(hand.length > 600, `${v}: ${hand.length} rigid hand vertices`);
    const p = new THREE.Vector3();
    for (const pose of Object.keys(POSES)) {
      let closest = Infinity,
        f = 0;
      drive(player, pose, ball => {
        if (f++ % 2) return;
        sk.update();
        for (const i of hand) {
          mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld);
          closest = Math.min(closest, p.distanceTo(ball) - BALL_RADIUS);
        }
      });
      assert.ok(closest > 0.002, `${v} ${pose}: hand ${closest.toFixed(4)} from the ball`);
    }
  }
});
