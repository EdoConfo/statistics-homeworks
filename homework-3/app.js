// Homework 3 page controller: the attack table (01), trajectories (02), the experiments on the three quantities (03–06)
// and the aggregate score of n systems and m attackers (07).
import * as W from './walks.js';
import { xyChart, fmtNum } from './plots.js';
import { $, tile, yieldToBrowser, whenVisible, group, stage } from '../homework-2/ui.js';

const CHECKPOINTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const N_MAX = CHECKPOINTS.at(-1);
const COLORS = { total: 'var(--series-1)', average: 'var(--series-2)', normalized: 'var(--series-3)' };
const INK = 'var(--ink-2)';
const LOG_N = { domain: [1, N_MAX], log: true, label: 'systems n', fmt: (v) => group(v) };

const state = { model: 'bernoulli', p: 0.3, n: 1000, m: 200, seed: 1 };
const exp = { m: 5000, seed: 1, sims: null, running: false, eps: 0.05, grow: 'bernoulli', cltN: 100 };

// ---- formatting -------------------------------------------------------------------------

function num(v, sig = 4) {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-3 || a >= 1e6) return fmtNum(v);
  return v.toLocaleString('en-US', { maximumSignificantDigits: sig }).replace('-', '−');
}
const pct = (v) => (v === 0 ? '0%' : v < 0.001 ? `${(100 * v).toPrecision(2)}%` : `${(100 * v).toFixed(1)}%`);
const sdOf = (t) => Math.sqrt(t.variance);

function segmented(attr, onPick) {
  const buttons = document.querySelectorAll(`[${attr}]`);
  buttons.forEach((b) => b.addEventListener('click', () => {
    buttons.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    onPick(b.getAttribute(attr));
  }));
}

function fillSelect(sel, values, value, label = group) {
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label(v);
    sel.appendChild(o);
  }
  sel.value = value;
}

/** Points of a smooth curve over [lo, hi]. */
const curve = (lo, hi, f, steps = 200) => Array.from({ length: steps + 1 }, (_, i) => { const x = lo + ((hi - lo) * i) / steps; return [x, f(x)]; });

/** Step counts for theory lines along a trajectory: every early step, then evenly spaced. */
function theorySteps(n, from) {
  const ks = new Set();
  for (let k = from; k <= Math.min(n, 40); k++) ks.add(k);
  for (let i = 0; i <= 240; i++) ks.add(Math.max(from, Math.round((i * n) / 240)));
  return [...ks].sort((a, b) => a - b);
}

/** Log-spaced n from 1 to N_MAX for exact curves. */
const LOG_GRID = [...new Set(Array.from({ length: 81 }, (_, i) => Math.round(10 ** (i / 20))))];

// ---- 01 one experiment as a table ------------------------------------------------------------

const MX = { n: 40, m: 14 };

function renderMatrix(el, rows, model) {
  const cell = 10, gap = 1.5, sumW = 26, barH = 24;
  const W_ = MX.n * cell, H = MX.m * cell;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W_ + sumW} ${H + barH + 6}`);
  svg.setAttribute('role', 'img');
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0));
  svg.setAttribute('aria-label', `${model} attack table: totals per attacker ${totals.join(', ')}`);
  let html = '';
  rows.forEach((row, j) => {
    row.forEach((x, i) => {
      const cls = x > 0 ? 'hit' : model === 'bernoulli' ? 'miss' : 'back';
      html += `<rect class="${cls}" x="${i * cell + gap / 2}" y="${j * cell + gap / 2}" width="${cell - gap}" height="${cell - gap}" rx="1.5"/>`;
    });
    html += `<text x="${W_ + 6}" y="${j * cell + cell / 2 + 3}">${String(totals[j]).replace('-', '−')}</text>`;
  });
  // under each column: how many attackers scored on that system
  for (let i = 0; i < MX.n; i++) {
    let c = 0;
    for (const row of rows) if (row[i] > 0) c++;
    const h = (c / MX.m) * barH;
    html += `<rect class="colbar" x="${i * cell + gap / 2}" y="${H + 6 + barH - h}" width="${cell - gap}" height="${h}"/>`;
  }
  html += `<text class="sum-head" x="${W_ + 6}" y="${H + 6 + barH - 2}">Sₙ</text>`;
  svg.innerHTML = html;
  el.replaceChildren(svg);
}

function runMatrix(seed = W.randomSeed()) {
  renderMatrix($('mx-b'), W.attackMatrix({ model: 'bernoulli', p: state.p, n: MX.n, m: MX.m, seed }), 'bernoulli');
  renderMatrix($('mx-r'), W.attackMatrix({ model: 'rademacher', p: state.p, n: MX.n, m: MX.m, seed: seed ^ 0x5bd1e995 }), 'rademacher');
  $('mx-b-title').textContent = `Bernoulli, p = ${state.p.toFixed(2)}`;
}

// ---- 02 trajectories ------------------------------------------------------------------

function runTrajectories() {
  const { model, p, n, m, seed } = state;
  const t0 = performance.now();
  const T = W.trajectories({ model, p, n, m, seed, points: 1000 });
  const ms = performance.now() - t0;
  const { mu, sigma2 } = W.moments(model, p);
  const sigma = Math.sqrt(sigma2);
  const last = T.grid.length - 1;
  const finals = Int32Array.from(T.paths, (path) => path[last]);
  const L = W.MODELS[model].lattice;
  const xMin = model === 'bernoulli' ? 0 : -1;

  $('s-status').textContent = `${group(m)} attackers × ${group(n)} systems = ${group(n * m)} scores, simulated in ${Math.max(1, Math.round(ms))} ms · seed ${seed}` +
    (n > 1000 ? ' · lines drawn every 10 systems' : '');

  const rows = [];
  for (const q of W.QUANTITIES) {
    const from = q.power === 0 ? 0 : 1;
    const dv = (k) => W.divisor(q, k);
    const th = (k) => W.theory(model, p, q, k);
    const y = (s, i) => s / dv(T.grid[i]);
    // y range: the theory band and everything the trajectories reach
    let lo = Infinity, hi = -Infinity;
    for (const path of T.paths) for (let i = Math.max(from, 1); i <= last; i++) { const v = y(path[i], i); if (v < lo) lo = v; if (v > hi) hi = v; }
    const tn = th(n);
    lo = Math.min(lo, tn.mean - 2.2 * sdOf(tn), q.power === 0 ? 0 : lo);
    hi = Math.max(hi, tn.mean + 2.2 * sdOf(tn));
    if (q.power === 1) { lo = xMin; hi = 1; }
    const pad = (hi - lo) * 0.04;
    const domain = [lo - pad, hi + pad];

    const ks = theorySteps(n, from);
    const band = (sgn) => ks.map((k) => [k, th(k).mean + sgn * 2 * sdOf(th(k))]);
    const sum = W.summary(finals, dv(n));
    rows.push([q, sum, tn]);

    const bars = W.latticeHistogram(finals, { lattice: L, origin: model === 'rademacher' ? n % 2 : 0, d: dv(n), lo: domain[0], hi: domain[1], maxBins: 36 });
    const sub = {
      total: `kμ ± 2σ√k`, average: `μ ± 2σ/√k`, normalized: `√k·μ ± 2σ`,
    }[q.id];
    $(`t-${q.id}-sub`).textContent = `dashed: expected value and ${sub} · histogram at k = ${group(n)}`;

    xyChart($(`t-${q.id}`), {
      height: 250,
      x: { domain: [from, n], label: 'systems k', fmt: (v) => group(v) },
      y: { domain, label: q.sym.replace('ₙ', 'ₖ').replace('/n', '/k').replace('√n', '√k') },
      paths: { xs: T.grid, list: T.paths, y, from, color: COLORS[q.id], label: `${group(m)} attackers`, highlight: { index: 0, color: 'var(--ink)', label: 'attacker 1' } },
      series: [
        { kind: 'line', points: ks.map((k) => [k, th(k).mean]), color: INK, dash: '6 4', width: 1.6, legend: false },
        { kind: 'line', points: band(1), color: INK, dash: '2 3', width: 1.3, legend: false },
        { kind: 'line', points: band(-1), color: INK, dash: '2 3', width: 1.3, legend: false },
      ],
      side: {
        bars: bars.map((b) => ({ y0: b.x0, y1: b.x1, value: b.y })),
        curve: curve(domain[0], domain[1], (v) => W.normalPdf(v, tn.mean, sdOf(tn))),
        color: COLORS[q.id], label: `k = ${group(n)}`,
      },
      hover: {
        xs: Array.from(T.grid).slice(from),
        text: (i) => {
          const idx = i + from, k = T.grid[idx];
          const vals = T.paths.map((path) => y(path[idx], idx));
          const s = W.summary(vals);
          const t = th(k);
          return {
            title: `k = ${group(k)} systems`,
            lines: [
              `mean ${num(s.mean)} · exact ${num(t.mean)}`,
              `sd ${num(Math.sqrt(s.variance))} · exact ${num(sdOf(t))}`,
              `attacker 1: ${num(vals[0])}`,
            ],
          };
        },
      },
      ariaLabel: `${m} trajectories of ${q.sym} for k up to ${n}`,
    });
  }

  $('s-table').tBodies[0].replaceChildren(...rows.map(([q, s, t]) => {
    const tr = document.createElement('tr');
    for (const [v, cls] of [[`${q.label} ${q.sym}`], [num(s.mean), 'num'], [num(t.mean), 'num'], [num(s.variance), 'num'], [num(t.variance), 'num']]) {
      const td = tr.insertCell();
      td.textContent = v;
      if (cls) td.className = cls;
    }
    return tr;
  }));

  stage('model', model === 'bernoulli' ? `X ∈ {0, 1}\nP(X = 1) = ${p.toFixed(2)}` : 'X ∈ {−1, +1}\n½ each');
  stage('model-name', W.MODELS[model].name);
  stage('moments', `μ = ${num(mu)} · σ² = ${num(sigma2)}\nσ = ${num(sigma)}`);
  stage('sim', `n = ${group(n)} systems\nm = ${group(m)} attackers`);
  stage('sim-seed', `seed ${seed}`);
  for (const [q, s, t] of rows) stage(`sim-${q.id}`, `${num(s.mean)} · ${num(s.variance)}\nexact ${num(t.mean)} · ${num(t.variance)}`);
}

function initTrajectories() {
  fillSelect($('s-n'), [10, 100, 1000, 10000], state.n);
  fillSelect($('s-m'), [10, 50, 200, 1000], state.m);
  segmented('data-model', (model) => {
    state.model = model;
    $('s-p').disabled = model !== 'bernoulli';
    $('s-p-field').classList.toggle('off', model !== 'bernoulli');
    runTrajectories();
  });
  $('s-p').addEventListener('input', () => { $('s-p-val').textContent = Number($('s-p').value).toFixed(2); });
  $('s-p').addEventListener('change', () => {
    state.p = Number($('s-p').value);
    runTrajectories();
    runMatrix();
    if (agg.started) runAggregate();
    if (exp.sims) runExperiments({ only: 'bernoulli' });
  });
  $('s-n').addEventListener('change', () => { state.n = Number($('s-n').value); runTrajectories(); });
  $('s-m').addEventListener('change', () => { state.m = Number($('s-m').value); runTrajectories(); });
  $('s-run').addEventListener('click', () => { state.seed = W.randomSeed(); runTrajectories(); });
}

// ---- 03–06 experiments ------------------------------------------------------------------

async function simulate(model, m, seed, status) {
  const sim = W.checkpointSimulator({ model, p: state.p, m, checkpoints: CHECKPOINTS, seed });
  const chunk = model === 'bernoulli' ? 200 : 2000;
  while (sim.done < m) {
    sim.run(sim.done + chunk);
    status(`${W.MODELS[model].name}: ${group(sim.done)} of ${group(m)} attackers…`);
    await yieldToBrowser();
  }
  return { model, p: state.p, m, S: sim.S };
}

const at = (sim, n) => sim.S[CHECKPOINTS.indexOf(n)];

async function runExperiments({ only } = {}) {
  if (exp.running) return;
  exp.running = true;
  $('x-run').disabled = true;
  const status = (t) => { $('x-status').textContent = t; };
  try {
    const t0 = performance.now();
    const sims = exp.sims ?? {};
    for (const model of ['bernoulli', 'rademacher']) {
      if (only && model !== only) continue;
      sims[model] = await simulate(model, exp.m, model === 'bernoulli' ? exp.seed : exp.seed ^ 0x9e3779b9, status);
    }
    exp.sims = sims;
    const ms = performance.now() - t0;
    status(`${group(exp.m)} attackers per model × ${group(N_MAX)} systems = ${group(2 * exp.m * N_MAX)} scores in ${(ms / 1000).toFixed(1)} s · seed ${exp.seed}`);
    stage('x-sim', `m = ${group(exp.m)} attackers\nn up to ${group(N_MAX)}`);
    renderGrow();
    renderLLN();
    renderVariance();
    renderCLT();
  } finally {
    exp.running = false;
    $('x-run').disabled = false;
  }
}

// 03 small multiples: rows are the quantities, columns are n
const GROW_N = [10, 100, 1000, 10000];

function renderGrow() {
  const sim = exp.sims[exp.grow];
  const { model, p } = sim;
  const L = W.MODELS[model].lattice;
  const box = $('g-grid');
  box.replaceChildren();
  for (const q of W.QUANTITIES) {
    const half = Math.max(...GROW_N.map((n) => 4.2 * sdOf(W.theory(model, p, q, n))));
    const row = document.createElement('div');
    row.className = 'mult-row';
    const head = document.createElement('p');
    head.className = 'chart-title';
    head.textContent = `${q.label} ${q.sym}`;
    const panels = document.createElement('div');
    panels.className = 'mult-panels';
    row.append(head, panels);
    box.appendChild(row);
    for (const n of GROW_N) {
      const S = at(sim, n), d = W.divisor(q, n), t = W.theory(model, p, q, n), s = W.summary(S, d);
      const lo = t.mean - half, hi = t.mean + half;
      const bars = W.latticeHistogram(S, { lattice: L, origin: model === 'rademacher' ? n % 2 : 0, d, lo, hi, maxBins: 44 });
      const dens = curve(lo, hi, (v) => W.normalPdf(v, t.mean, sdOf(t)), 240);
      const top = Math.max(...bars.map((b) => b.y), ...dens.map((c) => c[1])) * 1.08;
      const cell = document.createElement('div');
      cell.className = 'mult-cell';
      const cap = document.createElement('p');
      cap.className = 'mult-cap';
      cap.innerHTML = `<strong>n = ${group(n)}</strong><span>mean ${num(s.mean, 3)} · var ${num(s.variance, 3)}</span>`;
      const chart = document.createElement('div');
      cell.append(cap, chart);
      panels.appendChild(cell);
      xyChart(chart, {
        compact: true, height: 112, legend: false,
        x: { domain: [lo, hi] },
        y: { domain: [0, top], hidden: true },
        series: [
          { kind: 'bars', bars, color: COLORS[q.id] },
          { kind: 'line', points: dens, color: INK, dash: '4 3', width: 1.4 },
        ],
        ariaLabel: `Histogram of ${q.sym} for n = ${n}: mean ${num(s.mean)}, variance ${num(s.variance)}`,
      });
    }
  }
}

// 04 Law of Large Numbers
const EPS = [0.01, 0.02, 0.05, 0.1];

function renderLLN() {
  const eps = exp.eps;
  for (const model of ['bernoulli', 'rademacher']) {
    const sim = exp.sims[model];
    const { mu, sigma2 } = W.moments(model, sim.p);
    const simulated = CHECKPOINTS.map((n) => W.sampleDeviation(at(sim, n), n, mu, eps));
    const points = CHECKPOINTS.map((n, i) => [n, simulated[i]]);
    const color = model === 'bernoulli' ? 'var(--series-1)' : 'var(--series-7)';
    xyChart($(model === 'bernoulli' ? 'l-b' : 'l-r'), {
      height: 260,
      x: LOG_N,
      y: { domain: [0, 1.02], label: 'share of attackers', ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => `${Math.round(v * 100)}%` },
      series: [
        { kind: 'line', label: 'Chebyshev bound σ²/(nε²)', points: LOG_GRID.map((n) => [n, W.chebyshev(sigma2, n, eps)]), color: INK, dash: '5 4', width: 1.6 },
        { kind: 'line', label: `simulated, ${group(sim.m)} attackers`, points, color, width: 1.8 },
        { kind: 'dots', points, color, legend: false },
      ],
      hover: {
        xs: CHECKPOINTS,
        text: (i) => ({ title: `n = ${group(CHECKPOINTS[i])}`, lines: [`simulated ${pct(simulated[i])}`, `Chebyshev ≤ ${pct(W.chebyshev(sigma2, CHECKPOINTS[i], eps))}`] }),
      },
      table: {
        headers: ['n', 'Simulated', 'Chebyshev bound'],
        rows: CHECKPOINTS.map((n, i) => [group(n), pct(simulated[i]), pct(W.chebyshev(sigma2, n, eps))]),
      },
      ariaLabel: `${model}: share of attackers whose average is at least ${eps} away from the mean, against n`,
    });
    if (model === 'bernoulli') {
      const i = CHECKPOINTS.indexOf(1000);
      stage('lln', `n = 1 000: ${pct(simulated[i])} simulated\nChebyshev ≤ ${pct(W.chebyshev(sigma2, 1000, eps))}`);
      stage('lln-note', `Bernoulli, ε = ${eps}`);
    }
  }
  $('l-b-sub').textContent = `P(|Sₙ/n − ${exp.sims.bernoulli.p.toFixed(2)}| ≥ ε)`;
}

// 05 variance under the three normalizations
function renderVariance() {
  const slopes = {};
  for (const model of ['bernoulli', 'rademacher']) {
    const sim = exp.sims[model];
    const { sigma2 } = W.moments(model, sim.p);
    const vars = {};
    for (const q of W.QUANTITIES) vars[q.id] = CHECKPOINTS.map((n) => W.summary(at(sim, n), W.divisor(q, n)).variance);
    const all = Object.values(vars).flat().filter((v) => v > 0);
    const yDomain = [10 ** Math.floor(Math.log10(Math.min(...all, sigma2 / N_MAX))), 10 ** Math.ceil(Math.log10(Math.max(...all, sigma2 * N_MAX)))];
    slopes[model] = Object.fromEntries(W.QUANTITIES.map((q) => [q.id, W.logSlope(CHECKPOINTS, vars[q.id])]));
    const series = [];
    for (const q of W.QUANTITIES) {
      const exact = (n) => W.theory(model, sim.p, q, n).variance;
      series.push({ kind: 'line', points: [[1, exact(1)], [N_MAX, exact(N_MAX)]], color: COLORS[q.id], dash: '6 4', width: 1.5, legend: false });
      series.push({ kind: 'dots', label: `Var(${q.sym})`, points: CHECKPOINTS.map((n, i) => [n, vars[q.id][i]]), color: COLORS[q.id] });
    }
    xyChart($(model === 'bernoulli' ? 'v-b' : 'v-r'), {
      height: 280,
      x: LOG_N,
      y: { domain: yDomain, log: true, label: 'variance' },
      series,
      hover: {
        xs: CHECKPOINTS,
        text: (i) => ({
          title: `n = ${group(CHECKPOINTS[i])}`,
          lines: W.QUANTITIES.map((q) => `Var(${q.sym}) ${num(vars[q.id][i], 3)} · exact ${num(W.theory(model, sim.p, q, CHECKPOINTS[i]).variance, 3)}`),
        }),
      },
      table: {
        headers: ['n', ...W.QUANTITIES.flatMap((q) => [`Var(${q.sym})`, 'exact'])],
        rows: CHECKPOINTS.map((n, i) => [group(n), ...W.QUANTITIES.flatMap((q) => [num(vars[q.id][i]), num(W.theory(model, sim.p, q, n).variance)])]),
      },
      ariaLabel: `${model}: sample variance of the three quantities against n, log–log`,
    });
  }
  $('v-b-sub').textContent = `σ² = p(1 − p) = ${num(W.moments('bernoulli', exp.sims.bernoulli.p).sigma2)}`;
  const formula = { total: 'nσ²', average: 'σ²/n', normalized: 'σ²' };
  $('v-table').tBodies[0].replaceChildren(...W.QUANTITIES.map((q) => {
    const tr = document.createElement('tr');
    const cells = [[`${q.label} ${q.sym}`], [formula[q.id], 'num mono'], [String(1 - 2 * q.power).replace('-', '−'), 'num'],
      [slopes.bernoulli[q.id].toFixed(3).replace('-', '−'), 'num'], [slopes.rademacher[q.id].toFixed(3).replace('-', '−'), 'num']];
    for (const [v, cls] of cells) { const td = tr.insertCell(); td.textContent = v; if (cls) td.className = cls; }
    return tr;
  }));
  stage('var', W.QUANTITIES.map((q) => `${q.sym}: ${slopes.bernoulli[q.id].toFixed(2).replace('-', '−')}`).join('\n'));
}

// 06 Central Limit Theorem, in the Rademacher model
const CLT_N = [1, 2, 5, 10, 20, 50, 100, 1000, 10000];

function renderCLT() {
  const n = exp.cltN, sim = exp.sims.rademacher;
  const S = at(sim, n);
  const z = Float64Array.from(S, (s) => s / Math.sqrt(n));
  const s = W.summary(z);
  let inside = 0;
  for (const x of z) if (Math.abs(x) <= 1.96) inside++;
  const gap = W.sampleKolmogorov(z);

  $('c-tiles').replaceChildren(
    tile('Mean of Sₙ/√n', num(s.mean, 3), 'N(0, 1): 0'),
    tile('Variance of Sₙ/√n', num(s.variance, 3), 'N(0, 1): 1'),
    tile('Attackers with |Sₙ/√n| ≤ 1.96', pct(inside / z.length), 'N(0, 1): 95.0%'),
  );

  const lo = -4.5, hi = 4.5;
  const bars = W.latticeHistogram(S, { lattice: 2, origin: n % 2, d: Math.sqrt(n), lo, hi, maxBins: 60 });
  const top = Math.min(Math.max(...bars.map((b) => b.y), 0.45) * 1.08, 3);
  $('c-hist-sub').textContent = `n = ${group(n)}, ${group(sim.m)} attackers · bin width ${num(bars[0].x1 - bars[0].x0, 3)}`;
  xyChart($('c-hist'), {
    height: 260,
    x: { domain: [lo, hi], label: 'Sₙ/√n' },
    y: { domain: [0, top], label: 'density' },
    series: [
      { kind: 'bars', label: 'simulated', bars, color: 'var(--series-3)' },
      { kind: 'line', label: 'N(0, 1) density', points: curve(lo, hi, (x) => W.normalPdf(x), 300), color: INK, width: 1.8, dash: '5 3' },
    ],
    ariaLabel: `Histogram of Sₙ/√n for n = ${n} with the standard normal density`,
  });

  // the simulated distribution function is a staircase: one step per distinct value
  const sorted = Float64Array.from(z).sort();
  const steps = [[lo, 0]];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[i]) j++;
    steps.push([sorted[i], i / sorted.length], [sorted[i], (j + 1) / sorted.length]);
    i = j + 1;
  }
  steps.push([hi, 1]);
  $('c-cdf-sub').textContent = `largest vertical gap to Φ: ${num(gap, 3)}`;
  xyChart($('c-cdf'), {
    height: 260,
    x: { domain: [lo, hi], label: 'x' },
    y: { domain: [0, 1], label: 'P(Sₙ/√n ≤ x)', ticks: [0, 0.25, 0.5, 0.75, 1] },
    series: [
      { kind: 'line', label: 'simulated', points: steps, color: 'var(--series-3)', width: 1.8 },
      { kind: 'line', label: 'Φ', points: curve(lo, hi, (x) => W.normalCdf(x), 300), color: INK, width: 1.8, dash: '5 3' },
    ],
    ariaLabel: `Distribution function of Sₙ/√n for n = ${n} and the standard normal distribution function`,
  });

  stage('clt', `n = ${group(n)}: ${pct(inside / z.length)} within ±1.96\nmean ${num(s.mean, 2)} · variance ${num(s.variance, 3)}`);
  stage('clt-note', 'Rademacher');
}

function initExperiments() {
  fillSelect($('x-m'), [1000, 5000, 20000], exp.m);
  $('x-m').addEventListener('change', () => { exp.m = Number($('x-m').value); runExperiments(); });
  $('x-run').addEventListener('click', () => { exp.seed = W.randomSeed(); runExperiments(); });
  segmented('data-grow', (model) => { exp.grow = model; if (exp.sims) renderGrow(); });
  fillSelect($('l-eps'), EPS, exp.eps, String);
  $('l-eps').addEventListener('change', () => { exp.eps = Number($('l-eps').value); if (exp.sims) renderLLN(); });
  fillSelect($('c-n'), CLT_N, exp.cltN);
  $('c-n').addEventListener('change', () => { exp.cltN = Number($('c-n').value); if (exp.sims) renderCLT(); });
  let started = false;
  const start = () => { if (!started) { started = true; runExperiments(); } };
  for (const id of ['grow', 'lln', 'variance', 'clt']) whenVisible($(id), start);
}

// ---- 07 the aggregate score of n systems and m attackers --------------------------------------

const TRAJ_M = [1, 10, 100, 1000], TRAJ_N = 1000;
const AGG_N = [10, 100, 1000], AGG_M = [1, 10, 100], AGG_R = 200;
const agg = { model: 'bernoulli', seed: 7, started: false, running: false, again: false };

/** One experiment for each m: the aggregate rate T_k/(km) as the attackers work through the systems. */
function renderAggregateTrajectory() {
  const { model } = agg, p = state.p;
  const { mu, sigma2 } = W.moments(model, p);
  const colors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-7)'];
  const lines = TRAJ_M.map((m, i) => {
    const T = W.trajectories({ model, p, n: TRAJ_N, m, seed: agg.seed + i, points: TRAJ_N });
    const total = new Float64Array(T.grid.length);
    for (const path of T.paths) for (let k = 0; k < path.length; k++) total[k] += path[k];
    return { m, grid: T.grid, rate: Array.from(total, (t, k) => t / (Math.max(1, T.grid[k]) * m)) };
  });
  const ks = Array.from(lines[0].grid).slice(1);
  $('a-traj-sub').textContent = `one experiment for each m · dashed: μ = ${num(mu)} · after k systems the rate is within μ ± 2σ/√(km) about 95% of the time`;
  xyChart($('a-traj'), {
    height: 260,
    x: { domain: [1, TRAJ_N], log: true, label: 'systems k (log scale)', fmt: group },
    y: { domain: model === 'bernoulli' ? [0, 1] : [-1, 1], label: 'Tₖ/(km)' },
    series: [
      { kind: 'hline', value: mu, color: INK, dash: '6 4', width: 1.4 },
      ...lines.map((l, i) => ({ kind: 'line', label: `m = ${group(l.m)}`, points: ks.map((k, j) => [k, l.rate[j + 1]]), color: colors[i], width: 1.6 })),
    ],
    hover: {
      xs: ks,
      text: (j) => ({
        title: `k = ${group(ks[j])} systems`,
        lines: lines.map((l) => `m = ${group(l.m)}: ${num(l.rate[j + 1], 3)} · band ±${num(2 * Math.sqrt(sigma2 / (ks[j] * l.m)), 2)}`),
      }),
    },
    ariaLabel: 'Aggregate penetration rate of one experiment against the number of systems, for 1, 10, 100 and 1000 attackers',
  });
}

/** AGG_R repeated experiments for every pair (n, m): histograms of the aggregate rate T_n/(nm) on one shared axis. */
async function renderAggregateGrid() {
  if (agg.running) { agg.again = true; return; }
  agg.running = true;
  try {
    do {
      agg.again = false;
      const { model } = agg, p = state.p;
      const { mu, sigma2 } = W.moments(model, p);
      const t0 = performance.now();
      const sims = [];
      for (const m of AGG_M) for (const n of AGG_N) {
        const sim = W.aggregateSimulator({ model, p, n, m, R: AGG_R, seed: agg.seed * 1009 + n * 31 + m });
        const chunk = Math.max(1, Math.floor(2e5 / (n * m)));
        while (sim.done < AGG_R) {
          sim.run(sim.done + chunk);
          $('a-status').textContent = `Simulating ${group(AGG_R)} experiments with m = ${group(m)}, n = ${group(n)}…`;
          await yieldToBrowser();
        }
        sims.push(sim);
      }
      if (agg.again) continue;
      const scores = AGG_R * AGG_N.reduce((s, n) => s + n, 0) * AGG_M.reduce((s, m) => s + m, 0);
      $('a-status').textContent = `${group(AGG_R)} experiments for each pair (n, m): ${group(scores)} scores in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
      $('a-grid-sub').textContent = `Histograms of the aggregate rate Tₙ/(nm) over ${group(AGG_R)} repeated experiments, all on the same axis (heights scaled per panel). ` +
        `Dashed: normal density with mean μ and standard deviation σ/√(nm). Panels with the same nm have the same width.`;

      const half = 4.2 * Math.sqrt(sigma2 / (AGG_N[0] * AGG_M[0]));
      const lo = mu - half, hi = mu + half;
      const box = $('a-grid');
      box.replaceChildren();
      for (const m of AGG_M) {
        const row = document.createElement('div');
        row.className = 'mult-row';
        const head = document.createElement('p');
        head.className = 'chart-title';
        head.textContent = `m = ${group(m)} attacker${m > 1 ? 's' : ''}`;
        const panels = document.createElement('div');
        panels.className = 'mult-panels three';
        row.append(head, panels);
        box.appendChild(row);
        for (const n of AGG_N) {
          const sim = sims.find((x) => x.n === n && x.m === m), nm = n * m;
          const s = W.summary(sim.T, nm), sd = Math.sqrt(sigma2 / nm);
          const bars = W.latticeHistogram(sim.T, { lattice: W.MODELS[model].lattice, origin: model === 'rademacher' ? nm % 2 : 0, d: nm, lo, hi, maxBins: 40 });
          // the density on the panel's grid plus a fine grid around μ, so narrow bells keep their shape
          const xs = [];
          for (let i = 0; i <= 200; i++) xs.push(lo + ((hi - lo) * i) / 200);
          for (let i = 0; i <= 80; i++) xs.push(mu - 4 * sd + (8 * sd * i) / 80);
          const dens = xs.sort((u, v) => u - v).map((x) => [x, W.normalPdf(x, mu, sd)]);
          const cell = document.createElement('div');
          cell.className = 'mult-cell';
          const cap = document.createElement('p');
          cap.className = 'mult-cap';
          cap.innerHTML = `<strong>n = ${group(n)}</strong><span>nm = ${group(nm)} · sd ${num(Math.sqrt(s.variance), 2)}</span>`;
          const chart = document.createElement('div');
          cell.append(cap, chart);
          panels.appendChild(cell);
          xyChart(chart, {
            compact: true, height: 112, legend: false,
            x: { domain: [lo, hi] },
            y: { domain: [0, Math.max(...bars.map((b) => b.y)) * 1.15], hidden: true },
            series: [
              { kind: 'bars', bars, color: 'var(--series-1)' },
              { kind: 'line', points: dens, color: INK, dash: '4 3', width: 1.4 },
            ],
            ariaLabel: `Aggregate rate for n = ${n}, m = ${m}: mean ${num(s.mean)}, standard deviation ${num(Math.sqrt(s.variance))}`,
          });
        }
      }
      const ref = sims.find((x) => x.n === 100 && x.m === 10), rs = W.summary(ref.T);
      stage('att', `n = 100, m = 10: Tₙ ≈ ${num(rs.mean, 3)} ± ${num(2 * Math.sqrt(rs.variance), 2)}\nexpected ${num(1000 * mu, 3)} ± ${num(2 * Math.sqrt(1000 * sigma2), 2)}`);
      stage('att-note', model === 'bernoulli' ? `Bernoulli, p = ${p.toFixed(2)}` : 'Rademacher');
    } while (agg.again);
  } finally {
    agg.running = false;
  }
}

function runAggregate() {
  renderAggregateTrajectory();
  renderAggregateGrid();
}

function initAggregate() {
  segmented('data-agg', (model) => { agg.model = model; if (agg.started) runAggregate(); });
  whenVisible($('attackers'), () => { agg.started = true; runAggregate(); });
}

// ---- start ------------------------------------------------------------------------------

$('mx-legend').innerHTML = '<span class="swatch-inline" style="--c:var(--series-1)"></span>X = 1 or +1 ' +
  '<span class="swatch-inline mx-miss"></span>X = 0 <span class="swatch-inline mx-back"></span>X = −1';
$('mx-run').addEventListener('click', () => runMatrix());
runMatrix(11);
initTrajectories();
runTrajectories();
initExperiments();
initAggregate();
