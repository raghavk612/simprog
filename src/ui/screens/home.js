import * as V from '../../events.js';
import * as E from '../../engine.js';
import { t } from '../../i18n/index.js';
import { state, save } from '../store.js';
import { esc, html, btn } from '../markup.js';
import { stage } from '../shell.js';
import { noteWeek } from './results.js';

/* The one thing to do next (engine nextStep), as the screen's primary button: its label, and the action it runs or the
   page it opens. Home shows it in its bar; other pages show it when nothing on them is the way forward. */
export function nextStepButton(cls = 'primary') {
  const n = E.nextStep(state),
    key = n.break || (n.id === 'scout' ? 'practice' : n.id),
    label = n.break ? t(`flow.btn.${n.break}`) : t(`nudge.btn.${key}`);
  return {
    n,
    key,
    html: n.action
      ? btn(label, n.action, cls)
      : `<button class="${cls}" data-view="${n.view}">${label}</button>`,
  };
}
// Home: the gym, the one thing to do next, and a grey timeline of what follows it, labelled "After that" so it doesn't
// read as a progress bar with nothing done. The timeline is a map, not a menu, so nothing on it can be clicked.
export function home() {
  if (state.pendingEvent && V.eventStale(state)) {
    state.pendingEvent = null;
    save();
  }
  noteWeek(state);
  const next = nextStepButton('primary hb-go'),
    key = next.key,
    opp = state.finished ? '' : esc(E.opponent(state).opponent),
    ahead = E.roadmap(state);
  return html`
    <div class="home-view">
      <div class="home-stage">${stage('home-arena', { controls: false })}</div>
      <section class="home-bar" aria-label="${esc(t('home.barAria'))}">
        <div class="home-next">
          <h1 tabindex="-1"><b>${t('flow.next')}</b> ${t(`flow.now.${key}`, { opp })}</h1>
          ${next.html}
        </div>
        ${
          ahead.length
            ? html`
              <div class="home-later">
                <span class="eyebrow" id="home-later">${t('flow.later')}</span>
                <ol class="home-path" aria-labelledby="home-later">
                  ${ahead.map(x => `<li>${t(`flow.step.${x.id}`, { opp: esc(x.opp ?? '') })}</li>`).join('')}
                </ol>
              </div>`
            : ''
        }
      </section>
    </div>`;
}
