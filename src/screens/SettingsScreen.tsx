/**
 * SettingsScreen — app-wide preferences.
 *
 * Phase 5 scope:
 *   - Language picker (10 locales; selection persists via the platform
 *     StorageAdapter so it survives app restarts).
 *   - Auto-lock duration (1 / 5 / 15 / 30 min). Actual alarm-driven
 *     unlock gate lands in Phase 5 Week 2 — this screen currently only
 *     stores the preference.
 *   - Biometric toggle (reuses the flag already on authStore).
 *   - Sign-out.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import { colors } from '@theme/colors';
import { getBiometricAdapter, getStorageAdapter } from '@wallet/platform/registry';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import { useAuthStore } from '../store/authStore';

/** Storage keys used by this screen. */
const KEY_LANGUAGE = 'settings.language';
const KEY_AUTO_LOCK_MIN = 'settings.autoLockMinutes';

/** Allowed auto-lock durations. */
const AUTO_LOCK_OPTIONS: number[] = [1, 5, 15, 30];

/** Props accepted by SettingsScreen. */
export interface SettingsScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Sign-out callback (clears authStore). */
  onSignOut: () => void;
}

/**
 * Render the Settings screen.
 * @param props - See {@link SettingsScreenProps}.
 * @returns JSX.
 */
export default function SettingsScreen(props: SettingsScreenProps): JSX.Element {
  const { t } = useTranslation();
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);

  const [language, setLanguage] = useState<SupportedLanguage>(
    (i18next.language as SupportedLanguage) ?? 'en',
  );
  const [autoLockMin, setAutoLockMin] = useState<number>(5);

  // Hydrate auto-lock preference from storage on mount.
  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const stored = await getStorageAdapter().getItem<number>(KEY_AUTO_LOCK_MIN);
        if (typeof stored === 'number' && AUTO_LOCK_OPTIONS.includes(stored)) {
          setAutoLockMin(stored);
        }
      } catch {
        /* best effort */
      }
    })();
  }, []);

  const pickLanguage = useCallback(async (lang: SupportedLanguage): Promise<void> => {
    setLanguage(lang);
    await i18next.changeLanguage(lang);
    try {
      await getStorageAdapter().setItem(KEY_LANGUAGE, lang);
    } catch {
      /* persistence best-effort */
    }
  }, []);

  const pickAutoLock = useCallback(async (minutes: number): Promise<void> => {
    setAutoLockMin(minutes);
    try {
      await getStorageAdapter().setItem(KEY_AUTO_LOCK_MIN, minutes);
    } catch {
      /* best effort */
    }
  }, []);

  const toggleBiometric = useCallback(async (next: boolean): Promise<void> => {
    if (next) {
      try {
        const ok = await getBiometricAdapter().authenticate(
          t('settings.biometric.enableReason', {
            defaultValue: 'Enable biometric unlock for OmniBazaar',
          }),
        );
        setBiometricEnabled(ok);
      } catch {
        setBiometricEnabled(false);
      }
    } else {
      setBiometricEnabled(false);
    }
  }, [setBiometricEnabled, t]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title', { defaultValue: 'Settings' })}
        </Text>
      </View>

      {/* Language */}
      <Card style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t('settings.language', { defaultValue: 'Language' })}
        </Text>
        <View style={styles.chipRow}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              onPress={() => void pickLanguage(lang)}
              style={[styles.chip, lang === language && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: lang === language }}
            >
              <Text
                style={[styles.chipText, lang === language && styles.chipTextActive]}
              >
                {lang.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Auto-lock */}
      <Card style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t('settings.autoLock', { defaultValue: 'Auto-lock' })}
        </Text>
        <Text style={styles.rowSubtle}>
          {t('settings.autoLockHint', {
            defaultValue: 'Lock the app after this many minutes of inactivity.',
          })}
        </Text>
        <View style={styles.chipRow}>
          {AUTO_LOCK_OPTIONS.map((min) => (
            <Pressable
              key={min}
              onPress={() => void pickAutoLock(min)}
              style={[styles.chip, min === autoLockMin && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: min === autoLockMin }}
            >
              <Text
                style={[styles.chipText, min === autoLockMin && styles.chipTextActive]}
              >
                {t('settings.minutes', { defaultValue: '{{n}} min', n: min })}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Biometric */}
      <Card style={styles.section}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeader}>
              {t('settings.biometric.title', { defaultValue: 'Biometric Unlock' })}
            </Text>
            <Text style={styles.rowSubtle}>
              {t('settings.biometric.hint', {
                defaultValue: 'Use FaceID / TouchID / fingerprint to unlock without PIN.',
              })}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={(next) => void toggleBiometric(next)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title={t('settings.signOut', { defaultValue: 'Sign Out' })}
          onPress={props.onSignOut}
          variant="danger"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowSubtle: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: colors.background, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { paddingHorizontal: 16, marginTop: 24 },
});
