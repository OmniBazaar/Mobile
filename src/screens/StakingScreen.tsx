/**
 * StakingScreen — XOM staking: reference tiers + live stake / unstake /
 * claim flows.
 *
 * All three actions route through `StakingService`, which signs an
 * EIP-712 intent + legacy EIP-191 canonical and POSTs to the validator's
 * gasless relay endpoint (`/api/v1/staking/{stake,unstake,claim}`). The
 * user never pays gas on OmniCoin L1.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { ethers } from 'ethers';

import Card from '@components/Card';
import { Button } from '@components/index';
import { useRequireAuth } from '@components/RequireAuth';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import {
  claim as claimRewards,
  stake as stakeAction,
  unstake as unstakeAction,
} from '../services/StakingService';
import { getStakingPosition, type StakingPosition } from '../services/InventoryService';

/** Amount tier + base APR. */
interface AmountTier {
  range: string;
  baseApr: number;
}

/** Duration tier + APR bonus. */
interface DurationTier {
  label: string;
  days: number;
  bonusApr: number;
}

const AMOUNT_TIERS: AmountTier[] = [
  { range: '1 – 999,999 XOM', baseApr: 5 },
  { range: '1M – 9,999,999 XOM', baseApr: 6 },
  { range: '10M – 99,999,999 XOM', baseApr: 7 },
  { range: '100M – 999,999,999 XOM', baseApr: 8 },
  { range: '1B+ XOM', baseApr: 9 },
];

const DURATION_TIERS: DurationTier[] = [
  { label: 'Flexible', days: 0, bonusApr: 0 },
  { label: '1 month', days: 30, bonusApr: 1 },
  { label: '6 months', days: 180, bonusApr: 2 },
  { label: '2 years', days: 730, bonusApr: 3 },
];

/** Props. */
export interface StakingScreenProps {
  /** Back-nav. */
  onBack: () => void;
  /** BIP39 mnemonic — required for signing stake / unstake / claim intents. */
  mnemonic: string;
}

/**
 * Render tiers + action controls.
 * @param props - See {@link StakingScreenProps}.
 * @returns JSX.
 */
export default function StakingScreen(props: StakingScreenProps): JSX.Element {
  const { t } = useTranslation();
  const { mnemonic, onBack } = props;
  const staker = useAuthStore((s) => s.address);
  const requireAuth = useRequireAuth();

  const [amount, setAmount] = useState('');
  const [durationIdx, setDurationIdx] = useState(0);
  const [busy, setBusy] = useState<'stake' | 'unstake' | 'claim' | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [position, setPosition] = useState<StakingPosition | undefined>(undefined);

  const loadPosition = useCallback(async (): Promise<void> => {
    if (staker === '') return;
    setPosition(await getStakingPosition(staker));
  }, [staker]);

  useEffect(() => {
    void loadPosition();
  }, [loadPosition]);

  const canStake = amount !== '' && Number.parseFloat(amount) > 0 && mnemonic !== '';
  const canUnstake = amount !== '' && Number.parseFloat(amount) > 0 && mnemonic !== '';
  const canClaim = mnemonic !== '';

  const withErrorHandling = useCallback(
    async (
      kind: 'stake' | 'unstake' | 'claim',
      fn: () => Promise<{ txHash: string }>,
    ): Promise<void> => {
      setBusy(kind);
      setMessage(undefined);
      try {
        const { txHash } = await fn();
        setMessage(
          t('staking.success', {
            defaultValue: `${kind} submitted — tx ${txHash.slice(0, 10)}…`,
          }),
        );
        await loadPosition();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(undefined);
      }
    },
    [t, loadPosition],
  );

  const onStake = useCallback((): void => {
    const wei = ethers.parseUnits(amount, 18).toString();
    const { days } = DURATION_TIERS[durationIdx] ?? DURATION_TIERS[0]!;
    Alert.alert(
      t('staking.confirmStakeTitle', { defaultValue: 'Confirm stake' }),
      t('staking.confirmStakeBody', {
        defaultValue: `Stake ${amount} XOM for ${days === 0 ? 'flexible' : `${days} days`}?`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: () => {
            void withErrorHandling('stake', () =>
              stakeAction({ staker, amount: wei, durationDays: days, mnemonic }),
            );
          },
        },
      ],
    );
  }, [amount, durationIdx, staker, mnemonic, t, withErrorHandling]);

  const onUnstake = useCallback((): void => {
    const wei = ethers.parseUnits(amount, 18).toString();
    Alert.alert(
      t('staking.confirmUnstakeTitle', { defaultValue: 'Confirm unstake' }),
      t('staking.confirmUnstakeBody', {
        defaultValue: `Unstake ${amount} XOM? Early withdrawal penalty may apply.`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: () => {
            void withErrorHandling('unstake', () =>
              unstakeAction({ staker, amount: wei, mnemonic }),
            );
          },
        },
      ],
    );
  }, [amount, staker, mnemonic, t, withErrorHandling]);

  const onClaim = useCallback((): void => {
    void withErrorHandling('claim', () => claimRewards({ staker, mnemonic }));
  }, [staker, mnemonic, withErrorHandling]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('staking.title', { defaultValue: 'Staking' })}
        </Text>
        <Text style={styles.subTitle}>
          {t('staking.gasless', {
            defaultValue: 'Stake + claim settle on OmniCoin L1 — zero gas.',
          })}
        </Text>
      </View>

      {position !== undefined && (
        <Card style={styles.section}>
          <Text style={styles.sectionHeader}>
            {t('staking.yourPosition', { defaultValue: 'Your position' })}
          </Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              {t('staking.staked', { defaultValue: 'Staked' })}
            </Text>
            <Text style={styles.rowValue}>
              {ethers.formatUnits(position.amount, 18)} XOM
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              {t('staking.pending', { defaultValue: 'Pending rewards' })}
            </Text>
            <Text style={styles.rowValue}>
              {ethers.formatUnits(position.pendingRewards, 18)} XOM
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              {t('staking.currentApr', { defaultValue: 'Current APR' })}
            </Text>
            <Text style={styles.rowValue}>
              {(position.baseAprBps / 100).toFixed(2)}% +{' '}
              {(position.bonusAprBps / 100).toFixed(2)}%
            </Text>
          </View>
          {position.unlockAt !== undefined && position.unlockAt > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                {t('staking.unlockAt', { defaultValue: 'Unlocks' })}
              </Text>
              <Text style={styles.rowValue}>
                {new Date(position.unlockAt * 1000).toLocaleDateString(i18n.language)}
              </Text>
            </View>
          )}
          {position.participationScore !== undefined && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                {t('staking.participation', { defaultValue: 'Participation score' })}
              </Text>
              <Text style={styles.rowValue}>{position.participationScore}/100</Text>
            </View>
          )}
        </Card>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t('staking.actions', { defaultValue: 'Stake / Unstake / Claim' })}
        </Text>
        <Text style={styles.label}>
          {t('staking.amountXom', { defaultValue: 'Amount (XOM)' })}
        </Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.0"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('staking.amountXom', { defaultValue: 'Amount (XOM)' })}
        />
        <Text style={styles.label}>
          {t('staking.duration', { defaultValue: 'Lock duration' })}
        </Text>
        <View style={styles.durationRow}>
          {DURATION_TIERS.map((tier, i) => (
            <Pressable
              key={tier.label}
              onPress={() => setDurationIdx(i)}
              style={[styles.durationChip, durationIdx === i && styles.durationChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: durationIdx === i }}
            >
              <Text
                style={[
                  styles.durationText,
                  durationIdx === i && styles.durationTextActive,
                ]}
              >
                {tier.label}
              </Text>
              <Text
                style={[
                  styles.durationBonus,
                  durationIdx === i && styles.durationTextActive,
                ]}
              >
                +{tier.bonusApr}%
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.buttonGrid}>
          <View style={styles.buttonCell}>
            <Button
              title={
                busy === 'stake'
                  ? t('staking.submitting', { defaultValue: 'Submitting…' })
                  : t('staking.stake', { defaultValue: 'Stake' })
              }
              onPress={(): void =>
                requireAuth(
                  t('authPrompt.toStake', { defaultValue: 'Sign in to stake or unstake.' }),
                  onStake,
                  'Staking',
                  'stake',
                )
              }
              disabled={!canStake || busy !== undefined}
            />
          </View>
          <View style={styles.buttonCell}>
            <Button
              title={
                busy === 'unstake'
                  ? t('staking.submitting', { defaultValue: 'Submitting…' })
                  : t('staking.unstake', { defaultValue: 'Unstake' })
              }
              onPress={(): void =>
                requireAuth(
                  t('authPrompt.toStake', { defaultValue: 'Sign in to stake or unstake.' }),
                  onUnstake,
                  'Staking',
                  'unstake',
                )
              }
              disabled={!canUnstake || busy !== undefined}
            />
          </View>
          <View style={styles.buttonCell}>
            <Button
              title={
                busy === 'claim'
                  ? t('staking.submitting', { defaultValue: 'Submitting…' })
                  : t('staking.claim', { defaultValue: 'Claim rewards' })
              }
              onPress={(): void =>
                requireAuth(
                  t('authPrompt.toStake', { defaultValue: 'Sign in to claim staking rewards.' }),
                  onClaim,
                  'Staking',
                  'claimRewards',
                )
              }
              disabled={!canClaim || busy !== undefined}
            />
          </View>
        </View>
        {message !== undefined && <Text style={styles.message}>{message}</Text>}
      </Card>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  subTitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: { color: colors.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: {
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
  },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 12 },
  durationChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  durationChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  durationBonus: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  durationTextActive: { color: colors.background },
  buttonGrid: { marginTop: 8 },
  buttonCell: { marginBottom: 8 },
  message: { color: colors.textMuted, marginTop: 8, fontSize: 12 },
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
});
