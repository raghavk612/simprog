// Title screen. With a save: next game, Continue (primary) and New season, which reveals the start form;
// without one the form is shown. The season code folds behind a <details>.
import { getA11y } from '../../settings.js';
import { t, tu, translateError } from '../../i18n/index.js';
import { titleMatchup } from '../../title.js';
import { play } from '../../audio.js';
import * as E from '../../engine.js';
import { state, data, save, setState, setView, takeLateKits } from '../store.js';
import { html, LOGO_WHITE, pill, btn, esc, hint } from '../markup.js';
import { stage, render, go } from '../shell.js';
import { walkDefault, startTour } from '../tutorial.js';
import { confirmDialog } from '../dialogs.js';
import { notify, announceKits } from '../toast.js';
import { showEvent } from '../postgame.js';
import { arena, $ } from '../page.js';

let titlePause = null; // { paused, rm } once the coach has pressed pause; rm is the reduced-motion setting at the time
let launching = false; // true while the camera flies from the title into the gym
// The title gym shows a real season for the chosen difficulty when there is no save: built once per difficulty (seed 1), never saved.
let previews = {};

// The pause toggle follows reduced motion until the coach presses it, and again once that setting changes
// (WCAG 2.2.2: a way to stop the moving gym behind the menu).
const bgPaused = () => {
  const rm = !!getA11y().reducedMotion;
  return titlePause?.rm === rm ? titlePause.paused : rm;
};
const pauseLabel = () => t(bgPaused() ? 'landing.playBg' : 'landing.pauseBg');
// With reduced motion the gym is already still: no pause button.
const pauseAttr = () => (getA11y().reducedMotion ? 'hidden' : '');
// The gym (with the phone layout's pause overlay) comes first in the markup, as on phones it is the picture at the top;
// on desktop it is the full-screen backdrop and the links row holds the pause button instead.
export function landing() {
  const m = titleMatchup(state, data);
  return html`
    <main class="landing" id="main">
      <div class="landing-brand">
        <img class="brand-logo" src="${LOGO_WHITE}" alt="" width="58" height="43">
        <div>${tu('landing.school')} <span>${tu('landing.program')}</span></div>
        ${pill(tu('landing.badge'))}
      </div>
      <div class="landing-content">
        <div class="landing-visual">
          ${stage('title-arena', { controls: false })}
          ${btn(pauseLabel(), 'title-pause', 'title-pause-over', pauseAttr())}
          <div class="season-ticket">
            <span>${tu('landing.ticketSeason', { season: esc((data?.season ?? '2026–27').replace('–', '—')) })}</span><strong>${tu('landing.ticketA')}<br>${tu('landing.ticketB')}</strong>
            <div>
              ${data?.levels ? t('landing.ticketReal', { players: Object.values(data.levels).reduce((a, x) => a + x.players.length, 0), games: Object.values(data.levels).reduce((a, x) => a + x.games.length, 0) }) : t('landing.ticketFallback')}<br>${t('landing.ticketTail')}
            </div>
          </div>
        </div>
        <div class="landing-copy">
          <div class="eyebrow"><span class="line"></span> ${tu('landing.tagline')}</div>
          <h1 tabindex="-1">${tu('landing.titleA')}<br><em>${tu('landing.titleB')}</em></h1>
          <p>${t('landing.intro')}</p>
          ${
            state
              ? html`
                <div class="title-next">
                  <p class="title-next-game">
                    <span>${tu('landing.nextGame', { n: m.game, total: m.games })}</span>${m.opponent ? ` <span aria-hidden="true">·</span> <strong>${t('landing.vs', { team: esc(m.opponent) })}</strong>` : ''}
                  </p>
                  <p class="title-next-record">${t('landing.record', { w: m.wins, l: m.losses })}</p>
                </div>
                ${btn(t('landing.continueSeason'), 'continue', 'primary launch')}
                ${btn(t('landing.newSeason'), 'new-season-form', 'secondary wide', 'aria-expanded="false" aria-controls="start-form"')}`
              : ''
          }
          <form id="start-form"${state ? ' hidden' : ''}>
            <label for="coach">${tu('landing.name')}</label>
            <input id="coach" name="coach" maxlength="32" placeholder="${esc(t('landing.namePlaceholder'))}" required autocomplete="given-name">
            <div class="difficulty">
              <label for="difficulty">${tu('landing.challenge')}</label>
              <select id="difficulty" name="difficulty">
                ${Object.keys(E.DIFFICULTIES)
                  .map(
                    k =>
                      `<option value="${k}" ${k === 'standard' ? 'selected' : ''}>${t(`difficulty.${k}`)}</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <details class="code-toggle">
              <summary>${t('code.toggle')}</summary>
              <label for="code">${t('code.field')}</label>
              <input id="code" name="code" maxlength="16" placeholder="${esc(t('code.placeholder'))}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="code-hint"><small id="code-hint" class="code-hint">${t('code.hint')}</small>
            </details>
            <label class="walk-check">
              <input type="checkbox" name="walk" ${walkDefault() ? 'checked' : ''}> ${t('flow.walk')}
            </label>
            <button class="primary launch" type="submit">${t('landing.start')}</button>
          </form>
          <div class="landing-links">
            ${btn(t('landing.howTo'), 'rules')}
            ${btn(t('side.credits'), 'credits')}
            ${btn(t('landing.import'), 'import')}
            ${btn(t('landing.demo'), 'demo-start')}
            ${btn(t('top.settings'), 'settings', ' ', hint('settings'))}
            ${btn(pauseLabel(), 'title-pause', 'title-pause-link', pauseAttr())}
          </div>
        </div>
      </div>
      <footer>${tu('landing.footer')} <span>${tu('landing.footerNote')}</span></footer>
    </main>`;
}
export function syncTitlePause() {
  arena.setTitlePaused(bgPaused());
  const rm = !!getA11y().reducedMotion;
  document.querySelectorAll('[data-action="title-pause"]').forEach(b => {
    b.textContent = pauseLabel();
    b.hidden = rm;
  });
}
export function toggleTitlePause() {
  titlePause = { paused: !bgPaused(), rm: !!getA11y().reducedMotion };
  syncTitlePause();
}
// "New season" with a save open: shows or hides the start form.
export function toggleStartForm(button) {
  const f = $('#start-form'),
    open = !!f?.hidden;
  if (f) f.hidden = !open;
  button.setAttribute('aria-expanded', open);
  if (open) $('#coach')?.focus();
}
// Start / Continue: with motion on, the menu slides out while the camera flies into the gym; with reduced motion there is no wait.
async function leaveTitle() {
  const l = $('.landing');
  if (!arena.motion || !l) return;
  l.classList.add('leaving');
  l.inert = true;
  await arena.flyIn(900);
}
// If anything after leaveTitle fails, the menu comes back so the coach can try again.
function restoreTitle() {
  arena.endFly();
  const l = $('.landing');
  if (l) {
    l.classList.remove('leaving');
    l.inert = false;
  }
}
// The start form: a new season, from a season code if one is given, with the walk-through if it is ticked.
export async function startSeason(form) {
  if (launching) return;
  const f = new FormData(form);
  const raw = String(f.get('code') || '').trim(),
    code = raw ? E.parseSeasonCode(raw) : null;
  if (raw && !code) {
    notify(t('code.invalid'), { type: 'error' });
    play('error');
    const d = $('#code')?.closest('details');
    if (d) d.open = true;
    $('#code')?.focus();
    return;
  }
  launching = true;
  try {
    if (state && !(await confirmDialog(t('confirm.replace'), { yes: t('confirm.replaceYes'), danger: true })))
      return;
    await leaveTitle();
    setState(
      E.createGame(
        data,
        f.get('coach'),
        code ? code.difficulty : f.get('difficulty'),
        code ? code.seed : undefined,
      ),
    );
    E.autoLineup(state);
    if (f.get('walk') === 'on') startTour();
    save();
    play('whistle');
    setView('home');
    render();
    arena.setView('broadcast');
    $('main h1')?.focus({ preventScroll: true });
  } catch (err) {
    restoreTitle();
    play('error');
    notify(translateError(err.message), { type: 'error' });
  } finally {
    launching = false;
  }
}
// Continue on the title screen (with the fly-in), or the brand link back to Home.
export async function enterSeason(fromTitle) {
  if (launching) return;
  play('uiClick');
  try {
    if (fromTitle) {
      launching = true;
      await leaveTitle();
    }
    go('home');
  } catch (err) {
    restoreTitle();
    throw err;
  } finally {
    launching = false;
  }
  if (!fromTitle) return;
  const kits = takeLateKits();
  if (kits.length) announceKits(kits);
  if (state?.pendingEvent) showEvent();
}
export function titlePreview(difficulty = 'standard') {
  return data && E.DIFFICULTIES[difficulty]
    ? (previews[difficulty] ??= E.createGame(data, 'Coach', difficulty, 1))
    : null;
}
// New season data arrived: the previews are rebuilt from it when next needed.
export function clearPreviews() {
  previews = {};
}
