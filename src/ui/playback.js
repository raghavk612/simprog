// The live game: tip-off, each possession (step), "Watch live", replays, timeouts and quarter breaks.
// The 3D gym (arena.js) plays each possession's clip and calls syncPresentation as it goes; the numbers come from engine.js.
import * as E from '../engine.js';
import { up, t, tu, localeTag } from '../i18n/index.js';
import { isDunk, CLIP_SECONDS } from '../basketball.js';
import { play } from '../audio.js';
import { commentaryText as commentary, feedLines, logText, tv } from '../narrative.js';
import { speak } from '../speech.js';
import { getSound, getA11y } from '../settings.js';
import { announce } from '../a11y.js';
import { state, view, save, ui } from './store.js';
import { issueText, esc, fgPct, html, btn, shot, phase, speedLabel } from './markup.js';
import { arena, modal, $ } from './page.js';
import { setCamera, render, applyArena, go } from './shell.js';
import { show } from './dialogs.js';
import { whyHtml } from './screens/game.js';
import { result } from './screens/results.js';
import { announceKits, notify } from './toast.js';

let cued = ''; // the last play read out, so each is read once
export function tipOff() {
  const bad = E.lineupIssues(state);
  if (bad.length) throw Error(issueText(bad));
  E.startMatch(state);
  ui.lastWhy = '';
  ui.auto = false;
  arena.clear();
  setCamera('auto');
}
// Quarter break after possessions 16, 32 and 48: only a pause in the interface, the simulation is not touched. Watch live stops here and resumes on "Keep going".
let breakSeen = '';
let breakAuto = false;
function maybeBreak() {
  const m = state?.match;
  if (
    !m ||
    ui.replayEvent ||
    view !== 'game' ||
    modal.open ||
    !E.BREAKS.includes(m.possession) ||
    breakSeen === `${m.seedStart}|${m.possession}`
  )
    return;
  quarterBreak();
}
function quarterBreak() {
  const m = state.match,
    r = E.quarterReport(state);
  if (!m || !r) return;
  breakSeen = `${m.seedStart}|${m.possession}`;
  breakAuto = ui.auto;
  ui.auto = false;
  const o = E.opponent(state),
    H = r.teams.home,
    A = r.teams.away,
    us = esc(up(t('game.kangs'))),
    them = esc(up(o.opponent)),
    rows = [
      ['fg', fgPct(H.fgm, H.fga), fgPct(A.fgm, A.fga)],
      ['tp', fgPct(H.tpm, H.tpa), fgPct(A.tpm, A.tpa)],
      ...['reb', 'ast', 'stl', 'blk'].map(k => [k, H[k], A[k]]),
    ];
  const sg = r.suggestions
    .map(x => {
      const pr = { ...x.p };
      if (x.tactic) pr.tactic = t(`tactic.${x.tactic}`);
      return `<button class="choice break-adjust" data-action="break-adjust" data-id="${x.id}"><strong>${t(`break.s.${x.id}`, pr)}</strong><span>${x.tactic ? t('break.toTactic', { tactic: t(`tactic.${x.tactic}`) }) : t('break.toPace', { pace: t(`pace.${x.pace}`) })}</span></button>`;
    })
    .join('');
  render();
  show(
    html`
      <span class="eyebrow">${tu('break.kicker')}</span>
      <h1>${t('break.title', { n: r.quarter })}</h1>
      <h2 class="break-score">${us} <b>${r.home}</b>–<b>${r.away}</b> ${them}</h2>
      <div class="table-wrap team-compare">
        <table>
          <thead>
            <tr>
              <th scope="col">${t('stats.title')}</th><th scope="col">${us}</th><th scope="col">${them}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(([k, a, b]) => `<tr><td>${t(`box.${k}`)}</td><td><b>${a}</b></td><td>${b}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <h3>${t('break.suggested')}</h3>
      ${sg || `<p>${t('break.none')}</p>`}
      ${btn(t('break.keep'), 'break-go', 'primary wide break-go')}`,
  );
}
export function resumeBreak() {
  arena.paused = false;
  if (breakAuto) {
    ui.auto = true;
    ui.gap = 0;
  }
  breakAuto = false;
}
// Sounds are chosen from the clip itself: made baskets swish, everything else has its own cue.
function cueFor(c) {
  return c.outcome === 'made' ? (c.three ? 'three' : 'swish') : c.outcome === 'miss' ? 'rim' : c.outcome;
}
// The crowd reacts to big plays: it roars for the Kangs' threes, dunks and blocks, and groans for the visitors'.
function crowdReaction(c) {
  const big = c.outcome === 'made' && (c.three || isDunk(c.kind));
  if (c.team === 'home' && (big || c.outcome === 'steal')) play('cheer');
  else if (c.team === 'away' && big) play('groan');
  else if (c.outcome === 'block') play(c.team === 'away' ? 'cheer' : 'groan');
}
// Each resolved play once: its sound, the crowd, the commentary (spoken if speech is on), and the score read out
// for screen-reader users who cannot follow the 3D scene.
export function reportPlay(p) {
  const id = `${arena.run}|${p.index}`;
  if (cued === id) return;
  cued = id;
  play(cueFor(p.clip));
  crowdReaction(p.clip);
  const line = commentary(p.clip);
  const spoke = speak(line, {
    tag: localeTag(),
    muted: getSound().muted,
    rate: Math.min(1.5, 0.95 + 0.15 * Math.log2(Math.max(0.5, arena.speed || 1)) + 0.1),
  });
  announce(
    spoke
      ? t('a11y.score', { home: p.home, away: p.away })
      : `${line} ${t('a11y.score', { home: p.home, away: p.away })}`,
  );
}
export function syncPresentation(p) {
  if (!p) return;
  if ($('#live-home')) $('#live-home').textContent = p.home;
  if ($('#live-away')) $('#live-away').textContent = p.away;
  const banner = $('.live-action');
  if (banner)
    banner.textContent = `${p.clip.team === 'home' ? up(t('game.kangs')) : up(t('game.visitors'))} · ${shot(p.clip)}`;
  const call = $('.play-call');
  if (call)
    call.textContent = p.resolved
      ? commentary(p.clip)
      : t('game.look', {
          player: p.clip.player,
          phase: phase(p.phase),
          contest: t(`contest.${p.clip.contest}`),
        });
  const feed = $('.play-feed');
  if (feed) {
    const m = state.match || ui.closingMatch;
    const rows = ui.replayEvent
      ? p.index === 1 && p.resolved
        ? arena.clips.map(commentary).reverse()
        : p.index === 0 && !p.resolved
          ? []
          : [commentary(arena.clips[0])]
      : m
        ? p.index === 1 && p.resolved
          ? feedLines(m)
          : p.index === 0 && !p.resolved
            ? feedLines(m).slice(2)
            : feedLines(m).slice(1)
        : [];
    feed.innerHTML = rows.map((text, i) => `<p class="${i === 0 ? 'new' : ''}">${esc(text)}</p>`).join('');
  }
  if (p.resolved && p.clip?.impacts) {
    ui.lastWhy = whyHtml(p.clip);
    const w = $('#why-body');
    if (w) w.innerHTML = ui.lastWhy;
  }
  const next = $('[data-action="step"]');
  if (next) next.disabled = arena.isPlaying() || !!ui.closingMatch;
  if (p.done && ui.pendingResult !== null) {
    const index = ui.pendingResult;
    ui.pendingResult = null;
    ui.closingMatch = null;
    ui.auto = false;
    arena.clear();
    render();
    play(state.results[index].won ? 'victory' : 'defeat');
    ui.flowPending = !state.finished;
    result(index);
    announceKits(state.results[index].kits);
  } else if (p.done) maybeBreak();
}
export function fpHud() {
  try {
    const el = document.querySelector('.fp-hud');
    if (!el) return;
    const s = arena.fpActive ? arena.fpSubject : null;
    let key = '';
    if (s && view === 'game') {
      const pl = s.home ? state?.players?.find(p => p.id === s.id) : null;
      const pos = s.home
        ? s.position && s.position !== 'Not listed'
          ? s.position
          : pl
            ? E.bio(pl).position
            : ''
        : '';
      const opp = ui.replayEvent
        ? ui.replayOpp
        : ((ui.closingMatch ? state?.results?.at(-1)?.opponent : undefined) ??
          state?.schedule?.[state.week]?.opponent);
      const tag = s.home ? (pos ? tv(pos) : '') : opp || t('game.visitors');
      key = `${s.number ?? ''}|${s.name || ''}|${tag}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.innerHTML = `<b>${tu('stage.player')}</b><span>#${esc(String(s.number ?? ''))} ${esc(s.name || '')}</span>${tag ? `<em>${esc(String(tag).toUpperCase())}</em>` : ''}`;
      }
      el.hidden = false;
      return;
    }
    if (el.dataset.key) {
      el.dataset.key = '';
      el.textContent = '';
    }
    el.hidden = true;
  } catch {}
}
// Plays the next possession. After the last one the match is over, but it stays on screen (closingMatch)
// until its clip ends; then syncPresentation opens the result.
export function step() {
  if (!state.match || arena.isPlaying()) return;
  ui.closingMatch = state.match;
  const event = E.possession(state);
  arena.play(event);
  applyArena();
  save();
  ui.gap = 0;
  if (!state.match) {
    ui.pendingResult = state.results.length - 1;
    ui.auto = false;
  } else ui.closingMatch = null;
  render();
}
// "Next play".
export function nextPlay() {
  ui.auto = false;
  arena.paused = false;
  step();
}
// "Watch live" turns automatic play on or off. Returns false when it has already done everything
// (the caller otherwise saves and redraws). During the final possession it only pauses the clip.
export function toggleWatch() {
  play('uiClick');
  if (ui.closingMatch) {
    arena.paused = !arena.paused;
    render();
    return false;
  }
  ui.auto = !ui.auto;
  arena.paused = !ui.auto;
  ui.gap = 0;
  if (ui.auto && !arena.isPlaying()) {
    step();
    return false;
  }
}
// Every 100 ms: while "Watch live" is on, the next possession starts once the last clip has ended.
// With timing assist on, a short pause between possessions leaves time to read each play.
export function watchTick() {
  if (arena.failed && arena.event && !arena.paused) {
    arena.playTime = Math.min(CLIP_SECONDS * 2, arena.playTime + 0.1 * arena.speed);
    syncPresentation(arena.presentation());
  }
  if (
    ui.auto &&
    view === 'game' &&
    state?.match &&
    !modal.open &&
    !arena.isPlaying() &&
    !(['SELECT', 'INPUT'].includes(document.activeElement?.tagName) && Date.now() - ui.lastInteract < 4000)
  ) {
    ui.gap += 100;
    if (!getA11y().timingAssist || ui.gap >= 2500) step();
  }
}
export function togglePause() {
  arena.paused = !arena.paused;
  render();
}
export function setSpeed(n) {
  ui.playbackSpeed = n;
  applyArena();
  render();
  announce(t('a11y.speed', { speed: speedLabel(n) }));
}
export function askTimeout() {
  ui.auto = false;
  show(
    html`
      <span class="eyebrow">${tu('timeout.kicker')}</span>
      <h1>${t('timeout.title')}</h1>
      <p>${t('timeout.body')}</p>
      ${btn(t('timeout.calm'), 'huddle', 'primary wide', 'data-message="calm"')}
      ${btn(t('timeout.belief'), 'huddle', 'secondary wide', 'data-message="belief"')}`,
  );
}
// Quarter break: "Keep going", or one of the suggested adjustments.
export function closeBreak() {
  modal.close();
  resumeBreak();
  render();
}
export function applyBreakAdjust(id) {
  const e = E.applyAdjustment(state, id);
  save();
  modal.close();
  resumeBreak();
  play('confirm');
  notify(logText(e), { type: 'success', title: t('break.applied') });
  render();
}
// A possession replayed from a result: the Game day page shows it on the court with its own controls.
export function watchReplay(index, eventIndex) {
  const event = state.results[index].events[eventIndex];
  ui.flowPending = false;
  modal.close();
  go('game');
  ui.replayEvent = event;
  ui.replayOpp = state.results[index].opponent || '';
  arena.play(event, { replay: true });
  applyArena();
  render();
}
export function replayAgain() {
  arena.play(ui.replayEvent, { replay: true });
  applyArena();
  render();
}
