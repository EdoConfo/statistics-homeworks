import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selfTest, pipeline, toChecksumAddress, checkAddress, checkMnemonic, checkIndices, entropyToMnemonic,
  derivePath, hexToBytes, bytesToHex, TEST_MNEMONIC,
} from '../homework-2/wallet.js';

test('all known-answer vectors pass', () => {
  for (const r of selfTest()) assert.equal(r.got, r.expect, r.name);
});

test('EIP-55 reference addresses', () => {
  for (const a of [
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
  ]) {
    assert.equal(toChecksumAddress(a.toLowerCase()).checksummed, a);
    assert.deepEqual(checkAddress(a), { valid: true, hasChecksum: true });
  }
  assert.equal(checkAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD').valid, false);
  assert.deepEqual(checkAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'), { valid: true, hasChecksum: false });
});

test('BIP-32 test vector 1 master key and chain code', () => {
  const [m] = derivePath(hexToBytes('000102030405060708090a0b0c0d0e0f'), 'm');
  assert.equal(bytesToHex(m.key), 'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35');
  assert.equal(bytesToHex(m.chainCode), '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508');
});

test('Hardhat accounts 0..2 (m/44\'/60\'/0\'/0/i)', () => {
  const expected = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  ];
  expected.forEach((addr, i) => {
    assert.equal(pipeline({ mnemonic: TEST_MNEMONIC, path: `m/44'/60'/0'/0/${i}` }).checksummed, addr);
  });
});

test('mnemonic checksum round trip and single-word corruption', () => {
  const { words } = entropyToMnemonic(new Uint8Array(16).fill(0x7f));
  assert.ok(checkMnemonic(words));
  assert.ok(checkMnemonic(TEST_MNEMONIC.split(' ')));
  assert.ok(!checkMnemonic(TEST_MNEMONIC.replace('junk', 'test').split(' ')));
});

test('24-word phrases: round trip and 8 checksum bits', () => {
  for (let t = 0; t < 50; t++) {
    const { indices, csBits } = entropyToMnemonic(crypto.getRandomValues(new Uint8Array(32)));
    assert.equal(indices.length, 24);
    assert.equal(csBits.length, 8);
    assert.ok(checkIndices(indices));
    indices[23] ^= 1; // flip the last checksum bit
    assert.ok(!checkIndices(indices));
  }
});
