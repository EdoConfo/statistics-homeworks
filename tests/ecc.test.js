import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, INF, add, neg, eq, isOnCurve, multiples, scalarMult, scalarMultTrace,
  enumeratePoints, groupOrder, pointOrder, bruteForceLog, isPrime, fmt,
} from '../homework-1/ecc.js';

const { curve: C, G } = PRESETS.toy17;

test('assignment example: 6G = (5, 8) on y^2 = x^3 + 7 mod 17', () => {
  assert.equal(fmt(scalarMult(C, 6, G)), '(5, 8)');
  assert.deepEqual(multiples(C, G, 9).map(fmt),
    ['(1, 5)', '(2, 10)', '(5, 9)', '(12, 1)', '(12, 16)', '(5, 8)', '(2, 7)', '(1, 12)', 'O']);
});

test('toy17 has 18 points and G has order 9', () => {
  assert.equal(enumeratePoints(C).length, 17);
  assert.equal(groupOrder(C), 18n);
  assert.equal(pointOrder(C, G), 9n);
  for (const P of enumeratePoints(C)) assert.ok(isOnCurve(C, P));
});

test('double-and-add agrees with repeated addition', () => {
  const naive = multiples(C, G, 40);
  for (let k = 1; k <= 40; k++) assert.ok(eq(scalarMult(C, k, G), naive[k - 1]), `k=${k}`);
});

test('trace accumulator matches k and the result', () => {
  const k = 1234567891011121314151617181920n;
  const { steps, result } = scalarMultTrace(C, k, G);
  assert.equal(steps.at(-1).acc, k);
  assert.ok(eq(result, scalarMult(C, k % 9n, G)));
});

test('group law: identity, inverse, commutativity, associativity', () => {
  const pts = [INF, ...enumeratePoints(C)];
  for (const P of pts) {
    assert.ok(eq(add(C, P, INF), P));
    assert.equal(add(C, P, neg(C, P)), INF);
    for (const Q of pts) {
      assert.ok(eq(add(C, P, Q), add(C, Q, P)));
      for (const R of pts.slice(0, 6)) {
        assert.ok(eq(add(C, add(C, P, Q), R), add(C, P, add(C, Q, R))));
      }
    }
  }
});

test('homomorphism (a + b)G = aG + bG on a prime-order curve', () => {
  const { curve, G: g } = PRESETS.toy1051;
  for (const [a, b] of [[3, 5], [100, 999], [1092, 7], [500, 593]]) {
    assert.ok(eq(scalarMult(curve, a + b, g), add(curve, scalarMult(curve, a, g), scalarMult(curve, b, g))));
  }
});

test('larger presets have prime order and valid generators', () => {
  for (const key of ['toy97', 'toy1051']) {
    const { curve, G: g } = PRESETS[key];
    const N = groupOrder(curve);
    assert.ok(isPrime(N), key);
    assert.ok(isOnCurve(curve, g));
    assert.equal(pointOrder(curve, g, N), N);
  }
  assert.ok(isOnCurve(PRESETS.toy65173.curve, PRESETS.toy65173.G));
});

test('brute-force discrete log recovers k on the toy curve', () => {
  const Q = scalarMult(C, 6, G);
  assert.equal(bruteForceLog(C, G, Q).k, 6n);
});
