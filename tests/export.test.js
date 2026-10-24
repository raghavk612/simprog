import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';
// B14: the season export stays far below the 2 MB import limit and re-imports as a valid save.
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const fullSeason=(difficulty,seed)=>{const s=E.createGame(data,'Export',difficulty,seed);E.autoLineup(s);E.playTo(s,99);return s;};

for(const difficulty of ['rookie','standard','elite']){
 test(`export of a full ${difficulty} season is under 1 MB and re-imports valid`,()=>{
  const s=fullSeason(difficulty,31);
  assert.ok(s.finished&&s.results.length>=10,'fixture: the season was played');
  const text=E.exportJson(s),old=JSON.stringify(s,null,2);
  assert.ok(text.length<1e6,`export is ${text.length} bytes`);
  assert.ok(text.length<old.length*.6,`export (${text.length}) is much smaller than the indented one (${old.length})`);
  assert.ok(!text.includes('\n'),'no indentation');
  const back=JSON.parse(text);
  assert.equal(E.validSave(back),true);
  assert.equal(back.results.length,s.results.length);
  assert.equal(back.wins,s.wins);
  for(const r of back.results)assert.ok(r.events.length<=E.EXPORT_EVENTS);
 });
}

test('exporting does not change the live save and keeps the last plays of each game',()=>{
 const s=fullSeason('standard',32),before=JSON.stringify(s),last=s.results.at(-1).events.at(-1);
 const back=JSON.parse(E.exportJson(s));
 assert.equal(JSON.stringify(s),before,'source state untouched');
 assert.deepEqual(back.results.at(-1).events.at(-1),last,'the final play (used by the board and replays) is kept');
});

test('a game in progress keeps its whole event list on export',()=>{
 const s=E.createGame(data,'Live','standard',33);E.autoLineup(s);E.startMatch(s);for(let i=0;i<30&&s.match;i++)E.possession(s);
 assert.ok(s.match.events.length>E.EXPORT_EVENTS,'fixture');
 const back=JSON.parse(E.exportJson(s));
 assert.equal(back.match.events.length,s.match.events.length);
 assert.equal(E.validSave(back),true);
});
