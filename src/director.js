// Broadcast camera director for the 3D athletes (presentation only). The angles come from the Spline rig
// (src/broadcastRig.js, RIG.cameras), authored for the home team attacking +x; the director mirrors them along the court
// for the visitors but keeps the sideline cameras on the near (broadcast) side, as a real TV truck would.
//   wide        -> the high wide angle at the start of a possession
//   track       -> the low sideline camera on a long lens, following the ball handler
//   baseline    -> the end-zone camera behind the play (visitors' finishes)
//   freeThrow   -> behind the shooter, looking at the rim (jump shots), with depth of field
//   replayClose -> the low corner camera at the rim (replays), with depth of field
//   player      -> the existing first-person view (home drives and dunks)
// Cameras move on critically damped springs (frame-rate independent) with a little look-ahead, and cut (no glide)
// between angles that a director would cut between.
import * as THREE from 'three';
import {RIG,toGame} from './broadcastRig.js';
import {family,CLIP_SECONDS} from './basketball.js';

export const CAMERAS=Object.fromEntries(Object.entries(RIG.cameras).map(([k,v])=>[k,{position:toGame(v.position),target:toGame(v.target)}]));
export const RIM_X=12.15,RIM_Y=3.05;
/* Field of view per angle (degrees, 16:9). The sideline cameras are long lenses, which flattens the court like TV. */
export const LENS={wide:30,track:22,baseline:22,freeThrow:46,replayClose:40};
/* Depth of field per angle: aperture scales the blur (0 = none). Only the close angles use it. */
export const APERTURE={freeThrow:2.2,replayClose:3,track:0,wide:0,baseline:0};
const JUMPERS=new Set(['catch','pullup','stepback']);
export const CUTS=new Set(['baseline','freeThrow','replayClose','player']);

/* Which angle at a point in a possession (ct = 0..1 through the clip). */
export function pickShot(ct,{team='home',kind='pullup',replay=false}={}){
 if(ct<.26)return 'wide';
 if(ct<.58)return 'track';
 if(ct<.86){if(replay)return 'replayClose';if(JUMPERS.has(family(kind)))return 'freeThrow';return team==='home'?'player':'baseline';}
 return 'track';
}

/* Camera position and target (arrays, game units) for an angle. dir = +1 home attacking +x, -1 visitors.
   focus = the ball handler's position {x,y,z}; lead = his smoothed velocity (look-ahead). */
export function framing(shot,dir,focus,lead={x:0,z:0}){
 const C=CAMERAS,fx=Math.max(-11,Math.min(11,focus.x+lead.x*.35)),fz=focus.z+lead.z*.2;
 if(shot==='wide'){const c=C.wide;return {position:[fx*.45,c.position[1],c.position[2]],target:[fx*.55,c.target[1],c.target[2]]};}
 if(shot==='track'){
  // the rig's low sideline camera, moved in over the front row (at the rig's spot the courtside fans fill the lower frame)
  // and aimed a little low, because the lower third of the stage is covered by the camera buttons and the play caption
  const c=C.broadcastLow;return {position:[fx-dir*2,c.position[1]+1.6,c.position[2]*.76],target:[fx+dir*1.2,c.target[1]-1.1,fz*.35]};}
 if(shot==='baseline'){const c=C.baseline;return {position:[c.position[0]*dir,c.position[1],c.position[2]],target:[c.target[0]*dir,c.target[1],c.target[2]]};}
 if(shot==='replayClose'){const c=C.replayClose,k=.45;   // the rig aims at the rim; pull the aim toward the play so the shooter stays in frame
  return {position:[c.position[0]*dir,c.position[1],c.position[2]],target:[c.target[0]*dir+(focus.x-c.target[0]*dir)*k,c.target[1]-.5,c.target[2]+(focus.z-c.target[2])*k]};}
 if(shot==='freeThrow'){
  // the rig's free-throw camera, carried to wherever the shooter is: same distance behind him, height and offset
  const c=C.freeThrow,rim=[RIM_X*dir,RIM_Y,0],line=[RIM_X-4.55,0,0],back=line[0]-c.position[0],side=c.position[2];
  let ux=rim[0]-focus.x,uz=rim[2]-focus.z;const d=Math.hypot(ux,uz)||1;ux/=d;uz/=d;
  const sideSign=uz*dir<=0?1:-1;   // stay on the near (broadcast) side of the shooter
  // a little further back and higher than the rig, and aimed mostly at the shooter (rim at the top of frame), so he stays above the captions
  const b=back*1.25,k=.8;return {position:[focus.x-ux*b-uz*side*sideSign,c.position[1]+.8,focus.z-uz*b+ux*side*sideSign],target:[rim[0]+(focus.x-rim[0])*k,c.target[1]+(1.1-c.target[1])*k,rim[2]+(focus.z-rim[2])*k]};
 }
 return null;
}

/* Unity-style SmoothDamp: a critically damped spring that reaches the target in about smoothTime, frame-rate independent. */
export function smoothDamp(cur,target,vel,smoothTime,dt){
 const o=2/Math.max(1e-4,smoothTime),x=o*dt,e=1/(1+x+.48*x*x+.235*x*x*x),change=cur-target,temp=(vel+o*change)*dt;
 let v=(vel-o*temp)*e,out=target+(change+temp)*e;
 if((target-cur>0)===(out>target)){out=target;v=dt>0?(out-target)/dt:0;}
 return [out,v];
}

export class Director{
 constructor(){this.shot=null;this.pos=new THREE.Vector3();this.tgt=new THREE.Vector3();this.pv=[0,0,0];this.tv=[0,0,0];this.fov=43;this.fv=0;this.lead={x:0,z:0};this.last=null;this.dof=0;}
 reset(){this.shot=null;this.last=null;this.lead={x:0,z:0};}
 /* Moves the arena camera for this frame. Returns the angle name ('player' means the arena should run its first-person view). */
 update(a,dt,{follow=false}={}){
  const pr=a.presentation();if(!pr)return null;const clip=pr.clip,ct=Math.min(1,(a.playTime-pr.index*CLIP_SECONDS)/CLIP_SECONDS),dir=clip.team==='home'?1:-1;
  const actor=a.people[clip.team==='home'?0:5];if(!actor)return null;const f=actor.position;
  // smoothed velocity of the handler for look-ahead
  if(this.last&&dt>0){const vx=(f.x-this.last.x)/dt,vz=(f.z-this.last.z)/dt,k=1-Math.exp(-dt*4);if(Math.abs(vx)<20&&Math.abs(vz)<20){this.lead.x+=(vx-this.lead.x)*k;this.lead.z+=(vz-this.lead.z)*k;}}
  this.last={x:f.x,z:f.z};
  const shot=follow?'track':pickShot(ct,{team:clip.team,kind:clip.kind,replay:a.replaying});
  const cut=shot!==this.shot&&(this.shot===null||CUTS.has(shot)||CUTS.has(this.shot));
  if(shot!==this.shot){if(this.shot==='player'&&a.fpLook)a.controls.target.copy(a.fpLook);if(shot==='player')a.fpLook=null;this.shot=shot;}
  if(shot==='player'){this.dof=0;return shot;}
  const fr=framing(shot,dir,f,this.lead),tall=a.w/a.h<.8,fov=Math.min(80,LENS[shot]*(tall?1.5:1));
  if(cut){this.pos.fromArray(fr.position);this.tgt.fromArray(fr.target);this.pv=[0,0,0];this.tv=[0,0,0];this.fov=fov;this.fv=0;}
  else{const st=shot==='wide'?.9:.55,P=fr.position,T=fr.target;
   for(let i=0;i<3;i++){const c=['x','y','z'][i];[this.pos[c],this.pv[i]]=smoothDamp(this.pos[c],P[i],this.pv[i],st,dt);[this.tgt[c],this.tv[i]]=smoothDamp(this.tgt[c],T[i],this.tv[i],st*.6,dt);}
   [this.fov,this.fv]=smoothDamp(this.fov,fov,this.fv,.6,dt);}
  a.camera.position.copy(this.pos);a.camera.lookAt(this.tgt);a.controls.target.copy(this.tgt);
  // depth of field: focus on the shooter (or the ball once it is in the air), on the close angles and in replays
  // replays also get a gentle blur on the far stands and the front row from the sideline camera
  const ap=APERTURE[shot]||(a.replaying&&shot==='track'?.6:0);this.dof=ap;
  this.focusPoint=ap?(shot==='replayClose'&&a.ball.position.y>2.4?a.ball.position:f):null;   // the shooter; the ball in flight on the rim camera
  return shot;
 }
}
