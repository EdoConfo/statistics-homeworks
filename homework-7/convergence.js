// Homework 7, Ex. 1: the typewriter sequence and the variance of a sum under the three normalizations.

/**
 * Typewriter sequence on Ω = [0, 1) with the uniform probability: write n = 2ᵏ + j with 0 ≤ j < 2ᵏ;
 * Xₙ is the indicator of the interval [j/2ᵏ, (j+1)/2ᵏ), which sweeps [0, 1) once per block k.
 */
export function typewriter(n, omega) {
  const k = Math.floor(Math.log2(n));
  const j = n - 2 ** k;
  const width = 2 ** -k;
  const lo = j * width, hi = lo + width;
  return { k, j, lo, hi, value: omega >= lo && omega < hi ? 1 : 0, prob: width };
}

/**
 * Variance of Sₙ = X₁ + … + Xₙ when every Xᵢ has variance σ² and every pair has correlation ρ:
 * Var(Sₙ) = ∑ Var(Xᵢ) + 2 ∑_{i<j} Cov(Xᵢ, Xⱼ) = nσ² + n(n − 1)ρσ².
 */
export function sumVariance(n, sigma2 = 1, rho = 0) {
  const total = n * sigma2 * (1 + (n - 1) * rho);
  return { total, mean: total / (n * n), normalized: total / n };
}
