import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryLoops, readGlbMeshes } from '../scripts/kit-topology.mjs';

/* A flat grid of n x n quads: one boundary loop. */
function grid(n, dx = 0, split = false) {
  const pos = [],
    idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(i * 0.1 + dx, j * 0.1, 0);
  const v = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      idx.push(v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j), v(i + 1, j + 1), v(i, j + 1));
  return { pos, idx };
}

test('a disc of quads has one boundary loop', () => {
  const { pos, idx } = grid(3);
  const r = boundaryLoops(pos, idx);
  assert.equal(r.loops.length, 1);
  assert.ok(Math.abs(r.loops[0].length - 1.2) < 1e-9);
});

test('a closed tetrahedron has none', () => {
  const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    idx = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];
  assert.equal(boundaryLoops(pos, idx).loops.length, 0);
});

test('a ring (two loops) counts two', () => {
  // a tube: 8 around, 2 tall, open at both ends
  const pos = [],
    idx = [];
  for (let h = 0; h <= 2; h++)
    for (let k = 0; k < 8; k++)
      pos.push(Math.cos((k / 8) * 6.2832) * 0.3, h * 0.2, Math.sin((k / 8) * 6.2832) * 0.3);
  for (let h = 0; h < 2; h++)
    for (let k = 0; k < 8; k++) {
      const a = h * 8 + k,
        b = h * 8 + ((k + 1) % 8);
      idx.push(a, b, b + 8, a, b + 8, a + 8);
    }
  assert.equal(boundaryLoops(pos, idx).loops.length, 2);
});

test('duplicated vertices on a seam are welded at the tolerance, not before', () => {
  // two grids side by side whose shared edge has separate vertices 0.4 mm apart
  const a = grid(2),
    b = grid(2, 0.2 + 0.0004);
  const pos = [...a.pos, ...b.pos],
    idx = [...a.idx, ...b.idx.map(i => i + a.pos.length / 3)];
  assert.equal(boundaryLoops(pos, idx, 0.002).loops.length, 1, 'welded: one piece');
  assert.equal(boundaryLoops(pos, idx, 0.0001).loops.length, 2, 'not welded: two pieces');
});

test('small loops are summed by edge length', () => {
  const a = grid(1), // loop length 0.4
    b = grid(10, 5); // loop length 4
  const pos = [...a.pos, ...b.pos],
    idx = [...a.idx, ...b.idx.map(i => i + a.pos.length / 3)];
  const r = boundaryLoops(pos, idx, 0.002, 0.5);
  assert.equal(r.loops.length, 2);
  assert.equal(r.small.count, 1);
  assert.ok(Math.abs(r.small.length - 0.4) < 1e-9);
});

test('the shipped guard GLB can be read and its kit meshes counted', () => {
  const m = readGlbMeshes(new URL('../public/models/players/guard.glb', import.meta.url).pathname);
  for (const n of ['jersey', 'shorts']) {
    assert.ok(m[n], n);
    assert.ok(boundaryLoops(m[n].positions, m[n].indices).loops.length >= 3);
  }
});
