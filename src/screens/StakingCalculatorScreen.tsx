/**
 * StakingCalculatorScreen — what-if APR calculator.
 *
 * Mirrors the WebApp earnings calculator. Pure on-device math (no
 * validator round-trip). Tier-based APR (5–9%) + duration bonus
 * (0–3%). Output: yearly + monthly + daily yield in XOM.
 *
 * @module screens/StakingCalculatorScreen
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';

const AMOUNT_TIERS: Array<{ floor: number; aprBps: number; label: string }> = [
  { floor: 1_000_000_000, aprBps: 900, label: '1B+ XOM' },
  { floor: 100_000_000, aprBps: 800, label: '100M – 999M XOM' },
  { floor: 10_000_000, aprBps: 700, label: '10M – 99M XOM' },
  { floor: 1_000_000, aprBps: 600, label: '1M – 9M XOM' },
  { floor: 0, aprBps: 500, label: '< 1M XOM' },
];

const DURATIONS: Array<{ months: number; label: string; bonusBps: number }> = [
  { months: 0, label: 'Flexible', bonusBps: 0 },
  { months: 1, label: '1 month', bonusBps: 100 },
  { months: 6, label: '6 months', bonusBps: 200 },
  { months: 24, label: '2 years', bonusBps: 300 },
];

/** Resolve the amount-tier APR. */
function tierFor(amount: number): { aprBps: number; label: string } {
  for (const tier of AMOUNT_TIERS) {
    if (amount >= tier.floor) return { aprBps: tier.aprBps, label: tier.label };
  }
  return { aprBps: 500, label: '< 1M XOM' };
}

/** Format USD-style number. */
function fmt(n: number, frac = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

/** Props accepted by StakingCalculatorScreen. */
export interface StakingCalculatorScreenProps {
  onBack: () => void;
}

/**
 * Render the calculator.
 *
 * @param props - See {@link StakingCalculatorScreenProps}.
 * @returns JSX.
 */
export default function StakingCalculatorScreen(
  props: StakingCalculatorScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const [amountStr, setAmountStr] = useState('100000');
  const [durationMonths, setDurationMonths] = useState<number>(6);

  const amountNum = Number(amountStr);
  const safeAmount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;

  const result = useMemo(() => {
    const tier = tierFor(safeAmount);
    const duration = DURATIONS.find((d) => d.months === durationMonths) ?? DURATIONS[0];
    const totalBps = tier.aprBps + (duration?.bonusBps ?? 0);
    const yearly = (safeAmount * totalBps) / 10_000;
    return {
      tierLabel: tier.label,
      durationLabel: duration?.label ?? 'Flexible',
      aprBps: tier.aprBps,
      bonusBps: duration?.bonusBps ?? 0,
      totalBps,
      yearly,
      monthly: yearly / 12,
      daily: yearly / 365,
    };
  }, [safeAmount, durationMonths]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('stakingCalc.title', { defaultValue: 'Staking Calculator' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>
          {t('stakingCalc.amount', { defaultValue: 'Amount staked (XOM)' })}
        </Text>
        <TextInput
          value={amountStr}
          onChangeText={setAmountStr}
          keyboardType="decimal-pad"
          placeholder="100000"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('stakingCalc.amountA11y', { defaultValue: 'Staked XOM amount' })}
        />

        <Text style={styles.label}>{t('stakingCalc.duration', { defaultValue: 'Duration' })}</Text>
        <View style={styles.chipsRow}>
          {DURATIONS.map((d) => (
            <Pressable
              key={d.months}
              onPress={(): void => setDurationMonths(d.months)}
              accessibilityRole="button"
              accessibilityState={{ selected: durationMonths === d.months }}
              style={[styles.chip, durationMonths === d.months && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, durationMonths === d.months && styles.chipTextActive]}
              >
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <SummaryRow label={t('stakingCalc.tier', { defaultValue: 'Tier' })} value={result.tierLabel} />
          <SummaryRow
            label={t('stakingCalc.baseApr', { defaultValue: 'Base APR' })}
            value={`${(result.aprBps / 100).toFixed(2)}%`}
          />
          <SummaryRow
            label={t('stakingCalc.bonusApr', { defaultValue: 'Duration bonus' })}
            value={`+${(result.bonusBps / 100).toFixed(2)}%`}
          />
          <SummaryRow
            label={t('stakingCalc.totalApr', { defaultValue: 'Total APR' })}
            value={`${(result.totalBps / 100).toFixed(2)}%`}
            primary
          />
          <View style={styles.divider} />
          <SummaryRow
            label={t('stakingCalc.yearly', { defaultValue: 'Yearly yield' })}
            value={`${fmt(result.yearly)} XOM`}
            primary
          />
          <SummaryRow
            label={t('stakingCalc.monthly', { defaultValue: 'Monthly' })}
            value={`${fmt(result.monthly)} XOM`}
          />
          <SummaryRow
            label={t('stakingCalc.daily', { defaultValue: 'Daily' })}
            value={`${fmt(result.daily, 4)} XOM`}
          />
        </View>

        <Text style={styles.disclaimer}>
          {t('stakingCalc.disclaimer', {
            defaultValue:
              'Estimates use the launch APR schedule (5–9% by tier, +0/1/2/3% by duration). Actual rewards adjust over time.',
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, primary === true && styles.summaryPrimary]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 48 },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    color: colors.textPrimary,
    fontSize: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  summaryCard: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryLabel: { color: colors.textSecondary, fontSize: 14 },
  summaryValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  summaryPrimary: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginVertical: 8 },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginTop: 24, textAlign: 'center', lineHeight: 18 },
});
