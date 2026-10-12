// Minimal dependency-free SVG charts: bar/histogram and scatter.
// Each chart re-renders on container resize, carries a hover/focus tooltip
// and an optional <details> data table so no value is hover-only.

const NS = 'http://www.w3.org/2000/svg';
const BASE_M = { top: 12, right: 12, bottom: 40, left: 48 };

/** Margins sized to the widest y tick label so the rotated axis title never collides. */
const margins = (labels) => ({ ...BASE_M, left: Math.max(40, 26 + 6.4 * Math.max(...labels.map((l) => l.length))) });

function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function niceStep(range, target) {
  const raw = range / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

/** Nice ticks covering [lo, hi]: the first tick is <= lo and the last is >= hi. */
function ticks(lo, hi, target = 5) {
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo, target);
  const out = [];
  const end = Math.ceil(hi / step - 1e-9) * step;
  for (let v = Math.floor(lo / step + 1e-9) * step; v <= end + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

const defaultFmt = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : +v.toPrecision(4) + '');

function topRoundedBar(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function mount(el, opts, render) {
  el.classList.add('chart');
  el._chartOpts = opts;
  el._chartRender = render;
  draw(el);
  if (!el._chartObserver) {
    let lastW = el.clientWidth;
    el._chartObserver = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - lastW) > 2) { lastW = el.clientWidth; draw(el); }
    });
    el._chartObserver.observe(el);
  }
}

function draw(el) {
  el.replaceChildren();
  const width = Math.max(260, el.clientWidth || 600);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  el._chartRender(el, el._chartOpts, width, tip);
  el.appendChild(tip);
  if (el._chartOpts.table) el.appendChild(dataTable(el._chartOpts.table));
}

function showTip(el, tip, x, y, value, label) {
  tip.replaceChildren();
  const s = document.createElement('strong');
  s.textContent = value;
  tip.appendChild(s);
  if (label) tip.appendChild(document.createTextNode(label));
  tip.classList.add('show');
  const w = el.clientWidth;
  const tw = tip.offsetWidth;
  tip.style.left = `${Math.min(Math.max(0, x - tw / 2), w - tw)}px`;
  tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
}

function hideTip(tip) { tip.classList.remove('show'); }

function legend(items) {
  const box = document.createElement('div');
  box.className = 'legend';
  for (const it of items) {
    const k = document.createElement('span');
    k.className = 'key';
    const sw = document.createElement('span');
    sw.className = it.kind === 'line' ? 'linekey' : 'swatch';
    sw.style.setProperty('--c', it.color);
    k.append(sw, document.createTextNode(it.label));
    box.appendChild(k);
  }
  return box;
}

function dataTable({ headers, rows, summary = 'Data table' }) {
  const d = document.createElement('details');
  d.className = 'data-table';
  const s = document.createElement('summary');
  s.textContent = summary;
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const t = document.createElement('table');
  const thead = t.createTHead().insertRow();
  headers.forEach((h, i) => {
    const th = document.createElement('th');
    th.textContent = h;
    if (i > 0) th.className = 'num';
    thead.appendChild(th);
  });
  const tb = t.createTBody();
  for (const r of rows) {
    const tr = tb.insertRow();
    r.forEach((c, i) => {
      const td = tr.insertCell();
      td.textContent = c;
      if (i > 0) td.className = 'num';
    });
  }
  wrap.appendChild(t);
  d.append(s, wrap);
  return d;
}

function axes(svg, { M, width, height, yTicks, yScale, yFmt, xLabel, yLabel }) {
  const g = svgEl('g', {}, svg);
  for (const t of yTicks) {
    const y = yScale(t);
    svgEl('line', { class: 'gridline', x1: M.left, x2: width - M.right, y1: y, y2: y }, g);
    const tx = svgEl('text', { x: M.left - 8, y: y + 3.5, 'text-anchor': 'end', 'font-variant-numeric': 'tabular-nums' }, g);
    tx.textContent = yFmt(t);
  }
  svgEl('line', { class: 'baseline', x1: M.left, x2: width - M.right, y1: height - M.bottom, y2: height - M.bottom }, g);
  if (xLabel) {
    const t = svgEl('text', { class: 'axis-title', x: M.left + (width - M.left - M.right) / 2, y: height - 4, 'text-anchor': 'middle' }, g);
    t.textContent = xLabel;
  }
  if (yLabel) {
    const t = svgEl('text', { class: 'axis-title', transform: `translate(11 ${M.top + (height - M.top - M.bottom) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, g);
    t.textContent = yLabel;
  }
}

/**
 * Bar chart / histogram.
 * opts: { data: [{label, value, tip?}], color, height, yMax, yFmt, xLabel, yLabel,
 *         expected?: number[], expectedStyle?: 'tick'|'line', expectedLabel?, observedLabel?, ref?: {value,label},
 *         xTickEvery?, table? }
 */
export function barChart(el, opts) {
  mount(el, opts, renderBars);
}

function renderBars(el, o, width, tip) {
  const height = o.height ?? 220;
  const n = o.data.length;
  const color = o.color ?? 'var(--series-1)';
  const yFmt = o.yFmt ?? defaultFmt;
  const maxVal = Math.max(
    o.yMax ?? 0,
    ...o.data.map((d) => d.value),
    ...(o.expected ?? []),
    o.ref ? o.ref.value : 0,
  ) || 1;
  const yTicks = ticks(0, o.yMax ?? maxVal, 4);
  const yTop = Math.max(yTicks.at(-1), o.yMax ?? 0);
  const M = margins(yTicks.map(yFmt));
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const yScale = (v) => M.top + innerH - (v / yTop) * innerH;
  const band = innerW / n;
  const gap = band > 6 ? 2 : band > 2.5 ? 1 : 0;
  const bw = Math.max(0.6, Math.min(24, band - gap, band * (n <= 24 ? 0.72 : 1)));

  if (o.expected) {
    el.appendChild(legend([
      { label: o.observedLabel ?? 'Observed', color, kind: 'bar' },
      { label: o.expectedLabel ?? 'Expected', color: 'var(--ink-2)', kind: 'line' },
    ]));
  }

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': o.ariaLabel ?? o.yLabel ?? 'bar chart' });
  axes(svg, { M, width, height, yTicks: yTicks.filter((t) => t <= yTop), yScale, yFmt, xLabel: o.xLabel, yLabel: o.yLabel });

  const bars = svgEl('g', {}, svg);
  const barEls = [];
  o.data.forEach((d, i) => {
    const x = M.left + i * band + (band - bw) / 2;
    const y = yScale(Math.min(d.value, yTop));
    const h = M.top + innerH - y;
    const shape = bw >= 8
      ? svgEl('path', { d: topRoundedBar(x, y, bw, h, 4), fill: color, class: 'bar' }, bars)
      : svgEl('rect', { x, y, width: bw, height: Math.max(0, h), fill: color, class: 'bar' }, bars);
    barEls.push(shape);
  });

  // x tick labels
  const every = o.xTickEvery ?? Math.max(1, Math.ceil(n / Math.floor(innerW / 34)));
  const xg = svgEl('g', {}, svg);
  o.data.forEach((d, i) => {
    if (i % every !== 0 && i !== n - 1) return;
    if (i === n - 1 && i % every !== 0 && (n - 1) % every < every * 0.6) return;
    const t = svgEl('text', { x: M.left + i * band + band / 2, y: height - M.bottom + 15, 'text-anchor': 'middle' }, xg);
    t.textContent = d.label;
  });

  if (o.ref) {
    const y = yScale(o.ref.value);
    svgEl('line', { x1: M.left, x2: width - M.right, y1: y, y2: y, stroke: 'var(--ink-2)', 'stroke-width': 1.5 }, svg);
    if (o.ref.label) {
      const t = svgEl('text', { x: width - M.right, y: y - 5, 'text-anchor': 'end', fill: 'var(--ink-2)' }, svg);
      t.style.fill = 'var(--ink-2)';
      t.textContent = o.ref.label;
    }
  }

  if (o.expected && o.expectedStyle === 'line') {
    const pts = o.expected.map((v, i) => `${M.left + i * band + band / 2},${yScale(Math.min(v, yTop))}`);
    svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  } else if (o.expected) {
    // one short marker per bar: honest for sparse supports, where a connecting line would invent slopes
    const tw = Math.max(3, Math.min(band - gap, bw + 8));
    o.expected.forEach((v, i) => {
      if (!(v > 0)) return;
      const cx = M.left + i * band + band / 2, y = yScale(Math.min(v, yTop));
      svgEl('line', { x1: cx - tw / 2, x2: cx + tw / 2, y1: y, y2: y, stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    });
  }

  // hit targets: whole band, full height
  const hits = svgEl('g', {}, svg);
  o.data.forEach((d, i) => {
    const hx = M.left + i * band;
    const r = svgEl('rect', { class: 'hit', x: hx, y: M.top, width: band, height: innerH }, hits);
    if (n <= 40) { r.setAttribute('tabindex', '0'); r.setAttribute('aria-label', `${d.label}: ${yFmt(d.value)}`); }
    const enter = () => {
      barEls.forEach((b, j) => b.classList.toggle('dim', j !== i));
      const exp = o.expected ? ` · ${o.expectedLabel ?? 'expected'} ${yFmt(o.expected[i])}` : '';
      const px = ((hx + band / 2) / width) * el.clientWidth;
      const py = (yScale(d.value) / height) * el.querySelector('svg').clientHeight + (el.querySelector('.legend')?.offsetHeight ?? 0);
      showTip(el, tip, px, py, d.tip ?? yFmt(d.value), `${o.xLabel ? o.xLabel + ' ' : ''}${d.label}${exp}`);
    };
    const leave = () => { barEls.forEach((b) => b.classList.remove('dim')); hideTip(tip); };
    r.addEventListener('pointerenter', enter);
    r.addEventListener('focus', enter);
    r.addEventListener('pointerleave', leave);
    r.addEventListener('blur', leave);
  });

  el.appendChild(svg);
}

/**
 * Scatter plot with nearest-point hover.
 * opts: { points: [{x, y, label?}], xDomain, yDomain, xLabel, yLabel, color, height, r, table? }
 */
export function scatterChart(el, opts) {
  mount(el, opts, renderScatter);
}

function renderScatter(el, o, width, tip) {
  const height = o.height ?? 260;
  const color = o.color ?? 'var(--series-1)';
  const [x0, x1] = o.xDomain;
  const [y0, y1] = o.yDomain;
  const fmt = o.fmt ?? defaultFmt;
  const yT = ticks(y0, y1, 4).filter((t) => t >= y0 && t <= y1);
  const M = margins(yT.map(fmt));
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const xs = (v) => M.left + ((v - x0) / (x1 - x0 || 1)) * innerW;
  const ys = (v) => M.top + innerH - ((v - y0) / (y1 - y0 || 1)) * innerH;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': o.ariaLabel ?? 'scatter plot' });
  axes(svg, { M, width, height, yTicks: yT, yScale: ys, yFmt: fmt, xLabel: o.xLabel, yLabel: o.yLabel });
  const xg = svgEl('g', {}, svg);
  for (const t of ticks(x0, x1, Math.max(3, Math.floor(innerW / 80)))) {
    if (t < x0 || t > x1) continue;
    const tx = svgEl('text', { x: xs(t), y: height - M.bottom + 15, 'text-anchor': 'middle' }, xg);
    tx.textContent = fmt(t);
  }

  const pts = o.points;
  const r = o.r ?? (pts.length > 1500 ? 1.6 : pts.length > 300 ? 2.6 : 4);
  const g = svgEl('g', {}, svg);
  const screen = pts.map((p) => [xs(p.x), ys(p.y)]);
  screen.forEach(([cx, cy]) => {
    svgEl('circle', { cx, cy, r, fill: color, stroke: pts.length > 300 ? 'none' : 'var(--surface)', 'stroke-width': 1.5 }, g);
  });

  const ring = svgEl('circle', { r: r + 4, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5, opacity: 0 }, svg);
  const overlay = svgEl('rect', { class: 'hit', x: M.left, y: M.top, width: innerW, height: innerH }, svg);
  overlay.addEventListener('pointermove', (ev) => {
    const box = svg.getBoundingClientRect();
    const sx = ((ev.clientX - box.left) / box.width) * width;
    const sy = ((ev.clientY - box.top) / box.height) * height;
    let best = -1, bd = Infinity;
    for (let i = 0; i < screen.length; i++) {
      const d = (screen[i][0] - sx) ** 2 + (screen[i][1] - sy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || bd > 900) { ring.setAttribute('opacity', 0); hideTip(tip); return; }
    const [cx, cy] = screen[best];
    ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('opacity', 1);
    const p = pts[best];
    showTip(el, tip, (cx / width) * box.width, (cy / height) * box.height, p.label ?? `(${fmt(p.x)}, ${fmt(p.y)})`,
      `${o.xLabel ?? 'x'} ${fmt(p.x)} · ${o.yLabel ?? 'y'} ${fmt(p.y)}`);
  });
  overlay.addEventListener('pointerleave', () => { ring.setAttribute('opacity', 0); hideTip(tip); });

  el.appendChild(svg);
}
