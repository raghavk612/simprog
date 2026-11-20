// Cameras (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the Arena). Modes (setView): broadcast,
// court (the user orbits), follow, auto, player (first person, the head hidden: firstPerson, restoreHead) and title (the
// sweep, flyIn on leaving it). cameraFrame points the camera each frame: with the athletes' broadcast look, Auto and
// Follow hand it to the broadcast director (src/director.js); otherwise the classic follow camera and the classic auto
// director (autoDirector: wide, track, Player view, baseline). A user dragging the view switches to court
// (the 'cameramode' event tells the UI).
import * as THREE from 'three';
import { CLIP_SECONDS } from '../basketball.js';
import { titleCamera, flyIn, titleFov, STILL } from '../title.js';

export const cameraMethods = {
  setView(mode) {
    if (this.failed) return;
    if (mode !== 'title') this.endFly();
    const wasTitle = this.mode === 'title';
    this.mode = mode;
    if (wasTitle !== (mode === 'title') && this.playersChoice) this.applyPlayers();
    this.userMoved = false;
    this.controls.enabled = mode !== 'player' && mode !== 'title';
    if (mode === 'player') {
      this.fpLook = null;
      return;
    }
    if (mode === 'title') {
      this.aimTitle();
      return;
    }
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      a = w > 1 && h > 1 ? w / h : 16 / 9,
      tall = a < 0.8,
      fixed = {
        locker: [
          [-9, 5.5, -6],
          [-15.5, 1.4, -15],
        ],
        office: [
          [18.6, 4.4, -6],
          [15.6, 1, -13.2],
        ],
        follow: [
          [7, tall ? 11 : 9, tall ? 17 : 16],
          [7, 1, 0],
        ],
      };
    if (fixed[mode]) {
      const [p, t] = fixed[mode];
      this.camera.position.set(...p);
      this.controls.target.set(...t);
    } else {
      /* broadcast/courtside keep a fixed viewing angle and solve the distance so the court fills the frame at this aspect (zoom>1 lets the corners run off-frame; the tighter vertical bound leaves room for the score bug and controls) */ const [
          az,
          el,
          ty,
          zx,
          zy,
        ] =
          mode === 'court'
            ? [tall ? 62 : 47, tall ? 21 : 19, 1, tall ? 1.75 : 1.3, tall ? 1.75 : 1.3]
            : [tall ? 70 : 33, tall ? 40 : 32, 0, tall ? 1.12 : 0.97, tall ? 0.9 : 0.8],
        r = Math.PI / 180,
        cam = (this.fitCam ||= new THREE.PerspectiveCamera()),
        dir = new THREE.Vector3(
          Math.sin(az * r) * Math.cos(el * r),
          Math.sin(el * r),
          Math.cos(az * r) * Math.cos(el * r),
        ),
        t = new THREE.Vector3(0, ty, 0),
        v = new THREE.Vector3(),
        pts = [
          [-14.2, 0, -8.6],
          [14.2, 0, -8.6],
          [-14.2, 0, 8.6],
          [14.2, 0, 8.6],
          [-12.75, 4.5, 0],
          [12.75, 4.5, 0],
        ].map(p => new THREE.Vector3(...p));
      cam.fov = tall ? 65 : 43;
      cam.aspect = a;
      cam.updateProjectionMatrix();
      const fits = d => {
        cam.position.copy(dir).multiplyScalar(d).add(t);
        cam.lookAt(t);
        cam.updateMatrixWorld();
        return pts.every(p => {
          v.copy(p).project(cam);
          return v.z < 1 && Math.abs(v.x) <= zx && Math.abs(v.y) <= zy;
        });
      };
      let lo = 4,
        hi = 120;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      this.camera.position.copy(dir).multiplyScalar(hi).add(t);
      this.controls.target.copy(t);
    }
    this.controls.update();
  },
  /* Points the camera for this frame (frame): the broadcast director (with the athletes' look, in Auto and Follow), the
     classic follow camera, Player view, the title sweep or the user's orbit, and the field of view and depth of field. */
  cameraFrame(dt, titled) {
    // With the 3D athletes' broadcast look, Auto and Follow use the broadcast director (Spline camera angles, springs, cuts, depth of field).
    const directed =
      this.look?.active && this.motion && this.event && (this.mode === 'auto' || this.mode === 'follow')
        ? this.director.update(this, dt * (this.paused ? 0 : 1), { follow: this.mode === 'follow' })
        : null;
    if (!directed && this.mode === 'follow' && this.event) {
      const side = this.clipIndex === 1 ? -1 : 1;
      const focus = this.people[side === 1 ? 0 : 5].position;
      const x = THREE.MathUtils.clamp(focus.x, -10, 10);
      this.camera.position.lerp(new THREE.Vector3(x, 8.5, 14), 0.045);
      this.controls.target.lerp(new THREE.Vector3(x, 1.2, 0), 0.08);
    }
    const fp =
      this.mode === 'player' ||
      (directed ? directed === 'player' : this.mode === 'auto' && this.autoDirector());
    this.fpActive = !!fp;
    if (fp) {
      this.firstPerson();
    } else {
      this.restoreHead();
      if (titled) this.aimTitle();
      else if (!directed) this.controls.update();
    }
    const fov = fp
      ? 62
      : directed
        ? this.director.fov
        : titled
          ? titleFov(this.w / this.h, this.titleU)
          : this.w / this.h < 0.8
            ? 65
            : 43;
    // the title shot holds the dribbler in gentle focus (chest height) with the broadcast look on
    const heroFocus =
      titled && this.look?.active
        ? (this.heroPoint ||= new THREE.Vector3()).copy(this.people[2].position).setY(1.2)
        : null;
    this.look?.setDof(
      heroFocus || (directed && directed !== 'player' ? this.director.focusPoint : null),
      heroFocus ? 0.45 : this.director.dof,
      dt,
    );
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  },
  /* Title screen (mode 'title', shots in src/title.js): a slow jib sweep on its own clock (held while paused; one fixed shot with reduced motion), or the fly-in to the broadcast shot,
    which holds there once it lands. The fly-in runs on wall time and resolves when it lands, when the view changes or the arena is cleared or remounted, or at the latest shortly after
    it should have landed (a hidden tab draws no frames). */
  aimTitle() {
    if (this.fly && !this.motion) this.endFly();
    /* reduced motion switched on mid-flight: no fly-in, straight to the fixed shot */ const f = this.fly,
      u = f ? (performance.now() - f.t0) / f.ms : 0,
      s = f ? flyIn(u, f.from) : titleCamera(this.motion ? this.titleClock || 0 : STILL);
    this.titleU = f ? u : 0;
    /* fly-in progress, for the lens (titleFov) */ this.camera.position.set(...s.position);
    this.controls.target.set(...s.target);
    this.camera.lookAt(this.controls.target);
    if (f && u >= 1) f.done();
  },
  setTitlePaused(paused) {
    this.titlePaused = !!paused;
  },
  flyIn(ms = 900) {
    this.endFly();
    if (this.failed || !this.motion || this.mode !== 'title' || this.host.hidden) return Promise.resolve();
    return new Promise(resolve => {
      const f = (this.fly = {
          t0: performance.now(),
          ms: Math.max(1, ms),
          from: { position: this.camera.position.toArray(), target: this.controls.target.toArray() },
        }),
        timer = setTimeout(() => f.done(), f.ms + 500);
      f.done = () => {
        if (f.over) return;
        f.over = true;
        clearTimeout(timer);
        resolve();
      };
    });
  } /* done is a no-op after the first call (aimTitle reports the landing every frame while the shot holds) */,
  endFly() {
    const f = this.fly;
    this.fly = null;
    f?.done();
  },
  firstPerson() {
    const clip = this.event ? this.presentation()?.clip : null;
    const team = clip?.team || 'home';
    const actor = this.people[clip ? (team === 'home' ? 0 : 5) : 2];
    if (!actor) {
      this.fpSubject = null;
      this.restoreHead();
      return;
    }
    const who = actor.userData.person;
    this.fpSubject = who
      ? {
          number: who.number,
          name: team === 'away' && clip && clip.player ? clip.player : who.name,
          position: who.position,
          id: who.id,
          home: team === 'home',
        }
      : null;
    // Through his eyes: the camera sits at his eyes (his head, so it rises with a jump and dips with the crouch), looks at
    // the rim with a glance toward the ball, never cranes more than 40 degrees up, and keeps clear of everyone's
    // body. His own body is hidden (it would fill the lens). Smoothing is time-based.
    const dir = team === 'home' ? 1 : -1;
    const rim = new THREE.Vector3(dir * 12.15, 3.28, 0);
    const a = actor.position;
    const flat = new THREE.Vector3(rim.x - a.x, 0, rim.z - a.z);
    if (flat.lengthSq() < 0.01) flat.set(dir, 0, 0);
    flat.normalize();
    const headBone = actor.userData.body?.bones?.head;
    const eye = headBone
      ? headBone.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0))
      : new THREE.Vector3(a.x, a.y + 1.8, a.z);
    eye.addScaledVector(flat, 0.12);
    const look = rim.clone().lerp(this.ball.position, 0.2);
    // limit how steeply he looks up (under the rim the view would otherwise point straight up the net)
    const up = look.y - eye.y,
      across = Math.hypot(look.x - eye.x, look.z - eye.z),
      maxUp = Math.tan((40 * Math.PI) / 180) * Math.max(across, 0.4);
    if (up > maxUp) look.y = eye.y + maxUp;
    for (const o of this.people) {
      if (o === actor) continue;
      const dx = eye.x - o.position.x,
        dz = eye.z - o.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.75) {
        eye.x = o.position.x + (d > 0.001 ? dx / d : -flat.x) * 0.75;
        eye.z = o.position.z + (d > 0.001 ? dz / d : -flat.z) * 0.75;
      }
    }
    if (this.fpHidden !== actor) {
      this.restoreHead();
      this.fpHidden = actor;
      // his whole body: from inside his head his own shoulder and arm would fill half the lens
      actor.visible = false;
    }
    if (this.camera.near !== 0.15) {
      this.camera.near = 0.15;
      this.camera.updateProjectionMatrix();
    }
    const dt = this.frameDt || 1 / 60,
      kp = 1 - Math.exp(-dt * 20),
      kl = 1 - Math.exp(-dt * 9);
    if (!this.fpLook) {
      this.camera.position.copy(eye);
      this.fpLook = look.clone();
    }
    this.camera.position.lerp(eye, kp);
    this.fpLook.lerp(look, kl);
    this.camera.lookAt(this.fpLook);
  },
  restoreHead() {
    if (this.camera.near !== 0.1) {
      this.camera.near = 0.1; // the first-person near-clip (see firstPerson) is only for that view
      this.camera.updateProjectionMatrix();
    }
    const o = this.fpHidden;
    if (!o) return;
    this.fpHidden = null;
    o.visible = true;
  },
  /* TV director for Auto camera: wide for the setup, tracking for the drive, then a first-person look at the rim (Kangs) or a baseline angle (visitors) on the shot. Returns true when the first-person shot is active. */
  autoDirector() {
    if (!this.event || !this.motion) {
      this.autoShot = null;
      return false;
    }
    const pr = this.presentation();
    if (!pr) return false;
    const ct = Math.min(1, (this.playTime - pr.index * CLIP_SECONDS) / CLIP_SECONDS),
      team = pr.clip.team,
      dir = team === 'home' ? 1 : -1,
      a = this.people[team === 'home' ? 0 : 5].position;
    const shot =
      ct < 0.26
        ? 'wide'
        : ct < 0.58
          ? 'track'
          : ct < 0.84
            ? team === 'home'
              ? 'player'
              : 'baseline'
            : 'track';
    if (shot !== this.autoShot) {
      if (this.autoShot === 'player' && this.fpLook) this.controls.target.copy(this.fpLook);
      if (shot === 'player') this.fpLook = null;
      this.autoShot = shot;
    }
    if (shot === 'player') return true;
    const x = THREE.MathUtils.clamp(a.x, -11, 11),
      V = (px, py, pz) => new THREE.Vector3(px, py, pz);
    const [pos, tgt] =
      shot === 'wide'
        ? [V(x * 0.45, 15, 21), V(x * 0.55, 0, 0)]
        : shot === 'track'
          ? [V(x - dir * 4, 6.2, 12.5), V(x + dir * 1.5, 1.3, a.z * 0.4)]
          : [V(dir * 17.5, 4.2, dir * 4.5), V(dir * 9, 2, 0)];
    this.camera.position.lerp(pos, shot === 'baseline' ? 0.07 : 0.05);
    this.controls.target.lerp(tgt, 0.09);
    return false;
  },
};
