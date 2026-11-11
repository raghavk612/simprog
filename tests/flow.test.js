import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import * as P from '../src/press.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
const game = (d = 'standard') => {
  const s = E.createGame(data, 'Flow', d, 7);
  E.autoLineup(s);
  return s;
};
const play = s => {
  while (s.actions > 0) E.train(s, 'recovery');
  E.autoLineup(s);
  E.startMatch(s);
  while (s.match) E.possession(s);
};

test('a season has three breaks: preseason, midseason and before the playoffs', () => {
  for (const d of ['rookie', 'standard', 'elite']) {
    const s = game(d),
      w = E.breakWeeks(s),
      cut = E.seasonPlan(s).cut;
    assert.equal(w.pre, 0);
    assert.equal(w.playoff, cut);
    assert.ok(w.mid > w.pre && w.mid < w.playoff, d);
    const seen = [];
    let g = 0;
    while (!s.finished && g++ < 40) {
      const b = E.breakDue(s);
      if (b) {
        seen.push(b);
        assert.equal(E.nextStep(s).id, 'break');
        E.endBreak(s);
        assert.equal(E.breakDue(s), null, 'a break ends once');
      }
      play(s);
      s.press = { week: s.week, questions: [], done: true };
    }
    assert.deepEqual(seen.slice(0, 2), ['pre', 'mid'], d);
    if (s.results.length > cut) assert.ok(seen.includes('playoff'), d);
  }
});
test('with the first-game tutorial, preseason waits for game 1 to be played', () => {
  const s = game();
  s.deferPre = true;
  assert.equal(E.breakDue(s), null);
  assert.equal(E.nextStep(s).id, 'practice');
  play(s);
  s.press = { week: s.week, questions: [], done: true };
  assert.equal(E.breakDue(s), 'pre');
});
test('the timeline lists what comes after the next step, in order', () => {
  const s = game(),
    o = i => s.schedule[i].opponent;
  assert.deepEqual(
    E.roadmap(s),
    [{ id: 'prepare', opp: o(0) }, { id: 'play', opp: o(0) }, { id: 'post' }, { id: 'prepare', opp: o(1) }],
    'preseason is next, then the first week',
  );
  E.endBreak(s);
  assert.deepEqual(
    E.roadmap(s, 3),
    [{ id: 'play', opp: o(0) }, { id: 'post' }, { id: 'prepare', opp: o(1) }],
    'preparing: play is next',
  );
  s.actions = 0;
  assert.deepEqual(E.roadmap(s, 2), [{ id: 'post' }, { id: 'prepare', opp: o(1) }], 'ready for tip-off');
  const w = E.breakWeeks(s);
  s.week = w.mid;
  s.actions = 3;
  assert.deepEqual(E.roadmap(s, 1), [{ id: 'prepare', opp: o(w.mid) }], 'on the break itself');
  s.week = w.mid - 1;
  s.actions = 0;
  assert.deepEqual(
    E.roadmap(s, 3),
    [{ id: 'post' }, { id: 'mid' }, { id: 'prepare', opp: o(w.mid) }],
    'a coming break sits in front of its game',
  );
  s.week = s.schedule.length - 1;
  assert.equal(E.roadmap(s, 4).at(-1).id, 'end');
  s.finished = true;
  assert.deepEqual(E.roadmap(s), []);
});
test('saves keep the breaks, old saves still load, and hostile values are refused', () => {
  const s = game();
  E.endBreak(s);
  s.deferPre = false;
  assert.ok(E.validSave(JSON.parse(JSON.stringify(s))));
  const old = game();
  delete old.breaksDone;
  delete old.deferPre;
  assert.ok(E.validSave(old));
  for (const bad of [
    x => {
      x.breaksDone = ['pre', 'evil'];
    },
    x => {
      x.breaksDone = 'pre';
    },
    x => {
      x.breaksDone = ['pre', 'pre', 'pre', 'pre'];
    },
    x => {
      x.deferPre = 'yes';
    },
  ]) {
    const c = structuredClone(s);
    bad(c);
    assert.equal(E.validSave(c), false);
  }
});
test('the press room asks at most two questions in the weekly flow', () => {
  const s = game();
  E.endBreak(s);
  play(s);
  const pr = P.startPress(s, 2);
  assert.ok(pr.questions.length >= 1 && pr.questions.length <= 2);
  const again = game();
  E.endBreak(again);
  play(again);
  assert.ok(P.startPress(again).questions.length >= 3, 'the full press room still exists');
});
test('the judge demo jump skips every break', () => {
  const s = game();
  E.playTo(s, 3);
  assert.deepEqual(s.breaksDone, E.BREAK_IDS);
  assert.equal(E.breakDue(s), null);
});
