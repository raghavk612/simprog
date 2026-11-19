// The ball (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the Arena). this.ball is where the play
// puts it; this.ballSpinner, its child, carries the spin and the small drop that keeps the real-size ball on the floor.
//   styleBall    the real 24 cm leather ball with the athletes, the classic toy ball otherwise (and hoop sizes to match)
//   dribbleSpot  where the idle dribbler bounces it
//   spinBall     backspin in flight, rolling on the floor, slowed in the hands
//   settleBall   the real ball's drop near the floor (drawing only)
//   blendBall    a ball that changes hands travels on an arc from where it was (this.ballFrom)
import * as THREE from 'three';
import { ballDrop } from '../basketball.js';
import { ballMaterial } from '../materials.js';
import { heroYaw } from '../title.js';

export const ballMethods = {
  /* With the athletes the ball is drawn at its real size (24 cm across) in pebbled leather; classic keeps the bigger toy ball. Presentation only. */
  styleBall(real) {
    const sphere = this.ballSpinner?.children[0];
    if (!sphere) return;
    this.ballReal = real;
    sphere.userData.classic ??= sphere.material;
    // the classic toy ball (0.28) needs the old big ring; the real ball goes through a real one
    for (const h of this.hoops || []) h.scale.set(real ? 1 : 1.94, real ? 1 : 1.2, real ? 1 : 1.94);
    if (real) {
      sphere.material = this.ballMat ??= ballMaterial();
      this.ball.scale.setScalar(0.13 / 0.28);
    } else {
      sphere.material = sphere.userData.classic;
      this.ball.scale.setScalar(1);
      this.ballSpinner.position.y = 0;
    }
  },
  /* Where the idle dribbler bounces the ball: at his right side and a little ahead, turning with him. It is calibrated so that
     facing the title camera (heroYaw) it is the spot it always was (+0.4 x, +0.25 z). */
  dribbleSpot(player) {
    const k = heroYaw(),
      lx = 0.4 * Math.cos(k) - 0.25 * Math.sin(k), // the spot in his own frame
      lz = 0.4 * Math.sin(k) + 0.25 * Math.cos(k),
      y = player.rotation.y,
      p = player.position;
    return { x: p.x + lx * Math.cos(y) + lz * Math.sin(y), z: p.z - lx * Math.sin(y) + lz * Math.cos(y) };
  },
  /* Turns the ball the way a real one turns, from how it moved since the last frame: backspin on a shot (about two turns a
     second, top spinning back toward the shooter), rolling when it runs along the floor, and slowed by the hands while a
     player holds or dribbles it. In the air with nobody touching it, it keeps the spin it had. */
  spinBall(shot, override = null) {
    const b = this.ball,
      dt = this.frameDt || 0,
      w = (this.ballSpin ??= new THREE.Vector3()),
      last = (this.ballLast ??= b.position.clone());
    if (!dt) return;
    const v = b.position.clone().sub(last).divideScalar(dt);
    last.copy(b.position);
    if (v.lengthSq() > 900) return; // a jump (new play, teleport): not a movement
    const R = 0.13, // the real ball's radius; spin is drawn the same on the classic ball
      roll = new THREE.Vector3(v.z, 0, -v.x).divideScalar(R), // up x velocity: rolling forward along the motion
      onFloor = b.position.y < 0.36;
    let want = null,
      rate = 0;
    if (override) {
      want = override; // a move spins it itself (a ball spun on a finger)
      rate = 20;
    } else if (shot) {
      want = roll.lengthSq() > 1e-6 ? roll.normalize().multiplyScalar(-12.5) : null;
      rate = 10;
    } else if (this.holder) {
      want = roll.multiplyScalar(0.15);
      rate = 8;
    } else if (onFloor) {
      want = roll;
      rate = 25;
    }
    if (want) w.lerp(want, 1 - Math.exp(-rate * dt));
    const a = w.length() * dt;
    if (a > 1e-6)
      this.ballSpinner.quaternion.premultiply(
        new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), a),
      );
  },
  /* The plays place the ball for the classic 0.28 ball; near the floor the smaller real ball drops by the difference so its bounces still touch the wood. Drawing only: the ball's position is untouched. */
  settleBall() {
    if (!this.ballReal || !this.ball) return;
    const s = this.ball.scale.x,
      y = this.ball.position.y,
      drop = ballDrop(y);
    this.ballSpinner.position.y = -drop / s;
  },
  // A ball that has to change hands is passed along an arc.
  blendBall(target, t) {
    const f = this.ballFrom;
    if (!f || !this.motion) return target;
    const d = Math.hypot(target.x - f.x, target.y - f.y, target.z - f.z);
    f.dur ??= Math.min(1.2, Math.max(0.25, d / 11));
    const w = Math.max(0, (t - f.t0) / f.dur);
    if (w >= 1) return target;
    const s = w * w * (3 - 2 * w);
    return {
      x: f.x + (target.x - f.x) * s,
      y: f.y + (target.y - f.y) * s + Math.sin(w * Math.PI) * Math.min(2.4, d * 0.16),
      z: f.z + (target.z - f.z) * s,
    };
  },
};
