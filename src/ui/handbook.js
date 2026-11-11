// Help: the handbook dialog, one tab per topic. The arrow keys change tabs (keyboard.js).
import { keyLabel } from '../keys.js';
import { t, list, tu } from '../i18n/index.js';
import * as E from '../engine.js';
import { state, plan, keys, data, stages, teamName } from './store.js';
import { html, kbd, esc, micon, link, btn } from './markup.js';
import { show } from './dialogs.js';
import { modal } from './page.js';

const RULE_TABS = ['goal', 'prep', 'rotation', 'gameday', 'difficulty', 'controls', 'court', 'data'];
const RULE_BODY = ['controls', 'goal', 'difficulty', 'rotation', 'prep', 'gameday', 'court', 'data'];
export function rules(tab = 0) {
  tab = (tab + RULE_TABS.length) % RULE_TABS.length;
  const P = state ? plan() : null;
  const row = (keyHtml, text) =>
    `<div class="ctl-row"><div class="ctl-keys">${keyHtml}</div><span>${text}</span></div>`;
  const chips = list =>
    html`
      <div class="rule-chips">
        ${list.map(([a, b]) => `<div><strong>${a}</strong><span>${b}</span></div>`).join('')}
      </div>`;
  const key = name => kbd(esc(keyLabel(keys[name])));
  const levels = data?.levels || {};
  const body = [
    () =>
      html`
        <p class="rule-lead">${t('hb.c.lead')}</p>
        <div class="ctl-grid">
          ${row(micon('drag'), t('hb.c.drag'))}
          ${row(micon('scroll'), t('hb.c.scroll'))}
          ${row(kbd('SPACE') + key('nextPlay'), t('hb.c.next'))}
          ${row(key('playPause'), t('hb.c.watch'))}
          ${row(key('timeout'), t('hb.c.timeout'))}
          ${row(['camWide', 'camCourt', 'camFollow', 'camPlayer', 'camAuto'].map(key).join(''), t('hb.c.cams'))}
          ${row(key('speed'), t('settings.controls.actions.speed'))}
          ${row(key('sound'), t('settings.controls.actions.sound'))}
          ${row(key('settings'), t('settings.controls.actions.settings'))}
          ${row(key('rules'), t('hb.c.hb'))}
          ${row(kbd('ESC'), t('hb.c.esc'))}
          ${row(kbd('TAB') + kbd('ENTER'), t('hb.c.tab'))}
          ${row(micon('tap'), t('hb.c.tap'))}
        </div>
        <p class="muted">${t('hb.c.rebind')}</p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.g.lead')}</p>
        ${chips(
          P
            ? [
                [t('hb.g.ofCut', { need: P.need, cut: P.cut }), t('hb.g.early')],
                [t('hb.g.fourGames'), t('hb.g.run', { run: stages().run })],
                [String(P.n), t('hb.g.games')],
              ]
            : [
                [t('hb.g.qualify'), t('hb.g.qualifyLine')],
                [t('hb.g.fourGames'), t('hb.g.finalRun')],
                ['1', t('hb.g.champ')],
              ],
        )}
        <p>${t('hb.g.note')}</p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.d.lead')}</p>
        ${chips(Object.entries(E.DIFFICULTIES).map(([k, d]) => [esc(teamName(d.level)), `${esc(t(`tier.${k}`))} · ${t('hb.d.scheduled', { n: levels[d.level]?.games.length || 0 })}`]))}
        <p>${t('hb.d.note')}</p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.r.lead')}</p>
        ${chips([
          ['5', t('hb.r.starters')],
          ['15+', t('hb.r.energy')],
          ['2.0+', t('hb.r.gpa')],
          ['0', t('hb.r.injuries')],
        ])}
        <p>${t('hb.r.tip', { button: `<b>${t('flow.bestFive')}</b>` })}</p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.p.lead')}</p>
        ${chips([
          ['3', t('hb.p.slots')],
          ['+' + E.ECON.base, t('hb.p.tokens')],
          ['+' + E.ECON.win, t('hb.p.bonus')],
          ['15', t('hb.p.cap')],
          ['1', t('hb.p.assistant')],
        ])}
        <p>${t('hb.p.note')}</p>
        <p>${t('hb.p.costs', { upkeep: E.ECON.upkeep, travel: E.ECON.travel })}</p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.gd.lead')}</p>
        ${chips([
          ['3', t('hb.gd.timeouts')],
          [t('bug.ot'), t('hb.gd.ot')],
          ['1× 2× 4×', t('hb.gd.speed')],
        ])}
        <p>${t('hb.gd.note')}</p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.cr.lead')}</p>
        <ul class="rule-list">
          ${list('hb.cr.list')
            .map(([a, b]) => `<li><b>${a}</b> ${b}</li>`)
            .join('')}
        </ul>
        <p class="muted">
          ${t('hb.cr.note', { link: link('https://www.nfhs.org/sports/basketball/rules', t('hb.cr.link')) })}
        </p>`,
    () =>
      html`
        <p class="rule-lead">${t('hb.ds.lead')}</p>
        ${chips([
          [String(Object.values(levels).reduce((a, x) => a + x.players.length, 0)), t('hb.ds.players')],
          [String(Object.values(levels).reduce((a, x) => a + x.games.length, 0)), t('hb.ds.matchups')],
          [t('hb.ds.auto'), t('hb.ds.save')],
        ])}
        <p>${t('hb.ds.note', { export: t('top.export'), import: t('landing.import') })}</p>`,
  ][RULE_BODY.indexOf(RULE_TABS[tab])];
  const name = i => t(`hb.tabs.${RULE_TABS[i]}`);
  show(
    html`
      <span class="eyebrow">${tu('rules.kicker')}</span>
      <h1>${t('landing.howTo')}</h1>
      <div class="rule-tabs" role="tablist" aria-label="${esc(t('hb.tabsAria'))}">
        ${RULE_TABS.map((k, i) => `<button role="tab" id="rtab-${i}" aria-selected="${i === tab}" aria-controls="rpanel" tabindex="${i === tab ? 0 : -1}" class="${i === tab ? 'active' : ''}" data-action="rules" data-tab="${i}">${name(i)}</button>`).join('')}
      </div>
      <section class="rule-panel" id="rpanel" role="tabpanel" aria-labelledby="rtab-${tab}" data-rules-tab="${tab}">
        <h2>${name(tab)}</h2>
        ${body()}
      </section>
      <div class="rule-nav">
        ${btn(t('hb.prev'), 'rules', 'secondary small', `data-tab="${tab - 1}" ${tab === 0 ? 'disabled' : ''}`)}
        <div class="rule-dots" aria-hidden="true">
          ${RULE_TABS.map((_, i) => `<i class="${i === tab ? 'on' : ''}"></i>`).join('')}
        </div>
        ${btn(tab === RULE_TABS.length - 1 ? t('hb.done') : t('hb.next'), tab === RULE_TABS.length - 1 ? 'close' : 'rules', 'primary small', `data-tab="${tab + 1}"`)}
      </div>`,
  );
  modal.querySelector('.rule-tabs .active')?.focus({ preventScroll: true });
}
