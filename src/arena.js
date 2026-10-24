import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CLIP_SECONDS, SHOTS, sampleClip, isDunk} from './basketball.js';
import {drawScoreboard, scoreboardData, scoreboardKey, setScoreboardLogo, setScoreboardOpponentLogo, boardGame} from './scoreboard.js';
import {oppRoster} from './engine.js';
import {visitorCast} from './identities.js';
import {qualityProfile, lowerLevel, autoDowngrade, probeDone, PROBE} from './graphics.js';
import {loadOpponentLogo} from './logos.js';
const purple=0x6832ab;
export class Arena{
 constructor(host){
  this.speed=1;this.playTime=0;this.paused=false;this.host=host;this.models=0;this.people=[];this.time=0;this.motion=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;this.shakeOn=true;this.shake=0;this.run=0;this.mode='broadcast';this.texts=new Set();this.quality='auto';this.level='high';this.probe={times:[],frames:0,done:false};this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#100e22');this.scene.fog=new THREE.Fog('#100e22',75,150);
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){host.innerHTML='<div class="fallback">3D graphics unavailable on this device. All coaching controls remain playable.</div>';this.failed=true;return;}
  /* Pixel ratio 2 keeps lines and signs sharp on hi-DPI screens; the old 1.7 cap upscaled a soft canvas. */this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.aniso=this.renderer.capabilities.getMaxAnisotropy();this.renderer.domElement.setAttribute('aria-hidden','true');host.append(this.renderer.domElement);
  this.camera=new THREE.PerspectiveCamera(43,16/9,.1,220);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.minDistance=6;this.controls.maxDistance=85;this.controls.maxPolarAngle=Math.PI*.46;this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.addEventListener('start',()=>{this.userMoved=true;if(this.mode==='follow'||this.mode==='auto'){this.mode='court';this.host.dispatchEvent(new CustomEvent('cameramode',{bubbles:true,detail:'court'}));}});
  this.scene.add(new THREE.HemisphereLight(0xded5ff,0x2a1f3c,.95));const sun=new THREE.DirectionalLight(0xffeee2,2.2);sun.position.set(6,25,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:75});sun.shadow.bias=-.0005;this.sun=sun;this.scene.add(sun);
  const fill=new THREE.PointLight(0x9e61ff,80,60);fill.position.set(-15,9,-11);this.scene.add(fill);const desk=new THREE.PointLight(0xffe2c4,140,18);desk.position.set(16,6,-12);this.scene.add(desk);
  for(const x of [-10,0,10]){const light=new THREE.SpotLight(0xf4edff,100,42,.65,.65,1.4);light.position.set(x,15,1);light.target.position.set(x,0,0);this.scene.add(light,light.target);}
  this.build();this.importModels();this.setView('broadcast');
  /* Re-solve the camera preset whenever the canvas changes shape (title, HQ, game and phone layouts all differ). */new ResizeObserver(()=>{if(!this.userMoved&&this.mode!=='player'&&!((this.mode==='follow'||this.mode==='auto')&&this.event))this.setView(this.mode);}).observe(host);
  /* Barlow is a CSS webfont: redraw every canvas texture once it has loaded so no sign stays in the fallback face. */Promise.all(['900 64px "Barlow Condensed"','italic 900 64px "Barlow Condensed"','700 64px Barlow'].map(f=>document.fonts?.load(f))).then(()=>{this.fontsReady=true;this.texts.forEach(draw=>draw());this.texts.clear();}).catch(()=>{});
  this.clock=new THREE.Clock();this.renderer.setAnimationLoop(()=>this.frame());
 }
 mat(c,extra={}){return new THREE.MeshStandardMaterial({color:c,roughness:.68,...extra});}
 box(w,h,d,c,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m;}
 glow(m,c,i=3){m.material.emissive.set(c);m.material.emissiveIntensity=i;m.castShadow=false;return m;}
 /* Crisp canvas text: canvas matches the mesh aspect (o.aspect, default 2:1 for legacy calls), Barlow Condensed fitted to the canvas, mipmaps + max anisotropy, redrawn once the webfont is ready. "\n" splits lines. */
 textTexture(text,bg='#562494',fg='#ffffff',size=512,o={}){const a=o.aspect||2,W=Math.round(Math.min(2048,o.px||Math.max(512,size*2))),H=Math.max(48,Math.round(W/a)),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),t=new THREE.CanvasTexture(c),lines=String(text).split('\n'),font=s=>{x.font=`${o.italic?'italic ':''}900 ${s}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`;if('letterSpacing' in x)x.letterSpacing=`${s*(o.spacing??.03)}px`;};
  const draw=()=>{x.fillStyle=bg;x.fillRect(0,0,W,H);if(o.border){x.fillStyle=o.border;x.fillRect(0,H*.9,W,H*.05);x.fillRect(0,H*.03,W,H*.025);}let fs=H*(o.scale||.62)/lines.length;font(fs);const widest=Math.max(...lines.map(l=>x.measureText(l).width));if(widest>W*.88){fs*=W*.88/widest;font(fs);}
   x.fillStyle=fg;x.textAlign='center';x.textBaseline='alphabetic';lines.forEach((l,i)=>{const m=x.measureText(l);x.fillText(l,W/2,H*(i+.5)/lines.length+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);});t.needsUpdate=true;};
  draw();t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso||8;if(!this.fontsReady){this.texts.add(draw);t.addEventListener('dispose',()=>this.texts.delete(draw));}return t;}
 sign(text,w,h,x,y,z,o={}){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:this.textTexture(text,o.bg,o.fg,512,{aspect:w/h,px:Math.min(2048,Math.max(256,Math.round(w*200))),...o}),toneMapped:false}));m.position.set(x,y,z);m.rotation.y=o.ry||0;this.scene.add(m);return m;}
 /* NFHS high-school court (84'x50') on the 32x20 floor at 128 px per world unit. Feet->units is solved so the basket centre, 5'3" in from the baseline, sits exactly under the 3D rims at x=+-12.15 (1 ft = 0.3306 u; baselines at +-13.89, sidelines at +-8.27). */
 court(){const S=Math.min(1,(this.renderer.capabilities.maxTextureSize||4096)/4096),c=document.createElement('canvas');c.width=4096*S;c.height=2560*S;const x=c.getContext('2d'),t=new THREE.CanvasTexture(c),U=128,F=U*12.15/36.75,cx=2048,cy=1280,L=42*F,Wd=25*F,lw=Math.max(7,F/6),lane=6*F,logo=new Image(),R=n=>{const s=Math.sin(n*127.1)*43758.5453;return s-Math.floor(s);};
  const draw=()=>{x.setTransform(S,0,0,S,0,0);x.fillStyle='#6934a5';x.fillRect(0,0,4096,2560);
   x.save();x.beginPath();x.rect(cx-L,cy-Wd,2*L,2*Wd);x.clip();for(let r=0,y=cy-Wd;y<cy+Wd;r++,y+=U*.5){let px=cx-L-R(r+1)*U*2.4;for(let k=0;px<cx+L;k++){const len=U*(1.9+R(r*31+k)*1.5);x.fillStyle=['#d9ad76','#d2a46d','#dfb683','#d6a972'][Math.floor(R(r*7+k*13+.5)*4)];x.fillRect(px,y,len,U*.5);x.fillStyle='rgba(110,70,35,.2)';x.fillRect(px,y,3,U*.5);px+=len;}x.fillStyle='rgba(110,70,35,.14)';x.fillRect(cx-L,y,2*L,2);}x.restore();
   x.strokeStyle='#fff6e4';x.lineWidth=lw;
   for(const s of [1,-1]){x.save();x.translate(cx,cy);x.scale(s,1);const b=-L+5.25*F,fc=-L+19*F-lw/2,r3=19.75*F-lw/2,h8=8/12*F;
    x.fillStyle='#6934a5';x.fillRect(-L,-lane,19*F,2*lane);x.strokeRect(-L+lw/2,-lane+lw/2,19*F-lw,2*lane-lw); // 12' lane, free-throw line 15' from the backboard (19' from the baseline)
    x.beginPath();x.arc(fc,0,6*F-lw/2,-Math.PI/2,Math.PI/2);x.stroke();x.setLineDash([F*1.3,F*.95]);x.beginPath();x.arc(fc,0,6*F-lw/2,Math.PI/2,Math.PI*1.5);x.stroke();x.setLineDash([]); // 6' free-throw circle, dashed inside the lane
    x.fillStyle='#fff6e4';for(const z of [lane,-lane-h8]){x.fillRect(-L+7*F,z,F,h8);for(const m of [11,14+2/12,17+4/12])x.fillRect(-L+m*F,z,F/6,h8);} // lane-space marks
    x.beginPath();x.moveTo(-L,-r3);x.lineTo(b,-r3);x.arc(b,0,r3,-Math.PI/2,Math.PI/2);x.lineTo(-L,r3);x.stroke();x.restore();} // 19'9" three-point arc with straight corner lines to the baseline
   x.strokeRect(cx-L+lw/2,cy-Wd+lw/2,2*L-lw,2*Wd-lw);x.fillStyle='#fff6e4';x.fillRect(cx-lw/2,cy-Wd,lw,2*Wd);x.beginPath();x.arc(cx,cy,6*F-lw/2,0,Math.PI*2);x.stroke();
   if(logo.naturalWidth){const w=880,h=w*logo.naturalHeight/logo.naturalWidth;x.drawImage(logo,cx-w/2,cy-h/2,w,h);}else if(logo.failed){x.fillStyle='#6934a5';x.font='italic 900 420px "Barlow Condensed",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('K',cx,cy);}
   x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='italic 900 150px "Barlow Condensed","Arial Narrow",Arial,sans-serif';if('letterSpacing' in x)x.letterSpacing='12px';x.fillText('LAKE WASHINGTON',cx,cy-8.85*U+4);x.fillText('HOME OF THE KANGS',cx,cy+8.85*U+4);/* inside the 8.27-9.4 apron band so the scorer's table and bench chairs behind it never cover the lettering */if('letterSpacing' in x)x.letterSpacing='0px';t.needsUpdate=true;};
  logo.onload=draw;logo.onerror=()=>{logo.failed=true;draw();};logo.src=`${import.meta.env.BASE_URL}images/kangs-logo.png`;draw();t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso||8;if(!this.fontsReady)this.texts.add(draw);return t;}
 build(){this.box(40,.6,33,0x221a35,0,-.3,0);/* ground slab top is y=0 so props off the wood rest on it instead of hovering */const edge=this.mat(0x5a3726),floor=new THREE.Mesh(new THREE.BoxGeometry(32,.16,20),[edge,edge,this.mat(0xffffff,{map:this.court(),roughness:.36}),edge,edge,edge]);floor.position.y=-.04;floor.receiveShadow=true;this.scene.add(floor);
 // Gym shell: cut-away room of four inward-facing one-sided walls (+ light bands). Walls between an orbiting camera and the court are back-face culled, so every angle sees in while the far walls still close the room.
 const panel=(w,h,c,x,y,z,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),this.mat(c));m.position.set(x,y,z);m.rotation.y=ry;m.receiveShadow=true;this.scene.add(m);return m;};for(const [w,x,z,ry] of [[39,0,-16,0],[32,-19.5,0,Math.PI/2],[32,19.5,0,-Math.PI/2],[39,0,16,Math.PI]]){panel(w,9.3,0x2c1d3d,x,4.35,z,ry);this.glow(panel(w,.14,0xa76aff,x*.999,4.75,z*.999,ry),0x8e43ed);}this.sign('LAKE WASHINGTON KANGS',17,2,-19.45,6.5,0,{ry:Math.PI/2});
 this.stands();this.nets=[];for(const side of [-1,1]){
  const x=side*14.9;this.box(.3,4.1,.3,0x393846,x,2.05,0);this.box(1.94,.2,.24,0xd6d5df,side*13.78,3.72,0);const back=this.box(.12,1.25,2.4,0xded9e9,side*12.75,3.8,0);back.material.transparent=true;back.material.opacity=.6;back.castShadow=false; // stanchion sits out of bounds; arm meets the back of the board instead of poking through it over the rim
  const frame=(y0,y1,z)=>[[y0,-z],[y0,z],[y0,z],[y1,z],[y1,z],[y1,-z],[y1,-z],[y0,-z]];this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([...frame(3.18,4.42,1.19),...frame(3.36,3.86,.33)].map(([y,z])=>new THREE.Vector3(side*12.685,y,z))),new THREE.LineBasicMaterial({color:0xffffff})));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.045,8,32),this.mat(0xf27a24));ring.rotation.x=Math.PI/2;ring.position.set(side*12.15,3.28,0);this.scene.add(ring);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const points=[new THREE.Vector3(ring.position.x+Math.cos(a)*.48,3.25,Math.sin(a)*.48),new THREE.Vector3(ring.position.x+Math.cos(a+.25)*.28,2.65,Math.sin(a+.25)*.28)];const net=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffffff}));this.scene.add(net);this.nets.push({mesh:net,side});}
 }
 for(let i=0;i<4;i++)this.sign(i===3?'YOUR\nSEASON':`KANGS\n${2023+i}`,2,2.8,-17.6+i*2.5,6.5,-15.95,{border:'#e9b858',scale:.5});
 /* LED video board modelled on the real Lake Washington gym board (see src/scoreboard.js); unlit material so it glows. */this.boardCanvas=document.createElement('canvas');this.boardCanvas.width=2048;this.boardCanvas.height=768;this.boardTex=new THREE.CanvasTexture(this.boardCanvas);this.boardTex.colorSpace=THREE.SRGBColorSpace;this.boardTex.anisotropy=this.renderer.capabilities.getMaxAnisotropy();this.scoreboard=new THREE.Mesh(new THREE.PlaneGeometry(12,4.5),new THREE.MeshBasicMaterial({map:this.boardTex,toneMapped:false}));this.scoreboard.position.set(0,8.2,-11);this.scene.add(this.scoreboard);this.box(12.7,5.2,.45,0x0b0c16,0,8.2,-11.3);const boardRim=new THREE.Mesh(new THREE.PlaneGeometry(12.24,4.74),new THREE.MeshBasicMaterial({color:0x2d57c8,toneMapped:false}));boardRim.position.set(0,8.2,-11.03);this.scene.add(boardRim);for(const x of [-5,5])this.box(.07,2.6,.07,0x2a2a33,x,12,-11.3);this.score(0,0);{const img=new Image();img.onload=()=>{setScoreboardLogo(img);this.boardKey='';this.score(this.boardHome??0,this.boardAway??0);};img.src=`${import.meta.env.BASE_URL}images/kangs-logo.png`;}document.fonts?.load('900 100px "Barlow Condensed"').then(()=>document.fonts.load('800 100px "Barlow Condensed"')).then(()=>{this.boardKey='';this.score(this.boardHome??0,this.boardAway??0);}).catch(()=>{});
 for(let i=0;i<10;i++){const player=this.player(i,i<5?purple:0xf1e9df);this.people.push(player);this.scene.add(player);}
 this.ball=new THREE.Group();const sphere=new THREE.Mesh(new THREE.SphereGeometry(.28,24,16),this.mat(0xe9832a,{roughness:.85}));this.ball.add(sphere);for(let i=0;i<3;i++){const seam=new THREE.Mesh(new THREE.TorusGeometry(.282,.009,4,48),this.mat(0x392318));if(i===1)seam.rotation.x=Math.PI/2;if(i===2)seam.rotation.y=Math.PI/2;this.ball.add(seam);}this.scene.add(this.ball);
 // Program spaces share the gym: imported furniture, jersey wall, and coach desk.
 // (Ceiling lamp bars removed: with no roof they floated across the court in every elevated preset; the spotlights still light the floor.) Office corner gets a carpet.
 this.box(5.2,.03,4.6,0x3b2a52,16.3,.015,-13.4).castShadow=false;
 this.addDetails();this.box(2.1,2.7,.1,0x140d1d,-18.2,1.35,-15.96);this.sign('LOCKER ROOM',2.6,.6,-18.2,3.1,-15.93);this.sign('ALWAYS RISING.',10,1.6,9.5,6.4,-15.95,{italic:true});
 }
 player(i,color){const g=new THREE.Group();const skin=[0x9c6946,0xe4b58b,0x66432d,0xb67e57,0xd39871][i%5];const jersey=this.mat(color);const limb=(radius,length,c)=>new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,4,8),this.mat(c));const body=new THREE.Mesh(new THREE.CylinderGeometry(.27,.22,.65,8),jersey);body.position.y=1.18;g.add(body);g.userData.jersey=jersey;const head=new THREE.Mesh(new THREE.SphereGeometry(.205,12,10),this.mat(skin));head.position.y=1.78;g.add(head);g.userData.head=head;const hair=new THREE.Mesh(new THREE.SphereGeometry(.21,12,8,0,Math.PI*2,0,Math.PI*.5),this.mat(0x242025));hair.position.y=1.82;g.add(hair);g.userData.hair=hair;
 const numberGeo=new THREE.PlaneGeometry(.35,.35),uv=numberGeo.attributes.uv;for(let k=0;k<uv.count;k++)uv.setX(k,.25+uv.getX(k)*.5);/* number textures are 2:1: sample the centre square so digits keep their shape */const number=new THREE.Mesh(numberGeo,new THREE.MeshStandardMaterial({map:this.textTexture(String([0,2,3,11,20][i%5]),i<5?'#6832ab':'#f1e9df',i<5?'#ffffff':'#562494',128),roughness:.68,side:THREE.DoubleSide}));number.position.set(0,1.23,.255);g.add(number);g.userData.number=number;const nameplate=new THREE.Mesh(new THREE.PlaneGeometry(.45,.23),new THREE.MeshStandardMaterial({map:this.textTexture('KANGS','#6832ab','#ffffff',256),roughness:.68}));nameplate.position.set(0,1.3,-.255);nameplate.rotation.y=Math.PI;g.add(nameplate);g.userData.nameplate=nameplate;/* small gold C beside the name on the captain's back plate; shown by setIdentity */const capBadge=new THREE.Mesh(new THREE.PlaneGeometry(.11,.11),(this.capMat??=new THREE.MeshBasicMaterial({map:this.textTexture('C','#e9b858','#2a1450',128,{aspect:1}),toneMapped:false})));capBadge.position.set(-.2,1.4,-.262);capBadge.rotation.y=Math.PI;capBadge.visible=false;g.add(capBadge);g.userData.capBadge=capBadge;
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
  for(const side of [-1,1])this.box(1,.8,1.5,0x673a9b,side*14.95,.4,0); // padded stanchion bases, behind the baselines
  for(let i=0;i<5;i++)this.box(.1,.08,1.7,0xa186bf,-19.42,.5+i*.6,-5);for(const z of [-5.8,-4.2])this.box(.1,3.2,.1,0xa186bf,-19.42,1.6,z); // wall bars fixed to the end wall
  this.box(5,1,.7,0x211332,0,.5,9.75);this.sign('KANGS SCORER’S TABLE',4.8,.6,0,.65,9.38);
  for(let i=0;i<5;i++){const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.065,.08,.35,8),this.mat(0xb7dff2));bottle.position.set(-2+i*.7,1.18,9.75);this.scene.add(bottle);}
  this.box(2.1,.12,.75,0x4d4555,-16,.35,6);for(let i=0;i<3;i++){const ball=new THREE.Mesh(new THREE.SphereGeometry(.27,16,12),this.mat(0xdd7d2b));ball.position.set(-16.7+i*.7,.7,6);this.scene.add(ball);}
  for(const z of [5.65,6.35])for(const x of [-17,-15])this.box(.06,1.1,.06,0xa3a1ae,x,.55,z);
  for(let i=0;i<4;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(.18,.5,12),this.mat(0xe67a24));cone.position.set(-17,.25,-3+i*1.2);this.scene.add(cone);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.57,48),new THREE.MeshBasicMaterial({color:0xe3bd69,transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;this.focusRing=ring;this.scene.add(ring);
  this.trail=[];for(let i=0;i<8;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:0xf6c078,transparent:true,opacity:(8-i)/16}));dot.visible=false;this.scene.add(dot);this.trail.push(dot);}
 }
 /* Six-row bleachers on both sidelines: solid risers (no hollow gaps), a lit ribbon on the front rail, aisles, and an instanced seated crowd sized to the players. */
 stands(){const rows=6,rise=.5,deep=.85,z0=10.2,len=26,seats=[],R=n=>{const s=Math.sin(n*91.7)*43758.5453;return s-Math.floor(s);};
  for(const side of [-1,1]){this.glow(this.box(len,.26,.05,0xa76aff,0,.32,side*(z0-.03)),0x8e43ed,2.4);
   for(let r=0;r<rows;r++){const d=r===rows-1?16-z0-r*deep:deep;this.box(len,(r+1)*rise,d,r%2?0x7e51b1:0x4e2b78,0,(r+1)*rise/2,side*(z0+r*deep+d/2));
    for(let i=0;i<40;i++){const n=side*1000+r*50+i;if(i===13||i===26||R(n)<.2)continue;seats.push([-len/2+.45+i*.64+(R(n+.5)-.5)*.1,(r+1)*rise,side*(z0+r*deep+deep*.55),n]);}}}
  const torso=new THREE.InstancedMesh(new THREE.BoxGeometry(.42,.56,.28),this.mat(0xffffff),seats.length),head=new THREE.InstancedMesh(new THREE.SphereGeometry(.17,10,8),this.mat(0xffffff),seats.length),m=new THREE.Matrix4(),col=new THREE.Color();
  seats.forEach(([x,y,z,n],i)=>{const h=(R(n+.3)-.5)*.08;torso.setMatrixAt(i,m.makeTranslation(x,y+.28+h,z));torso.setColorAt(i,col.set([0x6832ab,0xf3ecff,0xe9b858,0x3d1d66,0x7541b0,0x6832ab][Math.floor(R(n+.7)*6)]));head.setMatrixAt(i,m.makeTranslation(x,y+.75+h,z));head.setColorAt(i,col.set([0xca9e79,0x8c5f41,0xf2cbab,0x6b4430,0xe0b48c][Math.floor(R(n+.9)*5)]));});
  for(const o of [torso,head]){o.castShadow=true;o.receiveShadow=true;this.scene.add(o);}this.crowd=[torso,head];}

 async importModels(){const loader=new GLTFLoader();/* [model,[[x,y,z,rotY]],scale]: team chairs line each bench on the scorer's side, office set in the +x/-z corner, cabinets beside the locker-room door */for(const [name,positions,scale] of [['bench',[0,1,2,3,4,5].flatMap(k=>[[-9.6+k,0,9.65,Math.PI],[4.4+k,0,9.65,Math.PI]]),2],['chair',[[16.05,0,-13.66,0],[16.4,0,-12.25,Math.PI]],1.7],['table',[[15.3,0,-12.4,0]],2.2],['bookcaseClosedDoors',[[-16.66,0,-15.5,0],[-15.46,0,-15.5,0],[-14.26,0,-15.5,0]],2.1],['plantSmall1',[[18.9,0,-15.5,0]],4.5]]){
  try{const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);for(const [px,py,pz,ry] of positions){const obj=gltf.scene.clone(true);obj.position.set(px,py,pz);obj.rotation.y=ry;obj.scale.setScalar(scale);obj.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});this.scene.add(obj);}this.models++;}catch(error){console.warn('Asset unavailable',name,error);}
 }}
 mount(target){target.append(this.host);}
 /* Graphics quality (see graphics.js). 'auto' starts at High and measures ~2 s of frames once; setting the same level again is a no-op, so applyArena can call this freely. */
 setQuality(q){if(this.failed||q===this.quality)return;this.quality=q;this.level=q==='auto'?'high':q;this.probe=q==='auto'?{times:[],frames:0,done:false}:{done:true};this.applyLevel();}
 applyLevel(){const p=qualityProfile(this.level,devicePixelRatio),sun=this.sun;this.renderer.setPixelRatio(p.pixelRatio);
  if(sun){sun.castShadow=p.shadows;if(p.shadows&&sun.shadow.mapSize.x!==p.shadowSize){sun.shadow.mapSize.set(p.shadowSize,p.shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;}}
  for(const o of this.crowd||[]){o.visible=p.crowd!=='hidden';o.castShadow=p.crowd==='full';}}
 /* Auto mode: after a short warm-up, time about two seconds of rendered frames; if the typical frame is slower than ~28 fps drop one level, once. Nothing is remembered. */
 measure(now){const pr=this.probe;if(pr.done)return;const raw=this.lastT?now-this.lastT:0;this.lastT=now;if(raw<=0||++pr.frames<=PROBE.warmup)return;pr.times.push(raw);if(probeDone(pr.times)){pr.done=true;if(autoDowngrade(pr.times)){this.level=lowerLevel(this.level);this.applyLevel();}}}
 setView(mode){if(this.failed)return;this.mode=mode;this.userMoved=false;this.controls.enabled=mode!=='player';if(mode==='player'){this.fpLook=null;return;}const w=this.host.clientWidth,h=this.host.clientHeight,a=w>1&&h>1?w/h:16/9,tall=a<.8,fixed={locker:[[-9,5.5,-6],[-15.5,1.4,-15]],office:[[18.6,4.4,-6],[15.6,1,-13.2]],follow:[[7,tall?11:9,tall?17:16],[7,1,0]]};
  if(fixed[mode]){const [p,t]=fixed[mode];this.camera.position.set(...p);this.controls.target.set(...t);}
  else{/* broadcast/courtside keep a fixed viewing angle and solve the distance so the court fills the frame at this aspect (zoom>1 lets the corners run off-frame; the tighter vertical bound leaves room for the score bug and controls) */const [az,el,ty,zx,zy]=mode==='court'?[tall?62:47,tall?21:19,1,tall?1.75:1.3,tall?1.75:1.3]:[tall?70:33,tall?40:32,0,tall?1.12:.97,tall?.9:.8],r=Math.PI/180,cam=this.fitCam||=new THREE.PerspectiveCamera(),dir=new THREE.Vector3(Math.sin(az*r)*Math.cos(el*r),Math.sin(el*r),Math.cos(az*r)*Math.cos(el*r)),t=new THREE.Vector3(0,ty,0),v=new THREE.Vector3(),pts=[[-14.2,0,-8.6],[14.2,0,-8.6],[-14.2,0,8.6],[14.2,0,8.6],[-12.75,4.5,0],[12.75,4.5,0]].map(p=>new THREE.Vector3(...p));cam.fov=tall?65:43;cam.aspect=a;cam.updateProjectionMatrix();
   const fits=d=>{cam.position.copy(dir).multiplyScalar(d).add(t);cam.lookAt(t);cam.updateMatrixWorld();return pts.every(p=>{v.copy(p).project(cam);return v.z<1&&Math.abs(v.x)<=zx&&Math.abs(v.y)<=zy;});};let lo=4,hi=120;for(let i=0;i<26;i++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}this.camera.position.copy(dir).multiplyScalar(hi).add(t);this.controls.target.copy(t);}
  this.controls.update();}
 restoreHead(){const o=this.fpHidden;if(!o)return;this.fpHidden=null;for(const k of ['head','hair'])if(o.userData[k])o.userData[k].visible=true;}
 firstPerson(){const clip=this.event?this.presentation()?.clip:null;const team=clip?.team||'home';const actor=this.people[clip?(team==='home'?0:5):2];if(!actor){this.fpSubject=null;this.restoreHead();return;}const who=actor.userData.person;this.fpSubject=who?{number:who.number,name:team==='away'&&clip&&clip.player?clip.player:who.name,position:who.position,id:who.id,home:team==='home'}:null;const dir=team==='home'?1:-1;const rim=new THREE.Vector3(dir*12.15,3.05,0);const a=actor.position;const look=rim.clone().lerp(this.ball.position,.35);const flat=new THREE.Vector3(look.x-a.x,0,look.z-a.z);if(flat.lengthSq()<.01)flat.set(dir,0,0);flat.normalize();const eye=new THREE.Vector3(a.x+flat.x*.4,1.74,a.z+flat.z*.4);/* never inside a neighbour's head: keep 0.6 from every other body, and hide the subject's own head */for(const o of this.people){if(o===actor)continue;const dx=eye.x-o.position.x,dz=eye.z-o.position.z,d=Math.hypot(dx,dz);if(d<.6){eye.x=o.position.x+(d>.001?dx/d:flat.x)*.6;eye.z=o.position.z+(d>.001?dz/d:flat.z)*.6;}}if(this.fpHidden!==actor){this.restoreHead();this.fpHidden=actor;for(const k of ['head','hair'])if(actor.userData[k])actor.userData[k].visible=false;}if(!this.fpLook){this.camera.position.copy(eye);this.fpLook=look.clone();}this.camera.position.lerp(eye,.25);this.fpLook.lerp(look,.12);this.camera.lookAt(this.fpLook);}
 /* TV director for Auto camera: wide for the setup, tracking for the drive, then a first-person look at the rim (Kangs) or a baseline angle (visitors) on the shot. Returns true when the first-person shot is active. */
 autoDirector(){if(!this.event||!this.motion){this.autoShot=null;return false;}const pr=this.presentation();if(!pr)return false;const ct=Math.min(1,(this.playTime-pr.index*CLIP_SECONDS)/CLIP_SECONDS),team=pr.clip.team,dir=team==='home'?1:-1,a=this.people[team==='home'?0:5].position;
  const shot=ct<.26?'wide':ct<.58?'track':ct<.84?(team==='home'?'player':'baseline'):'track';if(shot!==this.autoShot){if(this.autoShot==='player'&&this.fpLook)this.controls.target.copy(this.fpLook);if(shot==='player')this.fpLook=null;this.autoShot=shot;}
  if(shot==='player')return true;const x=THREE.MathUtils.clamp(a.x,-11,11),V=(px,py,pz)=>new THREE.Vector3(px,py,pz);
  const [pos,tgt]=shot==='wide'?[V(x*.45,15,21),V(x*.55,0,0)]:shot==='track'?[V(x-dir*4,6.2,12.5),V(x+dir*1.5,1.3,a.z*.4)]:[V(dir*17.5,4.2,dir*4.5),V(dir*9,2,0)];
  this.camera.position.lerp(pos,shot==='baseline'?.07:.05);this.controls.target.lerp(tgt,.09);return false;}
 setIdentity(p,person,home=true){
  const kit=this.state?.kit||'home',bg=home?(kit==='away'?'#f4effc':kit==='alternate'?'#191126':'#6832ab'):'#db7536';
  const fg=home?(kit==='away'?'#562494':this.state?.trim||'#ffffff'):'#ffffff';
  p.userData.person={id:person?.id,number:person?.number,name:person?.name,position:person?.position,home};
  const cap=home&&person?.id!=null&&person.id===this.state?.captain,key=[person?.id,person?.number,person?.name,bg,fg,cap?'C':'',person?.plate||''].join('|');if(p.userData.identity===key)return;p.userData.identity=key;
  p.userData.jersey.color.set(bg);
  const n=p.userData.number.material;n.map.dispose();n.map=this.textTexture(String(person?.number??11),bg,fg,128);
  const back=p.userData.nameplate.material;back.map.dispose();back.map=this.textTexture((person?.plate||(person?.name||'VISITORS').split(' ').at(-1)).toUpperCase(),bg,fg,256);p.userData.capBadge&&(p.userData.capBadge.visible=cap);
 }
 /* Opponent bodies wear real names and numbers: the clip's shooter and helper first, then the rest of the roster (fictional rosters read as the school name). */
 castVisitors(){const s=this.state;if(!s)return;const opp=boardGame(s,this.event).opponent;visitorCast(oppRoster(s,opp),this.clips?.[1],opp).forEach((v,i)=>this.setIdentity(this.people[i+5],v,false));}
 score(home,away){this.boardHome=home;this.boardAway=away;if(!this.boardCanvas)return;const data=scoreboardData(this.state,home,away,this.event);(this.oppAsked??=new Set());if(!this.oppAsked.has(data.opponent)){this.oppAsked.add(data.opponent);const name=data.opponent;loadOpponentLogo(name).then(img=>{if(img){setScoreboardOpponentLogo(name,img);this.boardKey='';this.score(this.boardHome??0,this.boardAway??0);}});}const key=scoreboardKey(data);if(this.boardKey===key)return;this.boardKey=key;drawScoreboard(this.boardCanvas.getContext('2d'),this.boardCanvas.width,this.boardCanvas.height,data);this.boardTex.needsUpdate=true;}
 update(s){if(this.failed)return;this.state=s;if(!this.event){const starters=s?.players.filter(p=>p.starter)||[];for(let i=0;i<5;i++)this.setIdentity(this.people[i],starters[i]||{id:i,number:[0,2,3,11,20][i],name:'Kangs'});this.castVisitors();}
  if(!this.event){const m=s?.match,r=s?.results.at(-1);this.score(m?.home??r?.home??0,m?.away??r?.away??0);}
 }
 play(event){
  this.event=event;this.run++;this.playTime=0;this.paused=false;this.clipIndex=-1;this.presentKey='';
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
  if(w<1||h<1||this.host.hidden){this.lastT=0;return;}this.measure(performance.now());if(this.w!==w||this.h!==h){this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=w/h<.8?65:43;this.camera.updateProjectionMatrix();}
  if(this.motion)this.time+=dt;
  // One continuous stride/dribble clock, so legs and arms never jump when a clip restarts.
  this.gait=(this.gait||0)+(this.motion&&!(this.event&&this.paused)?dt*(this.event?this.speed:1):0);
  if(this.event){
   if(!this.paused)this.playTime=Math.min(CLIP_SECONDS*2,this.playTime+dt*this.speed);
   const presentation=this.presentation(),clip=presentation.clip,index=presentation.index,clipTime=Math.min(CLIP_SECONDS,this.playTime-index*CLIP_SECONDS);
   // New clip: re-order bodies (never re-dress them) so the clip's defender is people[0], then ease everyone from where they stand.
   if(index!==this.clipIndex){this.clipIndex=index;const lineup=this.event.lineup||this.state?.players.filter(p=>p.starter)||[];let home=[...lineup];if(index===1&&clip.defenderId!==undefined)home.sort((a,b)=>(a.id===clip.defenderId?-1:b.id===clip.defenderId?1:0));this.cast(home,true);this.castVisitors();this.trail.forEach(d=>d.visible=false);this.snapshot(clipTime);}else if(this.motion!==this.blendMotion)this.snapshot(clipTime);this.blendMotion=this.motion;
   const pose=sampleClip(clip,this.motion?clipTime:(presentation.resolved?CLIP_SECONDS:0)),u=clipTime/CLIP_SECONDS,o=clip.team==='home'?0:5,ease=!this.motion?1:this.paused?0:1-Math.exp(-dt*this.speed*22);
   pose.actors.forEach((p,i)=>this.posePlayer(this.people[i],this.blend(this.people[i].userData.from,p,clipTime),this.gait,ease));
   // While a player is still easing into place the ball stays in his hands (the handler, or the defender after a steal).
   const sm=x=>(x=Math.max(0,Math.min(1,x)),x*x*(3-2*x)),off=j=>[this.people[j].position.x-pose.actors[j].x,this.people[j].position.z-pose.actors[j].z],a=off(o),b=off(5-o),st=clip.outcome==='steal'?sm((u-.27)/.09):0,hold=1-sm((u-.55)/.06);
   const ball=this.blendBall({x:pose.ball.x+(a[0]+(b[0]-a[0])*st)*hold,y:pose.ball.y,z:pose.ball.z+(a[1]+(b[1]-a[1])*st)*hold},clipTime);this.ball.position.set(ball.x,ball.y,ball.z);this.ball.rotation.set(this.gait*6,0,this.gait*2);
   this.focusRing.visible=true;this.focusRing.position.x=this.people[o].position.x;this.focusRing.position.z=this.people[o].position.z;
   this.nets.forEach(n=>n.mesh.rotation.y=n.side===(clip.team==='home'?1:-1)?pose.net:0);
   this.trail.forEach((d,i)=>{d.visible=this.motion&&clipTime>CLIP_SECONDS*.61&&clipTime<CLIP_SECONDS*.9&&clip.outcome!=='steal';if(d.visible){const previous=sampleClip(clip,Math.max(0,clipTime-i*.025)).ball;d.position.set(previous.x,previous.y,previous.z);}});
   this.score(presentation.home,presentation.away);
   const impact=`${this.run}|${index}`;if(presentation.resolved&&this.impactKey!==impact){this.impactKey=impact;if(isDunk(clip.kind)&&clip.points)this.shake=.24;else if(clip.outcome==='block')this.shake=.18;}
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
  if(this.mode==='follow'&&this.event){const side=this.clipIndex===1?-1:1;const focus=this.people[side===1?0:5].position;const x=THREE.MathUtils.clamp(focus.x,-10,10);this.camera.position.lerp(new THREE.Vector3(x,8.5,14),.045);this.controls.target.lerp(new THREE.Vector3(x,1.2,0),.08);}const fp=this.mode==='player'||(this.mode==='auto'&&this.autoDirector());this.fpActive=!!fp;if(fp){this.firstPerson();}else{this.restoreHead();this.controls.update();}const fov=fp?74:(this.w/this.h<.8?65:43);if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  // Impact shake: a short camera jitter on dunks and blocks. Off with reduced motion or the screen-shake setting.
  let jx=0,jy=0;if(this.shake>0){if(this.motion&&this.shakeOn){jx=(Math.random()-.5)*this.shake;jy=(Math.random()-.5)*this.shake;}this.shake*=Math.pow(.02,dt);if(this.shake<.004)this.shake=0;}
  this.camera.position.x+=jx;this.camera.position.y+=jy;this.renderer.render(this.scene,this.camera);this.camera.position.x-=jx;this.camera.position.y-=jy;
 }
}
