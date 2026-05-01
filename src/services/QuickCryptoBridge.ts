/**
 * QuickCryptoBridge — runtime bridge to `react-native-quick-crypto`.
 *
 * The native module ships JSI bindings for Node's `crypto` API. We use it
 * for PBKDF2 SHA-512 (~30× faster than pure-JS noble on Hermes) and for
 * AES-256-GCM encryption when we land an encrypted-vault flow.
 *
 * The bridge is intentionally indirect:
 *   - Production Mobile bundle: `react-native-quick-crypto` is autolinked
 *     and `install()` registers it as `globalThis.crypto.{getRandomValues,subtle}`
 *     plus a node-style `crypto` module via Metro resolution.
 *   - Jest / Node tests: the package never resolves (it's a native module),
 *     and we fall back to `@noble/hashes` so the deterministic-derivation
 *     test fixtures remain runnable on CI.
 *
 * Both implementations produce byte-identical output for the same inputs;
 * if they diverge, every existing user's wallet would migrate to a
 * different mnemonic the next time they sign in. Treat this file as
 * cryptographic boundary code.
 *
 * @module services/QuickCryptoBridge
 */

let _quickCrypto: { pbkdf2Sync?: (password: Uint8Array, salt: Uint8Array, iter: number, keylen: number, digest: string) => Uint8Array } | undefined;
let _checked = false;

/**
 * Lazy-load the quick-crypto module. We don't `import` at module top level
 * because the package is platform-conditional (RN-only) and the test
 * environment must keep working without it.
 *
 * @returns Resolved quick-crypto handle, or undefined when unavailable.
 */
function loadQuickCrypto(): typeof _quickCrypto {
  if (_checked) return _quickCrypto;
  _checked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: unknown = require('react-native-quick-crypto');
    if (mod !== undefined && mod !== null && typeof mod === 'object') {
      // The module also exposes an `install()` initializer, which the
      // entry point (App.tsx) calls during cold start. We don't call it
      // here — that would re-register on every import.
      const m = mod as { pbkdf2Sync?: unknown };
      if (typeof m.pbkdf2Sync === 'function') {
        _quickCrypto = mod as typeof _quickCrypto;
      }
    }
  } catch {
    _quickCrypto = undefined;
  }
  return _quickCrypto;
}

/**
 * Ask whether the native crypto bridge is wired up.
 *
 * @returns True when running with `react-native-quick-crypto` autolinked.
 */
export function isQuickCryptoAvailable(): boolean {
  return loadQuickCrypto() !== undefined;
}

/**
 * Native PBKDF2 SHA-512. Throws if the bridge is missing — callers must
 * guard with {@link isQuickCryptoAvailable}.
 *
 * @param password - UTF-8 encoded password bytes.
 * @param salt - UTF-8 encoded salt bytes.
 * @param iterations - PBKDF2 iteration count (must match the producer).
 * @param keyLen - Output key length in bytes.
 * @returns Derived key as Uint8Array.
 */
export function nativePbkdf2Sha512Sync(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLen: number,
): Uint8Array {
  const qc = loadQuickCrypto();
  if (qc?.pbkdf2Sync === undefined) {
    throw new Error('QuickCryptoBridge: pbkdf2Sync requested but native bridge not loaded');
  }
  const out = qc.pbkdf2Sync(password, salt, iterations, keyLen, 'sha512');
  // quick-crypto returns a Buffer that's also a Uint8Array; copy to a
  // plain Uint8Array so callers don't have to depend on the Buffer
  // polyfill for typing.
  return new Uint8Array(out);
}

/**
 * Run the native bridge's `install()` once at app boot. Wires
 * `globalThis.crypto.subtle`, `crypto.getRandomValues`, and a
 * Node-compatible `crypto` module that ethers v6 picks up internally.
 * Idempotent; safe to call multiple times.
 */
export function installQuickCrypto(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: unknown = require('react-native-quick-crypto');
    if (mod !== undefined && mod !== null && typeof mod === 'object') {
      const installer = (mod as { install?: () => void }).install;
      if (typeof installer === 'function') {
        installer();
      }
    }
  } catch {
    // Silent — falls through to noble path; callers don't need to
    // know about the absence at boot time.
  }
}
