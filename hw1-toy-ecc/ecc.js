// Toy elliptic-curve arithmetic over a prime field F_p.
//
// Curve in short Weierstrass form:  y^2 = x^3 + a*x + b  (mod p)
// Points are { x: bigint, y: bigint }; the point at infinity O is `null`.
//
// Everything uses BigInt, so the same code works for the 5-bit toy curve of
// the assignment and for arbitrarily large scalars k in double-and-add.
// Educational code: NOT constant-time, NOT safe for real keys.

export const INF = null;

export function mod(a, p) {
  const r = a % p;
  return r < 0n ? r + p : r;
}

/** Modular inverse with the extended Euclidean algorithm. */
export function inv(a, p) {
  let t = 0n, newT = 1n, r = p, newR = mod(a, p);
  if (newR === 0n) throw new RangeError('0 has no modular inverse');
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  return mod(t, p);
}

export function makeCurve({ p, a = 0, b, name = '' }) {
  return { p: BigInt(p), a: BigInt(a), b: BigInt(b), name };
}

export function point(x, y) {
  return { x: BigInt(x), y: BigInt(y) };
}

export function eq(P, Q) {
  if (P === INF || Q === INF) return P === Q;
  return P.x === Q.x && P.y === Q.y;
}

export function isOnCurve(C, P) {
  if (P === INF) return true;
  const { p, a, b } = C;
  return mod(P.y * P.y - (P.x * P.x * P.x + a * P.x + b), p) === 0n;
}

export function neg(C, P) {
  return P === INF ? INF : { x: P.x, y: mod(-P.y, C.p) };
}

/**
 * Point addition with every intermediate value exposed (used by the
 * step-by-step visualisation and the printed traces).
 *
 * kind:
 *   'identity' - one operand is O, result is the other operand
 *   'inverse'  - P = -Q, the line is vertical, result is O
 *   'double'   - P = Q, tangent line, lambda = (3x^2 + a) / (2y)
 *   'add'      - P != Q, chord, lambda = (y2 - y1) / (x2 - x1)
 *
 * For 'double' and 'add' we also return the line y = lambda*x + c (mod p)
 * and the third intersection point `third` = -R before the reflection.
 */
export function addDetailed(C, P, Q) {
  const { p, a } = C;
  if (P === INF) return { kind: 'identity', result: Q };
  if (Q === INF) return { kind: 'identity', result: P };
  if (P.x === Q.x && mod(P.y + Q.y, p) === 0n) return { kind: 'inverse', result: INF };

  const doubling = P.x === Q.x && P.y === Q.y;
  let num, den;
  if (doubling) {
    num = mod(3n * P.x * P.x + a, p);
    den = mod(2n * P.y, p);
  } else {
    num = mod(Q.y - P.y, p);
    den = mod(Q.x - P.x, p);
  }
  const lambda = mod(num * inv(den, p), p);
  const x3 = mod(lambda * lambda - P.x - Q.x, p);
  const y3 = mod(lambda * (P.x - x3) - P.y, p);
  const c = mod(P.y - lambda * P.x, p);
  return {
    kind: doubling ? 'double' : 'add',
    num, den, lambda, c,
    third: { x: x3, y: mod(-y3, p) },
    result: { x: x3, y: y3 },
  };
}

export function add(C, P, Q) {
  return addDetailed(C, P, Q).result;
}

export function double(C, P) {
  return addDetailed(C, P, P).result;
}

/** [1G, 2G, ..., kG] by repeated addition: k-1 additions, fine for small k. */
export function multiples(C, G, k) {
  const out = [];
  let R = INF;
  for (let i = 1n; i <= BigInt(k); i++) {
    R = add(C, R, G);
    out.push(R);
  }
  return out;
}

/**
 * Left-to-right double-and-add: O(log k) group operations.
 * Returns the result plus a trace of every operation for printing/animation.
 */
export function scalarMultTrace(C, k, G) {
  k = BigInt(k);
  if (k < 0n) return scalarMultTrace(C, -k, neg(C, G));
  const bits = k.toString(2);
  const steps = [];
  let R = INF;
  let acc = 0n; // R = acc * G at every point of the loop
  for (let i = 0; i < bits.length; i++) {
    if (R !== INF) {
      const d = addDetailed(C, R, R);
      steps.push({ bitIndex: i, op: 'double', from: R, operand: R, accBefore: acc, acc: acc * 2n, ...d });
      R = d.result;
    }
    acc *= 2n;
    if (bits[i] === '1') {
      const s = addDetailed(C, R, G);
      steps.push({ bitIndex: i, op: R === INF ? 'load' : 'add', from: R, operand: G, accBefore: acc, acc: acc + 1n, ...s });
      R = s.result;
      acc += 1n;
    }
  }
  return { bits, steps, result: R };
}

export function scalarMult(C, k, G) {
  k = BigInt(k);
  if (k < 0n) return scalarMult(C, -k, neg(C, G));
  let R = INF;
  for (const bit of k.toString(2)) {
    R = double(C, R);
    if (bit === '1') R = add(C, R, G);
  }
  return R;
}

/** All affine points, by tabulating square roots. O(p) - only for toy p. */
export function enumeratePoints(C) {
  const { p, a, b } = C;
  if (p > 200000n) throw new RangeError('enumeratePoints is meant for toy curves only');
  const roots = new Map();
  for (let y = 0n; y < p; y++) {
    const s = (y * y) % p;
    if (!roots.has(s)) roots.set(s, []);
    roots.get(s).push(y);
  }
  const pts = [];
  for (let x = 0n; x < p; x++) {
    const rhs = mod(x * x * x + a * x + b, p);
    for (const y of roots.get(rhs) ?? []) pts.push({ x, y });
  }
  return pts;
}

/** #E(F_p) = affine points + the point at infinity. */
export function groupOrder(C) {
  return BigInt(enumeratePoints(C).length + 1);
}

export function factorize(n) {
  n = BigInt(n);
  const f = new Map();
  for (let d = 2n; d * d <= n; d++) {
    while (n % d === 0n) { f.set(d, (f.get(d) ?? 0) + 1); n /= d; }
  }
  if (n > 1n) f.set(n, (f.get(n) ?? 0) + 1);
  return f;
}

export function divisors(n) {
  let ds = [1n];
  for (const [q, e] of factorize(n)) {
    const next = [];
    for (const d of ds) { let m = 1n; for (let i = 0; i <= e; i++) { next.push(d * m); m *= q; } }
    ds = next;
  }
  return ds.sort((u, v) => (u < v ? -1 : u > v ? 1 : 0));
}

/** Order of P: the smallest divisor d of #E with dP = O (Lagrange). */
export function pointOrder(C, P, N = groupOrder(C)) {
  if (P === INF) return 1n;
  for (const d of divisors(N)) if (scalarMult(C, d, P) === INF) return d;
  throw new Error('order not found - is P on the curve?');
}

/** Brute-force discrete log: smallest k >= 1 with kG = Q. Feasible only on toy curves. */
export function bruteForceLog(C, G, Q, limit = 1n << 20n) {
  let R = INF;
  for (let k = 1n; k <= limit; k++) {
    R = add(C, R, G);
    if (eq(R, Q)) return { k, tries: k };
    if (R === INF && Q !== INF) return { k: null, tries: k }; // walked the whole cycle
  }
  return { k: null, tries: limit };
}

export function fmt(P) {
  return P === INF ? 'O' : `(${P.x}, ${P.y})`;
}

export function isPrime(n) {
  n = BigInt(n);
  if (n < 2n) return false;
  for (let d = 2n; d * d <= n; d++) if (n % d === 0n) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Presets. "toy17" is the curve from the assignment; the larger ones keep the
// same equation y^2 = x^3 + 7 (like secp256k1) but give the statistics room.

export const PRESETS = {
  toy17: {
    label: 'p = 17 (assignment)',
    curve: makeCurve({ p: 17, b: 7, name: 'y² = x³ + 7 (mod 17)' }),
    G: point(1, 5),
    note: '18 points. p ≡ 2 (mod 3) makes the curve supersingular with exactly p + 1 points; G = (1, 5) has order 9.',
  },
  toy97: {
    label: 'p = 97 (prime order 79)',
    curve: makeCurve({ p: 97, b: 7, name: 'y² = x³ + 7 (mod 97)' }),
    G: point(1, 28),
    note: '79 points, a prime: every point except O generates the whole group, as on secp256k1.',
  },
  toy1051: {
    label: 'p = 1051 (prime order 1093)',
    curve: makeCurve({ p: 1051, b: 7, name: 'y² = x³ + 7 (mod 1051)' }),
    G: point(3, 385),
    note: '1093 points (prime). Coordinates fit in 11 bits.',
  },
  toy65173: {
    label: 'p = 65173 (prime order 65647)',
    curve: makeCurve({ p: 65173, b: 7, name: 'y² = x³ + 7 (mod 65173)' }),
    G: point(3, 1876),
    note: '65 647 points (prime). 16-bit coordinates: enough for bit-level statistics.',
  },
};

