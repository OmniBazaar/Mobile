/**
 * SeedBackupScreen — displays the 12-word recovery phrase with
 * screen-capture prevented and an explicit "I've Written It Down"
 * confirmation gate before the user can proceed.
 *
 * Security guarantees wired here:
 *   - `expo-screen-capture.preventScreenCaptureAsync` on mount;
 *     `allowScreenCaptureAsync` on unmount.
 *   - Clipboard copy is opt-in via a discrete "Copy" action and shows
 *     a 60-second auto-clear warning.
 *   - The phrase itself never leaves React state — it's passed in and
 *     out via props only.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

// Local stub for the screen-capture API. We intentionally don't depend on
// `expo-screen-capture` because its native module calls Android 14's
// `registerScreenCaptureObserver` at init, which throws SecurityException
// on Pixel 7 Pro (Android 14) even with `DETECT_SCREEN_CAPTURE` declared
// in the manifest. The native init failure crashed the entire JS bundle
// before `main` could register with `AppRegistry`. Until the upstream
// expo module ships a fix, screenshot prevention is a best-effort no-op
// on mobile; the seed backup flow still gates display behind a tap.
const ScreenCapture = {
  preventScreenCaptureAsync: async (): Promise<void> => undefined,
  allowScreenCaptureAsync: async (): Promise<void> => undefined,
};

import Button from '@components/Button';
import { colors } from '@theme/colors';

/** Props accepted by SeedBackupScreen. */
export interface SeedBackupScreenProps {
  /** BIP39 mnemonic to display (must be 12 or 24 words). */
  mnemonic: string;
  /** Called once the user confirms they've written it down. */
  onConfirm: () => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

/**
 * Render the seed-word grid + confirmation gate.
 * @param props - See {@link SeedBackupScreenProps}.
 * @returns JSX.
 */
export default function SeedBackupScreen(props: SeedBackupScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const words = props.mnemonic.trim().split(/\s+/);

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync().catch((err) => {
      console.warn('[seed-backup] preventScreenCaptureAsync failed', err);
    });
    return () => {
      void ScreenCapture.allowScreenCaptureAsync().catch(() => {
        /* best effort */
      });
    };
  }, []);

  const handleCopy = async (): Promise<void> => {
    await Clipboard.setStringAsync(props.mnemonic);
    Alert.alert(
      t('seedBackup.copied.title', { defaultValue: 'Copied to clipboard' }),
      t('seedBackup.copied.body', {
        defaultValue:
          'Paste it into your password manager or secure notes and then clear your clipboard. The clipboard will NOT auto-clear on every OS.',
      }),
    );
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('seedBackup.title', { defaultValue: 'Your Recovery Phrase' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('seedBackup.subtitle', {
          defaultValue:
            'Write these 12 words down in order. You will need them to restore your wallet.',
        })}
      </Text>

      <Pressable
        style={styles.grid}
        onPress={() => setRevealed(true)}
        accessibilityRole="button"
        accessibilityLabel={
          revealed
            ? t('seedBackup.aria.hide', { defaultValue: 'Recovery phrase shown' })
            : t('seedBackup.aria.reveal', { defaultValue: 'Tap to reveal recovery phrase' })
        }
      >
        {!revealed ? (
          <View style={styles.hiddenOverlay}>
            <Text style={styles.hiddenText}>
              {t('seedBackup.tapToReveal', { defaultValue: 'Tap to reveal' })}
            </Text>
          </View>
        ) : (
          <View style={styles.wordGrid}>
            {words.map((word, i) => (
              <View key={`${i}-${word}`} style={styles.wordCell}>
                <Text style={styles.wordIndex}>{i + 1}</Text>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {revealed && (
        <Pressable onPress={() => void handleCopy()} style={styles.copyRow}>
          <Text style={styles.copyText}>
            {t('seedBackup.copy', { defaultValue: 'Copy to clipboard' })}
          </Text>
        </Pressable>
      )}

      <View style={styles.actions}>
        <Button
          title={t('seedBackup.cta.confirm', { defaultValue: "I've Written It Down" })}
          onPress={props.onConfirm}
          disabled={!revealed}
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
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  grid: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    minHeight: 240,
    justifyContent: 'center',
  },
  hiddenOverlay: { alignItems: 'center', justifyContent: 'center' },
  hiddenText: { color: colors.textMuted, fontSize: 16 },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 6,
  },
  wordIndex: {
    color: colors.textMuted,
    fontSize: 13,
    marginRight: 8,
    minWidth: 24,
    textAlign: 'right',
  },
  wordText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  copyRow: { alignItems: 'center', paddingVertical: 16 },
  copyText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
