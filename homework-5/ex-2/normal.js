// The standard normal CDF Φ(x) computed in several ways, each returning the value and the work it took.

const INV_SQRT_2PI = 0.3989422804014327;   // 1/√(2π)

/** Standard normal density φ(x). */
export const pdf = (x) => INV_SQRT_2PI * Math.exp(-0.5 * x * x);

/** Trapezoidal rule on Φ(x) = 1/2 + ∫₀ˣ φ(t) dt with n subintervals (n + 1 evaluations of φ). */
export function trapezoid(x, n) {
  const h = x / n;
  let s = 0.5 * (pdf(0) + pdf(x));
  for (let i = 1; i < n; i++) s += pdf(i * h);
  return { value: 0.5 + h * s, work: n + 1 };
}

/** Simpson's rule on the same integral, n even (n + 1 evaluations of φ). */
export function simpson(x, n) {
  if (n % 2) n++;
  const h = x / n;
  let s = pdf(0) + pdf(x);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * pdf(i * h);
  return { value: 0.5 + (h / 3) * s, work: n + 1 };
}

/**
 * Power series of the antiderivative, integrated term by term:
 * Φ(x) = 1/2 + (1/√(2π)) Σ (−1)ᵏ x^(2k+1) / (2ᵏ (2k + 1) k!). Alternating: it stops when a term no longer changes the sum.
 */
export function taylor(x) {
  let a = x, s = x, k = 0;              // a = (−1)ᵏ x^(2k+1) / (2ᵏ k!)
  while (k < 500) {
    k++;
    a *= (-x * x) / (2 * k);
    const term = a / (2 * k + 1);
    if (s + term === s) break;
    s += term;
  }
  return { value: 0.5 + INV_SQRT_2PI * s, work: k };
}

/**
 * Same series with the Gaussian factored out (all terms positive, no cancellation):
 * Φ(x) = 1/2 + φ(x) (x + x³/3 + x⁵/(3·5) + x⁷/(3·5·7) + …).
 */
export function positiveSeries(x) {
  let a = x, s = x, k = 0;
  while (k < 1000) {
    k++;
    a *= (x * x) / (2 * k + 1);
    if (s + a === s) break;
    s += a;
  }
  return { value: 0.5 + pdf(x) * s, work: k };
}

/**
 * Upper tail Q(x) = 1 − Φ(x) for x > 0 from Laplace's continued fraction
 * Q(x) = φ(x) / (x + 1/(x + 2/(x + 3/(x + …)))), evaluated with the modified Lentz algorithm.
 */
export function tailFraction(x) {
  if (x === 0) return { value: 0.5, work: 0 };
  const tiny = 1e-300;
  let f = x, C = x, D = 0, k = 0;
  while (k < 5000) {
    k++;
    D = x + k * D; D = D === 0 ? tiny : 1 / D;
    C = x + k / C; if (C === 0) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return { value: pdf(x) / f, work: k };
}

/** Abramowitz & Stegun 7.1.26: erf(z) ≈ 1 − (a₁t + … + a₅t⁵) e^(−z²), t = 1/(1 + pz), |error| ≤ 1.5 × 10⁻⁷. */
export function erfAS(z) {
  const s = Math.sign(z), u = Math.abs(z);
  const t = 1 / (1 + 0.3275911 * u);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return s * (1 - poly * Math.exp(-u * u));
}

/** Φ(x) = (1 + erf(x/√2)) / 2 with the A&S erf. */
export const erfFormula = (x) => ({ value: 0.5 * (1 + erfAS(x / Math.SQRT2)), work: 1 });

/** Where the method switches from the series to the continued fraction. */
export const SWITCH = 2.5;

/**
 * The method proposed here: the positive series near the centre, the continued fraction in the tails.
 * The left tail is computed directly as Q(−x), so very small probabilities keep their relative accuracy.
 */
export function phi(x) {
  if (Number.isNaN(x)) return { value: NaN, work: 0 };
  if (Math.abs(x) < SWITCH) return positiveSeries(x);
  const q = tailFraction(Math.abs(x));
  return { value: x < 0 ? q.value : 1 - q.value, work: q.work };
}

export const cdf = (x) => phi(x).value;

/** Erf from Φ: erf(z) = 2Φ(z√2) − 1. */
export const erf = (z) => 2 * cdf(z * Math.SQRT2) - 1;

/**
 * Reference values. Φ(k) for k = 0.5, 1, …, 8 come from the "Table of numerical values" of the Wikipedia article
 * "68–95–99.7 rule" (fraction p inside μ ± kσ, 15 decimals): Φ(k) = (1 + p)/2 and Φ(−k) = (1 − p)/2.
 * The other points (1.645, 1.96 and the tails, where that table has too few digits) were computed with
 * mpmath.ncdf at 30 significant digits.
 */
const INSIDE = {
  0.5: 0.382924922548026, 1: 0.682689492137086, 1.5: 0.866385597462284, 2: 0.954499736103642,
  2.5: 0.987580669348448, 3: 0.997300203936740, 3.5: 0.999534741841929, 4: 0.999936657516334,
};
export const REFERENCE = [
  ...Object.entries(INSIDE).flatMap(([k, p]) => [
    { x: -Number(k), value: (1 - p) / 2, source: 'wiki' },
    { x: Number(k), value: (1 + p) / 2, source: 'wiki' },
  ]),
  { x: 0, value: 0.5, source: 'exact' },
  { x: 1.645, value: 0.950015094460878636553496742645, source: 'mpmath' },
  { x: 1.96, value: 0.975002104851779563787176307604, source: 'mpmath' },
  { x: -1.96, value: 0.0249978951482204362128236923956, source: 'mpmath' },
  { x: -5, value: 2.86651571879193911673752332875e-7, source: 'mpmath' },
  { x: -6, value: 9.86587645037698140700864132398e-10, source: 'mpmath' },
  { x: -8, value: 6.22096057427178412351599517259e-16, source: 'mpmath' },
  { x: 5, value: 0.999999713348428120806088326248, source: 'mpmath' },
].sort((a, b) => a.x - b.x);

/** Φ(x) at x = −8, −7.75, …, 8 (step 1/4), mpmath.ncdf at 30 digits rounded to 17: the reference curve for the error charts. */
export const GRID = [6.2209605742717841e-16, 4.5946274357785955e-15, 3.1908916729108962e-14, 2.0838581586720694e-13, 1.279812543885835e-12, 7.3922577780178224e-12, 4.0160005838591178e-11, 2.0522634252189389e-10, 9.8658764503769814e-10, 4.4621724539016119e-9, 1.8989562465887719e-8, 7.6049605164887143e-8, 2.8665157187919391e-7, 1.0170832425687032e-6, 3.3976731247300604e-6, 1.068852577493442e-5, 3.1671241833119921e-5, 8.8417285200803868e-5, 0.00023262907903552504, 0.00057702504239076704, 0.0013498980316300945, 0.0029797632350545568, 0.0062096653257761352, 0.012224472655044703, 0.022750131948179207, 0.04005915686381709, 0.066807201268858066, 0.10564977366685526, 0.15865525393145705, 0.2266273523768682, 0.3085375387259869, 0.40129367431707628, 0.5, 0.59870632568292372, 0.6914624612740131, 0.7733726476231318, 0.84134474606854295, 0.89435022633314474, 0.93319279873114193, 0.95994084313618291, 0.97724986805182079, 0.9877755273449553, 0.99379033467422386, 0.99702023676494544, 0.99865010196836991, 0.99942297495760923, 0.99976737092096447, 0.9999115827147992, 0.99996832875816688, 0.99998931147422507, 0.99999660232687527, 0.99999898291675743, 0.99999971334842812, 0.99999992395039484, 0.99999998101043753, 0.99999999553782755, 0.99999999901341235, 0.99999999979477366, 0.99999999995983999, 0.99999999999260774, 0.99999999999872019, 0.99999999999979161, 0.99999999999996809, 0.99999999999999541, 0.99999999999999938];
export const gridX = (i) => -8 + i / 4;
