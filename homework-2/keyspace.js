// Homework 2 section 06: recovering the restricted private key of the toy scheme from its public key.
import { scalarMult, eq } from '../homework-1/part-1/ecc.js';
import { SECP256K1, decrypt } from './elgamal.js';
import { bruteForce, babyStepGiantStep, isqrtCeil, runToEnd } from './attack.js';
import { $, tile, writeConsole, yieldToBrowser, shortPoint, group, sup, sci, duration } from './ui.js';

const { curve: C, G } = SECP256K1;
const SLICE_MS = 40;
const SCALE_BITS = [16, 20, 24, 28, 32, 40, 64, 128];

const state = { method: 'brute', target: null, running: false, stop: false };
const speed = { brute: 0, bsgs: 0 };   // group operations per second, measured in this browser

function header(target) {
  const { bits, Q, blocks } = target;
  return [
    [['# public key   ', 'c-dim'], `Q = ${shortPoint(Q)}`],
    [['# key range    ', 'c-dim'], `k ∈ [1, 2${sup(bits)}] = ${group(2 ** bits)} candidates`],
    [['# ciphertext   ', 'c-dim'], `${blocks.length} block${blocks.length > 1 ? 's' : ''} (C₁, C₂) from section 01`],
    '',
  ];
}

function setTarget(target) {
  state.stop = true;   // a running attack aims at the old key: stop it
  state.target = target;
  if (!state.running) reset();
}

function reset() {
  writeConsole($('k-out'), [...header(state.target), [['Press "Run attack".', 'c-dim']]]);
  $('k-key').textContent = '–';
  $('k-key-sub').textContent = '';
  $('k-tiles').replaceChildren();
  $('k-progress').value = 0;
  $('k-progress-label').textContent = '';
}

async function run() {
  if (state.running || !state.target) return;
  const target = state.target;
  const { bits, Q, blocks } = target;
  const maxK = 1n << BigInt(bits);
  const method = state.method;
  const m = isqrtCeil(maxK);
  const gen = method === 'brute' ? bruteForce(C, G, Q, maxK) : babyStepGiantStep(C, G, Q, maxK);
  const totalOps = method === 'brute' ? maxK : 2n * m + 1n;

  state.running = true;
  state.stop = false;
  $('k-run').disabled = true;
  $('k-stop').disabled = false;
  const lines = header(target);
  if (method === 'brute') {
    lines.push([['BRUTE FORCE', 'c-hi'], ['  compare G, 2G, 3G, … with Q', 'c-dim']]);
    if (bits >= 26) lines.push([[`  about ${duration(2 ** (bits - 1) / (speed.brute || 1e5))} on average at the measured speed: Stop works at any time`, 'c-warn']]);
  } else {
    lines.push([['BABY-STEP GIANT-STEP', 'c-hi'], [`  m = ⌈√2${sup(bits)}⌉ = ${group(m)}`, 'c-dim']]);
    lines.push(`  baby steps   store x(jG) → j for j = 1 … ${group(m)}`);
    lines.push(`  giant steps  Q − i·mG for i = 0, 1, … until a hit`);
  }
  writeConsole($('k-out'), [...lines, [['  running…', 'c-dim']]]);

  const t0 = performance.now();
  let res = null, done = 0n;
  try {
    for (;;) {
      const slice = performance.now();
      let r;
      do r = gen.next(); while (!r.done && performance.now() - slice < SLICE_MS);
      if (r.done) { res = r.value; break; }
      done = r.value.phase === 'giant steps' ? m + r.value.done : r.value.done;
      $('k-progress').value = Number(done) / Number(totalOps);
      $('k-progress-label').textContent = `${r.value.phase} · ${group(done)} / ${group(totalOps)}`;
      await yieldToBrowser();
      if (state.stop) break;
    }
  } finally {
    state.running = false;
    $('k-run').disabled = false;
    $('k-stop').disabled = true;
  }
  const secs = (performance.now() - t0) / 1000;

  if (!res) {
    lines.push([[`  stopped after ${group(done)} additions (${duration(secs)})`, 'c-warn']]);
    writeConsole($('k-out'), lines);
    if (state.target !== target) reset();
    return;
  }

  const ops = Number(res.ops);
  speed[method] = ops / secs;
  renderScale();
  $('k-progress').value = 1;
  $('k-progress-label').textContent = `${group(res.ops)} additions`;

  if (res.k === null) {
    lines.push([['  no key in the range', 'c-warn']]);
    writeConsole($('k-out'), lines);
    return;
  }
  if (method === 'bsgs') {
    const i = (res.k - 1n) / m;   // k = i·m + j with 1 ≤ j ≤ m
    lines.push(`  hit after ${group(res.ops - m)} giant steps:  Q − ${group(i)}·mG = ${group(res.k - i * m)}·G`);
    lines.push(`  so k = ${group(i)}·${group(m)} + ${group(res.k - i * m)}`);
  }
  const ok = eq(scalarMult(C, res.k, G), Q);
  const plain = decrypt(res.k, blocks);
  lines.push(
    '',
    [['FOUND', 'c-ok'], `  k = ${group(res.k)}  after ${group(res.ops)} additions in ${duration(secs)}`],
    [`  check    kG = Q  `, ok ? ['✓', 'c-ok'] : ['✗', 'c-warn']],
    ['  decrypt  ', [`"${plain}"`, 'c-ok']],
  );
  writeConsole($('k-out'), lines);
  $('k-key').textContent = group(res.k);
  $('k-key-sub').textContent = `kG = Q ${ok ? '✓' : '✗'} · decrypts to "${plain.length > 40 ? plain.slice(0, 40) + '…' : plain}"`;
  $('k-tiles').replaceChildren(
    tile('Additions', group(res.ops), `${(100 * ops / 2 ** bits).toFixed(ops / 2 ** bits < 0.01 ? 3 : 1)}% of the ${group(2 ** bits)} keys`),
    tile('Time', duration(secs), `${sci(speed[method])} additions per second`),
    tile('Memory', method === 'brute' ? '1 point' : `${group(m)} points`, method === 'brute' ? 'only the current point' : 'the baby-step table'),
  );
}

/** Expected work and time for growing key spaces, at the speeds measured here. */
function renderScale() {
  const rows = SCALE_BITS.map((b) => {
    const brute = 2 ** (b - 1);
    const m = 2 ** Math.ceil(b / 2);
    const bsgs = 1.5 * m;   // m baby steps, then on average m/2 giant steps
    return [`2${sup(b)} = ${b <= 40 ? group(2 ** b) : sci(2 ** b)}`, sci(brute), duration(brute / speed.brute), sci(bsgs), sci(m), duration(bsgs / speed.bsgs)];
  });
  const rho = Math.sqrt(Math.PI * 2 ** 256 / 4);
  rows.push([`n ≈ 2²⁵⁶ (real secp256k1)`, sci(2 ** 255), duration(2 ** 255 / speed.brute), sci(1.5 * 2 ** 128), sci(2 ** 128), duration(1.5 * 2 ** 128 / speed.bsgs)]);
  rows.push([`n ≈ 2²⁵⁶ with Pollard's rho`, '', '', sci(rho), 'a few', duration(rho / speed.bsgs)]);
  $('k-scale').tBodies[0].replaceChildren(...rows.map((cells, r) => {
    const tr = document.createElement('tr');
    cells.forEach((c, i) => {
      const td = tr.insertCell();
      td.textContent = c;
      if (i > 0) td.className = 'num';
      if (r >= SCALE_BITS.length) td.style.fontWeight = '650';
    });
    return tr;
  }));
  $('k-scale-sub').textContent = `Times use the speed measured in this browser: ${sci(speed.brute)} additions per second for brute force and ` +
    `${sci(speed.bsgs)} for baby-step giant-step. Running an attack refreshes them.`;
}

/** A short warm-up run of each attack, so the scaling table starts from real numbers. */
function calibrate() {
  const Q = scalarMult(C, 1n << 40n, G);   // outside the range: both attacks run to the end
  let t = performance.now();
  runToEnd(bruteForce(C, G, Q, 4000n));
  speed.brute = 4000 / ((performance.now() - t) / 1000);
  t = performance.now();
  const res = runToEnd(babyStepGiantStep(C, G, Q, 1n << 22n));
  speed.bsgs = Number(res.ops) / ((performance.now() - t) / 1000);
}

export function initKeyspace() {
  const btns = [...document.querySelectorAll('[data-attack]')];
  btns.forEach((b) => b.addEventListener('click', () => {
    if (state.running) return;
    btns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    state.method = b.dataset.attack;
  }));
  $('k-run').addEventListener('click', run);
  $('k-stop').addEventListener('click', () => { state.stop = true; });
  calibrate();
  renderScale();
  return { setTarget };
}
