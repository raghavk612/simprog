// Baked detail maps for the 3D athletes: per body variant, one RGBA texture per atlas with the tangent-space normal in RGB
// (OpenGL / glTF, green up) and ambient occlusion in A, made by scripts/build_players.py --bake (assets-src/players/bake).
//   skin: body, head, arms, hands   2048 px on High, a 1024 px copy (_1k) on Medium
//   kit:  jersey, shorts, sleeves, headband, trim   1024 px
//   gear: sneakers, hair   1024 px
// The GLBs carry the atlas UVs (TEXCOORD_0) and the tangents the maps were baked in (TANGENT), so normalScale stays (1, 1).
// Maps are used on Medium and High only (Low draws the classic players) and never on the far mesh (LOD1), whose welded seams
// smear the atlas. They are loaded once per variant and shared by every player of that variant; bodies switch them live.
import * as THREE from 'three';

export const MAP_ATLASES = ['skin', 'kit', 'gear'];
// which atlas each body material reads (material names as in the GLB; band, sleeve and trim are fabric on the kit atlas)
export const ATLAS_OF = {
  skin: 'skin',
  kit: 'kit',
  band: 'kit',
  sleeve: 'kit',
  trim: 'kit',
  shoes: 'gear',
  sole: 'gear',
  hair: 'gear',
};
export const mapsOn = level => level === 'medium' || level === 'high';
export const mapFile = (variant, atlas, level) =>
  `${variant}_${atlas}${atlas === 'skin' && level !== 'high' ? '_1k' : ''}.png`;
/* Baked AO darkens only indirect light (the hemisphere fill, sheen and clearcoat). On High the screen-space AO (GTAO) darkens
   the same creases again, so the baked AO is lighter there; on the face the painted shadows already carry it (materials.js
   fades the baked AO under the painted face). */
export const AO_INTENSITY = { medium: 0.8, high: 0.55 };
export const NORMAL_SCALE = { skin: 1, kit: 1, gear: 1 };

const BASE = `${import.meta.env?.BASE_URL ?? '/'}models/players/maps/`;
/* Data textures straight from the file: no premultiplied alpha (the AO in A would crush the normal in RGB), no colour
   management, no flip (glTF UVs). */
export function loadMapTexture(url) {
  if (typeof createImageBitmap === 'function') {
    const loader = new THREE.ImageBitmapLoader();
    loader.setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    return loader.loadAsync(url).then(bmp => new THREE.Texture(bmp));
  }
  return new THREE.TextureLoader().loadAsync(url);
}
function prepare(t) {
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.premultiplyAlpha = false;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.shared = true; // owned by the template's AthleteMaps: scenes that free their textures leave it alone
  return t;
}

/* The maps of one body variant, kept with its template (gltf.maps). get() is synchronous (null until loaded); request()
   loads a file once, whoever asks; a file that fails stays off (the body simply has no detail map). */
export class AthleteMaps {
  constructor(variant, { base = BASE, load = loadMapTexture } = {}) {
    this.variant = variant;
    this.base = base;
    this.load = load;
    this.files = new Map(); // file -> { texture, promise }
    this.disposed = false;
  }
  get(atlas, level) {
    return this.files.get(mapFile(this.variant, atlas, level))?.texture ?? null;
  }
  request(atlas, level) {
    if (this.disposed) return Promise.resolve(null);
    const file = mapFile(this.variant, atlas, level);
    let e = this.files.get(file);
    if (!e) {
      e = { texture: null };
      e.promise = Promise.resolve()
        .then(() => this.load(this.base + file))
        .then(t => {
          if (this.disposed) {
            t.dispose();
            return null;
          }
          t.name ||= file;
          return (e.texture = prepare(t));
        })
        .catch(err => {
          this.warn(`Player map ${file} unavailable`, err);
          return null;
        });
      this.files.set(file, e);
    }
    return e.promise;
  }
  /* Starts the files a level needs (e.g. the kit and gear atlases, which both levels share, with the bodies). */
  prefetch(level, atlases = MAP_ATLASES) {
    return Promise.all(atlases.map(a => this.request(a, level)));
  }
  loaded() {
    return [...this.files.values()].map(e => e.texture).filter(Boolean);
  }
  warn(...a) {
    console.warn(...a);
  }
  dispose() {
    this.disposed = true;
    for (const t of this.loaded()) t.dispose();
    this.files.clear();
  }
}

/* Puts one atlas texture on a material, or takes it off (tex null). The program changes only when a map comes or goes, so
   needsUpdate is set then; swapping High for Medium just rebinds. */
export function setMaterialMaps(material, tex, level, atlas) {
  const had = !!material.normalMap;
  material.normalMap = tex;
  material.aoMap = tex;
  if (tex) {
    const s = NORMAL_SCALE[atlas] ?? 1;
    material.normalScale.set(s, s);
    material.aoMapIntensity = AO_INTENSITY[level] ?? 1;
  }
  if (had !== !!tex) material.needsUpdate = true;
}
