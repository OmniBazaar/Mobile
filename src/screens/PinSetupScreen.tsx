/**
 * PinSetupScreen — user chooses a 6-digit PIN that gates local wallet
 * access. The PIN is used to derive the AES-256-GCM key that encrypts
 * the mnemonic in SecureStore (PBKDF2, 100k iterations — delegated to
 * `@wallet/services/EncryptionService` once Mobile imports it).
 *
 * Phase 1 minimum: collect + confirm the PIN. Phase 2 wires it through
 * EncryptionService and persists the encrypted mnemonic.
 *
 * UX:
 *   - Two visible fields ("Enter PIN" + "Confirm PIN") with numeric
 *     keypad and secure-entry masking.
 *   - Strength rule: exactly 6 digits, not all-same-digit, not
 *     strictly-sequential.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import { colors } from '@theme/colors';
import { validatePin } from '../utils/pinValidation';

/** Props accepted by PinSetupScreen. */
export interface PinSetupScreenProps {
  /** Fired with the chosen PIN once both inputs match and pass strength check. */
  onPinSet: (pin: string) => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

// Re-export for callers that used `import { validatePin } from '.../PinSetupScreen'`.
export { validatePin };

/**
 * Render the PIN + confirm-PIN flow.
 * @param props - See {@link PinSetupScreenProps}.
 * @returns JSX.
 */
export default function PinSetupScreen(props: PinSetupScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');

  const pinError = useMemo(() => (pin === '' ? null : validatePin(pin)), [pin]);
  const matchError = useMemo(
    () => (confirm !== '' && pin !== confirm ? 'PINs do not match.' : null),
    [pin, confirm],
  );

  const canContinue = pinError === null && matchError === null && pin !== '' && pin === confirm;

  const handleContinue = useCallback((): void => {
    if (canContinue) props.onPinSet(pin);
  }, [canContinue, pin, props]);

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('pinSetup.title', { defaultValue: 'Choose a PIN' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('pinSetup.subtitle', {
          defaultValue:
            'Your 6-digit PIN unlocks this app on your device. It never leaves this phone.',
        })}
      </Text>

      <View style={styles.fields}>
        <Input
          label={t('pinSetup.enter', { defaultValue: 'Enter PIN' })}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          error={pinError ?? undefined}
        />
        <Input
          label={t('pinSetup.confirm', { defaultValue: 'Confirm PIN' })}
          value={confirm}
          onChangeText={setConfirm}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          error={matchError ?? undefined}
        />
      </View>

      <View style={styles.actions}>
        <Button
          title={t('common.continue', { defaultValue: 'Continue' })}
          onPress={handleContinue}
          disabled={!canContinue}
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
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  fields: { flex: 1 },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
