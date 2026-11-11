// Synthesized sound effects: no audio files. The AudioContext is created on first use so the browser autoplay policy is respected.
export const SOUND_KEYS = [
  'swish',
  'three',
  'rim',
  'block',
  'steal',
  'whistle',
  'timeout',
  'confirm',
  'select',
  'error',
  'signing',
  'victory',
  'defeat',
  'uiClick',
  'cheer',
  'groan',
  'crowd',
];
let ctx = null,
  volume = 0.35,
  muted = true,
  bypass = false;
const enabled = Object.fromEntries(SOUND_KEYS.map(k => [k, true]));
export function configureAudio({ volume: v, muted: m, toggles } = {}) {
  if (typeof v === 'number') volume = Math.max(0, Math.min(1, v));
  if (typeof m === 'boolean') muted = m;
  if (toggles) for (const k of SOUND_KEYS) if (typeof toggles[k] === 'boolean') enabled[k] = toggles[k];
  if (bed && (muted || !enabled.crowd)) stopCrowd();
}
function context() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
  } catch {
    return null;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function osc(type, f0, f1, dur, vol = 0.4, delay = 0, attack = 0.005) {
  const c = context();
  if (!c) return;
  const now = c.currentTime + delay,
    o = c.createOscillator(),
    g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), now + dur);
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(vol * volume, 0.001), now + attack);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + dur + 0.01);
}
function noise(dur, f0, f1, q, vol = 0.3, delay = 0) {
  const c = context();
  if (!c) return;
  const now = c.currentTime + delay,
    buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(),
    filter = c.createBiquadFilter(),
    g = c.createGain();
  src.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(f0, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), now + dur);
  filter.Q.value = q;
  g.gain.setValueAtTime(Math.max(vol * volume, 0.001), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(now);
  src.stop(now + dur + 0.01);
}
const chord = (notes, step, dur, vol, type = 'sine') =>
  notes.forEach((f, i) => {
    osc(type, f, f * 1.005, dur, vol, i * step, 0.004);
    osc(type, f * 2, f * 2 * 1.005, dur * 0.65, vol * 0.25, i * step, 0.004);
  });
const SOUNDS = {
  // A clean two-point swish: air through the net, then a soft pop.
  swish() {
    noise(0.24, 5200, 2200, 1.1, 0.26);
    osc('sine', 720, 980, 0.08, 0.2, 0.02, 0.003);
    osc('sine', 420, 380, 0.12, 0.12, 0.04, 0.004);
  },
  // Three-pointers add a bright rising ping.
  three() {
    SOUNDS.swish();
    chord([783.99, 1046.5], 0.07, 0.3, 0.2);
  },
  // Metallic clank off the rim.
  rim() {
    osc('triangle', 430, 300, 0.16, 0.34, 0, 0.002);
    osc('square', 860, 610, 0.09, 0.1, 0, 0.002);
    noise(0.05, 2400, 900, 4, 0.2);
  },
  // Low thud and a sharp slap.
  block() {
    osc('sine', 260, 55, 0.2, 0.5, 0, 0.003);
    noise(0.07, 2600, 700, 5, 0.32);
    osc('sine', 480, 240, 0.08, 0.2, 0.03);
  },
  // Quick swipe across the ball.
  steal() {
    noise(0.12, 500, 3000, 3, 0.26);
    osc('sine', 560, 320, 0.14, 0.22, 0.02);
  },
  // Referee whistle: two close tones with a fast tremolo.
  whistle() {
    const c = context();
    if (!c) return;
    const now = c.currentTime,
      peak = Math.max(0.3 * volume, 0.001),
      g = c.createGain(),
      lfo = c.createOscillator(),
      depth = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.03);
    g.gain.setValueAtTime(peak, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    lfo.frequency.value = 30;
    depth.gain.value = peak * 0.45;
    lfo.connect(depth).connect(g.gain);
    g.connect(c.destination);
    for (const f of [2850, 2905]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(now);
      o.stop(now + 0.48);
    }
    lfo.start(now);
    lfo.stop(now + 0.48);
  },
  // Two falling bell tones.
  timeout() {
    osc('sine', 659.25, 650, 0.32, 0.34, 0, 0.004);
    osc('sine', 493.88, 485, 0.4, 0.34, 0.16, 0.004);
    osc('sine', 1318.5, 1300, 0.2, 0.08, 0, 0.004);
  },
  // Rising two-tone confirmation.
  confirm() {
    osc('sine', 440, 880, 0.15, 0.4, 0, 0.004);
    osc('sine', 880, 1320, 0.1, 0.18, 0.08, 0.004);
  },
  // Soft tick when a choice changes.
  select() {
    osc('sine', 660, 700, 0.09, 0.3, 0, 0.004);
    noise(0.04, 800, 1600, 6, 0.08);
  },
  // Low double buzz for rejected actions.
  error() {
    osc('sawtooth', 190, 120, 0.2, 0.22, 0, 0.004);
    osc('square', 140, 100, 0.18, 0.12, 0.1, 0.004);
  },
  // Glittery arpeggio when someone joins the program.
  signing() {
    noise(0.1, 4000, 9000, 10, 0.14);
    chord([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.09, 0.4, 0.3);
    noise(0.12, 6000, 12000, 8, 0.1, 0.45);
  },
  // Triumphant chime for a win or a title.
  victory() {
    chord([523.25, 659.25, 783.99, 1046.5], 0.15, 0.55, 0.34);
    osc('sine', 261.63, 254, 0.7, 0.28, 0, 0.01);
    noise(0.12, 3000, 8000, 6, 0.12, 0.55);
  },
  // Gentle descending phrase for a loss.
  defeat() {
    chord([392, 349.23, 293.66, 261.63], 0.2, 0.5, 0.28);
  },
  // Crowd roar: a rising wash of noise with a few shouts on top.
  cheer() {
    noise(1.1, 500, 2200, 0.8, 0.3);
    noise(0.9, 900, 2600, 1.5, 0.18, 0.12);
    osc('sawtooth', 320, 420, 0.5, 0.05, 0.1, 0.05);
  },
  // The crowd's groan: noise sliding down, with a falling hum.
  groan() {
    noise(0.9, 900, 260, 0.9, 0.26);
    osc('sawtooth', 230, 130, 0.8, 0.07, 0, 0.08);
  },
  // A short murmur; the same sound runs continuously as the ambience during a live game.
  crowd() {
    noise(1.2, 400, 700, 0.5, 0.16);
    noise(1.2, 900, 500, 0.7, 0.08, 0.2);
  },
  // Deep, short click.
  uiClick() {
    noise(0.035, 180, 60, 1.8, 0.5);
    osc('sine', 320, 420, 0.075, 0.65, 0, 0.003);
  },
};
export function play(key) {
  if (!bypass && (muted || !enabled[key])) return;
  try {
    SOUNDS[key]?.();
  } catch {}
}
// Plays a sound even when muted so volume can be checked before sound effects are switched on.
export function preview(key = 'swish') {
  bypass = true;
  try {
    SOUNDS[key]?.();
  } catch {
  } finally {
    bypass = false;
  }
}
// Ambient crowd for a live game: looping low noise that swells a little now and then. It follows the master mute and the 'crowd' switch.
let bed = null,
  bedBuffer = null;
function brownNoise(c, seconds = 4) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate),
    d = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buffer;
}
export function startCrowd() {
  if (bed || muted || !enabled.crowd) return;
  const c = context();
  if (!c) return;
  try {
    const src = c.createBufferSource(),
      low = c.createBiquadFilter(),
      g = c.createGain(),
      lfo = c.createOscillator(),
      depth = c.createGain();
    bedBuffer ??= brownNoise(c);
    src.buffer = bedBuffer;
    src.loop = true;
    low.type = 'lowpass';
    low.frequency.value = 650;
    g.gain.value = Math.max(0.09 * volume, 0.0005);
    // The slow swell is its own stage in series, so fading the master really fades everything.
    const swell = c.createGain();
    swell.gain.value = 1;
    lfo.frequency.value = 0.12;
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(swell.gain);
    src.connect(low).connect(swell).connect(g).connect(c.destination);
    src.start();
    lfo.start();
    bed = { src, lfo, g, swell };
  } catch {
    bed = null;
  }
}
export function stopCrowd() {
  if (!bed) return;
  const b = bed;
  bed = null;
  try {
    b.g.gain.cancelScheduledValues(0);
    b.g.gain.setTargetAtTime(0.0001, b.g.context.currentTime, 0.12);
    setTimeout(() => {
      try {
        b.src.stop();
        b.lfo.stop();
        b.g.disconnect();
      } catch {}
    }, 900);
  } catch {}
}
export const crowdRunning = () => !!bed;
