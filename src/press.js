// The post-game press conference: three to five questions chosen from how the game went. Each answer shifts something for the next game (see addMods in engine.js).
import {cap,log,hashStr,seasonPlan,opponent,addMods} from './engine.js';
import en from './i18n/locales/en.js';

/* Answers set next-game modifiers: chem/morale/energy/fans change once at tip-off; offense/defense/oppRating are small shot-quality terms during the game.
   `player` is a one-off morale change for the game's top scorer. */
export const QUESTIONS=[
 {id:'winwhy',when:c=>c.won,answers:[{id:'team',mods:{chem:3}},{id:'effort',mods:{defense:2,morale:-3}},{id:'deflect',mods:{}}]},
 {id:'losswhy',when:c=>!c.won,answers:[{id:'own',mods:{chem:2,morale:-1}},{id:'execution',mods:{offense:1,morale:-3}},{id:'deflect',mods:{}}]},
 {id:'complacent',when:c=>c.won&&c.margin>=15,answers:[{id:'hungry',mods:{defense:1,chem:1}},{id:'bench',mods:{chem:2}},{id:'confident',mods:{fans:10,oppRating:1}}]},
 {id:'wire',when:c=>Math.abs(c.margin)<=5,answers:[{id:'composure',mods:{chem:2}},{id:'details',mods:{defense:1,morale:-2}},{id:'deflect',mods:{}}]},
 {id:'scorer',when:c=>!!c.top&&c.top.pts>=10,answers:[{id:'praise',mods:{chem:-1},player:6},{id:'team',mods:{chem:3}},{id:'deflect',mods:{}}]},
 {id:'next',when:c=>!!c.next,answers:[{id:'confident',mods:{fans:15,oppRating:2}},{id:'respect',mods:{oppRating:-1}},{id:'step',mods:{morale:1}}]},
 {id:'streakw',when:c=>c.streak>=3,answers:[{id:'routine',mods:{chem:2}},{id:'confident',mods:{fans:15,oppRating:2}},{id:'fans',mods:{fans:10}}]},
 {id:'streakl',when:c=>c.streak<=-2,answers:[{id:'rally',mods:{morale:3,chem:1}},{id:'honest',mods:{chem:2,morale:-2}},{id:'deflect',mods:{}}]},
 {id:'finalrun',when:c=>c.finalRun,answers:[{id:'focus',mods:{defense:2,morale:-2}},{id:'loose',mods:{morale:3,offense:-1}},{id:'confident',mods:{fans:15,oppRating:2}}]},
 {id:'threes',when:c=>c.threes>=7,answers:[{id:'shooters',mods:{offense:2,chem:-1}},{id:'balance',mods:{chem:2}},{id:'deflect',mods:{}}]},
 {id:'stops',when:c=>c.won&&c.oppPts<=50,answers:[{id:'defense',mods:{defense:2,morale:-2}},{id:'team',mods:{chem:3}},{id:'deflect',mods:{}}]},
 {id:'tired',when:c=>c.energy<60,answers:[{id:'rest',mods:{energy:4,offense:-1}},{id:'tough',mods:{morale:1,energy:-3}},{id:'depth',mods:{chem:1}}]},
 {id:'crowd',when:()=>true,answers:[{id:'fans',mods:{fans:10}},{id:'earn',mods:{chem:1}},{id:'deflect',mods:{}}]}
];
const q=id=>QUESTIONS.find(x=>x.id===id);
export const ANSWER_IDS=Object.fromEntries(QUESTIONS.map(x=>[x.id,x.answers.map(a=>a.id)]));

/* What happened in the game that just ended, in the terms the questions ask about. */
export function context(s){
 const r=s.results.at(-1);if(!r)return null;
 const margin=r.home-r.away;let streak=0;for(let i=s.results.length-1;i>=0&&s.results[i].won===r.won;i--)streak+=r.won?1:-1;
 let top=null;for(const [id,l] of Object.entries(r.line||{}))if(l.min>0&&(!top||l.pts>top.pts))top={id:+id,pts:l.pts,name:s.players.find(p=>p.id===+id)?.name||''};
 const lines=Object.values(r.line||{}).filter(l=>l.min>0);
 return {won:r.won,margin,streak,top,oppPts:r.away,next:s.finished||s.week>=s.schedule.length?null:opponent(s).opponent,finalRun:r.week>=seasonPlan(s).cut,threes:lines.reduce((a,l)=>a+l.tpm,0),energy:s.players.filter(p=>p.minutes>0).reduce((a,p)=>a+p.energy,0)/Math.max(1,s.players.filter(p=>p.minutes>0).length)};
}
const params=(id,c)=>({opp:c.next||'',pid:c.top?.id??-1,name:c.top?.name||'',pts:c.top?.pts||0,n:id==='threes'?c.threes:Math.abs(c.streak),oppPts:c.oppPts,margin:Math.abs(c.margin)});

/* Starts the press conference for the game that just finished: 3 questions, 4 after a close game or a streak of 3, 5 in the final run. Nothing happens once the season is over. */
export function startPress(s){
 if(s.finished||!s.results.length||s.match)return null;const c=context(s);if(!c)return null;
 const size=c.finalRun?5:(Math.abs(c.margin)<=5||Math.abs(c.streak)>=3)?4:3;
 const first=c.won?'winwhy':'losswhy',rest=QUESTIONS.filter(x=>x.id!==first&&x.id!=='crowd'&&x.when(c)).map(x=>({x,h:hashStr(`${s.seed}|press|${s.week}|${x.id}`)})).sort((a,b)=>a.h-b.h).map(o=>o.x);
 const picked=[q(first),...rest,q('crowd')].filter((x,i,a)=>a.indexOf(x)===i).slice(0,size);
 s.press={week:s.week,questions:picked.map(x=>({id:x.id,params:params(x.id,c),answer:null})),done:false};return s.press;
}
/* What an answer will do, as chips: [{k,v,who}], with the top scorer named for his morale change. */
export function answerChips(question,answer){const out=Object.entries(answer.mods||{}).filter(([,v])=>v).map(([k,v])=>({k,v,who:'next'}));if(answer.player)out.push({k:'morale',v:answer.player,who:question.params.name||''});return out;}
export function previewPress(s){return (s.press?.questions||[]).map(x=>{const d=q(x.id);return d?{id:x.id,answered:x.answer,answers:d.answers.map(a=>({id:a.id,chips:answerChips(x,a)}))}:{id:x.id,answers:[]};});}

export function answerPress(s,index,answerId){
 const p=s.press;if(!p||p.done)throw Error('Nothing is waiting in the inbox.');const x=p.questions[index];if(!x||x.answer)throw Error('That choice is not available.');
 const d=q(x.id),a=d?.answers.find(v=>v.id===answerId);if(!a)throw Error('That choice is not available.');
 addMods(s,a.mods);if(a.player){const t=s.players.find(pl=>pl.id===x.params.pid);if(t)t.morale=cap(t.morale+a.player);}
 x.answer=a.id;if(p.questions.every(v=>v.answer))finishPress(s);return x;
}
function finishPress(s){const p=s.press;p.done=true;const n=p.questions.length,text=`Press conference: ${n} answers shape the next game.`;log(s,text,'press',{n});s.ripples.unshift({label:'Press conference',detail:text,week:s.week,k:'press',p:{n}});s.ripples=s.ripples.slice(0,12);}
/* Skipping: no bonuses and a small dip in fans. */
export function skipPress(s){const p=s.press;if(!p||p.done)return;p.done=true;s.fans=Math.max(40,s.fans-10);log(s,'Skipped the press conference. Fans −10.','pressSkip');}
export const questionText=id=>en.press[id]?.q;
