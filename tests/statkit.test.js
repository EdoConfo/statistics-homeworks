import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chiSquareSurvival, chiSquareTest, pearson, spearman, binomialPmf, wilson,
  logGamma, popcountBig, bitBalance, hammingBytes,
} from '../assets/js/statkit.js';

const close = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test('chi-square survival matches table values', () => {
  close(chiSquareSurvival(3.841458821, 1), 0.05);
  close(chiSquareSurvival(18.30703805, 10), 0.05);
  close(chiSquareSurvival(24.99579014, 15), 0.05);
  close(chiSquareSurvival(0, 4), 1);
});

test('chi-square test on a perfectly uniform sample', () => {
  const r = chiSquareTest([10, 10, 10, 10]);
  assert.equal(r.stat, 0);
  assert.equal(r.df, 3);
  close(r.pValue, 1);
});

test('correlation coefficients', () => {
  close(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  close(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  close(spearman([1, 2, 3, 4], [1, 4, 9, 16]), 1);
});

test('gamma and binomial', () => {
  close(logGamma(5), Math.log(24), 1e-9);
  close(binomialPmf(2, 4, 0.5), 6 / 16, 1e-12);
  const w = wilson(50, 100);
  assert.ok(w.lo < 0.5 && w.hi > 0.5);
});

test('bit helpers', () => {
  assert.equal(popcountBig(0xffn << 40n), 8);
  assert.deepEqual(bitBalance([0b10, 0b11], 2), [1, 0.5]);
  assert.equal(hammingBytes(Uint8Array.of(0xff, 0), Uint8Array.of(0x0f, 1)), 5);
});
