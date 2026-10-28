// Depth of field for the broadcast look (replays and the close camera angles only; switched off otherwise, so it costs
// nothing in normal play). It reuses the depth the main render already wrote (no extra scene pass):
//   1. at half resolution, a 32-tap golden-angle disc blur whose radius follows each pixel's circle of confusion,
//      with background samples kept from bleeding over sharp foreground edges;
//   2. at full resolution, the sharp image blended with the blur by the circle of confusion.
import * as THREE from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const VERT='varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const BLUR=`#include <packing>
uniform sampler2D tColor; uniform sampler2D tDepth; uniform float cameraNear; uniform float cameraFar; uniform float focus; uniform float aperture; uniform float radius; uniform vec2 texel; varying vec2 vUv;
float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
float coc(float z){ return clamp(abs(z - focus) / max(z, 1e-3) * aperture, 0.0, 1.0); }
void main(){
 float zc = viewZ(vUv), cc = coc(zc); vec3 acc = texture2D(tColor, vUv).rgb; float ws = 1.0;
 for (int i = 0; i < 32; i++) {
  float r = sqrt((float(i) + .5) / 32.0), ang = float(i) * 2.39996323;
  vec2 uv = vUv + vec2(cos(ang), sin(ang)) * r * radius * texel;
  float zs = viewZ(uv), cs = coc(zs);
  float reach = zs > zc ? min(cs, cc) : cs;            // a far sample may not spill over a nearer, sharper pixel
  float w = clamp((reach - r) * 6.0 + 1.0, 0.0, 1.0);
  acc += texture2D(tColor, uv).rgb * w; ws += w;
 }
 gl_FragColor = vec4(acc / ws, cc);
}`;
const MIX=`uniform sampler2D tSharp; uniform sampler2D tBlur; uniform float amount; varying vec2 vUv;
void main(){ vec4 s = texture2D(tSharp, vUv), b = texture2D(tBlur, vUv); gl_FragColor = vec4(mix(s.rgb, b.rgb, smoothstep(.04, .3, b.a) * amount), s.a); }`;

/* Hands the depth texture of the buffer the RenderPass just drew into to the depth-of-field pass. */
export class DepthGrab extends Pass{constructor(){super();this.needsSwap=false;this.texture=null;}render(r,w,read){this.texture=read.depthTexture;}}

export class DofPass extends Pass{
 constructor(camera,grab){
  super();this.camera=camera;this.grab=grab;this.enabled=false;this.amount=0;this.focus=10;this.aperture=2;
  this.half=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  this.blur=new THREE.ShaderMaterial({uniforms:{tColor:{value:null},tDepth:{value:null},cameraNear:{value:.1},cameraFar:{value:220},focus:{value:10},aperture:{value:2},radius:{value:9},texel:{value:new THREE.Vector2()}},vertexShader:VERT,fragmentShader:BLUR,depthTest:false,depthWrite:false});
  this.mix=new THREE.ShaderMaterial({uniforms:{tSharp:{value:null},tBlur:{value:this.half.texture},amount:{value:0}},vertexShader:VERT,fragmentShader:MIX,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad();
 }
 setSize(w,h){const hw=Math.max(1,w>>1),hh=Math.max(1,h>>1);this.half.setSize(hw,hh);this.blur.uniforms.texel.value.set(1/hw,1/hh);this.blur.uniforms.radius.value=Math.max(4,Math.round(hh/90));}
 render(renderer,writeBuffer,readBuffer){
  const u=this.blur.uniforms,c=this.camera;u.tColor.value=readBuffer.texture;u.tDepth.value=this.grab.texture;u.cameraNear.value=c.near;u.cameraFar.value=c.far;u.focus.value=this.focus;u.aperture.value=this.aperture;
  this.quad.material=this.blur;renderer.setRenderTarget(this.half);renderer.clear();this.quad.render(renderer);
  this.mix.uniforms.tSharp.value=readBuffer.texture;this.mix.uniforms.amount.value=this.amount;this.quad.material=this.mix;
  renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);if(this.clear)renderer.clear();this.quad.render(renderer);
 }
 dispose(){this.half.dispose();this.blur.dispose();this.mix.dispose();this.quad.dispose();}
}
