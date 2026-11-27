// Pure helpers for the Team and Season lists: sorting, the standings table and its percentages, the captain suggestion
// and the starters' position balance. No DOM and no store here, so tests import it. The sort itself is kept in store.js
// (`sorts`), because render() throws the page away after every change.
import { localeTag } from '../i18n/index.js';

// The next sort after a click on column `key`: the same column flips, a new one starts its natural way
// ('desc' for numbers, highest first; 'asc' for names).
export function nextSort(cur, key, first = 'desc') {
  if (cur?.key === key) return { key, dir: cur.dir === 'desc' ? 'asc' : 'desc' };
  return { key, dir: first };
}

// A sorted copy of `rows`; value(row, key) gives the cell's value. Ties keep the list's own order; no sort keeps it all.
export function sortRows(rows, sort, value) {
  const list = rows.map((r, i) => ({ r, i }));
  if (!sort) return rows.slice();
  const sign = sort.dir === 'asc' ? 1 : -1;
  const cmp = (a, b) => {
    if (typeof a === 'string' || typeof b === 'string')
      return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    return (a ?? -Infinity) - (b ?? -Infinity);
  };
  return list
    .sort((a, b) => sign * cmp(value(a.r, sort.key), value(b.r, sort.key)) || a.i - b.i)
    .map(x => x.r);
}

export const ariaSort = (sort, key) =>
  sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

// Basketball's ".750" (and "1.000") in the reader's number format; a team yet to play has none.
export const pctText = v =>
  v == null
    ? '—'
    : v
        .toLocaleString(localeTag(), { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        .replace(/^0(?=\D)/, '');

// The standings table: by winning percentage (then more wins), level records share a place, games behind the leader.
export function standingsRows(standings, you = 'Lake Washington') {
  const pct = t => (t.w + t.l ? t.w / (t.w + t.l) : null);
  const rows = Object.values(standings)
    .map(t => ({ name: t.name, w: t.w, l: t.l, pct: pct(t), you: t.name === you }))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.pct ?? 0) - (a.r.pct ?? 0) || b.r.w - a.r.w || a.i - b.i)
    .map(x => x.r);
  const lead = rows[0];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.w === r.w && prev.l === r.l ? prev.rank : i + 1;
    r.gb = lead ? (lead.w - r.w + (r.l - lead.l)) / 2 : 0;
  });
  return rows;
}

// Who to suggest as captain: the best player who can play and is in good spirits (morale 70 or more, the level at
// which a captain calms the locker room), else the best who can play, else nobody.
export function captainPick(players, ovr, eligible) {
  const ok = players.filter(eligible);
  const best = list => list.reduce((a, p) => (!a || ovr(p) > ovr(a) ? p : a), null);
  return best(ok.filter(p => p.morale >= 70)) || best(ok);
}

// How many starters play each position, guards first: [['Guard', 3], ['Forward', 2]].
export function positionBalance(positions) {
  return ['Guard', 'Forward', 'Center']
    .map(k => [k, positions.filter(p => p === k).length])
    .filter(([, n]) => n);
}

// The highest value in each column (bolded in the table), or null when nobody has more than zero.
export function columnLeaders(rows, keys, value) {
  return Object.fromEntries(
    keys.map(k => {
      const top = Math.max(...rows.map(r => value(r, k) ?? -Infinity));
      return [k, top > 0 ? top : null];
    }),
  );
}

// Class years from youngest to oldest (anything else, such as a tryout, sorts before them).
export const yearRank = y => ['Freshman', 'Sophomore', 'Junior', 'Senior'].indexOf(y);
// `6' 0"` as 72; null when the height is not given in feet and inches.
export function heightInches(h) {
  const m = /(\d+)\s*'\s*(\d+)?/.exec(h || '');
  return m ? +m[1] * 12 + +(m[2] || 0) : null;
}

// A sortable column header: the label is a button (data-action="sort") and the sorted column says so with aria-sort
// and an arrow. `label` and `title` are markup already escaped by the caller; `first` is the direction of a first click.
export function sortHead(table, sort, key, label, { title = '', first = 'desc', cls = '' } = {}) {
  const aria = ariaSort(sort, key),
    on = aria !== 'none';
  return `<th scope="col"${on ? ` aria-sort="${aria}"` : ''} class="sortable${on ? ' sorted' : ''}${cls ? ` ${cls}` : ''}"><button type="button" class="sort-btn" data-action="sort" data-table="${table}" data-key="${key}" data-first="${first}"${title ? ` title="${title}"` : ''}>${label}<span class="sort-mark" aria-hidden="true">${on ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button></th>`;
}
