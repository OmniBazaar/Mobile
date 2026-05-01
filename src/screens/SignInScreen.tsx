/**
 * SignInScreen — deterministic-credentials sign-in.
 *
 * The user types their canonical username + password. We derive the
 * BIP-39 mnemonic from those two inputs deterministically (PBKDF2-SHA512
 * over `(password, salt=username, 100k iters)` → 32-byte entropy →
 * 24-word mnemonic), then run the standard challenge-response flow
 * against the validator (`/api/v1/auth/login-challenge` →
 * `/api/v1/auth/login-verify`).
 *
 * Same algorithm as Wallet/src/core/keyring/KeyringManager.ts and the
 * WebApp `EmbeddedWalletService.getMnemonic()` — so a user can register
 * on any client and log in on any other with just their credentials.
 * No mnemonic to memorise, no device-bound vault, no recovery sheet.
 *
 * If the validator surfaces an "unverified email" failure
 * (`needsVerification`), the screen invites the user back through the
 * email-verification step. Until that's wired through the navigator,
 * the error is just shown verbatim.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import { signInWithMnemonic } from '../services/AuthService';
import { deriveDeterministicWallet, type DerivedKeys } from '../services/WalletCreationService';
import { logger } from '../utils/logger';

/** Username canonical form — mirrors validator-side regex. */
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

/** Props accepted by SignInScreen. */
export interface SignInScreenProps {
  /** Fired on successful sign-in with the freshly-derived keys. */
  onSignedIn: (keys: DerivedKeys, username: string) => void;
  /** Fired on user cancel (back to welcome). */
  onCancel: () => void;
  /** Fired when the user taps "Forgot password?". */
  onForgotPassword?: () => void;
}

/**
 * Render the username + password sign-in form.
 *
 * @param props - See {@link SignInScreenProps}.
 * @returns JSX.
 */
export default function SignInScreen(props: SignInScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>('');
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSignIn = useCallback(async (): Promise<void> => {
    setError(undefined);
    const canonical = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(canonical)) {
      setError(t('signIn.usernameInvalid', {
        defaultValue: 'Username must be 3–20 characters: lowercase letters, digits, or underscore, starting with a letter.',
      }));
      return;
    }
    if (password.length < 8) {
      setError(t('signIn.passwordTooShort', {
        defaultValue: 'Password must be at least 8 characters.',
      }));
      return;
    }

    setBusy(true);
    setBusyLabel(t('signIn.deriving', {
      defaultValue: 'Unlocking wallet…',
    }));
    try {
      // Yield to the UI thread so the spinner paints before the PBKDF2
      // burn — without this the screen freezes for the duration of
      // derivation and looks crashed. setTimeout(0) gives Hermes one
      // event-loop tick to render the busy state.
      await new Promise<void>((r) => setTimeout(r, 0));
      const t0 = Date.now();
      const keys = deriveDeterministicWallet(canonical, password);
      logger.info('[signin] derive ok', {
        durationMs: Date.now() - t0,
        address: keys.address,
      });
      setBusyLabel(t('signIn.signing', { defaultValue: 'Signing challenge…' }));
      const t1 = Date.now();
      await signInWithMnemonic(keys.mnemonic, canonical);
      logger.info('[signin] challenge-response ok', { durationMs: Date.now() - t1 });
      props.onSignedIn(keys, canonical);
    } catch (err) {
      logger.error('[signin] failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      // Map known failure shapes to user-actionable copy. Anything else
      // falls through to a generic message that still tells the user
      // what to do next.
      const raw = err instanceof Error ? err.message : String(err);
      let copy: string;
      if (/not[_ -]?found|user_not_found|unknown[_ ]username/i.test(raw)) {
        copy = t('signIn.errors.userNotFound', {
          defaultValue:
            'No account matches that username. Check the spelling, or tap "Create Wallet" to register.',
        });
      } else if (/challenge[_ ]?expired|expired/i.test(raw)) {
        copy = t('signIn.errors.challengeExpired', {
          defaultValue: 'The login challenge expired. Tap Log In again.',
        });
      } else if (/rate[_ -]?limit|too many/i.test(raw)) {
        copy = t('signIn.errors.rateLimited', {
          defaultValue: 'Too many sign-in attempts. Please wait a minute and try again.',
        });
      } else if (/bad[_ -]?signature|invalid_password|verifyMessage/i.test(raw)) {
        copy = t('signIn.errors.badPassword', {
          defaultValue: 'Wrong password. Try again, or tap "Forgot Password?" if you cannot recover it.',
        });
      } else if (/network|timeout|fetch/i.test(raw)) {
        copy = t('signIn.errors.network', {
          defaultValue: 'No connection to OmniBazaar. Check your internet and try again.',
        });
      } else {
        copy = t('signIn.failed', {
          defaultValue: 'Sign-in failed: {{msg}}',
          msg: raw,
        });
      }
      setError(copy);
    } finally {
      setBusy(false);
    }
  }, [props, t, username, password]);

  if (busy) {
    return (
      <View style={styles.root}>
        <LoadingSpinner label={busyLabel} />
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
            'Enter your username and password. The same credentials regenerate your wallet on any device — there is no separate seed phrase.',
        })}
      </Text>

      <Input
        label={t('signIn.usernameLabel', { defaultValue: 'Username' })}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="alice"
        textContentType="username"
      />

      <Input
        label={t('signIn.passwordLabel', { defaultValue: 'Password' })}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
      />

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Button
          title={t('signIn.cta.sign', { defaultValue: 'Log In' })}
          onPress={() => void handleSignIn()}
          style={styles.actionButton}
        />
        {props.onForgotPassword !== undefined && (
          <Button
            title={t('signIn.cta.forgot', { defaultValue: 'Forgot Password?' })}
            onPress={props.onForgotPassword}
            variant="secondary"
            style={styles.actionButton}
          />
        )}
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
