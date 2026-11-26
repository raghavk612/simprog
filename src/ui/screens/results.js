// The result dialog after a game, or when a result is opened from the journal: the score, player of the game,
// highlights to replay, what the week changed with the one next step under it, and the full analysis behind "More".
import { t, tu, up, has } from '../../i18n/index.js';
import * as E from '../../engine.js';
import { reasonText, logText, explanationText } from '../../narrative.js';
import { state, ui } from '../store.js';
import { weekSnapshot, whatChanged } from '../../recap.js';
import { html, esc, shot, btn } from '../markup.js';
import { show } from '../dialogs.js';
import { boxTable } from './game.js';

// Player of the game card and the three best plays, each a replay button (the same "replay" action as the defining possessions below).
function pogCard(r) {
  if (!r.pog) return '';
  const p = state.players.find(x => x.id === r.pog.id),
    l = r.line?.[r.pog.id],
    name = p?.name || t('result.former'),
    bits = [
      `${r.pog.pts} ${t('box.pts')}`,
      `${r.pog.reb} ${t('box.reb')}`,
      `${r.pog.ast} ${t('box.ast')}`,
      `${r.pog.stl} ${t('box.stl')}`,
      `${r.pog.blk} ${t('box.blk')}`,
    ];
  if (l) bits.push(`${l.fgm}-${l.fga} ${t('box.fg')}`);
  return html`
    <section class="pog-card pog" role="group" aria-label="${esc(t('result.pog', { name, pts: r.pog.pts, reb: r.pog.reb, ast: r.pog.ast }))}">
      <span class="jersey" aria-hidden="true">${p?.number ?? ''}</span>
      <div>
        <small>${tu('result.pogTitle')}</small><strong>${esc(name)}</strong><span class="pog-line">${bits.map(x => `<span>${esc(x)}</span>`).join('')}</span>
      </div>
    </section>`;
}
function highlightStrip(r, index) {
  const list = E.highlights(r.events);
  if (!list.length) return '';
  return html`
    <h3>${t('hl.title')}</h3>
    <p>${t('hl.note')}</p>
    <div class="highlights">
      ${list
        .map((h, n) => {
          const kind = t(`hl.kind.${h.kind}`);
          return `<button class="choice hl-card ${h.kind}" data-action="replay" data-index="${index}" data-event="${h.i}" aria-label="${esc(t('hl.watch', { player: h.player, kind, home: h.home, away: h.away }))}"><i class="hl-rank" aria-hidden="true">${n + 1}</i><span class="hl-body"><em class="hl-tag">${esc(kind)}</em><strong>${esc(h.player)}</strong><span>${esc(h.points ? shot(h.shot) : t(`hl.def.${h.kind}`))}</span></span><b class="hl-score" aria-hidden="true">${esc(up(t('game.kangs')))} ${h.home}–${h.away}</b></button>`;
        })
        .join('')}
    </div>`;
}
// "What changed": the save at the start of each week of this session (noteWeek, called from Home, Prep and tip-off),
// compared with the save once the week's game is over. Kept for the save object it was taken from, so a new or loaded
// season starts empty; a result opened after a reload simply has no list.
let weeks = { of: null, start: {}, recap: {} };
export function noteWeek(s) {
  if (!s || s.match || s.finished) return;
  if (weeks.of !== s) weeks = { of: s, start: {}, recap: {} };
  weeks.start[s.week] ??= weekSnapshot(s);
  for (const w of Object.keys(weeks.start)) if (+w < s.week - 1) delete weeks.start[w];
}
// The list for a result: worked out once, right after its game (the latest result, its week just ended).
function recapFor(r, index) {
  if (weeks.of !== state) return null;
  const done = index === state.results.length - 1 && state.week === r.week + 1 && !state.match;
  if (!weeks.recap[r.week] && done && weeks.start[r.week])
    weeks.recap[r.week] = whatChanged(weeks.start[r.week], weekSnapshot(state));
  return weeks.recap[r.week] || null;
}
const arrow = { good: '▲', bad: '▼', same: '•' };
function recapItem(x) {
  const [tone, text] =
    x.k === 'ovr'
      ? [x.to > x.from ? 'good' : 'bad', t('recap.ovr', { name: esc(x.name), from: x.from, to: x.to })]
      : x.k === 'ovrMore'
        ? ['same', t('recap.more', { n: x.n })]
        : x.k === 'injured'
          ? ['bad', t(x.n === 1 ? 'recap.injuredOne' : 'recap.injured', { name: esc(x.name), n: x.n })]
          : x.k === 'healed'
            ? ['good', t('recap.healed', { name: esc(x.name) })]
            : x.k === 'tokens'
              ? [
                  x.v > 0 ? 'good' : x.v < 0 ? 'bad' : 'same',
                  t('recap.tokens', { n: x.v > 0 ? `+${x.v}` : x.v < 0 ? `−${-x.v}` : '0' }),
                ]
              : x.from == null
                ? ['same', t('recap.rankNew', { to: x.to, of: x.of })]
                : x.from === x.to
                  ? ['same', t('recap.rankSame', { to: x.to, of: x.of })]
                  : [x.to < x.from ? 'good' : 'bad', t('recap.rank', { from: x.from, to: x.to, of: x.of })];
  return `<li class="${tone}"><b aria-hidden="true">${arrow[tone]}</b><span>${text}</span></li>`;
}
const recapList = list =>
  list
    ? html`
      <section class="recap" aria-labelledby="recap-h">
        <h3 id="recap-h">${t('recap.title')}</h3>
        <ol>${list.map(recapItem).join('')}</ol>
      </section>`
    : '';
export function result(index) {
  const r = state.results[index];
  if (!r) return;
  // The one next step: closing the dialog right after a game opens the press room (main.js runs the postgame).
  const next =
    ui.flowPending && E.nextStep(state).id === 'press' ? t('nudge.btn.press') : t('inbox.continue');
  show(
    html`
      <span class="eyebrow">${tu('result.kicker', { outcome: r.won ? t('result.win') : t('result.loss') })}</span>
      <h1>${r.home}–${r.away}</h1>
      <h2>${t('game.vs', { opp: esc(r.opponent) })}</h2>
      <p>${esc(reasonText(r))}</p>
      ${pogCard(r)}
      ${highlightStrip(r, index)}
      ${recapList(recapFor(r, index))}
      <div class="modal-actions sticky">${btn(next, 'close', 'primary')}</div>
      <details class="analysis-drawer">
        <summary>${t('flow.more')}</summary>
        <h3>${t('result.before')}</h3>
        ${r.ripples.map(x => `<p class="notice">${esc(logText(x))}</p>`).join('') || `<p>${t('result.noPrep')}</p>`}
        <h3>${t('result.defining')}</h3>
        ${r.events
          .slice(-5)
          .map(
            (e, i) =>
              `<button class="choice" data-action="replay" data-index="${index}" data-event="${r.events.length - 5 + i}"><strong>${esc(e.player)} · ${e.points ? `+${e.points}` : esc(t(`outcome.${e.plays?.[0]?.outcome || 'miss'}`))}</strong><span>${esc(explanationText(e))}${e.shotChance ? ` ${t('result.shotQuality', { n: e.shotChance })}` : ''}</span><b aria-hidden="true">▶</b></button>`,
          )
          .join('')}
        <h3>${t('result.why')}</h3>
        <p>${t('result.whyBody')}</p>
        <div class="effect-list">
          ${Object.entries(r.events.at(-1)?.impacts || {})
            .map(
              ([key, n]) =>
                `<span>${esc(has(`impact.${key}`) ? t(`impact.${key}`) : key)}: ${n >= 0 ? '+' : ''}${n.toFixed(1)} pp</span>`,
            )
            .join('')}
        </div>
        <h3>${t('game.boxScore')}</h3>
        ${
          r.line
            ? boxTable(r.line, `${up(t('game.kangs'))} ${r.home} · ${up(r.opponent)} ${r.away}`)
            : Object.entries(r.box)
                .filter(([, p]) => p > 0)
                .map(
                  ([id, points]) =>
                    html`
                      <div class="staff-row">
                        <span>${esc(state.players.find(p => p.id === +id)?.name || t('result.former'))}</span><b>${t('result.pts', { n: points })}</b>
                      </div>`,
                )
                .join('')
        }
      </details>`,
  );
}
