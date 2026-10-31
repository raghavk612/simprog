import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {seatLayout,fanBoxes,CAMERA_CLEAR} from '../src/seating.js';
import {CAMERAS,LENS} from '../src/director.js';
import {titlePath,titleCamera,flyIn,SWEEP} from '../src/title.js';
const L=seatLayout(),box=([w,h,d,x,y,z])=>new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2));
const solids=l=>[...l.risers.map(box),...l.rails.map(box),...l.seats.flatMap(s=>fanBoxes(s).map(box))],ends=l=>solids(l).filter(b=>Math.abs(b.min.x+b.max.x)/2>16); // ends: the baseline stands' pieces
// Footprints [x0,x1,z0,z1] of what already stands around the court, read off src/arena.js build()/addDetails()/importModels().
const PROPS={'+x stanchion pad':[14.45,15.45,-.75,.75],'-x stanchion pad':[-15.45,-14.45,-.75,.75],'ball rack':[-17.05,-14.95,5.62,6.38],'cones':[-17.18,-16.82,-3.18,.78],'wall bars':[-19.47,-19.37,-5.85,-4.15],
 'office carpet + furniture':[13.7,18.9,-15.7,-11.1],'locker door + cabinets':[-19.3,-13.6,-16,-15],'scorer\'s table':[-2.5,2.5,9.4,10.1],'home bench':[-10.1,-4.1,9.2,10.1],'visitor bench':[3.9,9.9,9.2,10.1],'court floor':[-16,16,-10,10]};
test('seating: about 5% of sideline seats are empty, the two aisles stay clear',()=>{
 const side=L.slots.filter(s=>s.axis==='z'),aisle=side.filter(s=>s.aisle),rest=side.filter(s=>!s.aisle),empty=rest.filter(s=>!s.taken).length/rest.length;
 assert.equal(side.length,2*6*40);assert.ok(aisle.length===2*6*2&&aisle.every(s=>!s.taken),'aisles stay empty');assert.ok(empty>.02&&empty<.08,`empty share ${empty.toFixed(3)}`);
});
test('seating: rows of fans behind both baselines, rising away from the court and facing it',()=>{
 for(const side of [1,-1]){const end=L.seats.filter(s=>s.x*side>16);assert.ok(end.length>=40,`${end.length} fans behind the ${side>0?'+':'-'}x baseline`);
  for(const s of end){assert.ok(Math.abs(s.x)>=16.1&&Math.abs(s.x)<19.5&&Math.abs(s.z)<10);const k=(Math.abs(s.x)-16.1)/.85|0;assert.ok(Math.abs(s.y-(k+1)*.5)<1e-9,'row height rises with distance');}}
 for(const s of L.seats){const f=[Math.sin(s.ry),Math.cos(s.ry)],toCourt=[-s.x,-s.z],len=Math.hypot(...toCourt);assert.ok((f[0]*toCourt[0]+f[1]*toCourt[1])/len>.5,`fan at ${s.x.toFixed(1)},${s.z.toFixed(1)} faces the court`);}
});
test('seating: no riser, rail or fan overlaps a prop, the court or the walls; the baseline stands stay below the wall bars and end-wall sign',()=>{
 for(const b of ends(L))assert.ok(b.max.y<3.1,'below the wall bars (3.2) and the end-wall sign (5.5)');
 for(const b of solids(L)){assert.ok(b.max.x<=19.5+1e-9&&b.min.x>=-19.5-1e-9&&b.max.z<=16+1e-9&&b.min.z>=-16-1e-9,'inside the walls');
  for(const [name,[x0,x1,z0,z1]] of Object.entries(PROPS))assert.ok(b.max.x<=x0||b.min.x>=x1||b.max.z<=z0||b.min.z>=z1,`stand piece at x ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}, z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)} overlaps the ${name}`);}
});
const view=(position,target,fov,aspect)=>{const c=new THREE.PerspectiveCamera(fov,aspect,.1,220);c.position.set(...position);c.lookAt(...target);c.updateMatrixWorld();return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));};
test('seating: the end-zone camera never has the stand it looks over in shot (fans behind the far hoop are its backdrop); the office and locker cameras never see a baseline stand',()=>{
 const all=ends(L),shots=[...[1,-1].map(dir=>['baseline '+dir,[CAMERAS.baseline.position[0]*dir,...CAMERAS.baseline.position.slice(1)],[CAMERAS.baseline.target[0]*dir,...CAMERAS.baseline.target.slice(1)],LENS.baseline,all.filter(b=>b.max.x*dir<0)]),['office',[18.6,4.4,-6],[15.6,1,-13.2],43,all],['locker',[-9,5.5,-6],[-15.5,1.4,-15],43,all]];
 for(const [name,p,t,fov,pieces] of shots)for(const [aspect,f] of [[16/9,fov],[2.4,fov],[.56,fov===43?65:fov*1.5]]){const fr=view(p,t,f,aspect),hit=pieces.find(b=>fr.intersectsBox(b));assert.ok(!hit,`${name} at aspect ${aspect.toFixed(2)} sees stand piece at ${hit&&[hit.min.x,hit.min.y,hit.min.z].map(v=>v.toFixed(2))}`);}
});
test('seating: seats on the title jib and fly-in path are left empty so no fan fills the lens',()=>{
 // checked against a much denser sampling than titlePath() (the jib every 0.05 s, the fly-in from 48 points), with 0.3 of the clearance spared for the gaps between its samples
 const dense=[...[...Array(1201)].map((_,i)=>titleCamera(i*SWEEP/1200).position),...[...Array(48)].flatMap((_,k)=>[...Array(81)].map((_,i)=>flyIn(i/80,titleCamera(k*SWEEP/48)).position))].map(p=>new THREE.Vector3(...p)),
  near=(l,r)=>l.seats.filter(s=>fanBoxes(s).some(b=>{const bb=box(b);return dense.some(p=>bb.distanceToPoint(p)<r);}));
 assert.ok(near(L,CAMERA_CLEAR-.3).length>0,'without the clearance some fans would sit on the camera path');
 const clear=seatLayout(titlePath());assert.deepEqual(near(clear,CAMERA_CLEAR-.3).map(s=>s.n),[]);assert.ok(clear.seats.length>L.seats.length-40,`only the seats on the path are left empty (${L.seats.length-clear.seats.length})`);
});
