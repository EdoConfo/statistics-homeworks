import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moments, theory, QUANTITIES, rng, checkpointSimulator, trajectories, attackMatrix, aggregateSimulator, erfc, normalCdf,
  sampleKolmogorov, sampleDeviation, chebyshev, summary, latticeHistogram, logSlope,
} from '../homework-3/walks.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const [total, average, normalized] = QUANTITIES;

test('moments and the variance of the three quantities', () => {
  assert.deepEqual(moments('rademacher', 0.3), { mu: 0, sigma2: 1 });
  close(moments('bernoulli', 0.3).sigma2, 0.21);
  close(theory('bernoulli', 0.3, total, 100).variance, 21);
  close(theory('bernoulli', 0.3, average, 100).variance, 0.0021);
  close(theory('bernoulli', 0.3, normalized, 100).variance, 0.21);
  close(theory('bernoulli', 0.3, normalized, 100).mean, 3);
});

test('the generator is reproducible and uniform enough', () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  const next = rng(1);
  let ones = 0;
  for (let i = 0; i < 1e5; i++) ones += next() >>> 31;
  assert.ok(Math.abs(ones / 1e5 - 0.5) < 0.01);
});

test('checkpoints, trajectories and the attack table agree with the model', () => {
  const sim = checkpointSimulator({ model: 'rademacher', p: 0.5, m: 500, checkpoints: [1, 7, 64, 100], seed: 3 });
  sim.run(200);
  assert.equal(sim.done, 200);
  sim.run();
  for (const [c, n] of [1, 7, 64, 100].entries()) {
    for (const s of sim.S[c]) assert.ok(Math.abs(s) <= n && (s + n) % 2 === 0, `S_${n} = ${s}`);
  }
  const b = checkpointSimulator({ model: 'bernoulli', p: 0.3, m: 4000, checkpoints: [1000], seed: 9 });
  b.run();
  const s = summary(b.S[0]);
  assert.ok(Math.abs(s.mean - 300) < 1.5 && Math.abs(s.variance / 210 - 1) < 0.1, JSON.stringify(s));

  const T = trajectories({ model: 'bernoulli', p: 0.3, n: 50, m: 3, seed: 5 });
  assert.equal(T.grid.length, 51);
  for (const path of T.paths) for (let i = 1; i < path.length; i++) assert.ok(path[i] - path[i - 1] === 0 || path[i] - path[i - 1] === 1);
  assert.equal(trajectories({ model: 'rademacher', p: 0.5, n: 10000, m: 1, seed: 5, points: 1000 }).grid.length, 1001);

  const rows = attackMatrix({ model: 'rademacher', p: 0.5, n: 20, m: 4, seed: 1 });
  assert.equal(rows.length, 4);
  for (const row of rows) for (const x of row) assert.ok(x === 1 || x === -1);
});

test('the aggregate score sums all n·m scores of an experiment', () => {
  const sim = aggregateSimulator({ model: 'bernoulli', p: 0.3, n: 100, m: 10, R: 2000, seed: 4 });
  sim.run(500);
  assert.equal(sim.done, 500);
  sim.run();
  const s = summary(sim.T);
  // T ~ Bin(1000, 0.3): mean 300, variance 210
  assert.ok(Math.abs(s.mean - 300) < 1.5 && Math.abs(s.variance / 210 - 1) < 0.1, JSON.stringify(s));
  const r = aggregateSimulator({ model: 'rademacher', p: 0.5, n: 7, m: 3, R: 200, seed: 2 });
  r.run();
  for (const x of r.T) assert.ok(Math.abs(x) <= 21 && (x + 21) % 2 === 0, `T = ${x}`);
});

test('normal distribution function', () => {
  close(erfc(1), 0.15729920705028513, 1e-13);
  close(normalCdf(1.96), 0.9750021048517795, 1e-13);
  close(normalCdf(0), 0.5, 1e-15);
});

test('distance of a sample to the normal law', () => {
  close(sampleKolmogorov([0]), 0.5, 1e-12);
  close(sampleKolmogorov([-1, 1]), 0.5 - normalCdf(-1), 1e-12);   // S_1 = ±1: the largest gap sits at ±1
});

test('Law of Large Numbers: share of deviating attackers and the Chebyshev bound', () => {
  close(sampleDeviation(Int32Array.from([0, 2, -2, 0]), 2, 0, 0.5), 0.5, 1e-12);   // |S_2/2| = 1 for half of them
  close(chebyshev(0.21, 100, 0.05), 0.84, 1e-12);
  close(chebyshev(0.21, 10, 0.05), 1, 1e-12);
  const sim = checkpointSimulator({ model: 'bernoulli', p: 0.3, m: 2000, checkpoints: [10, 1000], seed: 6 });
  sim.run();
  assert.ok(sampleDeviation(sim.S[1], 1000, 0.3, 0.05) < sampleDeviation(sim.S[0], 10, 0.3, 0.05));
});

test('lattice histogram integrates to 1 and keeps the lattice', () => {
  const S = Int32Array.from([-4, -2, 0, 0, 2, 2, 2, 4]);
  const bars = latticeHistogram(S, { lattice: 2, d: 2, lo: -3, hi: 3, maxBins: 10 });
  close(bars.reduce((a, b) => a + b.y * (b.x1 - b.x0), 0), 1);
  for (const b of bars) close(b.x1 - b.x0, 1);
  close(logSlope([1, 10, 100], [2, 20, 200]), 1);
});
