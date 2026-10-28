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
  const look={hair:'afro',hairColor:0x221813,headband:true,armSleeve:true,legSleeve:false};
  const b=athleteBody(gltf,kit,3,0x6832ab,v,look);assert.ok(validBody(b),v);assert.equal(b.variant,v);assert.equal(b.key,`${v}|afro+band+arm`);
  assert.ok(b.parts.head.isMesh&&!b.parts.head.isBone,'head is the mesh, not the bone');
  assert.deepEqual(b.parts.hair.children.map(o=>o.name).sort(),['headband_mesh','hair_afro_mesh'].sort(),'one hair style plus the headband, hidden together in Player view');
  const names=[];b.root.traverse(o=>{if(o.isSkinnedMesh||(o.isGroup&&o.name.endsWith('_mesh')))names.push(o.name);});
  for(const n of ['jersey_mesh','shorts_mesh','shoes_mesh','sleeve_arm_mesh'])assert.ok(names.includes(n),n);
  for(const n of ['hair_buzz_mesh','hair_crop_mesh','hair_rows_mesh','sleeve_leg_mesh'])assert.ok(!names.includes(n),`${n} is dropped`);
  const kitMeshes=[];b.root.traverse(o=>{if(o.isSkinnedMesh&&o.material===b.parts.jersey)kitMeshes.push(o.name);});assert.deepEqual(kitMeshes.sort(),['jersey_mesh','shorts_mesh'],'team colour reaches jersey and shorts');
  assert.deepEqual(b.parts.legs.map(l=>l.name),['hip_R','hip_L']);assert.deepEqual(b.parts.arms.map(a=>a.name),['shoulder_R','shoulder_L']);
  for(const bone of [...b.parts.legs,...b.parts.arms])assert.deepEqual(bone.quaternion.toArray(),[0,0,0,1],'bones rest unrotated');
  assert.ok(b.parts.legs[0].position.x<0&&b.parts.arms[0].getWorldPosition(new THREE.Vector3()).x<0,'x<0 side first, like the classic figure');
  let tris=0;b.root.traverse(o=>{if(o.isSkinnedMesh){tris+=o.geometry.index.count/3;assert.equal(o.frustumCulled,false);}});assert.ok(tris>10000&&tris<15000,`${v}: ${tris} triangles in budget`);
  // one shared skeleton per body, and a far-distance version (about a third of the triangles) swapped in by setLod
  const skels=new Set();b.root.traverse(o=>{if(o.isSkinnedMesh)skels.add(o.skeleton);});assert.equal(skels.size,1,'all meshes share one skeleton');
  assert.ok(!names.some(n=>n.endsWith('_lod1')),'LOD meshes are not separate objects');
  const count=()=>{let t=0;b.root.traverse(o=>{if(o.isSkinnedMesh)t+=o.geometry.index.count/3;});return t;};
  b.setLod(1);const far=count();assert.ok(far>tris*.2&&far<tris*.45,`${v}: far ${far} of ${tris}`);
  b.root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.lods)assert.equal(o.geometry.attributes.position,o.userData.lods[0].attributes.position,'same vertices, only fewer triangles');});
  b.setLod(0);assert.equal(count(),tris);
  const box=new THREE.Box3().setFromObject(b.root);const h=box.max.y;assert.ok(h>2.0&&h<2.4,`${v} height ${h}`);
 }
});
test('looks: the same player always gets the same hair and options, and players differ',async()=>{
 const {lookFor,lookKey,HAIR_STYLES}=await import('../src/players.js');
 assert.deepEqual(lookFor(42),lookFor(42));const keys=new Set(),hair=new Set();
 for(let i=0;i<60;i++){const l=lookFor('player'+i);keys.add(lookKey(l));hair.add(l.hair);assert.ok(HAIR_STYLES.includes(l.hair));}
 assert.equal(hair.size,4,'every hair style is used');assert.ok(keys.size>8,'plenty of different looks');
});
