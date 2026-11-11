// After a game: the result dialog closes, then the press room (up to PRESS_MAX questions), then maybe an inbox event.
// Each answer or choice shows its effects as chips. The engine side is in press.js and events.js.
import { t, tu, translateError } from '../i18n/index.js';
import * as V from '../events.js';
import { announce } from '../a11y.js';
import { play } from '../audio.js';
import * as P from '../press.js';
import { esc, html, svg, TOAST_ICONS, chipHtml, btn } from './markup.js';
import { state, view, save, ui } from './store.js';
import { render, go } from './shell.js';
import { show } from './dialogs.js';
import { modal } from './page.js';
import { notify } from './toast.js';

export const PRESS_MAX = 2;
let pressOpen = false; // the press room dialog is showing a question

// Locale text whose string parameters are names from the save, so they are escaped.
const escParams = params =>
  Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, typeof v === 'string' ? esc(v) : v]));
const chips = list => list.map(chipHtml).join('') || `<span class="chip">${t('press.none')}</span>`;
const eventText = (id, key, params) => t(`ev.${id}.${key}`, escParams(params));
function eventShell(icon, title, body) {
  return html`
    <div class="inbox-card">
      <div class="inbox-icon" aria-hidden="true">
        ${svg(TOAST_ICONS[icon === 'recruit' ? 'staff' : icon] || TOAST_ICONS.info)}
      </div>
      <span class="eyebrow">${tu('inbox.kicker')}</span>
      <h1>${title}</h1>
      ${body}
    </div>`;
}
export function showEvent() {
  const pe = state?.pendingEvent;
  if (!pe) return false;
  const d = V.EVENTS.find(e => e.id === pe.id);
  if (!d || V.eventStale(state)) {
    state.pendingEvent = null;
    save();
    render();
    return false;
  }
  const opts = V.previewOptions(state);
  show(
    eventShell(
      d.icon,
      t(`ev.${d.id}.title`),
      html`
        <p class="inbox-text">${eventText(d.id, 'text', pe.params)}</p>
        <div class="inbox-options">
          ${opts.map((o, i) => `<button type="button" class="inbox-option" data-action="pick-event" data-i="${i}" data-pick ${o.available ? '' : 'disabled'}><kbd class="key">${i + 1}</kbd><span><strong>${t(`ev.${d.id}.o.${o.id}`)}</strong><span class="chips">${o.available ? chips(o.chips) : `<span class="chip bad">${t('inbox.unavailable')}</span>`}</span></span></button>`).join('')}
        </div>
        <p class="muted">${t('inbox.hint')}</p>`,
    ),
  );
  modal.querySelector('[data-pick]:not([disabled])')?.focus();
  announce(t('inbox.pending'));
  return true;
}
export function chooseEvent(i) {
  try {
    const r = V.resolveEvent(state, i);
    save();
    if (!r) {
      modal.close();
      render();
      return;
    }
    const body = html`
      <p class="inbox-text">${t('inbox.chose', { choice: `<b>${t(`ev.${r.id}.o.${r.choice}`)}</b>` })}</p>
      <div class="chips">${chips(r.chips)}</div>
      <div class="modal-actions">${btn(t('inbox.continue'), 'inbox-done', 'primary')}</div>`;
    show(eventShell('success', t(`ev.${r.id}.title`), body));
    modal.querySelector('[data-action="inbox-done"]')?.focus();
    render();
  } catch (err) {
    notify(translateError(err.message), { type: 'error' });
    play('error');
  }
}
export function closeInbox() {
  modal.close();
  if (view === 'game' && !state.match) go('home');
}
export function showPress() {
  const pr = state?.press;
  if (!pr || pr.done) return false;
  pressOpen = true;
  const prev = P.previewPress(state),
    i = pr.questions.findIndex(x => !x.answer);
  if (i < 0) return false;
  const q = pr.questions[i],
    pv = prev[i];
  const qText = t(`press.${q.id}.q`, escParams(q.params));
  show(
    html`
      <div class="inbox-card press">
        <div class="inbox-icon reporter" aria-hidden="true">${svg(TOAST_ICONS.film)}</div>
        <span class="eyebrow">${tu('press.kicker')} · ${esc(t('press.progress', { n: i + 1, total: pr.questions.length }))}</span>
        <h1>${t('press.title')}</h1>
        <div class="drill-pips" aria-hidden="true">
          ${pr.questions.map((x, k) => `<i class="${x.answer ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}
        </div>
        <p class="inbox-text"><b>${t('press.reporter')}:</b> ${qText}</p>
        <div class="inbox-options">
          ${pv.answers.map((a, k) => `<button type="button" class="inbox-option" data-action="pick-press" data-q="${i}" data-a="${a.id}" data-pick><kbd class="key">${k + 1}</kbd><span><strong>${t(`press.${q.id}.a.${a.id}`)}</strong><span class="chips">${chips(a.chips)}</span></span></button>`).join('')}
        </div>
        <div class="modal-actions">${btn(t('press.skip'), 'press-skip', 'text-button')}</div>
      </div>`,
  );
  modal.querySelector('[data-pick]')?.focus();
  return true;
}
export function choosePress(qi, ans) {
  try {
    P.answerPress(state, qi, ans);
    save();
    if (state.press.done) {
      pressOpen = false;
      const effects = Object.entries(state.nextMods || {})
        .filter(([, v]) => v)
        .map(([k, v]) => ({ k, v, who: 'next' }));
      show(
        html`
          <div class="inbox-card press">
            <div class="inbox-icon reporter" aria-hidden="true">${svg(TOAST_ICONS.success)}</div>
            <span class="eyebrow">${tu('press.kicker')}</span>
            <h1>${t('press.done')}</h1>
            <h2>${t('press.effects')}</h2>
            <div class="chips">${chips(effects)}</div>
            <div class="modal-actions">${btn(t('inbox.continue'), 'press-after', 'primary')}</div>
          </div>`,
      );
      modal.querySelector('[data-action="press-after"]')?.focus();
      render();
    } else showPress();
  } catch (err) {
    notify(translateError(err.message), { type: 'error' });
    play('error');
  }
}
// The press room from Home's next step (after a reload, say).
export function openPress() {
  if (!state.press || state.press.week !== state.week) P.startPress(state, PRESS_MAX);
  save();
  if (!showPress()) render();
}
export function skipPress() {
  pressOpen = false;
  P.skipPress(state);
  save();
  afterPress();
}
// Closing the press room dialog (Esc or ×) counts as skipping the rest.
export function pressClosed() {
  if (!pressOpen) return;
  pressOpen = false;
  if (state?.press && !state.press.done) {
    P.skipPress(state);
    const pe = V.rollEvent(state);
    save();
    if (pe) {
      render();
      setTimeout(showEvent, 0);
    } else go('home');
  }
}
// After the press room: the inbox may have news.
export function afterPress() {
  modal.close();
  const pe = V.rollEvent(state);
  save();
  if (pe) {
    render();
    showEvent();
  } else go('home');
}
// After a game result is closed: press room first (if the season goes on), then maybe an event.
export function postGame() {
  if (!state || state.finished) {
    ui.flowPending = false;
    return;
  }
  P.startPress(state, PRESS_MAX);
  save();
  if (view === 'home') render();
  else go('home');
  if (!showPress()) afterPress();
}
