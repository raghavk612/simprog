// Shared, deterministic basketball presentation. No rendering or wall-clock RNG here.
export const CLIP_SECONDS=3.6;
export const SHOTS={
 catch:{label:'Catch-and-shoot three',three:true,base:-.035,finish:[4.2,5.5],arc:3.8},
 pullup:{label:'Pull-up jumper',three:false,base:.015,finish:[7,2.7],arc:3},
 stepback:{label:'Step-back three',three:true,base:-.075,finish:[3.8,3.8],arc:4},
 drive:{label:'Crossover layup',three:false,base:.13,finish:[11.5,1],arc:1},
 floater:{label:'Running floater',three:false,base:.045,finish:[9.5,1.8],arc:2.3},
 hook:{label:'Post hook',three:false,base:.055,finish:[10,1.8],arc:2.1},
 dunk:{label:'Fast-break dunk',three:false,base:.20,finish:[12,0],arc:.25},
 roll:{label:'Pick-and-roll finish',three:false,base:.11,finish:[11.2,.8],arc:1.2}
};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*clamp(t);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
function path(points,t){const n=points.length-1,p=clamp(t)*n,i=Math.min(n-1,Math.floor(p)),u=smooth(p-i);return [lerp(points[i][0],points[i+1][0],u),lerp(points[i][1],points[i+1][1],u)];}
export function choosePlay(rng,tactic,pace,last){
 const bag=tactic==='perimeter'?['catch','catch','stepback','pullup','drive','roll']:pace==='fast'?['dunk','drive','roll','catch','floater','pullup']:['catch','pullup','stepback','drive','floater','hook','roll'];
 let kind=bag[Math.floor(rng()*bag.length)];if(kind===last)kind=bag[(bag.indexOf(kind)+1+Math.floor(rng()*(bag.length-1)))%bag.length];return kind;
}
export function describePlay(c,rng){
 const pick=arr=>arr[Math.floor(rng()*arr.length)],name=c.player,def=c.defender,helper=c.helper;
 const lead={catch:[`${helper} swings it to ${name} on the ${c.lane>0?'right':'left'} wing.`,`${name} relocates off the ball; ${helper} finds the open window.`],pullup:[`${name} stops on a dime at the elbow.`,`${name} uses a hesitation dribble and rises from midrange.`],stepback:[`${name} crosses over, then steps back beyond the arc.`,`${name} sells the drive and creates space with a step-back.`],drive:[`${name} changes hands and slips past ${def}.`,`${name} attacks the gap with a crossover.`],floater:[`${name} snakes into the lane and lofts a floater.`,`${name} avoids the help defender with a high runner.`],hook:[`${name} backs into the post and turns over the shoulder.`,`${name} seals the defender on the low block.`],dunk:[`${name} sprints ahead of the retreating defense.`,`${helper} pushes the outlet to ${name} in transition.`],roll:[`${helper} sets the screen; ${name} turns the corner.`,`${name} uses ${helper}’s screen and cuts hard to the rim.`]}[c.kind];
 if(c.outcome==='steal')return pick([`${def} times the reach and strips ${name}. Turnover.`,`${def} pokes the ball loose from ${name} and takes possession.`]);
 if(c.outcome==='block')return `${pick(lead)} ${pick([`${def} meets the shot at its release—blocked!`,`${def} rotates across and swats it away.`])} ${c.rebounder} collects the loose ball.`;
 const finish=c.points?pick(c.three?['Three-pointer—nothing but net.','The three drops.','Buries it from deep.']:c.kind==='dunk'?['Two hands above the rim—slam!','Finishes with a dunk.']:['Soft touch, two points.','Drops through the net.','Gets it to fall.']):pick(['Off the rim.','The shot will not fall.','The shot rolls out.']);
 return `${pick(lead)} ${finish}${c.points?(c.assisted?` Assist: ${helper}.`:''):` ${c.rebounder} secures the rebound.`}`;
}
// Sample any point in a recorded clip. Same clip + time always gives the same pose.
// Coordinates are mirrored for the visitors, so both baskets are used.
export function sampleClip(c,time){
 const t=clamp(time/CLIP_SECONDS),side=c.team==='home'?1:-1,lane=c.lane||1,spec=SHOTS[c.kind]||SHOTS.pullup;
 const end=[spec.finish[0],spec.finish[1]*lane],start=[c.kind==='dunk'?-8:2.2,4.7*lane];
 const route=c.kind==='stepback'?[start,[6,2.5*lane],[7,2*lane],end]:c.kind==='hook'?[[8,3*lane],[9.8,2.8*lane],[10.5,1.5*lane],end]:c.kind==='catch'?[[4,6.5*lane],[2,6*lane],end]:c.kind==='dunk'?[start,[-2,2.5*lane],[6,1.4*lane],end]:[start,[5,4.6*lane],[6.6,1.5*lane],[8.2,3*lane],end];
 const movement=smooth(t/.5),at=path(route,movement),gather=clamp((t-.43)/.14),jump=(t>=.48&&t<=.78)?Math.sin((t-.48)/.30*Math.PI)*(c.kind==='dunk'?1.2:c.kind==='drive'||c.kind==='roll'?.65:.8):0;
 const offense=c.team==='home'?0:5,defense=c.team==='home'?5:0;
 const actors=Array.from({length:10},(_,i)=>{const k=i%5;const off=i>=offense&&i<offense+5;const base=[[2,4.7],[3,-5.5],[8,5.7],[9,-4.4],[6,0]][k];return {x:(base[0]+(off?Math.sin(t*3+k)*.7:.9))*side,y:0,z:base[1]+(off?0:.8),yaw:side*Math.PI/2,run:off?.35:.25,arms:off?'run':'defend',jump:0};});
 const shooter=actors[offense],marker=actors[defense];Object.assign(shooter,{x:at[0]*side,y:jump,z:at[1],run:t<.48?1:0,arms:t<.43?'dribble':t<.8?(c.kind==='hook'?'hook':'shoot'):'relax',yaw:Math.atan2((12.15-at[0])*side,-at[1])});
 const separation=c.contest==='open'?1.9:c.contest==='tight'?.45:1;
 marker.x=(at[0]+separation)*side;marker.z=at[1]+.5*lane;marker.yaw=-side*Math.PI/2;marker.run=t<.5?.85:.1;
 const defenseJump=t>=.5&&t<=.81?Math.sin((t-.5)/.31*Math.PI)*(c.outcome==='block'?1.05:c.contest==='open'?.22:.7):0;marker.y=defenseJump;marker.arms=t>.48&&t<.82?'block':'defend';
 if(c.kind==='drive'||c.kind==='floater'||c.kind==='roll'){marker.z+=Math.sin(t*12)*.7;marker.x-=Math.sin(t*Math.PI)*side*.6;}
 // A second defender slides from the weak side to help at the basket.
 const help=actors[defense+2];help.x=lerp(9,11,t)*side;help.z=lerp(-4*lane,-.9*lane,smooth(t/.6));help.arms=t>.48&&t<.8?'block':'defend';help.y=defenseJump*.6;
 const screen=actors[offense+1];if(c.kind==='roll'){screen.x=5.8*side;screen.z=3*lane;screen.run=0;screen.arms='screen';}
 // Off-ball cuts and closeouts: players do not just oscillate in place.
 actors[offense+2].x=lerp(4,10,smooth(t))*side;actors[offense+2].z=lerp(-5,3,smooth(t))*lane;
 actors[defense+3].x=lerp(9,5,t)*side;actors[defense+3].z=-5*lane;
 let ball={x:shooter.x+.38*side,y:.3+Math.abs(Math.sin(t*45))*.95,z:shooter.z+.15};
 if(c.kind==='catch'&&t<.3){const q=smooth(t/.3);ball={x:lerp(3,at[0],q)*side,y:1.4+Math.sin(q*Math.PI)*.35,z:lerp(-5.5,at[1],q)};screen.arms='pass';}
 if(c.kind==='dunk'&&t<.2){screen.x=-10*side;screen.z=3*lane;screen.arms='pass';const q=smooth(t/.2);ball={x:lerp(-10,at[0],q)*side,y:1.6+Math.sin(q*Math.PI)*.7,z:lerp(3*lane,at[1],q)};}
 if(t>=.43&&t<.61){ball={x:shooter.x+.28*side,y:lerp(1.2,2.3,gather)+jump,z:shooter.z};}
 const release={x:end[0]*side,y:2.3+Math.sin((.61-.48)/.3*Math.PI)*(c.kind==='dunk'?1.2:.8),z:end[1]};
 if(t>=.61){const q=clamp((t-.61)/.25);ball={x:lerp(release.x,12.15*side,q),y:lerp(release.y,3.28,q)+Math.sin(q*Math.PI)*spec.arc,z:lerp(release.z,0,q)};}
 if(t>.86){const q=clamp((t-.86)/.14);ball=c.points?{x:12.15*side,y:lerp(3.28,.3,q),z:0}:{x:lerp(12.15,9,q)*side,y:3.28-Math.sin(q*Math.PI/2)*1.8,z:lerp(0,-2*lane,q)};}
 if(c.outcome==='block'&&t>.65){const q=clamp((t-.65)/.35);ball={x:lerp(end[0]+.4,7,q)*side,y:lerp(3.3,.3,q)+Math.sin(q*Math.PI)*.5,z:lerp(end[1],-3*lane,q)};marker.x=(end[0]+.4)*side;marker.z=end[1];}
 if(c.outcome==='steal'&&t>.32){const q=clamp((t-.32)/.68);marker.x=lerp(at[0]+.4,-3,q)*side;marker.z=lerp(at[1],-2*lane,q);marker.y=0;marker.run=1;marker.arms='dribble';shooter.y=0;shooter.arms='defend';ball={x:marker.x-.35*side,y:.3+Math.abs(Math.sin(t*45))*.9,z:marker.z};}
 const rebounder=actors[defense+(c.team==='home'?4:0)];if(!c.points&&c.outcome!=='steal'&&t>.84){rebounder.x=ball.x;rebounder.z=ball.z;rebounder.arms='rebound';if(t>.96)ball.y=1.6;}
 return {actors,ball,phase:t<.43?(c.kind==='catch'?'Pass & relocate':'Attack & dribble'):t<.61?'Gather & contest':t<.86?(c.outcome==='block'?'Shot blocked':c.outcome==='steal'?'Turnover':'Shot in flight'):c.points?'Basket':'Rebound',resolved:t>=.86,net:c.points&&t>.86?Math.sin((t-.86)*Math.PI/.14)*.12:0};
}
