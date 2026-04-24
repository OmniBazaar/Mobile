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
