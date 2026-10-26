// The locker-room showcase: six tank-top jerseys under a spotlight (home, away and midnight above; throwback, senior night and blackout below).
// The special kits show a padlock until the season earns them. All six wear the selected player's name and number.
// One WebGL canvas is created once and moved into whichever page shows it, so switching pages never piles up WebGL contexts.
import * as THREE from 'three';
import {KITS,ALL_KITS,SPECIAL_KITS} from './kits.js';
export {KITS};

const ORDER=ALL_KITS,SPACING=2.3,ROW_Y=[1.5,-1.55];
// The front reads "Lake" / number / "Washington" in a script like the school's real jerseys (Yellowtail, bundled locally).
export const SCRIPT_FONT='"Yellowtail","Brush Script MT","Segoe Script",cursive';

// The outline of a tank top in a 0..W by 0..H box (y down), drawn into a 2D canvas path.
function outline(x,W,H){
 const c=W/2;x.beginPath();
 x.moveTo(W*.30,0);x.lineTo(W*.38,0);x.quadraticCurveTo(c,H*.17,W*.62,0);x.lineTo(W*.70,0);
 x.bezierCurveTo(W*.70,H*.2,W*.84,H*.22,W*.96,H*.3);x.lineTo(W*.9,H);x.lineTo(W*.1,H);x.lineTo(W*.04,H*.3);
 x.bezierCurveTo(W*.16,H*.22,W*.30,H*.2,W*.30,0);x.closePath();
}
function star(x,cx,cy,r,fill){x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.42:r;x.lineTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad);}x.closePath();x.fillStyle=fill;x.fill();}
function padlock(x,W,H){
 const cx=W/2,cy=H*.52;x.save();x.lineWidth=22;x.lineCap='round';x.strokeStyle='#8f879e';x.beginPath();x.arc(cx,cy-34,46,Math.PI,0);x.lineTo(cx+46,cy-6);x.moveTo(cx-46,cy-34);x.lineTo(cx-46,cy-6);x.stroke();
 x.fillStyle='#a49cb3';x.beginPath();x.roundRect(cx-76,cy-8,152,118,16);x.fill();x.fillStyle='#4a4358';x.beginPath();x.arc(cx,cy+38,14,0,Math.PI*2);x.fill();x.fillRect(cx-6,cy+38,12,34);x.restore();
}
// Fit a line of lettering into a width by shrinking the font size.
function fitText(x,text,maxPx,maxW,weight,font,min=34){let size=maxPx;do{x.font=`italic ${weight} ${size}px ${font}`;size-=2;}while(x.measureText(text).width>maxW&&size>min);}
// One face of the jersey as a texture: the silhouette (transparent outside), trim along the neck and arm holes, and the lettering.
function faceTexture(kit,side,{number,name},font,locked){
 const W=512,H=640,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
 if(locked)kit={body:'#4b4658',dark:'#2c2836',trim:'#6a6478',ink:'#8f879e',accent:'#3a3546'};
 x.save();outline(x,W,H);x.clip();
 const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,kit.body);g.addColorStop(1,kit.dark);x.fillStyle=g;x.fillRect(0,0,W,H);
 if(kit.sleeves){x.fillStyle=kit.sleeves;x.beginPath();x.moveTo(0,0);x.lineTo(W*.3,0);x.bezierCurveTo(W*.3,H*.2,W*.16,H*.22,W*.04,H*.3);x.lineTo(W*.07,H*.5);x.quadraticCurveTo(W*.17,H*.4,W*.2,H*.26);x.bezierCurveTo(W*.24,H*.25,W*.27,H*.18,W*.28,H*.06);x.lineTo(0,0);x.fill();
  x.beginPath();x.moveTo(W,0);x.lineTo(W*.7,0);x.bezierCurveTo(W*.7,H*.2,W*.84,H*.22,W*.96,H*.3);x.lineTo(W*.93,H*.5);x.quadraticCurveTo(W*.83,H*.4,W*.8,H*.26);x.bezierCurveTo(W*.76,H*.25,W*.73,H*.18,W*.72,H*.06);x.lineTo(W,0);x.fill();}
 if(kit.stripe||kit.vintage){ // pinstripes (blackout) or a faint cream grain (throwback)
  x.globalAlpha=kit.vintage?.07:.16;x.strokeStyle=kit.vintage?'#6832ab':kit.accent;x.lineWidth=kit.vintage?1:2;for(let k=-H;k<W+H;k+=kit.vintage?9:26){x.beginPath();x.moveTo(k,0);x.lineTo(k+H*.7,H);x.stroke();}x.globalAlpha=1;}
 // side panels and a hem stripe
 x.fillStyle=kit.trim;x.globalAlpha=.9;x.fillRect(0,H-26,W,26);x.fillRect(W*.04,H*.34,16,H);x.fillRect(W-W*.04-16,H*.34,16,H);x.globalAlpha=1;
 x.fillStyle=kit.stripe||kit.accent;x.fillRect(0,H-34,W,8);
 if(kit.vintage&&side==='back'){ // retro chest bands, purple over gold
  const y=H*.4;x.fillStyle=kit.trim;x.fillRect(0,y,W,22);x.fillStyle=kit.accent;x.fillRect(0,y+30,W,9);}
 x.restore();
 // trim around the neck and arm holes
 x.lineWidth=kit.star?18:14;x.strokeStyle=kit.trim;x.lineJoin='round';
 x.beginPath();x.moveTo(W*.38,2);x.quadraticCurveTo(W/2,H*(side==='front'?.19:.1),W*.62,2);x.stroke();
 x.beginPath();x.moveTo(W*.70,2);x.bezierCurveTo(W*.70,H*.2,W*.84,H*.22,W*.96,H*.3);x.stroke();
 x.beginPath();x.moveTo(W*.30,2);x.bezierCurveTo(W*.30,H*.2,W*.16,H*.22,W*.04,H*.3);x.stroke();
 if(locked){padlock(x,W,H);}
 else{
  x.fillStyle=kit.ink;x.textAlign='center';x.textBaseline='alphabetic';x.lineJoin='round';
  const letter=(text,px,y,weight)=>{ if(kit.vintage){x.strokeStyle=kit.accent;x.lineWidth=Math.max(5,px/22);x.strokeText(text,W/2,y);} x.fillText(text,W/2,y); };
  if(side==='front'){
   const script=(text,size,y,maxW,rot)=>{x.save();x.translate(W/2,y);x.rotate(rot);if('letterSpacing' in x)x.letterSpacing='3px';let s=size;x.font=`400 ${s}px ${SCRIPT_FONT}`;while(x.measureText(text).width>maxW&&s>40){s-=4;x.font=`400 ${s}px ${SCRIPT_FONT}`;}x.lineWidth=Math.max(6,s/9);x.strokeStyle=kit.scriptLine||kit.trim;x.strokeText(text,0,0);x.fillStyle=kit.script||kit.ink;x.fillText(text,0,0);x.restore();};
   script('Lake',112,H*.35,W*.4,-.06);
   x.font=`800 188px ${font}`;x.lineWidth=22;x.strokeStyle=kit.numLine||kit.trim;x.strokeText(String(number),W/2,H*.635);x.fillStyle=kit.num||kit.ink;x.fillText(String(number),W/2,H*.635);
   script('Washington',92,H*.81,W*.62,-.045);
  }
  else{fitText(x,name,92,W*.62,800,font);letter(name,72,H*.33);x.font=`italic 900 300px ${font}`;letter(String(number),300,H*.8);}
  if(kit.star&&side==='back'){star(x,W/2,H*.9-2,30,kit.accent);star(x,W/2-74,H*.9+6,17,kit.accent);star(x,W/2+74,H*.9+6,17,kit.accent);}
 }
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function glow(color){const cv=document.createElement('canvas');cv.width=cv.height=128;const x=cv.getContext('2d'),g=x.createRadialGradient(64,64,6,64,64,64);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(cv);return t;}

export function createJerseyShowcase({onPick}={}){
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{return null;}
 renderer.setPixelRatio(Math.min(2,globalThis.devicePixelRatio||1));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const canvas=renderer.domElement;canvas.className='jersey-canvas';canvas.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,50);camera.position.set(0,.2,6.4);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x3b2760,1.15));
 const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(2.5,4,5);scene.add(key);
 const rim=new THREE.PointLight(0x9d5cf2,40,14);rim.position.set(-3,1,-2);scene.add(rim);
 const spot=new THREE.PointLight(0xe9b858,16,10);spot.position.set(0,3,3);scene.add(spot);
 const floorGlow=glow('rgba(180,138,255,.55)'),goldGlow=glow('rgba(233,184,88,.9)');
 const pieces=ORDER.map((kitKey,i)=>{
  const col=i%3,row=Math.floor(i/3),baseY=ROW_Y[row],group=new THREE.Group();group.position.set((col-1)*SPACING,baseY,0);
  const geo=()=>{const gm=new THREE.PlaneGeometry(2,2.5,28,36),p=gm.attributes.position;for(let k=0;k<p.count;k++){const u=p.getX(k)/1;p.setZ(k,.15*(1-u*u)*(1-.25*(p.getY(k)/1.25)));}gm.computeVertexNormals();return gm;};
  const mat=()=>new THREE.MeshStandardMaterial({transparent:false,alphaTest:.5,side:THREE.DoubleSide,roughness:.72,metalness:.04});
  const front=new THREE.Mesh(geo(),mat()),back=new THREE.Mesh(geo(),mat());back.rotation.y=Math.PI;back.scale.z=1;
  group.add(front,back);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.3,32),new THREE.MeshBasicMaterial({map:floorGlow,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.5;group.add(shadow);
  const ring=new THREE.Mesh(new THREE.CircleGeometry(1.45,40),new THREE.MeshBasicMaterial({map:goldGlow,transparent:true,depthWrite:false,opacity:0}));ring.rotation.x=-Math.PI/2;ring.position.y=-1.49;group.add(ring);
  scene.add(group);return {kitKey,group,front,back,ring,col,baseY,hover:0,sel:0,phase:i*1.7,locked:SPECIAL_KITS.includes(kitKey)};
 });
 let resizer=null,player={number:11,name:'KANGS'},font='"Barlow Condensed",Arial,sans-serif',selected='home',motion=true,hoverIdx=-1,raf=0,last=performance.now(),size={w:0,h:0},focusIdx=-1;
 const paint=()=>{for(const p of pieces){const kit=KITS[p.kitKey];for(const [m,side] of [[p.front,'front'],[p.back,'back']]){m.material.map?.dispose();m.material.map=faceTexture(kit,side,player,font,p.locked);m.material.needsUpdate=true;}}};
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
 const pick=e=>{const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-(((e.clientY-r.top)/r.height)*2-1));ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects(pieces.flatMap(p=>[p.front,p.back]));const h=hits[0]?.object;return pieces.findIndex(p=>p.front===h||p.back===h);};
 canvas.addEventListener('pointermove',e=>{const i=pick(e);if(i!==hoverIdx){hoverIdx=i;canvas.style.cursor=i>=0?'pointer':'default';wake();}});
 canvas.addEventListener('pointerleave',()=>{hoverIdx=-1;wake();});
 canvas.addEventListener('click',e=>{const i=pick(e);if(i>=0){const p=pieces[i];if(!p.locked)selected=p.kitKey;onPick?.(p.kitKey);wake();}});
 function resize(){const r=canvas.parentElement?.getBoundingClientRect();if(!r||!r.width||!r.height)return;if(Math.abs(r.width-size.w)<1&&Math.abs(r.height-size.h)<1)return;size={w:r.width,h:r.height};renderer.setSize(r.width,r.height,false);canvas.style.width='100%';canvas.style.height='100%';camera.aspect=r.width/r.height;
  // keep all six jerseys in view, whichever of width or height is the tight one
  const half=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),needW=(2*SPACING+2.5)/(2*half*Math.max(camera.aspect,.1)),needH=(ROW_Y[0]-ROW_Y[1]+3.5)/(2*half);camera.position.z=Math.max(5.4,needW,needH);camera.position.y=(ROW_Y[0]+ROW_Y[1])/2+.1;camera.lookAt(0,(ROW_Y[0]+ROW_Y[1])/2,0);camera.updateProjectionMatrix();}
 function frame(now){
  raf=0;if(!canvas.isConnected)return;const dt=Math.min(.05,(now-last)/1000);last=now;resize();let moving=false;
  pieces.forEach((p,i)=>{
   p.group.rotation.y=((p.group.rotation.y%(2*Math.PI))+2*Math.PI)%(2*Math.PI);const isSel=p.kitKey===selected;p.sel+=((isSel?1:0)-p.sel)*Math.min(1,dt*8);p.hover+=((i===hoverIdx||i===focusIdx?1:0)-p.hover)*Math.min(1,dt*10);
   if(motion)p.group.rotation.y+=dt*(.55+.2*Math.sin(p.phase));else p.group.rotation.y+=((Math.PI+.3-(p.col-1)*.14)-p.group.rotation.y)*Math.min(1,dt*6); // still: turned to show the back, where the name is
   const s=1+.14*p.sel+.05*p.hover;p.group.scale.setScalar(s);p.group.position.y=p.baseY+.15*p.hover+(motion?.04*Math.sin(now/700+p.phase):0);p.ring.material.opacity=p.sel;
   if(Math.abs(p.sel-(isSel?1:0))>.01||Math.abs(p.hover-(i===hoverIdx||i===focusIdx?1:0))>.01)moving=true;
  });
  renderer.render(scene,camera);
  if(motion||moving)raf=requestAnimationFrame(frame);
 }
 function wake(){if(!raf&&canvas.isConnected){last=performance.now();raf=requestAnimationFrame(frame);}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)wake();});
 paint();
 return {
  canvas,
  mount(container){if(canvas.parentElement!==container)container.appendChild(canvas);size={w:0,h:0};focusIdx=-1;resizer?.disconnect();if(globalThis.ResizeObserver){resizer=new ResizeObserver(()=>wake());resizer.observe(container);}wake();},
  setKit(k){if(ORDER.includes(k)){selected=k;wake();}},
  // Name and number on the jerseys: only the textures are repainted, the scene stays as it is.
  setPlayer({name,number:n}){const nm=String(name||'KANGS').toUpperCase();if(nm!==player.name||n!==player.number){player={name:nm,number:n};paint();wake();}},
  setNumber(n){if(n!==player.number){player={...player,number:n};paint();wake();}},
  setUnlocked(list){let changed=false;for(const p of pieces){const lock=SPECIAL_KITS.includes(p.kitKey)&&!list?.includes(p.kitKey);if(lock!==p.locked){p.locked=lock;changed=true;}}if(changed){paint();wake();}},
  setMotion(on){motion=!!on;wake();},
  focusKit(i){focusIdx=i;wake();},
  refreshFont(f){font=f||font;paint();wake();},
  dispose(){cancelAnimationFrame(raf);for(const p of pieces){p.front.material.map?.dispose();p.back.material.map?.dispose();}renderer.dispose();canvas.remove();}
 };
}
