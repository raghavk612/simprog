import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWood, rowJoints, STRIP_FT } from '../src/courtwood.js';

test('the court is maple strips 2 1/4 inches wide in boards 2 to 7 feet long, the same every time', () => {
  const F = 40,
    a = makeWood(400, 120, F),
    b = makeWood(400, 120, F);
  assert.deepEqual(a.rgba, b.rgba);
  assert.equal(a.strip, STRIP_FT * F);
  const j = rowJoints(3, 4000, F);
  assert.ok(j[0] <= 0 && j[j.length - 1] >= 4000);
  for (let k = 1; k < j.length; k++) {
    const ft = (j[k] - j[k - 1]) / F;
    assert.ok(ft >= 2 && ft <= 7, String(ft));
  }
  // the groove between strips is darker than the middle of the strip next to it
  const lum = (x, y) => a.rgba[(y * 400 + x) * 4 + 1];
  let darker = 0;
  for (let x = 10; x < 390; x += 7)
    if (lum(x, Math.ceil(a.strip * 4)) < lum(x, Math.floor(a.strip * 4.5))) darker++;
  assert.ok(darker > 45);
});
test('the varnish wears where wearAt says players run, board by board', () => {
  const w = makeWood(300, 60, 40, x => (x < 150 ? 1 : 0)).wear,
    mean = (x0, x1) => {
      let s = 0,
        n = 0;
      for (let y = 0; y < 60; y++) for (let x = x0; x < x1; x++, n++) s += w[y * 300 + x];
      return s / n;
    };
  assert.ok(mean(0, 60) > 3 * mean(240, 300));
});
