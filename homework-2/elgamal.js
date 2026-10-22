// The toy scheme: EC-ElGamal on secp256k1, built only from the Part 1 arithmetic (ecc.js),
// with the private key restricted to a small range [1, 2^bits].
//
//   key pair      k ∈ [1, 2^bits] (private),  Q = kG (public)
//   encryption    message block → point M,  fresh random r,  C1 = rG,  C2 = M + rQ
//   decryption    S = kC1 (= rQ),  M = C2 − S,  point → message block
//
// Educational code: no padding, no authentication, NOT constant-time.

import { makeCurve, point, mod, add, neg, scalarMult, isOnCurve } from '../homework-1/part-1/ecc.js';
import { randomBelow } from '../assets/js/statkit.js';

export const SECP256K1 = {
  curve: makeCurve({ p: 2n ** 256n - 2n ** 32n - 977n, b: 7, name: 'secp256k1' }),
  G: point(
    0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  ),
  n: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,   // prime order of G
};

const { curve: C, G, n } = SECP256K1;

/** Message bytes per block: x = 256·m + j must stay below p, and 30 bytes leave plenty of room. */
export const BLOCK_BYTES = 30;

export function modPow(b, e, m) {
  let r = 1n;
  b = mod(b, m);
  for (; e > 0n; e >>= 1n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
  }
  return r;
}

/** Private key uniform in [1, 2^bits] and public key Q = kG. */
export function keyGen(bits, k = 1n + randomBelow(1n << BigInt(bits))) {
  return { bits, k, Q: scalarMult(C, k, G) };
}

/** Fresh ephemeral scalar r, uniform in [1, n − 1]. */
export const randomScalar = () => 1n + randomBelow(n - 1n);

export function bytesToInt(bytes) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

export function intToBytes(v, len) {
  const out = [];
  for (; v > 0n; v >>= 8n) out.unshift(Number(v & 0xffn));
  while (len !== undefined && out.length < len) out.unshift(0);
  return Uint8Array.from(out);
}

/**
 * Koblitz encoding: the block becomes the integer m, and x = 256·m + j for the first j = 0, 1, 2, …
 * for which x³ + 7 is a square mod p. About half of all x qualify, so j is usually 0, 1 or 2.
 * Since p ≡ 3 (mod 4), a square root is (x³ + 7)^((p+1)/4).
 */
export function encodeBlock(bytes) {
  const m = bytesToInt(bytes);
  for (let j = 0n; j < 256n; j++) {
    const x = m * 256n + j;
    const rhs = mod(x * x * x + 7n, C.p);
    const y = modPow(rhs, (C.p + 1n) / 4n, C.p);
    if ((y * y) % C.p === rhs) return { m, j, M: { x, y } };
  }
  throw new Error('no curve point for this block');
}

/** Drop the 8 bits of j and read the message bytes back. */
export const decodeBlock = (M) => intToBytes(M.x >> 8n);

export function encryptBlock(Q, M, r = randomScalar()) {
  const C1 = scalarMult(C, r, G);
  const S = scalarMult(C, r, Q);
  return { r, S, C1, C2: add(C, M, S) };
}

export function decryptBlock(k, C1, C2) {
  if (!isOnCurve(C, C1) || !isOnCurve(C, C2)) throw new RangeError('ciphertext point is not on the curve');
  const S = scalarMult(C, k, C1);
  return { S, M: add(C, C2, neg(C, S)) };
}

/** UTF-8 text → blocks of BLOCK_BYTES → one (C1, C2) pair per block, each with its own r. */
export function encrypt(Q, text, nextR = randomScalar) {
  const bytes = new TextEncoder().encode(text);
  const blocks = [];
  for (let i = 0; i < bytes.length; i += BLOCK_BYTES) {
    const block = bytes.subarray(i, i + BLOCK_BYTES);
    const enc = encodeBlock(block);
    blocks.push({ bytes: block, ...enc, ...encryptBlock(Q, enc.M, nextR()) });
  }
  return blocks;
}

export function decrypt(k, blocks) {
  const parts = blocks.map(({ C1, C2 }) => decodeBlock(decryptBlock(k, C1, C2).M));
  const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0;
  for (const p of parts) { all.set(p, off); off += p.length; }
  return new TextDecoder().decode(all);
}

/** A point as 64 bytes, x ‖ y: what a ciphertext looks like on the wire (uncompressed, without the 04 prefix). */
export const pointBytes = (P) => Uint8Array.from([...intToBytes(P.x, 32), ...intToBytes(P.y, 32)]);

export const hex = (v, digits = 64) => v.toString(16).padStart(digits, '0');
