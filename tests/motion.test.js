import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveLeg,
  ankleOf,
  strideFor,
  footAt,
  steerYaw,
  mixAngle,
  facingWeight,
  keepApart,
  SPACE,
} from '../src/motion.js';
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
test('leg IK: the solved hip and knee put the ankle exactly on the target, knee bending backward', () => {
  for (const [f, d] of [
    [0, 0.9],
    [0.2, 0.85],
    [-0.25, 0.8],
    [0.4, 0.7],
    [0, 0.6],
    [-0.1, 0.95],
  ]) {
    const s = solveLeg(0.5, 0.48, f, d),
      a = ankleOf(0.5, 0.48, s.hip, s.knee);
    assert.ok(
      near(a.forward, f, 1e-6) && near(a.drop, d, 1e-6),
      `target ${f},${d} -> ${a.forward},${a.drop}`,
    );
    assert.ok(s.knee >= 0, 'knees never bend the wrong way');
  }
  const straight = solveLeg(0.5, 0.48, 0, 0.98);
  assert.ok(
    straight.knee < 0.03 && Math.abs(straight.hip) < 0.03,
    'a full-length target leaves the leg straight',
  );
  const far = solveLeg(0.5, 0.48, 0, 2);
  assert.ok(far.knee < 0.02, 'out of reach: leg straight, no NaN');
  assert.ok(Number.isFinite(far.hip));
});
test('stride: planted feet move back exactly as far as the body moves forward, so they do not slide', () => {
  const L = strideFor(4);
  assert.ok(L > strideFor(1) && L <= 1.5);
  // phase advances by π per stride length travelled; during stance the foot moves back by the same distance
  const dist = L * 0.3,
    ph0 = 0.4,
    ph1 = ph0 + (dist / L) * Math.PI;
  assert.ok(near(footAt(ph0, L, 0.1).forward - footAt(ph1, L, 0.1).forward, dist, 1e-9));
  assert.equal(footAt(ph0, L, 0.1).up, 0, 'planted feet stay on the floor');
  const swing = footAt(Math.PI * 1.5, L, 0.1);
  assert.ok(swing.up > 0.09, 'the swing foot lifts');
  assert.ok(
    near(footAt(Math.PI - 1e-9, L, 0.1).forward, -L / 2, 1e-6) &&
      near(footAt(Math.PI * 2 - 1e-9, L, 0.1).forward, L / 2, 1e-6),
    'the swing ends where the next stance starts',
  );
});
test('arm IK: the wrist lands on the target, the elbow bends toward the pole, out-of-reach targets give a straight arm', async () => {
  const THREE = await import('three');
  const { solveArm } = await import('../src/motion.js');
  const S = new THREE.Vector3(0.2, 1.5, 0),
    L1 = 0.32,
    L2 = 0.3;
  for (const [T, pole] of [
    [new THREE.Vector3(0.3, 1.9, 0.35), new THREE.Vector3(0.4, -0.1, 1)],
    [new THREE.Vector3(0.35, 1.1, 0.25), new THREE.Vector3(0.5, -0.3, -1)],
    [new THREE.Vector3(0.2, 2.05, 0.1), new THREE.Vector3(0, 0, 1)],
  ]) {
    const r = solveArm(S, T, L1, L2, pole.clone().normalize());
    const wrist = r.elbow
      .clone()
      .add(r.b.clone().multiplyScalar(Math.sin(r.bend) * L2))
      .add(r.u.clone().multiplyScalar(Math.cos(r.bend) * L2));
    assert.ok(wrist.distanceTo(T) < 1e-4, `wrist ${wrist.toArray()} vs ${T.toArray()}`);
    const mid = S.clone().lerp(T, 0.5),
      toElbow = r.elbow.clone().sub(mid);
    assert.ok(toElbow.dot(pole) > 0 || r.bend < 0.05, 'elbow on the pole side');
  }
  const far = solveArm(S, new THREE.Vector3(0.2, 3, 0), L1, L2, new THREE.Vector3(0, 0, 1));
  assert.ok(far.bend < 0.02 && Number.isFinite(far.u.x), 'straight, no NaN');
  assert.equal(solveArm(S, S.clone(), L1, L2, new THREE.Vector3(0, 0, 1)), null);
});
test('bodies turn the short way round, at a human speed, and settle on the target', () => {
  // from just left of behind to just right of behind is a small turn, not a full spin
  assert.ok(near(mixAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5), Math.PI, 1e-9));
  let yaw = 0;
  const frames = [];
  for (let i = 0; i < 120; i++) frames.push((yaw = steerYaw(yaw, Math.PI / 2, 1 / 60)));
  assert.ok(frames.every((y, i) => Math.abs(y - (i ? frames[i - 1] : 0)) <= 9 / 60 + 1e-9)); // never faster than 9 rad/s
  assert.ok(near(yaw, Math.PI / 2, 1e-3));
});
test('players face where they run, except when aiming, defending or backpedalling', () => {
  for (const arms of ['shoot', 'hook', 'block', 'screen', 'pass', 'rebound'])
    assert.equal(facingWeight(7, arms), 0);
  assert.equal(facingWeight(0, 'run'), 0); // standing: the play's facing
  assert.ok(facingWeight(6, 'run') > 0.99); // running: where he runs
  assert.ok(facingWeight(3, 'defend') === 0 && facingWeight(7, 'defend') > 0.99); // slides, then turns and sprints
  assert.ok(facingWeight(6, 'dribble') > 0.6 && facingWeight(6, 'dribble') < 0.8); // keeps the rim in view
  assert.equal(facingWeight(3, 'dribble', Math.PI), 0); // a step-back stays facing the rim
  assert.ok(facingWeight(7.5, 'run', Math.PI) > 0.99); // a sprint back down the floor turns round
  // no jumps as speed rises
  for (const arms of ['run', 'dribble', 'defend'])
    for (let v = 0; v < 9; v += 0.05)
      assert.ok(Math.abs(facingWeight(v + 0.05, arms) - facingWeight(v, arms)) < 0.05);
});
test('players keep their distance, and one sent through another goes round him without jumping', () => {
  // B runs straight through A (who stands still) at 6 units/s
  const state = {},
    dt = 1 / 60;
  let last = null,
    fastest = 0,
    closest = 9;
  for (let f = 0; f <= 120; f++) {
    const bx = -2 + 6 * f * dt,
      q = keepApart(
        state,
        [
          { x: 0, z: 0 },
          { x: bx, z: 0 },
        ],
        { pinned: new Set([0]), dt },
      );
    assert.deepEqual(q[0], { x: 0, z: 0 }); // the pinned player never moves
    closest = Math.min(closest, Math.hypot(q[1].x, q[1].z));
    if (last) fastest = Math.max(fastest, Math.hypot(q[1].x - last.x, q[1].z - last.z) / dt);
    last = { ...q[1] };
  }
  assert.ok(closest > SPACE.min - 0.02, `closest ${closest}`);
  assert.ok(fastest < 12, `fastest ${fastest}`); // a sidestep, not a teleport
  assert.ok(last.x > 1.5 && Math.abs(last.z) < 0.2); // and he ends up where the play wanted, past A
});
test('defensive stance: hands in front of the body, never out to the side; one high one low on the ball, both low in help', async () => {
  const THREE = await import('three');
  const { animateAthlete } = await import('../src/motion.js');
  const { loadBody } = await import('../assets-src/players/cloudmesh/ball_samples.mjs');
  for (const v of ['guard', 'center']) {
    const { body, player } = await loadBody(v);
    const b = body.bones,
      at = n => b[n].getWorldPosition(new THREE.Vector3()),
      drive = ball => {
        player.userData.motionState = undefined;
        for (let f = 0; f < 90; f++)
          animateAthlete(
            player,
            { arms: 'defend', y: 0 },
            { dt: 1 / 60, motion: true, ball: ball.clone(), holder: false },
          );
        player.updateMatrixWorld(true);
        return {
          eR: at('elbow_R'),
          eL: at('elbow_L'),
          R: at('wrist_R'),
          L: at('wrist_L'),
          sR: at('shoulder_R'),
          sL: at('shoulder_L'),
          chest: at('chest'),
        };
      };
    // he faces +z; +x is his left. On the ball: the handler dribbling a step in front, a little to his left
    const on = drive(new THREE.Vector3(0.35, 0.9, 1.1));
    for (const [w, s] of [
      [on.R, on.sR],
      [on.L, on.sL],
    ]) {
      assert.ok(w.z > s.z + 0.15, `${v}: hand in front of the shoulder (${(w.z - s.z).toFixed(2)})`);
      assert.ok(Math.abs(w.x) < Math.abs(s.x) + 0.2, `${v}: hand not out to the side (${w.x.toFixed(2)})`);
    }
    const [hi, lo] = on.R.y > on.L.y ? [on.R, on.L] : [on.L, on.R];
    assert.ok(
      hi.y > on.sR.y - 0.05 && lo.y < on.chest.y - 0.1,
      `${v}: one hand up, one low (${hi.y.toFixed(2)} / ${lo.y.toFixed(2)})`,
    );
    assert.ok(lo === on.L, `${v}: the low hand is on the ball's side (his left)`);
    // the high hand reaches out at the man with its elbow under it, not out to the side (a chicken wing)
    assert.ok(on.R.z > on.sR.z + 0.4, `${v}: high hand well out in front (${(on.R.z - on.sR.z).toFixed(2)})`);
    assert.ok(
      Math.abs(on.eR.x) < Math.abs(on.sR.x) + 0.08 && on.eR.y < on.R.y,
      `${v}: high elbow under the hand (${on.eR.x.toFixed(2)} vs shoulder ${on.sR.x.toFixed(2)})`,
    );
    // help: the ball far away
    const help = drive(new THREE.Vector3(6, 1, 6));
    for (const [w, s] of [
      [help.R, help.sR],
      [help.L, help.sL],
    ]) {
      assert.ok(w.y < help.chest.y && w.z > s.z + 0.1, `${v}: help hands low and in front`);
      assert.ok(Math.abs(w.x) < Math.abs(s.x) + 0.15, `${v}: help hands no wider than the shoulders`);
    }
  }
});
test('gait: a planted foot stays put on the floor at a walk, a jog, a run and a sprint (stride fitted to the leg)', async () => {
  const THREE = await import('three');
  const { animateAthlete, gaitFor, fitGait, footAt } = await import('../src/motion.js');
  const { loadBody } = await import('../assets-src/players/cloudmesh/ball_samples.mjs');
  // the stance/swing cycle is continuous, and duty 0.5 is the old half-and-half cycle
  for (const d of [0.3, 0.5, 0.62]) {
    const a = footAt(d * 2 * Math.PI - 1e-9, 1.2, 0.2, d),
      b = footAt(d * 2 * Math.PI + 1e-9, 1.2, 0.2, d);
    assert.ok(Math.abs(a.forward - b.forward) < 1e-6 && b.up < 1e-6);
  }
  assert.deepEqual(footAt(1.3, 1.1, 0.1), footAt(1.3, 1.1, 0.1, 0.5));
  // running leaves a flight phase, walking overlaps
  assert.ok(gaitFor(7).duty < 0.5 && gaitFor(1.2).duty > 0.5);
  assert.ok(gaitFor(7).stride > gaitFor(3).stride && gaitFor(7).elbow > gaitFor(1).elbow);
  for (const v of ['guard', 'center']) {
    const { body, player } = await loadBody(v);
    for (const speed of [1.2, 3, 5, 7]) {
      player.userData.motionState = undefined;
      player.position.set(0, 0, 0);
      let sum = 0,
        n = 0;
      const prev = {};
      for (let f = 0; f < 240; f++) {
        player.position.z += speed / 60;
        animateAthlete(player, { arms: 'relax', y: 0 }, { dt: 1 / 60, motion: true, ball: null });
        player.updateMatrixWorld(true);
        const m = player.userData.motionState,
          R = body.motionRest,
          g = fitGait(gaitFor(m.speed), R.legs.L, R.legs.L.hipY - m.crouch * R.legs.L.hipY),
          T = 2 * Math.PI;
        ['R', 'L'].forEach((s, j) => {
          const p = (((m.phase + (j ? Math.PI : 0)) % T) + T) % T,
            prog = p / (g.duty * T),
            mid = f > 90 && prog > 0.1 && prog < 0.85,
            a = body.bones['ankle_' + s].getWorldPosition(new THREE.Vector3());
          if (mid && prev[s]) {
            sum += Math.hypot(a.x - prev[s].x, a.z - prev[s].z);
            n++;
          }
          prev[s] = mid ? a : null;
        });
      }
      const slip = sum / n / (speed / 60);
      assert.ok(
        n > 30 && slip < 0.05,
        `${v} at ${speed}: planted foot slides ${(slip * 100).toFixed(1)}% of the travel`,
      );
    }
  }
});

test('fingers: spread wide on defence and for a target, together when relaxed or in a fist', async () => {
  const THREE = await import('three');
  const { animateAthlete } = await import('../src/motion.js');
  const { loadBody } = await import('../assets-src/players/cloudmesh/ball_samples.mjs');
  const { body, player } = await loadBody('guard');
  let spread = null;
  body.setSpread = (r, l) => (spread = [r, l]);
  const run = (pose, perform = null) => {
    player.userData.motionState = undefined;
    for (let f = 0; f < 60; f++)
      animateAthlete(player, { y: 0, ...pose }, { dt: 1 / 60, motion: true, ball: null, perform });
    return spread;
  };
  assert.ok(
    run({ arms: 'defend' }).every(s => s > 0.7),
    'defence: both hands spread',
  );
  assert.ok(
    run({ arms: 'relax' }).every(s => s < 0.05),
    'relaxed: together',
  );
  const at = new THREE.Vector3(0.2, 1.4, 0.5),
    target = { p: at, pole: null, w: 1, spread: 0.9 },
    fist = { p: at.clone(), pole: null, w: 1, grip: 1 };
  const shown = run(
    { arms: 'relax' },
    { gait: true, body: {}, feet: {}, look: null, hands: { R: target, L: fist } },
  );
  assert.ok(shown[0] > 0.8 && shown[1] < 0.05, `a target hand spreads, a fist does not (${shown})`);
});
