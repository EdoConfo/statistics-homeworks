// Contingency table of a bivariate categorical dataset (X, F): joint, marginal and conditional frequencies,
// expected frequencies under independence, Pearson's chi-square statistic and its p-value.
import { chiSquareSurvival } from '../assets/js/statkit.js';
import { rng } from '../homework-3/walks.js';

/**
 * Contingency table built from raw records: counts[i][j] = number of records with X = xs[i] and F = fs[j].
 * Categories keep the given order; values not listed are appended in order of first appearance.
 */
export function contingencyTable(records, xKey, fKey, xs = [], fs = []) {
  const rows = [...xs], cols = [...fs];
  const index = (list, v) => {
    let k = list.indexOf(v);
    if (k < 0) { list.push(v); k = list.length - 1; }
    return k;
  };
  const cells = new Map();
  for (const r of records) {
    const key = `${index(rows, r[xKey])}|${index(cols, r[fKey])}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  const counts = rows.map((_, i) => cols.map((_, j) => cells.get(`${i}|${j}`) ?? 0));
  const rowTotals = counts.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals = cols.map((_, j) => counts.reduce((s, row) => s + row[j], 0));
  const n = rowTotals.reduce((s, v) => s + v, 0);
  return { rows, cols, counts, rowTotals, colTotals, n };
}

/** Relative frequencies: joint fᵢⱼ = nᵢⱼ/n and the two marginals fᵢ· = nᵢ·/n, f·ⱼ = n·ⱼ/n. */
export function relative(t) {
  return {
    joint: t.counts.map((row) => row.map((v) => v / t.n)),
    rowMarginal: t.rowTotals.map((v) => v / t.n),
    colMarginal: t.colTotals.map((v) => v / t.n),
  };
}

/** Conditional frequencies: F given X = xᵢ (nᵢⱼ/nᵢ·, each row sums to 1) and X given F = fⱼ (nᵢⱼ/n·ⱼ, each column sums to 1). */
export function conditional(t) {
  return {
    fGivenX: t.counts.map((row, i) => row.map((v) => v / t.rowTotals[i])),
    xGivenF: t.counts.map((row) => row.map((v, j) => v / t.colTotals[j])),
  };
}

/** Expected counts under independence: Eᵢⱼ = nᵢ· n·ⱼ / n. */
export const expected = (t) => t.rowTotals.map((r) => t.colTotals.map((c) => (r * c) / t.n));

/** Pearson's χ² = Σ (nᵢⱼ − Eᵢⱼ)² / Eᵢⱼ with (r − 1)(c − 1) degrees of freedom, and the p-value P(χ²_df ≥ χ²). */
export function chiSquare(t) {
  const E = expected(t);
  const contributions = t.counts.map((row, i) => row.map((v, j) => (v - E[i][j]) ** 2 / E[i][j]));
  const stat = contributions.flat().reduce((s, v) => s + v, 0);
  const df = (t.rows.length - 1) * (t.cols.length - 1);
  return { expected: E, contributions, stat, df, pValue: chiSquareSurvival(stat, df), minExpected: Math.min(...E.flat()) };
}

/** Critical value c with P(χ²_df ≥ c) = alpha, by bisection. */
export function criticalValue(df, alpha = 0.05) {
  let lo = 0, hi = df + 10;
  while (chiSquareSurvival(hi, df) > alpha) hi *= 2;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (chiSquareSurvival(mid, df) > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---- the example dataset: a log of intrusion attempts --------------------------------------------------------

export const SERVICES = ['Web', 'SSH', 'Email', 'Database'];
export const OUTCOMES = ['Blocked', 'Detected', 'Undetected'];

const SERVICE_P = [0.40, 0.25, 0.20, 0.15];
const OUTCOME_P = [            // outcome probabilities for each service
  [0.70, 0.20, 0.10],
  [0.55, 0.35, 0.10],
  [0.45, 0.25, 0.30],
  [0.60, 0.30, 0.10],
];

const pick = (u, ps) => {
  let acc = 0;
  for (let k = 0; k < ps.length; k++) { acc += ps[k]; if (u < acc) return k; }
  return ps.length - 1;
};

/** n simulated log records { id, service, outcome }. */
export function intrusionLog(n, seed) {
  const next = rng(seed);
  const u = () => next() / 4294967296;
  return Array.from({ length: n }, (_, k) => {
    const s = pick(u(), SERVICE_P);
    return { id: k + 1, service: SERVICES[s], outcome: OUTCOMES[pick(u(), OUTCOME_P[s])] };
  });
}
