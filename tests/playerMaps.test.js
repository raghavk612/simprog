import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {
  AthleteMaps,
  MAP_ATLASES,
  ATLAS_OF,
  mapFile,
  mapsOn,
  AO_INTENSITY,
  NORMAL_SCALE,
} from '../src/playerMaps.js';
import { athleteBody, disposeBody, BODY_VARIANTS } from '../src/players.js';

const kit = { capMat: new THREE.MeshBasicMaterial() };
const MAPS_DIR = new URL('../public/models/players/maps/', import.meta.url);
const look = { hair: 'afro', hairColor: 0x221813, headband: true, armSleeve: true, legSleeve: true };

async function loadGlb(v) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
  return new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
}
// The tests cannot decode images: a stub loader hands out empty textures named after the file and counts the loads.
function stubLoader() {
  const calls = [];
  const load = url => {
    calls.push(url);
    const t = new THREE.Texture();
    t.name = url.split('/').pop();
    return Promise.resolve(t);
  };
  return { load, calls };
}
const tick = () => new Promise(r => setTimeout(r, 0));
// Every material of a body that a map can go on, by its name (skin, kit, shoes, sole, hair, band, sleeve, trim).
function materials(body) {
  const out = new Map();
  body.root.traverse(o => {
    if (o.isSkinnedMesh) out.set(o.material.name === 'sleeve' ? `${o.name}` : o.material.name, o.material);
  });
  return out;
}

test('player GLBs: every primitive carries the bake tangent frame and atlas UVs in range', async () => {
  for (const v of BODY_VARIANTS) {
    const gltf = await loadGlb(v);
    let prims = 0;
    gltf.scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      prims++;
      const g = o.geometry,
        uv = g.attributes.uv,
        tan = g.attributes.tangent;
      assert.ok(uv && tan, `${v} ${o.name}: TEXCOORD_0 and TANGENT`);
      assert.equal(tan.itemSize, 4, 'tangent xyz + handedness');
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i),
          w = uv.getY(i);
        assert.ok(u >= 0 && u <= 1 && w >= 0 && w <= 1, `${v} ${o.name}: uv ${u}, ${w} in 0..1`);
        const l = Math.hypot(tan.getX(i), tan.getY(i), tan.getZ(i));
        assert.ok(
          Math.abs(l - 1) < 1e-3 && Math.abs(Math.abs(tan.getW(i)) - 1) < 1e-6,
          `${v} ${o.name}: unit tangent, w ±1`,
        );
      }
    });
    assert.ok(prims >= 14, `${v}: ${prims} skinned primitives checked`);
  }
});

test('player maps: a PNG per variant and atlas at its size, baked for the UV layout the GLB carries', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', MAPS_DIR), 'utf8'));
  const size = file => {
    const b = fs.readFileSync(new URL(file, MAPS_DIR));
    assert.equal(b.subarray(1, 4).toString(), 'PNG', `${file} is a PNG`);
    assert.equal(b[25], 6, `${file} is RGBA (normal in RGB, AO in A)`);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  for (const v of BODY_VARIANTS) {
    for (const [atlas, high, medium] of [
      ['skin', 2048, 1024],
      ['kit', 1024, 1024],
      ['gear', 1024, 1024],
    ]) {
      assert.deepEqual(size(mapFile(v, atlas, 'high')), [high, high], `${v} ${atlas} on High`);
      assert.deepEqual(size(mapFile(v, atlas, 'medium')), [medium, medium], `${v} ${atlas} on Medium`);
    }
    const gltf = await loadGlb(v);
    let extras = null;
    gltf.scene.traverse(o => o.userData?.maps && (extras = o.userData.maps));
    assert.ok(extras?.uvHash, `${v}: the GLB records its UV layout`);
    assert.equal(
      manifest[v]?.uvHash,
      extras.uvHash,
      `${v}: maps baked for this GLB's UVs (rebuild with python3 scripts/build_players.py --bake ${v})`,
    );
  }
});

test('map files: every body material reads one of the three atlases; skin is half size on Medium', () => {
  assert.deepEqual(MAP_ATLASES, ['skin', 'kit', 'gear']);
  for (const m of ['skin', 'kit', 'shoes', 'sole', 'hair', 'band', 'sleeve', 'trim'])
    assert.ok(MAP_ATLASES.includes(ATLAS_OF[m]), m);
  assert.equal(mapFile('guard', 'skin', 'high'), 'guard_skin.png');
  assert.equal(mapFile('guard', 'skin', 'medium'), 'guard_skin_1k.png');
  assert.equal(mapFile('center', 'kit', 'medium'), 'center_kit.png');
  assert.equal(mapFile('forward', 'gear', 'high'), 'forward_gear.png');
  assert.deepEqual(['auto', 'low', 'medium', 'high', undefined].map(mapsOn), [
    false,
    false,
    true,
    true,
    false,
  ]);
});

test('AthleteMaps: one load per file, shared by every caller; a failed file stays off', async () => {
  const { load, calls } = stubLoader();
  const maps = new AthleteMaps('guard', { base: '/m/', load });
  assert.equal(maps.get('skin', 'high'), null, 'nothing until loaded');
  const [a, b] = await Promise.all([maps.request('skin', 'high'), maps.request('skin', 'high')]);
  assert.equal(a, b);
  assert.equal(maps.get('skin', 'high'), a);
  assert.deepEqual(calls, ['/m/guard_skin.png']);
  await maps.request('kit', 'medium');
  await maps.request('kit', 'high');
  assert.deepEqual(calls, ['/m/guard_skin.png', '/m/guard_kit.png'], 'kit is the same file on both levels');
  for (const t of [a, maps.get('kit', 'high')]) {
    assert.equal(t.flipY, false, 'glTF UVs: flipY false');
    assert.equal(t.colorSpace, THREE.NoColorSpace, 'normals and AO are data');
  }
  const bad = new AthleteMaps('guard', { base: '/m/', load: () => Promise.reject(new Error('404')) });
  bad.warn = () => {};
  assert.equal(await bad.request('gear', 'high'), null);
  assert.equal(bad.get('gear', 'high'), null);
  // disposing the store (with the template) frees every texture it loaded
  let freed = 0;
  for (const t of maps.loaded()) t.addEventListener('dispose', () => freed++);
  maps.dispose();
  assert.equal(freed, 2);
  assert.equal(await maps.request('skin', 'high'), null, 'a disposed store loads nothing more');
});

test('athlete maps: on Medium and High, the right skin size per level, none on Low or on the far mesh, live toggle', async () => {
  const gltf = await loadGlb('guard');
  const { load, calls } = stubLoader();
  gltf.maps = new AthleteMaps('guard', { base: '', load });
  const body = athleteBody(gltf, kit, 3, 0x6832ab, 'guard', look, { level: 'high' });
  await tick();
  const mats = materials(body);
  const expect = level => {
    for (const [key, m] of mats) {
      const atlas = ATLAS_OF[m.name];
      if (!mapsOn(level)) {
        assert.equal(m.normalMap, null, `${level}: no normal map on ${key}`);
        assert.equal(m.aoMap, null, `${level}: no AO map on ${key}`);
        continue;
      }
      assert.equal(m.normalMap?.name, mapFile('guard', atlas, level), `${level}: ${key} reads ${atlas}`);
      assert.equal(m.aoMap, m.normalMap, 'AO lives in the alpha of the same texture');
      assert.equal(m.aoMapIntensity, AO_INTENSITY[level]);
      assert.deepEqual(
        m.normalScale.toArray(),
        [NORMAL_SCALE[atlas], NORMAL_SCALE[atlas]],
        'TANGENT in the GLB: no y flip',
      );
    }
  };
  assert.ok(mats.size >= 9, `${mats.size} materials`);
  expect('high');
  // the level changes without rebuilding the body: the maps swap on the same materials
  const skin = mats.get('skin'),
    high = skin.normalMap;
  body.setDetail('medium');
  await tick();
  expect('medium');
  assert.notEqual(skin.normalMap, high, 'the 1k skin on Medium');
  const v0 = skin.version;
  body.setDetail('low');
  expect('low');
  assert.ok(skin.version > v0, 'needsUpdate when the maps go (the shader changes)');
  body.setDetail('high');
  await tick();
  expect('high');
  // far mesh (LOD1): its welded seams smear the atlas, so the maps go off and come back with LOD0
  body.setLod(1);
  for (const m of mats.values()) assert.equal(m.normalMap, null, 'no maps on LOD1');
  body.setLod(0);
  expect('high');
  // every body of a variant shares the same textures, loaded once
  const other = athleteBody(gltf, kit, 4, 0x111111, 'guard', { ...look, hair: 'rows' }, { level: 'high' });
  await tick();
  assert.equal(materials(other).get('kit').normalMap, mats.get('kit').normalMap);
  assert.equal(new Set(calls).size, calls.length, `each file loaded once: ${calls}`);
  // disposing a body leaves the shared maps alone
  let freed = 0;
  mats.get('kit').normalMap.addEventListener('dispose', () => freed++);
  disposeBody(body, new Set([kit.capMat]));
  assert.equal(freed, 0);
  disposeBody(other, new Set([kit.capMat]));
  // a body made before its maps arrive gets them when they land; one disposed meanwhile does not
  const late = new AthleteMaps('guard', { base: '', load });
  gltf.maps = late;
  const b2 = athleteBody(gltf, kit, 5, 0x222222, 'guard', look, { level: 'medium' }),
    b3 = athleteBody(gltf, kit, 6, 0x333333, 'guard', look, { level: 'medium' });
  assert.equal(materials(b2).get('skin').normalMap, null);
  disposeBody(b3, new Set([kit.capMat]));
  await tick();
  assert.equal(materials(b2).get('skin').normalMap?.name, 'guard_skin_1k.png');
  assert.equal(materials(b3).get('skin').normalMap, null);
  // no store (e.g. a template loaded without maps): bodies work without them
  delete gltf.maps;
  const plain = athleteBody(gltf, kit, 7, 0x444444, 'guard', look, { level: 'high' });
  assert.equal(materials(plain).get('skin').normalMap, null);
});
