// Caesar cipher and its statistical cryptanalysis.
//
// The key K is the shift: encryption maps letter x to (x + K) mod 26, decryption to (x - K) mod 26.
// Case is kept and everything that is not a letter A-Z passes through unchanged, so word breaks stay visible.

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const E = 4;

/** Shift every letter by K places (K may be negative). */
export function shift(text, K) {
  K = ((K % 26) + 26) % 26;
  let out = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) out += String.fromCharCode(65 + ((c - 65 + K) % 26));
    else if (c >= 97 && c <= 122) out += String.fromCharCode(97 + ((c - 97 + K) % 26));
    else out += ch;
  }
  return out;
}

export const encrypt = (text, K) => shift(text, K);
export const decrypt = (text, K) => shift(text, -K);

/** The letters of a text as numbers 0..25 (A = 0); everything else is dropped. */
export function letters(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i) & ~0x20;   // fold lower case onto upper case
    if (c >= 65 && c <= 90) out.push(c - 65);
  }
  return out;
}

export const words = (text) => text.toUpperCase().match(/[A-Z]+/g) ?? [];

export function letterCounts(xs) {
  const c = new Array(26).fill(0);
  for (const x of xs) c[x]++;
  return c;
}

/** Probability that two letters drawn without replacement are equal: ≈ 0.066 for English, 1/26 ≈ 0.038 for uniform text. */
export function indexOfCoincidence(counts) {
  let n = 0, s = 0;
  for (const c of counts) { n += c; s += c * (c - 1); }
  return n > 1 ? s / (n * (n - 1)) : NaN;
}

/**
 * Statistics of the known language, learned from a corpus: letter frequencies, a bigram model
 * P(next letter | letter) with add-one smoothing (an unseen pair is rare, not impossible) and the word list.
 */
export function buildModel(texts) {
  const counts = new Array(26).fill(0);
  const pairs = new Array(26 * 26).fill(0);
  const vocab = new Set();
  for (const t of texts) {
    const xs = letters(t);
    for (let i = 0; i < xs.length; i++) {
      counts[xs[i]]++;
      if (i > 0) pairs[xs[i - 1] * 26 + xs[i]]++;
    }
    for (const w of words(t)) vocab.add(w);
  }
  const N = counts.reduce((s, c) => s + c, 0);
  const freq = counts.map((c) => c / N);
  const logFreq = freq.map(Math.log);
  const logNext = new Float64Array(26 * 26);
  for (let a = 0; a < 26; a++) {
    let row = 0;
    for (let b = 0; b < 26; b++) row += pairs[a * 26 + b];
    for (let b = 0; b < 26; b++) logNext[a * 26 + b] = Math.log((pairs[a * 26 + b] + 1) / (row + 26));
  }
  return { counts, letters: N, freq, logFreq, pairs, logNext, vocab, ic: indexOfCoincidence(counts) };
}

// ---- key recovery ---------------------------------------------------------------
// Every method gives each candidate key K = 0..25 a score and keeps the best one.
// Ties go to the smallest K.

function best(scores, lowerIsBetter) {
  let k = 0;
  for (let i = 1; i < scores.length; i++) {
    if (lowerIsBetter ? scores[i] < scores[k] : scores[i] > scores[k]) k = i;
  }
  return k;
}

/** Pearson's χ² distance between the letters decrypted with K and the language's letter frequencies. */
export function chiSquareScores(xs, model) {
  const c = letterCounts(xs);
  const n = xs.length;
  const scores = [];
  for (let K = 0; K < 26; K++) {
    let s = 0;
    for (let i = 0; i < 26; i++) {
      const e = n * model.freq[i];
      s += (c[(i + K) % 26] - e) ** 2 / e;
    }
    scores.push(s);
  }
  return scores;
}

/** Log-likelihood of the decrypted letters under the bigram model: log P(x₁) + Σ log P(xₜ₊₁ | xₜ). */
export function bigramScores(xs, model) {
  const scores = [];
  for (let K = 0; K < 26; K++) {
    if (!xs.length) { scores.push(0); continue; }
    let prev = (xs[0] - K + 26) % 26;
    let s = model.logFreq[prev];
    for (let i = 1; i < xs.length; i++) {
      const cur = (xs[i] - K + 26) % 26;
      s += model.logNext[prev * 26 + cur];
      prev = cur;
    }
    scores.push(s);
  }
  return scores;
}

/** Number of letters that fall in dictionary words once the text is decrypted with K. */
export function wordScores(text, model) {
  const ws = words(text);
  const scores = [];
  for (let K = 0; K < 26; K++) {
    let s = 0;
    for (const w of ws) if (model.vocab.has(shift(w, -K))) s += w.length;
    scores.push(s);
  }
  return scores;
}

/** How many ciphertext letters would decrypt to E with key K: the "most frequent letter is E" rule. */
export function topLetterScores(xs) {
  const c = letterCounts(xs);
  return Array.from({ length: 26 }, (_, K) => c[(E + K) % 26]);
}

export const METHODS = [
  { id: 'top', label: 'Most frequent letter is E', lowerIsBetter: false, scores: (text, xs) => topLetterScores(xs) },
  { id: 'chi', label: 'χ² on letter frequencies', lowerIsBetter: true, scores: (text, xs, model) => chiSquareScores(xs, model) },
  { id: 'bigram', label: 'Bigram log-likelihood', lowerIsBetter: false, scores: (text, xs, model) => bigramScores(xs, model) },
  { id: 'words', label: 'Exhaustive search + word list', lowerIsBetter: false, scores: (text, xs, model) => wordScores(text, model) },
];

/** Run every method on a ciphertext. */
export function crack(ciphertext, model) {
  const xs = letters(ciphertext);
  const out = {};
  for (const m of METHODS) {
    const scores = m.scores(ciphertext, xs, model);
    out[m.id] = { key: best(scores, m.lowerIsBetter), scores };
  }
  return out;
}

// ---- experiments ------------------------------------------------------------------

/** Small seeded PRNG (mulberry32), so an experiment can be repeated exactly. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A piece of text that starts at a word and holds exactly `n` letters. */
export function sampleText(texts, n, rand) {
  for (;;) {
    const t = texts[Math.floor(rand() * texts.length)];
    const starts = [0];
    for (let i = 1; i < t.length; i++) if (/[A-Za-z]/.test(t[i]) && !/[A-Za-z']/.test(t[i - 1])) starts.push(i);
    let i = starts[Math.floor(rand() * starts.length)], got = 0, out = '';
    for (; i < t.length && got < n; i++) {
      out += t[i];
      if (/[A-Za-z]/.test(t[i])) got++;
    }
    if (got === n) return out;
  }
}

/**
 * Success rate of each method against ciphertext length: `trials` random pieces of text per length,
 * each encrypted with a random key in 1..25.
 */
export function lengthExperiment(model, texts, lengths, trials, seed = 1) {
  const rand = rng(seed);
  return lengths.map((n) => {
    const hits = Object.fromEntries(METHODS.map((m) => [m.id, 0]));
    for (let t = 0; t < trials; t++) {
      const K = 1 + Math.floor(rand() * 25);
      const res = crack(encrypt(sampleText(texts, n, rand), K), model);
      for (const m of METHODS) if (res[m.id].key === K) hits[m.id]++;
    }
    return { n, trials, hits };
  });
}
