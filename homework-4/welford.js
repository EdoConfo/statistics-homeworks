// Welford's recurrences for the running mean, sum of squares and sample variance, and the m hackers × n systems experiment.
// Pure functions (no DOM), shared by the page and the node tests.
import { rng } from '../homework-3/walks.js';

/** One Welford step: from (k − 1, M, S) and the new score x to (k, M, S). */
export function welfordStep(state, x) {
  const k = state.k + 1;
  const d = x - state.mean;            // x_k − M_{k−1}
  const mean = state.mean + d / k;     // M_k = M_{k−1} + (x_k − M_{k−1}) / k
  const ss = state.ss + d * (x - mean); // S_k = S_{k−1} + (x_k − M_{k−1})(x_k − M_k)
  return { k, mean, ss };
}

export const START = { k: 0, mean: 0, ss: 0 };

/** Sample variance s²_k = S_k / (k − 1). */
export const variance = ({ k, ss }) => (k > 1 ? ss / (k - 1) : NaN);

/** Mean, sum of squares and sample variance of a whole sequence, in one pass. */
export function welford(xs) {
  let s = START;
  for (const x of xs) s = welfordStep(s, x);
  return { ...s, variance: variance(s) };
}

/** Two-pass reference: mean first, then the squared deviations from it. */
export function twoPass(xs) {
  const k = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / k;
  const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
  return { k, mean, ss, variance: k > 1 ? ss / (k - 1) : NaN };
}

// ---- the score of one penetration attempt: Binomial(10, p) on {0, …, 10} ----------------------

export const TRIALS = 10;

export function binomialPmf(p, N = TRIALS) {
  const out = [];
  let c = 1;
  for (let x = 0; x <= N; x++) {
    out.push(c * p ** x * (1 - p) ** (N - x));
    c = (c * (N - x)) / (x + 1);
  }
  return out;
}

/** μ, σ² and the central fourth moment μ₄ of Binomial(N, p). */
export function moments(p, N = TRIALS) {
  const pq = p * (1 - p);
  return { mu: N * p, sigma2: N * pq, mu4: N * pq * (1 + 3 * (N - 2) * pq) };
}

/** Variance across hackers of the sample mean and of the sample variance of n scores. */
export function samplingVariances(p, n, N = TRIALS) {
  const { sigma2, mu4 } = moments(p, N);
  return { mean: sigma2 / n, variance: (mu4 - (sigma2 ** 2 * (n - 3)) / (n - 1)) / n };
}

const thresholdOf = (p) => Math.min(2 ** 32, Math.round(p * 2 ** 32));

/** Stream of scores: each one counts the successes of N independent steps with probability p. */
export function scoreStream(p, seed, N = TRIALS) {
  const next = rng(seed);
  const t = thresholdOf(p);
  return () => {
    let x = 0;
    for (let i = 0; i < N; i++) if (next() < t) x++;
    return x;
  };
}

/**
 * m hackers, each attempting n systems. Every hacker's scores go through Welford's recurrences as they arrive.
 * Returns the m sample means and sample variances, and, when `keep` > 0, the running M_k and s²_k of the first `keep` hackers.
 */
export function experiment({ p, n, m, seed, keep = 0 }) {
  const draw = scoreStream(p, seed);
  const means = new Float64Array(m), variances = new Float64Array(m);
  const runMean = [], runVar = [];
  for (let j = 0; j < m; j++) {
    const track = j < keep;
    const M = track ? new Float32Array(n) : null, V = track ? new Float32Array(n) : null;
    let s = START;
    for (let i = 0; i < n; i++) {
      s = welfordStep(s, draw());
      if (track) { M[i] = s.mean; V[i] = variance(s); }
    }
    means[j] = s.mean;
    variances[j] = variance(s);
    if (track) { runMean.push(M); runVar.push(V); }
  }
  return { means, variances, runMean, runVar };
}

/** Average and spread (unbiased variance) of a list of values, again with Welford. */
export function summary(values) {
  const s = welford(values);
  return { average: s.mean, variance: s.variance, sd: Math.sqrt(s.variance) };
}
