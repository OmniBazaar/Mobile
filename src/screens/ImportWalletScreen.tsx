/**
 * ImportWalletScreen — user enters a 12 or 24-word BIP39 phrase to
 * restore an existing wallet. Validates the phrase client-side before
 * handing the derived keys back to the flow.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import { colors } from '@theme/colors';
import { importWallet, type DerivedKeys } from '../services/WalletCreationService';

/** Props accepted by ImportWalletScreen. */
export interface ImportWalletScreenProps {
  /** Fired with derived keys once the phrase validates. */
  onImported: (keys: DerivedKeys) => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

/**
 * Render the mnemonic entry form.
 * @param props - See {@link ImportWalletScreenProps}.
 * @returns JSX.
 */
export default function ImportWalletScreen(props: ImportWalletScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const handleContinue = useCallback((): void => {
    setError(undefined);
    setBusy(true);
    try {
      const keys = importWallet(phrase);
      props.onImported(keys);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        t('importWallet.invalid', {
          defaultValue: 'That recovery phrase is not valid: {{msg}}',
          msg,
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [phrase, props, t]);

  const words = phrase.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCountOk = words.length === 12 || words.length === 24;

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('importWallet.title', { defaultValue: 'Enter Your Recovery Phrase' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('importWallet.subtitle', {
          defaultValue:
            'Type the 12 or 24 words of your existing OmniBazaar wallet, separated by spaces.',
        })}
      </Text>

      <TextInput
        style={styles.input}
        multiline
        value={phrase}
        onChangeText={setPhrase}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        secureTextEntry={false}
        placeholder={t('importWallet.placeholder', {
          defaultValue: 'word1 word2 word3 word4 …',
        })}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('importWallet.label', { defaultValue: 'Recovery phrase' })}
      />

      <Text style={styles.counter}>
        {t('importWallet.counter', {
          defaultValue: '{{n}} word{{s}} entered',
          n: words.length,
          s: words.length === 1 ? '' : 's',
        })}
      </Text>

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Button
          title={t('importWallet.cta.continue', { defaultValue: 'Import Wallet' })}
          onPress={handleContinue}
          disabled={!wordCountOk || busy}
          style={styles.actionButton}
        />
        <Button
          title={t('common.back', { defaultValue: 'Back' })}
          onPress={props.onCancel}
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
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  input: {
    minHeight: 140,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  counter: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
