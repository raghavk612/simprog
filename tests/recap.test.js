import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { weekSnapshot, whatChanged } from '../src/recap.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
const game = () => {
  const s = E.createGame(data, 'Recap', 'standard', 5);
  E.autoLineup(s);
  return s;
};
const snap = (players, more = {}) => ({
  week: 1,
  tokens: 500,
  rank: 3,
  games: 1,
  teams: 9,
  earned: null,
  players,
  ...more,
});
const pl = (id, ovr, injury = 0) => ({ id, name: `P${id}`, ovr, injury });

test('a week’s recap ranks ratings, then injuries, then tokens, then the standings', () => {
  const before = snap([pl(1, 70), pl(2, 60), pl(3, 80, 1)]),
    after = snap([pl(1, 72), pl(2, 60, 1), pl(3, 80)], { rank: 2, earned: 190, tokens: 640 });
  assert.deepEqual(whatChanged(before, after), [
    { k: 'ovr', id: 1, name: 'P1', from: 70, to: 72 },
    { k: 'injured', id: 2, name: 'P2', n: 1 },
    { k: 'healed', id: 3, name: 'P3' },
    { k: 'tokens', v: 190 },
    { k: 'rank', from: 3, to: 2, of: 9 },
  ]);
});

test('ratings show the three biggest changes and count the rest', () => {
  const before = snap([pl(1, 70), pl(2, 70), pl(3, 70), pl(4, 70), pl(5, 70), pl(6, 70)]),
    after = snap([pl(1, 71), pl(2, 74), pl(3, 68), pl(4, 72), pl(5, 71), pl(6, 70)]);
  const list = whatChanged(before, after);
  assert.deepEqual(
    list.filter(x => x.k === 'ovr').map(x => x.id),
    [2, 3, 4],
  );
  assert.deepEqual(
    list.find(x => x.k === 'ovrMore'),
    { k: 'ovrMore', n: 2 },
  );
});

test('players who joined or left during the week are not compared', () => {
  const list = whatChanged(snap([pl(1, 70), pl(2, 60)]), snap([pl(1, 70), pl(3, 50, 2)]));
  assert.equal(list.filter(x => x.k === 'ovr' || x.k === 'injured').length, 0);
});

test('without the game’s income the tokens line is the change in the balance', () => {
  const list = whatChanged(snap([]), snap([], { tokens: 430 }));
  assert.deepEqual(
    list.find(x => x.k === 'tokens'),
    { k: 'tokens', v: -70 },
  );
});

test('before the first game there is no earlier place in the standings', () => {
  const list = whatChanged(snap([], { games: 0, rank: 1 }), snap([], { rank: 4 }));
  assert.deepEqual(list.at(-1), { k: 'rank', from: null, to: 4, of: 9 });
});

test('a real week: practice raises ratings and the game’s income and place are reported', () => {
  const s = game(),
    before = weekSnapshot(s);
  E.train(s, 'shooting');
  E.train(s, 'shooting');
  E.train(s, 'defense');
  E.autoLineup(s);
  E.startMatch(s);
  while (s.match) E.possession(s);
  const after = weekSnapshot(s),
    list = whatChanged(before, after),
    budget = s.log.find(e => e.k === 'budget');
  assert.equal(list[0].k, 'ovr');
  assert.ok(list[0].to > list[0].from);
  assert.deepEqual(
    list.find(x => x.k === 'tokens'),
    { k: 'tokens', v: budget.p.net },
  );
  const rank = list.at(-1);
  assert.equal(rank.k, 'rank');
  assert.equal(rank.from, null);
  assert.equal(rank.of, Object.keys(s.standings).length);
  assert.ok(rank.to >= 1 && rank.to <= rank.of);
  assert.equal(before.week, 0);
  assert.equal(after.week, 1);
});
