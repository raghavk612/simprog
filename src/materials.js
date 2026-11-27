// Materials for the 3D athletes (Settings > Player models > 3D athletes) and the ball.
// Fine surface detail (skin pores, perforated jersey mesh, pebbled leather, hair strands) comes from small tiling height maps
// generated here once, applied as bump detail in the shader with triplanar mapping on the model's rest pose, so it stays
// glued to a moving, skinned body and needs no texture downloads. It fades out with distance, where it would only shimmer.
import * as THREE from 'three';

/* ---------- tiling height maps (0..1 in the red channel) ---------- */
const SIZE = 256;
const rand = (x, y, s) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
function valueNoise(x, y, period, seed) {
  // periodic value noise, so the map tiles
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const r = (a, b) => rand(((a % period) + period) % period, ((b % period) + period) % period, seed);
  return (
    (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) +
    (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v
  );
}
function heightTexture(fn) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const h = Math.max(0, Math.min(1, fn(x / SIZE, y / SIZE)));
      const i = (y * SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = h * 255;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
const cache = {};
export const MAPS = {
  // skin: fine pores over a soft, larger grain
  skin: () =>
    (cache.skin ??= heightTexture(
      (u, v) =>
        0.55 * valueNoise(u * 64, v * 64, 64, 1) +
        0.3 * valueNoise(u * 16, v * 16, 16, 2) +
        0.15 * (1 - Math.pow(valueNoise(u * 128, v * 128, 128, 3), 0.35)),
    )),
  // athletic mesh: staggered rows of round perforations
  mesh: () =>
    (cache.mesh ??= heightTexture((u, v) => {
      const rows = 24,
        cols = 24,
        r = v * rows,
        row = Math.floor(r),
        c = u * cols + (row % 2 ? 0.5 : 0);
      const dx = c - Math.floor(c) - 0.5,
        dy = r - row - 0.5,
        d = Math.hypot(dx * 1.15, dy);
      return (
        0.25 + 0.75 * Math.min(1, Math.max(0, (d - 0.17) / 0.12)) - 0.05 * valueNoise(u * 48, v * 48, 48, 4)
      );
    })),
  // pebbled leather: rounded bumps in a jittered grid
  pebble: () =>
    (cache.pebble ??= heightTexture((u, v) => {
      const n = 40;
      let best = 9;
      const cx = Math.floor(u * n),
        cy = Math.floor(v * n);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i,
            gy = cy + j,
            px = (gx + rand(((gx % n) + n) % n, ((gy % n) + n) % n, 5)) / n,
            py = (gy + rand(((gx % n) + n) % n, ((gy % n) + n) % n, 6)) / n;
          best = Math.min(best, Math.hypot(u - px, v - py) * n);
        }
      return Math.max(0, 1 - best * 1.25);
    })),
  // hair: fine strands
  strands: () =>
    (cache.strands ??= heightTexture(
      (u, v) => 0.6 * valueNoise(u * 160, v * 6, 160, 7) + 0.4 * valueNoise(u * 60, v * 3, 60, 8),
    )),
};

/* ---------- shader patch: triplanar bump detail on the rest pose, plus optional wrap lighting (subsurface look) ---------- */
export const DETAIL_PARS = `
varying vec3 vKRest; varying vec3 vKRestN;
uniform sampler2D kDetailMap; uniform float kDetailScale; uniform float kDetailBump; uniform float kFadeFar;
float kHeight(vec3 p, vec3 n){
 vec3 w = pow(abs(n), vec3(4.0)); w /= max(w.x + w.y + w.z, 1e-4);
 return texture2D(kDetailMap, p.yz).r * w.x + texture2D(kDetailMap, p.xz).r * w.y + texture2D(kDetailMap, p.xy).r * w.z;
}
vec3 kPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir){
 // a zero screen derivative (a pixel quad on a silhouette or edge-on) would normalise to NaN; the reflection lookups of
 // the environment light then turn that into NaN pixels, which bloom spreads over the whole frame (a black flash)
 vec3 dx = dFdx(surf_pos), dy = dFdy(surf_pos);
 if (dot(dx, dx) < 1e-14 || dot(dy, dy) < 1e-14) return surf_norm;
 vec3 vSigmaX = normalize(dx); vec3 vSigmaY = normalize(dy);
 vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
 float fDet = dot(vSigmaX, R1) * faceDir;
 vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
 vec3 n = abs(fDet) * surf_norm - vGrad;
 return dot(n, n) > 1e-14 ? normalize(n) : surf_norm;
}`;
/* The finger curl (hands): rotation about the knuckle line's front-back axis, more toward the fingertips. The right hand's
   palm faces +x in the bind pose, so its fingers turn toward +x; the left's toward -x. */
const HAND_CURL = `
uniform vec2 kWrist; uniform vec4 kKnR; uniform vec4 kKnL; uniform vec2 kGrip; uniform vec2 kSpread;
vec3 kRotZ(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
float kCurl(vec3 p, out vec3 piv){
 piv = vec3(0.0);
 #ifdef USE_SKINNING
 if (skinWeight.x < 0.99) return 0.0;
 vec4 kn; float g; float sd;
 if (abs(skinIndex.x - kWrist.x) < 0.5) { kn = kKnR; g = kGrip.x; sd = 1.0; }
 else if (abs(skinIndex.x - kWrist.y) < 0.5) { kn = kKnL; g = kGrip.y; sd = -1.0; }
 else return 0.0;
 piv = kn.xyz;
 float below = kn.y - p.y;
 return below > 0.0 ? sd * g * 1.6 * clamp(below / kn.w, 0.0, 1.0) : 0.0;
 #else
 return 0.0;
 #endif
}
// the fingers fanned apart across the hand's width (z in the bind pose, the hand hanging palm in), more toward the tips
float kFan(vec3 p){
 #ifdef USE_SKINNING
 if (skinWeight.x < 0.99) return 0.0;
 vec4 kn; float sp;
 if (abs(skinIndex.x - kWrist.x) < 0.5) { kn = kKnR; sp = kSpread.x; }
 else if (abs(skinIndex.x - kWrist.y) < 0.5) { kn = kKnL; sp = kSpread.y; }
 else return 0.0;
 float below = kn.y - p.y;
 return below > 0.0 ? (p.z - kn.z) * sp * 0.5 * clamp(below / kn.w, 0.0, 1.0) : 0.0;
 #else
 return 0.0;
 #endif
}`;
/* Baked detail maps (src/playerMaps.js) hold the normal in RGB and the ambient occlusion in A of one texture, which is both
   normalMap and aoMap; three's aomap_fragment reads R, so every athlete material reads A instead. kAoFade (0..1) lets the
   painted face take over from the baked AO where it already paints the shadows. */
const AO_ALPHA = THREE.ShaderChunk.aomap_fragment.replace(
  'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;',
  'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).a - 1.0 ) * aoMapIntensity * ( 1.0 - kAoFade ) + 1.0;',
);
const FACE_AO_FADE = 0.8; // how much of the baked AO the painted face replaces
const aoAlpha = frag =>
  frag
    .replace('#include <map_fragment>', '#include <map_fragment>\n float kAoFade = 0.0;')
    .replace('#include <aomap_fragment>', AO_ALPHA);
/* strands: the hair's anisotropic highlight runs along the head's up direction (as it did on the old cylindrical UVs). The
   GLB's tangents now follow the atlas charts, which point anywhere, so the direction is the skinned rest-pose up instead. */
/* inflate (game units): clothing is pushed out along its normals after skinning starts, so the skin under it never pokes
   through when joints bend (the rest-pose gap is only about a centimetre). push: along a direction of its own instead
   (attribute kPush, src/clothFit.js trimPush): the binding is a tube, whose own normals point every way round it, so
   pushing along them made it fatter rather than lifting it off the body. */
/* print: lettering printed into the fabric. Two textures (front and back) projected in the rest pose, so the print moves
   and folds with the jersey and can never sink into the body. material.userData.print holds the uniforms to update. */
function patch(
  material,
  {
    map,
    scale,
    bump,
    fadeFar = 9,
    wrap = 0,
    scatter = [1, 0.42, 0.28],
    face = null,
    inflate = 0,
    print = false,
    strands = false,
    cover = false,
    hands = false,
    sway = false,
    push = false,
    cut = false,
    sock = false,
  } = {},
) {
  // sway: the loose shorts lag and flutter (a spring motion.js drives from the body's acceleration, kSway, in the body's
  // own space), more toward the hem: nothing at the waistband, all of it at the hem (kSwayRange: waist and hem heights)
  if (sway)
    material.userData.sway = {
      kSway: { value: new THREE.Vector3() },
      kSwayRange: { value: new THREE.Vector2(1, 0.7) },
    };
  // hands: the fingers curl toward the palm about the knuckle line (src/clothFit.js handFit), by kGrip per hand (0 open,
  // about 0.45 round the ball, 1 a fist), before skinning: the hand mesh is rigid on the wrist and has no finger joints
  if (hands)
    material.userData.hands = {
      kWrist: { value: new THREE.Vector2(-9, -9) },
      kKnR: { value: new THREE.Vector4(0, 0, 0, 1) },
      kKnL: { value: new THREE.Vector4(0, 0, 0, 1) },
      kGrip: { value: new THREE.Vector2(0.3, 0.3) },
      kSpread: { value: new THREE.Vector2(0, 0) }, // 0 fingers together, 1 spread wide
    };
  // cover: skin wholly under clothing the player wears is not drawn (src/clothFit.js kCover; kCoverOn picks the sleeves).
  // A mesh without the attribute reads zeros: nothing skipped.
  if (cover)
    material.userData.coverOn = Object.assign(
      { value: new THREE.Vector3(1, 0, 0) },
      // the sleeves' planes (src/clothFit.js sleeveRims): skin of the sleeved limb between them is not drawn, for a
      // straight edge (x top, y bottom, in the bind pose; the arm hangs, so they run across the limb)
      { kArmRim: { value: new THREE.Vector2(-9, 9) }, kLegRim: { value: new THREE.Vector2(-9, 9) } },
    );
  // sock: a sock drawn on the skin of the lower leg (no geometry), up to a line of the bind pose (kSockY.x), with a ribbed
  // cuff kSockY.y deep, in kSockC.rgb (kSockC.w 0: no sock). src/players.js setFeet sets it.
  if (sock)
    material.userData.sock = {
      kSockC: { value: new THREE.Vector4(1, 1, 1, 0) },
      kSockY: { value: new THREE.Vector2(0, 0.02) },
    };
  // cut: a sleeve drawn only between two heights of the bind pose (the same planes the skin is hidden between)
  if (cut) material.userData.cut = { value: new THREE.Vector2(9, -9) };
  if (print)
    material.userData.print = {
      kPrintF: { value: null },
      kPrintB: { value: null },
      kPrintFC: { value: new THREE.Vector2() },
      kPrintBC: { value: new THREE.Vector2() },
      kPrintSize: { value: new THREE.Vector2(1, 1) },
      kPrintMinY: { value: 0 },
      kPrintOn: { value: 0 },
    };
  // bumpU is live: the baked detail maps (src/playerMaps.js) scale it down where they carry the same detail
  const bumpU = { value: bump };
  material.userData.kDetail = { map, scale, bump, wrap, bumpU };
  if (face) material.userData.face = face;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      kDetailMap: { value: map },
      kDetailScale: { value: scale },
      kDetailBump: bumpU,
      kFadeFar: { value: fadeFar },
    });
    if (face)
      Object.assign(shader.uniforms, {
        kFaceMap: { value: face.map },
        kFaceCenter: { value: face.center },
        kFaceSize: { value: face.size },
      });
    if (print) Object.assign(shader.uniforms, material.userData.print);
    if (cover) {
      shader.uniforms.kCoverOn = material.userData.coverOn;
      shader.uniforms.kArmRim = material.userData.coverOn.kArmRim;
      shader.uniforms.kLegRim = material.userData.coverOn.kLegRim;
    }
    if (cut) shader.uniforms.kCut = material.userData.cut;
    if (sock) Object.assign(shader.uniforms, material.userData.sock);
    if (hands) Object.assign(shader.uniforms, material.userData.hands);
    if (sway) Object.assign(shader.uniforms, material.userData.sway);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vKRest; varying vec3 vKRestN;' +
          (strands ? ' varying vec3 vKUp;' : '') +
          (cover ? ' attribute vec3 kCover; varying vec3 vKCover;' : '') +
          (hands ? HAND_CURL : '') +
          (sway ? ' uniform vec3 kSway; uniform vec2 kSwayRange;' : '') +
          (push ? ' attribute vec3 kPush;' : ''),
      )
      .replace(
        '#include <skinnormal_vertex>',
        strands
          ? `#include <skinnormal_vertex>
 vec3 kUp = vec3(0.0, 1.0, 0.0);
 #ifdef USE_SKINNING
  kUp = (skinMatrix * vec4(kUp, 0.0)).xyz;
 #endif
 vKUp = normalize((modelViewMatrix * vec4(kUp, 0.0)).xyz);`
          : '#include <skinnormal_vertex>',
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>' +
          (hands
            ? `\n { vec3 kPiv; float kA = kCurl(position, kPiv); objectNormal = kRotZ(objectNormal, kA);
  #ifdef USE_TANGENT
  objectTangent = kRotZ(objectTangent, kA);
  #endif
 }`
            : '') +
          '\nvKRestN = objectNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>' +
          (hands
            ? '\n { transformed.z += kFan(position); vec3 kPiv; float kA = kCurl(position, kPiv); if (kA != 0.0) transformed = kPiv + kRotZ(transformed - kPiv, kA); }'
            : '') +
          '\nvKRest = transformed;' +
          (sway
            ? '\n { float kW = clamp((kSwayRange.x - position.y) / max(kSwayRange.x - kSwayRange.y, 1e-3), 0.0, 1.0); transformed += kSway * kW * kW; }'
            : '') +
          (cover ? '\nvKCover = kCover;' : '') +
          (inflate > 0 ? `\ntransformed += ${push ? 'kPush' : 'objectNormal'} * ${inflate.toFixed(4)};` : ''),
      );
    let frag = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\n' +
          DETAIL_PARS +
          (strands ? '\nvarying vec3 vKUp;' : '') +
          (cover
            ? '\nvarying vec3 vKCover; uniform vec3 kCoverOn; uniform vec2 kArmRim; uniform vec2 kLegRim;'
            : '') +
          (cut ? '\nuniform vec2 kCut;' : '') +
          (sock ? '\nuniform vec4 kSockC; uniform vec2 kSockY;' : '') +
          (face ? '\nuniform sampler2D kFaceMap; uniform vec3 kFaceCenter; uniform vec2 kFaceSize;' : '') +
          (print
            ? '\nuniform sampler2D kPrintF; uniform sampler2D kPrintB; uniform vec2 kPrintFC; uniform vec2 kPrintBC; uniform vec2 kPrintSize; uniform float kPrintMinY; uniform float kPrintOn;'
            : ''),
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
 {
  float kFade = 1.0 - smoothstep(kFadeFar * 0.35, kFadeFar, length(vViewPosition));
  if (kFade > 0.0) {
   float h = kHeight(vKRest * kDetailScale, normalize(vKRestN));
   normal = kPerturb(-vViewPosition, normal, vec2(dFdx(h), dFdy(h)) * kDetailBump * kFade, faceDirection);
  }
 }`,
      );
    // sock: the colour over the skin below the sock line (an antialiased edge), then knit ribs running up the leg (the
    // triplanar bump on the rest pose, across the leg seen from the front and from the side), deepest in the cuff
    if (sock)
      frag = frag
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
 float kSock = 0.0, kRib = 0.0;
 if (kSockC.w > 0.5) {
  float e = max(fwidth(vKRest.y), 1e-4);
  kSock = 1.0 - smoothstep(kSockY.x - e, kSockY.x + e, vKRest.y);
  kRib = kSock * smoothstep(kSockY.x - kSockY.y - e, kSockY.x - kSockY.y + e, vKRest.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, kSockC.rgb * (1.0 - 0.07 * kRib), kSock);
 }`,
        )
        .replace(
          '#include <clearcoat_normal_fragment_begin>',
          ` if (kSock > 0.0) {
  float kRf = 1.0 - smoothstep(1.2, 4.0, length(vViewPosition));
  if (kRf > 0.0) {
   vec3 rn = normalize(vKRestN);
   float wx = rn.x * rn.x, wz = rn.z * rn.z, f = 6.2831853 / 0.0055;
   float h = (wz * sin(vKRest.x * f) + wx * sin(vKRest.z * f)) / max(wx + wz, 1e-3);
   normal = kPerturb(-vViewPosition, normal, vec2(dFdx(h), dFdy(h)) * (0.06 + 0.16 * kRib) * kSock * kRf, faceDirection);
  }
 }
#include <clearcoat_normal_fragment_begin>`,
        )
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>
 material.roughness = mix(material.roughness, 0.92, kSock);
 material.specularColor *= 1.0 - 0.6 * kSock;
 #ifdef USE_CLEARCOAT
 material.clearcoat *= 1.0 - kSock;
 #endif`,
        );
    // face: features painted straight onto the head (projected from the front in the rest pose), so they share the skin's lighting.
    // The map holds two layers (see faceTexture): the top half for skin facing forward (features, soft shadows), the bottom
    // half for skin facing down (shadow under the brow, nose, lower lip and jaw), which a front projection would otherwise smear.
    if (face)
      frag = frag.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
 {
  vec2 fuv = (vKRest.xy - kFaceCenter.xy) / kFaceSize + 0.5;
  vec3 fn = normalize(vKRestN);
  float inFront = step(kFaceCenter.z - 0.12, vKRest.z);
  float front = smoothstep(0.15, 0.55, fn.z) * inFront, down = smoothstep(0.3, 0.75, -fn.y) * inFront;
  if (front + down > 0.0 && fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
   float edge = smoothstep(0.0, 0.15, fuv.x) * smoothstep(1.0, 0.85, fuv.x) * smoothstep(0.0, 0.12, fuv.y) * smoothstep(1.0, 0.88, fuv.y);
   kAoFade = ${FACE_AO_FADE.toFixed(2)} * clamp(front + down, 0.0, 1.0) * edge;
   vec4 f = texture2D(kFaceMap, vec2(fuv.x, 0.5 + fuv.y * 0.5));
   diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * front);
   vec4 d = texture2D(kFaceMap, vec2(fuv.x, fuv.y * 0.5));
   diffuseColor.rgb = mix(diffuseColor.rgb, d.rgb, d.a * down);
  }
 }`,
      );
    if (print)
      frag = frag.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
 if (kPrintOn > 0.5 && vKRest.y > kPrintMinY) {
  vec3 rn = normalize(vKRestN);
  vec2 fu = vec2((vKRest.x - kPrintFC.x) / kPrintSize.x + 0.5, (vKRest.y - kPrintFC.y) / kPrintSize.y + 0.5);
  float fm = smoothstep(0.05, 0.35, rn.z) * step(0.0, fu.x) * step(fu.x, 1.0) * step(0.0, fu.y) * step(fu.y, 1.0);
  if (fm > 0.0) { vec4 f = texture2D(kPrintF, fu); diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * fm); }
  vec2 bu = vec2(-(vKRest.x - kPrintBC.x) / kPrintSize.x + 0.5, (vKRest.y - kPrintBC.y) / kPrintSize.y + 0.5);
  float bm = smoothstep(0.05, 0.35, -rn.z) * step(0.0, bu.x) * step(bu.x, 1.0) * step(0.0, bu.y) * step(bu.y, 1.0);
  if (bm > 0.0) { vec4 f = texture2D(kPrintB, bu); diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * bm); }
 }`,
      );
    if (strands)
      frag = frag.replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
 #ifdef USE_ANISOTROPY
 {
  vec3 kB = vKUp - normal * dot(vKUp, normal);
  kB = dot(kB, kB) > 1e-6 ? normalize(kB) : normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
  vec3 kT = normalize(cross(kB, normal));
  vec2 kA = anisotropyVector / max(length(anisotropyVector), 1e-4);
  material.anisotropyT = kT * kA.x + kB * kA.y;
  material.anisotropyB = kB * kA.x - kT * kA.y;
 }
 #endif`,
      );
    if (cover)
      frag = frag.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
 if (vKCover.x * kCoverOn.x > 0.999) discard;
 if (vKCover.y * kCoverOn.y > 0.5 && vKRest.y < kArmRim.x && vKRest.y > kArmRim.y) discard;
 if (vKCover.z * kCoverOn.z > 0.5 && vKRest.y < kLegRim.x && vKRest.y > kLegRim.y) discard;`,
      );
    if (cut)
      frag = frag.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
 if (vKRest.y > kCut.x || vKRest.y < kCut.y) discard;`,
      );
    frag = aoAlpha(frag);
    if (wrap > 0)
      frag = frag.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
 #if NUM_DIR_LIGHTS > 0
 for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
  float ndl = dot(normal, directionalLights[i].direction);
  float wrapped = max(0.0, (ndl + ${wrap.toFixed(3)}) / ${(1 + wrap).toFixed(3)}) - max(0.0, ndl);
  reflectedLight.directDiffuse += directionalLights[i].color * wrapped * diffuseColor.rgb * vec3(${scatter.map(v => v.toFixed(3)).join(',')})${sock ? ' * (1.0 - 0.7 * kSock)' : ''};
 }
 #endif`,
      );
    shader.fragmentShader = frag;
  };
  material.customProgramCacheKey = () =>
    `kangs-${map.uuid}-${wrap}-${face ? 1 : 0}-${inflate}-${print ? 1 : 0}-${strands ? 1 : 0}-${cover ? 1 : 0}-${hands ? 1 : 0}-${sway ? 1 : 0}-${push ? 1 : 0}-${cut ? 1 : 0}-${sock ? 1 : 0}`;
  return material;
}

/* ---------- the materials ---------- */
// Skin: physically based, light wrap (soft subsurface look, reddish where light bleeds round the edge), fine pores and a slight sweat sheen.
// F0 = 0.028 (ior 1.4 at full specular intensity), the value measured for skin (GPU Gems 3, ch. 14); roughness .55.
export function skinMaterial(color, face = null) {
  return patch(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      ior: 1.4,
      specularIntensity: 1,
      clearcoat: 0.1,
      clearcoatRoughness: 0.35,
      name: 'skin',
    }),
    {
      map: MAPS.skin(),
      scale: 9,
      bump: 0.35,
      fadeFar: 7,
      wrap: 0.35,
      scatter: [0.75, 0.32, 0.22],
      face,
      cover: true,
      hands: true,
      sock: true,
    },
  );
}
export const KIT_INFLATE = 0.012; // how far the jersey and shorts are pushed off the skin (decals sit on top of it)
// Jersey and shorts: soft cloth sheen and the perforated athletic mesh.
export function clothMaterial(color) {
  return patch(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.74,
      sheen: 0.28,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0.75, 0.75, 0.8),
      specularIntensity: 0.3,
      name: 'kit',
    }),
    { map: MAPS.mesh(), scale: 22, bump: 0.18, fadeFar: 3.2, inflate: KIT_INFLATE, print: true, sway: true },
  );
}
// Shoes: smooth leather-like upper with a little gloss, matte rubber below; coloured by zone from a colourway (src/kits.js)
// in the shader. The zones (src/clothFit.js shoeZones and shoeZoneAt; keep SHOE_ZONE_GLSL alike) are worked out per
// variant in the bind pose, so they stay on the shoe as it moves. Zones: 0 upper, 1 toe box, 2 heel counter, 3 side panel,
// 4 midsole band, 5 outsole. The upper and the sole share one set of uniforms (shoeUniforms) per body.
export function shoeUniforms() {
  return {
    kShoeCol: { value: [0xf4f4f4, 0xf4f4f4, 0xf4f4f4, 0x1d1d22].map(c => new THREE.Color(c)) },
    kShoeZ0: { value: new THREE.Vector4(-9, 9, -9, 9) }, // heel, toe, heel counter's front edge, toe box's back edge
    kShoeZ1: { value: new THREE.Vector4(-1, -1, 1, 0.13) }, // midsole band low and high, collar, side panel width
    kShoeZ2: { value: new THREE.Vector4(0.3, 0.74, 0.62, 0.22) }, // side panel: t0, t1, h0, h1
  };
}
/* The variant's zones (src/clothFit.js shoeZones) into the uniforms. */
export function setShoeZones(u, z, panelWidth = 0.13) {
  if (!z) return;
  u.kShoeZ0.value.set(z.heel, z.toe, z.counter, z.toeBox);
  u.kShoeZ1.value.set(z.band[0], z.band[1], z.collar, panelWidth);
  u.kShoeZ2.value.set(z.panel.t0, z.panel.t1, z.panel.h0, z.panel.h1);
}
/* A colourway [upper, accent, midsole band, outsole] (hex or CSS colours) into the uniforms. */
export const setShoeColours = (u, colourway) => colourway.forEach((c, k) => u.kShoeCol.value[k].set(c));
export const SHOE_ZONE_GLSL = `
uniform vec3 kShoeCol[4]; uniform vec4 kShoeZ0; uniform vec4 kShoeZ1; uniform vec4 kShoeZ2;
varying vec3 vKShoeP; varying vec3 vKShoeN;
int kShoeZone(vec3 p, vec3 n, bool sole){
 if (p.y < kShoeZ1.x) return 5;
 if (p.y < kShoeZ1.y || sole) return 4;
 float t = (p.z - kShoeZ0.x) / (kShoeZ0.y - kShoeZ0.x), h = (p.y - kShoeZ1.y) / (kShoeZ1.z - kShoeZ1.y);
 if (p.z < kShoeZ0.z && h < 0.85) return 2;
 if (p.z > kShoeZ0.w) return 1;
 if (abs(n.x) > 0.4 && t > kShoeZ2.x && t < kShoeZ2.y) {
  float s = (t - kShoeZ2.x) / (kShoeZ2.y - kShoeZ2.x);
  if (abs(h - mix(kShoeZ2.z, kShoeZ2.w, s)) < kShoeZ1.w * (1.0 - 0.55 * s)) return 3;
 }
 return 0;
}`;
function shoePatch(material, u, sole) {
  material.userData.shoe = u;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKShoeP; varying vec3 vKShoeN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvKShoeN = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKShoeP = transformed;');
    shader.fragmentShader = aoAlpha(
      shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SHOE_ZONE_GLSL)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
 float kZR = 0.36, kZC = 1.0;
 {
  int z = kShoeZone(vKShoeP, normalize(vKShoeN), ${sole ? 'true' : 'false'});
  vec3 c = kShoeCol[0];
  if (z == 1) { c = mix(kShoeCol[0], kShoeCol[1], 0.35); kZR = 0.46; kZC = 0.8; }
  else if (z == 2) { c = kShoeCol[1]; kZR = 0.32; }
  else if (z == 3) { c = kShoeCol[1]; kZR = 0.4; }
  else if (z == 4) { c = kShoeCol[2]; kZR = 0.55; kZC = 0.0; }
  else if (z == 5) { c = kShoeCol[3]; kZR = 0.85; kZC = 0.0; }
  diffuseColor.rgb *= c;
 }`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\n roughnessFactor = kZR;',
        )
        .replace(
          '#include <lights_physical_fragment>',
          '#include <lights_physical_fragment>\n #ifdef USE_CLEARCOAT\n material.clearcoat *= kZC;\n #endif',
        ),
    );
  };
  material.customProgramCacheKey = () => `kangs-shoe-${sole ? 1 : 0}`;
  return material;
}
export const shoeMaterial = (u = shoeUniforms()) =>
  shoePatch(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.36,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
      name: 'shoes',
    }),
    u,
    false,
  );
export const soleMaterial = (u = shoeUniforms()) =>
  shoePatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, name: 'sole' }), u, true);
// Hair: soft highlight that runs round the head (anisotropic), fine strands.
export function hairMaterial(color) {
  return patch(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.48,
      anisotropy: 0.65,
      anisotropyRotation: Math.PI / 2,
      sheen: 0.3,
      sheenColor: new THREE.Color(0.35, 0.3, 0.28),
      name: 'hair',
    }),
    { map: MAPS.strands(), scale: 14, bump: 0.8, fadeFar: 6, strands: true },
  );
}
// Sleeves and headband: compression fabric, smoother and a touch shinier than the jersey. The binding (trim) uses it too,
// lifted off the body a little further than the jersey (KIT_INFLATE) along the body's normal (push), so it rides on the
// cloth's edge, at the width it was modelled, instead of dipping under it.
export const TRIM_INFLATE = 0.014;
export const fabricMaterial = (color, inflate = 0.01, { push = false, sway = false, cut = false } = {}) =>
  patch(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      sheen: 0.4,
      sheenRoughness: 0.35,
      name: 'sleeve',
    }),
    { map: MAPS.mesh(), scale: 30, bump: 0.15, fadeFar: 3, inflate, push, sway, cut },
  );
// Ball: pebbled orange leather.
export function ballMaterial() {
  return patch(
    new THREE.MeshPhysicalMaterial({
      color: 0xd9661e,
      roughness: 0.62,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      name: 'ball',
    }),
    { map: MAPS.pebble(), scale: 6, bump: 0.55, fadeFar: 6 },
  );
}

/* ---------- jersey lettering: transparent, outlined, on a plane bent to the chest ---------- */
export function letteringTexture(
  text,
  fill,
  stroke,
  {
    w = 256,
    h = 256,
    font = '"Barlow Condensed","Arial Narrow",Arial,sans-serif',
    weight = 800,
    italic = false,
  } = {},
) {
  if (typeof document === 'undefined') return new THREE.Texture(); // tests run without a page
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d'),
    t = new THREE.CanvasTexture(c);
  const draw = () => {
    x.clearRect(0, 0, w, h);
    let size = h * 0.9;
    x.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
    const width = x.measureText(text).width;
    if (width > w * 0.9) {
      size *= (w * 0.9) / width;
      x.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
    }
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = Math.max(4, size * 0.1);
    x.strokeStyle = stroke;
    x.strokeText(text, w / 2, h * 0.54);
    x.fillStyle = fill;
    x.fillText(text, w / 2, h * 0.54);
    t.needsUpdate = true;
  };
  draw();
  document.fonts
    ?.load(`${weight} 64px "Barlow Condensed"`)
    .then(draw)
    .catch(() => {});
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// A plane that wraps round a cylinder of the given radius (front of the chest or back), so decals sit on the fabric.
export function bentPlane(width, height, radius) {
  const g = new THREE.PlaneGeometry(width, height, 12, 1),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      drop = radius > 0 ? radius - Math.sqrt(Math.max(radius * radius - x * x, 0)) : 0;
    p.setZ(i, -drop);
  } /* edges fall back toward the body (also on the back plate, which is turned round) */
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
export function decalMaterial(map) {
  return new THREE.MeshPhysicalMaterial({
    map,
    transparent: true,
    alphaTest: 0.35,
    roughness: 0.6,
    sheen: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
    name: 'decal',
  });
}

/* ---------- painted face: brows, eyes, nose, lips and soft shadows, in tones taken from the skin ----------
   The texture covers a frame on the front of the head, projected straight from the front in the rest pose (see patch).
   Features are placed in millimetres on the head's own landmark rows (scripts/build_players.py writes them to the model as
   extras.faceMarks: fractions of the frame from the top; pupil, mouthHalf and noseHalf as fractions of its width), so they
   sit on the geometry: eyes on the closed-lid bulge inside the sockets, lips on the mouth line. The shadows the sockets,
   nose, lower lip and jaw would get from ambient light are painted in (ambient occlusion), soft and low-frequency, because
   at 15-35 pixels value reads and detail does not. Young faces: no creases, no lines beside the nose. */
export const FACE_MARKS = {
  brow: 0.151,
  eye: 0.213,
  nose: 0.513,
  mouth: 0.62,
  chin: 0.903,
  pupil: 0.229,
  mouthHalf: 0.181,
  noseHalf: 0.14,
  aspect: 0.776,
};
export function faceTexture(skinHex, seed = 0, marks = FACE_MARKS) {
  if (typeof document === 'undefined') return new THREE.Texture();
  // two layers, one above the other: front-facing skin (top half) and down-facing skin (bottom half), see patch()
  const M = { ...FACE_MARKS, ...marks },
    W = 256,
    HH = Math.round(W / M.aspect),
    c = document.createElement('canvas');
  c.width = W;
  c.height = HH * 2;
  const x = c.getContext('2d');
  const base = new THREE.Color(skinHex),
    hex = col => '#' + col.getHexString();
  const tone = f => hex(base.clone().multiplyScalar(f)),
    r = n => {
      const v = Math.sin(seed * 91.7 + n * 13.1) * 43758.5;
      return v - Math.floor(v);
    };
  // millimetres on the head -> pixels: X across from the midline, rows from the landmark marks, Y(row, mm up from it)
  const mm = (W * M.pupil) / 33,
    X = d => W / 2 + d * mm,
    Y = (row, up = 0) => row * HH - up * mm,
    local = y => Y(M.eye, y - 26.5); // local: head-local y (mm), eye line +26.5
  const blob = (cx, cy, rx, ry, color, alpha, soft = 0.6) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, 1);
    g.addColorStop(0, color);
    g.addColorStop(soft, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save();
    x.translate(cx, cy);
    x.scale(rx, ry);
    x.translate(-cx, -cy);
    x.globalAlpha = alpha;
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, 1, 0, Math.PI * 2);
    x.fill();
    x.restore();
  };
  const B = (dx, row, up, rx, ry, color, alpha, soft) =>
    blob(X(dx), Y(row, up), rx * mm, ry * mm, color, alpha, soft); // a blob placed in mm
  // per-player variety, kept small (millimetres): brow height and weight, eye spacing and size, mouth height, iris colour
  const browUp = (r(1) - 0.5) * 3,
    spread = (r(2) - 0.5) * 2,
    mouthUp = (r(3) - 0.5) * 2,
    browW = 5 + r(4) * 2,
    eyeW = 13.2 + r(5) * 1.4,
    iris = ['#3a2416', '#2a1a10', '#45301f', '#1e140d'][Math.floor(r(6) * 4)];
  const shadow = tone(0.42),
    deep = tone(0.3);

  /* --- down-facing layer (bottom half): ambient occlusion where skin faces the floor --- */
  x.save();
  x.translate(0, HH);
  for (const s of [-1, 1]) {
    B(s * 31, M.eye, 5, 19, 9, deep, 0.55, 0.3);
    B(s * 16, M.eye, 3, 7, 7, deep, 0.4, 0.3);
  } // under the brow shelf, into the sockets
  B(0, M.nose, 2, 13, 7, deep, 0.55, 0.35); // under the nose tip and wings (kept narrow)
  B(0, M.mouth, mouthUp - 9, 17, 6, shadow, 0.5, 0.3); // under the lower lip, over the chin
  // under the jaw: everything below the jaw line, from the chin round to the jaw corners
  x.globalAlpha = 0.55;
  x.fillStyle = deep;
  x.beginPath();
  x.moveTo(X(-62), local(-50));
  x.bezierCurveTo(X(-52), local(-78), X(-30), Y(M.chin, 4), X(0), Y(M.chin, 1));
  x.bezierCurveTo(X(30), Y(M.chin, 4), X(52), local(-78), X(62), local(-50));
  x.lineTo(X(62), HH);
  x.lineTo(X(-62), HH);
  x.closePath();
  x.fill();
  x.restore();

  /* --- front-facing layer (top half) --- */
  // soft shade on the throat just under the chin (the jaw's shadow)
  B(0, M.chin, -9, 26, 10, shadow, 0.45, 0.25);
  // eye sockets: the shade under the brow shelf, a little deeper at the inner corner, and the lid crease
  for (const s of [-1, 1]) {
    const ex = s * (33 + spread);
    B(ex * 0.96, M.eye, 3, 19, 11, shadow, 0.32, 0.2);
    B(s * 17, M.eye, 1.5, 6.5, 8, deep, 0.24, 0.2);
    B(ex, M.eye, 6.2, 13, 3.6, deep, 0.22, 0.3);
  }
  // brows: thick, dark, tapering toward the temple, with a soft edge
  const brow = (s, grow, alpha, color) => {
    const p = (dx, up) => [X(s * dx), Y(M.brow, up + browUp)],
      t = browW * grow;
    x.save();
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(...p(12.5, -t * 0.5));
    x.lineTo(...p(11.5, t * 0.45));
    x.quadraticCurveTo(...p(29, t * 0.8 + 2.4), ...p(51, -0.6 * grow));
    x.quadraticCurveTo(...p(31, -t * 0.3 + 1.4), ...p(12.5, -t * 0.5));
    x.closePath();
    x.fill();
    x.restore();
  };
  for (const s of [-1, 1]) {
    brow(s, 1.3, 0.25, '#1a120d');
    brow(s, 1, 0.9, '#16100c');
  }
  // eyes: a dark almond on the closed-lid bulge; the iris fills most of it, so only slivers of muted white show at the corners
  const white = hex(base.clone().lerp(new THREE.Color(0xd9d1c7), 0.45).multiplyScalar(0.85));
  // each eye is drawn in its own mirrored frame: lx runs from the outer corner (-w) to the inner corner (+w), so both eyes match,
  // and the outer corner sits a little higher than the inner one (a young, alert eye; a drooping outer corner reads tired)
  for (const s of [-1, 1]) {
    const cx = X(s * (33 + spread)),
      cy = Y(M.eye),
      w = eyeW * mm,
      up = 5 * mm,
      dn = 3.6 * mm,
      a = 0.7 * mm,
      P = (lx, ly) => [cx - s * lx, cy + ly];
    const almond = () => {
      x.beginPath();
      x.moveTo(...P(-w, -a));
      x.bezierCurveTo(...P(-w * 0.35, -up * 1.32), ...P(w * 0.5, -up * 1.3), ...P(w, a));
      x.bezierCurveTo(...P(w * 0.45, dn * 1.3), ...P(-w * 0.45, dn * 1.3), ...P(-w, -a));
      x.closePath();
    };
    x.save();
    almond();
    x.globalAlpha = 0.95;
    x.fillStyle = white;
    x.fill();
    x.clip();
    x.fillStyle = iris;
    x.beginPath();
    x.arc(cx + s * 0.3 * mm, cy + 0.2 * mm, 5.4 * mm, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#0a0706';
    x.beginPath();
    x.arc(cx + s * 0.3 * mm, cy + 0.2 * mm, 2.3 * mm, 0, Math.PI * 2);
    x.fill();
    const lid = x.createLinearGradient(0, cy - up, 0, cy);
    lid.addColorStop(0, 'rgba(10,6,4,.55)');
    lid.addColorStop(1, 'rgba(10,6,4,0)');
    x.fillStyle = lid;
    x.fillRect(cx - w, cy - up * 1.4, 2 * w, up * 1.4); // lash shadow
    x.fillStyle = 'rgba(255,255,255,.4)';
    x.beginPath();
    x.arc(cx - 1.5 * mm, cy - 1.5 * mm, 0.75 * mm, 0, Math.PI * 2);
    x.fill();
    x.restore(); // catchlight: same side on both eyes (one light)
    x.save();
    x.strokeStyle = '#100a07';
    x.lineCap = 'round';
    x.lineWidth = 1.6 * mm;
    x.beginPath();
    x.moveTo(...P(-w * 1.06, -a * 1.3));
    x.bezierCurveTo(...P(-w * 0.35, -up * 1.36), ...P(w * 0.5, -up * 1.32), ...P(w * 1.02, a * 0.8));
    x.stroke(); // upper lid and lashes
    x.globalAlpha = 0.4;
    x.strokeStyle = tone(0.5);
    x.lineWidth = 0.8 * mm;
    x.beginPath();
    x.moveTo(...P(-w * 0.85, dn * 0.7));
    x.bezierCurveTo(...P(-w * 0.35, dn * 1.25), ...P(w * 0.35, dn * 1.3), ...P(w * 0.8, dn * 0.8));
    x.stroke();
    x.restore(); // lower lid
  }
  // nose: a soft light down the bridge, shade under the tip and round the wings, nostrils
  B(0, M.eye, -12, 3.2, 13, tone(1.1), 0.16, 0.3);
  const nw = Math.min(17, (M.noseHalf / M.pupil) * 33); // nostril-wing half-width (mm)
  B(0, M.nose, -1.5, nw * 0.6, 3.2, shadow, 0.32, 0.25);
  for (const s of [-1, 1]) {
    B(s * nw * 0.38, M.nose, 1.2, 2.8, 1.7, deep, 0.7, 0.45);
    B(s * nw * 0.8, M.nose, 4.5, 2.4, 4, tone(0.65), 0.12, 0.3);
  }
  B(0, M.nose, 5, 3.6, 3.2, tone(1.12), 0.18, 0.3); // soft light on the tip, so the base reads narrow
  // lips: one value darker than the skin with a little warmth, the upper lip darker than the lower; a soft lip line
  const lip = f => {
      const l = base.clone().multiplyScalar(f);
      l.r *= 1.07;
      l.g *= 0.9;
      l.b *= 0.93;
      return hex(l);
    },
    m = Y(M.mouth, mouthUp),
    mw = (M.mouthHalf / M.pupil) * 33 * mm;
  const upper = () => {
    x.beginPath();
    x.moveTo(W / 2 - mw, m);
    x.quadraticCurveTo(W / 2 - mw * 0.45, m - 5.5 * mm, W / 2 - mw * 0.18, m - 6.2 * mm);
    x.quadraticCurveTo(W / 2, m - 4.8 * mm, W / 2 + mw * 0.18, m - 6.2 * mm);
    x.quadraticCurveTo(W / 2 + mw * 0.45, m - 5.5 * mm, W / 2 + mw, m);
    x.closePath();
  };
  const lower = () => {
    x.beginPath();
    x.moveTo(W / 2 - mw * 0.94, m);
    x.bezierCurveTo(W / 2 - mw * 0.6, m + 8.5 * mm, W / 2 + mw * 0.6, m + 8.5 * mm, W / 2 + mw * 0.94, m);
    x.closePath();
  };
  x.save();
  x.globalAlpha = 0.85;
  x.fillStyle = lip(0.74);
  upper();
  x.fill();
  x.fillStyle = lip(0.84);
  lower();
  x.fill();
  x.restore();
  B(0, M.mouth, mouthUp - 3.5, 9, 2, tone(1.06), 0.3, 0.3); // soft light on the lower lip
  x.save();
  x.globalAlpha = 0.8;
  x.strokeStyle = tone(0.42);
  x.lineWidth = 1.2 * mm;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(W / 2 - mw * 0.96, m);
  x.quadraticCurveTo(W / 2, m + 1.1 * mm, W / 2 + mw * 0.96, m);
  x.stroke();
  x.restore();
  for (const s of [-1, 1]) B(s * (mw / mm), M.mouth, mouthUp, 2.6, 2.2, shadow, 0.35, 0.3); // mouth corners
  B(0, M.mouth, mouthUp - 12, 13, 4, shadow, 0.3, 0.25); // under the lower lip
  // a faint warmth over the cheeks
  for (const s of [-1, 1]) B(s * 40, M.eye, -23, 15, 10, lip(0.95), 0.12, 0.2);
  // some players keep a little stubble or a goatee (light: they are high-school kids)
  if (r(7) < 0.4) {
    B(0, M.chin, 10, 13, 8, '#1a120d', 0.14 + r(8) * 0.12, 0.4);
    if (r(9) < 0.5) B(0, M.mouth, mouthUp + 8.5, (mw / mm) * 0.8, 2.4, '#1a120d', 0.1 + r(8) * 0.08, 0.4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
