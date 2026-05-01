/**
 * WalletCreationService — Mobile-side helper around ethers v6 for
 * BIP39 mnemonic generation, derivation, and import.
 *
 * Uses ethers v6 primitives directly (HDNodeWallet, Mnemonic). Full
 * multi-chain 17-family derivation is deferred to Phase 2 where Mobile
 * pulls in `@wallet/core/keyring/familyAddressDerivation`. For the
 * Phase 1 auth flow we only need the primary EVM address (owner key at
 * `m/44'/60'/0'/0/0`) and the active key at `m/44'/60'/0'/0/1`.
 */

import { HDNodeWallet, Mnemonic } from 'ethers';
import { pbkdf2 as noblePbkdf2 } from '@noble/hashes/pbkdf2';
import { sha512 } from '@noble/hashes/sha512';
import { entropyToMnemonic as scureEntropyToMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english';

/** Bundle of primary derivation output used by the auth flow. */
export interface DerivedKeys {
  /** 12-word BIP39 mnemonic phrase. */
  mnemonic: string;
  /** EVM address derived at m/44'/60'/0'/0/0. */
  address: string;
  /** Owner public key (hex). */
  ownerPublicKey: string;
  /** Active public key (hex, m/44'/60'/0'/0/1). */
  activePublicKey: string;
}

/** Standard HD path for the owner (primary) key. */
const OWNER_PATH = "m/44'/60'/0'/0/0";
/** Secondary HD path for the active (day-to-day signing) key. */
const ACTIVE_PATH = "m/44'/60'/0'/0/1";

/**
 * Generate a fresh BIP39 mnemonic + primary EVM derivation.
 *
 * @param wordCount - 12 or 24. Defaults to 12 (128-bit entropy).
 * @returns Derivation bundle. Callers are responsible for zeroing the
 *   mnemonic from memory after the user confirms the backup.
 */
export function createWallet(wordCount: 12 | 24 = 12): DerivedKeys {
  const entropyBytes = wordCount === 24 ? 32 : 16;
  const random = globalThis.crypto.getRandomValues(new Uint8Array(entropyBytes));
  const hexEntropy = `0x${Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
  const mnemonic = Mnemonic.fromEntropy(hexEntropy);
  return deriveFromMnemonic(mnemonic);
}

/**
 * Import an existing BIP39 mnemonic.
 *
 * @param phrase - 12/24-word BIP39 phrase (lowercase, single-space-separated).
 * @returns Derivation bundle.
 * @throws If the mnemonic is malformed or checksum fails.
 */
export function importWallet(phrase: string): DerivedKeys {
  const mnemonic = Mnemonic.fromPhrase(phrase.trim());
  return deriveFromMnemonic(mnemonic);
}

/** Number of PBKDF2 iterations. Must match Wallet's `KeyringManager.SALT_ROUNDS`. */
const DETERMINISTIC_PBKDF2_ITERATIONS = 100_000;

/**
 * Derive a wallet deterministically from username + password.
 *
 * MUST stay byte-for-byte identical to:
 *   - `Wallet/src/core/keyring/KeyringManager.ts::generateDeterministicSeed`
 *   - WebApp `EmbeddedWalletService.getMnemonic(username, password)`
 *
 * The validator stores exactly one address per username at registration,
 * so any divergence in this KDF locks the user out — re-cased usernames
 * or alternative iteration counts silently produce a different mnemonic.
 *
 * Canonical algorithm:
 *   salt     = utf8(trim(username))   // case preserved (validator already
 *                                     //  enforces lowercase at signup)
 *   secret   = utf8(password)
 *   entropy  = pbkdf2(secret, salt, 100_000 iterations, SHA-512, 32 bytes)
 *   mnemonic = bip39.entropyToMnemonic(entropy)   // 24 words
 *
 * @param username - Canonical username (validator already lowercases).
 * @param password - Plaintext password.
 * @returns DerivedKeys (24-word mnemonic + EVM address + owner/active pubkeys).
 * @throws If username is empty.
 */
export function deriveDeterministicWallet(username: string, password: string): DerivedKeys {
  const normalizedUsername = username.trim();
  if (normalizedUsername.length === 0) {
    throw new Error('username required for deterministic wallet derivation');
  }
  // Pure-JS PBKDF2 via `@noble/hashes`. We do NOT route through ethers'
  // `pbkdf2`: ethers v6's CommonJS build delegates to `crypto.pbkdf2Sync`
  // from Node's `crypto` module, which is not present in Hermes (RN).
  // The resulting `undefined` swallowed silently and surfaced as
  // "undefined is not a function" inside the hot path. Noble is what
  // ethers itself uses on the browser side, so the output is identical.
  const encoder = new TextEncoder();
  const salt = encoder.encode(normalizedUsername);
  const secret = encoder.encode(password);
  const t0 = Date.now();
  const entropy = noblePbkdf2(sha512, secret, salt, {
    c: DETERMINISTIC_PBKDF2_ITERATIONS,
    dkLen: 32,
  });
  // PBKDF2 is the dominant cost on Hermes; log it so we can profile
  // whether to swap in a native implementation. On Pixel 7 Pro the
  // pure-JS path takes ~10–15 seconds for 100k iters; a native
  // implementation would drop this to <50ms.
  // eslint-disable-next-line no-console
  console.log('[derive] pbkdf2 100k SHA-512 took', Date.now() - t0, 'ms');
  // `@scure/bip39` mirrors the BIP-39 spec exactly; ethers'
  // `Mnemonic.fromEntropy` does the same internally but routes through
  // `crypto.createHash('sha256')` for the checksum, which is also
  // missing in Hermes. Build the phrase via `@scure/bip39` first, then
  // hand it to ethers' `Mnemonic.fromPhrase` which is pure JS once it
  // has a validated phrase.
  const phrase = scureEntropyToMnemonic(entropy, englishWordlist);
  const mnemonic = Mnemonic.fromPhrase(phrase);
  return deriveFromMnemonic(mnemonic);
}

/**
 * Derive the primary + active keys from a validated Mnemonic.
 *
 * @param mnemonic - ethers Mnemonic instance.
 * @returns Derivation bundle.
 */
function deriveFromMnemonic(mnemonic: Mnemonic): DerivedKeys {
  const ownerWallet = HDNodeWallet.fromMnemonic(mnemonic, OWNER_PATH);
  const activeWallet = HDNodeWallet.fromMnemonic(mnemonic, ACTIVE_PATH);
  return {
    mnemonic: mnemonic.phrase,
    address: ownerWallet.address,
    ownerPublicKey: ownerWallet.publicKey,
    activePublicKey: activeWallet.publicKey,
  };
}

/**
 * Randomly select `count` distinct word positions from a mnemonic for
 * the seed-verify challenge.
 *
 * @param wordCount - Total words in the mnemonic (12 or 24).
 * @param count - Number of positions to return. Defaults to 3.
 * @returns Array of 0-indexed positions, sorted ascending.
 */
export function chooseVerifyPositions(wordCount: number, count: number = 3): number[] {
  const positions = new Set<number>();
  while (positions.size < count) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(1));
    const byte = bytes[0] ?? 0;
    positions.add(byte % wordCount);
  }
  return Array.from(positions).sort((a, b) => a - b);
}
