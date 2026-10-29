// Player bodies for the gym. A player is a stable outer group (moved, turned and identified by the Arena) holding one swappable
// body. Every body, whatever it is made of, hands the Arena the same parts:
//   jersey (material, recoloured per team), head and hair (hidden in Player view), number and nameplate (meshes whose
//   material.map is replaced), capBadge (shown for the captain), legs (hip pivots, each with userData.knee) and
//   arms (shoulder pivots, each with userData.elbow). Pivots rest with no rotation; the Arena swings them around x (and z for arms).
// "classic" is the original primitive figure, unchanged. Imported (skinned glTF) bodies plug in through attachBody.
import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {KITS} from './kits.js';
import {skinMaterial,clothMaterial,shoeMaterial,soleMaterial,hairMaterial,fabricMaterial,letteringTexture,bentPlane,decalMaterial,faceTexture,KIT_INFLATE} from './materials.js';

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
 return {root:g,parts,style:'classic',variant:'classic',key:'classic'};
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
 body.root.traverse(o=>{if(o.isMesh){if(!body.sharedGeometry||!o.isSkinnedMesh)o.geometry?.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m&&!keep.has(m)&&mats.add(m));}});
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
export const SKIN_TONES=[0x8a5a3c,0xc99a7a,0x5a3825,0xa8754f,0xbf8a63,0x3f2a1e,0xdcb59b];
export const HAIR_STYLES=['buzz','crop','afro','rows'];
const HAIR_COLORS=[0x161210,0x161210,0x221813,0x2e2118,0x161210,0x4a3424];
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
/* A player's look (hair style and colour, headband, arm and leg sleeves), the same every time for the same player. */
export function lookFor(seed){const h=hash(seed);return {hair:HAIR_STYLES[h%4],hairColor:HAIR_COLORS[(h>>>4)%HAIR_COLORS.length],headband:(h>>>8)%5===0,armSleeve:(h>>>11)%4===0,legSleeve:(h>>>14)%6===0};}
export const lookKey=l=>l?`${l.hair}${l.headband?'+band':''}${l.armSleeve?'+arm':''}${l.legSleeve?'+leg':''}`:'';
/* The locker-room lettering for one side of the jersey, transparent round the letters, in the same layout and colours as
   the 3D jerseys in the locker room (jerseys.js): front "Lake" in script, the number, "Washington" in script; back the name
   and a big number. The canvas is the lettering band of the locker jersey (from 20% down its height). */
const SCRIPT='"Yellowtail","Brush Script MT","Segoe Script",cursive',BLOCK='"Barlow Condensed","Arial Narrow",Arial,sans-serif';
export const KIT_DECAL={w:512,h:460,top:128,face:640};
export function kitLettering(kitKey,side,number,name){
 if(typeof document==='undefined')return new THREE.Texture();   // tests run without a page
 const kit=KITS[kitKey]||KITS.home,{w:W,h:H,top,face:F}=KIT_DECAL,c=document.createElement('canvas');c.width=W;c.height=H;
 const x=c.getContext('2d'),t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;const num=String(number);
 const draw=()=>{x.clearRect(0,0,W,H);x.save();x.translate(0,-top);x.textAlign='center';x.textBaseline='alphabetic';x.lineJoin='round';
  const letter=(text,px,y)=>{if(kit.vintage){x.strokeStyle=kit.accent;x.lineWidth=Math.max(5,px/22);x.strokeText(text,W/2,y);}x.fillStyle=kit.ink;x.fillText(text,W/2,y);};
  if(side==='front'){
   const script=(text,size,y,maxW,rot)=>{x.save();x.translate(W/2,y);x.rotate(rot);if('letterSpacing' in x)x.letterSpacing='3px';let s=size;x.font=`400 ${s}px ${SCRIPT}`;while(x.measureText(text).width>maxW&&s>40){s-=4;x.font=`400 ${s}px ${SCRIPT}`;}
    x.lineWidth=Math.max(6,s/9);x.strokeStyle=kit.scriptLine||kit.trim;x.strokeText(text,0,0);x.fillStyle=kit.script||kit.ink;x.fillText(text,0,0);x.restore();};
   script('Lake',112,F*.35,W*.4,-.06);
   x.font=`800 188px ${BLOCK}`;x.lineWidth=22;x.strokeStyle=kit.numLine||kit.trim;x.strokeText(num,W/2,F*.635);x.fillStyle=kit.num||kit.ink;x.fillText(num,W/2,F*.635);
   script('Washington',92,F*.81,W*.62,-.045);
  }else{
   const plate=String(name||'').toUpperCase();let size=92;do{x.font=`italic 800 ${size}px ${BLOCK}`;size-=2;}while(x.measureText(plate).width>W*.5&&size>34);
   letter(plate,72,F*.33);x.font=`italic 900 300px ${BLOCK}`;letter(num,300,F*.8);
  }
  x.restore();t.needsUpdate=true;};
 draw();document.fonts?.load(`400 100px ${SCRIPT}`).then(draw).catch(()=>{});   // repaint once the script font has loaded
 return t;
}

/* template = a loaded glTF (public/models/players/<variant>.glb). Bones rest unrotated, so the Arena's hip/knee/shoulder/elbow
   swings work exactly as on the classic figure; legs and arms are listed in the same order (x<0 side first).
   Geometry stays shared with the template (only materials and decals belong to the body). */
export function athleteBody(template,kit,i,color,variant,look=lookFor(i)){
 const root=cloneSkinned(template.scene),bones={},objs={};let info={},holder=null;
 root.traverse(o=>{if(o.isBone)bones[o.name]=o;else if(o.name)objs[o.name]??=o;if(o.userData&&o.userData.number){info=o.userData;holder=o;}});/* bones and meshes share names (head): parts take the mesh */
 // one skeleton per body: cloning gives every skinned mesh its own copy of the same bones, which means 8 bone-matrix updates
 // and 8 bone textures per player per frame instead of one
 let skeleton=null;root.traverse(o=>{if(!o.isSkinnedMesh)return;if(!skeleton)skeleton=o.skeleton;else if(o.skeleton!==skeleton&&o.skeleton.bones.length===skeleton.bones.length&&o.skeleton.bones.every((b,k)=>b.name===skeleton.bones[k].name)){o.skeleton.dispose?.();o.bind(skeleton,o.bindMatrix);}});
 // far-distance meshes (<name>_lod1, made by scripts/player_lods.mjs): kept as a second geometry on the full mesh and
 // swapped in by setLod, so visibility (Player view hides the head) and materials are untouched
 const lodMeshes=[];for(const [name,o] of Object.entries(objs)){const m=name.match(/^(.*)_lod1$/);if(!m)continue;const base=objs[m[1]];o.parent?.remove(o);delete objs[name];
  if(base?.isMesh){base.userData.lods=[base.geometry,o.geometry];lodMeshes.push(base);}}
 const jersey=clothMaterial(color),skin=skinMaterial(SKIN_TONES[i%SKIN_TONES.length]),shoes=shoeMaterial(0xf4f4f4),sole=soleMaterial(0x1d1d22),
  hairMat=hairMaterial(look.hairColor??0x161210),band=fabricMaterial(0xffffff),sleeve=fabricMaterial(0x111114),trim=fabricMaterial(0xe9b858);
 const pick={kit:jersey,skin,shoes,sole,hair:hairMat,band,sleeve,trim};   // trim: the binding round the neck, armholes and hems
 // keep one hair style and the chosen options; drop the rest
 const keep=new Set([`hair_${look.hair}_mesh`,look.headband&&'headband_mesh',look.armSleeve&&'sleeve_arm_mesh',look.legSleeve&&'sleeve_leg_mesh'].filter(Boolean));
 for(const [name,o] of Object.entries(objs))if(/^(hair_|headband_|sleeve_)/.test(name)&&!keep.has(name))o.parent?.remove(o);
 root.traverse(o=>{if(o.isMesh){const name=o.material?.name;o.material=pick[name]||skin;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 // head and hair (with the headband) hide together in Player view
 const hair=new THREE.Group();hair.name='hair';(holder||root).add(hair);for(const n of [`hair_${look.hair}_mesh`,'headband_mesh'])if(keep.has(n)&&objs[n])hair.add(objs[n]);
 const ds=info.decalScale||1,chest=bones.chest;
 const number=new THREE.Mesh(bentPlane(.3*ds,.3*ds,info.chestRadius||0),decalMaterial(letteringTexture(String([0,2,3,11,20][i%5]),'#ffffff','#2a1050')));
 const nameplate=new THREE.Mesh(bentPlane(.42*ds,.11*ds,info.backRadius||0),decalMaterial(letteringTexture('KANGS','#ffffff','#2a1050',{w:512,h:128,weight:800})));nameplate.rotation.y=Math.PI;
 const capBadge=new THREE.Mesh(new THREE.PlaneGeometry(.09*ds,.09*ds),kit.capMat);capBadge.rotation.y=Math.PI;capBadge.visible=false;
 for(const m of [number,nameplate,capBadge])m.castShadow=false;
 // face: painted onto the head mesh by its own skin material (see materials.js), so it is lit like the skin and hides with the head
 const tone=SKIN_TONES[i%SKIN_TONES.length],headMesh=objs.head_mesh;
 if(headMesh&&info.face&&bones.head){root.updateMatrixWorld(true);const c=bones.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3().fromArray(info.face));const [fw,fh]=info.faceSize||[.15,.13];
  const faceSkin=skinMaterial(tone,{map:faceTexture(tone,i),center:c,size:new THREE.Vector2(fw,fh)});headMesh.traverse(o=>{if(o.isMesh)o.material=faceSkin;});}
 for(const [m,at,dir] of [[number,info.number,1],[nameplate,info.nameplate,-1],[capBadge,info.capBadge,-1]]){if(at)m.position.fromArray(at);m.position.z+=dir*KIT_INFLATE;chest?.add(m);}
 const legs=[bones.hip_R,bones.hip_L],arms=[bones.shoulder_R,bones.shoulder_L];
 legs.forEach((b,j)=>b&&(b.userData.knee=bones[j?'knee_L':'knee_R']));arms.forEach((b,j)=>b&&(b.userData.elbow=bones[j?'elbow_L':'elbow_R']));
 /* Real jersey lettering: the number in the text colour with an outline, the name across the back, both on the fabric. */
 const shade=(hex,f)=>{const c=new THREE.Color(hex);return '#'+c.multiplyScalar(f).getHexString();},lum=hex=>{const c=new THREE.Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b;};
 const setLod=level=>{for(const m of lodMeshes)if(m.parent)m.geometry=m.userData.lods[level?1:0];};
 // the team's locker-room design (kit lettering front and back), made on first use; visitors keep the plain number and name
 let kitFront=null,kitBack=null;
 const kitDecal=(back)=>{const w=.55*ds,h=w*KIT_DECAL.h/KIT_DECAL.w,m=new THREE.Mesh(bentPlane(w,h,(back?(info.backRadius||0)*1.6:info.chestRadius)||0),decalMaterial(null));   // the back is flatter than the chestm.castShadow=false;
  const at=back?info.nameplate:info.number;if(at)m.position.fromArray(at);
  // line the number up with where the plain number sat (front), the name with the old nameplate (back)
  m.position.y+=back?-.32*h-.035*ds:.104*h-.015*ds;m.position.z+=(back?-1:1)*(KIT_INFLATE+(back?.012:.004));if(back)m.rotation.y=Math.PI;chest?.add(m);return m;};
 const setLettering=(num,name,bg,fg,kitKey=null)=>{
  if(kitKey){const kit=KITS[kitKey]||KITS.home;trim.color.set(kit.trim);kitFront??=kitDecal(false);kitBack??=kitDecal(true);
   for(const [m,side] of [[kitFront,'front'],[kitBack,'back']]){m.material.map?.dispose();m.material.map=kitLettering(kitKey,side,num,name);m.material.needsUpdate=true;m.visible=true;}
   number.visible=nameplate.visible=false;return;}
  if(kitFront)kitFront.visible=kitBack.visible=false;number.visible=nameplate.visible=true;
  trim.color.set(fg);const stroke=lum(fg)>.45?shade(bg,lum(bg)>.6?.55:.45):'#ffffff';
  for(const [m,tex] of [[number,letteringTexture(num,fg,stroke)],[nameplate,letteringTexture(name,fg,stroke,{w:512,h:128,weight:800})]]){m.material.map?.dispose();m.material.map=tex;m.material.needsUpdate=true;}};
 return {root,bones,parts:{jersey,head:objs.head_mesh,hair,number,nameplate,capBadge,legs,arms},style:'athletes',variant,key:`${variant}|${lookKey(look)}`,look,sharedGeometry:true,setLettering,setLod,lodMeshes};
}
