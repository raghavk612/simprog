// The 3D gym: the Arena shows what the engine decided (src/engine.js makes the plays; nothing here changes an outcome).
// The UI creates one (src/ui/page.js), hands it the season with update(state), plays a possession with play(event) and
// listens to onPresentation for the moments a play resolves; it picks the camera with setView and the graphics level
// with setQuality. Without WebGL it shows a text fallback and its entry points return at once (this.failed).
//
// This file holds the setup (renderer, lights), the graphics level and auto quality, the scoreboard, and frame(), the
// loop body that runs every animation frame. The rest is in src/arena/ by concern, mixed into the class at the bottom:
//   gym.js       building the gym: court, hoops, signs, scoreboard, stands and fans, furniture
//   cast.js      who is on the floor: bodies (classic or athletes), names, numbers, kit colours, height, level of detail
//   playback.js  a possession: the play clock, the run between plays, each frame of a play (playFrame)
//   pose.js      one player's pose each frame: facing, the motion.js animation, shot and finish performances
//   ball.js      the ball's look, spin, the idle dribble and passes between hands
//   idle.js      the gym between plays and the title hero's show (idleFrame)
//   cameras.js   camera modes, the title sweep and fly-in, Player view, the classic auto director (cameraFrame)
// Presentation only throughout: the engine's play (basketball.js sampleClip) is read, never changed, so old saves replay
// exactly.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CLIP_SECONDS, family, dribbleAt, DRIBBLE } from './basketball.js';
import { drawScoreboard, scoreboardData, scoreboardKey, setScoreboardOpponentLogo } from './scoreboard.js';
import { qualityProfile, autoStep, medianMs, probeDone, PROBE } from './graphics.js';
import { loadOpponentLogo } from './logos.js';
import { BroadcastLook } from './broadcast.js';
import { Director } from './director.js';
import { PerfHud, perfWanted } from './perfHud.js';
import { gymMethods } from './arena/gym.js';
import { castMethods } from './arena/cast.js';
import { ballMethods } from './arena/ball.js';
import { poseMethods } from './arena/pose.js';
import { playbackMethods } from './arena/playback.js';
import { idleMethods } from './arena/idle.js';
import { cameraMethods } from './arena/cameras.js';

export class Arena {
  constructor(host) {
    this.speed = 1;
    this.playTime = 0;
    this.paused = false;
    this.host = host;
    this.models = 0;
    this.people = [];
    this.time = 0;
    this.motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shakeOn = true;
    this.shake = 0;
    this.run = 0;
    this.mode = 'broadcast';
    this.texts = new Set();
    this.quality = 'auto';
    this.level = 'high';
    this.probe = { times: [], frames: 0, done: false };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#100e22');
    this.scene.fog = new THREE.Fog('#100e22', 75, 150);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      host.innerHTML =
        '<div class="fallback">3D graphics unavailable on this device. All coaching controls remain playable.</div>';
      this.failed = true;
      return;
    }
    /* Pixel ratio 2 keeps lines and signs sharp on hi-DPI screens; the old 1.7 cap upscaled a soft canvas. */ this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.aniso = this.renderer.capabilities.getMaxAnisotropy();
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 220);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 6;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
      if (this.mode === 'follow' || this.mode === 'auto') {
        this.mode = 'court';
        this.host.dispatchEvent(new CustomEvent('cameramode', { bubbles: true, detail: 'court' }));
      }
    });
    this.hemi = new THREE.HemisphereLight(0xded5ff, 0x2a1f3c, 0.95);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffeee2, 2.2);
    sun.position.set(6, 25, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 75 });
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    this.scene.add(sun);
    const fill = new THREE.PointLight(0x9e61ff, 80, 60);
    fill.position.set(-15, 9, -11);
    this.scene.add(fill);
    const desk = new THREE.PointLight(0xffe2c4, 140, 18);
    desk.position.set(16, 6, -12);
    this.scene.add(desk);
    this.spots = [];
    for (const x of [-10, 0, 10]) {
      const light = new THREE.SpotLight(0xf4edff, 100, 42, 0.65, 0.65, 1.4);
      light.position.set(x, 15, 1);
      light.target.position.set(x, 0, 0);
      this.scene.add(light, light.target);
      this.spots.push(light);
    }
    this.build();
    this.look = new BroadcastLook(this);
    this.director = new Director();
    this.importModels();
    this.setView('broadcast');
    /* Re-solve the camera preset whenever the canvas changes shape (title, HQ, game and phone layouts all differ). */ new ResizeObserver(
      () => {
        if (
          !this.userMoved &&
          this.mode !== 'player' &&
          !((this.mode === 'follow' || this.mode === 'auto') && this.event)
        )
          this.setView(this.mode);
      },
    ).observe(host);
    /* Barlow is a CSS webfont: redraw every canvas texture once it has loaded so no sign stays in the fallback face. */ Promise.all(
      ['900 64px "Barlow Condensed"', 'italic 900 64px "Barlow Condensed"', '700 64px Barlow'].map(f =>
        document.fonts?.load(f),
      ),
    )
      .then(() => {
        this.fontsReady = true;
        this.texts.forEach(draw => draw());
        this.texts.clear();
      })
      .catch(() => {});
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => {
      this.frame();
      this.perfHud?.frame();
    });
    if (perfWanted()) this.perfHud = new PerfHud(this);
  }
  mount(target) {
    this.endFly();
    target.append(this.host);
  }
  /* Graphics quality (see graphics.js). 'auto' starts at High and measures ~2 s of frames once; setting the same level again is a no-op, so applyArena can call this freely. */
  setQuality(q) {
    if (this.failed || q === this.quality) return;
    this.quality = q;
    this.level = q === 'auto' ? 'high' : q;
    this.probe = q === 'auto' ? { times: [], frames: 0, done: false } : { done: true };
    this.applyLevel();
  }
  applyLevel() {
    const p = qualityProfile(this.level, devicePixelRatio, {
        width: this.host.clientWidth,
        height: this.host.clientHeight,
      }),
      sun = this.sun;
    if (this.renderer.getPixelRatio() !== p.pixelRatio) {
      this.renderer.setPixelRatio(p.pixelRatio);
      if (this.w) this.look?.resize(this.w, this.h);
    }
    if (sun) {
      sun.castShadow = p.shadows;
      if (p.shadows && sun.shadow.mapSize.x !== p.shadowSize) {
        sun.shadow.mapSize.set(p.shadowSize, p.shadowSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
    for (const o of this.crowd || []) {
      o.visible = p.crowd !== 'hidden';
      o.castShadow = p.crowd === 'full';
    }
    if (this.playersChoice) this.applyPlayers();
  }
  /* Auto mode (graphics.js autoStep): after a short warm-up, every two seconds or so of rendered frames decides a step down
     the ladder (High, Medium, Lite, Low) when frames are slow, or back up after three fast windows; a step up that proves
     slow is undone and not tried again. Each change starts a new warm-up (new shaders compile). Nothing is remembered. */
  measure(now) {
    const pr = this.probe;
    if (pr.done) return;
    const raw = this.lastT ? now - this.lastT : 0;
    this.lastT = now;
    if (raw <= 0 || ++pr.frames <= PROBE.warmup) return;
    pr.times.push(raw);
    if (!probeDone(pr.times)) return;
    const { level, state } = autoStep(this.level, medianMs(pr.times), pr.state);
    pr.state = state;
    pr.times = [];
    if (level !== this.level) {
      this.level = level;
      pr.frames = 0;
      this.applyLevel();
    }
  }
  score(home, away) {
    this.boardHome = home;
    this.boardAway = away;
    if (!this.boardCanvas) return;
    const data = scoreboardData(this.state, home, away, this.event);
    this.oppAsked ??= new Set();
    if (!this.oppAsked.has(data.opponent)) {
      this.oppAsked.add(data.opponent);
      const name = data.opponent;
      loadOpponentLogo(name).then(img => {
        if (img) {
          setScoreboardOpponentLogo(name, img);
          this.boardKey = '';
          this.score(this.boardHome ?? 0, this.boardAway ?? 0);
        }
      });
    }
    const key = scoreboardKey(data);
    if (this.boardKey === key) return;
    this.boardKey = key;
    drawScoreboard(this.boardCanvas.getContext('2d'), this.boardCanvas.width, this.boardCanvas.height, data);
    this.boardTex.needsUpdate = true;
  }
  update(s) {
    if (this.failed) return;
    this.state = s;
    if (!this.event) {
      const starters = s?.players.filter(p => p.starter) || [];
      for (let i = 0; i < 5; i++)
        this.setIdentity(
          this.people[i],
          starters[i] || { id: i, number: [0, 2, 3, 11, 20][i], name: 'Kangs' },
        );
      this.castVisitors();
    }
    if (!this.event) {
      const m = s?.match,
        r = s?.results.at(-1);
      this.score(m?.home ?? r?.home ?? 0, m?.away ?? r?.away ?? 0);
    }
  }
  frame() {
    if (this.failed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05),
      w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (w < 1 || h < 1 || this.host.hidden) {
      this.lastT = 0;
      return;
    }
    /* the auto-quality probe never times the title gym (it always shows the athletes and the broadcast look); it runs on the first other view */ if (
      this.mode === 'title'
    )
      this.lastT = 0;
    else this.measure(performance.now());
    if (this.w !== w || this.h !== h) {
      this.w = w;
      this.h = h;
      this.renderer.setPixelRatio(
        qualityProfile(this.level, devicePixelRatio, { width: w, height: h }).pixelRatio,
      );
      this.renderer.setSize(w, h, false);
      this.look?.resize(w, h);
      this.camera.aspect = w / h;
      this.camera.fov = w / h < 0.8 ? 65 : 43;
      this.camera.updateProjectionMatrix();
    }
    // who has the ball (for the athletes' hands): the nearest player within reach of where it was last frame
    {
      const bp = this.ball?.position;
      this.holder = null;
      if (bp && bp.y < 2.9) {
        let best = 0.85;
        for (const p of this.people) {
          const d = Math.hypot(p.position.x - bp.x, p.position.z - bp.z);
          if (d < best) {
            best = d;
            this.holder = p;
          }
        }
      }
    }
    this.clipFamily =
      this.event && this.clips
        ? family(this.clips[Math.min(1, Math.floor(this.playTime / CLIP_SECONDS))]?.kind || '')
        : '';
    // The title screen's pause (WCAG 2.2.2) holds its camera sweep where it is and poses the gym as with reduced motion: everyone on his title spot in a still stance, gait frozen; nothing else uses it.
    const titled = this.mode === 'title' && !this.event,
      still = titled && !!this.titlePaused;
    this.titleStill = still;
    if (this.motion) {
      this.time += dt;
      if (titled && !still) this.titleClock = (this.titleClock || 0) + dt;
    }
    this.frameDt = this.event && this.paused ? 0 : dt * (this.event ? (this.speed || 1) * this.slowMo() : 1);
    // the crowd breathes and sways, and bounces for a few seconds after a Kangs basket (still with reduced motion)
    this.cheer = this.motion ? (this.cheer || 0) * Math.exp(-dt * 0.7) : 0;
    this.fans?.update(this.motion ? dt : 0, Math.min(1, this.cheer * 1.6));
    // One continuous stride/dribble clock, so legs and arms never jump when a clip restarts.
    this.gait =
      (this.gait || 0) +
      (this.motion && !(this.event && this.paused) && !still
        ? dt * (this.event ? this.speed * this.slowMo() : 1)
        : 0);
    // the dribbling hand (dribbleAt) on the gait clock: between plays and in the idle gym; a play sets its own below
    this.dribble = dribbleAt(this.gait / DRIBBLE.period);
    this.dribbleHand = this.dribble.hand;
    if (this.event) this.playFrame(dt);
    else this.idleFrame(dt, titled, still);
    this.posed = true;
    this.cameraFrame(dt, titled);
    // Impact shake: a short camera jitter on dunks and blocks. Off with reduced motion or the screen-shake setting.
    let jx = 0,
      jy = 0;
    if (this.shake > 0) {
      if (this.motion && this.shakeOn) {
        jx = (Math.random() - 0.5) * this.shake;
        jy = (Math.random() - 0.5) * this.shake;
      }
      this.shake *= Math.pow(0.02, dt);
      if (this.shake < 0.004) this.shake = 0;
    }
    this.settleBall();
    this.updateLods();
    // figures out of view are skipped only without shadows: a player just out of shot still throws one into it
    this.classicBatch?.update(this.people, this.sun?.castShadow ? null : this.camera);
    this.camera.position.x += jx;
    this.camera.position.y += jy;
    this.look.render(this.camera);
    this.camera.position.x -= jx;
    this.camera.position.y -= jy;
  }
}

// The rest of the Arena's methods live in modules by concern (src/arena/*.js; each says what it covers and what it keeps
// on the Arena). They are plain methods sharing the Arena as `this`, added to the class here; a name defined twice throws.
for (const part of [
  gymMethods,
  castMethods,
  ballMethods,
  poseMethods,
  playbackMethods,
  idleMethods,
  cameraMethods,
])
  for (const [name, d] of Object.entries(Object.getOwnPropertyDescriptors(part))) {
    if (Object.hasOwn(Arena.prototype, name)) throw Error(`Arena.${name} is defined twice`);
    Object.defineProperty(Arena.prototype, name, { ...d, enumerable: false });
  }
