// The pregame press conference: two or three questions about tonight's matchup, asked when the coach heads to tip-off.
// Answers use the same next-game modifiers as the post-game press room (addMods), so they land at this game's tip-off.
import {cap,log,hashStr,seasonPlan,opponent,addMods} from './engine.js';

/* `player` is a one-off morale change for the player the question names (params.pid). */
export const PRE_QUESTIONS=[
 {id:'plan',first:true,when:c=>!c.scouted,answers:[{id:'attack',mods:{offense:2,defense:-1}},{id:'lockdown',mods:{defense:2,offense:-1}},{id:'own',mods:{chem:2}}]},
 {id:'film',first:true,when:c=>c.scouted,answers:[{id:'film',mods:{offense:1,defense:1}},{id:'counter',mods:{defense:2}},{id:'own',mods:{chem:2}}]},
 {id:'home',when:c=>c.home,answers:[{id:'pack',mods:{fans:12}},{id:'focus',mods:{chem:2}},{id:'thanks',mods:{fans:6,morale:1}}]},
 {id:'road',when:c=>!c.home,answers:[{id:'embrace',mods:{morale:2}},{id:'silence',mods:{fans:8,oppRating:1}},{id:'routine',mods:{chem:2}}]},
 {id:'revenge',big:true,when:c=>c.met&&!c.metWon,answers:[{id:'revenge',mods:{morale:3,oppRating:1}},{id:'learned',mods:{defense:1,chem:1}},{id:'deflect',mods:{}}]},
 {id:'again',big:true,when:c=>c.met&&c.metWon,answers:[{id:'again',mods:{fans:12,oppRating:2}},{id:'newgame',mods:{chem:2}},{id:'deflect',mods:{}}]},
 {id:'star',when:c=>!!c.star,answers:[{id:'praise',mods:{chem:-1},player:5},{id:'team',mods:{chem:2}},{id:'deflect',mods:{}}]},
 {id:'tired',when:c=>c.energy<60,answers:[{id:'rest',mods:{energy:3,offense:-1}},{id:'tough',mods:{morale:1,energy:-2}},{id:'depth',mods:{chem:1}}]},
 {id:'finalrun',big:true,when:c=>c.finalRun,answers:[{id:'focus',mods:{defense:2,morale:-2}},{id:'loose',mods:{morale:3,offense:-1}},{id:'confident',mods:{fans:15,oppRating:2}}]},
 {id:'streakw',big:true,when:c=>c.streak>=3,answers:[{id:'routine',mods:{chem:2}},{id:'confident',mods:{fans:15,oppRating:2}},{id:'humble',mods:{oppRating:-1}}]},
 {id:'streakl',big:true,when:c=>c.streak<=-2,answers:[{id:'rally',mods:{morale:3,chem:1}},{id:'honest',mods:{chem:2,morale:-2}},{id:'deflect',mods:{}}]},
 {id:'captain',when:c=>!!c.captain,answers:[{id:'speech',mods:{chem:2},player:3},{id:'lead',mods:{morale:2}},{id:'quiet',mods:{defense:1}}]}
];
const q=id=>PRE_QUESTIONS.find(x=>x.id===id);
export const PRE_ANSWER_IDS=Object.fromEntries(PRE_QUESTIONS.map(x=>[x.id,x.answers.map(a=>a.id)]));
const clean=v=>String(v||'').replace(/[<>"&`]/g,'').slice(0,60);

/* Tonight's matchup in the terms the questions ask about. */
export function pregameContext(s){
 if(s.finished||s.week>=s.schedule.length)return null;
 const o=opponent(s),prev=[...s.results].reverse().find(r=>r.opponent===o.opponent);
 let streak=0;const last=s.results.at(-1);if(last)for(let i=s.results.length-1;i>=0&&s.results[i].won===last.won;i--)streak+=last.won?1:-1;
 const fit=s.players.filter(p=>p.starter&&!p.injury),star=fit.length?fit.reduce((a,p)=>p.skill>a.skill?p:a):null;
 const cpt=s.captain!=null?s.players.find(p=>p.id===s.captain&&!p.injury):null,rot=s.players.filter(p=>p.minutes>0);
 return {opp:o.opponent,venue:o.venue||'',home:o.home!==false,scouted:!!s.scouted,met:!!prev,metWon:!!prev?.won,metScore:prev?`${prev.home}–${prev.away}`:'',
  star:star?{id:star.id,name:star.name}:null,captain:cpt?{id:cpt.id,name:cpt.name}:null,
  energy:rot.length?rot.reduce((a,p)=>a+p.energy,0)/rot.length:100,finalRun:s.week>=seasonPlan(s).cut,streak};
}
function params(id,c){
 const who=id==='captain'?c.captain:id==='star'?c.star:null;
 return {opp:clean(c.opp),venue:clean(c.venue),pid:who?.id??-1,name:clean(who?.name),n:Math.abs(c.streak),score:clean(c.metScore)};
}

/* Opens the pregame press conference for this week's game: an opening question about the plan, then 1 more (2 in big games), seeded so a save always gets the same questions. */
export function startPregame(s){
 if(s.match||s.finished)return null;if(s.pregame&&s.pregame.week===s.week)return s.pregame;
 const c=pregameContext(s);if(!c)return null;
 const elig=PRE_QUESTIONS.filter(x=>x.when(c)),first=elig.find(x=>x.first),big=elig.some(x=>x.big),size=big?3:2;
 const rest=elig.filter(x=>!x.first).map(x=>({x,h:hashStr(`${s.seed}|pregame|${s.week}|${x.id}`)-(x.big?2**32:0)})).sort((a,b)=>a.h-b.h).map(o=>o.x);
 const picked=[first,...rest].filter(Boolean).slice(0,size);
 s.pregame={week:s.week,questions:picked.map(x=>({id:x.id,params:params(x.id,c),answer:null})),done:false};return s.pregame;
}
export const pregameReady=s=>!!s.pregame&&s.pregame.week===s.week&&s.pregame.done;
/* What an answer does tonight, as chips: [{k,v,who}]. */
export function preChips(question,answer){const out=Object.entries(answer.mods||{}).filter(([,v])=>v).map(([k,v])=>({k,v,who:'team'}));if(answer.player)out.push({k:'morale',v:answer.player,who:question.params?.name||''});return out;}
export function previewPregame(s){return (s.pregame?.questions||[]).map(x=>{const d=q(x.id);return {id:x.id,answered:x.answer,answers:d?d.answers.map(a=>({id:a.id,chips:preChips(x,a)})):[]};});}
export function answerPregame(s,index,answerId){
 const p=s.pregame;if(!p||p.done||p.week!==s.week)throw Error('That choice is not available.');const x=p.questions[index];if(!x||x.answer)throw Error('That choice is not available.');
 const a=q(x.id)?.answers.find(v=>v.id===answerId);if(!a)throw Error('That choice is not available.');
 addMods(s,a.mods);if(a.player){const pl=s.players.find(v=>v.id===x.params.pid);if(pl)pl.morale=cap(pl.morale+a.player);}
 x.answer=a.id;if(p.questions.every(v=>v.answer))finishPregame(s);return x;
}
function finishPregame(s){const p=s.pregame;p.done=true;const n=p.questions.length,text=`Pregame press conference: ${n} answers set the tone.`;log(s,text,'pregame',{n});s.ripples.unshift({label:'Pregame press',detail:text,week:s.week,k:'pregame',p:{n}});s.ripples=s.ripples.slice(0,12);}
/* Skipping: no answers, five fans fewer. Starting a game without one is never blocked by the engine; the tip-off button asks first. */
export function skipPregame(s){if(!s.pregame||s.pregame.week!==s.week)startPregame(s);const p=s.pregame;if(!p||p.done)return;p.done=true;s.fans=Math.max(40,s.fans-5);log(s,'Skipped the pregame press conference. Fans −5.','pregameSkip');}
