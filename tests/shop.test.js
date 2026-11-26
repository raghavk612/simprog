// The Shop's decision helpers (src/shopFit.js): how a tryout compares with the team, what the team needs, and what a
// refused purchase is missing. Pure functions of the save, so the cards and these tests read the same numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { t } from '../src/i18n/index.js';
import {
  startersOf,
  prospectFit,
  teamNeeds,
  fitLine,
  needsLine,
  tokenShort,
  shortText,
  dismissText,
} from '../src/shopFit.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
const game = () => {
  const s = E.createGame(data, 'Shop', 'standard', 42);
  E.autoLineup(s);
  return s;
};
const ovr = p => E.ratings(p).ovr,
  pos = p => E.bio(p).position;

test('a tryout shows the OVR the roster will show once signed (same scale)', () => {
  for (const p of game().pool) {
    const s = game(),
      fit = prospectFit(s, p);
    assert.equal(fit.ovr, ovr(p));
    s.tokens = 9999;
    E.recruit(s, p.id);
    assert.equal(ovr(s.players.find(q => q.id === p.id)), fit.ovr, `${p.name} keeps the OVR on the roster`);
  }
});
test('a tryout is compared with the weakest starter at his position, and starts only if he beats him', () => {
  const s = game();
  for (const p of s.pool) {
    const fit = prospectFit(s, p),
      same = startersOf(s).filter(q => pos(q) === pos(p));
    if (!same.length) continue;
    const low = Math.min(...same.map(ovr));
    assert.equal(fit.vs.ovr, low);
    assert.equal(pos(s.players.find(q => q.id === fit.vs.id)), pos(p));
    assert.equal(fit.vs.samePos, true);
    assert.equal(fit.diff, fit.ovr - low);
    assert.equal(fit.starts, fit.diff > 0);
  }
});
test('with nobody at his position in the five, a tryout is compared with the weakest starter', () => {
  const s = game(),
    p = { ...s.pool[0], position: 'Center' };
  for (const q of s.players) if (q.starter && pos(q) === 'Center') q.starter = false;
  const five = startersOf(s),
    fit = prospectFit(s, p);
  assert.ok(five.every(q => pos(q) !== 'Center'));
  assert.equal(fit.vs.samePos, false);
  assert.equal(fit.vs.ovr, Math.min(...five.map(ovr)));
});
test('a tryout ranks among the current players by OVR', () => {
  const s = game(),
    p = s.pool[3],
    fit = prospectFit(s, p);
  assert.equal(fit.total, s.players.length + 1);
  assert.equal(fit.rank, 1 + s.players.filter(q => ovr(q) > fit.ovr).length);
});
test('the five are the chosen starters, or the five best by OVR before a lineup is set', () => {
  const s = game();
  assert.deepEqual(
    startersOf(s).map(p => p.id),
    s.players.filter(p => p.starter).map(p => p.id),
  );
  for (const p of s.players) p.starter = false;
  const best = [...s.players].sort((a, b) => ovr(b) - ovr(a)).slice(0, 5);
  assert.deepEqual(
    startersOf(s)
      .map(p => p.id)
      .sort(),
    best.map(p => p.id).sort(),
  );
});
test("team needs: the weakest starter and the five's lowest average rating", () => {
  const s = game(),
    five = startersOf(s),
    need = teamNeeds(s),
    low = five.reduce((a, b) => (ovr(b) < ovr(a) ? b : a));
  assert.equal(need.weakest.id, low.id);
  assert.equal(need.weakest.ovr, ovr(low));
  assert.equal(need.weakest.pos, pos(low));
  const avg = k => five.reduce((n, p) => n + E.ratings(p)[k], 0) / five.length,
    keys = ['ins', 'mid', 'tpt', 'perd', 'insd'];
  assert.equal(
    need.rating.key,
    keys.reduce((a, b) => (avg(b) < avg(a) ? b : a)),
  );
  assert.equal(need.rating.value, Math.round(avg(need.rating.key)));
  assert.equal(teamNeeds({ ...s, players: [] }), null);
});
test('the comparison line and the needs line name the player, the signed difference and the rank', () => {
  const s = game();
  for (const p of s.pool) {
    const fit = prospectFit(s, p),
      line = fitLine(s, p);
    assert.ok(line.includes(fit.vs.name), line);
    assert.ok(line.includes(t('recruit.rank', { rank: fit.rank, total: fit.total })), line);
    assert.match(line, fit.diff > 0 ? /\+\d/ : /(−|±)\d/);
    assert.ok(!line.includes('{{'), line);
  }
  const need = teamNeeds(s),
    line = needsLine(s);
  assert.ok(line.includes(need.weakest.name) && line.includes(String(need.rating.value)), line);
  assert.ok(line.includes(t(`rv.${need.rating.key}T`)), line);
  assert.equal(needsLine({ ...s, players: [] }), '');
});
test('a refused purchase says how many tokens are missing and how many the coach has', () => {
  const s = game();
  s.tokens = 25;
  assert.deepEqual(tokenShort(s, 65), { n: 40, have: 25 });
  assert.equal(tokenShort(s, 25), null);
  assert.equal(shortText(s, 65), t('shop.needTokens', { n: 40, have: 25 }));
  assert.match(shortText(s, 65), /40.*25/);
  assert.equal(shortText(s, 10), '');
});
test('the dismiss confirmation names the assistant and the tokens that are lost', () => {
  const s = game();
  assert.equal(dismissText(s), '');
  E.hire(s, 'development');
  const text = dismissText(s),
    a = E.staff.find(a => a.key === 'development');
  assert.ok(text.includes(t('staff.development.name')), text);
  assert.ok(text.includes(String(a.cost)), text);
});
