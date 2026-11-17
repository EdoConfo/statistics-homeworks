import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contingencyTable, relative, conditional, expected, chiSquare, criticalValue, intrusionLog, SERVICES, OUTCOMES,
} from '../homework-6/independence.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

// 2 × 2 table [[10, 20], [30, 40]] written as raw records.
const records = [
  ...Array(10).fill({ x: 'a', f: 'u' }), ...Array(20).fill({ x: 'a', f: 'v' }),
  ...Array(30).fill({ x: 'b', f: 'u' }), ...Array(40).fill({ x: 'b', f: 'v' }),
];

test('the contingency table counts the records and its margins add up', () => {
  const t = contingencyTable(records, 'x', 'f');
  assert.deepEqual(t.rows, ['a', 'b']);
  assert.deepEqual(t.cols, ['u', 'v']);
  assert.deepEqual(t.counts, [[10, 20], [30, 40]]);
  assert.deepEqual(t.rowTotals, [30, 70]);
  assert.deepEqual(t.colTotals, [40, 60]);
  assert.equal(t.n, 100);
});

test('relative and conditional frequencies', () => {
  const t = contingencyTable(records, 'x', 'f');
  const r = relative(t), c = conditional(t);
  close(r.joint[1][1], 0.4);
  assert.deepEqual(r.rowMarginal, [0.3, 0.7]);
  assert.deepEqual(r.colMarginal, [0.4, 0.6]);
  close(c.fGivenX[0][0], 1 / 3);
  close(c.xGivenF[1][1], 40 / 60);
  for (const row of c.fGivenX) close(row[0] + row[1], 1);
});

test('expected counts and chi-square match the hand computation', () => {
  const t = contingencyTable(records, 'x', 'f');
  const E = expected(t);
  assert.deepEqual(E, [[12, 18], [28, 42]]);
  const x = chiSquare(t);
  close(x.stat, 4 / 12 + 4 / 18 + 4 / 28 + 4 / 42);   // 0.7937
  assert.equal(x.df, 1);
  close(x.pValue, 0.37300, 1e-4);
});

test('an independent table gives chi-square 0 and p-value 1', () => {
  const t = { rows: ['a', 'b'], cols: ['u', 'v', 'w'], counts: [[2, 4, 6], [4, 8, 12]], rowTotals: [12, 24], colTotals: [6, 12, 18], n: 36 };
  const x = chiSquare(t);
  close(x.stat, 0);
  close(x.pValue, 1);
});

test('critical values of the chi-square distribution', () => {
  close(criticalValue(1), 3.841459, 1e-5);
  close(criticalValue(6), 12.591587, 1e-5);
});

test('the simulated log is reproducible and uses the listed categories', () => {
  const a = intrusionLog(500, 7), b = intrusionLog(500, 7);
  assert.deepEqual(a, b);
  const t = contingencyTable(a, 'service', 'outcome', SERVICES, OUTCOMES);
  assert.deepEqual(t.rows, SERVICES);
  assert.deepEqual(t.cols, OUTCOMES);
  assert.equal(t.n, 500);
});
