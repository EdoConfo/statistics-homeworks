// Homework 5 · Ex. 2 page controller: calculator (01), reference table and error chart (05), efficiency (06).
import * as Nm from './normal.js';
import { xyChart } from '../../homework-3/plots.js';
import { $, tile, stage, whenVisible, yieldToBrowser } from '../../homework-2/ui.js';

const FLOOR = 1e-17;
const tailCF = (x) => {
  const q = Nm.tailFraction(Math.abs(x));
  return { value: x < 0 ? q.value : 1 - q.value, work: q.work };
};

const METHODS = [
  { id: 'final', name: 'Final method (4 + 5)', run: Nm.phi, unit: 'terms', color: 'var(--ink)' },
  { id: 'trap', name: 'Trapezoid, n = 100', run: (x) => Nm.trapezoid(x, 100), unit: 'φ evaluations', color: 'var(--series-4)' },
  { id: 'simp', name: 'Simpson, n = 100', run: (x) => Nm.simpson(x, 100), unit: 'φ evaluations', color: 'var(--series-1)' },
  { id: 'taylor', name: 'Series 3 (alternating)', run: Nm.taylor, unit: 'terms', color: 'var(--series-2)' },
  { id: 'pos', name: 'Series 4 (positive terms)', run: Nm.positiveSeries, unit: 'terms', color: 'var(--series-5)' },
  { id: 'cf', name: 'Continued fraction 5', run: tailCF, unit: 'levels', color: 'var(--series-6)' },
  { id: 'as', name: 'A&S erf 7.1.26', run: Nm.erfFormula, unit: 'formula', color: 'var(--series-3)' },
];

const e1 = (v) => (v === 0 ? '0' : v.toExponential(1).replace('-', '−'));
const full = (v) => (v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(15) : v.toFixed(17)).replace('-', '−');
const rel = (v, r) => Math.abs(v - r) / Math.abs(r);

// ---- 01 calculator --------------------------------------------------------------------------------

function renderCalc() {
  const x = parseFloat($('calc-x').value);
  if (!Number.isFinite(x)) return;
  const ref = Nm.phi(x).value;
  $('calc-tiles').replaceChildren(
    tile('Φ(x)', full(ref), 'final method'),
    tile('1 − Φ(x)', full(Nm.phi(-x).value), 'computed as Φ(−x)'),
  );
  $('calc-table').tBodies[0].innerHTML = METHODS.map((m) => {
    const o = m.run(x);
    const d = o.value - ref;
    return `<tr><td>${m.name}</td><td class="num mono">${full(o.value)}</td><td class="num mono">${m.id === 'final' ? '–' : e1(Math.abs(d))}</td>` +
      `<td class="num mono">${m.unit === 'formula' ? '1 formula' : `${o.work} ${m.unit}`}</td></tr>`;
  }).join('');
  stage('x', String(x));
  stage('phi', full(ref));
}

// ---- 05 reference table and error chart ----------------------------------------------------------

const SOURCE = { wiki: 'Wikipedia', mpmath: 'mpmath', exact: 'exact' };

function renderReference() {
  const by = Object.fromEntries(METHODS.map((m) => [m.id, m]));
  $('ref-table').tBodies[0].innerHTML = Nm.REFERENCE.map(({ x, value, source }) => {
    const f = Nm.phi(x).value;
    const r = (id) => e1(rel(by[id].run(x).value, value));
    return `<tr><td class="num mono">${String(x).replace('-', '−')}</td><td class="num mono">${full(value)}</td><td>${SOURCE[source]}</td>` +
      `<td class="num mono">${full(f)}</td><td class="num mono">${e1(rel(f, value))}</td>` +
      `<td class="num mono">${r('simp')}</td><td class="num mono">${r('taylor')}</td><td class="num mono">${r('as')}</td></tr>`;
  }).join('');
}

const worst = (m) => Math.max(...Nm.GRID.map((ref, i) => rel(m.run(Nm.gridX(i)).value, ref)));

function renderErrorChart() {
  const xs = Nm.GRID.map((_, i) => Nm.gridX(i));
  const shown = METHODS.filter((m) => m.id !== 'pos' && m.id !== 'cf');
  const errs = Object.fromEntries(shown.map((m) => [m.id, Nm.GRID.map((ref, i) => rel(m.run(xs[i]).value, ref))]));
  xyChart($('err-chart'), {
    height: 300,
    x: { domain: [-8, 8], label: 'x' },
    y: { domain: [FLOOR, 1e2], log: true, label: 'relative error' },
    series: shown.map((m) => ({ kind: 'line', label: m.name, points: xs.map((x, i) => [x, Math.max(errs[m.id][i], FLOOR)]), color: m.color, width: m.id === 'final' ? 2.6 : 1.6 })),
    hover: { xs, text: (i) => ({ title: `x = ${xs[i]}`, lines: shown.map((m) => `${m.name}: ${e1(errs[m.id][i])}`) }) },
    ariaLabel: 'Relative error of each method against x',
  });
  stage('acc', e1(Math.max(...errs.final)));
}

// ---- 06 efficiency ---------------------------------------------------------------------------------

function renderQuadrature() {
  const ns = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  const ref = Nm.GRID[40];   // Φ(2)
  const pts = (fn) => ns.map((n) => [n, Math.max(Math.abs(fn(2, n).value - ref), FLOOR)]);
  const t = pts(Nm.trapezoid), s = pts(Nm.simpson);
  xyChart($('quad-chart'), {
    height: 260,
    x: { domain: [2, 1024], log: true, label: 'n', ticks: [2, 8, 32, 128, 512], fmt: String },
    y: { domain: [FLOOR, 1], log: true, label: 'absolute error' },
    series: [
      { kind: 'line', label: 'trapezoid', points: t, color: 'var(--series-4)' },
      { kind: 'dots', points: t, color: 'var(--series-4)', legend: false },
      { kind: 'line', label: 'Simpson', points: s, color: 'var(--series-1)' },
      { kind: 'dots', points: s, color: 'var(--series-1)', legend: false },
    ],
    hover: { xs: ns, text: (i) => ({ title: `n = ${ns[i]}`, lines: [`trapezoid ${e1(t[i][1])}`, `Simpson ${e1(s[i][1])}`] }) },
    ariaLabel: 'Quadrature error against the number of subintervals',
  });
}

async function renderSpeed() {
  $('speed-run').disabled = true;
  const rows = [];
  let finalNs = 0;
  for (const m of METHODS) {
    await yieldToBrowser();
    const reps = m.id === 'trap' || m.id === 'simp' ? 20000 : 200000;
    let sink = 0;
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) sink += m.run(-8 + (16 * i) / reps).value;
    const ns = ((performance.now() - t0) * 1e6) / reps;
    if (m.id === 'final') finalNs = ns;
    rows.push(`<tr><td>${m.name}</td><td class="num mono">${ns < 10 ? ns.toFixed(1) : Math.round(ns)}</td><td class="num mono">${e1(worst(m))}</td></tr>`);
  }
  $('speed-table').tBodies[0].innerHTML = rows.join('');
  $('speed-run').disabled = false;
  stage('eff', `${Math.round(finalNs)} ns per Φ(x)`);
}

// ---- init ------------------------------------------------------------------------------------------

$('calc-x').addEventListener('input', renderCalc);
renderCalc();
whenVisible($('accuracy'), () => { renderReference(); renderErrorChart(); });
whenVisible($('efficiency'), () => { renderQuadrature(); renderSpeed(); });
$('speed-run').addEventListener('click', renderSpeed);
