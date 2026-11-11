// The result dialog after a game, or when a result is opened from the journal: the score, player of the game,
// highlights to replay, and the full analysis behind "More".
import { t, tu, up, has } from '../../i18n/index.js';
import * as E from '../../engine.js';
import { reasonText, logText, explanationText } from '../../narrative.js';
import { state } from '../store.js';
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
export function result(index) {
  const r = state.results[index];
  if (!r) return;
  show(
    html`
      <span class="eyebrow">${tu('result.kicker', { outcome: r.won ? t('result.win') : t('result.loss') })}</span>
      <h1>${r.home}–${r.away}</h1>
      <h2>${t('game.vs', { opp: esc(r.opponent) })}</h2>
      <p>${esc(reasonText(r))}</p>
      ${pogCard(r)}
      ${highlightStrip(r, index)}
      <div class="modal-actions sticky">${btn(t('inbox.continue'), 'close', 'primary')}</div>
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
