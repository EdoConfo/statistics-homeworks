// HW1 page controller: curve facts, the k -> Q computation, brute-force inversion.
import {
  PRESETS, INF, enumeratePoints, groupOrder, pointOrder, multiples, scalarMultTrace,
  bruteForceLog, add, fmt, eq,
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
    tile('Cofactor #E / ord(G)', String(N / ordG), 'secp256k1: 1'),
    tile('p mod 3', String(C.p % 3n), 'supersingular case'),
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

// ---- 05 brute force -------------------------------------------------------------

function initInverse() {
  const sel = $('i-target');
  for (const P of POINTS) {
    const o = document.createElement('option');
    o.value = `${P.x},${P.y}`;
    o.textContent = fmt(P);
    if (P.x === 5n && P.y === 8n) o.selected = true;
    sel.appendChild(o);
  }
  const run = () => {
    const Q = parsePoint(sel.value);
    const lines = [[['# find k such that k·G = Q,  G = (1, 5),  Q = ' + fmt(Q), 'c-dim']]];
    let R = INF;
    for (let k = 1; k <= 9; k++) {
      R = add(C, R, G0);
      const hit = eq(R, Q);
      lines.push([`k = ${k}:  ${k}G = ${fmt(R).padEnd(9)} `, hit ? ['✓ match', 'c-ok'] : ['✗', 'c-dim']]);
      if (hit) break;
      if (R === INF) {
        lines.push([['Back to O: the cycle of G is exhausted.', 'c-warn']]);
        lines.push([[`${fmt(Q)} is not a multiple of G (not in ⟨G⟩): no private key maps to it with this G.`, 'c-warn']]);
      }
    }
    const res = bruteForceLog(C, G0, Q, 9n);
    if (res.k !== null) lines.push('', [['Recovered private key: ', 'c-dim'], [`k = ${res.k}`, 'c-ok'], ` after ${res.tries} tries.`]);
    writeConsole($('i-out'), lines);
  };
  $('i-run').addEventListener('click', run);
  sel.addEventListener('change', run);
  run();
}

renderCurve();
initCompute();
initViz({ curve: C, G: G0 });
initInverse();
initExplore();
