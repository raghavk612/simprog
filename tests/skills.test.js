import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as E from '../src/engine.js';
import {BASIC_MOVES,SKILL_TREE,skillNode,unlockedMoves,canUnlock,validSkills} from '../src/skills.js';import {SHOTS,isDunk} from '../src/basketball.js';import {setLanguage,LANGUAGES,has} from '../src/i18n/index.js';import {logText} from '../src/narrative.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const game=(seed=42)=>{const s=E.createGame(data,'Skills','standard',seed);E.autoLineup(s);return s;};
const prepare=s=>{if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');};
// Plays a whole season; style(s,week) may set the Kangs' tactic and pace after tip-off. Returns every play, both teams.
function season(s,style=()=>{}){const plays=[];let guard=0;while(!s.finished&&guard++<45){prepare(s);E.autoLineup(s);E.startMatch(s);style(s.match,s.week);let k=0;while(s.match&&k++<500)plays.push(...E.possession(s).plays);}assert.ok(s.finished,'fixture: the season finished');return plays;}
const ALL=Object.values(SKILL_TREE).flat().map(n=>n.key);

test('the skill tree has three ordered branches with fixed costs and prerequisites',()=>{
 assert.deepEqual(BASIC_MOVES,['catch','pullup','drive','floater','roll']);
 assert.deepEqual(SKILL_TREE,{shooter:[{key:'corner',cost:150,requires:null},{key:'stepback',cost:250,requires:'corner'},{key:'fadeaway',cost:350,requires:'stepback'}],slasher:[{key:'euro',cost:150,requires:null},{key:'dunk',cost:300,requires:'euro'},{key:'alley',cost:400,requires:'dunk'}],post:[{key:'hook',cost:150,requires:null},{key:'spin',cost:250,requires:'hook'}]});
 // Basic moves plus the tree are exactly the 13 moves the game can animate.
 assert.deepEqual([...BASIC_MOVES,...ALL].sort(),Object.keys(SHOTS).sort());
 assert.deepEqual(skillNode('dunk'),{key:'dunk',cost:300,requires:'euro'});assert.equal(skillNode('catch'),undefined);assert.equal(skillNode('nope'),undefined);
});
test('a new save knows only the five basic moves; unknown stored keys are ignored',()=>{
 const s=game();assert.deepEqual(unlockedMoves(s),BASIC_MOVES);assert.equal(s.skills,undefined);
 assert.deepEqual(unlockedMoves({...s,skills:['euro','bogus']}),[...BASIC_MOVES,'euro']);assert.deepEqual(unlockedMoves({...s,skills:'euro'}),BASIC_MOVES);
});
test('canUnlock names why a move cannot be learned yet',()=>{
 const s=game();
 assert.deepEqual(canUnlock(s,'corner'),{ok:true});assert.deepEqual(canUnlock(s,'stepback'),{ok:false,reason:'locked'});
 E.unlockSkill(s,'corner');assert.deepEqual(canUnlock(s,'corner'),{ok:false,reason:'owned'});assert.deepEqual(canUnlock(s,'stepback'),{ok:true});
 assert.equal(canUnlock({...s,tokens:249},'stepback').reason,'tokens');assert.equal(canUnlock({...s,tokens:250},'stepback').ok,true);
 assert.equal(canUnlock({...s,finished:true},'stepback').reason,'season');
 assert.equal(canUnlock({...s,match:{possession:0}},'stepback').reason,'game');
 assert.equal(canUnlock({...s,pendingEvent:{id:'x',params:{}}},'stepback').reason,'inbox');
 assert.equal(canUnlock(s,'nope').ok,false);
});
test('unlockSkill spends tokens (no preparation slot), enforces prerequisites and blocks atomically',()=>{
 const s=game();E.unlockSkill(s,'euro');assert.equal(s.tokens,850);assert.equal(s.actions,3);assert.deepEqual(s.skills,['euro']);
 assert.deepEqual({k:s.log[0].k,p:s.log[0].p,text:s.log[0].text},{k:'skillUnlock',p:{move:'euro',cost:150},text:'Unlocked Euro-step layup for 150 tokens.'});
 const before=JSON.stringify(s),same=()=>assert.equal(JSON.stringify(s),before);
 assert.throws(()=>E.unlockSkill(s,'euro'),/already/);same();assert.throws(()=>E.unlockSkill(s,'alley'),/first/);same();assert.throws(()=>E.unlockSkill(s,'catch'),/unavailable/);same();assert.throws(()=>E.unlockSkill(s,'nope'),/unavailable/);same();
 s.tokens=299;assert.throws(()=>E.unlockSkill(s,'dunk'),/tokens/);assert.deepEqual(s.skills,['euro']);s.tokens=1000;
 s.pendingEvent={id:'x',params:{}};assert.throws(()=>E.unlockSkill(s,'dunk'),/inbox/);s.pendingEvent=null;
 E.startMatch(s);assert.throws(()=>E.unlockSkill(s,'dunk'),/Finish/);while(s.match)E.possession(s);
 E.unlockSkill(s,'dunk');E.unlockSkill(s,'alley');assert.deepEqual(s.skills,['euro','dunk','alley']);
 s.finished=true;assert.throws(()=>E.unlockSkill(s,'hook'),/complete/);
});
test('with no unlocks the Kangs never use a move outside the basic five, while visitors still use every move',()=>{
 const styles=[['perimeter','steady'],['balanced','fast'],['balanced','steady'],['zone','fast'],['pressure','steady']];
 const plays=season(game(7),(m,w)=>{[m.tactic,m.pace]=styles[w%styles.length];});
 const home=new Set(plays.filter(p=>p.team==='home').map(p=>p.kind)),away=new Set(plays.filter(p=>p.team==='away').map(p=>p.kind));
 assert.deepEqual([...home].sort(),[...BASIC_MOVES].sort());assert.deepEqual([...away].sort(),Object.keys(SHOTS).sort());
});
test('dunks are a skill: once unlocked the Kangs dunk in steady games, and only use moves they own',()=>{
 const none=season(game(5)).filter(p=>p.team==='home');assert.equal(none.filter(p=>isDunk(p.kind)).length,0,'no dunks before the unlock');
 const s=game(5);E.unlockSkill(s,'euro');E.unlockSkill(s,'dunk');const own=new Set(unlockedMoves(s));
 const home=season(s,m=>{m.tactic='balanced';m.pace='steady';}).filter(p=>p.team==='home');
 assert.ok(home.filter(p=>p.kind==='dunk').length>20,'steady-pace dunks over a season');assert.ok(home.every(p=>own.has(p.kind)),'only owned moves');
 // Alley-oops join the fast bag once unlocked.
 const f=game(6);f.skills=['euro','dunk','alley'];const fast=season(f,m=>{m.pace='fast';}).filter(p=>p.team==='home');assert.ok(fast.some(p=>p.kind==='alley'));assert.ok(fast.some(p=>p.kind==='dunk'));
});
test('skills validate strictly in saves, survive export and import, and old saves still load',()=>{
 const s=game();assert.ok(E.validSave(s),'old save without skills');assert.ok(validSkills(s));
 E.unlockSkill(s,'hook');E.unlockSkill(s,'spin');assert.ok(E.validSave(s));const back=JSON.parse(E.exportJson(s));assert.ok(E.validSave(back));assert.deepEqual(back.skills,['hook','spin']);assert.deepEqual(unlockedMoves(back),[...BASIC_MOVES,'hook','spin']);
 assert.ok(E.validSave({...s,skills:[]}));assert.ok(E.validSave({...s,skills:ALL}));
 for(const skills of [null,'hook',{0:'hook'},['bogus'],['catch'],['hook','hook'],['spin'],['euro','alley'],[1],['hook','<img src=x>'],[...ALL,'hook']])assert.equal(E.validSave({...s,skills}),false,JSON.stringify(skills));
});
test('the unlock log line is translated in every language with the move name',async()=>{
 const s=game();E.unlockSkill(s,'corner');const entry=s.log[0];
 for(const {code} of LANGUAGES){await setLanguage(code,{persist:false});assert.ok(has('log.skillUnlock'),code);const text=logText(entry);assert.ok(!text.includes('{{')&&text.includes('150'),`${code}: ${text}`);if(code==='en')assert.equal(text,entry.text);else assert.notEqual(text,entry.text,code);}
 await setLanguage('en',{persist:false});
});
