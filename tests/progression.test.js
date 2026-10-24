import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';import {achievements,newlyEarned,bestStreak,ACHIEVEMENTS} from '../src/achievements.js';import {arc,sparkPoints,roomLevel,ARC} from '../src/arcs.js';
// Progression features: achievements, player development arcs, and recruiting scouting (hidden potential and work ethic).
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const fresh=(seed=7,diff='elite')=>{const s=E.createGame(data,'Prog',diff,seed);E.autoLineup(s);return s;};
const prepare=s=>{if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');};
const playGame=s=>{E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);};
const verdict=s=>{try{return E.validSave(s);}catch{return 'threw';}};
// A bare save-shaped object: enough for achievements(), which only reads results, log, ripples, tally, schedule and the finish flags.
const stub=(wins,over={})=>({schedule:Array.from({length:20},()=>({})),results:wins.map(won=>({won,ripples:[]})),log:[],ripples:[],finished:false,champion:false,level:'varsity',...over});
const ids=s=>achievements(s).filter(a=>a.earned).map(a=>a.id);

test('achievements: ids are fixed and every entry has an id and a boolean',()=>{
 const list=achievements(stub([]));assert.deepEqual(list.map(a=>a.id),ACHIEVEMENTS);assert.ok(list.every(a=>typeof a.earned==='boolean'));assert.deepEqual(ids(stub([])),[]);
});
test('achievements: first win, streaks and the undefeated regular season (cut = games - 4)',()=>{
 assert.deepEqual(ids(stub([false])),[]);assert.ok(ids(stub([false,true])).includes('firstWin'));
 assert.equal(bestStreak([{won:true},{won:true},{won:false},{won:true}]),2);
 const nine=stub(Array(9).fill(true));assert.ok(!ids(nine).includes('streak10'));assert.deepEqual(achievements(nine).find(a=>a.id==='streak10').progress,{n:9,of:10});
 assert.ok(ids(stub(Array(10).fill(true))).includes('streak10'));
 assert.ok(ids(stub([...Array(10).fill(true),false,...Array(5).fill(true)])).includes('streak10'),'the best run counts, not the current one');
 const cut=16;assert.ok(ids(stub(Array(cut).fill(true))).includes('undefeated'),'16 straight wins is an undefeated regular season');
 assert.ok(!ids(stub([...Array(cut-1).fill(true),false])).includes('undefeated'));assert.ok(!ids(stub(Array(cut-1).fill(true))).includes('undefeated'),'not before the regular season is over');
 assert.ok(ids(stub([...Array(cut).fill(true),false,false])).includes('undefeated'),'later playoff losses do not take it away');
});
test('achievements: perfect drill comes from the tally or from practice notes still on the save',()=>{
 assert.ok(!ids(stub([])).includes('perfectDrill'));
 assert.ok(ids(stub([],{tally:{perfects:1}})).includes('perfectDrill'));
 assert.ok(ids(stub([],{ripples:[{k:'train',p:{perfect:true}}]})).includes('perfectDrill'));
 assert.ok(ids({...stub([true]),results:[{won:true,ripples:[{k:'train',p:{perfect:true}}]}]}).includes('perfectDrill'));
 assert.ok(!ids(stub([],{ripples:[{k:'train',p:{perfect:false}}]})).includes('perfectDrill'));
});
test('achievements: zero-injury needs a finished regular season with no regular-season injuries; full strength needs the tally',()=>{
 const cut=16;assert.ok(!ids(stub(Array(cut-1).fill(true))).includes('zeroInjury'));
 assert.ok(ids(stub(Array(cut).fill(false))).includes('zeroInjury'));
 assert.ok(!ids(stub(Array(cut).fill(true),{tally:{injuries:1}})).includes('zeroInjury'));
 assert.ok(!ids(stub(Array(cut).fill(true),{log:[{k:'injury',week:3}]})).includes('zeroInjury'),'old saves fall back to the decision trail');
 assert.ok(ids(stub(Array(cut).fill(true),{log:[{k:'injury',week:cut+2}]})).includes('zeroInjury'),'a playoff injury does not count');
 assert.ok(!ids(stub([true])).includes('fullStrength'));assert.ok(ids(stub([true],{tally:{full:2}})).includes('fullStrength'));
});
test('achievements: Varsity Champion needs a finished, champion Varsity season',()=>{
 assert.ok(ids(stub([true],{finished:true,champion:true})).includes('champion'));
 assert.ok(!ids(stub([true],{finished:true,champion:true,level:'jv'})).includes('champion'));
 assert.ok(!ids(stub([true],{finished:true,champion:false})).includes('champion'));assert.ok(!ids(stub([true],{finished:false,champion:true})).includes('champion'));
});
test('achievements: newlyEarned lists only ids not yet announced, and is never reset by later games',()=>{
 const s=stub([true],{tally:{full:1}});assert.deepEqual(newlyEarned(s),['firstWin','fullStrength']);
 s.seenAch=['firstWin'];assert.deepEqual(newlyEarned(s),['fullStrength']);s.seenAch=['firstWin','fullStrength'];assert.deepEqual(newlyEarned(s),[]);
 s.results.push({won:false,ripples:[]});assert.ok(ids(s).includes('firstWin'),'a later loss keeps the first win');
});
test('engine: practice, injuries and full-strength starts are counted in s.tally (created on first use)',()=>{
 const s=fresh();assert.equal(s.tally,undefined);E.train(s,'shooting','all',{perfect:true});assert.equal(s.tally.perfects,1);E.train(s,'shooting');assert.equal(s.tally.perfects,1);
 assert.ok(ids(s).includes('perfectDrill'));
 const t=fresh(3);t.players.forEach(p=>p.energy=95);playGame(t);assert.equal(t.tally.full,1,'rested starters');
 const u=fresh(3);u.players.forEach(p=>p.energy=60);playGame(u);assert.ok(!u.tally?.full,'tired starters');
});
test('engine: a full season keeps injuries regular-season only and the save valid, with every new field populated',()=>{
 for(const seed of [2,5,9]){
  const s=fresh(seed);let guard=0;while(!s.finished&&guard++<60){prepare(s);playGame(s);}
  assert.ok(s.finished);assert.equal(verdict(s),true,`seed ${seed}`);
  const cut=E.seasonPlan(s).cut,trail=s.log.filter(l=>l.k==='injury'&&l.week<=cut).length;
  assert.ok((s.tally?.injuries||0)>=trail,'the tally is never below what the trail shows');
  for(const p of s.players){assert.ok(p.hist.length<=40&&p.hist.length>0);assert.equal(p.hist.length,p.form.length);assert.ok(p.hist.every(Number.isFinite));assert.equal(p.hist.at(-1),Math.round(p.skill*10)/10);}
 }
});
test('engine: hist and form are capped at 40 entries',()=>{
 const s=fresh();s.players[0].hist=Array(40).fill(70);s.players[0].form=Array(40).fill(60);playGame(s);assert.equal(s.players[0].hist.length,40);assert.equal(s.players[0].form.length,40);assert.equal(verdict(s),true);
});

test('arc: sparkline text needs two games; breakout and slump use documented thresholds',()=>{
 assert.equal(arc({skill0:64}).show,false);assert.equal(arc({skill0:64,hist:[65]}).show,false);
 const a=arc({skill0:64,hist:[66,70,75,81]});assert.deepEqual([a.from,a.to,a.games,a.show],[64,81,4,true]);
 assert.equal(a.tag,'breakout');assert.equal(a.gain,15);
 assert.equal(arc({skill0:64,hist:[70,71,72,72]}).tag,null,'a gain of 2 over 3 games is not a breakout');
 assert.equal(arc({skill0:64,hist:[64,64,65,66]}).tag,null);assert.equal(arc({skill0:64,hist:[64,64,65,66]}).gain,2);
 assert.equal(arc({skill0:60,hist:[61,62,63]}).gain,3);assert.equal(arc({skill0:60,hist:[61,62,63]}).tag,'breakout','exactly +3 counts');
 assert.equal(arc({hist:[64,65],form:[]}).from,64,'no skill0: the series starts at the first game');
 const slump=arc({skill0:70,hist:[70,70,70,70],form:[80,70,66,60]});assert.equal(slump.tag,'slump','down 20 and below 65');
 assert.equal(arc({hist:[70,70,70,70],form:[90,86,84,80]}).tag,null,'falling but still healthy');
 assert.equal(arc({hist:[70,70,70,70],form:[62,62,61,60]}).tag,null,'low but steady');
 assert.equal(arc({skill0:60,hist:[70,75,80,85],form:[80,70,66,60]}).tag,'slump','slump wins over breakout');
 assert.equal(arc({skill0:'x',hist:[1,'a',NaN,3],form:'bad'}).games,2,'junk entries are ignored');
 assert.equal(ARC.window,3);
});
test('arc: sparkline points stay inside the box, rise with the skill, and handle flat or tiny series',()=>{
 assert.equal(sparkPoints([]),'');assert.equal(sparkPoints([5]),'');
 const pts=sparkPoints([60,70,80],120,32,3).split(' ').map(p=>p.split(',').map(Number));
 assert.equal(pts.length,3);assert.equal(pts[0][0],3);assert.equal(pts[2][0],117);assert.ok(pts[0][1]>pts[1][1]&&pts[1][1]>pts[2][1],'higher skill is higher on the page (smaller y)');
 assert.ok(pts.every(([x,y])=>x>=0&&x<=120&&y>=0&&y<=32));
 assert.ok(sparkPoints([70,70,70]).split(' ').every(p=>p.endsWith(',16')),'flat series draws mid-height');
});
test('growth room: default ceiling is unchanged, a personal ceiling lowers it, and words follow thresholds',()=>{
 assert.equal(E.growthRoom(70),E.growthRoom(70,98));assert.equal(E.growthRoom(40),1);assert.equal(E.growthRoom(98),E.GROWTH.min);
 assert.ok(E.growthRoom(80,85)<E.growthRoom(80));assert.equal(E.growthRoom(90,85),E.GROWTH.min);
 assert.deepEqual([1,.75,.74,.4,.39,.1].map(roomLevel),['high','high','some','some','low','low']);
});

test('prospectTraits: deterministic from seed and id, ceiling 78..98, work ethic 1..5, and all values occur',()=>{
 assert.deepEqual(E.prospectTraits(42,100),E.prospectTraits(42,100));
 const ceils=new Set(),works=new Set();
 for(let seed=1;seed<=60;seed++)for(let id=100;id<106;id++){const t=E.prospectTraits(seed,id);assert.ok(Number.isInteger(t.ceil)&&t.ceil>=78&&t.ceil<=98,`ceil ${t.ceil}`);assert.ok(Number.isInteger(t.work)&&t.work>=1&&t.work<=5);ceils.add(t.ceil);works.add(t.work);}
 assert.ok(ceils.has(78)||ceils.has(79),'low end reached');assert.ok(ceils.has(97)||ceils.has(98),'high end reached');assert.deepEqual([...works].sort(),[1,2,3,4,5]);assert.ok(ceils.size>=15);
 assert.notDeepEqual([100,101,102,103,104,105].map(i=>E.prospectTraits(42,i)),[100,101,102,103,104,105].map(i=>E.prospectTraits(43,i)),'a different save gets different prospects');
 assert.equal(E.workMult({}),1);assert.equal(E.workMult({work:3}),1);assert.ok(Math.abs(E.workMult({work:1})-.9)<1e-9&&Math.abs(E.workMult({work:5})-1.1)<1e-9);assert.equal(E.workMult({work:9}),1);
});
test('scouting a prospect costs 60 tokens and no practice slot, reveals once, and needs tokens',()=>{
 const s=fresh();const t0=s.tokens,a0=s.actions;E.scoutProspect(s,100);
 assert.equal(s.tokens,t0-E.SCOUT_COST);assert.equal(E.SCOUT_COST,60);assert.equal(s.actions,a0);assert.deepEqual(s.scoutedProspects,{100:true});
 assert.equal(s.log[0].k,'scoutP');assert.equal(verdict(s),true);
 assert.throws(()=>E.scoutProspect(s,100),/already scouted/);assert.throws(()=>E.scoutProspect(s,999),/unavailable/);
 s.tokens=59;assert.throws(()=>E.scoutProspect(s,101),/Not enough/);assert.equal(s.scoutedProspects[101],undefined);
 E.startMatch(s);assert.throws(()=>E.scoutProspect(s,101),/current game/);
});
test('signing stores the hidden traits; growth respects the personal ceiling and work ethic; others are unchanged',()=>{
 const s=fresh(11);s.tokens=2000;const tr=E.prospectTraits(s.seed,101);E.recruit(s,101);const p=s.players.find(x=>x.id===101);
 assert.equal(p.ceil,tr.ceil);assert.equal(p.work,tr.work);assert.equal(verdict(s),true);
 const rostered=s.players.find(x=>x.id===0);assert.equal(rostered.ceil,undefined,'existing players have no personal ceiling');
 // A capped player cannot pass the personal ceiling however long they train.
 const q=fresh(11);const star=q.players[0];star.ceil=80;star.work=3;star.skill=79.5;E.train(q,'shooting',star.id);assert.ok(star.skill<=80);
 // Same practice, same starting skill: work ethic scales the gain from x0.9 to x1.1 (before rounding to a tenth).
 const gain=work=>{const r=fresh(11);const x=r.players[0];x.skill=60;x.skill0=60;x.work=work;E.train(r,'shooting',x.id);return x.skill-60;};
 assert.ok(gain(5)>gain(3)&&gain(3)>gain(1));assert.ok(Math.abs(gain(5)/gain(1)-1.1/.9)<.1);
 const base=fresh(11),ref=fresh(11);ref.players[0].ceil=98;ref.players[0].work=3;E.train(base,'shooting');E.train(ref,'shooting');assert.deepEqual(base.players.map(x=>x.skill),ref.players.map(x=>x.skill),'ceiling 98 and work 3 are neutral');
});

// ---- Hostile saves: the optional fields are validated; old saves without them still load ----
const bad=(base,mutate,msg)=>{const s=structuredClone(base);mutate(s);assert.equal(verdict(s),false,msg);};
test('save validation: progression fields are optional, and hostile values are rejected without throwing',()=>{
 const s=fresh(5);for(let i=0;i<2;i++){prepare(s);playGame(s);}E.scoutProspect(s,100);s.seenAch=['firstWin'];
 assert.equal(verdict(s),true);
 const old=structuredClone(s);delete old.tally;delete old.seenAch;delete old.scoutedProspects;for(const p of [...old.players,...old.pool])for(const k of ['hist','form','ceil','work'])delete p[k];assert.equal(verdict(old),true,'an old save loads');
 bad(s,x=>x.tally='x','tally string');bad(s,x=>x.tally=[1],'tally array');bad(s,x=>x.tally={injuries:-1},'negative');bad(s,x=>x.tally={injuries:1.5},'fraction');bad(s,x=>x.tally={injuries:1,hack:1},'unknown key');bad(s,x=>x.tally={perfects:'3'},'string count');bad(s,x=>x.tally={full:1e9},'huge');
 bad(s,x=>x.seenAch='firstWin','seenAch string');bad(s,x=>x.seenAch=[1],'seenAch number');bad(s,x=>x.seenAch=['<img src=x onerror=alert(1)>'],'markup id');bad(s,x=>x.seenAch=Array(31).fill('a'),'too many');bad(s,x=>x.seenAch=[{}],'object id');
 bad(s,x=>x.scoutedProspects=[1],'scouted array');bad(s,x=>x.scoutedProspects={100:'yes'},'scouted value');bad(s,x=>x.scoutedProspects={'<b>':true},'scouted key');bad(s,x=>x.scoutedProspects='1','scouted string');bad(s,x=>x.scoutedProspects=Object.fromEntries(Array.from({length:40},(_,i)=>[i,true])),'too many');
 bad(s,x=>x.players[0].hist='x','hist string');bad(s,x=>x.players[0].hist=Array(41).fill(50),'hist too long');bad(s,x=>x.players[0].hist=[50,'a'],'hist junk');bad(s,x=>x.players[0].hist=[50,101],'hist range');bad(s,x=>x.players[0].hist=[null],'hist null');
 bad(s,x=>x.players[0].form=[NaN],'form NaN');bad(s,x=>x.players[0].form={length:1},'form object');bad(s,x=>x.pool[0].hist=[-1],'pool hist');
 bad(s,x=>x.players[0].ceil='99','ceil string');bad(s,x=>x.players[0].ceil=500,'ceil range');bad(s,x=>x.players[0].ceil=NaN,'ceil NaN');
 bad(s,x=>x.players[0].work=0,'work 0');bad(s,x=>x.players[0].work=6,'work 6');bad(s,x=>x.players[0].work=2.5,'work fraction');bad(s,x=>x.players[0].work='3','work string');
 for(const junk of [null,5,'x',[],{players:5},{players:[null]},{players:[5],pool:'x',tally:{}}])assert.notEqual(verdict(junk),'threw',JSON.stringify(junk));
});
test('save round trip: JSON keeps the progression fields and the same achievements',()=>{
 const s=fresh(8);let guard=0;while(!s.finished&&guard++<60){prepare(s);playGame(s);}
 const back=JSON.parse(JSON.stringify(s));assert.equal(verdict(back),true);assert.deepEqual(achievements(back),achievements(s));assert.deepEqual(back.tally,s.tally);
});
