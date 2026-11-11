import * as E from '../engine.js';
import { t, list } from '../i18n/index.js';
import { state, data, save, KEY, view, plan, setSaveKey, setState, ui } from './store.js';
import { stopTour } from './tutorial.js';
import { clearPlan } from './screens/prep.js';
import { go, render } from './shell.js';
import { notify } from './toast.js';
import { arena, app } from './page.js';
import { btn, html, esc, hintJ } from './markup.js';

// Judge demo: a repeatable mid-season save kept under its own key, so a player's own season is never overwritten.
// It walks through DEMO_VIEWS (route names) with the steps in the locales (demo.steps); J jumps to the final run.
const DEMOKEY = 'kangs-demo-season-v1';
const DEMO_TIMES = ['0:00', '0:25', '0:50', '1:20', '1:50', '2:15', '2:40', '3:00'];
const DEMO_VIEWS = ['home', 'roster', 'practice', 'game', 'season', 'home', 'data', 'game'];
export let demo = null;
let realState = null;
export function enterDemo() {
  if (demo) return;
  realState = state;
  setSaveKey(DEMOKEY);
  setState(E.demoSeason(data));
  try {
    E.autoLineup(state);
  } catch {}
  demo = { step: 0, hidden: false };
  stopTour();
  clearPlan();
  save();
  go('home');
  notify(t('demo.entered', { w: state.wins, l: state.losses }), {
    type: 'success',
    title: t('demo.jumpedTitle'),
  });
}
export function leaveDemo() {
  demo = null;
  setSaveKey(KEY);
  setState(realState);
  realState = null;
}
export function exitDemo() {
  leaveDemo();
  go('landing');
  notify(t('demo.closed'), { type: 'info', title: t('demo.jumpedTitle') });
}
export function demoStep(delta) {
  if (!demo) return;
  demo.step = Math.max(0, Math.min(DEMO_VIEWS.length - 1, demo.step + delta));
  if (view !== DEMO_VIEWS[demo.step]) go(DEMO_VIEWS[demo.step]);
  else render();
}
// Plays the season on with the same sensible preparation until the final run begins.
export function demoJump() {
  if (!demo || !state) return;
  if (state.match || ui.closingMatch) {
    notify(t('demo.busy'), { type: 'error' });
    return;
  }
  const P = plan();
  if (state.week >= P.cut) {
    notify(t('demo.already'), { type: 'info' });
    return;
  }
  E.playTo(state, P.cut);
  save();
  arena.clear();
  go('game');
  notify(t('demo.jumped'), { type: 'success', title: t('demo.jumpedTitle') });
}
// Hide or show the demo card.
export function showDemoGuide(show) {
  demo.hidden = !show;
  render();
}
export function renderDemoGuide() {
  const el = document.createElement('div'),
    total = DEMO_VIEWS.length,
    i = demo.step;
  el.className = 'tutorial demo-guide';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', t('demo.label'));
  if (demo.hidden) {
    el.classList.add('collapsed');
    el.innerHTML = btn(t('demo.show'), 'demo-show', 'primary small');
    app.append(el);
    return;
  }
  const S = list('demo.steps')[i] || { title: '', body: '' };
  el.innerHTML = html`
    <span class="eyebrow">${esc(t('demo.kicker', { n: i + 1, total, time: DEMO_TIMES[i] }))}</span>
    <h3>${esc(S.title)}</h3>
    <p>${esc(S.body)}</p>
    ${i === 5 ? `<div class="demo-actions">${btn(t('top.settings'), 'settings', 'secondary small')}</div>` : ''}
    <div class="demo-nav">
      ${btn(t('demo.back'), 'demo-back', 'secondary small', i ? '' : 'disabled')}
      ${btn(i === total - 1 ? t('demo.finish') : t('demo.next'), i === total - 1 ? 'demo-exit' : 'demo-next', 'primary small')}
    </div>
    <div class="demo-foot">
      ${btn(`${t('demo.jump')} · J`, 'demo-jump', 'text-button', hintJ)}
      ${btn(t('demo.hide'), 'demo-hide', 'text-button')}
      ${btn(t('demo.exit'), 'demo-exit', 'text-button')}
    </div>`;
  app.append(el);
}
