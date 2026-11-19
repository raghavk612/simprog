// Each opponent's colours, read from its own logo (public/images/opponents/*.png, supplied by the project team), so the
// visiting players wear their school's colour instead of one orange for everyone. Writes src/teamColors.js.
//   node scripts/team-colors.mjs
// The primary colour is the most common saturated colour in the logo (by hue, weighted by how saturated it is); the
// secondary the next distinct hue, or the logo's dark ink. A logo that is all black and white gives black.
// The PNG decoding is a small reader for 8-bit, non-interlaced files (no new dependency).
import fs from 'node:fs';
import zlib from 'node:zlib';

const root = new URL('..', import.meta.url).pathname,
  dir = `${root}public/images/opponents`;

export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw Error('not a PNG');
  let p = 8,
    w = 0,
    h = 0,
    depth = 0,
    type = 0,
    interlace = 0,
    palette = null,
    trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p),
      kind = buf.toString('ascii', p + 4, p + 8),
      data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type],
    raw = zlib.inflateSync(Buffer.concat(idat)),
    stride = w * ch,
    px = Buffer.alloc(h * stride),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)],
      row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0,
        b = y ? px[(y - 1) * stride + x] : 0,
        c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c,
          pa = Math.abs(pp - a),
          pb = Math.abs(pp - b),
          pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  for (let i = 0; i < w * h; i++) {
    const s = i * ch,
      o = i * 4;
    if (type === 6) {
      out[o] = px[s];
      out[o + 1] = px[s + 1];
      out[o + 2] = px[s + 2];
      out[o + 3] = px[s + 3];
    } else if (type === 2) {
      out[o] = px[s];
      out[o + 1] = px[s + 1];
      out[o + 2] = px[s + 2];
      out[o + 3] = 255;
    } else if (type === 3) {
      const k = px[s];
      out[o] = palette[k * 3];
      out[o + 1] = palette[k * 3 + 1];
      out[o + 2] = palette[k * 3 + 2];
      out[o + 3] = trns && k < trns.length ? trns[k] : 255;
    } else {
      out[o] = out[o + 1] = out[o + 2] = px[s];
      out[o + 3] = type === 4 ? px[s + 1] : 255;
    }
  }
  return { width: w, height: h, data: out };
}

const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
function hsv([r, g, b]) {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let hh = 0;
  if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
}
/* Primary and secondary colours of an RGBA image. Pure, so it is tested with made-up pixels. */
export function teamColors({ data }) {
  const BINS = 24,
    bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 })),
    dark = { w: 0, r: 0, g: 0, b: 0 };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const c = [data[i], data[i + 1], data[i + 2]],
      [hh, s, v] = hsv(c);
    if (s > 0.3 && v > 0.18) {
      const k = Math.floor(hh / (360 / BINS)) % BINS,
        w = s;
      Object.assign(bins[k], {
        w: bins[k].w + w,
        r: bins[k].r + c[0] * w,
        g: bins[k].g + c[1] * w,
        b: bins[k].b + c[2] * w,
      });
    } else if (v < 0.35)
      Object.assign(dark, { w: dark.w + 1, r: dark.r + c[0], g: dark.g + c[1], b: dark.b + c[2] });
  }
  const avg = x => [x.r / x.w, x.g / x.w, x.b / x.w];
  // neighbouring bins of one hue are one colour: merge each bin with its neighbours, then take the strongest
  const merged = bins.map((_, k) => [-1, 0, 1].map(d => bins[(k + d + BINS) % BINS]));
  const total = bins.reduce((a, x) => a + x.w, 0);
  const rank = merged
    .map((g, k) => ({ k, w: g.reduce((a, x) => a + x.w, 0), c: g }))
    .filter(x => x.w > 0)
    .sort((a, b) => b.w - a.w);
  const colourOf = g => {
    const s = g.reduce((a, x) => ({ w: a.w + x.w, r: a.r + x.r, g: a.g + x.g, b: a.b + x.b }), {
      w: 0,
      r: 0,
      g: 0,
      b: 0,
    });
    return avg(s);
  };
  const solid = total > 0 && rank.length && rank[0].w > total * 0.12;
  const primary = solid ? colourOf(rank[0].c) : dark.w ? avg(dark) : [26, 26, 31];
  const second = solid
    ? rank.find(
        x => Math.min(Math.abs(x.k - rank[0].k), BINS - Math.abs(x.k - rank[0].k)) >= 4 && x.w > total * 0.08,
      )
    : null;
  const secondary = second ? colourOf(second.c) : dark.w ? avg(dark) : [255, 255, 255];
  return { primary: hex(primary), secondary: hex(secondary) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const f of fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .sort()) {
    const c = teamColors(decodePNG(fs.readFileSync(`${dir}/${f}`)));
    out[f.replace(/\.png$/, '')] = c;
    console.log(f.padEnd(18), c.primary, c.secondary);
  }
  fs.writeFileSync(
    `${root}src/teamColors.js`,
    `// Generated by scripts/team-colors.mjs from the opponents' logos (public/images/opponents). Do not edit by hand:
// run node scripts/team-colors.mjs. Keys are logo slugs (src/logos.js logoSlug).
export const TEAM_COLORS = ${JSON.stringify(out, null, 2)};\n`,
  );
  console.log('Wrote src/teamColors.js');
}
