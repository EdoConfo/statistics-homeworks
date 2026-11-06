import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../homework-5/ex-2/normal.js';

test('the hybrid method matches the reference grid to ~1e-14 relative error', () => {
  N.GRID.forEach((ref, i) => {
    const x = N.gridX(i);
    assert.ok(Math.abs(N.cdf(x) - ref) / ref < 1e-13, `x = ${x}`);
  });
});

test('series, quadrature and the A&S erf behave as expected', () => {
  assert.ok(Math.abs(N.taylor(1).value - 0.841344746068543) < 1e-15);
  assert.ok(Math.abs(N.simpson(1, 20).value - 0.841344746068543) < 1e-7);
  assert.ok(Math.abs(N.trapezoid(1, 20).value - 0.841344746068543) < 1e-3);
  for (let z = -3; z <= 3; z += 0.1) assert.ok(Math.abs(N.erfAS(z) - N.erf(z)) < 1.5e-7);
  assert.ok(Math.abs(N.taylor(-8).value) > 1e-6);                       // cancellation ruins the alternating series (true value 6.2e-16)
});
