/**
 * Route classification helpers for the Mobile Universal Swap.
 *
 * Mirrors `WebApp/src/services/swap/routeClassification.ts`. Kept as a
 * separate (small) module instead of imported from `@wallet/...` so the
 * Metro bundler doesn't have to reach across the Wallet alias just for
 * a couple of one-line predicates.
 *
 * The hard rule: any leg whose source or target is OmniCoin L1 (chain
 * 88008) requires the embedded mnemonic. Those legs use EIP-2771
 * meta-transactions through OmniRelay so the user pays zero gas — and
 * external EOAs reachable via WalletConnect cannot sign EIP-2771 forward
 * requests through their public RPC methods.
 *
 * @module services/swapRouteClassification
 */
import type { SwapQuote } from '@wallet/services/dex/UniversalSwapClient';

/** Chain ID for the OmniCoin L1 subnet. */
export const OMNICOIN_CHAIN_ID = 88008;

/**
 * Reasons a quote cannot be executed by the connected external wallet.
 * Used to render the disabled-state badge on a quote card.
 */
export type ExternalQuoteBlockReason =
  /** The route involves OmniCoin L1; embedded wallet required for gasless. */
  | 'requires-omnicoin'
  /** WalletConnect is on a different chain than the quote's source chain. */
  | 'wrong-chain'
  /** Route's source chain is not in the connected wallet's supported list. */
  | 'unsupported-chain';

/**
 * True when the quote can only be executed with the embedded mnemonic.
 *
 * Returns true if any step in the quote's route touches OmniCoin L1
 * (chain 88008) — those legs use EIP-2771 gasless meta-transactions
 * which external wallets cannot sign.
 *
 * @param quote - A quote returned by the validator's quote endpoint.
 * @returns True if the embedded wallet is required for this route.
 */
export function requiresEmbeddedWallet(quote: SwapQuote): boolean {
  const route = quote.route;
  if (!Array.isArray(route)) return false;
  return route.some(
    (step) =>
      step.sourceChainId === OMNICOIN_CHAIN_ID ||
      step.targetChainId === OMNICOIN_CHAIN_ID,
  );
}

/**
 * Classify a quote against the currently connected external wallet.
 *
 * Returns null when the quote can be executed as-is. Otherwise returns
 * the reason it is blocked, so the screen can render the right badge
 * and disable the action button.
 *
 * @param quote - Quote to evaluate.
 * @param walletChainId - Chain ID currently active in the external wallet
 *   (from the WC session); pass `undefined` when not connected.
 * @param supportedChainIds - Chains the connected wallet has explicitly
 *   declared support for; pass `undefined` to skip the check.
 * @returns The block reason, or `null` if the quote is executable.
 */
export function classifyQuoteForExternalWallet(
  quote: SwapQuote,
  walletChainId: number | undefined,
  supportedChainIds?: readonly number[],
): ExternalQuoteBlockReason | null {
  if (requiresEmbeddedWallet(quote)) return 'requires-omnicoin';

  const firstStep = quote.route?.[0];
  if (firstStep === undefined) return null;
  const sourceChain = firstStep.sourceChainId;

  if (
    supportedChainIds !== undefined &&
    supportedChainIds.length > 0 &&
    !supportedChainIds.includes(sourceChain)
  ) {
    return 'unsupported-chain';
  }

  if (walletChainId !== undefined && walletChainId !== sourceChain) {
    return 'wrong-chain';
  }

  return null;
}
