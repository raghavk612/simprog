import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { NAV } from '../src/ui/nav.js';
import { headModel, headChips, headEnters, HERO_GROUPS } from '../src/ui/pageHead.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url), 'utf8'));
const season = () => {
  const s = E.createGame(data, 'Head', 'standard', 7);
  E.autoLineup(s);
  return s;
};
const routes = Object.values(NAV).flat();

test('every page but Home has the shared header', () => {
  const s = season();
  for (const v of routes) {
    const m = headModel(v, s);
    if (v === 'home') assert.equal(m, null, 'Home keeps the gym');
    else assert.ok(m, v);
  }
  assert.equal(headModel('landing', s), null);
  assert.ok(
    headModel('game', s),
    'Game day before tip-off (the live game and replays hide it, body.live-match)',
  );
});

test("the ghost word is the page's own name, and the render is its group's", () => {
  const s = season();
  for (const [g, pages] of Object.entries(NAV))
    for (const v of pages.filter(p => p !== 'home')) {
      const m = headModel(v, s);
      assert.equal(m.ghost, `nav.${v}`, v);
      assert.equal(m.hero, `hero-${g}`, v);
    }
  assert.deepEqual(HERO_GROUPS, ['week', 'team', 'season', 'shop']);
  for (const g of HERO_GROUPS)
    for (const f of [`${g}.avif`, `${g}.webp`, `${g}@2x.avif`, `${g}@2x.webp`])
      assert.ok(fs.existsSync(new URL(`../public/images/ui/hero-${f}`, import.meta.url)), f);
});

test("Prep's chips are the team's average energy and the opponent's rating, never a scorebug number", () => {
  const s = season();
  const chips = headChips('practice', s);
  assert.deepEqual(
    chips.map(c => c.id),
    ['energy', 'opp'],
  );
  assert.equal(chips[0].value, Math.round(E.mean(s.players, 'energy')));
  assert.equal(chips[1].value, Math.round(E.opponent(s).rating));
  assert.ok(chips.length <= 3);
  for (const v of routes)
    for (const c of headChips(v, s))
      assert.ok(!['record', 'wins', 'losses', 'tokens', 'slots', 'game'].includes(c.id), `${v}: ${c.id}`);
  s.players[0].energy -= 30;
  assert.equal(headChips('practice', s)[0].value, Math.round(E.mean(s.players, 'energy')), 'read live');
  assert.deepEqual(headChips('roster', s), [], 'other pages have none for now');
  s.finished = true;
  assert.deepEqual(
    headChips('practice', s).map(c => c.id),
    ['energy'],
    'no opponent once the season is over',
  );
});

test('the header enters only when the view changes, never on the way to play or under reduced motion', () => {
  const tab = { from: 'roster', to: 'standings' };
  assert.equal(headEnters(tab), true, 'a tab click to another page');
  assert.equal(headEnters({ from: 'standings', to: 'standings' }), false, 're-render of the same page');
  assert.equal(headEnters({ ...tab, reduced: true }), false, 'reduced motion');
  assert.equal(headEnters({ ...tab, way: true }), false, 'the purple way forward (Continue, the next step)');
  assert.equal(headEnters({ from: 'practice', to: 'game' }), false, 'Game day: Tip off is on it');
  assert.equal(headEnters({ from: 'landing', to: 'practice' }), false, 'Continue from the title');
  assert.equal(headEnters({ from: null, to: 'practice' }), false, 'first paint');
  assert.equal(headEnters({ from: 'roster', to: 'home' }), false, 'Home has no header');
  assert.equal(headEnters({ from: 'home', to: 'practice' }), true);
});
