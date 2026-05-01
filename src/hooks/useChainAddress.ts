/**
 * useChainAddress — Mobile-equivalent of the Wallet popup hook.
 *
 * Returns the address Mobile should display for a given chain. The
 * primary EVM address (derived at `m/44'/60'/0'/0/0`) is correct for:
 *   - All EVM chains (Ethereum, Arbitrum, Base, Polygon, Optimism,
 *     Avalanche, OmniCoin L1) — they share one address per BIP-44.
 *
 * For non-EVM families (Bitcoin, Solana, Cosmos, XRP, etc.) the proper
 * derivation lives in `@wallet/core/keyring/familyAddressDerivation`.
 * Mobile V1 does not yet expose non-EVM UX, so this hook returns the
 * EVM address as a best-effort fallback and a separate flag indicates
 * whether the family is supported on the current build. When the
 * family-derivation step lands in Mobile it'll attach to
 * `useAuthStore.familyAddresses` and this hook can switch on family.
 *
 * @module hooks/useChainAddress
 */

import { useAuthStore } from '../store/authStore';

/** Coarse family classification used by the chain switch. */
export type ChainFamily = 'evm' | 'omnicoin' | 'unsupported';

/**
 * Map a chain id to its family. Numbers are EVM chain IDs; strings
 * are reserved for future non-EVM families (e.g. `'bitcoin-mainnet'`).
 *
 * @param chainId - Chain identifier (numeric for EVM, string otherwise).
 * @returns ChainFamily classification.
 */
function familyForChain(chainId: number | string): ChainFamily {
  if (typeof chainId === 'number') {
    if (chainId === 88008) return 'omnicoin';
    return 'evm';
  }
  return 'unsupported';
}

/** Return value of the hook. */
export interface ChainAddressResult {
  /** Address to display, or empty string if unsupported on this build. */
  address: string;
  /** Family classification — useful for branching on display logic. */
  family: ChainFamily;
  /**
   * True when the address is a real per-family derivation. False when
   * we fell back to the EVM address (e.g. for an unsupported family).
   */
  derived: boolean;
}

/**
 * Return the chain-specific address the UI should show.
 *
 * @param chainId - EVM chain ID or non-EVM string identifier.
 * @returns Address + family + derivation state.
 */
export function useChainAddress(chainId: number | string): ChainAddressResult {
  const evmAddress = useAuthStore((s) => s.address);
  const family = familyForChain(chainId);
  switch (family) {
    case 'evm':
    case 'omnicoin':
      return { address: evmAddress, family, derived: true };
    case 'unsupported':
    default:
      return { address: '', family: 'unsupported', derived: false };
  }
}
