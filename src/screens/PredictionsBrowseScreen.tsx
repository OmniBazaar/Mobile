/**
 * PredictionsBrowseScreen — prediction markets catalog.
 *
 * Fetches open markets from @wallet/services/predictions/PredictionsClient
 * and renders a scrollable list. Each row shows the canonical question,
 * category, resolution date, and a short volume / yes-price summary.
 *
 * Phase 4 Week 2 MVP: browse. Per-market detail + buy + claim lands
 * in a follow-up commit once the unsigned-tx submission path for
 * Polymarket CTF is wired.
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
  type PredictionMarket,
} from '@wallet/services/predictions/PredictionsClient';
import Card from '@components/Card';
import { colors } from '@theme/colors';

/** Props. */
export interface PredictionsBrowseScreenProps {
  /** Called when the user taps a market row. Undefined disables tap. */
  onSelectMarket?: (market: PredictionMarket) => void;
}

/**
 * Render the predictions-markets catalog.
 * @param props - See {@link PredictionsBrowseScreenProps}.
 * @returns JSX.
 */
export default function PredictionsBrowseScreen(
  props: PredictionsBrowseScreenProps = {},
): JSX.Element {
  const { t } = useTranslation();
  const { onSelectMarket } = props;
  const [markets, setMarkets] = useState<readonly PredictionMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const rows = await getPredictionsClient().getOpenMarkets({ limit: 25 });
      setMarkets(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <FlatList
        data={markets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MarketRow
            market={item}
            onPress={onSelectMarket !== undefined ? () => onSelectMarket(item) : undefined}
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
            <Text style={styles.placeholder}>
              {t('predictions.loading', { defaultValue: 'Loading markets…' })}
            </Text>
          ) : (
            <Text style={styles.placeholder}>
              {t('predictions.empty', { defaultValue: 'No open markets right now.' })}
            </Text>
          )
        }
      />
    </View>
  );
}

/** Single-market card. */
function MarketRow({
  market,
  onPress,
}: {
  market: PredictionMarket;
  onPress?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const yes = market.outcomes.find((o) => o.label.toLowerCase() === 'yes');
  const resolutionDate = new Date(market.resolutionDate);
  const resolutionDateFmt = Number.isNaN(resolutionDate.getTime())
    ? market.resolutionDate
    : resolutionDate.toLocaleDateString();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={market.question} onPress={onPress}>
      <Card style={styles.card}>
        <Text numberOfLines={2} style={styles.question}>
          {market.question}
        </Text>
        <View style={styles.metaRow}>
          {market.category !== undefined && (
            <Text style={styles.chip}>{market.category}</Text>
          )}
          <Text style={styles.platformChip}>{market.platform}</Text>
        </View>
        <View style={styles.statsRow}>
          <StatBlock
            label={t('predictions.yesPrice', { defaultValue: 'YES' })}
            value={yes !== undefined ? `${(Number.parseFloat(yes.price) * 100).toFixed(0)}¢` : '—'}
          />
          <StatBlock
            label={t('predictions.volume', { defaultValue: 'Volume' })}
            value={`$${Number.parseFloat(market.totalVolume).toLocaleString()}`}
          />
          <StatBlock
            label={t('predictions.resolves', { defaultValue: 'Resolves' })}
            value={resolutionDateFmt}
          />
        </View>
      </Card>
    </Pressable>
  );
}

/** Labeled value column for the per-card stats row. */
function StatBlock({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  listContent: { paddingBottom: 32 },
  card: { marginBottom: 10 },
  question: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  metaRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' },
  chip: {
    color: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
    fontSize: 11,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 6,
  },
  platformChip: {
    color: colors.primary,
    backgroundColor: colors.surfaceElevated,
    fontSize: 11,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  stat: { flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  placeholder: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48 },
});
