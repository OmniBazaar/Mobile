/**
 * FamilyAddressService — derive every non-EVM family address from a
 * BIP-39 mnemonic so the portfolio screen can show real per-family
 * balances without re-deriving on every refresh.
 *
 * This is a thin wrapper around Wallet's
 * `@wallet/core/keyring/familyAddressDerivation`. It is invoked once
 * at sign-in / wallet-create; the result lives in `authStore.familyAddresses`
 * and is consumed by `ClientPortfolioService` + `useChainAddress`.
 *
 * Each derivation is wrapped in try/catch — a single failing family
 * (e.g. Cardano which carries a heavy serialization SDK) must not
 * block the whole bundle. Missing entries fall through to "unsupported"
 * in the portfolio UI.
 *
 * @module services/FamilyAddressService
 */

import { HDNodeWallet, Mnemonic } from 'ethers';

import {
  getCardanoAddress,
  getCosmosAddress,
  getHederaAddress,
  getStellarAddress,
  getTezosAddress,
  getTronAddress,
  getXrpAddress,
  getNearAddress,
  getSolanaAddress,
} from '@wallet/core/keyring/familyAddressDerivation';

import type { FamilyAddressBundle } from '../store/authStore';
import { logger } from '../utils/logger';

/** Build the BIP-39 seed (Uint8Array) for SLIP-0010 / Solana / Algorand derivations. */
function seedFromMnemonic(mnemonic: string): Uint8Array {
  const m = Mnemonic.fromPhrase(mnemonic.trim());
  // ethers v6 returns the BIP-39 seed bytes via `computeSeed` on the
  // Mnemonic instance; alternatively `mnemonic.password` extension is
  // possible but we only need the canonical seed here.
  const seedHex = m.computeSeed();
  const clean = seedHex.startsWith('0x') ? seedHex.slice(2) : seedHex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = Number.parseInt(clean.substring(i, i + 2), 16);
  }
  return out;
}

/**
 * Derive every supported per-family address. Best-effort: any single
 * failure logs a warning and the resulting bundle simply omits that
 * family.
 *
 * @param mnemonic - BIP-39 phrase (12 or 24 words, validated upstream).
 * @returns Bundle of family addresses.
 */
export function deriveFamilyAddresses(mnemonic: string): FamilyAddressBundle {
  if (mnemonic.trim() === '') return {};
  let seed: Uint8Array | undefined;
  try {
    seed = seedFromMnemonic(mnemonic);
  } catch (err) {
    logger.warn('[family] seed derivation failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  // Bitcoin uses BIP-44 path 0' / 0' / 0; the Wallet helper signature
  // is hdNode-driven for some families and seed-driven for others.
  const bundle: FamilyAddressBundle = {};
  // ethers HDNodeWallet at the root of m/ for the helpers that take it.
  let root: HDNodeWallet | undefined;
  try {
    root = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic.trim()));
  } catch (err) {
    logger.warn('[family] hdnode root failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const tryDerive = (label: string, fn: () => string | undefined): string | undefined => {
    try {
      const addr = fn();
      if (addr !== undefined && addr !== '') return addr;
    } catch (err) {
      logger.debug('[family] derivation failed', {
        family: label,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return undefined;
  };

  if (root !== undefined) {
    const xrp = tryDerive('xrp', () => getXrpAddress(root).address);
    if (xrp !== undefined) bundle.xrp = xrp;
    const cosmos = tryDerive('cosmos', () => getCosmosAddress(root).address);
    if (cosmos !== undefined) bundle.cosmos = cosmos;
    const tron = tryDerive('tron', () => getTronAddress(root).address);
    if (tron !== undefined) bundle.tron = tron;
    const hedera = tryDerive('hedera', () => getHederaAddress(root).address);
    if (hedera !== undefined) bundle.hedera = hedera;
    const stellar = tryDerive('stellar', () => getStellarAddress(root, seed).address);
    if (stellar !== undefined) bundle.stellar = stellar;
    const tezos = tryDerive('tezos', () => getTezosAddress(root, seed).address);
    if (tezos !== undefined) bundle.tezos = tezos;
    const near = tryDerive('near', () => getNearAddress(root, seed).address);
    if (near !== undefined) bundle.near = near;
    const cardano = tryDerive('cardano', () => getCardanoAddress(root).address);
    if (cardano !== undefined) bundle.cardano = cardano;
  }

  if (seed !== undefined) {
    const sol = tryDerive('solana', () => getSolanaAddress(seed).address);
    if (sol !== undefined) bundle.solana = sol;
  }

  return bundle;
}
