// Golden poses: proof that a refactor changes nothing a player sees. Two snapshots, stored as short hashes per moment in
// tests/golden/poses.json:
//   clips   - sampleClip (src/basketball.js) for every shot kind, outcome and team at fixed times: where everyone is, the
//             ball, the phase and every flag the score reveal reads. Plays recorded before a motion version (no clip.v)
//             must replay exactly like this forever (old saves and replays).
//   bodies  - animateAthlete (src/motion.js) driven through plays at a fixed 1/60 s step, the way the Arena drives it: the
//             rotation of every bone and the pelvis position at fixed frames.
// A change that is meant to alter motion regenerates the file on purpose and says why in its commit:
//   UPDATE_GOLDEN=1 node --test tests/golden.test.js     (npm run golden:update)
// The clips section for unversioned plays must never be regenerated: old events would replay differently.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { SHOTS, sampleClip, CLIP_SECONDS, dribbleAt, family } from '../src/basketball.js';

const FILE = new URL('./golden/poses.json', import.meta.url),
  UPDATE = !!process.env.UPDATE_GOLDEN;
const round = x =>
  typeof x === 'number' ? (Math.abs(x) < 5e-6 ? 0 : Number.isFinite(x) ? +x.toFixed(5) : String(x)) : x;
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    if (v.isVector3) return [v.x, v.y, v.z].map(round);
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map(k => [k, canon(v[k])]),
    );
  }
  return round(v);
}
const digest = v =>
  crypto
    .createHash('sha1')
    .update(JSON.stringify(canon(v)))
    .digest('hex')
    .slice(0, 12);

/* The plays: every kind, made / missed / blocked (each way the loose ball goes) / stolen, both teams, a few variants. */
export function goldenClips() {
  const out = [];
  for (const kind of Object.keys(SHOTS))
    for (const team of ['home', 'away'])
      for (const o of [
        { outcome: 'made', points: SHOTS[kind].three ? 3 : 2 },
        { outcome: 'miss', points: 0 },
        { outcome: 'block', points: 0, recovery: 'defense' },
        { outcome: 'block', points: 0, recovery: 'offense', putback: 'made' },
        { outcome: 'block', points: 0, recovery: 'offense', putback: 'miss' },
        { outcome: 'steal', points: 0 },
      ])
        out.push({ kind, team, lane: team === 'home' ? 1 : -1, contest: 'contested', ...o });
  for (const kind of ['catch', 'dunk', 'alley', 'corner'])
    out.push({ kind, team: 'home', lane: 1, contest: 'open', outcome: 'made', points: 2, afterSteal: true });
  for (const contest of ['open', 'tight'])
    out.push({ kind: 'pullup', team: 'home', lane: -1, contest, outcome: 'miss', points: 0 });
  return out;
}
const clipName = c =>
  [c.kind, c.team, c.outcome, c.recovery, c.putback, c.contest, c.lane, c.afterSteal && 'afterSteal']
    .filter(Boolean)
    .join(':');
const TIMES = Array.from({ length: 23 }, (_, i) => +(i * 0.2).toFixed(2)); // 0 .. 4.4 s

function clipsSnapshot() {
  const out = {};
  for (const c of goldenClips()) out[clipName(c)] = TIMES.map(t => digest(sampleClip(c, t)));
  return out;
}

/* ---- bodies: animateAthlete driven like the Arena drives it (posePlayer), without the Arena ---- */
const kit = {
  mat: (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, ...e }),
  textTexture: () => new THREE.Texture(),
  capMat: new THREE.MeshBasicMaterial(),
};
async function loadTemplate(v) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const buf = fs.readFileSync(new URL(`../public/models/players/${v}.glb`, import.meta.url));
  return new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
}
/* Arena.shotPerform: a play's world-space hands as a hands-only performance. */
function shotPerform(hands) {
  const V = p => new THREE.Vector3(...p),
    out = { gait: true, body: {}, feet: {}, look: null, hands: {} };
  for (const h of ['R', 'L']) {
    const H = hands[h];
    if (H) out.hands[h] = { ...H, p: V(H.p), pole: H.pole ? V(H.pole) : null };
  }
  return out;
}
function boneState(body) {
  const b = body.bones,
    out = { pelvis: b.pelvis.position.toArray() };
  for (const [name, bone] of Object.entries(b).sort(([a], [c]) => (a < c ? -1 : 1)))
    out[name] = bone.quaternion.toArray();
  return out;
}
/* Drives one actor of a play from 0 to its end and records the bones every 12 frames. */
async function driveActor(animateAthlete, body, player, clip, idx) {
  player.userData.motionState = undefined;
  // motion.js seeds each player's idle clock with Math.random: the same number every run (reseeded here, after loading,
  // because three.js also draws random numbers for object ids while bodies are built)
  const rnd = Math.random;
  let seed = 99;
  Math.random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  try {
    return driveFrames(animateAthlete, body, player, clip, idx);
  } finally {
    Math.random = rnd;
  }
}
function driveFrames(animateAthlete, body, player, clip, idx) {
  player.position.set(0, 0, 0);
  const frames = [],
    off = clip.team === 'home' ? 0 : 5,
    mk = 5 - off,
    ballV = new THREE.Vector3();
  for (let f = 0; f <= Math.round(CLIP_SECONDS * 60); f++) {
    const t = f / 60,
      pose = sampleClip(clip, t),
      a = pose.actors[idx];
    player.position.set(a.x, a.y, a.z);
    player.rotation.set(0, a.yaw, 0);
    ballV.set(pose.ball.x, pose.ball.y, pose.ball.z);
    const d = dribbleAt(pose.bounce),
      holder = Math.hypot(a.x - ballV.x, a.z - ballV.z) < 0.85 && ballV.y < 2.9,
      perform =
        idx === off && pose.shotHands
          ? shotPerform(pose.shotHands)
          : idx === mk && pose.blockHands
            ? shotPerform(pose.blockHands)
            : null;
    animateAthlete(
      player,
      { ...a, perform },
      {
        dt: f ? 1 / 60 : 0,
        motion: true,
        ball: ballV.clone(),
        ballRadius: 0.13,
        holder,
        dribbleHand: d.hand,
        dribble: d,
        perform,
        family: family(clip.kind),
      },
    );
    if (f % 12 === 0) frames.push(digest(boneState(body)));
  }
  return frames;
}
export const BODY_SCENES = [
  ['guard', { kind: 'pullup', team: 'home', lane: 1, contest: 'contested', outcome: 'made', points: 2 }, 0],
  ['guard', { kind: 'pullup', team: 'home', lane: 1, contest: 'contested', outcome: 'made', points: 2 }, 5],
  ['forward', { kind: 'drive', team: 'home', lane: 1, contest: 'contested', outcome: 'made', points: 2 }, 0],
  ['center', { kind: 'dunk', team: 'away', lane: -1, contest: 'open', outcome: 'made', points: 2 }, 5],
  ['center', { kind: 'hook', team: 'home', lane: 1, contest: 'tight', outcome: 'miss', points: 0 }, 9],
  [
    'forward',
    {
      kind: 'catch',
      team: 'home',
      lane: -1,
      contest: 'contested',
      outcome: 'block',
      points: 0,
      recovery: 'offense',
      putback: 'made',
    },
    5,
  ],
  ['guard', { kind: 'euro', team: 'away', lane: 1, contest: 'contested', outcome: 'steal', points: 0 }, 0],
  ['guard', { kind: 'roll', team: 'home', lane: 1, contest: 'contested', outcome: 'miss', points: 0 }, 1],
];
export async function bodiesSnapshot() {
  const { athleteBody, attachBody } = await import('../src/players.js');
  const { animateAthlete } = await import('../src/motion.js');
  const templates = {},
    out = {};
  for (const [v, clip, idx] of BODY_SCENES) {
    templates[v] ??= await loadTemplate(v);
    const body = athleteBody(templates[v], kit, 3, 0x6832ab, v, {
        hair: 'buzz',
        headband: false,
        armSleeve: false,
        legSleeve: false,
      }),
      player = new THREE.Group();
    player.userData.slot = idx;
    attachBody(player, body);
    out[`${v}:${clipName(clip)}:actor${idx}`] = await driveActor(animateAthlete, body, player, clip, idx);
  }
  return out;
}

if (UPDATE) {
  const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};
  const next = { clips: clipsSnapshot(), bodies: await bodiesSnapshot() };
  // unversioned plays are frozen: an update may add plays, never change one that was already recorded
  for (const [k, v] of Object.entries(old.clips || {}))
    if (JSON.stringify(next.clips[k]) !== JSON.stringify(v))
      throw Error(`golden: ${k} changed. Plays without a motion version must replay exactly as recorded.`);
  fs.mkdirSync(new URL('./golden/', import.meta.url), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 0).replace(/\],"/g, '],\n"') + '\n');
}
const GOLD = JSON.parse(fs.readFileSync(FILE));

test('golden clips: every unversioned play samples exactly as recorded (old saves and replays)', () => {
  const now = clipsSnapshot(),
    bad = [];
  for (const [k, v] of Object.entries(GOLD.clips)) {
    const i = (now[k] || []).findIndex((h, j) => h !== v[j]);
    if (!now[k]) bad.push(`${k}: missing`);
    else if (i >= 0) bad.push(`${k} at ${TIMES[i]} s`);
  }
  assert.deepEqual(bad, [], `sampleClip changed for recorded plays:\n${bad.slice(0, 20).join('\n')}`);
  assert.ok(Object.keys(GOLD.clips).length >= 160);
});
test('golden bodies: animateAthlete poses every bone as recorded', async () => {
  const now = await bodiesSnapshot(),
    bad = [];
  for (const [k, v] of Object.entries(GOLD.bodies)) {
    const i = (now[k] || []).findIndex((h, j) => h !== v[j]);
    if (!now[k]) bad.push(`${k}: missing`);
    else if (i >= 0) bad.push(`${k} at frame ${i * 12}`);
  }
  assert.deepEqual(bad, [], `animateAthlete changed:\n${bad.join('\n')}`);
});
