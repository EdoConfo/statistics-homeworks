// Homework 5 · Ex. 1 page controller: the strips/slabs picture (01), accuracy and convergence (03),
// cost (04), the Dirichlet table (06) and Thomae's function (07).
import * as I from './integrals.js';
import { xyChart, fmtNum } from '../../homework-3/plots.js';
import { $, group, stage, whenVisible, yieldToBrowser } from '../../homework-2/ui.js';

const SVG = 'http://www.w3.org/2000/svg';
const NS = [5, 15, 45, 135, 405, 1215, 3645];
const FLOOR = 1e-17;   // where an exact result is drawn on the log axis

const sci = (v) => (v === 0 ? '0 (exact)' : v < 1e-3 ? v.toExponential(1).replace('-', '−') : v.toFixed(4));
const val = (v) => v.toFixed(10);

function fillFunctions(sel, value) {
  for (const F of I.FUNCTIONS) {
    const o = document.createElement('option');
    o.value = F.id;
    o.textContent = F.label;
    sel.appendChild(o);
  }
  sel.value = value;
}

// ---- 01 strips and slabs ------------------------------------------------------------------------

const fig = { id: 'sin', n: 8 };

function frame(F) {
  const W = 600, H = 300, M = { l: 34, r: 10, t: 10, b: 24 };
  const yMax = Number.isFinite(F.hi) ? F.hi * 1.08 : 6;
  const sx = (x) => M.l + ((x - F.a) / (F.b - F.a)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - (Math.min(y, yMax) / yMax) * (H - M.t - M.b);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const add = (tag, attrs, text) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  };
  return { svg, add, sx, sy, W, H, M, yMax };
}

function axes(c, F) {
  c.add('line', { class: 'axis', x1: c.M.l, x2: c.W - c.M.r, y1: c.sy(0), y2: c.sy(0) });
  c.add('line', { class: 'axis', x1: c.M.l, x2: c.M.l, y1: c.M.t, y2: c.sy(0) });
  c.add('text', { x: c.sx(F.a), y: c.H - 6, 'text-anchor': 'start' }, fmtNum(F.a));
  c.add('text', { x: c.sx(F.b), y: c.H - 6, 'text-anchor': 'end' }, F.b === Math.PI ? 'π' : fmtNum(F.b));
  const top = Number.isFinite(F.hi) ? F.hi : 6;
  c.add('text', { x: c.M.l - 6, y: c.sy(top) + 4, 'text-anchor': 'end' }, fmtNum(top));
}

function curve(c, F) {
  const pts = [];
  for (let i = 0; i <= 600; i++) {
    const x = F.a + ((F.b - F.a) * i) / 600;
    const y = F.f(x === 0 && F.id === 'isqrt' ? 1e-9 : x);
    pts.push(`${c.sx(x).toFixed(1)},${c.sy(y).toFixed(1)}`);
  }
  // steps: break the line at the jump instead of drawing a vertical segment
  if (F.id.startsWith('step')) {
    const half = pts.length >> 1;
    c.add('polyline', { class: 'curve', points: pts.slice(0, half).join(' ') });
    c.add('polyline', { class: 'curve', points: pts.slice(half).join(' ') });
  } else c.add('polyline', { class: 'curve', points: pts.join(' ') });
}

function renderFigure() {
  const F = I.byId(fig.id), N = fig.n;
  const r = frame(F);
  axes(r, F);
  for (const b of I.riemannBoxes(F, N)) {
    r.add('rect', { class: 'box', x: r.sx(b.x0), width: r.sx(b.x1) - r.sx(b.x0), y: r.sy(b.y), height: Math.max(0, r.sy(0) - r.sy(b.y)) });
  }
  curve(r, F);
  $('fig-r').replaceChildren(r.svg);

  const l = frame(F);
  axes(l, F);
  for (const s of I.lebesgueSlabs(F, N)) {
    if (s.y0 >= l.yMax) break;
    for (const [x0, x1] of s.parts) {
      l.add('rect', { class: 'slab', x: l.sx(x0), width: Math.max(0.5, l.sx(x1) - l.sx(x0)), y: l.sy(s.y1), height: Math.max(0, l.sy(s.y0) - l.sy(s.y1)) });
    }
  }
  if (F.lo > 0) l.add('rect', { class: 'slab', x: l.sx(F.a), width: l.sx(F.b) - l.sx(F.a), y: l.sy(F.lo), height: l.sy(0) - l.sy(F.lo) });
  curve(l, F);
  $('fig-l').replaceChildren(l.svg);

  const R = I.riemann(F, N).value, L = I.lebesgue(F, N).value;
  $('fig-r-sub').textContent = `R = ${val(R)} · exact ${val(F.exact)}`;
  $('fig-l-sub').textContent = `L = ${val(L)}` + (F.lo > 0 ? ` · bottom block min f · (b − a) = ${fmtNum(F.lo * (F.b - F.a))}` : '');
  $('fig-n-out').textContent = N;
  stage('fig-f', F.label);
  stage('fig-r', `${val(R)}  (N = ${N})`);
  stage('fig-l', `${val(L)}  (N = ${N})`);
}

// ---- 03 accuracy --------------------------------------------------------------------------------

let runs = null;   // per function: { R: [{value, evals}], L: [...] } for each N in NS

async function computeRuns() {
  runs = {};
  for (const F of I.FUNCTIONS) {
    await yieldToBrowser();
    runs[F.id] = { R: NS.map((N) => I.riemann(F, N)), L: NS.map((N) => I.lebesgue(F, N)) };
  }
}

const errors = (F, list) => list.map((o) => Math.abs(o.value - F.exact));
const slope = (errs) => (errs.every((e) => e < 1e-12) ? 'exact' : I.logSlope(NS, errs.map((e) => Math.max(e, 1e-300))).toFixed(2).replace('-', '−'));

function renderAccuracyTable() {
  $('acc-table').tBodies[0].innerHTML = I.FUNCTIONS.map((F) => {
    const r = runs[F.id], eR = errors(F, r.R), eL = errors(F, r.L);
    return `<tr><td>${F.label}</td><td class="num mono">${val(F.exact)}</td><td class="num mono">${val(r.R.at(-1).value)}</td><td class="num mono">${val(r.L.at(-1).value)}</td>` +
      `<td class="num mono">${sci(eR.at(-1))}</td><td class="num mono">${sci(eL.at(-1))}</td><td class="num mono">${slope(eR)}</td><td class="num mono">${slope(eL)}</td></tr>`;
  }).join('');
}

function renderAccuracyChart(id) {
  const F = I.byId(id), r = runs[id];
  const eR = errors(F, r.R), eL = errors(F, r.L);
  const pts = (es) => NS.map((N, i) => [N, Math.max(es[i], FLOOR)]);
  xyChart($('acc-chart'), {
    height: 280,
    x: { domain: [NS[0], NS.at(-1)], log: true, label: 'N', fmt: group, ticks: NS },
    y: { domain: [FLOOR, 1], log: true, label: 'absolute error' },
    series: [
      { kind: 'line', label: 'Riemann (midpoint)', points: pts(eR), color: 'var(--series-1)' },
      { kind: 'dots', points: pts(eR), color: 'var(--series-1)', legend: false },
      { kind: 'line', label: 'Lebesgue (layer cake)', points: pts(eL), color: 'var(--series-2)', dash: '6 4' },
      { kind: 'dots', points: pts(eL), color: 'var(--series-2)', legend: false },
    ],
    hover: { xs: NS, text: (i) => ({ title: `N = ${group(NS[i])}`, lines: [`Riemann ${sci(eR[i])}`, `Lebesgue ${sci(eL[i])}`] }) },
    ariaLabel: `Error against N for ${F.label}`,
  });
  stage('acc', `Riemann ${slope(eR)} · Lebesgue ${slope(eL)}`);
  stage('acc-note', F.label);
}

// ---- 04 cost ------------------------------------------------------------------------------------

const COST_NS = [45, 405, 3645];
let costN = 405;

function time(fn) {
  let reps = 0, out;
  const t0 = performance.now();
  do { out = fn(); reps++; } while (performance.now() - t0 < 30);
  return { out, ms: (performance.now() - t0) / reps };
}

async function renderCost() {
  $('cost-run').disabled = true;
  const rows = [];
  let ratio = 0;
  for (const F of I.FUNCTIONS) {
    await yieldToBrowser();
    const r = time(() => I.riemann(F, costN)), l = time(() => I.lebesgue(F, costN));
    ratio += l.out.evals / r.out.evals;
    rows.push(`<tr><td>${F.label}</td><td class="num mono">${group(r.out.evals)}</td><td class="num mono">${r.ms.toFixed(3)} ms</td>` +
      `<td class="num mono">${group(l.out.evals)}</td><td class="num mono">${l.ms.toFixed(2)} ms</td></tr>`);
  }
  $('cost-table').tBodies[0].innerHTML = rows.join('');
  $('cost-run').disabled = false;
  stage('cost', `Lebesgue ≈ ${Math.round(ratio / I.FUNCTIONS.length)} × Riemann evaluations`);
  stage('cost-note', `N = ${group(costN)}`);
}

// ---- 06 Dirichlet, 07 Thomae ------------------------------------------------------------------

function renderDirichlet() {
  // rational points give f = 1, irrational points f = 0, on every strip: the sums are 1 · h · N and 0
  $('dir-table').tBodies[0].innerHTML = [10, 100, 1000, 10000].map((N) =>
    `<tr><td class="num mono">${group(N)}</td><td class="num mono">1</td><td class="num mono">0</td><td class="num mono">1</td><td class="num mono">0</td></tr>`).join('');
}

function renderThomae() {
  const Ns = [10, 20, 50, 100, 200, 500, 1000, 2000, 4000];
  const up = Ns.map(I.thomaeUpper), mid = Ns.map(I.thomaeMidpoint);
  xyChart($('th-chart'), {
    height: 260,
    x: { domain: [Ns[0], Ns.at(-1)], log: true, label: 'N', fmt: group },
    y: { domain: [1e-4, 1], log: true },
    series: [
      { kind: 'line', label: 'upper sum', points: Ns.map((N, i) => [N, up[i]]), color: 'var(--series-1)' },
      { kind: 'dots', points: Ns.map((N, i) => [N, up[i]]), color: 'var(--series-1)', legend: false },
      { kind: 'line', label: 'midpoint sum', points: Ns.map((N, i) => [N, mid[i]]), color: 'var(--series-2)', dash: '6 4' },
      { kind: 'dots', points: Ns.map((N, i) => [N, mid[i]]), color: 'var(--series-2)', legend: false },
    ],
    hover: { xs: Ns, text: (i) => ({ title: `N = ${group(Ns[i])}`, lines: [`upper ${up[i].toFixed(5)}`, `midpoint ${mid[i].toFixed(5)}`, 'lower 0'] }) },
    ariaLabel: "Riemann sums of Thomae's function against N",
  });
  $('th-note').textContent = `${up[0].toFixed(3)} at N = 10, ${up.at(-1).toFixed(4)} at N = 4 000`;
  $('th-table').tBodies[0].innerHTML = [2, 5, 10, 100, 1000].map((q) =>
    `<tr><td class="num mono">${group(q)}</td><td class="num mono">${group(I.thomaeLevelCount(q))}</td><td class="num mono">0</td></tr>`).join('');
}

// ---- init ---------------------------------------------------------------------------------------

fillFunctions($('fig-f'), fig.id);
$('fig-f').addEventListener('change', (e) => { fig.id = e.target.value; renderFigure(); });
$('fig-n').addEventListener('input', (e) => { fig.n = +e.target.value; renderFigure(); });
renderFigure();

fillFunctions($('acc-f'), 'sin');
whenVisible($('accuracy'), async () => {
  await computeRuns();
  renderAccuracyTable();
  renderAccuracyChart($('acc-f').value);
  $('acc-f').addEventListener('change', (e) => renderAccuracyChart(e.target.value));
});

for (const N of COST_NS) {
  const o = document.createElement('option');
  o.value = N; o.textContent = group(N);
  $('cost-n').appendChild(o);
}
$('cost-n').value = costN;
$('cost-n').addEventListener('change', (e) => { costN = +e.target.value; renderCost(); });
$('cost-run').addEventListener('click', renderCost);
whenVisible($('cost'), renderCost);

renderDirichlet();
whenVisible($('thomae'), renderThomae);
