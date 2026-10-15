// Part 2 section 06: Monte Carlo experiments on checksums, avalanche and address uniformity.
import {
  entropyToMnemonic, checkIndices, toChecksumAddress, checkAddress, addressFromPrivateKey, keccak_256, bytesToHex, CURVE_N,
} from './wallet.js';
import { barChart } from '../../assets/js/charts.js';
import { wilson, binomialPmf, chiSquareTest, hammingBytes, mean, sd, fmtP } from '../../assets/js/statkit.js';

const $ = (id) => document.getElementById(id);
const HEX = '0123456789abcdef';
const AVALANCHE_TRIALS = 5000;
const ADDRESS_SAMPLES = 1000;
const EIP55_FACTOR = 4; // rare events need more trials
const P_COLLISION = (13 / 16) ** 40;

const pct = (x, d = 2) => `${(100 * x).toFixed(d)}%`;

// pooled CSPRNG output: one getRandomValues call per 4096 draws
const pool = new Uint32Array(4096);
let poolPos = pool.length;
function randInt(n) { // n <= 2^16, so the modulo bias is below 2^-16
  if (poolPos === pool.length) { crypto.getRandomValues(pool); poolPos = 0; }
  return pool[poolPos++] % n;
}

function countLetters(s) {
  let c = 0;
  for (let i = 0; i < s.length; i++) {
    const x = s.charCodeAt(i) | 0x20;
    if (x >= 97 && x <= 102 && s.charCodeAt(i) > 57) c++;
  }
  return c;
}

function tile(label, value, sub) {
  const t = document.createElement('div');
  t.className = 'tile';
  const a = document.createElement('div'); a.className = 't-label'; a.textContent = label;
  const b = document.createElement('div'); b.className = 't-value'; b.textContent = value;
  const c = document.createElement('div'); c.className = 't-sub'; c.textContent = sub;
  t.append(a, b, c);
  return t;
}

// Yield to the event loop through a MessageChannel: unlike setTimeout it is not
// throttled to ~1 s when the tab is in the background.
const yieldToBrowser = () => new Promise((r) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => r();
  ch.port2.postMessage(0);
});

/** Run `body(i)` n times, yielding to the browser every `chunk` iterations. */
async function loop(n, body, label, chunk = 4000) {
  for (let i = 0; i < n; i++) {
    body(i);
    if (i % chunk === chunk - 1) {
      $('x-status').textContent = `${label} ${Math.round((100 * i) / n)}%`;
      await yieldToBrowser();
    }
  }
}

/** Proportion with its Wilson interval; with a theoretical value, also say whether the interval covers it. */
function estimateTile(label, hits, n, expected, expectedLabel) {
  const w = wilson(hits, n);
  const d = w.p < 0.001 ? 4 : 2;
  let sub = `${hits}/${n} · 95% CI [${pct(w.lo, d)}, ${pct(w.hi, d)}]`;
  if (expected !== undefined) sub += ` · theory ${expectedLabel}${expected >= w.lo && expected <= w.hi ? ' ✓ inside' : ' ✗ outside'}`;
  return tile(label, pct(w.p, d), sub);
}

async function bip39(n) {
  const words = new Array(12);
  let random12 = 0, oneWord = 0, random24 = 0;
  await loop(n, () => {
    for (let j = 0; j < 12; j++) words[j] = randInt(2048);
    random12 += checkIndices(words);
  }, 'BIP-39 random phrases');
  await loop(n, () => {
    const { indices } = entropyToMnemonic(crypto.getRandomValues(new Uint8Array(16)));
    const pos = randInt(12);
    let r;
    do { r = randInt(2048); } while (r === indices[pos]);
    indices[pos] = r;
    oneWord += checkIndices(indices);
  }, 'BIP-39 one-word errors');
  const w24 = new Array(24);
  await loop(n, () => {
    for (let j = 0; j < 24; j++) w24[j] = randInt(2048);
    random24 += checkIndices(w24);
  }, 'BIP-39 24-word phrases');
  $('x-bip39').replaceChildren(
    estimateTile('Random 12 words: checksum valid', random12, n, 1 / 16, '1/16 = 6.25%'),
    estimateTile('Valid phrase, one word replaced: still valid', oneWord, n, 1 / 16, '≈ 1/16'),
    estimateTile('Random 24 words: checksum valid', random24, n, 1 / 256, '1/256 = 0.39%'),
  );
}

async function eip55(n) {
  const bytes = new Uint8Array(20);
  const lettersHist = new Array(41).fill(0);
  let collisions = 0;
  await loop(n, () => {
    crypto.getRandomValues(bytes);
    const lower = bytesToHex(bytes);
    const { checksummed } = toChecksumAddress(lower);
    lettersHist[countLetters(lower)]++;
    // one-character substitution, typed in a random case
    const pos = 2 + randInt(40);
    const old = checksummed[pos].toLowerCase();
    let c;
    do { c = HEX[randInt(16)]; } while (c === old);
    if (c > '9' && randInt(2)) c = c.toUpperCase();
    const typed = checksummed.slice(0, pos) + c + checksummed.slice(pos + 1);
    const { valid, hasChecksum } = checkAddress(typed);
    if (valid && hasChecksum) collisions++;
  }, 'EIP-55 typos');

  $('x-eip').replaceChildren(
    estimateTile('Single-character typo accepted by the checksum', collisions, n, P_COLLISION, '(13/16)⁴⁰ ≈ 0.0247%'),
    tile('Mean letters per address', (lettersHist.reduce((s, c, L) => s + c * L, 0) / n).toFixed(2), 'theory 40 · 6/16 = 15'),
  );

  const lo = 4, hi = 28;
  const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  barChart($('x-letters'), {
    data: range.map((L) => ({ label: String(L), value: lettersHist[L] })),
    expected: range.map((L) => n * binomialPmf(L, 40, 6 / 16)),
    expectedStyle: 'line', observedLabel: 'Observed', expectedLabel: 'Binomial(40, 6/16)',
    xLabel: 'letters L', yLabel: 'addresses', height: 220,
  });
}

async function avalanche() {
  const input = new Uint8Array(64);
  const hd = [];
  await loop(AVALANCHE_TRIALS, () => {
    crypto.getRandomValues(input);
    const h1 = keccak_256(input);
    const bit = randInt(512);
    input[bit >> 3] ^= 1 << (bit & 7);
    hd.push(hammingBytes(h1, keccak_256(input)));
  }, 'Keccak avalanche');
  const lo = 96, hi = 160;
  const counts = new Array(hi - lo + 1).fill(0);
  hd.forEach((d) => { if (d >= lo && d <= hi) counts[d - lo]++; });
  barChart($('x-av'), {
    data: counts.map((v, i) => ({ label: String(lo + i), value: v })),
    expected: counts.map((_, i) => hd.length * binomialPmf(lo + i, 256, 0.5)),
    expectedStyle: 'line', observedLabel: 'Observed', expectedLabel: 'Binomial(256, ½)',
    xLabel: 'changed bits', yLabel: 'count', height: 230, xTickEvery: 8,
  });
  $('x-av-sub').textContent = `${hd.length} trials · mean ${mean(hd).toFixed(2)} (theory 128) · sd ${sd(hd).toFixed(2)} (theory 8)`;
}

async function addresses() {
  const nib = new Array(16).fill(0);
  const ones = new Array(160).fill(0);
  const priv = new Uint8Array(32);
  await loop(ADDRESS_SAMPLES, () => {
    let k;
    do {
      crypto.getRandomValues(priv);
      k = BigInt('0x' + bytesToHex(priv));
    } while (k === 0n || k >= CURVE_N);
    const { address } = addressFromPrivateKey(priv);
    for (let i = 0; i < 40; i++) {
      const v = parseInt(address[i], 16);
      nib[v]++;
      for (let b = 0; b < 4; b++) if ((v >> (3 - b)) & 1) ones[4 * i + b]++;
    }
  }, 'secp256k1 + Keccak addresses', 100);
  const test = chiSquareTest(nib);
  barChart($('x-nib'), {
    data: nib.map((v, i) => ({ label: HEX[i], value: v })),
    expected: nib.map(() => (ADDRESS_SAMPLES * 40) / 16),
    observedLabel: 'Observed', expectedLabel: 'Uniform', xLabel: 'hex digit', yLabel: 'count', height: 220,
  });
  $('x-nib-sub').textContent = `${ADDRESS_SAMPLES} random private keys · χ² = ${test.stat.toFixed(1)}, df ${test.df}, p = ${fmtP(test.pValue)}`;
  const share = ones.map((o) => o / ADDRESS_SAMPLES);
  const band = 1.96 * Math.sqrt(0.25 / ADDRESS_SAMPLES);
  const outside = share.filter((s) => Math.abs(s - 0.5) > band).length;
  barChart($('x-bits'), {
    data: share.map((s, i) => ({ label: String(i), value: s, tip: s.toFixed(3) })),
    yMax: 1, ref: { value: 0.5 }, yFmt: (v) => v.toFixed(2), xLabel: 'bit position (MSB first)', yLabel: 'share of 1s', height: 220, xTickEvery: 20,
  });
  $('x-bits-sub').textContent = `${outside} of 160 bits outside the 95% band 0.5 ± ${band.toFixed(3)} (about 8 expected by chance)`;
}

let running = false;
async function runAll() {
  if (running) return;
  running = true;
  const btn = $('x-run');
  btn.disabled = true;
  const n = Math.max(1000, Math.min(400000, Math.floor(Number($('x-n').value) || 20000)));
  $('x-n').value = n;
  try {
    await bip39(n);
    await avalanche();
    await addresses();
    await eip55(EIP55_FACTOR * n); // slowest, so it runs last
    $('x-status').textContent = `Done: ${n.toLocaleString('en-US')} BIP-39 trials per row, ${(EIP55_FACTOR * n).toLocaleString('en-US')} EIP-55 typos.`;
  } finally {
    running = false;
    btn.disabled = false;
  }
}

export function initExperiments() {
  $('x-run').addEventListener('click', runAll);
  // start when the section first scrolls into view, so the page itself loads instantly
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); runAll(); }
  }, { rootMargin: '200px' });
  io.observe($('experiments'));
}
