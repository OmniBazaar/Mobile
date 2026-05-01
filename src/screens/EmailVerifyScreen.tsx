/**
 * EmailVerifyScreen — collects the 6-digit OTP the validator emails
 * after registration and posts it to `/api/v1/auth/verify-email`.
 *
 * Mirrors the WebApp signup flow (see `WebApp/CLAUDE.md` "Signup flow
 * fix"): after registration succeeds, the validator emails a code; the
 * user types it here; on success we proceed to challenge-response login.
 *
 * Also exposes a "Resend code" path that posts to
 * `/api/v1/auth/resend-verification`.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import { colors } from '@theme/colors';
import { getBaseUrl } from '../services/BootstrapService';

/** Props accepted by EmailVerifyScreen. */
export interface EmailVerifyScreenProps {
  /** Email the validator just sent the code to. */
  email: string;
  /** Fired once the validator confirms the code is valid. */
  onVerified: () => void;
  /** Back-navigation callback. */
  onCancel: () => void;
}

const CODE_PATTERN = /^[0-9]{6}$/;

/**
 * Render the verification-code form.
 *
 * @param props - See {@link EmailVerifyScreenProps}.
 * @returns JSX.
 */
export default function EmailVerifyScreen(props: EmailVerifyScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [resendNotice, setResendNotice] = useState<string | undefined>(undefined);

  const handleVerify = useCallback(async (): Promise<void> => {
    setError(undefined);
    setResendNotice(undefined);
    const trimmed = code.trim();
    if (!CODE_PATTERN.test(trimmed)) {
      setError(t('emailVerify.codeInvalid', {
        defaultValue: 'Enter the 6-digit code sent to your email.',
      }));
      return;
    }
    setBusy(true);
    try {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: props.email, code: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      props.onVerified();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('emailVerify.failed', {
        defaultValue: 'Verification failed: {{msg}}',
        msg,
      }));
    } finally {
      setBusy(false);
    }
  }, [code, props, t]);

  const handleResend = useCallback(async (): Promise<void> => {
    setError(undefined);
    setResendNotice(undefined);
    setResending(true);
    try {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: props.email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResendNotice(t('emailVerify.resendSuccess', {
        defaultValue: 'A new code has been sent.',
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('emailVerify.resendFailed', {
        defaultValue: 'Could not resend code: {{msg}}',
        msg,
      }));
    } finally {
      setResending(false);
    }
  }, [props.email, t]);

  if (busy) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('emailVerify.verifying', { defaultValue: 'Verifying…' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('emailVerify.title', { defaultValue: 'Verify Your Email' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('emailVerify.subtitle', {
          defaultValue: 'We sent a 6-digit code to {{email}}. Enter it below to finish setting up your account.',
          email: props.email,
        })}
      </Text>

      <Input
        label={t('emailVerify.codeLabel', { defaultValue: 'Verification code' })}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="123456"
        textContentType="oneTimeCode"
      />

      {error !== undefined && <Text style={styles.error}>{error}</Text>}
      {resendNotice !== undefined && <Text style={styles.notice}>{resendNotice}</Text>}

      <View style={styles.actions}>
        <Button
          title={t('emailVerify.cta.verify', { defaultValue: 'Verify' })}
          onPress={() => void handleVerify()}
          style={styles.actionButton}
        />
        <Button
          title={
            resending
              ? t('emailVerify.cta.resending', { defaultValue: 'Sending…' })
              : t('emailVerify.cta.resend', { defaultValue: 'Resend Code' })
          }
          onPress={() => void handleResend()}
          variant="secondary"
          style={styles.actionButton}
          disabled={resending}
        />
        <Button
          title={t('common.cancel', { defaultValue: 'Cancel' })}
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
  notice: { color: colors.textSecondary, fontSize: 14, marginBottom: 16, fontStyle: 'italic' },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
});
