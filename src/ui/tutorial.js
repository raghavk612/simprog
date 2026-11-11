// The first game is the tutorial, and it counts. It goes one beat at a time: the game holds, the assistant says
// one line (tutorial.b.<id> in the locales), and only what they point at can be used. coachTick() runs every 100 ms.
//
// A beat in BEATS:
//   on()    the beat opens when this is true          done()  ...and closes when this is true
//   spot    what the ring highlights                  act     what glows (the thing to press)
//   lock    what can still be clicked (default: spot) next    wait for the card's Next button instead of done()
//   inline  the line sits inside the open dialog      game    only during a live game (skipped otherwise)
//   skip()  pass the beat by without opening it       last    the final beat
//   enter / leave   run when the beat opens / closes  say()   values for the line
// The tutorial and the judge demo open screens by route name, so renaming a route means updating them too.
import * as E from '../engine.js';
import { t, formatNumber } from '../i18n/index.js';
import { announce } from '../a11y.js';
import { play } from '../audio.js';
import { arena, modal, $ } from './page.js';
import { render } from './shell.js';
import { state, view, save, ui } from './store.js';
import { esc, html, btn } from './markup.js';
import { confirmDialog } from './dialogs.js';
import { planCap, practicePlan, practiceRun } from './screens/prep.js';

const TUTORIAL = 'kangs-three-tutorial-v3';
export let tour = null; // { i: beat index, open, say } while the tutorial runs
export const walkDefault = () => {
  try {
    return !localStorage.getItem(TUTORIAL);
  } catch {
    return true;
  }
};
const hold = () => {
  ui.auto = false;
  arena.paused = true;
  render();
};
const letGo = () => {
  arena.paused = false;
  ui.auto = true;
  ui.gap = 0;
  render();
};
const inGame = () => !!state?.match && view === 'game' && !modal.open;
export const BEATS = [
  {
    id: 'home',
    spot: '.home-bar',
    lock: '.hb-go',
    act: '.hb-go',
    on: () => view === 'home',
    done: () => view === 'practice',
    say: () => ({ opp: esc(E.opponent(state).opponent) }),
  },
  {
    id: 'pick',
    spot: '.prep-row:first-child',
    act: '[data-plan="shooting"]',
    on: () => view === 'practice',
    done: () => practicePlan.includes('shooting'),
    say: () => ({ name: t('plan.shooting.name') }),
  },
  {
    id: 'fill',
    spot: '.prep-list',
    lock: '.prep-row,.plan-x',
    on: () => view === 'practice',
    done: () => practicePlan.length >= planCap(),
  },
  {
    id: 'run',
    spot: '[data-action="practice-start"]',
    act: '[data-action="practice-start"]',
    lock: '[data-action="practice-start"],.plan-x',
    on: () => view === 'practice',
    done: () => !!practiceRun,
  },
  {
    id: 'retry',
    spot: '.prep-side',
    lock: '[data-action="practice-start"],.prep-go,.plan-x,.prep-row',
    act: '[data-action="practice-start"]',
    skip: () =>
      view === 'game' ||
      (view === 'practice' && !practiceRun && !modal.open && !(planCap() && practicePlan.length)),
    on: () => view === 'practice' && !practiceRun,
    done: () => !!practiceRun || view === 'game',
  },
  {
    id: 'toGame',
    spot: '.prep-go',
    act: '.prep-go',
    // The retry beat also lets the coach go straight to the game.
    skip: () => view === 'game',
    on: () => view === 'practice' && !practiceRun,
    done: () => view === 'game',
  },
  {
    id: 'five',
    spot: '.right-rail',
    lock: '[data-action="start-match"]',
    act: '[data-action="start-match"]',
    on: () => view === 'game' && !state.match,
    done: () => !!state.match,
  },
  {
    id: 'watch',
    spot: '[data-action="auto"]',
    act: '[data-action="auto"]',
    game: true,
    on: inGame,
    done: () => ui.auto,
    say: () => ({ btn: t('game.watch').replace(/^[^\p{L}]+/u, '') }),
  },
  {
    id: 'shot',
    game: true,
    next: true,
    lock: '.coach-card',
    on: () => {
      const p = arena.presentation();
      return (
        inGame() &&
        state.match.possession >= 3 &&
        !!p?.resolved &&
        p.clip.team === 'home' &&
        !!p.clip.shotChance
      );
    },
    enter: hold,
    leave: letGo,
    say: () => {
      const c = arena.presentation()?.clip;
      return { player: esc(c?.player ?? ''), n: c?.shotChance ?? 0 };
    },
  },
  {
    id: 'timeout',
    spot: '[data-action="timeout"]',
    act: '[data-action="timeout"]',
    game: true,
    on: () => inGame() && state.match.possession >= 9,
    enter: hold,
    leave: letGo,
    done: () => state.match?.timeouts < E.TIMEOUTS,
  },
  {
    id: 'quarter',
    inline: true,
    game: true,
    on: () => modal.open && !!modal.querySelector('[data-action="break-go"]'),
    done: () => !modal.open,
  },
  {
    id: 'speed',
    spot: '.playback-controls',
    game: true,
    next: true,
    on: inGame,
    enter: hold,
    leave: letGo,
  },
  {
    id: 'press',
    inline: true,
    on: () => modal.open && !!modal.querySelector('.inbox-card.press'),
    done: () => !modal.open || !modal.querySelector('.inbox-card.press') || !!state.press?.done,
  },
  {
    id: 'done',
    spot: '.home-bar',
    lock: '.hb-go',
    act: '.hb-go',
    last: true,
    on: () => view === 'home' && !modal.open,
    done: () => view !== 'home',
    say: () => ({ n: formatNumber(state.tokens), tokens: t('toast.tokens') }),
  },
];
export function startTour() {
  state.deferPre = true;
  tour = { i: 0, open: false };
  try {
    localStorage.setItem(TUTORIAL, 'seen');
  } catch {}
}
function clearCoach() {
  document.querySelectorAll('.coach-card,.coach-ring,.coach-line').forEach(x => x.remove());
  document.querySelectorAll('.coach-glow').forEach(x => x.classList.remove('coach-glow'));
}
// The page redraws under the tutorial, so the glow is put back on every tick.
function glowCoach() {
  const b = BEATS[tour.i],
    sel = b.act ?? (b.next ? '.coach-card [data-action="tour-next"]' : null);
  document.querySelectorAll('.coach-glow').forEach(x => {
    if (!sel || !x.matches(sel)) x.classList.remove('coach-glow');
  });
  if (sel) document.querySelectorAll(sel).forEach(x => x.classList.add('coach-glow'));
}
// Skipping sits apart from the card, so it never reads as the next step.
function skipButton(show) {
  let el = $('.coach-skip');
  if (!show) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.className = 'coach-skip';
    el.dataset.action = 'tour-skip';
    el.textContent = t('tutorial.skip');
    document.body.append(el);
  }
}
export function stopTour() {
  if (!tour) return;
  const b = BEATS[tour.i];
  if (tour.open && b.enter) {
    arena.paused = false;
  }
  tour = null;
  clearCoach();
  skipButton(false);
  if (state?.week === 0 && state.deferPre) {
    state.deferPre = false;
    save();
  }
}
function endTour() {
  tour = null;
  clearCoach();
  skipButton(false);
}
function coachLine(b) {
  const text = t(`tutorial.b.${b.id}`, tour.say);
  return `<span class="coach-who">${t('tutorial.who')}</span><p>${text}</p>`;
}
function drawCoach() {
  const b = BEATS[tour.i];
  clearCoach();
  if (b.inline) {
    const el = document.createElement('div');
    el.className = 'coach-line';
    el.dataset.beat = b.id;
    el.innerHTML = coachLine(b);
    modal.querySelector('.modal-content')?.prepend(el);
    return;
  }
  const card = document.createElement('div');
  card.className = 'coach-card';
  card.dataset.beat = b.id;
  card.setAttribute('role', 'status');
  card.innerHTML = `${coachLine(b)}${
    b.next
      ? html`
        <div class="coach-acts">
          ${btn(t(b.last ? 'tutorial.finish' : 'tutorial.next'), 'tour-next', 'primary small')}
        </div>`
      : ''
  }`;
  document.body.append(card);
  if (b.spot) {
    const ring = document.createElement('div');
    ring.className = 'coach-ring';
    document.body.append(ring);
  }
  placeCoach();
}
// The ring sits on the thing being talked about, and the card next to it. Both are re-placed on every tick, because the page redraws under them.
function placeCoach() {
  const b = BEATS[tour.i],
    card = $('.coach-card');
  if (!card) return;
  const ring = $('.coach-ring'),
    el = b.spot ? [...document.querySelectorAll(b.spot)].find(x => x.getBoundingClientRect().width) : null,
    r = el?.getBoundingClientRect(),
    w = card.offsetWidth,
    h = card.offsetHeight;
  if (ring) {
    ring.hidden = !r;
    if (r)
      Object.assign(ring.style, {
        left: `${r.left - 6}px`,
        top: `${r.top - 6}px`,
        width: `${r.width + 12}px`,
        height: `${r.height + 12}px`,
      });
  }
  if (!r || innerWidth <= 760) {
    card.style.left = `${Math.max(12, (innerWidth - w) / 2)}px`;
    card.style.top = `${innerHeight - h - (innerWidth <= 760 ? 84 : 24)}px`;
    return;
  }
  // Below first, then to the left, and above only as a last resort: the top right is where notifications appear.
  const below = r.bottom + 14 + h < innerHeight - 12,
    side = r.left - 14 - w > 12,
    above = r.top - 14 - h > 12;
  card.style.left = `${below || (!side && above) ? Math.max(12, Math.min(innerWidth - w - 12, r.left)) : side ? r.left - 14 - w : Math.max(12, innerWidth - w - 12)}px`;
  card.style.top = `${below ? r.bottom + 14 : side ? Math.max(12, Math.min(innerHeight - h - 12, r.top)) : above ? r.top - 14 - h : Math.max(12, innerHeight - h - 12)}px`;
}
export function coachTick() {
  if (!tour) return;
  const b = BEATS[tour.i];
  skipButton(view !== 'landing');
  if (view === 'landing') {
    if (tour.open) {
      tour.open = false;
      clearCoach();
    }
    return;
  }
  if (!tour.open && ((b.game && !state?.match) || b.skip?.())) {
    tour.i++;
    coachTick();
    return;
  }
  if (!tour.open) {
    if (b.inline ? !b.on() : modal.open || !b.on()) return;
    tour.open = true;
    tour.say = b.say?.() || {};
    b.enter?.();
    drawCoach();
    glowCoach();
    announce(document.querySelector('.coach-card p,.coach-line p')?.textContent || '');
    return;
  }
  if (b.inline && modal.open && !modal.querySelector('.coach-line')) drawCoach();
  glowCoach();
  if (!b.inline && modal.open) {
    $('.coach-card')?.setAttribute('hidden', '');
  } else {
    $('.coach-card')?.removeAttribute('hidden');
    placeCoach();
  }
  if (b.done?.() || (b.game && !state?.match && !modal.open)) nextBeat();
}
export function nextBeat() {
  const b = BEATS[tour.i];
  clearCoach();
  if (state?.match) b.leave?.();
  if (b.last) {
    endTour();
    return;
  }
  tour.i++;
  tour.open = false;
  coachTick();
}
// Skip asks first; "Keep going" is the safe default.
export async function askSkipTour() {
  if (!(await confirmDialog(t('tutorial.skipAsk'), { yes: t('tutorial.skipYes'), no: t('tutorial.keep') })))
    return;
  stopTour();
  render();
}
// While a beat is open only the card and the thing it points at respond (a capture listener, so it runs first).
// The tutorial's own lines inside a dialog never get in the way.
export function blockOutsideSpotlight(e) {
  if (!tour?.open) return;
  const b = BEATS[tour.i];
  if (b.inline || modal.open || e.target.closest('.coach-card,.coach-skip,.confirm-dlg,.toast-card')) return;
  const ok = b.lock ?? b.spot;
  if (ok && !e.target.closest(ok)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    play('error');
  }
}
// Shortcut keys wait while a beat card is up (but not for lines inside a dialog).
export const tourHoldsKeys = () => !!tour?.open && !BEATS[tour.i].inline && !modal.open;
