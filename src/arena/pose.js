// One player's pose each frame (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the Arena).
// posePlayer takes a pose in the play's terms ({x, y, z, yaw, run, arms, ...} from basketball.js sampleClip, blended and
// spaced by the frame) and draws it: position and facing (faceYaw: toward where he runs, at a human turning speed), then
// the body through motion.js animateAthlete (athletes) or the classic figure's joints. A performance (q.perform) moves the
// hands, body and look on top of the gait: shotPerform (the play's shot hands), finishPerform (finishes, actions and
// reactions, from src/finishes.js, src/actions.js and src/reactions.js). releasePoint is where a play's shot leaves the
// hands, cached per play.
import * as THREE from 'three';
import { CLIP_SECONDS, sampleClip, family, shotTiming, DRIBBLE } from '../basketball.js';
import { animateAthlete, facingWeight, mixAngle, steerYaw, footAt, strideFor } from '../motion.js';

export const poseMethods = {
  posePlayer(player, pose, t, ease = 1) {
    const u = player.userData,
      run = (u.run = ease >= 1 || u.run === undefined ? pose.run : u.run + (pose.run - u.run) * ease);
    player.position.set(pose.x, pose.y, pose.z);
    player.rotation.set(0, this.faceYaw(player, pose) + (pose.yawAdd || 0), 0); // yawAdd: a finish's turn (hook, spin)
    // the classic figure strides on the distance it covers (motion.js footAt), so a planted foot stays put; the athletes'
    // legs are posed by animateAthlete below
    const classic = u.body?.style === 'classic';
    let swing = j => Math.sin(t * 11 + j * Math.PI) * 0.65 * run;
    if (classic) {
      const last = u.cLast,
        dt = this.frameDt || 0;
      let moved = last ? Math.hypot(pose.x - last.x, pose.z - last.z) : 0;
      if (moved > 1.5) moved = 0;
      u.cLast = { x: pose.x, z: pose.z };
      if (dt > 0) u.cSpeed = (u.cSpeed || 0) + (moved / dt - (u.cSpeed || 0)) * (1 - Math.exp(-6 * dt));
      const stride = strideFor(u.cSpeed || 0),
        k = Math.max(0, Math.min(1, ((u.cSpeed || 0) - 0.1) / 0.8)),
        gw = this.motion ? k * k * (3 - 2 * k) : 0;
      if (this.motion) u.cPhase = (u.cPhase || 0) + (moved / Math.max(stride, 0.2)) * Math.PI;
      const foot = j => footAt((u.cPhase || 0) + j * Math.PI, stride, 0.12);
      swing = j => -Math.atan2(foot(j).forward, 0.74) * gw;
      u.legs.forEach((leg, j) => {
        leg.rotation.set(swing(j), 0, 0);
        leg.userData.knee.rotation.x = foot(j).up * 6 * gw;
      });
    } else
      u.legs.forEach((leg, j) => {
        leg.rotation.set(swing(j), 0, 0);
        leg.userData.knee.rotation.x = Math.max(0, -Math.sin(t * 11 + j * Math.PI)) * 0.8 * run;
      });
    u.arms.forEach((arm, j) => {
      const side = j ? 1 : -1;
      let x = classic ? -swing(j) * 0.85 : Math.sin(t * 11 + j * Math.PI) * 0.55 * run,
        z = side * 0.12,
        elbow = -0.25;
      if (['shoot', 'block', 'rebound'].includes(pose.arms)) {
        x = -2.7;
        z = side * 0.12;
        elbow = -0.25;
      }
      if (pose.arms === 'hook') {
        x = j ? -2.9 : -0.3;
        z = side * 0.25;
        elbow = -0.4;
      }
      if (pose.arms === 'defend') {
        // one hand up in the passing lane, the other low in front: never both straight out to the side
        x = j ? -0.55 : -1.3;
        z = side * 0.32;
        elbow = j ? -0.9 : -0.6;
      }
      if (pose.arms === 'screen') {
        x = -0.1;
        z = side * 0.55;
        elbow = -0.8;
      }
      if (pose.arms === 'pass') {
        x = -1.6;
        elbow = -0.1;
      }
      if (pose.arms === 'dribble') {
        // the dribbling arm rides the dribble's hand (dribbleAt): up as it meets the ball, a push down, then waiting
        x = j ? -0.25 - (this.dribbleHand - DRIBBLE.mid) * 2.4 : -0.6;
        elbow = j ? -0.15 : -0.8;
      }
      const r = arm.rotation,
        e = arm.userData.elbow.rotation;
      r.set(r.x + (x - r.x) * ease, 0, r.z + (z - r.z) * ease);
      e.x += (elbow - e.x) * ease;
    });
    if (u.body?.style === 'athletes')
      animateAthlete(player, pose, {
        dt: this.frameDt || 0,
        motion: this.motion && !(this.event && this.paused) && !this.titleStill,
        gait: this.gait,
        ball: this.ball?.position,
        ballRadius: 0.13,
        holder: player === this.holder,
        dribbleHand: this.dribbleHand,
        dribble: this.dribble,
        perform: pose.perform || null,
        family: this.clipFamily || '',
        airLegs: pose.airLegs || null,
        airLead: pose.airLead || 'R',
      });
  },
  /* The way a player's body faces: the play's facing, turned toward where he is running by facingWeight (motion.js), and
     steered at a human turning speed instead of snapping. Ground speed is measured from his drawn positions. */
  faceYaw(player, pose) {
    const u = player.userData,
      dt = this.frameDt || 0,
      last = u.faceLast;
    u.faceLast = { x: pose.x, z: pose.z };
    if (pose.exactYaw || !this.motion || u.faceYaw === undefined || !last) return (u.faceYaw = pose.yaw); // a move turns him itself
    if (!dt) return u.faceYaw;
    const dx = pose.x - last.x,
      dz = pose.z - last.z,
      d = Math.hypot(dx, dz);
    if (d > 1.5) return (u.faceYaw = pose.yaw); // a jump to a new spot: no turning
    const speed = (u.faceSpeed =
      (u.faceSpeed || 0) + (d / dt - (u.faceSpeed || 0)) * (1 - Math.exp(-8 * dt)));
    if (d > 1e-4) u.faceTravel = Math.atan2(dx, dz);
    const off =
        u.faceTravel === undefined
          ? 0
          : Math.abs(Math.atan2(Math.sin(u.faceTravel - pose.yaw), Math.cos(u.faceTravel - pose.yaw))),
      w = Math.max(0, Math.min(1, facingWeight(speed, pose.arms, off) || 0)),
      want = u.faceTravel === undefined ? pose.yaw : mixAngle(pose.yaw, u.faceTravel, w);
    return (u.faceYaw = steerYaw(u.faceYaw, want, dt));
  },
  /* A hands-only performance (motion.js ctx.perform) from a play's shot hands (world arrays): legs keep their gait.
     around/scale: a player drawn taller or shorter than his model (bodyFor) has the hands scaled about his feet, as the
     ball he holds is (frame), so they still meet it. spread: how far the fingers fan apart (a blocker's swat). */
  shotPerform(hands, around = null, scale = 1, spread = 0) {
    const V = p =>
        around && scale !== 1
          ? new THREE.Vector3(...p).sub(around).multiplyScalar(scale).add(around)
          : new THREE.Vector3(...p),
      out = { gait: true, body: {}, feet: {}, look: null, hands: {} };
    for (const h of ['R', 'L']) {
      const H = hands[h];
      if (H) out.hands[h] = { spread, ...H, p: V(H.p), pole: H.pole ? V(H.pole) : null };
    }
    return out;
  },
  /* A finish's frame (src/finishes.js finishFrame / putbackFrame) as a performance: hands (world arrays), body, look. */
  finishPerform(f) {
    const V = p => new THREE.Vector3(...p),
      out = { gait: true, body: f.body || {}, feet: {}, look: f.look ? V(f.look) : null, hands: {} };
    for (const [h, H] of Object.entries(f.hands || {}))
      out.hands[h] = { ...H, p: V(H.p), pole: H.pole ? V(H.pole) : null };
    return out;
  },
  /* The play's release point (where the flight starts): the finishes land the held ball on it exactly. */
  releasePoint(clip) {
    const c = (this.relCache ??= new WeakMap());
    let r = c.get(clip);
    if (!r) c.set(clip, (r = sampleClip(clip, shotTiming(clip.kind).release * CLIP_SECONDS + 1e-9).ball));
    return r;
  },
};
