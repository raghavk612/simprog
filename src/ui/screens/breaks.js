// Shop pages: Tryouts, Staff, Skill tree and Gear (the locker room is in locker.js). Open at any time; the three breaks
// (preseason, midseason, playoffs) walk through them.
import { tu, t } from '../../i18n/index.js';
import { tv } from '../../narrative.js';
import { skillTreeCard, selectSkill, skillNeighbour } from '../../skillsView.js';
import { gearBody } from '../../gearView.js';
import * as E from '../../engine.js';
import { play } from '../../audio.js';
import { announce } from '../../a11y.js';
import { html, header, pill, esc, btn, officeIcon, signed } from '../markup.js';
import { state, save } from '../store.js';
import { render } from '../shell.js';
import { notify } from '../toast.js';
import { $ } from '../page.js';
import { prospectFit, fitLine, teamNeeds, needsLine, shortText } from '../../shopFit.js';
import { withRail } from '../rail.js';

// Tryouts. Each card's buttons are secondary: the page's one primary action is top right (leaving the break, or the
// week's next step). The line at the top says what the team needs; each card shows the prospect's OVR on the roster's
// scale and how he compares with the starter he would have to beat (shopFit.js), so "would he start?" is answered here.
export function recruit() {
  const full = state.players.length >= E.ROSTER_MAX,
    blocked = shopBlocked(),
    need = teamNeeds(state),
    weak = need?.rating.key;
  return html`
    ${header(t('nav.recruit'), t('recruit.intro'))}
    <div class="toolbar">
      ${pill(t('roster.spots', { n: state.players.length }))}${full ? `<span class="toolbar-note">${t('recruit.full')}</span>` : ''}
    </div>
    <div class="tryouts">
    ${state.pool.length && need ? `<p class="team-needs" role="note">${esc(needsLine(state))}</p>` : ''}
    <div class="cards three">
      ${
        state.pool
          .map(p => {
            const fit = prospectFit(state, p),
              r = E.ratings(p),
              signWhy = blocked || (full ? t('recruit.fullShort') : shortText(state, p.cost)),
              signShort = !blocked && !full && !!signWhy;
            return html`
              <section class="card recruit">
                <div class="prospect-jersey-stage" data-prospect="${p.id}" aria-hidden="true">
                  <span class="prospect-jersey">${p.number}</span>
                </div>
                <b class="sq-ovr recruit-ovr" title="${esc(t('rv.overall'))}"><small>${t('rv.ovr')}</small> ${fit.ovr}</b>
                <span class="eyebrow">${tu('recruit.tryout', { pos: esc(tv(p.position)) })}</span>
                <h2>${esc(p.name)}</h2>
                <p class="recruit-fit${fit.starts ? ' starts' : ''}">${esc(fitLine(state, p))}</p>
                <div class="effect-list">
                  <span>${t('roster.skill')} <b>${p.skill}</b></span><span>${t('roster.energy')} <b>${p.energy}</b></span><span>${t('roster.gpa')} <b>${p.gpa}</b></span>${weak ? `<span title="${esc(t(`rv.${weak}T`))}">${t(`rv.${weak}`)} <b>${r[weak]}</b></span>` : ''}
                </div>
                ${scoutRow(p, blocked, signWhy)}
                ${btn(t('recruit.sign', { cost: p.cost }), 'recruit', 'secondary wide', `data-id="${p.id}" aria-label="${esc(t('recruit.signAria', { name: p.name, cost: p.cost }))}" ${signWhy ? `disabled aria-describedby="sign-why-${p.id}"` : ''}`)}
                ${signWhy ? `<small id="sign-why-${p.id}"${signShort ? ' class="need-tokens"' : ''}>${esc(signWhy)}</small>` : ''}
              </section>`;
          })
          .join('') || `<section class="card">${t('recruit.none')}</section>`
      }
    </div>
    </div>`;
}
// What stops any Shop purchase right now, before tokens: the season's end, a game in progress, or the coach's inbox.
const shopBlocked = () =>
  state.finished
    ? t('office.seasonDone')
    : state.match
      ? t('office.gameActive')
      : state.pendingEvent
        ? t('office.inboxFirst')
        : '';
// Gear: buy items with tokens and choose who wears them. Whose loadout is shown and the shop filter live here, not in the save.
let gearPlayer = null,
  gearFilter = 'all';
export function gear() {
  return `${header(t('nav.gear'), t('gear.intro'))}${gearBody(state, gearPlayer, gearFilter)}`;
}
export function setGearPlayer(id) {
  gearPlayer = id;
  render();
}
export function setGearFilter(f) {
  gearFilter = f === 'owned' ? 'owned' : 'all';
  render();
}
// The skill tree: unlock new moves with tokens (the tree itself is drawn by skillsView.js).
export function skillsView() {
  return withRail('skills', header(t('nav.skills')), skillTreeCard(state));
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
// The reason under a greyed-out purchase: what blocks it, or the missing tokens and how many the coach has (the assistant
// coach's tip on a .need-tokens line says where to earn them).
const short = (cost, reason) => !!reason && reason === shortText(state, cost);
export function staffView() {
  const blocked = shopBlocked();
  return html`
    ${header(t('nav.staff'))}
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
                    : shortText(state, a.cost));
            return html`
              <article class="office-option ${hired ? 'owned' : ''}">
                ${officeIcon(a.key)}
                <h3>${t(`staff.${a.key}.name`)}</h3>
                <p>${t(`staff.${a.key}.detail`)}</p>
                ${btn(hired ? '✓ ' + t('office.hired') : t('office.hireCost', { cost: a.cost }), 'hire', 'secondary wide', `data-key="${a.key}" ${reason ? 'disabled' : ''}`)}
                ${reason && !hired ? `<small${short(a.cost, reason) ? ' class="need-tokens"' : ''}>${reason}</small>` : ''}
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
            reason = shopBlocked() || shortText(state, u.cost);
          return html`
            <article class="office-option ${own ? 'owned' : ''}">
              ${officeIcon(u.key)}
              <h3>${name}</h3>
              <p>${fx}</p>
              ${own ? `<span class="pill">✓ ${t('office.upgOwned')}</span>` : btn(t('office.upgBuy', { cost: u.cost }), 'upgrade', 'secondary wide', `data-key="${u.key}" aria-label="${esc(t('office.upgAria', { name, cost: u.cost, effect: fx }))}" ${reason ? 'disabled' : ''}`)}
              ${!own && reason ? `<small${short(u.cost, reason) ? ' class="need-tokens"' : ''}>${reason}</small>` : ''}
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
// Tryouts: scouting reveals a prospect's hidden potential and work ethic for a small token cost. When it is refused for
// a reason the Sign line below does not already give, the reason sits under the Scout button.
function scoutRow(p, blocked, signWhy) {
  if (state.scoutedProspects?.[p.id]) {
    const tr = E.prospectTraits(state.seed, p.id);
    return html`
      <div class="effect-list scout-traits">
        <span>${t('scoutP.potential')} <b>${tr.ceil}</b></span><span>${t('scoutP.work')} <b role="img" aria-label="${esc(t('scoutP.workAria', { k: tr.work }))}">${[1, 2, 3, 4, 5].map(i => (i <= tr.work ? '★' : '☆')).join('')}</b></span>
      </div>`;
  }
  // When the Sign line already says how many tokens the coach has, the Scout line only says what is missing.
  const signShort = !blocked && !!signWhy && signWhy === shortText(state, Number(p.cost)),
    why =
      blocked ||
      (state.tokens < E.SCOUT_COST
        ? signShort
          ? t('office.needTokens', { n: E.SCOUT_COST - state.tokens })
          : shortText(state, E.SCOUT_COST)
        : ''),
    own = why && why !== signWhy;
  return html`
    ${btn(t('scoutP.btn', { cost: E.SCOUT_COST }), 'scout-prospect', 'secondary small wide', `data-id="${p.id}" aria-label="${esc(t('scoutP.aria', { name: p.name, cost: E.SCOUT_COST }))}" ${why ? `disabled aria-describedby="${own ? 'scout' : 'sign'}-why-${p.id}"` : ''}`)}
    ${own ? `<small id="scout-why-${p.id}" class="need-tokens">${esc(why)}</small>` : ''}`;
}
