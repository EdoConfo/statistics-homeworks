# Statistics Homeworks · MSc Cybersecurity

Interactive homework pages for the **Statistics** course: cryptographic primitives analysed with statistical tools.

**Live site:** https://edoconfo.github.io/statistics-homeworks/

| Part | Title | What's inside |
|---|----------|---------------|
| Homework 1 · Part 1 | [Example App: Public-Key Cryptography PRIVATE KEY → PUBLIC KEY in Ethereum](https://edoconfo.github.io/statistics-homeworks/homework-1/part-1/) | Point addition and double-and-add on `y² = x³ + 7 (mod 17)`, `G = (1, 5)`, `k = 6 → Q = (5, 8)`. Step-by-step SVG animation, brute-force ECDLP, and statistical exploration: coordinate distributions with χ² tests, bit balance, input/output correlation, avalanche vs SHA-256, structure tests. Discussion of one-way function vs hash properties. |
| Homework 1 · Part 2 | [From Wallet Seed to Ethereum Address: Hashing, Key Derivation and Cryptographic Primitives](https://edoconfo.github.io/statistics-homeworks/homework-1/part-2/) | BIP-39 → BIP-32/BIP-44 → secp256k1 → Keccak-256 → EIP-55, each step classified (generation, derivation, public-key crypto, hashing, checksum, encoding) and run live. Monte Carlo experiments on BIP-39 and EIP-55 checksums, Keccak avalanche, address uniformity. Timeline 1977–2016, SHA-2 vs Keccak/SHA-3, why the pipeline uses several primitives. |
| Homework 2 | [Homework 2](https://edoconfo.github.io/statistics-homeworks/homework-2/) | A message encrypted with a toy EC-ElGamal scheme on secp256k1 (built on the Part 1 code, private key restricted to `[1, 2^B]`) and with the Caesar cipher. Comparison of procedures, key spaces and ciphertext statistics. Caesar key recovery from letter frequencies (χ²) trained on an English corpus, tested on held-out text of different lengths against top-letter, bigram and word-list scoring. Brute-force and baby-step giant-step recovery of the toy private key, scaling to real key sizes, and a discussion of key-space vs design weaknesses. |
| Homework 3 | [Homework 3](https://edoconfo.github.io/statistics-homeworks/homework-3/) | n systems and m attackers: penetration scores as random walks with Bernoulli and Rademacher increments. Simulated trajectories of the total, average and normalized score and their distributions as n grows, the Law of Large Numbers with Chebyshev's bound, the variance under the three normalizations (log–log slopes 1, −1, 0), the Central Limit Theorem in the Rademacher case, and the aggregate score of all attackers as n and m change. |

## Structure

```
index.html                  landing page
assets/                     shared CSS, theme toggle, SVG charts, statistics toolkit
homework-1/
  index.html                redirects to part 1
  part-1/
    ecc.js                  toy curve arithmetic (BigInt), double-and-add with trace
    viz.js                  slow-motion SVG animation
    explore.js              statistical experiments
    cli.js                  terminal version: prints G, 2G, ..., kG
  part-2/
    wallet.js               BIP-39 / BIP-32 / BIP-44 / EIP-55 written out on top of noble primitives
    app.js, experiments.js  live demo and Monte Carlo experiments
homework-2/
  elgamal.js                toy EC-ElGamal on secp256k1 (Koblitz encoding), on top of Part 1's ecc.js
  caesar.js                 Caesar cipher, language model and four key-recovery methods
  attack.js                 brute force and baby-step giant-step in Jacobian coordinates
  corpus.js                 English training corpus and held-out test passages
  app.js, cryptanalysis.js, keyspace.js   page sections
homework-3/
  walks.js                  random walks (xoshiro128**), aggregate scores, normal CDF, Chebyshev bound, lattice histograms
  plots.js                  x–y charts with log axes, a canvas layer for trajectories and side histograms
  app.js                    page sections
tests/                      node:test suites with known-answer vectors
```

No build step: plain HTML, CSS and ES modules. Part 2 imports pinned builds of
[`@noble/hashes`](https://github.com/paulmillr/noble-hashes), [`@noble/curves`](https://github.com/paulmillr/noble-curves)
and the [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) English wordlist through an import map (jsDelivr).
Node uses the same versions from `node_modules`.

## Run locally

```bash
npm install          # only needed for the Part 2 tests
npm test             # 46 tests: toy curve, statistics toolkit, wallet vectors, Caesar, toy EC-ElGamal and attacks, random walks
npm run hw1 -- 6     # prints G, 2G, ..., 6G and the toy public key
npm run serve        # http://localhost:8000
```

## Disclaimer

Educational code. The toy curves and the toy key range can be broken instantly, nothing here is constant-time, and the wallet demo accepts only generated or public
test phrases. **Never type a real recovery phrase into any website.**
