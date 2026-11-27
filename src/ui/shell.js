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
import {
  html,
  esc,
  pill,
  micon,
  btn,
  hint,
  logoPair,
  svg,
  crestText,
  TAB_ICONS,
  NAV_GLYPHS,
} from './markup.js';
import { glyphImage, isLiveMatch } from './art.js';
import { state, view, setView, ui } from './store.js';
import { landing, titlePreview, syncTitlePause } from './screens/landing.js';
import { home, nextStepButton } from './screens/home.js';
import { roster } from './screens/roster.js';
import { practice } from './screens/prep.js';
import { recruit, staffView, skillsView, gear } from './screens/breaks.js';
import { NAV, navGroup, subTabs, breakFoot, subnavGo, tabNumber } from './nav.js';
import { scorebugData } from './scorebug.js';
import { headEnters } from './pageHead.js';
import { game } from './screens/game.js';
import { journal, bracketView, standingsView, dataView } from './screens/season.js';
import { demo, renderDemoGuide, leaveDemo } from './demo.js';
import { syncPresentation } from './playback.js';
import { notify } from './toast.js';
import { nthKeys, sideScroll, restoreSideScroll } from './renderKeep.js';

// The page each route draws (the routes and their tabs are in nav.js).
const PAGES = {
  home,
  roster,
  practice,
  recruit,
  staff: staffView,
  skills: skillsView,
  gear,
  game,
  locker,
  season: journal,
  bracket: bracketView,
  standings: standingsView,
  data: dataView,
};
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
// The scorebug: one plate with the next game, the record, the tokens and the prep slots (a phone keeps the record and
// the tokens), and a 17-segment season track along its foot. Display only: the tokens never link to the Shop.
// "Game 2 of 17" is the plate's name for screen readers; the visible "GM 2/17" is hidden from them so it is read once.
function scorebug() {
  const d = scorebugData(state),
    pair = (cls, k, v, hide = false) =>
      `<div class="sb-${cls}"${hide ? ' aria-hidden="true"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`,
    name = d.game ? t('landing.nextGame', { n: d.game.n, total: d.game.total }) : t('scorebug.over');
  return html`
    <div class="scorebug" role="group" aria-label="${esc(name)}">
      <span class="sb-team" aria-hidden="true">${logoPair('sb-logo')}</span>
      <dl>
        ${
          d.next
            ? pair(
                'next',
                t('scorebug.next'),
                `${d.next.crest ? `<img class="sb-crest" src="${d.next.crest}" alt="" decoding="async">` : `<span class="sb-crest ph" aria-hidden="true">${esc(crestText(d.next.name))}</span>`}<span>${t(d.next.home ? 'data.vs' : 'data.at')} <b>${esc(d.next.name)}</b></span>`,
              )
            : ''
        }
        ${pair('rec', t('scorebug.record'), `${d.wins}–${d.losses}`)}
        ${pair('tokens', t('scorebug.tokens'), `${glyphImage('coin', NAV_GLYPHS.coin, 'sb-coin')}${formatNumber(d.tokens)}`)}
        ${pair('slots', t('scorebug.slots'), `${d.slots}<span class="sb-pips" aria-hidden="true">${Array.from({ length: d.slotsMax }, (_, i) => `<i class="${i < d.slots ? 'on' : ''}"></i>`).join('')}</span>`)}
        ${d.game ? pair('game', t('scorebug.game'), `${d.game.n}/${d.game.total}`, true) : ''}
      </dl>
      <span class="sb-track" aria-hidden="true">${d.track.map(x => `<i class="${x}"></i>`).join('')}</span>
    </div>`;
}
// The band under the top bar: during a break its name as a stamp, the open group's tabs (numbered where their order is
// real, nav.js tabNumber), the scorebug, and at its end the way forward on every page without its own (nav.js
// subnavGo): ending the break on a Shop page during a break, otherwise the week's next step. It sits in the page's one
// .page-action, which a phone docks above the tab bar.
function subnav() {
  const go = subnavGo(state, view),
    pause = go === 'break' ? E.breakDue(state) : null,
    tabs = subTabs(view),
    label = pause ? t(`flow.step.${pause}`) : t(`nav.groups.${navGroup(view)}`),
    tab = v => {
      const n = tabNumber(v);
      return `<button data-view="${v}" class="sub-item ${view === v ? 'active' : ''}" ${view === v ? 'aria-current="page"' : ''}>${n ? `<span class="sub-num" aria-hidden="true">${n}</span>` : ''}<span class="sub-label">${t(`nav.${v}`)}</span></button>`;
    };
  return html`
    <div class="subnav">
      ${pause ? `<b class="break-name">${t(`flow.step.${pause}`)}</b>` : ''}
      ${tabs.length ? `<nav aria-label="${esc(label)}">${tabs.map(tab).join('')}</nav>` : ''}
      <span class="band-fill" aria-hidden="true"></span>
      <div class="subnav-end">
        ${scorebug()}
        ${go ? `<div class="page-action">${go === 'break' ? btn(t(`flow.done.${pause}`), 'break-done', 'primary small') : nextStepButton('primary small').html}</div>` : ''}
      </div>
    </div>`;
}
// The foot of a Shop page during a break: the break is optional, so it says so, and offers the next tab, or leaving the
// break on the last one (secondary there: the purple way forward is the same button in the slot under the top bar; a
// phone docks that slot just above, so there the foot leaves it out).
function breakNext(foot) {
  return html`
    <div class="break-next">
      <p>${t('flow.breakHint')}</p>
      ${
        foot.next
          ? `<button class="secondary" data-view="${foot.next}">${t('flow.breakNext', { tab: t(`nav.${foot.next}`) })} <span aria-hidden="true">→</span></button>`
          : btn(t(`flow.done.${foot.pause}`), 'break-done', 'secondary break-leave')
      }
    </div>`;
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
// Whether the click being handled is the purple way forward (actions.js wayClick): the header's entrance never plays on
// the way to play. Every render() reads it and clears it.
let viaWay = false;
export const wayClick = on => {
  viaWay = !!on;
};
const reducedMotion = () =>
  document.documentElement.classList.contains('a11y-reduced-motion') ||
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// On a phone the page's .page-action is a bar docked above the tab bar: its height goes into --action-bar-h, so the
// page keeps that much room at its foot and notifications sit above it (theme.css).
const actionBar =
  typeof ResizeObserver === 'function'
    ? new ResizeObserver(([e]) =>
        document.body.style.setProperty('--action-bar-h', `${Math.ceil(e.target.offsetHeight)}px`),
      )
    : null;
function watchActionBar() {
  if (!actionBar) return;
  actionBar.disconnect();
  const bar = app.querySelector('.page-action');
  if (bar) actionBar.observe(bar);
  else document.body.style.removeProperty('--action-bar-h');
}
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
// Open drawers (<details>) survive a re-render too, or the box score would close after every play, and so does each
// table's sideways scroll (renderKeep.js finds them again by class list and place).
const detailsKeys = () => nthKeys(app.querySelectorAll('details')).map(({ el, key }) => ({ d: el, key }));
const tableWraps = () => app.querySelectorAll('.table-wrap');
// Draws the current page.
export function render() {
  disposeProspectJerseys();
  const keep =
    renderedView === view
      ? {
          focus: focusMemo(),
          y: window.scrollY,
          x: sideScroll(tableWraps()),
          open: new Set(
            detailsKeys()
              .filter(x => x.d.open)
              .map(x => x.key),
          ),
        }
      : null;
  const enter = headEnters({ from: renderedView, to: view, way: viaWay, reduced: reducedMotion() });
  viaWay = false;
  renderedView = view;
  document.body.dataset.view = view;
  document.body.classList.toggle('live-match', isLiveMatch(view, state, ui));
  document.body.append(host);
  if (view === 'landing') {
    app.innerHTML = landing();
  } else {
    const top = navGroup(view),
      foot = breakFoot(state, view);
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
            <span class="bar-fill" aria-hidden="true"></span>
            <div class="top-tools">
              <span class="top-coach">${glyphImage('whistle', NAV_GLYPHS.whistle, 'coach-glyph')}<span>${t('side.coach', { name: esc(state.coach) })}</span></span>${btn(t('top.settings'), 'settings', '', hint('settings'))}
              ${btn(t('top.help'), 'rules', '', hint('rules'))}
            </div>
          </header>
          ${subnav()}
          <main class="content" id="main" tabindex="-1">
            ${(PAGES[view] || home)()}
            ${foot ? breakNext(foot) : ''}
          </main>
        </div>
      </div>`;
  }
  if (enter) $('.page-head')?.classList.add('enter');
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
  watchActionBar();
  if (view === 'locker') mountJerseys();
  if (view === 'recruit') mountProspectJerseys();
  syncCrowd();
  if (demo && view !== 'landing') renderDemoGuide();
  if (arena.event) syncPresentation(arena.presentation());
  if (keep) {
    for (const { d, key } of detailsKeys()) if (keep.open.has(key)) d.open = true;
    restoreSideScroll(tableWraps(), keep.x);
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
// On a narrow screen the top tabs and the sub-tabs scroll sideways: keep the open one of each centred. So does the
// Journal's game-by-game strip on a phone: its next game is kept centred.
export function keepNavTabInView() {
  for (const n of document.querySelectorAll('.nav-item.active, .sub-item.active, .strip-card.next')) {
    const bar = n.parentElement;
    if (bar.scrollWidth <= bar.clientWidth) continue;
    const r = n.getBoundingClientRect();
    bar.scrollLeft += r.left - bar.getBoundingClientRect().left - (bar.clientWidth - r.width) / 2;
  }
  // Sub-tabs that do not fit show a ‹ › plate on the side with more (theme.css), kept up to date as the row scrolls.
  for (const bar of document.querySelectorAll('.subnav nav')) {
    const mark = () => {
      const start = bar.scrollLeft > 1,
        end = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1,
        more = start && end ? 'both' : start ? 'start' : end ? 'end' : '';
      if ((bar.dataset.more || '') === more) return;
      if (more) bar.dataset.more = more;
      else delete bar.dataset.more;
    };
    mark();
    bar.onscroll = mark;
  }
}
