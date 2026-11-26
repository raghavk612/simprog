import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from '../src/i18n/locales/en.js';
import * as E from '../src/engine.js';
import { NAV, navGroup, subTabs, breakFoot, subnavGo } from '../src/ui/nav.js';
import { LESSONS } from '../src/ui/lessons.js';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const shell = read('../src/ui/shell.js'),
  markup = read('../src/ui/markup.js'),
  actions = read('../src/ui/actions.js'),
  demoSrc = read('../src/ui/demo.js'),
  lessons = read('../src/ui/lessons.js');
const routes = Object.values(NAV).flat();
const data = JSON.parse(read('../public/data/kangs.json'));
const season = () => {
  const s = E.createGame(data, 'Nav', 'standard', 7);
  E.autoLineup(s);
  return s;
};

test('four top tabs, the Shop holds every page that spends tokens, and no screen is listed twice', () => {
  assert.deepEqual(Object.keys(NAV), ['week', 'team', 'season', 'shop']);
  assert.deepEqual(NAV.shop, ['recruit', 'staff', 'skills', 'gear', 'locker']);
  assert.equal(new Set(routes).size, routes.length);
  const icons = /export const TAB_ICONS = \{([\s\S]*?)\n\};/
    .exec(markup)[1]
    .match(/^ {2}(\w+):/gm)
    .map(k => k.trim().slice(0, -1));
  assert.deepEqual(icons, Object.keys(NAV), 'every top tab has its icon, in the same order');
});
test('every group with more than one page shows them as tabs under the top bar', () => {
  for (const v of NAV.week) assert.deepEqual(subTabs(v), NAV.week, v);
  for (const v of NAV.shop) assert.deepEqual(subTabs(v), NAV.shop, v);
  assert.deepEqual(subTabs('season'), NAV.season);
  assert.deepEqual(subTabs('roster'), [], 'Team has one page');
  assert.equal(navGroup('gear'), 'shop');
  assert.equal(navGroup('nowhere'), 'week');
});
test('Shop pages open at any time; during a break their foot walks the tabs and the last one ends the break', () => {
  const s = season();
  assert.equal(E.breakDue(s), 'pre');
  assert.deepEqual(breakFoot(s, 'recruit'), { pause: 'pre', next: 'staff' });
  assert.deepEqual(breakFoot(s, 'skills'), { pause: 'pre', next: 'gear' });
  assert.deepEqual(breakFoot(s, 'locker'), { pause: 'pre', next: null });
  assert.equal(breakFoot(s, 'home'), null, 'only Shop pages have the break foot');
  assert.equal(subnavGo(s, 'staff'), 'break', 'during a break the way forward is ending it');
  assert.equal(subnavGo(s, 'home'), null, 'Home has its own next-step bar');
  E.endBreak(s);
  for (const v of NAV.shop) {
    assert.equal(breakFoot(s, v), null, `${v}: no break foot outside a break`);
    assert.equal(subnavGo(s, v), 'next', `${v}: outside a break the way forward is the week's next step`);
  }
  assert.doesNotMatch(shell, /setView\('home'\)/, 'render() no longer sends Shop pages back to Home');
});
test('the way forward has one slot, at the end of the row under the top bar, on every page without its own', () => {
  const s = season();
  E.endBreak(s);
  const step = E.nextStep(s);
  assert.ok(
    !['roster', ...NAV.season, ...NAV.shop].includes(step.view),
    'a plain week: the step is elsewhere',
  );
  // This week: Home has its next-step bar, Prep and Game day their own primary buttons, so the slot is empty.
  for (const v of NAV.week) assert.equal(subnavGo(s, v), null, v);
  // Team, Season and Shop pages all carry the week's next step in the same place.
  for (const v of [...NAV.team, ...NAV.season, ...NAV.shop]) assert.equal(subnavGo(s, v), 'next', v);
  // A lineup problem: the roster's own "Pick my best five" is the way forward there, so its slot is empty.
  const hurt = s.players.find(p => p.starter);
  hurt.injury = 2;
  assert.ok(E.lineupIssues(s).length);
  assert.equal(subnavGo(s, 'roster'), null, 'the roster shows its own fix');
  assert.equal(subnavGo(s, 'standings'), 'next', 'other pages still point at the next step');
  // The slot never offers the page it is on.
  const done = season();
  E.endBreak(done);
  done.finished = true;
  assert.equal(E.nextStep(done).view, 'season');
  assert.equal(subnavGo(done, 'season'), null, 'the journal is the step: no button to open it again');
  assert.equal(subnavGo(done, 'bracket'), 'next');
  // During a break a Shop page ends the break; other pages still show the week's next step (opening the break).
  const pre = season();
  for (const v of NAV.shop) assert.equal(subnavGo(pre, v), 'break', v);
  for (const v of NAV.season) assert.equal(subnavGo(pre, v), 'next', v);
});
test('the Shop lessons follow the Shop tabs in order, one line each', () => {
  const shop = LESSONS.filter(l => l.chapter === 'shop');
  assert.deepEqual(
    shop.map(l => l.route),
    NAV.shop,
  );
  for (const l of shop) {
    assert.equal(l.steps.length, 1, l.id);
    assert.equal(typeof en.tutorial.c.shop[l.route], 'string', `lesson text: ${l.id}`);
  }
});
test('the gear shop is wired: every button on it has a handler, and the player picker changes the page', () => {
  const used = [...read('../src/gearView.js').matchAll(/data-action="([\w-]+)"/g)].map(m => m[1]),
    ternary = /data-action="\$\{own \? '([\w-]+)' : '([\w-]+)'\}"/.exec(read('../src/gearView.js'));
  for (const a of [...used, ...ternary.slice(1)]) assert.match(actions, new RegExp(`'${a}':`), a);
  assert.match(actions, /el\.id === 'gear-player'/);
});
test('the judge demo and the lessons only use screens that exist', () => {
  const demo = /DEMO_VIEWS = \[([^\]]*)\]/
    .exec(demoSrc)[1]
    .match(/'(\w+)'/g)
    .map(x => x.slice(1, -1));
  const tour = [
    ...[...lessons.matchAll(/view (?:===|!==) '(\w+)'/g)].map(m => m[1]),
    ...LESSONS.map(l => l.route).filter(Boolean),
  ];
  assert.ok(demo.length >= 5, 'the demo names its screens');
  assert.ok(tour.length >= 5, 'the lessons name their screens');
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
  for (const g of Object.keys(NAV)) assert.equal(typeof en.nav.groups[g], 'string', g);
});
