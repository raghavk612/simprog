// Keyboard shortcuts (rebindable in Settings, see keys.js). They press the visible buttons, so a disabled control
// stays disabled. ? opens Help, J jumps ahead in the judge demo, and 1–3 pick an answer in the press room and inbox.
// In `npm run dev` only, ` (backquote) toggles 64× playback for testing whole games quickly; production builds drop it.
import { ACTIONS } from '../keys.js';
import { keys, view, ui } from './store.js';
import { setSpeed } from './playback.js';
import { modal, $ } from './page.js';
import { setCamera } from './shell.js';
import { openSettings, toggleSound } from './dialogs.js';
import { rules } from './handbook.js';
import { demo, demoJump } from './demo.js';
import { tourHoldsKeys } from './tutorial.js';

const press = sel => {
  const b = document.querySelector(sel);
  if (b && !b.disabled) {
    b.click();
    return true;
  }
  return false;
};
const CAMERA_KEYS = {
  camWide: 'broadcast',
  camCourt: 'court',
  camFollow: 'follow',
  camPlayer: 'player',
  camAuto: 'auto',
};
export function onShortcut(e) {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const tg = e.target;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tg?.tagName) || tg?.isContentEditable) return;
  if (tourHoldsKeys()) return;
  // Help's tabs follow the arrow keys.
  const rulesTab = modal.open ? modal.querySelector('[data-rules-tab]') : null;
  if (rulesTab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    rules(+rulesTab.dataset.rulesTab + (e.key === 'ArrowRight' ? 1 : -1));
    return;
  }
  if (modal.open) return;
  if (demo && e.code === 'KeyJ') {
    e.preventDefault();
    demoJump();
    return;
  }
  if (e.key === '?') {
    e.preventDefault();
    rules();
    return;
  }
  const action = ACTIONS.find(a => keys[a] === e.code);
  if (!action) {
    if (import.meta.env?.DEV && e.code === 'Backquote') {
      e.preventDefault();
      setSpeed(ui.playbackSpeed === 64 ? 1 : 64);
      return;
    }
    // Space is "Next play" on Game day, unless it is pressing a focused button.
    if (
      e.code === 'Space' &&
      document.body.dataset.view === 'game' &&
      !tg?.closest?.('button,a,summary') &&
      press('[data-action="step"]')
    )
      e.preventDefault();
    return;
  }
  e.preventDefault();
  if (action === 'playPause') press('[data-action="auto"]') || press('[data-action="replay-pause"]');
  else if (action === 'nextPlay') press('[data-action="step"]');
  else if (action === 'timeout') press('[data-action="timeout"]');
  else if (CAMERA_KEYS[action]) {
    // the title gym keeps its own shot
    if ($('#arena') && view !== 'landing') setCamera(CAMERA_KEYS[action]);
  } else if (action === 'speed') {
    const all = [...document.querySelectorAll('[data-action="speed"]')],
      i = all.findIndex(b => b.getAttribute('aria-pressed') === 'true');
    all[(i + 1) % all.length]?.click();
  } else if (action === 'sound') toggleSound();
  else if (action === 'settings') openSettings();
  else if (action === 'rules') rules();
}
// In the press room and the inbox, 1–3 pick the matching answer.
export function pickWithNumberKeys(e) {
  if (!/^[1-3]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
  const b = modal.querySelectorAll('[data-pick]')[+e.key - 1];
  if (b && !b.disabled) {
    e.preventDefault();
    b.click();
  }
}
