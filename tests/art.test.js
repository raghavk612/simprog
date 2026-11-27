import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { emptyArt, isLiveMatch, uiPicture, glyphImage, logoMark } from '../src/ui/art.js';
import { headModel } from '../src/ui/pageHead.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url), 'utf8'));
const season = () => {
  const s = E.createGame(data, 'Art', 'standard', 7);
  E.autoLineup(s);
  return s;
};
const size = f => fs.statSync(new URL(`../public/images/ui/${f}`, import.meta.url)).size;

test('an empty state shows its render only while it is empty', () => {
  const s = season();
  assert.equal(emptyArt('season', s), 'empty-journal', 'no game played yet');
  assert.equal(emptyArt('skills', s), 'empty-skills', 'no skill learned yet');
  assert.equal(emptyArt('bracket', s), 'empty-bracket', 'a seed to show before the run');
  s.results.push({ won: true, home: 50, away: 40, opponent: 'x', date: 'd' });
  assert.equal(emptyArt('season', s), null, 'a result is in the Journal');
  s.skills = ['corner'];
  assert.equal(emptyArt('skills', s), null, 'a skill is learned');
  assert.equal(emptyArt('roster', s), null, 'no other page has one');
  s.finished = true;
  assert.equal(emptyArt('bracket', s), null, 'the bracket is real after the season');
});

test('the live game and replays hide the header, so they never fetch its render', () => {
  const s = season();
  assert.equal(isLiveMatch('game', s, {}), false, 'before tip-off');
  assert.equal(isLiveMatch('game', { ...s, match: {} }, {}), true);
  assert.equal(isLiveMatch('game', s, { closingMatch: true }), true);
  assert.equal(isLiveMatch('game', s, { replayEvent: {} }), true);
  assert.equal(isLiveMatch('practice', { ...s, match: {} }, {}), false, 'only on Game day');
  assert.ok(headModel('game', s).hero, 'the model still has its render; header() leaves it out while live');
});

test('a render is a picture: AVIF then WebP, 1x and 2x, sized, decorative', () => {
  const h = uiPicture('hero-week', { w: 480, h: 270, cls: 'ph-hero' });
  assert.match(h, /<picture class="ph-hero">/);
  assert.match(h, /type="image\/avif" srcset="[^"]*hero-week\.avif 1x, [^"]*hero-week@2x\.avif 2x"/);
  assert.match(h, /type="image\/webp" srcset="[^"]*hero-week\.webp 1x, [^"]*hero-week@2x\.webp 2x"/);
  assert.match(h, /<img [^>]*alt="" width="480" height="270"/);
  assert.match(h, /forced-colors: active/, 'forced colours get a blank source, so nothing downloads');
});

test('a small glyph keeps its SVG underneath for failed images, high contrast and forced colours', () => {
  const g = glyphImage('coin', '<circle r="1"/>', 'sb-coin');
  assert.match(g, /<svg class="sb-coin"/);
  assert.match(g, /coin-24\.avif 1x, [^"]*coin-48\.avif 2x, [^"]*coin-72\.avif 3x/);
  assert.match(g, /class="art-glyph"/);
  assert.match(g, /width="24" height="24"/);
  assert.match(g, /media="\(forced-colors: active\)"/, 'forced colours fetch nothing and show the SVG');
  assert.doesNotMatch(
    g,
    /prefers-contrast/,
    'the SVG is shown only by the stylesheet, so a blank source would leave the box empty',
  );
});

test('the logo is content: no source of it is blank', () => {
  const l = logoMark('brand-logo on-light');
  assert.doesNotMatch(l, /BLANK|data:image|forced-colors|prefers-contrast/);
  assert.match(l, /logo-42\.avif 1x, [^"]*logo-84\.avif 2x, [^"]*logo-126\.avif 3x/);
});

test('every wired file exists, in both formats, within the spec budgets', () => {
  const set = (name, kinds) => kinds.flatMap(k => [`${name}${k}.avif`, `${name}${k}.webp`]);
  for (const g of ['week', 'team', 'season', 'shop'])
    for (const f of set(`hero-${g}`, ['', '@2x'])) assert.ok(size(f) > 0, f);
  for (const g of ['week', 'team', 'season', 'shop']) {
    assert.ok(size(`hero-${g}@2x.avif`) <= 120 * 1024, `hero ${g} avif`);
    assert.ok(size(`hero-${g}@2x.webp`) <= 120 * 1024, `hero ${g} webp`);
  }
  for (const e of ['journal', 'bracket', 'skills'])
    for (const f of set(`empty-${e}`, ['', '@2x'])) assert.ok(size(f) <= 80 * 1024, f);
  for (const f of ['hardwood.avif', 'hardwood.webp']) assert.ok(size(f) <= 60 * 1024, f);
  assert.ok(size('grain.webp') <= 6 * 1024, 'grain tile');
  for (const n of ['coin', 'whistle'])
    for (const px of [24, 48, 72])
      for (const x of ['avif', 'webp']) assert.ok(size(`${n}-${px}.${x}`) <= 6 * 1024, `${n}-${px}.${x}`);
  for (const px of [42, 84, 126])
    for (const x of ['avif', 'webp']) assert.ok(size(`logo-${px}.${x}`) <= 10 * 1024, `logo-${px}.${x}`);
});
