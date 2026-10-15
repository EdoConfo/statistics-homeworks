// HW1 page controller: curve facts, point addition, and the k -> Q computation.
import {
  PRESETS, INF, mod, inv, addDetailed, isOnCurve, enumeratePoints, groupOrder, pointOrder, multiples, scalarMultTrace,
  fmt, eq,
} from './ecc.js';
import { initViz } from './viz.js';
import { initExplore } from './explore.js';

const { curve: C, G: G0 } = PRESETS.toy17;
const N = groupOrder(C);
const POINTS = enumeratePoints(C);
const NAIVE_PRINT_MAX = 200n;

const $ = (id) => document.getElementById(id);

function tile(label, value, sub) {
  const t = document.createElement('div');
  t.className = 'tile';
  const a = document.createElement('div'); a.className = 't-label'; a.textContent = label;
  const b = document.createElement('div'); b.className = 't-value mono'; b.textContent = value;
  t.append(a, b);
  if (sub) { const c = document.createElement('div'); c.className = 't-sub'; c.textContent = sub; t.appendChild(c); }
  return t;
}

/** Console writer: lines are arrays of [text, className?] segments. */
function writeConsole(pre, lines) {
  pre.replaceChildren();
  for (const line of lines) {
    for (const seg of [].concat(line)) {
      if (typeof seg === 'string') pre.appendChild(document.createTextNode(seg));
      else {
        const s = document.createElement('span');
        s.className = seg[1];
        s.textContent = seg[0];
        pre.appendChild(s);
      }
    }
    pre.appendChild(document.createTextNode('\n'));
  }
}

const parsePoint = (v) => { const [x, y] = v.split(',').map(BigInt); return { x, y }; };
const short = (k) => { const s = k.toString(); return s.length > 24 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s; };

// ---- 01 the toy curve --------------------------------------------------------

function renderCurve() {
  const ordG = pointOrder(C, G0, N);
  $('curve-tiles').append(
    tile('#E (points incl. O)', String(N), '17 affine points + O'),
    tile('Order of G = (1, 5)', String(ordG), '9G = O'),
  );
  const multipleOf = new Map();
  multiples(C, G0, Number(ordG)).forEach((P, j) => { if (P !== INF) multipleOf.set(fmt(P), j + 1); });
  const tbody = $('points-table').tBodies[0];
  const rows = [...POINTS, INF];
  for (const P of rows) {
    const tr = tbody.insertRow();
    const j = P === INF ? 9 : multipleOf.get(fmt(P));
    const cells = [fmt(P), String(pointOrder(C, P, N)), j ? '✓' : '·', j ? (P === INF ? '0G = 9G' : `${j}G`) : '-'];
    cells.forEach((c, i) => {
      const td = tr.insertCell();
      td.textContent = c;
      if (i === 0) td.className = 'mono';
      if (i === 1 || i === 3) td.className = 'num mono';
      if (i === 2 && j) td.className = 'yes';
    });
  }
}

// ---- 02 point addition ---------------------------------------------------------

const num = (v) => (v < 0n ? `−${-v}` : String(v));
const factor = (v) => (v < 0n ? `(${num(v)})` : String(v));   // negative factors in brackets: (−5) · (−1)⁻¹
const reduced = (raw) => (mod(raw, C.p) === raw ? num(raw) : `${num(raw)} ≡ ${mod(raw, C.p)}`);
const readPoint = (v) => (v === 'O' ? INF : parsePoint(v));

/** The last steps of a chain: the raw value, then its reduction mod p when it differs. */
const result = (raw) => (mod(raw, C.p) === raw ? [['=', num(raw)]] : [['=', num(raw)], ['≡', String(mod(raw, C.p))]]);

/** Writes "name = a" and then each further step on its own row, aligned under the "=". */
function column(lines, name, steps) {
  steps.forEach(([op, expr], i) => lines.push(`${i ? '  ' : name} ${op} ${expr}`));
}

function fillPointSelect(sel, selected) {
  for (const P of [...POINTS, INF]) {
    const o = document.createElement('option');
    o.value = P === INF ? 'O' : `${P.x},${P.y}`;
    o.textContent = P === INF ? 'O (point at infinity)' : fmt(P);
    sel.appendChild(o);
  }
  sel.value = selected;
}

/** Every step of P + Q, with the raw numbers before each reduction mod p. */
function explainAdd(P, Q) {
  const p = C.p;
  const d = addDetailed(C, P, Q);
  const lines = [[[`# P = ${fmt(P)},  Q = ${fmt(Q)},  curve y² = x³ + 7 (mod ${p})`, 'c-dim']]];
  let how;
  if (d.kind === 'identity') {
    how = 'O is the neutral element';
    lines.push(P === INF ? 'P = O, the neutral element:  O + Q = Q' : 'Q = O, the neutral element:  P + O = P');
  } else if (d.kind === 'inverse') {
    how = 'Q = −P, vertical line';
    lines.push(`Same x and y₁ + y₂ = ${P.y} + ${Q.y} = ${P.y + Q.y} ≡ 0, so Q = −P.`);
    lines.push('The line through them is vertical and meets the curve "at infinity":  P + Q = O');
  } else {
    const { x: x1, y: y1 } = P, { x: x2, y: y2 } = Q;
    let numRaw, denRaw;
    const lam = [];   // λ, one step per row: [operator, expression]
    if (d.kind === 'double') {
      how = 'P = Q, tangent line';
      numRaw = 3n * x1 * x1 + C.a; denRaw = 2n * y1;
      lines.push([['P = Q: doubling, use the tangent line', 'c-hi']], '');
      lam.push(['=', '(3·x₁² + a) · (2·y₁)⁻¹'], ['=', `(3·${x1}² + ${C.a}) · (2·${y1})⁻¹`]);
    } else {
      how = 'P ≠ Q, line through P and Q';
      numRaw = y2 - y1; denRaw = x2 - x1;
      lines.push([['P ≠ Q: line through P and Q', 'c-hi']], '');
      lam.push(['=', '(y₂ − y₁) · (x₂ − x₁)⁻¹'], ['=', `(${y2} − ${y1}) · (${x2} − ${x1})⁻¹`]);
    }
    lam.push(['=', `${factor(numRaw)} · ${factor(denRaw)}⁻¹`]);
    if (mod(numRaw, p) !== numRaw || mod(denRaw, p) !== denRaw) lam.push(['≡', `${d.num} · ${d.den}⁻¹`]);
    const di = inv(d.den, p);
    lam.push(['=', `${d.num} · ${di}`]);
    lam.push(...result(d.num * di));
    column(lines, 'λ ', lam);
    lines.push([[`   (${d.den}⁻¹ = ${di}, because ${d.den} · ${di} = ${d.den * di} = ${(d.den * di) / p}·${p} + 1)`, 'c-dim']], '');

    const { x: x3, y: y3 } = d.result;
    column(lines, 'x₃', [['=', 'λ² − x₁ − x₂'], ['=', `${d.lambda}² − ${x1} − ${x2}`], ...result(d.lambda * d.lambda - x1 - x2)]);
    lines.push('');
    column(lines, 'y₃', [['=', 'λ·(x₁ − x₃) − y₁'], ['=', `${d.lambda}·(${x1} − ${x3}) − ${y1}`], ...result(d.lambda * (x1 - x3) - y1)]);
    lines.push('');

    const lhs = y3 * y3, rhs = x3 * x3 * x3 + C.a * x3 + C.b;
    lines.push([[`check:  y₃²     = ${y3}² = ${reduced(lhs)}`, 'c-dim']]);
    lines.push([[`        x₃³ + 7 = ${x3}³ + 7 = ${reduced(rhs)}   `, 'c-dim'],
      isOnCurve(C, d.result) ? ['✓ on the curve', 'c-ok'] : ['✗', 'c-warn']]);
  }
  lines.push('', [['P + Q = ', 'c-dim'], [fmt(d.result), 'c-ok']]);
  return { lines, result: d.result, how };
}

function initAddition() {
  const selP = $('a-p'), selQ = $('a-q');
  fillPointSelect(selP, '1,5');
  fillPointSelect(selQ, '1,5');
  const run = () => {
    const { lines, result, how } = explainAdd(readPoint(selP.value), readPoint(selQ.value));
    writeConsole($('a-out'), lines);
    $('a-key-value').textContent = fmt(result);
    $('a-key-sub').textContent = how;
  };
  document.querySelectorAll('[data-pq]').forEach((b) => b.addEventListener('click', () => {
    [selP.value, selQ.value] = b.dataset.pq.split('|');
    run();
  }));
  selP.addEventListener('change', run);
  selQ.addEventListener('change', run);
  run();
}

// ---- 03 computing Q = kG -------------------------------------------------------

const compute = { method: 'naive' };

function fillBaseSelect(sel, selected) {
  for (const P of POINTS) {
    const o = document.createElement('option');
    o.value = `${P.x},${P.y}`;
    o.textContent = `${fmt(P)} · order ${pointOrder(C, P, N)}`;
    if (eq(P, selected)) o.selected = true;
    sel.appendChild(o);
  }
}

function runCompute() {
  const out = $('c-out');
  const G = parsePoint($('c-base').value);
  const raw = $('c-k').value.trim().replace(/[\s_]/g, '');
  let k;
  try {
    if (!/^(0x[0-9a-f]+|\d+)$/i.test(raw)) throw new Error();
    k = BigInt(raw);
    if (k < 1n) throw new Error();
  } catch {
    writeConsole(out, [[['Please enter a positive integer k (decimal or 0x-hex).', 'c-warn']]]);
    return;
  }
  const ordG = pointOrder(C, G, N);
  const lines = [
    [['# toy curve  ', 'c-dim'], `${C.name}`],
    [['# base point ', 'c-dim'], `G = ${fmt(G)}  (order ${ordG})`],
    [['# private key', 'c-dim'], ` k = ${short(k)}${k >= ordG ? `  ≡ ${k % ordG} (mod ${ordG})` : ''}`],
    '',
  ];

  const { bits, steps, result } = scalarMultTrace(C, k, G);
  if (compute.method === 'naive') {
    if (k > NAIVE_PRINT_MAX) {
      lines.push([[`Repeated addition would need ${short(k - 1n)} additions. Printing is limited to k ≤ ${NAIVE_PRINT_MAX}.`, 'c-warn']]);
      lines.push([['Switch to double-and-add: it needs only ' + steps.length + ' operations.', 'c-warn']]);
    } else {
      multiples(C, G, k).forEach((P, i) => {
        const j = BigInt(i + 1);
        lines.push([[`${String(j).padStart(4)}G`, j === k ? 'c-hi' : ''], ' = ', [fmt(P), j === k ? 'c-hi' : '']]);
      });
    }
  } else {
    lines.push([[`k = ${bits.length > 64 ? bits.slice(0, 32) + '…' + bits.slice(-16) : bits} (binary, ${bits.length} bits)`, 'c-dim']]);
    const show = steps.length > 80 ? [...steps.slice(0, 40), null, ...steps.slice(-20)] : steps;
    for (const s of show) {
      if (s === null) { lines.push([['   …', 'c-dim']]); continue; }
      const what = s.op === 'double' ? `2·${fmt(s.from)}` : s.op === 'load' ? 'O + G' : `${fmt(s.from)} + G`;
      lines.push([
        [`bit ${bits[s.bitIndex]} `, 'c-dim'], `${s.op.padEnd(6)} `, what.padEnd(18), ' = ', [fmt(s.result).padEnd(10), 'c-hi'],
        [s.lambda !== undefined ? ` λ=${s.lambda}` : '', 'c-dim'],
      ]);
    }
  }
  lines.push('');
  lines.push([['TOY PUBLIC KEY', 'c-ok'], `  Q = ${short(k)}·G = `, [fmt(result), 'c-ok']]);
  writeConsole(out, lines);
  out.scrollTop = out.scrollHeight;

  $('c-key-value').textContent = fmt(result);
  $('c-key-sub').textContent = `Q = ${short(k)}·G${result === INF ? '  (k is a multiple of ord(G))' : ''}`;
  const tiles = $('c-tiles');
  tiles.replaceChildren(
    tile('Repeated addition', `${short(k - 1n)}`, 'additions for kG'),
    tile('Double-and-add', String(steps.length), `operations (${bits.length} bits)`),
    tile('k mod ord(G)', String(k % ordG), `ord(G) = ${ordG}`),
  );
}

function initCompute() {
  fillBaseSelect($('c-base'), G0);
  const methodBtns = document.querySelectorAll('[data-method]');
  methodBtns.forEach((b) => b.addEventListener('click', () => {
    methodBtns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    compute.method = b.dataset.method;
    runCompute();
  }));
  document.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    $('c-k').value = b.dataset.k;
    if (BigInt(b.dataset.k) > NAIVE_PRINT_MAX && compute.method === 'naive') {
      document.querySelector('[data-method="dbl"]').click();
      return;
    }
    runCompute();
  }));
  $('c-k').addEventListener('input', runCompute);
  $('c-base').addEventListener('change', runCompute);
  runCompute();
}


renderCurve();
initAddition();
initCompute();
initViz({ curve: C, G: G0 });
initExplore();
