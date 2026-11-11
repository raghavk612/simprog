// What the page's buttons and fields do. One click listener (onAction) and one change listener (onChange)
// serve the whole page, so a redraw never needs to re-attach anything.
//
//   <button data-view="roster">     opens that page
//   <button data-action="recruit">  runs ACTIONS.recruit or SEASON_ACTIONS.recruit, with the button as `el`
//
// ACTIONS handle everything themselves. SEASON_ACTIONS change the season: afterwards the game plays the action's
// sound (CUES), saves, redraws, and for the ones in TOASTS shows what it cost or earned. One returns false to skip that.
// An error thrown by either kind is shown as a notification.
import * as E from '../engine.js';
import { t, translateError } from '../i18n/index.js';
import { logText } from '../narrative.js';
import { play } from '../audio.js';
import { state, view, save, ui } from './store.js';
import { arena, modal } from './page.js';
import { signed } from './markup.js';
import { go, render, setCamera } from './shell.js';
import { notify, actionToast } from './toast.js';
import { confirmDialog, openSettings, credits } from './dialogs.js';
import { rules } from './handbook.js';
import { exportSeason, importSeason } from './files.js';
import { askSkipTour, nextBeat } from './tutorial.js';
import { enterDemo, exitDemo, demoStep, demoJump, showDemoGuide } from './demo.js';
import {
  showEvent,
  openPress,
  chooseEvent,
  choosePress,
  skipPress,
  closeInbox,
  afterPress,
} from './postgame.js';
import {
  tipOff,
  toggleWatch,
  nextPlay,
  askTimeout,
  closeBreak,
  applyBreakAdjust,
  watchReplay,
  togglePause,
  replayAgain,
  setSpeed,
} from './playback.js';
import { toggleTitlePause, toggleStartForm, enterSeason, titlePreview } from './screens/landing.js';
import { profile, cycleRoster, toggleFullRoster, selectPlayer } from './screens/roster.js';
import { togglePlan, startPractice, nextDrill } from './screens/prep.js';
import { unlockSkill, pickSkill } from './screens/breaks.js';
import {
  wearKit,
  stepJerseyPlayer,
  makeCaptain,
  toggleCaptainPick,
  setJerseyPlayer,
} from './screens/locker.js';
import { modelPanel } from './screens/game.js';
import { result } from './screens/results.js';
import { copyCode, refresh, saveReportCard, pickDataLevel } from './screens/season.js';

// Play the interface click (or the selection tick) first.
const click = fn => el => {
  play('uiClick');
  return fn(el);
};
const select = fn => el => {
  play('select');
  return fn(el);
};

const ACTIONS = {
  // Dialogs and help
  settings: click(() => openSettings()),
  close: click(() => {
    modal.close();
    arena.paused = false;
  }),
  credits: click(() => credits()),
  rules: el => rules(+(el.dataset.tab || 0)),
  model: click(() => modelPanel()),
  'copy-code': click(el => copyCode(el.dataset.code)),
  'report-save': click(() => saveReportCard()),
  export: () => exportSeason(),
  import: click(() => importSeason()),
  refresh: () => refresh(),
  'data-level': select(el => pickDataLevel(el.dataset.key)),

  // Title screen and moving between pages
  title: click(() => {
    if (modal.open) modal.close();
    go('landing');
  }),
  'title-pause': click(() => toggleTitlePause()),
  'new-season-form': click(el => toggleStartForm(el)),
  continue: () => enterSeason(true),
  home: () => enterSeason(false),
  game: click(() => go('game')),
  rotation: click(() => go('roster')),
  journal: click(() => go('season')),
  'new-season': click(() => go('landing')),
  'break-done': () => {
    play('confirm');
    E.endBreak(state);
    save();
    go('home');
  },

  // Tutorial and judge demo
  'tour-skip': click(() => askSkipTour()),
  'tour-next': click(() => nextBeat()),
  'demo-start': () => {
    play('whistle');
    enterDemo();
  },
  'demo-next': click(() => demoStep(1)),
  'demo-back': click(() => demoStep(-1)),
  'demo-exit': click(() => exitDemo()),
  'demo-hide': click(() => showDemoGuide(false)),
  'demo-show': click(() => showDemoGuide(true)),
  'demo-jump': click(() => demoJump()),

  // Team
  player: click(el => profile(el.dataset.id)),
  'roster-full': click(() => toggleFullRoster()),
  'rv-select': select(el => selectPlayer(+el.dataset.id)),
  'rv-cycle': el => cycleRoster(+el.dataset.step),

  // Prep
  'plan-toggle': select(el => togglePlan(el.dataset.plan)),
  'practice-start': () => {
    play('whistle');
    startPractice();
  },
  'practice-next': click(() => nextDrill()),

  // Breaks: skill tree and locker room
  'skill-select': el => pickSkill(el.dataset.key),
  'skill-unlock': el => unlockSkill(el.dataset.key),
  kit: el => wearKit(el.dataset.kit),
  'kit-locked': el => wearKit(el.dataset.kit),
  'jersey-step': el => stepJerseyPlayer(+el.dataset.step),
  'lk-pick': select(el => toggleCaptainPick(+el.dataset.id)),
  'lk-captain': el => makeCaptain(+el.dataset.id),

  // Game day
  camera: click(el => setCamera(el.dataset.camera)),
  step: click(() => nextPlay()),
  timeout: click(() => askTimeout()),
  speed: select(el => setSpeed(Number(el.dataset.speed))),
  'break-go': click(() => closeBreak()),
  'break-adjust': el => applyBreakAdjust(el.dataset.id),
  result: click(el => result(+el.dataset.index)),
  replay: click(el => watchReplay(+el.dataset.index, +el.dataset.event)),
  'replay-pause': select(() => togglePause()),
  'replay-again': select(() => replayAgain()),

  // After the game: press room and inbox
  'press-open': click(() => openPress()),
  'pick-press': select(el => choosePress(+el.dataset.q, el.dataset.a)),
  'press-skip': click(() => skipPress()),
  'press-after': click(() => afterPress()),
  'inbox-open': click(() => showEvent()),
  'pick-event': select(el => chooseEvent(+el.dataset.i)),
  'inbox-done': click(() => closeInbox()),
};

const SEASON_ACTIONS = {
  recruit: el => {
    E.recruit(state, el.dataset.id);
  },
  'scout-prospect': el => {
    E.scoutProspect(state, el.dataset.id);
    notify(logText(state.log[0]), {
      type: 'success',
      icon: 'film',
      title: t('scoutP.toastTitle'),
      chips: [signed(-E.SCOUT_COST, t('toast.tokens'))],
    });
  },
  release: async el => {
    if (!(await confirmDialog(t('confirm.release'), { yes: t('confirm.releaseYes'), danger: true })))
      return false;
    E.release(state, el.dataset.id);
    modal.close();
  },
  hire: el => {
    E.hire(state, el.dataset.key);
  },
  upgrade: el => {
    E.buyUpgrade(state, el.dataset.key);
  },
  dismiss: () => {
    if (state.match) throw Error('Finish the current game first.');
    state.assistant = null;
    E.log(state, 'Assistant dismissed. No refund.', 'dismiss');
  },
  'captain-set': el => {
    const p = E.setCaptain(state, el.dataset.id);
    play('confirm');
    notify(t('captain.set', { name: p.name }), { type: 'success', icon: 'staff' });
  },
  'auto-lineup': () => {
    E.autoLineup(state);
  },
  'start-match': () => {
    tipOff();
  },
  auto: () => toggleWatch(),
  huddle: el => {
    E.timeout(state, el.dataset.message);
    modal.close();
    arena.paused = false;
  },
};
// The sound after a season action. Anything not listed plays a plain interface click.
const CUES = {
  recruit: 'signing',
  hire: 'signing',
  upgrade: 'signing',
  'auto-lineup': 'confirm',
  huddle: 'timeout',
  'start-match': 'whistle',
  release: 'select',
  dismiss: 'select',
};
// Season actions that also show a notification with what changed.
const TOASTS = ['recruit', 'hire', 'upgrade', 'release', 'dismiss'];

export async function onAction(e) {
  const el = e.target.closest('button[data-action],a[data-action],button[data-view]');
  if (!el) return;
  e.preventDefault();
  if (el.dataset.view) {
    play('uiClick');
    go(el.dataset.view);
    return;
  }
  const a = el.dataset.action;
  const was = state ? { tokens: state.tokens, actions: state.actions, chemistry: state.chemistry } : null;
  try {
    if (ACTIONS[a]) {
      await ACTIONS[a](el);
      return;
    }
    if ((await SEASON_ACTIONS[a]?.(el)) === false) return;
    play(CUES[a] ?? 'uiClick');
    save();
    render();
    if (TOASTS.includes(a)) actionToast(a, was);
  } catch (err) {
    ui.auto = false;
    play('error');
    notify(translateError(err.message), { type: 'error' });
  }
}

// Fields: the title screen's difficulty, the locker's "whose jersey", starters, and the live game's system and tempo.
export function onChange(e) {
  const el = e.target;
  if (el.id === 'difficulty' && view === 'landing') {
    if (!state) arena.update(titlePreview(el.value));
    return;
  }
  if (el.id === 'jersey-player' && state) {
    setJerseyPlayer(+el.value);
    return;
  }
  try {
    if (el.matches('[data-starter]')) {
      if (state.match) throw Error(t('notify.finishFirst'));
      E.setStarter(state, el.dataset.starter, el.checked);
      save();
      play('select');
      render();
    }
    if ((el.id === 'tactic' || el.id === 'pace') && state.match) {
      state.match[el.id] = el.value;
      save();
      play('select');
      if (ui.viaPointer) el.blur();
    }
  } catch (err) {
    notify(translateError(err.message), { type: 'error' });
    play('error');
    render();
  }
}
