/**
 * SeedVerifyScreen — user re-enters 3 random words from the mnemonic
 * before the onboarding flow continues. Verifies that the user actually
 * wrote the phrase down (or has it accessible).
 *
 * If any of the 3 inputs don't match, the "Continue" button stays
 * disabled and an inline error appears under the offending word.
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import { colors } from '@theme/colors';
import { chooseVerifyPositions } from '../services/WalletCreationService';
import { useScreenCaptureBlocked } from '../services/ScreenCaptureGuard';

/** Props accepted by SeedVerifyScreen. */
export interface SeedVerifyScreenProps {
  /** The full mnemonic the user just backed up. */
  mnemonic: string;
  /** Fired when all 3 prompts match. */
  onVerified: () => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

/**
 * Render the 3-word verification challenge.
 * @param props - See {@link SeedVerifyScreenProps}.
 * @returns JSX.
 */
export default function SeedVerifyScreen(props: SeedVerifyScreenProps): JSX.Element {
  const { t } = useTranslation();
  useScreenCaptureBlocked('seed-verify');

  const words = props.mnemonic.trim().split(/\s+/);
  const positions = useMemo(
    () => chooseVerifyPositions(words.length, 3),
    [words.length],
  );

  const [inputs, setInputs] = useState<string[]>(() => positions.map(() => ''));

  /** Whether every input (trimmed, lowercased) matches its target word. */
  const allMatch = positions.every((pos, i) => {
    const target = words[pos] ?? '';
    const entered = inputs[i]?.trim().toLowerCase() ?? '';
    return entered === target && target !== '';
  });

  const handleChange = (index: number, value: string): void => {
    setInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('seedVerify.title', { defaultValue: 'Verify Your Recovery Phrase' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('seedVerify.subtitle', {
          defaultValue: 'Enter the following words from your recovery phrase:',
        })}
      </Text>

      <View style={styles.fields}>
        {positions.map((pos, i) => {
          const entered = inputs[i]?.trim().toLowerCase() ?? '';
          const target = words[pos] ?? '';
          const showError = entered !== '' && entered !== target;
          return (
            <Input
              key={`pos-${pos}`}
              label={t('seedVerify.wordLabel', {
                defaultValue: 'Word #{{n}}',
                n: pos + 1,
              })}
              value={inputs[i] ?? ''}
              onChangeText={(v) => handleChange(i, v)}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              error={
                showError
                  ? t('seedVerify.mismatch', { defaultValue: 'Word does not match' })
                  : undefined
              }
            />
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button
          title={t('common.continue', { defaultValue: 'Continue' })}
          onPress={props.onVerified}
          disabled={!allMatch}
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
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: 24 },
  fields: { flex: 1 },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
