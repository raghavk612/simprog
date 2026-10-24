// The coach's inbox: mid-season events that need a decision. Pure game logic (no page code), so it can be tested on its own.
// Roughly one game in three ends with an event; none before the second game, none twice in a row, and each choice shows what it does before it is made.
import {cap,log,hashStr,eligible,addMods,addWalkOn,captainCalm} from './engine.js';
import en from './i18n/locales/en.js';

const WALKON_NAMES=['Eli Navarro','Marcus Bell','Theo Park','Jonah Reyes','Isaiah Cole','Devin Okafor','Caleb Ross','Nico Alvarez','Owen Tran','Mateo Silva','Ravi Patel','Hudson Clark'];
const byHash=(list,h)=>list[h%list.length];
const starters=s=>s.players.filter(p=>p.starter);
const lowest=(list,key)=>list.reduce((b,p)=>!b||p[key]<b[key]||(p[key]===b[key]&&p.id<b.id)?p:b,null);
const open=s=>s.players.length<15;
const freeNames=s=>WALKON_NAMES.filter(n=>!s.players.some(p=>p.name===n));
const name=(s,id)=>s.players.find(p=>p.id===id)?.name??'';

/* Every event: when it can happen, what it needs to know (params, picked from the roster by hash), and its options. An option's effects say exactly what will change:
   team/player: per-player deltas (morale, energy, skill, gpa, injury); tokens, fans, chemistry; mods: next-game modifiers; roster: a new fictional player. */
export const EVENTS=[
 {id:'walkon',weight:3,icon:'recruit',when:s=>open(s)&&s.tokens>=120&&freeNames(s).length>0,params:(s,h)=>({name:byHash(freeNames(s),h),cost:120}),
  options:[{id:'sign',eff:(s,p)=>({tokens:-p.cost,roster:{name:p.name,skill:62}}),ok:(s,p)=>open(s)&&s.tokens>=p.cost},{id:'pass',eff:()=>({})}]},
 {id:'transfer',weight:2,icon:'recruit',when:s=>open(s)&&s.results.length>=3&&freeNames(s).length>0,params:(s,h)=>({name:byHash(freeNames(s).reverse(),h)}),
  options:[{id:'accept',eff:(s,p)=>({roster:{name:p.name,skill:68},chemistry:-3}),ok:s=>open(s)},{id:'decline',eff:()=>({})}]},
 {id:'recruiter',weight:2,icon:'staff',when:s=>starters(s).length>0,params:(s,h)=>{const p=byHash(starters(s),h);return {pid:p.id,name:p.name};},
  options:[{id:'minutes',eff:(s,p)=>({player:{morale:8}})},{id:'decide',eff:(s,p)=>({player:{morale:-6}})},{id:'parents',eff:(s,p)=>({tokens:-60,player:{morale:10}}),ok:s=>s.tokens>=60}]},
 {id:'bench',weight:3,icon:'staff',when:s=>s.players.some(p=>p.minutes===0&&p.morale<70),params:(s,h)=>{const c=s.players.filter(p=>p.minutes===0&&p.morale<70);const p=byHash(c,h);return {pid:p.id,name:p.name};},
  options:[{id:'promise',eff:()=>({player:{morale:10},chemistry:-1})},{id:'explain',eff:()=>({player:{morale:4}})},{id:'ignore',eff:()=>({player:{morale:-6},chemistry:-1})}]},
 {id:'shots',weight:2,icon:'ball',when:s=>starters(s).length>0,params:(s,h)=>{const p=byHash(starters(s),h);return {pid:p.id,name:p.name};},
  options:[{id:'plays',eff:()=>({player:{morale:6},mods:{offense:2},chemistry:-2})},{id:'team',eff:()=>({chemistry:3,player:{morale:-2}})}]},
 {id:'feud',weight:2,icon:'staff',when:s=>s.players.filter(p=>p.morale<65).length>=2,params:(s,h)=>{const lo=[...s.players].sort((a,b)=>a.morale-b.morale||a.id-b.id).slice(0,2);return {pid:lo[0].id,name:lo[0].name,name2:lo[1].name};},
  options:[{id:'meeting',eff:()=>({chemistry:3,team:{energy:-3}})},{id:'bench',eff:()=>({team:{morale:-2},chemistry:2})},{id:'captain',eff:s=>{const c=s.players.find(p=>p.id===s.captain);return {chemistry:c&&c.morale>=60?4:1};},ok:s=>s.captain!=null}]},
 {id:'grades',weight:3,icon:'film',when:s=>s.players.some(p=>p.gpa<2.6),params:(s)=>{const p=lowest(s.players,'gpa');return {pid:p.id,name:p.name};},
  options:[{id:'hall',eff:()=>({player:{gpa:.3},team:{energy:-3}})},{id:'tutor',eff:()=>({tokens:-80,player:{gpa:.6}}),ok:s=>s.tokens>=80}]},
 {id:'finals',weight:2,icon:'film',when:s=>s.results.length>=4,params:()=>({}),
  options:[{id:'light',eff:()=>({team:{energy:6}})},{id:'push',eff:()=>({team:{skill:1,gpa:-.15}})}]},
 {id:'booster',weight:2,icon:'staff',when:s=>s.results.length>=3,params:()=>({}),
  options:[{id:'strings',eff:()=>({tokens:200,team:{morale:-3}})},{id:'uniforms',eff:()=>({fans:60})},{id:'decline',eff:()=>({team:{morale:2}})}]},
 {id:'flu',weight:2,icon:'ball',when:s=>s.results.length>=3,params:(s,h)=>{const p=byHash(s.players,h);return {pid:p.id,name:p.name};},
  options:[{id:'rest',eff:()=>({team:{energy:8},mods:{offense:-2}})},{id:'play',eff:()=>({team:{energy:-4},player:{injury:1}})}]},
 {id:'social',weight:2,icon:'staff',when:s=>s.fans>=100,params:(s,h)=>{const p=byHash(s.players,h);return {pid:p.id,name:p.name};},
  options:[{id:'address',eff:()=>({team:{morale:3},fans:-20})},{id:'quiet',eff:()=>({fans:-30,team:{morale:-3}})}]},
 {id:'captaincall',weight:3,icon:'staff',when:s=>s.captain!=null,params:s=>({pid:s.captain,name:name(s,s.captain)}),
  options:[{id:'players',eff:s=>{const c=s.players.find(p=>p.id===s.captain);return {chemistry:c&&c.morale>=60?4:2};}},{id:'coach',eff:()=>({chemistry:2,team:{morale:1}})}]}
];
const def=id=>EVENTS.find(e=>e.id===id);
export const OPTION_IDS=Object.fromEntries(EVENTS.map(e=>[e.id,e.options.map(o=>o.id)]));

/* Rolls for an event after a game: about 1 in 3, not before the second game, never in two games in a row. Returns the pending event (also stored on the save) or null. */
export function rollEvent(s){
 if(s.finished||s.pendingEvent||s.match||s.results.length<2)return null;
 const last=s.eventLog?.at(-1);if(last&&last.week===s.week-1)return null;
 const h=hashStr(`${s.seed}|inbox|${s.week}`);if(h%100>=44)return null; // about 1 game in 3 once the no-back-to-back rule is counted
 const seen={};for(const e of s.eventLog||[])seen[e.id]=(seen[e.id]||0)+1;
 const pool=EVENTS.filter(e=>(seen[e.id]||0)<2&&e.when(s)).map(e=>({e,w:e.weight/(1+(seen[e.id]||0))}));if(!pool.length)return null;
 let x=(hashStr(`${s.seed}|pick|${s.week}`)%10000)/10000*pool.reduce((a,b)=>a+b.w,0),chosen=pool.at(-1).e;for(const c of pool){x-=c.w;if(x<=0){chosen=c.e;break;}}
 s.pendingEvent={id:chosen.id,params:chosen.params(s,hashStr(`${s.seed}|who|${s.week}`))};return s.pendingEvent;
}

const KEYS=['team','player','tokens','fans','chemistry','mods','roster'];
/* What an option does, as a list of short chips: [{k:'morale',v:8,who:'team'|'<name>'}]. */
export function chips(eff,params={},s=null){
 const calm=!!s&&captainCalm(s),soft=(k,v)=>calm&&v<0&&(k==='morale'||k==='chemistry')?Math.round(v*.75*10)/10:v;
 const out=[];for(const [who,obj] of [['team',eff.team],['player',eff.player]])for(const [k,v0] of Object.entries(obj||{})){const v=soft(k,v0);if(v)out.push({k,v,who:who==='team'?'team':params.name||''});}
 for(const k of ['tokens','fans','chemistry']){const v=soft(k,eff[k]||0);if(v)out.push({k,v,who:'team'});}
 for(const [k,v] of Object.entries(eff.mods||{}))if(v)out.push({k,v,who:'next'});
 if(eff.roster)out.push({k:'roster',v:1,who:'team'});
 return out;
}
/* A pending event can go stale (its player was released, or an edited save names something that does not exist). Parameters from a save are never trusted: names come from the fixed list or the roster. Returns the usable parameters, or null. */
function usable(s,d,params){
 const p={...(params||{})};
 if(d.id==='walkon'||d.id==='transfer'){if(!WALKON_NAMES.includes(p.name)||s.players.some(x=>x.name===p.name)){const f=freeNames(s);if(!f.length)return null;p.name=f[0];}if(d.id==='walkon')p.cost=120;}
 if('pid' in p||d.id==='recruiter'||d.id==='bench'||d.id==='shots'||d.id==='grades'||d.id==='flu'||d.id==='social'||d.id==='captaincall'||d.id==='feud'){const pl=s.players.find(x=>x.id===p.pid);if(!pl)return null;p.name=pl.name;if(d.id==='feud'){const o=s.players.find(x=>x.name===p.name2);if(!o||o.id===pl.id)return null;}}
 return p;
}
export function eventStale(s){const pe=s.pendingEvent;if(!pe)return false;const d=def(pe.id);return !d||!usable(s,d,pe.params);}
export function previewOptions(s){const pe=s.pendingEvent,d=pe&&def(pe.id),params=d&&usable(s,d,pe.params);return d&&params?d.options.map(o=>({id:o.id,available:!o.ok||o.ok(s,params),chips:chips(o.eff(s,params),params,s)})):[];}

function apply(s,eff,params){
 const calm=captainCalm(s),soften=v=>calm&&v<0?Math.round(v*.75*10)/10:v;
 const bump=(p,d)=>{if(!p)return;for(const [k,v] of Object.entries(d)){if(k==='morale')p.morale=cap(p.morale+soften(v));else if(k==='energy')p.energy=cap(p.energy+v);else if(k==='skill')p.skill=Math.round(cap(p.skill+v,35,98)*10)/10;else if(k==='gpa')p.gpa=cap(p.gpa+v,0,4);else if(k==='injury')p.injury=cap(p.injury+v,0,10);}};
 if(eff.team)for(const p of s.players)bump(p,eff.team);
 if(eff.player)bump(s.players.find(p=>p.id===params.pid),eff.player);
 if(eff.tokens)s.tokens=Math.max(0,s.tokens+eff.tokens);
 if(eff.fans)s.fans=Math.max(40,s.fans+eff.fans);
 if(eff.chemistry)s.chemistry=cap(s.chemistry+soften(eff.chemistry));
 if(eff.mods)addMods(s,eff.mods);
 if(eff.roster)addWalkOn(s,eff.roster.name,eff.roster.skill);
}

/* Applies the player's choice, records it in the decision trail, the ripples and the event log, and clears the inbox. Unknown events (from an edited save) are dropped. */
export function resolveEvent(s,index){
 const pe=s.pendingEvent;if(!pe)throw Error('Nothing is waiting in the inbox.');const d=def(pe.id);
 if(!d){s.pendingEvent=null;return null;}
 const params=usable(s,d,pe.params);if(!params){s.pendingEvent=null;return null;}
 const o=d.options[index];if(!o||(o.ok&&!o.ok(s,params)))throw Error('That choice is not available.');
 const eff=o.eff(s,params),shown=chips(eff,params,s);apply(s,eff,params);
 const E=en.ev[d.id],text=`Inbox: ${E.title} → ${E.o[o.id]}`;
 log(s,text,'event',{id:d.id,choice:o.id});
 s.ripples.unshift({label:E.title,detail:text,week:s.week,k:'event',p:{id:d.id,choice:o.id}});s.ripples=s.ripples.slice(0,12);
 (s.eventLog??=[]).push({week:s.week,id:d.id,choice:o.id});s.eventLog=s.eventLog.slice(-40);
 s.pendingEvent=null;return {id:d.id,choice:o.id,chips:shown};
}
