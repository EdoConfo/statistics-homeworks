import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encrypt, decrypt, letters, indexOfCoincidence, letterCounts, buildModel, crack, sampleText, rng, lengthExperiment,
} from '../homework-2/caesar.js';
import { TRAIN, TEST, SAMPLES } from '../homework-2/corpus.js';

const model = buildModel(TRAIN);

test('textbook example: ATTACK AT DAWN with K = 3', () => {
  assert.equal(encrypt('ATTACK AT DAWN', 3), 'DWWDFN DW GDZQ');
  assert.equal(decrypt('DWWDFN DW GDZQ', 3), 'ATTACK AT DAWN');
  assert.equal(encrypt('Hello, World!', 13), 'Uryyb, Jbeyq!');
});

test('decryption inverts encryption for every key', () => {
  const t = SAMPLES.italian.text;
  for (let K = -30; K <= 30; K++) assert.equal(decrypt(encrypt(t, K), K), t);
});

test('the corpus looks like English', () => {
  assert.ok(model.letters > 30000, `${model.letters} letters`);
  const order = model.freq.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]);
  assert.equal(order[0], 'E');
  assert.ok('TAO'.includes(order[1]));
  assert.ok(model.ic > 0.06 && model.ic < 0.072, `IC ${model.ic}`);
  assert.ok(SAMPLES.noE.text.toUpperCase().indexOf('E') < 0, 'lipogram has no E');
});

test('a shift does not change the index of coincidence', () => {
  const t = TEST[1];
  const ic = (s) => indexOfCoincidence(letterCounts(letters(s)));
  for (const K of [1, 7, 19]) assert.equal(ic(encrypt(t, K)), ic(t));
});

test('every method recovers the key of a long held-out paragraph', () => {
  for (const t of TEST) {
    const K = 1 + (t.length % 25);
    const res = crack(encrypt(t, K), model);
    for (const [id, r] of Object.entries(res)) assert.equal(r.key, K, `${id} on "${t.slice(0, 20)}…"`);
  }
});

test('sampled pieces have exactly n letters', () => {
  const rand = rng(7);
  for (const n of [1, 5, 40]) assert.equal(letters(sampleText(TEST, n, rand)).length, n);
});

test('success grows with ciphertext length', () => {
  const [short, long] = lengthExperiment(model, TEST, [3, 60], 150, 3);
  for (const id of ['chi', 'bigram']) assert.ok(long.hits[id] > short.hits[id]);
  assert.ok(long.hits.chi / long.trials > 0.95);
});
