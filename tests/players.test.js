import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {classicBody,attachBody,disposeBody,validBody,variantFor,BODY_PARTS} from '../src/players.js';
const kit={mat:(c,extra={})=>new THREE.MeshStandardMaterial({color:c,roughness:.68,...extra}),textTexture:()=>new THREE.Texture(),capMat:new THREE.MeshBasicMaterial()};

test('classic body: same figure as before (mesh count, joints, sizes) and every part the Arena drives',()=>{
 const b=classicBody(kit,0,0x6832ab);assert.ok(validBody(b));
 let meshes=0;b.root.traverse(o=>{if(o.isMesh){meshes++;assert.equal(o.castShadow,true);}});assert.equal(meshes,20,'torso, head, hair, number, nameplate, badge + 2×(thigh, shorts, shin, shoe, upper arm, forearm, hand)');
 assert.deepEqual(b.parts.legs.map(l=>[l.position.x,l.position.y]),[[-.15,.86],[.15,.86]]);assert.deepEqual(b.parts.arms.map(a=>[a.position.x,a.position.y]),[[-.3,1.46],[.3,1.46]]);
 assert.equal(b.parts.legs[0].userData.knee.position.y,-.38);assert.equal(b.parts.arms[1].userData.elbow.position.y,-.29);
 const box=new THREE.Box3().setFromObject(b.root);assert.ok(Math.abs(box.max.y-2.03)<.01,`head top ${box.max.y}`);assert.ok(Math.abs(box.min.y-.39)<.02||box.min.y<.5);
 assert.equal(b.parts.capBadge.material,kit.capMat,'badge material is shared');
});
test('attachBody: points the player at the new parts, carries the pose over and returns the old body',()=>{
 const p=new THREE.Group(),a=classicBody(kit,1,0x111111),b=classicBody(kit,2,0x222222);
 assert.equal(attachBody(p,a),null);for(const k of BODY_PARTS)assert.equal(p.userData[k],a.parts[k],k);
 a.parts.legs[0].rotation.x=.5;a.parts.legs[0].userData.knee.rotation.x=.3;a.parts.arms[1].rotation.set(-2.7,0,.12);a.parts.arms[1].userData.elbow.rotation.x=-.25;a.parts.head.visible=false;
 assert.equal(attachBody(p,b),a);assert.equal(p.children.length,1);assert.equal(p.children[0],b.root);
 for(const k of BODY_PARTS)assert.equal(p.userData[k],b.parts[k],k);
 assert.equal(b.parts.legs[0].rotation.x,.5);assert.equal(b.parts.legs[0].userData.knee.rotation.x,.3);assert.equal(b.parts.arms[1].rotation.x,-2.7);assert.equal(b.parts.arms[1].rotation.z,.12);assert.equal(b.parts.arms[1].userData.elbow.rotation.x,-.25);
 assert.equal(b.parts.head.visible,false,'first-person hiding survives a swap');
 disposeBody(a,new Set([kit.capMat]));
});
test('validBody rejects bodies missing a part, and positions map to body variants',()=>{
 const b=classicBody(kit,0,0);for(const k of ['jersey','number','head'])assert.equal(validBody({...b,parts:{...b.parts,[k]:undefined}}),false,k);
 assert.equal(validBody({...b,parts:{...b.parts,legs:[b.parts.legs[0]]}}),false);assert.equal(validBody(null),false);
 assert.equal(variantFor('Guard'),'guard');assert.equal(variantFor('Point Guard'),'guard');assert.equal(variantFor('Center'),'center');assert.equal(variantFor('Forward'),'forward');assert.equal(variantFor(undefined),'forward');
});
test('athlete bodies: every variant file loads as a rigged body the Arena can drive',async()=>{
 const fs=await import('node:fs');const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const {athleteBody,BODY_VARIANTS}=await import('../src/players.js');
 for(const v of BODY_VARIANTS){
  const buf=fs.readFileSync(new URL(`../public/models/players/${v}.glb`,import.meta.url));
  const gltf=await new Promise((res,rej)=>new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'',res,rej));
  const b=athleteBody(gltf,kit,3,0x6832ab,v);assert.ok(validBody(b),v);assert.equal(b.variant,v);
  assert.ok(b.parts.head.isMesh&&!b.parts.head.isBone,'head is the mesh, not the bone');assert.ok(b.parts.hair.isMesh);
  assert.deepEqual(b.parts.legs.map(l=>l.name),['hip_R','hip_L']);assert.deepEqual(b.parts.arms.map(a=>a.name),['shoulder_R','shoulder_L']);
  for(const bone of [...b.parts.legs,...b.parts.arms])assert.deepEqual(bone.quaternion.toArray(),[0,0,0,1],'bones rest unrotated');
  assert.ok(b.parts.legs[0].position.x<0&&b.parts.arms[0].getWorldPosition(new THREE.Vector3()).x<0,'x<0 side first, like the classic figure');
  let tris=0;b.root.traverse(o=>{if(o.isSkinnedMesh){tris+=o.geometry.index.count/3;assert.equal(o.frustumCulled,false);}});assert.ok(tris>6000&&tris<12000,`${v}: ${tris} triangles in budget`);
  const box=new THREE.Box3().setFromObject(b.root);const h=box.max.y;assert.ok(h>2.0&&h<2.4,`${v} height ${h}`);
 }
});
