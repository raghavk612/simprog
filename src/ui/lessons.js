// The assistant coach's lessons, as data: nine short chapters and a few one-time tips, with the pure parts of how they
// run (progress, levels, replay, Hide tips, timeout symptoms). No DOM here, so tests import it; tutorial.js shows them.
//
// A lesson:  { id, kind: 'chapter' | 'tip', chapter (its group, for the locale keys), replay: 'arm' | 'now', route?,
//              start(c, armed)  it begins when this is true (armed: replayed from Help and waiting for its moment)
//              begin(c)         what it remembers from that moment (memo), e.g. the Shop tab's purchases so far
//              end(c, m)        the whole lesson is over (counts as done)   abort(c, m)  stop without a status
//              steps }          one to three, plus at most one conditional `extra` step after the last
// A step:    { id, on(c, m) the card opens when true, done(c, m) the real action is done (checked before it opens
//              too, so a step already done is skipped), spot (ringed), act (glows), inline (a line inside the open
//              dialog), hold (pauses the live game), game (needs a live game), notNow (Got it reads Not now),
//              say(c, m) values for the line (read when the card opens, before variant), variants / variant(c, m)
//              for a line with several versions }
// The line is tutorial.c.<chapter>.<step> (a chapter) or tutorial.tip.<id> (a tip), plus .<variant>.
//
// c, the moment (built by tutorial.js every 100 ms): { view, state, dialog: null | 'huddle' | 'quarter' | 'press' |
//   'inbox' | 'drill' | 'other', auto, playing, breakPending, shot: { player, n } | null, active (the chapter
//   running), practice: { plan, cap, running, last: { week, missed } | null }, has(selector) }
// Screens are named by route (nav.js), so renaming a route means updating them here too.
import * as E from '../engine.js';
import { t, formatNumber } from '../i18n/index.js';
import { NAV } from './nav.js';

export const PROGRESS_KEY = 'kangs-lessons-v1';
const STATUSES = ['done', 'dismissed', 'armed'];

// When the timeout chapter calls for a timeout (starting values, to tune by playtesting).
export const RUN_POINTS = 6; // the visitors scored this many unanswered points
export const LOW_ENERGY = 45; // a starter is this tired (the injury risk line in a player's profile)
export const TIRED_FROM = 6; // ...but not before this possession, when nobody can be tired yet
export const FALLBACK_AT = 12; // otherwise, at this possession

const free = c => !c.dialog;
const live = c => c.view === 'game' && !!c.state?.match && !c.dialog;
const between = c => live(c) && !c.playing && !c.breakPending;
const shopPage = v => NAV.shop.includes(v);
const symptom = c => timeoutSymptom(c.state.match, c.state.players);
const ran = c => c.practice?.last?.week === c.state?.week;
const missed = c =>
  ran(c) && !c.practice.running && c.practice.last.missed.some(k => c.practice.plan.includes(k));

// What has been bought or done on a Shop tab, as a string: a lesson ends when it changes after the lesson began.
export function shopMark(s, tab) {
  if (!s) return '';
  const pick = {
    recruit: () => [s.players.map(p => p.id), Object.keys(s.scoutedProspects || {})],
    staff: () => [s.assistant, s.upgrades || []],
    skills: () => [s.skills || []],
    gear: () => [s.gear || null],
    locker: () => [s.kit, s.captain],
  }[tab];
  return pick ? JSON.stringify(pick()) : '';
}
// A Shop tab's lesson: one line, on the tab's main card. Tryouts rings the team-needs line with the cards, so the
// coach card is placed clear of that line, not over it.
const SHOP_SPOT = {
  recruit: '.tryouts',
  staff: '.office-section',
  skills: '.st-tree',
  gear: '.gear-layout',
  locker: '.lk-stage-row',
};
const shopLesson = tab => ({
  id: `shop:${tab}`,
  kind: 'chapter',
  chapter: 'shop',
  replay: 'now',
  route: tab,
  start: c => c.view === tab && free(c),
  begin: c => ({ mark: shopMark(c.state, tab), shown: false }),
  abort: (c, m) => c.view !== tab && !m.shown,
  steps: [
    {
      id: tab,
      spot: SHOP_SPOT[tab],
      on: c => c.view === tab && free(c),
      done: (c, m) => (m.shown && c.view !== tab) || shopMark(c.state, tab) !== m.mark,
    },
  ],
});
const breakLesson = (id, pause, steps) => ({
  id,
  kind: 'chapter',
  chapter: id,
  replay: 'arm',
  start: c => !!c.state && E.breakDue(c.state) === pause && shopPage(c.view) && free(c),
  begin: c => ({ view: c.view }),
  end: c => E.breakDue(c.state) !== pause,
  steps,
});
const record = c => ({
  w: c.state.wins,
  l: c.state.losses,
  n: formatNumber(c.state.tokens),
  why: t('game.why'),
});
// A button's name without what it adds ("Calm the team · +4 energy" → "Calm the team").
const label = k => t(k).split(' · ')[0];

export const LESSONS = [
  {
    id: 'week',
    kind: 'chapter',
    chapter: 'week',
    replay: 'arm',
    start: (c, armed) =>
      c.view === 'home' &&
      free(c) &&
      !c.state.match &&
      !c.state.finished &&
      c.state.actions === 3 &&
      (armed || (c.state.week === 0 && !c.state.results.length)),
    end: c => c.view === 'game',
    steps: [
      {
        id: 'home',
        spot: '.home-bar',
        act: '.hb-go',
        on: c => c.view === 'home' && free(c),
        done: c => c.view !== 'home' || ran(c),
        say: c => ({ opp: E.opponent(c.state).opponent }),
      },
      {
        id: 'plan',
        spot: '.prep-list',
        act: '[data-plan="shooting"][aria-pressed="false"]',
        on: c => c.view === 'practice' && free(c),
        done: c => c.practice.plan.length >= c.practice.cap || c.practice.running || ran(c),
        say: () => ({ name: t('plan.shooting.name') }),
      },
      {
        id: 'run',
        spot: '[data-action="practice-start"]',
        act: '[data-action="practice-start"]',
        on: c => c.view === 'practice' && free(c),
        done: c => c.practice.running || ran(c),
      },
      // Only after a missed drill; a re-run that lands before the card shows counts.
      {
        id: 'retry',
        extra: true,
        spot: '.prep-side',
        act: '[data-action="practice-start"]',
        on: c => c.view === 'practice' && free(c) && missed(c),
        done: c => ran(c) && !missed(c) && !c.practice.running,
      },
    ],
  },
  {
    id: 'tipoff',
    kind: 'chapter',
    chapter: 'tipoff',
    replay: 'arm',
    start: (c, armed) =>
      c.view === 'game' &&
      free(c) &&
      !c.state.match &&
      !c.state.finished &&
      (armed || !c.state.results.length),
    steps: [
      {
        id: 'five',
        spot: '.right-rail',
        act: '[data-action="start-match"]',
        // only while Tip off is the purple button: before that, Game day's way forward is the week's next step
        on: c => c.view === 'game' && free(c) && !c.state.match && E.nextStep(c.state).id === 'tipoff',
        done: c => !!c.state.match,
      },
      // Pressing Next play a few times instead is a choice too.
      {
        id: 'watch',
        spot: '[data-action="auto"]',
        act: '[data-action="auto"]',
        game: true,
        on: live,
        done: c => !!c.auto || c.state.match.possession >= 3,
        say: () => ({ btn: t('game.watch').replace(/^[^\p{L}]+/u, '') }),
      },
      // The shot chance of a home shot that has just resolved: the number the coach cannot see otherwise.
      {
        id: 'shot',
        game: true,
        hold: true,
        on: c => live(c) && c.state.match.possession >= 3 && !!c.shot,
        done: () => false,
        say: (c, m) => (m.shot ??= { ...c.shot }),
      },
    ],
  },
  {
    id: 'timeout',
    kind: 'chapter',
    chapter: 'timeout',
    replay: 'arm',
    start: c => between(c) && !!symptom(c),
    steps: [
      {
        id: 'call',
        spot: '[data-action="timeout"]',
        act: '[data-action="timeout"]',
        game: true,
        hold: true,
        notNow: true,
        variants: ['run', 'tired', 'fallback'],
        variant: (c, m) => m.why?.kind ?? 'fallback',
        on: c => between(c) && !!symptom(c),
        done: c => c.dialog === 'huddle' || c.state.match.timeouts < E.TIMEOUTS,
        say: (c, m) => (m.why = symptom(c)),
      },
      {
        id: 'huddle',
        inline: true,
        variants: ['run', 'tired', 'fallback'],
        variant: (c, m) => m.why?.kind ?? 'fallback',
        on: c => c.dialog === 'huddle',
        done: c => c.dialog !== 'huddle',
        say: () => ({ calm: label('timeout.calm'), belief: label('timeout.belief') }),
      },
    ],
  },
  {
    id: 'quarter',
    kind: 'chapter',
    chapter: 'quarter',
    replay: 'arm',
    start: c => c.dialog === 'quarter',
    steps: [{ id: 'read', inline: true, on: c => c.dialog === 'quarter', done: c => c.dialog !== 'quarter' }],
  },
  // After a quarter break, between two plays: so it never pauses a play or stands in front of the break dialog.
  {
    id: 'speed',
    kind: 'chapter',
    chapter: 'speed',
    replay: 'arm',
    start: c => between(c) && c.state.match.possession >= E.BREAKS[0],
    steps: [
      {
        id: 'controls',
        spot: '.playback-controls',
        game: true,
        hold: true,
        on: between,
        done: () => false,
      },
    ],
  },
  {
    id: 'press',
    kind: 'chapter',
    chapter: 'press',
    replay: 'arm',
    start: c => c.dialog === 'press',
    steps: [
      { id: 'room', inline: true, on: c => c.dialog === 'press', done: c => c.dialog !== 'press' },
      {
        id: 'tokens',
        spot: '.home-bar',
        act: '.hb-go',
        on: c => c.view === 'home' && free(c),
        done: c => c.view !== 'home' || !!c.state.match,
        say: c => ({ n: formatNumber(c.state.tokens), shop: t('nav.groups.shop') }),
      },
    ],
  },
  breakLesson('mid', 'mid', [
    {
      id: 'record',
      spot: '.scorebug',
      on: c => shopPage(c.view) && free(c),
      done: (c, m) => c.view !== m.view,
      say: record,
    },
    {
      id: 'after',
      spot: '.subnav-end [data-action="break-done"]',
      act: '.subnav-end [data-action="break-done"]',
      on: c => shopPage(c.view) && free(c),
      done: () => false,
      say: c => {
        const P = E.seasonPlan(c.state);
        return { need: P.need, cut: P.cut };
      },
    },
  ]),
  breakLesson('playoff', 'playoff', [
    {
      id: 'stakes',
      spot: '.subnav-end [data-action="break-done"]',
      act: '.subnav-end [data-action="break-done"]',
      on: c => shopPage(c.view) && free(c),
      done: () => false,
    },
  ]),
  // The Shop tabs come after the breaks, so a break's own lesson opens first on a Shop page.
  ...NAV.shop.map(shopLesson),
  // One-time tips: one line, the first time each comes up.
  {
    id: 'lineup',
    kind: 'tip',
    chapter: 'lineup',
    replay: 'arm',
    start: c => c.view === 'home' && free(c) && E.nextStep(c.state).id === 'issues',
    steps: [
      {
        id: 'lineup',
        spot: '.hb-go',
        on: c => c.view === 'home' && free(c),
        done: c => c.view !== 'home' || E.nextStep(c.state).id !== 'issues',
      },
    ],
  },
  {
    id: 'inbox',
    kind: 'tip',
    chapter: 'inbox',
    replay: 'arm',
    start: c => c.dialog === 'inbox',
    steps: [{ id: 'inbox', inline: true, on: c => c.dialog === 'inbox', done: c => c.dialog !== 'inbox' }],
  },
  {
    id: 'scout',
    kind: 'tip',
    chapter: 'scout',
    replay: 'arm',
    start: c => c.view === 'practice' && free(c) && E.nextStep(c.state).id === 'scout',
    steps: [
      {
        id: 'scout',
        spot: '.prep-row[data-row="film"]',
        act: '[data-plan="film"]',
        on: c => c.view === 'practice' && free(c),
        done: c => c.view !== 'practice' || !!c.state.scouted || c.practice.plan.includes('film'),
        say: () => ({ name: t('prep.film') }),
      },
    ],
  },
  // A missed drill that the week chapter is not already talking about (so, in a first season, the second one).
  {
    id: 'drill',
    kind: 'tip',
    chapter: 'drill',
    replay: 'arm',
    start: c => c.view === 'practice' && free(c) && missed(c) && c.active !== 'week',
    steps: [
      {
        id: 'drill',
        spot: '.prep-side',
        act: '[data-action="practice-start"]',
        on: c => c.view === 'practice' && free(c),
        done: c => c.view !== 'practice' || !missed(c),
      },
    ],
  },
  // A purchase greyed out for want of tokens (the page says how many): where tokens come from.
  {
    id: 'tokens',
    kind: 'tip',
    chapter: 'tokens',
    replay: 'arm',
    start: c => shopPage(c.view) && free(c) && c.has('.need-tokens'),
    begin: c => ({ view: c.view }),
    steps: [
      {
        id: 'tokens',
        spot: '.need-tokens',
        on: c => shopPage(c.view) && free(c),
        done: (c, m) => c.view !== m.view || !c.has('.need-tokens'),
        say: () => ({ clinic: t('office.fundraise') }),
      },
    ],
  },
];
export const lessonById = id => LESSONS.find(l => l.id === id);

// The locale key(s) of a step's line.
const baseKey = (l, s) => (l.kind === 'tip' ? `tutorial.tip.${l.id}` : `tutorial.c.${l.chapter}.${s.id}`);
export const stepKeys = (l, s) =>
  s.variants ? s.variants.map(v => `${baseKey(l, s)}.${v}`) : [baseKey(l, s)];
export const stepKey = (l, s, c, m) => (s.variant ? `${baseKey(l, s)}.${s.variant(c, m)}` : baseKey(l, s));

// What the visitors' run or a tired starter says about calling a timeout now, or the fallback; null when there are
// no timeouts left or nothing calls for one yet. match.events holds one entry per possession: the home team plays first
// ({ points }), then the visitors ({ away }).
export function timeoutSymptom(match, players = []) {
  if (!match || !(match.timeouts > 0)) return null;
  const ev = match.events || [];
  let run = 0;
  for (let i = ev.length - 1; i >= 0; i--) {
    run += ev[i].away || 0;
    if (ev[i].points > 0) break;
  }
  if (run >= RUN_POINTS) return { kind: 'run', n: run };
  if (match.possession >= TIRED_FROM) {
    const tired = players
      .filter(p => p.starter && p.energy < LOW_ENERGY)
      .sort((a, b) => a.energy - b.energy)[0];
    if (tired) return { kind: 'tired', player: tired.name, energy: Math.round(tired.energy) };
  }
  return match.possession >= FALLBACK_AT ? { kind: 'fallback' } : null;
}

// Progress, per browser profile: { [lesson id]: 'done' | 'dismissed' | 'armed' }. Storage may throw or hold junk.
const clean = raw =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw).filter(([k, v]) => lessonById(k) && STATUSES.includes(v)))
    : {};
// The store is reached inside the try: where site data is blocked, even reading localStorage throws.
export function loadProgress(store) {
  try {
    store ??= globalThis.localStorage;
    return clean(JSON.parse(store.getItem(PROGRESS_KEY)));
  } catch {
    return {};
  }
}
export function saveProgress(progress, store) {
  try {
    store ??= globalThis.localStorage;
    store.setItem(PROGRESS_KEY, JSON.stringify(clean(progress)));
    return true;
  } catch {
    return false;
  }
}
// Chapters show at the lessons level, tips at lessons or tips; a lesson replayed from Help (armed) at any level.
export function allowed(lesson, level, progress) {
  const st = progress[lesson.id];
  if (st === 'armed') return true;
  if (st) return false;
  return lesson.kind === 'tip' ? level !== 'off' : level === 'lessons';
}
// Replay from Help: the lesson waits for its next moment, or (a Shop tab) opens at once on its tab.
export function replayLesson(progress, id) {
  const l = lessonById(id);
  if (!l) return null;
  return { progress: { ...progress, [id]: 'armed' }, now: l.replay === 'now', route: l.route ?? null };
}
// Hide tips: the level goes to off and lessons waiting for their moment are dropped; undo holds what to put back.
export function hideTips(level, progress) {
  return {
    level: 'off',
    progress: Object.fromEntries(
      Object.entries(progress).map(([k, v]) => [k, v === 'armed' ? 'dismissed' : v]),
    ),
    undo: { level, progress: { ...progress } },
  };
}
// Got it on the last regular step (or the conditional one after it) finishes the lesson; earlier, it dismisses it.
export function gotItStatus(lesson, i) {
  return i >= lesson.steps.filter(s => !s.extra).length - 1 ? 'done' : 'dismissed';
}
// A card that held the live game closes. how: gotit | escape | notnow | hide (the coach answered the card: Watch live
// goes back to what it was before the card), played (the coach pressed Watch live, Resume or Next play on the page:
// that choice stands), done (the coach did the step itself, e.g. called the timeout), ended (the lesson stopped by
// itself or was dropped: the hold was the card's doing, so the game goes back as it was).
export function watchAfterCard(how, autoBefore, autoNow) {
  return ['gotit', 'escape', 'notnow', 'hide', 'ended'].includes(how)
    ? { auto: autoBefore, unpause: true }
    : { auto: autoNow, unpause: false };
}
// Answering "No, show me as I go" on the start form: every chapter can show again (the one-time tips stay as they were).
export const forgetChapters = progress =>
  Object.fromEntries(Object.entries(progress).filter(([id]) => lessonById(id)?.kind !== 'chapter'));
// The 100 ms loop runs the lessons through this: a lesson that throws is reported once (onFail closes its card and
// gives the game back) and the lessons stop until the page is reloaded, so a bad lesson can never stall Watch live.
export function guardTick(tick, onFail) {
  let failed = false;
  return () => {
    if (failed) return;
    try {
      tick();
    } catch (err) {
      failed = true;
      onFail(err);
    }
  };
}
// The start question's default: "No, show me as I go" until the first week and the first tip-off have been seen.
export const questionDefault = progress =>
  ['week', 'tipoff'].every(id => ['done', 'dismissed'].includes(progress[id])) ? 'tips' : 'lessons';
// Escape answers a card like Got it, unless a dialog is open (its Escape is its own, and a line inside it goes with it).
export const escapeAnswers = ({ open, inline, dialog }) => !!open && !inline && !dialog;
// Shortcut keys wait only while a card holds the paused live game (and no dialog is over it).
export const holdsKeys = ({ open, held, dialog }) => !!open && !!held && !dialog;
// The thing a card points at is wholly out of view: above, below, or under the card docked at the bottom of a phone.
export const outOfView = (r, height, dockTop = null) =>
  !!r && (r.bottom <= 0 || r.top >= height || (dockTop !== null && r.top >= dockTop));
// A desktop card's place in the page header (the band's free middle, over the decorative ghost word), beside the title
// and sub-line and never on them, nor on the page's stat chips that follow them (Prep): centred in the band, or from its
// top when the card is taller than the band (it then hangs below it, still beside the text). null when the header is
// hidden (the live game), not wholly on screen, or has no room. Hidden chips measure 0 wide and do not count.
export function headRoom({ head, text, chips = null, card, screen }) {
  if (!head?.height || !text || head.top < 0 || head.bottom > screen.h) return null;
  const left = Math.max(text.right, chips?.width ? chips.right : -Infinity) + 24,
    top = head.top + Math.max(8, (head.height - card.h) / 2);
  if (left + card.w > screen.w - 12 || top + card.h > screen.h - 12) return null;
  return { left, top };
}
// A phone's card is docked at the bottom, and the page can scroll anything clear of it. It rises above its target only
// when the target is on screen under it and scrolling cannot clear it: the page has too little left to scroll (`room`),
// or the target is fixed in place (the live game's control bar).
export const liftsDocked = ({ aim, dockTop, h, vh, room, fixed = false }) =>
  !!aim &&
  aim.top < vh &&
  aim.bottom > dockTop &&
  aim.top - h - 12 >= 12 &&
  (fixed || room < aim.bottom - dockTop + 12);
