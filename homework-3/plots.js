// Charts for Homework 3: one x–y chart with linear or log axes that draws lines, dots, bands and histogram bars,
// an optional canvas layer for thousands of trajectories, and an optional histogram turned sideways on the right.
// Same look as assets/js/charts.js (shared CSS classes, tooltip, data table), re-rendered on resize and theme change.

const NS = 'http://www.w3.org/2000/svg';
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export const pow10 = (k) => (k === 0 ? '1' : k === 1 ? '10' : '10' + String(k).replace(/[0-9-]/g, (c) => SUP[c]));

export function fmtNum(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const k = Math.floor(Math.log10(a));
    const c = +(v / 10 ** k).toPrecision(2);
    return c === 1 ? pow10(k) : c === -1 ? '−' + pow10(k) : `${c} × ${pow10(k)}`;
  }
  if (a >= 1000) return Math.round(v).toLocaleString('en-US');
  return String(+v.toPrecision(3)).replace('-', '−');
}

function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function linearTicks(lo, hi, target) {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

function logTicks(lo, hi, target) {
  const a = Math.ceil(Math.log10(lo) - 1e-9), b = Math.floor(Math.log10(hi) + 1e-9);
  const every = Math.max(1, Math.ceil((b - a + 1) / Math.max(2, target)));
  const out = [];
  for (let k = a; k <= b; k++) if ((k - a) % every === 0) out.push(10 ** k);
  return out;
}

function scale(axis, from, to) {
  const [d0, d1] = axis.domain;
  if (axis.log) {
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    return (v) => from + ((Math.log10(v) - l0) / (l1 - l0)) * (to - from);
  }
  return (v) => from + ((v - d0) / (d1 - d0 || 1)) * (to - from);
}

const axisFmt = (axis) => axis.fmt ?? (axis.log ? (v) => pow10(Math.round(Math.log10(v))) : fmtNum);

function legend(items) {
  const box = document.createElement('div');
  box.className = 'legend';
  for (const it of items) {
    const k = document.createElement('span');
    k.className = 'key';
    const sw = document.createElement('span');
    sw.className = it.kind === 'bars' || it.kind === 'band' ? 'swatch' : it.kind === 'dots' ? 'swatch dot' : it.dash ? 'linekey dashed' : 'linekey';
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
  const head = t.createTHead().insertRow();
  headers.forEach((h, i) => {
    const th = document.createElement('th');
    th.textContent = h;
    if (i > 0) th.className = 'num';
    head.appendChild(th);
  });
  const body = t.createTBody();
  for (const r of rows) {
    const tr = body.insertRow();
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

const cssVar = (el, value) => {
  const m = /^var\((--[\w-]+)\)$/.exec(value);
  return m ? getComputedStyle(el).getPropertyValue(m[1]).trim() : value;
};

// ---- mounting: redraw on width change and on theme change (the canvas does not follow CSS variables) ----

const mounted = new Set();
function redrawAll() { for (const el of mounted) if (el.isConnected) draw(el); else mounted.delete(el); }
if (typeof window !== 'undefined') {
  window.addEventListener('themechange', () => requestAnimationFrame(redrawAll));
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => requestAnimationFrame(redrawAll));
}

/**
 * x–y chart.
 * opts: { height, x: {domain, log?, label?, fmt?, ticks?}, y: {domain, log?, label?, fmt?, ticks?, hidden?},
 *         series: [{ kind: 'line'|'dots'|'band'|'bars'|'vline'|'hline', label?, color, points?, lo?, hi?, bars?, value?, dash?, width?, r?, legend? }],
 *         paths?: { xs, list: Int32Array[], y: (s, i) => number, from?, color, label?, highlight?: { index, color, label } },
 *         side?: { bars: [{y0, y1, value}], curve?: [[y, value]], color, label? },
 *         hover?: { xs: number[], text: (i) => ({ title, lines }) }, table?, legend?: boolean, compact?: boolean, ariaLabel? }
 */
export function xyChart(el, opts) {
  el.classList.add('chart', 'xy');
  el._xy = opts;
  mounted.add(el);
  draw(el);
  if (!el._xyObserver) {
    let lastW = el.clientWidth;
    el._xyObserver = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - lastW) > 2) { lastW = el.clientWidth; draw(el); }
    });
    el._xyObserver.observe(el);
  }
}

function draw(el) {
  const o = el._xy;
  el.replaceChildren();
  const width = Math.max(200, el.clientWidth || 600);
  const height = o.height ?? 260;
  const xFmt = axisFmt(o.x), yFmt = axisFmt(o.y);
  const yT = o.y.hidden ? [] : (o.y.ticks ?? (o.y.log ? logTicks(...o.y.domain, 5) : linearTicks(...o.y.domain, o.compact ? 3 : 4)));
  const yLabelW = Math.max(0, ...yT.map((t) => yFmt(t).length * 6.4));
  const sideW = o.side ? Math.min(90, Math.max(48, width * 0.16)) : 0;
  const M = o.compact
    ? { top: 8, right: 8, bottom: o.x.label ? 34 : 22, left: o.y.hidden ? 8 : 18 + yLabelW }
    : { top: 12, right: 14 + (sideW ? sideW + 10 : 0), bottom: 40, left: Math.max(40, (o.y.label ? 26 : 12) + yLabelW) };
  const innerW = width - M.left - M.right, innerH = height - M.top - M.bottom;
  const xs = scale(o.x, M.left, M.left + innerW), ys = scale(o.y, M.top + innerH, M.top);
  const clampY = (v) => Math.max(M.top - 2, Math.min(M.top + innerH + 2, v));

  const keyed = o.series.filter((s) => s.label && s.legend !== false);
  if (o.legend !== false && (keyed.length || o.paths?.label)) {
    const items = [];
    if (o.paths?.label) items.push({ label: o.paths.label, color: o.paths.color, kind: 'line' });
    if (o.paths?.highlight?.label) items.push({ label: o.paths.highlight.label, color: o.paths.highlight.color, kind: 'line' });
    el.appendChild(legend([...items, ...keyed]));
  }

  const stage = document.createElement('div');
  stage.className = 'xy-stage';
  el.appendChild(stage);
  const view = { viewBox: `0 0 ${width} ${height}` };
  const back = svgEl('svg', { ...view, role: 'img', 'aria-label': o.ariaLabel ?? 'chart' });
  stage.appendChild(back);

  // grid and axes
  for (const t of yT) {
    const y = ys(t);
    svgEl('line', { class: 'gridline', x1: M.left, x2: M.left + innerW, y1: y, y2: y }, back);
    svgEl('text', { x: M.left - 8, y: y + 3.5, 'text-anchor': 'end', 'font-variant-numeric': 'tabular-nums' }, back).textContent = yFmt(t);
  }
  const xT = o.x.ticks ?? (o.x.log ? logTicks(...o.x.domain, innerW / 60) : linearTicks(...o.x.domain, o.compact ? 4 : Math.max(2, Math.floor(innerW / 80))));
  for (const t of xT) {
    if (t < o.x.domain[0] - 1e-12 || t > o.x.domain[1] + 1e-12) continue;
    svgEl('text', { x: xs(t), y: M.top + innerH + 15, 'text-anchor': 'middle', 'font-variant-numeric': 'tabular-nums' }, back).textContent = xFmt(t);
    if (o.x.grid) svgEl('line', { class: 'gridline', x1: xs(t), x2: xs(t), y1: M.top, y2: M.top + innerH }, back);
  }
  const baseY = o.y.log ? M.top + innerH : Math.min(M.top + innerH, Math.max(M.top, ys(Math.max(o.y.domain[0], Math.min(0, o.y.domain[1])))));
  svgEl('line', { class: 'baseline', x1: M.left, x2: M.left + innerW, y1: M.top + innerH, y2: M.top + innerH }, back);
  if (o.x.label) {
    svgEl('text', { class: 'axis-title', x: M.left + innerW / 2, y: height - 4, 'text-anchor': 'middle' }, back).textContent = o.x.label;
  }
  if (o.y.label && !o.compact) {
    svgEl('text', { class: 'axis-title', transform: `translate(11 ${M.top + innerH / 2}) rotate(-90)`, 'text-anchor': 'middle' }, back).textContent = o.y.label;
  }

  // trajectories on a canvas between the grid and the overlays
  if (o.paths) {
    const canvas = document.createElement('canvas');
    canvas.className = 'xy-canvas';
    stage.appendChild(canvas);
    requestAnimationFrame(() => paintPaths(canvas, back, o.paths, { M, width, innerW, innerH, xs, ys }));
  }

  const front = svgEl('svg', { ...view, class: 'xy-front', 'aria-hidden': 'true' });
  stage.appendChild(front);
  const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
  svgEl('rect', { x: M.left, y: M.top - 1, width: innerW, height: innerH + 2 }, svgEl('clipPath', { id: clipId }, svgEl('defs', {}, front)));
  const plot = svgEl('g', { 'clip-path': `url(#${clipId})` }, front);

  for (const s of o.series) {
    const dash = s.dash ? { 'stroke-dasharray': s.dash === true ? '5 4' : s.dash } : {};
    if (s.kind === 'bars') {
      for (const b of s.bars) {
        const x0 = xs(b.x0), x1 = xs(b.x1), y = ys(b.y);
        const w = Math.max(0.8, x1 - x0 - (x1 - x0 > 5 ? 1 : 0));
        svgEl('rect', { x: x0 + (x1 - x0 - w) / 2, y: Math.min(y, baseY), width: w, height: Math.max(0, Math.abs(baseY - y)), fill: s.color, opacity: s.opacity ?? 1 }, plot);
      }
    } else if (s.kind === 'band') {
      const pts = [...s.hi.map(([x, y]) => `${xs(x)},${clampY(ys(y))}`), ...[...s.lo].reverse().map(([x, y]) => `${xs(x)},${clampY(ys(y))}`)];
      svgEl('polygon', { points: pts.join(' '), fill: s.color, opacity: s.opacity ?? 0.14 }, plot);
    } else if (s.kind === 'line') {
      svgEl('polyline', {
        points: s.points.map(([x, y]) => `${xs(x)},${clampY(ys(y))}`).join(' '),
        fill: 'none', stroke: s.color, 'stroke-width': s.width ?? 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...dash,
      }, plot);
    } else if (s.kind === 'dots') {
      for (const [x, y] of s.points) {
        if (!(y > 0) && o.y.log) continue;
        svgEl('circle', { cx: xs(x), cy: ys(y), r: s.r ?? 3.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 1.5 }, front);
      }
    } else if (s.kind === 'vline') {
      svgEl('line', { x1: xs(s.value), x2: xs(s.value), y1: M.top, y2: M.top + innerH, stroke: s.color, 'stroke-width': s.width ?? 1.5, ...dash }, plot);
    } else if (s.kind === 'hline') {
      const y = ys(s.value);
      svgEl('line', { x1: M.left, x2: M.left + innerW, y1: y, y2: y, stroke: s.color, 'stroke-width': s.width ?? 1.5, ...dash }, plot);
      if (s.note) {
        const t = svgEl('text', { x: M.left + innerW - 4, y: y - 5, 'text-anchor': 'end' }, front);
        t.style.fill = s.color;
        t.textContent = s.note;
      }
    }
  }

  // histogram turned sideways, sharing the y axis
  if (o.side) {
    const x0 = M.left + innerW + 10, maxV = Math.max(...o.side.bars.map((b) => b.value), ...(o.side.curve ?? []).map((c) => c[1])) || 1;
    const sx = (v) => x0 + (v / maxV) * sideW;
    const g = svgEl('g', { 'clip-path': `url(#${clipId}-side)` }, front);
    svgEl('rect', { x: x0, y: M.top - 1, width: sideW + 2, height: innerH + 2 }, svgEl('clipPath', { id: `${clipId}-side` }, front.querySelector('defs')));
    svgEl('line', { class: 'baseline', x1: x0, x2: x0, y1: M.top, y2: M.top + innerH }, back);
    for (const b of o.side.bars) {
      const yTop = ys(b.y1), yBot = ys(b.y0);
      const h = Math.max(0.8, Math.abs(yBot - yTop) - (Math.abs(yBot - yTop) > 5 ? 1 : 0));
      svgEl('rect', { x: x0, y: (yTop + yBot) / 2 - h / 2, width: Math.max(0, sx(b.value) - x0), height: h, fill: o.side.color }, g);
    }
    if (o.side.curve) {
      svgEl('polyline', {
        points: o.side.curve.filter(([, v]) => v > maxV * 0.004).map(([y, v]) => `${sx(v)},${ys(y)}`).join(' '),
        fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
      }, g);
    }
    if (o.side.label) {
      svgEl('text', { class: 'axis-title', x: x0 + sideW / 2, y: height - 4, 'text-anchor': 'middle' }, back).textContent = o.side.label;
    }
  }

  if (o.hover) hover(el, front, o, { M, width, height, innerW, innerH, xs });
  if (o.table) el.appendChild(dataTable(o.table));
}

function paintPaths(canvas, svg, P, { M, width, innerW, innerH, xs, ys }) {
  const box = svg.getBoundingClientRect();
  if (!box.width) return;
  const k = box.width / width;   // CSS pixels per viewBox unit
  const dpr = window.devicePixelRatio || 1;
  Object.assign(canvas.style, { left: `${M.left * k}px`, top: `${M.top * k}px`, width: `${innerW * k}px`, height: `${innerH * k}px` });
  canvas.width = Math.round(innerW * k * dpr);
  canvas.height = Math.round(innerH * k * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(k * dpr, k * dpr);
  ctx.translate(-M.left, -M.top);
  ctx.lineJoin = 'round';
  const px = Array.from(P.xs, xs);
  const from = P.from ?? 0;
  const line = (path, color, alpha, w) => {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = from; i < path.length; i++) {
      const y = ys(P.y(path[i], i));
      if (i > from) ctx.lineTo(px[i], y); else ctx.moveTo(px[i], y);
    }
    ctx.stroke();
  };
  const color = cssVar(canvas, P.color);
  const alpha = P.alpha ?? Math.min(0.85, Math.max(0.06, 2.4 / Math.sqrt(P.list.length)));
  for (const path of P.list) line(path, color, alpha, P.list.length > 300 ? 0.8 : 1.1);
  if (P.highlight) line(P.list[P.highlight.index ?? 0], cssVar(canvas, P.highlight.color), 1, 1.8);
}

function hover(el, front, o, { M, innerW, innerH, xs }) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  el.appendChild(tip);
  const guide = svgEl('line', { y1: M.top, y2: M.top + innerH, stroke: 'var(--ink-2)', 'stroke-width': 1, opacity: 0 }, front);
  const hit = svgEl('rect', { class: 'hit', x: M.left, y: M.top, width: innerW, height: innerH }, front);
  const px = o.hover.xs.map(xs);
  const move = (clientX) => {
    const box = front.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * front.viewBox.baseVal.width;
    let best = 0;
    for (let i = 1; i < px.length; i++) if (Math.abs(px[i] - sx) < Math.abs(px[best] - sx)) best = i;
    guide.setAttribute('x1', px[best]); guide.setAttribute('x2', px[best]); guide.setAttribute('opacity', 0.6);
    const { title, lines } = o.hover.text(best);
    tip.replaceChildren();
    const s = document.createElement('strong');
    s.textContent = title;
    tip.appendChild(s);
    for (const l of lines) { const d = document.createElement('div'); d.textContent = l; tip.appendChild(d); }
    tip.classList.add('show');
    const offTop = front.getBoundingClientRect().top - el.getBoundingClientRect().top;
    const x = (px[best] / front.viewBox.baseVal.width) * box.width;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, x + 14), el.clientWidth - tw)}px`;
    if (x + 14 + tw > el.clientWidth) tip.style.left = `${Math.max(0, x - 14 - tw)}px`;
    tip.style.top = `${offTop + 4}px`;
  };
  const leave = () => { guide.setAttribute('opacity', 0); tip.classList.remove('show'); };
  hit.addEventListener('pointermove', (e) => move(e.clientX));
  hit.addEventListener('pointerleave', leave);
}
