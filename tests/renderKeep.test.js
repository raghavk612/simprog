// What render() carries across a redraw that lives only in the DOM: the sideways scroll of each table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nthKeys, sideScroll, restoreSideScroll } from '../src/ui/renderKeep.js';

const el = (className, scrollLeft = 0) => ({ className, scrollLeft });

test('elements are keyed by their classes and their place among elements with the same classes', () => {
  const keys = nthKeys([el('table-wrap rv-table'), el('table-wrap'), el('table-wrap')]).map(x => x.key);
  assert.deepEqual(keys, ['table-wrap rv-table#0', 'table-wrap#0', 'table-wrap#1']);
});

test('a table scrolled sideways is scrolled back to the same place after the redraw', () => {
  const before = [el('table-wrap rv-table', 240), el('table-wrap'), el('table-wrap', 90)];
  const saved = sideScroll(before);
  const after = [el('table-wrap rv-table'), el('table-wrap'), el('table-wrap')];
  restoreSideScroll(after, saved);
  assert.deepEqual(
    after.map(x => x.scrollLeft),
    [240, 0, 90],
  );
});

test('a table that is not there any more, or a new one, is left alone', () => {
  const saved = sideScroll([el('table-wrap box-score', 120)]);
  const after = [el('table-wrap rv-table')];
  restoreSideScroll(after, saved);
  assert.equal(after[0].scrollLeft, 0);
});
