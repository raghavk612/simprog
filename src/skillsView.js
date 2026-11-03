// Skill tree card on the Team Gear page, drawn like a game's skill tree: three coloured light fans (Shooter, Slasher, Post) rising
// from ribbon banners, each move a round medallion on a connector line, and a detail panel for the selected move with its Unlock
// button. Every node is a real button whose name says the move, its state (learned, ready, blocked and why, locked and what it
// needs) and its cost, so colour and glow are never the only signal. The five basic moves are listed under the tree.
import {BASIC_MOVES,SKILL_TREE,unlockedMoves,canUnlock} from './skills.js';
import {t,tu} from './i18n/index.js';
const BRANCHES=Object.keys(SKILL_TREE),ALL=Object.values(SKILL_TREE).flat(),TOTAL=BASIC_MOVES.length+ALL.length,move=k=>t(`shot.${k}`);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Layout in stage units (the stage keeps this aspect ratio): each branch leans along an axis from its base to the top edge.
const VW=600,VH=500,BASE=470,RIBBON=440,TIERS=[330,205,80],AXIS={shooter:[150,75],slasher:[300,300],post:[450,525]};
const ax=(b,y)=>{const [x0,x1]=AXIS[b];return x0+(x1-x0)*(BASE-y)/BASE;},pct=(v,of)=>`${+(v/of*100).toFixed(2)}%`;
const lean=b=>{const [x0,x1]=AXIS[b];return +(Math.atan2(x1-x0,BASE)*180/Math.PI).toFixed(1);};
// Line icons (24×24, stroked in the branch colour): what each move looks like on court.
const ICONS={
 corner:'<path d="M4 3v17h17"/><path d="M4 8a12 12 0 0 1 12 12"/><circle cx="8" cy="16" r="1.8"/>',
 stepback:'<circle cx="15" cy="4.5" r="1.8"/><path d="M15 7.5l-1 6 2.5 6.5M14 13.5l-3.5 6M15 9l4 2.5"/><path d="M8 7H3m0 0l2.5-2.5M3 7l2.5 2.5"/>',
 fadeaway:'<circle cx="11" cy="5" r="1.8"/><path d="M11.5 8l2 6-1.5 6.5M13.5 14l3.5 5M12 9.5l6-5"/><circle cx="19.5" cy="3.5" r="1.6"/><path d="M5 20h4"/>',
 euro:'<path d="M5 21l5-5-4-4 6-6"/><path d="M8 6h4v4"/><circle cx="17.5" cy="16.5" r="2.5"/>',
 dunk:'<circle cx="12" cy="4" r="2.4"/><path d="M12 7.5v3"/><path d="M4 12h16"/><path d="M6.5 12l2 7h7l2-7M9.5 12l1 7M14.5 12l-1 7"/>',
 alley:'<circle cx="4.5" cy="18" r="2"/><path d="M6 15.5C8 7 14 4 18 9.5" stroke-dasharray="2 2.5"/><path d="M15 13h7M16.2 13l1 5.5h2.6l1-5.5"/>',
 hook:'<path d="M5 21v-6l3-4"/><path d="M8 11c0-5 4-8 9-7"/><circle cx="18.5" cy="4.5" r="2.2"/><circle cx="7" cy="7" r="1.7"/>',
 spin:'<path d="M19 9a7.5 7.5 0 1 0 1 6"/><path d="M19.5 3.5V9H14"/><circle cx="12" cy="12" r="2"/>',
};
const icon=(k,cls='')=>`<svg class="st-icon${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[k]||'<circle cx="12" cy="12" r="6"/>'}</svg>`;
const LOCK='<svg class="st-badge lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const CHECK='<svg class="st-badge check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
// Why a move cannot be learned now, in the same words the other shops use.
const why=(s,n,reason)=>reason==='locked'?t('skills.needs',{move:move(n.requires)}):reason==='tokens'?t('office.needTokens',{n:n.cost-s.tokens}):reason==='game'?t('office.gameActive'):reason==='inbox'?t('office.inboxFirst'):t('office.seasonDone');
// owned: learned · open: can be bought now · blocked: next in line but tokens, a game, the inbox or the season's end stop it · locked: the previous move is missing.
const info=(s,n)=>{const c=canUnlock(s,n.key),state=c.ok?'open':c.reason==='owned'?'owned':c.reason==='locked'?'locked':'blocked';
 return {state,why:state==='blocked'||state==='locked'?why(s,n,c.reason):'',text:state==='owned'?t('skills.owned'):state==='open'?t('skills.stateOpen'):why(s,n,c.reason)};};
const where=key=>{for(const b of BRANCHES){const i=SKILL_TREE[b].findIndex(n=>n.key===key);if(i>=0)return {b,i};}return null;};

/* The move shown in the detail panel: the one the coach picked, else the first move they can unlock now, else the next move in
   line that something blocks, else the first locked one, else (every move learned) the last move. */
let picked=null;
export function selectSkill(key){picked=key&&where(key)?key:null;}
export function selectedSkill(s){
 if(picked)return picked;const by=st=>ALL.find(n=>info(s,n).state===st)?.key;
 return by('open')||by('blocked')||by('locked')||ALL.at(-1).key;
}
/* Arrow keys on the tree: up and down walk a branch, left and right step to the neighbouring branch on the same tier. */
export function skillNeighbour(key,dir){
 const w=where(key);if(!w)return null;
 if(dir==='ArrowUp'||dir==='ArrowDown')return SKILL_TREE[w.b][w.i+(dir==='ArrowUp'?1:-1)]?.key||null;
 if(dir!=='ArrowLeft'&&dir!=='ArrowRight')return null;
 return SKILL_TREE[BRANCHES[BRANCHES.indexOf(w.b)+(dir==='ArrowRight'?1:-1)]]?.[w.i]?.key||null;
}

function nodeButton(s,b,n,i,sel){
 const {state,text}=info(s,n),x=ax(b,TIERS[i]),on=n.key===sel;
 const label=t('skills.nodeLabel',{move:move(n.key),state:text,cost:t('skills.cost',{cost:n.cost})});
 return `<button class="st-node ${state} b-${b}" id="skill-${n.key}" data-action="skill-select" data-key="${n.key}" style="--x:${pct(x,VW)};--y:${pct(TIERS[i],VH)}" aria-pressed="${on}" aria-label="${esc(label)}"${on?' aria-describedby="st-detail-hint"':''}>`
  +`<span class="st-medal" aria-hidden="true">${icon(n.key)}${state==='locked'?LOCK:state==='owned'?CHECK:''}</span>`
  +(state==='owned'?'':`<span class="st-cost" aria-hidden="true">${n.cost}</span>`)
  +`<span class="st-name" aria-hidden="true">${esc(move(n.key))}</span></button>`;
}
// A connector from one move to the next: lit once both are learned, flowing toward a move that is next in line, dim and dashed otherwise.
function links(s,b){
 const nodes=SKILL_TREE[b],own=unlockedMoves(s),line=(from,to,x1,y1,x2,y2)=>{const st=own.includes(from)&&own.includes(to)?'lit':own.includes(from)?'next':'locked';
  return `<line class="st-link ${st} b-${b}" data-from="${from}" data-to="${to}" x1="${x1.toFixed(1)}" y1="${y1}" x2="${x2.toFixed(1)}" y2="${y2}"/>`;};
 // from the ribbon (the branch's base, always open) to its first move, then move to move
 const base=`<line class="st-link ${own.includes(nodes[0].key)?'lit':'next'} b-${b}" data-from="base" data-to="${nodes[0].key}" x1="${ax(b,RIBBON-14).toFixed(1)}" y1="${RIBBON-14}" x2="${ax(b,TIERS[0]).toFixed(1)}" y2="${TIERS[0]}"/>`;
 return base+nodes.slice(1).map((n,i)=>line(nodes[i].key,n.key,ax(b,TIERS[i]),TIERS[i],ax(b,TIERS[i+1]),TIERS[i+1])).join('');
}
// A light fan behind each branch, narrow at its ribbon and wide at the top (clip-path in stage percentages).
function beam(b){const [x0,x1]=AXIS[b],poly=[[x0-20,BASE],[x0+20,BASE],[x1+90,0],[x1-90,0]].map(([x,y])=>`${pct(Math.min(VW,Math.max(0,x)),VW)} ${pct(y,VH)}`).join(',');return `<div class="st-beam b-${b}" style="clip-path:polygon(${poly})" aria-hidden="true"></div>`;}

function detail(s,sel){
 const {b,i}=where(sel),n=SKILL_TREE[b][i],{state,why:w}=info(s,n),cost=t('skills.cost',{cost:n.cost});
 const body=state==='owned'?`<p class="skill-state"><span aria-hidden="true">✓</span> ${t('skills.owned')}</p>`
  :state==='locked'?`<p class="skill-state"><b>${t('skills.locked')}</b> · ${w}</p><small class="st-price">${cost}</small>`
  :`<button class="primary wide${state==='blocked'?' locked-action':''}" data-action="skill-unlock" data-key="${n.key}" aria-describedby="st-detail-name${state==='blocked'?' st-detail-why':''}" ${state==='blocked'?'disabled':''}>${t('skills.unlock',{cost:n.cost})}</button>${state==='blocked'?`<small id="st-detail-why">${w}</small>`:''}`;
 return `<aside class="st-detail ${state} b-${b}" aria-labelledby="st-detail-name"><div class="st-detail-top"><span class="st-medal" aria-hidden="true">${icon(n.key)}</span><div><span class="eyebrow">${esc(tu(`skills.branch.${b}`))} · ${t('skills.tier',{n:i+1,total:SKILL_TREE[b].length})}</span><h3 id="st-detail-name">${move(n.key)}</h3></div></div><p class="skill-hint" id="st-detail-hint">${t(`skills.hint.${n.key}`,{tactic:t('tactic.perimeter')})}</p>${body}</aside>`;
}

export function skillTreeCard(s){
 const sel=selectedSkill(s);
 const branches=BRANCHES.map(b=>`<div class="st-branch b-${b}" role="group" aria-labelledby="skill-branch-${b}"><h3 class="st-ribbon" id="skill-branch-${b}" style="--x:${pct(ax(b,RIBBON),VW)};--y:${pct(RIBBON,VH)};--r:${lean(b)}deg">${t(`skills.branch.${b}`)}</h3>${SKILL_TREE[b].map((n,i)=>nodeButton(s,b,n,i,sel)).join('')}</div><!--/${b}-->`).join('');
 return `<section class="card skill-tree game-tree" aria-labelledby="skill-tree-title"><div class="office-heading"><div><span class="eyebrow">${tu('skills.kicker')}</span><h2 id="skill-tree-title">${t('skills.title')}</h2></div><span class="pill">${t('skills.progress',{n:unlockedMoves(s).length,total:TOTAL})}</span></div><p class="skill-intro">${t('skills.intro')}</p>
 <div class="st-board"><div class="st-stage" style="aspect-ratio:${VW}/${VH}">${BRANCHES.map(beam).join('')}<svg class="st-links" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${BRANCHES.map(b=>links(s,b)).join('')}</svg>${branches}</div>${detail(s,sel)}</div>
 <div class="st-basics"><h3 class="skill-sub">${t('skills.basic')}</h3><ul class="skill-chips">${BASIC_MOVES.map(k=>`<li class="skill-chip"><span class="sr-only">${t('skills.owned')}: </span><span aria-hidden="true">✓</span> ${move(k)}</li>`).join('')}</ul></div></section>`;
}
