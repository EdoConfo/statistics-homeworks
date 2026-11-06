import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../homework-5/integrals.js';

test('Riemann and Lebesgue sums converge to the exact integrals', () => {
  for (const F of I.FUNCTIONS) {
    const tol = F.id === 'isqrt' ? 0.02 : F.id.startsWith('step') ? 1e-3 : 1e-5;   // odd N puts a midpoint on the jump
    assert.ok(Math.abs(I.riemann(F, 2001).value - F.exact) < tol, `Riemann ${F.id}`);
    assert.ok(Math.abs(I.lebesgue(F, 2001).value - F.exact) < tol, `Lebesgue ${F.id}`);
  }
});

test('superlevel sets are measured exactly for known functions', () => {
  const sq = new I.LevelSets(I.byId('sq'));
  assert.ok(Math.abs(sq.above(0.25).measure - 0.5) < 1e-13);          // x² > 1/4 on (1/2, 1]
  const sin = new I.LevelSets(I.byId('sin'));
  assert.ok(Math.abs(sin.above(0.5).measure - (Math.PI - Math.PI / 3)) < 1e-13);
  const isq = new I.LevelSets(I.byId('isqrt'));
  assert.ok(Math.abs(isq.above(100).measure - 1e-4) < 1e-15);        // 1/√x > 100 on (0, 10⁻⁴)
});

test('Thomae: exact rational evaluation, shrinking upper sums, finite level sets', () => {
  assert.equal(I.thomaeAt(2, 4), 1 / 2);
  assert.equal(I.smallestDenominator(0, 10), 1);
  assert.equal(I.smallestDenominator(3, 10), 3);                         // [0.3, 0.4] contains 1/3
  assert.ok(I.thomaeUpper(1000) < I.thomaeUpper(100));
  assert.equal(I.thomaeLevelCount(5), 11);
});
