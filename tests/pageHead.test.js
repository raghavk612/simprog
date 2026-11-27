import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { NAV } from '../src/ui/nav.js';
import {
  headModel,
  headChips,
  headEnters,
  ghostFit,
  ghostSplit,
  GHOST_FLOOR,
  HERO_GROUPS,
  readyFigures,
} from '../src/ui/pageHead.js';
import * as P from '../src/press.js';

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

test("Prep's chips are the rotation's energy and the opponent's strength the game model uses, never a scorebug number", () => {
  const s = season();
  const chips = headChips('practice', s),
    M = E.modelSnapshot(s);
  assert.deepEqual(
    chips.map(c => [c.id, c.label]),
    [
      ['energy', 'tipoff.energy'],
      ['opp', 'head.opp'],
    ],
  );
  assert.equal(chips[0].value, Math.round(M.energy), "the figure Game day's rotation energy comes from");
  assert.equal(chips[1].value, Math.round(M.rating));
  assert.ok(chips.length <= 3);
  for (const v of routes)
    for (const c of headChips(v, s))
      assert.ok(!['record', 'wins', 'losses', 'tokens', 'slots', 'game'].includes(c.id), `${v}: ${c.id}`);
  // the bench does not count: tiring a player outside the rotation leaves the chip alone
  const bench = s.players.find(p => !(p.minutes > 0));
  bench.energy = 0;
  assert.equal(headChips('practice', s)[0].value, chips[0].value, 'bench energy is not in it');
  const five = s.players.find(p => p.minutes > 0);
  five.energy -= 40;
  assert.equal(headChips('practice', s)[0].value, Math.round(E.modelSnapshot(s).energy), 'read live');
  assert.ok(headChips('practice', s)[0].value < chips[0].value);
  assert.deepEqual(headChips('roster', s), [], 'other pages have none for now');
  s.finished = true;
  assert.deepEqual(
    headChips('practice', s).map(c => c.id),
    ['energy'],
    'no opponent once the season is over',
  );
});

test("after a press-room answer that changes the next game's energy, Prep's chip and Game day's row say the same", () => {
  const s = season();
  E.endBreak(s);
  E.startMatch(s);
  while (s.match) E.possession(s);
  s.pendingEvent = null;
  P.startPress(s);
  s.press.questions = [{ id: 'tired', answer: null }];
  P.answerPress(s, 0, 'rest'); // energy +4 for the next game
  assert.equal(s.nextMods.energy, 4, 'a next-game energy modifier is pending');
  const chip = headChips('practice', s).find(c => c.id === 'energy').value,
    row = readyFigures(s);
  assert.equal(row.energy, chip, "Game day's Rotation energy row is Prep's chip");
  assert.equal(row.energy, Math.round(E.modelSnapshot(s).energy));
  assert.equal(row.morale, Math.round(E.modelSnapshot(s).morale), 'morale from the same model');
  assert.notEqual(
    row.energy,
    E.tipoffPreview(s).energy,
    'the preview leaves the modifier out; the row does not',
  );
  // game.js draws the row from readyFigures, not from the preview
  const game = fs.readFileSync(new URL('../src/ui/screens/game.js', import.meta.url), 'utf8'),
    ready = /function readyFacts[\s\S]*?\n}\n/.exec(game)[0];
  assert.match(ready, /readyFigures\(state\)/);
  assert.doesNotMatch(ready, /tipoffPreview/);
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

const room = { w: 355, h: 176 };
test('the ghost word is sized to show whole in the free span, shrinking below its usual size when it must', () => {
  // At its CSS size (173 px at 1440) JOURNAL is 780 px wide; the span before the render is 355 px.
  const fit = ghostFit({ one: 780, room, size: 173 });
  assert.equal(fit.lines, 1);
  assert.ok(fit.size < 173 && fit.size >= GHOST_FLOOR, `${fit.size}`);
  assert.ok((780 * fit.size) / 173 <= 355, 'the whole word fits');
  assert.equal(fit.squeezed, false);
  assert.deepEqual(
    ghostFit({ one: 300, room, size: 173 }),
    { size: 173, lines: 1, squeezed: false },
    'a short word keeps its size',
  );
  assert.deepEqual(
    ghostFit({ one: 780, room: { w: 0, h: 0 }, size: 173 }),
    { size: 173, lines: 1, squeezed: false },
    'hidden (a phone)',
  );
});
test('a name of several words too long for one line at the floor goes on two lines before it is ever cut', () => {
  // REAL KANGS DATA: 1300 px on one line at 173 px (47 px at 355), REAL KANGS / DATA widest 870 px.
  const two = ghostFit({ one: 1300, two: 870, room, size: 173 });
  assert.equal(two.lines, 2);
  assert.equal(two.squeezed, false);
  assert.ok(two.size >= GHOST_FLOOR && (870 * two.size) / 173 <= 355, `${two.size}`);
  assert.ok(two.size * 0.8 * 2 <= room.h, 'both lines fit the band');
  // One line at the floor is preferred over two when it fits there.
  assert.equal(ghostFit({ one: 900, two: 470, room, size: 173 }).lines, 1);
});
test('only a name that fits neither way is cut: at the floor, fading out at its end', () => {
  assert.deepEqual(ghostFit({ one: 2400, two: 1300, room, size: 173 }), {
    size: GHOST_FLOOR,
    lines: 1,
    squeezed: true,
  });
  assert.deepEqual(
    ghostFit({ one: 2400, room, size: 173 }),
    { size: GHOST_FLOOR, lines: 1, squeezed: true },
    'one long word',
  );
  // At the floor exactly it fits: not cut, whatever the rounding.
  assert.equal(ghostFit({ one: 355 * (173 / GHOST_FLOOR), room, size: 173 }).squeezed, false);
});
test('the two-line split keeps the wider line as short as it can', () => {
  // Word widths 300, 400, 200 with 40 px spaces: [REAL] [KANGS DATA] is 640 wide, [REAL KANGS] [DATA] is 740.
  const words = [300, 400, 200],
    width = (a, b) => words.slice(a, b).reduce((t, x) => t + x, 0) + 40 * (b - a - 1);
  assert.deepEqual(ghostSplit(3, width), { at: 1, widest: 640 });
  assert.equal(ghostSplit(1, width), null, 'one word cannot split');
});
test('two lines are two block lines in a column, not a <br> among flex items (which engines lay out differently)', () => {
  const shell = fs.readFileSync(new URL('../src/ui/shell.js', import.meta.url), 'utf8'),
    css = fs.readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8'),
    fit = /export function fitGhost[\s\S]*?\n}\n/.exec(shell)[0];
  assert.doesNotMatch(fit, /createElement\('br'\)/);
  assert.match(fit, /classList\.(toggle|add)\('two'/);
  const rule = /\.ph-ghost\.two\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, '.ph-ghost.two');
  assert.match(rule[1], /flex-direction:\s*column/);
  assert.match(css, /\.ph-ghost\.two > span\s*\{[^}]*display:\s*block/);
});
