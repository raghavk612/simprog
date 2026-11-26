// Boundary loops of every mesh in a player GLB, welded at 2 mm: a jersey should have 4 (neck, two armholes, hem) and shorts 3
// (waist, two legs). The build's holes show as extra, mostly tiny, loops. Used by tests/players.test.js and the plans' reports.
//   node scripts/kit-topology.mjs [file.glb ...]          # default: the three shipped variants, jersey and shorts
//   node scripts/kit-topology.mjs --all guard.glb         # every mesh
//   options: --weld 0.002 (units)  --small 0.2 (a loop shorter than this is a "small" one)
import fs from 'node:fs';

const COMP = {
    5120: [1, Int8Array],
    5121: [1, Uint8Array],
    5122: [2, Int16Array],
    5123: [2, Uint16Array],
    5125: [4, Uint32Array],
    5126: [4, Float32Array],
  },
  NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/* { meshName: { positions: number[], indices: number[] } } of a GLB (all primitives of a mesh joined; LOD copies included). */
export function readGlbMeshes(file) {
  const b = fs.readFileSync(file),
    jl = b.readUInt32LE(12),
    json = JSON.parse(b.toString('utf8', 20, 20 + jl)),
    bin = b.subarray(20 + jl + 8);
  const acc = i => {
    const a = json.accessors[i],
      v = json.bufferViews[a.bufferView],
      [size, T] = COMP[a.componentType],
      n = NCOMP[a.type],
      stride = v.byteStride || size * n,
      base = (v.byteOffset || 0) + (a.byteOffset || 0),
      out = new Array(a.count * n),
      dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength),
      get = {
        1: o => (T === Int8Array ? dv.getInt8(o) : dv.getUint8(o)),
        2: o => (T === Int16Array ? dv.getInt16(o, true) : dv.getUint16(o, true)),
        4: o => (T === Float32Array ? dv.getFloat32(o, true) : dv.getUint32(o, true)),
      }[size];
    for (let k = 0; k < a.count; k++)
      for (let c = 0; c < n; c++) out[k * n + c] = get(base + k * stride + c * size);
    return out;
  };
  const meshes = {};
  for (const m of json.meshes) {
    const positions = [],
      indices = [];
    for (const p of m.primitives) {
      const off = positions.length / 3;
      positions.push(...acc(p.attributes.POSITION));
      const ix =
        p.indices != null
          ? acc(p.indices)
          : Array.from({ length: acc(p.attributes.POSITION).length / 3 }, (_, i) => i);
      for (const i of ix) indices.push(i + off);
    }
    meshes[m.name] = { positions, indices };
  }
  return meshes;
}

/* Boundary loops of an indexed triangle mesh with vertices that round to the same `weld` grid point merged. A loop is a connected set of edges
   used by exactly one triangle. Returns { loops: [{ edges, length }], small: { count, length } } where small = loops
   shorter than `smallBelow` (and the length of edge in them). */
export function boundaryLoops(positions, indices, weld = 0.002, smallBelow = 0.2) {
  // vertices are welded by rounding each coordinate to the nearest `weld` (the way the audit counted: 30 / 14 for the forward jersey)
  const nv = positions.length / 3,
    ids = new Map(),
    rep = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const k = `${Math.round(positions[v * 3] / weld)},${Math.round(positions[v * 3 + 1] / weld)},${Math.round(positions[v * 3 + 2] / weld)}`;
    if (!ids.has(k)) ids.set(k, v);
    rep[v] = ids.get(k);
  }
  const edges = new Map(); // "a,b" (a<b) -> count
  for (let t = 0; t < indices.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = rep[indices[t + e]],
        b = rep[indices[t + ((e + 1) % 3)]];
      if (a === b) continue;
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  const parent = new Map(),
    find = a => {
      while (parent.get(a) !== a) {
        parent.set(a, parent.get(parent.get(a)));
        a = parent.get(a);
      }
      return a;
    },
    bnd = [];
  for (const [k, n] of edges) {
    if (n !== 1) continue;
    const [a, b] = k.split(',').map(Number);
    bnd.push([a, b]);
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  }
  const groups = new Map();
  for (const [a, b] of bnd) {
    const r = find(a),
      g = groups.get(r) || { edges: 0, length: 0 },
      d = Math.hypot(
        positions[a * 3] - positions[b * 3],
        positions[a * 3 + 1] - positions[b * 3 + 1],
        positions[a * 3 + 2] - positions[b * 3 + 2],
      );
    g.edges++;
    g.length += d;
    groups.set(r, g);
  }
  const loops = [...groups.values()].sort((p, q) => q.length - p.length),
    sm = loops.filter(l => l.length < smallBelow);
  return { loops, small: { count: sm.length, length: sm.reduce((s, l) => s + l.length, 0) } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2),
    opt = (k, d) => {
      const i = argv.indexOf(`--${k}`);
      return i < 0 ? d : Number(argv.splice(i, 2)[1]);
    },
    weld = opt('weld', 0.002),
    smallBelow = opt('small', 0.2),
    all = argv.includes('--all'),
    files = argv.filter(a => !a.startsWith('--')),
    list = files.length ? files : ['guard', 'forward', 'center'].map(v => `public/models/players/${v}.glb`);
  console.log(`weld ${weld} units, small = under ${smallBelow}`);
  for (const f of list) {
    const m = readGlbMeshes(f);
    for (const n of Object.keys(m).filter(n => (all ? !n.endsWith('_lod1') : /^(jersey|shorts)$/.test(n)))) {
      const r = boundaryLoops(m[n].positions, m[n].indices, weld, smallBelow);
      console.log(
        `${f.split('/').pop().padEnd(12)} ${n.padEnd(16)} loops ${String(r.loops.length).padStart(3)}  small ${String(r.small.count).padStart(3)} (${r.small.length.toFixed(2)} u of edge)`,
      );
    }
  }
}
