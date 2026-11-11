import * as E from '../../engine.js';
import { t, tu, translateError } from '../../i18n/index.js';
import { logText } from '../../narrative.js';
import { play } from '../../audio.js';
import { mountDrill } from '../../drills.js';
import { state, save } from '../store.js';
import { esc, html, svg, sgn, PLAN_ICONS, officeIcon, btn, header } from '../markup.js';
import { render } from '../shell.js';
import { modal } from '../page.js';
import { notify } from '../toast.js';
import { show } from '../dialogs.js';

// Prep: one list of everything a week can hold. The coach picks up to 3 (one per open slot), then
// "Run the week" plays them in order: drills are played in a dialog, the clinic and film happen on their own card.
// A drill that is missed leaves its pick in the plan, so it can be run again.
const PREP = [...Object.keys(E.plans), 'fundraise', 'film'];
export let practicePlan = []; // keys picked for this week, in order
export let practiceRun = null; // while running: { queue, done: [{ key, passed }], cleanup }

export function planCap() {
  return Math.max(0, Math.min(3, state?.actions ?? 0));
}
export function clearPlan() {
  practicePlan = [];
}
export function practice() {
  practicePlan = practicePlan.filter(k => PREP.includes(k)).slice(0, planCap());
  const cap = planCap(),
    full = practicePlan.length >= cap,
    locked = state.finished || !!state.match,
    opp = state.finished ? '' : esc(E.opponent(state).opponent),
    filmCost = E.hasUpgrade(state, 'film') ? 0 : 50;
  const why = k =>
    k === 'fundraise' && state.conversation
      ? t('office.checkDone')
      : k === 'film' && state.scouted
        ? t('prep.filmDone')
        : k === 'film' && state.tokens < filmCost
          ? t('office.needTokens', { n: filmCost - state.tokens })
          : '';
  const used = 3 - cap,
    slots = [0, 1, 2]
      .map(i => {
        const label = `<span>${tu('practice.slot', { n: i + 1 })}</span>`,
          k = practicePlan[i - used];
        if (i < used) return `<div class="plan-slot used">${label}<b>${t('flow.doneBadge')}</b></div>`;
        return k
          ? html`
            <div class="plan-slot filled">
              ${label}<b>${prepName(k)}</b><button class="plan-x" data-action="plan-toggle" data-plan="${k}" aria-label="${esc(t('practice.removeAria', { name: prepName(k) }))}">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
            </div>`
          : `<div class="plan-slot open">${label}<b>${t('practice.open')}</b></div>`;
      })
      .join('');
  const fx = k => {
    const p = E.plans[k];
    if (!p)
      return k === 'film'
        ? `<span>${filmCost ? `${filmCost} ${t('toast.tokens')}` : t('office.upgOwned')}</span>`
        : t('office.fundraiseFx')
            .split(' · ')
            .map(x => `<span>${x}</span>`)
            .join('');
    return [
      p.skill && t('practice.fxSkill', { n: '+' + p.skill }),
      p.energy && t('practice.fxEnergy', { n: sgn(p.energy) }),
      p.morale && t('practice.fxMorale', { n: '+' + p.morale }),
      p.gpa && t('practice.fxGpa', { n: sgn(p.gpa.toFixed(2)) }),
    ]
      .filter(Boolean)
      .map(x => `<span>${x}</span>`)
      .join('');
  };
  const row = k => {
    const on = practicePlan.includes(k),
      i = Object.keys(E.plans).indexOf(k),
      no = why(k);
    return html`
      <li class="prep-row ${on ? 'on' : ''}">
        ${i >= 0 ? `<span class="prep-icon" aria-hidden="true">${svg(PLAN_ICONS[i])}</span>` : officeIcon(k)}
        <div class="prep-main"><strong>${prepName(k)}</strong><small>${no || prepDesc(k, opp)}</small></div>
        <div class="effect-list">${fx(k)}</div>
        ${btn(t(on ? 'practice.inPlan' : full ? 'practice.planFull' : 'practice.add'), 'plan-toggle', on ? 'primary small' : 'secondary small', `data-plan="${k}" aria-pressed="${on}" ${locked || no || (!on && full) ? 'disabled' : ''}`)}
      </li>`;
  };
  return html`
    ${header(tu('practice.kicker'), state.finished ? t('nav.practice') : t('prep.title', { opp }), t('prep.slots', { n: cap - practicePlan.length }))}
    <div class="prep-grid">
      <section class="card prep-list"><ul>${PREP.map(row).join('')}</ul></section>
      <section class="prep-side">
        <div class="plan-slots">${slots}</div>
        ${cap ? btn(t('flow.run'), 'practice-start', 'primary wide', practicePlan.length && !locked ? '' : 'disabled') : ''}<button class="${cap ? 'secondary' : 'primary'} wide prep-go" data-view="game">${t('flow.toGame')}</button>
      </section>
    </div>`;
}
const prepName = k =>
  E.plans[k] ? t(`plan.${k}.name`) : k === 'film' ? t('prep.film') : t('office.fundraise');
const prepDesc = (k, opp) =>
  E.plans[k] ? t(`plan.${k}.desc`) : k === 'film' ? t('prep.filmFx', { opp }) : '';
export function togglePlan(key) {
  if (!PREP.includes(key)) return;
  const i = practicePlan.indexOf(key);
  if (i >= 0) practicePlan.splice(i, 1);
  else {
    if (practicePlan.length >= planCap())
      throw Error(
        planCap() ? 'Your plan holds 3 sessions. Remove one first.' : 'No preparation slots left this week.',
      );
    practicePlan.push(key);
  }
  render();
}
export function startPractice() {
  if (!practicePlan.length || practiceRun) return;
  practiceRun = { queue: [...practicePlan], done: [], cleanup: null };
  nextDrill();
}
const drillResult = (passed, badge, msg, last) =>
  html`
    <div class="drill-result ${passed ? 'pass' : 'fail'}" role="status">
      <b>${badge}</b>
      <p>${esc(msg)}</p>
      ${btn(t(last ? 'practice.finish' : 'practice.nextDrill'), 'practice-next', 'primary')}
    </div>`;
export function nextDrill() {
  const run = practiceRun;
  if (!run) return;
  run.cleanup?.();
  run.cleanup = null;
  const key = run.queue.shift();
  if (!key) {
    practiceRun = null;
    practicePlan = practicePlan.filter(k => !run.done.some(d => d.key === k && d.passed));
    if (modal.open) modal.close();
    render();
    const won = run.done.filter(d => d.passed);
    notify(
      won.length
        ? `${t('practice.doneUnlocked', { names: won.map(d => prepName(d.key)).join(', ') })}${run.done.length > won.length ? ` ${t('practice.doneMissed')}` : ''}`
        : t('practice.doneNone'),
      {
        type: won.length ? 'success' : 'warn',
        icon: 'ball',
        title: won.length
          ? t('practice.titleWon', { won: won.length, total: run.done.length })
          : t('practice.titleNone'),
      },
    );
    return;
  }
  const name = prepName(key),
    left = run.queue.length;
  show(
    html`
      <div class="drill-shell">
        <span class="eyebrow">${esc(t('practice.session', { name }))}${left ? `, ${esc(t('practice.more', { n: left }))}` : ''}</span>
        <div id="drill-root"></div>
      </div>`,
  );
  if (!E.plans[key]) {
    let ok = true,
      msg;
    try {
      if (key === 'film') E.scout(state);
      else E.talk(state, key);
      save();
      msg = logText(state.log[0]);
    } catch (err) {
      ok = false;
      msg = translateError(err.message);
    }
    run.done.push({ key, passed: ok });
    modal.querySelector('#drill-root').innerHTML = drillResult(
      ok,
      ok ? t('flow.doneBadge') : tu('practice.badgeFail'),
      msg,
      !run.queue.length,
    );
    if (ok) play('confirm');
    modal.querySelector('[data-action="practice-next"]')?.focus();
    return;
  }
  run.cleanup = mountDrill(modal.querySelector('#drill-root'), key, r => {
    run.cleanup?.();
    run.cleanup = null;
    let msg;
    if (r.passed) {
      try {
        E.train(state, key, 'all', { perfect: r.perfect });
        save();
        msg = t(r.perfect ? 'practice.unlockedPerfect' : 'practice.unlockedMsg', {
          name,
          log: state.log[0] ? logText(state.log[0]) : '',
        }).trim();
      } catch (err) {
        msg = translateError(err.message);
        r.passed = false;
      }
    } else msg = t('practice.missMsg', { made: r.made, total: r.total, name });
    run.done.push({ key, passed: r.passed });
    const root = modal.querySelector('#drill-root');
    if (root)
      root.innerHTML = drillResult(
        r.passed,
        tu(
          r.passed ? (r.perfect ? 'practice.badgePerfect' : 'practice.badgeUnlocked') : 'practice.badgeFail',
        ),
        msg,
        !run.queue.length,
      );
    if (r.passed) play(r.perfect ? 'signing' : 'confirm');
    modal.querySelector('[data-action="practice-next"]')?.focus();
  });
}
// Closing the dialog mid-run stops the run; picks that were passed leave the plan.
export function endPracticeRun() {
  if (!practiceRun) return;
  practiceRun.cleanup?.();
  const run = practiceRun;
  practiceRun = null;
  practicePlan = practicePlan.filter(k => !run.done.some(d => d.key === k && d.passed));
  render();
}
