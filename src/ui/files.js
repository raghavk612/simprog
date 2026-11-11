// The season as a file: Export (Settings, end of season) downloads it, Import (title screen) loads one back.
import * as E from '../engine.js';
import { t } from '../i18n/index.js';
import { play } from '../audio.js';
import { state, save, setState } from './store.js';
import { go } from './shell.js';
import { confirmDialog } from './dialogs.js';
import { notify, announceKits } from './toast.js';

export function exportSeason() {
  play('confirm');
  const blob = new Blob([E.exportJson(state)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'kangs-season.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(t('notify.exported'), { type: 'success', title: t('toast.exportedTitle') });
}
// The file is checked (size, then E.validSave) before it replaces the open season, which asks first.
export function importSeason() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  document.body.append(input);
  input.oncancel = () => input.remove();
  input.onchange = async () => {
    try {
      if (input.files[0].size > 2e6) throw Error(t('notify.tooLarge'));
      const s = JSON.parse(await input.files[0].text());
      if (!E.validSave(s)) throw Error(t('notify.badSave'));
      if (state && !(await confirmDialog(t('confirm.import'), { yes: t('confirm.importYes'), danger: true })))
        return;
      setState(s);
      const early = E.updateKits(state);
      save();
      go('home');
      announceKits(early);
    } catch (err) {
      notify(err.message, { type: 'error', title: t('toast.importFailed') });
      play('error');
    } finally {
      input.remove();
    }
  };
  input.click();
}
