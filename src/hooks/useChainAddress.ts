/**
 * useChainAddress — Mobile-equivalent of the Wallet popup hook.
 *
 * Returns the address Mobile should display for a given chain. EVM
 * chains share the primary EVM address (`m/44'/60'/0'/0/0`). Non-EVM
 * families read from the bundle derived once at sign-in
 * ({@link FamilyAddressService.deriveFamilyAddresses}) and cached on
 * `authStore.familyAddresses`.
 *
 * Synthetic chain IDs (Bitcoin = 100_001, Solana = 100_002, etc.) live
 * in {@link FamilyPortfolioService.FAMILY_CHAIN_IDS} and are interpreted
 * here so the Receive screen + portfolio UI can render the right
 * address per row.
 *
 * @module hooks/useChainAddress
 */

import { useAuthStore } from '../store/authStore';

/** Coarse family classification used by the chain switch. */
export type ChainFamily =
  | 'evm'
  | 'omnicoin'
  | 'bitcoin'
  | 'solana'
  | 'polkadot'
  | 'cosmos'
  | 'cardano'
  | 'xrp'
  | 'tron'
  | 'near'
  | 'hedera'
  | 'stellar'
  | 'tezos'
  | 'unsupported';

/**
 * Map a chain id to its family. Numbers above 100_000 are synthetic
 * Mobile-only IDs for non-EVM families; standard EVM chain IDs map
 * to `evm` (or `omnicoin` for 88008).
 *
 * @param chainId - Chain identifier (numeric).
 * @returns ChainFamily classification.
 */
function familyForChain(chainId: number | string): ChainFamily {
  if (typeof chainId === 'string') return 'unsupported';
  if (chainId === 88008) return 'omnicoin';
  if (chainId < 100_000) return 'evm';
  // Synthetic Mobile-internal IDs from FamilyPortfolioService.FAMILY_CHAIN_IDS.
  switch (chainId) {
    case 100_001: return 'bitcoin';
    case 100_002: return 'solana';
    case 100_003: return 'polkadot';
    case 100_004: return 'cosmos';
    case 100_005: return 'cardano';
    case 100_006: return 'xrp';
    case 100_007: return 'tron';
    case 100_008: return 'near';
    case 100_009: return 'hedera';
    case 100_010: return 'stellar';
    case 100_011: return 'tezos';
    default: return 'unsupported';
  }
}

/** Return value of the hook. */
export interface ChainAddressResult {
  /** Address to display, or empty string if unsupported on this build. */
  address: string;
  /** Family classification — useful for branching on display logic. */
  family: ChainFamily;
  /** True when the address is a real per-family derivation. */
  derived: boolean;
}

/**
 * Return the chain-specific address the UI should show.
 *
 * @param chainId - EVM chain ID or synthetic family ID.
 * @returns Address + family + derivation state.
 */
export function useChainAddress(chainId: number | string): ChainAddressResult {
  const evmAddress = useAuthStore((s) => s.address);
  const fam = useAuthStore((s) => s.familyAddresses);
  const family = familyForChain(chainId);
  switch (family) {
    case 'evm':
    case 'omnicoin':
      return { address: evmAddress, family, derived: true };
    case 'bitcoin':
      return { address: fam.bitcoin ?? '', family, derived: fam.bitcoin !== undefined };
    case 'solana':
      return { address: fam.solana ?? '', family, derived: fam.solana !== undefined };
    case 'polkadot':
      return { address: fam.polkadot ?? '', family, derived: fam.polkadot !== undefined };
    case 'cosmos':
      return { address: fam.cosmos ?? '', family, derived: fam.cosmos !== undefined };
    case 'cardano':
      return { address: fam.cardano ?? '', family, derived: fam.cardano !== undefined };
    case 'xrp':
      return { address: fam.xrp ?? '', family, derived: fam.xrp !== undefined };
    case 'tron':
      return { address: fam.tron ?? '', family, derived: fam.tron !== undefined };
    case 'near':
      return { address: fam.near ?? '', family, derived: fam.near !== undefined };
    case 'hedera':
      return { address: fam.hedera ?? '', family, derived: fam.hedera !== undefined };
    case 'stellar':
      return { address: fam.stellar ?? '', family, derived: fam.stellar !== undefined };
    case 'tezos':
      return { address: fam.tezos ?? '', family, derived: fam.tezos !== undefined };
    case 'unsupported':
    default:
      return { address: '', family: 'unsupported', derived: false };
  }
}
