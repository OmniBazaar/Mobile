/**
 * CreateWalletScreen — entry to the wallet-creation flow.
 *
 * Generates a fresh BIP39 mnemonic via WalletCreationService and hands
 * the 12 words to the SeedBackup screen. The actual mnemonic never
 * crosses the React component boundary after backup is confirmed —
 * SeedBackup strips it from state the moment the user proceeds.
 *
 * UX guarantees:
 *   - The mnemonic is generated locally on-demand; not fetched.
 *   - Haptic feedback on the "I'm Ready" confirm button.
 *   - Screen-capture is prevented on the seed-display screen via
 *     expo-screen-capture (wired by SeedBackup).
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import { createWallet, type DerivedKeys } from '../services/WalletCreationService';

/** Props accepted by CreateWalletScreen. */
export interface CreateWalletScreenProps {
  /** Invoked once the user has acknowledged the warning — `keys.mnemonic` is the new 12-word phrase. */
  onMnemonicReady: (keys: DerivedKeys) => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

/**
 * Render the create-wallet warning + Generate button.
 * @param props - See {@link CreateWalletScreenProps}.
 * @returns JSX.
 */
export default function CreateWalletScreen(props: CreateWalletScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback((): void => {
    setLoading(true);
    // Defer to next tick so the spinner paints — creation itself is
    // synchronous and completes in < 10 ms on mid-range Android.
    setTimeout(() => {
      try {
        const keys = createWallet(12);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        props.onMnemonicReady(keys);
      } catch (err) {
        console.error('[create-wallet] generation failed', err);
        setLoading(false);
      }
    }, 0);
  }, [props]);

  if (loading) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('createWallet.generating', { defaultValue: 'Generating your secure wallet…' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('createWallet.title', { defaultValue: 'Before We Begin' })}
      </Text>

      <View style={styles.warnings}>
        <Warning
          emoji="🔒"
          text={t('createWallet.warn.local', {
            defaultValue: 'Your wallet is generated on this device. We never see it.',
          })}
        />
        <Warning
          emoji="📝"
          text={t('createWallet.warn.write', {
            defaultValue:
              'You will see a 12-word recovery phrase. Write it down and store it somewhere safe.',
          })}
        />
        <Warning
          emoji="⚠️"
          text={t('createWallet.warn.lose', {
            defaultValue:
              'If you lose your recovery phrase you lose access to your wallet. No one can recover it for you.',
          })}
        />
      </View>

      <View style={styles.actions}>
        <Button
          title={t('createWallet.cta.generate', { defaultValue: 'Generate My Wallet' })}
          onPress={handleGenerate}
          style={styles.actionButton}
        />
        <Button
          title={t('common.cancel', { defaultValue: 'Cancel' })}
          onPress={props.onCancel}
          variant="secondary"
        />
      </View>
    </View>
  );
}

/** Helper row rendering a warning emoji + text. */
function Warning({ emoji, text }: { emoji: string; text: string }): JSX.Element {
  return (
    <View style={styles.warnRow}>
      <Text style={styles.warnEmoji}>{emoji}</Text>
      <Text style={styles.warnText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
  },
  warnings: { flex: 1, justifyContent: 'center' },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  warnEmoji: { fontSize: 24, marginRight: 12 },
  warnText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, flex: 1 },
  actions: { marginTop: 24 },
  actionButton: { marginBottom: 12 },
});
