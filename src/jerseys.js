// The locker-room showcase: three tank-top jerseys (home, away, midnight) that turn slowly under a spotlight.
// One WebGL canvas is created once and moved into whichever page shows it, so switching pages never piles up WebGL contexts.
import * as THREE from 'three';

export const KITS={
 home:{body:'#6832ab',dark:'#4a1f80',trim:'#ffffff',ink:'#ffffff',accent:'#e9b858'},
 away:{body:'#f4effc',dark:'#d9cdee',trim:'#562494',ink:'#562494',accent:'#8b4fe0'},
 alternate:{body:'#191126',dark:'#0d0915',trim:'#e9b858',ink:'#e9b858',accent:'#8b4fe0'}
};
const ORDER=['home','away','alternate'],SPACING=2.3;

// The outline of a tank top in a 0..W by 0..H box (y down), drawn into a 2D canvas path.
function outline(x,W,H){
 const c=W/2;x.beginPath();
 x.moveTo(W*.30,0);x.lineTo(W*.38,0);x.quadraticCurveTo(c,H*.17,W*.62,0);x.lineTo(W*.70,0);
 x.bezierCurveTo(W*.70,H*.2,W*.84,H*.22,W*.96,H*.3);x.lineTo(W*.9,H);x.lineTo(W*.1,H);x.lineTo(W*.04,H*.3);
 x.bezierCurveTo(W*.16,H*.22,W*.30,H*.2,W*.30,0);x.closePath();
}
// One face of the jersey as a texture: the silhouette (transparent outside), trim along the neck and arm holes, and the lettering.
function faceTexture(kit,side,number,font){
 const W=512,H=640,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
 x.save();outline(x,W,H);x.clip();
 const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,kit.body);g.addColorStop(1,kit.dark);x.fillStyle=g;x.fillRect(0,0,W,H);
 // side panels and a hem stripe
 x.fillStyle=kit.trim;x.globalAlpha=.9;x.fillRect(0,H-26,W,26);x.fillRect(W*.04,H*.34,16,H);x.fillRect(W-W*.04-16,H*.34,16,H);x.globalAlpha=1;
 x.fillStyle=kit.accent;x.fillRect(0,H-34,W,8);
 x.restore();
 // trim around the neck and arm holes
 x.lineWidth=14;x.strokeStyle=kit.trim;x.lineJoin='round';
 x.beginPath();x.moveTo(W*.38,2);x.quadraticCurveTo(W/2,H*(side==='front'?.19:.1),W*.62,2);x.stroke();
 x.beginPath();x.moveTo(W*.70,2);x.bezierCurveTo(W*.70,H*.2,W*.84,H*.22,W*.96,H*.3);x.stroke();
 x.beginPath();x.moveTo(W*.30,2);x.bezierCurveTo(W*.30,H*.2,W*.16,H*.22,W*.04,H*.3);x.stroke();
 x.fillStyle=kit.ink;x.textAlign='center';x.textBaseline='alphabetic';
 if(side==='front'){x.font=`italic 900 92px ${font}`;x.fillText('KANGS',W/2,H*.42);x.font=`italic 900 230px ${font}`;x.fillText(String(number),W/2,H*.8);}
 else{x.font=`italic 800 62px ${font}`;x.fillText('KANGS',W/2,H*.33);x.font=`italic 900 300px ${font}`;x.fillText(String(number),W/2,H*.8);}
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
  const group=new THREE.Group();group.position.x=(i-1)*SPACING;
  const geo=()=>{const gm=new THREE.PlaneGeometry(2,2.5,28,36),p=gm.attributes.position;for(let k=0;k<p.count;k++){const u=p.getX(k)/1;p.setZ(k,.15*(1-u*u)*(1-.25*(p.getY(k)/1.25)));}gm.computeVertexNormals();return gm;};
  const mat=()=>new THREE.MeshStandardMaterial({transparent:false,alphaTest:.5,side:THREE.DoubleSide,roughness:.72,metalness:.04});
  const front=new THREE.Mesh(geo(),mat()),back=new THREE.Mesh(geo(),mat());back.rotation.y=Math.PI;back.scale.z=1;
  group.add(front,back);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.3,32),new THREE.MeshBasicMaterial({map:floorGlow,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.5;group.add(shadow);
  const ring=new THREE.Mesh(new THREE.CircleGeometry(1.45,40),new THREE.MeshBasicMaterial({map:goldGlow,transparent:true,depthWrite:false,opacity:0}));ring.rotation.x=-Math.PI/2;ring.position.y=-1.49;group.add(ring);
  scene.add(group);return {kitKey,group,front,back,ring,hover:0,sel:0,phase:i*1.7};
 });
 let resizer=null,number=11,font='"Barlow Condensed",Arial,sans-serif',selected='home',motion=true,hoverIdx=-1,raf=0,last=performance.now(),size={w:0,h:0},focusIdx=-1;
 const paint=()=>{for(const p of pieces){const kit=KITS[p.kitKey];for(const [m,side] of [[p.front,'front'],[p.back,'back']]){m.material.map?.dispose();m.material.map=faceTexture(kit,side,number,font);m.material.needsUpdate=true;}}};
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
 const pick=e=>{const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-(((e.clientY-r.top)/r.height)*2-1));ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects(pieces.flatMap(p=>[p.front,p.back]));const h=hits[0]?.object;return pieces.findIndex(p=>p.front===h||p.back===h);};
 canvas.addEventListener('pointermove',e=>{const i=pick(e);if(i!==hoverIdx){hoverIdx=i;canvas.style.cursor=i>=0?'pointer':'default';wake();}});
 canvas.addEventListener('pointerleave',()=>{hoverIdx=-1;wake();});
 canvas.addEventListener('click',e=>{const i=pick(e);if(i>=0){selected=pieces[i].kitKey;onPick?.(selected);wake();}});
 function resize(){const r=canvas.parentElement?.getBoundingClientRect();if(!r||!r.width||!r.height)return;if(Math.abs(r.width-size.w)<1&&Math.abs(r.height-size.h)<1)return;size={w:r.width,h:r.height};renderer.setSize(r.width,r.height,false);canvas.style.width='100%';canvas.style.height='100%';camera.aspect=r.width/r.height;
  // keep all three jerseys in view on narrow containers
  const width=2*SPACING+2.5,need=width/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(camera.aspect,.1));camera.position.z=Math.max(5.4,need);camera.updateProjectionMatrix();}
 function frame(now){
  raf=0;if(!canvas.isConnected)return;const dt=Math.min(.05,(now-last)/1000);last=now;resize();let moving=false;
  pieces.forEach((p,i)=>{
   p.group.rotation.y=((p.group.rotation.y%(2*Math.PI))+2*Math.PI)%(2*Math.PI);if(!motion&&p.group.rotation.y>Math.PI)p.group.rotation.y-=2*Math.PI;const isSel=p.kitKey===selected;p.sel+=((isSel?1:0)-p.sel)*Math.min(1,dt*8);p.hover+=((i===hoverIdx||i===focusIdx?1:0)-p.hover)*Math.min(1,dt*10);
   if(motion)p.group.rotation.y+=dt*(.55+.2*Math.sin(p.phase));else p.group.rotation.y+=((.38-(i-1)*.12)-p.group.rotation.y)*Math.min(1,dt*6);
   const s=1+.14*p.sel+.05*p.hover;p.group.scale.setScalar(s);p.group.position.y=.15*p.hover+(motion?.04*Math.sin(now/700+p.phase):0);p.ring.material.opacity=p.sel;
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
  setNumber(n){if(n!==number){number=n;paint();wake();}},
  setMotion(on){motion=!!on;wake();},
  focusKit(i){focusIdx=i;wake();},
  refreshFont(f){font=f||font;paint();wake();},
  dispose(){cancelAnimationFrame(raf);for(const p of pieces){p.front.material.map?.dispose();p.back.material.map?.dispose();}renderer.dispose();canvas.remove();}
 };
}
