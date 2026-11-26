// KANGS · Road to the Championship. This file starts the app and connects the page's events to the code in src/ui/.
// src/ui/README.md says where everything lives.
import './style.css';
import './theme.css';
import './a11y.css';
import { onSettingsChange } from './settings.js';
import { perfWanted } from './perfHud.js';
import { t } from './i18n/index.js';
import { arena, modal, app } from './ui/page.js';
import { data, view, ui, setData, setView, restoreSave } from './ui/store.js';
import { html } from './ui/markup.js';
import { render, applyArena, syncCrowd, keepNavTabInView, syncCameraButtons } from './ui/shell.js';
import { onAction, onChange } from './ui/actions.js';
import { onShortcut, pickWithNumberKeys } from './ui/keyboard.js';
import { fpHud, reportPlay, syncPresentation, watchTick } from './ui/playback.js';
import { coachTick, lessonFailed, onCoachKey } from './ui/tutorial.js';
import { guardTick } from './ui/lessons.js';
import { pressClosed, postGame } from './ui/postgame.js';
import { endPracticeRun } from './ui/screens/prep.js';
import { startSeason, syncTitlePause, clearPreviews } from './ui/screens/landing.js';
import { renamePlayer, onRosterKey, onRosterRowClick } from './ui/screens/roster.js';
import { onSkillKey } from './ui/screens/breaks.js';

// The 3D gym follows the settings, shows the first-person player tag, and reports each play as it resolves.
applyArena();
setInterval(fpHud, 150);
// dev builds, or any build opened with ?perf (scripts/perf.mjs measures the built game): the gym for checking plays by
// hand (window.__kangsArena.clips[0].outcome = 'block', ...)
if (import.meta.env?.DEV || perfWanted()) window.__kangsArena = arena;
arena.onPresentation = p => {
  if (p.resolved) reportPlay(p);
  syncPresentation(p);
};

app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'start-form') startSeason(e.target);
});
// Closing any dialog: the gym runs again, a skipped press room moves on, a result starts the postgame,
// and an unfinished practice run stops.
modal.addEventListener('close', () => {
  arena.paused = false;
  syncCrowd();
  pressClosed();
  if (ui.flowPending) {
    ui.flowPending = false;
    setTimeout(postGame, 0);
  }
  endPracticeRun();
});
modal.addEventListener('keydown', pickWithNumberKeys);
modal.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'rename-form') renamePlayer(e.target);
});
new MutationObserver(keepNavTabInView).observe(app, { childList: true });
const noteInput = viaPointer => {
  ui.viaPointer = viaPointer;
  ui.lastInteract = Date.now();
};
document.addEventListener('pointerdown', () => noteInput(true), true);
document.addEventListener('keydown', () => noteInput(false), true);
// The first key or pointer press on the title screen ends its entrance animation at once.
for (const ev of ['pointerdown', 'keydown'])
  document.addEventListener(
    ev,
    () => document.querySelector('.landing:not(.entered)')?.classList.add('entered'),
    true,
  );
document.addEventListener('change', onChange);
document.addEventListener('click', onAction);
// Escape answers an assistant coach card before the shortcut keys see it (even from a field on the live game's bar).
document.addEventListener('keydown', onCoachKey);
document.addEventListener('keydown', onShortcut);
// Every 100 ms: the assistant coach's lessons, then Watch live. A lesson that throws closes its card, gives the game
// back and stops the lessons until the page is reloaded; play goes on.
const lessonTick = guardTick(coachTick, lessonFailed);
setInterval(() => {
  lessonTick();
  watchTick();
}, 100);
onSettingsChange(type => {
  applyArena();
  if (type === 'a11y' && view === 'landing') syncTitlePause();
  if (type === 'sound') syncCrowd();
});
window.addEventListener('kangs-language-changed', () => {
  if (data) render();
});

// Load the team data and any saved season, then show the title screen.
try {
  setData(
    await fetch(`${import.meta.env.BASE_URL}data/kangs.json`).then(r => {
      if (!r.ok) throw Error('Data unavailable');
      return r.json();
    }),
  );
  restoreSave();
  setView('landing');
  render();
  arena.setView('title');
} catch (error) {
  app.innerHTML = html`
    <div class="error-screen">
      <h1>${t('error.title')}</h1>
      <p>${t('error.body')}</p>
      <button onclick="location.reload()">${t('error.reload')}</button>
    </div>`;
}
// Check the same-origin published snapshot periodically; no third-party browser scraping.
setInterval(async () => {
  try {
    const d = await fetch(`${import.meta.env.BASE_URL}data/kangs.json`, { cache: 'no-store' }).then(r =>
      r.json(),
    );
    if (d.levels?.varsity?.players?.length) {
      setData(d);
      clearPreviews();
    }
  } catch {}
}, 300000);
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(error =>
      console.warn(
        'Browser offline cache unavailable; local offline bundle remains supported.',
        error.message,
      ),
    );
document.addEventListener('keydown', onRosterKey);
document.addEventListener('keydown', onSkillKey);
document.addEventListener('click', onRosterRowClick);
document.addEventListener('cameramode', e => syncCameraButtons(e.detail));
