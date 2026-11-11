// The season being played and the shared screen state.
//
// state  the save (see engine.js createGame); change it, then call save() and render()
// data   the published team data (public/data/kangs.json)
// view   the route name of the open page
// Other modules read these directly but replace them only through the setters at the bottom.
import { loadKeys } from '../keys.js';
import { t } from '../i18n/index.js';
import * as E from '../engine.js';
import { announceAch, notify } from './toast.js';

export let data;
export let state = null;
export let view = 'home';
export let keys = loadKeys(); // keyboard shortcuts, rebindable in Settings
export const KEY = 'kangs-three-season-v2';
export let saveKey = KEY; // the judge demo saves under its own key
let lateKits = []; // special jerseys a loaded save had earned, announced on Continue

// The real team being coached and the names of the season's stages depend on the level (varsity, JV or C-team).
export const lvl = () => state?.level ?? 'varsity';
export const teamName = key => t(`team.${key}`);
export const teamLabel = () => teamName(lvl());
export const plan = () => E.seasonPlan(state);
export const stages = () => ({
  run: t(lvl() === 'varsity' ? 'season.runState' : 'season.runTitle'),
  stretch: t(lvl() === 'varsity' ? 'season.stretchDistrict' : 'season.stretchLeague'),
});
export const hasScore = g => Number.isInteger(g?.points) && Number.isInteger(g?.against);
// Where estimated player stats come from: this season's final scores once any exist, else last season's average.
export const estSrc = () => (state?.schedule?.some(hasScore) ? t('rv.srcReal') : t('rv.srcLast'));

export function save() {
  announceAch();
  try {
    localStorage.setItem(saveKey, JSON.stringify(state));
  } catch {
    notify(t('notify.storage'), { type: 'warn', title: t('toast.storageTitle') });
  }
}
// On start: the saved season, if there is a valid one. Jerseys it has earned since it was saved are kept for Continue.
export function restoreSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (E.validSave(s)) {
      state = s;
      lateKits = E.updateKits(state);
      if (lateKits.length)
        try {
          localStorage.setItem(saveKey, JSON.stringify(state));
        } catch {}
    }
  } catch {}
}
export function takeLateKits() {
  const kits = lateKits;
  lateKits = [];
  return kits;
}

// The live game's playback and the latest input, shared by the game screen, the tutorial and the controls. Not saved.
export const ui = {
  auto: false, // "Watch live" is on
  gap: 0, // ms waited since the last possession (timing assist)
  playbackSpeed: 1,
  closingMatch: null, // the match whose last possession is still on screen
  pendingResult: null, // index of the result to show once that possession ends
  replayEvent: null, // the possession being replayed from the journal
  replayOpp: '',
  lastWhy: '', // "Why that shot?" for the latest resolved play
  flowPending: false, // a result dialog is open; closing it starts the postgame
  // "Watch live" waits while a field has focus so a drop-down is not rebuilt under the cursor, but only while it is in use:
  // a pointer user's choice blurs it, and a keyboard user's focus stops mattering after a few idle seconds.
  lastInteract: 0,
  viaPointer: false,
};

export function setState(value) {
  state = value;
}
export function setData(value) {
  data = value;
}
export function setView(value) {
  view = value;
}
export function setKeys(value) {
  keys = value;
}
export function setSaveKey(value) {
  saveKey = value;
}
