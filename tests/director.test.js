import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickShot,
  framing,
  smoothDamp,
  frameShot,
  SAFE,
  CAMERAS,
  LENS,
  APERTURE,
  RIM_X,
} from '../src/director.js';
import * as THREE from 'three';
import { RIG, toGame } from '../src/broadcastRig.js';
const V = a => ({ x: a[0], y: a[1], z: a[2] });
test('director: the angles follow a possession, with close angles for jump shots and replays', () => {
  assert.equal(pickShot(0.1), 'wide');
  assert.equal(pickShot(0.4), 'track');
  assert.equal(pickShot(0.95), 'track');
  assert.equal(pickShot(0.7, { kind: 'catch' }), 'freeThrow');
  assert.equal(pickShot(0.7, { kind: 'corner' }), 'freeThrow', 'variations share their family');
  assert.equal(pickShot(0.7, { kind: 'dunk', team: 'home' }), 'player');
  assert.equal(pickShot(0.7, { kind: 'drive', team: 'away' }), 'baseline');
  assert.equal(pickShot(0.7, { kind: 'drive', replay: true }), 'replayClose');
  for (const k of Object.keys(LENS)) assert.ok(LENS[k] > 15 && LENS[k] < 60);
  assert.equal(APERTURE.wide, 0, 'no tilt-shift look on the wide angle');
  for (const shot of ['wide', 'track', 'baseline', 'freeThrow'])
    assert.equal(APERTURE[shot], 0, `live ${shot} is sharp`);
});
test('director: angles come from the Spline rig, mirrored for the visitors, sideline cameras stay on the broadcast side', () => {
  assert.deepEqual(CAMERAS.wide.position, toGame(RIG.cameras.wide.position));
  const f = { x: 4, y: 0, z: 1 };
  for (const dir of [1, -1])
    for (const shot of ['wide', 'track', 'baseline', 'replayClose', 'freeThrow']) {
      const r = framing(shot, dir, { ...f, x: f.x * dir });
      assert.ok(r.position.every(Number.isFinite) && r.target.every(Number.isFinite), shot);
      assert.ok(r.position[2] > 0, `${shot} (${dir}) stays on the near side`);
      assert.ok(r.position[1] > 1, `${shot} is above the floor`);
    }
  const home = framing('baseline', 1, f),
    away = framing('baseline', -1, { ...f, x: -4 });
  assert.equal(home.position[0], -away.position[0]);
  // the shooter's camera is behind the shooter, looking past him at the rim he attacks
  for (const dir of [1, -1]) {
    const s = { x: 5 * dir, y: 0, z: -2 },
      r = framing('freeThrow', dir, s),
      toShooter = [s.x - r.position[0], s.z - r.position[2]],
      toRim = [RIM_X * dir - s.x, -s.z];
    assert.ok(toShooter[0] * toRim[0] + toShooter[1] * toRim[1] > 0, 'camera behind the shooter');
    assert.ok(Math.sign(r.target[0]) === dir, 'looks at the attacked rim');
  }
});
test('director: camera springs settle, never overshoot, and do not depend on frame rate', () => {
  const run = (fps, secs) => {
    let x = 0,
      v = 0;
    const dt = 1 / fps;
    let max = 0;
    for (let i = 0; i < fps * secs; i++) {
      [x, v] = smoothDamp(x, 10, v, 0.5, dt);
      max = Math.max(max, x);
    }
    return { x, max };
  };
  const a = run(60, 0.5),
    b = run(30, 0.5),
    c = run(144, 0.5);
  assert.ok(Math.abs(a.x - b.x) < 0.15 && Math.abs(a.x - c.x) < 0.15, `${a.x} ${b.x} ${c.x}`);
  const settled = run(60, 3);
  assert.ok(Math.abs(settled.x - 10) < 1e-3 && settled.max <= 10 + 1e-9);
  const [same] = smoothDamp(5, 5, 0, 0.5, 0);
  assert.equal(same, 5);
});

test('every shooting angle keeps the shooter, the hoop and the ball clear of the score bar, panels and captions', () => {
  for (const shot of ['track', 'freeThrow', 'baseline', 'replayClose'])
    for (const dir of [1, -1])
      for (const [fx, fz] of [
        [4, 5.5],
        [7, 2.7],
        [11.5, 1],
        [9.5, -1.8],
      ]) {
        const f = { x: fx * dir, y: 0, z: fz },
          pts = [
            [f.x, 0, f.z],
            [f.x, 2.3, f.z],
            [RIM_X * dir, 3.28, 0],
            [(fx + 1.5) * dir, 4.6, fz * 0.6], // the ball near the top of its arc
          ],
          fit = frameShot(shot, dir, f, { x: 0, z: 0 }, 16 / 9, pts, s => LENS[s]),
          cam = new THREE.PerspectiveCamera(fit.fov, 16 / 9, 0.1, 300);
        cam.position.set(...fit.position);
        cam.lookAt(...fit.target);
        cam.updateMatrixWorld();
        for (const p of pts) {
          const v = new THREE.Vector3(...p).project(cam);
          if (v.z > 1) continue;
          const tol = 0.03;
          assert.ok(
            v.x >= SAFE.left - tol &&
              v.x <= SAFE.right + tol &&
              v.y >= SAFE.bottom - tol &&
              v.y <= SAFE.top + tol,
            `${shot} dir ${dir} at ${fx},${fz}: ${p.join(',')} lands at ${v.x.toFixed(2)},${v.y.toFixed(2)}`,
          );
        }
      }
});
