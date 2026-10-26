// Skill drills that unlock practice sessions. Pure DOM + canvas; no game state is touched here.
// mountDrill(root, kind, onDone) -> cleanup()   onDone({passed, perfect, made, total})

import {t,tu,list} from './i18n/index.js';
import {getA11y} from './settings.js';
import {play} from './audio.js';
import {mount3d} from './drillscenes.js';

// Names, instructions and quiz questions live in the language files (drill.*); only the mechanics are described here.
export const DRILLS = {
  shooting: { kind: 'three' },
  bond: { kind: 'freethrow' },
  defense: { kind: 'closeout' },
  recovery: { kind: 'breathe' },
  study: { kind: 'quiz' },
};
export const drillName = key => t(`drill.${key}.name`);

// Pending timeouts are cancelled with the drill, so closing the dialog early leaves nothing running.
const bag = () => { const ids = new Set(); return { later: (fn, ms) => { const id = setTimeout(() => { ids.delete(id); fn(); }, ms); ids.add(id); }, clear: () => { ids.forEach(clearTimeout); ids.clear(); } }; };
const shuffle = (a, r = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Every drill is played in 3D (drillscenes.js). If WebGL is not available the original 2D drills below take over,
// so a practice session can always be completed.
export function mountDrill(root, key, onDone) {
  const spec = DRILLS[key] && { ...DRILLS[key], key }; if (!spec) throw Error('Unknown drill');
  let cleanup3d = null;
  try { cleanup3d = mount3d({ header, bag, finish, shuffle }, root, spec, onDone); } catch (err) { console.warn('3D drill unavailable, using the 2D drill', err); root.innerHTML = ''; }
  if (cleanup3d) return cleanup3d;
  if (spec.kind === 'three' || spec.kind === 'freethrow') return shotDrill(root, spec, onDone);
  if (spec.kind === 'quiz') return quizDrill(root, spec, onDone);
  return timingDrill(root, spec, onDone);
}

function header(spec, made, i, total, need) {
  return `<div class="drill-head"><div><span class="eyebrow">${tu('drill.skillCheck')}</span><h3>${t(`drill.${spec.key}.name`)}</h3><p>${t(`drill.${spec.key}.how`)}</p></div><div class="drill-score" aria-live="polite"><b>${made}</b><span>${t('drill.madeNeed', { n: need })}</span><div class="drill-pips">${Array.from({ length: total }, (_, k) => `<i class="${k < i ? 'done' : ''}"></i>`).join('')}</div></div></div>`;
}
function finish(root, spec, made, total, need, onDone) {
  const passed = made >= need, perfect = made === total;
  onDone({ passed, perfect, made, total });
}

/* ---------- shooting: side-view projectile with angle + power ---------- */
function shotDrill(root, spec, onDone) {
  const T = bag();
  const three = spec.kind === 'three', total = three ? 4 : 3, need = 2;
  const G = 32.2, REL_H = 7, RIM_H = 10, RIM_R = 0.75, BALL_R = 0.39;
  let shot = 0, made = 0, angle = three ? 50 : 52, power = 50, flying = false, raf = 0, dist = 0, trail = [], last = null, ended = false;
  const spot = () => { dist = three ? +(20.8 + Math.random() * 3.2).toFixed(1) : 15; };
  spot();
  root.innerHTML = `<div class="drill shot-drill">${header(spec, 0, 0, total, need)}<canvas class="drill-canvas" width="900" height="420" role="img" aria-label="${t('drill.canvasAria')}"></canvas>
   <div class="drill-controls"><label>${tu('drill.arc')} <b class="v-angle">${angle}°</b><input type="range" class="r-angle" min="35" max="68" step="1" value="${angle}" aria-label="${t('drill.arcAria')}"></label>
   <label>${tu('drill.power')} <b class="v-power">${power}%</b><input type="range" class="r-power" min="0" max="100" step="1" value="${power}" aria-label="${t('drill.powerAria')}"></label>
   <button class="primary drill-go" type="button">${t('drill.shoot')}</button></div><p class="drill-msg muted" aria-live="polite">${t(three ? 'drill.spot' : 'drill.line', { d: dist })}</p></div>`;
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), $ = s => root.querySelector(s);
  const W = cv.width, H = cv.height, ground = H - 46, scale = Math.min((W - 120) / 27, (ground - 30) / 14), x0 = 70;
  const X = ft => x0 + ft * scale, Y = ft => ground - ft * scale;
  const speed = p => 17 + p / 100 * 21; // ft/s

  function draw(ball) {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1c1230'); g.addColorStop(1, '#0d0915'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // floor + markings
    ctx.fillStyle = '#c9965e'; ctx.fillRect(0, ground, W, H - ground); ctx.fillStyle = '#b5824d'; for (let i = 0; i < W; i += 60) ctx.fillRect(i, ground, 2, H - ground);
    ctx.fillStyle = '#6832ab'; ctx.fillRect(X(dist - 19), ground, X(dist) - X(dist - 19) + 30, 6);
    ctx.font = '700 15px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#ffffffaa'; ctx.textAlign = 'center';
    ctx.fillText(t('drill.dist', { d: dist }), X(dist / 2), ground + 30);
    ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(X(0), ground + 14); ctx.lineTo(X(dist), ground + 14); ctx.stroke(); ctx.setLineDash([]);
    // hoop: pole, board, rim, net
    const bx = X(dist + 1.25);
    ctx.fillStyle = '#3a3448'; ctx.fillRect(bx + 26, Y(13), 9, ground - Y(13)); ctx.fillRect(bx, Y(12.2), 30, 6);
    ctx.fillStyle = '#e8e4f0'; ctx.fillRect(bx - 4, Y(13.5), 6, Y(9.5) - Y(13.5));
    ctx.strokeStyle = '#ff7a24'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(X(dist - RIM_R), Y(RIM_H)); ctx.lineTo(bx - 3, Y(RIM_H)); ctx.stroke();
    ctx.strokeStyle = '#ffffffb0'; ctx.lineWidth = 1.5; for (let k = 0; k <= 4; k++) { const t = k / 4, xa = X(dist - RIM_R + t * RIM_R * 2); ctx.beginPath(); ctx.moveTo(xa, Y(RIM_H)); ctx.lineTo(X(dist - RIM_R * .6 + t * RIM_R * 1.2), Y(RIM_H - 1.4)); ctx.stroke(); }
    // shooter
    const sx = X(0), sy = ground;
    ctx.fillStyle = '#6832ab'; ctx.fillRect(sx - 12, sy - 82, 24, 40); ctx.fillStyle = '#ffffff'; ctx.font = '800 16px "Barlow Condensed", sans-serif'; ctx.fillText('K', sx, sy - 56);
    ctx.fillStyle = '#8a5634'; ctx.beginPath(); ctx.arc(sx, sy - 96, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a5634'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - 6, sy - 42); ctx.lineTo(sx - 9, sy - 4); ctx.moveTo(sx + 6, sy - 42); ctx.lineTo(sx + 9, sy - 4); ctx.stroke();
    const a = angle * Math.PI / 180; ctx.beginPath(); ctx.moveTo(sx + 4, sy - 74); ctx.lineTo(sx + 4 + Math.cos(a) * 30, sy - 74 - Math.sin(a) * 30); ctx.stroke();
    // aim indicator (direction only) + power bar
    if (!flying) { ctx.strokeStyle = '#e9b858'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(X(0), Y(REL_H)); ctx.lineTo(X(0) + Math.cos(a) * 110, Y(REL_H) - Math.sin(a) * 110); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = '#ffffff18'; ctx.fillRect(16, ground - 150, 12, 140); ctx.fillStyle = '#b48aff'; ctx.fillRect(16, ground - 10 - 140 * power / 100, 12, 140 * power / 100);
    // trails
    for (const [pts, col] of [[last?.trail || [], '#ffffff30'], [trail, '#e9b85899']]) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py))); ctx.stroke(); }
    // ball
    const b = ball || { x: 0.35, y: REL_H };
    ctx.fillStyle = '#e9832a'; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), BALL_R * scale, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2316'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), BALL_R * scale, 0, 7); ctx.moveTo(X(b.x) - BALL_R * scale, Y(b.y)); ctx.lineTo(X(b.x) + BALL_R * scale, Y(b.y)); ctx.stroke();
  }

  function simulate() {
    const a = angle * Math.PI / 180, v = speed(power); let x = 0.35, y = REL_H, vx = Math.cos(a) * v, vy = Math.sin(a) * v, t = 0, scored = false, crossedX = null;
    const path = [], dt = 1 / 240, board = dist + 1.25, rims = [dist - RIM_R, dist + RIM_R];
    while (t < 5) {
      const py = y; vy -= G * dt; x += vx * dt; y += vy * dt; t += dt;
      // backboard (face at x = board - .05), spans 9.5..13.5 ft
      if (x + BALL_R > board - .05 && x < board + .2 && y > 9.5 && y < 13.5 && vx > 0) { x = board - .05 - BALL_R; vx *= -.55; vy *= .85; }
      // rim edges as points
      for (const rx of rims) { const dx = x - rx, dy = y - RIM_H, d = Math.hypot(dx, dy); if (d < BALL_R && d > 0) { const nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny; if (dot < 0) { vx -= 1.6 * dot * nx; vy -= 1.6 * dot * ny; vx *= .8; vy *= .8; } x = rx + nx * BALL_R; y = RIM_H + ny * BALL_R; } }
      // through the hoop: center crosses rim height going down between the rim edges
      if (!scored && py >= RIM_H && y < RIM_H && vy < 0) { if (x > rims[0] + BALL_R * .55 && x < rims[1] - BALL_R * .55) { scored = true; vx *= .25; } else if (crossedX === null) crossedX = x; }
      path.push({ x, y, t });
      if (y < BALL_R) { if (Math.abs(vy) > 4 && t < 4) { y = BALL_R; vy = -vy * .5; vx *= .7; } else break; }
      if (x > dist + 6 || x < -3) break;
    }
    return { path, scored, crossedX };
  }

  function shoot() {
    if (flying || ended) return; flying = true; $('.drill-go').disabled = true;
    const res = simulate(); let k = 0; trail = []; const start = performance.now();
    const step = now => {
      const elapsed = (now - start) / 1000 * 1.15; while (k < res.path.length - 1 && res.path[k].t < elapsed) { k++; if (k % 3 === 0) trail.push([res.path[k].x, res.path[k].y]); }
      draw(res.path[k]);
      if (k < res.path.length - 1) { raf = requestAnimationFrame(step); return; }
      shot++; if (res.scored) made++;
      const miss = res.crossedX === null ? t(res.path.reduce((m, p) => Math.max(m, p.y), 0) < RIM_H ? 'drill.shortAir' : 'drill.offRim') : res.crossedX < dist ? t('drill.shortBy', { n: (dist - res.crossedX).toFixed(1) }) : t('drill.longBy', { n: (res.crossedX - dist).toFixed(1) });
      play(res.scored ? (three ? 'three' : 'swish') : 'rim');
      last = { trail }; flying = false;
      root.querySelector('.drill-head').outerHTML = header(spec, made, shot, total, need);
      if (shot >= total) { ended = true; $('.drill-msg').textContent = res.scored ? t('drill.swish') : miss; T.later(() => finish(root, spec, made, total, need, onDone), 700); return; }
      if (total - shot + made < need) { ended = true; $('.drill-msg').textContent = miss; T.later(() => finish(root, spec, made, total, need, onDone), 700); return; }
      spot(); $('.drill-msg').textContent = `${res.scored ? t('drill.swish') : miss} ${t('drill.nextSpot', { d: dist })}`; $('.drill-go').disabled = false; draw();
    };
    raf = requestAnimationFrame(step);
  }

  const sync = () => { $('.v-angle').textContent = angle + '°'; $('.v-power').textContent = power + '%'; $('.r-angle').value = angle; $('.r-power').value = power; if (!flying) draw(); };
  $('.r-angle').addEventListener('input', e => { angle = +e.target.value; sync(); });
  $('.r-power').addEventListener('input', e => { power = +e.target.value; sync(); });
  $('.drill-go').addEventListener('click', shoot);
  const key = e => {
    if (!root.isConnected) return; const k = e.key;
    if (k === ' ') { e.preventDefault(); e.stopPropagation(); shoot(); return; }
    if (k.toLowerCase() === 'h') { e.stopPropagation(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k) || e.target.closest?.('input[type=range]')) return;
    if (k === 'ArrowLeft') angle = Math.max(35, angle - 1); else if (k === 'ArrowRight') angle = Math.min(68, angle + 1);
    else if (k === 'ArrowUp') power = Math.min(100, power + 1); else power = Math.max(0, power - 1);
    e.preventDefault(); e.stopPropagation(); sync();
  };
  window.addEventListener('keydown', key, true);
  draw();
  return () => { T.clear(); cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); };
}

/* ---------- timing: stop the marker in the window ---------- */
function timingDrill(root, spec, onDone) {
  const T = bag();
  const close = spec.kind === 'closeout', total = 3, need = 2, assist = getA11y().timingAssist,
    widths = (close ? [.17, .13, .1] : [.24, .2, .16]).map(w => assist ? Math.min(.4, w * 1.6) : w), speeds = (close ? [.9, 1.15, 1.4] : [.55, .7, .85]).map(v => assist ? v * .6 : v);
  let round = 0, made = 0, pos = 0, dir = 1, zone = 0, raf = 0, last = performance.now(), locked = false, ended = false;
  const newZone = () => { zone = .12 + Math.random() * (.76 - widths[round]); };
  newZone();
  root.innerHTML = `<div class="drill timing-drill">${header(spec, 0, 0, total, need)}<div class="timing-bar" role="img" aria-label="${t('drill.barAria')}"><i class="timing-zone"></i><i class="timing-mark"></i></div><div class="drill-controls"><button class="primary drill-go" type="button">${t(close ? 'drill.closeOut' : 'drill.release')}</button></div><p class="drill-msg muted" aria-live="polite">${t('drill.timingHelp')}</p></div>`;
  const $ = s => root.querySelector(s);
  const paint = () => { $('.timing-zone').style.left = zone * 100 + '%'; $('.timing-zone').style.width = widths[round] * 100 + '%'; $('.timing-mark').style.left = pos * 100 + '%'; };
  const tick = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; if (!locked) { pos += dir * speeds[round] * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } } paint(); raf = requestAnimationFrame(tick); };
  const lock = () => {
    if (locked || ended) return; locked = true; const hit = pos >= zone && pos <= zone + widths[round]; if (hit) made++; round++;
    root.querySelector('.drill-head').outerHTML = header(spec, made, round, total, need);
    $('.timing-bar').classList.toggle('hit', hit); $('.timing-bar').classList.toggle('miss', !hit);
    $('.drill-msg').textContent = hit ? t(close ? 'drill.handUp' : 'drill.smooth') : t(pos < zone ? 'drill.early' : 'drill.late');
    play(hit ? 'confirm' : 'error');
    if (round >= total || total - round + made < need) { ended = true; T.later(() => finish(root, spec, made, total, need, onDone), 800); return; }
    T.later(() => { locked = false; newZone(); $('.timing-bar').classList.remove('hit', 'miss'); }, 750);
  };
  $('.drill-go').addEventListener('click', lock);
  const key = e => { if (!root.isConnected) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); lock(); } else if (e.key.toLowerCase() === 'h') e.stopPropagation(); };
  window.addEventListener('keydown', key, true);
  raf = requestAnimationFrame(tick);
  return () => { T.clear(); cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); };
}

/* ---------- quiz ---------- */
function quizDrill(root, spec, onDone) {
  const T = bag();
  const total = 3, need = 2, qs = shuffle(list('drill.quiz')).slice(0, total).map(([q, ...opts]) => { const order = shuffle(opts.map((o, i) => [o, i === 0])); return { q, order }; });
  let i = 0, made = 0, ended = false;
  const render = msg => {
    const cur = qs[i];
    root.innerHTML = `<div class="drill quiz-drill">${header(spec, made, i, total, need)}${cur ? `<p class="quiz-q">${cur.q}</p><div class="quiz-opts">${cur.order.map(([o], k) => `<button type="button" class="secondary" data-k="${k}"><kbd class="key">${k + 1}</kbd>${o}</button>`).join('')}</div>` : ''}<p class="drill-msg muted" aria-live="polite">${msg || t('drill.quizPick')}</p></div>`;
    root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
  };
  const answer = k => {
    if (ended) return; const right = qs[i].order[k][1]; if (right) made++; const correct = qs[i].order.find(o => o[1])[0]; i++;
    const msg = right ? t('drill.quizRight') : t('drill.quizWrong', { a: correct });
    play(right ? 'confirm' : 'error');
    if (i >= total || total - i + made < need) { ended = true; render(msg); T.later(() => finish(root, spec, made, total, need, onDone), 900); return; }
    render(msg);
  };
  const key = e => { if (!root.isConnected) return; if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); answer(+e.key - 1); } else if (e.key.toLowerCase() === 'h' || e.key === ' ') e.stopPropagation(); };
  window.addEventListener('keydown', key, true);
  render();
  return () => { T.clear(); window.removeEventListener('keydown', key, true); };
}
