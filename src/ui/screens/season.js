// The Season tab: the journal (results and the decision trail), the final-run bracket, standings with leaders and
// achievements, and the real team data. A finished season adds the report card.
import * as E from '../../engine.js';
import { tu, t, formatDate, formatNumber, formatDateTime } from '../../i18n/index.js';
import { logText, tv } from '../../narrative.js';
import { achievements } from '../../achievements.js';
import { state, teamLabel, estSrc, stages, plan, data, lvl, hasScore, teamName, setData } from '../store.js';
import { html, esc, btn, oppBadge, header, LOGO_WHITE, pill } from '../markup.js';
import { notify } from '../toast.js';
import { $ } from '../page.js';
import { stage, render } from '../shell.js';
import { clearPreviews } from './landing.js';

let dataLevel = null; // the level shown on the data page; defaults to the one being coached

// ESPN-style season leaders: category, player, per-game value.
function leadersCard() {
  const L = E.leaders(state);
  return html`
    <section class="card leaders-card">
      <span class="eyebrow">${tu('leaders.title', { team: esc(teamLabel()) })}</span>
      <ul class="leaders">
        ${['ppg', 'apg', 'rpg', 'bpg', 'spg']
          .map(k => {
            const l = L[k];
            return html`
              <li>
                <b>${t(`leaders.${k}`)}:</b> ${l ? t('leaders.value', { name: `<button class="leader-link" data-action="player" data-id="${l.id}">${esc(l.name)}</button>`, value: l.value.toFixed(1) }) : `<span class="muted">${t('leaders.none')}</span>`}
              </li>`;
          })
          .join('')}
      </ul>
      <small class="muted"> ${L.est ? t('leaders.est', { src: estSrc() }) : t('leaders.note')}</small> </section>`;
}

// Season code card in the journal, and copying it.
function codeCard() {
  const c = E.seasonCode(state);
  return html`
    <section class="card season-code">
      <span class="eyebrow">${tu('code.kicker')}</span>${
        c
          ? html`
            <p>${t('code.body')}</p>
            <div class="code-row">
              <code class="code-box" id="season-code">${esc(c)}</code>${btn(t('code.copy'), 'copy-code', 'secondary small', `data-code="${esc(c)}"`)}
            </div>`
          : `<p class="muted">${t('code.unavailable')}</p>`
      }
    </section>`;
}
export async function copyCode(c) {
  try {
    await navigator.clipboard.writeText(c);
    notify(t('code.copied', { code: c }), { type: 'success' });
  } catch {
    const el = $('#season-code');
    if (el) {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    notify(t('code.failed'), { type: 'info' });
  }
}
// The final run drawn as a bracket: four win-or-go-home rounds that fill in as games are played.
function bracket() {
  const B = E.runBracket(state),
    names = stages();
  const gate =
    B.gate === 'qualified'
      ? t('bracket.qualified', { w: B.wins, need: B.need })
      : B.gate === 'failed'
        ? t('bracket.failed', { w: B.wins, cut: B.cut, need: B.need })
        : t('bracket.open', { w: B.wins, need: B.need, cut: B.cut, played: B.played });
  return html`
    <section class="card bracket-card" aria-labelledby="bracket-h">
      <span class="eyebrow">${tu('bracket.kicker')}</span>
      <h2 id="bracket-h">${t('hb.g.run', { run: names.run })}</h2>
      <p class="bracket-gate ${B.gate}">${gate}</p>
      <ol class="bracket" aria-label="${esc(t('bracket.aria'))}">
        ${B.rounds
          .map((r, i) => {
            const status = t(`bracket.status.${r.status}`, { h: r.home, a: r.away });
            return html`
              <li class="round ${r.status}" aria-label="${esc(t('bracket.item', { r: i + 1, opp: r.opponent, status }))}">
                <span class="round-name">${t(`bracket.round.${i}`)}</span><b>${oppBadge(r.opponent)}${esc(r.opponent)}</b><small>${esc(formatDate(r.date))}${r.time ? ` · ${esc(r.time)}` : ''}</small><em>${status}</em>
              </li>`;
          })
          .join('')}
      </ol>
    </section>`;
}
export function journal() {
  return html`
    ${header(tu('journal.kicker'), t('nav.season'), t('journal.intro'))}
    ${
      state.finished
        ? html`
          <section class="card purple">
            <span class="eyebrow">${state.champion ? tu('journal.bannerYours') : tu('journal.teaches')}</span>
            <h2>${state.champion ? t('home.champions') : t('journal.whistle')}</h2>
            <p>
              ${t('journal.summary', { coach: esc(state.coach), w: state.wins, l: state.losses, fans: formatNumber(state.fans), chem: Math.round(state.chemistry) })}
            </p>
            ${btn(t('journal.newSeason'), 'new-season', 'secondary')}
            ${btn(t('journal.export'), 'export', 'secondary')}
          </section>
          ${reportCard()}`
        : ''
    }
    <div class="cards two fit-row">
      <section class="card fit-col">
        <h2>${t('journal.scoreboard')}</h2>
        <div class="fit-scroll" tabindex="0">
          ${state.results.map((r, i) => `<button class="result-row" data-action="result" data-index="${i}"><b class="${r.won ? 'win' : 'loss'}">${r.won ? 'W' : 'L'}<span class="sr-only"> ${r.won ? t('result.win') : t('result.loss')}</span></b><span>${esc(r.opponent)}<small>${esc(formatDate(r.date))}</small></span><strong>${r.home}–${r.away}</strong><span>${t('journal.replay')}</span></button>`).join('') || `<p>${t('journal.noGames')}</p>`}
        </div>
      </section>
      <section class="card fit-col">
        <h2>${t('journal.trail')}</h2>
        <div class="journal-log fit-scroll" tabindex="0">
          ${state.log.map(l => `<p><small>${tu('journal.gameN', { n: l.week })}</small>${esc(logText(l))}</p>`).join('') || `<p>${t('journal.trailEmpty')}</p>`}
        </div>
      </section>
    </div>`;
}
export function bracketView() {
  return html`
    ${header(tu('bracket.kicker'), t('nav.bracket'))}
    <div class="season-path" aria-label="${esc(t('journal.path'))}">
      ${(P => [
        ['01', t('journal.regular'), state.week < P.stretch],
        ['02', stages().stretch, state.week >= P.stretch && state.week < P.cut],
        ['03', stages().run, state.week >= P.cut],
      ])(plan())
        .map(
          ([n, l, cur], i) =>
            `${i ? '<i aria-hidden="true">→</i>' : ''}<span class="${cur ? 'current' : ''}"${cur ? ' aria-current="step"' : ''}>${n} / ${l}</span>`,
        )
        .join('')}
    </div>
    ${bracket()}
    ${codeCard()}`;
}
export function standingsView() {
  const teams = {};
  for (const r of state.results) {
    teams[r.opponent] ??= { name: r.opponent, w: 0, l: 0 };
    r.won ? teams[r.opponent].l++ : teams[r.opponent].w++;
  }
  const ranks = Object.values(
    state.standings || {
      'Lake Washington': { name: 'Lake Washington', w: state.wins, l: state.losses },
      ...teams,
    },
  ).sort((a, b) => b.w / Math.max(1, b.w + b.l) - a.w / Math.max(1, a.w + a.l));
  return html`
    ${header(tu('journal.standings'), t('nav.standings'))}
    <div class="standings-grid">
      <section class="card fit-col">
        <h2>${t('journal.table')}</h2>
        <p>${t('journal.tableNote')}</p>
        <div class="fit-scroll" tabindex="0">
          ${ranks.map((r, i) => `<div class="staff-row"><span>${i + 1}. ${esc(r.name)}</span><b>${r.w}–${r.l}</b></div>`).join('')}
        </div>
      </section>
      ${leadersCard()}
      ${achCard()}
    </div>`;
}
// Achievements: earned ones are marked and highlighted, locked ones dimmed and labelled in words, with progress where it makes sense.
function achCard() {
  const list = achievements(state),
    got = list.filter(a => a.earned).length;
  return html`
    <section class="card ach" aria-labelledby="ach-h">
      <span class="eyebrow">${tu('ach.kicker')}</span>
      <h2 id="ach-h">${t('ach.title')}</h2>
      <p class="muted">${t('ach.count', { n: got, of: list.length })}</p>
      <ul class="ach-list">
        ${list
          .map(
            a => html`
              <li class="${a.earned ? 'earned' : 'locked'}">
                <span class="ach-mark" aria-hidden="true">${a.earned ? '★' : '○'}</span>
                <div>
                  <strong>${t(`ach.items.${a.id}.name`)}</strong><small>${t(`ach.items.${a.id}.desc`)}</small>${!a.earned && a.progress ? `<small class="ach-prog">${t('ach.progress', a.progress)}</small>` : ''}
                </div>
                <b class="ach-state">${t(a.earned ? 'ach.earned' : 'ach.locked')}</b>
              </li>`,
          )
          .join('')}
      </ul>
    </section>`;
}
// The season report card, with the working behind the grade shown so it can be questioned.
function reportCard() {
  const R = E.seasonReport(state),
    G = R.grade,
    who = id => esc(state.players.find(p => p.id === id)?.name || '—');
  const facts = [
    t('report.record', { w: R.record[0], l: R.record[1] }),
    t('report.scoring', { f: R.ppg, a: R.oppg }),
    R.bestWin && t('report.bestWin', { opp: esc(R.bestWin.opponent), h: R.bestWin.home, a: R.bestWin.away }),
    R.toughestLoss &&
      t('report.worstLoss', {
        opp: esc(R.toughestLoss.opponent),
        h: R.toughestLoss.home,
        a: R.toughestLoss.away,
      }),
    t('report.practice', { n: R.sessions, p: R.perfect }),
    R.eliminated && t('report.eliminated', { n: R.games }),
  ].filter(Boolean);
  return html`
    <section class="card report" aria-labelledby="report-h">
      <span class="eyebrow">${tu('report.kicker')}</span>
      <h2 id="report-h">${t('report.title')}</h2>
      <div class="report-grid">
        <div class="report-grade">
          <small>${t('report.grade')}</small><strong>${esc(G.letter)}</strong><span>${G.total} / 100</span>
        </div>
        <ul class="report-parts">
          ${Object.entries(G.parts)
            .map(
              ([k, v]) =>
                html`
                  <li>
                    <span>${t(`report.parts.${k}`)}</span><b>${t('report.points', { pts: v, max: E.GRADE_POINTS[k] })}</b>
                  </li>`,
            )
            .join('')}
        </ul>
      </div>
      <p class="muted">${t('report.how')}</p>
      <h3>${t('report.awards')}</h3>
      <ul class="report-awards">
        ${
          R.awards.length
            ? R.awards
                .map(
                  a => html`
                    <li>
                      <span>${t(`report.award.${a.key}`)}</span><strong>${who(a.id)}</strong><small>${t(`report.value.${a.key}`, { v: a.value })}</small>
                    </li>`,
                )
                .join('')
            : `<li class="muted">${t('report.noAwards')}</li>`
        }
      </ul>
      <ul class="report-facts">${facts.map(x => `<li>${x}</li>`).join('')}</ul>
      ${btn(t('report.save'), 'report-save', 'secondary')}
    </section>`;
}
export async function saveReportCard() {
  try {
    const R = E.seasonReport(state),
      G = R.grade,
      font = getComputedStyle(document.body).fontFamily,
      cv = document.createElement('canvas');
    cv.width = 1200;
    cv.height = 630;
    const x = cv.getContext('2d');
    x.fillStyle = '#17181c';
    x.fillRect(0, 0, 1200, 630);
    try {
      await document.fonts.ready;
    } catch {}
    await new Promise(done => {
      const im = new Image();
      im.onload = () => {
        x.drawImage(im, 48, 36, 116, 87);
        done();
      };
      im.onerror = done;
      im.src = LOGO_WHITE;
    });
    const write = (text, px, y, color, weight = 700, left = 190, max = 960) => {
      let size = px;
      x.fillStyle = color;
      do {
        x.font = `${weight} ${size}px ${font}`;
        size -= 2;
      } while (x.measureText(text).width > max && size > 14);
      x.fillText(text, left, y);
    };
    write(t('report.kicker'), 26, 66, '#f2b233');
    write(t('meta.title'), 48, 118, '#ffffff', 800);
    write(
      `${t('side.coach', { name: state.coach })} · ${teamLabel()} · ${data?.season ?? ''}`,
      26,
      166,
      '#b9bcc4',
    );
    x.fillStyle = '#292b31';
    x.fillRect(48, 210, 300, 330);
    write(t('report.grade'), 24, 254, '#f2b233', 700, 72, 240);
    write(G.letter, 150, 400, '#ffffff', 900, 72, 240);
    write(`${G.total} / 100`, 34, 452, '#b9bcc4', 700, 72, 240);
    const lines = [
      t('report.record', { w: R.record[0], l: R.record[1] }),
      t('report.scoring', { f: R.ppg, a: R.oppg }),
      ...(R.bestWin
        ? [t('report.bestWin', { opp: R.bestWin.opponent, h: R.bestWin.home, a: R.bestWin.away })]
        : []),
      ...(R.toughestLoss
        ? [
            t('report.worstLoss', {
              opp: R.toughestLoss.opponent,
              h: R.toughestLoss.home,
              a: R.toughestLoss.away,
            }),
          ]
        : []),
    ];
    lines.forEach((l, i) => write(l, 28, 246 + i * 40, '#ffffff', 600, 390, 760));
    const top = 246 + lines.length * 40 + 24;
    write(t('report.awards'), 22, top, '#f2b233', 700, 390, 760);
    R.awards.forEach((a, i) =>
      write(
        `${t(`report.award.${a.key}`)}: ${state.players.find(p => p.id === a.id)?.name || ''} · ${t(`report.value.${a.key}`, { v: a.value })}`,
        26,
        top + 38 + i * 38,
        '#ffffff',
        600,
        390,
        760,
      ),
    );
    write(t('side.footerNote'), 18, 596, '#ffffff99', 500, 48, 1100);
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'kangs-report-card.png';
    document.body.append(a);
    a.click();
    a.remove();
    notify(t('report.saved'), { type: 'success' });
  } catch {
    notify(t('report.failed'), { type: 'error' });
  }
}
// Game day once the season is over.
export function endscreen() {
  return html`
    ${header(tu('ending.kicker'), state.champion ? t('ending.won') : t('ending.over'))} ${stage()}
    <section class="card ending">
      <h2>${state.champion ? t('ending.bannerTitle') : t('ending.lossTitle')}</h2>
      <p>
        ${t('ending.record', { w: state.wins, l: state.losses })} ${state.champion ? t('ending.championBody') : t('ending.lossBody')}
      </p>
      ${btn(t('ending.story'), 'journal', 'primary')}
      ${btn(t('journal.newSeason'), 'new-season', 'secondary')}
    </section>
    ${reportCard()}`;
}
export function dataView() {
  const levels = Object.entries(data.levels),
    pick = dataLevel && data.levels[dataLevel] ? dataLevel : lvl(),
    rec = lv => {
      const done = lv.games.filter(hasScore),
        left = lv.games.length - done.length;
      return done.length
        ? `${done.filter(g => g.points > g.against).length}–${done.filter(g => g.points < g.against).length}${left ? ` · ${t('data.upcomingN', { n: left })}` : ''}`
        : t('data.upcomingGames', { n: left });
    };
  return html`
    ${header(tu('data.kicker'), t('data.title'), t('data.intro', { season: esc(data.season) }))}
    <section class="card source-summary">
      <div>
        ${pill(tu('data.badge'), 'good')}
        <h2>${t('data.school')}</h2>
        <p>${t('data.checked', { date: formatDateTime(data.checkedAt) })}</p>
        <p>${t('data.notice')}</p>
      </div>
      ${btn(t('data.refresh'), 'refresh', 'secondary')}
    </section>
    <div class="level-tabs" role="group" aria-label="${esc(t('data.title'))}">
      ${levels.map(([k]) => btn(esc(teamName(k)), 'data-level', 'secondary small', `data-key="${k}" aria-pressed="${k === pick}"`)).join('')}
    </div>
    ${levels
      .filter(([key]) => key === pick)
      .map(
        ([key, lv]) =>
          html`
            <h2 class="section-title">${esc(teamName(key))} · ${rec(lv)}</h2>
            <div class="data-cols">
              <div>
                <div class="table-wrap">
                  <table aria-label="${esc(teamName(key))}">
                    <thead>
                      <tr>
                        <th scope="col">#</th><th scope="col">${t('data.player')}</th><th scope="col">${t('data.position')}</th><th scope="col">${t('data.height')}</th><th scope="col">${t('data.grade')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lv.players
                        .map(
                          p => html`
                            <tr>
                              <td>${p.number}${p.numberAssigned ? `<span class="muted" title="${esc(t('data.assignedTitle'))}">*</span>` : ''}</td><td>${esc(p.name)}</td><td>${esc(tv(p.position))}</td><td>${esc(p.height)}</td><td>${esc(tv(p.year))}</td>
                            </tr>`,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
                <p class="footnote">
                  ${t('data.rosterNote', { season: esc(lv.rosterSeason || data.season) })}
                  ${lv.players.some(p => p.numberAssigned) ? ` ${t('data.assignedNote')}` : ''}
                </p>
              </div>
              <div>
                <details class="schedule-drawer" open>
                  <summary>
                    ${t('data.scheduleSummary', { team: esc(teamName(key)), season: esc(data.season), n: lv.games.length })}
                  </summary>
                  <div class="table-wrap">
                    <table aria-label="${esc(t('data.scheduleSummary', { team: teamName(key), season: data.season, n: lv.games.length }))}">
                      <thead>
                        <tr>
                          <th scope="col">${t('data.date')}</th><th scope="col">${t('data.time')}</th><th scope="col">${t('data.opponent')}</th><th scope="col">${t('data.type')}</th><th scope="col">${t('data.score')}</th><th scope="col">${t('data.venue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${lv.games
                          .map(
                            g => html`
                              <tr>
                                <td>${esc(formatDate(g.date))}</td><td>${esc(g.time || '')}</td><td>${t(g.home ? 'data.vs' : 'data.at')} ${esc(g.opponent)}</td><td>${esc(tv(g.type))}</td>${hasScore(g) ? `<td class="${g.points > g.against ? 'good-text' : 'warn-text'}"><span aria-hidden="true">${g.points > g.against ? 'W' : 'L'}</span><span class="sr-only">${g.points > g.against ? t('result.win') : t('result.loss')}</span> ${g.points}–${g.against}</td>` : `<td class="muted">${t('data.upcoming')}</td>`}<td>${esc(g.venue)}</td>
                              </tr>`,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                </details>
                ${(o => html`
                  <details class="schedule-drawer">
                    <summary>
                      ${t('data.oppSummary', { team: esc(teamName(key)), real: o.filter(([, v]) => v.real).length, fiction: o.filter(([, v]) => !v.real).length })}
                    </summary>
                    ${o
                      .map(
                        ([n, v]) => html`
                          <p class="opp-roster">
                            <b>${oppBadge(n)}${esc(n)}</b> <span class="muted">${t(v.real ? 'data.oppReal' : 'data.oppFictional')}</span><br>${v.players.map(x => `#${x.number} ${esc(x.name)}`).join(' · ')}
                          </p>`,
                      )
                      .join('')}
                  </details>`)(Object.entries(lv.opponents || {}))}
                <p class="footnote">
                  <a href="${esc(lv.source)}" target="_blank" rel="noreferrer">${t('data.openPage', { team: esc(teamName(key)) })}<span class="sr-only"> (${t('a11y.newTab')})</span></a>
                </p>
              </div>
            </div>`,
      )
      .join('')}`;
}
export function pickDataLevel(key) {
  dataLevel = key;
  render();
}
// "Check for updates": loads the published data again, bypassing the cache.
export async function refresh() {
  try {
    const next = await fetch(`${import.meta.env.BASE_URL}data/kangs.json?t=${Date.now()}`, {
      cache: 'no-store',
    }).then(r => {
      if (!r.ok) throw Error();
      return r.json();
    });
    if (!next.levels?.varsity?.players?.length) throw Error();
    setData(next);
    clearPreviews();
    render();
    notify(t('notify.checked', { date: formatDateTime(data.checkedAt) }), {
      type: 'success',
      title: t('toast.dataChecked'),
    });
  } catch {
    notify(t('notify.snapshotFailed'), { type: 'error', title: t('toast.snapshotTitle') });
  }
}
