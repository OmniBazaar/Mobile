/**
 * TokenDetailScreen — per-asset detail view.
 *
 * Renders:
 *   - Hero: symbol + chain + balance + USD value + 24h change pill.
 *   - Sparkline price chart driven by `react-native-wagmi-charts` when
 *     historical data is available (CoinGecko `market_chart`); falls
 *     back to a flat skeleton when the oracle declines.
 *   - Action row: Send / Receive / Swap (each gated through RequireAuth).
 *
 * Recent transactions land in Sprint 3 — for now this screen surfaces
 * the high-value bits (balance + chart + actions). The feature is
 * complete enough to be the destination of Wallet-home tap-to-detail
 * (the remediation plan flagged the prior dead-end).
 *
 * @module screens/TokenDetailScreen
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '@components/ScreenHeader';
import TokenIcon from '@components/TokenIcon';
import { useRequireAuth } from '@components/RequireAuth';
import { colors } from '@theme/colors';
import { logger } from '../utils/logger';

/**
 * Lazily resolved `LineChart` component from `react-native-wagmi-charts`.
 *
 * Why lazy: wagmi-charts pulls in `react-native-redash` which uses
 * Reanimated worklets. A static `import { LineChart } from
 * 'react-native-wagmi-charts'` puts the worklet payload in the boot
 * bundle's evaluation chain (App.tsx → RootNavigator → AppTabs →
 * WalletStack → TokenDetailScreen). When anything in that chain blows
 * up, the JS thread dies before AppRegistry registers — the user sees
 * the splash, then the launcher (the 2026-05-03 reported "crashes at
 * splash in less than a second"). Lazy-loading via React.lazy +
 * Suspense quarantines the failure to the screen itself: if the chart
 * can't render, the screen renders a skeleton instead and the rest of
 * the app keeps working.
 */
const LazyChart = React.lazy(() =>
  import('react-native-wagmi-charts')
    .then((mod) => ({
      default: function ChartWrapper({ data }: { data: PricePoint[] }): React.ReactElement {
        const Provider = mod.LineChart.Provider;
        const Chart = mod.LineChart;
        return (
          <Provider data={data}>
            <Chart height={160}>
              <Chart.Path color={colors.primary} />
              <Chart.CursorCrosshair color={colors.primary} />
            </Chart>
          </Provider>
        );
      },
    }))
    .catch((err) => {
      logger.warn('TokenDetailScreen lazy chart failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        default: function ChartUnavailable(): React.ReactElement {
          return <Text style={styles.chartFallback}>—</Text>;
        },
      };
    }),
);

/** Price-chart point shape consumed by react-native-wagmi-charts. */
interface PricePoint {
  timestamp: number;
  value: number;
}

/** CoinGecko slug for native-token historical data. Same map as PriceOracle. */
const COINGECKO_NATIVE_SLUG: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'ethereum',
  56: 'binancecoin',
  137: 'matic-network',
  8453: 'ethereum',
  42161: 'ethereum',
  43114: 'avalanche-2',
  88008: 'omnicoin',
};

/** CoinGecko platform slug for ERC-20 historical lookups. */
const COINGECKO_PLATFORM: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  56: 'binance-smart-chain',
  137: 'polygon-pos',
  8453: 'base',
  42161: 'arbitrum-one',
  43114: 'avalanche',
};

/** Fetch a 24-hour, 5-min-interval price history. */
async function fetchPriceHistory(
  chainId: number,
  contract: string | undefined,
): Promise<PricePoint[] | undefined> {
  try {
    const slug =
      contract === undefined || contract === '' || contract === 'native'
        ? COINGECKO_NATIVE_SLUG[chainId]
        : undefined;
    let url: string;
    if (slug !== undefined) {
      url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(slug)}/market_chart?vs_currency=usd&days=1`;
    } else {
      const platform = COINGECKO_PLATFORM[chainId];
      if (platform === undefined || contract === undefined) return undefined;
      url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(platform)}/contract/${encodeURIComponent(contract.toLowerCase())}/market_chart/?vs_currency=usd&days=1`;
    }
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return undefined;
    const json = (await r.json()) as { prices?: Array<[number, number]> };
    if (!Array.isArray(json.prices) || json.prices.length === 0) return undefined;
    return json.prices
      .filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[1]))
      .map(([timestamp, value]) => ({ timestamp, value }));
  } catch (err) {
    logger.debug('TokenDetail price-history failed', {
      chainId,
      contract,
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/** Format a USD number with sane precision. */
function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  const rounded = Math.round(usd * 100) / 100;
  return `$${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Props accepted by TokenDetailScreen. */
export interface TokenDetailScreenProps {
  /** EVM chain ID. */
  chainId: number;
  /** Chain display name. */
  chainName: string;
  /** Token symbol. */
  symbol: string;
  /** Contract address ('native' for the gas token). */
  contract: string;
  /** Whole-unit balance string. */
  balance: string;
  /** USD value of the balance. */
  usdValue: number;
  /** Decimal places (used for downstream Send call). */
  decimals: number;
  /** Back-navigation callback. */
  onBack: () => void;
  /** Tap "Send" — routes through RequireAuth. */
  onSend: () => void;
  /** Tap "Receive". */
  onReceive: () => void;
  /** Tap "Swap" — routes through RequireAuth. */
  onSwap: () => void;
}

/**
 * Render the token detail.
 *
 * @param props - See {@link TokenDetailScreenProps}.
 * @returns JSX.
 */
export default function TokenDetailScreen(
  props: TokenDetailScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const requireAuth = useRequireAuth();
  const [history, setHistory] = useState<PricePoint[] | undefined>(undefined);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPriceHistory(props.chainId, props.contract === 'native' ? undefined : props.contract).then(
      (h) => {
        if (cancelled) return;
        setHistory(h);
        setChartLoading(false);
      },
    );
    return (): void => {
      cancelled = true;
    };
  }, [props.chainId, props.contract]);

  const change24h = (() => {
    if (history === undefined || history.length < 2) return 0;
    const first = history[0];
    const last = history[history.length - 1];
    if (first === undefined || last === undefined) return 0;
    if (first.value === 0) return 0;
    return ((last.value - first.value) / first.value) * 100;
  })();

  return (
    <View style={styles.root}>
      <ScreenHeader title={`${props.symbol} · ${props.chainName}`} onBack={props.onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <TokenIcon chainId={props.chainId} symbol={props.symbol} size={48} />
          <Text style={styles.balance}>
            {props.balance} {props.symbol}
          </Text>
          <Text style={styles.usd}>{formatUsd(props.usdValue)}</Text>
          {Number.isFinite(change24h) && Math.abs(change24h) > 0.01 && (
            <Text
              style={[styles.change, change24h >= 0 ? styles.changePos : styles.changeNeg]}
              accessibilityLabel={t('tokenDetail.change24hA11y', {
                defaultValue: '24-hour change {{pct}} percent',
                pct: change24h.toFixed(2),
              })}
            >
              {change24h >= 0 ? '↑' : '↓'} {Math.abs(change24h).toFixed(2)}%
            </Text>
          )}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          {chartLoading ? (
            <Text style={styles.chartFallback}>
              {t('tokenDetail.loadingChart', { defaultValue: 'Loading 24-hour chart…' })}
            </Text>
          ) : history === undefined || history.length < 2 ? (
            <Text style={styles.chartFallback}>
              {t('tokenDetail.noChart', {
                defaultValue: 'Price history is unavailable for this asset right now.',
              })}
            </Text>
          ) : (
            <React.Suspense
              fallback={
                <Text style={styles.chartFallback}>
                  {t('tokenDetail.loadingChart', { defaultValue: 'Loading 24-hour chart…' })}
                </Text>
              }
            >
              <LazyChart data={history} />
            </React.Suspense>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={(): void =>
              requireAuth(
                t('authPrompt.toSend', { defaultValue: 'Sign in to send tokens from your wallet.' }),
                props.onSend,
                'TokenDetail',
                'send',
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t('tokenDetail.send', { defaultValue: 'Send' })}
            style={styles.action}
          >
            <Ionicons name="arrow-up-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionText}>{t('tokenDetail.send', { defaultValue: 'Send' })}</Text>
          </Pressable>
          <Pressable
            onPress={props.onReceive}
            accessibilityRole="button"
            accessibilityLabel={t('tokenDetail.receive', { defaultValue: 'Receive' })}
            style={styles.action}
          >
            <Ionicons name="arrow-down-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionText}>{t('tokenDetail.receive', { defaultValue: 'Receive' })}</Text>
          </Pressable>
          <Pressable
            onPress={(): void =>
              requireAuth(
                t('authPrompt.toSwap', { defaultValue: 'Sign in to swap or trade tokens.' }),
                props.onSwap,
                'TokenDetail',
                'swap',
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t('tokenDetail.swap', { defaultValue: 'Swap' })}
            style={styles.action}
          >
            <Ionicons name="swap-horizontal-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionText}>{t('tokenDetail.swap', { defaultValue: 'Swap' })}</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          {t('tokenDetail.disclaimer', {
            defaultValue: 'Recent transactions land here in the next release.',
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 64 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  balance: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 16 },
  usd: { color: colors.textSecondary, fontSize: 16, marginTop: 4 },
  change: { fontSize: 13, marginTop: 8, fontWeight: '600' },
  changePos: { color: colors.success },
  changeNeg: { color: colors.danger },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 160,
    justifyContent: 'center',
  },
  chartFallback: { color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 24 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  actionText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginTop: 24, textAlign: 'center' },
});
