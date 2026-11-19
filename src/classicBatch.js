// The classic (Low) figures drawn as one instanced mesh per body part for all ten players (presentation only): about 200
// draw calls become 17 (plus the textured number, nameplate and captain badge each player keeps). On Low, where the device
// is weakest, the figures' draw calls were 44% of the frame.
// The figures themselves are untouched (src/players.js classicBody: the same parts and pivots the Arena poses, the same
// body interface); their own meshes leave the main camera's layer, and every frame each part's world matrix and colour are
// copied into its instance. A part that is hidden (the head in Player view, a player who is not drawn) is drawn at zero
// scale. Shadows and the court mirror see the instances.
import * as THREE from 'three';

export const HIDDEN_LAYER = 31; // where a batched figure's own meshes go (no camera renders it)
const keep = m => !!m.material?.map; // textured parts (number, nameplate, badge) stay as they are

/* The batched meshes of a classic body, in a fixed order. */
const partsOf = body => {
  const out = [];
  body.root.traverse(o => {
    if (o.isMesh && !keep(o)) out.push(o);
  });
  return out;
};
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class ClassicBatch {
  constructor(scene, size = 10) {
    this.scene = scene;
    this.size = size;
    this.meshes = null;
    this.bodies = new WeakSet();
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68 });
  }
  /* Builds the instanced meshes from the first classic body seen (every classic body has the same part shapes). */
  build(body) {
    this.meshes = partsOf(body).map(m => {
      const im = new THREE.InstancedMesh(m.geometry, this.material, this.size);
      im.frustumCulled = false; // the players move every frame: bounds from the instances would go stale
      im.castShadow = true;
      im.receiveShadow = false;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.size * 3), 3);
      for (let i = 0; i < this.size; i++) im.setMatrixAt(i, ZERO);
      this.scene.add(im);
      return im;
    });
  }
  /* Copies the classic players' parts into the instances; players with another body leave their slot empty. */
  update(people) {
    let any = false;
    for (const p of people) if (p.userData.body?.style === 'classic') any = true;
    if (!any) {
      if (this.meshes) for (const im of this.meshes) im.visible = false;
      return;
    }
    people.forEach((p, i) => {
      const body = p.userData.body;
      if (body?.style !== 'classic') return;
      if (!this.meshes) this.build(body);
      if (!this.bodies.has(body)) {
        this.bodies.add(body);
        body.root.traverse(o => o.isMesh && !keep(o) && o.layers.set(HIDDEN_LAYER));
      }
      p.updateWorldMatrix(true, true);
      const parts = (body.batchParts ??= partsOf(body));
      parts.forEach((m, k) => {
        const im = this.meshes[k];
        if (!im) return;
        let shown = p.visible;
        for (let o = m; shown && o && o !== p; o = o.parent) shown = o.visible;
        im.setMatrixAt(i, shown ? m.matrixWorld : ZERO);
        im.setColorAt(i, m.material.color);
      });
    });
    // a slot whose player is not classic (or missing) stays empty
    for (let i = people.length; i < this.size; i++) for (const im of this.meshes) im.setMatrixAt(i, ZERO);
    people.forEach((p, i) => {
      if (p.userData.body?.style !== 'classic') for (const im of this.meshes) im.setMatrixAt(i, ZERO);
    });
    for (const im of this.meshes) {
      im.visible = true;
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    }
  }
  /* The court mirror (src/broadcast.js) renders one layer; the instances join it when it is on. */
  enableLayer(n) {
    for (const im of this.meshes || []) im.layers.enable(n);
  }
}
