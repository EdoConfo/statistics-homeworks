// Homework 7, Ex. 2: Bayes' theorem on a finite set of hypotheses and the Beta prior with a binomial likelihood.
import { logGamma } from '../assets/js/statkit.js';

/** Posterior over a finite set of hypotheses: P(Hᵢ | data) = P(data | Hᵢ) P(Hᵢ) / ∑ⱼ P(data | Hⱼ) P(Hⱼ). */
export function posterior(prior, likelihood) {
  const joint = prior.map((p, i) => p * likelihood[i]);
  const evidence = joint.reduce((s, v) => s + v, 0);
  return { joint, evidence, posterior: joint.map((v) => v / evidence) };
}

/**
 * IDS alarm: H = attack or no attack, prior P(attack) = base rate, likelihoods P(alarm | attack) = sensitivity and
 * P(alarm | no attack) = false-positive rate. After each alarm the posterior becomes the prior of the next update
 * (alarms independent given the state). Returns P(attack) before any alarm and after 1, …, alarms of them.
 */
export function alarmUpdates(baseRate, sensitivity, falsePositive, alarms = 3) {
  const steps = [baseRate];
  let p = baseRate;
  for (let k = 0; k < alarms; k++) {
    p = posterior([p, 1 - p], [sensitivity, falsePositive]).posterior[0];
    steps.push(p);
  }
  return steps;
}

/** Natural frequencies: out of `total` events, how many are attacks and how many raise the alarm. */
export function alarmCounts(baseRate, sensitivity, falsePositive, total = 100000) {
  const attacks = total * baseRate, normal = total - attacks;
  const truePos = attacks * sensitivity, falsePos = normal * falsePositive;
  return { total, attacks, normal, truePos, falseNeg: attacks - truePos, falsePos, trueNeg: normal - falsePos };
}

// ---- Beta prior, binomial likelihood ---------------------------------------------------------------------------

export const logBeta = (a, b) => logGamma(a) + logGamma(b) - logGamma(a + b);

export function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) {
    if (x === 0) return a < 1 ? Infinity : a === 1 ? b : 0;
    if (x === 1) return b < 1 ? Infinity : b === 1 ? a : 0;
    return 0;
  }
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - logBeta(a, b));
}

/** Continued fraction of the incomplete beta function (modified Lentz). */
function betaCf(a, b, x) {
  const TINY = 1e-300;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Beta CDF, the regularized incomplete beta function Iₓ(a, b). */
export function betaCdf(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log1p(-x) - logBeta(a, b));
  return x < (a + 1) / (a + b + 2) ? (front * betaCf(a, b, x)) / a : 1 - (front * betaCf(b, a, 1 - x)) / b;
}

/** Beta quantile by bisection on the CDF. */
export function betaQuantile(q, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Conjugate update: Beta(a, b) prior and k successes in n trials give the Beta(a + k, b + n − k) posterior. */
export const betaUpdate = (a, b, k, n) => ({ a: a + k, b: b + n - k });

export function betaSummary(a, b) {
  const s = a + b;
  return {
    mean: a / s,
    mode: a > 1 && b > 1 ? (a - 1) / (s - 2) : NaN,
    sd: Math.sqrt((a * b) / (s * s * (s + 1))),
    lo: betaQuantile(0.025, a, b),
    hi: betaQuantile(0.975, a, b),
  };
}

/**
 * Binomial likelihood L(θ) = θᵏ (1 − θ)ⁿ⁻ᵏ rescaled to integrate to 1 over [0, 1], i.e. the Beta(k + 1, n − k + 1) density,
 * so that it can be drawn on the same axis as the prior and the posterior densities.
 */
export const likelihoodDensity = (theta, k, n) => betaPdf(theta, k + 1, n - k + 1);

/** Posterior mean as a weighted average of the prior mean and the observed proportion k/n. */
export function shrinkage(a, b, k, n) {
  const w = (a + b) / (a + b + n);
  return { priorWeight: w, priorMean: a / (a + b), mle: n ? k / n : NaN, mean: w * (a / (a + b)) + (1 - w) * (n ? k / n : 0) };
}
