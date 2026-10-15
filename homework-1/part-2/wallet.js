// The Ethereum wallet pipeline, one primitive per function:
//
//   entropy --BIP-39--> mnemonic --PBKDF2-HMAC-SHA512--> seed
//   seed --BIP-32 (HMAC-SHA512)--> master key --BIP-44 path--> private key
//   private key --secp256k1--> public key --Keccak-256--> address --EIP-55--> checksummed address
//
// Each step is written out by hand for readability. The audited @noble/@scure
// libraries supply only the primitives: hashes, HMAC, PBKDF2, curve arithmetic
// and the BIP-39 English wordlist. In the browser the bare imports below are
// resolved by an import map to pinned CDN builds; in Node by node_modules.
// Educational code: never paste a real recovery phrase into it.

import { sha256, sha512 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { keccak_256, sha3_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { wordlist } from '@scure/bip39/wordlists/english';

export { bytesToHex, hexToBytes, utf8ToBytes, wordlist, keccak_256, sha3_256, sha256 };

/** Order n of the secp256k1 group. */
export const CURVE_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
export const HARDENED = 0x80000000;

const bytesToBig = (b) => BigInt('0x' + (bytesToHex(b) || '0'));
const bigTo32 = (v) => hexToBytes(v.toString(16).padStart(64, '0'));
const ser32 = (i) => Uint8Array.of(i >>> 24, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff);

export function bytesToBits(bytes) {
  return [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
}

// ---------------------------------------------------------------- BIP-39

/**
 * Entropy (128-256 bits) -> mnemonic.
 * CS = ENT/32 checksum bits (first bits of SHA-256(entropy)) are appended,
 * then the bit string is cut into 11-bit groups, each indexing a 2048-word list.
 */
export function entropyToMnemonic(entropy) {
  const ent = entropy.length * 8;
  if (ent % 32 !== 0 || ent < 128 || ent > 256) throw new RangeError('entropy must be 128-256 bits, a multiple of 32');
  const cs = ent / 32;
  const entBits = bytesToBits(entropy);
  const csBits = bytesToBits(sha256(entropy)).slice(0, cs);
  const bits = entBits + csBits;
  const indices = [];
  for (let i = 0; i < bits.length; i += 11) indices.push(parseInt(bits.slice(i, i + 11), 2));
  return { words: indices.map((i) => wordlist[i]), indices, entBits, csBits, bits };
}

/**
 * Split word indices back into entropy bytes and checksum bits.
 * Bit-level arithmetic (no strings) so the Monte Carlo experiments stay fast.
 */
export function indicesToEntropy(indices) {
  const totalBits = indices.length * 11;
  const cs = totalBits / 33;
  const entropy = new Uint8Array((totalBits - cs) / 8);
  let acc = 0, accBits = 0, byte = 0, checksum = 0;
  for (const idx of indices) {
    acc = (acc << 11) | idx;
    accBits += 11;
    while (accBits >= 8 && byte < entropy.length) {
      entropy[byte++] = (acc >>> (accBits - 8)) & 0xff;
      accBits -= 8;
      acc &= (1 << accBits) - 1;
    }
  }
  checksum = acc & ((1 << accBits) - 1); // the cs leftover bits
  return { entropy, checksum, cs };
}

/** Does a list of word indices carry a valid BIP-39 checksum? */
export function checkIndices(indices) {
  if (![12, 15, 18, 21, 24].includes(indices.length)) return false;
  const { entropy, checksum, cs } = indicesToEntropy(indices);
  return sha256(entropy)[0] >>> (8 - cs) === checksum;
}

/** Does a word sequence carry a valid BIP-39 checksum? */
export function checkMnemonic(words) {
  const indices = words.map((w) => wordlist.indexOf(w));
  return !indices.some((i) => i < 0) && checkIndices(indices);
}

/** Mnemonic (+ optional passphrase) -> 512-bit seed: PBKDF2-HMAC-SHA512, 2048 rounds. */
export function mnemonicToSeed(mnemonic, passphrase = '') {
  const pw = utf8ToBytes(mnemonic.normalize('NFKD'));
  const salt = utf8ToBytes(('mnemonic' + passphrase).normalize('NFKD'));
  return pbkdf2(sha512, pw, salt, { c: 2048, dkLen: 64 });
}

// ---------------------------------------------------------------- BIP-32 / BIP-44

/** Master node: I = HMAC-SHA512(key = "Bitcoin seed", data = seed); IL = key, IR = chain code. */
export function masterKey(seed) {
  const I = hmac(sha512, utf8ToBytes('Bitcoin seed'), seed);
  const key = I.slice(0, 32);
  const k = bytesToBig(key);
  if (k === 0n || k >= CURVE_N) throw new Error('invalid master key (probability < 2^-127)');
  return { key, chainCode: I.slice(32), depth: 0, index: 0, path: 'm' };
}

export function publicKey(priv, compressed = true) {
  return secp256k1.getPublicKey(priv, compressed);
}

/**
 * BIP-32 CKDpriv. Hardened children (i >= 2^31) hash the parent *private* key,
 * normal children hash the parent *public* key, so they can also be derived from an xpub.
 * child key = (IL + k_par) mod n, chain code = IR, where I = HMAC-SHA512(c_par, data).
 */
export function ckdPriv(parent, index) {
  const hardened = index >= HARDENED;
  const data = hardened
    ? concatBytes(Uint8Array.of(0), parent.key, ser32(index))       // 0x00 || k_par || i
    : concatBytes(publicKey(parent.key, true), ser32(index));       // serP(K_par) || i
  const I = hmac(sha512, parent.chainCode, data);
  const IL = bytesToBig(I.slice(0, 32));
  if (IL >= CURVE_N) throw new Error('invalid child (IL >= n), use the next index');
  const k = (IL + bytesToBig(parent.key)) % CURVE_N;
  if (k === 0n) throw new Error('invalid child (k = 0), use the next index');
  const label = hardened ? `${index - HARDENED}'` : String(index);
  return { key: bigTo32(k), chainCode: I.slice(32), depth: parent.depth + 1, index, hardened, path: `${parent.path}/${label}`, tweak: I.slice(0, 32) };
}

export function parsePath(path) {
  const parts = path.trim().split('/');
  if (parts[0] !== 'm') throw new SyntaxError('path must start with m');
  return parts.slice(1).map((p) => {
    const h = /['hH]$/.test(p);
    const n = Number(h ? p.slice(0, -1) : p);
    if (!Number.isInteger(n) || n < 0 || n >= HARDENED) throw new SyntaxError(`bad path element ${p}`);
    return h ? n + HARDENED : n;
  });
}

/** Derive every level of a path; returns [master, ..., leaf]. */
export function derivePath(seed, path) {
  const levels = [masterKey(seed)];
  for (const i of parsePath(path)) levels.push(ckdPriv(levels.at(-1), i));
  return levels;
}

// ---------------------------------------------------------------- secp256k1 / Keccak / EIP-55

/** Address = last 20 bytes of Keccak-256(X || Y) of the uncompressed public key. */
export function addressFromPrivateKey(priv) {
  const pub = publicKey(priv, false);            // 0x04 || X (32) || Y (32)
  const hash = keccak_256(pub.slice(1));
  return { pub, hash, address: bytesToHex(hash.slice(12)) };
}

/** EIP-55: uppercase a hex letter when the matching nibble of Keccak-256(lowercase address) is >= 8. */
export function toChecksumAddress(addressHex) {
  const lower = addressHex.toLowerCase().replace(/^0x/, '');
  const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    out += /[a-f]/.test(lower[i]) && parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return { checksummed: '0x' + out, hash };
}

/**
 * EIP-55 validation. All-lowercase or all-uppercase input carries no checksum
 * and is accepted (backwards compatibility); mixed case must match exactly.
 */
export function checkAddress(addr) {
  const body = addr.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{40}$/.test(body)) return { valid: false, hasChecksum: false };
  if (body === body.toLowerCase() || body === body.toUpperCase()) return { valid: true, hasChecksum: false };
  return { valid: toChecksumAddress(body).checksummed === '0x' + body, hasChecksum: true };
}

/** Full pipeline, every intermediate value included. */
export function pipeline({ mnemonic, passphrase = '', path = "m/44'/60'/0'/0/0" }) {
  const seed = mnemonicToSeed(mnemonic, passphrase);
  const levels = derivePath(seed, path);
  const leaf = levels.at(-1);
  const { pub, hash, address } = addressFromPrivateKey(leaf.key);
  const { checksummed, hash: csHash } = toChecksumAddress(address);
  return { seed, levels, priv: leaf.key, pub, hash, address, checksummed, csHash };
}

// ---------------------------------------------------------------- known-answer tests

export const TEST_MNEMONIC = 'test test test test test test test test test test test junk';

export const VECTORS = [
  {
    name: 'Keccak-256("")',
    run: () => bytesToHex(keccak_256(new Uint8Array())),
    expect: 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
  },
  {
    name: 'SHA3-256("")',
    run: () => bytesToHex(sha3_256(new Uint8Array())),
    expect: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
  },
  {
    name: 'BIP-39 entropy 0x00…00 → mnemonic',
    run: () => entropyToMnemonic(new Uint8Array(16)).words.join(' '),
    expect: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  },
  {
    name: 'BIP-39 seed (passphrase "TREZOR")',
    run: () => bytesToHex(mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'TREZOR')),
    expect: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
  },
  {
    name: 'BIP-32 test vector 1, chain m/0\'',
    run: () => bytesToHex(derivePath(hexToBytes('000102030405060708090a0b0c0d0e0f'), "m/0'").at(-1).key),
    expect: 'edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea',
  },
  {
    name: 'EIP-55 example address',
    run: () => toChecksumAddress('5aaeb6053f3e94c9b9a09f33669435e7ef1beaed').checksummed,
    expect: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  },
  {
    name: 'Hardhat test mnemonic → m/44\'/60\'/0\'/0/0',
    run: () => pipeline({ mnemonic: TEST_MNEMONIC }).checksummed,
    expect: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
];

export function selfTest() {
  return VECTORS.map((v) => {
    let got;
    try { got = v.run(); } catch (e) { got = String(e); }
    return { name: v.name, ok: got === v.expect, got, expect: v.expect };
  });
}
