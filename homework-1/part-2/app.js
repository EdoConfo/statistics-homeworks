// Part 2 page controller: live pipeline demo and hash comparison.
import {
  entropyToMnemonic, indicesToEntropy, checkIndices, mnemonicToSeed, derivePath, addressFromPrivateKey,
  toChecksumAddress, bytesToHex, utf8ToBytes, keccak_256, sha3_256, sha256, wordlist,
  TEST_MNEMONIC, HARDENED,
} from './wallet.js';
import { initExperiments } from './experiments.js';

const $ = (id) => document.getElementById(id);
const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const LEVEL_NAMES = ['master', 'purpose', 'coin type (60 = ETH)', 'account', 'change', 'address index'];

const state = { indices: [], changed: new Set() };

function badge(el, kind, text) {
  el.className = `badge ${kind}`;
  el.replaceChildren();
  const icon = kind === 'ok'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    : kind === 'fail'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      : '';
  el.insertAdjacentHTML('afterbegin', icon);
  el.appendChild(document.createTextNode(text));
}

function span(cls, text) {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}

function setPhrase(words) {
  state.indices = words.map((w) => wordlist.indexOf(w));
  state.changed = new Set();
  render();
}

function randomPhrase(bytes) {
  const e = crypto.getRandomValues(new Uint8Array(bytes));
  state.indices = entropyToMnemonic(e).indices;
  state.changed = new Set();
  render();
}

function randomIndex() {
  return crypto.getRandomValues(new Uint16Array(1))[0] & 2047;
}

// BIP-44 path of the first Ethereum account
const PATH = "m/44'/60'/0'/0/0";

function render() {
  const { indices } = state;
  const words = indices.map((i) => wordlist[i]);
  const { entropy, checksum, cs } = indicesToEntropy(indices);
  const expectedCs = sha256(entropy)[0] >>> (8 - cs);
  const valid = checkIndices(indices);

  // 1 entropy
  $('d-entropy').textContent = bytesToHex(entropy);
  const eb = $('d-entbits');
  eb.replaceChildren();
  [...entropy].forEach((b) => eb.appendChild(span('grp', b.toString(2).padStart(8, '0'))));
  eb.appendChild(span('', '+ checksum '));
  eb.appendChild(span('grp cs', expectedCs.toString(2).padStart(cs, '0')));
  eb.appendChild(span('dim-txt', ` = first ${cs} bits of SHA-256(entropy) · ${entropy.length * 8} + ${cs} = ${indices.length * 11} bits = ${indices.length} × 11`));

  // 2 words
  const box = $('d-words');
  box.replaceChildren();
  indices.forEach((idx, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'word' + (state.changed.has(n) ? ' changed' : '');
    b.title = 'Replace with a random word';
    const bits = idx.toString(2).padStart(11, '0');
    const wb = span('w-bits', '');
    if (n === indices.length - 1) {
      wb.append(document.createTextNode(bits.slice(0, 11 - cs)), span('cs', bits.slice(11 - cs)));
    } else wb.textContent = bits;
    b.append(span('w-n', `${n + 1} · #${idx}`), span('w-word', wordlist[idx]), wb);
    b.addEventListener('click', () => {
      let r;
      do { r = randomIndex(); } while (r === idx);
      state.indices[n] = r;
      state.changed.add(n);
      render();
    });
    box.appendChild(b);
  });
  badge($('d-cs'), valid ? 'ok' : 'fail', valid ? 'checksum valid' : 'checksum invalid: a wallet rejects this phrase');
  $('d-cs-detail').textContent = valid
    ? `last ${cs} bits ${checksum.toString(2).padStart(cs, '0')} = SHA-256 prefix`
    : `found ${checksum.toString(2).padStart(cs, '0')}, expected ${expectedCs.toString(2).padStart(cs, '0')}. PBKDF2 accepts any string, so the steps below still run.`;

  // 3 seed
  const pass = $('d-pass').value;
  const t0 = performance.now();
  const seed = mnemonicToSeed(words.join(' '), pass);
  const ms = performance.now() - t0;
  $('d-seed').textContent = bytesToHex(seed);
  $('d-seed-time').textContent = `${ms.toFixed(0)} ms for 2048 HMAC-SHA512 rounds in this browser. Passphrase: ${pass ? `"${pass}"` : 'empty'}.`;

  // 4 levels
  const levels = derivePath(seed, PATH);
  const tb = $('d-levels');
  tb.replaceChildren();
  levels.forEach((lv, d) => {
    const tr = tb.insertRow();
    const cells = [
      lv.path,
      LEVEL_NAMES[d] ?? '',
      d === 0 ? '-' : lv.index >= HARDENED ? `yes (${lv.index - HARDENED} + 2³¹)` : 'no',
      `${bytesToHex(lv.key).slice(0, 16)}…`,
      `${bytesToHex(lv.chainCode).slice(0, 16)}…`,
    ];
    cells.forEach((c, i) => {
      const td = tr.insertCell();
      td.textContent = c;
      if (i === 0 || i >= 3) td.className = 'mono';
    });
  });

  // 5-8
  const priv = levels.at(-1).key;
  $('d-priv').textContent = bytesToHex(priv);
  const { pub, hash, address } = addressFromPrivateKey(priv);
  const hex = bytesToHex(pub);
  const pubEl = $('d-pub');
  pubEl.replaceChildren(span('dim-txt', hex.slice(0, 2) + ' '), document.createTextNode(hex.slice(2, 66) + ' ' + hex.slice(66)));
  const h = bytesToHex(hash);
  const mark = document.createElement('mark');
  mark.className = 'hl';
  mark.textContent = h.slice(24);
  $('d-hash').replaceChildren(span('dim-txt', h.slice(0, 24)), mark);
  $('d-addr').textContent = '0x' + address;

  const { checksummed, hash: csHash } = toChecksumAddress(address);
  const grid = $('d-eip55');
  grid.replaceChildren();
  let letters = 0, upper = 0;
  for (let i = 0; i < 40; i++) {
    const ch = checksummed[i + 2];
    const isLetter = /[a-fA-F]/.test(ch);
    const isUp = /[A-F]/.test(ch);
    letters += isLetter;
    upper += isUp;
    const c = document.createElement('div');
    c.className = 'c' + (isUp ? ' up' : isLetter ? ' lo' : '');
    c.title = isLetter ? `nibble ${csHash[i]} ${parseInt(csHash[i], 16) >= 8 ? '≥ 8 → uppercase' : '< 8 → lowercase'}` : 'digit: no check bit';
    c.append(span('ch', ch), span('nb', csHash[i]));
    grid.appendChild(c);
  }
  $('d-final').textContent = checksummed;
  $('d-final-sub').textContent = `${letters} letters = ${letters} check bits (${upper} uppercase). A random typo slips through with probability ≈ 2^−${letters} = ${(2 ** -letters).toExponential(1)}.`;
}

function initDemo() {
  $('d-gen12').addEventListener('click', () => randomPhrase(16));
  $('d-gen24').addEventListener('click', () => randomPhrase(32));
  $('d-hardhat').addEventListener('click', () => setPhrase(TEST_MNEMONIC.split(' ')));
  $('d-abandon').addEventListener('click', () => setPhrase(ABANDON.split(' ')));
  let t;
  $('d-pass').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 250); });
  setPhrase(TEST_MNEMONIC.split(' '));
}


function initHashCompare() {
  const input = $('h-in');
  const update = () => {
    const bytes = utf8ToBytes(input.value);
    const k = bytesToHex(keccak_256(bytes));
    const s3 = bytesToHex(sha3_256(bytes));
    $('h-keccak').textContent = k;
    $('h-sha3').textContent = s3;
    $('h-sha256').textContent = bytesToHex(sha256(bytes));
    let same = 0;
    for (let i = 0; i < 64; i++) same += k[i] === s3[i];
    $('h-diff').textContent = `Keccak-256 and SHA3-256 agree in ${same} of 64 hex positions (≈ 4 expected by chance for unrelated digests).`;
  };
  input.addEventListener('input', update);
  update();
}

initDemo();
initHashCompare();
initExperiments();
