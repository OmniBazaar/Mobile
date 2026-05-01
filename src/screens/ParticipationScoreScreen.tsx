/**
 * ParticipationScoreScreen — surfaces the user's 100-point Proof-of-
 * Participation score + the per-component breakdown.
 *
 * Reads `/api/v1/participation/:address` from the validator. Component
 * weights mirror the WebApp (10 components, 100 pts max).
 *
 * @module screens/ParticipationScoreScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { getBaseUrl } from '../services/BootstrapService';
import { logger } from '../utils/logger';

interface ScoreEnvelope {
  total?: number;
  components?: Array<{ key: string; label: string; value: number; max: number }>;
}

/** Default 10-component table rendered when the validator declines. */
const DEFAULT_COMPONENTS: Array<{ key: string; label: string; max: number; min?: number }> = [
  { key: 'kyc', label: 'KYC Trust', max: 20 },
  { key: 'reputation', label: 'Marketplace Reputation', max: 10, min: -10 },
  { key: 'staking', label: 'Staking (Amount + Duration)', max: 24 },
  { key: 'referrals', label: 'Disseminator (Referrals)', max: 10 },
  { key: 'publisher', label: 'Publisher (Listings)', max: 4 },
  { key: 'forum', label: 'Forum Participation', max: 5 },
  { key: 'activity', label: 'Marketplace Activity', max: 5 },
  { key: 'policing', label: 'Community Policing', max: 5 },
  { key: 'reliability', label: 'Reliability', max: 5, min: -5 },
];

/** Props accepted by ParticipationScoreScreen. */
export interface ParticipationScoreScreenProps {
  onBack: () => void;
}

/**
 * Render the score breakdown.
 *
 * @param props - See {@link ParticipationScoreScreenProps}.
 * @returns JSX.
 */
export default function ParticipationScoreScreen(
  props: ParticipationScoreScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [score, setScore] = useState<ScoreEnvelope | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    if (address === '') return;
    try {
      const url = `${getBaseUrl().replace(/\/+$/, '')}/api/v1/participation/${encodeURIComponent(address)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as { data?: ScoreEnvelope } & ScoreEnvelope;
      setScore(body.data ?? body);
      setError(undefined);
    } catch (err) {
      logger.warn('[participation] fetch failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('participation.errors.loadFailed', {
          defaultValue: 'Could not load your score right now. Pull to refresh.',
        }),
      );
    }
  }, [address, t]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const total = score?.total ?? 0;
  const components = score?.components ?? DEFAULT_COMPONENTS.map((c) => ({
    key: c.key,
    label: c.label,
    value: 0,
    max: c.max,
  }));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('participation.title', { defaultValue: 'Participation Score' })}
        onBack={props.onBack}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={(): void => {
              setRefreshing(true);
              void refresh().finally(() => setRefreshing(false));
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.scoreCard}>
          {loading && score === undefined ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.scoreValue}>{total}</Text>
              <Text style={styles.scoreOutOf}>
                {t('participation.outOf', { defaultValue: 'of 100' })}
              </Text>
            </>
          )}
        </View>

        {components.map((c) => (
          <View key={c.key} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.rowLabel}>{c.label}</Text>
              <Text style={styles.rowValue}>
                {c.value} / {c.max}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(0, Math.min(100, (c.value / Math.max(1, c.max)) * 100))}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}

        {error !== undefined && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Text style={styles.disclaimer}>
          {t('participation.disclaimer', {
            defaultValue:
              'Your score updates as you participate. Validators require ≥ 50; listing nodes require ≥ 25.',
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 64 },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 32,
    borderRadius: 16,
    marginBottom: 24,
  },
  scoreValue: { color: colors.primary, fontSize: 48, fontWeight: '700' },
  scoreOutOf: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  row: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel: { color: colors.textPrimary, fontSize: 14 },
  rowValue: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  barTrack: { height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  error: { color: colors.danger, fontSize: 13, marginTop: 16, textAlign: 'center' },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginTop: 24, textAlign: 'center', lineHeight: 18 },
});
