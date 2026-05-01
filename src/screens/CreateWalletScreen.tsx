/**
 * CreateWalletScreen — deterministic-credentials sign-up form.
 *
 * Single screen: username + email + password + confirm-password →
 * derives a BIP39 seed via PBKDF2-SHA512(password, salt=username) and
 * registers the wallet on the validator. The seed is the deterministic
 * function of (username, password); typing the same pair on any client
 * regenerates the same wallet. There is no separate mnemonic to back up.
 *
 * Mirrors `Wallet/src/popup/pages/onboarding/CreateWallet.tsx` so users
 * have one credential pair across mobile, browser-extension, and web.
 *
 * Email is collected here and sent to the validator at registration.
 * The validator emails a 6-digit verification code; the next step in
 * the navigator collects that code via `EmailVerifyScreen`.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import {
  deriveDeterministicWallet,
  type DerivedKeys,
} from '../services/WalletCreationService';

/** Username regex — mirrors validator-side canonical form. */
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;
/** Quick email shape check. Validator does the canonical RFC validation. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Props accepted by CreateWalletScreen. */
export interface CreateWalletScreenProps {
  /**
   * Fired once derivation succeeds. The navigator should advance to
   * the registration step, which posts the attestation to the
   * validator and triggers the verification email.
   */
  onAccountReady: (params: {
    keys: DerivedKeys;
    username: string;
    email: string;
    referralCode?: string;
  }) => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

/**
 * Render the create-account form.
 *
 * @param props - See {@link CreateWalletScreenProps}.
 * @returns JSX.
 */
export default function CreateWalletScreen(props: CreateWalletScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = useCallback((): void => {
    setError(undefined);
    const canonicalUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(canonicalUsername)) {
      setError(t('createWallet.usernameInvalid', {
        defaultValue: 'Username must be 3–20 characters: lowercase letters, digits, or underscore, starting with a letter.',
      }));
      return;
    }
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('createWallet.emailInvalid', { defaultValue: 'Enter a valid email address.' }));
      return;
    }
    if (password.length < 8) {
      setError(t('createWallet.passwordTooShort', {
        defaultValue: 'Password must be at least 8 characters.',
      }));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('createWallet.passwordMismatch', { defaultValue: 'Passwords do not match.' }));
      return;
    }

    setLoading(true);
    // Derivation is synchronous (~150 ms on mid-range Android for
    // 100k PBKDF2 iters) — defer one tick so the spinner paints.
    setTimeout(() => {
      try {
        const keys = deriveDeterministicWallet(canonicalUsername, password);
        const trimmedReferral = referralCode.trim();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        props.onAccountReady({
          keys,
          username: canonicalUsername,
          email: trimmedEmail,
          ...(trimmedReferral.length > 0 && { referralCode: trimmedReferral }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(t('createWallet.deriveFailed', {
          defaultValue: 'Wallet derivation failed: {{msg}}',
          msg,
        }));
        setLoading(false);
      }
    }, 0);
  }, [props, t, username, email, password, confirmPassword, referralCode]);

  if (loading) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('createWallet.generating', {
            defaultValue: 'Deriving your wallet from credentials…',
          })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {t('createWallet.title', { defaultValue: 'Create Account' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('createWallet.deterministicHint', {
          defaultValue:
            'Your wallet is derived from your username and password. The same credentials regenerate the same wallet on any device — there is no separate seed phrase to write down.',
        })}
      </Text>

      <Input
        label={t('createWallet.usernameLabel', { defaultValue: 'Username' })}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="alice"
        textContentType="username"
      />
      <Input
        label={t('createWallet.emailLabel', { defaultValue: 'Email' })}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="alice@example.com"
        textContentType="emailAddress"
      />
      <Input
        label={t('createWallet.passwordLabel', { defaultValue: 'Password' })}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
      />
      <Input
        label={t('createWallet.confirmPasswordLabel', {
          defaultValue: 'Confirm Password',
        })}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
      />
      <Input
        label={t('createWallet.referralLabel', {
          defaultValue: 'Referral Code (optional)',
        })}
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Button
          title={t('createWallet.cta.create', { defaultValue: 'Create Account' })}
          onPress={handleSubmit}
          style={styles.actionButton}
        />
        <Button
          title={t('common.cancel', { defaultValue: 'Cancel' })}
          onPress={props.onCancel}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  error: { color: colors.danger, fontSize: 14, marginBottom: 16, marginTop: 8 },
  actions: { marginTop: 24 },
  actionButton: { marginBottom: 12 },
});
