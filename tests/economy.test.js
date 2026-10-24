import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as E from '../src/engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const game=(diff='standard',seed=42)=>{const s=E.createGame(data,'Econ',diff,seed);E.autoLineup(s);return s;};
const play=s=>{E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);};
const awayIndex=s=>s.schedule.findIndex(g=>g.home===false);

test('income is base + fans/10 (capped) + win bonus; costs are upkeep and away travel',()=>{
 const s=game(),home={home:true},away={home:false};
 assert.deepEqual(E.gameIncome(s,true,home),{base:120,fans:12,bonus:70,income:202,upkeep:0,travel:0,net:202});
 assert.equal(E.gameIncome(s,false,home).net,132);
 s.fans=5000;assert.equal(E.gameIncome(s,false,home).fans,E.ECON.fansCap);
 s.assistant='culture';assert.equal(E.gameIncome(s,true,away).net,120+60+70-30-40);
 s.fans=0;assert.equal(E.gameIncome(s,false,undefined).net,120-30);
});
test('a played game pays income, upkeep and travel, and writes a budget line to the decision trail',()=>{
 const s=game();s.assistant='development';const away=s.schedule[0].home===false;const t0=s.tokens,fans=s.fans;play(s);
 const won=s.results[0].won,exp=E.gameIncome({...s,fans},won,s.schedule[0]).net;
 assert.equal(s.tokens-t0,exp);assert.equal(away,s.schedule[0].home===false);
 const b=s.log.find(l=>l.k==='budget');assert.ok(b);assert.equal(b.p.net,exp);assert.equal(b.p.upkeep,30);assert.ok(E.validSave(s));
});
test('tokens never drop below zero',()=>{const s=game();s.assistant='culture';s.tokens=0;play(s);assert.ok(s.tokens>=0);});
test('upgrades are bought once, for their price, and recorded in the trail',()=>{
 const s=game();s.tokens=2000;
 for(const u of E.UPGRADES){assert.ok(u.cost>=200&&u.cost<=500);const before=s.tokens;E.buyUpgrade(s,u.key);assert.equal(s.tokens,before-u.cost);assert.ok(E.hasUpgrade(s,u.key));assert.equal(s.log[0].k,'upgrade');assert.equal(s.log[0].p.item,u.key);assert.throws(()=>E.buyUpgrade(s,u.key),/already own/);}
 assert.equal(s.actions,3,'buying does not use a preparation slot');assert.throws(()=>E.buyUpgrade(s,'nope'),/unavailable/);
 const poor=game();poor.tokens=100;assert.throws(()=>E.buyUpgrade(poor,'film'),/Not enough program tokens/);assert.equal(poor.upgrades,undefined);
 assert.ok(E.validSave(s));
});
test('Film room makes scouting free; Training facility adds 10% to skill gains',()=>{
 const a=game(),b=game();b.tokens=1000;E.buyUpgrade(b,'film');const t=b.tokens;E.scout(b);assert.equal(b.tokens,t);E.scout(a);assert.equal(a.tokens,950);
 const c=game(),d=game();d.tokens=1000;E.buyUpgrade(d,'facility');E.train(c,'shooting',0);E.train(d,'shooting',0);
 const gc=c.players[0].skill-c.players[0].skill0,gd=d.players[0].skill-d.players[0].skill0;assert.ok(Math.abs(gd/gc-1.1)<.06,`${gd} vs ${gc}`);
});
test('Nutrition plan adds energy after a game and Tutor center halves the GPA lost',()=>{
 const a=game(),b=game();b.tokens=2000;E.buyUpgrade(b,'nutrition');E.buyUpgrade(b,'tutor');
 const ga=a.players.map(p=>p.gpa),gb=b.players.map(p=>p.gpa);play(a);play(b);
 const pa=a.players.find(p=>p.games>0&&b.players.find(q=>q.id===p.id).games>0);const pb=b.players.find(p=>p.id===pa.id);
 assert.ok(pa&&pb.games===pa.games);
 const lostA=ga[a.players.indexOf(pa)]-pa.gpa;const lostB=gb[b.players.indexOf(pb)]-pb.gpa;assert.ok(lostB<lostA&&Math.abs(lostB*2-lostA)<.02,`${lostA} ${lostB}`);
});
test('upgrades and the season seed are optional in saves and validated when present',()=>{
 const s=game();assert.ok(E.validSave(s));const old=structuredClone(s);delete old.upgrades;delete old.seed0;assert.ok(E.validSave(old),'older saves still load');
 for(const bad of [['film','film'],['nope'],'film',[1],['film','facility','nutrition','tutor','film']]){const x=structuredClone(s);x.upgrades=bad;assert.equal(E.validSave(x),false,JSON.stringify(bad));}
 for(const bad of [-1,1.5,2**32,'7',null]){const x=structuredClone(s);x.seed0=bad;assert.equal(E.validSave(x),false,String(bad));}
 const ok=structuredClone(s);ok.upgrades=['tutor','film'];assert.ok(E.validSave(ok));
});
test('season codes round-trip, are strict, and rebuild the same starting season',()=>{
 for(const [diff,seed] of [['rookie',0],['standard',1],['elite',4294967295],['standard',123456789]]){const s=E.createGame(data,'C',diff,seed),code=E.seasonCode(s);assert.match(code,/^KNG-[CJV]-[0-9A-Z]{1,7}$/);assert.deepEqual(E.parseSeasonCode(code),{difficulty:diff,seed});}
 assert.equal(E.seasonCode(E.createGame(data,'C','standard',255)),'KNG-J-73');
 assert.deepEqual(E.parseSeasonCode(' kng-v-73 '),{difficulty:'elite',seed:255},'case and spaces are forgiven');
 for(const bad of ['','KNG','KNG-J','KNG-J-','KNG-X-73','KNG-J-073','KNG-J-ZZZZZZZ','KNG-J-1A2B3C4D','KNG-J-7 3','KNG_J_73','XKNG-J-73','KNG-J-73-1','KNG-J-7!',null,undefined,42])assert.equal(E.parseSeasonCode(bad),null,String(bad));
 const a=E.createGame(data,'A','standard',777),code=E.seasonCode(a);play(a);play(a);assert.equal(E.seasonCode(a),code,'the code survives playing');
 const p=E.parseSeasonCode(code),b=E.createGame(data,'B',p.difficulty,p.seed);assert.deepEqual(b.players.map(x=>x.skill),E.createGame(data,'A','standard',777).players.map(x=>x.skill));
 assert.equal(E.seasonCode({difficulty:'standard',seed:5}),null,'an old save has no code');
});
test('the next-step nudge follows its priority order',()=>{
 const s=game();
 assert.equal(E.nextStep(s).id,'practice');assert.equal(E.nextStep(s).n,3);
 E.train(s,'bond');assert.equal(E.nextStep(s).id,'scout','some slots left and not scouted: scout');
 E.scout(s);assert.equal(E.nextStep(s).id,'practice','scouted with slots left: practice again');
 E.train(s,'bond');assert.equal(E.nextStep(s).id,'tipoff','no slots left');
 s.players.find(p=>p.starter).gpa=1;assert.equal(E.nextStep(s).id,'issues','ineligible starters come before slots');
 E.autoLineup(s);s.players.forEach(p=>{p.starter=false;p.minutes=0;});assert.equal(E.nextStep(s).id,'lineup');
 E.autoLineup(s);s.pendingEvent={id:'x',params:{}};assert.equal(E.nextStep(s).id,'inbox','inbox first of all');assert.equal(E.nextStep(s).action,'inbox-open');
 s.pendingEvent=null;
 const g=game();play(g);g.press=null;assert.equal(E.nextStep(g).id,'press');g.press={week:g.week,questions:[],done:true};assert.equal(E.nextStep(g).id,'practice');
 E.startMatch(g);assert.equal(E.nextStep(g).id,'live');while(g.match)E.possession(g);
 const f=game();f.finished=true;assert.deepEqual(E.nextStep(f),{id:'finished',view:'season'});
 for(const x of [s,g,f])assert.ok(E.nextStep(x).view||E.nextStep(x).action);
});
test('the tip-off preview reports strength, scouted style, energy, chemistry, timeouts, travel and modifiers',()=>{
 const s=game();let v=E.tipoffPreview(s);assert.equal(v.style,null);assert.equal(v.timeouts,3);assert.equal(v.chemistry,Math.round(s.chemistry));assert.deepEqual(v.mods,[]);assert.equal(v.effective,v.rating);
 s.nextMods=null;E.addMods(s,{oppRating:2,offense:1});E.scout(s);v=E.tipoffPreview(s);assert.ok(['perimeter','paint','transition'].includes(v.style));assert.equal(v.effective,Math.round((v.rating+2)*10)/10);assert.equal(v.mods.length,2);
 const i=awayIndex(s);s.week=i;assert.equal(E.tipoffPreview(s).away,true);assert.equal(E.tipoffPreview(s).travel,40);
});
test('the written-out shot model reproduces the chance of simulated Kangs shots',()=>{
 for(const diff of ['rookie','standard','elite']){const s=game(diff,5);E.startMatch(s);for(let i=0;i<40;i++)E.possession(s);
  for(const ev of s.match.events){const p=ev.plays[0];assert.equal(Math.round(E.modelChance(p.impacts,{three:p.three,difficulty:diff})*100),p.shotChance);}}
 const snap=E.modelSnapshot(game());assert.equal(snap.base,43);assert.equal(snap.miss,-4);assert.equal(snap.threeMiss,-7);assert.equal(snap.min,16);assert.equal(snap.max,86);assert.ok(snap.before>16&&snap.before<86);
});
test('the title-rate band holds for a player who buys nothing (the mix strategy)',()=>{
 // Economy changes only move tokens, so a practice-only season is decided exactly as before.
 let champs=0;for(let seed=1;seed<=20;seed++){const s=game('rookie',seed);let g=0;while(!s.finished&&g++<20){if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');play(s);}if(s.champion)champs++;}
 assert.ok(champs>=5,`${champs} of 20`);
});
