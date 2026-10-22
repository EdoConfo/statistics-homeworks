// Homework 2 page controller: the toy scheme (01), the Caesar cipher (02) and their comparison (03).
import { SECP256K1, keyGen, encrypt, decrypt, encodeBlock, encryptBlock, decryptBlock, decodeBlock, pointBytes } from './elgamal.js';
import { encrypt as caesarEncrypt, decrypt as caesarDecrypt, letters, letterCounts, indexOfCoincidence, ALPHABET } from './caesar.js';
import { TEST } from './corpus.js';
import { barChart } from '../assets/js/charts.js?v=3';
import { chiSquareTest, fmtP } from '../assets/js/statkit.js';
import { $, tile, writeConsole, yieldToBrowser, whenVisible, shortHex, shortPoint, group, sup, stage, stagePoint, stageText } from './ui.js';
import { initCryptanalysis } from './cryptanalysis.js';
import { initKeyspace } from './keyspace.js';

const { n } = SECP256K1;
const BITS = [16, 20, 24, 28, 32];
const scheme = { bits: 20, keys: null, blocks: null };
let keyspace;

const byteHex = (bytes, max = 16) =>
  [...bytes.slice(0, max)].map((b) => b.toString(16).padStart(2, '0')).join(' ') + (bytes.length > max ? ' …' : '');
const quote = (s) => `"${s}"`;

// ---- 01 the toy scheme ---------------------------------------------------------

function fillBits() {
  for (const sel of document.querySelectorAll('[data-bits]')) {
    for (const b of BITS) {
      const o = document.createElement('option');
      o.value = b;
      o.textContent = `[1, 2${sup(b)}] · ${group(2 ** b)} keys`;
      sel.appendChild(o);
    }
    sel.value = scheme.bits;
    sel.addEventListener('change', () => setBits(Number(sel.value)));
  }
}

function setBits(bits) {
  scheme.bits = bits;
  for (const sel of document.querySelectorAll('[data-bits]')) sel.value = bits;
  newKeys();
}

function newKeys() {
  scheme.keys = keyGen(scheme.bits);
  runScheme();
}

function runScheme() {
  const text = $('e-msg').value;
  const out = $('e-out');
  if (!text) {
    writeConsole(out, [[['Type a message to encrypt.', 'c-warn']]]);
    return;
  }
  const { k, Q, bits } = scheme.keys;
  const t0 = performance.now();
  const blocks = encrypt(Q, text);
  const t1 = performance.now();
  const plain = decrypt(k, blocks);
  const t2 = performance.now();
  scheme.blocks = blocks;

  const total = new TextEncoder().encode(text).length;
  const shown = blocks.slice(0, 2);
  const many = blocks.length > 1;
  const blockHead = (i) => (many ? [[[`  block ${i + 1}`, 'c-dim']]] : []);
  const lines = [
    [['# curve       ', 'c-dim'], 'secp256k1, y² = x³ + 7 (mod p), p = 2²⁵⁶ − 2³² − 977'],
    [['# base point  ', 'c-dim'], `G = ${shortPoint(SECP256K1.G)}`],
    [['# order of G  ', 'c-dim'], `n = ${shortHex(n)} ≈ 2²⁵⁶ (prime)`],
    '',
    [['KEY GENERATION', 'c-hi'], ['  receiver', 'c-dim']],
    [`  k = ${group(k)}`, [`   random in [1, 2${sup(bits)}]`, 'c-dim']],
    `  Q = kG = ${shortPoint(Q)}`,
    '',
    [['ENCODING', 'c-hi'], [`  ${total} bytes → ${blocks.length} block${many ? 's' : ''} of up to 30 bytes`, 'c-dim']],
  ];
  shown.forEach((b, i) => {
    lines.push(...blockHead(i));
    lines.push(`  bytes ${byteHex(b.bytes)}`);
    lines.push(`  m = 0x${shortHex(b.m)}`);
    lines.push(`  x = 256·m + j  with j = ${b.j}`);
    lines.push([`  M = ${shortPoint(b.M)}  `, ['✓ on the curve', 'c-ok']]);
  });
  lines.push('', [['ENCRYPTION', 'c-hi'], ['  sender, knows only Q', 'c-dim']]);
  shown.forEach((b, i) => {
    lines.push(...blockHead(i));
    lines.push([`  r  = ${shortHex(b.r)}`, ['   fresh, random in [1, n − 1]', 'c-dim']]);
    lines.push(`  C₁ = rG    = ${shortPoint(b.C1)}`);
    lines.push([`  S  = rQ    = ${shortPoint(b.S)}`, ['   the mask', 'c-dim']]);
    lines.push(`  C₂ = M + S = ${shortPoint(b.C2)}`);
  });
  lines.push('', [['DECRYPTION', 'c-hi'], ['  receiver, uses k', 'c-dim']]);
  shown.forEach((b, i) => {
    const d = decryptBlock(k, b.C1, b.C2);
    lines.push(...blockHead(i));
    lines.push([`  S  = kC₁   = ${shortPoint(d.S)}  `, d.S.x === b.S.x ? ['= rQ ✓', 'c-ok'] : ['≠ rQ', 'c-warn']]);
    lines.push(`  M  = C₂ − S = ${shortPoint(d.M)}`);
    lines.push(`  x without its last byte → ${byteHex(decodeBlock(d.M))}`);
  });
  if (blocks.length > shown.length) lines.push([[`  … ${blocks.length - shown.length} more block${blocks.length - shown.length > 1 ? 's' : ''}, each with its own r`, 'c-dim']]);
  lines.push('', [['RESULT  ', 'c-hi'], quote(plain), plain === text ? ['   ✓ identical to the message', 'c-ok'] : ['   ✗ differs', 'c-warn']]);
  writeConsole(out, lines);

  $('e-ct').textContent = `C₁ = ${shortPoint(blocks[0].C1)}\nC₂ = ${shortPoint(blocks[0].C2)}`;
  $('e-ct-sub').textContent = `${blocks.length} block${blocks.length > 1 ? 's' : ''} · ${blocks.length * 128} bytes for ${total} bytes of text`;
  $('e-pt').textContent = plain;
  $('e-pt-sub').textContent = plain === text ? 'identical to the message' : 'differs from the message';
  $('e-tiles').replaceChildren(
    tile('Private key k', group(k), `${bits}-bit range`),
    tile('Encryption', `${(t1 - t0).toFixed(0)} ms`, `${2 * blocks.length} scalar multiplications`),
    tile('Decryption', `${(t2 - t1).toFixed(0)} ms`, `${blocks.length} scalar multiplication${blocks.length > 1 ? 's' : ''}, small k`),
  );
  keyspace?.setTarget({ bits, Q, blocks });

  stage('k', group(k));
  stage('k-range', `k ≤ 2${sup(bits)}`);
  stage('Q', stagePoint(Q));
  stage('msg', stageText(text));
  stage('msg-bytes', `${total} bytes`);
  stage('M', stagePoint(blocks[0].M));
  stage('M-blocks', many ? `block 1 of ${blocks.length}` : '1 block');
  stage('ct', `C₁ ${shortHex(blocks[0].C1.x)}\nC₂ ${shortHex(blocks[0].C2.x)}`);
  stage('ct-size', `${blocks.length * 128} bytes`);
  stage('dec', `${stageText(plain)} ${plain === text ? '✓' : '✗'}`);
}

function initScheme() {
  fillBits();
  $('e-run').addEventListener('click', runScheme);
  $('e-keys').addEventListener('click', newKeys);
  $('e-msg').addEventListener('keydown', (e) => { if (e.key === 'Enter') runScheme(); });
  scheme.keys = keyGen(scheme.bits);
}

// ---- 02 the Caesar cipher ----------------------------------------------------------

const MAX_LETTER_LINES = 12;

function runCaesar() {
  const text = $('e-msg').value;   // the same message as section 01
  $('c-msg').value = text;
  const K = Number($('c-k').value);
  $('c-k-val').textContent = K;
  const ct = caesarEncrypt(text, K);
  const back = caesarDecrypt(ct, K);

  const used = new Set(letters(text));
  $('c-alpha').replaceChildren(...[...ALPHABET].map((ch, i) => {
    const d = document.createElement('div');
    d.className = used.has(i) ? 'pair used' : 'pair';
    const a = document.createElement('span'); a.textContent = ch;
    const b = document.createElement('span'); b.textContent = ALPHABET[(i + K) % 26];
    d.append(a, b);
    return d;
  }));

  const letterLines = (src, sign) => {
    const out = [];
    let count = 0;
    for (const ch of src) {
      const up = ch.toUpperCase();
      const i = ALPHABET.indexOf(up);
      if (i < 0) continue;
      if (++count > MAX_LETTER_LINES) { out.push([['  …', 'c-dim']]); break; }
      const j = (i + sign * K + 26) % 26;
      out.push(`  ${up}  ${String(i).padStart(2)}  ${sign > 0 ? '+' : '−'} ${K}  →  ${String(j).padStart(2)}  ${ALPHABET[j]}`);
    }
    return out;
  };
  writeConsole($('c-out'), [
    [['# key ', 'c-dim'], `K = ${K}`],
    '',
    [['ENCRYPTION', 'c-hi'], [`  c = (x + ${K}) mod 26`, 'c-dim']],
    ...letterLines(text, 1),
    [['  ciphertext  ', 'c-dim'], quote(ct)],
    '',
    [['DECRYPTION', 'c-hi'], [`  x = (c − ${K}) mod 26`, 'c-dim']],
    ...letterLines(ct, -1),
    [['  plaintext   ', 'c-dim'], quote(back), back === text ? ['   ✓', 'c-ok'] : ['   ✗', 'c-warn']],
  ]);
  $('c-ct').textContent = ct || '–';
  stage('K', `K = ${K}`);
  stage('caesar-ct', ct ? stageText(ct) : '–');
  $('c-ct-sub').textContent = `decrypts back to "${back}"`;
}

function initCaesar() {
  $('e-msg').addEventListener('input', runCaesar);
  $('c-k').addEventListener('input', runCaesar);
  runCaesar();
}

// ---- 03 statistics of the two ciphertexts ---------------------------------------------

const MEASURE_TEXT = TEST[1];
const MEASURE_K = 3;

let measuring = false;
async function measure() {
  if (measuring) return;
  measuring = true;
  $('m-run').disabled = true;
  try {
    const plainCounts = letterCounts(letters(MEASURE_TEXT));
    const caesarCounts = letterCounts(letters(caesarEncrypt(MEASURE_TEXT, MEASURE_K)));
    const bytes = new TextEncoder().encode(MEASURE_TEXT);
    $('m-len').textContent = `${group(letters(MEASURE_TEXT).length)} letters, ${group(bytes.length)} bytes`;

    // EC-ElGamal block by block, yielding so the page stays responsive (≈ 45 ms per block)
    const nBlocks = Math.ceil(bytes.length / 30);
    const ecCounts = new Array(256).fill(0);
    for (let i = 0; i < nBlocks; i++) {
      $('m-status').textContent = `Encrypting block ${i + 1} of ${nBlocks}…`;
      await yieldToBrowser();
      const { C1, C2 } = encryptBlock(scheme.keys.Q, encodeBlock(bytes.subarray(i * 30, i * 30 + 30)).M);
      for (const v of [...pointBytes(C1), ...pointBytes(C2)]) ecCounts[v]++;
    }
    const ecTotal = nBlocks * 128;
    $('m-status').textContent = `${nBlocks} blocks, ${group(ecTotal)} ciphertext bytes. A new random r for every block, so every run gives different bytes.`;

    const letterData = (c) => c.map((v, i) => ({ label: ALPHABET[i], value: v }));
    barChart($('m-plain'), { data: letterData(plainCounts), height: 200, yLabel: 'count', xTickEvery: 2,
      table: { headers: ['Letter', 'Count'], rows: plainCounts.map((v, i) => [ALPHABET[i], v]) } });
    barChart($('m-caesar'), { data: letterData(caesarCounts), height: 200, yLabel: 'count', xTickEvery: 2, color: 'var(--series-2)',
      table: { headers: ['Letter', 'Count'], rows: caesarCounts.map((v, i) => [ALPHABET[i], v]) } });
    const chi = chiSquareTest(ecCounts);
    $('m-ec-sub').textContent = `values 0–255 · line: uniform, ${(ecTotal / 256).toFixed(1)} each`;
    barChart($('m-ec'), {
      data: ecCounts.map((v, i) => ({ label: String(i), value: v })), height: 200, yLabel: 'count', xLabel: 'byte', xTickEvery: 64,
      color: 'var(--series-7)', expected: new Array(256).fill(ecTotal / 256), expectedStyle: 'line', expectedLabel: 'uniform',
      table: { headers: ['Byte', 'Count'], rows: ecCounts.map((v, i) => [i, v]) },
    });

    const icPlain = indexOfCoincidence(plainCounts);
    $('m-tiles').replaceChildren(
      tile('Index of coincidence · plaintext', icPlain.toFixed(4), 'English text ≈ 0.066, random letters 1/26 ≈ 0.038'),
      tile('Index of coincidence · Caesar', indexOfCoincidence(caesarCounts).toFixed(4), 'exactly the same: a shift only renames letters'),
      tile('Index of coincidence · EC bytes', indexOfCoincidence(ecCounts).toFixed(4), 'random bytes: 1/256 ≈ 0.0039'),
      tile('χ² uniformity · EC bytes', `p = ${fmtP(chi.pValue)}`, `χ² = ${chi.stat.toFixed(0)}, df = 255 · ` +
        (chi.pValue >= 0.05 ? 'no evidence against uniform' : 'p < 0.05 happens in 1 run out of 20 by chance')),
    );
  } finally {
    measuring = false;
    $('m-run').disabled = false;
  }
}

// ---- start ----------------------------------------------------------------------------

initScheme();
keyspace = initKeyspace();
runScheme();
initCaesar();
initCryptanalysis();
$('m-run').addEventListener('click', measure);
whenVisible($('compare'), measure);
