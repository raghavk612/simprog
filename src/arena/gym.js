// Building the gym (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the Arena). Built once, from the
// constructor (build, importModels); the graphics level only shows or hides parts of it (Arena.applyLevel).
//   mat, box, glow, textTexture, sign  the shared material style, boxes, light panels and canvas text (redrawn once the
//                                      webfonts arrive: this.texts)
//   courtWood, court                   the maple floor, its lines and the painted logo
//   build                              lights' fixtures, hoops and nets, scoreboard, banners, the ten players, the ball
//   addDetails, stands, importModels   sideline details, the stands and their fans, benches and office furniture (GLB)
// Left on the Arena for the frame: people, ball and ballSpinner, hoops, nets, trail, focusRing, floor and courtWear,
// boardCanvas and boardTex (the scoreboard, drawn by Arena.score), fans and crowd, classicBatch.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setScoreboardLogo } from '../scoreboard.js';
import { ClassicBatch } from '../classicBatch.js';
import { titlePath } from '../title.js';
import { seatLayout, hash } from '../seating.js';
import { makeWood } from '../courtwood.js';
import { buildCrowd } from '../crowd.js';
import { KANGS_PURPLE } from '../kits.js';

export const gymMethods = {
  mat(c, extra = {}) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, ...extra });
  },
  box(w, h, d, c, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  },
  glow(m, c, i = 3) {
    m.material.emissive.set(c);
    m.material.emissiveIntensity = i;
    m.castShadow = false;
    return m;
  },
  /* Crisp canvas text: canvas matches the mesh aspect (o.aspect, default 2:1 for legacy calls), Barlow Condensed fitted to the canvas, mipmaps + max anisotropy, redrawn once the webfont is ready. "\n" splits lines. */
  textTexture(text, bg = '#562494', fg = '#ffffff', size = 512, o = {}) {
    const a = o.aspect || 2,
      W = Math.round(Math.min(2048, o.px || Math.max(512, size * 2))),
      H = Math.max(48, Math.round(W / a)),
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d'),
      t = new THREE.CanvasTexture(c),
      lines = String(text).split('\n'),
      font = s => {
        x.font = `${o.italic ? 'italic ' : ''}900 ${s}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`;
        if ('letterSpacing' in x) x.letterSpacing = `${s * (o.spacing ?? 0.03)}px`;
      };
    const draw = () => {
      x.fillStyle = bg;
      x.fillRect(0, 0, W, H);
      if (o.border) {
        x.fillStyle = o.border;
        x.fillRect(0, H * 0.9, W, H * 0.05);
        x.fillRect(0, H * 0.03, W, H * 0.025);
      }
      let fs = (H * (o.scale || 0.62)) / lines.length;
      font(fs);
      const widest = Math.max(...lines.map(l => x.measureText(l).width));
      if (widest > W * 0.88) {
        fs *= (W * 0.88) / widest;
        font(fs);
      }
      x.fillStyle = fg;
      x.textAlign = 'center';
      x.textBaseline = 'alphabetic';
      lines.forEach((l, i) => {
        const m = x.measureText(l);
        x.fillText(
          l,
          W / 2,
          (H * (i + 0.5)) / lines.length + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
        );
      });
      t.needsUpdate = true;
    };
    draw();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.aniso || 8;
    if (!this.fontsReady) {
      this.texts.add(draw);
      t.addEventListener('dispose', () => this.texts.delete(draw));
    }
    return t;
  },
  sign(text, w, h, x, y, z, o = {}) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: this.textTexture(text, o.bg, o.fg, 512, {
          aspect: w / h,
          px: Math.min(2048, Math.max(256, Math.round(w * 200))),
          ...o,
        }),
        toneMapped: false,
      }),
    );
    m.position.set(x, y, z);
    m.rotation.y = o.ry || 0;
    this.scene.add(m);
    return m;
  },
  /* The maple floor as a canvas (w x h px at pxPerFt), and its varnish wear as this.courtWear: a small grey texture over the
     whole floor read as a roughness factor (0.45 on fresh varnish up to 1 where it is most worn) by the broadcast look. */
  courtWood(w, h, pxPerFt, wearAt) {
    const { rgba, wear } = makeWood(w, h, pxPerFt, wearAt),
      c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
    const k = 4, // the wear map is a quarter of the size each way: boards are still several pixels long
      ww = Math.floor(w / k),
      wh = Math.floor(h / k),
      data = new Uint8Array(ww * wh * 4);
    for (let y = 0; y < wh; y++)
      for (let x = 0; x < ww; x++) {
        const v = 115 + 0.55 * wear[y * k * w + x * k], // stored as a roughness factor: 0.45 on fresh varnish, 1 fully worn
          i = ((wh - 1 - y) * ww + x) * 4; // bottom row first: texture v runs up, canvas rows run down
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    const t = new THREE.DataTexture(data, ww, wh, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = this.aniso || 8;
    t.needsUpdate = true;
    this.courtWear = t;
    return c;
  },
  /* NFHS high-school court (84'x50') on the 32x20 floor at 128 px per world unit. Feet->units is solved so the basket centre, 5'3" in from the baseline, sits exactly under the 3D rims at x=+-12.15 (1 ft = 0.3306 u; baselines at +-13.89, sidelines at +-8.27). */
  court() {
    const S = Math.min(1, (this.renderer.capabilities.maxTextureSize || 4096) / 4096),
      c = document.createElement('canvas');
    c.width = 4096 * S;
    c.height = 2560 * S;
    const x = c.getContext('2d'),
      t = new THREE.CanvasTexture(c),
      U = 128,
      F = (U * 12.15) / 36.75,
      cx = 2048,
      cy = 1280,
      L = 42 * F,
      Wd = 25 * F,
      lw = Math.max(7, F / 6),
      lane = 6 * F,
      logo = new Image(),
      R = n => {
        const s = Math.sin(n * 127.1) * 43758.5453;
        return s - Math.floor(s);
      };
    // maple strips (src/courtwood.js) at the canvas's own resolution, made once; the paint below is redrawn over it
    const wood = this.courtWood(c.width, c.height, F * S, (px, py) => {
      // traffic wear in feet from the court's centre: the paint under both baskets and the centre circle
      const fx = (px / S - cx) / F,
        fy = (py / S - cy) / F,
        g = (dx, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (fy * fy) / (2 * sy * sy));
      return 0.55 * (g(fx - 31, 9, 8) + g(fx + 31, 9, 8)) + 0.3 * g(fx, 7, 7);
    });
    const STAIN = 'rgba(86,31,172,.86)'; // a stain: the grain shows through, and over average maple it comes out the gym KANGS_PURPLE #6934a5
    const draw = () => {
      x.setTransform(S, 0, 0, S, 0, 0);
      x.fillStyle = '#6934a5';
      x.fillRect(0, 0, 4096, 2560);
      x.drawImage(wood, 0, 0, 4096, 2560);
      x.fillStyle = STAIN; // the apron round the court
      x.beginPath();
      x.rect(0, 0, 4096, 2560);
      x.rect(cx - L, cy - Wd, 2 * L, 2 * Wd);
      x.fill('evenodd');
      x.strokeStyle = '#fff6e4';
      x.lineWidth = lw;
      for (const s of [1, -1]) {
        x.save();
        x.translate(cx, cy);
        x.scale(s, 1);
        const b = -L + 5.25 * F,
          fc = -L + 19 * F - lw / 2,
          r3 = 19.75 * F - lw / 2,
          h8 = (8 / 12) * F;
        x.fillStyle = STAIN;
        x.fillRect(-L, -lane, 19 * F, 2 * lane);
        x.strokeRect(-L + lw / 2, -lane + lw / 2, 19 * F - lw, 2 * lane - lw); // 12' lane, free-throw line 15' from the backboard (19' from the baseline)
        x.beginPath();
        x.arc(fc, 0, 6 * F - lw / 2, -Math.PI / 2, Math.PI / 2);
        x.stroke();
        x.setLineDash([F * 1.3, F * 0.95]);
        x.beginPath();
        x.arc(fc, 0, 6 * F - lw / 2, Math.PI / 2, Math.PI * 1.5);
        x.stroke();
        x.setLineDash([]); // 6' free-throw circle, dashed inside the lane
        x.fillStyle = '#fff6e4';
        for (const z of [lane, -lane - h8]) {
          x.fillRect(-L + 7 * F, z, F, h8);
          for (const m of [11, 14 + 2 / 12, 17 + 4 / 12]) x.fillRect(-L + m * F, z, F / 6, h8);
        } // lane-space marks
        x.beginPath();
        x.moveTo(-L, -r3);
        x.lineTo(b, -r3);
        x.arc(b, 0, r3, -Math.PI / 2, Math.PI / 2);
        x.lineTo(-L, r3);
        x.stroke();
        x.restore();
      } // 19'9" three-point arc with straight corner lines to the baseline
      x.strokeRect(cx - L + lw / 2, cy - Wd + lw / 2, 2 * L - lw, 2 * Wd - lw);
      x.fillStyle = '#fff6e4';
      x.fillRect(cx - lw / 2, cy - Wd, lw, 2 * Wd);
      x.beginPath();
      x.arc(cx, cy, 6 * F - lw / 2, 0, Math.PI * 2);
      x.stroke();
      if (logo.naturalWidth) {
        const w = 880,
          h = (w * logo.naturalHeight) / logo.naturalWidth;
        x.globalAlpha = 0.9; // painted on the wood, like the lane
        x.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
        x.globalAlpha = 1;
      } else if (logo.failed) {
        x.fillStyle = '#6934a5';
        x.font = 'italic 900 420px "Barlow Condensed",Arial,sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('K', cx, cy);
      }
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = 'italic 900 150px "Barlow Condensed","Arial Narrow",Arial,sans-serif';
      if ('letterSpacing' in x) x.letterSpacing = '12px';
      x.fillText('LAKE WASHINGTON', cx, cy - 8.85 * U + 4);
      x.fillText('HOME OF THE KANGS', cx, cy + 8.85 * U + 4);
      /* inside the 8.27-9.4 apron band so the scorer's table and bench chairs behind it never cover the lettering */ if (
        'letterSpacing' in x
      )
        x.letterSpacing = '0px';
      t.needsUpdate = true;
    };
    logo.onload = draw;
    logo.onerror = () => {
      logo.failed = true;
      draw();
    };
    logo.src = `${import.meta.env.BASE_URL}images/kangs-logo.png`;
    draw();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.aniso || 8;
    if (!this.fontsReady) this.texts.add(draw);
    return t;
  },
  build() {
    this.box(40, 0.6, 33, 0x221a35, 0, -0.3, 0);
    /* ground slab top is y=0 so props off the wood rest on it instead of hovering */ const edge =
        this.mat(0x5a3726),
      floor = new THREE.Mesh(new THREE.BoxGeometry(32, 0.16, 20), [
        edge,
        edge,
        this.mat(0xffffff, { map: this.court(), roughness: 0.36 }),
        edge,
        edge,
        edge,
      ]);
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;
    // Gym shell: cut-away room of four inward-facing one-sided walls (+ light bands). Walls between an orbiting camera and the court are back-face culled, so every angle sees in while the far walls still close the room.
    const panel = (w, h, c, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat(c));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    for (const [w, x, z, ry] of [
      [39, 0, -16, 0],
      [32, -19.5, 0, Math.PI / 2],
      [32, 19.5, 0, -Math.PI / 2],
      [39, 0, 16, Math.PI],
    ]) {
      panel(w, 9.3, 0x2c1d3d, x, 4.35, z, ry);
      this.glow(panel(w, 0.14, 0xa76aff, x * 0.999, 4.75, z * 0.999, ry), 0x8e43ed);
    }
    this.sign('LAKE WASHINGTON KANGS', 17, 2, -19.45, 6.5, 0, { ry: Math.PI / 2 });
    this.stands();
    // The hoops at real size (1 ft = 0.3306): ring 18 in across, 10 ft up; backboard 6 x 3.5 ft, its face 15 in behind the
    // ring's centre, its bottom 6 in below the ring; the shooter's square 24 x 18 in. The ring and net sit in one group at
    // the hoop (styleBall makes them the old bigger size for the classic toy ball, which a real ring could not take).
    this.nets = [];
    this.hoops = [];
    const FT = 0.3306,
      RIM = 0.75 * FT,
      FACE = 12.15 + 1.25 * FT;
    for (const side of [-1, 1]) {
      const x = side * 14.9;
      this.box(0.3, 4.1, 0.3, 0x393846, x, 2.05, 0);
      const armFrom = FACE + 0.12,
        armTo = 14.75;
      this.box(armTo - armFrom, 0.2, 0.24, 0xd6d5df, side * ((armFrom + armTo) / 2), 3.72, 0);
      const back = this.box(
        0.12,
        3.5 * FT,
        6 * FT,
        0xded9e9,
        side * (FACE + 0.06),
        3.28 - 0.5 * FT + 1.75 * FT,
        0,
      );
      // tempered glass: you see the arena through it; the white frame and the shooter's square are painted on (below)
      back.material = new THREE.MeshPhysicalMaterial({
        color: 0xdfe8f2,
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      back.castShadow = false; // stanchion sits out of bounds; arm meets the back of the board instead of poking through it over the rim
      const frame = (y0, y1, z) => [
        [y0, -z],
        [y0, z],
        [y0, z],
        [y1, z],
        [y1, z],
        [y1, -z],
        [y1, -z],
        [y0, -z],
      ];
      const b0 = 3.28 - 0.5 * FT;
      this.scene.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(
            [...frame(b0, b0 + 3.5 * FT, 3 * FT - 0.01), ...frame(3.28, 3.28 + 1.5 * FT, 1 * FT)].map(
              ([y, z]) => new THREE.Vector3(side * (FACE - 0.005), y, z),
            ),
          ),
          new THREE.LineBasicMaterial({ color: 0xffffff }),
        ),
      );
      const hoop = new THREE.Group();
      hoop.position.set(side * 12.15, 3.28, 0);
      this.scene.add(hoop);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RIM, 0.012, 8, 40), this.mat(0xf27a24));
      ring.rotation.x = Math.PI / 2;
      hoop.add(ring);
      // the net: 12 strands, 18 in long, narrowing to about half the ring
      const net = new THREE.Group();
      hoop.add(net);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          points = [
            new THREE.Vector3(Math.cos(a) * RIM, -0.01, Math.sin(a) * RIM),
            new THREE.Vector3(Math.cos(a + 0.25) * RIM * 0.55, -1.5 * FT, Math.sin(a + 0.25) * RIM * 0.55),
          ];
        net.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0xffffff }),
          ),
        );
      }
      this.nets.push({ mesh: net, side });
      this.hoops.push(hoop);
    }
    for (let i = 0; i < 4; i++)
      this.sign(i === 3 ? 'YOUR\nSEASON' : `KANGS\n${2023 + i}`, 2, 2.8, -17.6 + i * 2.5, 6.5, -15.95, {
        border: '#e9b858',
        scale: 0.5,
      });
    /* LED video board modelled on the real Lake Washington gym board (see src/scoreboard.js); unlit material so it glows. */ this.boardCanvas =
      document.createElement('canvas');
    this.boardCanvas.width = 2048;
    this.boardCanvas.height = 768;
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    this.boardTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.scoreboard = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 4.5),
      new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false }),
    );
    this.scoreboard.position.set(0, 8.2, -11);
    this.scene.add(this.scoreboard);
    this.box(12.7, 5.2, 0.45, 0x0b0c16, 0, 8.2, -11.3);
    const boardRim = new THREE.Mesh(
      new THREE.PlaneGeometry(12.24, 4.74),
      new THREE.MeshBasicMaterial({ color: 0x2d57c8, toneMapped: false }),
    );
    boardRim.position.set(0, 8.2, -11.03);
    this.scene.add(boardRim);
    for (const x of [-5, 5]) this.box(0.07, 2.6, 0.07, 0x2a2a33, x, 12, -11.3);
    this.score(0, 0);
    {
      const img = new Image();
      img.onload = () => {
        setScoreboardLogo(img);
        this.boardKey = '';
        this.score(this.boardHome ?? 0, this.boardAway ?? 0);
      };
      img.src = `${import.meta.env.BASE_URL}images/kangs-logo.png`;
    }
    document.fonts
      ?.load('900 100px "Barlow Condensed"')
      .then(() => document.fonts.load('800 100px "Barlow Condensed"'))
      .then(() => {
        this.boardKey = '';
        this.score(this.boardHome ?? 0, this.boardAway ?? 0);
      })
      .catch(() => {});
    for (let i = 0; i < 10; i++) {
      const player = this.player(i, i < 5 ? KANGS_PURPLE : 0xf1e9df);
      this.people.push(player);
      this.scene.add(player);
    }
    // the classic figures drawn instanced, a part type at a time (src/classicBatch.js)
    this.classicBatch = new ClassicBatch(this.scene);
    // ball (placed by the plays) > spinner (turned by spinBall, lowered by settleBall) > sphere and seams
    this.ball = new THREE.Group();
    this.ballSpinner = new THREE.Group();
    this.ball.add(this.ballSpinner);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 16),
      this.mat(0xe9832a, { roughness: 0.85 }),
    );
    this.ballSpinner.add(sphere);
    for (let i = 0; i < 3; i++) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.282, 0.009, 4, 48), this.mat(0x392318));
      if (i === 1) seam.rotation.x = Math.PI / 2;
      if (i === 2) seam.rotation.y = Math.PI / 2;
      this.ballSpinner.add(seam);
    }
    this.scene.add(this.ball);
    // Program spaces share the gym: imported furniture, jersey wall, and coach desk.
    // (Ceiling lamp bars removed: with no roof they floated across the court in every elevated preset; the spotlights still light the floor.) Office corner gets a carpet.
    this.box(5.2, 0.03, 4.6, 0x3b2a52, 16.3, 0.015, -13.4).castShadow = false;
    this.addDetails();
    this.box(2.1, 2.7, 0.1, 0x140d1d, -18.2, 1.35, -15.96);
    this.sign('LOCKER ROOM', 2.6, 0.6, -18.2, 3.1, -15.93);
    this.sign('ALWAYS RISING.', 10, 1.6, 9.5, 6.4, -15.95, { italic: true });
  },
  addDetails() {
    // Physical sideline details, rather than extra floating UI.
    for (const side of [-1, 1]) this.box(1, 0.8, 1.5, 0x673a9b, side * 14.95, 0.4, 0); // padded stanchion bases, behind the baselines
    for (let i = 0; i < 5; i++) this.box(0.1, 0.08, 1.7, 0xa186bf, -19.42, 0.5 + i * 0.6, 14.6);
    for (const z of [13.8, 15.4]) this.box(0.1, 3.2, 0.1, 0xa186bf, -19.42, 1.6, z); // wall bars on the end wall; they, the ball rack and the cones share the -x near corner, clear of the baseline stand (src/seating.js)
    this.box(5, 1, 0.7, 0x211332, 0, 0.5, 9.75);
    this.sign('KANGS SCORER’S TABLE', 4.8, 0.6, 0, 0.65, 9.38);
    for (let i = 0; i < 5; i++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.35, 8), this.mat(0xb7dff2));
      bottle.position.set(-2 + i * 0.7, 1.18, 9.75);
      this.scene.add(bottle);
    }
    this.box(0.75, 0.12, 2.1, 0x4d4555, -18.75, 0.35, 11.7);
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), this.mat(0xdd7d2b));
      ball.position.set(-18.75, 0.7, 11 + i * 0.7);
      this.scene.add(ball);
    } // ball rack along the end wall
    for (const z of [10.7, 12.7])
      for (const x of [-19.1, -18.4]) this.box(0.06, 1.1, 0.06, 0xa3a1ae, x, 0.55, z);
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 12), this.mat(0xe67a24));
      cone.position.set(-17.4 + i * 1.2, 0.25, 10.9);
      this.scene.add(cone);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.57, 48),
      new THREE.MeshBasicMaterial({
        color: 0xe3bd69,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    this.focusRing = ring;
    this.scene.add(ring);
    this.trail = [];
    for (let i = 0; i < 8; i++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xf6c078, transparent: true, opacity: (8 - i) / 16 }),
      );
      dot.visible = false;
      this.scene.add(dot);
      this.trail.push(dot);
    }
  },
  /* Bleachers (layout in src/seating.js): six rows on both sidelines, four behind each baseline cut around the props there; solid risers (no hollow gaps), a lit ribbon on each front rail, aisles,
    and the instanced seated crowd (src/crowd.js) sized to the players, turned to face the court. Seats on the title jib's path stay empty so no fan fills its lens. */
  stands() {
    const { risers, rails, seats } = seatLayout(titlePath());
    for (const [w, h, d, x, y, z] of rails) this.glow(this.box(w, h, d, 0xa76aff, x, y, z), 0x8e43ed, 2.4);
    for (const [w, h, d, x, y, z, odd] of risers) this.box(w, h, d, odd ? 0x7e51b1 : 0x4e2b78, x, y, z);
    // the seated crowd (src/crowd.js): four instanced meshes, swaying on the GPU
    this.fans = buildCrowd(seats, hash);
    for (const o of this.fans.meshes) this.scene.add(o);
    this.crowd = this.fans.meshes;
  },
  async importModels() {
    const loader = new GLTFLoader();
    /* [model,[[x,y,z,rotY]],scale]: team chairs line each bench on the scorer's side, office set in the +x/-z corner, cabinets beside the locker-room door */ for (const [
      name,
      positions,
      scale,
    ] of [
      [
        'bench',
        [0, 1, 2, 3, 4, 5].flatMap(k => [
          [-9.6 + k, 0, 9.65, Math.PI],
          [4.4 + k, 0, 9.65, Math.PI],
        ]),
        2,
      ],
      [
        'chair',
        [
          [16.05, 0, -13.66, 0],
          [16.4, 0, -12.25, Math.PI],
        ],
        1.7,
      ],
      ['table', [[15.3, 0, -12.4, 0]], 2.2],
      [
        'bookcaseClosedDoors',
        [
          [-16.66, 0, -15.5, 0],
          [-15.46, 0, -15.5, 0],
          [-14.26, 0, -15.5, 0],
        ],
        2.1,
      ],
      ['plantSmall1', [[18.9, 0, -15.5, 0]], 4.5],
    ]) {
      try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
        for (const [px, py, pz, ry] of positions) {
          const obj = gltf.scene.clone(true);
          obj.position.set(px, py, pz);
          obj.rotation.y = ry;
          obj.scale.setScalar(scale);
          obj.traverse(m => {
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          this.scene.add(obj);
        }
        this.models++;
      } catch (error) {
        console.warn('Asset unavailable', name, error);
      }
    }
  },
};
