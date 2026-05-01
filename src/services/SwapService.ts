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
  type ExecuteResponse,
  type QuoteResponse,
  type SwapQuote,
  type UnsignedSwapTransaction,
  type UniversalSwapQuoteParams,
} from '@wallet/services/dex/UniversalSwapClient';

import { submitTransaction } from './RelaySubmitService';
import { requiresEmbeddedWallet } from './swapRouteClassification';

export type {
  ExecuteResponse,
  QuoteResponse,
  SwapQuote,
  UniversalSwapQuoteParams,
};

/** Canonical native-token sentinel used by the validator. */
export const NATIVE_TOKEN_SENTINEL =
  '0x0000000000000000000000000000000000000000';

/** Common token shortcuts for the Mobile swap dropdown. */
export interface TokenShortcut {
  chainId: number;
  symbol: string;
  /** Contract address or NATIVE_TOKEN_SENTINEL for the chain-native. */
  address: string;
  decimals: number;
}

export const COMMON_TOKENS: TokenShortcut[] = [
  {
    chainId: 88008,
    symbol: 'XOM',
    address: NATIVE_TOKEN_SENTINEL,
    decimals: 18,
  },
  { chainId: 1, symbol: 'ETH', address: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  {
    chainId: 1,
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  {
    chainId: 1,
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
  {
    chainId: 42161,
    symbol: 'ETH',
    address: NATIVE_TOKEN_SENTINEL,
    decimals: 18,
  },
  {
    chainId: 42161,
    symbol: 'USDC',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
  },
  {
    chainId: 8453,
    symbol: 'ETH',
    address: NATIVE_TOKEN_SENTINEL,
    decimals: 18,
  },
  {
    chainId: 8453,
    symbol: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
  },
  {
    chainId: 137,
    symbol: 'MATIC',
    address: NATIVE_TOKEN_SENTINEL,
    decimals: 18,
  },
  {
    chainId: 137,
    symbol: 'USDC',
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
  },
];

/**
 * Fetch a swap quote from the validator. The first element of
 * {@link QuoteResponse.quotes} is the validator's preferred route.
 *
 * @param params - Quote request parameters.
 * @returns The full quote response (first element is best).
 */
export async function getQuote(
  params: UniversalSwapQuoteParams,
): Promise<QuoteResponse> {
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
export function classifySwap(
  params: Pick<
    UniversalSwapQuoteParams,
    'sourceChainId' | 'targetChainId' | 'tokenInSymbol' | 'tokenOutSymbol'
  >,
): 'same-chain-swap' | 'bridge-only' | 'bridge-and-swap' {
  const sameChain = params.sourceChainId === params.targetChainId;
  const sameToken = params.tokenInSymbol === params.tokenOutSymbol;
  if (sameChain) return 'same-chain-swap';
  if (sameToken) return 'bridge-only';
  return 'bridge-and-swap';
}

/** Final result of an executed swap. */
export interface ExecuteSwapResult {
  /** Validator-issued operation ID for status polling. */
  operationId: string;
  /** Hashes of every transaction the client broadcast, in execution order. */
  txHashes: string[];
  /** Chains each tx hash landed on — same length / order as txHashes. */
  chainIds: number[];
  /** The ExecuteResponse.status value as of the last call. */
  status: string;
  /** Human-readable status message from the validator. */
  message: string;
}

/** How the per-tx sign + broadcast should be performed. */
export type SwapSigner =
  /** BIP39 mnemonic in memory — gasless on L1 via OmniRelay, direct otherwise. */
  | { kind: 'embedded'; mnemonic: string }
  /** WalletConnect v2 session — pop the connected wallet for each tx. */
  | { kind: 'walletconnect' };

/**
 * Execute a previously-quoted swap.
 *
 * Flow:
 *   1. Call `UniversalSwapClient.execute(quoteId, address)` — validator
 *      returns an `operationId` plus an ordered array of unsigned txs.
 *   2. Sign + broadcast each tx in sequence, waiting for inclusion
 *      (1 confirmation) before moving to the next. This matches the
 *      validator's expectation that a "bridge" step lands before it
 *      polls the bridge oracle for attestation.
 *   3. Call `submitSignedTx(opId, txHash, step)` after each on-chain
 *      broadcast so the validator's status aggregator can track the
 *      operation without waiting for its own mempool observer.
 *
 * Embedded mode keeps the mnemonic in memory only for the duration of
 * this function. WalletConnect mode forwards each unsigned tx to the
 * paired wallet via `eth_sendTransaction`; routes that touch OmniCoin
 * L1 are rejected because external EOAs cannot sign EIP-2771 forward
 * requests for OmniRelay.
 *
 * @param params - Quote ID + address + the chosen signer.
 * @returns ExecuteSwapResult with every broadcast tx hash.
 * @throws Error when WalletConnect mode is selected but the route
 *   requires the embedded mnemonic (XOM-leg present).
 */
export async function executeQuote(params: {
  quoteId: string;
  address: string;
  signer: SwapSigner;
}): Promise<ExecuteSwapResult> {
  const client = getUniversalSwapClient();
  const response: ExecuteResponse = await client.execute(
    params.quoteId,
    params.address,
  );

  const txHashes: string[] = [];
  const chainIds: number[] = [];

  const unsigned = response.transactions ?? [];

  if (
    params.signer.kind === 'walletconnect' &&
    unsigned.some((t) => t.chainId === 88008)
  ) {
    throw new Error(
      'This route uses OmniCoin and must be signed by the embedded wallet. ' +
        'Switch to OmniWallet for OmniCoin swaps.',
    );
  }

  // Lazy-load the WC service only when actually using it. Static import
  // would force `@walletconnect/react-native-compat` to evaluate at
  // module-load time, which (a) installs RN-only globals that Jest can't
  // satisfy and (b) costs bundle size for users who never connect a WC
  // wallet. Embedded-mode callers stay on the cold path.
  const wc =
    params.signer.kind === 'walletconnect'
      ? (await import('./WalletConnectService')).getWalletConnect()
      : null;

  for (const tx of unsigned) {
    const hash =
      params.signer.kind === 'walletconnect'
        ? await wc!.sendTransaction(tx.chainId, {
            from: params.address,
            to: tx.to,
            data: tx.data,
            ...(tx.value !== '' &&
              tx.value !== '0' && {
                value: '0x' + BigInt(tx.value).toString(16),
              }),
          })
        : await submitTransaction(
            { to: tx.to, data: tx.data, value: tx.value, chainId: tx.chainId },
            params.signer.mnemonic,
          );
    txHashes.push(hash);
    chainIds.push(tx.chainId);
    // Route the on-chain hash back to the validator so it can track
    // the operation. 'claim' is the only non-'deposit' step we see
    // client-side today (CCTP/Wormhole manual claim); everything else
    // reports as 'deposit'.
    const reportStep = tx.step === 'claim' ? 'claim' : 'deposit';
    try {
      await client.submitSignedTx(response.operationId, hash, reportStep);
    } catch (err) {
      // Non-fatal — the validator will still observe the tx via its
      // own mempool aggregator; we just lose the faster-path status
      // push. Surface as a warn rather than throwing so the client
      // considers the step successful.
      console.warn('[swap-execute] submitSignedTx failed', err);
    }
  }

  return {
    operationId: response.operationId,
    txHashes,
    chainIds,
    status: response.status,
    message: response.message,
  };
}

/** Re-export so screens can import the embedded-wallet predicate. */
export { requiresEmbeddedWallet };

// Note: the per-tx sign/broadcast/relay logic lives in
// `./RelaySubmitService.submitTransaction`, which chooses OmniRelay for
// chainId 88008 (gasless) vs direct broadcast otherwise. `UnsignedSwapTransaction`
// stays exported so UI code can render the pending step list.
export type { UnsignedSwapTransaction };
