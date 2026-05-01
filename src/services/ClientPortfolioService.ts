/**
 * ClientPortfolioService — Mobile, on-device portfolio aggregation.
 *
 * Plan §53 mandates that portfolio aggregation runs on the user's
 * device IP, not the validator. This service replaces the previous
 * `PortfolioClient` that proxied to `/api/v1/wallet/portfolio/:address`
 * (which times out on the live validator and is the architectural
 * regression flagged in `MOBILE_REMEDIATION_PLAN.md` B1).
 *
 * Responsibilities:
 *   1. Native-balance fan-out across the 7 EVM chains supported by
 *      Multicall3 (already wired in `Mobile/src/services/PortfolioService.ts`).
 *   2. ERC-20 balance fan-out for the curated `ERC20_TOKENS` list.
 *   3. USD pricing via `PriceOracle` (CoinGecko + Li.Fi).
 *   4. Returns a snapshot whose shape matches what `usePortfolio` and
 *      `WalletHomeScreen` already render.
 *
 * Cache: in-memory, 30 s TTL (matches WebApp `ClientPortfolioService`).
 *
 * No SecureStore — the snapshot is not sensitive and a refresh is
 * cheap (parallelised, ~1.5 s warm).
 *
 * Failure mode: per-chain failures are absorbed silently (a chain row
 * shows zero balance + an `error` flag the UI can render as a retry
 * pill). Total USD is the sum over chains that succeeded; `error: false`
 * on the snapshot's chains array means "all chains responded".
 *
 * @module services/ClientPortfolioService
 */

import {
  ERC20_TOKENS,
  fetchErc20Balances,
  fetchNativeBalances,
  formatRaw,
  type ChainBalance,
} from './PortfolioService';
import { getTokenUsdPrices, priceKey } from './PriceOracle';
import { fetchFamilyBalances } from './FamilyPortfolioService';
import type { FamilyAddressBundle } from '../store/authStore';
import { logger } from '../utils/logger';

/** A single per-chain entry in the on-device snapshot. */
export interface OnDeviceChainEntry {
  /** EVM chain ID. */
  chainId: number;
  /** Human-readable chain name. */
  chainName: string;
  /** Native-token symbol. */
  nativeSymbol: string;
  /** Native balance (whole units, formatted). */
  nativeBalance: string;
  /** USD value of the native balance. 0 when oracle declines. */
  nativeUsdValue: number;
  /** Sum of native + ERC-20 USD value on this chain. */
  totalUsd: number;
  /** True when the chain failed to query (network, RPC outage). */
  error: boolean;
}

/** A token-row breakdown across chains, sorted descending by USD value. */
export interface OnDeviceTokenRow {
  /** EVM chain ID. */
  chainId: number;
  /** Human-readable chain name. */
  chainName: string;
  /** Symbol (XOM, USDC, ETH, …). */
  symbol: string;
  /** Token contract address (lowercased) or 'native'. */
  contract: string;
  /** Decimal places. */
  decimals: number;
  /** Smallest-unit balance. */
  rawBalance: bigint;
  /** Whole-unit balance (formatted). */
  balance: string;
  /** Per-token USD price; 0 when oracle declined. */
  priceUsd: number;
  /** USD value (balance × priceUsd). */
  usdValue: number;
}

/** Overall snapshot rendered by Wallet Home. */
export interface OnDevicePortfolioSnapshot {
  /** Lowercased EVM address the snapshot was computed for. */
  address: string;
  /** Total USD across all chains + tokens. */
  totalUsd: number;
  /** Optional 24-h change. Future work — Sprint 3 wires this. */
  change24h?: { amount: number; percentage: number };
  /** Per-chain breakdown. */
  chains: OnDeviceChainEntry[];
  /** Flat token list, sorted by USD value descending. */
  tokens: OnDeviceTokenRow[];
  /** ms since epoch when the snapshot was assembled. */
  timestamp: number;
  /** True when at least one chain failed (UI shows a retry banner). */
  hadErrors: boolean;
}

interface CacheEntry {
  snapshot: OnDevicePortfolioSnapshot;
  cachedAt: number;
}

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/**
 * Convert a single ChainBalance row (from `PortfolioService`) into a
 * normalized token row with pricing applied.
 *
 * @param row - Raw balance row.
 * @param prices - Price map keyed by `priceKey(chainId, contract)`.
 * @returns Token row, or undefined when the row carried a fetch error.
 */
function toTokenRow(
  row: ChainBalance,
  prices: Map<string, number>,
  contract: string,
): OnDeviceTokenRow | undefined {
  if (row.error !== undefined) return undefined;
  const balanceStr = formatRaw(row.raw, row.decimals);
  const balanceFloat = Number(balanceStr);
  const priceUsd = prices.get(priceKey(row.chainId, contract === 'native' ? undefined : contract)) ?? 0;
  const usdValue = Number.isFinite(balanceFloat) ? balanceFloat * priceUsd : 0;
  return {
    chainId: row.chainId,
    chainName: row.chainName,
    symbol: row.symbol,
    contract: contract === 'native' ? 'native' : contract.toLowerCase(),
    decimals: row.decimals,
    rawBalance: row.raw,
    balance: balanceStr,
    priceUsd,
    usdValue,
  };
}

/**
 * Build the address cache key. Returns undefined for invalid/empty
 * addresses so the caller can short-circuit.
 *
 * @param address - Hex address (any case).
 * @returns Lowercased address, or undefined when not a 0x-hex 20-byte.
 */
function cacheKey(address: string): string | undefined {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return undefined;
  return address.toLowerCase();
}

/**
 * Fetch the full on-device portfolio snapshot for an EVM address.
 * Each blockchain RPC originates from the device. The validator is
 * NOT consulted.
 *
 * @param address - EVM address.
 * @param force - When true, bypass the 30 s cache.
 * @param familyAddresses - Optional non-EVM family bundle. When
 *   provided, the snapshot also includes BTC / SOL / XRP / TRON /
 *   ATOM / ADA / NEAR / HBAR / XLM / XTZ / DOT rows.
 * @returns Snapshot, or undefined when the address is malformed.
 */
export async function getClientPortfolio(
  address: string,
  force: boolean = false,
  familyAddresses?: FamilyAddressBundle,
): Promise<OnDevicePortfolioSnapshot | undefined> {
  const key = cacheKey(address);
  if (key === undefined) return undefined;
  if (!force) {
    const hit = cache.get(key);
    if (hit !== undefined && Date.now() - hit.cachedAt < TTL_MS) {
      return hit.snapshot;
    }
  }

  // Fan out the EVM balance queries + the non-EVM family fetchers in
  // parallel. Native + ERC-20 each emit per-chain error rows on
  // individual chain failures, so a partial result is normal.
  const [nativeRows, erc20Rows, familyResult] = await Promise.all([
    fetchNativeBalances(address),
    fetchErc20Balances(address),
    familyAddresses !== undefined ? fetchFamilyBalances(familyAddresses) : Promise.resolve(undefined),
  ]);

  // Build the price-request set up front so the oracle batch is one
  // round trip per provider (CoinGecko / Li.Fi) instead of N round
  // trips per row.
  const priceRequests: Array<{ chainId: number; contract: string | undefined }> = [];
  for (const r of nativeRows) {
    if (r.error === undefined) {
      priceRequests.push({ chainId: r.chainId, contract: undefined });
    }
  }
  for (const tok of ERC20_TOKENS) {
    priceRequests.push({ chainId: tok.chainId, contract: tok.address });
  }
  const prices = await getTokenUsdPrices(priceRequests);

  // Per-chain rollup. We index the ERC-20 rows by chain so we can sum
  // alongside the native row in one pass.
  const erc20ByChain = new Map<number, ChainBalance[]>();
  for (const row of erc20Rows) {
    if (row.error !== undefined) continue;
    const arr = erc20ByChain.get(row.chainId) ?? [];
    arr.push(row);
    erc20ByChain.set(row.chainId, arr);
  }
  // Pre-build a lookup so we can find a token's contract address by
  // chain+symbol — fetchErc20Balances doesn't carry the contract on
  // the ChainBalance row.
  const erc20ContractBySymbol = new Map<string, string>();
  for (const tok of ERC20_TOKENS) {
    erc20ContractBySymbol.set(`${tok.chainId}:${tok.symbol}`, tok.address);
  }

  const tokens: OnDeviceTokenRow[] = [];
  const chains: OnDeviceChainEntry[] = [];
  let totalUsd = 0;
  let hadErrors = false;

  for (const native of nativeRows) {
    if (native.error !== undefined) {
      hadErrors = true;
      chains.push({
        chainId: native.chainId,
        chainName: native.chainName,
        nativeSymbol: native.symbol,
        nativeBalance: '0',
        nativeUsdValue: 0,
        totalUsd: 0,
        error: true,
      });
      continue;
    }
    const nativeRow = toTokenRow(native, prices, 'native');
    let nativeUsd = 0;
    if (nativeRow !== undefined) {
      nativeUsd = nativeRow.usdValue;
      tokens.push(nativeRow);
    }
    const erc20s = erc20ByChain.get(native.chainId) ?? [];
    let erc20Total = 0;
    for (const erc of erc20s) {
      const contract = erc20ContractBySymbol.get(`${erc.chainId}:${erc.symbol}`);
      if (contract === undefined) continue;
      const row = toTokenRow(erc, prices, contract);
      if (row === undefined) continue;
      tokens.push(row);
      erc20Total += row.usdValue;
    }
    const chainTotal = nativeUsd + erc20Total;
    totalUsd += chainTotal;
    chains.push({
      chainId: native.chainId,
      chainName: native.chainName,
      nativeSymbol: native.symbol,
      nativeBalance: nativeRow?.balance ?? '0',
      nativeUsdValue: nativeUsd,
      totalUsd: chainTotal,
      error: false,
    });
  }

  // Detect any per-chain ERC-20 error not also present on the native row.
  for (const row of erc20Rows) {
    if (row.error !== undefined) hadErrors = true;
  }

  // Merge in non-EVM family rows + their dollar totals.
  if (familyResult !== undefined) {
    for (const row of familyResult.rows) {
      tokens.push(row);
      // Family chains roll up as their own per-chain entry too, so the
      // wallet-home chain card count reflects holdings across the full
      // wallet.
      chains.push({
        chainId: row.chainId,
        chainName: row.chainName,
        nativeSymbol: row.symbol,
        nativeBalance: row.balance,
        nativeUsdValue: row.usdValue,
        totalUsd: row.usdValue,
        error: false,
      });
    }
    totalUsd += familyResult.totalUsd;
    if (familyResult.hadErrors) hadErrors = true;
  }

  // Sort tokens by USD value descending; equal-value rows fall back to
  // bigint balance comparison so stable ordering remains.
  tokens.sort((a, b) => {
    if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
    if (a.rawBalance < b.rawBalance) return 1;
    if (a.rawBalance > b.rawBalance) return -1;
    return 0;
  });

  const snapshot: OnDevicePortfolioSnapshot = {
    address: key,
    totalUsd,
    chains,
    tokens,
    timestamp: Date.now(),
    hadErrors,
  };
  cache.set(key, { snapshot, cachedAt: Date.now() });
  logger.debug('[client-portfolio] computed snapshot', {
    address: key,
    chains: chains.length,
    totalUsd,
    hadErrors,
  });
  return snapshot;
}

/** Drop every cached snapshot. Used after sign-out and on manual refresh. */
export function clearClientPortfolioCache(): void {
  cache.clear();
}
