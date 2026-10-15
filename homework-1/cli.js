#!/usr/bin/env node
// Terminal version of HW1: prints G, 2G, ..., kG and the toy public key.
//
//   node homework-1/cli.js            # k = 6, G = (1, 5)
//   node homework-1/cli.js 7
//   node homework-1/cli.js 123456789012345678901234567890   # double-and-add only

import { PRESETS, multiples, scalarMultTrace, fmt, groupOrder, pointOrder, enumeratePoints } from './ecc.js';

const { curve: C, G } = PRESETS.toy17;
const k = BigInt(process.argv[2] ?? 6);
const N = groupOrder(C);

console.log(`Toy curve      : ${C.name}`);
console.log(`Points         : ${enumeratePoints(C).map(fmt).join(' ')} O   (#E = ${N})`);
console.log(`Base point     : G = ${fmt(G)}   (order ${pointOrder(C, G, N)})`);
console.log(`Private key    : k = ${k}`);
console.log('');

if (k <= 64n) {
  console.log('Repeated addition:');
  multiples(C, G, k).forEach((P, i) => console.log(`  ${String(i + 1).padStart(2)}G = ${fmt(P)}`));
  console.log('');
}

const { bits, steps, result } = scalarMultTrace(C, k, G);
console.log(`Double-and-add (k = ${bits}b, ${steps.length} group operations):`);
for (const s of steps) {
  const what = s.op === 'double' ? `2 * ${fmt(s.from)}` : s.op === 'load' ? `O + G` : `${fmt(s.from)} + G`;
  const lam = s.lambda !== undefined ? `   lambda = ${s.lambda}` : '';
  console.log(`  bit ${bits[s.bitIndex]}  ${s.op.padEnd(6)} ${what.padEnd(22)} = ${fmt(s.result).padEnd(9)} (${s.acc}G)${lam}`);
}
console.log('');
console.log(`TOY PUBLIC KEY : Q = ${k}G = ${fmt(result)}`);
