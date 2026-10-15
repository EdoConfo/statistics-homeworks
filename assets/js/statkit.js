// Small statistics toolkit shared by both parts (no dependencies).

export const sum = (xs) => xs.reduce((s, x) => s + x, 0);
export const mean = (xs) => (xs.length ? sum(xs) / xs.length : NaN);

export function variance(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
}

export const sd = (xs) => Math.sqrt(variance(xs));

export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Average ranks (ties share the mean rank). */
export function ranks(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) r[idx[t][1]] = avg;
    i = j + 1;
  }
  return r;
}

export const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

// --- Gamma family (Lanczos + Numerical Recipes incomplete gamma) -----------

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized upper incomplete gamma Q(s, x). */
export function gammaQ(s, x) {
  if (x <= 0) return 1;
  if (x < s + 1) {
    // series for P, then Q = 1 - P
    let term = 1 / s, total = term;
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n);
      total += term;
      if (Math.abs(term) < Math.abs(total) * 1e-15) break;
    }
    return 1 - total * Math.exp(-x + s * Math.log(x) - logGamma(s));
  }
  // continued fraction (Lentz)
  let b = x + 1 - s, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

/** P(X >= x) for X ~ chi-square(df). */
export const chiSquareSurvival = (x, df) => gammaQ(df / 2, x / 2);

/**
 * Pearson chi-square goodness-of-fit.
 * `expected` may be omitted for a uniform null hypothesis.
 */
export function chiSquareTest(observed, expected) {
  const n = sum(observed);
  const exp = expected ?? observed.map(() => n / observed.length);
  let stat = 0;
  for (let i = 0; i < observed.length; i++) {
    if (exp[i] > 0) stat += (observed[i] - exp[i]) ** 2 / exp[i];
  }
  const df = observed.length - 1;
  return { stat, df, pValue: chiSquareSurvival(stat, df), minExpected: Math.min(...exp) };
}

export function binomialPmf(k, n, p) {
  if (k < 0 || k > n) return 0;
  const logC = logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Wilson score interval for a binomial proportion. */
export function wilson(successes, n, z = 1.959963984540054) {
  if (n === 0) return { p: NaN, lo: NaN, hi: NaN };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/** Counts of integer values 0..k-1. */
export function counts(values, k) {
  const c = new Array(k).fill(0);
  for (const v of values) c[v]++;
  return c;
}

/** Equal-width histogram of numbers in [lo, hi). */
export function histogram(values, bins, lo, hi) {
  const c = new Array(bins).fill(0);
  const w = (hi - lo) / bins;
  for (const v of values) c[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)))]++;
  return c.map((count, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, count }));
}

export function popcount32(x) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function popcountBig(x) {
  let c = 0;
  while (x) { c += popcount32(Number(x & 0xffffffffn)); x >>= 32n; }
  return c;
}

/** Hamming distance between two equal-length byte arrays. */
export function hammingBytes(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += popcount32(a[i] ^ b[i]);
  return d;
}

/** Fraction of ones at each bit position (MSB first) over a list of non-negative integers. */
export function bitBalance(values, width) {
  const ones = new Array(width).fill(0);
  for (const v of values) {
    const big = BigInt(v);
    for (let i = 0; i < width; i++) if ((big >> BigInt(width - 1 - i)) & 1n) ones[i]++;
  }
  return ones.map((o) => o / values.length);
}

/** Uniform random integer in [0, n) from crypto.getRandomValues (rejection sampling). */
export function randomBelow(n) {
  n = BigInt(n);
  const bytes = Math.ceil(n.toString(2).length / 8);
  const limit = (1n << BigInt(bytes * 8)) - ((1n << BigInt(bytes * 8)) % n);
  const buf = new Uint8Array(bytes);
  for (;;) {
    crypto.getRandomValues(buf);
    let v = 0n;
    for (const b of buf) v = (v << 8n) | BigInt(b);
    if (v < limit) return v % n;
  }
}

export const fmtP = (p) => (p < 1e-4 ? p.toExponential(1) : p.toFixed(4));
export const fmtPct = (x, digits = 2) => `${(100 * x).toFixed(digits)}%`;
