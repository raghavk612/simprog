// Motion polish for the 3D athletes (presentation only: the plays still decide where everyone is).
// On top of the Arena's pose (position, facing, arm pose) it adds:
//   * foot planting: a two-bone leg IK keeps the stance foot on the floor; the stride advances with the distance actually
//     travelled (not a clock), so feet do not slide; the swing foot lifts and reaches forward
//   * stances: an athletic crouch at rest, a lower one while dribbling, a wide low one on defence, tucked legs in the air
//   * weight: a slow side-to-side weight shift when standing, hip and shoulder counter-twist and torso lean when running
//   * arms swing opposite the legs; the dribble hand pumps in time with the ball; the head turns toward the ball
//   * every channel eases (critically damped), so poses blend instead of snapping
// The classic figure is not touched.
import * as THREE from 'three';

/* Two-bone leg in the sagittal plane. The hip sits `drop` above the ankle target and the target is `forward` ahead of the hip.
   Returns rotations about x for the hip (negative = thigh forward) and knee (positive = shin back), with the leg straight
   when the target is out of reach. */
export function solveLeg(thigh,shin,forward,drop){
 const reach=thigh+shin-1e-6,d=Math.min(Math.hypot(forward,drop),reach),cosK=(thigh*thigh+shin*shin-d*d)/(2*thigh*shin);
 const knee=Math.PI-Math.acos(Math.max(-1,Math.min(1,cosK)));
 const toTarget=Math.atan2(forward,Math.max(drop,1e-4)),cosB=(thigh*thigh+d*d-shin*shin)/(2*thigh*Math.max(d,1e-4));
 const beta=Math.acos(Math.max(-1,Math.min(1,cosB)));
 return {hip:-(toTarget+beta),knee};
}
/* Where the ankle ends up (forward, down from the hip) for given hip/knee rotations: the forward check of solveLeg. */
export function ankleOf(thigh,shin,hip,knee){const a=-hip,b=a-knee;return {forward:thigh*Math.sin(a)+shin*Math.sin(b),drop:thigh*Math.cos(a)+shin*Math.cos(b)};}
/* Stride length for a speed (game units per second): short steps when shuffling, long ones at a sprint. */
export const strideFor=speed=>Math.min(1.5,.42+speed*.2);
/* Foot target in the stride cycle. phase 0..2π: first half planted (moves back exactly as the body moves forward), second half swinging. */
export function footAt(phase,stride,lift){
 const p=((phase%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
 if(p<Math.PI)return {forward:stride/2-p/Math.PI*stride,up:0};
 const s=(p-Math.PI)/Math.PI,e=s*s*(3-2*s);return {forward:-stride/2+e*stride,up:lift*Math.sin(s*Math.PI)};
}
const damp=(cur,target,rate,dt)=>cur+(target-cur)*(1-Math.exp(-rate*dt));

/* Rest measurements of an athlete body, taken once from its bone offsets (the skeleton's own units; the rest pose is
   unrotated, so heights are sums of the bones' local offsets and do not depend on the current pose). */
function rest(body){
 if(body.motionRest)return body.motionRest;
 const b=body.bones,pelvis=b.pelvis.position.clone(),legs={};
 for(const s of ['L','R']){const hip=b['hip_'+s].position,knee=b['knee_'+s].position,ankle=b['ankle_'+s].position,hipY=pelvis.y+hip.y;
  legs[s]={thigh:knee.length(),shin:ankle.length(),hipY,ankleY:hipY+knee.y+ankle.y};}
 return body.motionRest={legs,pelvis};
}

/* Called by the Arena after its own pose for an athlete. ctx = {dt, motion, ball (world position or null)}. */
export function animateAthlete(player,pose,ctx){
 const u=player.userData,body=u.body,b=body?.bones;if(!b?.hip_L||!b.knee_L||!b.ankle_L)return;
 const R=rest(body),m=u.motionState??={phase:0,speed:0,crouch:.06,lean:0,wide:0,sway:0,last:null,headYaw:0,t:Math.random()*10},dt=Math.min(ctx.dt||0,.05);
 // measured ground speed from the pose positions (teleports are ignored)
 const here=player.position;let moved=0,dir=0;
 if(m.last){const dx=here.x-m.last.x,dz=here.z-m.last.z;moved=Math.hypot(dx,dz);if(moved>1.5)moved=0;
  // direction of travel relative to facing: 0 = forward, ±π/2 = sliding sideways (defence), π = backpedal
  if(moved>1e-5){dir=Math.atan2(dx,dz)-player.rotation.y;dir=Math.atan2(Math.sin(dir),Math.cos(dir));m.dir=dir;}else dir=m.dir||0;}
 m.last={x:here.x,z:here.z};
 const speed=dt>0?moved/dt:0;m.speed=damp(m.speed,Math.min(speed,9),6,dt);m.t+=dt;
 const run=Math.min(1,m.speed/5),airborne=Math.min(1,Math.max(0,pose.y)/.18);
 const stride=strideFor(m.speed);if(ctx.motion)m.phase+=moved/Math.max(stride,.2)*Math.PI;
 // stance targets by what the player is doing
 const arms=pose.arms||'relax',dribble=arms==='dribble',defend=arms==='defend';
 const crouchT=airborne>0?.02:defend?.17:dribble?.13:.07+run*.05,wideT=defend?.2:dribble?.08:.03,leanT=run*.2+(dribble?.22:0)+(defend?.12:0);
 m.crouch=damp(m.crouch,crouchT,7,dt);m.wide=damp(m.wide,wideT,7,dt);m.lean=damp(m.lean,leanT,6,dt);
 const still=1-run;m.sway=Math.sin(m.t*1.1)*still*(ctx.motion?1:0);   // slow weight shift when standing
 // pelvis: crouch, a bob at twice the stride rate, weight shift to one side
 const bob=ctx.motion?Math.abs(Math.sin(m.phase))*.035*run:0,h=R.legs.L.hipY;
 b.pelvis.position.set(R.pelvis.x+m.sway*.025,R.pelvis.y-m.crouch*h+bob,R.pelvis.z);
 b.pelvis.rotation.set(0,ctx.motion?-Math.sin(m.phase)*.1*run:0,-m.sway*.03);
 // legs: stride targets, planted while in stance; in the air the knees tuck
 for(const [j,s] of [[0,'R'],[1,'L']]){
  const L=R.legs[s],hipBone=b['hip_'+s],knee=b['knee_'+s],ankle=b['ankle_'+s];
  const foot=run>.02&&ctx.motion?footAt(m.phase+(j?Math.PI:0),stride,.1+.12*run):{forward:(j?.06:-.04)*(1-m.wide*2),up:0};
  // the stride runs along the direction of travel: forward/back in the leg's plane, sideways through the hip (a shuffle)
  const fwd=foot.forward*Math.cos(dir),side=foot.forward*Math.sin(dir);
  const hipWorldY=L.hipY-m.crouch*h+bob,drop=hipWorldY-L.ankleY-foot.up+(s==='L'?-1:1)*m.sway*.012;
  let sol=solveLeg(L.thigh,L.shin,fwd,Math.sqrt(Math.max(drop*drop-side*side,drop*drop*.5)));
  if(airborne>0){const tuck={hip:-.5,knee:1.0};sol={hip:sol.hip+(tuck.hip-sol.hip)*airborne,knee:sol.knee+(tuck.knee-sol.knee)*airborne};}
  const abduct=(s==='L'?1:-1)*m.wide+Math.asin(Math.max(-.6,Math.min(.6,side/drop)));
  hipBone.rotation.set(sol.hip,0,abduct);knee.rotation.set(sol.knee,0,0);
  ankle.rotation.set(-(sol.hip+sol.knee)*(1-airborne*.6),0,-abduct);   // foot stays flat on the floor
 }
 // torso: lean into the run, shoulders counter-twist against the hips
 b.spine.rotation.set(m.lean*.55,ctx.motion?Math.sin(m.phase)*.12*run:0,m.sway*.025);
 b.chest.rotation.set(m.lean*.35,ctx.motion?Math.sin(m.phase)*.08*run:0,0);
 // arms: swing opposite the legs when relaxed; the dribble hand pumps with the ball (same clock as the ball's bounce)
 if(arms==='relax'){u.arms.forEach((a,j)=>{const sw=ctx.motion?-Math.sin(m.phase+(j?Math.PI:0))*.55*run:0,side=j?1:-1;a.rotation.x=damp(a.rotation.x,sw,10,dt);a.rotation.z=damp(a.rotation.z,side*(.1+.08*m.crouch*4),8,dt);a.userData.elbow.rotation.x=damp(a.userData.elbow.rotation.x,-.25-.6*run,8,dt);});}
 if(dribble&&ctx.motion){const bounce=Math.abs(Math.sin((ctx.gait||0)*6)),a=u.arms[1];a.rotation.x=-.35-.4*bounce;a.userData.elbow.rotation.x=-.75+.4*bounce;}
 // head: turn toward the ball (limited), eyes level against the torso lean
 if(b.head){let yaw=0;if(ctx.ball){const dx=ctx.ball.x-here.x,dz=ctx.ball.z-here.z;if(dx*dx+dz*dz>.04){yaw=Math.atan2(dx,dz)-player.rotation.y;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));yaw=Math.max(-1,Math.min(1,yaw));}}
  m.headYaw=damp(m.headYaw,yaw,5,dt);b.head.rotation.set(-m.lean*.6,m.headYaw*.7,0);if(b.neck)b.neck.rotation.set(0,m.headYaw*.3,0);}
}
