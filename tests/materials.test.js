import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_PARS } from '../src/materials.js';

// A zero screen-space derivative normalised to NaN in the bump detail; the environment light's reflection lookup turned it
// into NaN pixels and bloom spread them over the whole frame (a black flash on low camera angles). Measured: 15 of 1,200
// frames before, 0 after (docs/realism-log.md, phase 0).
test('bump detail: zero screen derivatives and a zero perturbed normal fall back to the surface normal (no NaN)', () => {
  const fn = DETAIL_PARS.slice(DETAIL_PARS.indexOf('vec3 kPerturb'));
  assert.match(fn, /if \(dot\(dx, dx\) < [\d.e-]+ \|\| dot\(dy, dy\) < [\d.e-]+\) return surf_norm;/);
  assert.match(fn, /return dot\(n, n\) > [\d.e-]+ \? normalize\(n\) : surf_norm;/);
  assert.ok(!/normalize\(dFdx/.test(fn), 'no derivative is normalised before the guard');
});
