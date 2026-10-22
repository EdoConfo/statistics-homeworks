// Small DOM helpers shared by the Homework 2 page modules.

export const $ = (id) => document.getElementById(id);

export function tile(label, value, sub, cls) {
  const t = document.createElement('div');
  t.className = cls ? `tile ${cls}` : 'tile';
  const a = document.createElement('div'); a.className = 't-label'; a.textContent = label;
  const b = document.createElement('div'); b.className = 't-value'; b.textContent = value;
  t.append(a, b);
  if (sub) { const c = document.createElement('div'); c.className = 't-sub'; c.textContent = sub; t.appendChild(c); }
  return t;
}

/** Console writer: lines are arrays of [text, className?] segments. */
export function writeConsole(pre, lines) {
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

// Yield to the event loop through a MessageChannel: unlike setTimeout it is not
// throttled to ~1 s when the tab is in the background.
export const yieldToBrowser = () => new Promise((r) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => r();
  ch.port2.postMessage(0);
});

/** Run `start` once, the first time the element scrolls near the viewport. */
export function whenVisible(el, start) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: '200px' });
  io.observe(el);
}

/** A large number as its first and last 8 hex digits (short numbers in full). */
export const shortHex = (v) => {
  const h = v.toString(16);
  return h.length <= 24 ? h : `${h.slice(0, 8)}…${h.slice(-8)}`;
};

export const shortPoint = (P) => `(${shortHex(P.x)}, ${shortHex(P.y)})`;

export const group = (v) => v.toLocaleString('en-US');

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·' };
export const sup = (s) => String(s).replace(/[0-9.-]/g, (c) => SUP[c]);

/** Large positive numbers in scientific notation: 3.4 × 10³⁸. */
export function sci(v, digits = 2) {
  if (v < 1e6) return group(Math.round(v));
  const e = Math.floor(Math.log10(v));
  return `${(v / 10 ** e).toFixed(digits - 1)} × 10${sup(e)}`;
}

/** Seconds as a readable duration, from milliseconds to astronomically many years. */
export function duration(s) {
  if (s < 1e-3) return '< 1 ms';
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  if (s < 3600) return `${(s / 60).toFixed(0)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  const days = s / 86400;
  if (days < 365) return `${days.toFixed(0)} days`;
  const years = days / 365.25;
  return years < 1e6 ? `${group(Math.round(years))} years` : `${sci(years)} years`;
}
