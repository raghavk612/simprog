import test from 'node:test';import assert from 'node:assert/strict';
import {titleMatchup,titleCamera,flyIn,heroYaw,titleFov,SWEEP,STILL,HERO,END} from '../src/title.js';

const games=[{opponent:'Bothell',date:'12/1/2026'},{opponent:'Skyline',date:'12/4/2026'},{opponent:'Liberty',date:'12/8/2026'}];
const data={levels:{jv:{games},c:{games:[{opponent:'Redmond',date:'12/5/2026'}]},varsity:{games:[]}}};
const save=(o={})=>({schedule:games,week:1,wins:1,losses:0,finished:false,results:[{opponent:'Bothell'}],...o});

test('a mid-season save shows the next opponent with the real record',()=>{
 assert.deepEqual(titleMatchup(save(),data),{opponent:'Skyline',game:2,games:3,wins:1,losses:0,date:'12/4/2026',continuing:true});
});
test('a finished save shows the last result as the final game',()=>{
 const m=titleMatchup(save({finished:true,week:3,wins:2,losses:1,results:[{opponent:'Bothell'},{opponent:'Skyline'},{opponent:'Liberty'}]}),data);
 assert.equal(m.opponent,'Liberty');assert.equal(m.game,3);assert.equal(m.games,3);assert.equal(m.wins,2);assert.equal(m.losses,1);assert.equal(m.continuing,true);
});
test('no save uses the first real game of the chosen difficulty at 0-0',()=>{
 assert.deepEqual(titleMatchup(null,data),{opponent:'Bothell',game:1,games:3,wins:0,losses:0,date:'12/1/2026',continuing:false});
 assert.equal(titleMatchup(undefined,data,'rookie').opponent,'Redmond');
 assert.equal(titleMatchup(null,data,'elite').opponent,null);
});

test('the title camera drifts along the near sideline (azimuth -25..+5deg), aimed 4 m left of the hero and up toward the board, and never leaves the gym',()=>{
 assert.equal(SWEEP,60);
 let minAz=Infinity,maxAz=-Infinity;
 for(let t=0;t<=SWEEP;t+=.25){
  const {position:[x,y,z],target:[tx,ty,tz]}=titleCamera(t);
  assert.ok(z>9.6&&z<15,`z ${z} at ${t}`);assert.ok(Math.abs(x)<18,`x ${x} at ${t}`);assert.ok(y>2.5&&y<5,`y ${y} at ${t}`);
  assert.deepEqual([tx,ty,tz],[HERO.x*.5-4,3.2,HERO.z*.5]);
  const az=Math.atan2(x-tx,z-tz)*180/Math.PI;minAz=Math.min(minAz,az);maxAz=Math.max(maxAz,az);
  assert.ok(Math.abs(Math.hypot(x-tx,z-tz)-13)<1e-9,'horizontal distance 13');
 }
 assert.ok(minAz<-24.9&&maxAz>4.9&&minAz>=-25.0001&&maxAz<=5.0001,`azimuth ${minAz}..${maxAz}`);
});
test('the title camera is periodic',()=>{
 const a=titleCamera(0),b=titleCamera(SWEEP);
 a.position.forEach((v,i)=>assert.ok(Math.abs(v-b.position[i])<1e-9));a.target.forEach((v,i)=>assert.ok(Math.abs(v-b.target[i])<1e-9));
 const c=titleCamera(7),d=titleCamera(7+SWEEP);c.position.forEach((v,i)=>assert.ok(Math.abs(v-d.position[i])<1e-9));
});

test('the title lens is long (38deg) on wide screens, 65deg on tall ones, and eases to the broadcast 43deg during the fly-in',()=>{
 assert.equal(titleFov(16/10),38);assert.equal(titleFov(16/9,0),38);assert.equal(titleFov(.79),65);assert.equal(titleFov(.5,.6),65);
 assert.equal(titleFov(1.6,1),43);assert.equal(titleFov(1.6,7),43);assert.equal(titleFov(1.6,-1),38);
 assert.ok(Math.abs(titleFov(1.6,.5)-40.5)<1e-9,'halfway');assert.ok(titleFov(1.6,.25)<38+5*.25,'smoothstep, like the camera move');
});

// Pinhole projection of a world point for a camera at `position` looking at `target` (y up): normalised device coords, x and y in -1..1 when on screen.
const ndc=({position,target},fov,aspect,[px,py,pz])=>{const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
 const f=unit(sub(target,position)),r=unit(cross(f,[0,1,0])),u=cross(r,f),d=sub([px,py,pz],position),k=Math.tan(fov*Math.PI/360),z=dot(d,f);return [dot(d,r)/(z*k*aspect),dot(d,u)/(z*k)];};
test('at 1440x900 the whole sweep holds the hero right of centre with his feet in frame, and the scoreboard (12 x 4.5 at 0, 8.2, -11) with its team names',()=>{
 const a=1440/900,fov=titleFov(a);
 for(let t=0;t<=SWEEP;t+=.25){const s=titleCamera(t),[hx]=ndc(s,fov,a,[HERO.x,1.2,HERO.z]),[,fy]=ndc(s,fov,a,[HERO.x,0,HERO.z]),[lx,ly]=ndc(s,fov,a,[-6,9.81,-11]),[rx,ry]=ndc(s,fov,a,[6,9.81,-11]),[,by]=ndc(s,fov,a,[0,5.95,-11]);
  assert.ok(hx>.1,`hero right of centre at ${t}: ${hx}`);assert.ok(fy>-.9,`feet clear of the bottom bar at ${t}: ${fy}`);
  assert.ok(lx>-.45&&rx<1,`board across the frame, right of the menu, at ${t}: ${lx}..${rx}`);assert.ok(Math.max(ly,ry)<.9&&by>-1,`team names (centre line, y 9.81) clear of the 4vh top bar at ${t}: ${ly} ${ry}`);}
});
test('the reduced-motion still is the sweep moment that holds the hero furthest right',()=>{
 const a=1440/900,fov=titleFov(a),x=t=>ndc(titleCamera(t),fov,a,[HERO.x,1.2,HERO.z])[0];
 assert.ok(STILL>=0&&STILL<SWEEP);for(let t=0;t<SWEEP;t+=.25)assert.ok(x(STILL)>=x(t)-1e-9,`${t} beats the still`);
});

test('flyIn eases from the title shot to the broadcast end shot and clamps',()=>{
 const from=titleCamera(12.5);
 assert.deepEqual(flyIn(0,from),from);assert.deepEqual(flyIn(1,from),END);
 assert.deepEqual(flyIn(-3,from),from);assert.deepEqual(flyIn(9,from),END);
 assert.deepEqual(END,{position:[0,7.5,15.5],target:[0,1,0]});
 const mid=flyIn(.5,from);mid.position.forEach((v,i)=>assert.ok(Math.abs(v-(from.position[i]+END.position[i])/2)<1e-9));
 const q=flyIn(.25,from);assert.ok(q.position[1]!==from.position[1]+(END.position[1]-from.position[1])*.25,'smoothstep, not linear');
});

test('the title hero faces the middle of the camera sweep',()=>{
 const yaw=heroYaw(),[cx,,cz]=titleCamera(0).position,fx=Math.sin(yaw),fz=Math.cos(yaw),tx=cx-HERO.x,tz=cz-HERO.z;
 assert.ok(Math.abs(yaw)<Math.PI/2,'faces the near (+z) sideline');
 assert.ok(Math.abs(fx*tz-fz*tx)<1e-9&&fx*tx+fz*tz>0,'facing points at the camera');
 assert.equal(heroYaw(),yaw,'a constant: he never swivels with the sweep');
});
