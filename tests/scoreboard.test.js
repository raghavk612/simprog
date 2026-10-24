import test from 'node:test';import assert from 'node:assert/strict';
import {scoreboardData,boardGame} from '../src/scoreboard.js';

const ev=n=>({number:n,home:2*n,visitor:n,away:1,points:2,id:1,jersey:11});
const finalGame={opponent:'Liberty',week:0,home:60,away:50,won:true,events:[ev(1),ev(2)],box:{},line:{1:{pts:20}},stats:{home:{rebounds:30},away:{rebounds:20}}};
const state=(o={})=>({week:1,finished:false,match:null,results:[finalGame],schedule:[{opponent:'Liberty'},{opponent:'Skyline'}],players:[{id:1,number:11}],...o});

test('before tip-off the board names the next opponent at 0-0, not the previous final',()=>{
 const d=scoreboardData(state(),60,50);
 assert.equal(d.away,'SKYLINE');assert.equal(d.opponent,'Skyline');
 assert.equal(d.homeScore,'0');assert.equal(d.awayScore,'0');
 assert.equal(d.final,false);assert.equal(d.pre,true);assert.equal(d.live,false);
 assert.equal(d.plyr,null);assert.equal(d.statHome,'–');assert.equal(d.period,'–');assert.equal(d.clock,'8:00');
});
test('a season with no games played also reads 0-0 for the first opponent',()=>{
 const d=scoreboardData(state({week:0,results:[]}));assert.equal(d.opponent,'Liberty');assert.equal(d.homeScore,'0');assert.equal(d.pre,true);
});
test('a finished season keeps the last final on the board',()=>{
 const d=scoreboardData(state({finished:true,week:2}),60,50);assert.equal(d.final,true);assert.equal(d.pre,false);assert.equal(d.opponent,'Liberty');assert.equal(d.homeScore,'60');
});
test('a live match and a replayed possession are unaffected',()=>{
 const m={home:10,away:8,possession:4,timeouts:2,events:[ev(1)],stats:null};
 const live=scoreboardData(state({match:m}),10,8);assert.equal(live.pre,false);assert.equal(live.live,true);assert.equal(live.opponent,'Skyline');assert.equal(live.homeScore,'10');
 const replay=scoreboardData(state(),4,2,finalGame.events[0]);assert.equal(replay.pre,false);assert.equal(replay.opponent,'Liberty');assert.equal(replay.live,true);
});
test('boardGame names the opponent for the visitors on the court',()=>{
 assert.equal(boardGame(state()).opponent,'Skyline');
 assert.equal(boardGame(state(),finalGame.events[1]).opponent,'Liberty','after the week has advanced, a possession still belongs to its own game');
 assert.equal(boardGame(null).opponent,'Guest');
});
