/**
 * PriceOracle — Mobile-side price quotes for portfolio valuation.
 *
 * The mandate is *self-sovereign price acquisition* — the validator
 * cannot be the only source. We hit CoinGecko's public API first
 * (free tier, no API key needed for the small symbol set we ask for)
 * and Li.Fi's `/v1/token` endpoint as fallback. Both are queried from
 * the user's device IP, so the validators carry no per-user portfolio
 * load.
 *
 * Cache:
 *   - In-memory only (no SecureStore — prices are not sensitive).
 *   - 5-minute TTL per (chainId, contractAddress|'native') pair.
 *   - Cap of 200 entries; LRU eviction.
 *
 * Failure mode:
 *   - When all sources fail for a token, return `undefined`. Callers
 *     render the row at $0 with no warning UI — the user already sees
 *     the raw balance, which is the load-bearing fact. Sprint 3 adds
 *     a "price unavailable" annotation.
 *
 * @module services/PriceOracle
 */

import { logger } from '../utils/logger';

/** Per-token cache entry. */
interface CacheEntry {
  usd: number;
  cachedAt: number;
}

/** 5 minutes — short enough to feel fresh, long enough to absorb tab bursts. */
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;

/** Per-chain CoinGecko slug for native tokens. Hand-curated; safe to extend. */
const COINGECKO_NATIVE_SLUG: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'ethereum',         // OP-stack uses ETH
  56: 'binancecoin',
  137: 'matic-network',
  8453: 'ethereum',       // Base uses ETH
  42161: 'ethereum',      // Arbitrum uses ETH
  43114: 'avalanche-2',
  88008: 'omnicoin',      // OmniCoin L1 native; if not on CoinGecko, falls back to OmniDEX TWAP via validator
};

/** Per-chain CoinGecko platform slug for ERC-20 lookups. */
const COINGECKO_PLATFORM: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  56: 'binance-smart-chain',
  137: 'polygon-pos',
  8453: 'base',
  42161: 'arbitrum-one',
  43114: 'avalanche',
};

/** In-memory cache keyed by `${chainId}:${contract|'native'}`. */
const cache = new Map<string, CacheEntry>();

/**
 * Build the cache key. `native` for the chain's gas token; otherwise
 * the lowercased ERC-20 contract address.
 *
 * @param chainId - EVM chain ID.
 * @param contract - Contract address or `undefined`/`'native'` for the gas token.
 * @returns Cache key.
 */
function keyFor(chainId: number, contract: string | undefined): string {
  const c = contract === undefined || contract === '' ? 'native' : contract.toLowerCase();
  return `${chainId}:${c}`;
}

/** Drop the oldest entry once we exceed `MAX_ENTRIES`. */
function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;
  // Map iteration order is insertion order — drop the first (oldest).
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) cache.delete(firstKey);
}

/**
 * Fetch a native-token price by chain. Returns `undefined` when every
 * provider declines or errors.
 *
 * @param chainId - EVM chain ID.
 * @returns USD price per whole unit (e.g. `1850.42` for ETH), or undefined.
 */
async function fetchNativePrice(chainId: number): Promise<number | undefined> {
  const slug = COINGECKO_NATIVE_SLUG[chainId];
  if (slug === undefined) return undefined;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(slug)}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) return undefined;
    const json = (await r.json()) as Record<string, { usd?: number }>;
    const price = json[slug]?.usd;
    return typeof price === 'number' && Number.isFinite(price) ? price : undefined;
  } catch (err) {
    logger.debug('PriceOracle.fetchNativePrice failed', {
      chainId,
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Fetch an ERC-20 price by (chainId, contract). Tries CoinGecko first,
 * then Li.Fi `/v1/token` as fallback.
 *
 * @param chainId - EVM chain ID.
 * @param contract - ERC-20 contract address (any case).
 * @returns USD price per whole unit, or undefined.
 */
async function fetchErc20Price(
  chainId: number,
  contract: string,
): Promise<number | undefined> {
  const platform = COINGECKO_PLATFORM[chainId];
  const lcContract = contract.toLowerCase();
  if (platform !== undefined) {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/${encodeURIComponent(platform)}` +
          `?contract_addresses=${encodeURIComponent(lcContract)}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (r.ok) {
        const json = (await r.json()) as Record<string, { usd?: number }>;
        const price = json[lcContract]?.usd;
        if (typeof price === 'number' && Number.isFinite(price)) return price;
      }
    } catch (err) {
      logger.debug('PriceOracle CoinGecko ERC-20 failed', {
        chainId,
        contract: lcContract,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // Li.Fi fallback. Their `/v1/token` accepts (chain, token) and returns
  // `priceUSD` as a string — same shape regardless of chain.
  try {
    const r = await fetch(
      `https://li.quest/v1/token?chain=${chainId}&token=${encodeURIComponent(lcContract)}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) return undefined;
    const json = (await r.json()) as { priceUSD?: string };
    const parsed = json.priceUSD !== undefined ? Number(json.priceUSD) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  } catch (err) {
    logger.debug('PriceOracle Li.Fi ERC-20 failed', {
      chainId,
      contract: lcContract,
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Get the USD price for a token. Caches every successful read for 5
 * minutes; never caches `undefined` (so a transient outage doesn't
 * persist past a retry).
 *
 * @param chainId - EVM chain ID.
 * @param contract - ERC-20 address; pass `undefined` for native gas token.
 * @returns USD price per whole unit, or undefined.
 */
export async function getTokenUsdPrice(
  chainId: number,
  contract: string | undefined,
): Promise<number | undefined> {
  const k = keyFor(chainId, contract);
  const hit = cache.get(k);
  if (hit !== undefined && Date.now() - hit.cachedAt < TTL_MS) {
    return hit.usd;
  }
  const fresh =
    contract === undefined || contract === '' || contract === 'native'
      ? await fetchNativePrice(chainId)
      : await fetchErc20Price(chainId, contract);
  if (fresh !== undefined) {
    cache.set(k, { usd: fresh, cachedAt: Date.now() });
    evictIfNeeded();
  }
  return fresh;
}

/**
 * Batch helper — fetch many prices in parallel and return a map.
 * Missing entries (oracle declined or threw) are simply absent from
 * the map.
 *
 * @param requests - Array of (chainId, contract) tuples.
 * @returns Map keyed by `keyFor(chainId, contract)`.
 */
export async function getTokenUsdPrices(
  requests: ReadonlyArray<{ chainId: number; contract: string | undefined }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  await Promise.all(
    requests.map(async (req) => {
      const price = await getTokenUsdPrice(req.chainId, req.contract);
      if (price !== undefined) {
        out.set(keyFor(req.chainId, req.contract), price);
      }
    }),
  );
  return out;
}

/** Wipe the cache. Mostly used by tests + after-network-change refresh. */
export function clearPriceCache(): void {
  cache.clear();
}

/** Build the same key the cache uses, for callers reading the map. */
export const priceKey = keyFor;
