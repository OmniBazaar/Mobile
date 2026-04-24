/**
 * StakingScreen — Phase 5 landing for the XOM staking subsystem.
 *
 * Phase 5 MVP: read-only display of the staking tier table and the
 * user's current stake (once the staking-read integration lands). The
 * stake / unstake / claim-rewards flows come in Phase 5 Week 2 when we
 * wire Wallet's StakingService through OmniRelay — those need gasless
 * L1 submission to be useful.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Card from '@components/Card';
import { colors } from '@theme/colors';

/** Amount tier + base APR. */
interface AmountTier {
  /** Label for the amount range. */
  range: string;
  /** Base APR for this amount (percent). */
  baseApr: number;
}

/** Duration tier + APR bonus. */
interface DurationTier {
  label: string;
  bonusApr: number;
}

/** Tier data matches the on-chain `staking` contract config. */
const AMOUNT_TIERS: AmountTier[] = [
  { range: '1 – 999,999 XOM', baseApr: 5 },
  { range: '1M – 9,999,999 XOM', baseApr: 6 },
  { range: '10M – 99,999,999 XOM', baseApr: 7 },
  { range: '100M – 999,999,999 XOM', baseApr: 8 },
  { range: '1B+ XOM', baseApr: 9 },
];

const DURATION_TIERS: DurationTier[] = [
  { label: 'Flexible', bonusApr: 0 },
  { label: '1 month', bonusApr: 1 },
  { label: '6 months', bonusApr: 2 },
  { label: '2 years', bonusApr: 3 },
];

/** Props accepted by StakingScreen. */
export interface StakingScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the staking-tier reference screen.
 * @param props - See {@link StakingScreenProps}.
 * @returns JSX.
 */
export default function StakingScreen(props: StakingScreenProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('staking.title', { defaultValue: 'Staking' })}
        </Text>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t('staking.amountTier', { defaultValue: 'Base APR by Stake Size' })}
        </Text>
        {AMOUNT_TIERS.map((tier) => (
          <View key={tier.range} style={styles.row}>
            <Text style={styles.rowLabel}>{tier.range}</Text>
            <Text style={styles.rowValue}>{tier.baseApr}%</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t('staking.durationTier', { defaultValue: 'Duration Bonus' })}
        </Text>
        {DURATION_TIERS.map((tier) => (
          <View key={tier.label} style={styles.row}>
            <Text style={styles.rowLabel}>{tier.label}</Text>
            <Text style={styles.rowValue}>
              {tier.bonusApr === 0
                ? t('staking.noBonus', { defaultValue: 'No bonus' })
                : `+${tier.bonusApr}%`}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t('staking.range', { defaultValue: 'Total APR Range' })}
        </Text>
        <Text style={styles.summary}>
          {t('staking.rangeSummary', {
            defaultValue:
              'Base (5–9%) + duration bonus (0–3%) = 5–12% APR, paid in XOM.',
          })}
        </Text>
      </Card>

      <Text style={styles.comingSoon}>
        {t('staking.comingSoon', {
          defaultValue: 'Stake / unstake / claim flows land in the next update.',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  summary: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  comingSoon: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
