// Homework 4 page controller. Ex. 1: Welford step by step (02). Ex. 2: the score distribution (03),
// the m hackers × n systems experiment (04) and the same experiment for increasing n (05).
import * as W from './welford.js';
import { randomSeed } from '../homework-3/walks.js';
import { xyChart } from '../homework-3/plots.js';
import { barChart } from '../assets/js/charts.js?v=3';
import { $, tile, yieldToBrowser, whenVisible, group, stage } from '../homework-2/ui.js';

const P = 0.3;
const { mu: MU, sigma2: SIGMA2 } = W.moments(P);
const INK = 'var(--ink-2)';

const num = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '–');

function fillSelect(sel, values, value) {
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = group(v);
    sel.appendChild(o);
  }
  sel.value = value;
}

// ---- 02 Welford step by step ------------------------------------------------------------

const TRACE = 10;

function runTrace(seed = randomSeed()) {
  const draw = W.scoreStream(P, seed);
  const xs = [];
  let s = W.START;
  const rows = [];
  for (let k = 1; k <= TRACE; k++) {
    const x = draw();
    xs.push(x);
    s = W.welfordStep(s, x);
    const v = W.variance(s);
    rows.push(`<tr><td class="num mono">${k}</td><td class="num mono">${x}</td><td class="num mono">${num(s.mean)}</td>` +
      `<td class="num mono">${num(s.ss)}</td><td class="num mono">${k > 1 ? num(v) : '–'}</td><td class="num mono">${k > 1 ? num(W.twoPass(xs).variance) : '–'}</td></tr>`);
  }
  $('w-table').tBodies[0].innerHTML = rows.join('');
  stage('w', `M = ${num(s.mean)}\nS = ${num(s.ss)}\ns² = ${num(W.variance(s))}`);
  stage('w-k', `k = ${TRACE}`);
}

// ---- 03 the score distribution ----------------------------------------------------------------

function renderPmf() {
  const pmf = W.binomialPmf(P);
  barChart($('d-pmf'), {
    height: 220,
    data: pmf.map((q, x) => ({ label: String(x), value: q, tip: `P(X = ${x}) = ${q.toFixed(4)}` })),
    yFmt: (v) => v.toFixed(2),
    xLabel: 'score x',
    ariaLabel: 'Binomial(10, 0.3) probabilities',
  });
}

// ---- 04 one experiment ------------------------------------------------------------------------

const exp = { n: 100, m: 500 };
const SHOWN = 200;   // trajectories drawn

function runExperiment() {
  const { n, m } = exp;
  const keep = Math.min(m, SHOWN);
  const r = W.experiment({ p: P, n, m, seed: randomSeed(), keep });
  const sm = W.summary(r.means), sv = W.summary(r.variances);

  $('e-tiles').replaceChildren(
    tile('Average of the sampling means', num(sm.average), `μ = ${MU} · difference ${num(sm.average - MU)}`),
    tile('Average of the sampling variances', num(sv.average), `σ² = ${SIGMA2} · difference ${num(sv.average - SIGMA2)}`),
  );

  const xs = Int32Array.from({ length: n }, (_, i) => i + 1);
  const shownNote = keep < m ? `${group(keep)} of ${group(m)} hackers drawn` : `${group(m)} hackers`;
  $('e-mean-sub').textContent = `${shownNote} · dashed: μ = ${MU}`;
  $('e-var-sub').textContent = `${shownNote} · dashed: σ² = ${SIGMA2}`;
  const chart = (el, list, ref, top, from, color) => xyChart(el, {
    height: 240,
    x: { domain: [1, n], label: 'systems k', fmt: group },
    y: { domain: [0, top] },
    paths: { xs, list, y: (v) => v, from, color, highlight: { index: 0, color: 'var(--ink)' } },
    series: [{ kind: 'hline', value: ref, color: INK, dash: '6 4', width: 1.6 }],
    ariaLabel: `Running values for ${keep} hackers over ${n} systems`,
  });
  chart($('e-mean'), r.runMean, MU, 10, 0, 'var(--series-1)');
  chart($('e-var'), r.runVar, SIGMA2, 10, 1, 'var(--series-2)');

  stage('e-sim', `n = ${group(n)} systems\nm = ${group(m)} hackers`);
  stage('e-mean', num(sm.average));
  stage('e-var', num(sv.average));
}

// ---- 05 increasing n --------------------------------------------------------------------------

const NS = [2, 5, 10, 20, 50, 100, 200, 500, 1000];
const grow = { m: 2000, running: false };

async function runGrow() {
  if (grow.running) return;
  grow.running = true;
  $('g-run').disabled = true;
  const out = [];
  const t0 = performance.now();
  for (const n of NS) {
    $('g-status').textContent = `n = ${group(n)}…`;
    await yieldToBrowser();
    const r = W.experiment({ p: P, n, m: grow.m, seed: randomSeed() });
    out.push({ n, mean: W.summary(r.means), variance: W.summary(r.variances), th: W.samplingVariances(P, n) });
  }
  $('g-status').textContent = `${group(grow.m)} hackers for each n, ${Math.round(performance.now() - t0)} ms`;
  grow.running = false;
  $('g-run').disabled = false;
  renderGrow(out);
}

function renderGrow(out) {
  const x = { domain: [NS[0], NS.at(-1)], log: true, label: 'systems n', fmt: group };
  const panel = (el, key, ref, sdTh, domain, color, name) => xyChart(el, {
    height: 250, x, y: { domain },
    series: [
      { kind: 'band', label: 'average ± 2 SD, simulated', lo: out.map((o) => [o.n, o[key].average - 2 * o[key].sd]), hi: out.map((o) => [o.n, o[key].average + 2 * o[key].sd]), color, opacity: 0.2 },
      { kind: 'line', label: '± 2 SD, theory', points: out.map((o) => [o.n, ref + 2 * sdTh(o)]), color: INK, dash: '2 3', width: 1.3 },
      { kind: 'line', points: out.map((o) => [o.n, ref - 2 * sdTh(o)]), color: INK, dash: '2 3', width: 1.3, legend: false },
      { kind: 'hline', value: ref, color: INK, dash: '6 4', width: 1.6 },
      { kind: 'dots', label: 'average', points: out.map((o) => [o.n, o[key].average]), color },
    ],
    hover: {
      xs: NS,
      text: (i) => ({ title: `n = ${group(NS[i])}`, lines: [`average ${num(out[i][key].average)}`, `SD ${num(out[i][key].sd)} · theory ${num(sdTh(out[i]))}`] }),
    },
    ariaLabel: `${name} of ${grow.m} hackers against n`,
  });
  panel($('g-mean'), 'mean', MU, (o) => Math.sqrt(o.th.mean), [0, 6], 'var(--series-1)', 'Sampling means');
  panel($('g-var'), 'variance', SIGMA2, (o) => Math.sqrt(o.th.variance), [0, 8], 'var(--series-2)', 'Sampling variances');

  $('g-table').tBodies[0].innerHTML = out.map((o) =>
    `<tr><td class="num mono">${group(o.n)}</td><td class="num mono">${num(o.mean.average)}</td><td class="num mono">${num(o.mean.sd)}</td>` +
    `<td class="num mono">${num(Math.sqrt(o.th.mean))}</td><td class="num mono">${num(o.variance.average)}</td>` +
    `<td class="num mono">${num(o.variance.sd)}</td><td class="num mono">${num(Math.sqrt(o.th.variance))}</td></tr>`).join('');

  const first = out[0], last = out.at(-1);
  stage('g', `SD of x̄: ${num(first.mean.sd)} → ${num(last.mean.sd)}\nSD of s²: ${num(first.variance.sd)} → ${num(last.variance.sd)}`);
  stage('g-note', `n = ${first.n} → ${group(last.n)}`);
}

// ---- init ---------------------------------------------------------------------------------------

runTrace();
$('w-run').addEventListener('click', () => runTrace());

renderPmf();

fillSelect($('e-n'), [10, 50, 100, 500, 1000], exp.n);
fillSelect($('e-m'), [50, 200, 500, 2000, 5000], exp.m);
$('e-n').addEventListener('change', (e) => { exp.n = +e.target.value; runExperiment(); });
$('e-m').addEventListener('change', (e) => { exp.m = +e.target.value; runExperiment(); });
$('e-run').addEventListener('click', runExperiment);
runExperiment();

fillSelect($('g-m'), [500, 2000, 5000], grow.m);
$('g-m').addEventListener('change', (e) => { grow.m = +e.target.value; runGrow(); });
$('g-run').addEventListener('click', runGrow);
whenVisible($('grow'), runGrow);
