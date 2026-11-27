// The assistant coach's lessons on screen. The lessons themselves (chapters, tips, when each opens and closes) are data
// in lessons.js; this file shows them: one card at a time, a ring on what it talks about and a glow on what to press.
// Nothing on the page is locked: a step closes when the coach does the real thing, wherever they do it, and a step
// already done never shows. Every card has Got it (Escape too) and Hide tips; a card on the live game holds play while
// it is up. coachTick() runs every 100 ms (main.js, inside a try/catch).
import * as L from './lessons.js';
import { t } from '../i18n/index.js';
import { announce } from '../a11y.js';
import { getPrefs, setPrefs, getA11y } from '../settings.js';
import { arena, modal, $ } from './page.js';
import { render, go } from './shell.js';
import { state, view, ui } from './store.js';
import { html, btn } from './markup.js';
import { notify } from './toast.js';
import { planCap, practicePlan, practiceRun, lastRun } from './screens/prep.js';
import { breakPending } from './playback.js';
import { demo } from './demo.js';

let progress = L.loadProgress();
// Lessons under way, in the order they began. A run: { lesson, i (its step), memo, open: '' | 'card' | 'line', held,
// autoBefore, sawDialog, focusBefore, text }. Several can wait at once; only one is open.
let runs = [];
let logged = false;
const FOCUSABLE = 'button,a[href],input,select,textarea,summary,[tabindex]';
const phone = () => innerWidth <= 760;
const openRun = () => runs.find(r => r.open);
const step = r => r.lesson.steps[r.i];

// The status of each lesson, for Help's Lessons tab: done, dismissed, armed or new.
export const lessonStatus = id => progress[id] || 'new';
export const startQuestionDefault = () => L.questionDefault(progress);

function setStatus(id, status) {
  progress = { ...progress, [id]: status };
  L.saveProgress(progress);
}
// Which dialog is open, as the lessons see it.
function dialogKind() {
  if (document.querySelector('dialog.confirm-dlg[open]')) return 'other';
  if (!modal.open) return null;
  const q = s => modal.querySelector(s);
  if (q('[data-action="huddle"]')) return 'huddle';
  if (q('[data-action="break-go"]')) return 'quarter';
  if (q('.inbox-card.press [data-pick]')) return 'press';
  if (q('[data-action="pick-event"]')) return 'inbox';
  if (q('#drill-root')) return 'drill';
  return 'other';
}
// The moment the lessons look at (see lessons.js).
function moment() {
  const p = state?.match && arena.event ? arena.presentation() : null,
    c = p?.clip;
  return {
    view,
    state,
    dialog: dialogKind(),
    auto: ui.auto,
    playing: arena.isPlaying(),
    breakPending: breakPending(),
    shot: p?.resolved && c?.team === 'home' && c.shotChance ? { player: c.player, n: c.shotChance } : null,
    active: runs.find(r => r.lesson.kind === 'chapter')?.lesson.id ?? null,
    practice: { plan: practicePlan, cap: planCap(), running: !!practiceRun, last: lastRun },
    has: sel => !!document.querySelector(sel),
  };
}
const visible = sel =>
  sel ? [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width) : null;
// What a card points at: the thing to press, or else the thing it talks about.
const target = r => (r ? visible(step(r).act) || visible(step(r).spot) : null);

function clearDom() {
  document.querySelectorAll('.coach-card,.coach-ring,.coach-line').forEach(x => x.remove());
  document.documentElement.style.removeProperty('--coach-h');
  document.querySelectorAll('.coach-glow').forEach(x => x.classList.remove('coach-glow'));
}
const acts = s =>
  html`
    <div class="coach-acts">
      ${btn(t('tutorial.hide'), 'lesson-hide', 'text-button small coach-hide')}
      <span class="coach-acts-end">
        ${s.inline ? '' : btn(t('tutorial.showMe'), 'lesson-show', 'text-button small', 'hidden')}
        ${btn(t(s.notNow ? 'tutorial.notNow' : 'tutorial.ok'), 'lesson-ok', 'secondary small')}
      </span>
    </div>`;
function drawCard(r) {
  const s = step(r),
    card = document.createElement('div');
  card.className = 'coach-card';
  card.dataset.lesson = r.lesson.id;
  card.setAttribute('role', 'status');
  card.innerHTML = `<span class="coach-who">${t('tutorial.who')}</span><p></p>${acts(s)}`;
  card.querySelector('p').textContent = r.text;
  document.body.append(card);
  if (s.spot) {
    const ring = document.createElement('div');
    ring.className = 'coach-ring';
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
  }
  place(r);
}
// A line inside the open dialog, at its top. The dialog may redraw itself, so it is put back on every tick.
function drawLine(r) {
  const box = modal.querySelector('.modal-content');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'coach-line';
  el.dataset.lesson = r.lesson.id;
  el.innerHTML = `<span class="coach-who">${t('tutorial.who')}</span><p></p>${acts(step(r))}`;
  el.querySelector('p').textContent = r.text;
  box.prepend(el);
}
// The ring sits on the thing being talked about and the card next to it; both follow the page as it redraws and
// scrolls. On a phone the card is docked at the bottom (--coach-h lets the page scroll its last button clear of it).
function place(r) {
  const card = $('.coach-card');
  if (!card) return;
  const s = step(r),
    ring = $('.coach-ring'),
    el = visible(s.spot),
    rect = el?.getBoundingClientRect(),
    w = card.offsetWidth,
    h = card.offsetHeight,
    dock = phone(),
    // a phone's way-forward bar (.page-action, docked above the tab bar): the card sits above it, never over it
    bar = $('.page-action'),
    foot = 84 + (dock && bar && getComputedStyle(bar).position === 'fixed' ? bar.offsetHeight : 0);
  if (ring) {
    ring.hidden = !rect;
    if (rect)
      Object.assign(ring.style, {
        left: `${rect.left - 6}px`,
        top: `${rect.top - 6}px`,
        width: `${rect.width + 12}px`,
        height: `${rect.height + 12}px`,
      });
  }
  if (dock) document.documentElement.style.setProperty('--coach-h', `${h + foot}px`);
  const aimEl = target(r),
    aim = aimEl?.getBoundingClientRect() ?? null;
  let top = innerHeight - h - (dock ? foot : 24);
  // Docked on a phone over its target: the page scrolls the target clear (Show me does it), so the card stays docked and
  // covers nothing above. Only a target scrolling cannot clear (the live game's control bar) gets the card just above it.
  const lift =
    dock &&
    L.liftsDocked({
      aim,
      dockTop: top,
      h,
      vh: innerHeight,
      room: document.documentElement.scrollHeight - innerHeight - scrollY,
      fixed: pinned(aimEl),
    });
  const show = card.querySelector('[data-action="lesson-show"]');
  if (show) show.hidden = !L.outOfView(aim, innerHeight, dock && !lift ? top : null);
  if (lift) top = aim.top - h - 12;
  if (!rect || dock || L.outOfView(rect, innerHeight)) {
    card.style.left = `${Math.max(12, (innerWidth - w) / 2)}px`;
    card.style.top = `${top}px`;
    return;
  }
  // Below first, then to the left; where neither fits, the page header's free middle (over the ghost word, never on the
  // title or sub-line) before the space above the spot, which is the page's own content; the bottom right as a last
  // resort (the top right is where notifications appear). Any place that would cover the header's text moves into the
  // header's free middle too, or, where the header has none left (Prep's stat chips fill it at 1440), to that last resort.
  const headText = $('.page-head .ph-text')?.getBoundingClientRect(),
    head = L.headRoom({
      head: $('.page-head')?.getBoundingClientRect(),
      text: headText,
      chips: $('.page-head .ph-chips')?.getBoundingClientRect(),
      card: { w, h },
      screen: { w: innerWidth, h: innerHeight },
    }),
    below = rect.bottom + 14 + h < innerHeight - 12,
    side = rect.left - 14 - w > 12,
    above = rect.top - 14 - h > 12;
  let left =
    below || (!side && above)
      ? Math.max(12, Math.min(innerWidth - w - 12, rect.left))
      : side
        ? rect.left - 14 - w
        : Math.max(12, innerWidth - w - 12);
  top = below
    ? rect.bottom + 14
    : side
      ? Math.max(12, Math.min(innerHeight - h - 12, rect.top))
      : above
        ? rect.top - 14 - h
        : Math.max(12, innerHeight - h - 12);
  const onText =
    headText &&
    left < headText.right &&
    headText.left < left + w &&
    top < headText.bottom &&
    headText.top < top + h;
  if (head && ((!below && !side) || onText)) ({ left, top } = head);
  else if (onText) {
    left = Math.max(12, innerWidth - w - 12);
    top = Math.max(12, innerHeight - h - 12);
  }
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}
// Whether an element stays put while the page scrolls (it or a parent is fixed or sticky).
function pinned(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement)
    if (['fixed', 'sticky'].includes(getComputedStyle(e).position)) return true;
  return false;
}
// The page redraws under the card, so the glow is put back on every tick.
// It pulses only in the first PULSE_MS of its step (three breaths, theme.css): a redraw after that puts back a still
// outline, so the glow never loops.
const PULSE_MS = 3 * 1600;
let pulse = { key: null, at: 0 };
function glow(r) {
  const sel = r?.open === 'card' ? step(r).act : null;
  document.querySelectorAll('.coach-glow').forEach(x => {
    if (!sel || !x.matches(sel)) x.classList.remove('coach-glow', 'pulsing');
  });
  if (!sel) return;
  const key = `${r.lesson.id}:${r.i}`;
  if (pulse.key !== key) pulse = { key, at: performance.now() };
  const pulsing = performance.now() - pulse.at < PULSE_MS;
  document.querySelectorAll(sel).forEach(x => {
    x.classList.add('coach-glow');
    if (pulsing) x.classList.add('pulsing');
  });
}
function open(r, c) {
  const s = step(r);
  const say = s.say?.(c, r.memo) || {};
  r.text = t(L.stepKey(r.lesson, s, c, r.memo), say);
  r.memo.shown = true;
  r.focusBefore = document.activeElement;
  if (s.inline) {
    r.open = 'line';
    drawLine(r);
  } else {
    r.open = 'card';
    if (s.hold && c.state?.match) {
      r.held = true;
      r.sawDialog = false;
      r.autoBefore = ui.auto;
      ui.auto = false;
      arena.paused = true;
      render();
    }
    drawCard(r);
    glow(r);
  }
  announce(r.text);
}
// Closing a card. how: see watchAfterCard in lessons.js (and 'ended' when a lesson stops by itself).
function close(r, how) {
  if (!r.open) return;
  const a = document.activeElement,
    hadFocus = !!a?.closest?.('.coach-card,.coach-line');
  clearDom();
  r.open = '';
  if (r.held) {
    r.held = false;
    const w = L.watchAfterCard(how, r.autoBefore, ui.auto);
    ui.auto = w.auto;
    if (w.unpause && !modal.open) arena.paused = false;
    ui.gap = 0;
    render();
  }
  // Focus goes back where it was before the card, or to what the card pointed at: never to the page body.
  if (hadFocus) {
    const back = r.focusBefore?.isConnected && r.focusBefore !== document.body ? r.focusBefore : target(r);
    const f = back?.matches?.(FOCUSABLE)
      ? back
      : back?.querySelector?.(FOCUSABLE) || $('main h1') || $('#main');
    f?.focus({ preventScroll: true });
  }
}
function finish(r, status) {
  close(r, 'ended');
  runs = runs.filter(x => x !== r);
  setStatus(r.lesson.id, status);
}
// Stop a lesson without a status (it starts again at its next moment).
function drop(r) {
  close(r, 'ended');
  runs = runs.filter(x => x !== r);
}
// The coach answered the card: Got it, Escape, Not now, or playing on from a card that holds the game.
function answer(r, how) {
  const status = step(r).notNow ? 'done' : L.gotItStatus(r.lesson, r.i);
  close(r, how);
  runs = runs.filter(x => x !== r);
  setStatus(r.lesson.id, status);
}
function advance(r, c) {
  const l = r.lesson;
  if (l.abort?.(c, r.memo)) return drop(r);
  if (l.end?.(c, r.memo)) return finish(r, 'done');
  // A card holding the game: a dialog over it keeps it held; Watch live, Resume or Next play on the page answers it.
  if (r.open === 'card' && r.held) {
    if (c.dialog) r.sawDialog = true;
    else if (r.sawDialog) {
      r.sawDialog = false;
      ui.auto = false;
      arena.paused = true;
    } else if (ui.auto || !arena.paused) return answer(r, 'played');
  }
  for (;;) {
    const s = step(r);
    if (!s) return finish(r, 'done');
    if (r.open) {
      if (s.game && !c.state.match) return finish(r, 'done');
      if (!s.done(c, r.memo)) return;
      close(r, 'done');
      r.i++;
      continue;
    }
    if (s.game && !c.state.match) return finish(r, 'done');
    if (s.done(c, r.memo)) {
      r.i++;
      continue;
    }
    if (!openRun() && s.on(c, r.memo)) open(r, c);
    return;
  }
}
function begin(lesson, c) {
  const r = { lesson, i: 0, memo: lesson.begin?.(c) ?? {}, open: '' };
  runs.push(r);
  return r;
}
// The open card follows the page: hidden under a dialog, re-placed, its line put back inside a redrawn dialog.
function keepUp(r, c) {
  if (r.open === 'line') {
    if (modal.open && !modal.querySelector('.coach-line')) drawLine(r);
    return;
  }
  const card = $('.coach-card');
  if (!card) return drawCard(r);
  card.hidden = !!c.dialog;
  if (!c.dialog) place(r);
  glow(r);
}
export function coachTick() {
  if (!state || view === 'landing' || demo) {
    if (runs.length) stopLessons();
    return;
  }
  const level = getPrefs().tips,
    c = moment();
  for (const r of [...runs]) if (!L.allowed(r.lesson, level, progress)) drop(r);
  for (const r of [...runs]) advance(r, c);
  // Any lesson whose moment has come begins (they wait side by side; the first in LESSONS opens first). A tip begins
  // only when nothing is on screen and no other tip is waiting, so it shows at once.
  for (const l of L.LESSONS) {
    if (runs.some(r => r.lesson === l)) continue;
    if (l.kind === 'tip' && (openRun() || runs.some(r => r.lesson.kind === 'tip'))) continue;
    if (L.allowed(l, level, progress) && l.start(c, progress[l.id] === 'armed')) advance(begin(l, c), c);
  }
  const o = openRun();
  if (o) keepUp(o, c);
  else glow(null);
}
// The loop caught an error from a lesson (guardTick in lessons.js stops the lessons after it): close the card and give
// the game back as it was before the card, so play goes on, and say so once in the console.
export function lessonFailed(err) {
  try {
    stopLessons();
  } catch {
    runs = [];
    clearDom();
  }
  if (!logged) {
    logged = true;
    console.error('Lessons stopped after an error:', err);
  }
}
// "No, show me as I go" on the start form: every chapter can show again, even ones seen or dismissed before.
export function forgetLessonChapters() {
  progress = L.forgetChapters(progress);
  L.saveProgress(progress);
}
// The title screen, a new season and the judge demo stop every lesson under way (none gets a status).
export function stopLessons() {
  for (const r of [...runs]) drop(r);
  runs = [];
  clearDom();
}
// The card's buttons.
export function lessonOk() {
  const r = openRun();
  if (r) answer(r, step(r).notNow ? 'notnow' : 'gotit');
}
export function hideLessons() {
  const r = openRun(),
    h = L.hideTips(getPrefs().tips, progress),
    waiting = runs.map(x => ({ ...x, open: '', held: false }));
  if (r) close(r, 'hide');
  runs = [];
  progress = h.progress;
  L.saveProgress(progress);
  setPrefs({ tips: 'off' });
  notify(t('tutorial.hidden'), {
    title: t('tutorial.who'),
    action: {
      label: t('tutorial.undo'),
      run: () => {
        progress = h.undo.progress;
        L.saveProgress(progress);
        setPrefs({ tips: h.undo.level });
        runs = waiting;
        coachTick();
      },
    },
  });
}
export function showMe() {
  const el = target(openRun());
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: getA11y().reducedMotion ? 'auto' : 'smooth' });
  const f = el.matches(FOCUSABLE) ? el : el.querySelector(FOCUSABLE);
  if (f) f.focus({ preventScroll: true });
  else {
    el.tabIndex = -1;
    el.focus({ preventScroll: true });
  }
}
// Replay from Help: a Shop lesson opens at once on its tab; any other waits for its next moment.
export function replayLesson(id) {
  const res = L.replayLesson(progress, id);
  if (!res) return;
  for (const r of runs.filter(x => x.lesson.id === id)) drop(r);
  progress = res.progress;
  L.saveProgress(progress);
  if (modal.open) modal.close();
  if (res.now) {
    go(res.route);
    const o = openRun();
    if (o) drop(o);
    const r = begin(L.lessonById(id), moment());
    runs = [r, ...runs.filter(x => x !== r)];
    coachTick();
  } else notify(t('tutorial.armed'), { title: t('tutorial.who') });
}
// Escape answers the card like Got it, even from a field on the live game's bar (a dialog keeps its own Escape).
export function onCoachKey(e) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const r = openRun();
  if (
    !L.escapeAnswers({
      open: !!r,
      inline: r?.open === 'line',
      dialog: !!document.querySelector('dialog[open]'),
    })
  )
    return;
  e.preventDefault();
  answer(r, 'escape');
}
// Shortcut keys wait while a card holds the paused game.
export const lessonHoldsKeys = () => {
  const r = openRun();
  return L.holdsKeys({ open: !!r, held: !!r?.held, dialog: modal.open });
};
