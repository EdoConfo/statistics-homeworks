// Homework 6 page controller: the dataset and its contingency table (01), marginal and conditional
// frequencies (02), expected frequencies (03), chi-square and p-value (04), conclusions (06).
import * as I from './independence.js';
import { randomSeed } from '../homework-3/walks.js';
import { $, tile, group, stage, sup } from '../homework-2/ui.js';

const N = 500;
const ALPHA = 0.05;
const SHOWN = 8;   // records listed in 01

const num = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const fmtP = (p) => {
  if (p >= 1e-4) return p.toFixed(4);
  const [m, e] = p.toExponential(2).split('e');
  return `${m} × 10${sup(e)}`;
};
const pHtml = (p) => {
  if (p >= 1e-4) return p.toFixed(4);
  const [m, e] = p.toExponential(2).split('e');
  return `${m} × 10<sup>${e.replace('-', '−')}</sup>`;
};

const td = (v, cls = '') => `<td class="num mono${cls ? ' ' + cls : ''}">${v}</td>`;

/** A table with the categories of X as rows and of F as columns, an optional total row and column. */
function crossTable(el, t, cell, { rowTotal, colTotal, corner = '', rowLabel = 'Total', colLabel = 'Total' } = {}) {
  const head = `<tr><th>${corner}</th>${t.cols.map((c) => `<th class="num">${c}</th>`).join('')}${rowTotal ? `<th class="num">${colLabel}</th>` : ''}</tr>`;
  const body = t.rows.map((r, i) =>
    `<tr><th scope="row">${r}</th>${t.cols.map((_, j) => td(cell(i, j))).join('')}${rowTotal ? td(rowTotal(i), 'total') : ''}</tr>`).join('');
  const foot = colTotal
    ? `<tr class="total"><th scope="row">${rowLabel}</th>${t.cols.map((_, j) => td(colTotal(j))).join('')}${rowTotal ? td(colTotal(-1)) : ''}</tr>`
    : '';
  el.innerHTML = `<thead>${head}</thead><tbody>${body}${foot}</tbody>`;
}

/** 100% bars: one per category of X with its conditional distribution of F, and the marginal of F last. */
function profileBars(el, t, fGivenX, colMarginal) {
  const bar = (label, ps, cls = '') =>
    `<div class="profile${cls}"><span class="profile-label">${label}</span><span class="profile-bar">${ps.map((p, j) =>
      `<span class="seg s${j + 1}" style="width:${(100 * p).toFixed(2)}%" title="${t.cols[j]}: ${pct(p)}">${p >= 0.08 ? pct(p) : ''}</span>`).join('')}</span></div>`;
  el.innerHTML = t.rows.map((r, i) => bar(r, fGivenX[i])).join('') + bar('All', colMarginal, ' all') +
    `<div class="legend profile-legend">${t.cols.map((c, j) => `<span><span class="swatch s${j + 1}"></span>${c}</span>`).join('')}</div>`;
}

function run(seed = randomSeed()) {
  const log = I.intrusionLog(N, seed);
  const t = I.contingencyTable(log, 'service', 'outcome', I.SERVICES, I.OUTCOMES);
  const rel = I.relative(t), cond = I.conditional(t);
  const x = I.chiSquare(t);
  const crit = I.criticalValue(x.df, ALPHA);
  const dependent = x.pValue < ALPHA;

  // 01 records and contingency table
  $('records').tBodies[0].innerHTML = log.slice(0, SHOWN).map((r) =>
    `<tr><td class="num mono">${r.id}</td><td>${r.service}</td><td>${r.outcome}</td></tr>`).join('') +
    `<tr><td class="num mono muted">…</td><td class="muted">…</td><td class="muted">…</td></tr>`;
  crossTable($('t-counts'), t, (i, j) => t.counts[i][j],
    { rowTotal: (i) => t.rowTotals[i], colTotal: (j) => (j < 0 ? t.n : t.colTotals[j]), corner: 'X \\ F' });

  // 02 frequencies
  crossTable($('t-joint'), t, (i, j) => num(rel.joint[i][j]),
    { rowTotal: (i) => num(rel.rowMarginal[i]), colTotal: (j) => (j < 0 ? num(1) : num(rel.colMarginal[j])), corner: 'X \\ F', rowLabel: 'f·ⱼ', colLabel: 'fᵢ·' });
  crossTable($('t-f-given-x'), t, (i, j) => pct(cond.fGivenX[i][j]),
    { rowTotal: () => pct(1), colTotal: (j) => (j < 0 ? pct(1) : pct(rel.colMarginal[j])), corner: 'X \\ F', rowLabel: 'Marginal of F' });
  crossTable($('t-x-given-f'), t, (i, j) => pct(cond.xGivenF[i][j]),
    { rowTotal: (i) => pct(rel.rowMarginal[i]), colTotal: (j) => pct(1), corner: 'X \\ F', colLabel: 'Marginal of X' });
  profileBars($('profiles'), t, cond.fGivenX, rel.colMarginal);

  // 03 expected
  crossTable($('t-expected'), t, (i, j) => num(x.expected[i][j], 2),
    { rowTotal: (i) => t.rowTotals[i], colTotal: (j) => (j < 0 ? t.n : t.colTotals[j]), corner: 'X \\ F' });
  crossTable($('t-diff'), t, (i, j) => {
    const d = t.counts[i][j] - x.expected[i][j];
    return `${d > 0 ? '+' : d < 0 ? '−' : ''}${num(Math.abs(d), 2)}`;
  }, { corner: 'X \\ F' });
  const small = x.expected.flat().filter((e) => e < 5).length;
  $('expected-check').innerHTML = `Smallest expected count: <span class="mono">${num(x.minExpected, 2)}</span>. ` + (small === 0
    ? 'All are at least 5, so the chi-square approximation of the next section can be used.'
    : `${small} of ${x.expected.flat().length} are below 5, so the chi-square approximation of the next section is less reliable for this sample.`);

  // 04 chi-square
  crossTable($('t-contrib'), t, (i, j) => num(x.contributions[i][j], 2),
    { rowTotal: (i) => num(x.contributions[i].reduce((s, v) => s + v, 0), 2),
      colTotal: (j) => num(j < 0 ? x.stat : x.contributions.reduce((s, row) => s + row[j], 0), 2), corner: 'X \\ F' });
  $('x-tiles').replaceChildren(
    tile('χ² statistic', num(x.stat, 2), `sum of the ${t.rows.length * t.cols.length} cells`),
    tile('Degrees of freedom', String(x.df), `(${t.rows.length} − 1)(${t.cols.length} − 1)`),
    tile('Critical value, α = 0.05', num(crit, 2), `P(χ² ≥ ${num(crit, 2)}) = 0.05 with ${x.df} df`),
    tile('p-value', fmtP(x.pValue), `P(χ² ≥ ${num(x.stat, 2)}) with ${x.df} df`),
  );

  // 06 conclusions
  $('verdict').innerHTML = dependent
    ? `<span class="math">χ² = ${num(x.stat, 2)} &gt; ${num(crit, 2)}</span> and <span class="math">p = ${pHtml(x.pValue)} &lt; 0.05</span>:
       the hypothesis of independence is <strong>rejected</strong>. In this sample the targeted service and the outcome of the attempt are
       <strong>statistically dependent</strong>.`
    : `<span class="math">χ² = ${num(x.stat, 2)} ≤ ${num(crit, 2)}</span> and <span class="math">p = ${pHtml(x.pValue)} ≥ 0.05</span>:
       the hypothesis of independence is <strong>not rejected</strong>. The data are compatible with the targeted service and the outcome being
       <strong>independent</strong>.`;
  $('meaning').textContent = dependent
    ? 'The conditional distributions of the outcome differ across services more than sampling noise would explain: knowing which service was attacked changes the probabilities of the outcome.'
    : 'The conditional distributions of the outcome differ across services no more than sampling noise would explain: knowing which service was attacked does not change the probabilities of the outcome.';
  const undetected = I.OUTCOMES.indexOf('Undetected');
  const top = cond.fGivenX.map((row, i) => [i, row[undetected]]).sort((a, b) => b[1] - a[1])[0];
  $('pattern').innerHTML = `For example, ${pct(top[1])} of the attempts on <strong>${t.rows[top[0]]}</strong>
    went undetected, against ${pct(rel.colMarginal[undetected])} over all services.`;

  stage('data', `n = ${group(t.n)} attempts\n${t.rows.length} × ${t.cols.length} table`);
  stage('chi', num(x.stat, 2));
  stage('df', `df = ${x.df} · critical ${num(crit, 2)}`);
  stage('p', fmtP(x.pValue));
  stage('verdict', dependent ? 'dependent' : 'independent');
}

run(20261117);
$('run').addEventListener('click', () => run());
