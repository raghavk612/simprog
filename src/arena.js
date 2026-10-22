import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CLIP_SECONDS, SHOTS, sampleClip} from './basketball.js';
const purple=0x6832ab;
export class Arena{
 constructor(host){
  this.speed=1;this.playTime=0;this.paused=false;this.host=host;this.models=0;this.people=[];this.time=0;this.motion=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;this.mode='broadcast';this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#100e22');this.scene.fog=new THREE.Fog('#100e22',48,100);
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){host.innerHTML='<div class="fallback">3D graphics unavailable on this device. All coaching controls remain playable.</div>';this.failed=true;return;}
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;host.append(this.renderer.domElement);
  this.camera=new THREE.PerspectiveCamera(43,1,.1,180);this.camera.position.set(29,27,32);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,0);this.controls.minDistance=12;this.controls.maxDistance=58;this.controls.maxPolarAngle=Math.PI*.46;this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.addEventListener('start',()=>{if(this.mode==='follow')this.mode='court';});
  this.scene.add(new THREE.HemisphereLight(0xded5ff,0x181124,.85));const sun=new THREE.DirectionalLight(0xffeee2,2.2);sun.position.set(6,25,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:70});sun.shadow.bias=-.0005;this.scene.add(sun);
  const fill=new THREE.PointLight(0x9e61ff,80,55);fill.position.set(-15,9,-10);this.scene.add(fill);
  for(const x of [-10,0,10]){const light=new THREE.SpotLight(0xf4edff,100,42,.65,.65,1.4);light.position.set(x,15,1);light.target.position.set(x,0,0);this.scene.add(light,light.target);}
  this.build();this.importModels();this.clock=new THREE.Clock();this.renderer.setAnimationLoop(()=>this.frame());
 }
 mat(c,extra={}){return new THREE.MeshStandardMaterial({color:c,roughness:.68,...extra});}
 box(w,h,d,c,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m;}
 textTexture(text,bg='#562494',fg='#ffffff',size=512){const c=document.createElement('canvas');c.width=size;c.height=size/2;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';let fs=size*.12;x.font=`900 ${fs}px Arial`;const tw=x.measureText(text).width;if(tw>size*.9){fs*=size*.9/tw;x.font=`900 ${fs}px Arial`;}x.fillText(text,size/2,size/4);/* shrink long labels to fit the sign instead of clipping */const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
 sign(text,w,h,x,y,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:this.textTexture(text),side:THREE.DoubleSide}));m.position.set(x,y,z);this.scene.add(m);return m;}
 court(){const c=document.createElement('canvas');c.width=2048;c.height=1100;const x=c.getContext('2d');x.fillStyle='#d7ab74';x.fillRect(0,0,2048,1100);for(let y=0;y<1100;y+=35){for(let xx=0;xx<2048;xx+=190){x.fillStyle=((xx/190+y/35)%3<1)?'#d0a16b':'#ddb682';x.fillRect(xx+(y%2)*70,y,188,33);}}
 x.fillStyle='#6934a5';x.fillRect(0,0,130,1100);x.fillRect(1918,0,130,1100);x.fillRect(0,0,2048,65);x.fillRect(0,1035,2048,65);x.strokeStyle='#fff6e4';x.lineWidth=6;x.strokeRect(130,65,1788,970);x.beginPath();x.moveTo(1024,65);x.lineTo(1024,1035);x.stroke();x.beginPath();x.arc(1024,550,155,0,Math.PI*2);x.stroke();
 for(const side of [0,1]){x.save();if(side){x.translate(2048,0);x.scale(-1,1);}x.fillStyle='#6934a5';x.fillRect(130,360,335,380);x.strokeRect(130,360,335,380);x.beginPath();x.arc(465,550,190,-Math.PI/2,Math.PI/2);x.stroke();x.beginPath();x.arc(250,550,590,-Math.PI/2.2,Math.PI/2.2);x.stroke();x.restore();}
 x.fillStyle='#fff';x.font='900 36px Arial';x.textAlign='center';x.fillText('LAKE WASHINGTON',1024,46);x.fillText('HOME OF THE KANGS',1024,1080);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;/* Center-court Kangs logo (transparent PNG); falls back to the K monogram if the image cannot load. */const logo=new Image();logo.onload=()=>{const w=470,h=w*logo.naturalHeight/logo.naturalWidth;x.drawImage(logo,1024-w/2,550-h/2,w,h);t.needsUpdate=true;};logo.onerror=()=>{x.fillStyle='#6934a5';x.font='900 italic 220px Arial';x.textAlign='center';x.fillText('K',1024,630);t.needsUpdate=true;};logo.src=`${import.meta.env.BASE_URL}images/kangs-logo.png`;t.anisotropy=8;return t;}
 build(){this.box(39,.6,29,0x221a35,0,-.6,0);const floor=new THREE.Mesh(new THREE.BoxGeometry(30,.16,17),this.mat(0xffffff,{map:this.court(),roughness:.36}));floor.position.y=-.04;floor.receiveShadow=true;this.scene.add(floor);
 this.box(39,5,.5,0x30203f,0,2,-14);this.box(.5,5,28,0x30203f,-19.5,2,0);this.sign('LAKE WASHINGTON  /  KANGS',18,2,0,4,-13.7);
 this.nets=[];for(const side of [-1,1]){
  for(let row=0;row<3;row++){this.box(30,.7,1.1,row%2?0x7e51b1:0x4e2b78,0,row*.7,side*(10+row));for(let i=0;i<24;i++){if((i+row)%4===0)continue;const head=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),this.mat([0xca9e79,0x8c5f41,0xf2cbab][i%3]));head.position.set(-14+i*1.2,1+row*.7,side*(10+row));this.scene.add(head);this.box(.38,.45,.25,i%3?0x7541b0:0xf3ecff,head.position.x,head.position.y-.35,head.position.z);}}
  const x=side*13.4;this.box(.28,3.8,.28,0x393846,x,1.9,0);this.box(1.3,.2,.25,0xd6d5df,x-side*.65,3.5,0);const back=this.box(.12,1.25,2.4,0xded9e9,x-side*.65,3.8,0);back.material.transparent=true;back.material.opacity=.6;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.045,8,32),this.mat(0xf27a24));ring.rotation.x=Math.PI/2;ring.position.set(x-side*1.25,3.28,0);this.scene.add(ring);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const points=[new THREE.Vector3(ring.position.x+Math.cos(a)*.48,3.25,Math.sin(a)*.48),new THREE.Vector3(ring.position.x+Math.cos(a+.25)*.28,2.65,Math.sin(a+.25)*.28)];const net=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffffff}));this.scene.add(net);this.nets.push({mesh:net,side});}
 }
 for(let i=0;i<4;i++){const b=this.sign(i===3?'YOUR SEASON':`KANGS ${2023+i}`,2.2,3,-14+i*3,4.5,-13.65);}
 this.scoreboard=this.sign('KANGS  0 : 0  GUEST',9,3,0,8,-11);this.box(9.4,3.4,.35,0x0e0d16,0,8,-11.25);
 for(let i=0;i<10;i++){const player=this.player(i,i<5?purple:0xf1e9df);this.people.push(player);this.scene.add(player);}
 this.ball=new THREE.Group();const sphere=new THREE.Mesh(new THREE.SphereGeometry(.28,24,16),this.mat(0xe9832a,{roughness:.85}));this.ball.add(sphere);for(let i=0;i<3;i++){const seam=new THREE.Mesh(new THREE.TorusGeometry(.282,.009,4,48),this.mat(0x392318));if(i===1)seam.rotation.x=Math.PI/2;if(i===2)seam.rotation.y=Math.PI/2;this.ball.add(seam);}this.scene.add(this.ball);
 // Program spaces share the gym: imported furniture, jersey wall, and coach desk.
 for(const z of [-13.4,13.4]){const led=this.box(36,.09,.12,0xa76aff,0,3,z);led.material.emissive.set(0x8e43ed);led.material.emissiveIntensity=3;}
 for(const x of [-10,0,10])for(const z of [-6,6]){const lamp=this.box(3,.08,.3,0xffffff,x,11,z);lamp.material.emissive.set(0xe5d7ff);lamp.material.emissiveIntensity=4;}
 this.addDetails();this.sign('LOCKER ROOM',6,1.3,-13,3.7,-13.65);this.sign('ALWAYS RISING.',8,1.5,12,3.4,-13.65);
 }
 player(i,color){const g=new THREE.Group();const skin=[0x9c6946,0xe4b58b,0x66432d,0xb67e57,0xd39871][i%5];const jersey=this.mat(color);const limb=(radius,length,c)=>new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,4,8),this.mat(c));const body=new THREE.Mesh(new THREE.CylinderGeometry(.27,.22,.65,8),jersey);body.position.y=1.18;g.add(body);g.userData.jersey=jersey;const head=new THREE.Mesh(new THREE.SphereGeometry(.205,12,10),this.mat(skin));head.position.y=1.78;g.add(head);const hair=new THREE.Mesh(new THREE.SphereGeometry(.21,12,8,0,Math.PI*2,0,Math.PI*.5),this.mat(0x242025));hair.position.y=1.82;g.add(hair);
 const number=new THREE.Mesh(new THREE.PlaneGeometry(.35,.35),new THREE.MeshBasicMaterial({map:this.textTexture(String([0,2,3,11,20][i%5]),i<5?'#6832ab':'#f1e9df',i<5?'#ffffff':'#562494',128),side:THREE.DoubleSide}));number.position.set(0,1.23,.255);g.add(number);g.userData.number=number;const nameplate=new THREE.Mesh(new THREE.PlaneGeometry(.45,.23),new THREE.MeshBasicMaterial({map:this.textTexture('KANGS','#6832ab','#ffffff',256)}));nameplate.position.set(0,1.3,-.255);nameplate.rotation.y=Math.PI;g.add(nameplate);g.userData.nameplate=nameplate;
 g.userData.legs=[];g.userData.arms=[];
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.15,.86,0);g.add(hip);
  const thigh=limb(.105,.21,skin);thigh.position.y=-.18;hip.add(thigh);
  const shorts=new THREE.Mesh(new THREE.BoxGeometry(.25,.27,.3),jersey);shorts.position.y=-.06;hip.add(shorts);
  const knee=new THREE.Group();knee.position.y=-.38;hip.add(knee);
  const shin=limb(.085,.22,skin);shin.position.y=-.16;knee.add(shin);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.20,.14,.36),this.mat(0xffffff));shoe.position.set(0,-.34,.07);knee.add(shoe);
  hip.userData.knee=knee;g.userData.legs.push(hip);
  const shoulder=new THREE.Group();shoulder.position.set(side*.30,1.46,0);g.add(shoulder);
  const upper=limb(.075,.18,skin);upper.position.y=-.14;shoulder.add(upper);
  const elbow=new THREE.Group();elbow.position.y=-.29;shoulder.add(elbow);
  const forearm=limb(.065,.17,skin);forearm.position.y=-.12;elbow.add(forearm);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),this.mat(skin));hand.position.y=-.27;elbow.add(hand);
  shoulder.userData.elbow=elbow;g.userData.arms.push(shoulder);
 }
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;
 }
 addDetails(){
  // Physical sideline details, rather than extra floating UI.
  for(const side of [-1,1]){
   this.box(.8,.65,.8,0x673a9b,side*13.4,.32,0); // padded hoop supports
   for(let i=0;i<4;i++)this.box(1.4,.08,.32,0xa186bf,side*18,2.3+i*.55,-5);
  }
  this.box(5,1,.8,0x211332,0,.5,8.9);this.sign('KANGS  /  SCORER’S TABLE',4.8,.6,0,.65,9.32);
  for(let i=0;i<5;i++){const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.065,.08,.35,8),this.mat(0xb7dff2));bottle.position.set(-2+i*.7,1.2,8.9);this.scene.add(bottle);}
  this.box(2.1,.12,.75,0x4d4555,-16,.35,6);for(let i=0;i<3;i++){const ball=new THREE.Mesh(new THREE.SphereGeometry(.27,16,12),this.mat(0xdd7d2b));ball.position.set(-16.7+i*.7,.7,6);this.scene.add(ball);}
  for(const z of [5.65,6.35])for(const x of [-17,-15])this.box(.06,1.1,.06,0xa3a1ae,x,.55,z);
  for(let i=0;i<4;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(.18,.5,12),this.mat(0xe67a24));cone.position.set(-17,.25,-3+i*1.2);this.scene.add(cone);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.57,48),new THREE.MeshBasicMaterial({color:0xe3bd69,transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;this.focusRing=ring;this.scene.add(ring);
  this.trail=[];for(let i=0;i<8;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:0xf6c078,transparent:true,opacity:(8-i)/16}));dot.visible=false;this.scene.add(dot);this.trail.push(dot);}
 }

 async importModels(){const loader=new GLTFLoader();for(const [name,positions,scale] of [['bench',[[-8,0,8.8],[-3,0,8.8],[3,0,8.8]],2],['chair',[[14,0,-10],[16,0,-10]],1.7],['table',[[15,0,-11]],1.8],['bookcaseClosedDoors',[[-16,0,-12],[-14,0,-12],[-12,0,-12]],2.1],['plantSmall1',[[18,0,-11]],2.5]]){
  try{const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);for(const pos of positions){const obj=gltf.scene.clone(true);obj.position.set(...pos);obj.scale.setScalar(scale);obj.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});this.scene.add(obj);}this.models++;}catch(error){console.warn('Asset unavailable',name,error);}
 }}
 mount(target){target.append(this.host);}
 setView(mode){if(this.failed)return;this.mode=mode;this.controls.enabled=mode!=='player';if(mode==='player'){this.fpLook=null;return;}const settings={broadcast:[[29,27,32],[0,0,0]],court:[[18,7.5,16],[0,1,0]],locker:[[-8,6,-4],[-14,1.6,-12]],office:[[22,7,-3],[15,1,-10]],follow:[[7,9,16],[7,1,0]]};const [pos,target]=settings[mode]||settings.broadcast;this.camera.position.set(...pos);this.controls.target.set(...target);this.controls.update();}
 firstPerson(){const clip=this.event?this.presentation()?.clip:null;const team=clip?.team||'home';const actor=this.people[clip?(team==='home'?0:5):2];if(!actor)return;const dir=team==='home'?1:-1;const rim=new THREE.Vector3(dir*12.15,3.05,0);const a=actor.position;const look=rim.clone().lerp(this.ball.position,.35);const flat=new THREE.Vector3(look.x-a.x,0,look.z-a.z);if(flat.lengthSq()<.01)flat.set(dir,0,0);flat.normalize();const eye=new THREE.Vector3(a.x+flat.x*.32,1.74,a.z+flat.z*.32);if(!this.fpLook){this.camera.position.copy(eye);this.fpLook=look.clone();}this.camera.position.lerp(eye,.25);this.fpLook.lerp(look,.12);this.camera.lookAt(this.fpLook);}
 setIdentity(p,person,home=true){
  const kit=this.state?.kit||'home',bg=home?(kit==='away'?'#f4effc':kit==='alternate'?'#191126':'#6832ab'):'#db7536';
  const fg=home?(kit==='away'?'#562494':this.state?.trim||'#ffffff'):'#ffffff';
  const key=[person?.id,person?.number,person?.name,bg,fg].join('|');if(p.userData.identity===key)return;p.userData.identity=key;
  p.userData.jersey.color.set(bg);
  const n=p.userData.number.material;n.map.dispose();n.map=this.textTexture(String(person?.number??11),bg,fg,128);
  const back=p.userData.nameplate.material;back.map.dispose();back.map=this.textTexture((person?.name||'VISITORS').split(' ').at(-1).toUpperCase(),bg,fg,256);
 }
 score(home,away){const key=`${home}:${away}`;if(this.scoreKey===key)return;this.scoreKey=key;this.scoreboard.material.map.dispose();this.scoreboard.material.map=this.textTexture(`KANGS  ${home} : ${away}  GUEST`,'#10111e','#d4f6ae');}
 update(s){if(this.failed)return;this.state=s;if(!this.event){const starters=s?.players.filter(p=>p.starter)||[];for(let i=0;i<5;i++)this.setIdentity(this.people[i],starters[i]||{id:i,number:[0,2,3,11,20][i],name:'Kangs'});}
  if(!this.event){const m=s?.match,r=s?.results.at(-1);this.score(m?.home??r?.home??0,m?.away??r?.away??0);}
 }
 play(event){
  this.event=event;this.playTime=0;this.paused=false;this.clipIndex=-1;this.presentKey='';
  // Previous saves still replay; old events have no detailed action record.
  this.clips=event.plays?.length===2?event.plays:[{team:'home',kind:event.three?'catch':'pullup',player:event.player,id:event.id,jersey:event.jersey||11,lane:1,contest:'contested',outcome:event.points?'made':'miss',points:event.points,commentary:event.explanation},{team:'away',kind:'pullup',player:'Visitors',jersey:12,lane:-1,contest:'contested',outcome:event.away?'made':'miss',points:event.away||0,commentary:'Visitors complete their possession.'}];
 }
 clear(){this.event=null;this.clips=null;this.playTime=0;this.paused=false;this.clipIndex=-1;this.ballFrom=null;this.focusRing&&(this.focusRing.visible=false);if(this.people.length===10)this.cast(this.state?.players.filter(p=>p.starter)||[]);}
 isPlaying(){return !!this.event&&this.playTime<CLIP_SECONDS*2;}
 presentation(){if(!this.event)return null;const index=Math.min(1,Math.floor(this.playTime/CLIP_SECONDS)),clip=this.clips[index],time=Math.min(CLIP_SECONDS,this.playTime-index*CLIP_SECONDS),pose=sampleClip(clip,time),e=this.event;return {index,clip,phase:pose.phase,done:!this.isPlaying(),home:e.home-e.points+(index>0||pose.resolved?e.points:0),away:e.visitor-e.away+(index===1&&pose.resolved?e.away:0),resolved:pose.resolved};}
 // Put the home bodies in pose order without moving them: a body that already wears a player's jersey keeps it.
 cast(list,identify){const pool=this.people.slice(0,5),id=m=>m.userData.identity?.split('|')[0],own=list.slice(0,5).map(person=>{const j=person?.id==null?-1:pool.findIndex(m=>id(m)===String(person.id));return j<0?null:pool.splice(j,1)[0];});
  for(let i=0;i<5;i++){this.people[i]=own[i]||pool.shift();if(identify)this.setIdentity(this.people[i],list[i]||{number:i+1,name:'Kangs'},true);}}
 // Remember where everything is drawn right now; the next poses ease out of it instead of jumping.
 snapshot(t0){if(!this.posed)return;this.people.forEach(p=>p.userData.from={x:p.position.x,y:p.position.y,z:p.position.z,yaw:p.rotation.y,t0});const b=this.ball.position;this.ballFrom={x:b.x,y:b.y,z:b.z,t0};}
 blend(from,pose,t){if(!from||!this.motion)return pose;const dx=pose.x-from.x,dz=pose.z-from.z,d=Math.hypot(dx,dz,pose.y-from.y);from.dur??=Math.min(1.35,Math.max(.3,d/8));const w=Math.max(0,(t-from.t0)/from.dur);if(w>=1||d<1e-4)return pose;
  const s=w*w*(3-2*w),turn=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k,trip=Math.min(1,d/2)*Math.sin(w*Math.PI);return {...pose,x:from.x+dx*s,y:from.y+(pose.y-from.y)*s,z:from.z+dz*s,yaw:turn(turn(from.yaw,pose.yaw,s),Math.atan2(dx,dz),trip*.9),run:Math.max(pose.run,trip)};}
 // A ball that has to change hands is passed along an arc.
 blendBall(target,t){const f=this.ballFrom;if(!f||!this.motion)return target;const d=Math.hypot(target.x-f.x,target.y-f.y,target.z-f.z);f.dur??=Math.min(1.2,Math.max(.25,d/11));const w=Math.max(0,(t-f.t0)/f.dur);if(w>=1)return target;const s=w*w*(3-2*w);return {x:f.x+(target.x-f.x)*s,y:f.y+(target.y-f.y)*s+Math.sin(w*Math.PI)*Math.min(2.4,d*.16),z:f.z+(target.z-f.z)*s};}
 posePlayer(player,pose,t,ease=1){
  const u=player.userData,run=u.run=ease>=1||u.run===undefined?pose.run:u.run+(pose.run-u.run)*ease;
  player.position.set(pose.x,pose.y,pose.z);player.rotation.set(0,pose.yaw,0);
  u.legs.forEach((leg,j)=>{leg.rotation.set(Math.sin(t*11+j*Math.PI)*.65*run,0,0);leg.userData.knee.rotation.x=Math.max(0,-Math.sin(t*11+j*Math.PI))*.8*run;});
  u.arms.forEach((arm,j)=>{const side=j?1:-1;let x=Math.sin(t*11+j*Math.PI)*.55*run,z=side*.12,elbow=-.25;
   if(['shoot','block','rebound'].includes(pose.arms)){x=-2.7;z=side*.12;elbow=-.25;}
   if(pose.arms==='hook'){x=j?-2.9:-.3;z=side*.25;elbow=-.4;}
   if(pose.arms==='defend'){x=-.5;z=side*1.1;elbow=-.2;}
   if(pose.arms==='screen'){x=-.1;z=side*.55;elbow=-.8;}
   if(pose.arms==='pass'){x=-1.6;elbow=-.1;}
   if(pose.arms==='dribble'){x=j?-.25+Math.sin(t*18)*.25:-.6;elbow=j?-.15:-.8;}
   const r=arm.rotation,e=arm.userData.elbow.rotation;r.set(r.x+(x-r.x)*ease,0,r.z+(z-r.z)*ease);e.x+=(elbow-e.x)*ease;
  });
 }
 frame(){if(this.failed)return;const dt=Math.min(this.clock.getDelta(),.05),w=this.host.clientWidth,h=this.host.clientHeight;
  if(w<1||h<1||this.host.hidden)return;if(this.w!==w||this.h!==h){this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=w/h<.8?65:43;this.camera.updateProjectionMatrix();}
  if(this.motion)this.time+=dt;
  // One continuous stride/dribble clock, so legs and arms never jump when a clip restarts.
  this.gait=(this.gait||0)+(this.motion&&!(this.event&&this.paused)?dt*(this.event?this.speed:1):0);
  if(this.event){
   if(!this.paused)this.playTime=Math.min(CLIP_SECONDS*2,this.playTime+dt*this.speed);
   const presentation=this.presentation(),clip=presentation.clip,index=presentation.index,clipTime=Math.min(CLIP_SECONDS,this.playTime-index*CLIP_SECONDS);
   // New clip: re-order bodies (never re-dress them) so the clip's defender is people[0], then ease everyone from where they stand.
   if(index!==this.clipIndex){this.clipIndex=index;const lineup=this.event.lineup||this.state?.players.filter(p=>p.starter)||[];let home=[...lineup];if(index===1&&clip.defenderId!==undefined)home.sort((a,b)=>(a.id===clip.defenderId?-1:b.id===clip.defenderId?1:0));this.cast(home,true);for(let i=0;i<5;i++)this.setIdentity(this.people[i+5],{id:-i-1,number:i===0?(this.clips[1].jersey||12):[12,8,22,30,24][i],name:'Visitors'},false);this.trail.forEach(d=>d.visible=false);this.snapshot(clipTime);}else if(this.motion!==this.blendMotion)this.snapshot(clipTime);this.blendMotion=this.motion;
   const pose=sampleClip(clip,this.motion?clipTime:(presentation.resolved?CLIP_SECONDS:0)),u=clipTime/CLIP_SECONDS,o=clip.team==='home'?0:5,ease=!this.motion?1:this.paused?0:1-Math.exp(-dt*this.speed*22);
   pose.actors.forEach((p,i)=>this.posePlayer(this.people[i],this.blend(this.people[i].userData.from,p,clipTime),this.gait,ease));
   // While a player is still easing into place the ball stays in his hands (the handler, or the defender after a steal).
   const sm=x=>(x=Math.max(0,Math.min(1,x)),x*x*(3-2*x)),off=j=>[this.people[j].position.x-pose.actors[j].x,this.people[j].position.z-pose.actors[j].z],a=off(o),b=off(5-o),st=clip.outcome==='steal'?sm((u-.27)/.09):0,hold=1-sm((u-.55)/.06);
   const ball=this.blendBall({x:pose.ball.x+(a[0]+(b[0]-a[0])*st)*hold,y:pose.ball.y,z:pose.ball.z+(a[1]+(b[1]-a[1])*st)*hold},clipTime);this.ball.position.set(ball.x,ball.y,ball.z);this.ball.rotation.set(this.gait*6,0,this.gait*2);
   this.focusRing.visible=true;this.focusRing.position.x=this.people[o].position.x;this.focusRing.position.z=this.people[o].position.z;
   this.nets.forEach(n=>n.mesh.rotation.y=n.side===(clip.team==='home'?1:-1)?pose.net:0);
   this.trail.forEach((d,i)=>{d.visible=this.motion&&clipTime>CLIP_SECONDS*.61&&clipTime<CLIP_SECONDS*.9&&clip.outcome!=='steal';if(d.visible){const previous=sampleClip(clip,Math.max(0,clipTime-i*.025)).ball;d.position.set(previous.x,previous.y,previous.z);}});
   this.score(presentation.home,presentation.away);
   const key=`${index}|${pose.phase}|${presentation.resolved}|${presentation.done}`;if(key!==this.presentKey){this.presentKey=key;this.onPresentation?.(presentation);}
  }else{
   // Idle gym: dribbling and movement only. No invisible automatic shot loop.
   // Players jog back to their spots and the ball is passed to the dribbler; nothing snaps unless motion is off.
   const live=this.motion&&this.posed,ease=live?1-Math.exp(-dt*22):1,turn=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;this.idleClock=(this.idleClock||0)+dt;if(!this.ballFrom||this.blendMotion!==this.motion){this.blendMotion=this.motion;this.snapshot(this.idleClock);}
   this.people.forEach((p,i)=>{const k=i%5,tx=[-6,-2,4,8,1][k]+(i>=5?1:0),tz=[-4,4,-3,3,0][k],rest=i<5?Math.PI/2:-Math.PI/2,dx=tx-p.position.x,dz=tz-p.position.z,d=Math.hypot(dx,dz),v=Math.min(5,d*2.2),step=!live||d<.02?d:Math.min(d,v*dt);
    this.posePlayer(p,{x:p.position.x+(d?dx/d*step:0),y:live?p.position.y*Math.exp(-dt*12):0,z:p.position.z+(d?dz/d*step:0),yaw:live?turn(p.rotation.y,d>.6?Math.atan2(dx,dz):rest,1-Math.exp(-dt*7)):rest,run:live&&d>.02?Math.min(1,v/5):0,arms:i===2?'dribble':'relax'},this.gait,ease);});
   const p=this.people[2].position,b=this.blendBall({x:p.x+.4,y:.3+Math.abs(Math.sin(this.gait*6))*.9,z:p.z+.25},this.idleClock);this.ball.position.set(b.x,b.y,b.z);this.trail.forEach(d=>d.visible=false);
  }
  this.posed=true;
  if(this.mode==='follow'&&this.event){const side=this.clipIndex===1?-1:1;const focus=this.people[side===1?0:5].position;const x=THREE.MathUtils.clamp(focus.x,-10,10);this.camera.position.lerp(new THREE.Vector3(x,8.5,14),.045);this.controls.target.lerp(new THREE.Vector3(x,1.2,0),.08);}if(this.mode==='player'){this.firstPerson();}else this.controls.update();const fov=this.mode==='player'?74:(this.w/this.h<.8?65:43);if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}this.renderer.render(this.scene,this.camera);
 }
}
