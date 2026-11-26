// Game day: before tip-off (scouting, tip-off preview, the starting five) and the live game (score bug, controls,
// play-by-play, box score, "Why that shot?"). Replays of a past possession use the same page. The playing itself is in playback.js.
import { t, tu, up, formatDate, has } from '../../i18n/index.js';
import * as E from '../../engine.js';
import { strengthLevel, energyLevel, moraleLevel } from '../../teamLabels.js';
import { tv, feedLines } from '../../narrative.js';
import { state, plan, stages, teamLabel, hasScore, ui } from '../store.js';
import {
  html,
  esc,
  capBadge,
  chipHtml,
  btn,
  hint,
  speedLabel,
  header,
  LOGO_WHITE,
  crestText,
  oppMark,
  shot,
  issueText,
} from '../markup.js';
import { show } from '../dialogs.js';
import { arena } from '../page.js';
import { stage } from '../shell.js';
import { endscreen } from './season.js';
import { nextStepButton } from './home.js';

// The play-by-play is the game's story, so on a desktop it starts open; once the coach closes it (or opens another
// drawer, which closes it) it stays as they left it. Kept here, not in the DOM, because render() rebuilds the drawers.
let feedOpen = true;
if (typeof document !== 'undefined')
  document.addEventListener(
    'toggle',
    e => {
      if (e.target.matches?.('.commentary-drawer')) feedOpen = e.target.open;
    },
    true,
  );
const feedStartsOpen = () => feedOpen && matchMedia('(min-width: 761px)').matches;
/* ESPN-style box score: starters, bench, team totals. With `links` (the live game's compact box score) each name opens
   that player's profile; the result dialog's box score has none, because a profile would replace that dialog. */
export function boxTable(line, title, compact = false, links = compact) {
  if (!line) return '';
  const rows = Object.entries(line)
    .map(([id, l]) => ({ p: state.players.find(p => p.id === +id), l }))
    .filter(x => x.l.min > 0 || x.l.fga || x.l.reb || x.l.ast || x.l.stl || x.l.blk || x.l.tov);
  if (!rows.length) return '';
  const tot = rows.reduce((s, { l }) => {
    for (const k of ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'fgm', 'fga', 'tpm', 'tpa', 'tov'])
      s[k] = (s[k] || 0) + (l[k] || 0);
    return s;
  }, {});
  const cells = l =>
    compact
      ? `<td><b>${l.pts}</b></td><td>${l.reb}</td><td>${l.ast}</td><td>${l.stl}</td><td>${l.blk}</td>`
      : `<td>${l.min ?? '—'}</td><td><b>${l.pts}</b></td><td>${l.fgm}-${l.fga}</td><td>${l.tpm}-${l.tpa}</td><td>${l.reb}</td><td>${l.ast}</td><td>${l.stl}</td><td>${l.blk}</td><td>${l.tov}</td>`;
  const heads = (
    compact
      ? ['pts', 'reb', 'ast', 'stl', 'blk']
      : ['min', 'pts', 'fg', 'tp', 'reb', 'ast', 'stl', 'blk', 'to']
  ).map(h => t(`box.${h}`));
  const group = (name, list) =>
    list.length
      ? html`
        <tr class="box-group"><td>${name}</td>${heads.map(h => `<td>${esc(h)}</td>`).join('')}</tr>
        ${list
          .map(
            ({ p, l }) => html`
              <tr>
                <td class="box-player">${links && p ? `<button class="box-name player-link" data-action="player" data-id="${p.id}">${esc(p.name)}</button>` : `<span class="box-name">${esc(p?.name ?? t('result.former'))}</span>`}${p ? capBadge(p.id) : ''} <span class="box-pos">${p && p.position[0] !== 'N' ? esc(p.position[0]) + ' ' : ''}#${p?.number ?? ''}</span></td>${cells(l)}
              </tr>`,
          )
          .join('')}`
      : '';
  return html`
    <div class="table-wrap box-score${compact ? ' compact' : ''}">
      <table>
        <caption>${esc(title)}</caption>
        <tbody>
          ${group(
            tu('box.starters'),
            rows.filter(x => x.l.start),
          )}
          ${group(
            tu('box.bench'),
            rows.filter(x => !x.l.start),
          )}
          <tr class="box-total"><td class="box-player">${tu('box.team')}</td>${cells(tot)}</tr>
        </tbody>
      </table>
    </div>`;
}
// Tip-off preview on Game day, before the game starts, and the "How the model works" panel it opens.
function tipoffCard() {
  const v = E.tipoffPreview(state);
  return html`
    <section class="card tipoff-card">
      <span class="eyebrow">${tu('tipoff.kicker')}</span>
      <div class="effect-list">
        <span class="strength-badge ${strengthLevel(v.rating)}">${t('game.strength')} <b>${Math.round(v.rating)} · ${t(`game.strengthLevel.${strengthLevel(v.rating)}`)}</b></span><span>${t('game.style')} <b>${v.style ? t(`style.${v.style}`) : t('game.unscouted')}</b></span><span>${t('tipoff.energy')} <b>${v.energy}</b></span><span>${t('tipoff.morale')} <b>${v.morale}</b></span><span>${t('metrics.chemistry')} <b>${v.chemistry}</b></span><span>${t('tipoff.timeouts')} <b>${v.timeouts}</b></span>
      </div>
      ${v.effective !== v.rating ? `<p>${t('tipoff.effective', { n: v.effective })}</p>` : ''}
      <p>${v.away ? t('tipoff.travel', { n: v.travel }) : t('tipoff.homeGame')}</p>
      <h3>${t('tipoff.mods')}</h3>
      ${v.mods.length ? `<div class="chips">${v.mods.map(([k, x]) => chipHtml({ k, v: x, who: 'next' })).join('')}</div>` : `<p class="muted">${t('tipoff.none')}</p>`}
      ${btn(t('tipoff.model'), 'model', 'secondary small')}
    </section>`;
}
export function modelPanel() {
  const M = E.modelSnapshot(state),
    f = n => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`,
    v = n => n.toFixed(1);
  const rows = [
    [t('model.l.base'), t('model.base', { base: M.base, miss: f(M.miss), three: f(M.threeMiss) })],
    [t('impact.skill'), t('model.skill', { a: v(M.skill), b: v(M.rating), pp: f(M.pp.skill) })],
    [t('impact.energy'), t('model.energy', { v: v(M.energy), pp: f(M.pp.energy) })],
    [t('impact.morale'), t('model.morale', { v: v(M.morale), pp: f(M.pp.morale) })],
    [t('impact.chemistry'), t('model.chemistry', { v: v(M.chem), pp: f(M.pp.chemistry) })],
    [t('impact.shotType'), t('model.shotType', { hi: f(M.shotHi), lo: f(M.shotLo) })],
    [t('impact.space'), t('model.space', { n: v(M.space) })],
    [t('impact.tactics'), t('model.tactics', { scout: f(M.scout), pp: f(M.pp.tactics) })],
    [
      t('impact.repertoire'),
      t('model.repertoire', { max: v(E.TUNING.repertoire * 100), pp: f(M.pp.repertoire) }),
    ],
    [t('model.l.diff'), t('model.diff', { level: t(`level.${M.level}`), pp: f(M.diff) })],
    [t('model.l.boost'), t('model.boost', { n: f(M.boost) })],
  ];
  const factors = [
      ...Object.entries(M.pp).map(([key, value]) => [t(`impact.${key}`), value]),
      [t('model.l.diff'), M.diff],
    ],
    scale = Math.max(10, ...factors.map(([, n]) => Math.abs(n)));
  show(
    html`
      <div class="shot-model">
        <span class="eyebrow">${tu('tipoff.kicker')}</span>
        <h1>${t('model.title')}</h1>
        <div class="shot-overview">
          <div class="shot-gauge" style="--chance:${M.before}%"><strong>${M.before}%</strong></div>
          <div>
            <h2>${t('model.visual.typical')}</h2>
            <p>${t('model.visual.context')}</p>
            <div class="shot-equation">
              <span>${(M.base + M.miss).toFixed(1)}%<small>${t('model.l.base')}</small></span><b>+</b><span>${f(Object.values(M.pp).reduce((a, b) => a + b, 0) + M.diff)}<small>${t('model.visual.adjustments')}</small></span>
            </div>
          </div>
        </div>
        <h3>${t('model.visual.factors')}</h3>
        <p class="shot-caption">${t('model.visual.pp')}</p>
        <div class="shot-factors">
          ${factors
            .map(
              ([label, n]) => html`
                <div class="shot-factor ${n < 0 ? 'negative' : 'positive'}">
                  <span>${label}</span>
                  <div class="shot-track" aria-hidden="true">
                    <i style="width:${(Math.abs(n) / scale) * 50}%;left:${n < 0 ? 50 - (Math.abs(n) / scale) * 50 : 50}%"></i>
                  </div>
                  <b>${f(n)}</b>
                </div>`,
            )
            .join('')}
        </div>
        <div class="shot-variables">
          <div><span>${t('impact.shotType')}</span><strong>${f(M.shotLo)} → ${f(M.shotHi)}</strong></div>
          <div><span>${t('impact.space')}</span><strong>±${M.space}</strong></div>
          <div><span>${t('model.l.boost')}</span><strong>+${M.boost}</strong></div>
        </div>
        <details class="shot-details">
          <summary>${t('model.visual.details')}</summary>
          <p>${t('model.intro', { min: M.min, max: M.max })}</p>
          <ul class="model-list">
            ${rows.map(([l, x]) => `<li><strong>${esc(l)}</strong><span>${x}</span></li>`).join('')}
          </ul>
          <p>${t('model.note')}</p>
        </details>
      </div>`,
  );
}
function speedControls() {
  return html`
    <div class="playback-controls">
      <span id="speed-label">${tu('game.speed')}</span>
      <div role="group" aria-labelledby="speed-label" ${hint('speed')}>
        ${[1, 2, 4].map(n => btn(speedLabel(n), 'speed', ui.playbackSpeed === n ? 'selected' : '', `data-speed="${n}" aria-pressed="${ui.playbackSpeed === n}"`)).join('')}
      </div>
    </div>`;
}
function teamStats(stats, opp = '') {
  if (!stats) return '';
  return html`
    <div class="table-wrap team-compare">
      <table>
        <thead>
          <tr>
            <th scope="col">${t('stats.title')}</th><th scope="col">${esc(t('game.kangs'))}</th><th scope="col">${esc(opp)}</th>
          </tr>
        </thead>
        <tbody>
          ${['rebounds', 'assists', 'steals', 'blocks'].map(k => `<tr><td>${t(`stats.${k}`)}</td><td><b>${stats.home[k]}</b></td><td>${stats.away[k]}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
function replayView() {
  const p = arena.presentation(),
    e = ui.replayEvent;
  return html`
    ${header(tu('replay.kicker'), t('replay.title'), t('replay.intro'))}
    <div class="replay-layout">
      ${stage('game-arena')}
      <div class="score-strip">
        <div>${tu('game.kangs')}<strong id="live-home">${p?.home ?? e.home}</strong></div>
        <div class="clock"><span>${tu('replay.recorded')}</span><strong>#${e.number}</strong></div>
        <div>${tu('game.visitors')}<strong id="live-away">${p?.away ?? e.visitor}</strong></div>
      </div>
      <p class="play-call"></p>
      <div class="play-feed"></div>
      ${speedControls()}
      ${btn(t('replay.again'), 'replay-again', 'primary')}
      ${btn(arena.paused ? t('replay.resume') : t('replay.pause'), 'replay-pause', 'secondary', hint('playPause'))}
      ${btn(t('replay.back'), 'journal', 'secondary')}
    </div>`;
}
function scoreBug(m, o) {
  const q =
      m.possession > 64
        ? t('bug.ot')
        : t('bug.q', { n: Math.max(1, Math.min(4, Math.ceil(m.possession / 16))) }),
    clock = `${Math.max(0, 8 - Math.floor((m.possession ? ((m.possession - 1) % 16) + 1 : 0) / 2))}:00`,
    P = state ? plan() : null,
    tag =
      P && state.week >= P.cut
        ? up(stages().run)
        : `${esc(up(teamLabel()))} · ${esc(up(tv(o.type || 'Regular Season')))}`,
    to = Math.max(0, m.timeouts ?? 0);
  return html`
    <div class="score-strip bug2k" role="group" aria-label="${esc(t('bug.aria'))}">
      <span class="bug-tag">${tag}</span>
      <div class="bug-team home">
        <img src="${LOGO_WHITE}" alt="">
        <div class="bug-name">
          <b>${esc(up(t('game.kangs')))}</b><small>${state.wins}–${state.losses} · <span class="bug-to" role="img" aria-label="${esc(t('bug.timeouts', { n: to }))}">${[0, 1, 2].map(i => `<i class="${i < to ? 'on' : ''}"></i>`).join('')}</span></small>
        </div>
        <strong id="live-home">${arena.presentation()?.home ?? m.home}</strong>
      </div>
      <div class="bug-mid">
        <span>${esc(q)}</span><strong>${clock}</strong><small>${tu('bug.poss', { n: m.possession })}</small>
      </div>
      <div class="bug-team away">
        <strong id="live-away">${arena.presentation()?.away ?? m.away}</strong>
        <div class="bug-name"><b>${esc(crestText(o.opponent))}</b><small>${esc(o.opponent)}</small></div>
        ${oppMark(o.opponent, 'bug-logo', `<span class="bug-crest">${esc(crestText(o.opponent)).slice(0, 3)}</span>`)}
      </div>
      <span class="bug-slogan">${tu('bug.slogan')}</span>
    </div>`;
}
// Before tip-off, what a coach needs to judge readiness without opening a drawer: who is stronger on the model's own
// scale (the rotation's average skill against the opponent's strength), the rotation's energy and morale, and the
// opponent's style, or a way to scout it while a prep slot is left.
function readyFacts(o) {
  const v = E.tipoffPreview(state),
    M = E.modelSnapshot(state),
    them = Math.round(M.rating),
    level = strengthLevel(M.rating);
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  return html`
    <dl class="ready-facts">
      ${row(t('game.strengthShort'), `${esc(t('game.kangs'))} <b>${Math.round(M.skill)}</b> · ${esc(o.opponent)} <b>${them}</b> <span class="strength-word ${level}">(${t(`game.strengthLevel.${level}`)})</span>`)}
      ${row(t('tipoff.energy'), `<b>${v.energy}</b> · ${t(`rv.energy.${energyLevel(v.energy)}`)}`)}
      ${row(t('tipoff.morale'), `<b>${v.morale}</b> · ${t(`rv.morale.${moraleLevel(v.morale)}`)}`)}
      ${row(t('game.style'), state.scouted ? `<b>${t(`style.${o.style}`)}</b>` : `${t('game.unscouted')}${state.actions > 0 ? ` · <button class="text-button" data-view="practice">${t('prep.film')}</button>` : ''}`)}
    </dl>`;
}
// The starting five with each player's overall and energy (number and bar; a tired player's word in red).
function fiveTable(lineupBad) {
  return html`
    <table class="five-table">
      <caption class="sr-only">${esc(t('game.startingFive'))}</caption>
      <thead>
        <tr>
          <th scope="col" colspan="2"><span class="sr-only">${t('rv.name')}</span></th><th scope="col">${t('rv.ovr')}</th><th scope="col">${t('roster.energy')}</th>
        </tr>
      </thead>
      <tbody>
        ${state.players
          .filter(p => p.starter)
          .map(p => {
            const why = lineupBad.find(x => x.id === p.id)?.reason,
              e = Math.round(p.energy),
              lv = energyLevel(e),
              low = lv === 'tired' || lv === 'exhausted';
            return html`
              <tr>
                <td><span class="jersey">${p.number}</span></td>
                <th scope="row">${esc(p.name)}${why ? ` <span class="pill warn">${t(`lineup.${why}`)}</span>` : ''}</th>
                <td class="five-ovr">${E.ratings(p).ovr}</td>
                <td class="five-energy ${low ? 'low' : ''}">
                  <span class="bar" aria-hidden="true"><i style="width:${e}%"></i></span>${e}${low ? ` <small>${t(`rv.energy.${lv}`)}</small>` : ''}
                </td>
              </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}
// The way forward before tip-off. When the week's next step is something else, that step is the one purple button
// (the same as Home's; an ineligible starter is fixed right here), and Tip off is secondary with one line saying what
// tipping off now skips. When tip-off cannot happen yet, Tip off is disabled and the line says why.
function skipLine(skips) {
  const item = x =>
    x.id === 'slots'
      ? t(x.n === 1 ? 'game.skip.slot' : 'game.skip.slots', { n: x.n })
      : x.id === 'press'
        ? t('game.skip.press', { n: x.n })
        : t(`game.skip.${x.break}`);
  return skips.length ? t('game.skips', { list: skips.map(item).join(' · ') }) : '';
}
function tipoffAction(lineupBad) {
  const { blocked, skips } = E.tipoffSkips(state),
    step = E.nextStep(state),
    why = 'tipoff-why';
  const primary =
    step.id === 'tipoff'
      ? ''
      : step.id === 'issues'
        ? btn(t('lineup.fix'), 'auto-lineup', 'primary wide')
        : nextStepButton('primary wide').html;
  // an ineligible starter while another step comes first (the press room, say): still fixable here, as a secondary
  const fixHere =
    lineupBad.length && step.id !== 'issues' ? btn(t('lineup.fix'), 'auto-lineup', 'secondary wide') : '';
  const line =
    blocked === 'issues'
      ? issueText(lineupBad, true)
      : blocked
        ? t(`game.blocked.${blocked}`)
        : step.id === 'tipoff'
          ? ''
          : skipLine(skips);
  return html`
    ${fixHere}
    <div class="page-action">
      ${primary}
      ${btn(t('game.tipOff'), 'start-match', `${primary ? 'secondary' : 'primary'} wide`, `${line ? `aria-describedby="${why}"` : ''} ${blocked ? 'disabled' : ''}`)}
      ${line ? `<p class="tipoff-why" id="${why}">${line}</p>` : ''}
    </div>`;
}
// A replay, the end of the season, or the next game (before tip-off or live).
export function game() {
  if (ui.replayEvent) return replayView();
  if (state.finished && !ui.closingMatch) return endscreen();
  const lineupBad = E.lineupIssues(state),
    o = ui.closingMatch ? state.results.at(-1) : E.opponent(state),
    m = state.match || ui.closingMatch,
    P = plan(),
    names = stages();
  return html`
    ${header(m ? tu('game.liveKicker') : tu('game.prepKicker'), m ? t('game.liveTitle') : t('game.vs', { opp: esc(o.opponent) }), `${esc(formatDate(o.date))} · ${esc(o.venue)} · ${state.week >= P.cut ? t('game.eliminationGame', { run: names.run }) : t('game.matchup', { type: esc(o.type ? tv(o.type) : t('game.typeDefault')) })}`)}
    <div class="game-layout">
      <div class="court-panel">
        ${stage('game-arena')} ${
          m
            ? html`
              ${scoreBug(m, o)}
              <p class="play-call" aria-live="polite"> ${esc(arena.presentation()?.clip ? shot(arena.presentation().clip) : t('game.choosePlay'))}
              </p>
              <div class="court-drawers">
                <details class="court-drawer commentary-drawer" name="court-drawers" ${feedStartsOpen() ? 'open' : ''}>
                  <summary>${t('game.playByPlay')}</summary>
                  <div class="drawer-body play-feed">
                    ${(arena.isPlaying() ? feedLines(m).slice(2) : feedLines(m)).map((x, i) => `<p class="${i === 0 ? 'new' : ''}">${esc(x)}</p>`).join('') || `<p>${t('game.crowdReady')}</p>`}
                  </div>
                </details>
                <details class="court-drawer box-drawer" name="court-drawers">
                  <summary>${t('game.boxScore')}</summary>
                  <div class="drawer-body">
                    ${teamStats(m.stats, o.opponent)}
                    ${boxTable(m.line, up(t('game.kangs')), true)}
                  </div>
                </details>
                <details class="court-drawer why-drawer" name="court-drawers">
                  <summary>${t('game.why')}</summary>
                  <div class="drawer-body">
                    <p class="muted">${t('result.whyBody')}</p>
                    ${btn(t('tipoff.model'), 'model', 'secondary small')}
                    <div id="why-body" aria-live="polite">${ui.lastWhy || `<p>${t('game.whyNone')}</p>`}</div>
                  </div>
                </details>
              </div>`
            : html`
              <div class="court-drawers">
                <details class="court-drawer" name="court-drawers">
                  <summary>${tu('game.scouting')}</summary>
                  <section class="drawer-body card">
                    <p> ${hasScore(o) ? t('game.reference', { a: o.points, b: o.against }) : t('game.upcoming', { when: `${esc(formatDate(o.date))}${o.time ? ` · ${esc(o.time)}` : ''}`, where: t(o.home ? 'game.homeGame' : 'game.awayGame'), venue: esc(o.venue) })}
                    </p> <div class="effect-list">
                      <span class="strength-badge ${strengthLevel(o.rating)}">${t('game.strength')} <b>${Math.round(o.rating)} · ${t(`game.strengthLevel.${strengthLevel(o.rating)}`)}</b></span><span>${t('game.style')} <b>${state.scouted ? t(`style.${o.style}`) : t('game.unscouted')}</b></span>
                    </div>
                    ${state.scouted ? `<p class="notice">${t(`game.advice.${o.style}`)} ${t('game.adviceNote')}</p>` : `<button class="secondary small" data-view="practice">${t('nudge.btn.scout')}</button>`}
                  </section>
                </details>
                <details class="court-drawer" name="court-drawers">
                  <summary>${tu('tipoff.kicker')}</summary>
                  <div class="drawer-body">${tipoffCard()}</div>
                </details>
              </div>`
        }
      </div>
      <aside class="right-rail" aria-label="${esc(t('game.controls'))}">
        <section class="card">
          <span class="eyebrow">${m ? tu('game.sideline') : tu('game.startingFive')}</span>${
            m
              ? html`
                <h2>${t('game.callPlay')}</h2>
                <label>
                  ${tu('game.system')}
                  <select id="tactic">
                    ${['balanced', 'zone', 'pressure', 'perimeter'].map(v => `<option value="${v}" ${m.tactic === v ? 'selected' : ''}>${t(`tactic.${v}`)}</option>`).join('')}
                  </select>
                </label>
                <label>
                  ${tu('game.tempo')}
                  <select id="pace">
                    ${['steady', 'fast'].map(v => `<option value="${v}" ${m.pace === v ? 'selected' : ''}>${t(`pace.${v}`)}</option>`).join('')}
                  </select>
                </label>
                ${speedControls()}
                ${btn(
                  ui.closingMatch
                    ? arena.paused
                      ? t('game.resumeFinal')
                      : t('game.pauseFinal')
                    : ui.auto
                      ? t('game.pause')
                      : arena.paused
                        ? t('game.resume')
                        : t('game.watch'),
                  'auto',
                  'primary wide',
                  hint('playPause'),
                )}
                ${btn(t('game.next'), 'step', 'secondary wide', `${hint('nextPlay')} ${arena.isPlaying() || ui.closingMatch ? 'disabled' : ''}`)}
                ${btn(t('game.timeout', { n: m.timeouts }), 'timeout', 'secondary wide', `${hint('timeout')} ${m.timeouts && !ui.closingMatch ? '' : 'disabled'}`)}`
              : html`
                <h2>${t('game.ready')}</h2>
                ${readyFacts(o)}
                ${fiveTable(lineupBad)}
                ${btn(t('game.adjust'), 'rotation', 'secondary wide')}
                ${tipoffAction(lineupBad)}`
          }
        </section>
      </aside>
    </div>`;
}
// "Why that shot?": how each factor moved the chance of the latest resolved play, in percentage points. The bars are decoration; the numbers carry the meaning.
export function whyHtml(c) {
  const rows = Object.entries(c.impacts || {}),
    max = Math.max(8, ...rows.map(([, v]) => Math.abs(v)));
  return html`
    <p class="why-head">${esc(t('game.whyShot', { player: c.player, shot: shot(c), n: c.shotChance }))}</p>
    <ul>
      ${rows
        .map(
          ([k, v]) => html`
            <li>
              <span>${esc(has(`impact.${k}`) ? t(`impact.${k}`) : k)}</span><b>${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pp</b><i aria-hidden="true" class="${v >= 0 ? 'up' : 'down'}" style="width:${Math.round((Math.abs(v) / max) * 100)}%"></i>
            </li>`,
        )
        .join('')}
    </ul>`;
}
