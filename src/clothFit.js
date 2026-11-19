// Clean bindings and no skin through the clothes, worked out once per body variant from the meshes themselves (the
// Houdini source is not needed):
//   the binding tube (trim_mesh round the neck, armholes and hems) is smoothed and thinned (smoothTrim): as modelled it
//          kinked into flaps at the shoulders and stood off the jersey like a hose
//   kCover (a vertex attribute on the body skin) x, y, z: the skin vertex is under the kit (jersey or shorts), an arm
//          sleeve, a leg sleeve, well away from any opening. The skin shader (materials.js patch, cover) does not draw
//          skin that is wholly under clothing the player is wearing, so a bending elbow or hip can never push it through.
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
  const bones = body.skeleton?.bones.map(b => b.name) || [],
    torso = new Set(['pelvis', 'spine', 'chest', 'hip_L', 'hip_R']),
    sIdx = g.attributes.skinIndex,
    sW = g.attributes.skinWeight,
    kitBone = i => {
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
  g.setAttribute('kCover', new THREE.BufferAttribute(cover, 3));
  return cover;
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
  const out = { covered: {} };
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
        named.trim_mesh,
      ).reduce((c, v, i) => ((c[i % 3] += v), c), [0, 0, 0]);
    if (trim) smoothTrim(trim); // after the coverage, which reads where the openings are from the tube as modelled
  }
  template.userData.clothFit = out;
  return out;
}
