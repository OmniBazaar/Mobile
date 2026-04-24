/**
 * PortfolioService — Mobile-side multi-chain balance fetcher.
 *
 * Fans out native-balance queries across every EVM chain the user has
 * enabled. Uses Wallet's MulticallService (which batches via Multicall3
 * on the 7 supported chains and falls back to direct per-address reads
 * elsewhere) so Mobile inherits the same RPC-decentralization story as
 * the extension: every call originates from the user's device IP, not
 * the validator.
 *
 * Phase 2 scope:
 *   - Native balances on ETH, ARB, OP, BASE, POLY, BSC, AVAX (Multicall3)
 *   - OmniCoin L1 (chain 88008) native balance via ClientRPCRegistry
 *   - Returns a shape the portfolio UI can render immediately
 *
 * Non-EVM families (BTC, SOL, XRP, …) land in Phase 2 Week 2 via
 * familyBalanceFetchers; this service just exposes a placeholder stub
 * for them for now so the UI can render a "pending" state.
 */

import {
  getErc20Balances,
  getNativeBalances,
} from '@wallet/core/providers/MulticallService';

/** Per-chain native balance entry. */
export interface ChainBalance {
  /** EVM chain ID (or synthetic ID for non-EVM families). */
  chainId: number;
  /** Human-readable chain name. */
  chainName: string;
  /** Native-token symbol ("ETH", "XOM", "MATIC", …). */
  symbol: string;
  /** Raw balance in the chain's smallest unit (wei for EVM, sats for BTC, …). */
  raw: bigint;
  /** Decimal places for display. */
  decimals: number;
  /** Optional USD value; undefined until the price oracle lands. */
  usdValue?: number;
  /** Populated on fetch error; the UI can show a retry affordance. */
  error?: string;
}

/** Chains we query on every portfolio refresh in Phase 2. */
const CHAINS: Array<{
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
}> = [
  { chainId: 88008, name: 'OmniCoin', symbol: 'XOM', decimals: 18 },
  { chainId: 1, name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  { chainId: 10, name: 'Optimism', symbol: 'ETH', decimals: 18 },
  { chainId: 56, name: 'BNB Chain', symbol: 'BNB', decimals: 18 },
  { chainId: 137, name: 'Polygon', symbol: 'MATIC', decimals: 18 },
  { chainId: 8453, name: 'Base', symbol: 'ETH', decimals: 18 },
  { chainId: 42161, name: 'Arbitrum', symbol: 'ETH', decimals: 18 },
  { chainId: 43114, name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
];

/**
 * Fetch native balances for a single address across every chain the
 * Mobile portfolio screen cares about. Chain failures are captured
 * per-row rather than thrown — the UI shows a retry pill for the
 * individual chain and every other chain renders normally.
 *
 * @param address - EVM address (checksum case not required).
 * @returns Array of {@link ChainBalance} rows, one per CHAINS entry.
 */
export async function fetchNativeBalances(address: string): Promise<ChainBalance[]> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`PortfolioService.fetchNativeBalances: invalid address ${address}`);
  }

  const results = await Promise.all(
    CHAINS.map(async (chain) => {
      try {
        const map = await getNativeBalances(chain.chainId, [address]);
        const raw = map.get(address.toLowerCase()) ?? map.get(address) ?? 0n;
        return {
          chainId: chain.chainId,
          chainName: chain.name,
          symbol: chain.symbol,
          decimals: chain.decimals,
          raw,
        };
      } catch (err) {
        return {
          chainId: chain.chainId,
          chainName: chain.name,
          symbol: chain.symbol,
          decimals: chain.decimals,
          raw: 0n,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return results;
}

/**
 * Sum a set of chain balances into a naive "ETH-equivalent" total.
 *
 * Phase 2 placeholder: until the price oracle lands we can't produce a
 * real USD total; instead this returns the count of non-zero rows and
 * the largest chain balance's decimal-adjusted number so the UI has
 * something meaningful to display in the portfolio hero card.
 *
 * @param balances - Rows from {@link fetchNativeBalances}.
 * @returns Summary numbers.
 */
export function summarize(balances: ChainBalance[]): {
  nonZeroChains: number;
  totalErrorRows: number;
} {
  let nonZero = 0;
  let errors = 0;
  for (const b of balances) {
    if (b.error !== undefined) errors += 1;
    if (b.raw > 0n) nonZero += 1;
  }
  return { nonZeroChains: nonZero, totalErrorRows: errors };
}

/** ERC-20 token entry the portfolio knows how to query. */
export interface Erc20Token {
  chainId: number;
  /** Contract address (EIP-55 or lowercase — both accepted). */
  address: string;
  /** Display symbol ("USDC", "USDT", …). */
  symbol: string;
  /** Decimals as declared on-chain. */
  decimals: number;
}

/**
 * Curated ERC-20 list matching the Phase 2 chain set. Every entry maps
 * to a canonical contract address that the validator's price oracle
 * understands. Extend as new tokens go live.
 */
export const ERC20_TOKENS: Erc20Token[] = [
  { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
  { chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
  { chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
  { chainId: 42161, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
  { chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  { chainId: 137, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6 },
  { chainId: 137, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
  { chainId: 10, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 },
  { chainId: 43114, address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 },
];

/**
 * Fetch ERC-20 balances for `address` across every configured token,
 * grouped by chain. One Multicall3 batch per chain keeps the request
 * count tight.
 *
 * @param address - EVM address to query.
 * @returns Array of {@link ChainBalance} rows — one per ERC-20 with a
 *   non-zero balance plus error rows when the chain-level call fails.
 */
export async function fetchErc20Balances(address: string): Promise<ChainBalance[]> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`PortfolioService.fetchErc20Balances: invalid address ${address}`);
  }

  // Group tokens by chain so each chain gets one Multicall3 batch.
  const byChain = new Map<number, Erc20Token[]>();
  for (const tok of ERC20_TOKENS) {
    const existing = byChain.get(tok.chainId) ?? [];
    existing.push(tok);
    byChain.set(tok.chainId, existing);
  }

  const results: ChainBalance[] = [];
  await Promise.all(
    Array.from(byChain.entries()).map(async ([chainId, tokens]) => {
      try {
        const tokenAddresses = tokens.map((t) => t.address);
        const balances = await getErc20Balances(chainId, address, tokenAddresses);
        for (const tok of tokens) {
          const key = tok.address.toLowerCase();
          const raw = balances.get(key) ?? balances.get(tok.address) ?? 0n;
          if (raw > 0n) {
            results.push({
              chainId,
              chainName: chainNameFor(chainId),
              symbol: tok.symbol,
              decimals: tok.decimals,
              raw,
            });
          }
        }
      } catch (err) {
        // Surface the chain as a single error row so the UI shows a
        // "refresh this chain" affordance instead of silently dropping it.
        results.push({
          chainId,
          chainName: chainNameFor(chainId),
          symbol: 'ERC-20',
          decimals: 6,
          raw: 0n,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  return results;
}

/** Map chain ID to the display name used in ChainBalance rows. */
function chainNameFor(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum';
    case 10:
      return 'Optimism';
    case 56:
      return 'BNB Chain';
    case 137:
      return 'Polygon';
    case 8453:
      return 'Base';
    case 42161:
      return 'Arbitrum';
    case 43114:
      return 'Avalanche';
    case 88008:
      return 'OmniCoin';
    default:
      return `Chain ${chainId}`;
  }
}

/**
 * Convert a bigint balance to a human-readable decimal string.
 *
 * @param raw - Smallest-unit balance.
 * @param decimals - Decimal places for the token.
 * @param maxFractionDigits - Display precision (default 6).
 * @returns Decimal string (no thousands separator).
 */
export function formatRaw(raw: bigint, decimals: number, maxFractionDigits: number = 6): string {
  if (raw === 0n) return '0';
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = raw % scale;
  if (frac === 0n) return whole.toString();
  let fracStr = frac.toString().padStart(decimals, '0');
  // Trim trailing zeros
  fracStr = fracStr.replace(/0+$/, '');
  if (fracStr.length > maxFractionDigits) {
    fracStr = fracStr.slice(0, maxFractionDigits);
  }
  return fracStr === '' ? whole.toString() : `${whole.toString()}.${fracStr}`;
}
