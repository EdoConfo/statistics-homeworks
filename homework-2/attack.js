// Recovering a restricted private key k ∈ [1, maxK] from the public key Q = kG.
//
//   brute force          walk G, 2G, 3G, … until the point equals Q          about maxK/2 additions on average
//   baby-step giant-step store jG for j ≤ m = ⌈√maxK⌉, then walk Q − i·mG    about 2√maxK additions, √maxK points of memory
//
// Same group law as ecc.js, but in Jacobian coordinates (X, Y, Z) ↦ (X/Z², Y/Z³): adding the fixed point G
// costs a dozen multiplications instead of a modular inversion, which makes millions of steps affordable.
// Both attacks are generators that yield progress, so the page can run them in slices and stay responsive.

import { mod, inv, add, neg, scalarMult, INF } from '../homework-1/part-1/ecc.js';

const ZERO = { X: 1n, Y: 1n, Z: 0n };   // the point at infinity
const jac = (P) => (P === INF ? ZERO : { X: P.x, Y: P.y, Z: 1n });

/** R + P with R in Jacobian and P affine (curve y² = x³ + b). */
export function addMixed(C, R, P) {
  const p = C.p;
  if (R.Z === 0n) return jac(P);
  const Z2 = (R.Z * R.Z) % p;
  const H = mod(((P.x * Z2) % p) - R.X, p);
  const r = mod(((((P.y * Z2) % p) * R.Z) % p) - R.Y, p);
  if (H === 0n) return r === 0n ? jac(add(C, P, P)) : ZERO;   // R = P (doubling) or R = −P: rare, use the affine law
  const H2 = (H * H) % p, H3 = (H2 * H) % p, V = (R.X * H2) % p;
  const X = mod(r * r - H3 - 2n * V, p);
  return { X, Y: mod(r * (V - X) - R.Y * H3, p), Z: (R.Z * H) % p };
}

/** Many points to affine with a single inversion (Montgomery's trick). */
function toAffineBatch(C, pts) {
  const p = C.p, prefix = new Array(pts.length);
  const z = pts.map((R) => R.Z || 1n);   // a point at infinity is skipped and comes back as INF
  let acc = 1n;
  for (let i = 0; i < pts.length; i++) { prefix[i] = acc; acc = (acc * z[i]) % p; }
  let invAcc = inv(acc, p);
  const out = new Array(pts.length);
  for (let i = pts.length - 1; i >= 0; i--) {
    const zi = (invAcc * prefix[i]) % p;   // 1 / Z_i
    invAcc = (invAcc * z[i]) % p;
    const zi2 = (zi * zi) % p;
    out[i] = pts[i].Z === 0n ? INF : { x: (pts[i].X * zi2) % p, y: (((pts[i].Y * zi2) % p) * zi) % p };
  }
  return out;
}

/** True when the Jacobian point R is the affine point Q (no inversion: compare X with x·Z², Y with y·Z³). */
function equals(C, R, Q) {
  const p = C.p, Z2 = (R.Z * R.Z) % p;
  return (Q.x * Z2 - R.X) % p === 0n && (((Q.y * Z2) % p) * R.Z - R.Y) % p === 0n;
}

/** Try k = 1, 2, 3, … up to maxK. Returns { k, ops } with k = null if Q is not in the range. */
export function* bruteForce(C, G, Q, maxK, chunk = 1024) {
  let R = jac(G);
  const every = BigInt(chunk);
  for (let k = 1n; k <= maxK; k++) {
    if (R.Z !== 0n && equals(C, R, Q)) return { k, ops: k };
    R = addMixed(C, R, G);
    if (k % every === 0n) yield { phase: 'brute force', done: k, total: maxK };
  }
  return { k: null, ops: maxK };
}

/** ⌈√v⌉ for a positive BigInt. */
export function isqrtCeil(v) {
  if (v < 2n) return v;
  let x = BigInt(Math.ceil(Math.sqrt(Number(v))));
  while (x * x < v) x++;
  while ((x - 1n) * (x - 1n) >= v) x--;
  return x;
}

/**
 * Baby-step giant-step on [1, maxK]. Baby steps: a table x(jG) → j for j = 1..m.
 * Giant steps: T = Q − i·mG for i = 0, 1, … ; a hit T = ±jG gives k = i·m ± j.
 */
export function* babyStepGiantStep(C, G, Q, maxK, batch = 512) {
  const m = isqrtCeil(maxK);
  const table = new Map();
  let R = jac(G), pending = [];
  for (let j = 1n; j <= m; j++) {
    pending.push(R);
    R = addMixed(C, R, G);
    if (pending.length === batch || j === m) {
      const first = j - BigInt(pending.length) + 1n;
      toAffineBatch(C, pending).forEach((P, i) => table.set(P.x, { j: first + BigInt(i), y: P.y }));
      pending = [];
      yield { phase: 'baby steps', done: j, total: m };
    }
  }

  const step = neg(C, scalarMult(C, m, G));   // −mG
  let T = jac(Q);
  for (let i = 0n; i <= m; ) {
    const giants = [];
    for (let b = 0; b < batch && i <= m; b++, i++) { giants.push(T); T = addMixed(C, T, step); }
    const aff = toAffineBatch(C, giants);
    for (let b = 0; b < aff.length; b++) {
      const hit = aff[b] !== INF && table.get(aff[b].x);
      if (!hit) continue;
      const gi = i - BigInt(aff.length) + BigInt(b);
      const k = hit.y === aff[b].y ? gi * m + hit.j : gi * m - hit.j;
      return { k, ops: m + gi + 1n, m };
    }
    yield { phase: 'giant steps', done: i, total: m + 1n };
  }
  return { k: null, ops: 2n * m + 1n, m };
}

/** Run a generator to the end (used by tests and quick measurements). */
export function runToEnd(gen) {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
