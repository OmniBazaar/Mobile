/**
 * AuthPromptScreen — modal sheet shown to guest users when they tap a
 * write-action ("Buy", "Send", "Swap") that requires a wallet.
 *
 * Two CTAs: "Sign In" and "Create Wallet". Tapping either route the
 * user out to the Onboarding stack. "Cancel" simply dismisses.
 *
 * Pattern follows Phantom + Coinbase Wallet — guests get full read
 * access; the auth gate appears only at the moment of a write.
 *
 * @module navigation/AuthPromptScreen
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from './types';

/** Route params for the AuthPrompt modal. */
export interface AuthPromptParams {
  /** Brief reason copy ("Sign in to buy this listing"). */
  reason: string;
  /** Optional intended deep-link route to resume after sign-in. */
  intendedRoute?: string;
}

/**
 * Render the modal.
 *
 * @param props - Route info.
 * @returns JSX.
 */
export default function AuthPromptScreen({
  route,
}: {
  route: { params?: AuthPromptParams };
}): React.ReactElement {
  const { t } = useTranslation();
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const setState = useAuthStore((s) => s.setState);
  const reason: string =
    route.params?.reason ??
    t('authPrompt.defaultReason', { defaultValue: 'Sign in to continue.' });
  return (
    <View style={styles.root}>
      <Pressable
        style={styles.dismissTarget}
        onPress={(): void => nav.goBack()}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss', { defaultValue: 'Dismiss' })}
      />
      <View style={styles.sheet} accessibilityRole="alert">
        <View style={styles.handle} />
        <Ionicons name="lock-closed-outline" size={36} color={colors.primary} />
        <Text style={styles.title} accessibilityRole="header">
          {t('authPrompt.title', { defaultValue: 'Sign in required' })}
        </Text>
        <Text style={styles.body}>{reason}</Text>
        <Pressable
          onPress={(): void => {
            // Drop guest state so RootNavigator routes us to Onboarding.
            setState('signedOut');
            nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('authPrompt.signInA11y', { defaultValue: 'Sign in to your wallet' })}
          style={[styles.button, styles.primary]}
        >
          <Text style={[styles.buttonText, styles.primaryText]}>
            {t('authPrompt.signIn', { defaultValue: 'Sign In' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={(): void => {
            setState('signedOut');
            nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('authPrompt.createA11y', {
            defaultValue: 'Create a new wallet',
          })}
          style={[styles.button, styles.secondary]}
        >
          <Text style={styles.buttonText}>
            {t('authPrompt.create', { defaultValue: 'Create Wallet' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={(): void => nav.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', { defaultValue: 'Cancel' })}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  dismissTarget: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSoft,
    marginBottom: 16,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 12 },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  primaryText: { color: colors.background },
  cancel: { paddingVertical: 12, marginTop: 8 },
  cancelText: { color: colors.textMuted, fontSize: 14 },
});
