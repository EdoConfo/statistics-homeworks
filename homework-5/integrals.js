// Riemann and Lebesgue sums for a function on [a, b], counting how many times the function is evaluated.
// Riemann: split the domain into N equal pieces and add f(midpoint) · width.
// Lebesgue: split the range into N equal levels and add level step · measure of {x : f(x) > t} (the "layer cake" form),
// where the measure of each superlevel set is found from the crossings of f with the level (bisection on a fixed grid).

/** The functions studied in Exercise 1. `lo`/`hi` bound the range; `hi` is Infinity when f is unbounded. */
export const FUNCTIONS = [
  { id: 'sin', label: 'sin x on [0, π]', a: 0, b: Math.PI, f: Math.sin, lo: 0, hi: 1, exact: 2 },
  { id: 'sq', label: 'x² on [0, 1]', a: 0, b: 1, f: (x) => x * x, lo: 0, hi: 1, exact: 1 / 3 },
  { id: 'step13', label: '1 if x < 0.5, 3 if x ≥ 0.5', a: 0, b: 1, f: (x) => (x < 0.5 ? 1 : 3), lo: 1, hi: 3, exact: 2 },
  { id: 'abs', label: '|x − 0.5| on [0, 1]', a: 0, b: 1, f: (x) => Math.abs(x - 0.5), lo: 0, hi: 0.5, exact: 0.25 },
  { id: 'isqrt', label: '1/√x on (0, 1]', a: 0, b: 1, f: (x) => 1 / Math.sqrt(x), lo: 1, hi: Infinity, exact: 2 },
  { id: 'step10', label: '1 if x < 0.5, 0 if x ≥ 0.5', a: 0, b: 1, f: (x) => (x < 0.5 ? 1 : 0), lo: 0, hi: 1, exact: 0.5 },
  { id: 'sinc', label: 'sin x / x on [0, π]', a: 0, b: Math.PI, f: (x) => (x === 0 ? 1 : Math.sin(x) / x), lo: 0, hi: 1, exact: 1.8519370519824662 },
];

export const byId = (id) => FUNCTIONS.find((F) => F.id === id);

/** Wrap f so that every call is counted. */
function counted(f) {
  const g = (x) => { g.evals++; return f(x); };
  g.evals = 0;
  return g;
}

/** Midpoint Riemann sum with N equal subintervals. */
export function riemann(F, N) {
  const f = counted(F.f);
  const h = (F.b - F.a) / N;
  let s = 0;
  for (let i = 0; i < N; i++) s += f(F.a + (i + 0.5) * h);
  return { value: s * h, evals: f.evals };
}

/** Riemann sum pieces for drawing: one rectangle per subinterval. */
export function riemannBoxes(F, N) {
  const h = (F.b - F.a) / N;
  return Array.from({ length: N }, (_, i) => ({ x0: F.a + i * h, x1: F.a + (i + 1) * h, y: F.f(F.a + (i + 0.5) * h) }));
}

/**
 * Measure of {x in [a, b] : f(x) > t} from a grid of G cells: cells fully above t count whole,
 * cells where f crosses t are cut at the crossing, found by bisection.
 * Returns the measure and the intervals that make up the set (for drawing).
 */
export class LevelSets {
  constructor(F, G = 2048) {
    this.F = F;
    this.f = counted(F.f);
    this.G = G;
    this.xs = new Float64Array(G + 1);
    this.ys = new Float64Array(G + 1);
    for (let i = 0; i <= G; i++) {
      const x = F.a + ((F.b - F.a) * i) / G;
      this.xs[i] = x;
      this.ys[i] = this.f(x);
    }
  }

  /** Point in [x0, x1] where f passes level t (f(x0) and f(x1) on opposite sides of t). */
  cross(x0, x1, above0, t) {
    for (let k = 0; k < 60 && x1 - x0 > 1e-15 * (1 + Math.abs(x0)); k++) {
      const m = 0.5 * (x0 + x1);
      if ((this.f(m) > t) === above0) x0 = m; else x1 = m;
    }
    return 0.5 * (x0 + x1);
  }

  /** { measure, parts: [[x0, x1], …] } of the set where f > t. */
  above(t, wantParts = false) {
    const { xs, ys, G } = this;
    let measure = 0, start = ys[0] > t ? xs[0] : null;
    const parts = [];
    for (let i = 0; i < G; i++) {
      const u = ys[i] > t, v = ys[i + 1] > t;
      if (u === v) continue;
      const c = this.cross(xs[i], xs[i + 1], u, t);
      if (u) { measure += c - start; if (wantParts) parts.push([start, c]); start = null; } else start = c;
    }
    if (start !== null) { measure += xs[G] - start; if (wantParts) parts.push([start, xs[G]]); }
    return { measure, parts };
  }

  get evals() { return this.f.evals; }
}

/** Highest level used for the range partition: the maximum, or a cut-off growing like N^(2/3) when f is unbounded. */
export const topLevel = (F, N) => (Number.isFinite(F.hi) ? F.hi : F.lo + Math.cbrt(N * N));

/**
 * Lebesgue sum with N levels: ∫ f = lo · (b − a) + ∫_lo^hi μ{f > t} dt, the last integral taken with midpoint levels.
 * The evaluation count is the grid plus every bisection step made for these N levels.
 */
export function lebesgue(F, N, G = 2048) {
  const sets = new LevelSets(F, G);
  const top = topLevel(F, N);
  const dt = (top - F.lo) / N;
  let s = F.lo * (F.b - F.a);
  for (let k = 0; k < N; k++) s += dt * sets.above(F.lo + (k + 0.5) * dt).measure;
  return { value: s, evals: sets.evals, top };
}

/** Horizontal slabs for drawing the Lebesgue sum: each level t and the x-intervals where f > t. */
export function lebesgueSlabs(F, N, sets = new LevelSets(F, 1024)) {
  const top = topLevel(F, N);
  const dt = (top - F.lo) / N;
  return Array.from({ length: N }, (_, k) => {
    const t = F.lo + (k + 0.5) * dt;
    return { y0: F.lo + k * dt, y1: F.lo + (k + 1) * dt, t, parts: sets.above(t, true).parts };
  });
}

// ---- pathological functions: exact rational arithmetic -------------------------------------------

export const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

/** Thomae's function at p/q (any p, q > 0): 1 / (q in lowest terms). */
export const thomaeAt = (p, q) => 1 / (q / gcd(p, q));

/** Smallest denominator of a rational in [i/N, (i+1)/N]: the supremum of Thomae's function there is 1 / that. */
export function smallestDenominator(i, N) {
  for (let q = 1; ; q++) if (Math.ceil((i * q) / N) * N <= (i + 1) * q) return q;
}

/** Upper Darboux sum of Thomae's function with N equal subintervals of [0, 1] (the lower sum is 0). */
export function thomaeUpper(N) {
  let s = 0;
  for (let i = 0; i < N; i++) s += 1 / smallestDenominator(i, N);
  return s / N;
}

/** Midpoint Riemann sum of Thomae's function: midpoints (2i + 1)/(2N) are rational, evaluated exactly. */
export function thomaeMidpoint(N) {
  let s = 0;
  for (let i = 0; i < N; i++) s += thomaeAt(2 * i + 1, 2 * N);
  return s / N;
}

/** Number of points of [0, 1] where Thomae's function is at least 1/q: 0/1, 1/1 and p/k in lowest terms for 2 ≤ k ≤ q. */
export function thomaeLevelCount(q) {
  let c = 2;
  for (let k = 2; k <= q; k++) for (let p = 1; p < k; p++) if (gcd(p, k) === 1) c++;
  return c;
}

/** Log–log slope of error against N (least squares). */
export function logSlope(xs, ys) {
  const pts = xs.map((x, i) => [Math.log(x), Math.log(ys[i])]).filter(([, y]) => Number.isFinite(y));
  const n = pts.length;
  if (n < 2) return NaN;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxy / sxx;
}
