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

/* Two-bone arm IK in the chest's space. S = shoulder, T = wrist target, L1/L2 = upper arm and forearm, pole = where the elbow
   should point. Returns the upper-arm direction u, the forearm bend direction b (both unit) and the elbow bend angle
   (0 = straight), or null if the target sits on the shoulder. */
export function solveArm(S,T,L1,L2,pole){
 const d=T.clone().sub(S),len=d.length();if(len<1e-5)return null;
 const D=Math.min(Math.max(len,Math.abs(L1-L2)+1e-3),L1+L2-1e-4),dn=d.multiplyScalar(1/len);
 const p=pole.clone().sub(dn.clone().multiplyScalar(pole.dot(dn)));if(p.lengthSq()<1e-8)p.set(0,0,1).sub(dn.clone().multiplyScalar(dn.z));p.normalize();
 const a=Math.acos(Math.max(-1,Math.min(1,(L1*L1+D*D-L2*L2)/(2*L1*D)))),u=dn.clone().multiplyScalar(Math.cos(a)).add(p.clone().multiplyScalar(Math.sin(a)));
 const E=S.clone().add(u.clone().multiplyScalar(L1)),f=dn.clone().multiplyScalar(D).add(S).sub(E).normalize();
 const b=f.clone().sub(u.clone().multiplyScalar(f.dot(u)));if(b.lengthSq()<1e-8)b.copy(p);b.normalize();
 const bend=Math.PI-Math.acos(Math.max(-1,Math.min(1,(L1*L1+L2*L2-D*D)/(2*L1*L2))));
 return {u,b,bend,elbow:E};
}
/* Arm poses for each play situation, per side (j: 0 = right, 1 = left): shoulder flex x (negative = forward/up), abduction z
   (positive = away from the body) and elbow flex e (negative = bent). */
const ARM={
 relax:()=>[0,.1,-.25],
 shoot:(j,m)=>j===0?[-2.75,.05,-.15]:[-2.15,.35,-.5],          // follow-through: shooting arm up and through, guide hand off the ball
 hook:j=>j===0?[-2.9,.55,-.2]:[-1.2,.7,-.9],                    // hook over the top, off arm up to shield
 block:(j,m)=>j===m.high?[-2.85,.15,-.12]:[-1.85,.45,-.45],      // one hand high on the ball, the other wide
 rebound:()=>[-2.55,.3,-.45],                                    // both up, elbows soft
 defend:(j,m,t)=>j===m.high?[-1.25+Math.sin(t*3.1)*.12,.75,-.8]:[-.45+Math.sin(t*2.3+1)*.1,.95,-.55],   // active hands, one high one low
 pass:()=>[-1.35,-.08,-.35],                                     // chest pass: arms through, hands together
 screen:()=>[-.6,-.38,-1.5],                                     // arms crossed in front, braced
 dribble:()=>[-.7,.35,-1.0]                                      // off arm out front as a guard; the dribble hand is set by IK
};
const quatFrom=(()=>{const m0=new THREE.Matrix4(),m1=new THREE.Matrix4(),c=new THREE.Vector3(),c0=new THREE.Vector3();
 return (u0,b0,u,b,out)=>{c0.crossVectors(u0,b0);c.crossVectors(u,b);m0.makeBasis(u0,b0,c0);m1.makeBasis(u,b,c);return out.setFromRotationMatrix(m1.multiply(m0.transpose()));};})();
const _v=new THREE.Vector3(),_w=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler();

/* Rest measurements of an athlete body, taken once from its bone offsets (the skeleton's own units; the rest pose is
   unrotated, so heights are sums of the bones' local offsets and do not depend on the current pose). */
function rest(body){
 if(body.motionRest)return body.motionRest;
 const b=body.bones,pelvis=b.pelvis.position.clone(),legs={};
 for(const s of ['L','R']){const hip=b['hip_'+s].position,knee=b['knee_'+s].position,ankle=b['ankle_'+s].position,hipY=pelvis.y+hip.y;
  legs[s]={thigh:knee.length(),shin:ankle.length(),hipY,ankleY:hipY+knee.y+ankle.y};}
 const arms=[];for(const s of ['R','L']){const sh=b['shoulder_'+s],el=b['elbow_'+s],wr=b['wrist_'+s];if(!sh||!el||!wr){arms.push(null);continue;}
  const u0=el.position.clone().normalize(),b0=new THREE.Vector3(0,0,1);b0.sub(u0.clone().multiplyScalar(b0.dot(u0))).normalize();
  arms.push({L1:el.position.length(),L2:wr.position.length(),u0,b0});}
 return body.motionRest={legs,pelvis,arms};
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
  if(airborne>0){const tuck=jumpLegs(arms,ctx.family,s);sol={hip:sol.hip+(tuck.hip-sol.hip)*airborne,knee:sol.knee+(tuck.knee-sol.knee)*airborne,toe:tuck.toe};}
  const abduct=(s==='L'?1:-1)*m.wide+Math.asin(Math.max(-.6,Math.min(.6,side/drop)));
  hipBone.rotation.set(sol.hip,0,abduct);knee.rotation.set(sol.knee,0,0);
  ankle.rotation.set(-(sol.hip+sol.knee)*(1-airborne)+(sol.toe||0)*airborne,0,-abduct*(1-airborne));   // flat on the floor; toes point in the air
 }
 // torso: lean into the run, shoulders counter-twist against the hips
 b.spine.rotation.set(m.lean*.55,ctx.motion?Math.sin(m.phase)*.12*run:0,m.sway*.025);
 b.chest.rotation.set(m.lean*.35,ctx.motion?Math.sin(m.phase)*.08*run:0,0);
 animateArms(player,pose,ctx,m,R,run,dt);
 // head: turn toward the ball (limited), eyes level against the torso lean
 if(b.head){let yaw=0;if(ctx.ball){const dx=ctx.ball.x-here.x,dz=ctx.ball.z-here.z;if(dx*dx+dz*dz>.04){yaw=Math.atan2(dx,dz)-player.rotation.y;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));yaw=Math.max(-1,Math.min(1,yaw));}}
  m.headYaw=damp(m.headYaw,yaw,5,dt);b.head.rotation.set(-m.lean*.6,m.headYaw*.7,0);if(b.neck)b.neck.rotation.set(0,m.headYaw*.3,0);}
}

/* Leg shape in the air, by move: jump shooters keep the legs long with toes pointed; on drives and dunks the lead knee drives
   up and the trail leg folds back; blocks and rebounds tuck both knees. */
function jumpLegs(arms,family,side){
 if(arms==='shoot'&&['drive','dunk','roll','floater'].includes(family))return side==='R'?{hip:-1.25,knee:1.5,toe:.35}:{hip:.12,knee:.6,toe:.6};
 if(arms==='shoot'||arms==='hook')return {hip:-.12,knee:.28,toe:.65};
 return {hip:-.42,knee:.8,toe:.45};
}

/* Arms for the athletes (the classic figure keeps the Arena's own arm poses). Each arm eases toward the pose for the play
   situation; the ball handler's hands reach the ball with arm IK: one hand on top while dribbling, both hands while
   holding, gathering and shooting. When the ball leaves (a shot or pass), the IK fades and the follow-through takes over. */
function animateArms(player,pose,ctx,m,R,run,dt){
 const u=player.userData,b=u.body.bones,chest=b.chest;if(!chest)return;
 let arms=pose.arms||'relax';if(arms==='run')arms='relax';
 m.high??=(u.slot??0)%2;m.arm??=[[0,.1,-.25],[0,.1,-.25]];m.ik??=[0,0];m.ikT??=[null,null];
 const t=ctx.motion?m.t:0;
 // where the ball is relative to this player, and which hands should be on it
 const ball=ctx.ball,holder=!!ctx.holder&&!!ball,yaw=player.rotation.y,fw=_v.set(Math.sin(yaw),0,Math.cos(yaw)).clone(),left=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const r=ctx.ballRadius||.13,up=new THREE.Vector3(0,1,0);let normals=[null,null];
 if(holder){
  if(arms==='dribble'){const j=ball.clone().sub(player.position).dot(left)>0?1:0;normals[j]=up.clone();}
  else if(arms==='shoot'||arms==='hook'){normals[0]=fw.clone().negate().multiplyScalar(.75).add(up.clone().multiplyScalar(-.35)).add(left.clone().multiplyScalar(-.3)).normalize();if(arms==='shoot')normals[1]=left.clone();}
  else{normals[0]=left.clone().negate();normals[1]=left.clone();}
 }
 u.arms.forEach((a,j)=>{
  const rest=R.arms[j],side=j?1:-1;
  let [x,z,e]=(ARM[arms]||ARM.relax)(j,m,t);
  if(arms==='relax'){x=ctx.motion?-Math.sin(m.phase+(j?Math.PI:0))*.55*run:0;z=.1+.08*m.crouch*4;e=-.25-.6*run;}
  const st=m.arm[j];st[0]=damp(st[0],x,10,dt);st[1]=damp(st[1],z,9,dt);st[2]=damp(st[2],e,10,dt);
  a.rotation.set(st[0],0,side*st[1]);a.userData.elbow.rotation.set(st[2],0,0);
  // hand on the ball
  const n=normals[j];let want=0,T=null;const S=a.position;
  if(n&&rest){chest.updateWorldMatrix(true,false);T=chest.worldToLocal(ball.clone().add(n.clone().multiplyScalar(r+.07)));if(T.distanceTo(S)<(rest.L1+rest.L2)*1.2){want=1;m.ikT[j]=T.clone();}}
  m.ik[j]=damp(m.ik[j],want,want?14:7,dt);
  if(!want)T=m.ikT[j];   // the ball just left the hand: ease out from where it was
  if(rest&&T&&m.ik[j]>.01){{const pole=T.y>S.y+.1?new THREE.Vector3(side*.45,-.1,1):new THREE.Vector3(side*.6,-.25,-1);
    const sol=solveArm(S,T,rest.L1,rest.L2,pole.normalize());
    if(sol){quatFrom(rest.u0,rest.b0,sol.u,sol.b,_q);a.quaternion.slerp(_q,m.ik[j]);const el=a.userData.elbow.rotation;el.x=el.x+(-sol.bend-el.x)*m.ik[j];}}
  }
 });
}
