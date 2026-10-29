import test from 'node:test';import assert from 'node:assert/strict';
import {solveLeg,ankleOf,strideFor,footAt} from '../src/motion.js';
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
test('leg IK: the solved hip and knee put the ankle exactly on the target, knee bending backward',()=>{
 for(const [f,d] of [[0,.9],[.2,.85],[-.25,.8],[.4,.7],[0,.6],[-.1,.95]]){
  const s=solveLeg(.5,.48,f,d),a=ankleOf(.5,.48,s.hip,s.knee);
  assert.ok(near(a.forward,f,1e-6)&&near(a.drop,d,1e-6),`target ${f},${d} -> ${a.forward},${a.drop}`);
  assert.ok(s.knee>=0,'knees never bend the wrong way');
 }
 const straight=solveLeg(.5,.48,0,.98);assert.ok(straight.knee<.03&&Math.abs(straight.hip)<.03,'a full-length target leaves the leg straight');
 const far=solveLeg(.5,.48,0,2);assert.ok(far.knee<.02,'out of reach: leg straight, no NaN');assert.ok(Number.isFinite(far.hip));
});
test('stride: planted feet move back exactly as far as the body moves forward, so they do not slide',()=>{
 const L=strideFor(4);assert.ok(L>strideFor(1)&&L<=1.5);
 // phase advances by π per stride length travelled; during stance the foot moves back by the same distance
 const dist=L*.3,ph0=.4,ph1=ph0+dist/L*Math.PI;
 assert.ok(near(footAt(ph0,L,.1).forward-footAt(ph1,L,.1).forward,dist,1e-9));
 assert.equal(footAt(ph0,L,.1).up,0,'planted feet stay on the floor');
 const swing=footAt(Math.PI*1.5,L,.1);assert.ok(swing.up>.09,'the swing foot lifts');
 assert.ok(near(footAt(Math.PI-1e-9,L,.1).forward,-L/2,1e-6)&&near(footAt(Math.PI*2-1e-9,L,.1).forward,L/2,1e-6),'the swing ends where the next stance starts');
});
test('arm IK: the wrist lands on the target, the elbow bends toward the pole, out-of-reach targets give a straight arm',async()=>{
 const THREE=await import('three');const {solveArm}=await import('../src/motion.js');
 const S=new THREE.Vector3(.2,1.5,0),L1=.32,L2=.3;
 for(const [T,pole] of [[new THREE.Vector3(.3,1.9,.35),new THREE.Vector3(.4,-.1,1)],[new THREE.Vector3(.35,1.1,.25),new THREE.Vector3(.5,-.3,-1)],[new THREE.Vector3(.2,2.05,.1),new THREE.Vector3(0,0,1)]]){
  const r=solveArm(S,T,L1,L2,pole.clone().normalize());
  const wrist=r.elbow.clone().add(r.b.clone().multiplyScalar(Math.sin(r.bend)*L2)).add(r.u.clone().multiplyScalar(Math.cos(r.bend)*L2));
  assert.ok(wrist.distanceTo(T)<1e-4,`wrist ${wrist.toArray()} vs ${T.toArray()}`);
  const mid=S.clone().lerp(T,.5),toElbow=r.elbow.clone().sub(mid);assert.ok(toElbow.dot(pole)>0||r.bend<.05,'elbow on the pole side');
 }
 const far=solveArm(S,new THREE.Vector3(.2,3,0),L1,L2,new THREE.Vector3(0,0,1));assert.ok(far.bend<.02&&Number.isFinite(far.u.x),'straight, no NaN');
 assert.equal(solveArm(S,S.clone(),L1,L2,new THREE.Vector3(0,0,1)),null);
});
