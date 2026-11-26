// Game day before tip-off: what tipping off now would skip, and the press room costing the same either way.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import * as P from '../src/press.js';
import { energyLevel, moraleLevel, matchupLevel, EVEN_WITHIN, energyBar } from '../src/teamLabels.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
const game = () => {
  const s = E.createGame(data, 'Gameday', 'standard', 7);
  E.autoLineup(s);
  return s;
};
// One game played and the press room for the week after it opened (as postGame() does).
const afterGame = () => {
  const s = game();
  E.endBreak(s);
  E.startMatch(s);
  while (s.match) E.possession(s);
  s.pendingEvent = null;
  P.startPress(s);
  E.autoLineup(s);
  return s;
};

test('tipping off with the press room pending costs what Skip costs: fans −10, logged, press done', () => {
  const a = afterGame(),
    b = structuredClone(a);
  assert.equal(E.nextStep(a).id, 'press');
  b.fans = a.fans = 200;
  P.skipPress(a);
  E.startMatch(b);
  assert.equal(b.fans, a.fans, 'the same fans either way');
  assert.equal(b.fans, 190);
  assert.equal(b.press.done, true);
  assert.ok(
    b.log.some(x => x.k === 'pressSkip'),
    'the skip is in the decision trail',
  );
});

test('tipping off once the press room is done costs no fans', () => {
  const s = afterGame();
  while (!s.press.done) {
    const i = s.press.questions.findIndex(x => !x.answer);
    P.answerPress(s, i, P.previewPress(s)[i].answers[0].id);
  }
  s.nextMods = null;
  const fans = s.fans;
  E.startMatch(s);
  assert.equal(s.fans, fans);
  assert.ok(!s.log.some(x => x.k === 'pressSkip'));
});

test('a press room never started for this week counts as pending too (a reload before it opened)', () => {
  const s = afterGame();
  s.press = null;
  s.fans = 200;
  assert.equal(E.nextStep(s).id, 'press');
  assert.ok(E.tipoffSkips(s).skips.some(x => x.id === 'press'));
  E.startMatch(s);
  assert.equal(s.fans, 190);
});

test('the skip line lists unused prep slots, the press room and an open break, from state', () => {
  const s = game(); // preseason open, 3 slots, no game yet
  assert.deepEqual(E.tipoffSkips(s), {
    blocked: null,
    skips: [
      { id: 'slots', n: 3 },
      { id: 'break', break: 'pre' },
    ],
  });
  const t = afterGame();
  t.actions = 1;
  assert.deepEqual(E.tipoffSkips(t).skips, [
    { id: 'slots', n: 1 },
    { id: 'press', n: E.PRESS_SKIP_FANS },
  ]);
});

test('a clean week skips nothing and tip-off is the next step', () => {
  const s = game();
  E.endBreak(s);
  while (s.actions > 0) E.train(s, 'recovery');
  E.autoLineup(s);
  assert.equal(E.nextStep(s).id, 'tipoff');
  assert.deepEqual(E.tipoffSkips(s), { blocked: null, skips: [] });
});

test('tip-off is blocked, with the reason, by the inbox, an ineligible player or an illegal rotation', () => {
  const s = game();
  s.pendingEvent = { id: 'x' };
  assert.equal(E.tipoffSkips(s).blocked, 'inbox');
  s.pendingEvent = null;
  s.players.find(p => p.starter).injury = 2;
  assert.equal(E.tipoffSkips(s).blocked, 'issues');
  const u = game();
  u.players.find(p => p.starter).starter = false;
  assert.equal(E.tipoffSkips(u).blocked, 'lineup');
  assert.throws(() => E.startMatch(u));
});

test('energy and morale words use one set of thresholds', () => {
  assert.deepEqual([90, 80, 79, 55, 54, 30, 29, 0].map(energyLevel), [
    'fresh',
    'fresh',
    'rested',
    'rested',
    'tired',
    'tired',
    'exhausted',
    'exhausted',
  ]);
  assert.deepEqual([80, 79, 60, 59, 40, 39].map(moraleLevel), [
    'fired',
    'content',
    'content',
    'restless',
    'restless',
    'unhappy',
  ]);
});

test('the matchup word compares team skill on one scale: favoured, even or underdog', () => {
  assert.equal(matchupLevel(76, 77), 'even', 'one point apart');
  assert.equal(matchupLevel(76.6, 76.4 + EVEN_WITHIN + 1), 'even', 'compared as shown: 77 and 79');
  assert.equal(matchupLevel(80, 80 - EVEN_WITHIN - 1), 'favoured');
  assert.equal(matchupLevel(70, 70 + EVEN_WITHIN + 1), 'underdog');
  const s = game(),
    M = E.modelSnapshot(s);
  assert.ok(['favoured', 'even', 'underdog'].includes(matchupLevel(M.skill, M.rating)));
});

test('one energy bar for Game day and Team, coloured by the energy word', () => {
  assert.match(energyBar(90), /class="bar energy-fresh"/);
  assert.match(energyBar(60), /class="bar energy-rested"/);
  assert.match(energyBar(20), /class="bar energy-exhausted"/);
  assert.match(energyBar(60.4), /width:60%/, 'the bar is as long as the number shown');
});
