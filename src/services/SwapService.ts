/**
 * SwapService — Mobile-side swap orchestrator.
 *
 * Delegates to Wallet's {@link UniversalSwapClient} for quoting and
 * route execution. The quote response carries attribution metadata
 * (OmniDEX vs Li.Fi vs 0x) that the UI renders so the user can see
 * which aggregator won the race. The first quote returned is already
 * the best (the validator pre-sorts by net output).
 *
 * Phase 3 scope: same-chain swaps on OmniCoin L1 (gasless via
 * OmniRelay) + cross-chain routes via Li.Fi / 0x when XOM→USDC pre-hop
 * isn't needed. Full XOM→USDC mandatory pre-hop enforcement relies on
 * the IntentRouter in Wallet — Mobile's MVP just trusts the validator's
 * route ranking.
 */

import {
  getUniversalSwapClient,
  type QuoteResponse,
  type SwapQuote,
  type UniversalSwapQuoteParams,
} from '@wallet/services/dex/UniversalSwapClient';

export type { QuoteResponse, SwapQuote, UniversalSwapQuoteParams };

/** Canonical native-token sentinel used by the validator. */
export const NATIVE_TOKEN_SENTINEL = '0x0000000000000000000000000000000000000000';

/** Common token shortcuts for the Mobile swap dropdown. */
export interface TokenShortcut {
  chainId: number;
  symbol: string;
  /** Contract address or NATIVE_TOKEN_SENTINEL for the chain-native. */
  address: string;
  decimals: number;
}

export const COMMON_TOKENS: TokenShortcut[] = [
  { chainId: 88008, symbol: 'XOM', address: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { chainId: 1, symbol: 'ETH', address: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { chainId: 1, symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { chainId: 1, symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { chainId: 42161, symbol: 'ETH', address: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { chainId: 42161, symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  { chainId: 8453, symbol: 'ETH', address: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { chainId: 8453, symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { chainId: 137, symbol: 'MATIC', address: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { chainId: 137, symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
];

/**
 * Fetch a swap quote from the validator. The first element of
 * {@link QuoteResponse.quotes} is the validator's preferred route.
 *
 * @param params - Quote request parameters.
 * @returns The full quote response (first element is best).
 */
export async function getQuote(params: UniversalSwapQuoteParams): Promise<QuoteResponse> {
  return await getUniversalSwapClient().getQuote(params);
}

/**
 * Derive the attribution badge a UI would render for a quote.
 * Returns the provider name or "Unknown" when metadata is missing.
 *
 * @param quote - A single quote from the quote response.
 * @returns Short label.
 */
export function attributionLabel(quote: SwapQuote): string {
  if (quote.source !== undefined && quote.source !== '') return quote.source;
  return 'Unknown';
}

/**
 * Human-friendly price-impact string (e.g. "0.18%").
 *
 * @param bps - Price impact in basis points.
 * @returns Formatted percentage string.
 */
export function formatPriceImpact(bps: number): string {
  const pct = bps / 100;
  return `${pct.toFixed(2)}%`;
}

/**
 * Decide whether a given swap pair is a same-chain direct swap, a
 * cross-chain bridge-only transfer, or a bridge-and-swap combo. This
 * is purely for UI hints; the actual routing is the validator's job.
 *
 * @param params - Swap pair.
 * @returns Classification string.
 */
export function classifySwap(params: Pick<UniversalSwapQuoteParams, 'sourceChainId' | 'targetChainId' | 'tokenInSymbol' | 'tokenOutSymbol'>): 'same-chain-swap' | 'bridge-only' | 'bridge-and-swap' {
  const sameChain = params.sourceChainId === params.targetChainId;
  const sameToken = params.tokenInSymbol === params.tokenOutSymbol;
  if (sameChain) return 'same-chain-swap';
  if (sameToken) return 'bridge-only';
  return 'bridge-and-swap';
}
