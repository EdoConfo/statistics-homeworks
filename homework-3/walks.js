// Penetration scores as random walks: m attackers, each working through n systems.
// Attacker j's score after k systems is S_k = X_1 + … + X_k with i.i.d. increments X_i.
// Pure functions (no DOM), shared by the page and the node tests.
import { gammaQ, popcount32 } from '../assets/js/statkit.js';

export const MODELS = {
  bernoulli: { name: 'Bernoulli', values: '{0, 1}', lattice: 1 },
  rademacher: { name: 'Rademacher', values: '{−1, +1}', lattice: 2 },
};

/** Mean and variance of one increment X. */
export function moments(model, p) {
  if (model === 'rademacher') return { mu: 0, sigma2: 1 };
  return { mu: p, sigma2: p * (1 - p) };
}

/** The three quantities, as a scale applied to S_n: S_n / n^a with a = 0, 1, 1/2. */
export const QUANTITIES = [
  { id: 'total', label: 'Total score', sym: 'Sₙ', power: 0 },
  { id: 'average', label: 'Average score', sym: 'Sₙ/n', power: 1 },
  { id: 'normalized', label: 'Normalized total score', sym: 'Sₙ/√n', power: 0.5 },
];

export const divisor = (q, n) => (q.power === 0 ? 1 : q.power === 1 ? n : Math.sqrt(n));

/** Mean and variance of S_n / n^a from the model: nμ / n^a and nσ² / n^(2a). */
export function theory(model, p, q, n) {
  const { mu, sigma2 } = moments(model, p);
  const d = divisor(q, n);
  return { mean: (n * mu) / d, variance: (n * sigma2) / (d * d) };
}

// ---- random numbers --------------------------------------------------------------

const rotl = (x, k) => (x << k) | (x >>> (32 - k));

/** xoshiro128** seeded through splitmix32: a fast, reproducible stream of 32-bit words. */
export function rng(seed) {
  let s = seed >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = split(), b = split(), c = split(), d = split();
  return function next() {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotl(d, 11);
    return r;
  };
}

export const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/**
 * Score added by `steps` more systems. Bernoulli: X = 1 when a 32-bit word falls below p·2³².
 * Rademacher: every bit of a word is one fair ±1 step, so 32 steps cost one word.
 */
function advance(next, model, threshold, steps) {
  let s = 0;
  if (model === 'bernoulli') {
    for (let i = 0; i < steps; i++) if (next() < threshold) s++;
    return s;
  }
  for (; steps >= 32; steps -= 32) s += 2 * popcount32(next()) - 32;
  if (steps > 0) s += 2 * popcount32(next() & ((1 << steps) - 1)) - steps;
  return s;
}

const thresholdOf = (p) => Math.min(2 ** 32, Math.round(p * 2 ** 32));

/**
 * Simulator that records every attacker's score at the given checkpoints (sorted step counts).
 * run(j) simulates attackers up to j, so the caller can work in chunks and keep the page responsive.
 * S[c][j] is attacker j's score after checkpoints[c] systems.
 */
export function checkpointSimulator({ model, p, m, checkpoints, seed }) {
  const next = rng(seed);
  const threshold = thresholdOf(p);
  const S = checkpoints.map(() => new Int32Array(m));
  let done = 0;
  return {
    S, checkpoints, m,
    get done() { return done; },
    run(upTo = m) {
      for (; done < Math.min(upTo, m); done++) {
        let s = 0, step = 0;
        for (let c = 0; c < checkpoints.length; c++) {
          s += advance(next, model, threshold, checkpoints[c] - step);
          step = checkpoints[c];
          S[c][done] = s;
        }
      }
      return done;
    },
  };
}

/**
 * Whole trajectories for plotting: S_k for k on a grid of at most `points` + 1 steps from 0 to n.
 * Returns { grid, paths } where paths[j][i] is attacker j's score after grid[i] systems.
 */
export function trajectories({ model, p, n, m, seed, points = 1000 }) {
  const grid = [];
  for (let i = 0, last = -1; i <= Math.min(n, points); i++) {
    const k = Math.round((i * n) / Math.min(n, points));
    if (k !== last) grid.push(k);
    last = k;
  }
  const next = rng(seed);
  const threshold = thresholdOf(p);
  const paths = [];
  for (let j = 0; j < m; j++) {
    const path = new Int32Array(grid.length);
    let s = 0;
    for (let i = 1; i < grid.length; i++) {
      s += advance(next, model, threshold, grid[i] - grid[i - 1]);
      path[i] = s;
    }
    paths.push(path);
  }
  return { grid: Int32Array.from(grid), paths };
}

/** The m × n table of increments X_ij (attacker j, system i), for drawing one small experiment cell by cell. */
export function attackMatrix({ model, p, n, m, seed }) {
  const next = rng(seed);
  const threshold = thresholdOf(p);
  const rows = [];
  for (let j = 0; j < m; j++) {
    const row = new Int8Array(n);
    for (let i = 0; i < n; i++) row[i] = model === 'bernoulli' ? (next() < threshold ? 1 : 0) : (next() >>> 31 ? 1 : -1);
    rows.push(row);
  }
  return rows;
}

/**
 * Aggregate score of R independent experiments, each with m attackers on n systems:
 * T = S_n⁽¹⁾ + … + S_n⁽ᵐ⁾, the sum of all n·m scores of one experiment. run(r) works in chunks like checkpointSimulator.
 */
export function aggregateSimulator({ model, p, n, m, R, seed }) {
  const next = rng(seed);
  const threshold = thresholdOf(p);
  const T = new Int32Array(R);
  let done = 0;
  return {
    T, n, m,
    get done() { return done; },
    run(upTo = R) {
      for (; done < Math.min(upTo, R); done++) {
        let t = 0;
        for (let j = 0; j < m; j++) t += advance(next, model, threshold, n);
        T[done] = t;
      }
      return done;
    },
  };
}

// ---- normal distribution ------------------------------------------------------------

/** Complementary error function: erfc(x) = Q(1/2, x²) for x ≥ 0, with the incomplete gamma of the shared toolkit. */
export const erfc = (x) => (x >= 0 ? gammaQ(0.5, x * x) : 2 - gammaQ(0.5, x * x));

export const normalCdf = (x, mean = 0, sd = 1) => 0.5 * erfc(-(x - mean) / (sd * Math.SQRT2));
export const normalPdf = (x, mean = 0, sd = 1) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

/** Kolmogorov–Smirnov distance of a sample from N(mean, sd²). Ties (lattice values) are handled by the sorted order. */
export function sampleKolmogorov(sample, mean = 0, sd = 1) {
  const x = Float64Array.from(sample).sort();
  const m = x.length;
  let D = 0;
  for (let i = 0; i < m; i++) {
    const phi = normalCdf(x[i], mean, sd);
    D = Math.max(D, (i + 1) / m - phi, phi - i / m);
  }
  return D;
}

// ---- probabilities and summaries ----------------------------------------------------------

const EPS = 1e-9;   // values on the lattice can sit exactly on the boundary |S_n/n − μ| = ε

/** Share of attackers with |S_n/n − μ| ≥ ε. */
export function sampleDeviation(S, n, mu, eps) {
  let c = 0;
  for (const s of S) if (Math.abs(s / n - mu) >= eps - EPS) c++;
  return c / S.length;
}

/** Chebyshev: P(|S_n/n − μ| ≥ ε) ≤ σ² / (nε²). */
export const chebyshev = (sigma2, n, eps) => Math.min(1, sigma2 / (n * eps * eps));

/** Mean and unbiased variance of the scores divided by d. */
export function summary(S, d = 1) {
  const m = S.length;
  let sum = 0;
  for (const s of S) sum += s;
  const mean = sum / m;
  let ss = 0;
  for (const s of S) ss += (s - mean) ** 2;
  return { mean: mean / d, variance: m > 1 ? ss / (m - 1) / (d * d) : NaN };
}

/**
 * Histogram of integer scores read as (S − shift)/d, with bins aligned to the lattice of possible scores
 * (spacing `lattice`, starting at `origin`), so every bin holds the same number of possible values.
 * Returns bars {x0, x1, y} in the units of the quantity, y a density, for the bins that overlap [lo, hi].
 */
export function latticeHistogram(S, { lattice, origin = 0, shift = 0, d = 1, lo, hi, maxBins = 50 }) {
  const g = Math.max(1, Math.ceil(((hi - lo) * d) / lattice / maxBins));   // lattice points per bin
  const counts = new Map();
  for (const s of S) {
    const b = Math.floor(Math.round((s - origin) / lattice) / g);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const width = (g * lattice) / d;
  const bars = [];
  for (const [b, c] of counts) {
    const x0 = (origin + lattice * b * g - lattice / 2 - shift) / d;
    if (x0 + width < lo || x0 > hi) continue;
    bars.push({ x0, x1: x0 + width, y: c / (S.length * width) });
  }
  return bars.sort((u, v) => u.x0 - v.x0);
}

/** Least-squares slope of log10(y) against log10(x). */
export function logSlope(xs, ys) {
  const lx = xs.map(Math.log10), ly = ys.map(Math.log10);
  const mx = lx.reduce((a, b) => a + b, 0) / lx.length, my = ly.reduce((a, b) => a + b, 0) / ly.length;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < lx.length; i++) { sxy += (lx[i] - mx) * (ly[i] - my); sxx += (lx[i] - mx) ** 2; }
  return sxy / sxx;
}
