import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';import * as V from '../src/events.js';import * as P from '../src/press.js';
// Hostile imported saves: the optional fields added with the inbox, press conference, captain, player-of-the-game and
// development features (captain, pendingEvent, eventLog, press, nextMods, match.mods, player.skill0, result.pog).
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const fresh=(seed=9,diff='standard')=>{const s=E.createGame(data,'Hostile',diff,seed);E.autoLineup(s);return s;};
const prepare=s=>{if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');};
const playGame=s=>{E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);};
const clone=x=>structuredClone(x);
// validSave must answer true/false, never throw. A throw is reported as the string 'threw' so tests can name it.
const verdict=s=>{try{return E.validSave(s);}catch{return 'threw';}};
const ok=(s,msg)=>assert.equal(verdict(s),true,msg);
const bad=(base,mutate,msg)=>{const s=clone(base);mutate(s);assert.equal(verdict(s),false,msg);};
const MARKUP='<img src=x onerror=alert(1)>';

// A mid-season save that has every new field populated.
function season(){
 const s=fresh();E.setCaptain(s,s.players.find(p=>p.starter).id);
 let guard=0;
 while(!s.eventLog?.length&&guard++<20){prepare(s);playGame(s);if(V.rollEvent(s)){const i=V.previewOptions(s).findIndex(o=>o.available);V.resolveEvent(s,i);}}
 assert.ok(s.eventLog?.length,'fixture: an event was resolved');
 guard=0;while(!s.pendingEvent&&guard++<20){prepare(s);playGame(s);V.rollEvent(s);}
 assert.ok(s.pendingEvent,'fixture: an event is waiting');
 P.startPress(s);E.addMods(s,{chem:5,offense:2,defense:-1});
 return s;
}
// A live game: captain set, a next-game modifier consumed into match.mods, and a few possessions played.
function live(){
 const s=fresh(11);E.setCaptain(s,s.players.find(p=>p.starter).id);prepare(s);playGame(s);
 prepare(s);E.addMods(s,{offense:3,defense:-2,oppRating:1});E.autoLineup(s);E.startMatch(s);for(let i=0;i<8;i++)E.possession(s);
 assert.ok(s.match&&s.match.mods,'fixture: live match with mods');return s;
}
const S=season(),L=live();

test('valid states with every new field populated pass',()=>{
 ok(S);ok(L);
 assert.notEqual(S.captain??null,null);assert.ok(S.pendingEvent);assert.ok(S.eventLog.length);assert.ok(S.press);assert.ok(S.nextMods);
 assert.ok(L.match.mods);assert.ok(S.players.every(p=>typeof p.skill0==='number'));assert.ok(S.results.every(r=>r.pog&&typeof r.pog.id==='number'));
 ok(JSON.parse(JSON.stringify(S)));ok(JSON.parse(JSON.stringify(L)));
});

test('old saves lacking all of the new fields still pass; explicit nulls are accepted where the engine uses them',()=>{
 for(const base of [S,L]){
  const old=clone(base);
  for(const k of ['captain','pendingEvent','eventLog','press','nextMods'])delete old[k];
  if(old.match)delete old.match.mods;
  for(const p of old.players)delete p.skill0;for(const p of old.pool)delete p.skill0;
  for(const r of old.results)delete r.pog;
  ok(old,'no new field at all');
 }
 for(const k of ['captain','pendingEvent','press','nextMods']){const s=clone(S);s[k]=null;ok(s,`${k}: null`);}
 const m=clone(L);m.match.mods=null;ok(m,'match.mods: null');
 const e=clone(S);e.eventLog=[];ok(e,'eventLog: []');
 const q=clone(S);q.press={done:true,questions:[]};ok(q,'a finished press conference with no questions');
 const w=clone(S);w.pendingEvent={id:'walkon'};ok(w,'pendingEvent without params');
});

test('captain: must be the id of a player on the roster',()=>{
 for(const [label,v] of [['string',"x"],['numeric string',String(S.players[0].id)],['unknown id',99999],['negative',-1],['fraction',S.players[0].id+.5],['huge',1e308],['Infinity',Infinity],['NaN',NaN],['object',{}],['array',[S.players[0].id]],['boolean',true],['markup',MARKUP]])
  bad(S,s=>{s.captain=v;},`captain ${label}`);
 const gone=clone(S);const id=gone.captain;gone.players=gone.players.filter(p=>p.id!==id);gone.players.length>=5&&assert.equal(verdict(gone),false,'captain who left the roster');
 const z=clone(S);z.captain=z.players[0].id;ok(z,'any rostered player, including a bench player, may captain');
});

test('nextMods and match.mods: known keys, finite numbers, bounded size',()=>{
 const cases=(get)=>[['string','abc'],['number',5],['array',[1,2]],['unknown key',{nope:1}],['markup key',{[MARKUP]:1}],['string value',{chem:'5'}],['markup value',{chem:MARKUP}],['boolean value',{chem:true}],['null value',{chem:null}],['object value',{chem:{}}],['array value',{chem:[1]}],
  ['huge',{chem:1e9}],['huge negative',{offense:-1e9}],['1e308',{fans:1e308}],['Infinity',{chem:Infinity}],['NaN',{defense:NaN}],['just past the sanity cap',{fans:61}]];
 for(const [label,v] of cases())bad(S,s=>{s.nextMods=v;},`nextMods ${label}`);
 for(const [label,v] of cases())bad(L,s=>{s.match.mods=v;},`match.mods ${label}`);
 // an unknown key mixed in with valid ones
 bad(S,s=>{s.nextMods={...s.nextMods,evil:1};},'nextMods valid + unknown key');
 bad(L,s=>{s.match.mods={...s.match.mods,evil:1};},'match.mods valid + unknown key');
 ok((()=>{const s=clone(S);s.nextMods={chem:8,morale:-8,energy:8,fans:-40,offense:4,defense:-4,oppRating:4};return s;})(),'every limit at its extreme');
});
test('nextMods and match.mods: keys inherited from Object.prototype are not mod names',()=>{
 for(const k of ['constructor','toString','valueOf','hasOwnProperty','isPrototypeOf']){
  bad(S,s=>{s.nextMods={[k]:1};},`nextMods.${k}`);
  bad(L,s=>{s.match.mods={[k]:1};},`match.mods.${k}`);
 }
 bad(S,s=>{s.nextMods=JSON.parse('{"__proto__":1}');},'nextMods.__proto__ as an own key');
});

test('pendingEvent: short lowercase id, a few small scalar params, nothing else',()=>{
 const set=pe=>s=>{s.pendingEvent=pe;};
 for(const [label,v] of [['string','walkon'],['number',7],['array',['walkon']],['empty object',{}],['id missing',{params:{}}],['id number',{id:5}],['id null',{id:null}],['id empty',{id:''}],['id uppercase',{id:'WalkOn'}],['id with space',{id:'walk on'}],['id with punctuation',{id:'Bad Id!'}],['id too long',{id:'a'.repeat(25)}],['id huge',{id:'a'.repeat(100000)}],['id markup',{id:MARKUP}],['id object',{id:{}}],['id array',{id:['walkon']}],
  ['params string',{id:'walkon',params:'x'}],['params array',{id:'walkon',params:[1]}],['params number',{id:'walkon',params:5}],
  ['too many params',{id:'walkon',params:Object.fromEntries(Array.from({length:9},(_,i)=>['k'+i,i]))}],
  ['param key markup',{id:'walkon',params:{[MARKUP]:1}}],['param key too long',{id:'walkon',params:{['k'.repeat(13)]:1}}],['param key empty',{id:'walkon',params:{'':1}}],['param key with dash',{id:'walkon',params:{'a-b':1}}],
  ['param string too long',{id:'walkon',params:{name:'x'.repeat(61)}}],['param string huge',{id:'walkon',params:{name:'x'.repeat(1e6)}}],
  ['param Infinity',{id:'walkon',params:{cost:Infinity}}],['param NaN',{id:'walkon',params:{cost:NaN}}],['param null',{id:'walkon',params:{cost:null}}],
  ['nested object param',{id:'walkon',params:{name:{evil:1}}}],['nested array param',{id:'walkon',params:{name:['a']}}],['deeply nested',{id:'walkon',params:{a:{b:{c:{}}}}}]])
  bad(S,set(v),`pendingEvent ${label}`);
 const w=clone(S);w.pendingEvent={id:'walkon',params:{name:'Sam',cost:120,flag:true}};ok(w,'a normal event');
 const edge=clone(S);edge.pendingEvent={id:'a'.repeat(24),params:Object.fromEntries(Array.from({length:8},(_,i)=>['k'+i,'x'.repeat(60)]))};ok(edge,'limits are inclusive');
});
test('pendingEvent: unknown top-level keys are rejected',()=>{
 bad(S,s=>{s.pendingEvent={...s.pendingEvent,evil:MARKUP};},'pendingEvent extra key');
});
test('pendingEvent: markup inside a param string is rejected',()=>{
 bad(S,s=>{s.pendingEvent={id:'walkon',params:{name:MARKUP}};},'pendingEvent param markup');
});

test('eventLog: at most 60 entries, each a week 0-41 plus short ids',()=>{
 const e={week:3,id:'walkon',choice:'sign'};
 for(const [label,v] of [['string','x'],['object',{}],['number',3],['null',null],['61 entries',Array.from({length:61},()=>e)],['huge array',Array.from({length:100000},()=>e)],
  ['string entry',['x']],['number entry',[3]],['empty entry',[{}]],
  ['week string',[{...e,week:'3'}]],['week fraction',[{...e,week:1.5}]],['week negative',[{...e,week:-1}]],['week past season',[{...e,week:42}]],['week huge',[{...e,week:1e9}]],['week Infinity',[{...e,week:Infinity}]],['week NaN',[{...e,week:NaN}]],['week missing',[{id:'walkon',choice:'sign'}]],
  ['id markup',[{...e,id:MARKUP}]],['id long',[{...e,id:'a'.repeat(25)}]],['id number',[{...e,id:5}]],['id uppercase',[{...e,id:'WALKON'}]],['id missing',[{week:3,choice:'sign'}]],
  ['choice markup',[{...e,choice:MARKUP}]],['choice long',[{...e,choice:'a'.repeat(1000)}]],['choice object',[{...e,choice:{}}]],['choice missing',[{week:3,id:'walkon'}]],
  ['one bad among good',[e,e,{...e,week:99}]]])
  bad(S,s=>{s.eventLog=v;},`eventLog ${label}`);
 const full=clone(S);full.eventLog=Array.from({length:60},(_,i)=>({week:i%42,id:'walkon',choice:'sign'}));ok(full,'exactly 60 entries');
 const edge=clone(S);edge.eventLog=[{week:0,id:'a',choice:'b'},{week:41,id:'z'.repeat(24),choice:'9'.repeat(24)}];ok(edge,'week 0 and 41, ids of 1 and 24 characters');
});
test('eventLog and press: null entries are rejected cleanly instead of throwing',()=>{
 bad(S,s=>{s.eventLog=[null];},'eventLog [null]');
 bad(S,s=>{s.press={done:false,questions:[null]};},'press.questions [null]');
});
test('eventLog entries and press objects: unknown keys are rejected',()=>{
 bad(S,s=>{s.eventLog=[{week:1,id:'walkon',choice:'sign',evil:MARKUP}];},'eventLog entry extra key');
 bad(S,s=>{s.press={...s.press,evil:MARKUP};},'press extra key');
 bad(S,s=>{s.press.questions[0].evil=MARKUP;},'press question extra key');
});

test('press: boolean done, at most 5 questions with short ids, small params and an optional short answer',()=>{
 const q=()=>clone(S.press.questions[0]);
 const set=p=>s=>{s.press=p;};
 for(const [label,v] of [['string','x'],['number',1],['array',[]],['empty object',{}],['done missing',{questions:[]}],['done string',{done:'false',questions:[]}],['done number',{done:0,questions:[]}],['done null',{done:null,questions:[]}],
  ['questions missing',{done:false}],['questions object',{done:false,questions:{}}],['questions string',{done:false,questions:'abc'}],['questions null',{done:false,questions:null}],
  ['6 questions',{done:false,questions:Array.from({length:6},q)}],['huge questions',{done:false,questions:Array.from({length:100000},q)}],
  ['question string',{done:false,questions:['x']}],['question number',{done:false,questions:[3]}],['question empty',{done:false,questions:[{}]}],
  ['q id markup',{done:false,questions:[{...q(),id:MARKUP}]}],['q id long',{done:false,questions:[{...q(),id:'a'.repeat(25)}]}],['q id number',{done:false,questions:[{...q(),id:1}]}],['q id uppercase',{done:false,questions:[{...q(),id:'WinWhy'}]}],['q id missing',{done:false,questions:[{params:{},answer:null}]}],
  ['q params string',{done:false,questions:[{...q(),params:'x'}]}],['q params array',{done:false,questions:[{...q(),params:[1]}]}],['q params too many',{done:false,questions:[{...q(),params:Object.fromEntries(Array.from({length:9},(_,i)=>['k'+i,i]))}]}],
  ['q param key markup',{done:false,questions:[{...q(),params:{[MARKUP]:1}}]}],['q param string long',{done:false,questions:[{...q(),params:{name:'x'.repeat(61)}}]}],['q param huge string',{done:false,questions:[{...q(),params:{name:'x'.repeat(1e6)}}]}],['q param Infinity',{done:false,questions:[{...q(),params:{pts:Infinity}}]}],['q param NaN',{done:false,questions:[{...q(),params:{pts:NaN}}]}],['q param nested',{done:false,questions:[{...q(),params:{pts:{evil:1}}}]}],['q param array',{done:false,questions:[{...q(),params:{pts:[1]}}]}],['q param null',{done:false,questions:[{...q(),params:{pts:null}}]}],
  ['answer markup',{done:false,questions:[{...q(),answer:MARKUP}]}],['answer long',{done:false,questions:[{...q(),answer:'a'.repeat(25)}]}],['answer number',{done:false,questions:[{...q(),answer:7}]}],['answer object',{done:false,questions:[{...q(),answer:{}}]}],['answer uppercase',{done:false,questions:[{...q(),answer:'Team'}]}],['answer empty',{done:false,questions:[{...q(),answer:''}]}],
  ['one bad among good',{done:false,questions:[q(),q(),{...q(),id:'Bad Id'}]}]])
  bad(S,set(v),`press ${label}`);
 const five=clone(S);five.press={...five.press,questions:Array.from({length:5},(_,i)=>({...q(),answer:i%2?'team':null}))};ok(five,'exactly 5 questions, answered or not');
 const done=clone(S);done.press={...done.press,done:true,questions:done.press.questions.map(x=>({...x,answer:'team'}))};ok(done,'a finished press conference');
});
test('press: markup inside a question param string is rejected',()=>{
 bad(S,s=>{s.press.questions[0].params.name=MARKUP;},'press param markup');
});

test('player.skill0: optional finite number from 0 to 100, on roster and pool players',()=>{
 for(const [label,v] of [['string','50'],['markup',MARKUP],['null',null],['boolean',true],['object',{}],['array',[50]],['negative',-1],['101',101],['huge',1e9],['1e308',1e308],['-1e308',-1e308],['Infinity',Infinity],['-Infinity',-Infinity],['NaN',NaN]]){
  bad(S,s=>{s.players[0].skill0=v;},`skill0 ${label}`);
  bad(S,s=>{s.players.at(-1).skill0=v;},`last player skill0 ${label}`);
 }
 const s=clone(S);s.players[0].skill0=0;s.players[1].skill0=100;s.players[2].skill0=55.5;ok(s,'0, 100 and a fraction are fine');
 const pool=clone(S);if(pool.pool.length){bad(pool,x=>{x.pool[0].skill0='x';},'pool player skill0 string');}
 bad(S,s=>{s.players[0].skill0=undefined;s.players[0].skill0='';},'skill0 empty string');
});

test('result.pog: integer id and five bounded numeric stats',()=>{
 const pog=()=>clone(S.results[0].pog);
 for(const [label,v] of [['string','x'],['number',3],['array',[1,2,3]],['null',null],['false',false],['empty object',{}],
  ['id string',{...pog(),id:'8'}],['id fraction',{...pog(),id:1.5}],['id markup',{...pog(),id:MARKUP}],['id NaN',{...pog(),id:NaN}],['id Infinity',{...pog(),id:Infinity}],['id missing',(({id,...r})=>r)(pog())],
  ...['pts','reb','ast','stl','blk'].flatMap(k=>[[`${k} string`,{...pog(),[k]:'x'}],[`${k} markup`,{...pog(),[k]:MARKUP}],[`${k} negative`,{...pog(),[k]:-1}],[`${k} 301`,{...pog(),[k]:301}],[`${k} huge`,{...pog(),[k]:1e9}],[`${k} 1e308`,{...pog(),[k]:1e308}],[`${k} Infinity`,{...pog(),[k]:Infinity}],[`${k} NaN`,{...pog(),[k]:NaN}],[`${k} null`,{...pog(),[k]:null}],[`${k} missing`,(r=>{delete r[k];return r;})(pog())]])])
  bad(S,s=>{s.results[0].pog=v;},`pog ${label}`);
 bad(S,s=>{s.results.at(-1).pog=null;},'last result pog null');
 const edge=clone(S);edge.results[0].pog={id:0,pts:0,reb:300,ast:300,stl:0,blk:300};ok(edge,'limits are inclusive');
});
test('result.pog: unknown keys are rejected',()=>{
 bad(S,s=>{s.results[0].pog.evil=MARKUP;},'pog extra key');
 bad(S,s=>{s.results[0].pog.name=MARKUP;},'pog name');
});

test('one hostile field is enough to reject an otherwise valid save, whichever field it is',()=>{
 const muts={captain:s=>{s.captain='x';},nextMods:s=>{s.nextMods={chem:1e9};},eventLog:s=>{s.eventLog=Array.from({length:61},()=>({week:1,id:'a',choice:'b'}));},press:s=>{s.press.questions.length=0;s.press.done='yes';},pendingEvent:s=>{s.pendingEvent={id:MARKUP};},skill0:s=>{s.players[3].skill0=-5;},pog:s=>{s.results[0].pog.pts='<b>';}};
 for(const [k,m] of Object.entries(muts))bad(S,m,k);
 bad(L,s=>{s.match.mods={offense:Infinity};},'match.mods');
 ok(S);ok(L);
});

test('a full season with the inbox and press auto-resolved stays valid after a JSON round-trip, on every level',()=>{
 let events=0,pressed=0,logged=0;
 for(const diff of ['rookie','standard','elite'])for(const seed of [1,2,3,4]){
  let s=fresh(seed,diff),g=0;
  while(!s.finished&&g++<40){
   prepare(s);playGame(s);
   s=JSON.parse(JSON.stringify(s));ok(s,`${diff} ${seed} after game ${g}`);
   if(s.finished)break;
   if(P.startPress(s)){pressed++;s=JSON.parse(JSON.stringify(s));ok(s,`${diff} ${seed} press open`);s.press.questions.forEach((q,i)=>P.answerPress(s,i,P.ANSWER_IDS[q.id][(seed+i)%3]));s=JSON.parse(JSON.stringify(s));ok(s,`${diff} ${seed} press answered`);}
   if(V.rollEvent(s)){events++;s=JSON.parse(JSON.stringify(s));ok(s,`${diff} ${seed} event pending`);V.resolveEvent(s,V.previewOptions(s).findIndex(o=>o.available));s=JSON.parse(JSON.stringify(s));ok(s,`${diff} ${seed} event resolved`);}
   logged=Math.max(logged,s.eventLog?.length||0);
  }
  assert.ok(s.finished,`${diff} ${seed} finishes`);
  const rt=JSON.parse(JSON.stringify(s));ok(rt,`${diff} ${seed} final`);assert.deepEqual(rt,s,'a round-trip changes nothing');
  assert.ok(rt.results.every(r=>r.pog),'every game has a player of the game');
 }
 assert.ok(events>5&&pressed>5&&logged>=1,`the run exercised the new fields (events ${events}, press ${pressed}, log ${logged})`);
 // and a round-trip taken mid-game, with a modifier already folded into match.mods
 const m=JSON.parse(JSON.stringify(L));ok(m);while(m.match)E.possession(m);ok(JSON.parse(JSON.stringify(m)));
});
