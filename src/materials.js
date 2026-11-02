// Materials for the 3D athletes (Settings > Player models > 3D athletes) and the ball.
// Fine surface detail (skin pores, perforated jersey mesh, pebbled leather, hair strands) comes from small tiling height maps
// generated here once, applied as bump detail in the shader with triplanar mapping on the model's rest pose, so it stays
// glued to a moving, skinned body and needs no texture downloads. It fades out with distance, where it would only shimmer.
import * as THREE from 'three';

/* ---------- tiling height maps (0..1 in the red channel) ---------- */
const SIZE=256;
const rand=(x,y,s)=>{const n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n);};
function valueNoise(x,y,period,seed){ // periodic value noise, so the map tiles
 const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
 const r=(a,b)=>rand(((a%period)+period)%period,((b%period)+period)%period,seed);
 return (r(xi,yi)*(1-u)+r(xi+1,yi)*u)*(1-v)+(r(xi,yi+1)*(1-u)+r(xi+1,yi+1)*u)*v;
}
function heightTexture(fn){
 const data=new Uint8Array(SIZE*SIZE*4);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const h=Math.max(0,Math.min(1,fn(x/SIZE,y/SIZE)));const i=(y*SIZE+x)*4;data[i]=data[i+1]=data[i+2]=h*255;data[i+3]=255;}
 const t=new THREE.DataTexture(data,SIZE,SIZE,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
const cache={};
export const MAPS={
 // skin: fine pores over a soft, larger grain
 skin:()=>cache.skin??=heightTexture((u,v)=>.55*valueNoise(u*64,v*64,64,1)+.3*valueNoise(u*16,v*16,16,2)+.15*(1-Math.pow(valueNoise(u*128,v*128,128,3),.35))),
 // athletic mesh: staggered rows of round perforations
 mesh:()=>cache.mesh??=heightTexture((u,v)=>{const rows=24,cols=24,r=v*rows,row=Math.floor(r),c=u*cols+(row%2?.5:0);const dx=c-Math.floor(c)-.5,dy=r-row-.5,d=Math.hypot(dx*1.15,dy);return .25+.75*Math.min(1,Math.max(0,(d-.17)/.12))-.05*valueNoise(u*48,v*48,48,4);}),
 // pebbled leather: rounded bumps in a jittered grid
 pebble:()=>cache.pebble??=heightTexture((u,v)=>{const n=40;let best=9;const cx=Math.floor(u*n),cy=Math.floor(v*n);for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const gx=cx+i,gy=cy+j,px=(gx+rand(((gx%n)+n)%n,((gy%n)+n)%n,5))/n,py=(gy+rand(((gx%n)+n)%n,((gy%n)+n)%n,6))/n;best=Math.min(best,Math.hypot(u-px,v-py)*n);}return Math.max(0,1-best*1.25);}),
 // hair: fine strands
 strands:()=>cache.strands??=heightTexture((u,v)=>.6*valueNoise(u*160,v*6,160,7)+.4*valueNoise(u*60,v*3,60,8)),
};

/* ---------- shader patch: triplanar bump detail on the rest pose, plus optional wrap lighting (subsurface look) ---------- */
const PARS=`
varying vec3 vKRest; varying vec3 vKRestN;
uniform sampler2D kDetailMap; uniform float kDetailScale; uniform float kDetailBump; uniform float kFadeFar;
float kHeight(vec3 p, vec3 n){
 vec3 w = pow(abs(n), vec3(4.0)); w /= max(w.x + w.y + w.z, 1e-4);
 return texture2D(kDetailMap, p.yz).r * w.x + texture2D(kDetailMap, p.xz).r * w.y + texture2D(kDetailMap, p.xy).r * w.z;
}
vec3 kPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir){
 vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos));
 vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
 float fDet = dot(vSigmaX, R1) * faceDir;
 vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
 return normalize(abs(fDet) * surf_norm - vGrad);
}`;
/* inflate (game units): clothing is pushed out along its normals after skinning starts, so the skin under it never pokes
   through when joints bend (the rest-pose gap is only about a centimetre). */
/* print: lettering printed into the fabric. Two textures (front and back) projected in the rest pose, so the print moves
   and folds with the jersey and can never sink into the body. material.userData.print holds the uniforms to update. */
function patch(material,{map,scale,bump,fadeFar=9,wrap=0,scatter=[1,.42,.28],face=null,inflate=0,print=false}={}){
 if(print)material.userData.print={kPrintF:{value:null},kPrintB:{value:null},kPrintFC:{value:new THREE.Vector2()},kPrintBC:{value:new THREE.Vector2()},kPrintSize:{value:new THREE.Vector2(1,1)},kPrintMinY:{value:0},kPrintOn:{value:0}};
 material.userData.kDetail={map,scale,bump,wrap};if(face)material.userData.face=face;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{kDetailMap:{value:map},kDetailScale:{value:scale},kDetailBump:{value:bump},kFadeFar:{value:fadeFar}});
  if(face)Object.assign(shader.uniforms,{kFaceMap:{value:face.map},kFaceCenter:{value:face.center},kFaceSize:{value:face.size}});
  if(print)Object.assign(shader.uniforms,material.userData.print);
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vKRest; varying vec3 vKRestN;')
   .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvKRestN = objectNormal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvKRest = transformed;'+(inflate>0?`\ntransformed += objectNormal * ${inflate.toFixed(4)};`:''));
  let frag=shader.fragmentShader
   .replace('#include <common>','#include <common>\n'+PARS+(face?'\nuniform sampler2D kFaceMap; uniform vec3 kFaceCenter; uniform vec2 kFaceSize;':'')+(print?'\nuniform sampler2D kPrintF; uniform sampler2D kPrintB; uniform vec2 kPrintFC; uniform vec2 kPrintBC; uniform vec2 kPrintSize; uniform float kPrintMinY; uniform float kPrintOn;':''))
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 {
  float kFade = 1.0 - smoothstep(kFadeFar * 0.35, kFadeFar, length(vViewPosition));
  if (kFade > 0.0) {
   float h = kHeight(vKRest * kDetailScale, normalize(vKRestN));
   normal = kPerturb(-vViewPosition, normal, vec2(dFdx(h), dFdy(h)) * kDetailBump * kFade, faceDirection);
  }
 }`);
  // face: features painted straight onto the head (projected from the front in the rest pose), so they share the skin's lighting.
  // The map holds two layers (see faceTexture): the top half for skin facing forward (features, soft shadows), the bottom
  // half for skin facing down (shadow under the brow, nose, lower lip and jaw), which a front projection would otherwise smear.
  if(face)frag=frag.replace('#include <map_fragment>',`#include <map_fragment>
 {
  vec2 fuv = (vKRest.xy - kFaceCenter.xy) / kFaceSize + 0.5;
  vec3 fn = normalize(vKRestN);
  float inFront = step(kFaceCenter.z - 0.12, vKRest.z);
  float front = smoothstep(0.15, 0.55, fn.z) * inFront, down = smoothstep(0.3, 0.75, -fn.y) * inFront;
  if (front + down > 0.0 && fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
   vec4 f = texture2D(kFaceMap, vec2(fuv.x, 0.5 + fuv.y * 0.5));
   diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * front);
   vec4 d = texture2D(kFaceMap, vec2(fuv.x, fuv.y * 0.5));
   diffuseColor.rgb = mix(diffuseColor.rgb, d.rgb, d.a * down);
  }
 }`);
  if(print)frag=frag.replace('#include <map_fragment>',`#include <map_fragment>
 if (kPrintOn > 0.5 && vKRest.y > kPrintMinY) {
  vec3 rn = normalize(vKRestN);
  vec2 fu = vec2((vKRest.x - kPrintFC.x) / kPrintSize.x + 0.5, (vKRest.y - kPrintFC.y) / kPrintSize.y + 0.5);
  float fm = smoothstep(0.05, 0.35, rn.z) * step(0.0, fu.x) * step(fu.x, 1.0) * step(0.0, fu.y) * step(fu.y, 1.0);
  if (fm > 0.0) { vec4 f = texture2D(kPrintF, fu); diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * fm); }
  vec2 bu = vec2(-(vKRest.x - kPrintBC.x) / kPrintSize.x + 0.5, (vKRest.y - kPrintBC.y) / kPrintSize.y + 0.5);
  float bm = smoothstep(0.05, 0.35, -rn.z) * step(0.0, bu.x) * step(bu.x, 1.0) * step(0.0, bu.y) * step(bu.y, 1.0);
  if (bm > 0.0) { vec4 f = texture2D(kPrintB, bu); diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * bm); }
 }`);
  if(wrap>0)frag=frag.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
 #if NUM_DIR_LIGHTS > 0
 for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
  float ndl = dot(normal, directionalLights[i].direction);
  float wrapped = max(0.0, (ndl + ${wrap.toFixed(3)}) / ${(1+wrap).toFixed(3)}) - max(0.0, ndl);
  reflectedLight.directDiffuse += directionalLights[i].color * wrapped * diffuseColor.rgb * vec3(${scatter.map(v=>v.toFixed(3)).join(',')});
 }
 #endif`);
  shader.fragmentShader=frag;
 };
 material.customProgramCacheKey=()=>`kangs-${map.uuid}-${wrap}-${face?1:0}-${inflate}-${print?1:0}`;
 return material;
}

/* ---------- the materials ---------- */
// Skin: physically based, light wrap (soft subsurface look, reddish where light bleeds round the edge), fine pores and a slight sweat sheen.
// F0 = 0.028 (ior 1.4 at full specular intensity), the value measured for skin (GPU Gems 3, ch. 14); roughness .55.
export function skinMaterial(color,face=null){
 return patch(new THREE.MeshPhysicalMaterial({color,roughness:.55,ior:1.4,specularIntensity:1,clearcoat:.1,clearcoatRoughness:.35,name:'skin'}),{map:MAPS.skin(),scale:9,bump:.35,fadeFar:7,wrap:.35,scatter:[.75,.32,.22],face});
}
export const KIT_INFLATE=.012;   // how far the jersey and shorts are pushed off the skin (decals sit on top of it)
// Jersey and shorts: soft cloth sheen and the perforated athletic mesh.
export function clothMaterial(color){
 return patch(new THREE.MeshPhysicalMaterial({color,roughness:.74,sheen:.28,sheenRoughness:.45,sheenColor:new THREE.Color(.75,.75,.8),specularIntensity:.3,name:'kit'}),{map:MAPS.mesh(),scale:22,bump:.18,fadeFar:3.2,inflate:KIT_INFLATE,print:true});
}
// Shoes: smooth leather-like upper with a little gloss; matte rubber sole.
export const shoeMaterial=color=>new THREE.MeshPhysicalMaterial({color,roughness:.36,clearcoat:.55,clearcoatRoughness:.22,name:'shoes'});
export const soleMaterial=color=>new THREE.MeshStandardMaterial({color,roughness:.75,name:'sole'});
// Hair: soft highlight that runs round the head (anisotropic), fine strands.
export function hairMaterial(color){
 return patch(new THREE.MeshPhysicalMaterial({color,roughness:.48,anisotropy:.65,anisotropyRotation:Math.PI/2,sheen:.3,sheenColor:new THREE.Color(.35,.3,.28),name:'hair'}),{map:MAPS.strands(),scale:14,bump:.8,fadeFar:6});
}
// Sleeves and headband: compression fabric, smoother and a touch shinier than the jersey.
export const fabricMaterial=color=>patch(new THREE.MeshPhysicalMaterial({color,roughness:.55,sheen:.4,sheenRoughness:.35,name:'sleeve'}),{map:MAPS.mesh(),scale:30,bump:.15,fadeFar:3,inflate:.01});
// Ball: pebbled orange leather.
export function ballMaterial(){
 return patch(new THREE.MeshPhysicalMaterial({color:0xd9661e,roughness:.62,clearcoat:.12,clearcoatRoughness:.5,name:'ball'}),{map:MAPS.pebble(),scale:6,bump:.55,fadeFar:6});
}

/* ---------- jersey lettering: transparent, outlined, on a plane bent to the chest ---------- */
export function letteringTexture(text,fill,stroke,{w=256,h=256,font='"Barlow Condensed","Arial Narrow",Arial,sans-serif',weight=800,italic=false}={}){
 if(typeof document==='undefined')return new THREE.Texture();  // tests run without a page
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),t=new THREE.CanvasTexture(c);
 const draw=()=>{x.clearRect(0,0,w,h);let size=h*.9;x.font=`${italic?'italic ':''}${weight} ${size}px ${font}`;const width=x.measureText(text).width;if(width>w*.9){size*=w*.9/width;x.font=`${italic?'italic ':''}${weight} ${size}px ${font}`;}
  x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(4,size*.1);x.strokeStyle=stroke;x.strokeText(text,w/2,h*.54);x.fillStyle=fill;x.fillText(text,w/2,h*.54);t.needsUpdate=true;};
 draw();document.fonts?.load(`${weight} 64px "Barlow Condensed"`).then(draw).catch(()=>{});
 t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
// A plane that wraps round a cylinder of the given radius (front of the chest or back), so decals sit on the fabric.
export function bentPlane(width,height,radius){
 const g=new THREE.PlaneGeometry(width,height,12,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),drop=radius>0?radius-Math.sqrt(Math.max(radius*radius-x*x,0)):0;p.setZ(i,-drop);}/* edges fall back toward the body (also on the back plate, which is turned round) */
 p.needsUpdate=true;g.computeVertexNormals();return g;
}
export function decalMaterial(map){
 return new THREE.MeshPhysicalMaterial({map,transparent:true,alphaTest:.35,roughness:.6,sheen:.2,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8,name:'decal'});
}

/* ---------- painted face: brows, eyes, nose, lips and soft shadows, in tones taken from the skin ----------
   The texture covers a frame on the front of the head, projected straight from the front in the rest pose (see patch).
   Features are placed in millimetres on the head's own landmark rows (scripts/build_players.py writes them to the model as
   extras.faceMarks: fractions of the frame from the top; pupil, mouthHalf and noseHalf as fractions of its width), so they
   sit on the geometry: eyes on the closed-lid bulge inside the sockets, lips on the mouth line. The shadows the sockets,
   nose, lower lip and jaw would get from ambient light are painted in (ambient occlusion), soft and low-frequency, because
   at 15-35 pixels value reads and detail does not. Young faces: no creases, no lines beside the nose. */
export const FACE_MARKS={brow:.151,eye:.213,nose:.513,mouth:.62,chin:.903,pupil:.229,mouthHalf:.181,noseHalf:.14,aspect:.776};
export function faceTexture(skinHex,seed=0,marks=FACE_MARKS){
 if(typeof document==='undefined')return new THREE.Texture();
 // two layers, one above the other: front-facing skin (top half) and down-facing skin (bottom half), see patch()
 const M={...FACE_MARKS,...marks},W=256,HH=Math.round(W/M.aspect),c=document.createElement('canvas');c.width=W;c.height=HH*2;const x=c.getContext('2d');
 const base=new THREE.Color(skinHex),hex=col=>'#'+col.getHexString();
 const tone=f=>hex(base.clone().multiplyScalar(f)),r=n=>{const v=Math.sin(seed*91.7+n*13.1)*43758.5;return v-Math.floor(v);};
 // millimetres on the head -> pixels: X across from the midline, rows from the landmark marks, Y(row, mm up from it)
 const mm=W*M.pupil/33,X=d=>W/2+d*mm,Y=(row,up=0)=>row*HH-up*mm,local=y=>Y(M.eye,y-26.5);   // local: head-local y (mm), eye line +26.5
 const blob=(cx,cy,rx,ry,color,alpha,soft=.6)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,1);g.addColorStop(0,color);g.addColorStop(soft,color);g.addColorStop(1,'rgba(0,0,0,0)');x.save();x.translate(cx,cy);x.scale(rx,ry);x.translate(-cx,-cy);x.globalAlpha=alpha;x.fillStyle=g;x.beginPath();x.arc(cx,cy,1,0,Math.PI*2);x.fill();x.restore();};
 const B=(dx,row,up,rx,ry,color,alpha,soft)=>blob(X(dx),Y(row,up),rx*mm,ry*mm,color,alpha,soft);   // a blob placed in mm
 // per-player variety, kept small (millimetres): brow height and weight, eye spacing and size, mouth height, iris colour
 const browUp=(r(1)-.5)*3,spread=(r(2)-.5)*2,mouthUp=(r(3)-.5)*2,browW=5+r(4)*2,eyeW=13.2+r(5)*1.4,iris=['#3a2416','#2a1a10','#45301f','#1e140d'][Math.floor(r(6)*4)];
 const shadow=tone(.42),deep=tone(.3);

 /* --- down-facing layer (bottom half): ambient occlusion where skin faces the floor --- */
 x.save();x.translate(0,HH);
 for(const s of [-1,1]){B(s*31,M.eye,5,19,9,deep,.55,.3);B(s*16,M.eye,3,7,7,deep,.4,.3);}   // under the brow shelf, into the sockets
 B(0,M.nose,2,13,7,deep,.55,.35);                                                                   // under the nose tip and wings (kept narrow)
 B(0,M.mouth,mouthUp-9,17,6,shadow,.5,.3);                                                         // under the lower lip, over the chin
 // under the jaw: everything below the jaw line, from the chin round to the jaw corners
 x.globalAlpha=.55;x.fillStyle=deep;x.beginPath();x.moveTo(X(-62),local(-50));
 x.bezierCurveTo(X(-52),local(-78),X(-30),Y(M.chin,4),X(0),Y(M.chin,1));x.bezierCurveTo(X(30),Y(M.chin,4),X(52),local(-78),X(62),local(-50));x.lineTo(X(62),HH);x.lineTo(X(-62),HH);x.closePath();x.fill();
 x.restore();

 /* --- front-facing layer (top half) --- */
 // soft shade on the throat just under the chin (the jaw's shadow)
 B(0,M.chin,-9,26,10,shadow,.45,.25);
 // eye sockets: the shade under the brow shelf, a little deeper at the inner corner, and the lid crease
 for(const s of [-1,1]){const ex=s*(33+spread);
  B(ex*.96,M.eye,3,19,11,shadow,.32,.2);B(s*17,M.eye,1.5,6.5,8,deep,.24,.2);B(ex,M.eye,6.2,13,3.6,deep,.22,.3);
 }
 // brows: thick, dark, tapering toward the temple, with a soft edge
 const brow=(s,grow,alpha,color)=>{const p=(dx,up)=>[X(s*dx),Y(M.brow,up+browUp)],t=browW*grow;x.save();x.globalAlpha=alpha;x.fillStyle=color;x.beginPath();
  x.moveTo(...p(12.5,-t*.5));x.lineTo(...p(11.5,t*.45));x.quadraticCurveTo(...p(29,t*.8+2.4),...p(51,-.6*grow));x.quadraticCurveTo(...p(31,-t*.3+1.4),...p(12.5,-t*.5));x.closePath();x.fill();x.restore();};
 for(const s of [-1,1]){brow(s,1.3,.25,'#1a120d');brow(s,1,.9,'#16100c');}
 // eyes: a dark almond on the closed-lid bulge; the iris fills most of it, so only slivers of muted white show at the corners
 const white=hex(base.clone().lerp(new THREE.Color(0xd9d1c7),.45).multiplyScalar(.85));
 // each eye is drawn in its own mirrored frame: lx runs from the outer corner (-w) to the inner corner (+w), so both eyes match,
 // and the outer corner sits a little higher than the inner one (a young, alert eye; a drooping outer corner reads tired)
 for(const s of [-1,1]){const cx=X(s*(33+spread)),cy=Y(M.eye),w=eyeW*mm,up=5*mm,dn=3.6*mm,a=.7*mm,P=(lx,ly)=>[cx-s*lx,cy+ly];
  const almond=()=>{x.beginPath();x.moveTo(...P(-w,-a));x.bezierCurveTo(...P(-w*.35,-up*1.32),...P(w*.5,-up*1.3),...P(w,a));x.bezierCurveTo(...P(w*.45,dn*1.3),...P(-w*.45,dn*1.3),...P(-w,-a));x.closePath();};
  x.save();almond();x.globalAlpha=.95;x.fillStyle=white;x.fill();x.clip();
  x.fillStyle=iris;x.beginPath();x.arc(cx+s*.3*mm,cy+.2*mm,5.4*mm,0,Math.PI*2);x.fill();
  x.fillStyle='#0a0706';x.beginPath();x.arc(cx+s*.3*mm,cy+.2*mm,2.3*mm,0,Math.PI*2);x.fill();
  const lid=x.createLinearGradient(0,cy-up,0,cy);lid.addColorStop(0,'rgba(10,6,4,.55)');lid.addColorStop(1,'rgba(10,6,4,0)');x.fillStyle=lid;x.fillRect(cx-w,cy-up*1.4,2*w,up*1.4);   // lash shadow
  x.fillStyle='rgba(255,255,255,.4)';x.beginPath();x.arc(cx-1.5*mm,cy-1.5*mm,.75*mm,0,Math.PI*2);x.fill();x.restore();   // catchlight: same side on both eyes (one light)
  x.save();x.strokeStyle='#100a07';x.lineCap='round';x.lineWidth=1.6*mm;x.beginPath();x.moveTo(...P(-w*1.06,-a*1.3));x.bezierCurveTo(...P(-w*.35,-up*1.36),...P(w*.5,-up*1.32),...P(w*1.02,a*.8));x.stroke();   // upper lid and lashes
  x.globalAlpha=.4;x.strokeStyle=tone(.5);x.lineWidth=.8*mm;x.beginPath();x.moveTo(...P(-w*.85,dn*.7));x.bezierCurveTo(...P(-w*.35,dn*1.25),...P(w*.35,dn*1.3),...P(w*.8,dn*.8));x.stroke();x.restore();   // lower lid
 }
 // nose: a soft light down the bridge, shade under the tip and round the wings, nostrils
 B(0,M.eye,-12,3.2,13,tone(1.1),.16,.3);
 const nw=Math.min(17,M.noseHalf/M.pupil*33);   // nostril-wing half-width (mm)
 B(0,M.nose,-1.5,nw*.6,3.2,shadow,.32,.25);for(const s of [-1,1]){B(s*nw*.38,M.nose,1.2,2.8,1.7,deep,.7,.45);B(s*nw*.8,M.nose,4.5,2.4,4,tone(.65),.12,.3);}
 B(0,M.nose,5,3.6,3.2,tone(1.12),.18,.3);   // soft light on the tip, so the base reads narrow
 // lips: one value darker than the skin with a little warmth, the upper lip darker than the lower; a soft lip line
 const lip=f=>{const l=base.clone().multiplyScalar(f);l.r*=1.07;l.g*=.9;l.b*=.93;return hex(l);},m=Y(M.mouth,mouthUp),mw=M.mouthHalf/M.pupil*33*mm;
 const upper=()=>{x.beginPath();x.moveTo(W/2-mw,m);x.quadraticCurveTo(W/2-mw*.45,m-5.5*mm,W/2-mw*.18,m-6.2*mm);x.quadraticCurveTo(W/2,m-4.8*mm,W/2+mw*.18,m-6.2*mm);x.quadraticCurveTo(W/2+mw*.45,m-5.5*mm,W/2+mw,m);x.closePath();};
 const lower=()=>{x.beginPath();x.moveTo(W/2-mw*.94,m);x.bezierCurveTo(W/2-mw*.6,m+8.5*mm,W/2+mw*.6,m+8.5*mm,W/2+mw*.94,m);x.closePath();};
 x.save();x.globalAlpha=.85;x.fillStyle=lip(.74);upper();x.fill();x.fillStyle=lip(.84);lower();x.fill();x.restore();
 B(0,M.mouth,mouthUp-3.5,9,2,tone(1.06),.3,.3);                                                      // soft light on the lower lip
 x.save();x.globalAlpha=.8;x.strokeStyle=tone(.42);x.lineWidth=1.2*mm;x.lineCap='round';x.beginPath();x.moveTo(W/2-mw*.96,m);x.quadraticCurveTo(W/2,m+1.1*mm,W/2+mw*.96,m);x.stroke();x.restore();
 for(const s of [-1,1])B(s*(mw/mm),M.mouth,mouthUp,2.6,2.2,shadow,.35,.3);                         // mouth corners
 B(0,M.mouth,mouthUp-12,13,4,shadow,.3,.25);                                                         // under the lower lip
 // a faint warmth over the cheeks
 for(const s of [-1,1])B(s*40,M.eye,-23,15,10,lip(.95),.12,.2);
 // some players keep a little stubble or a goatee (light: they are high-school kids)
 if(r(7)<.4){B(0,M.chin,10,13,8,'#1a120d',.14+r(8)*.12,.4);if(r(9)<.5)B(0,M.mouth,mouthUp+8.5,mw/mm*.8,2.4,'#1a120d',.1+r(8)*.08,.4);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
