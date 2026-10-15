// Slow-motion visualisation of point addition and double-and-add on the toy curve.
//
// Every group operation is played in four phases:
//   0  highlight the operands
//   1  draw the line through them: y = λx + c over F_p wraps around the grid
//   2  mark the third intersection point -R
//   3  reflect it to R = (x3, -y3) and make it the new accumulator

import { INF, addDetailed, scalarMultTrace, enumeratePoints, multiples, pointOrder, fmt, eq } from './ecc.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 520;
const PAD = { left: 34, right: 14, top: 26, bottom: 30 };
const NAIVE_MAX = 60;
const PHASES = 4;

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function initViz({ curve: C, G: G0 }) {
  const svg = document.getElementById('v-svg');
  const kInput = document.getElementById('v-k');
  const baseSel = document.getElementById('v-base');
  const bitsBox = document.getElementById('v-bits');
  const statusBox = document.getElementById('v-status');
  const logBox = document.getElementById('v-log');
  const playBtn = document.getElementById('v-play');
  const stepBtn = document.getElementById('v-step');
  const resetBtn = document.getElementById('v-reset');
  const speed = document.getElementById('v-speed');
  const modeBtns = [...document.querySelectorAll('[data-vmode]')];

  const p = Number(C.p);
  const cell = (SIZE - PAD.left - PAD.right) / p;
  const X = (u) => PAD.left + u * cell;              // u in [0, p], lattice v sits at v + 0.5
  const Y = (u) => SIZE - PAD.bottom - u * cell;

  const points = enumeratePoints(C);
  for (const P of points) {
    const o = document.createElement('option');
    o.value = `${P.x},${P.y}`;
    o.textContent = `${fmt(P)} · order ${pointOrder(C, P)}`;
    if (eq(P, G0)) o.selected = true;
    baseSel.appendChild(o);
  }

  const S = { G: G0, k: 6, mode: 'dbl', ops: [], bits: '', i: 0, phase: -1, playing: false, timer: 0, labels: new Map() };

  // ---- static layer -------------------------------------------------------
  const defs = el('defs', {}, svg);
  const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--series-7)' }, marker);
  const gridLayer = el('g', {}, svg);
  const lineLayer = el('g', {}, svg);
  const pointLayer = el('g', {}, svg);
  const fxLayer = el('g', {}, svg);

  function drawGrid() {
    gridLayer.replaceChildren();
    for (let v = 0; v < p; v++) {
      el('line', { class: 'grid', x1: X(v + 0.5), x2: X(v + 0.5), y1: Y(0), y2: Y(p) }, gridLayer);
      el('line', { class: 'grid', y1: Y(v + 0.5), y2: Y(v + 0.5), x1: X(0), x2: X(p) }, gridLayer);
      const tx = el('text', { class: 'tick', x: X(v + 0.5), y: Y(0) + 16, 'text-anchor': 'middle' }, gridLayer);
      tx.textContent = v;
      const ty = el('text', { class: 'tick', x: X(0) - 8, y: Y(v + 0.5) + 3.5, 'text-anchor': 'end' }, gridLayer);
      ty.textContent = v;
    }
    el('rect', { class: 'frame', x: X(0), y: Y(p), width: p * cell, height: p * cell }, gridLayer);
  }

  function drawPoints() {
    pointLayer.replaceChildren();
    S.labels = new Map();
    const mult = multiples(C, S.G, Number(pointOrder(C, S.G)));
    mult.forEach((P, j) => { if (P !== INF) S.labels.set(`${P.x},${P.y}`, j + 1); });
    for (const P of points) {
      const key = `${P.x},${P.y}`;
      const j = S.labels.get(key);
      const cx = X(Number(P.x) + 0.5), cy = Y(Number(P.y) + 0.5);
      el('circle', { class: j ? 'pt sub' : 'pt', cx, cy, r: 6.5 }, pointLayer);
      if (j) {
        const t = el('text', { class: 'pt-label', x: cx + 8, y: cy - 7 }, pointLayer);
        t.textContent = j === 1 ? 'G' : `${j}G`;
      }
    }
  }

  // ---- operation list -------------------------------------------------------
  function buildOps() {
    stop();
    S.k = Math.max(1, Math.floor(Number(kInput.value) || 1));
    S.ops = [];
    if (S.mode === 'dbl') {
      const { bits, steps } = scalarMultTrace(C, S.k, S.G);
      S.bits = bits;
      S.ops = steps;
    } else {
      S.bits = '';
      if (S.k > NAIVE_MAX) {
        S.k = NAIVE_MAX;
        kInput.value = NAIVE_MAX;
      }
      let R = INF;
      for (let j = 1; j <= S.k; j++) {
        const d = addDetailed(C, R, S.G);
        S.ops.push({ op: R === INF ? 'load' : 'add', from: R, operand: S.G, acc: BigInt(j), accBefore: BigInt(j - 1), ...d });
        R = d.result;
      }
    }
    S.i = 0;
    S.phase = -1;
    logBox.replaceChildren();
    lineLayer.replaceChildren();
    fxLayer.replaceChildren();
    renderBits();
    status('Ready', S.mode === 'dbl'
      ? `k = ${S.k} = ${S.bits}₂. Scan the bits from the left: double R for every bit, then add G when the bit is 1.`
      : `R starts at O; add G ${S.k} time${S.k > 1 ? 's' : ''}. Limited to k ≤ ${NAIVE_MAX} here.`);
    playBtn.textContent = 'Play';
  }

  function renderBits() {
    bitsBox.replaceChildren();
    if (S.mode === 'naive') {
      const cap = document.createElement('span');
      cap.className = 'bits-caption';
      const done = S.phase >= 0 ? S.i + (S.phase === PHASES - 1 ? 1 : 0) : 0;
      cap.textContent = `Repeated addition: step ${Math.min(done, S.k)} of ${S.k}`;
      bitsBox.appendChild(cap);
      return;
    }
    const cur = S.ops[S.i];
    [...S.bits].forEach((b, idx) => {
      const s = document.createElement('span');
      s.className = 'bit';
      if (S.phase >= 0 && cur && idx < cur.bitIndex) s.classList.add('done');
      if (S.phase >= 0 && cur && idx === cur.bitIndex) s.classList.add('now');
      if (S.phase >= 0 && !cur) s.classList.add('done');
      s.textContent = b;
      bitsBox.appendChild(s);
    });
    const cap = document.createElement('span');
    cap.className = 'bits-caption';
    cap.textContent = 'k in binary (MSB first)';
    bitsBox.appendChild(cap);
  }

  function status(op, detail) {
    statusBox.replaceChildren();
    const a = document.createElement('div');
    a.className = 'op';
    a.textContent = op;
    const b = document.createElement('div');
    b.className = 'detail';
    b.textContent = detail;
    statusBox.append(a, b);
  }

  // ---- drawing helpers ------------------------------------------------------
  const pt = (P) => [X(Number(P.x) + 0.5), Y(Number(P.y) + 0.5)];

  function ring(P, cls, r = 11) {
    const [cx, cy] = pt(P);
    return el('circle', { class: `${cls} fade-in`, cx, cy, r }, fxLayer);
  }

  /** Line y = s*x + c0 over the reals, wrapped mod p onto the grid. */
  function drawWrappedLine(lambda, P) {
    let s = Number(lambda);
    if (s > p / 2) s -= p;                       // shortest representative: fewer wraps
    const c0 = Number(P.y) - s * Number(P.x);
    const f = (x) => s * x + c0 + 0.5;           // shifted so lattice v -> v + 0.5
    const xa = -0.5, xb = p - 0.5;
    const cuts = [xa];
    if (s !== 0) {
      const lo = Math.min(f(xa), f(xb)), hi = Math.max(f(xa), f(xb));
      for (let m = Math.ceil(lo / p); m * p <= hi; m++) {
        const xc = (m * p - c0 - 0.5) / s;
        if (xc > xa && xc < xb) cuts.push(xc);
      }
    }
    cuts.push(xb);
    cuts.sort((a, b) => a - b);
    const g = el('g', { class: 'fade-in' }, lineLayer);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const shift = Math.floor(f((a + b) / 2) / p) * p;
      el('line', { class: 'line-seg', x1: X(a + 0.5), y1: Y(f(a) - shift), x2: X(b + 0.5), y2: Y(f(b) - shift) }, g);
    }
    // the line as a set of points of F_p x F_p
    for (let x = 0; x < p; x++) {
      const y = (((Number(lambda) * x + (Number(P.y) - Number(lambda) * Number(P.x))) % p) + p) % p;
      el('circle', { class: 'line-dot', cx: X(x + 0.5), cy: Y(y + 0.5), r: 2.4 }, g);
    }
  }

  function drawVertical(P) {
    const g = el('g', { class: 'fade-in' }, lineLayer);
    const x = X(Number(P.x) + 0.5);
    el('line', { class: 'line-seg', x1: x, x2: x, y1: Y(0), y2: Y(p) + 2 }, g);
    const t = el('text', { class: 'inf-label', x, y: Y(p) - 8, 'text-anchor': 'middle' }, g);
    t.textContent = '↑ O';
  }

  function accMarker(P) {
    if (P === INF) return;
    ring(P, 'acc', 14);
  }

  const n = (v) => v.toString();
  function describe(op) {
    const from = fmt(op.from);
    const q = fmt(op.operand);
    if (op.kind === 'identity') return [`R = O + G = ${fmt(op.result)}`, 'Adding to the point at infinity O returns the other point unchanged.'];
    if (op.kind === 'inverse') return [`R = ${from} + ${q} = O`, 'The points are inverses (same x, opposite y): the line is vertical, so the sum is the point at infinity O.'];
    const pp = n(C.p);
    if (op.kind === 'double') {
      return [`R = 2 · ${from} = ${fmt(op.result)}`,
        `λ = (3·${op.from.x}² + ${C.a})·(2·${op.from.y})⁻¹ = ${op.num}·${op.den}⁻¹ ≡ ${op.lambda} (mod ${pp}); x₃ = λ² − 2x₁ = ${op.result.x}; y₃ = λ(x₁ − x₃) − y₁ = ${op.result.y}`];
    }
    return [`R = ${from} + ${q} = ${fmt(op.result)}`,
      `λ = (${op.operand.y} − ${op.from.y})·(${op.operand.x} − ${op.from.x})⁻¹ = ${op.num}·${op.den}⁻¹ ≡ ${op.lambda} (mod ${pp}); x₃ = ${op.result.x}; y₃ = ${op.result.y}`];
  }

  function opTitle(op) {
    const bit = S.mode === 'dbl' ? `bit ${S.bits[op.bitIndex]} · ` : '';
    const what = op.op === 'double' ? 'double' : op.op === 'load' ? 'load G' : 'add G';
    return `${bit}${what} → ${op.acc}G`;
  }

  function renderPhase() {
    const op = S.ops[S.i];
    lineLayer.replaceChildren();
    fxLayer.replaceChildren();
    renderBits();
    if (!op) return;
    const [title, detail] = describe(op);
    status(opTitle(op), `${title}\n${detail}`);

    if (op.from !== INF) accMarker(op.from);
    if (op.kind === 'identity') {
      if (S.phase >= 0) ring(op.operand, 'operand');
      if (S.phase >= 2) { const [cx, cy] = pt(op.result); el('circle', { class: 'result fade-in', cx, cy, r: 7.5 }, fxLayer); }
      return;
    }
    if (S.phase >= 0) {
      ring(op.from, 'operand');
      if (op.kind !== 'double') ring(op.operand, 'operand', 15);
    }
    if (op.kind === 'inverse') {
      if (S.phase >= 1) drawVertical(op.from);
      return;
    }
    if (S.phase >= 1) drawWrappedLine(op.lambda, op.from);
    if (S.phase >= 2) ring(op.third, 'third', 8);
    if (S.phase >= 3) {
      const [x1, y1] = pt(op.third);
      const [x2, y2] = pt(op.result);
      if (y1 !== y2) el('line', { class: 'reflect fade-in', x1, y1: y1 + (y2 > y1 ? 9 : -9), x2, y2: y2 + (y2 > y1 ? -10 : 10) }, fxLayer);
      el('circle', { class: 'result fade-in', cx: x2, cy: y2, r: 7.5 }, fxLayer);
    }
  }

  function logOp(op) {
    logBox.querySelector('.current')?.classList.remove('current');
    const li = document.createElement('li');
    li.className = 'current';
    li.textContent = `${opTitle(op).padEnd(22)}  ${describe(op)[0]}${op.lambda !== undefined ? `   λ=${op.lambda}` : ''}`;
    logBox.appendChild(li);   // the log grows with the page; no auto-scroll, so the page never jumps while playing
  }

  function finish() {
    stop();
    S.i = S.ops.length;
    renderBits();
    const last = S.ops.at(-1);
    lineLayer.replaceChildren();
    fxLayer.replaceChildren();
    if (last.result !== INF) {
      const [cx, cy] = pt(last.result);
      el('circle', { class: 'result fade-in', cx, cy, r: 9 }, fxLayer);
      const t = el('text', { class: 'inf-label fade-in', x: cx + 12, y: cy + 22 }, fxLayer);
      t.textContent = 'Q';
    }
    status(`Q = ${S.k}G = ${fmt(last.result)}`,
      `${S.ops.length} group operation${S.ops.length > 1 ? 's' : ''} (${S.mode === 'dbl' ? 'double-and-add' : 'repeated addition'}). This is the toy public key.`);
    playBtn.textContent = 'Replay';
  }

  // ---- control flow -----------------------------------------------------------
  function advance() {
    if (S.i >= S.ops.length) return false;
    S.phase++;
    if (S.phase >= PHASES) {
      S.phase = 0;
      S.i++;
      if (S.i >= S.ops.length) { finish(); return false; }
    }
    if (S.phase === 0) logOp(S.ops[S.i]);
    renderPhase();
    return true;
  }

  const delay = () => 2400 / Number(speed.value);

  function tick() {
    if (!S.playing) return;
    if (advance()) S.timer = setTimeout(tick, delay());
  }

  function play() {
    if (S.i >= S.ops.length) buildOps();
    S.playing = true;
    playBtn.textContent = 'Pause';
    tick();
  }

  function stop() {
    S.playing = false;
    clearTimeout(S.timer);
    playBtn.textContent = 'Play';
  }

  playBtn.addEventListener('click', () => (S.playing ? stop() : play()));
  stepBtn.addEventListener('click', () => {
    stop();
    if (S.i >= S.ops.length) buildOps();
    // jump to the last phase of the next operation
    if (S.phase === PHASES - 1 || S.phase === -1) {
      if (S.phase === PHASES - 1) S.i++;
      if (S.i >= S.ops.length) { finish(); return; }
      logOp(S.ops[S.i]);
    }
    S.phase = PHASES - 1;
    renderPhase();
  });
  resetBtn.addEventListener('click', buildOps);
  kInput.addEventListener('change', buildOps);
  baseSel.addEventListener('change', () => {
    const [x, y] = baseSel.value.split(',').map(BigInt);
    S.G = { x, y };
    drawPoints();
    buildOps();
  });
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    modeBtns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    S.mode = b.dataset.vmode;
    buildOps();
  }));

  drawGrid();
  drawPoints();
  buildOps();
}
