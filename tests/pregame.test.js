import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';import * as G from '../src/pregame.js';
import en from '../src/i18n/locales/en.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const fresh=(seed=7,diff='standard')=>{const s=E.createGame(data,'Pregame',diff,seed);E.autoLineup(s);return s;};
const playGame=s=>{E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);};

test('pregame: opens with the plan question, 2 questions normally and 3 in big games, same save same questions',()=>{
 const s=fresh();const p=G.startPregame(s);assert.equal(p.week,0);assert.equal(p.done,false);
 assert.equal(p.questions[0].id,'plan');assert.equal(p.questions.length,2,'a normal game has two');
 const again=fresh();assert.deepEqual(G.startPregame(again),p,'seeded');
 assert.equal(G.startPregame(s),s.pregame,'opening twice keeps the same conference');
 const scouted=fresh();scouted.scouted=true;assert.equal(G.startPregame(scouted).questions[0].id,'film');
 const fr=fresh();fr.week=E.seasonPlan(fr).cut;const fp=G.startPregame(fr);assert.equal(fp.questions.length,3,'final run is a big game');assert.ok(fp.questions.some(x=>x.id==='finalrun'));
});
test('pregame: rematches, streaks, the captain and tired legs bring their own questions',()=>{
 const c=fresh(3);c.captain=c.players.find(p=>p.starter).id;c.players.forEach(p=>p.energy=40);const ctx=G.pregameContext(c);
 assert.equal(ctx.captain.id,c.captain);assert.ok(ctx.energy<60);assert.ok(ctx.star);
 const ids=G.PRE_QUESTIONS.filter(x=>x.when(ctx)).map(x=>x.id);for(const k of ['captain','tired','star'])assert.ok(ids.includes(k),k);
 const w=fresh(5);w.results=[{opponent:'X',won:true,home:60,away:50},{opponent:'Y',won:true,home:60,away:50},{opponent:'Z',won:true,home:60,away:50}];
 const wp=G.startPregame(w);assert.equal(wp.questions.length,3);assert.ok(wp.questions.some(x=>x.id==='streakw'),'big question is asked');
 const r=fresh(6),opp=r.schedule[0].opponent;r.results=[{opponent:opp,won:false,home:40,away:55}];const rp=G.startPregame(r);assert.ok(rp.questions.some(x=>x.id==='revenge'));
 assert.equal(rp.questions.find(x=>x.id==='revenge').params.opp,opp);
});
test('pregame: answers add to tonight\'s modifiers within the caps and then apply at tip-off',()=>{
 const s=fresh();G.startPregame(s);const pv=G.previewPregame(s);assert.equal(pv.length,2);
 assert.throws(()=>G.answerPregame(s,0,'nope'),/not available/);
 const fans=s.fans,chem=s.chemistry;G.answerPregame(s,0,'own');assert.equal(s.nextMods.chem,2);assert.throws(()=>G.answerPregame(s,0,'attack'),/not available/);
 const second=s.pregame.questions[1],ans=pv[1].answers[0].id;G.answerPregame(s,1,ans);assert.equal(s.pregame.done,true);assert.ok(G.pregameReady(s));
 assert.equal(s.log[0].k,'pregame');assert.equal(s.ripples[0].k,'pregame');assert.ok(E.validSave(s));
 const expected=structuredClone(s.nextMods);E.startMatch(s);assert.equal(s.nextMods,null);assert.equal(s.chemistry,Math.min(100,chem+(expected.chem||0)));
 assert.equal(s.match.mods.offense,expected.offense||0);assert.ok(second);assert.ok(s.fans>=fans);
 for(let i=0;i<30;i++){const t=fresh(i+20);G.startPregame(t);t.pregame.questions.forEach((x,k)=>G.answerPregame(t,k,G.PRE_ANSWER_IDS[x.id][(i+k)%3]));for(const [k,v] of Object.entries(t.nextMods||{}))assert.ok(Math.abs(v)<=({chem:8,morale:8,energy:8,fans:40,offense:4,defense:4,oppRating:4})[k],k);assert.ok(E.validSave(t));}
});
test('pregame: skipping costs five fans once, star praise lifts his morale, a new week asks again',()=>{
 const s=fresh();const f=s.fans;G.skipPregame(s);assert.equal(s.fans,f-5);assert.ok(G.pregameReady(s));G.skipPregame(s);assert.equal(s.fans,f-5,'only once');assert.equal(s.log[0].k,'pregameSkip');
 playGame(s);assert.equal(G.pregameReady(s),false,'next game needs its own');
 let found=false;for(let seed=9;seed<80&&!found;seed++){const u=fresh(seed);const p=G.startPregame(u),i=p.questions.findIndex(x=>x.id==='star');if(i>=0){found=true;const pl=u.players.find(x=>x.id===p.questions[i].params.pid),m=pl.morale;G.answerPregame(u,i,'praise');assert.equal(pl.morale,Math.min(100,m+5));}}
 assert.ok(found,'some save asks about the star');
});
test('pregame: hostile saves are rejected and old saves without it still load',()=>{
 const s=fresh();assert.ok(E.validSave(s));G.startPregame(s);assert.ok(E.validSave(s));
 const bad=f=>{const x=structuredClone(s);f(x);assert.equal(E.validSave(x),false);};
 bad(x=>{x.pregame.evil=1;});bad(x=>{x.pregame.questions[0].params.opp='<img src=x>';});bad(x=>{x.pregame.questions=Array.from({length:4},()=>x.pregame.questions[0]);});
 bad(x=>{x.pregame.done='yes';});bad(x=>{x.pregame.week=-1;});bad(x=>{x.pregame.questions=[null];});
 const old=structuredClone(s);delete old.pregame;assert.ok(E.validSave(old));
});
test('pregame: every question and answer has English text, and a whole season still finishes with pressers answered',()=>{
 for(const x of G.PRE_QUESTIONS){assert.ok(en.pre[x.id]?.q,x.id);for(const a of x.answers)assert.ok(en.pre[x.id].a[a.id],`${x.id}.${a.id}`);}
 for(const diff of ['rookie','standard','elite']){const s=fresh(4,diff);let g=0;while(!s.finished&&g++<30){const p=G.startPregame(s);if(p)p.questions.forEach((x,k)=>G.answerPregame(s,k,G.PRE_ANSWER_IDS[x.id][k%3]));playGame(s);assert.ok(E.validSave(s));}assert.ok(s.finished,diff);}
});
