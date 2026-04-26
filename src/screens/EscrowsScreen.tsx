/**
 * EscrowsScreen — timeline view of every escrow the user has funded.
 *
 * Renders a row per escrow with the current state badge (Created →
 * Funded → Shipped → Released or Refunded / Disputed / Cancelled).
 * Sourced from `InventoryService.listBuyerEscrows` — the validator
 * emits one row per buyer escrow across all chains.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

import { colors } from '@theme/colors';
import Card from '@components/Card';
import { Button } from '../components';
import { useAuthStore } from '../store/authStore';
import { listBuyerEscrows, type EscrowSummary } from '../services/InventoryService';
import { releaseEscrow } from '../services/EscrowActionsService';

/** Props. */
export interface EscrowsScreenProps {
  /** Back-nav. */
  onBack: () => void;
}

/**
 * Render the escrow timeline list.
 * @param props - See {@link EscrowsScreenProps}.
 * @returns JSX.
 */
export default function EscrowsScreen(props: EscrowsScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const [rows, setRows] = useState<EscrowSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (address === '') return;
    setLoading(true);
    try {
      setRows(await listBuyerEscrows(address));
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
          {t('escrow.title', { defaultValue: 'Your purchases' })}
        </Text>
      </View>
      <FlashList
        data={rows}
        keyExtractor={(row) => row.escrowId}
        estimatedItemSize={140}
        renderItem={({ item }) => (
          <EscrowRow row={item} onReleased={() => void load()} />
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
              {t('escrow.loading', { defaultValue: 'Loading escrows…' })}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {t('escrow.empty', {
                defaultValue:
                  'No escrows yet. Purchases you fund in the P2P marketplace show up here.',
              })}
            </Text>
          )
        }
      />
    </View>
  );
}

/** Colour-coded status pill. */
function StatusBadge({ status }: { status: EscrowSummary['status'] }): JSX.Element {
  const palette = STATUS_PALETTE[status];
  return (
    <Text style={[styles.statusBadge, { color: palette.fg, backgroundColor: palette.bg }]}>
      {status}
    </Text>
  );
}

const STATUS_PALETTE: Record<EscrowSummary['status'], { fg: string; bg: string }> = {
  CREATED: { fg: colors.textSecondary, bg: colors.surfaceElevated },
  FUNDED: { fg: colors.primary, bg: colors.surfaceElevated },
  SHIPPED: { fg: colors.primary, bg: colors.surfaceElevated },
  RELEASED: { fg: colors.background, bg: colors.primary },
  REFUNDED: { fg: colors.background, bg: colors.danger },
  DISPUTED: { fg: colors.background, bg: colors.danger },
  CANCELLED: { fg: colors.textMuted, bg: colors.surfaceElevated },
};

/** Single escrow row. Renders a "Mark received" button on rows the
 * buyer can release (status FUNDED or SHIPPED). */
function EscrowRow({
  row,
  onReleased,
}: {
  row: EscrowSummary;
  onReleased: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const date = new Date(row.createdAt);
  const dateFmt = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(i18n.language);
  const canRelease = row.status === 'FUNDED' || row.status === 'SHIPPED';

  const onRelease = useCallback((): void => {
    Alert.alert(
      t('escrow.confirmReleaseTitle', { defaultValue: 'Mark item received?' }),
      t('escrow.confirmReleaseBody', {
        defaultValue:
          'This releases the escrow funds to the seller. Only confirm once you actually have the item / service.',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('escrow.releaseConfirm', { defaultValue: 'Release funds' }),
          style: 'destructive',
          onPress: () => {
            setReleasing(true);
            setError(undefined);
            void (async (): Promise<void> => {
              const res = await releaseEscrow(row.escrowId);
              setReleasing(false);
              if (!res.ok) {
                setError(res.error ?? 'Release failed');
                return;
              }
              onReleased();
            })();
          },
        },
      ],
    );
  }, [row.escrowId, t, onReleased]);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.listingTitle}>
          {row.listingTitle ?? `Listing ${row.listingId}`}
        </Text>
        <StatusBadge status={row.status} />
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.amount}>
          {row.amount} {row.currency}
        </Text>
        <Text style={styles.meta}>#{row.escrowId}</Text>
      </View>
      <Text style={styles.meta}>{dateFmt}</Text>
      {canRelease && (
        <View style={styles.actionRow}>
          <Button
            title={
              releasing
                ? t('escrow.releasing', { defaultValue: 'Releasing…' })
                : t('escrow.markReceived', { defaultValue: 'Mark received' })
            }
            onPress={onRelease}
            disabled={releasing}
          />
        </View>
      )}
      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">{error}</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listingTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', maxWidth: '70%' },
  statusBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 6,
  },
  amount: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actionRow: { marginTop: 10 },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48, paddingHorizontal: 24 },
});
