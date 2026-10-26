import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';import {CORE_KITS,SPECIAL_KITS,ALL_KITS,KITS,gymColors} from '../src/kits.js';
// Locker-room upgrades: special jerseys earned in the season, the morale history behind the mood board, and the save checks that go with them.
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const fresh=(seed=21,diff='elite')=>{const s=E.createGame(data,'Locker',diff,seed);E.autoLineup(s);return s;};
const win=won=>({won,home:70,away:60,opponent:'X',date:'1/1/2027',events:[],ripples:[],box:{}});
// A state whose results are filled in directly, so the rules can be checked without playing the games.
const withResults=(wins,week=wins.length,diff='elite')=>{const s=fresh(5,diff);s.results=wins.map(win);s.week=week;return s;};
const verdict=s=>{try{return E.validSave(s);}catch{return 'threw';}};

test('kit lists: three always-available kits, three special kits, a palette and gym colours for each',()=>{
 assert.deepEqual(CORE_KITS,['home','away','alternate']);assert.deepEqual(SPECIAL_KITS,['throwback','seniornight','blackout']);
 for(const k of ALL_KITS){assert.ok(KITS[k],k);for(const f of ['body','dark','trim','ink','accent'])assert.match(KITS[k][f],/^#[0-9a-f]{6}$/i,`${k}.${f}`);const [bg,fg]=gymColors(k,'#e9b858');assert.match(bg,/^#[0-9a-f]{6}$/i);assert.match(fg,/^#[0-9a-f]{6}$/i);}
 assert.equal(new Set(ALL_KITS.map(k=>gymColors(k)[0]+gymColors(k)[1])).size,ALL_KITS.length,'every kit looks different in the gym');
});
test('a new season has no special kits and wears the home kit',()=>{
 const s=fresh();assert.equal(s.kit,'home');assert.equal(s.unlockedKits,undefined);assert.deepEqual(E.earnedKits(s),[]);
 for(const k of CORE_KITS)assert.equal(E.kitUnlocked(s,k),true);for(const k of SPECIAL_KITS)assert.equal(E.kitUnlocked(s,k),false);
});
test('Throwback needs five wins in a row',()=>{
 assert.ok(!E.earnedKits(withResults([1,1,1,1])).includes('throwback'));
 assert.ok(E.earnedKits(withResults([1,1,1,1,1])).includes('throwback'));
 assert.ok(!E.earnedKits(withResults([1,1,1,1,0,1,1,1,1])).includes('throwback'),'a loss resets the streak');
 assert.ok(E.earnedKits(withResults([0,1,0,1,1,1,1,1,0])).includes('throwback'),'the streak can end later and the kit stays earned');
 const s=withResults([1,1,1,1,1]);assert.deepEqual(E.updateKits(s),['throwback','seniornight'].filter(k=>E.earnedKits(s).includes(k)));
});
test('Blackout needs a win in an elimination (final run) game',()=>{
 for(const diff of ['rookie','standard','elite']){
  const cut=E.seasonPlan(fresh(5,diff)).cut,reg=Array(cut).fill(1);
  assert.ok(!E.earnedKits(withResults(reg,cut,diff)).includes('blackout'),`${diff}: regular-season wins do not count`);
  assert.ok(E.earnedKits(withResults([...reg,1],cut+1,diff)).includes('blackout'),`${diff}: first elimination win`);
  assert.ok(!E.earnedKits(withResults([...Array(cut).fill(0),0],cut+1,diff)).includes('blackout'),`${diff}: an elimination loss does not count`);
  assert.ok(E.earnedKits(withResults([...Array(cut-1).fill(0),1,1],cut+1,diff)).includes('blackout'));
 }
});
test('Senior Night arrives when the next game is the last home game before the final run, and stays',()=>{
 for(const [diff,level] of [['rookie','c'],['standard','jv'],['elite','varsity']]){
  const s=fresh(5,diff),cut=E.seasonPlan(s).cut,last=E.lastHomeGame(s),games=data.levels[level].games;
  assert.ok(last>=0&&last<cut);assert.notEqual(games[last].home,false);for(let i=last+1;i<cut;i++)assert.equal(games[i].home,false,`${diff}: game ${i} is away`);
  assert.ok(!E.earnedKits(withResults(Array(last-1).fill(0),last-1,diff)).includes('seniornight'),`${diff}: two games out`);
  assert.ok(E.earnedKits(withResults(Array(last).fill(0),last,diff)).includes('seniornight'),`${diff}: next game is the senior night`);
  assert.ok(E.earnedKits(withResults(Array(last+1).fill(0),last+1,diff)).includes('seniornight'),`${diff}: stays after the game`);
 }
});
test('the engine unlocks kits after a real game result, once, and records them',()=>{
 const s=fresh(8),last=E.lastHomeGame(s);
 E.playTo(s,last);
 assert.equal(s.week,last);assert.ok(s.unlockedKits.includes('seniornight'));
 const r=s.results.at(-1);assert.ok(Array.isArray(r.kits)||s.results.every(x=>!x.kits),'result records new kits');
 const entry=s.log.find(l=>l.k==='kitUnlocked'&&l.p.kit==='seniornight');assert.ok(entry);
 assert.equal(s.results.flatMap(x=>x.kits||[]).filter(k=>k==='seniornight').length,1,'announced exactly once');
 assert.equal(E.validSave(s),true);
 assert.deepEqual(E.updateKits(s).filter(k=>k==='seniornight'),[],'nothing is unlocked twice');
});
test('every unlocked kit is justified by the results (full simulated seasons)',()=>{
 let sawStreak=false,sawBlackout=false;
 for(let seed=1;seed<=40;seed++){
  const s=fresh(seed);E.playTo(s,s.schedule.length);
  const earned=E.earnedKits(s);assert.deepEqual([...(s.unlockedKits||[])].sort(),[...earned].sort(),`seed ${seed}`);
  assert.equal(E.validSave(s),true,`seed ${seed}`);
  sawStreak||=earned.includes('throwback');sawBlackout||=earned.includes('blackout');
 }
 assert.ok(sawStreak||sawBlackout,'at least one seeded season earns a special kit');
});
test('setKit wears core kits always and special kits only when unlocked',()=>{
 const s=fresh();
 for(const k of CORE_KITS)assert.equal(E.setKit(s,k),k);
 assert.throws(()=>E.setKit(s,'blackout'),/locked/);assert.equal(s.kit,'alternate');
 assert.throws(()=>E.setKit(s,'neon'),/locked/);assert.throws(()=>E.setKit(s,undefined),/locked/);
 s.unlockedKits=['blackout'];assert.equal(E.setKit(s,'blackout'),'blackout');assert.equal(s.kit,'blackout');assert.throws(()=>E.setKit(s,'throwback'),/locked/);
});
test('save validation: special kits only when unlocked, unlockedKits is checked',()=>{
 const s=fresh();s.kit='throwback';assert.equal(verdict(s),false,'locked kit rejected');
 s.unlockedKits=['throwback'];assert.equal(verdict(s),true,'unlocked kit accepted');
 s.unlockedKits=['blackout'];assert.equal(verdict(s),false,'kit worn is not the one unlocked');
 for(const bad of [['throwback','throwback'],['home'],['neon'],'throwback',{},[1],['throwback','seniornight','blackout','blackout'],null]){const x=fresh();x.unlockedKits=bad;assert.equal(verdict(x),false,JSON.stringify(bad));}
 const x=fresh();x.unlockedKits=['throwback','seniornight','blackout'];assert.equal(verdict(x),true);
 const y=fresh();y.kit='nope';assert.equal(verdict(y),false);
});
test('morale history records the team average after each game, is bounded and validated',()=>{
 const s=fresh(3);assert.equal(s.moraleHistory,undefined);
 E.playTo(s,3);assert.equal(s.moraleHistory.length,3);
 for(const n of s.moraleHistory){assert.ok(Number.isInteger(n)&&n>=0&&n<=100);}
 assert.equal(s.moraleHistory.at(-1),Math.round(E.mean(s.players,'morale')));
 E.playTo(s,s.schedule.length);assert.ok(s.moraleHistory.length<=E.MORALE_HISTORY);assert.ok(s.moraleHistory.length>=Math.min(s.results.length,E.MORALE_HISTORY));assert.equal(verdict(s),true);
 for(const bad of [Array(E.MORALE_HISTORY+1).fill(50),[50,NaN],[50,101],[-1],['50'],'50',{},[Infinity],[null]]){const x=fresh();x.moraleHistory=bad;assert.equal(verdict(x),false,JSON.stringify(bad));}
 const ok=fresh();ok.moraleHistory=Array(E.MORALE_HISTORY).fill(100);assert.equal(verdict(ok),true);ok.moraleHistory=[];assert.equal(verdict(ok),true);
});
test('result.kits is validated',()=>{
 const s=fresh(8);E.playTo(s,E.lastHomeGame(s)+1);assert.equal(verdict(s),true);
 const x=structuredClone(s);x.results[0].kits=['neon'];assert.equal(verdict(x),false);x.results[0].kits='throwback';assert.equal(verdict(x),false);x.results[0].kits=['blackout'];assert.equal(verdict(x),true);
});
test('old saves without the new fields still validate and survive JSON',()=>{
 const s=fresh(4);E.playTo(s,4);delete s.unlockedKits;delete s.moraleHistory;for(const r of s.results)delete r.kits;
 assert.equal(verdict(s),true);const copy=JSON.parse(JSON.stringify(s));assert.equal(verdict(copy),true);
 E.playTo(copy,6);assert.equal(verdict(copy),true,'and they keep playing');
});
test('changing captain costs what the locker room says it does',()=>{
 assert.deepEqual(E.CAPTAIN_COST,{morale:4,chem:2});
 const s=fresh(6);const [a,b]=s.players;const m=b.morale,c=s.chemistry;
 E.setCaptain(s,a.id);assert.equal(s.chemistry,c,'the first choice is free');
 const am=a.morale;E.setCaptain(s,b.id);assert.equal(a.morale,am-E.CAPTAIN_COST.morale);assert.equal(s.chemistry,c-E.CAPTAIN_COST.chem);assert.equal(b.morale,m);
});
