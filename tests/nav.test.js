import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from '../src/i18n/locales/en.js';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const shell = read('../src/ui/shell.js'),
  demoSrc = read('../src/ui/demo.js'),
  tutorial = read('../src/ui/tutorial.js');
// NAV in shell.js is a plain object of route-name lists.
const NAV = JSON.parse(
  /const NAV = (\{[\s\S]*?\});/
    .exec(shell)[1]
    .replace(/'/g, '"')
    .replace(/(\w+):/g, '"$1":')
    .replace(/,\s*\}$/, '}'),
);
const routes = Object.values(NAV).flat();

test('three tabs, the break screens, and no screen listed twice', () => {
  assert.deepEqual(Object.keys(NAV), ['week', 'team', 'season', 'break']);
  assert.equal(new Set(routes).size, routes.length);
});
test('the judge demo and the first-game tutorial only use screens that exist', () => {
  const demo = /DEMO_VIEWS = \[([^\]]*)\]/
    .exec(demoSrc)[1]
    .match(/'(\w+)'/g)
    .map(x => x.slice(1, -1));
  const tour = [
    ...tutorial
      .slice(tutorial.indexOf('export const BEATS = ['), tutorial.indexOf('export function startTour'))
      .matchAll(/view (?:===|!==) '(\w+)'/g),
  ].map(m => m[1]);
  assert.ok(demo.length >= 5, 'the demo names its screens');
  assert.ok(tour.length >= 5, 'the tutorial names its screens');
  for (const v of [...demo, ...tour]) assert.ok(routes.includes(v), v);
});
test('every screen has a page to draw and a name on its tab', () => {
  const pages = /const PAGES = \{([^}]*)\}/
    .exec(shell)[1]
    .split(',')
    .map(x => x.split(':')[0].trim())
    .filter(Boolean);
  for (const v of routes) {
    assert.ok(pages.includes(v), `page: ${v}`);
    assert.equal(typeof en.nav[v], 'string', `name: ${v}`);
  }
  for (const g of ['week', 'team', 'season']) assert.equal(typeof en.nav.groups[g], 'string');
});
