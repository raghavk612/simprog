// Skill tree card on the Team Gear page: the five basic moves, then each branch's moves top to bottom with their state in text (learned, ready to unlock, or locked and why).
import {BASIC_MOVES,SKILL_TREE,unlockedMoves,canUnlock} from './skills.js';
import {t,tu} from './i18n/index.js';
const TOTAL=BASIC_MOVES.length+Object.values(SKILL_TREE).flat().length,move=k=>t(`shot.${k}`);
// Why a move cannot be learned now, in the same words the other shops use.
const why=(s,n,reason)=>reason==='locked'?t('skills.needs',{move:move(n.requires)}):reason==='tokens'?t('office.needTokens',{n:n.cost-s.tokens}):reason==='game'?t('office.gameActive'):reason==='inbox'?t('office.inboxFirst'):t('office.seasonDone');
// owned: learned · open: can be bought now · blocked: next in line but tokens, a game, the inbox or the season's end stop it · locked: the previous move is missing (stamped like locked kits).
function node(s,n){
 const c=canUnlock(s,n.key),state=c.ok?'open':c.reason==='owned'?'owned':c.reason==='locked'?'locked':'blocked',id=`skill-${n.key}`;
 const body=state==='owned'?`<p class="skill-state"><span aria-hidden="true">✓</span> ${t('skills.owned')}</p>`:state==='locked'?`<p class="skill-state"><b>${t('skills.locked')}</b> · ${why(s,n,c.reason)}</p><small>${t('skills.cost',{cost:n.cost})}</small>`:`<button class="primary small wide${state==='blocked'?' locked-action':''}" data-action="skill-unlock" data-key="${n.key}" aria-describedby="${id}-name${state==='blocked'?` ${id}-why`:''}" ${state==='blocked'?'disabled':''}>${t('skills.unlock',{cost:n.cost})}</button>${state==='blocked'?`<small id="${id}-why">${why(s,n,c.reason)}</small>`:''}`;
 return `<li class="skill-node ${state}" id="${id}" tabindex="-1"><h4 id="${id}-name">${move(n.key)}</h4><p class="skill-hint">${t(`skills.hint.${n.key}`,{tactic:t('tactic.perimeter')})}</p>${body}</li>`;
}
export function skillTreeCard(s){
 return `<section class="card skill-tree" aria-labelledby="skill-tree-title"><div class="office-heading"><div><span class="eyebrow">${tu('skills.kicker')}</span><h2 id="skill-tree-title">${t('skills.title')}</h2></div><span class="pill">${t('skills.progress',{n:unlockedMoves(s).length,total:TOTAL})}</span></div><p class="skill-intro">${t('skills.intro')}</p>
 <h3 class="skill-sub">${t('skills.basic')}</h3><ul class="skill-chips">${BASIC_MOVES.map(k=>`<li class="skill-chip"><span class="sr-only">${t('skills.owned')}: </span><span aria-hidden="true">✓</span> ${move(k)}</li>`).join('')}</ul>
 <div class="skill-branches">${Object.entries(SKILL_TREE).map(([b,nodes])=>`<section class="skill-branch" aria-labelledby="skill-branch-${b}"><h3 id="skill-branch-${b}">${t(`skills.branch.${b}`)}</h3><ol class="skill-path">${nodes.map(n=>node(s,n)).join('')}</ol></section>`).join('')}</div></section>`;
}
