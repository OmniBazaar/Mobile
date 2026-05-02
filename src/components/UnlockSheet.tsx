/**
 * UnlockSheet — Phase 12 contextual unlock modal for the mobile app.
 *
 * Mirrors the wallet-extension `<UnlockSheet>` — when a user with a
 * `'locked'` keystore taps a 🔒-lite action button (Buy / Stake / Swap /
 * Bridge / Sign), this sheet slides up from the bottom, the user
 * unlocks with biometric or password, and the deferred action resumes
 * from the same step. The user is never bounced out of context to
 * onboarding for what is functionally a re-enter-password event.
 *
 * Anti-phishing: like the extension, the sheet refuses to render its
 * password input if the cached username is missing — without that, we
 * cannot prove the user is on the same device that registered the
 * wallet. (The mobile equivalent of the extension's banner check.)
 *
 * Pairs 1:1 with `Wallet/src/popup/components/common/UnlockSheet.tsx`.
 *
 * @module components/UnlockSheet
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { deriveDeterministicWallet } from '../services/WalletCreationService';

/** Public props. */
export interface UnlockSheetProps {
  /** Whether the sheet is visible. */
  open: boolean;
  /**
   * i18n key fragment (under `auth.unlockSheet.actions`) describing
   * what the user is about to do (e.g. `buyListing`, `swap`, `stake`).
   * Used to fill the body sentence "To {{action}}, unlock your wallet."
   */
  actionKey: string;
  /** Optional dynamic action label that overrides `actionKey`. */
  actionLabel?: string;
  /** Called after a successful unlock. */
  onUnlocked: () => void;
  /** Called when the user cancels the sheet. */
  onCancel: () => void;
}

/**
 * Render the contextual unlock modal. Reads the cached username from
 * the auth store; the user only types their password. On success, the
 * deterministic-seed wallet is re-derived in place (same flow the
 * SignInScreen uses), `state` is flipped to `'unlocked'`, and the
 * `onUnlocked` callback fires.
 *
 * @param props - Sheet open state + callbacks + action context.
 * @returns React element.
 */
export default function UnlockSheet(props: UnlockSheetProps): React.ReactElement {
  const { open, actionKey, actionLabel, onUnlocked, onCancel } = props;
  const { t } = useTranslation();
  const username = useAuthStore((s) => s.username);
  const setMnemonic = useAuthStore((s) => s.setMnemonic);
  const setAddress = useAuthStore((s) => s.setAddress);
  const markUnlocked = useAuthStore((s) => s.markUnlocked);
  const passwordRef = useRef<TextInput>(null);
  const [password, setPassword] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setError('');
      setBusy(false);
      return;
    }
    // Auto-focus the password input on open so the user can start
    // typing immediately. Match the extension's behaviour.
    setTimeout(() => {
      passwordRef.current?.focus();
    }, 80);
  }, [open]);

  const submit = useCallback((): void => {
    if (busy) return;
    if (password.length === 0) {
      setError(t('auth.unlockSheet.errorPasswordRequired'));
      return;
    }
    if (username.length === 0) {
      setError(t('auth.unlockSheet.errorMissingUsername'));
      return;
    }
    setBusy(true);
    setError('');
    // Re-derive the deterministic wallet from (username, password).
    // PBKDF2 is heavy enough to surface as a frame stutter on older
    // devices; we run it on the next tick so the input loses focus
    // first and the activity-indicator paints.
    setTimeout((): void => {
      try {
        const keys = deriveDeterministicWallet(username, password);
        setMnemonic(keys.mnemonic);
        setAddress(keys.address, username);
        markUnlocked();
        setBusy(false);
        setPassword('');
        onUnlocked();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t('auth.unlockSheet.errorDeriveFailed');
        setError(message);
        setBusy(false);
      }
    }, 16);
  }, [busy, password, username, setMnemonic, setAddress, markUnlocked, onUnlocked, t]);

  const action = actionLabel ?? t(`auth.unlockSheet.actions.${actionKey}`, {
    defaultValue: t('auth.unlockSheet.actions.default', { defaultValue: 'continue' }),
  });

  const usernameMissing = username.length === 0;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.scrim}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss', { defaultValue: 'Dismiss' })}
      />
      <View
        style={styles.sheet}
        accessibilityRole="alert"
        accessibilityViewIsModal
        accessibilityLabel={t('auth.unlockSheet.title')}
      >
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {t('auth.unlockSheet.title')}
        </Text>
        <Text style={styles.body}>
          {t('auth.unlockSheet.body', { action })}
        </Text>

        {usernameMissing ? (
          <Text style={styles.error} accessibilityRole="alert">
            {t('auth.unlockSheet.errorMissingUsername')}
          </Text>
        ) : (
          <>
            <Text style={styles.label}>
              {t('auth.unlockSheet.passwordLabel')}
            </Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.unlockSheet.passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              editable={!busy}
              onSubmitEditing={submit}
              accessibilityLabel={t('auth.unlockSheet.passwordLabel')}
            />
            {error.length > 0 ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={[styles.button, styles.cancelButton, busy ? styles.disabled : null]}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={busy || usernameMissing || password.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('auth.unlockSheet.unlock')}
            style={[
              styles.button,
              styles.unlockButton,
              busy || usernameMissing || password.length === 0 ? styles.disabled : null,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.buttonText, styles.unlockText]}>
                {t('auth.unlockSheet.unlock')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSoft,
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  unlockButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  unlockText: {
    color: colors.background,
  },
  disabled: {
    opacity: 0.5,
  },
});
