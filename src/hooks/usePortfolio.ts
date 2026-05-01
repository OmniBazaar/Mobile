/**
 * usePortfolio — React hook that produces an on-device portfolio
 * snapshot for the signed-in user.
 *
 * The hook drives `ClientPortfolioService.getClientPortfolio()`, which
 * fans out balance reads across the 7 EVM chains via Multicall3 and
 * prices them via the on-device PriceOracle. No validator round-trip
 * is involved — the validator's `/api/v1/wallet/portfolio/:address`
 * endpoint is intentionally NOT consulted here. (Architectural mandate
 * §53: every blockchain balance call originates from the user's IP.)
 *
 * Snapshot shape preserves backwards compatibility with the previous
 * version of `usePortfolio`: the WalletHomeScreen reads `totalUsd`,
 * `change24h`, and `chains[]`. Sprint 3 wires `change24h` from a
 * historical-price source.
 *
 * @module hooks/usePortfolio
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getClientPortfolio } from '../services/ClientPortfolioService';
import { logger } from '../utils/logger';

/** Per-chain breakdown rendered by the home screen. */
export interface PortfolioChainEntry {
  chainId: number;
  chainName: string;
  nativeBalance: string;
  nativeSymbol: string;
  nativeUsdValue: number;
  totalUsd: number;
}

/** Top-level portfolio shape rendered by the home screen. */
export interface PortfolioSnapshot {
  totalUsd: number;
  /**
   * 24-hour change. Sprint 3 fills this with a real value from a
   * historical-price source. Until then we emit zeroes so the UI's
   * defensive guard renders nothing rather than crashing.
   */
  change24h: { amount: number; percentage: number };
  chains: PortfolioChainEntry[];
  lastUpdated: number;
  /** True when at least one chain failed; UI shows a retry banner. */
  hadErrors: boolean;
}

/** Return value of the hook. */
export interface UsePortfolioResult {
  /** Latest portfolio snapshot, undefined while loading initial fetch. */
  portfolio: PortfolioSnapshot | undefined;
  /** True while the initial / refresh fetch is in flight. */
  loading: boolean;
  /** Error message if the most recent fetch failed. */
  error: string | undefined;
  /** Force-refresh, bypassing the 30 s cache. */
  refresh: () => void;
}

/**
 * Fetch + cache the full on-device portfolio for the authenticated
 * user.
 *
 * @returns Loading / data / error state plus a manual refresh trigger.
 */
export function usePortfolio(): UsePortfolioResult {
  const address = useAuthStore((s) => s.address);
  const familyAddresses = useAuthStore((s) => s.familyAddresses);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (address === '') {
      setPortfolio(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void (async (): Promise<void> => {
      try {
        const result = await getClientPortfolio(address, refreshTick > 0, familyAddresses);
        if (cancelled) return;
        if (result === undefined) {
          setError('invalid_address');
          return;
        }
        setPortfolio({
          totalUsd: result.totalUsd,
          change24h: result.change24h ?? { amount: 0, percentage: 0 },
          chains: result.chains.map((c) => ({
            chainId: c.chainId,
            chainName: c.chainName,
            nativeBalance: c.nativeBalance,
            nativeSymbol: c.nativeSymbol,
            nativeUsdValue: c.nativeUsdValue,
            totalUsd: c.totalUsd,
          })),
          lastUpdated: result.timestamp,
          hadErrors: result.hadErrors,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('usePortfolio: fetch failed', { address, msg });
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [address, refreshTick, familyAddresses]);

  const refresh = useCallback((): void => {
    setRefreshTick((n) => n + 1);
  }, []);

  return { portfolio, loading, error, refresh };
}
