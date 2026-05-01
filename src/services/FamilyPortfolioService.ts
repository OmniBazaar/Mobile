/**
 * FamilyPortfolioService — fan-out across the non-EVM balance fetchers
 * exposed by `@wallet/core/providers/familyBalanceFetchers`.
 *
 * Each fetcher returns `{ raw, decimals, symbol }` (or undefined when
 * every endpoint fails). We map the result to the
 * {@link OnDeviceTokenRow} shape so it slots into the same UI as EVM
 * rows.
 *
 * Pricing: native-token CoinGecko slugs; we use the same `PriceOracle`
 * machinery, just with synthetic chain IDs above 10_000 so they don't
 * collide with real EVM chain IDs. The synthetic ID is purely a
 * Mobile-internal sentinel — the validator never sees it.
 *
 * @module services/FamilyPortfolioService
 */

import {
  fetchBitcoinFamilyBalance,
  fetchCardanoBalance,
  fetchCosmosBalance,
  fetchHederaBalance,
  fetchNearBalance,
  fetchPolkadotBalance,
  fetchSolanaBalance,
  fetchStellarBalance,
  fetchTezosBalance,
  fetchTronBalance,
  fetchXrpBalance,
} from '@wallet/core/providers/familyBalanceFetchers';

import type { FamilyAddressBundle } from '../store/authStore';
import type { OnDeviceTokenRow } from './ClientPortfolioService';
import { logger } from '../utils/logger';

/** Synthetic per-family chain IDs for the portfolio map. */
export const FAMILY_CHAIN_IDS: Readonly<Record<string, number>> = {
  bitcoin: 100_001,
  solana: 100_002,
  polkadot: 100_003,
  cosmos: 100_004,
  cardano: 100_005,
  xrp: 100_006,
  tron: 100_007,
  near: 100_008,
  hedera: 100_009,
  stellar: 100_010,
  tezos: 100_011,
};

/** Display names for the synthetic chains. */
const FAMILY_NAME: Readonly<Record<string, string>> = {
  bitcoin: 'Bitcoin',
  solana: 'Solana',
  polkadot: 'Polkadot',
  cosmos: 'Cosmos',
  cardano: 'Cardano',
  xrp: 'XRP',
  tron: 'Tron',
  near: 'NEAR',
  hedera: 'Hedera',
  stellar: 'Stellar',
  tezos: 'Tezos',
};

/** CoinGecko slug for native-asset pricing. */
const FAMILY_COINGECKO: Readonly<Record<string, string>> = {
  bitcoin: 'bitcoin',
  solana: 'solana',
  polkadot: 'polkadot',
  cosmos: 'cosmos',
  cardano: 'cardano',
  xrp: 'ripple',
  tron: 'tron',
  near: 'near',
  hedera: 'hedera-hashgraph',
  stellar: 'stellar',
  tezos: 'tezos',
};

/** Price-cache TTL kept in lock-step with PriceOracle. */
const TTL_MS = 5 * 60 * 1000;
const priceCache = new Map<string, { usd: number; ts: number }>();

/**
 * Look up the USD price for a family by CoinGecko slug. 8-second timeout
 * so a slow oracle doesn't block the whole portfolio.
 *
 * @param family - Family key.
 * @returns USD price per whole unit, or 0 when unavailable.
 */
async function priceFor(family: string): Promise<number> {
  const slug = FAMILY_COINGECKO[family];
  if (slug === undefined) return 0;
  const cached = priceCache.get(family);
  if (cached !== undefined && Date.now() - cached.ts < TTL_MS) return cached.usd;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(slug)}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) return 0;
    const json = (await r.json()) as Record<string, { usd?: number }>;
    const v = json[slug]?.usd;
    if (typeof v === 'number' && Number.isFinite(v)) {
      priceCache.set(family, { usd: v, ts: Date.now() });
      return v;
    }
  } catch (err) {
    logger.debug('[family-price] failed', {
      family,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return 0;
}

/** Format a bigint balance to a human-readable decimal string. */
function formatRaw(raw: bigint, decimals: number, maxFraction = 6): string {
  if (raw === 0n) return '0';
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = raw % scale;
  if (frac === 0n) return whole.toString();
  let fStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (fStr.length > maxFraction) fStr = fStr.slice(0, maxFraction);
  return fStr === '' ? whole.toString() : `${whole.toString()}.${fStr}`;
}

/**
 * Fetch balances + prices for every populated family in `bundle`.
 * Each family timed out at 8 s in the underlying fetcher; outer
 * Promise.all runs them in parallel.
 *
 * @param bundle - Address bundle from authStore.
 * @returns Token rows ready to merge into the EVM portfolio.
 */
export async function fetchFamilyBalances(
  bundle: FamilyAddressBundle,
): Promise<{ rows: OnDeviceTokenRow[]; totalUsd: number; hadErrors: boolean }> {
  const rows: OnDeviceTokenRow[] = [];
  let totalUsd = 0;
  let hadErrors = false;

  const tasks: Array<Promise<void>> = [];

  /** Unified per-family handler. */
  function add(family: string, address: string | undefined, fetcher: () => Promise<{ raw: bigint; decimals: number; symbol: string } | undefined>): void {
    if (address === undefined || address === '') return;
    tasks.push(
      (async () => {
        try {
          const result = await fetcher();
          if (result === undefined) {
            hadErrors = true;
            return;
          }
          const price = await priceFor(family);
          const balanceStr = formatRaw(result.raw, result.decimals);
          const usdValue = Number.isFinite(Number(balanceStr))
            ? Number(balanceStr) * price
            : 0;
          rows.push({
            chainId: FAMILY_CHAIN_IDS[family] ?? 100_000,
            chainName: FAMILY_NAME[family] ?? family,
            symbol: result.symbol,
            contract: 'native',
            decimals: result.decimals,
            rawBalance: result.raw,
            balance: balanceStr,
            priceUsd: price,
            usdValue,
          });
          totalUsd += usdValue;
        } catch (err) {
          hadErrors = true;
          logger.debug('[family-fetch] failed', {
            family,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      })(),
    );
  }

  add('bitcoin', bundle.bitcoin, () => fetchBitcoinFamilyBalance('bitcoin', bundle.bitcoin ?? ''));
  add('solana', bundle.solana, () => fetchSolanaBalance(bundle.solana ?? ''));
  add('polkadot', bundle.polkadot, () => fetchPolkadotBalance(bundle.polkadot ?? ''));
  add('cosmos', bundle.cosmos, () => fetchCosmosBalance(bundle.cosmos ?? ''));
  add('cardano', bundle.cardano, () => fetchCardanoBalance(bundle.cardano ?? ''));
  add('xrp', bundle.xrp, () => fetchXrpBalance(bundle.xrp ?? ''));
  add('tron', bundle.tron, () => fetchTronBalance(bundle.tron ?? ''));
  add('near', bundle.near, () => fetchNearBalance(bundle.near ?? ''));
  add('hedera', bundle.hedera, () => fetchHederaBalance(bundle.hedera ?? ''));
  add('stellar', bundle.stellar, () => fetchStellarBalance(bundle.stellar ?? ''));
  add('tezos', bundle.tezos, () => fetchTezosBalance(bundle.tezos ?? ''));

  await Promise.all(tasks);
  return { rows, totalUsd, hadErrors };
}
