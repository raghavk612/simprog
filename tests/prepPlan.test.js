import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { PREP, planEffects, prepBlock, fillPlan, lastWeekPlan, suggestedPlan } from '../src/prepPlan.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
const game = () => {
  const s = E.createGame(data, 'Prep', 'standard', 11);
  E.autoLineup(s);
  return s;
};
const playWeek = (s, picks) => {
  for (const k of picks)
    if (k === 'film') E.scout(s);
    else if (k === 'fundraise') E.talk(s, 'fundraise');
    else E.train(s, k);
  while (s.actions > 0) E.train(s, 'recovery');
  E.autoLineup(s);
  E.startMatch(s);
  while (s.match) E.possession(s);
};
const fx = (s, k) => Object.fromEntries(planEffects(s, k).map(c => [c.k, c.v]));

test('each Prep pick lists what it changes, with the staff bonuses that apply', () => {
  const s = game();
  assert.deepEqual(fx(s, 'shooting'), { skill: 3, energy: -10, morale: 1, chem: 1, gpa: -0.03 });
  assert.deepEqual(fx(s, 'recovery'), { energy: 20, morale: 2 });
  assert.deepEqual(fx(s, 'fundraise'), { tokens: 180, fans: 40, energy: -5 });
  assert.deepEqual(fx(s, 'film'), { tokens: -50 });
  s.assistant = 'development';
  assert.equal(fx(s, 'shooting').skill, 4);
  s.assistant = 'recovery';
  assert.equal(fx(s, 'recovery').energy, 28);
  s.assistant = 'culture';
  assert.deepEqual(fx(s, 'bond'), { energy: 6, morale: 11, chem: 11 });
  s.upgrades = ['film', 'facility'];
  assert.deepEqual(fx(s, 'film'), {});
  assert.equal(fx(s, 'defense').skill, 2.2);
});

test('the clinic and the film cost match what the engine does', () => {
  const s = game(),
    t0 = s.tokens,
    f0 = s.fans;
  E.talk(s, 'fundraise');
  assert.equal(s.tokens - t0, fx(game(), 'fundraise').tokens);
  assert.equal(s.fans - f0, fx(game(), 'fundraise').fans);
  const t1 = s.tokens;
  E.scout(s);
  assert.equal(s.tokens - t1, fx(game(), 'film').tokens);
});

test('a pick is blocked once it is done this week, or when the film is unaffordable', () => {
  const s = game();
  for (const k of PREP) assert.equal(prepBlock(s, k), null, k);
  s.tokens = 20;
  assert.deepEqual(prepBlock(s, 'film'), { key: 'office.needTokens', n: 30 });
  s.tokens = 500;
  E.scout(s);
  assert.deepEqual(prepBlock(s, 'film'), { key: 'prep.filmDone' });
  E.talk(s, 'fundraise');
  assert.deepEqual(prepBlock(s, 'fundraise'), { key: 'office.checkDone' });
});

test('filling a plan only adds to empty slots and never replaces a pick', () => {
  const s = game();
  assert.deepEqual(fillPlan(s, ['bond'], ['shooting', 'bond', 'defense', 'study']), [
    'bond',
    'shooting',
    'defense',
  ]);
  assert.deepEqual(fillPlan(s, ['bond', 'study', 'recovery'], ['shooting']), ['bond', 'study', 'recovery']);
  s.actions = 2;
  assert.deepEqual(fillPlan(s, [], ['shooting', 'defense', 'study']), ['shooting', 'defense']);
  s.tokens = 0;
  assert.deepEqual(fillPlan(s, [], ['film', 'study']), ['study'], 'a blocked pick is skipped');
  assert.deepEqual(fillPlan(s, [], ['nope', 'study']), ['study'], 'an unknown key is skipped');
  const mine = ['bond'];
  fillPlan(s, mine, ['study']);
  assert.deepEqual(mine, ['bond'], 'the plan passed in is not changed');
});

test('last week’s plan is what ran last week, in order', () => {
  const s = game();
  assert.deepEqual(lastWeekPlan(s), []);
  playWeek(s, ['film', 'shooting', 'fundraise']);
  assert.deepEqual(lastWeekPlan(s), ['film', 'shooting', 'fundraise']);
  playWeek(s, ['bond']);
  assert.deepEqual(lastWeekPlan(s), ['bond', 'recovery']);
});

test('the suggested plan answers the team’s needs first', () => {
  const s = game();
  const rot = s.players.filter(p => p.starter);
  assert.deepEqual(suggestedPlan(s).slice(0, 3), ['film', 'shooting', 'defense']);
  rot[0].energy = 30;
  assert.equal(suggestedPlan(s)[0], 'recovery');
  rot[0].energy = 90;
  rot[1].gpa = 2.1;
  assert.equal(suggestedPlan(s)[0], 'study');
  rot[1].gpa = 3;
  s.chemistry = 40;
  assert.ok(suggestedPlan(s).indexOf('bond') < suggestedPlan(s).indexOf('shooting'));
  assert.equal(new Set(suggestedPlan(s)).size, suggestedPlan(s).length, 'no key twice');
});
