import test from 'node:test';import en_ from '../src/i18n/locales/en.js';import assert from 'node:assert/strict';import fs from 'node:fs';import * as E from '../src/engine.js';import * as V from '../src/events.js';import * as P from '../src/press.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const fresh=(seed=7,diff='standard')=>{const s=E.createGame(data,'Inbox',diff,seed);E.autoLineup(s);return s;};
const playGame=s=>{E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);};
const prepare=s=>{if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');};

test('captain: first pick is free, changing costs morale and chemistry, and a healthy captain adds chemistry after a game',()=>{
 const s=fresh(),[a,b]=s.players.filter(p=>p.starter);assert.equal(s.captain??null,null);
 const m0=a.morale,c0=s.chemistry;E.setCaptain(s,a.id);assert.equal(s.captain,a.id);assert.equal(a.morale,m0);assert.equal(s.chemistry,c0);assert.match(s.log[0].text,/captain/);
 E.setCaptain(s,a.id);assert.equal(s.log.filter(l=>l.k==='captain').length,1,'no change, no entry');
 E.setCaptain(s,b.id);assert.equal(a.morale,m0-4);assert.equal(s.chemistry,c0-2);
 assert.throws(()=>E.setCaptain(s,9999),/Choose a player/);assert.ok(E.validSave(s));
 const t=fresh(11),cap=t.players.find(p=>p.starter);E.setCaptain(t,cap.id);const u=structuredClone(t);u.captain=null;
 playGame(t);playGame(u);assert.ok(t.chemistry>u.chemistry||t.chemistry===100,'a healthy captain adds chemistry');
 E.startMatch(fresh());const live=fresh();E.startMatch(live);assert.throws(()=>E.setCaptain(live,live.players[0].id),/Finish the current game/);
});
test('next-game modifiers are summed, clamped, applied once at tip-off and cleared',()=>{
 const s=fresh();E.addMods(s,{chem:5,morale:3,offense:3});E.addMods(s,{chem:5,offense:3,defense:-9});
 assert.equal(s.nextMods.chem,8);assert.equal(s.nextMods.offense,4);assert.equal(s.nextMods.defense,-4);assert.ok(E.validSave(s));
 const chem=s.chemistry,m=s.players[0].morale;E.startMatch(s);assert.equal(s.chemistry,Math.min(100,chem+8));assert.equal(s.players[0].morale,Math.min(100,m+3));assert.equal(s.match.mods.offense,4);assert.equal(s.nextMods,null);assert.ok(E.validSave(s));
 while(s.match)E.possession(s);const t=fresh();E.addMods(t,{offense:4});const x=structuredClone(t);E.startMatch(t);E.startMatch(x);x.match.mods={offense:0,defense:0,oppRating:0};
 const a=structuredClone(t),b=structuredClone(x);for(let i=0;i<60;i++){E.possession(a);E.possession(b);}assert.notEqual(a.match.home,b.match.home,'an offense modifier changes the game');
 const bad=fresh();bad.nextMods={chem:'x'};assert.equal(E.validSave(bad),false);bad.nextMods={nope:1};assert.equal(E.validSave(bad),false);
});
test('events: about one game in three, never before game two or twice in a row, deterministic, and every option stays in bounds',()=>{
 let games=0,events=0;const seenIds=new Set();
 for(let seed=1;seed<=60;seed++){
  const s=fresh(seed);let guard=0,lastEvt=-9;
  while(!s.finished&&guard++<30){prepare(s);playGame(s);if(s.finished)break;
   const pe=V.rollEvent(s);games++;
   if(pe){events++;seenIds.add(pe.id);assert.ok(s.results.length>=2,'none before game 2');assert.notEqual(lastEvt,s.week-1,'never twice in a row');lastEvt=s.week;
    const again=structuredClone(s);again.pendingEvent=null;assert.deepEqual(V.rollEvent(again),pe,'same save, same event');
    const opts=V.previewOptions(s);assert.ok(opts.length>=2);const avail=opts.map((o,i)=>[o,i]).filter(([o])=>o.available);const [,i]=avail[(seed+s.week)%avail.length];
    const tokens=s.tokens;assert.throws(()=>E.startMatch(s),/inbox/);
    const r=V.resolveEvent(s,i);assert.equal(s.pendingEvent,null);assert.ok(r.chips.length>=0);assert.equal(s.eventLog.at(-1).id,pe.id);assert.equal(s.log[0].k,'event');
    assert.ok(E.validSave(s),`${pe.id}/${r.choice} keeps a valid save`);
    for(const p of s.players){for(const k of ['skill','energy','morale'])assert.ok(p[k]>=0&&p[k]<=100);assert.ok(p.gpa>=0&&p.gpa<=4);assert.ok(p.injury>=0&&p.injury<=10);}
    assert.ok(s.chemistry>=0&&s.chemistry<=100&&s.tokens>=0&&s.fans>=40);assert.ok(s.players.length<=15);
   }
  }
 }
 const rate=events/games;assert.ok(rate>.2&&rate<.4,`event rate ${rate}`);assert.ok(seenIds.size>=7,`variety: ${[...seenIds]}`);
});
test('every event option has text in English and shows its effects before it is chosen',()=>{
 for(const e of V.EVENTS){assert.ok(e.id in V.OPTION_IDS);const s=fresh(3);for(let i=0;i<3;i++){prepare(s);playGame(s);}
  s.captain=s.players[0].id;s.players.forEach((p,i)=>{if(i>7)p.minutes=0;});s.players[9].morale=40;s.players[10].morale=40;s.players[11].gpa=2.2;s.fans=200;
  if(!e.when(s))continue;const t=structuredClone(s);t.pendingEvent={id:e.id,params:e.params(t,12345)};
  const opts=V.previewOptions(t);assert.deepEqual(opts.map(o=>o.id),V.OPTION_IDS[e.id]);
  const en=en_.ev[e.id];assert.ok(en.title&&en.text);for(const o of e.options)assert.ok(en.o[o.id],`${e.id}.${o.id}`);
  for(let i=0;i<e.options.length;i++){if(!opts[i].available)continue;const u=structuredClone(t);V.resolveEvent(u,i);assert.ok(E.validSave(u),`${e.id} option ${i}`);}}
});

test('a captain softens bad news; unknown events from an edited save are dropped',()=>{
 const a=fresh(5);a.players.forEach(p=>p.morale=80);const b=structuredClone(a);E.setCaptain(a,a.players[0].id);
 for(const s of [a,b]){s.pendingEvent={id:'social',params:{pid:s.players[1].id,name:'X'}};V.resolveEvent(s,1);}
 assert.ok(a.players[2].morale>b.players[2].morale,'quiet response hurts morale less with a calm captain');
 const c=fresh(5);c.pendingEvent={id:'nope',params:{}};assert.equal(V.resolveEvent(c,0),null);assert.equal(c.pendingEvent,null);
 const d=fresh(5);d.pendingEvent={id:'finals',params:{}};assert.throws(()=>V.resolveEvent(d,5),/not available/);d.pendingEvent={id:'Bad Id!',params:{}};assert.equal(E.validSave(d),false);
});
test('press conference: 3 questions, 4 after a close game or a streak, 5 in the final run; answers feed the next game once',()=>{
 const s=fresh(9);prepare(s);playGame(s);const pr=P.startPress(s);assert.ok(pr&&!pr.done);
 const close=Math.abs(s.results[0].home-s.results[0].away)<=5;assert.equal(pr.questions.length,close?4:3);
 assert.ok(pr.questions[0].id===(s.results[0].won?'winwhy':'losswhy'));assert.equal(new Set(pr.questions.map(q=>q.id)).size,pr.questions.length);
 const again=structuredClone(s);again.press=null;assert.deepEqual(P.startPress(again).questions,pr.questions,'deterministic');
 const prev=P.previewPress(s);assert.equal(prev.length,pr.questions.length);for(const q of prev){assert.ok(en_.press[q.id].q);assert.deepEqual(q.answers.map(a=>a.id),P.ANSWER_IDS[q.id]);for(const a of q.answers)assert.ok(en_.press[q.id].a[a.id]);}
 const before=s.fans;pr.questions.forEach((q,i)=>P.answerPress(s,i,P.ANSWER_IDS[q.id][0]));assert.ok(s.press.done);assert.ok(s.nextMods);assert.ok(E.validSave(s));assert.equal(s.log[0].k,'press');
 assert.throws(()=>P.answerPress(s,0,'team'),/inbox/);
 const t=fresh(9);prepare(t);playGame(t);P.startPress(t);P.skipPress(t);assert.equal(t.fans,Math.max(40,t.fans));assert.ok(t.press.done);assert.equal(t.nextMods??null,null);
 // the final run asks five
 const f=fresh(21);let g=0;while(!f.finished&&g++<30){prepare(f);playGame(f);if(f.finished)break;const q=P.startPress(f);if(f.results.at(-1).week>=E.seasonPlan(f).cut){assert.equal(q.questions.length,5);break;}}
 // not after the season ends
 const z=fresh(2);z.finished=true;z.results=[];assert.equal(P.startPress(z),null);
});
test('a full season with the inbox and press conferences resolved automatically still finishes on every level',()=>{
 for(const diff of ['rookie','standard','elite'])for(let seed=1;seed<=8;seed++){
  const s=fresh(seed,diff);let g=0;while(!s.finished&&g++<40){prepare(s);playGame(s);if(s.finished)break;
   if(P.startPress(s))s.press.questions.forEach((q,i)=>P.answerPress(s,i,P.ANSWER_IDS[q.id][(seed+i)%3]));
   if(V.rollEvent(s)){const opts=V.previewOptions(s);V.resolveEvent(s,opts.findIndex(o=>o.available));}
   assert.ok(E.validSave(s));}
  assert.ok(s.finished,`${diff} ${seed}`);}
});
