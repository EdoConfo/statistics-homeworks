# Statistics Homeworks · MSc Cybersecurity

Interactive homework pages for the **Statistics** course: cryptographic primitives analysed with statistical tools.

**Live site:** https://edoconfo.github.io/statistics-homeworks/

| # | Homework | What's inside |
|---|----------|---------------|
| 1 | [Example App: Public-Key Cryptography PRIVATE KEY → PUBLIC KEY in Ethereum](https://edoconfo.github.io/statistics-homeworks/homework-1/) | Point addition and double-and-add on `y² = x³ + 7 (mod 17)`, `G = (1, 5)`, `k = 6 → Q = (5, 8)`. Step-by-step SVG animation, brute-force ECDLP, and statistical exploration: coordinate distributions with χ² tests, bit balance, input/output correlation, avalanche vs SHA-256, structure tests. Discussion of one-way function vs hash properties. |
| 2 | [From Wallet Seed to Ethereum Address: Hashing, Key Derivation and Cryptographic Primitives](https://edoconfo.github.io/statistics-homeworks/homework-2/) | BIP-39 → BIP-32/BIP-44 → secp256k1 → Keccak-256 → EIP-55, each step classified (generation, derivation, public-key crypto, hashing, checksum, encoding) and run live. Monte Carlo experiments on BIP-39 and EIP-55 checksums, Keccak avalanche, address uniformity. Timeline 1977–2016, SHA-2 vs Keccak/SHA-3, why the pipeline uses several primitives. |

## Structure

```
index.html                  landing page
assets/                     shared CSS, theme toggle, SVG charts, statistics toolkit
homework-1/
  ecc.js                    toy curve arithmetic (BigInt), double-and-add with trace
  viz.js                    slow-motion SVG animation
  explore.js                statistical experiments
  cli.js                    terminal version: prints G, 2G, ..., kG
homework-2/
  wallet.js                 BIP-39 / BIP-32 / BIP-44 / EIP-55 written out on top of noble primitives
  app.js, experiments.js    live demo and Monte Carlo experiments
tests/                      node:test suites with known-answer vectors
```

No build step: plain HTML, CSS and ES modules. HW2 imports pinned builds of
[`@noble/hashes`](https://github.com/paulmillr/noble-hashes), [`@noble/curves`](https://github.com/paulmillr/noble-curves)
and the [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) English wordlist through an import map (jsDelivr).
Node uses the same versions from `node_modules`.

## Run locally

```bash
npm install          # only needed for the HW2 tests
npm test             # 19 tests: toy curve, statistics toolkit, wallet vectors
npm run hw1 -- 6     # prints G, 2G, ..., 6G and the toy public key
npm run serve        # http://localhost:8000
```

## Disclaimer

Educational code. The toy curves can be broken instantly, nothing here is constant-time, and the wallet demo accepts only generated or public
test phrases. **Never type a real recovery phrase into any website.**
