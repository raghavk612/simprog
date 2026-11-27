// The context rail beside Journal, Bracket, Standings and Skills (seasonModel.js railModel says what it holds): the next
// game, the last result and the top four. From 1440 px it is a 320 px column to the right of the page; below that it
// follows the page. Information and secondary links only: the purple way forward stays in the band.
import { t, formatDate, localeTag } from '../i18n/index.js';
import { state } from './store.js';
import { html, esc, oppMark, crestText, btn } from './markup.js';
import { railModel } from './seasonModel.js';

// Basketball's ".750" (and "1.000") in the reader's number format; a team yet to play has none.
export const pctText = v =>
  v == null
    ? '—'
    : v
        .toLocaleString(localeTag(), { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        .replace(/^0(?=\D)/, '');
const crest = n =>
  oppMark(n, 'rail-crest', `<span class="rail-crest ph" aria-hidden="true">${esc(crestText(n))}</span>`);
const go = (v, label) => `<button class="secondary small" data-view="${v}">${label}</button>`;
const card = (cls, title, body) =>
  html`
    <section class="card rail-card ${cls}">
      <h2>${title}</h2>
      ${body}
    </section>`;

function nextCard(n) {
  const where = t(n.home ? 'game.homeGame' : 'game.awayGame');
  return card(
    'rail-next',
    t('bracket.status.next'),
    html`
      <p class="rail-team">${crest(n.name)}<b>${esc(n.name)}</b><span class="rail-tag">${where}</span></p>
      <dl class="rail-facts">
        <div><dt>${t('rail.theirRecord')}</dt><dd>${n.record ? `${n.record.w}–${n.record.l}` : '—'}</dd></div>
        <div><dt>${t('game.style')}</dt><dd>${n.style ? t(`style.${n.style}`) : t('game.unscouted')}</dd></div>
      </dl>
      <p class="rail-when">${esc(formatDate(n.date))}${n.time ? ` · ${esc(n.time)}` : ''}</p>
      ${n.link ? go(n.link, n.link === 'practice' ? t('nudge.btn.scout') : t('rail.toGame')) : ''}`,
  );
}
function lastCard(r) {
  return card(
    'rail-last',
    t('rail.last'),
    html`
      <p class="rail-result">
        <b class="${r.won ? 'win' : 'loss'}"><span aria-hidden="true">${r.won ? 'W' : 'L'}</span><span class="sr-only">${t(r.won ? 'result.win' : 'result.loss')}</span></b><span>${esc(r.opponent)}<small>${esc(formatDate(r.date))}</small></span><strong>${r.for}–${r.against}</strong>
      </p>
      ${btn(t('journal.replay'), 'result', 'secondary small', `data-index="${r.index}"`)}`,
  );
}
function topCard(top) {
  return card(
    'rail-top',
    t('rail.top'),
    html`
      <ol class="rail-table">
        ${top.rows
          .map(
            x =>
              `<li class="${x.you ? 'you' : ''}"><span class="rt-rank">${x.rank}</span><span class="rt-name">${x.you ? t('journal.you', { team: esc(t('game.kangs')) }) : esc(x.name)}</span><span class="rt-pct"><span class="sr-only">${t('journal.col.pctFull')} </span>${pctText(x.pct)}</span></li>`,
          )
          .join('')}
      </ol>
      ${top.place ? `<p class="rail-place">${t('rail.place', top.place)}</p>` : ''}
      ${top.link ? go(top.link, t('rail.toStandings')) : ''}`,
  );
}

// The page's body with the rail beside it (or under it). `head` is the page's header, which stays full width.
export function withRail(v, head, body) {
  const m = railModel(state, v);
  if (!m) return `${head}${body}`;
  const cards = [m.next && nextCard(m.next), m.last && lastCard(m.last), m.top && topCard(m.top)].filter(
    Boolean,
  );
  return html`
    ${head}
    <div class="railed">
      <div class="railed-main">${body}</div>
      ${cards.length ? `<aside class="context-rail" aria-label="${esc(t('rail.label'))}">${cards.join('')}</aside>` : ''}
    </div>`;
}
