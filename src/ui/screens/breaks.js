// Break screens (preseason, midseason, playoffs): Tryouts and Staff. The locker room is in locker.js.
import { tu, t } from '../../i18n/index.js';
import { tv } from '../../narrative.js';
import { skillTreeCard, selectSkill, skillNeighbour } from '../../skillsView.js';
import * as E from '../../engine.js';
import { play } from '../../audio.js';
import { announce } from '../../a11y.js';
import { html, header, pill, esc, btn, officeIcon, signed } from '../markup.js';
import { state, save } from '../store.js';
import { render } from '../shell.js';
import { notify } from '../toast.js';
import { $ } from '../page.js';

// Tryouts. Each card's buttons are secondary: the page's one primary action is leaving the break (top right).
export function recruit() {
  const full = state.players.length >= E.ROSTER_MAX;
  return html`
    ${header(tu('recruit.kicker'), t('nav.recruit'), t('recruit.intro'))}
    <div class="toolbar">
      ${pill(t('roster.spots', { n: state.players.length }))}${full ? `<span class="toolbar-note">${t('recruit.full')}</span>` : ''}
    </div>
    <div class="cards three">
      ${
        state.pool
          .map(
            p => html`
              <section class="card recruit">
                <div class="prospect-jersey-stage" data-prospect="${p.id}" aria-hidden="true">
                  <span class="prospect-jersey">${p.number}</span>
                </div>
                <span class="eyebrow">${tu('recruit.tryout', { pos: esc(tv(p.position)) })}</span>
                <h2>${esc(p.name)}</h2>
                <div class="effect-list">
                  <span>${t('roster.skill')} <b>${p.skill}</b></span><span>${t('roster.energy')} <b>${p.energy}</b></span><span>${t('roster.gpa')} <b>${p.gpa}</b></span>
                </div>
                ${scoutRow(p)}
                ${btn(t('recruit.sign', { cost: p.cost }), 'recruit', 'secondary wide', `data-id="${p.id}" aria-label="${esc(t('recruit.signAria', { name: p.name, cost: p.cost }))}" ${full || state.tokens < p.cost || state.finished || state.match ? 'disabled' : ''}`)}
                ${!full && state.tokens < p.cost ? `<small>${t('office.needTokens', { n: p.cost - state.tokens })}</small>` : ''}
              </section>`,
          )
          .join('') || `<section class="card">${t('recruit.none')}</section>`
      }
    </div>`;
}
// The skill tree (skillsView.js) has no route in the weekly flow yet; the skill-tree-ui branch is building it.
function skillsView() {
  return `${header(tu('skills.kicker'), t('nav.skills'))}${skillTreeCard(state)}`;
}
// Selecting a move shows it in the detail panel; focus follows so the tree stays one Tab stop.
export function pickSkill(key) {
  selectSkill(key, state);
  render();
  $(`#skill-${key}`)?.focus({ preventScroll: true });
}
// Arrow keys walk the tree from the focused move (roving focus).
export function onSkillKey(e) {
  const n = e.target.closest?.('.st-node');
  if (!n || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = skillNeighbour(n.dataset.key, e.key);
  if (!k) return;
  e.preventDefault();
  pickSkill(k);
}
export function unlockSkill(key) {
  const node = E.skillNode(key);
  E.unlockSkill(state, key);
  selectSkill(key, state);
  save();
  play('signing');
  const name = t(`shot.${key}`);
  notify(t('skills.unlockedMsg', { move: name }), {
    type: 'success',
    icon: 'ball',
    title: t('skills.unlockedTitle'),
    chips: [signed(-node.cost, t('toast.tokens'))],
  });
  announce(`${t('skills.unlockedTitle')}: ${name}`);
  render();
  const n = $(`#skill-${key}`);
  n?.classList.add('st-burst');
  n?.focus({ preventScroll: true });
}
export function staffView() {
  const blocked = state.finished
    ? t('office.seasonDone')
    : state.match
      ? t('office.gameActive')
      : state.pendingEvent
        ? t('office.inboxFirst')
        : '';
  return html`
    ${header(tu('office.assistantKicker'), t('nav.staff'))}
    <section class="card office-section">
      <div class="office-heading">
        <h2>${t('office.buildStaff')}</h2>
        ${state.assistant ? btn(t('office.dismiss'), 'dismiss', 'secondary small', blocked ? 'disabled' : '') : ''}
      </div>
      <div class="office-grid">
        ${E.staff
          .map(a => {
            const hired = state.assistant === a.key,
              reason =
                blocked ||
                (hired
                  ? t('office.hired')
                  : state.assistant
                    ? t('office.slotFull')
                    : state.tokens < a.cost
                      ? t('office.needTokens', { n: a.cost - state.tokens })
                      : '');
            return html`
              <article class="office-option ${hired ? 'owned' : ''}">
                ${officeIcon(a.key)}
                <h3>${t(`staff.${a.key}.name`)}</h3>
                <p>${t(`staff.${a.key}.detail`)}</p>
                ${btn(hired ? '✓ ' + t('office.hired') : t('office.hireCost', { cost: a.cost }), 'hire', 'secondary wide', `data-key="${a.key}" ${reason ? 'disabled' : ''}`)}
                ${reason ? `<small>${reason}</small>` : ''}
              </article>`;
          })
          .join('')}
      </div>
    </section>
    ${upgradesCard()}`;
}
function upgradesCard() {
  const g = state.finished ? null : state.schedule[state.week],
    w = E.gameIncome(state, true, g),
    l = E.gameIncome(state, false, g);
  return html`
    <section class="card office-section">
      <div class="office-heading">
        <h2>${t('office.upgTitle')}</h2>
        ${pill(t('office.permanent'))}
      </div>
      <div class="office-grid upgrades-grid">
        ${E.UPGRADES.map(u => {
          const own = E.hasUpgrade(state, u.key),
            name = t(`upg.${u.key}.name`),
            fx = t(`upg.${u.key}.fx`),
            reason = state.finished
              ? t('office.seasonDone')
              : state.match
                ? t('office.gameActive')
                : state.pendingEvent
                  ? t('office.inboxFirst')
                  : state.tokens < u.cost
                    ? t('office.needTokens', { n: u.cost - state.tokens })
                    : '';
          return html`
            <article class="office-option ${own ? 'owned' : ''}">
              ${officeIcon(u.key)}
              <h3>${name}</h3>
              <p>${fx}</p>
              ${own ? `<span class="pill">✓ ${t('office.upgOwned')}</span>` : btn(t('office.upgBuy', { cost: u.cost }), 'upgrade', 'secondary wide', `data-key="${u.key}" aria-label="${esc(t('office.upgAria', { name, cost: u.cost, effect: fx }))}" ${reason ? 'disabled' : ''}`)}
              ${!own && reason ? `<small>${reason}</small>` : ''}
            </article>`;
        }).join('')}
      </div>
      ${
        g
          ? html`
            <details class="office-budget">
              <summary>${t('office.budgetDetails')}</summary>
              <p>${t('office.upgBudget', { lo: l.net, hi: w.net, upkeep: l.upkeep, travel: l.travel })}</p>
            </details>`
          : ''
      }
    </section>`;
}
// Tryouts: scouting reveals a prospect's hidden potential and work ethic for a small token cost.
function scoutRow(p) {
  if (state.scoutedProspects?.[p.id]) {
    const tr = E.prospectTraits(state.seed, p.id);
    return html`
      <div class="effect-list scout-traits">
        <span>${t('scoutP.potential')} <b>${tr.ceil}</b></span><span>${t('scoutP.work')} <b role="img" aria-label="${esc(t('scoutP.workAria', { k: tr.work }))}">${[1, 2, 3, 4, 5].map(i => (i <= tr.work ? '★' : '☆')).join('')}</b></span>
      </div>`;
  }
  return html`
    ${btn(t('scoutP.btn', { cost: E.SCOUT_COST }), 'scout-prospect', 'secondary small wide', `data-id="${p.id}" aria-label="${esc(t('scoutP.aria', { name: p.name, cost: E.SCOUT_COST }))}" ${state.tokens < E.SCOUT_COST || state.finished || state.match ? 'disabled' : ''}`)}`;
}
