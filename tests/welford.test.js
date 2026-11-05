import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  welfordStep, START, variance, welford, twoPass, binomialPmf, moments, samplingVariances, scoreStream, experiment, summary,
} from '../homework-4/welford.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test('Welford matches the two-pass formulas on a known sequence', () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  const w = welford(xs), t = twoPass(xs);
  close(w.mean, 5);
  close(w.ss, 32);
  close(w.variance, 32 / 7);
  close(w.ss, t.ss);
});

test('every step gives the mean and sum of squares of the prefix', () => {
  const xs = [3, 0, 7, 2, 2, 10, 5, 1, 4, 6];
  let s = START;
  xs.forEach((x, i) => {
    s = welfordStep(s, x);
    const t = twoPass(xs.slice(0, i + 1));
    close(s.mean, t.mean);
    close(s.ss, t.ss);
    if (i > 0) close(variance(s), t.variance);
  });
});

test('Welford stays accurate where the textbook one-pass formula cancels', () => {
  const xs = [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16];
  close(welford(xs).variance, 30, 1e-6);
});

test('Binomial(10, p): probabilities and moments', () => {
  const pmf = binomialPmf(0.3);
  close(pmf.reduce((a, b) => a + b, 0), 1, 1e-12);
  close(pmf.reduce((a, q, x) => a + q * x, 0), 3, 1e-12);
  const { mu, sigma2, mu4 } = moments(0.3);
  close(mu, 3); close(sigma2, 2.1);
  close(mu4, pmf.reduce((a, q, x) => a + q * (x - 3) ** 4, 0), 1e-9);
  close(samplingVariances(0.3, 10).mean, 0.21);
});

test('scores are reproducible, in range and have the right mean', () => {
  const a = scoreStream(0.3, 7), b = scoreStream(0.3, 7);
  let sum = 0;
  for (let i = 0; i < 20000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x <= 10);
    sum += x;
  }
  close(sum / 20000, 3, 0.05);
});

test('averages of sample means and sample variances are close to μ and σ²', () => {
  const { means, variances } = experiment({ p: 0.3, n: 10, m: 20000, seed: 3 });
  const sm = summary(means), sv = summary(variances);
  close(sm.average, 3, 0.02);
  close(sv.average, 2.1, 0.03);
  const th = samplingVariances(0.3, 10);
  close(sm.variance / th.mean, 1, 0.05);
  close(sv.variance / th.variance, 1, 0.06);
});
