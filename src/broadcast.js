// Broadcast look for the gym: the Spline lighting rig (src/broadcastRig.js), a glossy court with soft reflections of the
// players, contact shadows under feet and ball, ambient occlusion, bloom and a warm broadcast colour grade.
// Testing: setting window.__kangsLook before the game loads overrides parts of it (e.g. {noPost:true}, {f:{bloom:false}}, {spot:0}).
// It is switched on with the 3D athletes (Settings > Player models) on Medium/High graphics and switched off completely
// otherwise, so the classic gym is untouched. Presentation only.
import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RIG,toGame} from './broadcastRig.js';
import {DepthGrab,DofPass} from './dof.js';
import {lookFeatures} from './graphics.js';

// Spline light units to three.js (physically based) units, matched by eye against the classic gym's exposure.
const K={key:1.6,spot:17,rim:1.6,ambient:1.1,distance:1/50*0.3306/0.3048};
const FLOOR_Y=.042;   // just above the court's top face
const REFLECTED=2;   // layer of what the court mirrors: players, ball, hoops, the light rig (not the stands, walls or crowd)

/* The court reflection: the mirrored scene, softly blurred, shown more at grazing angles (Fresnel), over the wood. */
const GLOSS={name:'GlossFloor',
 uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},strength:{value:.42},texel:{value:new THREE.Vector2(1/512,1/512)}},
 vertexShader:`uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
}`,
 fragmentShader:`uniform sampler2D tDiffuse; uniform float strength; uniform vec2 texel; varying vec4 vUv; varying vec3 vWorld;
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
 vec2 uv = vUv.xy / vUv.w; vec3 acc = vec3(0.0); float ws = 0.0;
 for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) { float w = exp(-float(i * i + j * j) / 4.0); acc += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * texel * 2.0).rgb * w; ws += w; }
 vec3 v = normalize(cameraPosition - vWorld); float fres = 0.18 + 0.82 * pow(1.0 - abs(v.y), 2.5);
 gl_FragColor = vec4(acc / ws, strength * fres);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`};

/* Warm broadcast grade, applied to the linear image before tone mapping: warm white balance, a little more colour, soft vignette. */
const GRADE={uniforms:{tDiffuse:{value:null},warmth:{value:new THREE.Vector3(1.045,1,.935)},saturation:{value:1.08},vignette:{value:.22}},
 vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
 fragmentShader:`uniform sampler2D tDiffuse; uniform vec3 warmth; uniform float saturation; uniform float vignette; varying vec2 vUv;
void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb * warmth; float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, saturation);
 vec2 d = vUv - .5; col *= 1.0 - vignette * smoothstep(.25, .85, length(d * vec2(1.0, .85))); gl_FragColor = vec4(col, c.a); }`};

function blobTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.4,'rgba(0,0,0,.78)');g.addColorStop(.75,'rgba(0,0,0,.38)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export class BroadcastLook{
 constructor(arena){this.a=arena;this.key='off';this.added=[];this.undo=[];if(globalThis.__kangsLook)globalThis.__kangsLookObj=this;}
 /* Turns the look on for a graphics level, or off (enabled false or Low). Rebuilt only when the level changes. */
 set(enabled,level){const f=enabled?lookFeatures(level):null,key=f?level:'off';if(key===this.key)return;this.teardown();this.key=key;if(f)this.build(f);}
 get active(){return this.key!=='off';}
 keep(fn){this.undo.push(fn);}
 add(o){this.a.scene.add(o);this.added.push(o);return o;}
 build(f){
  const a=this.a,s=a.scene,r=a.renderer,dbg=globalThis.__kangsLook||{};f={...f,...(dbg.f||{})};this.f=f;
  // image-based light from a neutral room, for believable highlights on skin, shoes, the ball and the varnished floor
  const pm=new THREE.PMREMGenerator(r);this.env=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
  const env0=s.environment,ei0=s.environmentIntensity;s.environment=this.env;s.environmentIntensity=dbg.env??.22;this.keep(()=>{s.environment=env0;s.environmentIntensity=ei0;});
  // varnished maple: clearcoat over the painted court
  const floor=a.floor;if(floor){const mats=floor.material,top=mats[2];const gloss=new THREE.MeshPhysicalMaterial({map:top.map,roughness:.48,clearcoat:dbg.clearcoat??.28,clearcoatRoughness:.48});mats[2]=gloss;this.keep(()=>{mats[2]=top;gloss.dispose();});}
  // ambient fill and key light from the rig
  if(a.hemi){const c0=a.hemi.color.clone(),i0=a.hemi.intensity;a.hemi.color.set(RIG.ambient.color);a.hemi.intensity=RIG.ambient.intensity*K.ambient*(dbg.ambient??1);this.keep(()=>{a.hemi.color.copy(c0);a.hemi.intensity=i0;});}
  if(a.sun){const sun=a.sun,p0=sun.position.clone(),c0=sun.color.clone(),i0=sun.intensity,r0=sun.shadow.radius;sun.position.fromArray(toGame(RIG.key.position));sun.color.set(RIG.key.color);sun.intensity=RIG.key.intensity*K.key*(dbg.key??1);sun.shadow.radius=RIG.key.shadowSoftness/2;
   this.keep(()=>{sun.position.copy(p0);sun.color.copy(c0);sun.intensity=i0;sun.shadow.radius=r0;});}
  // the truss spotlights replace the gym's three; Medium keeps one per pair
  for(const sp of a.spots||[]){sp.visible=false;this.keep(()=>{sp.visible=true;});}
  const spots=f.spots>=6?RIG.spots:RIG.spots.filter((_,i)=>i<3).map(s=>({...s,position:[s.position[0],s.position[1],0]}));
  for(const sp of spots){const [x,y,z]=toGame(sp.position);const l=new THREE.SpotLight(sp.color,sp.intensity*K.spot*(dbg.spot??1),sp.distance*K.distance,THREE.MathUtils.degToRad(sp.angle),sp.penumbra,sp.decay);l.position.set(x,y,z);l.target.position.set(x,0,z);this.add(l);this.add(l.target);}
  // rim lights: cool, from high behind the baselines, so players separate from the stands
  for(const rim of RIG.rims){const l=new THREE.DirectionalLight(rim.color,rim.intensity*K.rim);l.position.fromArray(toGame(rim.position));this.add(l);}
  // the truss and its glowing light banks (they bloom)
  const metal=new THREE.MeshStandardMaterial({color:0x2b2b33,roughness:.45,metalness:.6}),glow=new THREE.MeshStandardMaterial({color:0xfffaf0,emissive:0xfff4e0,emissiveIntensity:3.2});
  for(const t of RIG.trusses){const [w,h,d]=toGame(t.size);const m=this.add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),metal));m.position.fromArray(toGame(t.position));}
  for(const b of RIG.banks){const [w,h,d]=toGame(b.size);const m=this.add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),glow));m.position.fromArray(toGame(b.position));}
  // court reflections (High)
  if(f.reflections){const g=new Reflector(new THREE.PlaneGeometry(32,20),{shader:GLOSS,textureWidth:512,textureHeight:512,clipBias:.003,multisample:0});
   g.rotation.x=-Math.PI/2;g.position.y=FLOOR_Y;g.material.transparent=true;g.material.depthWrite=false;g.renderOrder=1;this.add(g);this.reflector=g;
   this.reflect=g.onBeforeRender;g.onBeforeRender=()=>{};/* rendered once per frame in render(), not again by the AO pass */
   // the mirror only draws what can actually show in the floor: things over the court and every light (lights obey layers)
   g.camera.layers.set(REFLECTED);const box=new THREE.Box3(),c=new THREE.Vector3(),skip=new Set([g,a.floor,...a.people]);s.updateMatrixWorld(true);
   s.traverse(o=>{if(skip.has(o)||this.blobs?.includes(o))return;let on=false;
    if(o.isLight)on=true;else if(o.isMesh||o.isLine){box.setFromObject(o).getCenter(c);on=Math.abs(c.x)<15.5&&Math.abs(c.z)<9&&c.y>.15&&!o.isInstancedMesh;}
    if(on&&!o.layers.isEnabled(REFLECTED)){o.layers.enable(REFLECTED);this.keep(()=>o.layers.disable(REFLECTED));}});}
  // contact shadows: a soft dark pool under every player and the ball, fading as they leave the floor
  if(f.contact){const tex=this.blobTex=blobTexture();this.blobs=[];
   for(let i=0;i<=a.people.length;i++){const m=this.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:tex,color:dbg.blobColor??0xffffff,transparent:true,depthWrite:false,toneMapped:false})));m.rotation.x=-Math.PI/2;m.renderOrder=2;this.blobs.push(m);}}
  // post: ambient occlusion (High), bloom, grade, then tone mapping and sRGB
  if(dbg.noPost){this.composer=null;return;}
  const size=r.getSize(new THREE.Vector2()),pr=r.getPixelRatio();
  // full-precision depth: the default 16-bit buffer cannot separate the contact shadows (6 mm up) from the floor
  const rt=new THREE.WebGLRenderTarget(size.x*pr,size.y*pr,{type:THREE.HalfFloatType,depthBuffer:true});rt.depthTexture=new THREE.DepthTexture(size.x*pr,size.y*pr,THREE.FloatType);
  const c=this.composer=new EffectComposer(r,rt);
  for(const t of [c.renderTarget1,c.renderTarget2])if(!t.depthTexture||t.depthTexture.type!==THREE.FloatType)t.depthTexture=new THREE.DepthTexture(t.width,t.height,THREE.FloatType);c.setPixelRatio(r.getPixelRatio());c.setSize(size.x,size.y);
  c.addPass(new RenderPass(s,a.camera));const grab=new DepthGrab();c.addPass(grab);
  if(f.ao){const ao=new GTAOPass(s,a.camera,size.x,size.y);ao.updateGtaoMaterial({radius:.55,distanceExponent:1.2,thickness:1,scale:1.1,samples:12});ao.blendIntensity=.85;c.addPass(ao);this.ao=ao;}
  if(f.dof)c.addPass(this.dof=new DofPass(a.camera,grab));
  if(f.bloom)c.addPass(this.bloom=new UnrealBloomPass(new THREE.Vector2(size.x/2,size.y/2),dbg.bloomStrength??.3,.5,dbg.bloomThreshold??2.2));
  if(f.grade)c.addPass(new ShaderPass(GRADE));
  c.addPass(new OutputPass());
  this.resize(size.x,size.y);
 }
 /* Depth of field (replays and close angles): focus on a world point with an aperture; eases in and out. 0 / null switches it off. */
 setDof(point,aperture,dt){const d=this.dof;if(!d)return;const on=!!point&&aperture>0&&!globalThis.__kangsLook?.noDof;
  d.amount+=((on?1:0)-d.amount)*(1-Math.exp(-(dt||0)*5));if(on){d.focus=Math.max(.5,this.a.camera.position.distanceTo(point));d.aperture=aperture;}
  if(!on&&d.amount<.01)d.amount=0;d.enabled=d.amount>0;}
 /* Per frame: contact shadows follow their owners. */
 update(){const a=this.a;
  if(this.reflector)for(const o of [...a.people,a.ball]){if(!o||o.userData.reflected!==undefined&&o.userData.reflected===(o.userData.body??null))continue;o.userData.reflected=o.userData.body??null;o.traverse(m=>m.layers.enable(REFLECTED));}
  if(!this.blobs)return;
  a.people.forEach((p,i)=>{const b=this.blobs[i],y=p.position.y;b.position.set(p.position.x,FLOOR_Y+.004+(globalThis.__kangsLook?.blobLift||0),p.position.z);b.scale.setScalar(1.55+y*.5);b.material.opacity=.85*Math.max(0,1-y/1.4);b.visible=p.visible!==false;});
  const ball=a.ball,b=this.blobs[a.people.length];if(ball&&b){const y=Math.max(0,ball.position.y-.13);b.position.set(ball.position.x,FLOOR_Y+.005,ball.position.z);b.scale.setScalar(.42+y*.14);b.material.opacity=.7*Math.max(0,1-y/2.2);b.visible=ball.visible!==false;}}
 render(camera){const a=this.a;if(!this.active){a.renderer.render(a.scene,camera);return;}
  // shadows once per frame: otherwise every scene render (mirror, main, AO normals) redraws the shadow map
  const sm=a.renderer.shadowMap;sm.autoUpdate=false;sm.needsUpdate=true;
  this.update();if(this.reflect)this.reflect.call(this.reflector,a.renderer,a.scene,camera);if(this.composer)this.composer.render();else a.renderer.render(a.scene,camera);}
 resize(w,h){if(!this.composer)return;const pr=this.a.renderer.getPixelRatio();this.composer.setPixelRatio(pr);this.composer.setSize(w,h);this.ao?.setSize(w*pr,h*pr);
  if(this.reflector){const rw=Math.max(256,Math.round(w*pr*.5)),rh=Math.max(256,Math.round(h*pr*.5));this.reflector.getRenderTarget().setSize(rw,rh);this.reflector.material.uniforms.texel.value.set(1/rw,1/rh);}}
 teardown(){
  this.a.renderer.shadowMap.autoUpdate=true;  for(const fn of this.undo.reverse())fn();this.undo=[];for(const o of [...this.a.people,this.a.ball])if(o){delete o.userData.reflected;o.traverse(m=>m.layers.disable(REFLECTED));}
  for(const o of this.added){o.parent?.remove(o);o.traverse?.(m=>{if(m.isMesh){m.geometry?.dispose();}});o.dispose?.();}
  if(this.reflector){this.reflector.getRenderTarget().dispose();this.reflector.material.dispose();}
  this.blobs?.forEach(b=>b.material.dispose());this.blobTex?.dispose();this.env?.dispose();this.composer?.dispose?.();
  this.added=[];this.blobs=null;this.reflector=null;this.reflect=null;this.composer=null;this.ao=null;this.bloom=null;this.dof?.dispose();this.dof=null;this.env=null;this.key='off';
 }
}
