import { tu, t } from '../../i18n/index.js';
import { lockerBody, kitName, jerseyWho, plateName, byNumber } from '../../locker.js';
import * as E from '../../engine.js';
import { play } from '../../audio.js';
import { announce } from '../../a11y.js';
import { KITS } from '../../kits.js';
import { createJerseyShowcase, SCRIPT_FONT } from '../../jerseys.js';
import { getA11y } from '../../settings.js';
import { header, html, svg, esc, btn } from '../markup.js';
import { state, save } from '../store.js';
import { avatar } from '../avatar.js';
import { arena, $, modal } from '../page.js';
import { render } from '../shell.js';
import { show, confirmDialog } from '../dialogs.js';
import { notify } from '../toast.js';

// Locker room (a break screen): the kits on rotating 3D jerseys, whose name is on them, and the captain.
// Tryouts also show each prospect in a small 3D jersey.
let jerseys = null; // the locker room showcase: one canvas, created on first use and moved into the page on each draw
let jerseysTried = false;
let prospectJerseys = []; // the tryout jerseys on the current page
let jerseyId = null; // whose name and number the jerseys show
let captainPick = null; // the player picked in the captain list, before confirming
export function locker() {
  return `${header(tu('locker.kicker'), t('nav.locker'), t('locker.intro'))}${lockerBody({ state, avatar, jerseyId, captainPick })}`;
}
// Wearing a kit: core kits always, special kits once the season has earned them (E.setKit refuses a locked one).
export function wearKit(k) {
  if (!state) return;
  if (!E.kitUnlocked(state, k)) {
    unlockPopup(k);
    return;
  }
  E.setKit(state, k);
  save();
  play('select');
  announce(t('locker.picked', { kit: kitName(k) }));
  arena.update(state);
  render();
}
// A locked special jersey: an animated card that says how to earn it and how close the season is.
function unlockPopup(k) {
  const P = E.seasonPlan(state),
    home = E.lastHomeGame(state),
    n = Math.min(state.week + 1, state.schedule.length),
    total = state.schedule.length,
    col = KITS[k] || KITS.home;
  let pct = 0,
    prog = '';
  if (k === 'throwback') {
    const best = E.winStreak(state);
    pct = Math.min(1, best / E.KIT_STREAK);
    prog = t('lk.unlockProgress.throwback', { n: Math.min(best, E.KIT_STREAK), total: E.KIT_STREAK });
  } else if (k === 'seniornight') {
    if (home < 0) prog = t('lk.unlockProgress.seniornightNone');
    else {
      pct = Math.min(1, state.week / Math.max(1, home));
      prog = t('lk.unlockProgress.seniornight', { n, total, home: home + 1 });
    }
  } else {
    pct = Math.min(1, state.week / Math.max(1, P.cut));
    prog = t('lk.unlockProgress.blackout', { cut: P.cut + 1, n });
  }
  play('select');
  show(
    html`
      <div class="unlock-pop" style="--kit:${col.body};--kit2:${col.trim}">
        <div class="up-art" aria-hidden="true">
          <svg class="up-shirt" viewBox="0 0 120 120">
            <path d="M40 10h11q9 13 18 0h11l27 15-11 23-12-6v66H36V42l-12 6-11-23z"/>
          </svg>
          <span class="up-shine"></span><span class="up-lock">${svg('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>')}</span>
        </div>
        <span class="eyebrow">${tu('lk.unlockKicker')}</span>
        <h1>${esc(kitName(k))}</h1>
        <p class="up-how">${esc(t(`lk.how.${k}`, { n: E.KIT_STREAK }))}</p>
        <div class="up-meter" role="progressbar" aria-label="${esc(prog)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}">
          <i style="--p:${pct}"></i>
        </div>
        <p class="up-prog">${esc(prog)}</p>
        <div class="modal-actions">${btn(t('lk.unlockGot'), 'close', 'primary')}</div>
      </div>`,
  );
}
// Name and number on all the showcase jerseys. Only the textures are repainted; the select, the caption and the 3D scene are updated in place.
export function applyJerseyPlayer() {
  const p = jerseyWho(state, jerseyId);
  if (!p) return;
  jerseys?.setPlayer({ name: plateName(p), number: p.number });
  const sel = $('#jersey-player');
  if (sel) sel.value = String(p.id);
  const cap = $('#jersey-caption');
  if (cap) cap.innerHTML = `<b>${esc(p.number)}</b> ${esc(plateName(p))}`;
}
// Naming (or changing) the captain uses the engine's setCaptain; the dialog states the price first.
export async function makeCaptain(id) {
  const p = state.players.find(x => x.id === id);
  if (!p) return;
  const old = state.players.find(x => x.id === state.captain);
  const msg =
    old && old.id !== p.id
      ? t('lk.confirmChange', {
          name: plateName(p),
          old: plateName(old),
          morale: E.CAPTAIN_COST.morale,
          chem: E.CAPTAIN_COST.chem,
        })
      : t('lk.confirmFirst', { name: plateName(p) });
  if (!(await confirmDialog(msg, { yes: t('lk.confirmYes') }))) return;
  E.setCaptain(state, id);
  captainPick = null;
  save();
  play('confirm');
  notify(t('captain.set', { name: p.name }), { type: 'success', icon: 'staff' });
  if (modal.open) modal.close();
  render();
}
export function toggleCaptainPick(id) {
  captainPick = captainPick === id ? null : id;
  render();
}
// The "whose jersey" select.
export function setJerseyPlayer(id) {
  jerseyId = id;
  play('select');
  applyJerseyPlayer();
}
export function stepJerseyPlayer(step) {
  const list = byNumber(state.players),
    cur = jerseyWho(state, jerseyId),
    i = Math.max(
      0,
      list.findIndex(p => p.id === cur?.id),
    );
  jerseyId = list[(i + step + list.length) % list.length].id;
  play('select');
  applyJerseyPlayer();
  announce(
    t('lk.jerseyNow', {
      num: jerseyWho(state, jerseyId).number,
      name: plateName(jerseyWho(state, jerseyId)),
    }),
  );
}
// Reduced motion stops the jerseys turning.
export function setJerseyMotion(on) {
  jerseys?.setMotion(on);
  prospectJerseys.forEach(j => j.setMotion(on));
}
// Each redraw replaces the tryout cards, so their jerseys are thrown away first.
export function disposeProspectJerseys() {
  for (const jersey of prospectJerseys) jersey.dispose();
  prospectJerseys = [];
}
export function mountProspectJerseys() {
  for (const box of document.querySelectorAll('[data-prospect]')) {
    const p = state.pool.find(p => p.id === Number(box.dataset.prospect));
    if (!p) continue;
    const jersey = createJerseyShowcase({ kitKeys: [state.kit || 'home'], preview: true });
    if (!jersey) continue;
    jersey.setUnlocked(state.unlockedKits || []);
    jersey.setPlayer({ name: plateName(p), number: p.number });
    jersey.setMotion(!getA11y().reducedMotion);
    box.replaceChildren();
    jersey.mount(box);
    prospectJerseys.push(jersey);
  }
  const current = [...prospectJerseys];
  document.fonts?.load(`400 100px ${SCRIPT_FONT}`).then(() => {
    for (const jersey of current) if (prospectJerseys.includes(jersey)) jersey.refreshFont();
  });
}
export function mountJerseys() {
  const box = $('#jersey-stage');
  if (!box) return;
  if (!jerseysTried) {
    jerseysTried = true;
    jerseys = createJerseyShowcase({ onPick: wearKit });
    jerseys?.setMotion(!getA11y().reducedMotion);
    document.fonts?.ready.then(() => jerseys?.refreshFont());
    document.fonts
      ?.load(`400 100px ${SCRIPT_FONT}`)
      .then(() => jerseys?.refreshFont())
      .catch(() => {});
  }
  if (!jerseys) {
    box.classList.add('no-webgl');
    return;
  }
  jerseys.setUnlocked(state.unlockedKits || []);
  jerseys.setKit(state.kit);
  applyJerseyPlayer();
  jerseys.mount(box);
  box.addEventListener('keydown', e => {
    if (
      (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') ||
      e.target !== box ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    e.preventDefault();
    stepJerseyPlayer(e.key === 'ArrowRight' ? 1 : -1);
  });
  const group = $('.kit-options');
  group?.addEventListener('focusin', e => {
    const i = [...group.querySelectorAll('button')].indexOf(e.target.closest('button'));
    jerseys.focusKit(i);
  });
  group?.addEventListener('focusout', () => jerseys.focusKit(-1));
  group?.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const b = [...group.querySelectorAll('button')],
      i = b.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    b[(i + (e.key === 'ArrowRight' ? 1 : b.length - 1)) % b.length].focus();
  });
}
