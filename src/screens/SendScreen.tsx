/**
 * SendScreen — native EVM token sender.
 *
 * Phase 2 scope: native asset on one chain. The user picks a chain
 * from the dropdown, types a recipient + amount, and reviews the
 * transaction in a confirmation sheet before broadcast.
 *
 * The mnemonic is read from the parent screen at this phase (Phase 2
 * holds it in the RootNavigator's in-memory onboarding state). Phase 3
 * wires the encrypted-at-rest decryption path via EncryptionService.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import { parseAmount, sendNative, type SendResult } from '../services/SendService';

/** Props accepted by SendScreen. */
export interface SendScreenProps {
  /** Decrypted BIP39 mnemonic (held briefly in memory). */
  mnemonic: string;
  /** Back-navigation callback. */
  onBack: () => void;
  /** Fired after a successful broadcast with the tx hash. */
  onSent: (result: SendResult) => void;
}

/** Chains the user can pick from in Phase 2. */
const SUPPORTED_CHAINS: Array<{ chainId: number; name: string; symbol: string }> = [
  { chainId: 88008, name: 'OmniCoin', symbol: 'XOM' },
  { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
  { chainId: 137, name: 'Polygon', symbol: 'MATIC' },
  { chainId: 42161, name: 'Arbitrum', symbol: 'ETH' },
  { chainId: 8453, name: 'Base', symbol: 'ETH' },
  { chainId: 10, name: 'Optimism', symbol: 'ETH' },
  { chainId: 43114, name: 'Avalanche', symbol: 'AVAX' },
  { chainId: 56, name: 'BNB Chain', symbol: 'BNB' },
];

/**
 * Render the send form.
 * @param props - See {@link SendScreenProps}.
 * @returns JSX.
 */
export default function SendScreen(props: SendScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [chain, setChain] = useState(SUPPORTED_CHAINS[0] ?? SUPPORTED_CHAINS[0]!);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const toError = useMemo(() => {
    if (to === '') return undefined;
    if (!/^0x[0-9a-fA-F]{40}$/.test(to.trim())) {
      return t('send.error.invalidAddress', {
        defaultValue: 'Enter a valid 0x address.',
      });
    }
    return undefined;
  }, [to, t]);

  const amountError = useMemo(() => {
    if (amount === '') return undefined;
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) {
      return t('send.error.invalidAmount', { defaultValue: 'Enter a valid decimal amount.' });
    }
    if (Number.parseFloat(amount) <= 0) {
      return t('send.error.zeroAmount', { defaultValue: 'Amount must be greater than zero.' });
    }
    return undefined;
  }, [amount, t]);

  const canSubmit =
    to !== '' &&
    amount !== '' &&
    toError === undefined &&
    amountError === undefined &&
    !busy;

  const handleSend = useCallback((): void => {
    if (!canSubmit) return;
    Alert.alert(
      t('send.confirm.title', { defaultValue: 'Confirm Send' }),
      t('send.confirm.body', {
        defaultValue: 'Send {{amount}} {{symbol}} on {{chain}} to {{to}}?',
        amount,
        symbol: chain.symbol,
        chain: chain.name,
        to: `${to.slice(0, 6)}…${to.slice(-4)}`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('send.confirm.send', { defaultValue: 'Send' }),
          style: 'default',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(undefined);
              try {
                const result = await sendNative({
                  mnemonic: props.mnemonic,
                  chainId: chain.chainId,
                  to: to.trim(),
                  amount: parseAmount(amount),
                });
                props.onSent(result);
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
  }, [canSubmit, amount, chain, to, props, t]);

  if (busy) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('send.broadcasting', { defaultValue: 'Broadcasting transaction…' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('send.title', { defaultValue: 'Send' })}
      </Text>

      <Text style={styles.fieldLabel}>
        {t('send.chain', { defaultValue: 'Chain' })}
      </Text>
      <View style={styles.chainGrid}>
        {SUPPORTED_CHAINS.map((c) => (
          <Pressable
            key={c.chainId}
            onPress={() => setChain(c)}
            style={[styles.chainChip, c.chainId === chain.chainId && styles.chainChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: c.chainId === chain.chainId }}
          >
            <Text
              style={[
                styles.chainChipText,
                c.chainId === chain.chainId && styles.chainChipTextActive,
              ]}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label={t('send.to', { defaultValue: 'Recipient Address' })}
        value={to}
        onChangeText={setTo}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="0x…"
        error={toError}
      />

      <Input
        label={t('send.amount', { defaultValue: 'Amount' })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.0"
        error={amountError}
      />

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Button
          title={t('send.cta.review', { defaultValue: 'Review & Send' })}
          onPress={handleSend}
          disabled={!canSubmit}
          style={styles.actionButton}
        />
        <Button
          title={t('common.back', { defaultValue: 'Back' })}
          onPress={props.onBack}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
  },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 24 },
  fieldLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  chainGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chainChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chainChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chainChipText: { color: colors.textSecondary, fontSize: 13 },
  chainChipTextActive: { color: colors.background, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, marginTop: 8 },
  actions: { marginTop: 24 },
  actionButton: { marginBottom: 12 },
});
