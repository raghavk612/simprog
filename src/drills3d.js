// 3D scene kit for the practice drills: renderer lifecycle, the Kangs gym (half court, hoop, net), a capsule player rig, props.
// Everything is built in feet (the shot physics unit). One WebGLRenderer per drill; dispose() frees every GPU resource.
// No game state lives here. The drill controllers are in drillscenes.js.
import * as THREE from 'three';
import {getA11y} from './settings.js';
import {qualityProfile, lowerLevel, autoDowngrade, probeDone, PROBE, effectivePlayers} from './graphics.js';
import {athleteBody, lookFor, loadAthletes, loadedAthletes} from './players.js';
import {RIM_H, RIM_R, BALL_R, BOARD_Z, BOARD, BASELINE_Z} from './shotphysics.js';

export const PURPLE = 0x6832ab, GOLD = 0xe9b858, CREAM = 0xf1e9df, WOOD_LINE = '#fff6e4';
export const reducedMotion = () => { try { return !!getA11y().reducedMotion; } catch { return false; } };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const FONT = (w, s, italic = true) => `${italic ? 'italic ' : ''}${w} ${s}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`;

/* ------------------------------------------------------------------ stage */
let lastStage = null;
// Frees the newest stage if a controller threw while setting up.
export const abortStage = () => { try { lastStage?.dispose(); } catch { /* already gone */ } lastStage = null; };
// Returns null when WebGL is unavailable so the caller can fall back to the 2D drill.
export function createStage(host, { fov = 38, minAspect = 1.0 } = {}) {
  const a11y = getA11y(), want = a11y.graphics || 'auto';
  let level = want === 'auto' ? 'high' : want, renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: level !== 'low', alpha: false, powerPreference: 'high-performance' }); } catch { return null; }
  const gl = renderer.getContext?.();
  if (!gl || gl.isContextLost?.()) { try { renderer.dispose(); } catch { /* nothing to free */ } return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0x100e22);
  const canvas = renderer.domElement; canvas.className = 'd3-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
  canvas.addEventListener('contextmenu', e => e.preventDefault()); // long-press on touch must not open a menu mid-shot
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!S.dead) host.dispatchEvent(new CustomEvent('d3lost', { bubbles: true })); });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.5, 400);
  const S = { host, canvas, renderer, scene, camera, level, profile: null, size: { w: 1, h: 1 }, ticks: [], onLevel: [], redraws: [], sun: null, baseFov: fov, minAspect, dead: false };
  // A clock that stops while the tab is hidden, so a timing round cannot run out unseen.
  let hiddenAt = null, paused = 0;
  const vis = () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt !== null) { paused += performance.now() - hiddenAt; hiddenAt = null; } };
  document.addEventListener('visibilitychange', vis);
  S.now = () => (performance.now() - paused - (hiddenAt !== null ? performance.now() - hiddenAt : 0)) / 1000;
  const tmp = new THREE.Vector3();
  S.project = v => { tmp.copy(v).project(camera); return { x: (tmp.x * 0.5 + 0.5) * S.size.w, y: (-tmp.y * 0.5 + 0.5) * S.size.h, visible: tmp.z < 1 }; };
  S.fit = () => {
    const w = Math.max(2, host.clientWidth), h = Math.max(2, host.clientHeight), aspect = w / h;
    S.size = { w, h }; renderer.setSize(w, h, false); camera.aspect = aspect;
    camera.fov = aspect < S.minAspect ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(S.baseFov) / 2) * S.minAspect / aspect)) : S.baseFov;
    camera.updateProjectionMatrix();
  };
  S.applyLevel = () => {
    const p = qualityProfile(level, window.devicePixelRatio || 1); S.level = level; S.profile = p;
    renderer.setPixelRatio(p.pixelRatio); renderer.shadowMap.enabled = p.shadows;
    if (S.sun) { S.sun.castShadow = p.shadows; if (p.shadows && S.sun.shadow.mapSize.x !== p.shadowSize) { S.sun.shadow.mapSize.set(p.shadowSize, p.shadowSize); S.sun.shadow.map?.dispose(); S.sun.shadow.map = null; } }
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    S.onLevel.forEach(f => f(p)); S.fit();
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => S.fit()) : null; ro?.observe(host);
  S.applyLevel();
  // Auto graphics: after a short warm-up measure about two seconds of frames and step down a level if they are slow.
  const probe = { times: [], frames: 0, done: want !== 'auto' }; let lastT = 0;
  renderer.setAnimationLoop(() => {
    if (S.dead) return;
    const raw = performance.now(), dt = clamp((raw - (lastT || raw)) / 1000, 0, 0.25);
    if (!probe.done && lastT && ++probe.frames > PROBE.warmup) { probe.times.push(raw - lastT); if (probeDone(probe.times)) { if (autoDowngrade(probe.times) && level !== 'low') { level = lowerLevel(level); S.applyLevel(); probe.times = []; probe.frames = 0; } else probe.done = true; } }
    lastT = raw;
    const now = S.now();
    for (const f of S.ticks) f(now, dt);
    renderer.render(scene, camera);
  });
  S.dispose = () => {
    if (S.dead) return; S.dead = true; renderer.setAnimationLoop(null); ro?.disconnect(); document.removeEventListener('visibilitychange', vis);
    const seen = new Set(), free = t => { if (t && !seen.has(t)) { seen.add(t); t.dispose?.(); } };
    scene.traverse(o => {
      if (!o.userData.sharedGeometry) free(o.geometry);
      if (o.material) [].concat(o.material).forEach(m => { for (const v of Object.values(m)) if (v && v.isTexture) free(v); free(m); });
      if (o.isLight && o.shadow) { o.shadow.map?.dispose(); }
    });
    S.extra?.forEach(free); scene.clear();
    renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* already gone */ } canvas.remove();
  };
  S.track = t => { (S.extra ||= []).push(t); return t; };
  lastStage = S;
  return S;
}

/* ------------------------------------------------------------------ textures */
// Canvas text texture (Barlow Condensed), redrawn once the web font is ready so signs never stay in the fallback face.
export function textTexture(S, draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, S.renderer.capabilities.getMaxAnisotropy());
  const go = () => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); draw(x, w, h); tex.needsUpdate = true; };
  go(); S.redraws.push(go); S.track(tex); tex.userData.redraw = go;
  return tex;
}
export function whenFonts(S) { Promise.all(['italic 900 40px "Barlow Condensed"', '800 40px "Barlow Condensed"', '700 40px Barlow'].map(f => document.fonts?.load(f))).then(() => { if (!S.dead) S.redraws.forEach(f => f()); }).catch(() => {}); }
const wrap = (x, text, maxW) => {
  const toks = String(text).match(/[　-鿿＀-￯]|[^\s　-鿿＀-￯]+|\s+/g) || [], lines = []; let cur = '';
  for (const tk of toks) {
    const next = cur + tk;
    if (x.measureText(next).width > maxW && cur.trim()) { lines.push(cur.trim()); cur = tk.trim() ? tk : ''; } else cur = next;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
};
export { wrap };
const blobTex = S => {
  if (S.blobMap) return S.blobMap;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return S.blobMap = S.track(new THREE.CanvasTexture(c));
};

/* ------------------------------------------------------------------ basic builders */
export const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, ...o });
export function box(S, w, h, d, c, x = 0, y = 0, z = 0, o = {}) {
  const {cast, ...mo} = o, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, mo)); m.position.set(x, y, z); m.castShadow = cast !== false; m.receiveShadow = true; S.scene.add(m); return m;
}
// Soft contact shadow for Low graphics (real shadow maps are off there).
export function blob(S, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex(S), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.renderOrder = 1; m.visible = !S.profile.shadows; S.onLevel.push(p => { m.visible = !p.shadows; }); S.scene.add(m); return m;
}
export function makeBall(S) {
  const g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), mat(0xe9832a, { roughness: 0.82 })); body.castShadow = true; g.add(body);
  const seam = mat(0x2d1a10, { roughness: 0.9 });
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 1.004, 0.012, 5, 56), seam); if (i === 1) s.rotation.x = Math.PI / 2; if (i === 2) s.rotation.y = Math.PI / 2; g.add(s); }
  for (const sg of [-1, 1]) { const s = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 0.72, 0.011, 5, 40, Math.PI * 1.2), seam); s.position.x = sg * BALL_R * 0.72; s.rotation.y = Math.PI / 2; s.rotation.z = sg * 0.4; g.add(s); }
  S.scene.add(g); return g;
}

/* ------------------------------------------------------------------ the gym */
function courtTexture(S) {
  const max = S.renderer.capabilities.maxTextureSize || 2048, X0 = -34, X1 = 34, Z0 = -14, Z1 = 62;
  // Low graphics caps the longer side at 1024 px instead of 2048.
  const dims = lvl => { const cap = Math.min(lvl === 'low' ? 1024 : 2048, max), kk = cap / (Z1 - Z0); return { kk, w: Math.round((X1 - X0) * kk), h: cap }; };
  let { kk: k, w: W, h: H } = dims(S.level);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  const R = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const draw = () => {
    x.setTransform(k, 0, 0, k, -X0 * k, -Z0 * k); x.fillStyle = '#5a2b94'; x.fillRect(X0, Z0, X1 - X0, Z1 - Z0);
    // boards run the length of the court
    x.save(); x.beginPath(); x.rect(-25, BASELINE_Z, 50, Z1 - BASELINE_Z); x.clip();
    const tones = ['#dcb07a', '#d3a56e', '#e0b886', '#d7aa75'];
    for (let i = 0, px = -25; px < 25; i++, px += 0.42) {
      for (let z = BASELINE_Z - R(i + 1) * 6, j = 0; z < Z1; j++) {
        const len = 4 + R(i * 31 + j) * 4; x.fillStyle = tones[Math.floor(R(i * 7 + j * 13 + 0.5) * 4)]; x.fillRect(px, z, 0.42, len);
        x.fillStyle = 'rgba(110,70,35,.22)'; x.fillRect(px, z + len - 0.035, 0.42, 0.035); z += len;
      }
      x.fillStyle = 'rgba(110,70,35,.16)'; x.fillRect(px, BASELINE_Z, 0.025, Z1 - BASELINE_Z);
      if (R(i * 3.3) > 0.55) { x.fillStyle = 'rgba(120,75,38,.07)'; x.fillRect(px + 0.1, BASELINE_Z, 0.04, Z1 - BASELINE_Z); }
    }
    x.restore();
    // the lane is painted Kangs purple, 12 ft wide, from the baseline to the free-throw line
    x.fillStyle = '#6934a5'; x.fillRect(-6, BASELINE_Z, 12, 19);
    x.strokeStyle = WOOD_LINE; x.fillStyle = WOOD_LINE; x.lineWidth = 0.2; x.lineJoin = 'miter';
    x.strokeRect(-25, BASELINE_Z, 50, Z1 - BASELINE_Z + 0.1); // out-of-bounds lines (the far end runs off into the fog)
    x.strokeRect(-6, BASELINE_Z, 12, 19); // lane
    x.beginPath(); x.arc(0, 13.75, 6, 0, Math.PI); x.stroke(); x.setLineDash([1.1, 0.8]); x.beginPath(); x.arc(0, 13.75, 6, Math.PI, Math.PI * 2); x.stroke(); x.setLineDash([]); // free-throw circle
    for (const s of [-1, 1]) { x.fillRect(s > 0 ? 6 : -6.8, BASELINE_Z + 7, 0.8, 0.2); for (const m of [11, 14.2, 17.4]) x.fillRect(s > 0 ? 6 : -6.7, BASELINE_Z + m - 4, 0.7, 0.17); } // lane-space marks
    x.beginPath(); x.moveTo(-19.75, BASELINE_Z); x.lineTo(-19.75, 0); x.arc(0, 0, 19.75, Math.PI, 0, true); x.lineTo(19.75, BASELINE_Z); x.stroke(); // 19 ft 9 in three-point line
    x.beginPath(); x.moveTo(-3, -4.5 + 0); x.lineTo(3, -4.5); x.stroke(); // backboard line
    x.beginPath(); x.moveTo(-25, 41.75); x.lineTo(25, 41.75); x.stroke(); x.beginPath(); x.arc(0, 41.75, 6, 0, Math.PI * 2); x.stroke();
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,246,228,.92)'; x.font = FONT(900, 3.4); x.fillText('LAKE WASHINGTON', 0, -9.4); x.font = FONT(900, 2.1); x.fillStyle = '#e9b858'; x.fillText('HOME OF THE KANGS', 0, -12.2);
    x.fillStyle = 'rgba(255,246,228,.22)'; x.font = FONT(900, 6.2); x.fillText('KANGS', 0, 16.9);
    x.restore(); tex.needsUpdate = true;
  };
  draw(); S.redraws.push(draw); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, S.renderer.capabilities.getMaxAnisotropy()); S.track(tex);
  // If auto graphics steps down to Low mid-drill, redraw the court at the smaller size.
  S.onLevel.push(() => { const d = dims(S.level); if (d.h < c.height) { c.width = d.w; c.height = d.h; k = d.kk; W = d.w; H = d.h; tex.dispose(); draw(); } });
  return { tex, zMid: (Z0 + Z1) / 2, w: X1 - X0, d: Z1 - Z0 };
}

function makeNet() {
  const N = 12, ROWS = 5, TOP_R = RIM_R - 0.02, BOT_R = 0.46, LEN = 1.45, pos = new Float32Array((ROWS + 1) * N * 3), idx = [];
  const at = (r, i) => r * N + (i % N + N) % N;
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < N; i++) { idx.push(at(r, i), at(r + 1, i), at(r, i), at(r + 1, i + (r % 2 ? 1 : -1))); }
  for (let r = 1; r <= ROWS; r += 2) for (let i = 0; i < N; i++) idx.push(at(r, i), at(r, i + 1));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
  lines.frustumCulled = false;
  // a faint cloth cone gives the net some body from far away
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R, BOT_R, LEN, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -LEN / 2; cone.frustumCulled = false;
  const g = new THREE.Group(); g.add(lines, cone);
  let t0 = -10, amp = 0, dx = 0, dz = 0;
  const shape = (tau) => {
    const a = amp * Math.exp(-3.4 * tau), w = 17 * tau;
    for (let r = 0; r <= ROWS; r++) {
      const f = r / ROWS, base = lerp(TOP_R, BOT_R, f), sc = 1 + 0.9 * a * Math.sin(w - r * 0.9) * f, sy = 1 - 0.1 * a * Math.sin(w * 1.1 - r) * f;
      for (let i = 0; i < N; i++) {
        const ang = i / N * Math.PI * 2, o = (r * N + i) * 3;
        pos[o] = Math.cos(ang) * base * sc + dx * a * f; pos[o + 1] = -f * LEN * sy; pos[o + 2] = Math.sin(ang) * base * sc + dz * a * f;
      }
    }
    geo.attributes.position.needsUpdate = true; cone.scale.set(1 + 0.5 * a * Math.sin(w), 1, 1 + 0.5 * a * Math.sin(w));
  };
  shape(10);
  return { group: g, kick(now, strength = 1, dir = [0, 0]) { t0 = now; amp = strength; dx = dir[0] * 0.25; dz = dir[1] * 0.25; }, update(now) { const tau = now - t0; if (tau < 2.2) shape(tau); else if (amp) { amp = 0; shape(10); } } };
}

// Builds the whole half-court gym and returns handles to the pieces drills animate.
export function buildGym(S) {
  const scene = S.scene, lowQ = S.profile.pixelRatio <= 1 && !S.profile.shadows;
  scene.background = new THREE.Color('#100e22'); scene.fog = new THREE.Fog('#100e22', 70, 190);
  scene.add(new THREE.HemisphereLight(0xded5ff, 0x2a1f3c, 1.05));
  const sun = new THREE.DirectionalLight(0xffeee2, 2.1); sun.position.set(14, 44, 30); sun.target.position.set(0, 0, 12); scene.add(sun, sun.target);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 32, bottom: -22, near: 5, far: 120 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3; S.sun = sun; S.applyLevel();
  const fill = new THREE.PointLight(0x9e61ff, 2200, 150); fill.position.set(-34, 18, -6); scene.add(fill);
  const warm = new THREE.PointLight(0xffe2c4, 1400, 110); warm.position.set(20, 16, 12); scene.add(warm);
  // floor
  const ct = courtTexture(S), floor = new THREE.Mesh(new THREE.PlaneGeometry(ct.w, ct.d), new THREE.MeshStandardMaterial({ map: ct.tex, roughness: 0.4, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, ct.zMid); floor.receiveShadow = true; scene.add(floor);
  box(S, 200, 1, 200, 0x15101f, 0, -0.52, 20, { cast: false });
  // shell: padded wall, light band, banners, sign
  const wall = (w, h, c, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(c)); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
  wall(170, 30, 0x2c1d3d, 0, 15, -17, 0); wall(150, 30, 0x2c1d3d, -48, 15, 25, Math.PI / 2); wall(150, 30, 0x2c1d3d, 48, 15, 25, -Math.PI / 2);
  box(S, 170, 7.5, 0.4, 0x3d2467, 0, 3.75, -16.8, { cast: false }); box(S, 0.4, 7.5, 150, 0x3d2467, -47.8, 3.75, 25, { cast: false }); box(S, 0.4, 7.5, 150, 0x3d2467, 47.8, 3.75, 25, { cast: false });
  const band = box(S, 170, 0.5, 0.2, 0xa76aff, 0, 7.8, -16.6, { cast: false, emissive: 0x8e43ed, emissiveIntensity: 2.2 });
  const sign = textTexture(S, (x, w, h) => { x.fillStyle = '#562494'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9b858'; x.fillRect(0, h * 0.06, w, h * 0.05); x.fillRect(0, h * 0.89, w, h * 0.05); x.fillStyle = '#fff'; x.font = FONT(900, h * 0.6); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LAKE WASHINGTON KANGS', w / 2, h * 0.53); }, 2048, 192);
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(52, 4.9), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false })); signM.position.set(0, 15.5, -16.6); scene.add(signM);
  for (let i = 0; i < 4; i++) {
    const tx = textTexture(S, (x, w, h) => { x.fillStyle = '#562494'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e9b858'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = FONT(900, h * 0.2); x.fillText('KANGS', w / 2, h * 0.38); x.font = FONT(900, h * 0.27); x.fillStyle = '#e9b858'; x.fillText(String(2023 + i), w / 2, h * 0.62); }, 256, 360);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 7), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); m.position.set([-34, -26, 26, 34][i], 12, -16.6); scene.add(m);
  }
  // bleachers along both sidelines
  if (!lowQ) for (const s of [-1, 1]) for (let r = 0; r < 4; r++) {
    box(S, 2.4, 1.1 + r * 1.1, 52, 0x241a38, s * (28.6 + r * 2.4), (1.1 + r * 1.1) / 2, 18, { cast: false });
    if (r === 0) box(S, 0.2, 0.3, 52, 0xa76aff, s * 27.3, 1.18, 18, { cast: false, emissive: 0x8e43ed, emissiveIntensity: 2 });
  }
  // the basket: padded stanchion, arm, glass backboard with shooter's square, rim, net
  const hoop = new THREE.Group(); scene.add(hoop);
  const add = (m, parent = hoop) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  // ceiling-hung gantry (no pole on the floor): two thin uprights from the top of the board and a cross bar high above
  for (const sx of [-2.4, 2.4]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 22, 8), mat(0x393846, { metalness: 0.4 }))).position.set(sx, 23.2, BOARD_Z - 0.5);
  add(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 0.3), mat(0x393846, { metalness: 0.4 }))).position.set(0, 12.45, BOARD_Z - 0.5);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.9), mat(0x393846, { metalness: 0.4 }))).position.set(0, 12.45, BOARD_Z - 0.2);
  const board = new THREE.Group(); board.position.set(0, 10.5, BOARD_Z - 0.09); hoop.add(board);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(BOARD.halfW * 2, BOARD.y1 - BOARD.y0, 0.16), new THREE.MeshStandardMaterial({ color: 0xdfe6ff, roughness: 0.15, transparent: true, opacity: 0.5 })); glass.castShadow = true; board.add(glass);
  const trim = mat(0xffffff, { roughness: 0.4 }); const hw = BOARD.halfW, hh = (BOARD.y1 - BOARD.y0) / 2;
  for (const [w, h, px, py] of [[hw * 2, 0.14, 0, hh - 0.07], [hw * 2, 0.14, 0, -hh + 0.07], [0.14, hh * 2, -hw + 0.07, 0], [0.14, hh * 2, hw + -0.07, 0], [2, 0.1, 0, -0.5 + 0.0], [2, 0.1, 0, 1.0], [0.1, 1.5, -1, 0.25], [0.1, 1.5, 1, 0.25]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), trim); m.position.set(px, py, 0); board.add(m); }
  const pad = mat(0x6832ab); const padM = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.3, 0.55, 0.35), pad); padM.position.set(0, -hh - 0.2, 0); padM.castShadow = true; board.add(padM);
  const rimG = new THREE.Group(); rimG.position.set(0, RIM_H, 0); hoop.add(rimG);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.07, 10, 40), mat(0xf27a24, { roughness: 0.35, metalness: 0.3, emissive: 0x3a1500 })); rim.rotation.x = Math.PI / 2; rim.castShadow = true; rimG.add(rim);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.55), mat(0xf27a24, { metalness: 0.3 })); brace.position.set(0, 0, BOARD_Z + 0.25); rimG.add(brace);
  const net = makeNet(); rimG.add(net.group);
  const rig = { shake: 0, t0: -10 };
  return {
    hoop, rimG, net, board,
    rattle(now, strength = 1) { rig.t0 = now; rig.shake = strength; },
    update(now) { net.update(now); const tau = now - rig.t0; if (tau < 1.2) { const a = rig.shake * Math.exp(-5 * tau); rimG.rotation.x = 0.035 * a * Math.sin(46 * tau); rimG.position.y = RIM_H - 0.025 * a * Math.abs(Math.sin(30 * tau)); board.position.z = BOARD_Z - 0.09 - 0.03 * a * Math.sin(40 * tau); } else if (rig.shake) { rig.shake = 0; rimG.rotation.x = 0; rimG.position.y = RIM_H; } },
  };
}

/* ------------------------------------------------------------------ recovery studio */
function plankTexture(S, tile = 20) {
  const W = 1024, k = W / tile, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  const R = n => { const q = Math.sin(n * 91.7) * 43758.5453; return q - Math.floor(q); };
  x.setTransform(k, 0, 0, k, 0, 0); const tones = ['#c9a06c', '#bf9561', '#d0a874', '#c39a66'];
  for (let i = 0, px = 0; px < tile; i++, px += 0.5) for (let z = -R(i) * 5, j = 0; z < tile; j++) { const len = 3 + R(i * 17 + j) * 4; x.fillStyle = tones[Math.floor(R(i * 5 + j * 11) * 4)]; x.fillRect(px, z, 0.5, len); x.fillStyle = 'rgba(90,55,25,.22)'; x.fillRect(px, z + len - 0.03, 0.5, 0.03); z += len; }
  x.fillStyle = 'rgba(90,55,25,.18)'; for (let px = 0; px < tile; px += 0.5) x.fillRect(px, 0, 0.025, tile);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4); tex.anisotropy = Math.min(8, S.renderer.capabilities.getMaxAnisotropy()); S.track(tex);
  return tex;
}
export function buildStudio(S) {
  const scene = S.scene; scene.background = new THREE.Color('#14101f'); scene.fog = new THREE.Fog('#14101f', 38, 110);
  scene.add(new THREE.HemisphereLight(0xe6dcff, 0x2a1f3c, 1.0));
  const key = new THREE.SpotLight(0xfff0dc, 5200, 90, 0.62, 0.85, 2); key.position.set(5, 22, 12); key.target.position.set(0, 1, 0); key.castShadow = true; key.shadow.bias = -0.0005; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target); S.sun = key;
  const fill = new THREE.PointLight(0x9e61ff, 900, 70); fill.position.set(-14, 9, 6); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: plankTexture(S), roughness: 0.45 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), mat(0x2c1d3d)); wall.position.set(0, 13, -15); wall.receiveShadow = true; scene.add(wall);
  box(S, 90, 3.2, 0.3, 0x3d2467, 0, 1.6, -14.8, { cast: false });
  box(S, 90, 0.35, 0.2, 0xa76aff, 0, 3.5, -14.6, { cast: false, emissive: 0x8e43ed, emissiveIntensity: 2 });
  for (let i = 0; i < 11; i++) box(S, 0.18, 9.5, 0.18, 0xbfa57e, -9 + i * 1.8, 8.4, -14.5, { cast: false });
  for (let j = 0; j < 8; j++) box(S, 18.4, 0.14, 0.2, 0xcdb48d, 0, 4.4 + j * 1.15, -14.35, { cast: false });
  const sign = textTexture(S, (x, w, h) => { x.fillStyle = '#562494'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9b858'; x.fillRect(0, h * 0.07, w, h * 0.06); x.fillRect(0, h * 0.87, w, h * 0.06); x.fillStyle = '#fff'; x.font = FONT(900, h * 0.55); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('RECOVERY · ALWAYS RISING', w / 2, h * 0.52); }, 1536, 180);
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.05), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false })); sm.position.set(0, 15.2, -14.7); scene.add(sm);
  const mt = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 8.2), mat(0x7a5fd0, { roughness: 0.9 })); mt.position.set(0, 0.08, 0); mt.castShadow = true; mt.receiveShadow = true; scene.add(mt);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 8.4), mat(0x4a2f86, { roughness: 0.9 })); edge.position.set(0, 0.05, 0); edge.receiveShadow = true; scene.add(edge);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 20), mat(0xe9e4f2)); roller.rotation.z = Math.PI / 2; roller.position.set(-6.5, 0.5, 2); roller.castShadow = true; scene.add(roller);
  const towel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.6), mat(0xe9b858)); towel.position.set(5.6, 0.1, 1.5); towel.rotation.y = 0.4; towel.castShadow = true; scene.add(towel);
  for (const [bx, bz, bc] of [[5.2, 3.6, 0xb7dff2], [6.1, 3.2, 0xe9b858]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.0, 12), mat(bc, { roughness: 0.3 })); b.position.set(bx, 0.5, bz); b.castShadow = true; scene.add(b); }
  return { mat: mt, key };
}

/* ------------------------------------------------------------------ film room */
export function buildFilmRoom(S) {
  const scene = S.scene; scene.background = new THREE.Color('#07060d'); scene.fog = new THREE.Fog('#07060d', 30, 90);
  scene.add(new THREE.HemisphereLight(0xd9d1f2, 0x271d17, 0.85));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x1a1328, { roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), mat(0x1c1430, { roughness: 0.95 })); wall.position.set(0, 15, -16); wall.receiveShadow = true; scene.add(wall);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), mat(0x181127, { roughness: 0.95 })); w.position.set(sx * 24, 15, 6); w.rotation.y = -sx * Math.PI / 2; scene.add(w); }
  // acoustic panels
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) box(S, 0.3, 5, 2.4, i % 2 ? 0x2a1d44 : 0x33224f, sx * 23.8, 6, -12 + i * 3.2, { cast: false });
  // screen with a bezel
  const SW = 29, SH = 16.3;
  box(S, SW + 0.9, SH + 0.9, 0.35, 0x050409, 0, 11, -15.6, { cast: false });
  // Warm architectural accents, screen surround and tiered seating.
  for(const sx of [-1,1]){
    for(let j=0;j<7;j++)box(S,.18,20,.35,0x70503d,sx*(16+j*.55),10,-15.3,{cast:false});
    box(S,.16,12,.2,0xf1c47b,sx*20.8,10,-15,{cast:false});
    const warm=new THREE.PointLight(0xffcf91,220,28);warm.position.set(sx*17,11,-8);scene.add(warm);
  }
  box(S,42,.22,3,0x3b2c28,0,.12,-11,{cast:false});
  for(const z of [2,7]){box(S,22,.28,3.8,0x25212d,0,.14,z,{cast:false});box(S,22,.05,.08,0xd3aa62,0,.31,z+1.9,{cast:false});}
  const q = { text: '', head: '', foot: '', state: 'idle' };
  const tex = textTexture(S, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#17182b'); g.addColorStop(1, '#172d41'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 3; x.strokeRect(w * 0.08, h * 0.2, w * 0.84, h * 0.7); x.beginPath(); x.arc(w * 0.5, h * 0.9, h * 0.34, Math.PI, 0); x.stroke(); x.strokeRect(w * 0.36, h * 0.62, w * 0.28, h * 0.28);
    x.fillStyle = '#e9c780'; x.font = FONT(900, h * 0.075); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(q.head, w * 0.045, h * 0.09);
    x.textAlign = 'right'; x.fillStyle = '#d8dcec'; x.fillText(q.foot, w * 0.955, h * 0.09);
    x.textAlign = 'center'; x.fillStyle = q.state === 'right' ? '#8bf0b0' : q.state === 'wrong' ? '#ffb0b0' : '#ffffff';
    let fs = h * 0.115, lines; for (; fs > 24; fs -= 4) { x.font = FONT(800, fs, false); lines = wrap(x, q.text, w * 0.8); if (lines.length * fs * 1.18 <= h * 0.58) break; }
    lines.forEach((l, i) => x.fillText(l, w / 2, h * 0.52 + (i - (lines.length - 1) / 2) * fs * 1.18));
    if (q.state !== 'idle') { x.fillStyle = q.state === 'right' ? 'rgba(80,220,140,.16)' : 'rgba(248,113,113,.16)'; x.fillRect(0, 0, w, h); }
    // scanlines
    // Crisp projection: no scanline mask over the question.
  }, 1280, 720);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.position.set(0, 11, -15.4); scene.add(screen);
  const glow = new THREE.PointLight(0xb8d4ff, 850, 60); glow.position.set(0, 9, -11); scene.add(glow);
  const glow2 = new THREE.PointLight(0xffc987, 100, 40); glow2.position.set(0, 3, 8); scene.add(glow2);
  // projector beam and dust
  const beam = new THREE.Mesh(new THREE.ConeGeometry(11, 30, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(0, 9.2, 0); beam.rotation.x = -Math.PI / 2; beam.position.z = -0.4; scene.add(beam); beam.scale.set(1, 1, 0.56);
  box(S, 1.6, 0.8, 2.2, 0x22202a, 0, 16, 12, { cast: false });
  const N = 45, dp = new Float32Array(N * 3), seed = new Float32Array(N); for (let i = 0; i < N; i++) { dp[i * 3] = (Math.random() - 0.5) * 20; dp[i * 3 + 1] = 2 + Math.random() * 12; dp[i * 3 + 2] = -14 + Math.random() * 28; seed[i] = Math.random() * 6.28; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xcfd9ff, size: 0.09, transparent: true, opacity: 0.18, depthWrite: false })); dust.frustumCulled = false; scene.add(dust);
  // chairs with players watching, seen from behind
  const crew = [];
  const rows = [[8.5, 4, 0], [3.2, 5, 1]];
  rows.forEach(([z, n, ri]) => {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 3.6 + (ri % 2 ? 0.5 : -0.3);
      box(S, 2.2, 0.35, 2.2, 0x302a38, x, 1.55, z, {}); box(S, 2.2, 2.6, 0.35, 0x302a38, x, 2.9, z + 1.0, {});
      if ((i + ri) % 4 === 1 && ri === 1) continue; // an empty seat
      const rig = makeRig(S, { jersey: i % 2 ? PURPLE : 0x562494, skin: SKINS[(i + ri) % 5], number: String((i * 3 + ri * 7) % 24), numberBg: '#6832ab', name: ['KANGS', 'LW', 'KANGS'][ri % 3], scale:2.1 });
      rig.place(x, z + 0.15, Math.PI); rig.blob.visible = false; rig.pose({ ...POSE.stand, y: 1.55, hip: [-1.4, -1.4], knee: [1.45, 1.45], sh: [-0.5, -0.5], sp: [0.3, 0.3], el: [-1.3, -1.3], lean: 0.05, head: 0 }); rig.seat = rig.inner.position.y; crew.push(rig);
    }
  });
  const coach = makeRig(S, { jersey: 0x2b1e47, skin: SKINS[2], number: 'C', numberBg: '#e9b858', numberFg: '#2a1450', name: 'COACH', hair: 0x8a8a92 });
  coach.place(-14.2, -12.2, 0.5); coach.pose({ ...POSE.stand, sh: [-1.5, -0.05], sp: [0.1, 0.1], el: [-0.25, -0.2] });
  const laser = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false })); laser.position.set(-4, 9.5, -15.3); scene.add(laser);
  let react = { t0: -10, kind: 'idle' };
  const calm = reducedMotion(); // no drifting dust, flicker, laser sweep, sway or celebrations
  return {
    setQuestion(text, head, foot, state = 'idle') { q.text = text; q.head = head; q.foot = foot; q.state = state; tex.userData.redraw(); },
    react(now, kind) { react = { t0: now, kind }; },
    update(now) {
      if (calm) return;
      const pos = dgeo.attributes.position.array; for (let i = 0; i < N; i++) { pos[i * 3 + 1] += Math.sin(now * 0.4 + seed[i]) * 0.0016; pos[i * 3] += Math.cos(now * 0.3 + seed[i]) * 0.0014; } dgeo.attributes.position.needsUpdate = true;
      screen.material.opacity = 1; screen.material.color.setScalar(1);
      laser.position.set(-4 + Math.sin(now * 0.7) * 3.4, 9.5 + Math.sin(now * 1.1) * 1.8, -15.3);
      coach.pose({ ...POSE.stand, sh: [-1.45 - 0.1 * Math.sin(now * 1.1), -0.05], sp: [0.14, 0.1], el: [-0.28, -0.2], lean: 0.02 });
      const tau = now - react.t0;
      crew.forEach((c, i) => {
        const base = { ...POSE.stand, y: 1.55, hip: [-1.4, -1.4], knee: [1.45, 1.45], sh: [-0.5, -0.5], sp: [0.3, 0.3], el: [-1.3, -1.3], lean: 0.05, head: 0 };
        if (react.kind === 'right' && tau < 1.3) { const k = Math.sin(Math.min(1, tau / 1.3) * Math.PI); base.sh = [-0.5 - 2.4 * k, -0.5 - 2.4 * k * (i % 2 ? 1 : 0.8)]; base.el = [-1.3 + 1.1 * k, -1.3 + 1.1 * k]; }
        c.pose(base);
        c.head.rotation.y = react.kind === 'wrong' && tau < 1.3 ? Math.sin(tau * 14) * 0.5 * (1 - tau / 1.3) : Math.sin(now * 0.3 + i) * 0.08;
        c.head.rotation.x = react.kind === 'right' && tau < 0.7 ? 0.25 * Math.sin(tau * 9) : 0.04;
      });
    },
  };
}

/* ------------------------------------------------------------------ the player rig */
export const SKINS = [0x9c6946, 0xe4b58b, 0x66432d, 0xb67e57, 0xd39871];
export function makeRig(S, { jersey = PURPLE, trim = 0xffffff, skin = SKINS[0], number = '2', numberBg = '#6832ab', numberFg = '#ffffff', name = 'KANGS', scale = 3, hair = 0x242025 } = {}) {
  const root = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(scale); root.add(inner);
  const jm = mat(jersey), sk = mat(skin), cap = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), m);
  const torso = new THREE.Group(); torso.position.y = 0.86; inner.add(torso);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.65, 10), jm); body.position.y = 0.32; torso.add(body);
  const head = new THREE.Group(); head.position.y = 0.92; torso.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 10), sk));
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.212, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair)); hairM.position.y = 0.035; head.add(hairM);
  const numTex = textTexture(S, (x, w, h) => { x.fillStyle = numberBg; x.fillRect(0, 0, w, h); x.fillStyle = numberFg; x.font = FONT(900, h * 0.8); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(number, w / 2, h * 0.55); }, 128, 128);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.68 })); num.position.set(0, 0.38, 0.272); torso.add(num);
  const nameTex = textTexture(S, (x, w, h) => { x.fillStyle = numberBg; x.fillRect(0, 0, w, h); x.fillStyle = numberFg; x.font = FONT(900, h * 0.7); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, w / 2, h * 0.55); }, 256, 128);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.22), new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.68 })); plate.position.set(0, 0.46, -0.272); plate.rotation.y = Math.PI; torso.add(plate);
  const hips = [], knees = [], shoulders = [], elbows = [], hands = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.15, 0.86, 0); inner.add(hip);
    const thigh = cap(0.105, 0.21, sk); thigh.position.y = -0.18; hip.add(thigh);
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.31), jm); shorts.position.y = -0.07; hip.add(shorts);
    const knee = new THREE.Group(); knee.position.y = -0.38; hip.add(knee);
    const shin = cap(0.085, 0.22, sk); shin.position.y = -0.16; knee.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.36), mat(trim)); shoe.position.set(0, -0.34, 0.07); knee.add(shoe);
    hips.push(hip); knees.push(knee);
    const sh = new THREE.Group(); sh.position.set(side * 0.3, 0.6, 0); torso.add(sh);
    const upper = cap(0.075, 0.18, sk); upper.position.y = -0.14; sh.add(upper);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    const fore = cap(0.065, 0.17, sk); fore.position.y = -0.12; el.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), sk); hand.position.y = -0.28; el.add(hand);
    shoulders.push(sh); elbows.push(el); hands.push(hand);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  S.scene.add(root);
  const shadow = blob(S, 2.6); shadow.position.y = 0.05; root.userData.blob = shadow;
  const rig = { root, inner, torso, head, hips, knees, shoulders, elbows, hands, scale, blob: shadow, base: new THREE.Vector3() };
  rig.place = (x, z, yaw) => { root.position.set(x, 0, z); root.rotation.y = yaw; shadow.position.set(x, 0.05, z); rig.base.set(x, 0, z); };
  rig.handMid = out => { const a = new THREE.Vector3(), b = new THREE.Vector3(); hands[0].getWorldPosition(a); hands[1].getWorldPosition(b); return out.copy(a).add(b).multiplyScalar(0.5); };
  rig.pose = p => { rig.last = p; applyPose(rig, p); };
  rig.pose(POSE.stand);
  // With the 3D athletes (Settings > Player models, Medium or High graphics) the figure becomes a rigged athlete in the same
  // kit, driven by the same poses. Until the models have loaded (or if they fail) the simple figure stays.
  let wantAthletes = false; try { wantAthletes = effectivePlayers(getA11y().players, S.level || 'high') === 'athletes'; } catch { /* settings unavailable */ }
  if (wantAthletes) {
    const up = () => { if (!S.dead && !rig.athlete) toAthlete(S, rig, { jersey, skin, number, numberBg, numberFg, name, scale }); };
    if (loadedAthletes()) up(); else loadAthletes().then(up).catch(() => { /* keep the simple figure */ });
  }
  return rig;
}

/* Swaps a rig's simple figure for a 3D athlete: same root, place(), pose() and hands, so the drill scenes are unchanged. */
function toAthlete(S, rig, { jersey, skin, number, numberBg, numberFg, name, scale }) {
  const T = loadedAthletes(); if (!T) return;
  const body = athleteBody(T.guard, { capMat: new THREE.MeshBasicMaterial({ color: GOLD }) }, Math.max(0, SKINS.indexOf(skin)), jersey, 'guard', lookFor(`${name}|${number}`));
  body.setLod?.(0); body.setLettering(String(number), name, numberBg, numberFg, jersey === PURPLE ? 'home' : null);
  body.root.traverse(o => { if (o.isMesh) { o.userData.sharedGeometry = !!o.isSkinnedMesh; o.castShadow = true; } });
  const H = (() => { const b = body.bones.head; body.root.updateMatrixWorld(true); return b.getWorldPosition(new THREE.Vector3()).y + 0.12; })();
  const inner = new THREE.Group(), s = scale * 1.98 / H; inner.scale.setScalar(s); inner.add(body.root);
  rig.root.remove(rig.inner); rig.root.add(inner);
  const b = body.bones, legs = ['R', 'L'].map(k => ({ hip: b['hip_' + k], knee: b['knee_' + k], thigh: b['knee_' + k].position.length(), shin: b['ankle_' + k].position.length() }));
  rig.inner = inner; rig.athlete = { body, b, legs, s };
  rig.hands = [b.wrist_R, b.wrist_L];
  rig.handMid = out => { const v = new THREE.Vector3(), e = new THREE.Vector3(), acc = new THREE.Vector3();
    for (const k of ['R', 'L']) { b['wrist_' + k].getWorldPosition(v); b['elbow_' + k].getWorldPosition(e); acc.add(v.clone().add(v.clone().sub(e).normalize().multiplyScalar(0.09 * s))); }
    return out.copy(acc).multiplyScalar(0.5); };
  if (rig.last) applyPose(rig, rig.last);
}
export const POSE = {
  stand: { y: 0, lean: 0, head: 0, hip: [0, 0], knee: [0, 0], sh: [-0.04, -0.04], sp: [0.06, 0.06], el: [-0.05, -0.05] },
  ready: { y: 0, lean: 0.07, head: -0.05, hip: [-0.3, -0.3], knee: [0.6, 0.6], sh: [-0.55, -0.55], sp: [0.42, 0.42], el: [-1.5, -1.5] },
  dip: { y: 0, lean: 0.22, head: -0.2, hip: [-0.78, -0.78], knee: [1.4, 1.4], sh: [-0.4, -0.4], sp: [0.42, 0.42], el: [-1.95, -1.95] },
  set: { y: 0.55, lean: 0.03, head: -0.1, hip: [-0.12, -0.12], knee: [0.3, 0.3], sh: [-2.5, -2.5], sp: [0.3, 0.3], el: [-1.35, -1.35] },
  release: { y: 0.9, lean: -0.03, head: -0.12, hip: [0.12, 0.05], knee: [0.15, 0.4], sh: [-2.95, -2.95], sp: [0.14, 0.14], el: [-0.12, -0.12] },
  follow: { y: 0.55, lean: -0.05, head: -0.1, hip: [0.2, 0.1], knee: [0.3, 0.6], sh: [-3.0, -3.0], sp: [0.1, 0.1], el: [0, 0] },
  stance: { y: 0, lean: 0.24, head: -0.25, hip: [-0.62, -0.5], knee: [1.15, 1.0], sh: [-0.8, -0.8], sp: [-0.55, -0.55], el: [-0.95, -0.95] },
  contest: { y: 0.6, lean: 0.06, head: -0.1, hip: [-0.18, -0.12], knee: [0.35, 0.3], sh: [-2.95, -2.9], sp: [-0.18, -0.25], el: [-0.05, -0.05] },
  catch: { y: 0, lean: 0.06, head: -0.05, hip: [-0.34, -0.3], knee: [0.65, 0.6], sh: [-1.3, -1.3], sp: [0.28, 0.28], el: [-0.7, -0.7] },
};
export function mixPose(a, b, k) {
  const m = (u, v) => Array.isArray(u) ? u.map((x, i) => lerp(x, v[i], k)) : lerp(u, v, k);
  const o = {}; for (const key of Object.keys(a)) o[key] = m(a[key], b[key]); return o;
}
export function applyPose(rig, p) {
  const A = rig.athlete;
  if (A) {   // the same pose on the athlete's bones (same joint conventions as the simple figure)
    const b = A.b; b.spine.rotation.x = p.lean * 0.6; b.chest.rotation.x = p.lean * 0.4; b.head.rotation.x = p.head ?? 0;
    let reach = 0;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, L = A.legs[i], k = i ? 'L' : 'R';
      L.hip.rotation.set(p.hip[i], 0, 0); L.knee.rotation.set(p.knee[i], 0, 0);
      b['shoulder_' + k].rotation.set(p.sh[i], 0, -side * p.sp[i]); b['elbow_' + k].rotation.set(p.el[i], 0, 0);
      reach = Math.max(reach, L.thigh * Math.cos(p.hip[i]) + L.shin * Math.cos(p.hip[i] + p.knee[i]));
    }
    rig.inner.position.y = (reach - (A.legs[0].thigh + A.legs[0].shin)) * A.s + p.y;
    return;
  }
  rig.torso.rotation.x = p.lean; rig.head.rotation.x = p.head ?? 0;
  let reach = 0;
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1; rig.hips[i].rotation.x = p.hip[i]; rig.knees[i].rotation.x = p.knee[i];
    rig.shoulders[i].rotation.set(p.sh[i], 0, -side * p.sp[i]); rig.elbows[i].rotation.x = p.el[i];
    reach = Math.max(reach, 0.38 * Math.cos(p.hip[i]) + 0.41 * Math.cos(p.hip[i] + p.knee[i]));
  }
  // bent knees shorten the legs: lower the figure by what the longer leg lost so a foot stays on the floor, then add the jump (feet)
  rig.inner.position.y = (reach - 0.79) * rig.scale + p.y;
}

/* ------------------------------------------------------------------ floor rings (constant-width, redrawn per frame) */
export function makeRing(S, color, opacity = 1) {
  const SEG = 72, pos = new Float32Array(SEG * 2 * 3 + 6), idx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2, b = i * 2 + 1, c = ((i + 1) % SEG) * 2, d = ((i + 1) % SEG) * 2 + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, SEG * 6), 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  m.renderOrder = 3; m.frustumCulled = false; S.scene.add(m);
  m.userData.set = (rIn, rOut) => { const p = geo.attributes.position.array; for (let i = 0; i < SEG; i++) { const a = i / SEG * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); p[i * 6] = c * rIn; p[i * 6 + 1] = 0.07; p[i * 6 + 2] = s * rIn; p[i * 6 + 3] = c * rOut; p[i * 6 + 4] = 0.07; p[i * 6 + 5] = s * rOut; } geo.attributes.position.needsUpdate = true; };
  return m;
}

/* ------------------------------------------------------------------ small helpers for controllers */
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export { THREE };
