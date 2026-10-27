// Player bodies for the gym. A player is a stable outer group (moved, turned and identified by the Arena) holding one swappable
// body. Every body, whatever it is made of, hands the Arena the same parts:
//   jersey (material, recoloured per team), head and hair (hidden in Player view), number and nameplate (meshes whose
//   material.map is replaced), capBadge (shown for the captain), legs (hip pivots, each with userData.knee) and
//   arms (shoulder pivots, each with userData.elbow). Pivots rest with no rotation; the Arena swings them around x (and z for arms).
// "classic" is the original primitive figure, unchanged. Imported (skinned glTF) bodies plug in through attachBody.
import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

export const PLAYER_STYLES=['classic','realistic'];
export const BODY_PARTS=['jersey','head','hair','number','nameplate','capBadge','legs','arms'];
// Which body variant a roster position wears (realistic style). Unknown positions fall back to forward.
export const variantFor=position=>{const p=String(position||'').toLowerCase();return p.includes('guard')?'guard':p.includes('center')?'center':'forward';};

/* The original figure (moved here from arena.js without changes). kit = {mat(color,extra), textTexture(...), capMat}. */
export function classicBody(kit,i,color){
 const g=new THREE.Group(),parts={legs:[],arms:[]};const skin=[0x9c6946,0xe4b58b,0x66432d,0xb67e57,0xd39871][i%5];const jersey=kit.mat(color);const limb=(radius,length,c)=>new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,4,8),kit.mat(c));
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.27,.22,.65,8),jersey);body.position.y=1.18;g.add(body);parts.jersey=jersey;
 const head=new THREE.Mesh(new THREE.SphereGeometry(.205,12,10),kit.mat(skin));head.position.y=1.78;g.add(head);parts.head=head;
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.21,12,8,0,Math.PI*2,0,Math.PI*.5),kit.mat(0x242025));hair.position.y=1.82;g.add(hair);parts.hair=hair;
 const numberGeo=new THREE.PlaneGeometry(.35,.35),uv=numberGeo.attributes.uv;for(let k=0;k<uv.count;k++)uv.setX(k,.25+uv.getX(k)*.5);/* number textures are 2:1: sample the centre square so digits keep their shape */
 const number=new THREE.Mesh(numberGeo,new THREE.MeshStandardMaterial({map:kit.textTexture(String([0,2,3,11,20][i%5]),i<5?'#6832ab':'#f1e9df',i<5?'#ffffff':'#562494',128),roughness:.68,side:THREE.DoubleSide}));number.position.set(0,1.23,.255);g.add(number);parts.number=number;
 const nameplate=new THREE.Mesh(new THREE.PlaneGeometry(.45,.23),new THREE.MeshStandardMaterial({map:kit.textTexture('KANGS','#6832ab','#ffffff',256),roughness:.68}));nameplate.position.set(0,1.3,-.255);nameplate.rotation.y=Math.PI;g.add(nameplate);parts.nameplate=nameplate;
 /* small gold C beside the name on the captain's back plate; shown by setIdentity */
 const capBadge=new THREE.Mesh(new THREE.PlaneGeometry(.11,.11),kit.capMat);capBadge.position.set(-.2,1.4,-.262);capBadge.rotation.y=Math.PI;capBadge.visible=false;g.add(capBadge);parts.capBadge=capBadge;
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.15,.86,0);g.add(hip);
  const thigh=limb(.105,.21,skin);thigh.position.y=-.18;hip.add(thigh);
  const shorts=new THREE.Mesh(new THREE.BoxGeometry(.25,.27,.3),jersey);shorts.position.y=-.06;hip.add(shorts);
  const knee=new THREE.Group();knee.position.y=-.38;hip.add(knee);
  const shin=limb(.085,.22,skin);shin.position.y=-.16;knee.add(shin);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.20,.14,.36),kit.mat(0xffffff));shoe.position.set(0,-.34,.07);knee.add(shoe);
  hip.userData.knee=knee;parts.legs.push(hip);
  const shoulder=new THREE.Group();shoulder.position.set(side*.30,1.46,0);g.add(shoulder);
  const upper=limb(.075,.18,skin);upper.position.y=-.14;shoulder.add(upper);
  const elbow=new THREE.Group();elbow.position.y=-.29;shoulder.add(elbow);
  const forearm=limb(.065,.17,skin);forearm.position.y=-.12;elbow.add(forearm);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),kit.mat(skin));hand.position.y=-.27;elbow.add(hand);
  shoulder.userData.elbow=elbow;parts.arms.push(shoulder);
 }
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
 return {root:g,parts,style:'classic',variant:'classic'};
}

/* Puts a body into a player's outer group, replacing the previous one, and points the player's userData at the new parts.
   The pose the Arena last applied is carried over (pivot rotations), so a swap mid-play does not snap. Returns the old body. */
export function attachBody(player,body){
 const u=player.userData,old=u.body;
 if(old){
  body.parts.legs.forEach((leg,j)=>{const o=old.parts.legs[j];if(o){leg.rotation.copy(o.rotation);leg.userData.knee.rotation.copy(o.userData.knee.rotation);}});
  body.parts.arms.forEach((arm,j)=>{const o=old.parts.arms[j];if(o){arm.rotation.copy(o.rotation);arm.userData.elbow.rotation.copy(o.userData.elbow.rotation);}});
  for(const k of ['head','hair'])if(old.parts[k]&&body.parts[k])body.parts[k].visible=old.parts[k].visible;
  player.remove(old.root);
 }
 player.add(body.root);u.body=body;
 for(const k of BODY_PARTS)u[k]=body.parts[k];
 return old||null;
}

/* Frees what only this body owns (geometry, materials and their canvas textures). Shared materials are listed in keep. */
export function disposeBody(body,keep=new Set()){
 if(!body)return;const mats=new Set();
 body.root.traverse(o=>{if(o.isMesh){o.geometry?.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m&&!keep.has(m)&&mats.add(m));}});
 mats.forEach(m=>{m.map?.dispose();m.dispose();});
}

/* True when a body offers every part the Arena drives (used to reject a broken imported model and stay on classic). */
export function validBody(body){
 const p=body?.parts;if(!p||!body.root?.isObject3D)return false;
 return !!(p.jersey?.color&&p.head?.isObject3D&&p.hair?.isObject3D&&p.number?.material&&p.nameplate?.material&&p.capBadge?.isObject3D
  &&p.legs?.length===2&&p.arms?.length===2&&p.legs.every(l=>l.userData?.knee?.isObject3D)&&p.arms.every(a=>a.userData?.elbow?.isObject3D));
}

/* ---- Athletes: the rigged bodies built in Houdini (assets-src/players) and rigged by scripts/build_players.py ---- */
export const BODY_VARIANTS=['guard','forward','center'];
export const SKIN_TONES=[0x8a5a3c,0xd8a47a,0x5a3825,0xb27a50,0xc8905f,0x3f2a1e,0xe6bf98];
/* template = a loaded glTF (public/models/players/<variant>.glb). Bones rest unrotated, so the Arena's hip/knee/shoulder/elbow
   swings work exactly as on the classic figure; legs and arms are listed in the same order (x<0 side first). */
export function athleteBody(template,kit,i,color,variant){
 const root=cloneSkinned(template.scene),bones={},objs={};let info={};
 root.traverse(o=>{if(o.isBone)bones[o.name]=o;else if(o.name)objs[o.name]??=o;if(o.userData&&o.userData.number)info=o.userData;});/* bones and meshes share names (head): parts take the mesh */
 const jersey=kit.mat(color),skin=new THREE.MeshStandardMaterial({color:SKIN_TONES[i%SKIN_TONES.length],roughness:.55}),shoes=kit.mat(0xf4f4f4,{roughness:.45}),hairMat=kit.mat(0x161210,{roughness:.85});
 const pick={kit:jersey,skin,shoes,hair:hairMat};
 root.traverse(o=>{if(o.isMesh){const name=o.material?.name;o.material=pick[name]||skin;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 const ds=info.decalScale||1,chest=bones.chest;
 const numberGeo=new THREE.PlaneGeometry(.3*ds,.3*ds),uv=numberGeo.attributes.uv;for(let k=0;k<uv.count;k++)uv.setX(k,.25+uv.getX(k)*.5);
 const number=new THREE.Mesh(numberGeo,new THREE.MeshStandardMaterial({map:kit.textTexture(String([0,2,3,11,20][i%5]),'#6832ab','#ffffff',128),roughness:.68,transparent:true,alphaTest:.02}));
 const nameplate=new THREE.Mesh(new THREE.PlaneGeometry(.4*ds,.17*ds),new THREE.MeshStandardMaterial({map:kit.textTexture('KANGS','#6832ab','#ffffff',256),roughness:.68}));nameplate.rotation.y=Math.PI;
 const capBadge=new THREE.Mesh(new THREE.PlaneGeometry(.09*ds,.09*ds),kit.capMat);capBadge.rotation.y=Math.PI;capBadge.visible=false;
 for(const [m,at] of [[number,info.number],[nameplate,info.nameplate],[capBadge,info.capBadge]]){if(at)m.position.fromArray(at);chest?.add(m);}
 const legs=[bones.hip_R,bones.hip_L],arms=[bones.shoulder_R,bones.shoulder_L];
 legs.forEach((b,j)=>b&&(b.userData.knee=bones[j?'knee_L':'knee_R']));arms.forEach((b,j)=>b&&(b.userData.elbow=bones[j?'elbow_L':'elbow_R']));
 return {root,parts:{jersey,head:objs.head_mesh,hair:objs.hair_mesh,number,nameplate,capBadge,legs,arms},style:'athletes',variant,owned:[skin,shoes,hairMat]};
}
