/**
 * BiometricEnrollScreen — opt-in to FaceID / TouchID / Fingerprint so
 * the user can unlock the app without entering their PIN on every
 * launch. Skipping here is fine; settings expose a toggle to enable
 * later.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getBiometricAdapter } from '@wallet/platform/registry';
import Button from '@components/Button';
import { colors } from '@theme/colors';

/** Props accepted by BiometricEnrollScreen. */
export interface BiometricEnrollScreenProps {
  /** Fired with `true` when biometrics enrolled; `false` on skip/unavailable. */
  onDone: (enabled: boolean) => void;
}

/**
 * Prompt the user to enable biometrics.
 * @param props - See {@link BiometricEnrollScreenProps}.
 * @returns JSX.
 */
export default function BiometricEnrollScreen(
  props: BiometricEnrollScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const [available, setAvailable] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const ok = await getBiometricAdapter().isAvailable();
        setAvailable(ok);
      } catch (err) {
        console.warn('[biometric-enroll] availability check failed', err);
        setAvailable(false);
      }
    })();
  }, []);

  const handleEnable = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const ok = await getBiometricAdapter().authenticate(
        t('biometric.reason', {
          defaultValue: 'Enable biometric unlock for OmniBazaar',
        }),
      );
      if (ok) {
        props.onDone(true);
      } else {
        setError(
          t('biometric.cancelled', {
            defaultValue: 'Biometric prompt was dismissed. You can enable this later in Settings.',
          }),
        );
      }
    } catch (err) {
      setError(
        t('biometric.error', {
          defaultValue: 'Biometric unlock is not available on this device.',
        }),
      );
      console.warn('[biometric-enroll] authenticate failed', err);
    } finally {
      setBusy(false);
    }
  }, [props, t]);

  const handleSkip = useCallback((): void => {
    props.onDone(false);
  }, [props]);

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('biometric.title', { defaultValue: 'Unlock With Biometrics?' })}
      </Text>
      <Text style={styles.subtitle}>
        {available === false
          ? t('biometric.unsupported', {
              defaultValue:
                'Your device does not have biometric unlock set up. You can still use your PIN.',
            })
          : t('biometric.subtitle', {
              defaultValue:
                'Use FaceID, TouchID, or your fingerprint to unlock the app quickly. Your PIN still works as a fallback.',
            })}
      </Text>

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {available === true && (
          <Button
            title={t('biometric.cta.enable', { defaultValue: 'Enable Biometric Unlock' })}
            onPress={() => void handleEnable()}
            disabled={busy}
            style={styles.actionButton}
          />
        )}
        <Button
          title={t('biometric.cta.skip', { defaultValue: 'Use PIN Only' })}
          onPress={handleSkip}
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
    paddingTop: 96,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  actions: { marginTop: 'auto', width: '100%' },
  actionButton: { marginBottom: 12 },
});
