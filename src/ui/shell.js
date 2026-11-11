// The page frame (top bar, the row under it, the 3D gym), the router (go / render) and the camera buttons.
// Every page is a function in screens/ that returns its HTML; render() redraws the whole page from the save.
import { getA11y } from '../settings.js';
import { t, tu, formatNumber } from '../i18n/index.js';
import * as E from '../engine.js';
import { startCrowd, stopCrowd } from '../audio.js';
import { stopSpeech } from '../speech.js';
import { announce } from '../a11y.js';
import {
  locker,
  mountJerseys,
  mountProspectJerseys,
  setJerseyMotion,
  disposeProspectJerseys,
} from './screens/locker.js';
import { arena, app, host, $, modal } from './page.js';
import { html, esc, pill, micon, btn, hint, cap1, logoPair, svg, TAB_ICONS } from './markup.js';
import { state, view, setView, ui } from './store.js';
import { landing, titlePreview, syncTitlePause } from './screens/landing.js';
import { home } from './screens/home.js';
import { roster } from './screens/roster.js';
import { practice } from './screens/prep.js';
import { recruit, staffView } from './screens/breaks.js';
import { game } from './screens/game.js';
import { journal, bracketView, standingsView, dataView } from './screens/season.js';
import { demo, renderDemoGuide, leaveDemo } from './demo.js';
import { syncPresentation } from './playback.js';
import { notify } from './toast.js';

// Route names, grouped by top-bar tab. What can be opened at any time is the top row. Prep and Game day are reached through the next step, and the break screens exist only during a break. Every screen is still its own route, so the tutorial and the judge demo can jump straight to one.
const NAV = {
  week: ['home', 'practice', 'game'],
  team: ['roster'],
  season: ['season', 'bracket', 'standings', 'data'],
  break: ['recruit', 'staff', 'locker'],
};
// The page each route draws.
const PAGES = {
  home,
  roster,
  practice,
  recruit,
  staff: staffView,
  game,
  locker,
  season: journal,
  bracket: bracketView,
  standings: standingsView,
  data: dataView,
};
const navGroup = v => Object.keys(NAV).find(g => NAV[g].includes(v)) || 'week';
// Settings that the 3D gym and the jerseys follow.
export function applyArena() {
  const a = getA11y();
  setJerseyMotion(!a.reducedMotion);
  arena.motion = !a.reducedMotion;
  arena.shakeOn = a.screenShake;
  arena.setQuality(a.graphics);
  arena.setPlayers(a.players);
  arena.speed = ui.playbackSpeed * a.playbackSpeed;
}
// The 3D gym's frame on a page: the venue tag, and on Game day the camera buttons.
export function stage(cls = '', { controls = true } = {}) {
  const cams = [
    ['auto', 'camAuto', 'stage.auto', 'stage.autoTitle'],
    ['broadcast', 'camWide', 'stage.wide'],
    ['court', 'camCourt', 'stage.court'],
    ['follow', 'camFollow', 'stage.follow'],
    ['player', 'camPlayer', 'stage.player', 'stage.playerTitle'],
  ];
  return html`
    <div id="arena" class="${cls}" role="group" aria-label="${esc(t('a11y.stage'))}">
      <div class="arena-top">
        ${pill('● ' + tu('stage.venue'), 'live')}
        ${controls ? `<span class="orbit-hint">${micon('drag')}${t('stage.orbit')}${micon('scroll')}${t('stage.zoom')}</span>` : ''}
      </div>
      ${cls.includes('game-arena') ? '<div class="fp-hud" role="status" aria-live="polite" hidden></div>' : ''}
      <div class="arena-bottom">
        <div>
          <span class="eyebrow">${tu('stage.place')}</span>
          <h3 class="live-action">${t('stage.tagline')}</h3>
        </div>
        ${
          controls
            ? html`
              <div class="camera-controls" role="group" aria-label="${esc(t('stage.camera'))}">
                ${cams.map(([v, k, l, d]) => btn(t(l), 'camera', arena.mode === v ? 'active' : '', `data-camera="${v}" aria-pressed="${arena.mode === v}" ${hint(k, d ? t(d) : '')}`)).join('')}
              </div>`
            : ''
        }
      </div>
    </div>`;
}
// Game, record, tokens and slots on every page, so a coach never has to look for them.
function statusStrip() {
  const n = state.schedule.length,
    item = (k, v) => `<span>${k} <b>${v}</b></span>`;
  return html`
    <div class="status-strip">
      ${state.finished ? '' : `<span>${t('landing.nextGame', { n: Math.min(n, state.week + 1), total: n })}</span>`}
      ${item(t('metrics.record'), `${state.wins}–${state.losses}`)}
      ${item(t('metrics.tokens'), formatNumber(state.tokens))}
      ${item(cap1(t('toast.slots')), state.actions)}
    </div>`;
}
// The row under the top bar. Home has none. Prep and Game day show where the week has got to; a break and the Season tab have their own tabs.
function subnav(group) {
  if (view === 'home') return '';
  const pause = group === 'break' ? E.breakDue(state) : null,
    tabs =
      group === 'break' || group === 'season'
        ? html`
          <nav aria-label="${esc(pause ? t(`flow.step.${pause}`) : t(`nav.groups.${group}`))}">
            ${pause ? `<b class="break-name">${t(`flow.step.${pause}`)}</b>` : ''}
            ${NAV[group].map(v => `<button data-view="${v}" class="sub-item ${view === v ? 'active' : ''}" ${view === v ? 'aria-current="page"' : ''}>${t(`nav.${v}`)}</button>`).join('')}
          </nav>`
        : group === 'week'
          ? weekTrack()
          : '<span></span>';
  return html`
    <div class="subnav">
      ${tabs}
      <div class="subnav-end">
        ${statusStrip()}
        ${pause ? btn(t(`flow.done.${pause}`), 'break-done', 'primary small') : ''}
      </div>
    </div>`;
}
// The foot of every break page: the break is optional, so it says so, and offers the next tab, or leaving the break on the last one.
function breakNext() {
  const pause = E.breakDue(state),
    next = NAV.break[NAV.break.indexOf(view) + 1];
  return html`
    <div class="break-next">
      <p>${t('flow.breakHint')}</p>
      ${
        next
          ? `<button class="secondary" data-view="${next}">${t('flow.breakNext', { tab: t(`nav.${next}`) })} <span aria-hidden="true">→</span></button>`
          : btn(t(`flow.done.${pause}`), 'break-done', 'primary')
      }
    </div>`;
}
function weekTrack() {
  const at = view === 'game' ? 1 : 0;
  return html`
    <ol class="week-track" aria-label="${esc(t('nav.groups.week'))}">
      ${['prepare', 'play', 'post']
        .map(
          (k, i) => html`
            <li class="${i < at ? 'past' : i === at ? 'now' : ''}" ${i === at ? 'aria-current="step"' : ''}>
              ${t(`flow.track.${k}`)}
            </li>`,
        )
        .join('')}
    </ol>`;
}
// Focus and scroll survive a re-render, so keyboard users are not thrown back to the top after every action.
// The focused element is found again by these attributes.
const FOCUS_KEYS = [
  'data-action',
  'data-view',
  'data-id',
  'data-plan',
  'data-camera',
  'data-starter',
  'data-speed',
  'data-choice',
  'data-key',
  'data-kit',
  'data-step',
  'data-select',
  'data-index',
  'data-event',
  'data-message',
  'data-tab',
  'id',
];
let renderedView = null;
function focusMemo() {
  const a = document.activeElement;
  if (!a || a === document.body || !app.contains(a)) return null;
  let sel = a.tagName.toLowerCase(),
    n = 0;
  for (const k of FOCUS_KEYS)
    if (a.hasAttribute(k)) {
      sel += `[${k}="${CSS.escape(a.getAttribute(k))}"]`;
      n++;
    }
  return n ? { sel, nth: [...app.querySelectorAll(sel)].indexOf(a) } : null;
}
// Draws the current page. Break screens exist only during a break; otherwise they fall back to Home.
export function render() {
  if (state && NAV.break.includes(view) && !E.breakDue(state)) setView('home');
  disposeProspectJerseys();
  const keep = renderedView === view ? { focus: focusMemo(), y: window.scrollY } : null;
  renderedView = view;
  document.body.dataset.view = view;
  document.body.classList.toggle(
    'live-match',
    view === 'game' && !!(state?.match || ui.closingMatch || ui.replayEvent),
  );
  document.body.append(host);
  if (view === 'landing') {
    app.innerHTML = landing();
  } else {
    const group = navGroup(view),
      top = group === 'break' ? 'week' : group;
    app.innerHTML = html`
      <div class="shell">
        <div class="workspace">
          <header class="topbar">
            <a href="#" class="brand" data-action="home">${logoPair('brand-logo')}<div>KANGS</div></a>
            <nav class="main-nav" aria-label="${esc(t('side.nav'))}">
              ${Object.keys(TAB_ICONS)
                .map(
                  g =>
                    `<button data-view="${NAV[g][0]}" class="nav-item ${g === top ? 'active' : ''}" ${g === top ? 'aria-current="true"' : ''}><span class="nav-icon" aria-hidden="true">${svg(TAB_ICONS[g])}</span><b class="nav-label">${t(`nav.groups.${g}`)}</b></button>`,
                )
                .join('')}
            </nav>
            <div class="top-tools">
              <span class="top-coach">${t('side.coach', { name: esc(state.coach) })}</span>${btn(t('top.settings'), 'settings', '', hint('settings'))}
              ${btn(t('top.help'), 'rules', '', hint('rules'))}
            </div>
          </header>
          ${subnav(group)}
          <main class="content" id="main" tabindex="-1">
            ${(PAGES[view] || home)()}
            ${group === 'break' ? breakNext() : ''}
          </main>
        </div>
      </div>`;
  }
  const target = $('#arena');
  if (target) {
    arena.mount(target);
    arena.update(view === 'landing' ? state || titlePreview($('#difficulty')?.value) : state);
  } else host.hidden = true;
  host.hidden = !target;
  if (view === 'landing') {
    syncTitlePause();
    if (keep) $('.landing')?.classList.add('entered');
  }
  if (view === 'locker') mountJerseys();
  if (view === 'recruit') mountProspectJerseys();
  syncCrowd();
  if (demo && view !== 'landing') renderDemoGuide();
  if (arena.event) syncPresentation(arena.presentation());
  if (keep) {
    const f = keep.focus,
      el = f && [...app.querySelectorAll(f.sel)][Math.max(0, f.nth)];
    if (el && !el.disabled) el.focus({ preventScroll: true });
    window.scrollTo(0, keep.y);
  }
}
// The ambient crowd runs only during a live game.
export function syncCrowd() {
  if (view === 'game' && state?.match && !ui.replayEvent && !modal.open) startCrowd();
  else stopCrowd();
}
const pageName = v => (v === 'landing' ? t('meta.title') : t(`nav.${v}`));
// Opens a page: stops any replay or finished game on screen, redraws, and moves the camera.
export function go(v) {
  stopSpeech();
  ui.lastWhy = '';
  if (v === 'landing' && demo) {
    leaveDemo();
    notify(t('demo.closed'), { type: 'info', title: t('demo.jumpedTitle') });
  }
  setView(v);
  ui.auto = false;
  arena.clear();
  ui.closingMatch = null;
  ui.pendingResult = null;
  ui.replayEvent = null;
  ui.replayOpp = '';
  $('#toast')
    ?.querySelectorAll('.toast-card.error')
    .forEach(c => c.remove());
  render();
  window.scrollTo(0, 0);
  if (v === 'locker') arena.setView('court');
  else if (v === 'staff') arena.setView('office');
  else
    arena.setView(
      v === 'game'
        ? ['player', 'follow', 'court'].includes(arena.mode) && state?.match
          ? arena.mode
          : 'auto'
        : v === 'landing'
          ? 'title'
          : 'broadcast',
    );
  // Keyboard and screen-reader users land at the top of the new page instead of at the start of the document.
  $('main h1')?.focus({ preventScroll: true });
  announce(t('a11y.pageOpened', { page: pageName(v) }));
}
export function setCamera(mode) {
  arena.setView(mode);
  announce(
    t('a11y.camera', { view: document.querySelector(`[data-camera="${mode}"]`)?.textContent.trim() || mode }),
  );
  syncCameraButtons(mode);
}
// The camera buttons show which view is on (the gym also changes view by itself on Auto).
export function syncCameraButtons(mode) {
  document.querySelectorAll('[data-camera]').forEach(b => {
    b.classList.toggle('active', b.dataset.camera === mode);
    b.setAttribute('aria-pressed', b.dataset.camera === mode);
  });
}
// On phones the nav is a scrolling bottom tab bar: after each render keep the current page's tab in view.
export function keepNavTabInView() {
  const n = $('.nav-item.active'),
    bar = n?.parentElement;
  if (bar && bar.scrollWidth > bar.clientWidth)
    bar.scrollLeft = n.offsetLeft - (bar.clientWidth - n.offsetWidth) / 2;
}
