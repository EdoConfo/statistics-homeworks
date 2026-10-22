// Homework 2 sections 04-05: recovering the Caesar key from letter statistics, and how it depends on length.
import {
  buildModel, crack, encrypt, decrypt, letters, letterCounts, METHODS, ALPHABET, lengthExperiment,
} from './caesar.js';
import { TRAIN, TEST, SAMPLES } from './corpus.js';
import { barChart, lineChart } from '../assets/js/charts.js?v=3';
import { $, tile, yieldToBrowser, whenVisible, group, stage } from './ui.js';

const model = buildModel(TRAIN);
const COLORS = { top: 'var(--series-4)', chi: 'var(--series-1)', bigram: 'var(--series-3)', words: 'var(--series-7)' };
const LENGTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100];
const PREVIEW = 44;

const pct = (x, d = 1) => `${(100 * x).toFixed(d)}%`;
const preview = (s) => (s.length > PREVIEW ? s.slice(0, PREVIEW) + '…' : s);
const randomKey = () => 1 + Math.floor(Math.random() * 25);
const letterTicks = () => (window.innerWidth < 600 ? 2 : 1);   // 26 labels fit one per bar only on wide screens

// ---- 04 the attack ----------------------------------------------------------------

const state = { K: randomKey() };

function renderCorpus() {
  const words = TRAIN.reduce((s, t) => s + (t.match(/[A-Za-z']+/g) ?? []).length, 0);
  $('a-corpus-sub').textContent = `${TRAIN.length} passages · ${group(model.letters)} letters · ${group(words)} words, ` +
    `${group(model.vocab.size)} distinct · index of coincidence ${model.ic.toFixed(4)}`;
  barChart($('a-corpus'), {
    data: model.freq.map((f, i) => ({ label: ALPHABET[i], value: 100 * f, tip: `${(100 * f).toFixed(2)}%` })),
    height: 220, yLabel: '% of letters', yFmt: (v) => `${+v.toFixed(1)}%`, xTickEvery: letterTicks(),
    table: { headers: ['Letter', 'Frequency', 'Count'], rows: model.freq.map((f, i) => [ALPHABET[i], `${(100 * f).toFixed(2)}%`, model.counts[i]]) },
  });
}

function attack() {
  const plain = $('a-plain').value;
  const K = state.K;
  $('a-key').textContent = `K = ${K}`;
  const ct = encrypt(plain, K);
  $('a-cipher').value = ct;

  const xs = letters(ct);
  const res = crack(ct, model);
  $('a-results').replaceChildren(...METHODS.map((m) => {
    const r = res[m.id];
    const ok = r.key === K;
    return tile(m.label, `K = ${r.key} ${ok ? '✓' : '✗'}`, preview(decrypt(ct, r.key)), ok ? 'ok' : 'fail');
  }));

  const chiKey = res.chi.key;
  stage('chi', `K = ${chiKey} ${chiKey === K ? '✓' : '✗'}  (secret K = ${K})`);
  $('a-chi-sub').textContent = `${xs.length} ciphertext letters · log scale · lowest at K = ${chiKey}${chiKey === K ? ', the right key' : `, the right key is ${K}`}`;
  // log scale: the right key's χ² is often a hundred times smaller than the others and would vanish on a linear axis
  barChart($('a-chi'), {
    data: res.chi.scores.map((v, k) => ({
      label: String(k), value: Math.log10(Math.max(1, v)), color: k === chiKey ? 'var(--series-2)' : undefined, tip: `χ² = ${v.toFixed(1)}`,
    })),
    height: 220, xLabel: 'K', yLabel: 'log₁₀ χ²', xTickEvery: window.innerWidth < 600 ? 5 : 1,
    table: { headers: ['K', 'χ²'], rows: res.chi.scores.map((v, k) => [k, v.toFixed(1)]) },
  });

  const counts = letterCounts(xs);
  $('a-fit-sub').textContent = `bars: ciphertext · marks: expected counts if the key is ${chiKey}`;
  barChart($('a-fit'), {
    data: counts.map((v, i) => ({ label: ALPHABET[i], value: v })), height: 220, yLabel: 'count', xTickEvery: letterTicks(),
    expected: counts.map((_, i) => xs.length * model.freq[(i - chiKey + 26) % 26]),
    observedLabel: 'ciphertext', expectedLabel: `English shifted by ${chiKey}`,
  });

  const tbody = $('a-cands').querySelector('tbody');
  tbody.replaceChildren(...res.chi.scores.map((chi, k) => {
    const tr = document.createElement('tr');
    if (k === chiKey) tr.className = 'best';
    const cells = [k, chi.toFixed(1), res.bigram.scores[k].toFixed(1), res.words.scores[k], preview(decrypt(ct, k))];
    cells.forEach((c, i) => {
      const td = tr.insertCell();
      td.textContent = c;
      if (i < 4) td.className = 'num';
    });
    return tr;
  }));
}

function initAttack() {
  const sel = $('a-sample');
  for (const [id, s] of Object.entries(SAMPLES)) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = s.label;
    sel.appendChild(o);
  }
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Your own text';
  sel.appendChild(custom);

  sel.addEventListener('change', () => {
    if (sel.value !== 'custom') $('a-plain').value = SAMPLES[sel.value].text;
    attack();
  });
  $('a-plain').addEventListener('input', () => { sel.value = 'custom'; attack(); });
  $('a-new-key').addEventListener('click', () => {
    let K;
    do K = randomKey(); while (K === state.K);
    state.K = K;
    attack();
  });
  $('a-plain').value = SAMPLES.english.text;
  attack();
}

// ---- 05 success against length --------------------------------------------------------

let runs = 0, running = false;

async function runLength() {
  if (running) return;
  running = true;
  $('l-run').disabled = true;
  try {
    const trials = Math.max(50, Math.min(5000, Math.floor(Number($('l-trials').value) || 400)));
    $('l-trials').value = trials;
    const seed = runs++ === 0 ? 1 : (Math.random() * 2 ** 32) >>> 0;   // the first run is reproducible
    const rows = [];
    for (const [i, len] of LENGTHS.entries()) {
      $('l-status').textContent = `Length ${len}: ${group(trials)} ciphertexts…`;
      await yieldToBrowser();
      rows.push(...lengthExperiment(model, TEST, [len], trials, seed + i));
    }
    $('l-status').textContent = `${group(trials * LENGTHS.length)} ciphertexts from the held-out text, seed ${seed}.`;

    const rate = (r, id) => r.hits[id] / r.trials;
    $('l-sub').textContent = `share of ${group(trials)} random ciphertexts per length whose key is recovered exactly · chance level 1/25 = 4%`;
    lineChart($('l-chart'), {
      xLabels: LENGTHS.map(String),
      series: METHODS.map((m) => ({ label: m.label, color: COLORS[m.id], values: rows.map((r) => 100 * rate(r, m.id)) })),
      yMin: 0, yMax: 100, yFmt: (v) => `${+v.toFixed(1)}%`, xLabel: 'letters', yLabel: 'key recovered', height: 300,
      table: {
        headers: ['Letters', ...METHODS.map((m) => m.label)],
        rows: rows.map((r) => [r.n, ...METHODS.map((m) => pct(rate(r, m.id)))]),
      },
    });

    // the shortest length from which a method stays at 95% or more
    $('l-tiles').replaceChildren(...METHODS.map((m) => {
      let from = null;
      for (let i = rows.length - 1; i >= 0 && rate(rows[i], m.id) >= 0.95; i--) from = rows[i].n;
      const at20 = rows.find((r) => r.n === 20);
      return tile(m.label, from === null ? 'never ≥ 95%' : `≥ 95% from ${from} letters`, `at 20 letters: ${pct(rate(at20, m.id))}`);
    }));
  } finally {
    running = false;
    $('l-run').disabled = false;
  }
}

export function initCryptanalysis() {
  renderCorpus();
  initAttack();
  $('l-run').addEventListener('click', runLength);
  whenVisible($('length'), runLength);
}
