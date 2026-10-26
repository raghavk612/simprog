// The four 3D practice drills. Each controller owns one stage (WebGL renderer), its listeners and its timeouts,
// and returns a cleanup function. mount3d() returns null when WebGL is unavailable so drills.js can use the 2D drill instead.
import {t, tu, list} from './i18n/index.js';
import {getA11y} from './settings.js';
import {play} from './audio.js';
import * as P from './shotphysics.js';
import * as TM from './drilltiming.js';
import {THREE, v3, createStage, abortStage, buildGym, buildStudio, buildFilmRoom, makeRig, makeBall, makeRing, blob, mixPose, POSE, SKINS, PURPLE, GOLD, CREAM, whenFonts, reducedMotion, clamp, lerp, smooth} from './drills3d.js';

const R2D = Math.PI / 180, RISE = 0.26;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export function mount3d(kit, root, spec, onDone) {
  // The GPU can take the context away mid-drill; the stage announces it and the caller swaps in the 2D drill.
  const lost = () => kit.onLost?.();
  root.addEventListener('d3lost', lost);
  let cleanup = null;
  try {
    if (spec.kind === 'three' || spec.kind === 'freethrow') cleanup = shot3d(kit, root, spec, onDone);
    else if (spec.kind === 'closeout') cleanup = closeout3d(kit, root, spec, onDone);
    else if (spec.kind === 'breathe') cleanup = breathe3d(kit, root, spec, onDone);
    else if (spec.kind === 'quiz') cleanup = quiz3d(kit, root, spec, onDone);
  } catch (err) { abortStage(); root.innerHTML = ''; console.warn('3D drill failed to start', err); }
  if (!cleanup) { root.removeEventListener('d3lost', lost); return null; }
  return () => { root.removeEventListener('d3lost', lost); cleanup(); };
}

/* ---------------------------------------------------------------- shared bits */
// Camera with a smooth tween between poses plus an additive offset for the gentle follow.
function cameraRig(S) {
  const pos = v3(), look = v3(), off = v3(), loff = v3(); let tw = null, ready = false;
  const apply = () => { S.camera.position.copy(pos).add(off); S.camera.lookAt(look.x + loff.x, look.y + loff.y, look.z + loff.z); };
  return {
    off, loff, pos, look,
    set(p, l) { pos.copy(p); look.copy(l); tw = null; ready = true; apply(); },
    to(p, l, dur, now) { if (!ready || dur <= 0 || reducedMotion()) { this.set(p, l); return; } tw = { t0: now, dur, fp: pos.clone(), fl: look.clone(), tp: p.clone(), tl: l.clone() }; },
    update(now) { if (tw) { const k = smooth((now - tw.t0) / tw.dur); pos.lerpVectors(tw.fp, tw.tp, k); look.lerpVectors(tw.fl, tw.tl, k); if (k >= 1) tw = null; } if (ready) apply(); },
    get busy() { return !!tw; },
  };
}
const dashTexture = S => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(4, 6, 8, 34);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return S.track(tex);
};
const flat = (S, w, h, color, opacity, tex) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color, transparent: true, opacity, map: tex || null, depthWrite: false, toneMapped: false}));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.renderOrder = 2; S.scene.add(m); return m;
};
const dot = (S, r, color) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false})); m.rotation.x = -Math.PI / 2; m.position.y = 0.045; m.renderOrder = 2; S.scene.add(m); return m; };
// A key aimed at some other control (the dialog's close button, a link) is never ours to take.
const foreign = e => !!e.target?.closest?.('button:not(.drill-go), a, input, select, textarea, summary');
const faceYaw = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// Press / click / tap / Space / Enter for the timing drills. Returns an unbind function.
function bindPress(root, S, fire) {
  const down = e => { if (e.button > 0) return; e.preventDefault(); fire('pointer'); };
  const key = e => {
    if (!root.isConnected || foreign(e)) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat && e.type === 'keydown') fire('key'); return; }
    if (e.key.toLowerCase?.() === 'h') e.stopPropagation();
  };
  S.canvas.style.touchAction = 'none'; S.canvas.addEventListener('pointerdown', down);
  window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
  return () => { S.canvas.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); };
}
const setHeader = (root, kit, spec, made, i, total, need) => { const h = root.querySelector('.drill-head'); if (h) h.outerHTML = kit.header(spec, made, i, total, need); };
const banner = (el, text, cls) => { el.textContent = text; el.className = `d3-banner show ${cls || ''}`; };
const hideBanner = el => { el.className = 'd3-banner'; };

// Ball flight for blocked and deflected shots: plain gravity with a floor bounce. Returns the same path shape as simulateShot.
function toss(start, vel, tmax = 1.6) {
  let {x, y, z} = start, {x: vx, y: vy, z: vz} = vel, tt = 0, floored = false; const path = [{x, y, z, t: 0}], dt = 1 / 120;
  while (tt < tmax) {
    vy -= P.G * dt; x += vx * dt; y += vy * dt; z += vz * dt; tt += dt;
    if (y < P.BALL_R) { y = P.BALL_R; if (Math.abs(vy) > 3) { vy = -vy * 0.45; vx *= 0.7; vz *= 0.7; floored = true; } else { vy = 0; vx *= 0.9; vz *= 0.9; } }
    path.push({x, y, z, t: tt});
  }
  return {path, flight: tt, floored};
}

/* ================================================================ shooting (three-point and free-throw) */
function shot3d(kit, root, spec, onDone) {
  const {header, bag, finish, shuffle} = kit, T = bag();
  const three = spec.kind === 'three', total = three ? 4 : 3, need = 2, assist = !!getA11y().timingAssist, reduced = reducedMotion();
  const sweet = assist ? P.SWEET_ASSIST : P.SWEET;
  root.innerHTML = `<div class="drill shot-drill d3-drill">${header(spec, 0, 0, total, need)}
   <div class="d3-stage" role="img" aria-label="${esc(t('drill.d3.canvasShot'))}"><div class="d3-hud" aria-hidden="true">
    <span class="d3-chip d3-spot"></span>
    <div class="d3-meter"><em>${esc(tu('drill.power'))}</em><div class="d3-track"><i class="d3-fill"></i><i class="d3-band-made"></i><i class="d3-band-swish"></i><b class="d3-cursor"></b></div></div>
    <div class="d3-arc"><b>55°</b><small>${esc(tu('drill.arc'))}</small></div><div class="d3-banner"></div></div></div>
   <div class="drill-controls d3-controls"><button class="primary drill-go" type="button">${esc(t('drill.shoot'))}</button><p class="d3-keys muted">${esc(t('drill.d3.keys'))}</p></div>
   <p class="drill-msg muted" aria-live="polite"></p><p class="sr-only d3-sr" aria-live="polite"></p></div>`;
  const $ = s => root.querySelector(s), stageEl = $('.d3-stage');
  const S = createStage(stageEl, {fov: 30, minAspect: 1.0}); if (!S) { root.innerHTML = ''; return null; }
  whenFonts(S);
  const gym = buildGym(S), cam = cameraRig(S);
  const shooter = makeRig(S, {number: '2', skin: SKINS[1]}), ball = makeBall(S); ball.rotation.order = 'YXZ';
  const ballBlob = blob(S, 1.1);
  // aim guide: a dotted arc (first 30% of the flight at the sweet-spot power) and a dashed line on the floor
  const guide = new THREE.Group(); S.scene.add(guide);
  const dotGeo = new THREE.SphereGeometry(0.1, 10, 8), dotMat = new THREE.MeshBasicMaterial({color: GOLD, toneMapped: false, transparent: true, opacity: 0.95});
  const dots = Array.from({length: 19}, (_, i) => { const m = new THREE.Mesh(dotGeo, dotMat); m.scale.setScalar(1.3 - i * 0.03); guide.add(m); return m; });
  const dashTex = dashTexture(S), floorLine = flat(S, 0.34, 1, GOLD, 0.55, dashTex); floorLine.visible = true;
  const ring = makeRing(S, GOLD, 0.95), ring2 = makeRing(S, 0xffffff, 0.35);
  const marks = new Map(); const pastDots = [];
  if (three) for (const sp of P.THREE_SPOTS) { const d = dot(S, 0.55, GOLD); d.material.opacity = 0.28; d.position.set(sp.x, 0.045, sp.z); marks.set(sp.id, d); }
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(), v3()]), new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.35})); trail.visible = false; trail.frustumCulled = false; S.scene.add(trail);
  const el = {spot: $('.d3-spot'), fill: $('.d3-fill'), cursor: $('.d3-cursor'), made: $('.d3-band-made'), swish: $('.d3-band-swish'), arc: $('.d3-arc'), arcB: $('.d3-arc b'), banner: $('.d3-banner'), msg: $('.drill-msg'), sr: $('.d3-sr'), btn: $('.drill-go'), meter: $('.d3-meter')};

  const queue = three ? shuffle(P.THREE_SPOTS).slice(0, total) : Array(total).fill(P.FT_SPOT);
  let shot = 0, made = 0, ended = false, disposed = false, phase = 'idle', spot = null, place = null, arc = 55, aim = 0, ideal = 50, result = null, riseT0 = 0, launchT = 0, chargeT0 = 0, chargeSrc = '', handAtRelease = v3(), evIdx = 0, afterT = 0, spin = 0, lastSr = 0;
  const hold = v3(), tmpV = v3(), guideEnd = v3();
  const aimEff = () => assist && Math.abs(aim) < 0.8 ? 0 : aim;
  const spotName = sp => `${t(`drill.d3.spots.${sp.id}`)} · ${t('drill.dist', {d: sp.dist.toFixed(1)})}`;

  const camPose = sp => {
    const p = P.placeShooter({spot: sp}), fx = -p.x / p.dist, fz = -p.z / p.dist, back = three ? 14.5 : 12.5, up = three ? 9.2 : 8.5;
    return {pos: v3(p.x - fx * back, up, p.z - fz * back), look: v3(p.x + fx * p.dist * 0.62, 5.4, p.z + fz * p.dist * 0.62), f: v3(fx, 0, fz)};
  };
  let camBase = null;
  function setSpot(sp, instant) {
    spot = sp; place = P.placeShooter({spot: sp}); shooter.place(place.x, place.z, place.faceYaw);
    const sign = Math.random() < 0.5 ? -1 : 1; aim = sign * (2 + Math.random() * 3.5);
    ideal = P.idealPower(place.dist, arc);
    camBase = camPose(sp); cam.to(camBase.pos, camBase.look, instant ? 0 : 1.0, S.now()); cam.off.set(0, 0, 0); cam.loff.set(0, 0, 0);
    ring.position.set(place.x, 0, place.z); ring2.position.set(place.x, 0, place.z);
    el.spot.textContent = spotName(sp); trail.visible = false;
    refreshGuide(); refreshMeterBands();
  }
  function refreshMeterBands() {
    const band = (node, half) => { const lo = clamp(ideal - half, 0, 100), hi = clamp(ideal + half, 0, 100); node.style.bottom = lo + '%'; node.style.height = (hi - lo) + '%'; };
    band(el.made, sweet.made); band(el.swish, sweet.swish);
  }
  function refreshGuide() {
    ideal = P.idealPower(place.dist, arc);
    const pts = P.guidePoints({spot, angle: arc, aim: aimEff(), power: ideal, steps: 18});
    pts.forEach((q, i) => dots[i].position.set(q[0], q[1], q[2])); guideEnd.set(...pts[pts.length - 1]);
    const yaw = place.faceYaw - aimEff() * R2D, len = place.dist + 6;
    floorLine.position.set(place.x + Math.sin(yaw) * len / 2, 0.05, place.z + Math.cos(yaw) * len / 2); floorLine.scale.set(1, len, 1); floorLine.rotation.z = yaw + Math.PI; floorLine.material.map.repeat.set(1, len / 3.2);
    el.arcB.textContent = Math.round(arc) + '°'; refreshMeterBands();
  }
  const announce = () => { const n = performance.now(); if (n - lastSr < 350) return; lastSr = n; const a = Math.abs(aim).toFixed(1); el.sr.textContent = t('drill.d3.srAim', {a, side: t(aim < -0.05 ? 'drill.d3.left' : aim > 0.05 ? 'drill.d3.right' : 'drill.d3.onLine'), arc: Math.round(arc)}); };

  /* ---- shooting animation ---- */
  const shotPose = (u, crouch) => {
    if (u < 0) return mixPose(POSE.ready, POSE.dip, crouch);
    const k = u / RISE;
    if (k < 1) return k < 0.62 ? mixPose(POSE.dip, POSE.set, smooth(k / 0.62)) : mixPose(POSE.set, POSE.release, smooth((k - 0.62) / 0.38));
    const v = u - RISE;
    return v < 0.5 ? mixPose(POSE.release, POSE.follow, smooth(v / 0.5)) : mixPose(POSE.follow, POSE.ready, smooth((v - 0.5) / 0.45));
  };
  function beginCharge(src) {
    if (phase !== 'idle' || ended || disposed) return; phase = 'charge'; chargeT0 = S.now(); chargeSrc = src; el.btn.textContent = t('drill.release'); el.meter.classList.add('live'); hideBanner(el.banner);
  }
  function cancelCharge() { if (phase !== 'charge') return; phase = 'idle'; el.btn.textContent = t('drill.shoot'); el.meter.classList.remove('live'); el.fill.style.height = '0%'; el.cursor.style.bottom = '0%'; }
  function releaseShot() {
    if (phase !== 'charge') return; const held = S.now() - chargeT0;
    if (held < 0.14) { cancelCharge(); el.msg.textContent = t('drill.d3.holdMore'); return; }
    const meter = P.meterAt(held), power = P.effectivePower(meter, ideal, assist);
    result = P.simulateShot({spot, angle: arc, aim: aimEff(), power}); phase = 'rise'; riseT0 = S.now(); evIdx = 0;
    el.btn.disabled = true; el.btn.textContent = t('drill.shoot'); el.meter.classList.remove('live'); guide.visible = false; floorLine.visible = false; ring.visible = false; ring2.visible = false;
  }
  function launch(now) {
    phase = 'flight'; launchT = now; spin = 0; trail.visible = false;
    const yaw = place.faceYaw - aimEff() * R2D; ball.rotation.y = yaw;
    play('select');
  }
  function resolve(now) {
    phase = 'after'; afterT = now; shot++; if (result.made) made++;
    const r = result;
    const text = r.made ? t(r.reason === 'bank' ? 'drill.d3.bank' : r.reason === 'rattle' ? 'drill.d3.rattle' : 'drill.swish')
      : r.air && r.reason === 'short' ? t('drill.shortAir')
      : r.reason === 'short' ? t('drill.shortBy', {n: r.miss}) : r.reason === 'long' ? t('drill.longBy', {n: r.miss}) : r.reason === 'left' ? t('drill.d3.leftBy', {n: r.miss}) : t('drill.d3.rightBy', {n: r.miss});
    const mk = marks.get(spot.id) || dot(S, 0.55, GOLD); if (!marks.has(spot.id)) marks.set(spot.id, mk);
    if (three) { mk.material.color.set(r.made ? 0x4ade80 : 0xf87171); mk.material.opacity = 0.8; mk.scale.setScalar(1.3); }
    else { const d = dot(S, 0.5, r.made ? 0x4ade80 : 0xf87171); d.material.opacity = 0.9; d.position.set(place.x + (shot - 2) * 1.6, 0.046, place.z + 2.4); pastDots.push(d); }
    const pts = r.path.filter((_, i) => i % 6 === 0).map(q => v3(q.x, q.y, q.z)); trail.geometry.dispose(); trail.geometry = new THREE.BufferGeometry().setFromPoints(pts); trail.visible = true;
    banner(el.banner, r.made ? (r.reason === 'swish' ? t('drill.swish') : text) : text, r.made ? 'ok' : 'bad'); el.sr.textContent = text;
    setHeader(root, kit, spec, made, shot, total, need);
    const done = shot >= total || total - shot + made < need;
    if (done) { ended = true; el.msg.textContent = text; T.later(() => { if (!disposed) finish(root, spec, made, total, need, onDone); }, 1300); return; }
    const nextSp = queue[shot];
    el.msg.textContent = `${text} ${t('drill.nextSpot', {d: nextSp.dist.toFixed(1)})}`;
    T.later(() => { if (disposed) return; setSpot(nextSp); phase = 'idle'; hideBanner(el.banner); guide.visible = true; floorLine.visible = true; ring.visible = true; ring2.visible = true; el.btn.disabled = false; announce(); }, 1250);
  }

  /* ---- per-frame ---- */
  S.ticks.push((now, dt) => {
    gym.update(now);
    const pulse = reduced ? 1 : 1 + 0.08 * Math.sin(now * 5);
    ring.userData.set(0.95 * pulse, 1.3 * pulse); ring2.userData.set(1.7, 1.8 + (reduced ? 0 : 0.1 * Math.sin(now * 3)));
    // meter
    if (phase === 'charge') {
      const held = now - chargeT0, m = P.meterAt(held); el.fill.style.height = m + '%'; el.cursor.style.bottom = m + '%';
    }
    // shooter + ball
    let pose;
    if (phase === 'idle') pose = mixPose(POSE.ready, POSE.dip, 0.12 + (reduced ? 0 : 0.1 * Math.sin(now * 2.2) ** 2));
    else if (phase === 'charge') pose = shotPose(-1, smooth((now - chargeT0) / 0.5));
    else if (phase === 'rise') pose = shotPose(now - riseT0, 1);
    else pose = shotPose(now - launchT + RISE, 1);
    shooter.pose(pose);
    if (phase === 'idle' || phase === 'charge' || phase === 'rise') {
      shooter.root.updateMatrixWorld(true); shooter.handMid(hold);
      ball.position.copy(hold); ball.position.y += 0.03; ball.rotation.x = 0; ball.rotation.y = place.faceYaw;
      if (phase === 'rise' && now - riseT0 >= RISE) { handAtRelease.copy(hold); launch(now); }
      ballBlob.position.set(ball.position.x, 0.05, ball.position.z); ballBlob.scale.setScalar(1.2 - clamp(ball.position.y / 12, 0, 0.6)); ballBlob.visible = !S.profile.shadows;
    }
    if (phase === 'flight' || phase === 'after') {
      const el0 = now - launchT, ps = result.path;
      if (phase === 'flight') {
        const q = P.sampleAt(ps, el0), b = smooth(el0 / 0.09);
        ball.position.set(lerp(handAtRelease.x, q.x, b), lerp(handAtRelease.y, q.y, b), lerp(handAtRelease.z, q.z, b));
        spin += dt * 9; ball.rotation.x = -spin;
        while (evIdx < result.events.length && result.events[evIdx].t <= el0) {
          const e = result.events[evIdx++];
          if (e.type === 'rim') { play('rim'); gym.rattle(now, clamp(e.speed / 9, 0.3, 1)); }
          else if (e.type === 'board') { play('rim'); gym.rattle(now, 0.35); }
          else if (e.type === 'net') { play(three ? 'three' : 'swish'); gym.net.kick(now, result.reason === 'swish' ? 1 : 0.7, [Math.sin(place.faceYaw), Math.cos(place.faceYaw)]); }
        }
        ballBlob.position.set(ball.position.x, 0.05, ball.position.z); ballBlob.scale.setScalar(1.2 - clamp(ball.position.y / 12, 0, 0.6)); ballBlob.visible = !S.profile.shadows && ball.position.y < 30;
        // gentle follow: the camera drifts toward the basket and the view leans onto the ball
        if (!reduced) { const k = smooth(el0 / 0.9); cam.off.copy(camBase.f).multiplyScalar(k * 3.2); cam.off.y = -k * 0.5; cam.loff.set((ball.position.x - camBase.look.x) * 0.12 * k, (ball.position.y - camBase.look.y) * 0.1 * k, 0); }
        if (el0 >= result.flight) resolve(now);
      } else {
        const q = P.sampleAt(ps, Math.min(el0, result.flight)); ball.position.set(q.x, q.y, q.z);
      }
    }
    // arc readout rides next to the end of the guide
    if (phase === 'idle' || phase === 'charge') {
      const q = S.project(guideEnd); el.arc.style.transform = `translate(${clamp(q.x + 12, 8, S.size.w - 74)}px, ${clamp(q.y - 30, 42, S.size.h - 54)}px)`; el.arc.style.opacity = '1';
      dots.forEach((d, i) => { d.visible = true; });
    } else el.arc.style.opacity = '0';
    cam.update(now);
  });

  /* ---- input: drag to aim, hold to charge, release to shoot; keys; tap-tap button ---- */
  const KX = 0.045, KY = 0.1; let drag = null;
  const adjust = (dAim, dArc) => { aim = clamp(aim + dAim, -P.AIM_MAX, P.AIM_MAX); arc = clamp(arc + dArc, P.ARC_MIN, P.ARC_MAX); refreshGuide(); };
  S.canvas.style.touchAction = 'none';
  const pdown = e => {
    if (e.button > 0 || phase !== 'idle' || ended) return; e.preventDefault(); try { S.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, aim, arc}; beginCharge('pointer');
  };
  const pmove = e => { if (!drag || e.pointerId !== drag.id || (phase !== 'charge')) return; aim = clamp(drag.aim + (e.clientX - drag.x) * KX, -P.AIM_MAX, P.AIM_MAX); arc = clamp(drag.arc - (e.clientY - drag.y) * KY, P.ARC_MIN, P.ARC_MAX); refreshGuide(); };
  const pup = e => { if (!drag || e.pointerId !== drag.id) return; drag = null; releaseShot(); };
  const pcancel = e => { if (!drag || e.pointerId !== drag.id) return; drag = null; cancelCharge(); };
  let lastKey = 0;
  const key = e => {
    if (!root.isConnected || disposed || foreign(e)) return; const k = e.key;
    if (k === ' ') { e.preventDefault(); e.stopPropagation(); lastKey = performance.now(); if (e.type === 'keydown') { if (!e.repeat) beginCharge('key'); } else if (chargeSrc === 'key') releaseShot(); return; }
    if (k.toLowerCase?.() === 'h') { e.stopPropagation(); return; }
    if (e.type !== 'keydown' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return;
    e.preventDefault(); e.stopPropagation(); if (phase !== 'idle' && phase !== 'charge') return;
    const big = e.shiftKey ? 4 : 1;
    if (k === 'ArrowLeft') adjust(-0.25 * big, 0); else if (k === 'ArrowRight') adjust(0.25 * big, 0); else if (k === 'ArrowUp') adjust(0, 1 * (e.shiftKey ? 3 : 1)); else adjust(0, -1 * (e.shiftKey ? 3 : 1));
    announce();
  };
  const onBlur = () => { if (phase === 'charge') { drag = null; cancelCharge(); } };
  // The button works without holding anything: press once to start charging, press again to release.
  el.btn.addEventListener('click', e => {
    if (e.detail === 0 && performance.now() - lastKey < 400) return;
    if (phase === 'idle') { chargeSrc = 'button'; beginCharge('button'); } else if (phase === 'charge') releaseShot();
  });

  setSpot(queue[0], true); cam.set(camBase.pos, camBase.look);
  el.msg.textContent = t(three ? 'drill.d3.spot' : 'drill.d3.line', {d: place.dist.toFixed(1)}); announce();
  // Global listeners go in last, so a scene that fails to start cannot leave any behind.
  S.canvas.addEventListener('pointerdown', pdown); S.canvas.addEventListener('pointermove', pmove); S.canvas.addEventListener('pointerup', pup); S.canvas.addEventListener('pointercancel', pcancel);
  window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true); window.addEventListener('blur', onBlur);
  // The dialog opens with focus on its close button; hand it to the drill so Space and Enter act on the drill, and Shift+Tab still reaches the close button.
  el.btn.focus({preventScroll: true});
  return () => {
    if (disposed) return; disposed = true; T.clear();
    S.canvas.removeEventListener('pointerdown', pdown); S.canvas.removeEventListener('pointermove', pmove); S.canvas.removeEventListener('pointerup', pup); S.canvas.removeEventListener('pointercancel', pcancel);
    window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); window.removeEventListener('blur', onBlur); S.dispose();
  };
}

/* ================================================================ close-out timing */
function closeout3d(kit, root, spec, onDone) {
  const {header, bag, finish, shuffle} = kit, T = bag();
  const total = 3, need = 2, assist = !!getA11y().timingAssist, reduced = reducedMotion();
  root.innerHTML = `<div class="drill timing-drill d3-drill">${header(spec, 0, 0, total, need)}
   <div class="d3-stage" role="img" aria-label="${esc(t('drill.d3.canvasCloseout'))}"><div class="d3-hud" aria-hidden="true"><span class="d3-chip d3-round"></span><div class="d3-banner"></div></div></div>
   <div class="drill-controls d3-controls"><button class="primary drill-go" type="button">${esc(t('drill.closeOut'))}</button><p class="d3-keys muted">${esc(t('drill.d3.coKeys'))}</p></div>
   <p class="drill-msg muted" aria-live="polite">${esc(t('drill.d3.coHelp'))}</p></div>`;
  const $ = s => root.querySelector(s), S = createStage($('.d3-stage'), {fov: 40, minAspect: 1.0}); if (!S) { root.innerHTML = ''; return null; }
  whenFonts(S);
  const gym = buildGym(S), cam = cameraRig(S);
  const shooter = makeRig(S, {jersey: CREAM, trim: 0xffffff, skin: SKINS[3], number: '24', numberBg: '#f1e9df', numberFg: '#562494', name: 'VISITORS'});
  const defender = makeRig(S, {number: '3', skin: SKINS[0]}), ball = makeBall(S), ballBlob = blob(S, 1.1);
  const ringMove = makeRing(S, 0xffffff, 0.95), ringBand = makeRing(S, 0x4ade80, 0.55), ringEdge = makeRing(S, 0x4ade80, 0.95);
  const el = {chip: $('.d3-round'), banner: $('.d3-banner'), msg: $('.drill-msg'), btn: $('.drill-go')};
  const ids = shuffle(['top', 'slotL', 'slotR', 'wingL', 'wingR']).slice(0, total);
  let round = -1, made = 0, ended = false, disposed = false, st = null;
  const RT = 2.6; // ring target radius (ft)

  function startRound(r) {
    round = r; const sp = P.THREE_SPOTS.find(s => s.id === ids[r]), p = P.placeShooter({spot: sp}), rd = TM.closeoutRound(r, assist);
    const f = v3(-p.x / p.dist, 0, -p.z / p.dist), lat = v3(-f.z, 0, f.x), side = p.x >= 0 ? -1 : 1;
    const S0 = v3(p.x, 0, p.z), D0 = S0.clone().addScaledVector(f, 10).addScaledVector(lat, side * 2.6), toS = S0.clone().sub(D0).setY(0).normalize();
    const Dc = S0.clone().addScaledVector(toS, -2.5).addScaledVector(lat, side * -0.2);
    const camPos = D0.clone().addScaledVector(toS, -8.5).addScaledVector(lat, side * -3.4).setY(7.9), camLook = S0.clone().addScaledVector(f, 1.5).setY(3.9);
    const resPos = S0.clone().addScaledVector(lat, side * -17).addScaledVector(f, -2).setY(8.6), resLook = S0.clone().addScaledVector(f, 9).setY(6.8);
    const intro = r === 0 ? 0.9 : 1.2;
    st = {rd, sp, p, f, lat, side, S0, D0, Dc, toS, camPos, camLook, resPos, resLook, t0: S.now() + intro, TR: rd.release, press: null, verdict: null, launched: false, res: null, kind: 'made', over: false, phase: 'play', settleAt: 0, passFrom: S0.clone().addScaledVector(lat, -side * 9).addScaledVector(f, -3).setY(4.6), evIdx: 0, swung: false, resultAt: 0};
    shooter.place(p.x, p.z, p.faceYaw); defender.place(D0.x, D0.z, faceYaw(D0, S0)); shooter.pose(POSE.catch); defender.pose(POSE.stance);
    cam.to(camPos, camLook, r === 0 ? 0 : 1.0, S.now()); cam.off.set(0, 0, 0); cam.loff.set(0, 0, 0);
    el.chip.textContent = t('drill.d3.round', {n: r + 1, total}); hideBanner(el.banner);
    el.msg.textContent = t('drill.d3.coHelp'); el.btn.disabled = false;
    // the ring shrinks toward the green band; the band's width is the timing window
    const vRing = (7.4 - RT) / rd.approach; st.vRing = vRing; ringBand.userData.set(Math.max(0.2, RT - vRing * rd.half), RT + vRing * rd.half);
    ringEdge.userData.set(RT + vRing * rd.half - 0.03, RT + vRing * rd.half + 0.05);
    for (const rg of [ringMove, ringBand, ringEdge]) { rg.position.set(p.x, 0, p.z); rg.visible = true; }
    ball.position.copy(st.passFrom); ball.visible = true;
  }
  function press() {
    if (!st || ended || disposed || st.press !== null || st.phase !== 'play') return; const now = S.now(), rt = now - st.t0;
    if (rt < 0.1) return; // still setting up
    st.press = rt; st.verdict = rt < st.rd.catchT ? 'early' : TM.judge(rt, st.rd.ideal, st.rd.half); st.pressAbs = now;
    if (st.verdict === 'early') st.TR = Math.max(st.rd.catchT + 0.85, rt + st.rd.arrive + 0.75);
    play(st.verdict === 'hit' ? 'steal' : 'uiClick');
  }
  function launchShot(now) {
    st.launched = true; const sp = st.sp, v = st.verdict, ideal = P.idealPower(sp.dist, 55);
    if (v === 'hit') {
      if (round % 2 === 0) { // blocked at the release point
        const start = {x: st.p.x + Math.sin(st.p.faceYaw) * P.LEAD, y: 7, z: st.p.z + Math.cos(st.p.faceYaw) * P.LEAD}, out = st.lat.clone().multiplyScalar(-st.side * 13).addScaledVector(st.f, -6);
        const a = toss(start, {x: st.f.x * 5, y: 12, z: st.f.z * 5}, 0.1), last = a.path.at(-1);
        const b = toss({x: last.x, y: last.y, z: last.z}, {x: out.x, y: 2, z: out.z}, 1.7); st.res = {path: a.path.concat(b.path.map(q => ({...q, t: q.t + 0.1}))), flight: 1.8, events: [{type: 'block', t: 0.1}], made: false}; st.kind = 'block';
      } else { // short and off the iron
        let r = null; for (const d of [-9, -11, -14, -17]) { r = P.simulateShot({spot: sp, angle: 55, aim: 0.8, power: ideal + d}); if (!r.made) break; }
        st.res = r; st.kind = 'miss';
      }
    } else { st.res = P.simulateShot({spot: sp, angle: 55, aim: 0, power: ideal}); st.kind = 'made'; }
    st.launchT = now; st.ballFrom = ball.position.clone(); play('select');
  }
  function finishRound(now) {
    st.phase = 'result'; const v = st.verdict || 'late', hit = v === 'hit'; if (hit) made++;
    setHeader(root, kit, spec, made, round + 1, total, need);
    const text = hit ? t('drill.handUp') : v === 'early' ? t('drill.d3.coEarly') : t('drill.d3.coLate');
    banner(el.banner, text, hit ? 'ok' : 'bad'); el.msg.textContent = text; el.btn.disabled = true;
    play(hit ? 'confirm' : 'error');
    ringMove.visible = ringBand.visible = ringEdge.visible = false;
    const done = round + 1 >= total || total - (round + 1) + made < need;
    if (done) { ended = true; T.later(() => { if (!disposed) finish(root, spec, made, total, need, onDone); }, 1400); }
    else T.later(() => { if (!disposed) startRound(round + 1); }, 1600);
  }

  const tmp = v3(), handPos = v3();
  S.ticks.push((now, dt) => {
    gym.update(now); if (!st) return;
    const rt = now - st.t0, rd = st.rd;
    // ring: shrinks toward the green band, which is the shooter's release window
    const live = st.phase === 'play' && rt >= 0 && rt < st.TR + 0.9;
    ringBand.visible = ringEdge.visible = live;
    if (live && st.press === null) { const r = RT + st.vRing * (rd.ideal - rt); ringMove.visible = rt >= rd.catchT * 0.5 && r < 8.2; ringMove.userData.set(Math.max(0, r - 0.13), r + 0.13); ringMove.material.color.set(0xffffff); }
    else if (live) { ringMove.visible = true; ringMove.userData.set(RT - 0.13, RT + 0.13); ringMove.material.color.set(st.verdict === 'hit' ? 0x4ade80 : 0xf87171); }
    else ringMove.visible = false;
    // auto-late if nobody pressed
    if (st.phase === 'play' && st.press === null && rt > st.TR + 0.55) { st.verdict = 'late'; }
    // shooter pose and ball
    const u = rt - (st.TR - RISE);
    let sp;
    if (rt < rd.catchT) sp = POSE.catch;
    else if (u < -0.4) sp = mixPose(POSE.catch, POSE.ready, smooth((rt - rd.catchT) / 0.25));
    else if (u < 0) sp = mixPose(POSE.ready, POSE.dip, smooth((u + 0.4) / 0.4));
    else { const k = u / RISE; sp = k < 1 ? (k < 0.62 ? mixPose(POSE.dip, POSE.set, smooth(k / 0.62)) : mixPose(POSE.set, POSE.release, smooth((k - 0.62) / 0.38))) : (u - RISE < 0.5 ? mixPose(POSE.release, POSE.follow, smooth((u - RISE) / 0.5)) : mixPose(POSE.follow, POSE.ready, smooth((u - RISE - 0.5) / 0.45))); }
    if (rt >= rd.catchT && u < -0.4) { const b = reduced ? 0 : 0.06 * Math.sin(now * 5); sp = {...sp, y: sp.y + b}; }
    // early press: the shooter reads the closing defender and pump-fakes until he is past
    shooter.pose(sp);
    if (!st.launched && rt >= st.TR - 0.0 && st.phase === 'play') { shooter.root.updateMatrixWorld(true); shooter.handMid(handPos); ball.position.copy(handPos); launchShot(now); }
    if (!st.launched) {
      if (rt < 0) ball.position.copy(st.passFrom);
      else if (rt < rd.catchT) { shooter.root.updateMatrixWorld(true); shooter.handMid(handPos); const k = smooth(rt / rd.catchT); tmp.lerpVectors(st.passFrom, handPos, k); tmp.y += Math.sin(k * Math.PI) * 1.4; ball.position.copy(tmp); ball.rotation.x += dt * 8; }
      else { shooter.root.updateMatrixWorld(true); shooter.handMid(handPos); ball.position.copy(handPos); ball.position.y += 0.03; }
    } else {
      const el0 = now - st.launchT, res = st.res, q = P.sampleAt(res.path, Math.min(el0, res.flight)), b = smooth(el0 / 0.08);
      ball.position.set(lerp(st.ballFrom.x, q.x, b), lerp(st.ballFrom.y, q.y, b), lerp(st.ballFrom.z, q.z, b)); ball.rotation.x -= dt * 9;
      while (st.evIdx < res.events.length && res.events[st.evIdx].t <= el0) {
        const e = res.events[st.evIdx++];
        if (e.type === 'rim') { play('rim'); gym.rattle(now, 0.8); } else if (e.type === 'board') play('rim'); else if (e.type === 'block') play('block');
        else if (e.type === 'net') { play('three'); gym.net.kick(now, 1, [-st.f.x, -st.f.z]); }
      }
      if (st.kind === 'miss' && el0 > 0.1 && !st.shortPlayed) { st.shortPlayed = true; }
      if (st.phase === 'play' && (el0 >= Math.min(res.flight, 1.9) || (st.kind === 'made' && el0 > 1.5))) { st.phase = 'settle'; finishRound(now); }
    }
    ballBlob.position.set(ball.position.x, 0.05, ball.position.z); ballBlob.scale.setScalar(1.2 - clamp(ball.position.y / 12, 0, 0.6)); ballBlob.visible = !S.profile.shadows && ball.position.y < 30;
    // defender
    let dp, dpos = st.D0, dyaw = faceYaw(st.D0, st.S0);
    if (st.press === null) { dp = mixPose(POSE.stance, POSE.stance, 0); const sw = reduced ? 0 : Math.sin(now * 5); dp = {...dp, y: reduced ? 0 : 0.05 * Math.sin(now * 6)}; dp.sh = [dp.sh[0] + 0.1 * sw, dp.sh[1] - 0.1 * sw]; }
    else {
      const tr = now - st.pressAbs, A = rd.arrive, run = Math.min(1, tr / A), toward = st.verdict === 'early' ? st.S0.clone().addScaledVector(st.lat, st.side * 2.0) : st.Dc;
      if (st.verdict === 'early') {
        const v0 = toward.distanceTo(st.D0) / A * 0.9, dir = toward.clone().sub(st.D0).setY(0).normalize();
        const travelled = tr < A ? toward.distanceTo(st.D0) * smooth(tr / A) * 0.98 : toward.distanceTo(st.D0) * 0.98 + (v0 / 4.5) * (1 - Math.exp(-4.5 * (tr - A)));
        dpos = st.D0.clone().addScaledVector(dir, travelled); dyaw = faceYaw(st.D0, toward);
        const lean = tr > A ? 0.3 + 0.35 * Math.min(1, (tr - A) * 2) : 0.28;
        dp = tr < A ? runPose(tr * 13) : {...mixPose(POSE.stance, POSE.contest, 0.3), lean, hip: [-0.5, 0.2], knee: [0.9, 0.3], y: 0}; if (tr >= A) dp.sh = [-1.2, -0.6];
      } else {
        dpos = st.D0.clone().lerp(st.Dc, smooth(run)); dyaw = faceYaw(st.D0, st.S0);
        dp = tr < A * 0.82 ? runPose(tr * 13) : mixPose(runPose(tr * 13), POSE.contest, smooth((tr - A * 0.82) / (A * 0.3)));
        if (tr >= A * 1.12) dp = mixPose(POSE.contest, POSE.stance, smooth((tr - A * 1.12 - 0.6) / 0.5));
      }
    }
    defender.place(dpos.x, dpos.z, dyaw); defender.pose(dp);
    // camera: behind the defender, swinging to a side view as the shot goes up
    if (!st.swung && rt > st.TR - 0.12) { st.swung = true; if (reduced) cam.set(st.resPos, st.resLook); else cam.to(st.resPos, st.resLook, 1.1, now); }
    cam.update(now);
  });
  function runPose(ph) {
    const s = Math.sin(ph), c = Math.cos(ph);
    return {y: 0.1 * Math.abs(c), lean: 0.3, head: -0.3, hip: [-0.9 * s, 0.9 * s], knee: [Math.max(0, 1.3 * c), Math.max(0, -1.3 * c)], sh: [-0.4 + 0.9 * s, -0.4 - 0.9 * s], sp: [0.05, 0.05], el: [-1.3, -1.3]};
  }
  el.btn.addEventListener('click', e => { if (e.detail === 0) return; press(); });
  startRound(0); cam.set(st.camPos, st.camLook);
  const unpress = bindPress(root, S, press);
  // The dialog opens with focus on its close button; hand it to the drill so Space and Enter act on the drill, and Shift+Tab still reaches the close button.
  el.btn.focus({preventScroll: true});
  return () => { if (disposed) return; disposed = true; T.clear(); unpress(); S.dispose(); };
}

/* ================================================================ recovery rhythm */
function breathe3d(kit, root, spec, onDone) {
  const {header, bag, finish} = kit, T = bag();
  const total = 3, need = 2, assist = !!getA11y().timingAssist, reduced = reducedMotion();
  root.innerHTML = `<div class="drill timing-drill d3-drill">${header(spec, 0, 0, total, need)}
   <div class="d3-stage" role="img" aria-label="${esc(t('drill.d3.canvasBreathe'))}"><div class="d3-hud" aria-hidden="true"><span class="d3-chip d3-round"></span><div class="d3-cue"></div><div class="d3-banner"></div></div></div>
   <div class="drill-controls d3-controls"><button class="primary drill-go" type="button">${esc(t('drill.release'))}</button><p class="d3-keys muted">${esc(t('drill.d3.brKeys'))}</p></div>
   <p class="drill-msg muted" aria-live="polite">${esc(t('drill.d3.brHelp'))}</p></div>`;
  const $ = s => root.querySelector(s), S = createStage($('.d3-stage'), {fov: 36}); if (!S) { root.innerHTML = ''; return null; }
  whenFonts(S);
  const studio = buildStudio(S), cam = cameraRig(S);
  const body = makeRig(S, {jersey: 0x8d7bb0, trim: 0xffffff, skin: SKINS[4], number: '7', numberBg: '#8d7bb0', numberFg: '#ffffff', name: 'KANGS', scale: 2.9}); body.place(0, 0.4, 0.55); body.blob.visible = false;
  const ringMove = makeRing(S, 0xcdbbff, 0.9), ringBand = makeRing(S, 0x4ade80, 0.5), ringEdge = makeRing(S, 0x4ade80, 0.95), ringGlow = makeRing(S, 0xb48aff, 0.16);
  const el = {chip: $('.d3-round'), cue: $('.d3-cue'), banner: $('.d3-banner'), msg: $('.drill-msg'), btn: $('.drill-go')};
  for (const rg of [ringMove, ringBand, ringEdge, ringGlow]) rg.position.set(0, 0.08, 0.4);
  cam.set(v3(7.5, 6.2, 13.5), v3(0, 3.0, 0));
  let round = -1, made = 0, ended = false, disposed = false, st = null;
  const R0 = 2.7, R1 = 5.8; // ring radius when exhaled / inhaled

  function startRound(r) {
    round = r; const rd = TM.breatheRound(r, assist);
    st = {rd, t0: S.now() + 0.6, press: null, verdict: null, phase: 'play', lastCue: ''};
    const radius = tt => R0 + (R1 - R0) * TM.breath(tt - rd.lead, rd.period);
    st.radius = radius; const rLo = radius(rd.ideal + rd.half), rHi = radius(rd.ideal - rd.half);
    ringBand.userData.set(Math.min(rLo, rHi), Math.max(rLo, rHi)); ringEdge.userData.set(Math.min(rLo, rHi) - 0.04, Math.min(rLo, rHi) + 0.03);
    el.chip.textContent = t('drill.d3.round', {n: r + 1, total}); hideBanner(el.banner); el.msg.textContent = t('drill.d3.brHelp'); el.btn.disabled = false;
    for (const rg of [ringMove, ringBand, ringEdge, ringGlow]) rg.visible = true;
  }
  function conclude(now, verdict) {
    if (st.phase !== 'play') return; st.phase = 'result'; st.verdict = verdict; const hit = verdict === 'hit'; if (hit) made++;
    setHeader(root, kit, spec, made, round + 1, total, need);
    const text = hit ? t('drill.smooth') : verdict === 'early' ? t('drill.early') : t('drill.late');
    banner(el.banner, text, hit ? 'ok' : 'bad'); el.msg.textContent = text; el.btn.disabled = true; el.cue.textContent = ''; play(hit ? 'confirm' : 'error');
    ringMove.material.color.set(hit ? 0x4ade80 : 0xf87171);
    const done = round + 1 >= total || total - (round + 1) + made < need;
    if (done) { ended = true; T.later(() => { if (!disposed) finish(root, spec, made, total, need, onDone); }, 1300); }
    else T.later(() => { if (!disposed) { ringMove.material.color.set(0xcdbbff); startRound(round + 1); } }, 1500);
  }
  function press() {
    if (!st || ended || disposed || st.phase !== 'play') return; const now = S.now(), rt = now - st.t0; if (rt < 0.15) return;
    st.press = rt; conclude(now, TM.judge(rt, st.rd.ideal, st.rd.half));
  }
  // stretch: exhaled = deep forward fold, inhaled = reach overhead
  const fold = {y: 0, lean: 1.3, head: -0.5, hip: [0, 0], knee: [0.3, 0.3], sh: [-1.3, -1.3], sp: [0.05, 0.05], el: [-0.05, -0.05]};
  const reach = {y: 0.25, lean: -0.14, head: 0.1, hip: [0.05, 0.05], knee: [0, 0], sh: [-3.05, -3.05], sp: [-0.28, -0.28], el: [-0.12, -0.12]};
  S.ticks.push((now, dt) => {
    if (!st) return; const rt = Math.max(0, now - st.t0), rd = st.rd;
    if (st.phase === 'play' && rt > rd.ideal + rd.half + 0.02 && st.press === null) conclude(now, 'late');
    const b = TM.breath(rt - rd.lead, rd.period), bb = rt < rd.lead ? 0 : b;
    body.pose(mixPose(fold, reach, smooth(bb)));
    const r = st.radius(rt); ringMove.userData.set(r - 0.1, r + 0.1);
    ringGlow.userData.set(r - 0.6, r + 0.3);
    const inhale = (rt - rd.lead) % rd.period < rd.period / 2, cue = rt < rd.lead ? '' : inhale ? t('drill.d3.breatheIn') : t('drill.d3.breatheOut');
    if (st.phase === 'play' && cue !== st.lastCue) { st.lastCue = cue; el.cue.textContent = cue; el.cue.classList.toggle('out', !inhale); }
    if (!reduced) { cam.off.set(Math.sin(now * 0.25) * 0.25, 0, 0); }
    cam.update(now);
  });
  el.btn.addEventListener('click', e => { if (e.detail === 0) return; press(); });
  startRound(0);
  const unpress = bindPress(root, S, press);
  // The dialog opens with focus on its close button; hand it to the drill so Space and Enter act on the drill, and Shift+Tab still reaches the close button.
  el.btn.focus({preventScroll: true});
  return () => { if (disposed) return; disposed = true; T.clear(); unpress(); S.dispose(); };
}

/* ================================================================ film & rules quiz */
function quiz3d(kit, root, spec, onDone) {
  const {header, bag, finish, shuffle} = kit, T = bag();
  const total = 3, need = 2, qs = shuffle(list('drill.quiz')).slice(0, total).map(([q, ...opts]) => ({q, order: shuffle(opts.map((o, i) => [o, i === 0]))}));
  root.innerHTML = `<div class="drill quiz-drill d3-drill">${header(spec, 0, 0, total, need)}
   <div class="d3-stage d3-film" role="img" aria-label="${esc(t('drill.d3.canvasFilm'))}"><div class="d3-hud" aria-hidden="true"></div></div>
   <div class="quiz-ui"></div></div>`;
  const $ = s => root.querySelector(s), S = createStage($('.d3-stage'), {fov: 32}); if (!S) { root.innerHTML = ''; return null; }
  whenFonts(S);
  const room = buildFilmRoom(S); S.camera.position.set(0, 9.6, 20); S.camera.lookAt(0, 7.6, -15);
  let i = 0, made = 0, ended = false, disposed = false, locked = false;
  const ui = $('.quiz-ui');
  const show = (msg, state = 'idle') => {
    const cur = qs[i];
    if (cur) room.setQuestion(cur.q, t('drill.d3.filmHead'), `${Math.min(i + 1, total)} / ${total}`, state);
    ui.innerHTML = `${cur ? `<p class="quiz-q sr-only">${esc(cur.q)}</p><div class="quiz-opts">${cur.order.map(([o], k) => `<button type="button" class="secondary" data-k="${k}"><kbd class="key">${k + 1}</kbd>${esc(o)}</button>`).join('')}</div>` : ''}<p class="drill-msg muted" aria-live="polite">${esc(msg || t('drill.quizPick'))}</p>`;
    ui.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
  };
  function answer(k) {
    if (ended || locked || disposed) return; const cur = qs[i], right = cur.order[k][1], correct = cur.order.find(o => o[1])[0];
    if (right) made++; locked = true;
    const msg = right ? t('drill.quizRight') : t('drill.quizWrong', {a: correct});
    room.react(S.now(), right ? 'right' : 'wrong'); play(right ? 'confirm' : 'error');
    setHeader(root, kit, spec, made, i + 1, total, need);
    room.setQuestion(cur.q, t('drill.d3.filmHead'), `${i + 1} / ${total}`, right ? 'right' : 'wrong');
    ui.querySelectorAll('[data-k]').forEach(b => { b.disabled = true; if (+b.dataset.k === k) b.classList.add(right ? 'good' : 'bad'); if (cur.order[+b.dataset.k][1]) b.classList.add('good'); });
    ui.querySelector('.drill-msg').textContent = msg;
    i++;
    if (i >= total || total - i + made < need) { ended = true; T.later(() => { if (!disposed) finish(root, spec, made, total, need, onDone); }, 1300); return; }
    T.later(() => { if (disposed) return; locked = false; show(msg); }, 1050);
  }
  const key = e => { if (!root.isConnected || disposed) return; if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); if (e.type === 'keydown' && !e.repeat) answer(+e.key - 1); } else if (!foreign(e) && (e.key.toLowerCase?.() === 'h' || e.key === ' ')) e.stopPropagation(); };
  S.ticks.push(now => room.update(now));
  show();
  window.addEventListener('keydown', key, true);
  return () => { if (disposed) return; disposed = true; T.clear(); window.removeEventListener('keydown', key, true); S.dispose(); };
}
