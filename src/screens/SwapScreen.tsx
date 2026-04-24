/**
 * SwapScreen — intent-based swap entry.
 *
 * Phase 3 scope: quote + route attribution display. Executes the
 * resulting unsigned tx via the SendService path for same-chain
 * same-token transfers; full cross-chain execution (CCTP / Wormhole /
 * ICTT) lands after the OmniRelay + bridge monitor wiring in Phase 3
 * Week 2.
 *
 * What's demonstrated already:
 *   - Pair selector (from / to tokens, each bound to a chain)
 *   - Amount input with live validation
 *   - Quote fetch via UniversalSwapClient
 *   - Route-attribution label (OmniDEX / Li.Fi / 0x)
 *   - Price-impact and min-out display
 *   - Intent classification hint (same-chain vs bridge-only vs bridge+swap)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import {
  attributionLabel,
  classifySwap,
  COMMON_TOKENS,
  formatPriceImpact,
  getQuote,
  type QuoteResponse,
  type SwapQuote,
  type TokenShortcut,
} from '../services/SwapService';
import { useAuthStore } from '../store/authStore';

/** Props accepted by SwapScreen. */
export interface SwapScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the swap entry form.
 * @param props - See {@link SwapScreenProps}.
 * @returns JSX.
 */
export default function SwapScreen(props: SwapScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const [from, setFrom] = useState<TokenShortcut>(COMMON_TOKENS[0]!);
  const [to, setTo] = useState<TokenShortcut>(COMMON_TOKENS[2]!);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [quote, setQuote] = useState<SwapQuote | undefined>(undefined);
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | undefined>(undefined);

  const amountError = useMemo(() => {
    if (amount === '') return undefined;
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) {
      return t('swap.error.invalidAmount', { defaultValue: 'Enter a valid decimal amount.' });
    }
    if (Number.parseFloat(amount) <= 0) {
      return t('swap.error.zeroAmount', { defaultValue: 'Amount must be positive.' });
    }
    return undefined;
  }, [amount, t]);

  const classification = useMemo(
    () =>
      classifySwap({
        sourceChainId: from.chainId,
        targetChainId: to.chainId,
        tokenInSymbol: from.symbol,
        tokenOutSymbol: to.symbol,
      }),
    [from, to],
  );

  const canQuote =
    amount !== '' && amountError === undefined && address !== '' && !busy;

  const handleQuote = useCallback(async (): Promise<void> => {
    if (!canQuote) return;
    setBusy(true);
    setError(undefined);
    setQuote(undefined);
    try {
      const response = await getQuote({
        tokenIn: from.address,
        tokenInSymbol: from.symbol,
        sourceChainId: from.chainId,
        tokenOut: to.address,
        tokenOutSymbol: to.symbol,
        targetChainId: to.chainId,
        amountIn: amount,
        walletAddress: address,
        maxSlippageBps: 50,
      });
      setQuoteResponse(response);
      setQuote(response.quotes[0]);
      if (response.quotes.length === 0) {
        setError(
          t('swap.error.noQuotes', { defaultValue: 'No route found for this pair.' }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [canQuote, from, to, amount, address, t]);

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('swap.title', { defaultValue: 'Swap' })}
      </Text>

      <Card style={styles.pairCard}>
        <Text style={styles.fieldLabel}>{t('swap.from', { defaultValue: 'From' })}</Text>
        <TokenPicker selected={from} onSelect={setFrom} />

        <View style={styles.arrowRow}>
          <Pressable
            onPress={() => {
              const next = from;
              setFrom(to);
              setTo(next);
              setQuote(undefined);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('swap.flip', { defaultValue: 'Flip from and to' })}
            style={styles.flipButton}
          >
            <Text style={styles.flipText}>⇅</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>{t('swap.to', { defaultValue: 'To' })}</Text>
        <TokenPicker selected={to} onSelect={setTo} />
      </Card>

      <Input
        label={t('swap.amount', { defaultValue: 'Amount ({{symbol}})', symbol: from.symbol })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.0"
        error={amountError}
      />

      <Text style={styles.classification}>
        {classification === 'same-chain-swap'
          ? t('swap.classification.sameChain', { defaultValue: 'Same-chain swap' })
          : classification === 'bridge-only'
            ? t('swap.classification.bridgeOnly', { defaultValue: 'Cross-chain bridge' })
            : t('swap.classification.bridgeAndSwap', {
                defaultValue: 'Cross-chain bridge + swap',
              })}
      </Text>

      {quote !== undefined && (
        <Card style={styles.quoteCard}>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.you_get', { defaultValue: 'You receive' })}
            </Text>
            <Text style={styles.quoteValue}>
              {quote.amountOut} {to.symbol}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.min', { defaultValue: 'Minimum after slippage' })}
            </Text>
            <Text style={styles.quoteValueMuted}>
              {quote.amountOutMin} {to.symbol}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.impact', { defaultValue: 'Price impact' })}
            </Text>
            <Text style={styles.quoteValueMuted}>
              {formatPriceImpact(quote.priceImpactBps)}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.route', { defaultValue: 'Route' })}
            </Text>
            <Text style={styles.attribution}>{attributionLabel(quote)}</Text>
          </View>
          {quoteResponse !== undefined && quoteResponse.quotes.length > 1 && (
            <Text style={styles.alternativesHint}>
              {t('swap.quote.alternatives', {
                defaultValue: '{{n}} alternative route{{s}} available',
                n: quoteResponse.quotes.length - 1,
                s: quoteResponse.quotes.length === 2 ? '' : 's',
              })}
            </Text>
          )}
        </Card>
      )}

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      {busy ? (
        <LoadingSpinner
          label={t('swap.quoting', { defaultValue: 'Fetching best route…' })}
        />
      ) : (
        <View style={styles.actions}>
          <Button
            title={
              quote === undefined
                ? t('swap.cta.getQuote', { defaultValue: 'Get Quote' })
                : t('swap.cta.refreshQuote', { defaultValue: 'Refresh Quote' })
            }
            onPress={() => void handleQuote()}
            disabled={!canQuote}
            style={styles.actionButton}
          />
          <Button
            title={t('common.back', { defaultValue: 'Back' })}
            onPress={props.onBack}
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

/** Inline token picker — chip row across COMMON_TOKENS. */
function TokenPicker({
  selected,
  onSelect,
}: {
  selected: TokenShortcut;
  onSelect: (token: TokenShortcut) => void;
}): JSX.Element {
  return (
    <View style={styles.tokenRow}>
      {COMMON_TOKENS.map((tok) => {
        const active =
          tok.chainId === selected.chainId &&
          tok.address === selected.address &&
          tok.symbol === selected.symbol;
        return (
          <Pressable
            key={`${tok.chainId}-${tok.symbol}-${tok.address}`}
            onPress={() => onSelect(tok)}
            style={[styles.tokenChip, active && styles.tokenChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tokenChipText, active && styles.tokenChipTextActive]}>
              {tok.symbol}
              <Text style={styles.tokenChipSub}>  · {shortChain(tok.chainId)}</Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Short chain label for token chips. */
function shortChain(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'ETH';
    case 10:
      return 'OP';
    case 56:
      return 'BSC';
    case 137:
      return 'POLY';
    case 8453:
      return 'BASE';
    case 42161:
      return 'ARB';
    case 43114:
      return 'AVAX';
    case 88008:
      return 'XOM-L1';
    default:
      return `#${chainId}`;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 32,
  },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 16 },
  pairCard: { marginBottom: 16 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  tokenRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tokenChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tokenChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tokenChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  tokenChipTextActive: { color: colors.background, fontWeight: '700' },
  tokenChipSub: { color: colors.textMuted, fontSize: 11 },
  arrowRow: { alignItems: 'center', marginVertical: 8 },
  flipButton: { padding: 8 },
  flipText: { color: colors.primary, fontSize: 20 },
  classification: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
  quoteCard: { marginBottom: 16 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  quoteLabel: { color: colors.textSecondary, fontSize: 13 },
  quoteValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  quoteValueMuted: { color: colors.textPrimary, fontSize: 13 },
  attribution: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  alternativesHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
