/**
 * PredictionPositionsScreen — open + settled prediction positions for
 * the signed-in user.
 *
 * Sourced from `PredictionsClient.getUserPositions`. Claimable rows
 * surface a "Claim" button that delegates to `PredictionsService.claimOutcome`.
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

import {
  getPredictionsClient,
  type PredictionPosition,
} from '@wallet/services/predictions/PredictionsClient';

import Card from '@components/Card';
import { Button } from '../components';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { claimOutcome } from '../services/PredictionsService';

/** Props. */
export interface PredictionPositionsScreenProps {
  /** Back-nav. */
  onBack: () => void;
  /** Mnemonic (required for claim signing). */
  mnemonic: string;
}

/**
 * Render the user's prediction positions.
 * @param props - See {@link PredictionPositionsScreenProps}.
 * @returns JSX.
 */
export default function PredictionPositionsScreen(
  props: PredictionPositionsScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const { mnemonic, onBack } = props;

  const [rows, setRows] = useState<readonly PredictionPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingMarket, setClaimingMarket] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    if (address === '') return;
    setLoading(true);
    try {
      const list = await getPredictionsClient().getUserPositions(address);
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  const onClaim = useCallback(
    (row: PredictionPosition): void => {
      setClaimingMarket(row.marketId);
      setMessage(undefined);
      void (async (): Promise<void> => {
        try {
          const detail = await getPredictionsClient().getMarket(row.marketId);
          if (detail === undefined) {
            throw new Error('Market detail unavailable');
          }
          const res = await claimOutcome({
            market: detail,
            outcome: row.outcome,
            trader: address,
            mnemonic,
          });
          setMessage(
            t('predictions.claimSuccess', {
              defaultValue: `Claim broadcast — tx ${res.txHash.slice(0, 10)}… on chain ${res.chainId}`,
            }),
          );
          await load();
        } catch (err) {
          setMessage(err instanceof Error ? err.message : String(err));
        } finally {
          setClaimingMarket(undefined);
        }
      })();
    },
    [address, mnemonic, t, load],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('predictions.positionsTitle', { defaultValue: 'Your predictions' })}
        </Text>
      </View>
      {message !== undefined && (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      <FlatList
        data={[...rows]}
        keyExtractor={(row) => `${row.marketId}:${row.outcome}`}
        renderItem={({ item }) => (
          <PositionRow
            row={item}
            onClaim={onClaim}
            claiming={claimingMarket === item.marketId}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>
              {t('predictions.positionsLoading', { defaultValue: 'Loading positions…' })}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {t('predictions.positionsEmpty', {
                defaultValue: 'No prediction positions yet.',
              })}
            </Text>
          )
        }
      />
    </View>
  );
}

/** Single position row with claim CTA when claimable. */
function PositionRow({
  row,
  onClaim,
  claiming,
}: {
  row: PredictionPosition;
  onClaim: (row: PredictionPosition) => void;
  claiming: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const pnl = Number.parseFloat(row.pnlUsd);
  const pnlColor = pnl >= 0 ? colors.primary : colors.danger;
  return (
    <Card style={styles.card}>
      <Text numberOfLines={2} style={styles.question}>
        {row.marketQuestion}
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t('predictions.side', { defaultValue: 'Side' })}</Text>
        <Text style={styles.value}>{row.outcome.toUpperCase()}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('predictions.shares', { defaultValue: 'Shares' })}</Text>
        <Text style={styles.value}>{row.shares}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('predictions.entry', { defaultValue: 'Entry' })}</Text>
        <Text style={styles.value}>
          {Math.round(Number.parseFloat(row.avgPrice) * 100)}¢
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('predictions.mark', { defaultValue: 'Mark' })}</Text>
        <Text style={styles.value}>
          {Math.round(Number.parseFloat(row.markPrice) * 100)}¢
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('predictions.pnl', { defaultValue: 'P&L (USD)' })}</Text>
        <Text style={[styles.value, { color: pnlColor }]}>{row.pnlUsd}</Text>
      </View>
      {row.claimable && (
        <View style={styles.claimRow}>
          <Button
            title={
              claiming
                ? t('predictions.claiming', { defaultValue: 'Claiming…' })
                : t('predictions.claim', { defaultValue: 'Claim' })
            }
            onPress={() => onClaim(row)}
            disabled={claiming}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { marginVertical: 6, padding: 12 },
  question: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { color: colors.textSecondary, fontSize: 12 },
  value: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  claimRow: { marginTop: 10 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  message: {
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
  },
});
