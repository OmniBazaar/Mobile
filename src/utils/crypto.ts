/**
 * Crypto-primitive helpers placeholder.
 *
 * Mobile's production cryptography comes from `@wallet/core/keyring/*`
 * (BIP39 / BIP44 / ethers v6) — NOT from this module. This file exists
 * only so the legacy `@/utils/crypto` import path continues to resolve
 * while we migrate straggling callers.
 *
 * Two small helpers remain useful at the UI layer:
 *   - randomId() for UI-only identifiers (lists, modals)
 *   - hex() for compact display of digests
 *
 * Do NOT use this module for any signing, encryption, or keystore work.
 * Use `@wallet/core/keyring/KeyringService` and
 * `@wallet/services/EncryptionService` instead.
 */

/**
 * Generate a cryptographically random hex string.
 *
 * @param byteCount - Number of random bytes to produce. Default 16 (32 hex chars).
 * @returns Lowercase hex-encoded random value.
 */
export function randomId(byteCount = 16): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hex-encode a Uint8Array or ArrayBuffer.
 *
 * @param bytes - Input bytes.
 * @returns Lowercase hex string.
 */
export function hex(bytes: Uint8Array | ArrayBuffer): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const crypto = { randomId, hex };
export default crypto;
