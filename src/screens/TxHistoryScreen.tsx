/**
 * TxHistoryScreen — unified on-chain + shielded transaction list.
 *
 * Fetches from the validator's indexer via `TxHistoryService.getHistory`
 * with an automatic native-transfer fallback when the validator returns
 * no rows. Rows flagged `privacy: true` render a shield badge so users
 * can see shielded / unshielded state side-by-side (Track B4).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@theme/colors';
import Card from '@components/Card';
import { useAuthStore } from '../store/authStore';
import { getHistory, type TxHistoryRow } from '../services/TxHistoryService';

/** Props. */
export interface TxHistoryScreenProps {
  /** Back-nav. */
  onBack: () => void;
}

/**
 * Render transaction history.
 * @param props - See {@link TxHistoryScreenProps}.
 * @returns JSX.
 */
export default function TxHistoryScreen(props: TxHistoryScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const [rows, setRows] = useState<TxHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    if (address === '') return;
    setLoading(true);
    setError(undefined);
    try {
      const list = await getHistory(address);
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('txHistory.title', { defaultValue: 'Activity' })}
        </Text>
      </View>

      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => <HistoryRow row={item} />}
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
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Text style={styles.empty}>
              {t('txHistory.empty', {
                defaultValue: 'No activity yet. Send XOM or make your first purchase to see it here.',
              })}
            </Text>
          )
        }
      />
    </View>
  );
}

function HistoryRow({ row }: { row: TxHistoryRow }): JSX.Element {
  const { t } = useTranslation();
  const prefix = row.direction === 'in' ? '+' : row.direction === 'out' ? '−' : '↻';
  const valueColor =
    row.direction === 'in' ? colors.primary : colors.textPrimary;
  return (
    <Card style={styles.card}>
      <View style={styles.rowHeader}>
        <Text style={styles.label}>{row.label}</Text>
        {row.privacy === true && (
          <Text style={styles.privacyBadge}>
            {t('txHistory.shielded', { defaultValue: '🛡 Shielded' })}
          </Text>
        )}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>
          {prefix} {row.value} {row.symbol ?? ''}
        </Text>
        <Text style={styles.chain}>
          {t('txHistory.chain', { defaultValue: 'Chain' })} {row.chainId}
        </Text>
      </View>
      <Text style={styles.hash} numberOfLines={1}>
        {row.txHash}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 48 },
  card: { marginVertical: 6, padding: 12 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  privacyBadge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 },
  value: { fontSize: 16, fontWeight: '700' },
  chain: { color: colors.textMuted, fontSize: 11 },
  hash: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  loadingRow: { alignItems: 'center', paddingVertical: 48 },
  error: { color: colors.danger, fontSize: 13, marginHorizontal: 16, marginVertical: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48, paddingHorizontal: 24 },
});
