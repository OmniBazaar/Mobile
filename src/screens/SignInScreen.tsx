/**
 * SignInScreen — challenge-response entry point.
 *
 * For users who have a wallet on this device already (locked state),
 * this screen collects the PIN, decrypts the mnemonic, and executes
 * the challenge-response flow against the validator. Phase 1 wires the
 * cryptographic path with the mnemonic provided by the caller (held
 * in memory post-unlock); Phase 2 moves decryption behind
 * EncryptionService so the on-screen flow only sees the decrypted
 * mnemonic briefly before it's wiped.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import { signInWithMnemonic } from '../services/AuthService';

/** Props accepted by SignInScreen. */
export interface SignInScreenProps {
  /** Mnemonic (already decrypted by the PIN gate upstream). */
  mnemonic: string;
  /** Fired on successful sign-in. */
  onSignedIn: () => void;
  /** Fired on user cancel. */
  onCancel: () => void;
}

/**
 * Render the challenge-response sign-in button + status.
 * @param props - See {@link SignInScreenProps}.
 * @returns JSX.
 */
export default function SignInScreen(props: SignInScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSignIn = useCallback(async (): Promise<void> => {
    setError(undefined);
    setBusy(true);
    try {
      // Sign-in screen exists only as a fallback for the onboarding
      // mnemonic-already-registered path; it always knows the username.
      await signInWithMnemonic(props.mnemonic, username);
      props.onSignedIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        t('signIn.failed', {
          defaultValue: 'Sign-in failed: {{msg}}',
          msg,
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [props, t]);

  if (busy) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('signIn.signing', { defaultValue: 'Signing challenge…' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('signIn.title', { defaultValue: 'Welcome Back' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('signIn.subtitle', {
          defaultValue:
            'Sign a one-time challenge with your wallet to prove ownership. No password required.',
        })}
      </Text>

      <Input
        label={t('signIn.usernameLabel', { defaultValue: 'Username (optional)' })}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="alice"
      />

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Button
          title={t('signIn.cta.sign', { defaultValue: 'Sign In' })}
          onPress={() => void handleSignIn()}
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
    paddingTop: 72,
    paddingBottom: 32,
  },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 12 },
  subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 16 },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
