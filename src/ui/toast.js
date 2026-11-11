// Notifications in the top right, and the ones that follow a coaching action, an achievement or a new jersey.
import { getA11y } from '../settings.js';
import { t } from '../i18n/index.js';
import { logText } from '../narrative.js';
import * as E from '../engine.js';
import { achievements, newlyEarned } from '../achievements.js';
import { kitName } from '../locker.js';
import { announce } from '../a11y.js';
import { $ } from './page.js';
import { html, TOAST_ICONS, esc, signed, cap1 } from './markup.js';
import { state } from './store.js';

// Notification cards: a few at a time, each dismissable, paused while hovered. The text and the title are already in the player's language.
export function notify(msg, opt = {}) {
  const box = $('#toast');
  if (!box) return;
  const type = opt.type || 'info',
    ms = opt.ms ?? (getA11y().timingAssist ? 12000 : type === 'error' ? 6500 : 5200);
  const card = document.createElement('div');
  card.className = `toast-card ${type}`;
  card.setAttribute('role', type === 'error' ? 'alert' : 'status');
  card.style.setProperty('--life', ms + 'ms');
  card.innerHTML = html`
    <span class="toast-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${TOAST_ICONS[opt.icon] || TOAST_ICONS[type]}</svg></span>
    <div class="toast-body">
      <b>${esc(opt.title || t(`toast.${type}`))}</b>
      <p>${esc(msg)}</p>
      ${
        opt.chips?.length
          ? html`
            <div class="toast-chips">
              ${opt.chips.map(c => `<span class="${/^[−-]/.test(c) ? 'down' : 'up'}">${esc(c)}</span>`).join('')}
            </div>`
          : ''
      }
    </div>
    <button type="button" class="toast-close" aria-label="${esc(t('toast.dismiss'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><i class="toast-timer" aria-hidden="true"></i>`;
  const kill = () => {
    if (card.dataset.out) return;
    card.dataset.out = 1;
    card.classList.add('out');
    setTimeout(() => {
      card.remove();
      if (!box.children.length && box.hidePopover && box.matches(':popover-open')) box.hidePopover();
    }, 260);
  };
  let left = ms,
    start = Date.now(),
    timer = setTimeout(kill, left);
  card.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    left -= Date.now() - start;
    card.classList.add('hold');
  });
  card.addEventListener('mouseleave', () => {
    start = Date.now();
    card.classList.remove('hold');
    timer = setTimeout(kill, Math.max(900, left));
  });
  card.querySelector('.toast-close').addEventListener('click', e => {
    e.stopPropagation();
    clearTimeout(timer);
    kill();
  });
  box.prepend(card);
  [...box.children].slice(3).forEach(c => c.remove());
  if (box.showPopover) {
    try {
      if (box.matches(':popover-open')) box.hidePopover();
      box.showPopover();
    } catch {}
  }
}
// After a coaching action: the decision-trail line plus what it cost or gained.
export function actionToast(a, was) {
  if (!state) return;
  const msg = state.log[0] ? logText(state.log[0]) : t('notify.saved'),
    chips = [];
  if (was) {
    const dt = state.tokens - was.tokens,
      ds = state.actions - was.actions,
      dc = state.chemistry - was.chemistry;
    if (dt) chips.push(signed(dt, t('toast.tokens')));
    if (ds) chips.push(signed(ds, t(Math.abs(ds) === 1 ? 'toast.slot' : 'toast.slots')));
    if (dc) chips.push(signed(dc, t('toast.chemistry')));
  }
  if (a === 'hire') {
    const c = E.staff.find(x => x.key === state.assistant);
    return notify(
      c
        ? t('toast.hired', { name: t(`staff.${c.key}.name`), detail: cap1(t(`staff.${c.key}.detail`)) })
        : msg,
      { type: 'success', icon: 'staff', title: t('toast.hiredTitle'), chips },
    );
  }
  const map = {
    recruit: ['recruit', 'success', 'staff'],
    release: ['release', 'warn', 'staff'],
    dismiss: ['dismiss', 'warn', 'staff'],
    upgrade: ['upgrade', 'success', 'staff'],
  };
  const [key, type, icon] = map[a] || ['saved', 'success'];
  notify(msg, { title: t(`toast.titles.${key}`), type, icon, chips });
}
// Achievements are computed from the save; only the ids already announced are stored. A save that predates them is marked silently on its first save.
export function announceAch() {
  if (!state) return;
  if (!Array.isArray(state.seenAch)) {
    state.seenAch = achievements(state)
      .filter(a => a.earned)
      .map(a => a.id);
    return;
  }
  for (const id of newlyEarned(state)) {
    state.seenAch.push(id);
    notify(t(`ach.items.${id}.desc`), {
      type: 'success',
      icon: 'ball',
      title: t('ach.unlocked', { name: t(`ach.items.${id}.name`) }),
    });
  }
}
// A special jersey was just earned: tell the coach where to find it.
export function announceKits(kits) {
  for (const k of kits || []) {
    const name = kitName(k);
    notify(t('lk.unlockedMsg', { kit: name }), {
      type: 'success',
      icon: 'staff',
      title: t('lk.unlockedTitle'),
    });
    announce(t('lk.unlockedTitle') + ': ' + name);
  }
}
