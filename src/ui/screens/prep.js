import * as E from '../../engine.js';
import { t, tu, translateError } from '../../i18n/index.js';
import { logText } from '../../narrative.js';
import { play } from '../../audio.js';
import { mountDrill } from '../../drills.js';
import { state, save } from '../store.js';
import { esc, html, svg, chipHtml, PLAN_ICONS, officeIcon, btn, header } from '../markup.js';
import {
  PREP,
  planCap as cap0,
  planEffects,
  prepBlock,
  fillPlan,
  lastWeekPlan,
  suggestedPlan,
} from '../../prepPlan.js';
import { render } from '../shell.js';
import { modal } from '../page.js';
import { notify } from '../toast.js';
import { show } from '../dialogs.js';
import { noteWeek } from './results.js';

// Prep: one list of everything a week can hold. The coach picks up to 3 (one per open slot), then
// "Run the week" plays them in order: drills are played in a dialog, the clinic and film happen on their own card.
// A drill that is missed leaves its pick in the plan, so it can be run again. "Suggested plan" and "Repeat last week"
// fill the open slots only (src/prepPlan.js); they never replace a pick and never run the week.
export let practicePlan = []; // keys picked for this week, in order
export let practiceRun = null; // while running: { queue, done: [{ key, passed }], cleanup }
export let lastRun = null; // the last run that ended: { week, missed: [keys] } (the lessons look for a missed drill)
const ended = run => {
  lastRun = { week: state.week, missed: run.done.filter(d => !d.passed).map(d => d.key) };
};

export const planCap = () => cap0(state);
export function clearPlan() {
  practicePlan = [];
  lastRun = null;
}
const blockText = b => (b ? t(b.key, { n: b.n }) : '');
// The picks each one-click plan would add now (none when the plan is full or every pick is taken or blocked).
const fills = () => {
  const add = picks => fillPlan(state, practicePlan, picks).slice(practicePlan.length);
  return { suggest: add(suggestedPlan(state)), repeat: add(lastWeekPlan(state)) };
};
export function practice() {
  noteWeek(state);
  practicePlan = practicePlan.filter(k => PREP.includes(k)).slice(0, planCap());
  const cap = planCap(),
    full = practicePlan.length >= cap,
    locked = state.finished || !!state.match,
    opp = state.finished ? '' : esc(E.opponent(state).opponent);
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
  // What a pick changes, as the press room's up/down chips. Free film (the Film room upgrade) says so.
  const fx = k => {
    const list = planEffects(state, k);
    return list.length
      ? list.map(chipHtml).join('')
      : k === 'film'
        ? `<span class="chip">${t('prep.filmFree')}</span>`
        : '';
  };
  const row = k => {
    const on = practicePlan.includes(k),
      i = Object.keys(E.plans).indexOf(k),
      no = blockText(prepBlock(state, k));
    return html`
      <li class="prep-row ${on ? 'on' : ''}" data-row="${k}">
        ${i >= 0 ? `<span class="prep-icon" aria-hidden="true">${svg(PLAN_ICONS[i])}</span>` : officeIcon(k)}
        <div class="prep-main"><strong>${prepName(k)}</strong><small>${no || prepDesc(k, opp)}</small></div>
        <div class="prep-fx chips">${fx(k)}</div>
        ${btn(t(on ? 'practice.inPlan' : full ? 'practice.planFull' : 'practice.add'), 'plan-toggle', 'secondary small', `data-plan="${k}" aria-pressed="${on}" ${locked || no || (!on && full) ? 'disabled' : ''}`)}
      </li>`;
  };
  const f = locked ? { suggest: [], repeat: [] } : fills(),
    tools =
      f.suggest.length || f.repeat.length
        ? html`
          <div class="prep-fill">
            ${f.suggest.length ? btn(t('prep.suggest'), 'plan-suggest', 'secondary small') : ''}
            ${f.repeat.length ? btn(t('prep.repeat'), 'plan-repeat', 'secondary small') : ''}
            <small>${t('prep.fillNote')}</small>
          </div>`
        : '';
  // The way forward: Run the week while a slot is open, with why it can't run yet or else the plan's count (shown on
  // phones only, where the slots are hidden); with no slot open, Game day.
  const why = !cap
      ? ''
      : state.match
        ? t('notify.finishFirst')
        : state.finished
          ? t('prep.seasonOver')
          : practicePlan.length
            ? ''
            : t('prep.pickFirst'),
    action = cap
      ? html`
        <div class="page-action">
          ${btn(t('flow.run'), 'practice-start', 'primary wide', why ? 'disabled aria-describedby="run-why"' : '')}
          ${why ? `<small class="page-why" id="run-why">${why}</small>` : ''}
          ${why ? '' : `<small class="page-status">${t('practice.planned', { n: practicePlan.length, cap })}</small>`}
        </div>
        <button class="secondary wide prep-go" data-view="game">${t('flow.toGame')}</button>`
      : `<div class="page-action"><button class="primary wide prep-go" data-view="game">${t('flow.toGame')}</button></div>`;
  return html`
    ${header(tu('practice.kicker'), state.finished ? t('nav.practice') : t('prep.title', { opp }))}
    <div class="prep-grid">
      <section class="card prep-list">${tools}<ul>${PREP.map(row).join('')}</ul></section>
      <section class="prep-side">
        <div class="plan-slots">${slots}</div>
        ${action}
      </section>
    </div>`;
}
const prepName = k =>
  E.plans[k] ? t(`plan.${k}.name`) : k === 'film' ? t('prep.film') : t('office.fundraise');
const prepDesc = (k, opp) =>
  E.plans[k] ? t(`plan.${k}.desc`) : k === 'film' ? t('prep.filmFx', { opp }) : t('prep.clinicDesc');
// "Suggested plan" / "Repeat last week": add to the open slots only.
export function fillFrom(kind) {
  if (state.finished || state.match || practiceRun) return;
  practicePlan = fillPlan(
    state,
    practicePlan,
    kind === 'repeat' ? lastWeekPlan(state) : suggestedPlan(state),
  );
  render();
}
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
    ended(run);
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
  ended(run);
  practicePlan = practicePlan.filter(k => !run.done.some(d => d.key === k && d.passed));
  render();
}
