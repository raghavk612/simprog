// Clean bindings and no skin through the clothes, worked out once per body variant from the meshes themselves (the
// Houdini source is not needed):
//   the binding tube (trim_mesh round the neck, armholes and hems) is smoothed (smoothTrim): as modelled it kinked into
//          flaps at the shoulders; its scraps on seam gaps are dropped (trimOpenings); kPush, the direction to lift it
//          off the body (trimPush: the normal of the torso or thigh skin under it, not the tube's own normals)
//   kCover (a vertex attribute on the body skin) x: the skin vertex is under the kit (jersey or shorts), well away from
//          any opening; y, z: it belongs to the limb an arm or leg sleeve follows. The skin shader (materials.js patch,
//          cover) does not draw skin wholly under the kit, nor the sleeved limb's skin between the sleeve's two planes
//          (sleeveRims), so a bending elbow or hip can never push it through and a sleeve's edge is straight.
// The meshes' own topology is not trusted (their panels meet with gaps and their edges split into fragments): positions
// are welded within a small tolerance, in the template's rest pose.
import * as THREE from 'three';

function worldPositions(mesh) {
  mesh.updateWorldMatrix(true, false);
  const a = mesh.geometry.attributes.position,
    out = new Float64Array(a.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}
const triIndex = g =>
  g.index ? g.index.array : Uint32Array.from({ length: g.attributes.position.count }, (_, i) => i);

/* Nearest-point distances to a point set, through a uniform grid. */
function pointGrid(pos, cell) {
  const grid = new Map(),
    key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < pos.length / 3; i++) {
    const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  return (x, y, z, max) => {
    let best = max;
    const cx = Math.floor(x / cell),
      cy = Math.floor(y / cell),
      cz = Math.floor(z / cell),
      r = Math.ceil(max / cell);
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++)
          for (const i of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
            const d = Math.hypot(pos[i * 3] - x, pos[i * 3 + 1] - y, pos[i * 3 + 2] - z);
            if (d < best) best = d;
          }
    return best;
  };
}

/* The binding tube (trim_mesh): smoothed. As modelled it kinks into flaps where it turns at the shoulders. Each vertex is
   welded to its neighbours (the tube's panels meet with small gaps), then Taubin smoothing relaxes the kinks without
   shrinking the tube (plain Laplacian smoothing shrank it into the jersey). Rest-pose positions in the mesh's own space;
   the skinning weights stay as they are. */
export function smoothTrim(mesh, { steps = 6, lambda = 0.5, tol = 0.002 } = {}) {
  const g = mesh.geometry,
    a = g.attributes.position,
    n = a.count,
    id = new Int32Array(n),
    P = [],
    grid = new Map(),
    cell = v => Math.floor(v / tol);
  for (let i = 0; i < n; i++) {
    const x = a.getX(i),
      y = a.getY(i),
      z = a.getZ(i);
    let w = -1;
    for (let dx = -1; dx <= 1 && w < 0; dx++)
      for (let dy = -1; dy <= 1 && w < 0; dy++)
        for (let dz = -1; dz <= 1 && w < 0; dz++)
          for (const q of grid.get(`${cell(x) + dx},${cell(y) + dy},${cell(z) + dz}`) || [])
            if (Math.hypot(P[q][0] - x, P[q][1] - y, P[q][2] - z) <= tol) {
              w = q;
              break;
            }
    if (w < 0) {
      w = P.length;
      P.push([x, y, z]);
      const k = `${cell(x)},${cell(y)},${cell(z)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(w);
    }
    id[i] = w;
  }
  const nbr = P.map(() => new Set()),
    idx = triIndex(g);
  for (let t = 0; t < idx.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const u = id[idx[t + e]],
        v = id[idx[t + ((e + 1) % 3)]];
      if (u !== v) {
        nbr[u].add(v);
        nbr[v].add(u);
      }
    }
  let cur = P;
  // Taubin smoothing: each shrinking step is followed by an inflating one, so kinks relax without the tube shrinking
  // into the jersey
  for (let it = 0; it < steps * 2; it++) {
    const f = it % 2 ? -(lambda + 0.03) : lambda;
    cur = cur.map((p, w) => {
      if (!nbr[w].size) return p;
      const m = [0, 0, 0];
      for (const q of nbr[w]) for (let k = 0; k < 3; k++) m[k] += cur[q][k] / nbr[w].size;
      return p.map((v, k) => v + f * (m[k] - v));
    });
  }
  for (let i = 0; i < n; i++) a.setXYZ(i, ...cur[id[i]]);
  a.needsUpdate = true;
  g.computeBoundingSphere();
  return cur.length;
}

/* The binding's real openings (neck, armholes, waist, leg hems) and its scraps: the build also swept a tube along a few
   short open edges where the kit's panels meet with gaps, which came out as crumpled bits 2 to 16 cm across (a white Y on
   the hip; the real openings are 26 cm and more). They are not drawn; the skin near them stays drawn (they sit on holes
   in the kit). Pieces are found by welding within 2 mm; a piece under `minSize` across is a scrap. Returns a flag per
   vertex, 1 for a real opening. */
export function trimOpenings(trim, minSize = 0.2) {
  const a = trim.geometry.attributes.position,
    n = a.count,
    id = new Int32Array(n),
    weld = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(a.getX(i) / 0.002)},${Math.round(a.getY(i) / 0.002)},${Math.round(a.getZ(i) / 0.002)}`;
    if (!weld.has(k)) weld.set(k, weld.size);
    id[i] = weld.get(k);
  }
  const up = Int32Array.from({ length: weld.size }, (_, i) => i),
    root = x => {
      while (up[x] !== x) x = up[x] = up[up[x]];
      return x;
    },
    idx = triIndex(trim.geometry);
  for (let t = 0; t < idx.length; t += 3) {
    const r = root(id[idx[t]]);
    up[root(id[idx[t + 1]])] = r;
    up[root(id[idx[t + 2]])] = r;
  }
  const box = new Map();
  for (let i = 0; i < n; i++) {
    const r = root(id[i]);
    if (!box.has(r)) box.set(r, new THREE.Box3());
    box.get(r).expandByPoint(new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)));
  }
  const real = new Map(
      [...box].map(([r, b]) => [r, Math.max(...b.getSize(new THREE.Vector3()).toArray()) >= minSize]),
    ),
    out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = real.get(root(id[i])) ? 1 : 0;
  return out;
}
/* Drops the triangles of a mesh that touch a vertex not kept. */
function keepTriangles(mesh, keep) {
  const g = mesh.geometry,
    idx = triIndex(g),
    out = [];
  for (let t = 0; t < idx.length; t += 3)
    if (keep[idx[t]] && keep[idx[t + 1]] && keep[idx[t + 2]]) out.push(idx[t], idx[t + 1], idx[t + 2]);
  g.setIndex(out);
  return (idx.length - out.length) / 3;
}

/* Whether a skin vertex follows the torso or a thigh most (the skin the kit can lie on). */
function torsoSkin(body) {
  const g = body.geometry,
    bones = body.skeleton?.bones.map(b => b.name) || [],
    torso = new Set(['pelvis', 'spine', 'chest', 'hip_L', 'hip_R']),
    sIdx = g.attributes.skinIndex,
    sW = g.attributes.skinWeight;
  return i => {
    if (!sIdx || !bones.length) return true;
    let best = 0,
      w = -1;
    for (let k = 0; k < 4; k++)
      if (sW.getComponent(i, k) > w) {
        w = sW.getComponent(i, k);
        best = sIdx.getComponent(i, k);
      }
    return torso.has(bones[best]);
  };
}
/* kPush on the binding: the direction to lift each of its vertices off the body (materials.js push), the normal of the
   nearest skin vertex. The tube's own normals point all the way round it; the skin's say which way is out from the body,
   the way the jersey itself is lifted. A vertex with no skin within 12 cm keeps its own normal. */
export function trimPush(trim, body) {
  const tp = worldPositions(trim),
    bp = worldPositions(body),
    bn = body.geometry.attributes.normal,
    tn = trim.geometry.attributes.normal,
    n = trim.geometry.attributes.position.count,
    out = new Float32Array(n * 3),
    CELL = 0.04,
    grid = new Map(),
    key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`,
    toWorld = new THREE.Matrix3().getNormalMatrix(body.matrixWorld),
    toTrim = new THREE.Matrix4().copy(trim.matrixWorld).invert(),
    v = new THREE.Vector3();
  // only skin the kit lies on (torso and thighs): in the rest pose the hands hang beside the shorts, palms in, and the arms
  // pass through the armholes; their normals would push the binding into the body
  const torso = torsoSkin(body);
  for (let i = 0; i < bp.length / 3; i++) {
    if (!torso(i)) continue;
    const k = key(bp[i * 3], bp[i * 3 + 1], bp[i * 3 + 2]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  for (let i = 0; i < n; i++) {
    const x = tp[i * 3],
      y = tp[i * 3 + 1],
      z = tp[i * 3 + 2],
      cx = Math.floor(x / CELL),
      cy = Math.floor(y / CELL),
      cz = Math.floor(z / CELL);
    let best = 0.12,
      at = -1;
    for (let dx = -3; dx <= 3; dx++)
      for (let dy = -3; dy <= 3; dy++)
        for (let dz = -3; dz <= 3; dz++)
          for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
            const d = Math.hypot(bp[j * 3] - x, bp[j * 3 + 1] - y, bp[j * 3 + 2] - z);
            if (d < best) {
              best = d;
              at = j;
            }
          }
    if (at < 0) v.fromBufferAttribute(tn, i);
    else v.fromBufferAttribute(bn, at).applyMatrix3(toWorld).transformDirection(toTrim);
    v.normalize();
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  trim.geometry.setAttribute('kPush', new THREE.BufferAttribute(out, 3));
  return out;
}

/* kCover on the body skin: which clothing (slot 0 kit, 1 arm sleeve, 2 leg sleeve) is over each skin vertex. A short ray
   out along the skin's normal must hit that clothing, and (for the kit) away from its openings. */
export function coverField(body, cloths, trim) {
  const g = body.geometry,
    pos = worldPositions(body),
    nrm = g.attributes.normal,
    n = g.attributes.position.count,
    cover = new Float32Array(n * 3),
    CELL = 0.1,
    grid = new Map(),
    key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`,
    nearTrim = trim ? pointGrid(worldPositions(trim), 0.07) : () => 1;
  for (const { mesh, slot } of cloths) {
    const cp = worldPositions(mesh),
      idx = triIndex(mesh.geometry),
      cn = mesh.geometry.attributes.normal,
      nmc = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let t = 0; t < idx.length; t += 3) {
      const v = [0, 1, 2].map(
          e => new THREE.Vector3(cp[idx[t + e] * 3], cp[idx[t + e] * 3 + 1], cp[idx[t + e] * 3 + 2]),
        ),
        // facing from the mesh's own normals (its winding is not always consistent)
        tri = {
          v,
          slot,
          n: [0, 1, 2]
            .reduce(
              (a, e) => a.add(new THREE.Vector3().fromBufferAttribute(cn, idx[t + e])),
              new THREE.Vector3(),
            )
            .applyMatrix3(nmc)
            .normalize(),
        },
        // into every cell its bounds reach, grown by the ray's length (a skin vertex looks up only its own cell)
        lo = [0, 1, 2].map(k => Math.floor((Math.min(...v.map(p => p.getComponent(k))) - 0.075) / CELL)),
        hi = [0, 1, 2].map(k => Math.floor((Math.max(...v.map(p => p.getComponent(k))) + 0.075) / CELL));
      for (let x = lo[0]; x <= hi[0]; x++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let z = lo[2]; z <= hi[2]; z++) {
            const k = `${x},${y},${z}`;
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(tri);
          }
    }
  }
  // which bones the kit can cover: a hand or forearm hanging beside the shorts in the rest pose never is under them
  const kitBone = torsoSkin(body);
  const ray = new THREE.Ray(),
    hit = new THREE.Vector3(),
    N = new THREE.Vector3(),
    o = new THREE.Vector3(),
    nm = new THREE.Matrix3().getNormalMatrix(body.matrixWorld);
  for (let i = 0; i < n; i++) {
    N.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    o.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    // skin near an opening stays drawn: through an armhole or under a hem it can be seen (asked only when it matters)
    let open = null;
    ray.set(o.clone().addScaledVector(N, -0.004), N);
    for (const tri of grid.get(key(o.x, o.y, o.z)) || []) {
      if (cover[i * 3 + tri.slot] || (tri.slot === 0 && !kitBone(i))) continue;
      if (tri.slot === 0 && (open ??= nearTrim(o.x, o.y, o.z, 0.07) < 0.07)) continue;
      // the cloth must lie over the skin (a loose jersey hangs a few cm off it) and face the same way: an arm hanging beside the
      // shorts in the rest pose looks at the shorts' outside, which faces back at it
      if (tri.n.dot(N) < 0.5) continue;
      const p = ray.intersectTriangle(tri.v[0], tri.v[1], tri.v[2], false, hit);
      if (p && p.distanceTo(o) < 0.07) cover[i * 3 + tri.slot] = 1;
    }
  }
  // the sleeves (slots 1 and 2): every skin vertex of the limb a sleeve follows is marked; the skin shader hides it only
  // between the sleeve's planes (sleeveRims), so the edge is a straight line across the limb wherever the skin's
  // triangles end (marking only the skin a ray finds under the sleeve left a zig-zag of skin poking through at its rim)
  for (const { mesh, slot } of cloths) {
    if (slot === 0) continue;
    const limb = sleeveBones(mesh, body);
    for (let i = 0; i < n; i++) cover[i * 3 + slot] = limb(i) ? 1 : 0;
  }
  g.setAttribute('kCover', new THREE.BufferAttribute(cover, 3));
  return cover;
}
/* Which skin vertices follow the bones a sleeve follows (most of its weight on one of them). */
function sleeveBones(sleeve, body) {
  const names = sleeve.skeleton?.bones.map(b => b.name) || [],
    si = sleeve.geometry.attributes.skinIndex,
    count = new Map();
  if (si)
    for (let i = 0; i < si.count; i++) count.set(names[si.getX(i)], (count.get(names[si.getX(i)]) || 0) + 1);
  const total = si?.count || 1,
    limb = new Set([...count].filter(([, c]) => c > total * 0.1).map(([b]) => b)),
    bones = body.skeleton?.bones.map(b => b.name) || [],
    bi = body.geometry.attributes.skinIndex,
    bw = body.geometry.attributes.skinWeight;
  return i => {
    if (!bi) return false;
    let best = 0;
    for (let k = 1; k < 4; k++) if (bw.getComponent(i, k) > bw.getComponent(i, best)) best = k;
    return limb.has(bones[bi.getComponent(i, best)]);
  };
}
/* A sleeve's two planes in the bind pose (heights; the limbs hang straight, so a height is a cut across the limb): the top
   is the lowest point of its top rim all the way round, the bottom the highest point of its bottom rim, so the sleeve is
   whole between them. The sleeve is drawn and the skin under it hidden between the same two planes (materials.js cut,
   kArmRim/kLegRim): a straight, clean edge. */
export function sleeveRims(sleeve) {
  const p = sleeve.geometry.attributes.position;
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < p.count; i++) {
    lo = Math.min(lo, p.getY(i));
    hi = Math.max(hi, p.getY(i));
  }
  const rim = end => {
    const near = [];
    for (let i = 0; i < p.count; i++) if (end > 0 ? p.getY(i) > hi - 0.1 : p.getY(i) < lo + 0.1) near.push(i);
    let cx = 0,
      cz = 0;
    for (const i of near) {
      cx += p.getX(i) / near.length;
      cz += p.getZ(i) / near.length;
    }
    const bins = new Array(16).fill(end > 0 ? -Infinity : Infinity);
    for (const i of near) {
      const k =
        Math.floor(((Math.atan2(p.getZ(i) - cz, p.getX(i) - cx) + Math.PI) / (2 * Math.PI)) * 16) % 16;
      bins[k] = end > 0 ? Math.max(bins[k], p.getY(i)) : Math.min(bins[k], p.getY(i));
    }
    const f = bins.filter(Number.isFinite);
    return end > 0 ? Math.min(...f) : Math.max(...f);
  };
  return { top: rim(1), bottom: rim(-1) };
}

/* The hands, for the finger curl (materials.js patch, hands): the rigid hand hangs straight down in the bind pose, palm
   to the thigh, width front to back. Per hand: the wrist bone's index in the skin's skeleton, the knuckle line (a pivot
   about 45% of the way from the wrist to the fingertips) and the fingers' length below it. Bind space of body_mesh. */
export function handFit(body) {
  const sk = body.skeleton,
    g = body.geometry,
    p = g.attributes.position,
    si = g.attributes.skinIndex,
    sw = g.attributes.skinWeight;
  if (!sk || !si) return null;
  const out = {};
  for (const side of ['R', 'L']) {
    const wi = sk.bones.findIndex(b => b.name === `wrist_${side}`);
    if (wi < 0) return null;
    const joint = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[wi].clone().invert()),
      pts = [];
    for (let i = 0; i < p.count; i++)
      if (si.getX(i) === wi && sw.getX(i) > 0.99) pts.push([p.getX(i), p.getY(i), p.getZ(i)]);
    if (pts.length < 20) return null;
    const tip = Math.min(...pts.map(q => q[1])),
      knY = joint.y - 0.45 * (joint.y - tip),
      ring = pts.filter(q => Math.abs(q[1] - knY) < 0.012),
      mean = k => ring.reduce((a, q) => a + q[k], 0) / Math.max(1, ring.length);
    out[side] = { wrist: wi, knuckle: [mean(0), knY, mean(2)], length: knY - tip };
  }
  return out;
}

/* Works the attributes out for a loaded athlete template (gltf), once. Every level of detail gets its own. */
export function prepareCloth(template) {
  template.userData ??= {};
  if (template.userData.clothFit) return template.userData.clothFit;
  const scene = template.scene,
    named = {};
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (o.isMesh && o.name) named[o.name] = o;
  });
  const out = { covered: {} },
    openings = named.trim_mesh ? trimOpenings(named.trim_mesh) : null;
  if (openings) out.scraps = openings.length - openings.reduce((s, v) => s + v, 0);
  // the far mesh (scripts/player_lods.mjs) keeps the near mesh's vertices and only drops triangles: copy, do not redo
  const sameVerts = (a, b) =>
    a &&
    b &&
    a.geometry.attributes.position.array.length === b.geometry.attributes.position.array.length &&
    a.geometry.attributes.position.array.every((x, i) => x === b.geometry.attributes.position.array[i]);
  for (const lod of ['', '_lod1']) {
    const trim = named[`trim_mesh${lod}`],
      jersey = named[`jersey_mesh${lod}`],
      shorts = named[`shorts_mesh${lod}`],
      arm = named[`sleeve_arm_mesh${lod}`],
      leg = named[`sleeve_leg_mesh${lod}`],
      body = named[`body_mesh${lod}`];
    // the far mesh keeps the near mesh's vertices (scripts/player_lods.mjs): copy what was worked out for it
    if (lod && sameVerts(named.body_mesh, body) && named.body_mesh.geometry.attributes.kCover) {
      body.geometry.setAttribute('kCover', named.body_mesh.geometry.attributes.kCover);
    } else if (body)
      out.covered[`body${lod}`] = coverField(
        body,
        [
          jersey && { mesh: jersey, slot: 0 },
          shorts && { mesh: shorts, slot: 0 },
          arm && { mesh: arm, slot: 1 },
          leg && { mesh: leg, slot: 2 },
        ].filter(Boolean),
        // every piece of the binding counts as an opening, the scraps too: they sit on holes in the kit, where the skin
        // under them must stay drawn or the hole would show through the body (the scraps themselves are not drawn)
        named.trim_mesh,
      ).reduce((c, v, i) => ((c[i % 3] += v), c), [0, 0, 0]);
    if (trim) {
      // the scraps go (the far mesh keeps the near mesh's vertices, so the same flags fit it)
      if (openings && trim.geometry.attributes.position.count === openings.length)
        keepTriangles(trim, openings);
      smoothTrim(trim); // after the coverage, which reads where the openings are from the tube as modelled
      if (lod && sameVerts(named.trim_mesh, trim) && named.trim_mesh.geometry.attributes.kPush)
        trim.geometry.setAttribute('kPush', named.trim_mesh.geometry.attributes.kPush);
      else if (body) trimPush(trim, body);
    }
  }
  if (named.body_mesh) out.hands = handFit(named.body_mesh);
  // the sleeves' planes (bind pose heights)
  out.sleeves = {};
  if (named.sleeve_arm_mesh) out.sleeves.arm = sleeveRims(named.sleeve_arm_mesh);
  if (named.sleeve_leg_mesh) out.sleeves.leg = sleeveRims(named.sleeve_leg_mesh);
  // the shorts' height range in the bind pose, for their sway (materials.js sway): waistband to hem
  if (named.shorts_mesh) {
    const a = named.shorts_mesh.geometry.attributes.position;
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < a.count; i++) {
      lo = Math.min(lo, a.getY(i));
      hi = Math.max(hi, a.getY(i));
    }
    out.shorts = { top: hi, bottom: lo };
  }
  template.userData.clothFit = out;
  return out;
}
