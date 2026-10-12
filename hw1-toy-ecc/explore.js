// HW1 section 06: statistical exploration of k -> kG.
import { PRESETS, INF, enumeratePoints, groupOrder, pointOrder, multiples, scalarMult, add, neg, fmt, eq } from './ecc.js';
import { barChart, scatterChart } from '../assets/js/charts.js';
import {
  chiSquareTest, pearson, spearman, bitBalance, binomialPmf, randomBelow, fmtP, mean, popcount32, hammingBytes,
} from '../assets/js/statkit.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_COUNTS = {
  toy17: { sweep: 36, random: 500 },
  toy97: { sweep: 158, random: 1000 },
  toy1051: { sweep: 2186, random: 3000 },
  toy65173: { sweep: 6000, random: 4000 },
};
const SCATTER_MAX = 2500;
const AVALANCHE_SAMPLES = 1500;
const STRUCTURE_TRIALS = 300;

const cache = new Map();
function curveInfo(key) {
  if (!cache.has(key)) {
    const { curve: C } = PRESETS[key];
    const points = enumeratePoints(C);
    cache.set(key, { C, points, N: BigInt(points.length + 1) });
  }
  return cache.get(key);
}

const bitLen = (n) => n.toString(2).length;

function toBytes(v, len) {
  const out = new Uint8Array(len);
  for (let i = len - 1; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

const bytesToBig = (b) => b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);

function tile(label, value, sub) {
  const t = document.createElement('div');
  t.className = 'tile';
  const a = document.createElement('div'); a.className = 't-label'; a.textContent = label;
  const b = document.createElement('div'); b.className = 't-value'; b.textContent = value;
  t.append(a, b);
  if (sub) { const c = document.createElement('div'); c.className = 't-sub'; c.textContent = sub; t.appendChild(c); }
  return t;
}

const state = { preset: 'toy17', mode: 'sweep' };

export function initExplore() {
  const curveSel = $('s-curve');
  for (const [key, pr] of Object.entries(PRESETS)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = pr.label;
    curveSel.appendChild(o);
  }
  curveSel.addEventListener('change', () => {
    state.preset = curveSel.value;
    fillBases();
    $('s-count').value = DEFAULT_COUNTS[state.preset][state.mode];
    run();
  });
  const modeBtns = [...document.querySelectorAll('[data-smode]')];
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    modeBtns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    state.mode = b.dataset.smode;
    $('s-count-label').textContent = state.mode === 'sweep' ? 'K' : 'Samples';
    $('s-count').value = DEFAULT_COUNTS[state.preset][state.mode];
    run();
  }));
  $('s-base').addEventListener('change', run);
  $('s-run').addEventListener('click', run);
  fillBases();
  run();
}

function fillBases() {
  const sel = $('s-base');
  sel.replaceChildren();
  const { C, points, N } = curveInfo(state.preset);
  const G = PRESETS[state.preset].G;
  const list = points.length <= 20 ? points : [G, ...points.filter((P) => !eq(P, G)).slice(0, 11)];
  for (const P of list) {
    const o = document.createElement('option');
    o.value = `${P.x},${P.y}`;
    o.textContent = `${fmt(P)} · order ${pointOrder(C, P, N)}${eq(P, G) ? ' (default)' : ''}`;
    if (eq(P, G)) o.selected = true;
    sel.appendChild(o);
  }
}

// Runs are serialised: a request that arrives mid-run triggers one more run at the end.
let running = false, pending = false;
async function run() {
  if (running) { pending = true; return; }
  running = true;
  const btn = $('s-run');
  btn.disabled = true;
  btn.textContent = 'Running…';
  try {
    do {
      pending = false;
      await new Promise((r) => requestAnimationFrame(() => r())); // let "Running…" paint
      await experiment();
    } while (pending);
  } finally {
    running = false;
    btn.disabled = false;
    btn.textContent = 'Run experiment';
  }
}

async function experiment() {
  const { C, points, N } = curveInfo(state.preset);
  const [gx, gy] = $('s-base').value.split(',').map(BigInt);
  const G = { x: gx, y: gy };
  const n = pointOrder(C, G, N);
  const p = Number(C.p);
  const w = bitLen(C.p - 1n);
  const count = Math.max(2, Math.min(70000, Math.floor(Number($('s-count').value) || 2)));
  $('s-count').value = count;

  // points of <G> without O
  const subgroup = n === N ? points : multiples(C, G, Number(n) - 1);

  // --- sample public keys -----------------------------------------------------
  const sample = [];
  let infCount = 0;
  if (state.mode === 'sweep') {
    let R = INF;
    for (let k = 1; k <= count; k++) {
      R = add(C, R, G);
      if (R === INF) infCount++;
      else sample.push({ k, x: Number(R.x), y: Number(R.y), Q: R });
    }
  } else {
    for (let i = 0; i < count; i++) {
      const k = randomBelow(n - 1n) + 1n;
      const R = scalarMult(C, k, G);
      sample.push({ k: Number(k), x: Number(R.x), y: Number(R.y), Q: R });
    }
  }
  const M = sample.length;
  const xs = sample.map((s) => s.x);
  const ys = sample.map((s) => s.y);
  const ks = sample.map((s) => s.k);

  $('s-note').textContent = `${PRESETS[state.preset].note} ` + (state.mode === 'sweep'
    ? `Sweep: k = 1…${count}. Outputs repeat with period ord(G) = ${n}.`
    : `Random: ${count} private keys drawn uniformly from [1, ${n - 1n}] with crypto.getRandomValues.`);

  // --- coordinate histograms ------------------------------------------------------
  const fine = p <= 97;
  const bins = fine ? p : 32;
  const width = fine ? 1 : Math.ceil(p / bins);
  const binOf = (v) => Math.min(bins - 1, Math.floor(v / width));
  const label = (b) => (fine ? String(b) : String(b * width));

  function coordStats(values, coord) {
    const obs = new Array(bins).fill(0);
    values.forEach((v) => obs[binOf(v)]++);
    const sub = new Array(bins).fill(0);
    subgroup.forEach((P) => sub[binOf(Number(P[coord]))]++);
    const expSub = sub.map((c) => (M * c) / subgroup.length);
    const intsInBin = Array.from({ length: bins }, (_, b) => Math.max(0, Math.min(p, (b + 1) * width) - b * width));
    const expFp = intsInBin.map((c) => (M * c) / p);
    const idx = expSub.map((e, i) => (e > 0 ? i : -1)).filter((i) => i >= 0);
    const testSub = chiSquareTest(idx.map((i) => obs[i]), idx.map((i) => expSub[i]));
    const testFp = chiSquareTest(obs, expFp);
    return { obs, expSub, testSub, testFp };
  }

  const X = coordStats(xs, 'x');
  const Yc = coordStats(ys, 'y');
  const histOpts = (st, name) => ({
    data: st.obs.map((v, i) => ({ label: label(i), value: v })),
    expected: st.expSub,
    observedLabel: 'Observed count',
    expectedLabel: 'Expected if uniform on ⟨G⟩',
    xLabel: fine ? name : `${name} (bins of ${width})`,
    yLabel: 'count',
    height: 230,
    table: {
      summary: 'Show data table',
      headers: [fine ? name : `${name} bin start`, 'observed', 'expected'],
      rows: st.obs.map((v, i) => [label(i), v, st.expSub[i].toFixed(2)]),
    },
  });
  barChart($('s-x'), histOpts(X, 'x'));
  barChart($('s-y'), histOpts(Yc, 'y'));
  const sub = (t) => `χ² vs uniform on ⟨G⟩: ${t.testSub.stat.toFixed(2)}, df ${t.testSub.df}, p = ${fmtP(t.testSub.pValue)}`
    + (t.testSub.minExpected < 5 ? ' · some expected counts < 5, test is approximate' : '');
  $('s-x-sub').textContent = sub(X);
  $('s-y-sub').textContent = sub(Yc);

  // --- bits -----------------------------------------------------------------------
  const bitOpts = (vals) => {
    const bal = bitBalance(vals, w);
    return {
      data: bal.map((f, i) => ({ label: `b${w - 1 - i}`, value: f, tip: f.toFixed(3) })),
      yMax: 1, ref: { value: 0.5 }, yFmt: (v) => v.toFixed(2),
      xLabel: 'bit position', yLabel: 'share of 1s', height: 200,
      table: { summary: 'Show data table', headers: ['bit', 'share of 1s'], rows: bal.map((f, i) => [`b${w - 1 - i}`, f.toFixed(4)]) },
    };
  };
  barChart($('s-bx'), bitOpts(xs));
  barChart($('s-by'), bitOpts(ys));

  // --- correlation ------------------------------------------------------------------
  const r = pearson(ks, xs);
  const rho = spearman(ks, xs);
  const corr = (v) => (Number.isNaN(v) ? 'n/a' : v.toFixed(3)); // NaN when x is constant (tiny subgroups)
  const sc = sample.slice(0, SCATTER_MAX);
  scatterChart($('s-scatter'), {
    points: sc.map((s) => ({ x: s.k, y: s.x, label: `k = ${s.k} → ${fmt(s.Q)}` })),
    xDomain: [0, Math.max(...sc.map((s) => s.k))], yDomain: [0, p - 1], xLabel: 'k', yLabel: 'x(kG)', height: 250,
  });
  $('s-sc-sub').textContent = `Pearson r = ${corr(r)} · Spearman ρ = ${corr(rho)}${M > SCATTER_MAX ? ` · first ${SCATTER_MAX} of ${M} points drawn` : ''}`;
  const pairs = [];
  for (const s of sc) {
    const next = add(C, s.Q, G);
    if (next !== INF) pairs.push({ x: s.x, y: Number(next.x), label: `${fmt(s.Q)} → ${fmt(next)}` });
  }
  scatterChart($('s-scatter2'), {
    points: pairs, xDomain: [0, p - 1], yDomain: [0, p - 1], xLabel: 'x(kG)', yLabel: 'x((k+1)G)', height: 250,
  });

  // --- avalanche ---------------------------------------------------------------------
  const L = bitLen(n - 1n);
  const byteLen = Math.ceil(L / 8);
  const hdEC = [], hdH = [];
  for (let t = 0; t < AVALANCHE_SAMPLES; t++) {
    const k = randomBelow(n - 1n) + 1n;
    const i = randomBelow(BigInt(L));
    const k2 = k ^ (1n << i);
    const [h1, h2] = await Promise.all([sha256(toBytes(k, byteLen)), sha256(toBytes(k2, byteLen))]);
    hdH.push(hammingBytes(h1, h2));
    if (k2 % n === 0n) continue; // kG' = O has no coordinates to compare
    const Q1 = scalarMult(C, k, G), Q2 = scalarMult(C, k2, G);
    hdEC.push(popcount32(Number(Q1.x ^ Q2.x)) + popcount32(Number(Q1.y ^ Q2.y)));
  }
  const outBits = 2 * w;
  const avEC = new Array(outBits + 1).fill(0);
  hdEC.forEach((d) => avEC[d]++);
  barChart($('s-av'), {
    data: avEC.map((v, d) => ({ label: String(d), value: v })),
    expected: avEC.map((_, d) => hdEC.length * binomialPmf(d, outBits, 0.5)),
    observedLabel: 'Observed', expectedLabel: `Binomial(${outBits}, ½)`, expectedStyle: 'line',
    xLabel: 'changed bits', yLabel: 'count', height: 220,
  });
  const lo = 88, hi = 168;
  const avH = new Array(hi - lo + 1).fill(0);
  hdH.forEach((d) => { if (d >= lo && d <= hi) avH[d - lo]++; });
  barChart($('s-avh'), {
    data: avH.map((v, i) => ({ label: String(lo + i), value: v })),
    expected: avH.map((_, i) => hdH.length * binomialPmf(lo + i, 256, 0.5)),
    observedLabel: 'Observed', expectedLabel: 'Binomial(256, ½)', expectedStyle: 'line',
    xLabel: 'changed bits', yLabel: 'count', height: 220, xTickEvery: 10,
  });
  const fracEC = hdEC.length ? mean(hdEC) / outBits : NaN;
  const fracH = mean(hdH) / 256;
  $('s-av-sub').textContent = hdEC.length
    ? `${hdEC.length} trials · mean ${mean(hdEC).toFixed(2)} of ${outBits} bits (${(100 * fracEC).toFixed(1)}%)`
    : 'no valid trials: every bit flip of k lands on 0 (mod n) in a subgroup this small';
  $('s-avh-sub').textContent = `${hdH.length} trials · mean ${mean(hdH).toFixed(2)} of 256 bits (${(100 * fracH).toFixed(1)}%)`;

  // --- structure tests ----------------------------------------------------------------
  const T = STRUCTURE_TRIALS;
  const MOD256 = 1n << 256n;
  let homEC = 0, homH = 0, flipEC = 0, flipH = 0, flipT = 0;
  const H0 = bytesToBig(await sha256(toBytes(0n, 32)));
  for (let t = 0; t < T; t++) {
    const a = randomBelow(n - 1n) + 1n, b = randomBelow(n - 1n) + 1n;
    if (eq(scalarMult(C, a + b, G), add(C, scalarMult(C, a, G), scalarMult(C, b, G)))) homEC++;
    const [ha, hb, hab] = await Promise.all([a, b, a + b].map((v) => sha256(toBytes(v, 32))));
    if (bytesToBig(hab) === (bytesToBig(ha) + bytesToBig(hb)) % MOD256) homH++;

    // skip k2 = 0 (mod n), where both relations hold trivially; tiny subgroups may have no other case
    let k, i, k2, tries = 0;
    do {
      k = randomBelow(n - 1n) + 1n;
      i = randomBelow(BigInt(L));
      k2 = k ^ (1n << i);
    } while (k2 % n === 0n && ++tries < 50);
    if (k2 % n === 0n) continue;
    flipT++;
    const Q = scalarMult(C, k, G);
    const step = scalarMult(C, 1n << i, G);
    const predicted = (k >> i) & 1n ? add(C, Q, neg(C, step)) : add(C, Q, step);
    if (eq(predicted, scalarMult(C, k2, G))) flipEC++;
    const [hk, hk2, hbit] = await Promise.all([k, k2, 1n << i].map((v) => sha256(toBytes(v, 32))));
    if (bytesToBig(hk2) === (bytesToBig(hk) ^ bytesToBig(hbit) ^ H0)) flipH++;
  }

  // collisions: distinct keys (mod n) vs distinct outputs; SHA-256 truncated to bitLen(n) bits
  const distinctK = [...new Set(sample.map((s) => BigInt(s.k) % n))];
  const distinctQ = new Set(sample.map((s) => fmt(s.Q))).size;
  const tBits = bitLen(n);
  const trunc = new Set();
  for (const k of distinctK) {
    const h = await sha256(toBytes(k, 32));
    trunc.add(bytesToBig(h) >> BigInt(256 - tBits));
  }
  const D = distinctK.length;
  const space = 2 ** tBits;
  const expectedColl = D - space * (1 - (1 - 1 / space) ** D);

  const tb = $('s-structure').tBodies[0];
  tb.replaceChildren();
  const row = (cells) => {
    const tr = tb.insertRow();
    cells.forEach((c, i) => {
      const td = tr.insertCell();
      td.textContent = c;
      if (i > 0) td.className = 'num mono';
    });
  };
  row(['Homomorphism: f(a + b) = f(a) ⊕ f(b) (EC: point addition; hash: + mod 2²⁵⁶)', `${homEC}/${T} hold`, `${homH}/${T} hold`]);
  row(['Bit flip predictable from the old output alone (EC: Q ± 2ⁱG; hash: H(m) ⊕ H(2ⁱ) ⊕ H(0))',
    flipT ? `${flipEC}/${flipT} hold` : 'n/a (subgroup too small)', flipT ? `${flipH}/${flipT} hold` : 'n/a']);
  row([`Collisions among ${D} distinct keys (hash truncated to ${tBits} bits = size of ⟨G⟩)`, `${D - distinctQ}`, `${D - trunc.size} (birthday ≈ ${expectedColl.toFixed(1)})`]);

  // --- tiles ---------------------------------------------------------------------------
  const xsInSub = new Set(subgroup.map((P) => P.x)).size;
  $('s-tiles').replaceChildren(
    tile('Order of G', String(n), `#E = ${N}${n === N ? ' (G generates all)' : ''}`),
    tile('Public keys sampled', String(M), infCount ? `${infCount} × O skipped (k ≡ 0)` : 'O never hit'),
    tile('Distinct public keys', String(distinctQ), `of ${n - 1n} possible`),
    tile('Distinct x-values', String(new Set(xs).size), `${xsInSub} occur in ⟨G⟩, ${p} residues mod p`),
    tile('χ²(x) vs uniform on ⟨G⟩', `p = ${fmtP(X.testSub.pValue)}`, `χ² = ${X.testSub.stat.toFixed(1)}, df ${X.testSub.df}`),
    tile('χ²(x) vs uniform on F_p', `p = ${fmtP(X.testFp.pValue)}`, `χ² = ${X.testFp.stat.toFixed(1)}, df ${X.testFp.df}`),
    tile('Pearson r(k, x)', corr(r), `Spearman ρ = ${corr(rho)}`),
    tile('Avalanche', hdEC.length ? `${(100 * fracEC).toFixed(1)}%` : 'n/a', `of x‖y bits flip · SHA-256 ${(100 * fracH).toFixed(1)}%`),
  );
}
