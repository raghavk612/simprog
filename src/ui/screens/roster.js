import { t, tu } from '../../i18n/index.js';
import * as E from '../../engine.js';
import { tv } from '../../narrative.js';
import { arc, roomLevel, sparkPoints } from '../../arcs.js';
import { play } from '../../audio.js';
import { state, estSrc, teamLabel, save } from '../store.js';
import { esc, html, capBadge, cap1, btn, pill, issueText, header, short2, f1 } from '../markup.js';
import { avatar } from '../avatar.js';
import { show } from '../dialogs.js';
import { modal } from '../page.js';
import { render } from '../shell.js';

// Team: the lineup (starters and bench as cards) or, with Full stats, one player's card over the whole roster table.
let rosterFull = false;
let rosterSel = null; // the player shown on the card in Full stats

const energyWord = e =>
  t(`rv.energy.${e >= 80 ? 'fresh' : e >= 55 ? 'rested' : e >= 30 ? 'tired' : 'exhausted'}`);
const moraleWord = m =>
  t(`rv.morale.${m >= 80 ? 'fired' : m >= 60 ? 'content' : m >= 40 ? 'restless' : 'unhappy'}`);
const playerStatus = p =>
  p.injury
    ? t('status.injured')
    : p.gpa < 2
      ? t('status.ineligible')
      : p.starter
        ? t('status.starter')
        : p.minutes
          ? t('status.rotation')
          : t('status.bench');
const ineligibleWhy = p =>
  p.injury ? t('status.injured') : p.gpa < 2 ? t('status.ineligible') : t('status.exhausted');
function rosterCard(p) {
  const r = E.ratings(p),
    b = E.bio(p),
    line = E.statLine(state, p),
    idx = state.players.indexOf(p),
    n = state.players.length;
  const ring = `conic-gradient(var(--score) ${r.ovr * 3.6}deg,var(--panel-3) 0)`;
  const stars = k =>
    `<span class="stars" role="img" aria-label="${esc(t('rv.stars', { k }))}">${[1, 2, 3].map(i => `<i class="${i <= k ? 'on' : ''}" aria-hidden="true">★</i>`).join('')}</span>`;
  const words = p.name.split(' '),
    first = words.slice(0, -1).join(' '),
    last = words.slice(-1)[0];
  return html`
    <section class="rv-hero" aria-live="polite">
      <button class="rv-arrow prev" data-action="rv-cycle" data-step="-1" aria-label="${esc(t('rv.prev'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button> <div class="rv-portrait">
        <span class="rv-num" aria-hidden="true">${esc(p.number)}</span>${avatar(p, 220)}<span class="rv-count">${idx + 1} / ${n}</span>
      </div> <div class="rv-main">
        <div class="rv-name">
          <span>${esc(first)}</span> <b>${esc(last)}</b><em>| ${esc(p.number)}</em>${capBadge(p.id)}
        </div> <div class="rv-row">
          <div class="rv-ovr">
            <span class="rv-tag">${tu('rv.overall')}</span>
            <div class="ovr-ring" style="background:${ring}"><b>${r.ovr}</b></div>
          </div> <div class="rv-arch">
            <span class="rv-tag">${esc(cap1(tv(r.archetype)))}</span>${r.attrs.map(a => `<div>${stars(a.stars)}<span>${esc(cap1(tv(a.name)))}</span></div>`).join('')}
          </div> <div class="rv-info">
            ${[
              [tu('rv.position'), cap1(tv(b.position)) + (b.assigned ? '*' : '')],
              [tu('rv.height'), b.height + (b.assigned ? '*' : '')],
              [tu('roster.energy'), cap1(energyWord(p.energy))],
              [tu('roster.morale'), cap1(moraleWord(p.morale))],
              [tu('rv.class'), cap1(tv(p.year))],
              [tu('roster.status'), cap1(playerStatus(p))],
            ]
              .map(([a, v]) => `<div><span class="rv-tag">${a}</span><strong>${esc(v)}</strong></div>`)
              .join('')}
          </div>
        </div> <div class="rv-stats">
          ${['ppg', 'rpg', 'apg', 'spg', 'bpg', 'fgp']
            .map(
              k => html`
                <div>
                  <strong>${line[k] == null ? '0.0' : line[k].toFixed(1)}</strong><span>${t(`stat.${k}`)}</span>
                </div>`,
            )
            .join('')}
          ${arcBlock(p)}<small>${line.est ? t('rv.estLine', { src: estSrc() }) : t(line.gp === 1 ? 'rv.seasonOne' : 'rv.seasonN', { n: line.gp })}</small>
        </div>
      </div> <div class="rv-side">
        ${btn(t('rv.fullProfile'), 'player', 'secondary small', `data-id="${p.id}"`)}
        ${btn(state.captain === p.id ? t('captain.is') : t('captain.name'), 'captain-set', 'secondary small', `data-id="${p.id}" aria-pressed="${state.captain === p.id}" ${state.captain === p.id || state.match ? 'disabled' : ''}`)}
        <label class="rv-start">
          <input type="checkbox" data-starter="${p.id}" ${p.starter ? 'checked' : ''} ${state.match ? 'disabled' : ''}> ${t('status.starter')}
        </label>
      </div> <button class="rv-arrow next" data-action="rv-cycle" data-step="1" aria-label="${esc(t('rv.next'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
    </section>`;
}
// One player in the lineup view: who they are, whether they can play, and whether they start.
function squadCard(p) {
  const r = E.ratings(p),
    b = E.bio(p),
    ok = E.eligible(p);
  return html`
    <article class="sq-card ${ok ? '' : 'out'}">
      <button class="sq-face" data-action="player" data-id="${p.id}" aria-label="${esc(t('rv.fullProfile'))}: ${esc(p.name)}">${avatar(p, p.starter ? 72 : 48)}</button>
      <div class="sq-id">
        <strong>${esc(p.name)}${capBadge(p.id)}</strong><small>#${esc(p.number)}, ${esc(tv(b.position))}${ok ? '' : `, <span class="warn-text">${esc(ineligibleWhy(p))}</span>`}</small>
      </div>
      <b class="sq-ovr" title="${esc(t('rv.overall'))}">${r.ovr}</b>
      <div class="sq-energy">
        <span class="bar" aria-hidden="true"><i style="width:${p.energy}%"></i></span>${t('roster.energy')} ${Math.round(p.energy)}
      </div>
      <div class="sq-set">
        <label class="sq-start">
          <input type="checkbox" data-starter="${p.id}" ${p.starter ? 'checked' : ''} aria-label="${esc(t('roster.startAria', { name: p.name }))}" ${state.match ? 'disabled' : ''}> ${t('roster.start')}
        </label>
      </div>
    </article>`;
}
export function roster() {
  const cap = state.players.find(p => p.id === state.captain);
  const tools = html`
    <div class="toolbar">
      <span>${pill(t('roster.spots', { n: state.players.length }))} ${pill(cap ? t('flow.captain', { name: esc(cap.name) }) : t('flow.noCaptain'))}</span><span class="toolbar-go">${btn(t(rosterFull ? 'roster.lineup' : 'roster.fullStats'), 'roster-full', 'secondary')}${btn(t('flow.bestFive'), 'auto-lineup', 'primary')}</span>
    </div>
    ${(bad => (bad.length ? `<p class="notice" role="status">${issueText(bad, true)}</p>` : ''))(E.lineupIssues(state))}`;
  if (!rosterFull)
    return html`
      ${header(tu('roster.kicker'), t('nav.roster'), t('hb.r.lead'))}
      ${tools}
      <h2 class="squad-head">${t('box.starters')}</h2>
      <div class="squad starters">
        ${state.players
          .filter(p => p.starter)
          .map(squadCard)
          .join('')}
      </div>
      <h2 class="squad-head">${t('box.bench')}</h2>
      <div class="squad bench">
        ${state.players
          .filter(p => !p.starter)
          .map(squadCard)
          .join('')}
      </div>`;
  if (!state.players.some(p => p.id === rosterSel))
    rosterSel = (state.players.find(p => p.starter) || state.players[0])?.id;
  const sel = state.players.find(p => p.id === rosterSel);
  const est = E.estimateLines(state);
  const assigned = state.players.some(p => E.bio(p).assigned);
  const cell = v => `<td class="grade g-${E.grade(v)[0]}">${E.grade(v)}</td>`;
  return html`
    ${header(tu('roster.kicker'), t('nav.roster'), t('rv.intro'))} ${tools} ${sel ? rosterCard(sel) : ''} <div class="table-wrap rv-table">
      <div class="rv-team">
        <span>${tu('rv.team', { team: esc(teamLabel()) })}</span><span>${tu('rv.record', { w: state.wins, l: state.losses, c: Math.round(state.chemistry) })}</span>
      </div>
      <table aria-label="${esc(t('nav.roster'))}"> <thead>
          <tr>
            <th scope="col">${t('roster.start')}</th><th scope="col">${t('rv.name')}</th><th scope="col">${t('rv.pos')}</th><th scope="col">${t('rv.yr')}</th><th scope="col" class="ovr-col">${t('rv.ovr')}</th>${['ins', 'mid', 'tpt', 'perd', 'insd'].map(k => `<th scope="col" title="${esc(t(`rv.${k}T`))}">${t(`rv.${k}`)}</th>`).join('')}<th scope="col">${t('roster.energy')}</th>${['gp', 'ppg', 'rpg', 'apg', 'spg', 'bpg'].map(k => `<th scope="col" title="${esc(t(`stat.${k}Title`))}">${t(`stat.${k}`)}</th>`).join('')}
          </tr>
        </thead>
        <tbody> ${state.players
          .map(p => {
            const r = E.ratings(p),
              b = E.bio(p),
              g = p.games ? E.perGame(p) : est[p.id];
            return html`
              <tr class="${p.id === rosterSel ? 'selected' : ''} ${E.eligible(p) ? '' : 'out'}" data-select="${p.id}">
                <td><input type="checkbox" data-starter="${p.id}" ${p.starter ? 'checked' : ''} aria-label="${esc(t('roster.startAria', { name: p.name }))}" ${state.match ? 'disabled' : ''}></td><td><button class="player-cell" data-action="rv-select" data-id="${p.id}" ${p.id === rosterSel ? 'aria-current="true"' : ''}>${avatar(p, 34)}<div><strong>${esc(p.name)}${capBadge(p.id)}</strong><small>#${esc(p.number)}${E.eligible(p) ? '' : ` · <span class="warn-text">${esc(ineligibleWhy(p))}</span>`}</small></div></button></td><td>${esc(t(`rv.short.${b.position}`))}${b.assigned ? '*' : ''}</td><td>${esc(short2(tv(p.year)))}</td><td class="ovr-col"><b>${r.ovr}</b></td>${cell(r.ins)}
                ${cell(r.mid)}
                ${cell(r.tpt)}
                ${cell(r.perd)}
                ${cell(r.insd)}<td><span class="bar" aria-hidden="true"><i style="width:${p.energy}%"></i></span>${Math.round(p.energy)}</td><td>${g.gp}</td><td class="${g.est ? 'est' : ''}"><b>${g.ppg.toFixed(1)}</b></td><td class="${g.est ? 'est' : ''}">${g.rpg.toFixed(1)}</td><td class="${g.est ? 'est' : ''}">${g.apg.toFixed(1)}</td><td class="${g.est ? 'est' : ''}">${g.spg.toFixed(1)}</td><td class="${g.est ? 'est' : ''}">${g.bpg.toFixed(1)}</td>
              </tr>`;
          })
          .join('')}
        </tbody>
      </table>
    </div> <p class="footnote">
      ${t('rv.footnote', { italic: `<span class="est-key">${t('rv.italic')}</span>`, src: estSrc() })}
      ${assigned ? ` ${t('rv.assignedNote')}` : ''}
    </p>
    <p class="footnote">${t('captain.note')}</p>`;
}
// A player's development arc: skill sparkline with a text alternative, ceiling hint, and a Breakout or Slump tag (thresholds in arcs.js).
function arcBlock(p) {
  const a = arc(p),
    lvl = roomLevel(E.growthRoom(p.skill, p.ceil)),
    rf = Math.round(a.from),
    rt = Math.round(a.to);
  const alt = a.show
      ? t(rt > rf ? 'arc.rose' : rt < rf ? 'arc.fell' : 'arc.flat', { from: rf, to: rt, n: a.games })
      : '',
    pts = a.show ? sparkPoints(a.series) : '',
    end = pts.split(' ').at(-1).split(',');
  const stars = p.work
    ? `<span role="img" aria-label="${esc(t('scoutP.workAria', { k: p.work }))}">${[1, 2, 3, 4, 5].map(i => (i <= p.work ? '★' : '☆')).join('')}</span>`
    : '';
  return html`
    <aside class="arc" aria-label="${esc(t('arc.title'))}">
      <div class="arc-top">
        <span class="rv-tag">${tu('arc.title')}</span>${a.tag ? `<b class="arc-tag ${a.tag}">${t(`arc.${a.tag}`)}</b>` : ''}
      </div>
      ${
        a.show
          ? html`
            <svg class="spark" viewBox="0 0 120 32" role="img" aria-label="${esc(alt)}" focusable="false">
              <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${end[0]}" cy="${end[1]}" r="3" fill="currentColor"/>
            </svg>
            <small>${alt}</small>`
          : `<small>${t('arc.none')}</small>`
      }
      ${a.tag ? `<small>${t(`arc.${a.tag}Note`)}</small>` : ''}<small>${p.ceil ? `${t('arc.potential', { n: p.ceil })} · ` : ''}${t('arc.room', { level: t(`arc.level.${lvl}`) })}${stars ? ` · ${t('scoutP.work')} ${stars}` : ''}</small>
    </aside>`;
}
export function profile(id) {
  const p = state.players.find(p => p.id === +id);
  if (!p) return;
  const b = E.bio(p),
    r = E.ratings(p),
    g = E.statLine(state, p);
  show(
    html`
      <div class="profile-head">
        ${avatar(p, 96)}
        <div>
          <span class="eyebrow">${tu('profile.kicker', { n: esc(p.number) })}</span>
          <h1>${esc(p.name)}${capBadge(p.id)}</h1>
          <p>
            ${esc(tv(b.position))} · ${esc(b.height)}${b.assigned ? ` (${t('profile.est')})` : ''} · ${esc(tv(p.year))} · ${r.ovr} ${t('rv.ovr')} · ${esc(tv(r.archetype))}
          </p>
        </div>
      </div>
      <div class="profile-stats">
        ${[
          [t('roster.skill'), Math.round(p.skill)],
          [t('roster.energy'), Math.round(p.energy)],
          [t('roster.morale'), Math.round(p.morale)],
          [t('roster.gpa'), p.gpa.toFixed(2)],
          [g.est ? `${t('stat.ppg')} (${t('profile.est')})` : t('stat.ppg'), f1(g.ppg)],
          [t('stat.rpg'), f1(g.rpg)],
          [t('stat.apg'), f1(g.apg)],
          [t('stat.spg'), f1(g.spg)],
          [t('stat.bpg'), f1(g.bpg)],
          [t('stat.fgp'), f1(g.fgp)],
          [t('profile.risk'), p.energy < 45 ? t('profile.riskHigh') : t('profile.riskLow')],
        ]
          .map(([a, b]) => `<div><strong>${b}</strong><span>${a}</span></div>`)
          .join('')}
      </div>
      <p>${p.injury ? t('profile.injured', { n: p.injury }) : t('profile.healthy')}</p>
      ${arcBlock(p)}
      <form id="rename-form" data-id="${p.id}">
        <label for="rename">${t('profile.rename')}</label>
        <input id="rename" name="name" maxlength="36" value="${esc(p.name)}" required><button class="primary" ${state.match ? 'disabled' : ''}>${t('profile.save')}</button>
      </form>
      <small>${p.custom ? t('profile.custom') : t('profile.sourceName', { name: esc(p.originalName) })} ${t('profile.renameNote')}</small>
      <div class="modal-actions">
        ${state.captain === p.id ? '' : btn(t('flow.makeCaptain'), 'lk-captain', 'secondary', `data-id="${p.id}" ${state.match ? 'disabled' : ''}`)}
        ${btn(t('profile.release'), 'release', 'danger-button', `data-id="${p.id}" ${state.match ? 'disabled' : ''}`)}
      </div>`,
  );
}
export function toggleFullRoster() {
  rosterFull = !rosterFull;
  render();
}
export function selectPlayer(id) {
  rosterSel = id;
  render();
}
export function cycleRoster(step) {
  const list = state?.players || [];
  if (!list.length) return;
  const i = Math.max(
    0,
    list.findIndex(p => p.id === rosterSel),
  );
  rosterSel = list[(i + step + list.length) % list.length].id;
  play('select');
  render();
  document.querySelector(`.rv-arrow.${step > 0 ? 'next' : 'prev'}`)?.focus({ preventScroll: true });
}
// Full stats: the left and right arrow keys step through the players.
export function onRosterKey(e) {
  if (
    document.body.dataset.view !== 'roster' ||
    !rosterFull ||
    modal.open ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.target.closest?.('input,select,textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    cycleRoster(e.key === 'ArrowRight' ? 1 : -1);
  }
}
// Full stats: clicking anywhere on a table row (other than its controls) shows that player.
export function onRosterRowClick(e) {
  const tr = e.target.closest?.('tr[data-select]');
  if (!tr || e.target.closest('input,button,a,select')) return;
  rosterSel = +tr.dataset.select;
  play('select');
  render();
}
// The rename form in a player's profile.
export function renamePlayer(form) {
  const name = new FormData(form).get('name').trim();
  if (!name) return;
  state.players.find(p => p.id === +form.dataset.id).name = name.slice(0, 36);
  save();
  modal.close();
  render();
  play('confirm');
}
