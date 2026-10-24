import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import en from '../src/i18n/locales/en.js';
import {GRAPHICS_LEVELS} from '../src/graphics.js';
import {LANGUAGES,t,tu,list,has,translateError,setLanguage,getLanguage,detectLanguage,formatDate,supported} from '../src/i18n/index.js';
import {plans,staff,DIFFICULTIES,UPGRADES} from '../src/engine.js';import {VALUES} from '../src/narrative.js';import {SHOTS} from '../src/basketball.js';import {SOUND_KEYS} from '../src/audio.js';import {ACTIONS} from '../src/keys.js';
const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
// Every string leaf, keyed by its path. Arrays are indexed.
function flatten(value,prefix='',out={}){
 if(typeof value==='string')out[prefix]=value;
 else if(Array.isArray(value))value.forEach((v,i)=>flatten(v,`${prefix}.${i}`,out));
 else for(const [k,v] of Object.entries(value))flatten(v,prefix?`${prefix}.${k}`:k,out);
 return out;
}
const flat=flatten(en);
const placeholders=s=>[...s.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]).sort().join(',');
const codes=LANGUAGES.map(l=>l.code).filter(c=>c!=='en');

test('every language is listed, supported and has a locale file',()=>{
 assert.deepEqual(LANGUAGES.map(l=>l.code),['en','es','zh','fr','ja','it','hi']);
 for(const l of LANGUAGES){assert.ok(supported(l.code));assert.ok(l.native&&l.tag);assert.ok(fs.existsSync(new URL(`../src/i18n/locales/${l.code}.js`,import.meta.url)),l.code);}
});
test('every static translation key used by the code exists in English',()=>{
 const missing=[];
 for(const file of ['../src/main.js','../src/settingsDialog.js','../src/narrative.js','../src/drills.js','../src/i18n/index.js']){
  for(const m of read(file).matchAll(/\b(?:t|tu|tb|list|has)\('([a-zA-Z0-9_.]+)'/g)){
   const key=m[1];if(!Object.keys(flat).some(k=>k===key||k.startsWith(`${key}.`)))missing.push(`${file}: ${key}`);
  }
 }
 assert.deepEqual(missing,[]);
});
test('every key built at run time resolves to a string for each value it can take',()=>{
 const need=[];
 for(const v of ['home','roster','practice','recruit','staff','game','locker','season','data'])need.push(`nav.${v}`);
 for(const k of Object.keys(plans))need.push(`plan.${k}.name`,`plan.${k}.desc`);
 for(const a of staff)need.push(`staff.${a.key}.name`,`staff.${a.key}.detail`);
 for(const k of Object.keys(SHOTS))need.push(`shot.${k}`);
 for(const k of SOUND_KEYS)need.push(`settings.sound.items.${k}.name`,`settings.sound.items.${k}.desc`);
 for(const a of ACTIONS)need.push(`settings.controls.actions.${a}`);
 for(const l of LANGUAGES)need.push(`lang.${l.code}`);
for(const l of GRAPHICS_LEVELS)need.push(`settings.accessibility.graphicsOptions.${l}`);
 for(const v of ['listen','fundraise','academics'])need.push(`office.${v}`,`office.${v}Fx`);
 for(const v of ['perimeter','paint','transition'])need.push(`style.${v}`,`game.advice.${v}`);
 for(const v of ['balanced','zone','pressure','perimeter'])need.push(`tactic.${v}`);
 for(const v of ['steady','fast'])need.push(`pace.${v}`);
 for(const v of ['home','away','alternate'])need.push(`locker.${v}`);
 for(const v of ['rookie','standard','elite'])need.push(`level.${v}`,`difficulty.${v}`);
 for(const n of [1,2,3,4])need.push(`tutorial.step${n}.title`,`tutorial.step${n}.body`);
 for(const v of ['made','miss','block','steal'])need.push(`outcome.${v}`);
 for(const v of ['skill','energy','morale','chemistry','shotType','space','tactics'])need.push(`impact.${v}`);
 for(const v of ['open','tight','contested'])need.push(`contest.${v}`);
 for(const v of ['pass','attack','gather','blocked','turnover','flight','basket','rebound'])need.push(`phase.${v}`);
 for(const v of ['assists','blocks','steals','rebounds'])need.push(`stats.${v}`);
 for(const v of ['controls','sound','accessibility','language'])need.push(`settings.tabs.${v}`);
 for(const v of ['none','deuteranopia','protanopia','tritanopia'])need.push(`settings.accessibility.colorBlindOptions.${v}`);
 for(const v of ['default','modern','readable'])need.push(`settings.accessibility.fontOptions.${v}`);
 for(const v of ['0_5','0_75','1'])need.push(`settings.accessibility.playbackSpeedOptions.${v}`);
 for(const v of ['guard','forward'])need.push(`pos.${v}`);
 for(const v of ['senior','junior','sophomore','prospect','tryout'])need.push(`year.${v}`);
 for(const v of ['injured','ineligible','exhausted'])need.push(`status.${v}`);
 for(const v of ['wholeTeam','train','recruit','release','hire','dismiss','talkListen','talkFundraise','talkAcademics','scout','tipoff','injury','win','loss','result','reason','reasonWithScouting','runEnds','champions','seasonComplete'])need.push(`log.${v}`);
 for(const v of ['calm','belief'])need.push(`timeout.feed.${v}`);need.push('timeout.feedPrefix');
 for(const v of ['counter','threes','tired','boards','trailing','push','balanced'])need.push(`break.s.${v}`);
 for(const v of ['adjustTactic','adjustPace'])need.push(`log.${v}`);
 for(const v of ['dunk','three','two','block','steal'])need.push(`hl.kind.${v}`);
 for(const v of ['block','steal'])need.push(`hl.def.${v}`);
 for(const [k,d] of Object.entries(DIFFICULTIES))need.push(`difficulty.${k}`,`level.${k}`,`team.${d.level}`);
 for(const v of ['runState','runTitle','stretchDistrict','stretchLeague'])need.push(`season.${v}`);
 for(const v of ['ppg','apg','rpg','bpg','spg'])need.push(`leaders.${v}`);
 for(const v of ['gp','ppg','rpg','apg','spg','bpg'])need.push(`stat.${v}`,`stat.${v}Title`);
 for(const v of ['min','pts','fg','tp','reb','ast','stl','blk','to','starters','bench','team'])need.push(`box.${v}`);
 for(const v of ['info','success','warn','error'])need.push(`toast.${v}`);
 for(const v of ['train','recruit','talk','scout','release','dismiss','saved'])need.push(`toast.titles.${v}`);
 for(const v of ['rookie','standard','elite'])need.push(`tier.${v}`);
 for(const v of ['controls','goal','difficulty','rotation','prep','gameday','court','data'])need.push(`hb.tabs.${v}`);
 for(const u of UPGRADES)need.push(`upg.${u.key}.name`,`upg.${u.key}.fx`);
 for(const v of ['finished','live','inbox','press','issues','practice','scout','lineup','tipoff'])need.push(`nudge.${v}`,`nudge.btn.${v}`);
 for(const v of ['upgrade','budget'])need.push(`log.${v}`);need.push('toast.titles.upgrade');
 for(const v of ['shooting','bond','defense','recovery','study'])need.push(`drill.${v}.name`,`drill.${v}.how`);
 for(const v of ['fresh','rested','tired','exhausted'])need.push(`rv.energy.${v}`);
 for(const v of ['fired','content','restless','unhappy'])need.push(`rv.morale.${v}`);
 for(const v of ['Guard','Forward','Center'])need.push(`rv.short.${v}`);
 for(const v of ['starter','rotation','bench'])need.push(`status.${v}`);
 for(const v of ['auto','player'])need.push(`stage.${v}`);
 for(const v of ['ins','mid','tpt','perd','insd'])need.push(`rv.${v}`,`rv.${v}T`);
 for(const v of [0,1,2,3])need.push(`bracket.round.${v}`);
 for(const v of ['won','lost','next','upcoming','out','missed'])need.push(`bracket.status.${v}`);
 for(const v of ['mvp','defense','improved','pog'])need.push(`report.award.${v}`,`report.value.${v}`);
 for(const v of ['wins','postseason','development','academics','chemistry'])need.push(`report.parts.${v}`);
 for(const v of ['open','qualified','failed'])need.push(`bracket.${v}`);
 for(const v of ['ppg','rpg','apg','spg','bpg','fgp'])need.push(`stat.${v}`);
 for(const v of ['slashing','post','midrange','sharp','stretch','lockdown','rim','glass'])need.push(`arch.${v}`);
 for(const v of ['inside','mid','three','perim','interior'])need.push(`attr.${v}`);
 for(const v of ['firstWin','perfectDrill','streak10','undefeated','zeroInjury','fullStrength','champion'])need.push(`ach.items.${v}.name`,`ach.items.${v}.desc`);
for(const v of ['high','some','low'])need.push(`arc.level.${v}`);
for(const v of ['breakout','slump'])need.push(`arc.${v}`,`arc.${v}Note`);
for(const v of ['rose','fell','flat'])need.push(`arc.${v}`);need.push('log.scoutP');
for(const k of need)assert.equal(typeof flat[k],'string',k);
 assert.ok(Array.isArray(en.drill.quiz)&&en.drill.quiz.length>=6&&en.drill.quiz.every(q=>q.length===4));
 assert.equal(en.hb.cr.list.length,5);
});
test('every message thrown by the interface has a translation entry',()=>{
 const thrown=[...read('../src/main.js').matchAll(/throw Error\('([^']+)'/g)].map(m=>m[1]).filter(m=>/\s/.test(m)&&!m.includes('${')&&m!=='Data unavailable');// that one is never shown: the page shows its own error screen
 for(const message of thrown)assert.ok(en.errors[message],message);
});
test('every message thrown by the engine has a translation entry',()=>{
 const thrown=['../src/engine.js','../src/events.js','../src/press.js'].flatMap(f=>[...read(f).matchAll(/Error\('([^']+)'\)/g)].map(m=>m[1]));
 assert.ok(thrown.length>15);
 for(const message of thrown)assert.ok(en.errors[message],message);
});
test('all languages define exactly the English keys with matching placeholders',async()=>{
 for(const code of codes){
  const pack=flatten((await import(`../src/i18n/locales/${code}.js`)).default);
  const missing=Object.keys(flat).filter(k=>!(k in pack)),extra=Object.keys(pack).filter(k=>!(k in flat));
  assert.deepEqual(missing,[],`${code} is missing keys`);assert.deepEqual(extra,[],`${code} has extra keys`);
  for(const [k,v] of Object.entries(pack)){
   // The commentary joiner is deliberately a space, or empty for Chinese and Japanese.
   if(k!=='cm.join')assert.ok(v.trim().length>0,`${code}.${k} is empty`);
   assert.equal(placeholders(v),placeholders(flat[k]),`${code}.${k} placeholders`);
   assert.ok(!/[<>]/.test(v),`${code}.${k} contains markup`);
  }
 }
});
test('translations are real: most strings differ from English in every other language',async()=>{
 const brand=new Set(['kangs','k','ppg','gpa']);
 for(const code of codes){
  const pack=flatten((await import(`../src/i18n/locales/${code}.js`)).default);
  const same=Object.keys(flat).filter(k=>pack[k]===flat[k]&&!k.startsWith('errors.')&&flat[k].length>12&&!brand.has(flat[k].toLowerCase()));
  assert.ok(same.length<15,`${code} leaves ${same.length} long strings in English: ${same.slice(0,8).join(', ')}`);
 }
});
test('t() interpolates, falls back to English and then to the key',async()=>{
 await setLanguage('en',{persist:false});
 assert.equal(t('home.welcome',{name:'Sam'}),'Welcome back, Coach Sam.');
 assert.equal(t('no.such.key'),'no.such.key');
 assert.equal(tu('home.welcome',{name:'Sam'}),'WELCOME BACK, COACH SAM.');
 assert.equal(list('hb.cr.list').length,5);assert.ok(has('nav.home'));assert.ok(!has('nav.nope'));
 assert.equal(t('home.welcome'),'Welcome back, Coach {{name}}.');
});
test('switching language changes output; unknown codes fall back to English',async()=>{
 for(const code of codes){
  assert.equal(await setLanguage(code,{persist:false}),code);assert.equal(getLanguage(),code);
  assert.notEqual(t('landing.start'),en.landing.start,code);
  assert.equal(translateError('Not enough program tokens.'),(await import(`../src/i18n/locales/${code}.js`)).default.errors['Not enough program tokens.']);
 }
 assert.equal(await setLanguage('xx',{persist:false}),'en');assert.equal(t('landing.start'),en.landing.start);
 assert.equal(translateError('Something unexpected'),'Something unexpected');
});
test('uppercasing follows language rules',async()=>{
 await setLanguage('fr',{persist:false});assert.equal(tu('top.settings'),t('top.settings').toLocaleUpperCase('fr'));
 await setLanguage('en',{persist:false});
});
// Runs fn with a global temporarily replaced (Node 22 has no localStorage, Node 25 has one).
function withGlobals(values,fn){
 const saved=Object.keys(values).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]);
 for(const [k,v] of Object.entries(values))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
 try{fn();}finally{for(const [k,d] of saved)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];}
}
test('language detection honours a saved choice, then the browser, then English',()=>{
 const empty={getItem:()=>null},saved={getItem:()=>'it'};
 withGlobals({localStorage:empty,navigator:{languages:['pt-BR','xx']}},()=>assert.equal(detectLanguage(),'en'));
 withGlobals({localStorage:empty,navigator:{languages:['pt-BR','ja-JP','fr']}},()=>assert.equal(detectLanguage(),'ja'));
 withGlobals({localStorage:saved,navigator:{languages:['ja-JP']}},()=>assert.equal(detectLanguage(),'it'));
 withGlobals({localStorage:{getItem:()=>'zz'},navigator:{languages:['es-MX']}},()=>assert.equal(detectLanguage(),'es'));
 withGlobals({localStorage:{getItem(){throw Error('blocked');}},navigator:{languages:['hi']}},()=>assert.equal(detectLanguage(),'hi'));
});
test('schedule dates are formatted for the active language',async()=>{
 await setLanguage('en',{persist:false});assert.match(formatDate('12/2/2025'),/Dec/);assert.equal(formatDate('TBD'),'TBD');
 await setLanguage('ja',{persist:false});assert.match(formatDate('12/2/2025'),/12月/);await setLanguage('en',{persist:false});
});
test('every position, grade and game type in the published data has a translation',()=>{
 const data=JSON.parse(read('../public/data/kangs.json')),words=new Set();
 for(const lv of Object.values(data.levels)){
  for(const p of lv.players){words.add(p.position);words.add(p.year);}
  for(const g of lv.games)words.add(g.type);
 }
 for(const w of words){assert.ok(VALUES[w],`no translation entry for "${w}"`);assert.equal(typeof flat[VALUES[w]],'string',VALUES[w]);}
 for(const k of Object.keys(data.levels))assert.equal(typeof flat[`team.${k}`],'string',`team.${k}`);
});
