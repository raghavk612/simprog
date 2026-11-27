import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { tabMorphs, scoreValues, scoreFlash, NAV_BUTTONS } from '../src/ui/navMotion.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url), 'utf8'));
const season = () => {
  const s = E.createGame(data, 'Flash', 'standard', 7);
  E.autoLineup(s);
  return s;
};

// A nav click from Journal to Bracket, in a browser with View Transitions and motion on.
const click = { nav: true, from: 'season', to: 'bracket', supported: true, reduced: false };

test('the open tab morphs only when a nav button is clicked', () => {
  assert.equal(tabMorphs(click), true);
  assert.equal(tabMorphs({ ...click, from: 'bracket', to: 'recruit' }), true, 'to another group');
  assert.equal(
    tabMorphs({ ...click, nav: false }),
    false,
    'any other button that opens a page (rail links, the break foot)',
  );
  assert.equal(tabMorphs({ ...click, to: 'season' }), false, 'the tab that is already open: nothing moves');
});

test('no morph on the way to play: Continue from the title, the purple way forward, Game day, Tip off', () => {
  assert.equal(tabMorphs({ ...click, from: 'landing', to: 'home' }), false, 'Continue');
  assert.equal(tabMorphs({ ...click, from: null, to: 'home' }), false, 'the first paint');
  assert.equal(tabMorphs({ ...click, to: 'game' }), false, "Game day's tab: Tip off is there");
  assert.equal(
    tabMorphs({ ...click, nav: false, from: 'game', to: 'game' }),
    false,
    'Tip off redraws Game day',
  );
});

test('no morph under reduced motion or where the browser has no View Transitions', () => {
  assert.equal(tabMorphs({ ...click, reduced: true }), false);
  assert.equal(tabMorphs({ ...click, supported: false }), false);
});

test('the nav buttons are the top groups and the sub-tabs', () => {
  assert.match(NAV_BUTTONS, /\.nav-item/);
  assert.match(NAV_BUTTONS, /\.sub-item/);
});

test('the flash compares the record and the tokens', () => {
  const s = season();
  assert.deepEqual(scoreValues(s), { rec: `${s.wins}-${s.losses}`, tokens: s.tokens });
  assert.equal(scoreValues(null), null);
});

test('a value flashes once, on the render where it changed', () => {
  const s = season(),
    first = scoreFlash(null, s);
  assert.deepEqual(first.keys, [], 'never on the first paint');
  assert.deepEqual(scoreFlash(first.memo, s).keys, [], 'a redraw with the same numbers');
  s.tokens -= 150;
  const bought = scoreFlash(first.memo, s);
  assert.deepEqual(bought.keys, ['tokens']);
  assert.deepEqual(scoreFlash(bought.memo, s).keys, [], 'the next redraw does not flash again');
  s.wins += 1;
  s.tokens += 200;
  assert.deepEqual(scoreFlash(bought.memo, s).keys, ['rec', 'tokens'], 'a win with its reward');
});

test('a change made while the scorebug is hidden flashes when it shows again', () => {
  const s = season(),
    seen = scoreFlash(null, s).memo;
  s.wins += 1;
  const live = scoreFlash(seen, s, { shown: false });
  assert.deepEqual(live.keys, [], 'the live game hides the band');
  assert.equal(live.memo, seen, 'the last value seen is kept');
  assert.deepEqual(scoreFlash(live.memo, s).keys, ['rec'], 'back on a page with the scorebug');
});

test('the title screen forgets the numbers: a new season does not flash', () => {
  const s = season(),
    seen = scoreFlash(null, s).memo;
  const title = scoreFlash(seen, null, { shown: false });
  assert.equal(title.memo, null);
  const fresh = season();
  fresh.tokens += 1;
  assert.deepEqual(scoreFlash(title.memo, fresh).keys, []);
});

test('no flash under reduced motion or Fewer flashes, and the value is still remembered', () => {
  const s = season(),
    seen = scoreFlash(null, s).memo;
  s.tokens -= 60;
  for (const opt of [{ reduced: true }, { noFlash: true }]) {
    const r = scoreFlash(seen, s, opt);
    assert.deepEqual(r.keys, [], JSON.stringify(opt));
    assert.deepEqual(r.memo, scoreValues(s));
  }
});
