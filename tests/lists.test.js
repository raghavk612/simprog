// The Team and Season lists: sorting (kept as data in the store, so a redraw cannot lose it), the standings table,
// energy words, the captain suggestion and the starters' position balance. All pure, so no browser is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { energyLevel } from '../src/teamLabels.js'; // one copy, shared with Game day
import {
  nextSort,
  sortRows,
  ariaSort,
  standingsRows,
  captainPick,
  positionBalance,
  columnLeaders,
  yearRank,
  heightInches,
  sortHead,
} from '../src/ui/lists.js';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');

test('a first click sorts a column its natural way, a second click on it reverses it', () => {
  const ovr = nextSort(null, 'ovr');
  assert.deepEqual(ovr, { key: 'ovr', dir: 'desc' }); // numbers: highest first
  assert.deepEqual(nextSort(ovr, 'ovr'), { key: 'ovr', dir: 'asc' });
  assert.deepEqual(nextSort(nextSort(ovr, 'ovr'), 'ovr'), { key: 'ovr', dir: 'desc' });
  assert.deepEqual(nextSort(ovr, 'name', 'asc'), { key: 'name', dir: 'asc' }); // names: A to Z first
});

test('sortRows orders by the column, keeps the list order for ties and never changes its input', () => {
  const rows = [
    { id: 1, name: 'Cole', ovr: 70 },
    { id: 2, name: 'adams', ovr: 81 },
    { id: 3, name: 'Baker', ovr: 70 },
  ];
  const get = (r, k) => r[k];
  assert.deepEqual(
    sortRows(rows, { key: 'ovr', dir: 'desc' }, get).map(r => r.id),
    [2, 1, 3],
  );
  assert.deepEqual(
    sortRows(rows, { key: 'ovr', dir: 'asc' }, get).map(r => r.id),
    [1, 3, 2],
  );
  assert.deepEqual(
    sortRows(rows, { key: 'name', dir: 'asc' }, get).map(r => r.id),
    [2, 3, 1],
  ); // letters compare without case
  assert.deepEqual(
    sortRows(rows, null, get).map(r => r.id),
    [1, 2, 3],
  ); // no sort: the roster's own order
  assert.deepEqual(
    rows.map(r => r.id),
    [1, 2, 3],
  );
});

test('the sort is plain data: the same sort gives the same order on every redraw', () => {
  // render() rebuilds the table from state; the sort lives in the store, so building the rows again (a redraw, or
  // coming back from a player's profile) cannot reset it.
  const store = { stats: null };
  store.stats = nextSort(store.stats, 'ppg');
  const players = [
    { id: 1, ppg: 4 },
    { id: 2, ppg: 18 },
    { id: 3, ppg: 9 },
  ];
  const draw = () => sortRows(players, store.stats, (r, k) => r[k]).map(r => r.id);
  assert.deepEqual(draw(), [2, 3, 1]);
  assert.deepEqual(draw(), draw());
});

test('the sortable tables read their sort from the store, never from the page', () => {
  const store = read('../src/ui/store.js');
  assert.match(store, /export const sorts = /);
  assert.match(store, /export function setSort\(/);
  for (const f of ['../src/ui/screens/roster.js', '../src/ui/screens/season.js']) {
    const src = read(f);
    assert.match(src, /sorts\.\w+/, `${f} reads its sort from the store`);
    assert.doesNotMatch(src, /querySelector[^\n]*sort/, `${f} does not look for the sort in the DOM`);
  }
});

test('aria-sort names the sorted column and its direction, and none for the others', () => {
  const s = { key: 'ppg', dir: 'desc' };
  assert.equal(ariaSort(s, 'ppg'), 'descending');
  assert.equal(ariaSort({ key: 'ppg', dir: 'asc' }, 'ppg'), 'ascending');
  assert.equal(ariaSort(s, 'ovr'), 'none');
  assert.equal(ariaSort(null, 'ovr'), 'none');
});

test('energy levels use the same thresholds as the energy words', () => {
  assert.equal(energyLevel(100), 'fresh');
  assert.equal(energyLevel(80), 'fresh');
  assert.equal(energyLevel(79), 'rested');
  assert.equal(energyLevel(55), 'rested');
  assert.equal(energyLevel(54), 'tired');
  assert.equal(energyLevel(30), 'tired');
  assert.equal(energyLevel(29), 'exhausted');
});

test('standings: ranked by winning percentage, level records share a place, the coached team is marked', () => {
  const rows = standingsRows({
    'Lake Washington': { name: 'Lake Washington', w: 1, l: 0 },
    Juanita: { name: 'Juanita', w: 1, l: 0 },
    Bothell: { name: 'Bothell', w: 0, l: 1 },
    Redmond: { name: 'Redmond', w: 2, l: 0 },
  });
  assert.deepEqual(
    rows.map(r => [r.rank, r.name, r.you]),
    [
      [1, 'Redmond', false],
      [2, 'Lake Washington', true],
      [2, 'Juanita', false],
      [4, 'Bothell', false],
    ],
  );
  assert.deepEqual(
    rows.map(r => r.gb),
    [0, 0.5, 0.5, 1.5],
  ); // games behind the leader: (2 − 1 + 0 − 0) / 2 for a 1–0 team behind a 2–0 one
  assert.equal(rows[0].pct, 1);
  assert.equal(rows[3].pct, 0);
});

test('standings: a team that has not played has no percentage yet', () => {
  const [row] = standingsRows({ Hazen: { name: 'Hazen', w: 0, l: 0 } });
  assert.equal(row.pct, null);
  assert.equal(row.gb, 0);
});

test('the captain suggestion is the best eligible player in good spirits', () => {
  const ovr = p => p.ovr,
    ok = p => !p.out;
  const players = [
    { id: 1, ovr: 85, morale: 60 },
    { id: 2, ovr: 80, morale: 75 },
    { id: 3, ovr: 90, morale: 90, out: true },
    { id: 4, ovr: 78, morale: 72 },
  ];
  assert.equal(captainPick(players, ovr, ok).id, 2); // 3 can't play, 1's morale is under 70
  assert.equal(captainPick([players[0]], ovr, ok).id, 1); // nobody in good spirits: the best who can play
  assert.equal(captainPick([players[2]], ovr, ok), null);
});

test('position balance counts the starters as guards, forwards and centres, skipping the empty ones', () => {
  assert.deepEqual(positionBalance(['Guard', 'Forward', 'Guard', 'Guard', 'Forward']), [
    ['Guard', 3],
    ['Forward', 2],
  ]);
  assert.deepEqual(positionBalance(['Center', 'Guard']), [
    ['Guard', 1],
    ['Center', 1],
  ]);
});

test('column leaders: the highest value in each column, none when nobody has one', () => {
  const rows = [
    { ppg: 18, bpg: 0 },
    { ppg: 9, bpg: 0 },
    { ppg: 18, bpg: 0 },
  ];
  assert.deepEqual(
    columnLeaders(rows, ['ppg', 'bpg'], (r, k) => r[k]),
    { ppg: 18, bpg: null },
  );
});

test('class years sort from freshman to senior, and heights by inches', () => {
  const years = ['Senior', 'Freshman', 'Fictional prospect', 'Junior', 'Sophomore'];
  assert.deepEqual(
    sortRows(years, { key: 'y', dir: 'asc' }, y => yearRank(y)),
    ['Fictional prospect', 'Freshman', 'Sophomore', 'Junior', 'Senior'],
  );
  assert.equal(heightInches(`6' 0"`), 72);
  assert.equal(heightInches(`5'11"`), 71);
  assert.equal(heightInches('Tryout'), null);
});

test('a sortable header is a button inside the th, and only the sorted one carries aria-sort', () => {
  const s = { key: 'ppg', dir: 'desc' };
  const on = sortHead('stats', s, 'ppg', 'PPG', { title: 'Points per game' });
  assert.match(on, /^<th scope="col" aria-sort="descending"/);
  assert.match(
    on,
    /<button type="button" class="sort-btn" data-action="sort" data-table="stats" data-key="ppg"/,
  );
  assert.match(on, /title="Points per game"/);
  const off = sortHead('stats', s, 'ovr', 'OVR', { first: 'desc' });
  assert.doesNotMatch(off, /aria-sort/);
  assert.match(off, /data-first="desc"/);
});
