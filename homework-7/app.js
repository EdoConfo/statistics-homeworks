// Homework 7 page controller: the typewriter sequence (02), the variance of the three normalizations (04),
// the IDS alarm (07) and the Beta prior with a binomial likelihood (08, 09).
import * as C from './convergence.js';
import * as B from './bayes.js';
import { xyChart } from '../homework-3/plots.js';
import { rng, randomSeed, trajectories } from '../homework-3/walks.js';
import { $, tile, stage, group, sup } from '../homework-2/ui.js';

const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;
const num = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const sci = (v) => {
  if (v >= 0.01 && v < 1e4) return v >= 10 ? v.toFixed(1) : v.toPrecision(3);
  const [m, e] = v.toExponential(2).split('e');
  return `${m} × 10${sup(String(Number(e)))}`;
};

/** Segmented control: calls back with the data attribute of the pressed button. */
function segmented(el, key, onChange) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of el.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    onChange(b.dataset[key]);
  });
  return el.querySelector('[aria-pressed="true"]').dataset[key];
}

// ---- 02 typewriter sequence ---------------------------------------------------------------------------------

const TW_N = 255;   // blocks k = 0 … 7

function typewriter() {
  const omega = Number($('tw-omega').value);
  $('tw-omega-val').textContent = omega.toFixed(3);
  const hits = [], bars = [], prob = [];
  for (let n = 1; n <= TW_N; n++) {
    const t = C.typewriter(n, omega);
    if (t.value) { hits.push(n); bars.push({ x0: n - 0.5, x1: n + 0.5, y: 1 }); }
    prob.push([n - 0.5, t.prob], [n + 0.5, t.prob]);
  }
  xyChart($('tw-chart'), {
    height: 220,
    x: { domain: [0, TW_N + 1], label: 'n', ticks: [1, 32, 64, 128, 255] },
    y: { domain: [0, 1.05], ticks: [0, 0.25, 0.5, 0.75, 1] },
    series: [
      { kind: 'bars', bars, color: 'var(--series-1)', label: 'Xₙ(ω) = 1' },
      { kind: 'line', points: prob, color: 'var(--series-2)', label: 'P(Xₙ = 1) = E[Xₙ²] = 2⁻ᵏ' },
    ],
    ariaLabel: 'Typewriter sequence at a fixed outcome',
  });
  $('tw-note').innerHTML = `For ω = ${omega.toFixed(3)} the path equals 1 at n = ${hits.join(', ')}, … — once in every block, however far we go,
    while the probability of the value 1 halves from one block to the next.`;
  stage('omega', omega.toFixed(3));
  raster(omega);
}

/** Typewriter for ten outcomes: one row per ω, a dot at each n with Xₙ(ω) = 1. */
const RASTER_OMEGAS = [0.05, 0.16, 0.27, 0.38, 0.49, 0.61, 0.72, 0.83, 0.94];
function raster(omega) {
  const omegas = [...RASTER_OMEGAS, omega].sort((a, b) => a - b);
  const mine = omegas.indexOf(omega);
  const rowDots = (w) => {
    const pts = [];
    for (let n = 1; n <= TW_N; n++) if (C.typewriter(n, w).value) pts.push(n);
    return pts;
  };
  const series = [2, 4, 8, 16, 32, 64, 128].map((b) => ({ kind: 'vline', value: b - 0.5, color: 'var(--border-strong)', dash: '3 3', width: 1 }));
  series.push({ kind: 'dots', r: 2.6, color: 'var(--ink-2)', points: omegas.flatMap((w, i) => (i === mine ? [] : rowDots(w).map((n) => [n, i]))) });
  series.push({ kind: 'dots', r: 3.4, color: 'var(--series-1)', points: rowDots(omega).map((n) => [n, mine]) });
  xyChart($('tw-raster'), {
    height: 250,
    x: { domain: [0.75, TW_N + 20], log: true, label: 'n, log scale (one block k between dashed lines)', ticks: [1, 2, 4, 8, 16, 32, 64, 128, 255], fmt: String },
    y: { domain: [-0.7, omegas.length - 0.3], ticks: omegas.map((_, i) => i), fmt: (i) => `ω = ${omegas[Math.round(i)]?.toFixed(2) ?? ''}` },
    series,
    legend: false,
    ariaLabel: 'Typewriter sequence for ten outcomes',
  });
}

// ---- 04 simulated paths of Sₙ / nᵃ --------------------------------------------------------------------------

const PATH_N = 1000, PATH_M = 40;
let walk = null, alpha = 0.5;

function newPaths(seed = randomSeed()) {
  walk = trajectories({ model: 'rademacher', p: 0.5, n: PATH_N, m: PATH_M, seed, points: 500 });
  scaledPaths();
}

function scaledPaths() {
  const { grid, paths } = walk;
  const scale = (n) => n ** alpha;
  const half = (n) => 1.96 * n ** (0.5 - alpha);
  const top = 1.15 * Math.max(half(PATH_N), half(1), 1);
  const band = Array.from(grid).slice(1).map((n) => n);
  const atEnd = paths.map((p) => p[p.length - 1] / scale(PATH_N));
  const inside = atEnd.filter((v) => Math.abs(v) <= half(PATH_N)).length;
  const varEnd = atEnd.reduce((s, v) => s + v * v, 0) / atEnd.length;
  xyChart($('paths-chart'), {
    height: 300,
    x: { domain: [1, PATH_N], label: 'number of steps n' },
    y: { domain: [-top, top], label: `Sₙ / n^${alpha}` },
    paths: { xs: grid, list: paths, from: 1, y: (s, i) => s / scale(grid[i]), color: 'var(--series-1)', label: `${PATH_M} paths`,
      highlight: { index: 0, color: 'var(--series-2)', label: 'one path' } },
    series: [
      { kind: 'band', lo: band.map((n) => [n, -half(n)]), hi: band.map((n) => [n, half(n)]), color: 'var(--series-3)', opacity: 0.12 },
      { kind: 'line', points: band.map((n) => [n, half(n)]), color: 'var(--series-3)', dash: true, width: 1.5, label: '±1.96 · n^(1/2 − a)' },
      { kind: 'line', points: band.map((n) => [n, -half(n)]), color: 'var(--series-3)', dash: true, width: 1.5, legend: false },
    ],
    ariaLabel: 'Random walks divided by n to the power a',
  });
  const regime = alpha < 0.5 ? 'the band widens like n^(1/2 − a) and the paths spread out without limit'
    : alpha > 0.5 ? 'the band narrows like n^(1/2 − a) and every path is squeezed onto 0, the mean μ'
    : 'the band keeps the same width and the paths fluctuate on the same scale for every n: the CLT regime';
  $('paths-note').innerHTML = `With a = ${alpha}, ${regime}. At n = ${group(PATH_N)}: variance across the ${PATH_M} paths
    ${num(varEnd, varEnd < 0.1 ? 4 : 2)} (theory n^(1 − 2a) = ${(() => { const t = PATH_N ** (1 - 2 * alpha); return t >= 1 ? (Number.isInteger(t) ? group(t) : t.toFixed(1)) : t.toPrecision(3); })()}), ${inside} of ${PATH_M} paths inside the band.`;
}

// ---- 04 variance of the three normalizations ----------------------------------------------------------------

const NS = Array.from({ length: 61 }, (_, i) => Math.round(10 ** (i / 15))).filter((n, i, a) => a.indexOf(n) === i);

function variances(rho) {
  const curve = (key, r) => NS.map((n) => [n, C.sumVariance(n, 1, r)[key]]);
  const names = [['total', 'Var(Sₙ)', 'var(--series-1)'], ['normalized', 'Var(Sₙ/√n)', 'var(--series-3)'], ['mean', 'Var(Sₙ/n)', 'var(--series-2)']];
  const series = [];
  for (const [key, label, color] of names) {
    if (rho > 0) series.push({ kind: 'line', points: curve(key, 0), color, dash: true, width: 1.5, legend: false });
    series.push({ kind: 'line', points: curve(key, rho), color, label });
  }
  xyChart($('var-chart'), {
    height: 280,
    x: { domain: [1, 1e4], log: true, label: 'number of terms n' },
    y: { domain: [1e-4, 1e8], log: true, label: 'variance' },
    series,
    ariaLabel: 'Variance of the total, the normalized total and the mean as n grows',
  });
  const v = C.sumVariance(1e4, 1, rho);
  $('var-note').innerHTML = rho === 0
    ? 'Independent terms: on the log–log scale the three lines have slopes 1, 0 and −1. Only Sₙ/√n keeps a constant variance.'
    : `With ρ = ${rho}, at n = 10⁴ the variance of the mean is ${sci(v.mean)} instead of 10⁻⁴: it levels off at ρσ² = ${rho}, and the variance
       of Sₙ/√n grows like nρσ² once n is larger than about 1/ρ = ${group(Math.round(1 / rho))}.`;
  stage('rho', String(rho));
  stage('varmean', sci(v.mean));
}

// ---- 07 IDS alarm -------------------------------------------------------------------------------------------

let base = 0.01;

function alarm() {
  const s = Number($('sens').value), f = Number($('fpr').value);
  $('sens-val').textContent = pct(s);
  $('fpr-val').textContent = pct(f);
  const c = B.alarmCounts(base, s, f);
  const steps = B.alarmUpdates(base, s, f, 3);
  const r = (v) => group(Math.round(v));
  $('t-alarm').innerHTML = `<thead><tr><th></th><th class="num">Alarm</th><th class="num">No alarm</th><th class="num">Total</th></tr></thead><tbody>
    <tr><th scope="row">Attack</th><td class="num mono hl">${r(c.truePos)}</td><td class="num mono">${r(c.falseNeg)}</td><td class="num mono total">${r(c.attacks)}</td></tr>
    <tr><th scope="row">No attack</th><td class="num mono hl">${r(c.falsePos)}</td><td class="num mono">${r(c.trueNeg)}</td><td class="num mono total">${r(c.normal)}</td></tr>
    <tr class="total"><th scope="row">Total</th><td class="num mono">${r(c.truePos + c.falsePos)}</td><td class="num mono">${r(c.falseNeg + c.trueNeg)}</td><td class="num mono">${r(c.total)}</td></tr></tbody>`;
  $('alarm-read').innerHTML = `Of the ${r(c.truePos + c.falsePos)} alarms, ${r(c.truePos)} are real attacks: ${r(c.truePos)} / ${r(c.truePos + c.falsePos)} =
    <strong>${pct(steps[1])}</strong>, the posterior probability.`;

  xyChart($('alarm-chart'), {
    height: 220,
    x: { domain: [-0.3, 3.3], ticks: [0, 1, 2, 3], fmt: (v) => (v === 0 ? 'prior' : `${v} alarm${v > 1 ? 's' : ''}`) },
    y: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => `${Math.round(100 * v)}%` },
    series: [
      { kind: 'bars', bars: steps.map((p, k) => ({ x0: k - 0.3, x1: k + 0.3, y: p })), color: 'var(--series-1)', label: 'P(attack | alarms so far)' },
      { kind: 'hline', value: 0.5, color: 'var(--muted)', dash: true, width: 1 },
    ],
    ariaLabel: 'Probability of an attack after 0 to 3 alarms',
  });

  const lr = s / f;
  $('alarm-tiles').replaceChildren(
    tile('Prior P(attack)', pct(base, base < 0.01 ? 2 : 1), 'base rate'),
    tile('Likelihood ratio', num(lr, 1), `P(alarm | attack) / P(alarm | no attack)`),
    tile('Posterior after 1 alarm', pct(steps[1]), 'P(attack | alarm)'),
    tile('After 2 alarms', pct(steps[2]), 'posterior of 1 alarm used as prior'),
  );
  const flip = steps.findIndex((p) => p > 0.5);
  $('alarm-text').innerHTML = `The likelihoods are the same at every base rate, yet the conclusion changes with the prior. Each alarm multiplies the odds
    of an attack by the likelihood ratio ${num(lr, 1)}; with a prior of ${pct(base, base < 0.01 ? 2 : 1)} a single alarm leaves the probability at
    ${pct(steps[1])}${steps[1] < 0.5 ? ', so most alarms are false positives' : ''}. ${flip > 0
      ? `An attack becomes more likely than not after ${flip} independent alarm${flip > 1 ? 's' : ''}.`
      : flip === 0 ? '' : 'Even three independent alarms do not make an attack more likely than not.'}
    Neglecting the prior and reading the sensitivity ${pct(s)} as the probability of an attack is the base-rate fallacy.`;
  stage('prior', pct(base, base < 0.01 ? 2 : 1));
  stage('post', pct(steps[1]));

  const priors = Array.from({ length: 161 }, (_, i) => 10 ** (-4 + (4 * i) / 160)).filter((p) => p < 1);
  const postOf = (p) => B.alarmUpdates(p, s, f, 1)[1];
  xyChart($('prior-chart'), {
    height: 250,
    x: { domain: [1e-4, 1], log: true, label: 'prior P(attack), log scale', fmt: (v) => pct(v, v < 0.01 ? 2 : 0) },
    y: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => `${Math.round(100 * v)}%` },
    series: [
      { kind: 'line', points: priors.map((p) => [p, postOf(p)]), color: 'var(--series-1)', label: 'P(attack | alarm)' },
      { kind: 'line', points: [[1e-4, 1e-4], [1, 1]], color: 'var(--muted)', dash: true, width: 1, label: 'reference: posterior = prior' },
      { kind: 'dots', points: [[base, steps[1]]], color: 'var(--series-2)', r: 5 },
    ],
    ariaLabel: 'Posterior probability of an attack as a function of the prior',
  });
}

// ---- 08 sequential updating ---------------------------------------------------------------------------------

const SEQ_T = 2000;
let seqSeed = 20261123;

function sequential() {
  const n = Number($('b-n').value), k = Number($('b-k').value);
  const theta = n ? k / n : 0.24;
  const next = rng(seqSeed);
  const threshold = Math.round(theta * 2 ** 32);
  const ts = [], clicks = [];
  let kt = 0;
  for (let t = 1; t <= SEQ_T; t++) {
    if (next() < threshold) kt++;
    ts.push(t); clicks.push(kt);
  }
  const colors = { flat: 'var(--series-3)', past: 'var(--series-1)', strong: 'var(--series-2)' };
  const series = Object.entries(PRIORS).map(([key, p]) => ({
    kind: 'line', color: colors[key], width: key === priorKey ? 2.4 : 1.5, label: `${p.name} Beta(${p.a}, ${p.b})`,
    points: ts.map((t, i) => [t, (p.a + clicks[i]) / (p.a + p.b + t)]),
  }));
  series.push({ kind: 'line', color: 'var(--ink-2)', dash: '2 3', width: 1.2, label: 'k/t (no prior)', points: ts.map((t, i) => [t, clicks[i] / t]) });
  series.push({ kind: 'hline', value: theta, color: 'var(--muted)', dash: true, width: 1, note: `true θ = ${pct(theta)}` });
  xyChart($('seq-chart'), {
    height: 290,
    x: { domain: [1, SEQ_T], log: true, label: 'e-mails observed t, log scale' },
    y: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => `${Math.round(100 * v)}%`, label: 'posterior mean' },
    series,
    ariaLabel: 'Posterior means of three priors updated one observation at a time',
  });
  const last = (p) => (p.a + kt) / (p.a + p.b + SEQ_T);
  $('seq-note').innerHTML = `After ${group(SEQ_T)} e-mails (${group(kt)} clicks): ${Object.values(PRIORS).map((p) => `${p.name} ${pct(last(p))}`).join(' · ')};
    k/t = ${pct(kt / SEQ_T)}. The curves start at the three prior means and merge as the data accumulate; the strong prior needs the most e-mails.`;
}

// ---- 08 Beta prior and binomial likelihood ------------------------------------------------------------------

const PRIORS = {
  flat: { a: 1, b: 1, name: 'Flat', desc: 'Beta(1, 1): every θ equally plausible' },
  past: { a: 4, b: 36, name: 'Past campaigns', desc: 'Beta(4, 36): about 10% clicked before, worth 40 observations' },
  strong: { a: 45, b: 5, name: 'Strong, far off', desc: 'Beta(45, 5): a confident belief that 90% click, worth 50 observations' },
};
const N_OPTIONS = [0, 10, 50, 200, 1000];
let priorKey = 'past';

const GRID = Array.from({ length: 499 }, (_, i) => (i + 1) / 500);

function beta() {
  const n = Number($('b-n').value);
  const kIn = $('b-k');
  if (Number(kIn.max) !== n) {   // keep the observed proportion when n changes
    const rate = Number(kIn.max) ? Number(kIn.value) / Number(kIn.max) : 0.24;
    kIn.max = String(n);
    kIn.value = String(Math.round(rate * n));
  }
  kIn.disabled = n === 0;
  kIn.closest('.field').classList.toggle('off', n === 0);
  const k = Number(kIn.value);
  $('b-k-val').textContent = String(k);

  const P = PRIORS[priorKey];
  const post = B.betaUpdate(P.a, P.b, k, n);
  const priorC = GRID.map((t) => [t, B.betaPdf(t, P.a, P.b)]);
  const postC = GRID.map((t) => [t, B.betaPdf(t, post.a, post.b)]);
  const series = [{ kind: 'line', points: priorC, color: 'var(--series-2)', dash: true, label: `Prior ${P.desc.split(':')[0]}` }];
  let likC = [];
  if (n > 0) {
    likC = GRID.map((t) => [t, B.likelihoodDensity(t, k, n)]);
    series.push({ kind: 'line', points: likC, color: 'var(--series-3)', dash: '2 3', label: `Likelihood, k = ${k} of n = ${n}` });
  }
  series.push({ kind: 'line', points: postC, color: 'var(--series-1)', width: 2.5, label: `Posterior Beta(${post.a}, ${post.b})` });
  const top = Math.max(...[...priorC, ...postC, ...likC].map((p) => p[1]).filter(Number.isFinite));
  xyChart($('beta-chart'), {
    height: 280,
    x: { domain: [0, 1], label: 'θ = probability of a click', fmt: (v) => `${Math.round(100 * v)}%` },
    y: { domain: [0, top * 1.08], label: 'density' },
    series,
    ariaLabel: 'Prior, likelihood and posterior of the click probability',
  });

  const sP = B.betaSummary(post.a, post.b), sh = B.shrinkage(P.a, P.b, k, n);
  $('beta-tiles').replaceChildren(
    tile('Observed proportion k/n', n ? pct(k / n) : '–', 'maximum of the likelihood'),
    tile('Prior mean', pct(sh.priorMean), P.desc.split(':')[0]),
    tile('Posterior mean', pct(sP.mean), `weight of the prior w = ${num(sh.priorWeight, 2)}`),
    tile('95% credible interval', `${pct(sP.lo)} – ${pct(sP.hi)}`, 'P(θ in the interval | data) = 0.95'),
  );

  const rows = Object.entries(PRIORS).map(([key, p]) => {
    const q = B.betaUpdate(p.a, p.b, k, n), s = B.betaSummary(q.a, q.b), w = B.shrinkage(p.a, p.b, k, n).priorWeight;
    return { key, p, s, w };
  });
  $('t-priors').innerHTML = `<thead><tr><th>Prior</th><th class="num">Prior mean</th><th class="num">Weight w</th><th class="num">Posterior mean</th><th class="num">95% credible interval</th></tr></thead>
    <tbody>${rows.map(({ key, p, s, w }) => `<tr${key === priorKey ? ' class="current"' : ''}><td>${p.name} <span class="muted small">Beta(${p.a}, ${p.b})</span></td>
      <td class="num mono">${pct(p.a / (p.a + p.b))}</td><td class="num mono">${num(w, 2)}</td><td class="num mono">${pct(s.mean)}</td>
      <td class="num mono">${pct(s.lo)} – ${pct(s.hi)}</td></tr>`).join('')}</tbody>`;
  const means = rows.map((r) => r.s.mean), spread = Math.max(...means) - Math.min(...means);
  $('beta-read').textContent = n === 0
    ? 'With no data the posterior is the prior: each analyst keeps the belief they started from.'
    : `The three posterior means are ${spread * 100 < 5 ? 'within' : 'spread over'} ${(100 * spread).toFixed(1)} percentage points. ${spread * 100 < 5
      ? 'With this much data the likelihood dominates and the choice of prior hardly matters.'
      : 'The data are not yet enough to override the prior, so the conclusion still depends on it.'}`;

  const rate = n ? k / n : 0.24;
  const growthN = [10, 50, 200, 1000, 10000];
  $('t-growth-title').textContent = `Posterior mean when the observed proportion stays at ${pct(rate)} and n grows`;
  $('t-growth').innerHTML = `<thead><tr><th class="num">n</th><th class="num">k</th>${Object.entries(PRIORS).map(([key, p]) =>
    `<th class="num${key === priorKey ? ' current' : ''}">${p.name}</th>`).join('')}<th class="num">k/n</th></tr></thead>
    <tbody>${growthN.map((gn) => {
      const gk = Math.round(rate * gn);
      return `<tr><td class="num mono">${group(gn)}</td><td class="num mono">${group(gk)}</td>${Object.entries(PRIORS).map(([key, p]) =>
        `<td class="num mono${key === priorKey ? ' current' : ''}">${pct((p.a + gk) / (p.a + p.b + gn))}</td>`).join('')}<td class="num mono">${pct(gk / gn)}</td></tr>`;
    }).join('')}</tbody>`;

  $('influence').innerHTML = `In the alarm example the likelihoods were fixed and the posterior went from ${pct(B.alarmUpdates(0.001, 0.99, 0.05, 1)[1])}
    to ${pct(B.alarmUpdates(0.5, 0.99, 0.05, 1)[1])} only by changing the prior from 0.1% to 50%: when the evidence is one alarm, the prior decides the conclusion.
    In the phishing example the prior is worth <span class="math">a + b</span> observations: with ${n} employees it carries a weight
    <span class="math">w = ${num(sh.priorWeight, 2)}</span> in the posterior mean. As <var>n</var> grows, <span class="math">w → 0</span>, the
    posterior concentrates around <span class="math">k/n</span> with a spread of order <span class="math">1/√n</span>, and the three priors lead to the same conclusion
    — except a prior that gives zero probability to the true value, which no amount of data can correct.`;

  sequential();
  stage('data', n ? `${k} / ${n}` : 'no data');
  stage('theta', `mean ${pct(sP.mean)}\n95% ${pct(sP.lo)} – ${pct(sP.hi)}`);
}

// ---- wiring -------------------------------------------------------------------------------------------------

$('tw-omega').addEventListener('input', typewriter);
typewriter();

variances(Number(segmented($('rho'), 'rho', (v) => variances(Number(v)))));

alpha = Number(segmented($('alpha'), 'alpha', (v) => { alpha = Number(v); scaledPaths(); }));
newPaths(20261123);
$('paths-run').addEventListener('click', () => newPaths());
$('seq-run').addEventListener('click', () => { seqSeed = randomSeed(); sequential(); });

base = Number(segmented($('base'), 'base', (v) => { base = Number(v); alarm(); }));
$('sens').addEventListener('input', alarm);
$('fpr').addEventListener('input', alarm);
alarm();

$('b-n').innerHTML = N_OPTIONS.map((n) => `<option value="${n}"${n === 50 ? ' selected' : ''}>${n}</option>`).join('');
priorKey = segmented($('prior'), 'prior', (v) => { priorKey = v; beta(); });
$('b-n').addEventListener('change', beta);
$('b-k').addEventListener('input', beta);
beta();
