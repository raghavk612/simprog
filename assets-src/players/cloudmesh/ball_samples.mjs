// Where the ball sits relative to a hand on it, in the game's own animation (src/motion.js animateAthlete), for the
// cloudmesh finger-clearance test. For each body variant it drives an athlete through a dribble, a two-hand hold and a
// shot (ball positions as the Arena puts them), and records the ball centre in the hand's rest space: the offset from the
// wrist joint in model units, with the wrist bone's motion undone. The Python test turns that into the hand-local frame.
//   node assets-src/players/cloudmesh/ball_samples.mjs     (after scripts/build_players.py; writes tests/ball_samples.json)
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { athleteBody, attachBody, BODY_VARIANTS } from '../../../src/players.js';
import { animateAthlete } from '../../../src/motion.js';
import { dribbleAt, DRIBBLE } from '../../../src/basketball.js';

export const BALL_RADIUS = 0.13; // ctx.ballRadius in the Arena
const kit = {
  mat: (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, ...e }),
  textTexture: () => new THREE.Texture(),
  capMat: new THREE.MeshBasicMaterial(),
};
// ball centre for a pose at time t (s), player at the origin facing +z (yaw 0, +x = his left)
export const POSES = {
  dribble: (t, d) => new THREE.Vector3(-0.4, d.ball, 0.25), // at his right side, a little ahead (Arena.dribbleSpot)
  hold: () => new THREE.Vector3(0, 1.2, 0.4), // two hands on the ball in front of the chest (any non-dribble, non-shot pose)
  shoot: () => new THREE.Vector3(-0.28, 2.3, 0.05), // the shooting pocket (basketball.js BALL.hand, 0.28 to the side)
};
const ARMS = { dribble: 'dribble', hold: 'pass', shoot: 'shoot' };

export async function loadBody(v) {
  const buf = fs.readFileSync(new URL(`../../../public/models/players/${v}.glb`, import.meta.url));
  const gltf = await new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
  const body = athleteBody(gltf, kit, 3, 0x6832ab, v, { hair: 'buzz', headband: false, armSleeve: false, legSleeve: false });
  const player = new THREE.Group();
  attachBody(player, body);
  return { body, player };
}

/* Runs one pose for `frames` frames at 60 fps and calls visit(ball, t) on each frame after the first second. */
export function drive(player, pose, visit, frames = 240) {
  player.userData.motionState = undefined;
  for (let f = 0; f < frames; f++) {
    const t = f / 60,
      d = dribbleAt(t / DRIBBLE.period),
      ball = POSES[pose](t, d);
    animateAthlete(player, { arms: ARMS[pose], y: 0 }, {
      dt: 1 / 60,
      motion: true,
      ball: ball.clone(),
      ballRadius: BALL_RADIUS,
      holder: true,
      dribbleHand: d.hand,
      dribble: d,
      family: '',
    });
    if (f >= 60) {
      player.updateMatrixWorld(true);
      visit(ball, t);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = { ballRadius: BALL_RADIUS, units: 'model units (metres x 0.3306/0.3048)', variants: {} };
  for (const v of BODY_VARIANTS) {
    const { body, player } = await loadBody(v);
    let mesh;
    body.root.traverse(o => {
      if (o.isSkinnedMesh && o.name === 'body_mesh') mesh = o;
    });
    const sk = mesh.skeleton,
      rec = (out.variants[v] = {});
    for (const pose of Object.keys(POSES)) {
      const list = (rec[pose] = { L: [], R: [] });
      let f = 0;
      drive(player, pose, ball => {
        if (f++ % 3) return;
        sk.update();
        for (const side of ['L', 'R']) {
          const i = sk.bones.findIndex(b => b.name === 'wrist_' + side),
            M = sk.bones[i].matrixWorld.clone().multiply(sk.boneInverses[i]).invert(),
            J = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()),
            q = ball.clone().applyMatrix4(M).sub(J);
          // only frames where this hand is near the ball (within the ball radius + 0.13 of the wrist)
          if (q.length() < BALL_RADIUS + 0.13) list[side].push(q.toArray().map(x => +x.toFixed(5)));
        }
      });
    }
  }
  const path = new URL('./tests/ball_samples.json', import.meta.url);
  fs.writeFileSync(path, JSON.stringify(out) + '\n');
  console.log('wrote', path.pathname);
}
