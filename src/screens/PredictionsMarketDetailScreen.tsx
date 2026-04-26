/**
 * PredictionsMarketDetailScreen — per-market buy + claim flow.
 *
 * Fetches full market detail (incl. collateral + router addresses) via
 * `PredictionsClient.getMarket`, renders outcome tabs (YES / NO) with
 * the live quoted price, and orchestrates a buy or claim through
 * `PredictionsService`.
 *
 * Buy flow: user picks outcome + amount → live quote refresh →
 * confirmation → approve (if needed) + trade tx. All HTTP happens in
 * the service layer; this screen only renders state.
 *
 * Claim flow: only enabled when `market.status === 'resolved'`. Signs
 * the EIP-712 intent + legacy EIP-191 canonical, requests a
 * redeemPositions envelope, and broadcasts on the destination chain.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getPredictionsClient,
  type PredictionMarket,
  type PredictionMarketDetail,
  type PredictionOutcome,
  type PredictionTradeQuote,
} from '@wallet/services/predictions/PredictionsClient';

import { Button } from '../components';
import Sparkline from '../components/Sparkline';
import { colors } from '../theme/colors';
import { buyOutcome, claimOutcome, getQuote } from '../services/PredictionsService';

/** Props. */
export interface PredictionsMarketDetailScreenProps {
  /** Market row the user tapped in the list. */
  market: PredictionMarket;
  /** Authenticated trader address. */
  buyer: string;
  /** BIP39 mnemonic — used in-memory only for signing. */
  mnemonic: string;
  /** Back nav. */
  onBack: () => void;
}

/**
 * Render the detail + buy + claim flow.
 * @param props - See {@link PredictionsMarketDetailScreenProps}.
 * @returns JSX.
 */
export default function PredictionsMarketDetailScreen(
  props: PredictionsMarketDetailScreenProps,
): JSX.Element {
  const { market, buyer, mnemonic, onBack } = props;
  const { t } = useTranslation();

  const [detail, setDetail] = useState<PredictionMarketDetail | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [outcome, setOutcome] = useState<PredictionOutcome>('yes');
  const [amountUsd, setAmountUsd] = useState('5');
  const [quote, setQuote] = useState<PredictionTradeQuote | undefined>(undefined);
  const [quoting, setQuoting] = useState(false);
  const [trading, setTrading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [tradeMessage, setTradeMessage] = useState<string | undefined>(undefined);

  // ── Load full detail ─────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async (): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const d = await getPredictionsClient().getMarket(market.id);
        if (alive) setDetail(d);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [market.id]);

  // ── Quote refresh when outcome or amount changes ─────────────────────
  const refreshQuote = useCallback(async (): Promise<void> => {
    if (amountUsd === '' || Number.parseFloat(amountUsd) <= 0) return;
    setQuoting(true);
    try {
      const q = await getQuote(market.id, outcome, amountUsd);
      setQuote(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuoting(false);
    }
  }, [market.id, outcome, amountUsd]);

  useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  // ── Buy handler ──────────────────────────────────────────────────────
  const onBuy = useCallback((): void => {
    if (detail === undefined || quote === undefined) return;
    Alert.alert(
      t('predictions.confirmBuyTitle', { defaultValue: 'Confirm purchase' }),
      t('predictions.confirmBuyBody', {
        defaultValue: `Buy ${quote.expectedShares} ${outcome.toUpperCase()} shares for ${quote.totalAmount} ${detail.collateralToken ?? 'USD'}?`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: () => {
            setTrading(true);
            setTradeMessage(undefined);
            void (async (): Promise<void> => {
              try {
                const res = await buyOutcome({
                  market: detail,
                  outcome,
                  amountUsd,
                  buyer,
                  mnemonic,
                });
                setTradeMessage(
                  t('predictions.buySuccess', {
                    defaultValue: `Position opened — order ${res.orderId.slice(0, 10)}…`,
                  }),
                );
              } catch (err) {
                setTradeMessage(
                  err instanceof Error ? err.message : String(err),
                );
              } finally {
                setTrading(false);
              }
            })();
          },
        },
      ],
    );
  }, [detail, quote, outcome, amountUsd, buyer, mnemonic, t]);

  // ── Claim handler ────────────────────────────────────────────────────
  const onClaim = useCallback((): void => {
    if (detail === undefined) return;
    if (detail.status !== 'resolved') {
      setTradeMessage(
        t('predictions.notResolved', { defaultValue: 'Market not resolved yet.' }),
      );
      return;
    }
    setClaiming(true);
    setTradeMessage(undefined);
    void (async (): Promise<void> => {
      try {
        const res = await claimOutcome({
          market: detail,
          outcome,
          trader: buyer,
          mnemonic,
        });
        setTradeMessage(
          t('predictions.claimSuccess', {
            defaultValue: `Claim submitted — tx ${res.txHash.slice(0, 10)}… on chain ${res.chainId}`,
          }),
        );
      } catch (err) {
        setTradeMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setClaiming(false);
      }
    })();
  }, [detail, outcome, buyer, mnemonic, t]);

  const yesPrice = useMemo(() => {
    const row = detail?.outcomes.find((o) => o.label.toLowerCase() === 'yes');
    return row !== undefined ? Math.round(Number.parseFloat(row.price) * 100) : undefined;
  }, [detail]);

  const noPrice = useMemo(() => {
    const row = detail?.outcomes.find((o) => o.label.toLowerCase() === 'no');
    return row !== undefined ? Math.round(Number.parseFloat(row.price) * 100) : undefined;
  }, [detail]);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
      </Pressable>

      <Text style={styles.title}>{market.question}</Text>
      <Text style={styles.meta}>{market.platform}</Text>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {detail !== undefined && (
        <>
          {/* Outcome tabs */}
          <View style={styles.outcomeRow}>
            <Pressable
              onPress={() => setOutcome('yes')}
              style={[styles.outcomeChip, outcome === 'yes' && styles.outcomeChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: outcome === 'yes' }}
            >
              <Text
                style={[styles.outcomeText, outcome === 'yes' && styles.outcomeTextActive]}
              >
                YES {yesPrice !== undefined ? `${yesPrice}¢` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOutcome('no')}
              style={[styles.outcomeChip, outcome === 'no' && styles.outcomeChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: outcome === 'no' }}
            >
              <Text
                style={[styles.outcomeText, outcome === 'no' && styles.outcomeTextActive]}
              >
                NO {noPrice !== undefined ? `${noPrice}¢` : ''}
              </Text>
            </Pressable>
          </View>

          {/* YES-price history sparkline (renders only when the
              backend returned `priceHistory` on the detail). */}
          {detail.priceHistory !== undefined && detail.priceHistory.length >= 2 && (
            <View style={styles.sparklineCard}>
              <Text style={styles.sectionTitle}>
                {t('predictions.priceHistory', {
                  defaultValue: outcome === 'yes' ? 'YES price history' : 'NO price history',
                })}
              </Text>
              <Sparkline
                data={detail.priceHistory.map((p) => (outcome === 'yes' ? p.yes : p.no))}
                width={300}
                height={80}
                clampUnit
              />
            </View>
          )}

          {/* Amount input */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('predictions.amountUsd', { defaultValue: 'Amount (USD)' })}
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              value={amountUsd}
              onChangeText={setAmountUsd}
              style={styles.input}
              placeholder="5.00"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('predictions.amountUsd', { defaultValue: 'Amount (USD)' })}
            />
            {quoting && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            {quote !== undefined && (
              <View>
                <Row label={t('predictions.expected', { defaultValue: 'Expected shares' })} value={quote.expectedShares} />
                <Row label={t('predictions.fee', { defaultValue: 'Fee' })} value={`${quote.feeAmount} (${quote.feeRateBps} bps)`} />
                <Row label={t('predictions.total', { defaultValue: 'Total' })} value={quote.totalAmount} highlight />
              </View>
            )}
            <View style={styles.buttonRow}>
              <Button
                title={
                  trading
                    ? t('predictions.buying', { defaultValue: 'Submitting…' })
                    : t('predictions.buy', { defaultValue: 'Buy' })
                }
                onPress={onBuy}
                disabled={trading || quote === undefined}
              />
            </View>
          </View>

          {/* Claim */}
          {detail.status === 'resolved' && (
            <View style={[styles.card, styles.cardAccent]}>
              <Text style={styles.sectionTitle}>
                {t('predictions.claim', { defaultValue: 'Claim winnings' })}
              </Text>
              <Text style={styles.note}>
                {t('predictions.claimNote', {
                  defaultValue:
                    'Claims settle on the destination CTF chain (Polygon or Gnosis). You need native gas on that chain.',
                })}
              </Text>
              <View style={styles.buttonRow}>
                <Button
                  title={
                    claiming
                      ? t('predictions.claiming', { defaultValue: 'Claiming…' })
                      : t('predictions.claim', { defaultValue: 'Claim' })
                  }
                  onPress={onClaim}
                  disabled={claiming}
                />
              </View>
            </View>
          )}

          {tradeMessage !== undefined && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t('predictions.status', { defaultValue: 'Status' })}
              </Text>
              <Text style={styles.noteLine}>{tradeMessage}</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight === true && styles.rowValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 48 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    lineHeight: 24,
  },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: 12 },
  outcomeRow: { flexDirection: 'row', marginVertical: 12 },
  sparklineCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  outcomeChip: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  outcomeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  outcomeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  outcomeTextActive: { color: colors.background, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cardAccent: { borderColor: colors.primary },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  input: {
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 8,
    fontSize: 18,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.textPrimary, fontSize: 13, maxWidth: '60%', textAlign: 'right' },
  rowValueHighlight: { color: colors.primary, fontWeight: '700' },
  buttonRow: { marginTop: 12 },
  loadingRow: { alignItems: 'center', paddingVertical: 8 },
  error: { color: colors.danger, marginVertical: 8 },
  note: { color: colors.textMuted, fontSize: 11, marginBottom: 8, lineHeight: 16 },
  noteLine: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
});
