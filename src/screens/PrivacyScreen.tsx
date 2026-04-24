/**
 * PrivacyScreen — COTI pXOM shield/unshield entry.
 *
 * XOM ↔ pXOM conversion via COTI V2's privacy contract. First-time users
 * must run `_safeOnboard()` — the screen detects via PrivacyService
 * whether that's already been done and surfaces the right CTA.
 *
 * Phase 3 Week 2 MVP: onboard detection + shield/unshield entry. The
 * actual COTI tx submission runs through PrivacyService.shield /
 * .unshield which internally hit the validator's privacy endpoint.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import {
  getPrivacyService,
  PRIVACY_FEE_BPS,
} from '@wallet/services/privacy/PrivacyService';
import { useAuthStore } from '../store/authStore';

/** Props accepted by PrivacyScreen. */
export interface PrivacyScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/** Active direction tab. */
type Direction = 'shield' | 'unshield';

/**
 * Render the XOM ↔ pXOM conversion screen.
 * @param props - See {@link PrivacyScreenProps}.
 * @returns JSX.
 */
export default function PrivacyScreen(props: PrivacyScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const [direction, setDirection] = useState<Direction>('shield');
  const [amount, setAmount] = useState('');
  const [onboarded, setOnboarded] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);

  // Probe onboard status on mount.
  useEffect(() => {
    if (address === '') return;
    void (async (): Promise<void> => {
      try {
        const res = await getPrivacyService().isOnboarded(address);
        setOnboarded(res.onboarded);
      } catch (err) {
        console.warn('[privacy] onboard status check failed', err);
        setOnboarded(false);
      }
    })();
  }, [address]);

  const amountError = useMemo(() => {
    if (amount === '') return undefined;
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) {
      return t('privacy.error.invalidAmount', { defaultValue: 'Enter a valid decimal amount.' });
    }
    if (Number.parseFloat(amount) <= 0) {
      return t('privacy.error.zeroAmount', { defaultValue: 'Amount must be positive.' });
    }
    return undefined;
  }, [amount, t]);

  const canSubmit = amount !== '' && amountError === undefined && !busy && address !== '';
  const feePercent = (PRIVACY_FEE_BPS / 100).toFixed(2);

  const handleSubmit = useCallback((): void => {
    if (!canSubmit) return;
    const actionKey = direction === 'shield' ? 'privacy.confirm.shield' : 'privacy.confirm.unshield';
    const actionDefault =
      direction === 'shield'
        ? 'Shield {{amount}} XOM into pXOM? A {{fee}}% fee applies.'
        : 'Unshield {{amount}} pXOM back to XOM? A {{fee}}% fee applies.';
    Alert.alert(
      t('privacy.confirm.title', { defaultValue: 'Confirm Privacy Conversion' }),
      t(actionKey, { defaultValue: actionDefault, amount, fee: feePercent }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: () => {
            void (async (): Promise<void> => {
              setBusy(true);
              setError(undefined);
              setStatus(undefined);
              try {
                const service = getPrivacyService();
                const result =
                  direction === 'shield'
                    ? await service.shield(address, amount)
                    : await service.unshield(address, amount);
                setStatus(
                  t('privacy.submitted', {
                    defaultValue: 'Submitted — tx {{hash}}',
                    hash: result.txHash?.slice(0, 12) ?? '…',
                  }),
                );
                setAmount('');
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [canSubmit, direction, amount, feePercent, address, t]);

  if (onboarded === undefined) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('privacy.probing', { defaultValue: 'Checking COTI onboarding…' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('privacy.title', { defaultValue: 'Private XOM (pXOM)' })}
        </Text>
        <Text style={styles.subtitle}>
          {t('privacy.subtitle', {
            defaultValue:
              'Shield XOM into pXOM on COTI V2 for confidential balances and transfers. Unshield back to XOM anytime.',
          })}
        </Text>
      </View>

      {!onboarded && (
        <Card style={styles.onboardCard}>
          <Text style={styles.onboardTitle}>
            {t('privacy.onboard.title', { defaultValue: 'First-time setup needed' })}
          </Text>
          <Text style={styles.onboardBody}>
            {t('privacy.onboard.body', {
              defaultValue:
                "Your wallet hasn't been registered with COTI yet. The first shield tx will call `_safeOnboard()` automatically — you only need to confirm once.",
            })}
          </Text>
        </Card>
      )}

      <View style={styles.directionRow}>
        <Pressable
          onPress={() => setDirection('shield')}
          style={[styles.directionChip, direction === 'shield' && styles.directionChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: direction === 'shield' }}
        >
          <Text
            style={[
              styles.directionText,
              direction === 'shield' && styles.directionTextActive,
            ]}
          >
            {t('privacy.shield', { defaultValue: 'Shield (XOM → pXOM)' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setDirection('unshield')}
          style={[styles.directionChip, direction === 'unshield' && styles.directionChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: direction === 'unshield' }}
        >
          <Text
            style={[
              styles.directionText,
              direction === 'unshield' && styles.directionTextActive,
            ]}
          >
            {t('privacy.unshield', { defaultValue: 'Unshield (pXOM → XOM)' })}
          </Text>
        </Pressable>
      </View>

      <Input
        label={t('privacy.amount', {
          defaultValue: direction === 'shield' ? 'Amount of XOM to shield' : 'Amount of pXOM to unshield',
        })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.0"
        error={amountError}
      />

      <Text style={styles.fee}>
        {t('privacy.feeHint', {
          defaultValue: 'Privacy fee: {{fee}}% (paid to the protocol).',
          fee: feePercent,
        })}
      </Text>

      {status !== undefined && <Text style={styles.status}>{status}</Text>}
      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {busy ? (
          <LoadingSpinner
            label={t('privacy.submitting', { defaultValue: 'Submitting…' })}
          />
        ) : (
          <Button
            title={
              direction === 'shield'
                ? t('privacy.cta.shield', { defaultValue: 'Shield XOM' })
                : t('privacy.cta.unshield', { defaultValue: 'Unshield pXOM' })
            }
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingBottom: 32, paddingHorizontal: 16 },
  header: { paddingTop: 56, paddingBottom: 16 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  onboardCard: { marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.primary },
  onboardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  onboardBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  directionRow: { flexDirection: 'row', marginBottom: 16 },
  directionChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  directionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  directionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  directionTextActive: { color: colors.background, fontWeight: '700' },
  fee: { color: colors.textMuted, fontSize: 12, marginBottom: 12 },
  status: { color: colors.success, fontSize: 13, marginBottom: 8 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  actions: { marginTop: 16 },
});
