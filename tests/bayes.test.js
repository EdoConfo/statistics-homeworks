import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../homework-7/bayes.js';
import * as C from '../homework-7/convergence.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('posterior over a finite set sums to 1 and matches the textbook alarm example', () => {
  const r = B.posterior([0.01, 0.99], [0.99, 0.05]);
  close(r.evidence, 0.01 * 0.99 + 0.99 * 0.05);
  close(r.posterior[0] + r.posterior[1], 1);
  close(r.posterior[0], 0.0099 / 0.0594);
  const steps = B.alarmUpdates(0.01, 0.99, 0.05, 2);
  close(steps[2], (0.01 * 0.99 ** 2) / (0.01 * 0.99 ** 2 + 0.99 * 0.05 ** 2));
  const c = B.alarmCounts(0.01, 0.99, 0.05);
  close(c.truePos / (c.truePos + c.falsePos), steps[1]);
});

test('Beta CDF and quantile', () => {
  close(B.betaCdf(0.3, 1, 1), 0.3, 1e-12);
  close(B.betaCdf(0.5, 7, 7), 0.5, 1e-12);
  close(B.betaCdf(0.4, 2, 3), 1 - (1 - 0.4) ** 4 - 4 * 0.4 * (1 - 0.4) ** 3, 1e-12);   // I_x(2,3) = P(Bin(4,x) ≥ 2)
  close(B.betaCdf(0.2, 0.5, 0.5), (2 / Math.PI) * Math.asin(Math.sqrt(0.2)), 1e-10);   // arcsine law
  close(B.betaQuantile(0.975, 1, 1), 0.975, 1e-12);
  close(B.betaCdf(B.betaQuantile(0.025, 13, 89), 13, 89), 0.025, 1e-10);
});

test('Beta density integrates to 1 and conjugate update', () => {
  let s = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) s += B.betaPdf((i + 0.5) / N, 4, 36) / N;
  close(s, 1, 1e-6);
  assert.deepEqual(B.betaUpdate(1, 1, 7, 20), { a: 8, b: 14 });
  const sh = B.shrinkage(4, 36, 30, 100);
  close(sh.mean, (4 + 30) / (40 + 100));
  close(B.betaSummary(34, 106).mean, sh.mean);
});

test('typewriter sequence and variance of sums', () => {
  assert.deepEqual([1, 2, 3, 4, 7].map((n) => C.typewriter(n, 0.3).value), [1, 1, 0, 0, 0]);
  assert.equal(C.typewriter(5, 0.3).value, 1);   // n = 4 + 1: [1/4, 2/4)
  close(C.typewriter(1000, 0.3).prob, 2 ** -9);
  // ω is hit exactly once in every block k
  for (let k = 0; k < 8; k++) {
    let hits = 0;
    for (let n = 2 ** k; n < 2 ** (k + 1); n++) hits += C.typewriter(n, 0.3).value;
    assert.equal(hits, 1);
  }
  const v = C.sumVariance(100, 2, 0);
  close(v.total, 200); close(v.mean, 0.02); close(v.normalized, 2);
  close(C.sumVariance(100, 1, 0.1).mean, (100 + 9900 * 0.1) / 1e4);
});
