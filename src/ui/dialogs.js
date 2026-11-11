// The dialog (show), the yes/no confirm, Settings, the sound toggle and the credits.
import { t, tu } from '../i18n/index.js';
import { stopCrowd, play } from '../audio.js';
import { stopSpeech } from '../speech.js';
import { createSettingsDialog } from '../settingsDialog.js';
import { getSound, setSound } from '../settings.js';
import { announce } from '../a11y.js';
import { html, esc, btn, link } from './markup.js';
import { arena, modal } from './page.js';
import { notify } from './toast.js';
import { data, setKeys } from './store.js';
import { render } from './shell.js';

// Styled in-page replacement for confirm(): resolves true only on the yes button. The safe (no) button has focus first, Esc / backdrop / no all resolve false. Own <dialog>, so it can stack on top of the player modal.
export function confirmDialog(
  message,
  { yes = t('confirm.yes'), no = t('confirm.no'), danger = false } = {},
) {
  return new Promise(resolve => {
    const prev = document.activeElement,
      d = document.createElement('dialog');
    let done = false;
    d.className = 'confirm-dlg';
    d.setAttribute('role', 'alertdialog');
    d.setAttribute('aria-labelledby', 'confirm-msg');
    d.innerHTML = html`
      <div class="modal-content">
        <p id="confirm-msg">${esc(message)}</p>
        <div class="confirm-actions">
          <button type="button" class="secondary" data-no>${esc(no)}</button><button type="button" class="primary${danger ? ' danger' : ''}" data-yes>${esc(yes)}</button>
        </div>
      </div>`;
    const end = v => {
      if (done) return;
      done = true;
      resolve(v);
      d.close();
    };
    d.addEventListener('click', e => {
      if (e.target.closest('[data-yes]')) end(true);
      else if (e.target === d || e.target.closest('[data-no]')) end(false);
    });
    d.addEventListener('cancel', e => {
      e.preventDefault();
      end(false);
    });
    d.addEventListener('keydown', e => {
      if (e.key !== 'Tab') e.stopPropagation();
    });
    d.addEventListener('close', () => {
      end(false);
      d.remove();
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    });
    document.body.append(d);
    d.showModal();
    d.querySelector('[data-no]').focus();
  });
}
export function show(content) {
  arena.paused = true;
  stopCrowd();
  stopSpeech();
  modal.innerHTML = html`
    ${btn('×', 'close', 'close', `aria-label="${esc(t('a11y.closeDialog'))}"`)}
    <div class="modal-content">${content}</div>`;
  const h = modal.querySelector('h1');
  if (h) {
    h.id = 'modal-title';
    modal.setAttribute('aria-labelledby', 'modal-title');
  }
  if (!modal.open) modal.showModal();
}
const settings = createSettingsDialog({
  modal,
  show,
  notify,
  onKeysChange: k => {
    setKeys(k);
    render();
  },
});
export function openSettings(tab) {
  settings.open(tab);
}
export function toggleSound() {
  const muted = !getSound().muted;
  setSound({ muted });
  if (!muted) play('select');
  announce(muted ? t('a11y.soundOff') : t('a11y.soundOn'));
}
export function credits() {
  show(
    html`
      <span class="eyebrow">${tu('credits.kicker')}</span>
      <h1>${t('side.credits')}</h1>
      <h2>${t('credits.creators')}</h2>
      <p class="creator-names">Ajisth Sareen<br>Raghav Krishnan<br>Malhar Pawar</p>
      <h2>${t('credits.assets')}</h2>
      <ul class="sources">
        <li>${t('credits.logos')}</li>
        <li>
          ${t('credits.kenney', { link: link('https://kenney.nl/assets/furniture-kit', 'Kenney Furniture Kit'), loaded: arena.models })}
        </li>
        <li>${t('credits.three', { link: link('https://threejs.org/', 'Three.js') })}</li>
        <li>
          ${t('credits.fonts', { barlow: link('https://fonts.google.com/specimen/Barlow', 'Barlow'), condensed: link('https://fonts.google.com/specimen/Barlow+Condensed', 'Barlow Condensed') })}
        </li>
        <li>
          ${link('https://fonts.google.com/specimen/Yellowtail', 'Yellowtail')} · Astigmatic · Apache 2.0
        </li>
        <li>${t('credits.vite', { link: link('https://vite.dev/', 'Vite') })}</li>
        <li>
          ${t('credits.finalscore', { link: link(data.source, 'KingCo Athletics'), season: esc(data.season) })}
        </li>
        <li>
          ${t('credits.kangs', { link: link('https://www.kangsbasketball.com/hs', 'Lake Washington Boys Basketball') })}
        </li>
        <li>
          ${t('credits.nfhs', { link: link('https://www.nfhs.org/sports/basketball/rules', 'NFHS basketball rules') })}
        </li>
        <li>
          ${t('credits.fbla', { event: link('https://www.fbla.org/competitive-events/computer-game-simulation-programming/', 'FBLA event'), guidelines: link('https://greektrack-fbla-public.s3.us-east-1.amazonaws.com/files/1/High%20School%20Competitive%20Events%20Resources/Individual%20Guidelines/Presentation%20Events/Computer-Game-Simulation-Programming.pdf', '2026–27') })}
        </li>
        <li>${t('credits.ecoquest', { link: link('https://github.com/Rishboy39/EcoQuest', 'EcoQuest') })}</li>
      </ul>
      <p>${t('credits.generated')}</p>
      <p>${t('credits.render')}</p>`,
  );
}
