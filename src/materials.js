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
function patch(material,{map,scale,bump,fadeFar=9,wrap=0,scatter=[1,.42,.28],face=null,inflate=0}={}){
 material.userData.kDetail={map,scale,bump,wrap};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{kDetailMap:{value:map},kDetailScale:{value:scale},kDetailBump:{value:bump},kFadeFar:{value:fadeFar}});
  if(face)Object.assign(shader.uniforms,{kFaceMap:{value:face.map},kFaceCenter:{value:face.center},kFaceSize:{value:face.size}});
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vKRest; varying vec3 vKRestN;')
   .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvKRestN = objectNormal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvKRest = transformed;'+(inflate>0?`\ntransformed += objectNormal * ${inflate.toFixed(4)};`:''));
  let frag=shader.fragmentShader
   .replace('#include <common>','#include <common>\n'+PARS+(face?'\nuniform sampler2D kFaceMap; uniform vec3 kFaceCenter; uniform vec2 kFaceSize;':''))
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 {
  float kFade = 1.0 - smoothstep(kFadeFar * 0.35, kFadeFar, length(vViewPosition));
  if (kFade > 0.0) {
   float h = kHeight(vKRest * kDetailScale, normalize(vKRestN));
   normal = kPerturb(-vViewPosition, normal, vec2(dFdx(h), dFdy(h)) * kDetailBump * kFade, faceDirection);
  }
 }`);
  // face: features painted straight onto the head (projected from the front in the rest pose), so they share the skin's lighting
  if(face)frag=frag.replace('#include <map_fragment>',`#include <map_fragment>
 {
  vec2 fuv = (vKRest.xy - kFaceCenter.xy) / kFaceSize + 0.5;
  float front = smoothstep(0.15, 0.55, normalize(vKRestN).z) * step(kFaceCenter.z - 0.12, vKRest.z);
  if (front > 0.0 && fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
   vec4 f = texture2D(kFaceMap, fuv);
   diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * front);
  }
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
 material.customProgramCacheKey=()=>`kangs-${map.uuid}-${wrap}-${face?1:0}-${inflate}`;
 return material;
}

/* ---------- the materials ---------- */
// Skin: physically based, light wrap (soft subsurface look, reddish where light bleeds round the edge), fine pores and a slight sweat sheen.
export function skinMaterial(color,face=null){
 return patch(new THREE.MeshPhysicalMaterial({color,roughness:.5,clearcoat:.14,clearcoatRoughness:.32,specularIntensity:.55,name:'skin'}),{map:MAPS.skin(),scale:9,bump:.35,fadeFar:7,wrap:.35,scatter:[.75,.32,.22],face});
}
export const KIT_INFLATE=.012;   // how far the jersey and shorts are pushed off the skin (decals sit on top of it)
// Jersey and shorts: soft cloth sheen and the perforated athletic mesh.
export function clothMaterial(color){
 return patch(new THREE.MeshPhysicalMaterial({color,roughness:.74,sheen:.28,sheenRoughness:.45,sheenColor:new THREE.Color(.75,.75,.8),specularIntensity:.3,name:'kit'}),{map:MAPS.mesh(),scale:22,bump:.18,fadeFar:3.2,inflate:KIT_INFLATE});
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

/* ---------- painted face: brows, eyes, nose and lips in tones taken from the skin, on a decal bent round the face ---------- */
export function faceTexture(skinHex,seed=0){
 if(typeof document==='undefined')return new THREE.Texture();
 const W=256,c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d');
 const base=new THREE.Color(skinHex),tone=f=>'#'+base.clone().multiplyScalar(f).getHexString(),r=n=>{const v=Math.sin(seed*91.7+n*13.1)*43758.5;return v-Math.floor(v);};
 const blob=(cx,cy,rx,ry,color,alpha,soft=.6)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,1);g.addColorStop(0,color);g.addColorStop(soft,color);g.addColorStop(1,'rgba(0,0,0,0)');x.save();x.translate(cx,cy);x.scale(rx,ry);x.translate(-cx,-cy);x.globalAlpha=alpha;x.fillStyle=g;x.beginPath();x.arc(cx,cy,1,0,Math.PI*2);x.fill();x.restore();};
 // proportions of a real face across the painted area (eyes about a fifth of the face wide, one eye-width apart)
 const browY=W*(.17+r(1)*.025),eyeY=W*.35,eyeDX=W*(.215+r(2)*.012),mouthY=W*(.79+r(3)*.02),ew=W*(.085+r(5)*.008),iris=['#3b2416','#2a1a10','#4a3020','#1e140d'][Math.floor(r(6)*4)];
 // planes of the face: cheekbone light, hollow under the cheek, jaw and temple shadow
 for(const s of [-1,1]){blob(W/2+s*W*.27,W*.5,W*.13,W*.1,tone(1.12),.35,.2);blob(W/2+s*W*.3,W*.68,W*.12,W*.15,tone(.78),.35,.25);blob(W/2+s*W*.42,W*.3,W*.08,W*.16,tone(.8),.4,.2);}
 for(const s of [-1,1]){
  const ex=W/2+s*eyeDX;
  blob(ex,eyeY-W*.01,W*.14,W*.085,tone(.6),.6,.25);                                                   // eye socket shadow
  x.save();x.globalAlpha=.95;x.fillStyle='#efe9e1';x.beginPath();x.ellipse(ex,eyeY,ew,W*.034,0,0,Math.PI*2);x.fill();   // white of the eye
  x.save();x.clip();x.fillStyle=iris;x.beginPath();x.arc(ex+s*W*.004,eyeY+W*.004,W*.034,0,Math.PI*2);x.fill();x.fillStyle='#070504';x.beginPath();x.arc(ex+s*W*.004,eyeY+W*.004,W*.015,0,Math.PI*2);x.fill();
  x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.arc(ex-W*.01,eyeY-W*.01,W*.007,0,Math.PI*2);x.fill();x.restore();   // iris, pupil, catchlight
  x.strokeStyle='#120c09';x.lineWidth=W*.016;x.lineCap='round';x.beginPath();x.ellipse(ex,eyeY+W*.002,ew*1.04,W*.04,0,Math.PI*1.04,Math.PI*1.96);x.stroke();   // upper lid and lashes
  x.strokeStyle=tone(.55);x.lineWidth=W*.008;x.beginPath();x.ellipse(ex,eyeY-W*.002,ew,W*.036,0,Math.PI*.1,Math.PI*.9);x.stroke();x.restore();   // lower lid
  x.save();x.globalAlpha=.9;x.strokeStyle='#140d0a';x.lineCap='round';x.lineWidth=W*(.04+r(4)*.014);x.beginPath();x.moveTo(W/2+s*W*.07,browY+W*.03);x.quadraticCurveTo(ex,browY-W*.025,W/2+s*eyeDX*1.62,browY+W*.03);x.stroke();x.restore();   // brow
 }
 // nose: lit bridge between shaded sides, a shadow under the tip, nostrils
 x.save();x.globalAlpha=.4;x.fillStyle=tone(1.15);x.beginPath();x.ellipse(W/2,W*.5,W*.022,W*.11,0,0,Math.PI*2);x.fill();x.restore();
 for(const s of [-1,1])blob(W/2+s*W*.06,W*.5,W*.03,W*.11,tone(.7),.45,.3);
 blob(W/2,W*.635,W*.11,W*.05,tone(.55),.6,.3);
 for(const s of [-1,1])blob(W/2+s*W*.05,W*.625,W*.022,W*.014,tone(.3),.85,.5);
 // lips: darker upper lip, fuller lower lip with a soft highlight, a crisp line between
 x.save();x.globalAlpha=.9;x.fillStyle=tone(.62);x.beginPath();x.moveTo(W/2-W*.13,mouthY);x.quadraticCurveTo(W/2-W*.05,mouthY-W*.05,W/2,mouthY-W*.03);x.quadraticCurveTo(W/2+W*.05,mouthY-W*.05,W/2+W*.13,mouthY);x.closePath();x.fill();
 x.fillStyle=tone(.74);x.beginPath();x.moveTo(W/2-W*.12,mouthY);x.quadraticCurveTo(W/2,mouthY+W*.075,W/2+W*.12,mouthY);x.closePath();x.fill();
 x.globalAlpha=.5;x.fillStyle=tone(1.05);x.beginPath();x.ellipse(W/2,mouthY+W*.03,W*.05,W*.012,0,0,Math.PI*2);x.fill();
 x.globalAlpha=.95;x.strokeStyle=tone(.32);x.lineWidth=W*.012;x.lineCap='round';x.beginPath();x.moveTo(W/2-W*.13,mouthY);x.quadraticCurveTo(W/2,mouthY+W*.012,W/2+W*.13,mouthY);x.stroke();x.restore();
 blob(W/2,mouthY+W*.12,W*.09,W*.04,tone(.75),.4,.3);                                           // shadow under the lower lip
 // some players keep a little stubble or a goatee
 if(r(7)<.4){x.save();x.globalAlpha=.28+r(8)*.2;x.fillStyle='#1a120d';x.beginPath();x.ellipse(W/2,mouthY+W*.11,W*.14,W*.08,0,0,Math.PI*2);x.fill();x.beginPath();x.ellipse(W/2,mouthY-W*.055,W*.12,W*.022,0,0,Math.PI*2);x.fill();x.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

