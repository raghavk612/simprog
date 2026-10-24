import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as E from '../src/engine.js';import {COMMENTARY,SHOTS,renderCommentary} from '../src/basketball.js';
import {setLanguage,LANGUAGES,section,has} from '../src/i18n/index.js';import {commentaryText,explanationText,logText,reasonText,feedLines} from '../src/narrative.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const codes=LANGUAGES.map(l=>l.code);

// Plays a whole season with every kind of decision, calling check() after each action so nothing is missed.
// The decision trail keeps only the latest 120 lines, so each week's lines are also copied into `collect`.
function season(seed,check,collect=[]){
 const s=E.createGame(data,'Narrative test','standard',seed);let guard=0;
 while(!s.finished&&guard++<32){
  if(s.week===0){E.hire(s,'culture');E.recruit(s,100);}
  if(s.week===1){E.release(s,100);}
  if(!s.conversation&&s.actions>0)E.talk(s,['listen','fundraise','academics'][s.week%3]);
  if(s.actions>0&&s.tokens>=50&&s.week%2===0)E.scout(s);
  if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');
  if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study');
  while(s.actions>0&&s.tokens>=100)E.train(s,s.chemistry<85?'bond':'shooting',s.week%2?'all':s.players[0].id);
  E.autoLineup(s);E.startMatch(s);let n=0;
  while(s.match&&n++<500){
   E.possession(s);if(s.match)check(s);
   if(n===6&&s.match&&s.match.timeouts>0)E.timeout(s,s.week%2?'calm':'belief');
   if(s.match)check(s);
  }
  collect.push(...s.log);
 }
 return s;
}

test('in English, text rebuilt from the stored records equals the text the engine wrote',async()=>{
 await setLanguage('en',{persist:false});
 let plays=0,logs=0,feeds=0;
 for(const seed of [3,11,29,57]){
  const s=season(seed,s=>{
   const m=s.match;assert.deepEqual(feedLines(m),m.feed);feeds++;
   const last=m.events.at(-1);for(const c of last.plays){assert.equal(commentaryText(c),c.commentary);plays++;}
   assert.equal(explanationText(last),last.explanation);
  });
  for(const l of s.log){assert.equal(logText(l),l.text);logs++;}
  for(const r of s.ripples)assert.equal(logText(r),r.detail);
  for(const r of s.results){assert.equal(reasonText(r),r.reason);for(const x of r.ripples)assert.equal(logText(x),x.detail);}
 }
 assert.ok(plays>400&&logs>40&&feeds>400,`${plays} plays, ${logs} log lines`);
});
test('the decision trail uses every kind of entry the engine can write',()=>{
 const kinds=new Set();
 for(const seed of [3,11,29,57,101,202]){const seen=[];season(seed,()=>{},seen);for(const l of seen)if(l.k)kinds.add(l.k);}
 for(const k of ['train','recruit','release','hire','talkListen','talkFundraise','talkAcademics','scout','tipoff','result'])assert.ok(kinds.has(k),k);
 for(const k of kinds)assert.ok(has(`log.${k}`),`no translation entry for log kind ${k}`);
});
test('every language can present every play, log line and result without leftover placeholders',async()=>{
 const logs=[];
 for(const seed of [3,57]){const s=season(seed,()=>{});logs.push(...s.log,...s.ripples,...s.results);}
 const staged=season(91,()=>{});
 for(const code of codes){
  await setLanguage(code,{persist:false});
  for(const l of staged.log){const text=logText(l);assert.ok(text&&!text.includes('{{'),`${code} ${l.k}: ${text}`);}
  for(const r of staged.results){assert.ok(!reasonText(r).includes('{{'));}
  // every template, for each shot type and outcome
  const T=section('cm');
  for(const kind of Object.keys(SHOTS))for(const outcome of ['made','miss','block','steal'])for(const lane of [1,-1]){
   const base={kind,lane,outcome,player:'Ana Gómez',defender:'North Creek #22',helper:'Lee Chen',rebounder:'North Creek #24',points:outcome==='made'?(SHOTS[kind].three?3:2):0,three:SHOTS[kind].three,assisted:outcome==='made'};
   const finishes=T.finish[base.points?(base.three?'three':(SHOTS[kind].like||kind)==='dunk'?'dunk':'two'):'miss'].length;
   const options=outcome==='steal'?T.steal.length:outcome==='block'?T.block.length:finishes;
   for(let a=0;a<options;a++)for(let b=0;b<T.lead[kind].length;b++){
    const cm=outcome==='steal'?[a]:[outcome==='block'?b:a,outcome==='block'?a:b];
    const text=renderCommentary(base,cm,T);
    assert.ok(text&&!text.includes('{{')&&text.includes('Ana Gómez'),`${code} ${kind} ${outcome}: ${text}`);
   }
  }
 }
 await setLanguage('en',{persist:false});
});
test('a language switch changes the narrative text, and names are preserved',async()=>{
 await setLanguage('en',{persist:false});
 const s=season(57,()=>{});const play=s.results[0].events.at(-1).plays[0],entry=s.log.find(l=>l.k==='tipoff');
 const english={play:commentaryText(play),log:logText(entry)};
 for(const code of codes.filter(c=>c!=='en')){
  await setLanguage(code,{persist:false});
  assert.notEqual(commentaryText(play),english.play,code);assert.ok(commentaryText(play).includes(play.player),`${code} keeps the player name`);
  assert.notEqual(logText(entry),english.log,code);assert.ok(logText(entry).includes(entry.p.opp),`${code} keeps the opponent name`);
 }
 await setLanguage('en',{persist:false});
});
test('saves from before the structured records still display their stored text',async()=>{
 await setLanguage('es',{persist:false});
 const old={commentary:'Old English line.',player:'A',kind:'drive',outcome:'made'};assert.equal(commentaryText(old),'Old English line.');
 assert.equal(logText({week:1,text:'Old log line.'}),'Old log line.');assert.equal(logText({detail:'Old ripple.',week:0}),'Old ripple.');
 assert.equal(reasonText({reason:'Old reason.'}),'Old reason.');
 assert.deepEqual(feedLines({feed:['a','b'],events:[]}),['a','b']);
 assert.deepEqual(feedLines({feed:['a','b'],feedMeta:[{t:'t',m:'calm'}],events:[]}),['a','b'],'a mismatched record is ignored');
 // out-of-range or unknown records fall back instead of showing "undefined"
 assert.equal(commentaryText({commentary:'Stored.',cm:[99,99],player:'A',defender:'B',helper:'C',rebounder:'D',kind:'drive',outcome:'miss',points:0,lane:1}),'Stored.');
 assert.equal(logText({week:1,text:'Stored.',k:'nonsense'}),'Stored.');assert.equal(logText({week:1,text:'Stored.',k:'train',p:{plan:'madeup',who:'X',whole:false,skill:'+1',energy:'+1',gpa:'+0'}}).includes('madeup'),true);
 await setLanguage('en',{persist:false});
});
test('the new optional save fields are validated; unknown or hostile values are rejected',()=>{
 const s=season(57,()=>{});
 const fresh=()=>{const g=E.createGame(data,'Valid','standard',5);E.autoLineup(g);E.startMatch(g);E.possession(g);return g;};
 assert.ok(E.validSave(fresh()),'a game with the new fields is valid');
 const stripped=fresh();delete stripped.match.feedMeta;for(const l of stripped.log){delete l.k;delete l.p;}for(const e of stripped.match.events)for(const c of e.plays)delete c.cm;assert.ok(E.validSave(stripped),'older saves without them are valid');
 const bad=(mutate)=>{const g=fresh();mutate(g);return E.validSave(g);};
 assert.equal(bad(g=>{g.match.events[0].plays[0].cm=[99];}),false);
 assert.equal(bad(g=>{g.match.events[0].plays[0].cm='drive';}),false);
 assert.equal(bad(g=>{g.log[0].k='bad key!';}),false);
 assert.equal(bad(g=>{g.log[0].k='tipoff';g.log[0].p={opp:{nested:true}};}),false);
 assert.equal(bad(g=>{g.log[0].k='tipoff';g.log[0].p={['__proto__']:'x'};Object.defineProperty(g.log[0].p,'__proto__',{value:'x',enumerable:true});}),false);
 assert.equal(bad(g=>{g.log[0].k='tipoff';g.log[0].p=Object.fromEntries(Array.from({length:12},(_,i)=>['k'+String.fromCharCode(97+i),1]));}),false);
 assert.equal(bad(g=>{g.match.feedMeta=[{t:'p',team:'x',n:1}];}),false);
 assert.equal(bad(g=>{g.match.feedMeta=[{t:'t',m:'<script>'}];}),false);
 assert.equal(bad(g=>{g.match.feedMeta=Array.from({length:30},()=>({t:'t',m:'calm'}));}),false);
 assert.ok(s.results.length>0);const r=structuredClone(s);r.results[0].why={chem:'x',energy:1,scouted:true};assert.equal(E.validSave(r),false);
});
test('structured text does not change any simulation result',()=>{
 // Same seed, same outcomes as before the records were added: totals are fixed by the seed alone.
 const a=season(57,()=>{}),b=season(57,()=>{});assert.deepEqual(a,b);
 assert.equal(COMMENTARY.lead.catch.length,2);
});
