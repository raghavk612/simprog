// Half-size copies of the players' kit and gear atlases for Medium (public/models/players/maps/<variant>_<atlas>_512.png),
// and the manifest entries for them. The skin already has its 1k copy (from the bake). On Medium the players are seen at
// broadcast distance, where a 512 px kit or gear atlas looks the same and downloads a quarter of the bytes.
//   node scripts/player-maps-small.mjs
// The maps hold data, not colour (a tangent-space normal in RGB, ambient occlusion in A), so they are averaged 2x2 on the
// raw bytes (no colour management, no premultiplied alpha, which an image tool would apply) and written as RGBA PNG with
// each row's filter chosen to compress best.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodePNG } from './team-colors.mjs';

const root = new URL('..', import.meta.url).pathname,
  dir = `${root}public/models/players/maps`;
export const SMALL = { kit: 512, gear: 512 };

/* RGBA pixels -> PNG bytes (8-bit RGBA, adaptive filters, zlib level 9). */
export function encodePNG({ width: w, height: h, data }) {
  const stride = w * 4,
    raw = Buffer.alloc((stride + 1) * h),
    prev = Buffer.alloc(stride),
    cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = Buffer.from(data.buffer, data.byteOffset + y * stride, stride),
      up = y ? Buffer.from(data.buffer, data.byteOffset + (y - 1) * stride, stride) : prev;
    let best = 0,
      bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = cand[f];
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? row[x - 4] : 0,
          b = up[x],
          c = x >= 4 ? up[x - 4] : 0,
          p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c),
          pred =
            f === 0
              ? 0
              : f === 1
                ? a
                : f === 2
                  ? b
                  : f === 3
                    ? (a + b) >> 1
                    : pa <= pb && pa <= pc
                      ? a
                      : pb <= pc
                        ? b
                        : c,
          v = (row[x] - pred) & 255;
        out[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4),
      crc = Buffer.alloc(4),
      tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    len.writeUInt32BE(body.length);
    crc.writeUInt32BE(zlib.crc32(tb) >>> 0);
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
/* Halves an RGBA image by averaging each 2x2 block, channel by channel (data, not colour). */
export function halve({ width: w, height: h, data }) {
  const W = w >> 1,
    H = h >> 1,
    out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let k = 0; k < 4; k++) {
        const i = (yy, xx) => (yy * w + xx) * 4 + k,
          s =
            data[i(2 * y, 2 * x)] +
            data[i(2 * y, 2 * x + 1)] +
            data[i(2 * y + 1, 2 * x)] +
            data[i(2 * y + 1, 2 * x + 1)];
        out[(y * W + x) * 4 + k] = (s + 2) >> 2;
      }
  return { width: W, height: H, data: out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
  for (const [v, m] of Object.entries(manifest)) {
    for (const [atlas, size] of Object.entries(SMALL)) {
      let img = decodePNG(fs.readFileSync(`${dir}/${v}_${atlas}.png`));
      while (img.width > size) img = halve(img);
      const file = `${v}_${atlas}_${size}.png`,
        bytes = encodePNG(img);
      fs.writeFileSync(`${dir}/${file}`, bytes);
      m.files[file] = bytes.length;
      m.small[atlas] = size;
      console.log(
        file,
        `${(bytes.length / 1e3).toFixed(0)} kB (from ${(m.files[`${v}_${atlas}.png`] / 1e3).toFixed(0)} kB)`,
      );
    }
  }
  fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 1) + '\n');
}
