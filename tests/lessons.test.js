import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from '../src/i18n/locales/en.js';
import * as E from '../src/engine.js';
import { NAV } from '../src/ui/nav.js';
import { TIP_LEVELS, normalizePrefs } from '../src/settings.js';
import {
  LESSONS,
  lessonById,
  stepKeys,
  PROGRESS_KEY,
  loadProgress,
  saveProgress,
  allowed,
  replayLesson,
  hideTips,
  gotItStatus,
  shopMark,
  watchAfterCard,
  questionDefault,
  timeoutSymptom,
  RUN_POINTS,
  LOW_ENERGY,
  TIRED_FROM,
  FALLBACK_AT,
  guardTick,
  forgetChapters,
} from '../src/ui/lessons.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url), 'utf8'));
const season = () => {
  const s = E.createGame(data, 'Lessons', 'standard', 7);
  E.autoLineup(s);
  return s;
};
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
// A storage object like localStorage, backed by a Map; `fail` makes every call throw.
const memory = (init = {}, fail = false) => {
  const m = new Map(Object.entries(init));
  const guard =
    fn =>
    (...a) => {
      if (fail) throw Error('blocked');
      return fn(...a);
    };
  return {
    getItem: guard(k => (m.has(k) ? m.get(k) : null)),
    setItem: guard((k, v) => m.set(k, String(v))),
    removeItem: guard(k => m.delete(k)),
    raw: m,
  };
};

test('nine chapters and the one-time tips, each step with on, done and a line in English', () => {
  const chapters = [...new Set(LESSONS.filter(l => l.kind === 'chapter').map(l => l.chapter))];
  assert.deepEqual(chapters, [
    'week',
    'tipoff',
    'timeout',
    'quarter',
    'speed',
    'press',
    'mid',
    'playoff',
    'shop',
  ]);
  assert.deepEqual(
    LESSONS.filter(l => l.kind === 'tip').map(l => l.id),
    ['lineup', 'inbox', 'scout', 'drill', 'tokens'],
  );
  assert.equal(new Set(LESSONS.map(l => l.id)).size, LESSONS.length, 'ids are unique');
  for (const l of LESSONS) {
    assert.ok(['arm', 'now'].includes(l.replay), `${l.id}: replay`);
    assert.equal(typeof l.start, 'function', `${l.id}: start`);
    assert.ok(l.steps.length >= 1 && l.steps.filter(s => !s.extra).length <= 3, `${l.id}: 1 to 3 steps`);
    assert.equal(typeof get(en, `tutorial.name.${l.chapter}`), 'string', `${l.id}: its name in Help`);
    for (const s of l.steps) {
      assert.equal(typeof s.on, 'function', `${l.id}.${s.id}: on`);
      assert.equal(typeof s.done, 'function', `${l.id}.${s.id}: done`);
      const keys = stepKeys(l, s);
      assert.ok(keys.length >= 1, `${l.id}.${s.id}: a locale key`);
      for (const k of keys) assert.equal(typeof get(en, k), 'string', k);
    }
  }
  assert.equal(lessonById('shop:gear').route, 'gear');
  assert.equal(lessonById('nope'), undefined);
});
test('only the week chapter has the conditional retry step, after its three regular steps', () => {
  const w = lessonById('week');
  assert.deepEqual(
    w.steps.map(s => s.id),
    ['home', 'plan', 'run', 'retry'],
  );
  assert.ok(w.steps[3].extra);
  assert.equal(LESSONS.flatMap(l => l.steps).filter(s => s.extra).length, 1);
});
test('progress survives storage that throws, holds corrupt JSON or holds junk', () => {
  assert.deepEqual(loadProgress(memory({}, true)), {});
  assert.equal(saveProgress({ week: 'done' }, memory({}, true)), false);
  assert.deepEqual(loadProgress(memory({ [PROGRESS_KEY]: '{not json' })), {});
  assert.deepEqual(loadProgress(memory({ [PROGRESS_KEY]: '[1,2]' })), {});
  assert.deepEqual(loadProgress(memory({ [PROGRESS_KEY]: 'null' })), {});
  assert.deepEqual(
    loadProgress(
      memory({
        [PROGRESS_KEY]: JSON.stringify({ week: 'done', tipoff: 'maybe', x: 'done', speed: 'armed' }),
      }),
    ),
    { week: 'done', speed: 'armed' },
    'unknown ids and statuses are dropped',
  );
  const st = memory();
  assert.equal(saveProgress({ week: 'dismissed', 'shop:gear': 'done' }, st), true);
  assert.deepEqual(loadProgress(st), { week: 'dismissed', 'shop:gear': 'done' });
  assert.deepEqual(loadProgress(undefined), {}, 'no storage at all');
});
test('progress survives a browser where even reaching localStorage throws (site data blocked)', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw Error('SecurityError: site data is blocked');
    },
  });
  try {
    assert.deepEqual(loadProgress(), {});
    assert.equal(saveProgress({ week: 'done' }), false);
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had);
    else delete globalThis.localStorage;
  }
});
test('a lesson that throws is stopped for good: its error is handled once and the loop goes on', () => {
  let runs = 0;
  const errors = [];
  const tick = guardTick(
    () => {
      runs++;
      throw Error('bad lesson');
    },
    e => errors.push(e.message),
  );
  tick();
  tick();
  tick();
  assert.equal(runs, 1, 'the lessons are not run again after the error');
  assert.deepEqual(errors, ['bad lesson']);
  let ok = 0;
  const fine = guardTick(
    () => ok++,
    () => assert.fail('no error'),
  );
  fine();
  fine();
  assert.equal(ok, 2, 'lessons that do not throw keep running');
});
test('no lesson points at the page with :has(), which older browsers reject', () => {
  for (const l of LESSONS)
    for (const s of l.steps)
      for (const sel of [s.spot, s.act]) if (sel) assert.doesNotMatch(sel, /:has\(/, `${l.id}.${s.id}`);
});
test('answering “No, show me as I go” brings every chapter back; the one-time tips stay as they were', () => {
  assert.deepEqual(
    forgetChapters({
      week: 'dismissed',
      tipoff: 'done',
      speed: 'armed',
      'shop:gear': 'done',
      lineup: 'done',
    }),
    { lineup: 'done' },
  );
});
test('the old tour flag no longer decides anything', () => {
  const st = memory({ 'kangs-three-tutorial-v3': 'seen' });
  assert.deepEqual(loadProgress(st), {});
  assert.equal(questionDefault(loadProgress(st)), 'lessons');
});
test('the tips level is a preference: three values, lessons by default, junk normalised', () => {
  assert.deepEqual(TIP_LEVELS, ['lessons', 'tips', 'off']);
  assert.deepEqual(normalizePrefs(null), { tips: 'lessons' });
  assert.deepEqual(normalizePrefs({ tips: 'off' }), { tips: 'off' });
  assert.deepEqual(normalizePrefs({ tips: 'loud' }), { tips: 'lessons' });
});
test('level gating: chapters need lessons, tips need anything but off, armed shows at any level', () => {
  const ch = lessonById('week'),
    tip = lessonById('lineup');
  assert.equal(allowed(ch, 'lessons', {}), true);
  assert.equal(allowed(ch, 'tips', {}), false);
  assert.equal(allowed(ch, 'off', {}), false);
  assert.equal(allowed(tip, 'lessons', {}), true);
  assert.equal(allowed(tip, 'tips', {}), true);
  assert.equal(allowed(tip, 'off', {}), false);
  for (const st of ['done', 'dismissed']) {
    assert.equal(allowed(ch, 'lessons', { week: st }), false, st);
    assert.equal(allowed(tip, 'tips', { lineup: st }), false, st);
  }
  for (const lv of TIP_LEVELS) {
    assert.equal(allowed(ch, lv, { week: 'armed' }), true, lv);
    assert.equal(allowed(tip, lv, { lineup: 'armed' }), true, lv);
  }
});
test('replay: a moment lesson is re-armed for its next moment, a Shop lesson opens at once on its tab', () => {
  const p = { week: 'done', 'shop:staff': 'dismissed' };
  const a = replayLesson(p, 'week');
  assert.deepEqual(a, { progress: { week: 'armed', 'shop:staff': 'dismissed' }, now: false, route: null });
  assert.deepEqual(p.week, 'done', 'the old map is not changed');
  const b = replayLesson(p, 'shop:staff');
  assert.deepEqual(b, { progress: { week: 'done', 'shop:staff': 'armed' }, now: true, route: 'staff' });
  for (const l of LESSONS)
    assert.equal(l.replay === 'now', l.chapter === 'shop', `${l.id}: only Shop lessons replay at once`);
  assert.equal(replayLesson(p, 'nope'), null);
});
test('Hide tips turns armed lessons into dismissed and keeps the rest; Undo has the old map and level', () => {
  const p = { week: 'done', tipoff: 'armed', lineup: 'armed', speed: 'dismissed' };
  const h = hideTips('lessons', p);
  assert.equal(h.level, 'off');
  assert.deepEqual(h.progress, {
    week: 'done',
    tipoff: 'dismissed',
    lineup: 'dismissed',
    speed: 'dismissed',
  });
  assert.deepEqual(h.undo, { level: 'lessons', progress: p });
  assert.notEqual(h.undo.progress, p, 'a copy');
});
test('Got it on the last regular step (or the retry after it) is done; on an earlier step, dismissed', () => {
  const w = lessonById('week');
  assert.equal(gotItStatus(w, 0), 'dismissed');
  assert.equal(gotItStatus(w, 1), 'dismissed');
  assert.equal(gotItStatus(w, 2), 'done');
  assert.equal(gotItStatus(w, 3), 'done', 'the conditional step after the last');
  assert.equal(gotItStatus(lessonById('quarter'), 0), 'done', 'one step');
  assert.equal(gotItStatus(lessonById('press'), 0), 'dismissed');
  assert.equal(gotItStatus(lessonById('press'), 1), 'done');
});
test('Shop snapshots change with that tab’s own purchases only', () => {
  const s = season();
  s.tokens = 5000;
  const before = Object.fromEntries(NAV.shop.map(v => [v, shopMark(s, v)]));
  E.hire(s, E.staff[0].key);
  assert.notEqual(shopMark(s, 'staff'), before.staff);
  assert.equal(shopMark(s, 'recruit'), before.recruit);
  assert.equal(shopMark(s, 'gear'), before.gear);
  E.recruit(s, s.pool[0].id);
  assert.notEqual(shopMark(s, 'recruit'), before.recruit);
  const r = shopMark(s, 'recruit');
  E.scoutProspect(s, s.pool[0].id);
  assert.notEqual(shopMark(s, 'recruit'), r, 'scouting a prospect counts');
  E.buyUpgrade(s, E.UPGRADES[0].key);
  assert.notEqual(shopMark(s, 'staff'), before.staff);
  s.kit = s.kit === 'home' ? 'away' : 'home';
  assert.notEqual(shopMark(s, 'locker'), before.locker);
  assert.equal(shopMark(s, 'skills'), before.skills);
  assert.equal(shopMark(null, 'gear'), '');
});
test('Shop lesson: a purchase before it started does not end it; one after it started does', () => {
  const s = season();
  s.tokens = 5000;
  const L = lessonById('shop:staff'),
    ctx = { view: 'staff', state: s, dialog: null };
  E.hire(s, E.staff[0].key); // e.g. the judge demo or an earlier visit
  const memo = L.begin(ctx);
  assert.equal(L.steps[0].done(ctx, memo), false);
  E.buyUpgrade(s, E.UPGRADES[0].key);
  assert.equal(L.steps[0].done(ctx, memo), true);
  const m2 = L.begin(ctx);
  assert.equal(L.steps[0].done({ ...ctx, view: 'home' }, m2), false, 'leaving before it was shown keeps it');
  assert.equal(L.abort({ ...ctx, view: 'home' }, m2), true);
  m2.shown = true;
  assert.equal(L.steps[0].done({ ...ctx, view: 'home' }, m2), true, 'leaving after it was shown ends it');
});
test('Shop lessons follow the Shop tabs in order', () => {
  assert.deepEqual(
    LESSONS.filter(l => l.chapter === 'shop').map(l => l.route),
    NAV.shop,
  );
});
test('Watch live after a held card: Got it, Escape, Not now and Hide tips restore it; playing on keeps the coach’s choice', () => {
  for (const how of ['gotit', 'escape', 'notnow', 'hide']) {
    assert.deepEqual(watchAfterCard(how, true, false), { auto: true, unpause: true }, how);
    assert.deepEqual(watchAfterCard(how, false, false), { auto: false, unpause: true }, how);
  }
  assert.deepEqual(
    watchAfterCard('played', false, true),
    { auto: true, unpause: false },
    'pressed Watch live',
  );
  assert.deepEqual(
    watchAfterCard('played', true, false),
    { auto: false, unpause: false },
    'pressed Next play',
  );
  assert.deepEqual(
    watchAfterCard('done', true, false),
    { auto: false, unpause: false },
    'did the step itself',
  );
  assert.deepEqual(
    watchAfterCard('ended', true, false),
    { auto: true, unpause: true },
    'a lesson that stops by itself (or is dropped) gives the game back as it was',
  );
});
test('the start question defaults to “No, show me” until week and tip-off are both done or dismissed', () => {
  assert.equal(questionDefault({}), 'lessons');
  assert.equal(questionDefault({ week: 'done' }), 'lessons');
  assert.equal(questionDefault({ week: 'done', tipoff: 'armed' }), 'lessons');
  assert.equal(questionDefault({ week: 'done', tipoff: 'dismissed' }), 'tips');
  assert.equal(questionDefault({ week: 'dismissed', tipoff: 'done' }), 'tips');
});

// A live match with the given possessions: each [home points, away points].
const match = (plays, extra = {}) => ({
  possession: plays.length,
  timeouts: E.TIMEOUTS,
  events: plays.map(([points, away]) => ({ points, away })),
  ...extra,
});
const team = (energy = 85) =>
  Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, starter: i < 5, minutes: i < 5 ? 28 : 4, energy }));
test('timeout symptom: an unanswered opponent run', () => {
  assert.equal(RUN_POINTS, 6);
  assert.equal(
    timeoutSymptom(
      match([
        [2, 0],
        [0, 2],
        [0, 3],
      ]),
      team(),
    ),
    null,
    '5 straight is not enough',
  );
  assert.deepEqual(
    timeoutSymptom(
      match([
        [2, 0],
        [0, 2],
        [0, 2],
        [0, 3],
      ]),
      team(),
    ),
    { kind: 'run', n: 7 },
  );
  // home scored, then the visitors answered in the same possession: only that answer counts
  assert.equal(
    timeoutSymptom(
      match([
        [0, 3],
        [0, 3],
        [2, 2],
      ]),
      team(),
    ),
    null,
  );
  assert.deepEqual(
    timeoutSymptom(
      match([
        [2, 3],
        [0, 3],
      ]),
      team(),
    ),
    { kind: 'run', n: 6 },
  );
  assert.equal(
    timeoutSymptom(
      match(
        [
          [0, 3],
          [0, 3],
        ],
        { timeouts: 0 },
      ),
      team(),
    ),
    null,
    'none left',
  );
  assert.equal(timeoutSymptom(null, team()), null);
});
test('timeout symptom: a tired starter, but not in the first possessions', () => {
  const tired = team();
  tired[2].energy = LOW_ENERGY - 5;
  tired[6].energy = 10; // a bench player does not count
  const early = Array.from({ length: TIRED_FROM - 1 }, () => [2, 2]);
  assert.equal(timeoutSymptom(match(early), tired), null);
  assert.deepEqual(timeoutSymptom(match([...early, [2, 2]]), tired), {
    kind: 'tired',
    player: 'P2',
    energy: LOW_ENERGY - 5,
  });
  const fine = team();
  fine[6].energy = 10;
  assert.equal(timeoutSymptom(match([...early, [2, 2]]), fine), null);
});
test('timeout symptom: the fallback at possession 12', () => {
  const even = n => Array.from({ length: n }, () => [2, 2]);
  assert.equal(timeoutSymptom(match(even(FALLBACK_AT - 1)), team()), null);
  assert.deepEqual(timeoutSymptom(match(even(FALLBACK_AT)), team()), { kind: 'fallback' });
});
test('a real season: the week chapter starts on Home in week 1 and its steps follow the real actions', () => {
  const s = season();
  s.deferPre = true;
  const W = lessonById('week');
  const ctx = (view, practice = {}) => ({
    view,
    state: s,
    dialog: null,
    practice: { plan: [], cap: 3, running: false, last: null, ...practice },
  });
  assert.equal(W.start(ctx('home'), false), true);
  assert.equal(W.start(ctx('roster'), false), false);
  const [home, plan, run, retry] = W.steps;
  assert.equal(home.done(ctx('home')), false);
  assert.equal(home.done(ctx('practice')), true, 'left Home for practice');
  const full = ctx('practice', { plan: ['shooting', 'recovery', 'study'] });
  assert.equal(plan.done(full), true, 'filled before the card showed: skipped');
  assert.equal(run.done(full), false);
  assert.equal(run.done(ctx('practice', { running: true })), true);
  const missed = ctx('practice', { plan: ['shooting'], last: { week: 0, missed: ['shooting'] } });
  assert.equal(retry.on(missed), true);
  assert.equal(retry.done(missed), false);
  assert.equal(retry.done(ctx('practice', { last: { week: 0, missed: [] } })), true, 'no miss: skipped');
  assert.equal(retry.on(ctx('practice', { running: true })), false, 'waits for the run to end');
  assert.equal(retry.done(ctx('practice', { running: true })), false);
  assert.equal(W.end(ctx('game')), true, 'going to the game ends the chapter');
  s.week = 3;
  assert.equal(W.start(ctx('home'), false), false, 'not a new season');
  assert.equal(W.start(ctx('home'), true), true, 'armed: the next fresh practice week');
});
