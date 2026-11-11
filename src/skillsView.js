// The skill tree (its own break page): three branches (Shooter, Slasher, Post), each a column of moves from tier 1 down,
// joined by connectors that turn solid once both ends are learned, and a detail panel for the selected move with its Unlock
// button. Every move is a real button whose name says the move, its state (learned, ready, blocked and why, locked and what
// it needs) and its cost, so colour is never the only signal. The five basic moves are listed under the tree.
import { BASIC_MOVES, SKILL_TREE, unlockedMoves, canUnlock } from './skills.js';
import { t, tu } from './i18n/index.js';
const BRANCHES = Object.keys(SKILL_TREE),
  ALL = Object.values(SKILL_TREE).flat(),
  TOTAL = BASIC_MOVES.length + ALL.length,
  move = k => t(`shot.${k}`);
const esc = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Line icons (24×24, stroked in the state colour): what each move looks like on court.
const ICONS = {
  corner: '<path d="M4 3v17h17"/><path d="M4 8a12 12 0 0 1 12 12"/><circle cx="8" cy="16" r="1.8"/>',
  stepback:
    '<circle cx="15" cy="4.5" r="1.8"/><path d="M15 7.5l-1 6 2.5 6.5M14 13.5l-3.5 6M15 9l4 2.5"/><path d="M8 7H3m0 0l2.5-2.5M3 7l2.5 2.5"/>',
  fadeaway:
    '<circle cx="11" cy="5" r="1.8"/><path d="M11.5 8l2 6-1.5 6.5M13.5 14l3.5 5M12 9.5l6-5"/><circle cx="19.5" cy="3.5" r="1.6"/><path d="M5 20h4"/>',
  euro: '<path d="M5 21l5-5-4-4 6-6"/><path d="M8 6h4v4"/><circle cx="17.5" cy="16.5" r="2.5"/>',
  dunk: '<circle cx="12" cy="4" r="2.4"/><path d="M12 7.5v3"/><path d="M4 12h16"/><path d="M6.5 12l2 7h7l2-7M9.5 12l1 7M14.5 12l-1 7"/>',
  alley:
    '<circle cx="4.5" cy="18" r="2"/><path d="M6 15.5C8 7 14 4 18 9.5" stroke-dasharray="2 2.5"/><path d="M15 13h7M16.2 13l1 5.5h2.6l1-5.5"/>',
  hook: '<path d="M5 21v-6l3-4"/><path d="M8 11c0-5 4-8 9-7"/><circle cx="18.5" cy="4.5" r="2.2"/><circle cx="7" cy="7" r="1.7"/>',
  spin: '<path d="M19 9a7.5 7.5 0 1 0 1 6"/><path d="M19.5 3.5V9H14"/><circle cx="12" cy="12" r="2"/>',
};
const icon = (k, cls = '') =>
  `<svg class="st-icon${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[k] || '<circle cx="12" cy="12" r="6"/>'}</svg>`;
const LOCK =
  '<svg class="st-badge lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const CHECK =
  '<svg class="st-badge check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
// Why a move cannot be learned now, in the same words the other shops use.
const why = (s, n, reason) =>
  reason === 'locked'
    ? t('skills.needs', { move: move(n.requires) })
    : reason === 'tokens'
      ? t('office.needTokens', { n: n.cost - s.tokens })
      : reason === 'game'
        ? t('office.gameActive')
        : reason === 'inbox'
          ? t('office.inboxFirst')
          : t('office.seasonDone');
// owned: learned · open: can be bought now · blocked: next in line but tokens, a game, the inbox or the season's end stop it · locked: the previous move is missing.
const info = (s, n) => {
  const c = canUnlock(s, n.key),
    state = c.ok ? 'open' : c.reason === 'owned' ? 'owned' : c.reason === 'locked' ? 'locked' : 'blocked';
  return {
    state,
    why: state === 'blocked' || state === 'locked' ? why(s, n, c.reason) : '',
    text:
      state === 'owned' ? t('skills.owned') : state === 'open' ? t('skills.stateOpen') : why(s, n, c.reason),
  };
};
const where = key => {
  for (const b of BRANCHES) {
    const i = SKILL_TREE[b].findIndex(n => n.key === key);
    if (i >= 0) return { b, i };
  }
  return null;
};

/* The move shown in the detail panel: the one the coach picked, else the first move they can unlock now, else the next move in
   line that something blocks, else the first locked one, else (every move learned) the last move.
   The pick is remembered per game (save object), so a new season, an imported save or the demo starts fresh. */
const picked = new WeakMap();
export function selectSkill(key, s) {
  if (!s || typeof s !== 'object') return;
  if (key && where(key)) picked.set(s, key);
  else picked.delete(s);
}
export function selectedSkill(s) {
  if (picked.has(s)) return picked.get(s);
  const by = st => ALL.find(n => info(s, n).state === st)?.key;
  return by('open') || by('blocked') || by('locked') || ALL.at(-1).key;
}
/* Arrow keys on the tree: down and up walk a branch (tier 1 is at the top), left and right step to the neighbouring branch on the same tier. */
export function skillNeighbour(key, dir) {
  const w = where(key);
  if (!w) return null;
  if (dir === 'ArrowUp' || dir === 'ArrowDown')
    return SKILL_TREE[w.b][w.i + (dir === 'ArrowDown' ? 1 : -1)]?.key || null;
  if (dir !== 'ArrowLeft' && dir !== 'ArrowRight') return null;
  return SKILL_TREE[BRANCHES[BRANCHES.indexOf(w.b) + (dir === 'ArrowRight' ? 1 : -1)]]?.[w.i]?.key || null;
}

// One move: icon, name, and its cost (or "Unlocked") on a tile. The text is hidden from screen readers; aria-label says it all.
function nodeButton(s, n, sel) {
  const { state, text } = info(s, n),
    on = n.key === sel;
  const label = t('skills.nodeLabel', {
    move: move(n.key),
    state: text,
    cost: t('skills.cost', { cost: n.cost }),
  });
  return (
    `<button class="st-node ${state}" id="skill-${n.key}" data-action="skill-select" data-key="${n.key}" aria-pressed="${on}" tabindex="${on ? 0 : -1}" aria-label="${esc(label)}"${on ? ' aria-describedby="st-detail-hint"' : ''}>` +
    `<span class="st-medal" aria-hidden="true">${icon(n.key)}${state === 'locked' ? LOCK : state === 'owned' ? CHECK : ''}</span>` +
    `<span class="st-text" aria-hidden="true"><span class="st-name">${esc(move(n.key))}</span>` +
    `<span class="st-meta">${state === 'owned' ? t('skills.owned') : `<span class="st-coin"></span>${t('skills.cost', { cost: n.cost })}`}</span></span></button>`
  );
}
// The connector between two moves: solid once both ends are learned, dashed in the accent when it leads to the next move in line, dim otherwise.
function link(own, from, to) {
  const st = own.includes(from) && own.includes(to) ? 'lit' : own.includes(from) ? 'next' : 'locked';
  return `<span class="st-link ${st}" data-from="${from}" data-to="${to}" aria-hidden="true"></span>`;
}
// A branch: its name, what it adds, how much of it is learned (a segment per move), then its moves top to bottom.
function branch(s, b, sel) {
  const nodes = SKILL_TREE[b],
    own = unlockedMoves(s),
    done = nodes.filter(n => own.includes(n.key)).length;
  return (
    `<div class="st-branch" role="group" aria-labelledby="skill-branch-${b}"><div class="st-branch-head">` +
    `<h3 id="skill-branch-${b}">${t(`skills.branch.${b}`)}</h3><p>${t(`skills.branchHint.${b}`)}</p>` +
    `<div class="st-meter" aria-hidden="true">${nodes.map(n => `<i${own.includes(n.key) ? ' class="on"' : ''}></i>`).join('')}<span>${done}/${nodes.length}</span></div></div>` +
    nodes.map((n, i) => (i ? link(own, nodes[i - 1].key, n.key) : '') + nodeButton(s, n, sel)).join('') +
    `</div><!--/${b}-->`
  );
}

function detail(s, sel) {
  const { b, i } = where(sel),
    n = SKILL_TREE[b][i],
    { state, why: w } = info(s, n),
    cost = t('skills.cost', { cost: n.cost });
  const body =
    state === 'owned'
      ? `<p class="skill-state"><span aria-hidden="true">✓</span> ${t('skills.owned')}</p>`
      : state === 'locked'
        ? `<p class="skill-state"><b>${t('skills.locked')}</b> · ${esc(w)}</p><small class="st-price">${cost}</small>`
        : `<button class="secondary wide${state === 'blocked' ? ' locked-action' : ''}" data-action="skill-unlock" data-key="${n.key}" aria-describedby="st-detail-name${state === 'blocked' ? ' st-detail-why' : ''}" ${state === 'blocked' ? 'disabled' : ''}>${t('skills.unlock', { cost: n.cost })}</button>${state === 'blocked' ? `<small id="st-detail-why">${esc(w)}</small>` : ''}`;
  return `<div class="st-detail ${state}" role="region" aria-labelledby="st-detail-name"><div class="st-detail-top"><span class="st-medal" aria-hidden="true">${icon(n.key)}</span><div><span class="eyebrow">${esc(tu(`skills.branch.${b}`))} · ${t('skills.tier', { n: i + 1, total: SKILL_TREE[b].length })}</span><h3 id="st-detail-name">${esc(move(n.key))}</h3></div></div><p class="skill-hint" id="st-detail-hint">${t(`skills.hint.${n.key}`, { tactic: t('tactic.perimeter') })}</p>${body}</div><!--/detail-->`;
}

export function skillTreeCard(s) {
  const sel = selectedSkill(s);
  return `<section class="card skill-tree" aria-label="${t('skills.title')}"><div class="skill-head"><p class="skill-intro">${t('skills.intro')}</p><span class="pill">${t('skills.progress', { n: unlockedMoves(s).length, total: TOTAL })}</span></div>
 <div class="st-board"><div class="st-tree">${BRANCHES.map(b => branch(s, b, sel)).join('')}</div>${detail(s, sel)}</div>
 <div class="st-basics"><h3 class="skill-sub">${t('skills.basic')}</h3><ul class="skill-chips">${BASIC_MOVES.map(k => `<li class="skill-chip"><span class="sr-only">${t('skills.owned')}: </span><span aria-hidden="true">✓</span> ${move(k)}</li>`).join('')}</ul></div></section>`;
}
