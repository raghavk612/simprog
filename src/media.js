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
  // Live crowd: a looping filtered-noise bed that swells on big plays
  crowd: null,
  crowdStart(level = 1) {
    if (!this.ok() || this.crowd) return; const c = this.ctx; const len = c.sampleRate * 2; const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let last = 0; for (let i = 0; i < len; i++) { last = last * .97 + (Math.random() * 2 - 1) * .03; d[i] = (Math.random() * 2 - 1) * .5 + last * 6; } }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .45;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const g = c.createGain(); const base = .045 * level; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(base, c.currentTime + 1.2);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .23; lg.gain.value = base * .35; lfo.connect(lg).connect(g.gain);
    src.connect(bp).connect(lp).connect(g).connect(this.master); src.start(); lfo.start();
    this.crowd = { src, g, lfo, base };
  },
  crowdSwell(amount = 1) { const cr = this.crowd; if (!cr || !this.ok()) return; const t = this.ctx.currentTime; const peak = cr.base + .16 * amount;
    cr.g.gain.cancelScheduledValues(t); cr.g.gain.setValueAtTime(Math.max(cr.g.gain.value, .0001), t); cr.g.gain.linearRampToValueAtTime(peak, t + .18); cr.g.gain.linearRampToValueAtTime(cr.base, t + 1.9); },
  crowdStop() { const cr = this.crowd; if (!cr) return; this.crowd = null; try { const t = this.ctx.currentTime; cr.g.gain.cancelScheduledValues(t); cr.g.gain.setValueAtTime(Math.max(cr.g.gain.value, .0001), t); cr.g.gain.exponentialRampToValueAtTime(.0001, t + .8); cr.src.stop(t + .9); cr.lfo.stop(t + .9); } catch (e) {} },
};

/* ---------- Original procedural soundtrack (Web Audio). Plays on menus; the crowd takes over during games. ---------- */
const Music = {
  on: true, vol: .35, gain: null, timer: 0, step: 0, next: 0, playing: false,
  BPM: 104,
  CHORDS: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], // C, Am, F, G (MIDI)
  CHORDS_B: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], // Am, F, C, G
  LEAD: [[0, 2, 4, -1, 2, -1, 4, 5, 4, -1, 2, 0, -1, 2, 4, -1], [4, -1, 5, 4, 2, -1, 0, -1, 2, 4, -1, 7, 5, -1, 4, -1]],
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  ensure() { SFX.init(); const c = SFX.ctx; if (!c) return null; if (!this.gain) { this.gain = c.createGain(); this.gain.gain.value = 0; this.gain.connect(c.destination); } return c; },
  setVol(v) { this.vol = v; if (this.gain && SFX.ctx) this.gain.gain.setTargetAtTime(this.playing ? v * .5 : 0, SFX.ctx.currentTime, .1); },
  play() {
    if (!this.on || !SFX.on || this.playing) return; const c = this.ensure(); if (!c || c.state !== 'running') return;
    this.playing = true; this.step = 0; this.next = c.currentTime + .1; this.gain.gain.setTargetAtTime(this.vol * .5, c.currentTime, .4);
    clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 60);
  },
  stop() { if (!this.playing) return; this.playing = false; clearInterval(this.timer); if (this.gain && SFX.ctx) this.gain.gain.setTargetAtTime(0, SFX.ctx.currentTime, .25); },
  note(f, t, dur, type, peak, cutoff) { const c = SFX.ctx; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; let node = o;
    if (cutoff) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); node = lp; }
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur); node.connect(g).connect(this.gain); o.start(t); o.stop(t + dur + .05); },
  drum(kind, t) { const c = SFX.ctx;
    if (kind === 'kick') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .14); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18); o.connect(g).connect(this.gain); o.start(t); o.stop(t + .2); return; }
    const len = Math.floor(c.sampleRate * .12); const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const sN = c.createBufferSource(); sN.buffer = buf; const f = c.createBiquadFilter(); const g = c.createGain();
    if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); }
    else { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0001, t + .04); }
    sN.connect(f).connect(g).connect(this.gain); sN.start(t); sN.stop(t + .13); },
  schedule() {
    const c = SFX.ctx; if (!c || !this.playing) return; const sixteenth = 60 / this.BPM / 4;
    while (this.next < c.currentTime + .25) {
      const st = this.step % 16, bar = Math.floor(this.step / 16) % 4, section = Math.floor(this.step / 64) % 2; const t = this.next;
      const chord = (section ? this.CHORDS_B : this.CHORDS)[bar];
      if (st === 0 || st === 8 || st === 10) this.drum('kick', t);
      if (st === 4 || st === 12) this.drum('snare', t);
      if (st % 2 === 0) this.drum('hat', t);
      if (st === 0 || st === 6 || st === 8 || st === 14) this.note(this.hz(chord[0] - 12), t, sixteenth * 1.8, 'triangle', .28);
      if (st === 4 || st === 12) chord.forEach(m => this.note(this.hz(m + 12), t, sixteenth * 1.2, 'square', .035, 1400));
      const li = this.LEAD[(bar + section) % 2][st]; if (li >= 0) { const scale = [0, 2, 4, 7, 9, 12, 14, 16]; /* C major pentatonic fits every chord */ this.note(this.hz(72 + scale[li % scale.length]), t, sixteenth * 1.6, 'triangle', .07); }
      this.next += sixteenth; this.step++;
    }
  },
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

/* ---------- Court (Canvas 2D), drawn to NFHS dimensions: 84 × 50 ft, with stands around it ---------- */
const SKINS = ['#F3CDAE', '#E2AE85', '#C98D60', '#A96D45', '#8B5434', '#633D25'];
const HAIRS = ['#1A1A1A', '#3A2416', '#5E3B1F', '#B8914F', '#24170E', '#0E0E0E'];
function looksFor(id) { const h = U.hash(String(id)); return { skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 4) % HAIRS.length], hairStyle: (h >> 8) % 3 }; }
const Court = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, s: 1, OX: 4, OY: 7, WW: 92, WH: 64, marks: [], dots: [], ball: null, flash: null, label: null, raf: 0, colors: null, reduced: false, fans: [], cheerT: 0, carrier: 0, offense: 'us',
  mount(canvas, colors, reduced) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.colors = colors; this.reduced = reduced; this.marks = []; this.ball = null; this.flash = null; this.label = null; this.dots = [];
    this.makeFans(); this.resize(); this.formation('us', true);
    if (this._ro) this._ro.disconnect();
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas); }
    cancelAnimationFrame(this.raf); const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); }; loop();
  },
  unmount() { cancelAnimationFrame(this.raf); if (this._ro) this._ro.disconnect(); this.cv = null; },
  resize() { if (!this.cv) return; const r = this.cv.getBoundingClientRect(); this.dpr = window.devicePixelRatio || 1; this.W = Math.max(300, r.width); this.H = this.W * this.WH / this.WW; this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr; this.s = this.W / this.WW; },
  makeFans() {
    const c = this.colors.crowdHome; const pal = [c[0], c[0], c[1], '#E9ECEF', '#2B3440', c[0], '#7A8794', c[1]];
    this.fans = [];
    for (const side of ['top', 'bot']) for (let row = 0; row < 3; row++) for (let x = 1 + (row % 2) * .8; x < this.WW - 1; x += 1.7) {
      if (Math.random() < .12) continue;
      this.fans.push({ x, y: side === 'top' ? 1.4 + row * 1.9 : this.WH - 1.4 - row * 1.9, c: pal[Math.floor(Math.random() * pal.length)], skin: SKINS[Math.floor(Math.random() * SKINS.length)], ph: Math.random() * 6.28, home: Math.random() < .7 });
    }
  },
  setLineups(us, them) {
    const mk = (p) => p ? Object.assign({ num: p.num, id: p.id, name: p.last }, looksFor(p.id)) : null;
    this.lineUs = us.map(mk); this.lineThem = them.map(mk);
  },
  basket(side) { return side === 'us' ? [84 - 5.25, 25] : [5.25, 25]; },
  toCourt(side, loc) { const [bx, by] = this.basket(side); return side === 'us' ? [bx - loc.x, by + loc.y] : [bx + loc.x, by - loc.y]; },
  formation(off, instant) {
    // dots 0-4 are always your five on the floor, 5-9 theirs; offense/defense spots swap by possession
    const O = [[24, 0], [17, -15], [17, 15], [5, -12], [6, 9]]; const D = [[20, 0], [14, -12], [14, 12], [4, -8], [4, 6]];
    const jitter = () => this.reduced ? 0 : (Math.random() - .5) * 4;
    const usSet = off === 'us' ? O : D, themSet = off === 'us' ? D : O;
    const tgt = [...usSet.map(([x, y]) => ({ side: 'us', t: this.toCourt(off, { x: x + jitter(), y: y + jitter() }) })), ...themSet.map(([x, y]) => ({ side: 'them', t: this.toCourt(off, { x: x + jitter(), y: y + jitter() }) }))];
    tgt.forEach((d, i) => { if (!this.dots[i] || instant || this.reduced) this.dots[i] = { x: d.t[0], y: d.t[1] }; this.dots[i].side = d.side; this.dots[i].tx = d.t[0]; this.dots[i].ty = d.t[1]; });
    this.offense = off; this.carrier = off === 'us' ? 0 : 5;
  },
  shoot(side, loc, made, dur, idx, label) {
    const from = this.toCourt(side, loc); const to = this.basket(side);
    const k = (side === 'us' ? 0 : 5) + (idx != null ? idx : Math.floor(Math.random() * 5)); if (this.dots[k]) { this.dots[k].tx = from[0]; this.dots[k].ty = from[1]; this.carrier = k; }
    if (label) this.label = { k, text: label, t0: performance.now() };
    if (this.reduced || dur < 120) { this.marks.push({ x: from[0], y: from[1], made, side }); return; }
    this.ball = { from, to, t0: performance.now() + Math.min(250, dur * .3), dur, made, side, k };
  },
  clearMarks() { this.marks = []; },
  cheer() { this.cheerT = performance.now(); },
  text(msg, side) { this.flash = { msg, side, t0: performance.now() }; },
  drawPlayer(c, d, i, now) {
    const s = this.s; const col = this.colors; const us = d.side === 'us'; const info = (us ? this.lineUs : this.lineThem) || []; const pl = info[us ? i : i - 5] || { num: '', skin: SKINS[2], hair: HAIRS[0], hairStyle: 0 };
    const jersey = us ? col.us : col.them, ink = us ? col.usInk : col.themInk, trim = us ? col.usTrim : col.themTrim;
    const [bx, by] = this.basket(this.offense); const offense = (d.side === this.offense);
    let ang = Math.atan2(by - d.y, bx - d.x); if (!offense) ang += Math.PI;
    const moving = Math.hypot(d.tx - d.x, d.ty - d.y) > .15 && !this.reduced; const bob = moving ? Math.sin(now / 90 + i) * .12 : 0;
    const x = d.x * s, y = d.y * s; const W = 3.7 * s, Hh = 1.8 * s; // drawn larger than life so players read clearly
    c.save(); c.translate(x, y); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(s * .35, s * .45, W * .55, Hh * .8, 0, 0, Math.PI * 2); c.fill();
    c.rotate(ang + Math.PI / 2);
    // arms
    c.fillStyle = pl.skin; [-1, 1].forEach(sd => { c.beginPath(); c.ellipse(sd * W * .55, -Hh * .15 + (moving ? Math.sin(now / 90 + i + sd) * s * .3 : 0), s * .45, s * .7, 0, 0, Math.PI * 2); c.fill(); });
    // torso / jersey
    c.fillStyle = jersey; c.strokeStyle = trim; c.lineWidth = Math.max(1.5, s * .16);
    c.beginPath(); c.ellipse(0, bob * s, W * .5, Hh * .5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    // head + hair
    const hr = s * .8; c.fillStyle = pl.skin; c.beginPath(); c.arc(0, bob * s, hr, 0, Math.PI * 2); c.fill();
    c.fillStyle = pl.hair; c.beginPath(); if (pl.hairStyle === 0) c.arc(0, bob * s + hr * .15, hr * .95, Math.PI * .15, Math.PI * .85, true); else if (pl.hairStyle === 1) c.arc(0, bob * s, hr * .8, 0, Math.PI * 2); else c.arc(0, bob * s + hr * .3, hr * .9, Math.PI, 0); c.fill();
    c.restore();
    // number tag (always upright for legibility)
    if (pl.num !== '') { const fs = Math.max(9, s * 1.05); c.font = `700 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(pl.num).width + fs * .5; c.fillStyle = jersey; c.strokeStyle = trim; c.lineWidth = 1.5; const ty = y - s * 2.8;
      c.beginPath(); c.roundRect ? c.roundRect(x - tw / 2, ty - fs * .6, tw, fs * 1.2, 3) : c.rect(x - tw / 2, ty - fs * .6, tw, fs * 1.2); c.fill(); c.stroke(); c.fillStyle = ink; c.fillText(pl.num, x, ty + 1); }
  },
  draw() {
    const c = this.ctx; if (!c) return; const s = this.s; const now = performance.now(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const col = this.colors;
    // stands
    c.fillStyle = '#1D232B'; c.fillRect(0, 0, this.W, this.H);
    c.fillStyle = '#2A323C'; for (let r = 0; r < 3; r++) { c.fillRect(0, (.5 + r * 1.9) * s, this.W, 1.5 * s); c.fillRect(0, (this.WH - 2.0 - r * 1.9) * s, this.W, 1.5 * s); }
    const cheering = now - this.cheerT < 1400;
    for (const f of this.fans) {
      const jump = this.reduced ? 0 : (cheering && f.home ? Math.abs(Math.sin((now - this.cheerT) / 140 + f.ph)) * .55 : Math.sin(now / 900 + f.ph) * .05);
      const fy = (f.y - jump) * s, fx = f.x * s;
      c.fillStyle = f.c; c.beginPath(); c.ellipse(fx, fy + s * .45, s * .62, s * .42, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = f.skin; c.beginPath(); c.arc(fx, fy, s * .36, 0, Math.PI * 2); c.fill();
      if (cheering && f.home && !this.reduced) { c.strokeStyle = f.skin; c.lineWidth = Math.max(1, s * .18); c.beginPath(); c.moveTo(fx - s * .4, fy); c.lineTo(fx - s * .6, fy - s * .7); c.moveTo(fx + s * .4, fy); c.lineTo(fx + s * .6, fy - s * .7); c.stroke(); }
    }
    // floor apron
    c.fillStyle = '#B98448'; c.fillRect(0, (this.OY - 1) * s, this.W, (50 + 2) * s);
    c.save(); c.translate(this.OX * s, this.OY * s);
    // hardwood planks
    c.fillStyle = '#D9A566'; c.fillRect(0, 0, 84 * s, 50 * s);
    const plank = s * 1.1; for (let y = 0, i = 0; y < 50 * s; y += plank, i++) { c.fillStyle = i % 3 === 0 ? 'rgba(120,70,20,.07)' : i % 3 === 1 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)'; c.fillRect(0, y, 84 * s, plank); c.fillStyle = 'rgba(90,50,15,.12)'; c.fillRect(0, y, 84 * s, .6); const off = ((i * 37) % 11) * s * 1.7; for (let x = off; x < 84 * s; x += s * 19) c.fillRect(x, y, .7, plank); }
    c.fillStyle = col.paint; [0, 84 - 19].forEach(x => c.fillRect(x * s, 19 * s, 19 * s, 12 * s));
    c.globalAlpha = .9; c.beginPath(); c.arc(42 * s, 25 * s, 6 * s, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(1.5, s * .17);
    c.strokeRect(0, 0, 84 * s, 50 * s);
    c.beginPath(); c.moveTo(42 * s, 0); c.lineTo(42 * s, 50 * s); c.stroke();
    c.beginPath(); c.arc(42 * s, 25 * s, 6 * s, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(42 * s, 25 * s, 2 * s, 0, Math.PI * 2); c.stroke();
    c.fillStyle = col.paintInk; c.font = `${Math.round(s * 2.4)}px Graduate, Rockwell, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(col.initials, 42 * s, 25.2 * s);
    for (const side of ['L', 'R']) {
      const bx = side === 'L' ? 5.25 : 84 - 5.25, dir = side === 'L' ? 1 : -1, base = side === 'L' ? 0 : 84;
      c.strokeRect(Math.min(base, base + dir * 19) * s, 19 * s, 19 * s, 12 * s);
      c.beginPath(); c.arc((base + dir * 19) * s, 25 * s, 6 * s, 0, Math.PI * 2); c.stroke();
      const r3 = 19.75; const cy = 25;
      c.beginPath(); c.moveTo(base * s, (cy - r3 + .1) * s); c.lineTo(bx * s, (cy - r3 + .1) * s);
      const a = Math.PI / 2; c.arc(bx * s, cy * s, r3 * s, -a, a, side === 'R'); c.lineTo(base * s, (cy + r3 - .1) * s); c.stroke();
      c.beginPath(); c.moveTo((base + dir * 4) * s, 22 * s); c.lineTo((base + dir * 4) * s, 28 * s); c.lineWidth = s * .35; c.stroke(); c.lineWidth = Math.max(1.5, s * .17);
      c.strokeStyle = '#E8561C'; c.beginPath(); c.arc(bx * s, 25 * s, .75 * s, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#FFFFFF';
    }
    // shot marks: ● made, ✕ missed (shape carries meaning, not only color)
    for (const m of this.marks) {
      const [x, y] = [m.x * s, m.y * s]; const clr = m.side === 'us' ? col.us : col.them; const r = Math.max(4, s * .6);
      if (m.made) { c.fillStyle = clr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
      else { c.strokeStyle = clr; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); }
    }
    // players (move toward their spots)
    this.dots.forEach(d => { if (!this.reduced) { d.x += (d.tx - d.x) * .08; d.y += (d.ty - d.y) * .08; } });
    this.dots.slice().map((d, i) => [d, i]).sort((a, b) => a[0].y - b[0].y).forEach(([d, i]) => this.drawPlayer(c, d, i, now));
    // ball: dribbled by the ball handler, or in flight on a shot
    const b = this.ball;
    if (b && now >= b.t0) {
      const t = Math.min(1, (now - b.t0) / b.dur); const x = b.from[0] + (b.to[0] - b.from[0]) * t, y = b.from[1] + (b.to[1] - b.from[1]) * t; const lift = Math.sin(Math.PI * t) * 7;
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x * s, y * s, s * .5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#E8611A'; c.beginPath(); c.arc(x * s, (y - lift) * s, Math.max(4, s * .6 + lift * s * .05), 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5A2A08'; c.lineWidth = 1; c.stroke();
      if (t >= 1) { this.marks.push({ x: b.from[0], y: b.from[1], made: b.made, side: b.side }); this.ball = null; }
    } else {
      const h = this.dots[b ? b.k : this.carrier]; if (h) { const bounce = this.reduced ? 0 : Math.abs(Math.sin(now / 160)); const bx2 = h.x * s + s * 1.9, by2 = h.y * s + s * .4;
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(bx2, by2 + s * .3, s * .45 * (1.2 - bounce * .4), s * .25, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#E8611A'; c.beginPath(); c.arc(bx2, by2 - bounce * s * .6, Math.max(4, s * .6), 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5A2A08'; c.lineWidth = 1; c.stroke(); }
    }
    // shooter name label
    if (this.label) { const age = now - this.label.t0; const d = this.dots[this.label.k]; if (age > 1500 || !d) this.label = null; else {
      c.globalAlpha = Math.min(1, (1500 - age) / 400); const fs = Math.max(11, s * 1.3); c.font = `700 ${fs}px "Atkinson Hyperlegible", system-ui, sans-serif`; c.textAlign = 'center';
      const tw = c.measureText(this.label.text).width + 12; const lx = U.clamp(d.x * s, tw / 2, 84 * s - tw / 2), ly = d.y * s + s * 3.4;
      c.fillStyle = 'rgba(14,17,22,.85)'; c.fillRect(lx - tw / 2, ly - fs * .75, tw, fs * 1.5); c.fillStyle = '#fff'; c.fillText(this.label.text, lx, ly + 1); c.globalAlpha = 1; } }
    if (this.flash) {
      const age = now - this.flash.t0; if (age > 1200) this.flash = null; else {
        c.globalAlpha = Math.min(1, (1200 - age) / 400); c.font = `${Math.round(s * 3.2)}px Graduate, Rockwell, serif`; c.textAlign = 'center';
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)'; const xx = this.flash.side === 'us' ? 63 * s : 21 * s; c.strokeText(this.flash.msg, xx, 8 * s); c.fillStyle = '#fff'; c.fillText(this.flash.msg, xx, 8 * s); c.globalAlpha = 1; }
    }
    c.restore();
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

/* Courtside illustrations: original inline vectors, no external image downloads. */
function courtsideArt(kind = 'title') {
  const id = 'cs-' + kind;
  const ball = (x,y,r) => `<g class="art-ball" transform="translate(${x} ${y})"><circle r="${r}" fill="url(#${id}-ball)" stroke="#4c241b" stroke-width="3"/><circle r="${r-3}" fill="url(#${id}-pebble)" opacity=".24"/><g fill="none" stroke="#542717" stroke-width="${r*.047}" stroke-linecap="round"><path d="M${-r} 0H${r}M0 ${-r}V${r}"/><path d="M${-r*.7} ${-r*.7}C${r*.45} ${-r*.3} ${r*.45} ${r*.3} ${-r*.7} ${r*.7}M${r*.7} ${-r*.7}C${-r*.45} ${-r*.3} ${-r*.45} ${r*.3} ${r*.7} ${r*.7}"/></g><path d="M${-r*.62} ${-r*.51}Q${-r*.27} ${-r*.86} ${r*.2} ${-r*.79}" fill="none" stroke="#ffe2a9" stroke-width="3" opacity=".55"/></g>`;
  const trophy = `<g transform="translate(430 107)"><ellipse cx="36" cy="145" rx="69" ry="12" fill="#070f19" opacity=".4"/><path d="M0 20H-24V37Q-24 75 25 79M72 20H96V37Q96 75 48 79" fill="none" stroke="#c88c35" stroke-width="12"/><path d="M0 4H72V50Q72 90 36 94Q0 90 0 50Z" fill="url(#${id}-gold)" stroke="#fcd184" stroke-width="2"/><path d="M8 15V48Q8 67 19 74" fill="none" stroke="#fff0bb" stroke-width="5"/><path d="M29 91H43V121H60V132H12V121H29Z" fill="url(#${id}-gold)"/><rect x="0" y="132" width="72" height="19" rx="3" fill="#1b2a40" stroke="#9e7440"/><path d="M36 28L42 42L57 44L46 54L49 69L36 61L23 69L26 54L15 44L30 42Z" fill="#9c5b18"/><text x="36" y="145" text-anchor="middle" fill="#f5d7a6" font-size="8" letter-spacing="2">STATE</text></g>`;
  const hoop = `<g transform="translate(86 19)"><path d="M95 145V223" stroke="#4b5e70" stroke-width="14"/><rect width="188" height="100" rx="4" fill="#e4f4ff" fill-opacity=".12" stroke="#8ea8bc" stroke-width="4"/><rect x="62" y="41" width="64" height="47" fill="none" stroke="#e4f4ff" stroke-width="3"/><g fill="none" stroke="#d9e8ee" stroke-width="2" opacity=".9"><path d="M57 91L74 148H115L132 91M67 93L88 148M80 94L104 148M94 94L115 137M109 94L75 136M122 94L88 148M66 117H124M71 133H119"/></g><ellipse cx="95" cy="92" rx="42" ry="7" fill="none" stroke="#fa6c35" stroke-width="7"/></g>`;
  const jerseyArt = `<g transform="translate(84 28) rotate(-8 74 110)"><path d="M32 0L55 9Q74 28 94 9L117 0L147 24L127 59L115 51V205H33V51L20 59L0 24Z" fill="var(--team,#a6192e)" stroke="#ffe7c7" stroke-width="4"/><path d="M56 9Q74 44 94 9M34 172H114" fill="none" stroke="var(--team-2,#eeb847)" stroke-width="8"/><text x="75" y="82" text-anchor="middle" fill="var(--team-ink,#fff)" font-family="var(--f-data)" font-size="18" letter-spacing="3">HOME</text><text x="75" y="151" text-anchor="middle" fill="var(--team-ink,#fff)" font-family="var(--f-data)" font-weight="700" font-size="75">01</text></g>`;
  const board = `<g transform="translate(280 40) rotate(8 85 90)"><rect width="160" height="188" rx="9" fill="#142b32" stroke="#c59258" stroke-width="8"/><rect x="51" y="-10" width="58" height="20" rx="4" fill="#a6b7bb"/><g stroke="#e4efe4" stroke-width="2" fill="none" opacity=".65"><rect x="16" y="24" width="128" height="148"/><path d="M48 24V72H112V24M16 106Q80 183 144 106"/><circle cx="80" cy="72" r="24"/><circle cx="42" cy="116" r="8"/><circle cx="119" cy="90" r="8"/><path d="M70 134l13 13m-13 0l13-13M55 108Q78 84 105 88M98 82l8 6-9 6"/></g></g>`;
  const content = kind === 'practice' ? `${board}<path d="M92 240L131 126L168 240Z" fill="#f87a39" stroke="#ffbd77" stroke-width="3"/><path d="M112 181H150M103 210H160" stroke="#fff0cb" stroke-width="13"/>${ball(219,204,53)}` : kind === 'matchup' ? `${jerseyArt}${ball(371,171,76)}<path d="M257 63l-13 30h20l-10 29 43-48h-24l9-20Z" fill="#f4b95e"/>` : `${hoop}${trophy}${ball(318,198,85)}`;
  return `<svg class="courtside-illustration art-${kind}" viewBox="0 0 600 290" aria-hidden="true"><defs><radialGradient id="${id}-ball" cx="30%" cy="22%" r="80%"><stop stop-color="#ffbc66"/><stop offset=".5" stop-color="#ef7835"/><stop offset="1" stop-color="#a43e1d"/></radialGradient><linearGradient id="${id}-gold"><stop stop-color="#a96824"/><stop offset=".34" stop-color="#ffe9a0"/><stop offset=".63" stop-color="#e4ac48"/><stop offset="1" stop-color="#966019"/></linearGradient><radialGradient id="${id}-light"><stop stop-color="#365771"/><stop offset="1" stop-color="#101c2c"/></radialGradient><pattern id="${id}-pebble" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#412419"/></pattern></defs><rect width="600" height="290" rx="8" fill="url(#${id}-light)"/><circle cx="325" cy="145" r="124" fill="none" stroke="#ddeaf8" opacity=".06" stroke-width="32"/><path d="M0 250L600 229M0 271L600 250M72 290L212 190M404 290L371 190" fill="none" stroke="#e0be8a" opacity=".16"/><ellipse cx="308" cy="266" rx="161" ry="13" fill="#060c15" opacity=".45"/>${content}<g fill="#f0bb6f" opacity=".8"><path d="M531 40v12m-6-6h12M42 167v12m-6-6h12" stroke="currentColor"/><circle cx="553" cy="198" r="3"/><circle cx="359" cy="39" r="2"/></g></svg>`;
}
