import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { scorebugData, seasonTrack } from '../src/ui/scorebug.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url), 'utf8'));
const season = () => {
  const s = E.createGame(data, 'Bug', 'standard', 7);
  E.autoLineup(s);
  return s;
};
const playOne = s => {
  E.endBreak(s);
  E.startMatch(s);
  while (s.match) E.possession(s);
  return s;
};

test('the season track has one segment per scheduled game: played, the next one, and the rest', () => {
  const s = season();
  const fresh = seasonTrack(s);
  assert.equal(fresh.length, s.schedule.length);
  assert.equal(fresh[0], 'next');
  assert.ok(fresh.slice(1).every(x => x === 'left'));
  playOne(s);
  const after = seasonTrack(s);
  assert.deepEqual(after.slice(0, 2), ['played', 'next']);
  assert.equal(after.filter(x => x === 'played').length, s.week);
});
test('a finished season has no next segment, even when it ended early', () => {
  const s = season();
  s.week = 9;
  s.finished = true;
  const track = seasonTrack(s);
  assert.equal(track.filter(x => x === 'played').length, 9);
  assert.ok(!track.includes('next'));
});
test('the scorebug reads the next game, record, tokens and slots from the save', () => {
  const s = playOne(season());
  const d = scorebugData(s);
  const g = s.schedule[s.week];
  assert.deepEqual(d.next, {
    name: g.opponent,
    home: !!g.home,
    crest: d.next.crest,
  });
  assert.match(d.next.crest, /images\/opponents\/[a-z-]+\.png$/, 'the opponent has a crest image');
  assert.equal(d.wins, s.wins);
  assert.equal(d.losses, s.losses);
  assert.equal(d.tokens, s.tokens);
  assert.equal(d.slots, s.actions);
  assert.equal(d.slotsMax, E.PREP_SLOTS);
  assert.deepEqual(d.game, { n: 2, total: s.schedule.length }, 'GM 2/17 after one game');
  assert.deepEqual(d.track, seasonTrack(s));
});
test('an opponent without a crest gets null, and a finished season has no next game', () => {
  const s = season();
  s.schedule[0] = { ...s.schedule[0], opponent: 'Nowhere Prep' };
  assert.equal(scorebugData(s).next.crest, null);
  s.finished = true;
  const d = scorebugData(s);
  assert.equal(d.next, null);
  assert.equal(d.game, null);
});
