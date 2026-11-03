import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as E from '../src/engine.js';
import {skillTreeCard} from '../src/skillsView.js';import {gearBody} from '../src/gearView.js';import {BASIC_MOVES,SKILL_TREE} from '../src/skills.js';import {setLanguage,LANGUAGES,t} from '../src/i18n/index.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const game=()=>{const s=E.createGame(data,'Skills','standard',42);E.autoLineup(s);return s;};
// One node's markup, from its <li> to the next one.
const nodeHtml=(html,key)=>{const m=html.match(new RegExp(`<li class="skill-node[^"]*" id="skill-${key}"[\\s\\S]*?</li>`));assert.ok(m,`node ${key} rendered`);return m[0];};
const stateOf=(html,key)=>nodeHtml(html,key).match(/class="skill-node (\w+)"/)[1];
test.beforeEach(()=>setLanguage('en',{persist:false}));

test('a new season shows the five basic moves and three branches in order, roots ready to unlock',()=>{
 const s=game(),html=skillTreeCard(s);
 assert.match(html,new RegExp(t('skills.title')));assert.match(html,/defenses read a team with few moves/i);
 for(const k of BASIC_MOVES)assert.match(html,new RegExp(`<li class="skill-chip"><span class="sr-only">${t('skills.owned')}: </span><span aria-hidden="true">✓</span> ${t(`shot.${k}`)}</li>`),k);
 for(const [b,nodes] of Object.entries(SKILL_TREE)){
  const branch=html.match(new RegExp(`id="skill-branch-${b}">${t(`skills.branch.${b}`)}</h3><ol class="skill-path">([\\s\\S]*?)</ol>`));assert.ok(branch,b);
  assert.deepEqual([...branch[1].matchAll(/id="skill-(\w+)"/g)].map(m=>m[1]),nodes.map(n=>n.key),`${b} order`);
  const [root,...rest]=nodes;
  assert.equal(stateOf(html,root.key),'open');assert.match(nodeHtml(html,root.key),new RegExp(`<button class="primary small wide" data-action="skill-unlock" data-key="${root.key}"[^>]*>${t('skills.unlock',{cost:root.cost})}</button>`));
  for(const n of rest){const h=nodeHtml(html,n.key);assert.equal(stateOf(html,n.key),'locked');assert.doesNotMatch(h,/<button/);assert.ok(h.includes(t('skills.needs',{move:t(`shot.${n.requires}`)})),n.key);assert.ok(h.includes(t('skills.locked')));}
 }
 for(const k of Object.values(SKILL_TREE).flat().map(n=>n.key))assert.ok(nodeHtml(html,k).includes(t(`skills.hint.${k}`,{tactic:t('tactic.perimeter')})),k);
 assert.ok(html.includes(t('skills.progress',{n:5,total:13})));
});
test('an unlocked move shows as learned and opens the next move in its branch',()=>{
 const s=game();E.unlockSkill(s,'euro');const html=skillTreeCard(s);
 assert.equal(stateOf(html,'euro'),'owned');assert.ok(nodeHtml(html,'euro').includes(t('skills.owned')));assert.doesNotMatch(nodeHtml(html,'euro'),/<button/);
 assert.equal(stateOf(html,'dunk'),'open');assert.equal(stateOf(html,'alley'),'locked');assert.ok(nodeHtml(html,'alley').includes(t('shot.dunk')));
 assert.ok(html.includes(t('skills.progress',{n:6,total:13})));
});
test('a move blocked by tokens, a live game, the inbox or a finished season keeps a disabled button and says why',()=>{
 const cases=[[s=>{s.tokens=100;},t('office.needTokens',{n:50})],[s=>{s.match={};},t('office.gameActive')],[s=>{s.pendingEvent={id:'x'};},t('office.inboxFirst')],[s=>{s.finished=true;},t('office.seasonDone')]];
 for(const [set,why] of cases){const s=game();set(s);const h=nodeHtml(skillTreeCard(s),'corner');
  assert.equal(h.match(/class="skill-node (\w+)"/)[1],'blocked');assert.match(h,/<button class="primary small wide locked-action" data-action="skill-unlock" data-key="corner"[^>]*disabled/);assert.ok(h.includes(why),why);}
});
test('gear and the skill tree are separate shop tabs',()=>{
 const html=gearBody(game(),0);
 assert.ok(html.includes('gear-loadout')&&html.includes('gear-shop-heading'));
 assert.ok(!html.includes('skill-tree'));
});
test('the skill tree renders in every language without missing keys',async()=>{
 const s=game();E.unlockSkill(s,'corner');const english=skillTreeCard(s);
 for(const {code} of LANGUAGES){await setLanguage(code,{persist:false});const html=skillTreeCard(s);assert.doesNotMatch(html,/skills\.|shot\.|office\.|\{\{/,code);if(code!=='en')assert.ok(!html.includes(english.match(/<p class="skill-intro">([^<]*)/)[1]),`${code} intro is translated`);}
 await setLanguage('en',{persist:false});
});
test('the dunk hint names the tactic that turns dunks off, using the tactic label itself in every language',async()=>{
 for(const {code} of LANGUAGES){await setLanguage(code,{persist:false});const html=nodeHtml(skillTreeCard(game()),'dunk');
  assert.ok(html.includes(t('tactic.perimeter').replace(/&/g,'&amp;')),`${code}: dunk hint shows "${t('tactic.perimeter')}"`);assert.ok(!html.includes('{{'),`${code}: no raw placeholder`);}
});
