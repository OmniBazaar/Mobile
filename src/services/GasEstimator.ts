/**
 * GasEstimator — quick estimate of native + USD gas cost for a Send
 * transaction.
 *
 * Used by SendScreen to surface a fee preview before the user taps
 * Submit. We deliberately use a coarse estimate (21,000 gas for
 * native transfers, 65,000 for ERC-20) rather than calling
 * `eth_estimateGas` on every keystroke — the precise value only
 * matters when the transaction is actually broadcast, and the
 * preview's job is to tell the user "fees will be ~$X" so they
 * aren't surprised. A second, exact estimate happens server-side at
 * relay time.
 *
 * On OmniCoin L1 (chain 88008) the gas cost is shown as $0 because
 * the chain is gasless — every txn is sponsored via OmniRelay.
 *
 * @module services/GasEstimator
 */

import { getBaseUrl } from './BootstrapService';

/** Default gas units per transfer kind. Mirrors EIP-2028 + ERC-20 norms. */
const GAS_UNITS = {
  native: 21_000n,
  erc20: 65_000n,
} as const;

/** Result of {@link estimateGasFee}. */
export interface GasEstimate {
  /** Gas units the txn is expected to consume. */
  units: bigint;
  /** Gas price in wei. 0 means gasless (relay-sponsored). */
  gasPriceWei: bigint;
  /** Total fee in the chain's native currency (wei). */
  feeWei: bigint;
  /** Symbol of the native currency. */
  nativeSymbol: string;
  /** Estimated fee in USD. Undefined when no oracle price available. */
  feeUsd?: number;
  /** True for chains where the user pays nothing (relay-sponsored). */
  gasless: boolean;
}

/** Native currency symbol per chain — matches PortfolioService.CHAINS. */
const NATIVE_SYMBOL: Record<number, string> = {
  1: 'ETH',
  10: 'ETH',
  56: 'BNB',
  137: 'MATIC',
  8453: 'ETH',
  42161: 'ETH',
  43114: 'AVAX',
  88008: 'XOM',
};

/** Coingecko-style id per chain's native currency. */
const NATIVE_PRICE_ID: Record<number, string> = {
  1: 'ethereum',
  10: 'ethereum',
  56: 'binancecoin',
  137: 'matic-network',
  8453: 'ethereum',
  42161: 'ethereum',
  43114: 'avalanche-2',
  88008: 'omnicoin',
};

/**
 * Fetch the current gas price for `chainId` from the validator's
 * gas-oracle endpoint, with a hard 3-second cap. Returns 0 when the
 * chain is gasless or the oracle is unreachable.
 *
 * @param chainId - EVM chain ID.
 * @returns Gas price in wei.
 */
async function fetchGasPriceWei(chainId: number): Promise<bigint> {
  if (chainId === 88008) return 0n; // gasless
  try {
    const base = getBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/wallet/gas-price/${chainId}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return 0n;
    const body = (await res.json()) as { gasPriceWei?: string };
    if (typeof body.gasPriceWei !== 'string') return 0n;
    return BigInt(body.gasPriceWei);
  } catch {
    return 0n;
  }
}

/**
 * Fetch the USD price of `chainId`'s native currency. Returns
 * undefined on failure (caller falls back to "estimate unavailable").
 *
 * @param chainId - EVM chain ID.
 * @returns USD price per 1 native unit, or undefined.
 */
async function fetchNativeUsdPrice(chainId: number): Promise<number | undefined> {
  const id = NATIVE_PRICE_ID[chainId];
  if (id === undefined) return undefined;
  try {
    const base = getBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/wallet/price/${id}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { usd?: number };
    return typeof body.usd === 'number' ? body.usd : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Estimate the gas fee for sending native currency or an ERC-20.
 *
 * @param chainId - EVM chain ID the txn will land on.
 * @param kind - 'native' for ETH/MATIC/etc. transfer, 'erc20' for
 *   token transfer.
 * @returns Gas estimate bundle.
 */
export async function estimateGasFee(
  chainId: number,
  kind: 'native' | 'erc20',
): Promise<GasEstimate> {
  const units = kind === 'native' ? GAS_UNITS.native : GAS_UNITS.erc20;
  const nativeSymbol = NATIVE_SYMBOL[chainId] ?? `Chain${chainId}`;
  // OmniCoin L1 is gasless — the validator sponsors gas via OmniRelay,
  // so the user owes nothing.
  if (chainId === 88008) {
    return {
      units,
      gasPriceWei: 0n,
      feeWei: 0n,
      nativeSymbol,
      feeUsd: 0,
      gasless: true,
    };
  }
  const [gasPriceWei, usdPrice] = await Promise.all([
    fetchGasPriceWei(chainId),
    fetchNativeUsdPrice(chainId),
  ]);
  const feeWei = units * gasPriceWei;
  // 18-decimal native to USD: feeNative = feeWei / 1e18; feeUsd = feeNative * usdPrice
  const feeUsd =
    usdPrice !== undefined && gasPriceWei > 0n
      ? Number(feeWei) / 1e18 * usdPrice
      : undefined;
  return {
    units,
    gasPriceWei,
    feeWei,
    nativeSymbol,
    ...(feeUsd !== undefined && { feeUsd }),
    gasless: false,
  };
}
