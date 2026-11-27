import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { standingsRows } from '../src/ui/lists.js';
import { standingsRank } from '../src/recap.js';
import { seasonStrip, bracketSeed, railModel, RAIL_VIEWS } from '../src/ui/seasonModel.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url), 'utf8'));
const season = (difficulty = 'standard') => {
  const s = E.createGame(data, 'Strip', difficulty, 7);
  E.autoLineup(s);
  return s;
};
const playOne = s => {
  E.endBreak(s);
  if (s.pendingEvent) s.pendingEvent = null;
  E.startMatch(s);
  while (s.match) E.possession(s);
  if (s.press) s.press.done = true;
  else s.press = { week: s.week, done: true };
  return s;
};

test('the season strip has one card per scheduled game, numbered 01.., with the opponent and home or away', () => {
  const s = season();
  const strip = seasonStrip(s);
  assert.equal(strip.length, s.schedule.length);
  assert.equal(strip.length, 17, 'the JV season the game starts with');
  assert.deepEqual(
    strip.map(c => c.n),
    s.schedule.map((_, i) => String(i + 1).padStart(2, '0')),
  );
  strip.forEach((c, i) => {
    assert.equal(c.opponent, s.schedule[i].opponent);
    assert.equal(c.home, !!s.schedule[i].home);
    assert.equal(c.date, s.schedule[i].date);
  });
  assert.equal(seasonStrip(season('rookie')).length, season('rookie').schedule.length);
});
test('before a game is played the first card is next and every other is still to come, with no result', () => {
  const strip = seasonStrip(season());
  assert.equal(strip[0].status, 'next');
  assert.ok(strip.slice(1).every(c => c.status === 'left'));
  assert.ok(strip.every(c => c.result === null));
});
test('a played game shows its result (won, the Kangs score first, the result index for its replay)', () => {
  const s = playOne(season());
  const strip = seasonStrip(s),
    r = s.results[0];
  assert.equal(strip[0].status, 'played');
  assert.deepEqual(strip[0].result, { won: r.won, for: r.home, against: r.away, index: 0 });
  assert.equal(strip[1].status, 'next');
  assert.equal(strip.filter(c => c.status === 'next').length, 1);
});
test('the strip marks the elimination run, and a finished season has no next card', () => {
  const s = season(),
    P = E.seasonPlan(s),
    strip = seasonStrip(s);
  assert.deepEqual(
    strip.map(c => c.run),
    s.schedule.map((_, i) => i >= P.cut),
  );
  s.week = 9;
  s.finished = true;
  assert.ok(!seasonStrip(s).some(c => c.status === 'next'));
});

test('your seed if the season ended today is the Standings page’s own place, shown only before the run', () => {
  const s = playOne(season());
  const seed = bracketSeed(s),
    { rank, of } = standingsRank(s);
  assert.deepEqual(seed, { seed: rank, of });
  assert.equal(seed.seed, standingsRows(s.standings).find(r => r.you).rank);
  s.week = E.seasonPlan(s).cut;
  assert.equal(bracketSeed(s), null, 'once the run starts the bracket is real, not a projection');
  const done = season();
  done.finished = true;
  assert.equal(bracketSeed(done), null);
});

test('the context rail is on Journal, Bracket, Skills and Standings only', () => {
  assert.deepEqual(RAIL_VIEWS, ['season', 'bracket', 'standings', 'skills']);
  const s = season();
  for (const v of ['home', 'practice', 'game', 'roster', 'data', 'recruit', 'staff', 'gear', 'locker'])
    assert.equal(railModel(s, v), null, v);
  for (const v of RAIL_VIEWS) assert.ok(railModel(s, v), v);
});
test('the rail’s next game: the opponent, home or away, their record in the standings and the scouting line', () => {
  const s = playOne(season());
  const m = railModel(s, 'bracket'),
    g = s.schedule[s.week];
  assert.equal(m.next.name, g.opponent);
  assert.equal(m.next.home, !!g.home);
  assert.deepEqual(m.next.record, { w: s.standings[g.opponent].w, l: s.standings[g.opponent].l });
  assert.equal(m.next.style, null, 'unscouted');
  s.scouted = true;
  assert.equal(railModel(s, 'bracket').next.style, E.opponent(s).style);
  s.finished = true;
  assert.equal(railModel(s, 'bracket').next, null);
});
test('the rail’s last result and top four, each left out on the page that already shows it', () => {
  const fresh = season();
  assert.equal(railModel(fresh, 'bracket').last, null, 'no game played yet');
  const s = playOne(season());
  const m = railModel(s, 'bracket'),
    r = s.results.at(-1);
  assert.deepEqual(m.last, {
    index: s.results.length - 1,
    opponent: r.opponent,
    won: r.won,
    for: r.home,
    against: r.away,
    date: r.date,
  });
  const rows = standingsRows(s.standings);
  assert.deepEqual(
    m.top.rows.map(x => x.name),
    rows.slice(0, 4).map(x => x.name),
  );
  assert.deepEqual(
    m.top.rows.map(x => x.rank),
    rows.slice(0, 4).map(x => x.rank),
  );
  assert.equal(railModel(s, 'season').last, null, 'Journal lists the results itself');
  assert.equal(railModel(s, 'standings').top, null, 'Standings is the table itself');
});
test('the rail never repeats a scorebug number: no W–L for the Kangs, no tokens, slots or game count', () => {
  const s = playOne(season());
  // put the Kangs in the top four, where a record would be tempting
  s.standings['Lake Washington'].w = 30;
  const m = railModel(s, 'bracket'),
    you = m.top.rows.find(x => x.you);
  assert.ok(you, 'the Kangs are in the top four');
  assert.ok(!('w' in you) && !('l' in you), 'the Kangs row has no record');
  assert.equal(m.top.place, null, 'in the top four: no separate place line');
  const flat = JSON.stringify(m);
  for (const k of ['tokens', 'slots', 'actions', 'wins', 'losses', 'game'])
    assert.ok(!flat.includes(`"${k}":`), k);
  s.standings['Lake Washington'].w = 0;
  s.standings['Lake Washington'].l = 30;
  const low = railModel(s, 'bracket');
  assert.ok(!low.top.rows.some(x => x.you));
  assert.deepEqual(low.top.place, standingsRank(s));
});
test('the rail holds secondary links only, never the page the purple way forward opens nor the page itself', () => {
  const s = playOne(season());
  for (const v of RAIL_VIEWS) {
    const m = railModel(s, v),
      way = E.nextStep(s).view;
    const links = [m.next?.link, m.top?.link].filter(Boolean);
    for (const l of links) {
      assert.notEqual(l, way, `${v}: ${l} is the way forward`);
      assert.notEqual(l, v, `${v}: links to itself`);
    }
  }
  // unscouted with slots left: the scout link goes to Prep, unless Prep is the way forward
  s.pendingEvent = null;
  s.press = { week: s.week, done: true };
  s.actions = 2;
  s.scouted = false;
  assert.equal(E.nextStep(s).view, 'practice');
  assert.notEqual(railModel(s, 'bracket').next.link, 'practice');
  s.actions = 0;
  assert.equal(E.nextStep(s).view, 'game');
  assert.equal(
    railModel(s, 'bracket').next.link,
    null,
    'Game day is the way forward and nothing is left to scout',
  );
  assert.equal(railModel(s, 'bracket').top.link, 'standings');
});
