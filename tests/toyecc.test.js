import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scalarMult, isOnCurve, add, neg, eq, INF } from '../homework-1/part-1/ecc.js';
import {
  SECP256K1, keyGen, encodeBlock, decodeBlock, encryptBlock, decrypt, encrypt, modPow,
} from '../homework-2/elgamal.js';
import { bruteForce, babyStepGiantStep, runToEnd, isqrtCeil, addMixed } from '../homework-2/attack.js';

const { curve: C, G, n } = SECP256K1;

test('secp256k1 parameters: G on the curve, nG = O, p ≡ 3 (mod 4)', () => {
  assert.ok(isOnCurve(C, G));
  assert.equal(scalarMult(C, n, G), INF);
  assert.equal(C.p % 4n, 3n);
  assert.equal(modPow(3n, C.p - 1n, C.p), 1n);
});

test('known public key: k = 1 gives G, k = 2 gives the published 2G', () => {
  assert.ok(eq(keyGen(8, 1n).Q, G));
  assert.equal(scalarMult(C, 2n, G).x, 0xc6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5n);
});

test('Koblitz encoding gives a curve point and decodes back', () => {
  const bytes = new TextEncoder().encode('ATTACK AT DAWN');
  const { M, j } = encodeBlock(bytes);
  assert.ok(isOnCurve(C, M));
  assert.ok(j < 256n);
  assert.deepEqual(decodeBlock(M), bytes);
});

test('encrypt then decrypt returns the message (several blocks, UTF-8)', () => {
  const { k, Q } = keyGen(16);
  const msg = 'ATTACK AT DAWN — attacca all’alba, più tardi è troppo tardi.';
  const blocks = encrypt(Q, msg);
  assert.ok(blocks.length > 1);
  assert.equal(decrypt(k, blocks), msg);
});

test('encryption is randomised: same message, different ciphertexts', () => {
  const { Q } = keyGen(16);
  const [a] = encrypt(Q, 'HELLO');
  const [b] = encrypt(Q, 'HELLO');
  assert.ok(!eq(a.C1, b.C1) && !eq(a.C2, b.C2));
});

test('the shared secret: rQ = kC1', () => {
  const { k, Q } = keyGen(12);
  const { M } = encodeBlock([65]);
  const { S, C1, C2 } = encryptBlock(Q, M, 123456789n);
  assert.ok(eq(scalarMult(C, k, C1), S));
  assert.ok(eq(add(C, C2, neg(C, S)), M));
});

test('a wrong key decrypts to garbage, not to the message', () => {
  const { k, Q } = keyGen(16);
  const blocks = encrypt(Q, 'SECRET');
  assert.notEqual(decrypt(k + 1n, blocks.map((b) => ({ C1: b.C1, C2: b.C2 }))).slice(0, 6), 'SECRET');
});

test('mixed Jacobian addition agrees with the affine law', () => {
  let R = { X: G.x, Y: G.y, Z: 1n };
  for (let i = 2n; i <= 6n; i++) {
    R = addMixed(C, R, G);
    const P = scalarMult(C, i, G);
    const Z2 = (R.Z * R.Z) % C.p;
    assert.equal((P.x * Z2) % C.p, R.X % C.p);
  }
});

test('brute force recovers a 12-bit key and reports the work', () => {
  const { k, Q } = keyGen(12);
  const res = runToEnd(bruteForce(C, G, Q, 1n << 12n));
  assert.equal(res.k, k);
  assert.equal(res.ops, k);
});

test('baby-step giant-step recovers keys over the whole range, edges included', () => {
  const maxK = 1n << 16n;
  const m = isqrtCeil(maxK);
  assert.equal(m, 256n);
  for (const k of [1n, 2n, m - 1n, m, m + 1n, 2n * m, maxK - 1n, maxK, 40000n]) {
    const res = runToEnd(babyStepGiantStep(C, G, scalarMult(C, k, G), maxK, 64));
    assert.equal(res.k, k, `k = ${k}`);
    assert.ok(res.ops <= 2n * m + 1n);
  }
});

test('both attacks give up when the key is outside the range', () => {
  const Q = scalarMult(C, 5000n, G);
  assert.equal(runToEnd(bruteForce(C, G, Q, 4096n)).k, null);
  assert.equal(runToEnd(babyStepGiantStep(C, G, Q, 4096n)).k, null);
});

test('recovered key decrypts the ciphertext', () => {
  const { Q } = keyGen(14);
  const blocks = encrypt(Q, 'MEET ME AT NOON');
  const { k } = runToEnd(babyStepGiantStep(C, G, Q, 1n << 14n));
  assert.equal(decrypt(k, blocks), 'MEET ME AT NOON');
});
