import * as V from '../../events.js';
import * as E from '../../engine.js';
import { t } from '../../i18n/index.js';
import { state, save } from '../store.js';
import { esc, html, btn } from '../markup.js';
import { stage } from '../shell.js';

// Home: the gym, the one thing to do next, and a grey timeline of what follows it. The timeline is a map, not a menu, so nothing on it can be clicked.
export function home() {
  if (state.pendingEvent && V.eventStale(state)) {
    state.pendingEvent = null;
    save();
  }
  const n = E.nextStep(state),
    opp = state.finished ? '' : esc(E.opponent(state).opponent),
    key = n.break || (n.id === 'scout' ? 'practice' : n.id),
    label = n.break ? t(`flow.btn.${n.break}`) : t(`nudge.btn.${key}`),
    ahead = E.roadmap(state);
  return html`
    <div class="home-view">
      <div class="home-stage">${stage('home-arena', { controls: false })}</div>
      <section class="home-bar" aria-label="${esc(t('home.barAria'))}">
        <div class="home-next">
          <h1 tabindex="-1"><b>${t('flow.next')}</b> ${t(`flow.now.${key}`, { opp })}</h1>
          ${n.action ? btn(label, n.action, 'primary hb-go') : `<button class="primary hb-go" data-view="${n.view}">${label}</button>`}
        </div>
        ${
          ahead.length
            ? html`
              <ol class="home-path" aria-label="${esc(t('flow.later'))}">
                ${ahead.map(x => `<li>${t(`flow.step.${x.id}`, { opp: esc(x.opp ?? '') })}</li>`).join('')}
              </ol>`
            : ''
        }
      </section>
    </div>`;
}
