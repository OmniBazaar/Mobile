/**
 * usePortfolio — React hook that fetches the multi-chain portfolio for
 * the signed-in user from the validator.
 *
 * Mobile-equivalent of the Wallet popup's `PortfolioAnalyticsPage`
 * fetcher: calls `PortfolioService.getPortfolio(address)` once on
 * mount, exposes `{ portfolio, loading, error, refresh }` so the
 * caller can render a per-chain breakdown + a refresh button.
 *
 * Cached for 30 seconds inside `PortfolioService` so re-mounts within
 * a session don't refetch.
 *
 * @module hooks/usePortfolio
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getPortfolioService } from '../services/PortfolioClient';

/** Per-chain breakdown returned by the validator. */
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
  change24h: { amount: number; percentage: number };
  chains: PortfolioChainEntry[];
  lastUpdated: number;
}

/** Return value of the hook. */
export interface UsePortfolioResult {
  /** Latest portfolio snapshot, undefined while loading. */
  portfolio: PortfolioSnapshot | undefined;
  /** True while the initial / refresh fetch is in flight. */
  loading: boolean;
  /** Error message if the most recent fetch failed. */
  error: string | undefined;
  /** Force-refresh, bypassing the 30 s cache. */
  refresh: () => void;
}

/**
 * Fetch the full portfolio for the authenticated user.
 *
 * @returns Loading / data / error state plus a manual refresh trigger.
 */
export function usePortfolio(): UsePortfolioResult {
  const address = useAuthStore((s) => s.address);
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
        const service = getPortfolioService();
        const result = refreshTick === 0
          ? await service.getPortfolio(address)
          : await service.refreshPortfolio(address);
        if (cancelled) return;
        setPortfolio({
          totalUsd: result.totalUsd,
          change24h: result.change24h,
          chains: result.chains.map((c) => ({
            chainId: c.chainId,
            chainName: c.chainName,
            nativeBalance: c.nativeBalance,
            nativeSymbol: c.nativeSymbol,
            nativeUsdValue: c.nativeUsdValue,
            totalUsd: c.totalUsd,
          })),
          lastUpdated: result.lastUpdated,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, refreshTick]);

  const refresh = useCallback((): void => {
    setRefreshTick((n) => n + 1);
  }, []);

  return { portfolio, loading, error, refresh };
}
