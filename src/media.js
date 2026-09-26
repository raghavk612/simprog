/* =========================================================================
   AUDIO (Web Audio API, all sounds synthesized, no audio files)
   GRAPHICS (SVG crests & icons, 7-segment scoreboard, Canvas court)
   ========================================================================= */
'use strict';

const SFX = {
  ctx: null, on: true, vol: .6, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
  },
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
  ok() { return this.on && this.ctx && this.ctx.state !== 'closed'; },
  env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  tone(f, dur, type = 'sine', peak = .25, slideTo = null, delay = 0) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this.env(g, t, .01, dur, peak); o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + .05);
  },
  noise(dur, freq, q = 1, peak = .3, type = 'bandpass', attack = .01, delay = 0) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + delay; const len = Math.floor(c.sampleRate * (dur + attack + .05));
    const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
    this.env(g, t, attack, dur, peak); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur + attack + .05);
  },
  click() { this.tone(880, .05, 'triangle', .12); },
  swish() { this.noise(.18, 3800, 1.2, .35, 'bandpass', .02); },
  rim() { this.tone(210, .12, 'triangle', .22, 150); this.noise(.06, 1200, 2, .12); },
  whistle() { if (!this.ok()) return; const c = this.ctx, t = c.currentTime; const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 140; l.connect(lg).connect(o.frequency); this.env(g, t, .02, .35, .18); o.connect(g).connect(this.master); o.start(t); l.start(t); o.stop(t + .45); l.stop(t + .45); },
  buzzer() { this.tone(196, .9, 'square', .12); this.tone(147, .9, 'sawtooth', .06); },
  cheer(big) { this.noise(big ? 1.6 : .9, 900, .6, big ? .32 : .18, 'lowpass', .25); },
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, .14, 'triangle', .16, null, i * .08)); },
  bad() { this.tone(392, .18, 'triangle', .14, 330); this.tone(294, .26, 'triangle', .12, 247, .14); },
  fanfare() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, .22, 'square', .07, null, i * .12)); this.cheer(true); },
};

/* ---------- Color helpers (WCAG contrast) ---------- */
function lum(hex) { const c = hex.replace('#', ''); const v = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function inkOn(hex) { return contrast(hex, '#FFFFFF') >= contrast(hex, '#111418') ? '#FFFFFF' : '#111418'; }

/* ---------- Icons (original, drawn on a 24 grid) ---------- */
const ICON = {
  hawks: '<path d="M2 7l10 5 10-5-2.5 6.5L12 17l-7.5-3.5z"/><path d="M12 12l-2-5h4z"/>',
  wolves: '<ellipse cx="12" cy="16" rx="5" ry="4.2"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="9.5" cy="6.2" r="2.2"/><circle cx="14.5" cy="6.2" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/>',
  bolts: '<path d="M13.5 1.5L4 14h6.5L9 22.5 20 9h-6.8z"/>',
  flames: '<path d="M12 1.8c1.2 4.2 6.8 6.4 6.8 12.2a6.8 6.8 0 0 1-13.6 0c0-3.2 2-5.3 3.2-6.4.1 2.3 1.2 3.6 2.4 3.6-.3-3.9-.6-6.3 1.2-9.4z"/>',
  knights: '<path d="M12 1.8l8.5 3.2v6.2c0 5.3-3.7 9.4-8.5 11-4.8-1.6-8.5-5.7-8.5-11V5z"/>',
  comets: '<path d="M15.5 3.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.6-3.7-2.7-2.6 3.8-.5z"/><path d="M10.5 11.5L2.5 19.5M11.5 14.5l-5 6M8 10l-5.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  book: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="var(--bgc,#fff)"/>',
  megaphone: '<path d="M3 10v4h3l8 5V5L6 10zM17 8.5a5 5 0 0 1 0 7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6" fill="none" stroke="var(--bgc,#fff)" stroke-width="2"/>',
  alert: '<path d="M12 2L1.5 21h21z"/><rect x="11" y="9" width="2" height="6" fill="var(--bgc,#fff)"/><rect x="11" y="16.5" width="2" height="2" fill="var(--bgc,#fff)"/>',
  star: '<path d="M12 2l3 6.3 6.9.9-5 4.8 1.3 6.9L12 17.6 5.8 20.9l1.3-6.9-5-4.8 6.9-.9z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><rect x="3" y="5" width="18" height="5" /><rect x="7" y="2" width="2" height="5"/><rect x="15" y="2" width="2" height="5"/>',
  user: '<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z"/>',
  bus: '<rect x="3" y="3" width="18" height="15" rx="3"/><rect x="5" y="6" width="14" height="5" fill="var(--bgc,#fff)"/><circle cx="7.5" cy="20" r="2"/><circle cx="16.5" cy="20" r="2"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4" fill="none" stroke="currentColor" stroke-width="2"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H3a4 4 0 0 0 4 5M17 5h4a4 4 0 0 1-4 5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="11" y="12" width="2" height="5"/><rect x="7" y="18" width="10" height="3" rx="1"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2v20M5 5c3 3 3 11 0 14M19 5c-3 3-3 11 0 14" fill="none" stroke="var(--bgc,#000)" stroke-width="1.4" opacity=".55"/>',
  gear: '<path d="M10.3 2h3.4l.5 2.6 2 .9 2.2-1.5 2.4 2.4-1.5 2.2.9 2 2.6.5v3.4l-2.6.5-.9 2 1.5 2.2-2.4 2.4-2.2-1.5-2 .9-.5 2.6h-3.4l-.5-2.6-2-.9-2.2 1.5-2.4-2.4 1.5-2.2-.9-2L2 13.7v-3.4l2.6-.5.9-2L4 5.6 6.4 3.2l2.2 1.5 2-.9z"/><circle cx="12" cy="12" r="3.2" fill="var(--bgc,#fff)"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.2 9.2a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1.1-1.4 2.2" fill="none" stroke="var(--bgc,#fff)" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.3" fill="var(--bgc,#fff)"/>',
  sound: '<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  mute: '<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
};
function icon(name, cls = 'ico', label) { return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"'}>${ICON[name] || ''}</svg>`; }
const DRILL_ICON = { shooting: 'ball', defense: 'knights', scrimmage: 'bolts', conditioning: 'flames', film: 'mic', bonding: 'star', rest: 'home', study: 'book', fundraiser: 'money' };

function initials(name) { const w = name.trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase(); }
function crest(name, iconKey, c1, c2, label) {
  const ink1 = inkOn(c1); const ic = contrast(c2, c1) > 1.8 ? c2 : ink1; const id = 'g' + Math.floor(Math.random() * 1e8);
  return `<svg class="crest" viewBox="0 0 100 100" ${label ? `role="img" aria-label="${U.esc(label)} crest"` : 'aria-hidden="true"'}>
    <defs><clipPath id="${id}"><path d="M50 4l40 13v28c0 25-17 42-40 51C27 87 10 70 10 45V17z"/></clipPath></defs>
    <path d="M50 4l40 13v28c0 25-17 42-40 51C27 87 10 70 10 45V17z" fill="${c1}"/>
    <g clip-path="url(#${id})"><rect x="0" y="0" width="100" height="16" fill="${c2}" opacity=".9"/><rect x="0" y="16" width="100" height="3" fill="${ink1}" opacity=".25"/></g>
    <path d="M50 4l40 13v28c0 25-17 42-40 51C27 87 10 70 10 45V17z" fill="none" stroke="${c2}" stroke-width="4"/>
    <g transform="translate(29 22) scale(1.75)" fill="${ic}" style="color:${ic}">${ICON[iconKey] || ICON.knights}</g>
    <text x="50" y="80" text-anchor="middle" font-family="Graduate, Rockwell, Georgia, serif" font-size="15" fill="${ink1}" letter-spacing="1">${U.esc(initials(name))}</text>
  </svg>`;
}
function pennant(label, won, c1, c2, sub) {
  const fill = won ? c1 : 'rgba(255,255,255,.06)'; const stroke = won ? c2 : 'rgba(255,255,255,.35)'; const ink = won ? inkOn(c1) : 'rgba(255,255,255,.55)';
  return `<div class="pennant"><svg viewBox="0 0 80 110" role="img" aria-label="${U.esc(label)} banner${won ? ', won' : ', not yet won'}">
    <line x1="40" y1="0" x2="40" y2="8" stroke="#6B7785" stroke-width="2"/>
    <path d="M6 8h68v74L40 104 6 82z" fill="${fill}" stroke="${stroke}" stroke-width="3" ${won ? '' : 'stroke-dasharray="5 4"'}/>
    ${won ? `<path d="M6 20h68" stroke="${stroke}" stroke-width="4"/>` : ''}
    <text x="40" y="52" text-anchor="middle" font-family="Graduate, Rockwell, serif" font-size="13" fill="${ink}">${U.esc(sub || '')}</text>
    ${won ? `<g transform="translate(29 62) scale(.92)" fill="${stroke}">${ICON.trophy}</g>` : `<g transform="translate(31 62) scale(.75)" fill="${ink}">${ICON.lock}</g>`}
  </svg><div class="pl">${U.esc(label)}</div></div>`;
}

/* ---------- 7-segment scoreboard digits ---------- */
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
function seg7(str, h = 44, color = 'var(--led)') {
  const w = h * .56; const t = h * .12; const chars = String(str).split(''); const gap = h * .14;
  const paths = { a: [t * .6, 0, w - t * 1.2, t], b: [w - t, t * .6, t, h / 2 - t * .9], c: [w - t, h / 2 + t * .3, t, h / 2 - t * .9], d: [t * .6, h - t, w - t * 1.2, t], e: [0, h / 2 + t * .3, t, h / 2 - t * .9], f: [0, t * .6, t, h / 2 - t * .9], g: [t * .6, h / 2 - t / 2, w - t * 1.2, t] };
  const cw = ch => ch === ':' ? t * 1.6 : w; let W = 0; chars.forEach((ch, i) => W += cw(ch) + (i ? gap : 0));
  let out = `<svg class="seg7" width="${W.toFixed(1)}" height="${h}" viewBox="0 0 ${W.toFixed(1)} ${h}" aria-hidden="true">`; let x0 = 0;
  chars.forEach((ch, i) => {
    if (i) x0 += gap;
    if (ch === ':') { out += `<rect x="${(x0 + t * .3).toFixed(1)}" y="${(h * .28).toFixed(1)}" width="${t}" height="${t}" rx="${t / 2}" fill="${color}"/><rect x="${(x0 + t * .3).toFixed(1)}" y="${(h * .62).toFixed(1)}" width="${t}" height="${t}" rx="${t / 2}" fill="${color}"/>`; x0 += cw(ch); return; }
    const on = SEG[ch] || '';
    for (const s in paths) { const [x, y, ww, hh] = paths[s]; out += `<rect x="${(x0 + x).toFixed(1)}" y="${y.toFixed(1)}" width="${ww.toFixed(1)}" height="${hh.toFixed(1)}" rx="${(t / 2).toFixed(1)}" fill="${on.includes(s) ? color : 'var(--led-dim)'}"/>`; }
    x0 += cw(ch);
  });
  return out + '</svg>';
}

/* ---------- Court (Canvas 2D), drawn to NFHS dimensions: 84 × 50 ft ---------- */
const Court = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, s: 1, marks: [], dots: [], ball: null, flash: null, raf: 0, colors: null, reduced: false,
  mount(canvas, colors, reduced) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.colors = colors; this.reduced = reduced; this.marks = []; this.ball = null; this.flash = null;
    this.resize(); this.formation('us', true);
    if (this._ro) this._ro.disconnect();
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas); }
    cancelAnimationFrame(this.raf); const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); }; loop();
  },
  unmount() { cancelAnimationFrame(this.raf); if (this._ro) this._ro.disconnect(); this.cv = null; },
  resize() { if (!this.cv) return; const r = this.cv.getBoundingClientRect(); this.dpr = window.devicePixelRatio || 1; this.W = Math.max(300, r.width); this.H = this.W * 50 / 84; this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr; this.s = this.W / 84; },
  // feet → px. Court origin top-left; you attack the RIGHT basket, they attack the LEFT.
  px(x, y) { return [x * this.s, y * this.s]; },
  basket(side) { return side === 'us' ? [84 - 5.25, 25] : [5.25, 25]; },
  toCourt(side, loc) { const [bx, by] = this.basket(side); return side === 'us' ? [bx - loc.x, by + loc.y] : [bx + loc.x, by - loc.y]; },
  formation(off, instant) {
    // dots 0-4 are always your team, 5-9 the opponent; offense/defense sets swap by possession
    const O = [[24, 0], [17, -15], [17, 15], [5, -12], [6, 9]]; const D = [[20, 0], [14, -12], [14, 12], [4, -8], [4, 6]];
    const jitter = () => this.reduced ? 0 : (Math.random() - .5) * 4;
    const usSet = off === 'us' ? O : D, themSet = off === 'us' ? D : O;
    const tgt = [...usSet.map(([x, y]) => ({ side: 'us', t: this.toCourt(off, { x: x + jitter(), y: y + jitter() }) })), ...themSet.map(([x, y]) => ({ side: 'them', t: this.toCourt(off, { x: x + jitter(), y: y + jitter() }) }))];
    tgt.forEach((d, i) => { if (!this.dots[i] || instant || this.reduced) this.dots[i] = { x: d.t[0], y: d.t[1] }; this.dots[i].side = d.side; this.dots[i].tx = d.t[0]; this.dots[i].ty = d.t[1]; });
  },
  shoot(side, loc, made, dur) {
    const from = this.toCourt(side, loc); const to = this.basket(side);
    const k = (side === 'us' ? 0 : 5) + Math.floor(Math.random() * 5); if (this.dots[k]) { this.dots[k].tx = from[0]; this.dots[k].ty = from[1]; }
    if (this.reduced || dur < 120) { this.marks.push({ x: from[0], y: from[1], made, side }); return; }
    this.ball = { from, to, t0: performance.now(), dur, made, side };
  },
  clearMarks() { this.marks = []; },
  text(msg, side) { this.flash = { msg, side, t0: performance.now() }; },
  draw() {
    const c = this.ctx; if (!c) return; const s = this.s; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const col = this.colors;
    // hardwood planks
    c.fillStyle = '#D9A566'; c.fillRect(0, 0, this.W, this.H);
    const plank = s * 1.1; for (let y = 0, i = 0; y < this.H; y += plank, i++) { c.fillStyle = i % 3 === 0 ? 'rgba(120,70,20,.07)' : i % 3 === 1 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)'; c.fillRect(0, y, this.W, plank); c.fillStyle = 'rgba(90,50,15,.12)'; c.fillRect(0, y, this.W, .6); const off = ((i * 37) % 11) * s * 1.7; for (let x = off; x < this.W; x += s * 19) c.fillRect(x, y, .7, plank); }
    // painted keys in home colors
    c.fillStyle = col.paint; [[0, 19], [84 - 19, 19]].forEach(([x]) => c.fillRect(x * s, 19 * s, 19 * s, 12 * s));
    c.globalAlpha = .9; c.fillStyle = col.paint; c.beginPath(); c.arc(42 * s, 25 * s, 6 * s, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(1.5, s * .17);
    c.strokeRect(1, 1, this.W - 2, this.H - 2);
    c.beginPath(); c.moveTo(42 * s, 0); c.lineTo(42 * s, this.H); c.stroke();
    c.beginPath(); c.arc(42 * s, 25 * s, 6 * s, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(42 * s, 25 * s, 2 * s, 0, Math.PI * 2); c.stroke();
    // center logo text
    c.fillStyle = col.paintInk; c.font = `${Math.round(s * 2.4)}px Graduate, Rockwell, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(col.initials, 42 * s, 25.2 * s);
    for (const side of ['L', 'R']) {
      const bx = side === 'L' ? 5.25 : 84 - 5.25, dir = side === 'L' ? 1 : -1, base = side === 'L' ? 0 : 84;
      c.strokeRect(Math.min(base, base + dir * 19) * s, 19 * s, 19 * s, 12 * s); // lane 12ft
      c.beginPath(); c.arc((base + dir * 19) * s, 25 * s, 6 * s, 0, Math.PI * 2); c.stroke(); // FT circle
      // 3-pt: 19'9" arc with straight corner lines
      const r3 = 19.75; const cy = 25;
      c.beginPath(); c.moveTo(base * s, (cy - r3 + .1) * s); c.lineTo(bx * s, (cy - r3 + .1) * s);
      const a = Math.PI / 2; c.arc(bx * s, cy * s, r3 * s, -a, a, side === 'R'); c.lineTo(base * s, (cy + r3 - .1) * s); c.stroke();
      // backboard & rim
      c.beginPath(); c.moveTo((base + dir * 4) * s, 22 * s); c.lineTo((base + dir * 4) * s, 28 * s); c.lineWidth = s * .35; c.stroke(); c.lineWidth = Math.max(1.5, s * .17);
      c.strokeStyle = '#E8561C'; c.beginPath(); c.arc(bx * s, 25 * s, .75 * s, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#FFFFFF';
    }
    // shot marks: ● made, ✕ missed (shape carries meaning, not only color)
    for (const m of this.marks) {
      const [x, y] = [m.x * s, m.y * s]; const clr = m.side === 'us' ? col.us : col.them; const r = Math.max(4, s * .75);
      c.lineWidth = 2.5;
      if (m.made) { c.fillStyle = clr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
      else { c.strokeStyle = clr; c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); }
    }
    // players
    const R = Math.max(7, s * 1.25);
    this.dots.forEach((d, i) => {
      if (!this.reduced) { d.x += (d.tx - d.x) * .08; d.y += (d.ty - d.y) * .08; }
      const clr = d.side === 'us' ? col.us : col.them; const ink = d.side === 'us' ? col.usInk : col.themInk;
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(d.x * s + 2, d.y * s + 3, R, R * .7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = clr; c.beginPath(); c.arc(d.x * s, d.y * s, R, 0, Math.PI * 2); c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
      if (d.side !== 'us') { c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(d.x * s - R * .5, d.y * s); c.lineTo(d.x * s + R * .5, d.y * s); c.stroke(); } // stripe marks the opponent
    });
    // ball
    const b = this.ball; if (b) {
      const t = Math.min(1, (performance.now() - b.t0) / b.dur); const x = b.from[0] + (b.to[0] - b.from[0]) * t, y = b.from[1] + (b.to[1] - b.from[1]) * t; const lift = Math.sin(Math.PI * t) * 7;
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x * s, y * s, s * .5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#E8611A'; c.beginPath(); c.arc(x * s, (y - lift) * s, Math.max(4, s * .6 + lift * s * .05), 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5A2A08'; c.lineWidth = 1; c.stroke();
      if (t >= 1) { this.marks.push({ x: b.from[0], y: b.from[1], made: b.made, side: b.side }); this.ball = null; }
    }
    if (this.flash) {
      const age = performance.now() - this.flash.t0; if (age > 1200) this.flash = null; else {
        c.globalAlpha = Math.min(1, (1200 - age) / 400); c.font = `${Math.round(s * 3.2)}px Graduate, Rockwell, serif`; c.textAlign = 'center';
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)'; const xx = this.flash.side === 'us' ? 63 * s : 21 * s; c.strokeText(this.flash.msg, xx, 8 * s); c.fillStyle = '#fff'; c.fillText(this.flash.msg, xx, 8 * s); c.globalAlpha = 1; }
    }
  },
};

/* Title screen floor (static canvas) */
function drawTitleFloor(cv, c1) {
  const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const W = r.width, H = r.height; c.fillStyle = '#D9A566'; c.fillRect(0, 0, W, H);
  const pl = 14; for (let y = 0, i = 0; y < H; y += pl, i++) { c.fillStyle = i % 3 === 0 ? 'rgba(120,70,20,.08)' : i % 3 === 1 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'; c.fillRect(0, y, W, pl); c.fillStyle = 'rgba(90,50,15,.14)'; c.fillRect(0, y, W, .7); for (let x = (i * 53) % 130; x < W; x += 230) c.fillRect(x, y, .8, pl); }
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.beginPath(); c.arc(W / 2, 0, Math.min(W, 900) * .32, 0, Math.PI); c.stroke();
  c.fillStyle = c1; c.globalAlpha = .85; c.beginPath(); c.arc(W / 2, 0, Math.min(W, 900) * .12, 0, Math.PI); c.fill(); c.globalAlpha = 1;
  c.beginPath(); c.arc(W / 2, 0, Math.min(W, 900) * .12, 0, Math.PI); c.stroke();
}
