/**
 * WalletHomeScreen — Mobile's post-auth wallet landing.
 *
 * Renders:
 *   - Portfolio hero card (cumulative value + non-zero chain count)
 *   - Send / Receive / Swap quick-action row
 *   - Pull-to-refresh native-balance list across the 8 Phase 2 chains
 *
 * Data comes from `PortfolioService.fetchNativeBalances(address)` which
 * fans out to MulticallService (Multicall3 batch on 7 chains) +
 * ClientRPCRegistry (OmniCoin L1). Every RPC call is mobile-originated.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import Card from '@components/Card';
import TokenIcon from '@components/TokenIcon';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import {
  fetchErc20Balances,
  fetchNativeBalances,
  formatRaw,
  summarize,
  type ChainBalance,
} from '../services/PortfolioService';
import { usePortfolio } from '../hooks/usePortfolio';
import { useAuthStore } from '../store/authStore';

/**
 * Format a USD number for the hero "Portfolio" total.
 *
 * @param usd - Numeric USD value.
 * @returns "$0.00" through "$99,999,999.99" formatted with commas + 2 dp.
 */
function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  // Two-decimal precision under $1k, integer commas above. Mirrors
  // WebApp `formatUsd()` UX so the same dollar shows the same string
  // on both platforms.
  const rounded = Math.round(usd * 100) / 100;
  const fixed = rounded.toFixed(2);
  const [whole, dec] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${withCommas}.${dec}`;
}

/** Props accepted by WalletHomeScreen. */
export interface WalletHomeScreenProps {
  /** Navigate to SendScreen. */
  onSend: () => void;
  /** Navigate to ReceiveScreen. */
  onReceive: () => void;
  /** Navigate to SwapScreen (Phase 3). */
  onSwap: () => void;
  /** Navigate to MarketplaceHomeScreen (Phase 4). */
  onShop: () => void;
  /** Navigate to ProfileScreen (Phase 5). */
  onProfile: () => void;
  /** Sign out and return to welcome. */
  onSignOut: () => void;
}

/**
 * Render the wallet home.
 * @param props - See {@link WalletHomeScreenProps}.
 * @returns JSX.
 */
export default function WalletHomeScreen(props: WalletHomeScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const username = useAuthStore((s) => s.username);

  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (address === '') return;
    setRefreshing(true);
    try {
      // Fetch native + ERC-20 balances in parallel. Native returns one
      // row per chain (including zero); ERC-20 returns only non-zero
      // rows plus any per-chain error rows.
      const [nativeRows, erc20Rows] = await Promise.all([
        fetchNativeBalances(address),
        fetchErc20Balances(address),
      ]);
      // Hide zero-balance non-OmniCoin native rows to keep the list
      // focused on assets the user actually holds. OmniCoin L1 always
      // renders so the user sees their XOM home chain even at zero.
      const filteredNative = nativeRows.filter(
        (r) => r.chainId === 88008 || r.raw > 0n || r.error !== undefined,
      );
      setBalances([...filteredNative, ...erc20Rows]);
    } catch (err) {
      console.warn('[wallet-home] balance fetch failed', err);
    } finally {
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { nonZeroChains, totalErrorRows } = summarize(balances);

  // Validator-aggregated USD totals (hits `/api/v1/wallet/portfolio/:address`).
  // Independent of the per-chain Multicall fan-out above so the hero can
  // populate even when some chains time out, and vice versa.
  const { portfolio, loading: portfolioLoading, error: portfolioError } = usePortfolio();

  return (
    <View style={styles.root}>
      {/* Hero card */}
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>
          {t('walletHome.portfolio', { defaultValue: 'Portfolio' })}
        </Text>
        <Text style={styles.heroTotal}>
          {portfolio !== undefined && typeof portfolio.totalUsd === 'number'
            ? formatUsd(portfolio.totalUsd)
            : portfolioLoading
              ? t('walletHome.loading', { defaultValue: 'Loading…' })
              : portfolioError !== undefined
                ? '—'
                : t('walletHome.chainSummary', {
                    defaultValue: '{{n}} chain{{s}} active',
                    n: nonZeroChains,
                    s: nonZeroChains === 1 ? '' : 's',
                  })}
        </Text>
        {(() => {
          // Defensive read: validator may omit `change24h` entirely
          // when no price-history is available, return it as `null`,
          // or return `{ amount, percentage }` with non-numeric fields.
          // Without this guard the whole home screen used to throw
          // "Cannot read property 'amount' of undefined" mid-render
          // and the React tree would unmount back to the splash.
          const c24 = portfolio?.change24h;
          const amount = typeof c24?.amount === 'number' ? c24.amount : 0;
          const percentage = typeof c24?.percentage === 'number' ? c24.percentage : 0;
          if (portfolio === undefined || amount === 0) return null;
          return (
            <Text
              style={[
                styles.heroChange,
                amount >= 0 ? styles.heroChangePos : styles.heroChangeNeg,
              ]}
            >
              {amount >= 0 ? '↑' : '↓'} {formatUsd(Math.abs(amount))} ({percentage.toFixed(2)}%)
            </Text>
          );
        })()}
        <Text style={styles.heroAddress}>{username !== '' ? `@${username} · ${short(address)}` : short(address)}</Text>
        {totalErrorRows > 0 && (
          <Text style={styles.heroError}>
            {t('walletHome.errorRows', {
              defaultValue: '{{n}} chain{{s}} failed to load — pull to refresh',
              n: totalErrorRows,
              s: totalErrorRows === 1 ? '' : 's',
            })}
          </Text>
        )}
      </Card>

      {/* Quick actions — 2 rows of 3 (with the bottom slot empty) so
          each tile gets ~33% of screen width, plenty for "Receive"
          (the longest label) plus an icon without wrapping. */}
      <View style={styles.actionsGrid}>
        <View style={styles.actionsRow}>
          <ActionTile
            icon="arrow-up-outline"
            label={t('walletHome.send', { defaultValue: 'Send' })}
            onPress={props.onSend}
          />
          <ActionTile
            icon="arrow-down-outline"
            label={t('walletHome.receive', { defaultValue: 'Receive' })}
            onPress={props.onReceive}
          />
          <ActionTile
            icon="swap-horizontal-outline"
            label={t('walletHome.swap', { defaultValue: 'Swap' })}
            onPress={props.onSwap}
          />
        </View>
        <View style={styles.actionsRow}>
          <ActionTile
            icon="storefront-outline"
            label={t('walletHome.shop', { defaultValue: 'Shop' })}
            onPress={props.onShop}
          />
          <ActionTile
            icon="person-circle-outline"
            label={t('walletHome.profile', { defaultValue: 'Profile' })}
            onPress={props.onProfile}
          />
          {/* Spacer so the second row aligns with the first. */}
          <View style={styles.actionTileSpacer} />
        </View>
      </View>

      <Text style={styles.sectionHeader}>
        {t('walletHome.tokens', { defaultValue: 'Tokens' })}
      </Text>

      <FlatList
        data={balances}
        keyExtractor={(item) => `${item.chainId}`}
        renderItem={({ item }) => <TokenRow balance={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t('walletHome.noTokens', { defaultValue: 'No token balances yet.' })}
          </Text>
        }
        contentContainerStyle={styles.listContent}
      />

      <Pressable onPress={props.onSignOut} accessibilityRole="button" style={styles.signOut}>
        <Text style={styles.signOutText}>
          {t('walletHome.signOut', { defaultValue: 'Sign Out' })}
        </Text>
      </Pressable>
    </View>
  );
}

/** Single token-row render. */
function TokenRow({ balance }: { balance: ChainBalance }): JSX.Element {
  return (
    <View style={styles.tokenRow}>
      <TokenIcon
        chainId={balance.chainId}
        symbol={balance.symbol}
        size={36}
      />
      <View style={styles.tokenRowMid}>
        <Text style={styles.tokenSymbol}>{balance.symbol}</Text>
        <Text style={styles.tokenChain}>{balance.chainName}</Text>
      </View>
      <View style={styles.tokenRowRight}>
        {balance.error !== undefined ? (
          <Text style={styles.tokenError}>error</Text>
        ) : (
          <>
            <Text style={styles.tokenBalance}>{formatRaw(balance.raw, balance.decimals)}</Text>
            {balance.usdValue !== undefined && (
              <Text style={styles.tokenUsd}>{formatUsd(balance.usdValue)}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

/** Quick-action tile (Send / Receive / Swap). */
function ActionTile({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionTile}
    >
      <Ionicons name={icon} size={22} color={colors.textPrimary} />
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Shorten a 42-char address for inline display. */
function short(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 56, paddingHorizontal: 16 },
  hero: { marginBottom: 16, alignItems: 'center' },
  heroLabel: { color: colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.2 },
  heroTotal: { color: colors.textPrimary, fontSize: 28, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  heroAddress: { color: colors.primary, fontSize: 13, marginTop: 4 },
  heroChange: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  heroChangePos: { color: colors.success },
  heroChangeNeg: { color: colors.danger },
  heroError: { color: colors.warning, fontSize: 12, marginTop: 8, textAlign: 'center' },
  actionsGrid: { marginBottom: 24 },
  actionsRow: { flexDirection: 'row', marginBottom: 8 },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  actionTileSpacer: { flex: 1, marginHorizontal: 4 },
  actionLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  listContent: { paddingBottom: 32 },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  tokenRowMid: { flex: 1, marginLeft: 12, flexDirection: 'column' },
  tokenRowRight: { alignItems: 'flex-end' },
  tokenSymbol: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  tokenChain: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  tokenBalance: { color: colors.textPrimary, fontSize: 15 },
  tokenUsd: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tokenError: { color: colors.danger, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48 },
  signOut: { alignItems: 'center', paddingVertical: 16 },
  signOutText: { color: colors.textMuted, fontSize: 13 },
});
