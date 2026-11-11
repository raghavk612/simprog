// Maple strip flooring for the court, generated pixel by pixel (pure: no Three.js, no DOM, so it can be unit-tested).
// A real hardwood court is laid in strips 2 1/4" wide running the length of the floor; each row is made of boards a few feet
// long with staggered butt joints. Each board has its own tone, a fine grain along its length and now and then a darker
// mineral streak. The arena paints the lines and the stained lane over this, and uses the wear map for the varnish.
export const STRIP_FT = 2.25 / 12;
const hash = (a, b = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
// Per-pixel noise reads a table instead of calling Math.sin: the floor is millions of pixels.
const TABLE = new Float32Array(4096).map((_, i) => hash(i, 0.123)),
  WAVE = new Float32Array(1024).map((_, i) => 0.5 + 0.5 * Math.sin((i / 1024) * 2 * Math.PI)); // one period
/* Smooth 1D value noise, 0..1; seed is any integer. */
const noise = (x, seed) => {
  const i = Math.floor(x),
    f = x - i,
    u = f * f * (3 - 2 * f),
    o = (seed * 131) & 4095;
  return TABLE[(i + o) & 4095] * (1 - u) + TABLE[(i + 1 + o) & 4095] * u;
};
// Maple tones (sRGB 0..255): mostly pale, some honey, a few darker boards, weighted by how often each appears.
const TONES = [
  [226, 184, 132, 0.34],
  [219, 174, 120, 0.3],
  [231, 193, 143, 0.18],
  [208, 160, 106, 0.13],
  [194, 146, 95, 0.05],
];
function tone(r) {
  let acc = 0;
  for (const t of TONES) if (r < (acc += t[3])) return t;
  return TONES[0];
}

/* The boards of one strip row: their start positions (px, ascending, the first at or before 0) out past `width`. */
export function rowJoints(row, width, pxPerFt) {
  const joints = [-hash(row, 1) * 6 * pxPerFt];
  while (joints[joints.length - 1] < width) {
    const k = joints.length;
    joints.push(joints[k - 1] + (2 + hash(row, k + 2) * 5) * pxPerFt); // boards 2 to 7 ft long
  }
  return joints;
}

/* Wood colour (RGBA, width*height*4) and a wear map (one byte per pixel: 0 = fresh varnish, 255 = most worn) for a floor
   `width` x `height` pixels at pxPerFt pixels per foot, strips running along x. wearAt(x, y) (0..1) adds traffic wear where
   players run most; it is sampled once per board, not per pixel. */
export function makeWood(width, height, pxPerFt, wearAt = () => 0) {
  const rgba = new Uint8ClampedArray(width * height * 4),
    wear = new Uint8ClampedArray(width * height),
    strip = STRIP_FT * pxPerFt,
    grainScale = 1 / (pxPerFt * 1.6),
    streakScale = 1 / (pxPerFt * 0.45),
    mineralScale = 1 / (pxPerFt * 0.8);
  let row = -1,
    joints = null;
  for (let y = 0; y < height; y++) {
    const r = Math.floor(y / strip),
      v = y / strip - r, // 0..1 across the strip
      seam = v * strip < 0.9 ? 0.8 : 1; // the groove between strips
    if (r !== row) {
      row = r;
      joints = rowJoints(r, width, pxPerFt);
    }
    let k = -1,
      seed = 0,
      t = null,
      lift = 1,
      phase = 0,
      mineral = false,
      worn = 0;
    for (let x = 0; x < width; x++) {
      if (k < 0 || x >= joints[k + 1]) {
        while (x >= joints[k + 1]) k++;
        // a new board: its tone, brightness, grain offset, streak and how worn its varnish is
        seed = (r * 97 + k) | 0;
        t = tone(hash(seed, 3));
        lift = 0.94 + hash(seed, 4) * 0.1;
        phase = hash(seed, 5);
        mineral = hash(seed, 6) < 0.12;
        worn = Math.min(1, 0.1 * hash(seed, 7) + wearAt((joints[k] + joints[k + 1]) / 2, y));
      }
      const g = WAVE[((v * 2.3 + phase + 0.7 * noise(x * grainScale, seed)) * 1024) & 1023],
        s = noise(x * streakScale, seed + 7),
        m = mineral ? 0.86 + 0.14 * noise(x * mineralScale, seed + 13) : 1,
        joint = x - joints[k] < 1 ? 0.78 : 1,
        f = lift * (1 - 0.07 * g - 0.06 * s) * seam * joint * m,
        i = (y * width + x) * 4;
      rgba[i] = t[0] * f;
      rgba[i + 1] = t[1] * f;
      rgba[i + 2] = t[2] * f * (mineral ? 0.96 : 1);
      rgba[i + 3] = 255;
      wear[y * width + x] = 255 * worn * (0.7 + 0.3 * s);
    }
  }
  return { rgba, wear, strip };
}
