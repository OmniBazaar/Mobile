/**
 * EthersCryptoShim — replace ethers v6's crypto primitives with
 * pure-JS noble equivalents BEFORE any ethers code path that needs
 * them executes.
 *
 * Why this exists:
 *   ethers v6's CommonJS build does `var crypto_1 = require('crypto')`
 *   and pulls `pbkdf2Sync` / `createHmac` / `createHash` / `randomBytes`
 *   off it. Hermes (RN's JS engine) has no Node `crypto` module, and
 *   Metro silently substitutes an empty stub when it encounters
 *   `require('crypto')` — so `crypto_1.pbkdf2Sync(...)` reads
 *   `undefined` and the first call site (Mnemonic.computeSeed,
 *   HDNodeWallet.fromSeed, signing flows) throws "undefined is not a
 *   function" and crashes login + onboarding.
 *
 *   We tried two prior fixes — Metro `extraNodeModules` and a
 *   babel-plugin-module-resolver `crypto` → `crypto-browserify` alias —
 *   neither replaced the runtime resolution, because Metro's auto-stub
 *   for Node core modules runs before either layer.
 *
 *   ethers v6 exposes `register(impl)` on every primitive (`pbkdf2`,
 *   `computeHmac`, `keccak256`, `sha256`, `sha512`, `randomBytes`)
 *   precisely so consumers can swap the implementation at runtime.
 *   This shim does that with `@noble/hashes` (the same library ethers
 *   itself uses on the browser side), bypassing the missing Node-crypto
 *   resolution entirely.
 *
 *   The shim must run BEFORE any ethers crypto operation. App.tsx
 *   imports it as a side-effect at the very top of the boot sequence,
 *   right after the Buffer / TextEncoder / process polyfills.
 *
 * @module services/EthersCryptoShim
 */

import { computeHmac, pbkdf2, randomBytes, sha256, sha512, keccak256 } from 'ethers';
import { pbkdf2 as noblePbkdf2 } from '@noble/hashes/pbkdf2';
import { hmac as nobleHmac } from '@noble/hashes/hmac';
import { sha256 as nobleSha256 } from '@noble/hashes/sha256';
import { sha512 as nobleSha512 } from '@noble/hashes/sha512';
import { keccak_256 as nobleKeccak256 } from '@noble/hashes/sha3';
import 'react-native-get-random-values';

/** Pick the noble hash factory matching an ethers algo string. */
function pickHash(algo: 'sha256' | 'sha512'): typeof nobleSha256 | typeof nobleSha512 {
  return algo === 'sha256' ? nobleSha256 : nobleSha512;
}

/** Convert a Uint8Array to ethers' canonical 0x-prefixed hex string. */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '0x';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Coerce ethers BytesLike (Uint8Array | hex string) to Uint8Array. */
function toBytes(value: Uint8Array | string): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    const stripped = value.startsWith('0x') ? value.slice(2) : value;
    const out = new Uint8Array(stripped.length / 2);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  throw new TypeError(`unsupported BytesLike: ${typeof value}`);
}

let installed = false;

/**
 * Install noble-backed implementations of every ethers v6 crypto
 * primitive that would otherwise fall through to Node's missing
 * `crypto` module. Idempotent — second call is a no-op (ethers
 * locks the primitive after the first registration in some code
 * paths anyway).
 */
export function installEthersCryptoShim(): void {
  if (installed) return;
  installed = true;

  // PBKDF2 — used by Mnemonic.computeSeed (BIP-39 → BIP-32 seed).
  pbkdf2.register((password, salt, iterations, keylen, algo) => {
    const out = noblePbkdf2(pickHash(algo), toBytes(password), toBytes(salt), {
      c: iterations,
      dkLen: keylen,
    });
    return bytesToHex(out);
  });

  // HMAC — used by HDNodeWallet.fromSeed (BIP-32 master derivation)
  // and child-key derivation, EIP-712 commit hashes, etc.
  computeHmac.register((algorithm, key, data) => {
    const out = nobleHmac(pickHash(algorithm), toBytes(key), toBytes(data));
    return bytesToHex(out);
  });

  // SHA-256 — used by Mnemonic.fromEntropy checksum, address derivation.
  sha256.register((data) => {
    const out = nobleSha256(toBytes(data));
    return bytesToHex(out);
  });

  // SHA-512 — used in some signature flows.
  sha512.register((data) => {
    const out = nobleSha512(toBytes(data));
    return bytesToHex(out);
  });

  // Keccak-256 — used by EVM address derivation, EIP-191 / EIP-712.
  keccak256.register((data) => {
    const out = nobleKeccak256(toBytes(data));
    return bytesToHex(out);
  });

  // randomBytes — Hermes ships `globalThis.crypto.getRandomValues`
  // via react-native-get-random-values, so we wire ethers' randomBytes
  // through that. This is also what ethers' browser build does.
  randomBytes.register((length) => {
    const out = new Uint8Array(length);
    globalThis.crypto.getRandomValues(out);
    return out;
  });
}
