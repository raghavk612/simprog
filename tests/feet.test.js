// Feet and legs: team socks and shoe colourways (src/kits.js homeFeet / visitorFeet, src/players.js lookFor and feetFor),
// the shoe's zones and the sock lines worked out per variant in the rest pose (src/clothFit.js shoeZones), and the
// classic figure's sock band and shoe colour on the Low batch (src/classicBatch.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lookFor, lookKey, feetFor, SOCK_HEIGHTS, classicBody, attachBody } from '../src/players.js';
import {
  homeFeet,
  visitorFeet,
  visitorKit,
  KITS,
  ALL_KITS,
  GUM,
  OUTSOLE_DARK,
  KANGS_FEET_COLORS,
} from '../src/kits.js';
import { TEAM_COLORS } from '../src/teamColors.js';
import { logoSlug } from '../src/logos.js';
import { prepareCloth, shoeZoneAt, SHOE_ZONES } from '../src/clothFit.js';
import { ClassicBatch } from '../src/classicBatch.js';

const norm = c => String(c).toLowerCase();
const SEEDS = Array.from({ length: 200 }, (_, i) => (i % 2 ? `v:Player ${i}` : i));

test('looks: socks and shoes come from who he is (a hash of his seed), and the older parts of the look stay as they were', () => {
  const socks = new Set(),
    shoes = new Set(),
    home = homeFeet('home');
  for (const s of SEEDS) {
    const l = lookFor(s);
    assert.ok(SOCK_HEIGHTS.includes(l.socks), `${s}: ${l.socks}`);
    socks.add(l.socks);
    shoes.add(feetFor(home, l).shoe.join());
    assert.deepEqual(lookFor(s), l, 'the same every time');
  }
  assert.deepEqual([...socks].sort(), [...SOCK_HEIGHTS].sort(), 'crew, mid and ankle all worn');
  assert.ok(shoes.size >= 3, `${shoes.size} colourways over 200 players`);
  // about 1 in 6 wear a leg sleeve (the rule as it was)
  const sleeves = SEEDS.filter(s => lookFor(s).legSleeve).length;
  assert.ok(sleeves > 200 / 6 - 15 && sleeves < 200 / 6 + 15, `${sleeves} leg sleeves`);
  // hair, sleeves, skin and face are unchanged by the new fields (values from before they were added)
  const was = {
    42: {
      hair: 'rows',
      hairColor: 2234387,
      headband: true,
      armSleeve: true,
      legSleeve: false,
      skin: 6,
      face: 378,
    },
    player7: {
      hair: 'crop',
      hairColor: 1446416,
      headband: false,
      armSleeve: false,
      legSleeve: false,
      skin: 2,
      face: 625,
    },
    'v:Deng Deng': {
      hair: 'rows',
      hairColor: 1446416,
      headband: false,
      armSleeve: false,
      legSleeve: false,
      skin: 0,
      face: 76,
    },
  };
  for (const [s, w] of Object.entries(was)) {
    const l = lookFor(s === '42' ? 42 : s);
    for (const k of Object.keys(w)) assert.equal(l[k], w[k], `${s} ${k}`);
  }
  // the key names them, and still ends with skin and face
  const k = lookKey(lookFor(42));
  assert.match(k, new RegExp(`\\|${lookFor(42).socks}${lookFor(42).shoe}\\|s\\d+f\\d+$`));
});

test('Kangs feet: socks in white, black or the team colour; shoes in white, purple and gold, or black and purple', () => {
  const allowed = new Set(KANGS_FEET_COLORS.map(norm));
  for (const kit of ALL_KITS) {
    const f = homeFeet(kit);
    assert.ok(allowed.has(norm(f.sock)), `${kit}: sock ${f.sock}`);
    assert.equal(new Set(f.colourways.map(c => c.join())).size, 3, `${kit}: three colourways`);
    for (const c of f.colourways) {
      assert.equal(c.length, 4, 'upper, accent, midsole band, outsole');
      for (const x of c.slice(0, 3)) assert.ok(allowed.has(norm(x)), `${kit}: ${x}`);
      assert.ok([GUM, OUTSOLE_DARK].includes(c[3]), 'the outsole is gum or dark');
      assert.notEqual(norm(c[2]), norm(c[0]), 'the midsole band stands out from the upper');
    }
  }
  assert.ok(
    homeFeet('home').colourways.some(c => /^#f/i.test(c[0])),
    'a white shoe',
  );
  assert.ok(
    homeFeet('home').colourways.some(c => norm(c[0]) === norm(KITS.home.body)),
    'a purple shoe',
  );
  assert.ok(
    homeFeet('home').colourways.some(c => norm(c[0]) === norm(KITS.alternate.body)),
    'a black shoe',
  );
  assert.equal(homeFeet('nonsense').sock, homeFeet('home').sock);
});

test("visitor feet: socks and shoes only in that school's kit colours (the outsole is gum or dark rubber)", () => {
  const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
  const opponents = new Set(Object.values(data.levels).flatMap(l => l.games.map(g => g.opponent)));
  for (const home of [KITS.home.body, KITS.away.body, KITS.alternate.body])
    for (const o of [...opponents, 'Fictional Prep']) {
      const kit = visitorKit(o, home),
        team = TEAM_COLORS[logoSlug(o)],
        palette = new Set([...kit, team?.primary, team?.secondary].filter(Boolean).map(norm)),
        f = visitorFeet(o, kit);
      assert.ok(palette.has(norm(f.sock)), `${o}: sock ${f.sock} from ${[...palette]}`);
      assert.equal(new Set(f.colourways.map(c => c.join())).size, 3, `${o}: three colourways`);
      for (const c of f.colourways) {
        for (const x of c.slice(0, 3)) assert.ok(palette.has(norm(x)), `${o}: ${x} not in ${[...palette]}`);
        assert.ok([GUM, OUTSOLE_DARK].includes(c[3]), `${o}: outsole ${c[3]}`);
      }
    }
  // their own shoes, not the Kangs'
  const kangs = new Set(homeFeet('home').colourways.map(c => c.join()));
  const red = visitorFeet('Redmond', visitorKit('Redmond'));
  assert.ok(red.colourways.every(c => !kangs.has(c.join())));
});

const load = v => {
  const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
  return new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
};
test('shoe zones: worked out per variant in the rest pose; heel counter behind the ankle, the midsole band 0.01-0.03 off the floor, the sock lines above the collar', async () => {
  for (const v of ['guard', 'forward', 'center']) {
    const g = await load(v),
      z = prepareCloth(g).feet;
    assert.ok(z, `${v}: shoe zones`);
    assert.ok(
      z.counter < z.ankle[2],
      `${v}: heel counter (to ${z.counter.toFixed(3)}) behind the ankle (${z.ankle[2].toFixed(3)})`,
    );
    assert.ok(
      z.counter > z.heel && z.toeBox < z.toe && z.toeBox > z.counter,
      `${v}: heel, counter, toe box, toe in order`,
    );
    assert.ok(z.band[0] >= 0.01 && z.band[1] <= 0.03 && z.band[1] - z.band[0] > 0.01, `${v}: band ${z.band}`);
    const above = h => z.socks[h] - z.ankle[1];
    assert.ok(
      above('crew') >= 0.12 && above('crew') <= 0.16,
      `${v}: crew ${above('crew').toFixed(3)} above the ankle`,
    );
    assert.ok(z.socks.crew > z.socks.mid && z.socks.mid > z.socks.ankle, `${v}: crew, mid, ankle`);
    assert.ok(z.socks.ankle > z.collar + 0.01, `${v}: an ankle sock shows above the collar`);
    // every zone is on the shoe, and each vertex lands where its zone says
    const named = {};
    g.scene.traverse(o => o.isMesh && (named[o.name] = o));
    const count = Object.fromEntries(SHOE_ZONES.map(k => [k, 0]));
    for (const [mesh, sole] of [
      [named.shoes, false],
      [named.shoes_1, true],
    ]) {
      const p = mesh.geometry.attributes.position,
        n = mesh.geometry.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const at = [p.getX(i), p.getY(i), p.getZ(i)],
          k = shoeZoneAt(z, at, [n.getX(i), n.getY(i), n.getZ(i)], sole);
        count[k]++;
        if (k === 'heel') assert.ok(at[2] < z.ankle[2], `${v}: heel counter vertex at z ${at[2]}`);
        if (k === 'outsole') assert.ok(at[1] < 0.0135, `${v}: outsole vertex at y ${at[1]}`);
        if (k === 'midsole' && !sole)
          assert.ok(at[1] >= 0.01 && at[1] <= 0.03, `${v}: band vertex at ${at[1]}`);
      }
    }
    for (const k of SHOE_ZONES) assert.ok(count[k] >= 8, `${v}: ${k} (${count[k]} vertices)`);
  }
});

const kit = {
  mat: (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, ...extra }),
  textTexture: () => new THREE.Texture(),
  capMat: new THREE.MeshBasicMaterial(),
};
test('athlete feet: setFeet colours the sock in the skin shader and the shoe zones, with no new mesh or material', async () => {
  const { athleteBody } = await import('../src/players.js');
  const g = await load('guard'),
    b = athleteBody(g, kit, 0, 0x6832ab, 'guard', { ...lookFor(5), socks: 'mid', shoe: 1 }),
    meshes = [],
    mats = new Set();
  b.root.traverse(o => o.isMesh && (meshes.push(o), mats.add(o.material)));
  const f = feetFor(homeFeet('alternate'), b.look);
  b.setFeet(f);
  const after = [];
  b.root.traverse(o => o.isMesh && after.push(o));
  assert.equal(after.length, meshes.length, 'no new meshes');
  b.root.traverse(o => o.isMesh && assert.ok(mats.has(o.material), 'no new materials'));
  const skin = b.root.getObjectByName('body_mesh').material,
    S = skin.userData.sock;
  assert.ok(
    new THREE.Color(f.sock).equals(new THREE.Color(S.kSockC.value.x, S.kSockC.value.y, S.kSockC.value.z)),
  );
  assert.equal(S.kSockY.value.x, g.userData.clothFit.feet.socks.mid, 'the mid sock line of this variant');
  const shoe = b.root.getObjectByName('shoes').material,
    sole = b.root.getObjectByName('shoes_1').material;
  assert.equal(shoe.userData.shoe, sole.userData.shoe, 'upper and sole share one colourway');
  f.shoe.forEach((c, k) =>
    assert.ok(shoe.userData.shoe.kShoeCol.value[k].equals(new THREE.Color(c)), `colour ${k}`),
  );
});

// instance attributes are 32-bit floats
const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-5;
function team(n) {
  return Array.from({ length: n }, (_, i) => {
    const p = new THREE.Group();
    p.position.set(i * 2, 0, 0);
    attachBody(p, classicBody(kit, i, 0x6832ab));
    return p;
  });
}
test('Low: the sock band and the shoe colour ride on the instanced parts, one draw per body part as before', () => {
  const scene = new THREE.Scene(),
    people = team(3),
    batch = new ClassicBatch(scene),
    feet = [homeFeet('home'), homeFeet('alternate'), visitorFeet('Redmond', visitorKit('Redmond'))].map(
      (t, i) => feetFor(t, { socks: SOCK_HEIGHTS[i], shoe: i }),
    );
  people.forEach((p, i) => p.userData.body.setFeet(feet[i]));
  batch.update(people);
  let parts = 0;
  people[0].userData.body.root.traverse(o => o.isMesh && !o.material.map && parts++);
  assert.equal(batch.meshes.length, parts, 'one instanced mesh per untextured part');
  assert.equal(batch.meshes.length, 18, 'the same 18 parts as before');
  assert.equal(scene.children.filter(o => o.isInstancedMesh).length, 18, 'no extra draw');
  const body = people[1].userData.body,
    parts1 = body.batchParts,
    banded = parts1.map((m, j) => [m, batch.meshes[j]]).filter(([m]) => m.userData.band);
  assert.equal(banded.length, 4, 'two shins (socks) and two shoes (soles)');
  for (const [m, im] of banded) {
    const a = im.geometry.attributes.kBand,
      c = new THREE.Color(a.getX(1), a.getY(1), a.getZ(1));
    assert.ok(near(c, m.userData.band.color), 'the band colour of that player');
    assert.ok(Math.abs(a.getW(1) - m.userData.band.y) < 1e-6);
  }
  const shin = banded.find(([m]) => m.userData.band.kind === 'sock')[0];
  assert.ok(shin.userData.band.color.equals(new THREE.Color(feet[1].sock)));
  const shoe = banded.find(([m]) => m.userData.band.kind === 'sole')[0],
    c = new THREE.Color();
  batch.meshes[parts1.indexOf(shoe)].getColorAt(1, c);
  assert.ok(near(c, new THREE.Color(feet[1].shoe[0])), 'the shoe in its upper colour');
  // crew higher than mid higher than ankle on the figure too
  const y = i =>
    people[i].userData.body.batchParts.find(m => m.userData.band?.kind === 'sock').userData.band.y;
  assert.ok(y(0) > y(1) && y(1) > y(2));
});
