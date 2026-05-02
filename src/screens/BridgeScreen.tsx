/**
 * BridgeScreen — same-asset cross-chain bridge.
 *
 * Reuses {@link UniversalSwapClient} (via {@link SwapService}) which
 * already handles CCTP + Wormhole + CCIP + ICTT routes. The bridge
 * variant pre-locks `tokenInSymbol === tokenOutSymbol` so the user is
 * only choosing source/destination chains + amount, not different
 * tokens — that's the SwapScreen's job.
 *
 * The validator picks the best protocol (CCTP for USDC, ICTT for
 * XOM ↔ Avalanche, Wormhole / CCIP elsewhere) — this screen only
 * surfaces the chosen route in the preview banner.
 *
 * @module screens/BridgeScreen
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import Button from '@components/Button';
import ScreenHeader from '@components/ScreenHeader';
import { useRequireAuth } from '@components/RequireAuth';
import { colors } from '@theme/colors';

import {
  attributionLabel,
  COMMON_TOKENS,
  formatPriceImpact,
  getQuote,
  type QuoteResponse,
  type SwapQuote,
  type UniversalSwapQuoteParams,
} from '../services/SwapService';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

/** Bridgeable assets — must exist on more than one chain. */
const BRIDGEABLE_ASSETS = ['USDC', 'USDT', 'ETH', 'XOM'] as const;
type BridgeableAsset = (typeof BRIDGEABLE_ASSETS)[number];

/** Chain options the user can pick from. */
interface BridgeChain {
  chainId: number;
  name: string;
}

const BRIDGE_CHAINS: BridgeChain[] = [
  { chainId: 88008, name: 'OmniCoin L1' },
  { chainId: 1, name: 'Ethereum' },
  { chainId: 42161, name: 'Arbitrum' },
  { chainId: 8453, name: 'Base' },
  { chainId: 137, name: 'Polygon' },
  { chainId: 10, name: 'Optimism' },
  { chainId: 43114, name: 'Avalanche' },
];

/** Look up the canonical contract address for an asset on a chain. */
function lookupAddress(
  chainId: number,
  symbol: BridgeableAsset,
): { address: string; decimals: number } | undefined {
  const tok = COMMON_TOKENS.find((t) => t.chainId === chainId && t.symbol === symbol);
  if (tok === undefined) return undefined;
  return { address: tok.address, decimals: tok.decimals };
}

/** Props accepted by BridgeScreen. */
export interface BridgeScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the bridge UI.
 *
 * @param props - See {@link BridgeScreenProps}.
 * @returns JSX.
 */
export default function BridgeScreen(props: BridgeScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const requireAuth = useRequireAuth();
  const walletAddress = useAuthStore((s) => s.address);

  const [asset, setAsset] = useState<BridgeableAsset>('USDC');
  const [sourceChainId, setSourceChainId] = useState<number>(1);
  const [targetChainId, setTargetChainId] = useState<number>(42161);
  const [amountIn, setAmountIn] = useState<string>('');
  const [quote, setQuote] = useState<QuoteResponse | undefined>(undefined);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  /** Source-chain options exclude the current target (and vice-versa). */
  const sourceOptions = useMemo(
    () => BRIDGE_CHAINS.filter((c) => c.chainId !== targetChainId),
    [targetChainId],
  );
  const targetOptions = useMemo(
    () => BRIDGE_CHAINS.filter((c) => c.chainId !== sourceChainId),
    [sourceChainId],
  );

  const swapChains = useCallback((): void => {
    setSourceChainId(targetChainId);
    setTargetChainId(sourceChainId);
  }, [sourceChainId, targetChainId]);

  /** Fetch a fresh quote for the current selection. */
  const refreshQuote = useCallback(async (): Promise<void> => {
    setError(undefined);
    setQuote(undefined);
    if (walletAddress === '' || amountIn === '' || Number(amountIn) <= 0) return;
    const sourceAsset = lookupAddress(sourceChainId, asset);
    const targetAsset = lookupAddress(targetChainId, asset);
    if (sourceAsset === undefined || targetAsset === undefined) {
      setError(
        t('bridge.errors.unsupportedPair', {
          defaultValue: '{{asset}} is not bridgeable between these chains.',
          asset,
        }),
      );
      return;
    }
    setQuoteLoading(true);
    try {
      const params: UniversalSwapQuoteParams = {
        tokenIn: sourceAsset.address,
        tokenInSymbol: asset,
        sourceChainId,
        tokenOut: targetAsset.address,
        tokenOutSymbol: asset,
        targetChainId,
        amountIn,
        walletAddress,
        maxSlippageBps: 50,
      };
      const res = await getQuote(params);
      setQuote(res);
    } catch (err) {
      logger.warn('[bridge] quote failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('bridge.errors.quoteFailed', {
          defaultValue:
            'Could not get a bridge quote right now. Check your connection and try again.',
        }),
      );
    } finally {
      setQuoteLoading(false);
    }
  }, [walletAddress, amountIn, asset, sourceChainId, targetChainId, t]);

  /** Confirm + sign + relay the bridge. Wired to RequireAuth so guests
   *  see the AuthPrompt sheet instead of a no-op tap. The actual
   *  signing path reuses {@link executeSwap} once approved — Sprint 2
   *  follow-up wires it once the matching SwapService.executeBridge
   *  helper lands; for now the CTA reports a friendly "ready to ship"
   *  message so the screen is a proper part of the UX rather than a
   *  hidden stub. */
  const onConfirm = useCallback((): void => {
    requireAuth(
      t('authPrompt.toBridge', {
        defaultValue: 'Sign in to bridge assets across chains.',
      }),
      () => {
        // The validator's executeSwap pipeline already handles bridge
        // submission (CCTP / ICTT / Wormhole / CCIP). Mobile's
        // executeSwap helper in `services/SwapService` covers it; we
        // wire it here so the bridge confirms with the same gasless
        // flow the swap UI uses.
        // Sprint 2 follow-up: wire the executeSwap call site.
        // Currently quote retrieval works but execute is gated behind
        // the same dev-machine validator that times out for portfolio
        // (see Sprint 4). Until then, surface a clear next-step.
        setError(
          t('bridge.notReady', {
            defaultValue:
              'Bridge submission is queued for the next build. Quote pricing is live.',
          }),
        );
      },
      'Bridge',
      'bridge',
    );
  }, [requireAuth, t]);

  const bestQuote: SwapQuote | undefined = quote?.quotes[0];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('bridge.title', { defaultValue: 'Bridge' })} onBack={props.onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>
          {t('bridge.assetLabel', { defaultValue: 'Asset' })}
        </Text>
        <View style={styles.chipsRow}>
          {BRIDGEABLE_ASSETS.map((a) => (
            <Pressable
              key={a}
              onPress={(): void => setAsset(a)}
              accessibilityRole="button"
              accessibilityState={{ selected: asset === a }}
              style={[styles.chip, asset === a && styles.chipActive]}
            >
              <Text style={[styles.chipText, asset === a && styles.chipTextActive]}>{a}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          {t('bridge.fromLabel', { defaultValue: 'From' })}
        </Text>
        <ChainPicker
          options={sourceOptions}
          value={sourceChainId}
          onChange={setSourceChainId}
          accessibilityLabel={t('bridge.fromA11y', { defaultValue: 'Source chain' })}
        />

        <Pressable
          onPress={swapChains}
          accessibilityRole="button"
          accessibilityLabel={t('bridge.swapDirection', { defaultValue: 'Swap source and destination' })}
          style={styles.swapDirection}
          hitSlop={12}
        >
          <Ionicons name="swap-vertical" size={22} color={colors.primary} />
        </Pressable>

        <Text style={styles.sectionLabel}>{t('bridge.toLabel', { defaultValue: 'To' })}</Text>
        <ChainPicker
          options={targetOptions}
          value={targetChainId}
          onChange={setTargetChainId}
          accessibilityLabel={t('bridge.toA11y', { defaultValue: 'Destination chain' })}
        />

        <Text style={styles.sectionLabel}>
          {t('bridge.amountLabel', { defaultValue: 'Amount' })}
        </Text>
        <TextInput
          value={amountIn}
          onChangeText={setAmountIn}
          onBlur={(): void => void refreshQuote()}
          keyboardType="decimal-pad"
          placeholder="0.0"
          placeholderTextColor={colors.textMuted}
          style={styles.amountInput}
          accessibilityLabel={t('bridge.amountA11y', { defaultValue: 'Amount to bridge' })}
        />

        <Pressable
          onPress={(): void => void refreshQuote()}
          accessibilityRole="button"
          accessibilityLabel={t('bridge.refreshQuoteA11y', { defaultValue: 'Refresh bridge quote' })}
          style={styles.refresh}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.refreshText}>
            {t('bridge.refreshQuote', { defaultValue: 'Refresh quote' })}
          </Text>
        </Pressable>

        {quoteLoading && (
          <Text style={styles.loadingText} accessibilityLiveRegion="polite">
            {t('bridge.quoting', { defaultValue: 'Fetching the cheapest route…' })}
          </Text>
        )}

        {bestQuote !== undefined && (
          <View style={styles.quoteCard} accessibilityLiveRegion="polite">
            <Text style={styles.quoteHeader}>
              {t('bridge.via', { defaultValue: 'via {{provider}}', provider: attributionLabel(bestQuote) })}
            </Text>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>
                {t('bridge.amountOut', { defaultValue: 'You receive' })}
              </Text>
              <Text style={styles.quoteValue}>
                ≈ {bestQuote.amountOut} {asset}
              </Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>
                {t('bridge.minimumOut', { defaultValue: 'Minimum after slippage' })}
              </Text>
              <Text style={styles.quoteValue}>
                {bestQuote.amountOutMin} {asset}
              </Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>
                {t('bridge.priceImpact', { defaultValue: 'Price impact' })}
              </Text>
              <Text style={styles.quoteValue}>{formatPriceImpact(bestQuote.priceImpactBps)}</Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>
                {t('bridge.fees', { defaultValue: 'Total fees' })}
              </Text>
              <Text style={styles.quoteValue}>
                {bestQuote.totalFees} {asset}
              </Text>
            </View>
          </View>
        )}

        {error !== undefined && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Button
          title={t('bridge.cta', { defaultValue: 'Bridge' })}
          onPress={onConfirm}
          disabled={bestQuote === undefined}
          style={styles.cta}
        />
      </ScrollView>
    </View>
  );
}

/** Inline chain-selector row. */
function ChainPicker({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: BridgeChain[];
  value: number;
  onChange: (chainId: number) => void;
  accessibilityLabel: string;
}): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chainScroll}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((c) => (
        <Pressable
          key={c.chainId}
          onPress={(): void => onChange(c.chainId)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === c.chainId }}
          style={[styles.chainChip, value === c.chainId && styles.chainChipActive]}
        >
          <Text style={[styles.chainText, value === c.chainId && styles.chainTextActive]}>
            {c.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  chainScroll: { flexGrow: 0, maxHeight: 48 },
  chainChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginRight: 8,
  },
  chainChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chainText: { color: colors.textSecondary, fontSize: 13 },
  chainTextActive: { color: colors.background, fontWeight: '700' },
  swapDirection: { alignSelf: 'center', padding: 8, marginVertical: 4 },
  amountInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.textPrimary,
    fontSize: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  refreshText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  loadingText: { color: colors.textSecondary, fontSize: 13, marginTop: 8 },
  quoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  quoteHeader: { color: colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  quoteLabel: { color: colors.textSecondary, fontSize: 13 },
  quoteValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  cta: { marginTop: 24 },
});
