import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';
// Live-game features: quarter-break report and suggested adjustments, and the post-game highlights ranking.
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const game=(seed=42)=>{const s=E.createGame(data,'Live',  'standard',seed);E.autoLineup(s);return s;};
const upTo=(s,n)=>{E.startMatch(s);while(s.match.possession<n)E.possession(s);return s;};
const play=(o={})=>({outcome:'miss',three:false,points:0,kind:'catch',...o});
const ev=(h={},a={},i=0)=>({home:10+i,visitor:8+i,points:h.points||0,plays:[play(h),play(a)]});
/* A quarter-break state with hand-made shots and stats so each rule can be tested on its own. */
function scene({awayThrees=[0,0],reb=[10,10],lead=0,energy=80,tactic='balanced',pace='steady'}={}){
 const s=upTo(game(),16),m=s.match;
 m.events=[];for(let i=0;i<awayThrees[1];i++)m.events.push(ev({},{outcome:i<awayThrees[0]?'made':'miss',three:true,points:i<awayThrees[0]?3:0}));
 m.stats={home:{assists:3,blocks:1,steals:2,rebounds:reb[0]},away:{assists:2,blocks:1,steals:1,rebounds:reb[1]}};
 m.home=30;m.away=30+lead*-1;m.tactic=tactic;m.pace=pace;s.players.forEach(p=>{p.energy=energy;});return s;
}
const ids=s=>E.quarterReport(s).suggestions.map(x=>x.id);

test('quarterReport is empty outside a game and names the quarter that just ended',()=>{
 const s=game();assert.equal(E.quarterReport(s),null);E.startMatch(s);
 for(const [n,q] of [[16,1],[32,2],[48,3]]){while(s.match.possession<n)E.possession(s);const r=E.quarterReport(s);assert.equal(r.quarter,q);assert.equal(r.possession,n);assert.equal(r.home,s.match.home);assert.equal(r.away,s.match.away);}
 assert.deepEqual(E.BREAKS,[16,32,48]);
});
test('quarterReport team numbers agree with the stored line and stats',()=>{
 const s=upTo(game(7),32),r=E.quarterReport(s),m=s.match,L=Object.values(m.line);
 const sum=k=>L.reduce((a,l)=>a+l[k],0);
 assert.equal(r.teams.home.fga,sum('fga'));assert.equal(r.teams.home.fgm,sum('fgm'));assert.equal(r.teams.home.tpa,sum('tpa'));assert.equal(r.teams.home.tpm,sum('tpm'));
 for(const k of ['reb','ast','stl','blk'])assert.equal(r.teams.home[k],sum(k),k);
 assert.equal(r.teams.away.reb,m.stats.away.rebounds);assert.equal(r.teams.away.ast,m.stats.away.assists);
 for(const side of ['home','away']){const t=r.teams[side];assert.ok(t.fgm<=t.fga&&t.tpm<=t.tpa&&t.tpa<=t.fga&&t.tpm<=t.fgm);}
 const awayPts=m.events.reduce((a,e)=>a+e.plays[1].points,0);assert.equal(awayPts,m.away);
});
test('suggestion rules: hot three-point shooters, tired legs, rebounding, trailing, rested legs',()=>{
 assert.deepEqual(ids(scene({awayThrees:[6,9]})),['threes','push']);
 assert.equal(E.quarterReport(scene({awayThrees:[6,9]})).suggestions[0].tactic,'zone');
 assert.ok(!ids(scene({awayThrees:[2,9]})).includes('threes'),'cold shooters');
 assert.ok(!ids(scene({awayThrees:[3,4]})).includes('threes'),'too few attempts');
 assert.ok(!ids(scene({awayThrees:[6,9],tactic:'zone'})).includes('threes'),'already in a zone');
 const tired=E.quarterReport(scene({energy:50,pace:'fast'})).suggestions.find(x=>x.id==='tired');assert.equal(tired.pace,'steady');assert.equal(tired.p.energy,50);
 assert.ok(!ids(scene({energy:50,pace:'steady'})).includes('tired'),'already slow');
 assert.ok(!ids(scene({energy:80,pace:'fast'})).includes('tired'),'not tired');
 const boards=E.quarterReport(scene({reb:[8,14]})).suggestions.find(x=>x.id==='boards');assert.equal(boards.tactic,'pressure');assert.deepEqual(boards.p,{us:8,them:14});
 assert.ok(!ids(scene({reb:[8,10]})).includes('boards'),'a gap of two is not a battle');
 assert.ok(ids(scene({lead:-8})).includes('trailing'));assert.ok(!ids(scene({lead:-8,tactic:'pressure'})).includes('trailing'));assert.ok(!ids(scene({lead:-3})).includes('trailing'));
 assert.equal(E.quarterReport(scene({energy:90,pace:'steady'})).suggestions.find(x=>x.id==='push').pace,'fast');
 assert.ok(!ids(scene({energy:90,lead:8})).includes('push'),'no need to speed up when well ahead');
});
test('a scouted opponent adds the counter system; fallback never repeats the current setting',()=>{
 const s=scene();s.scouted=true;const style=E.opponent(s).style,want={perimeter:'zone',paint:'pressure',transition:'balanced'}[style];
 const c=E.quarterReport(s).suggestions.find(x=>x.id==='counter');
 if(want===s.match.tactic)assert.equal(c,undefined);else assert.equal(c.tactic,want);
 const u=scene();assert.ok(!ids(u).includes('counter'),'unscouted: nothing to counter');
 const b=scene({tactic:'perimeter',energy:70});assert.ok(ids(b).includes('balanced'));assert.ok(!ids(scene({tactic:'balanced',energy:70})).includes('balanced'));
});
test('every suggestion changes something, at most three are offered, and ids are unique',()=>{
 for(const seed of [1,2,3,4,5,6]){for(const n of E.BREAKS){const s=upTo(game(seed),n),m=s.match,r=E.quarterReport(s);
  assert.ok(r.suggestions.length<=3);assert.equal(new Set(r.suggestions.map(x=>x.id)).size,r.suggestions.length);
  for(const x of r.suggestions)assert.ok((x.tactic&&x.tactic!==m.tactic)||(x.pace&&x.pace!==m.pace),x.id);}}
});
test('applyAdjustment sets tactic or pace, writes one decision-trail line, and rejects unknown ids',()=>{
 const s=scene({awayThrees:[6,9],energy:50,pace:'fast'}),before=s.log.length,seed=s.seed;
 const e=E.applyAdjustment(s,'threes');assert.equal(s.match.tactic,'zone');assert.equal(s.match.pace,'fast');assert.equal(e.k,'adjustTactic');assert.deepEqual(e.p,{q:1,tactic:'zone'});assert.equal(s.log.length,before+1);assert.equal(s.log[0],e);
 E.applyAdjustment(s,'tired');assert.equal(s.match.pace,'steady');assert.equal(s.log[0].k,'adjustPace');
 assert.throws(()=>E.applyAdjustment(s,'nope'),/no longer available/);assert.throws(()=>E.applyAdjustment(game(),'tired'),/no longer available/);
 assert.equal(s.seed,seed,'adjusting never draws random numbers');assert.equal(s.log.length,before+2);
});
test('a real game saved after an adjustment still validates; malformed trail lines do not',()=>{
 let done=0;
 for(let seed=1;seed<=12&&!done;seed++){const s=upTo(game(seed),16),sg=E.quarterReport(s).suggestions[0];if(!sg)continue;
  const e=E.applyAdjustment(s,sg.id);assert.ok(['adjustTactic','adjustPace'].includes(e.k));assert.ok(E.validSave(s),`seed ${seed}`);
  assert.ok(E.validSave(JSON.parse(JSON.stringify(s))),'survives a save and load');
  const bad=structuredClone(s);bad.log[0].p={q:{x:1},tactic:'zone'};assert.equal(E.validSave(bad),false);
  while(s.match)E.possession(s);assert.ok(E.validSave(s));done++;}
 assert.ok(done,'at least one seed offers a suggestion at the first break');
});
test('the break is a pause only: reading reports changes nothing and the game plays out identically',()=>{
 const a=game(11),b=game(11);E.startMatch(a);E.startMatch(b);
 while(a.match)E.possession(a);
 while(b.match){if(E.BREAKS.includes(b.match.possession)){const snap=JSON.stringify(b.match);E.quarterReport(b);assert.equal(JSON.stringify(b.match),snap);}E.possession(b);}
 assert.deepEqual([b.results[0].home,b.results[0].away,b.seed],[a.results[0].home,a.results[0].away,a.seed]);
});
test('old saves without stored plays still produce a report',()=>{
 const s=upTo(game(3),16);s.match.events.forEach(e=>{delete e.plays;});delete s.match.stats;
 const r=E.quarterReport(s);assert.equal(r.teams.away.fga,0);assert.equal(r.teams.away.reb,0);assert.ok(Array.isArray(r.suggestions));
});
test('highlights: points plus dunk and three bonuses, Kangs blocks and steals, latest play wins ties',()=>{
 const events=[
  ev({outcome:'made',points:2,kind:'catch'}),                                   // 0: plain two = 2
  ev({outcome:'made',points:3,three:true,kind:'catch'}),                         // 1: three = 4
  ev({outcome:'made',points:2,kind:'dunk'}),                                     // 2: dunk = 4
  ev({},{outcome:'block'}),                                                      // 3: block = 3
  ev({},{outcome:'steal'}),                                                      // 4: steal = 2.5
  ev({outcome:'miss'}),                                                          // 5: nothing
  ev({outcome:'made',points:2,kind:'catch'},{outcome:'block'}),                  // 6: block 3 beats the two
 ];
 events[3].plays[1].defender='Jay';events[2].plays[0].player='Dunker';
 const top=E.highlights(events);
 assert.deepEqual(top.map(h=>h.i),[2,1,6]);                                       // dunk (latest of the 4s), three, then the block
 assert.deepEqual(top.map(h=>h.kind),['dunk','three','block']);
 assert.equal(top[0].player,'Dunker');assert.equal(top[0].score,4);assert.equal(top[0].points,2);
 assert.equal(E.highlights(events,5).length,5);assert.equal(E.highlights(events,10).length,6,'the empty possession is not a highlight');
 assert.equal(new Set(E.highlights(events,10).map(h=>h.i)).size,E.highlights(events,10).length,'one clip per possession');
 const d=E.highlights(events,10).find(h=>h.i===3);assert.equal(d.kind,'block');assert.equal(d.player,'Jay');assert.equal(d.points,0);
});
test('highlights cope with few or odd events and with real game results',()=>{
 assert.deepEqual(E.highlights([]),[]);assert.deepEqual(E.highlights(undefined),[]);assert.deepEqual(E.highlights([{home:1,visitor:0}]),[]);
 assert.equal(E.highlights([ev({outcome:'made',points:2})]).length,1);
 const s=game(5);E.startMatch(s);while(s.match)E.possession(s);const r=s.results[0],h=E.highlights(r.events);
 assert.ok(h.length>=1&&h.length<=3);assert.ok(h.every(x=>x.i>=0&&x.i<r.events.length&&r.events[x.i]));
 assert.deepEqual(h.map(x=>x.score),[...h.map(x=>x.score)].sort((a,b)=>b-a));
});
