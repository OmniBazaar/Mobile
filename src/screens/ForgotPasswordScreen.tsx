/**
 * ForgotPasswordScreen — explains the deterministic-credentials
 * recovery model.
 *
 * Because the wallet is deterministically derived from username +
 * password, "forgot password" can't be a self-service reset (we
 * don't store a hash to compare against). The honest answer is:
 *
 *   1. If you remember your username, type it on the login screen
 *      with any guess at the password — you'll either succeed
 *      (good) or get a permanent denial (try a different password).
 *   2. We have no way to reset the password to anything new without
 *      the user remembering it. The validator stores ONLY the
 *      address, not anything reversible.
 *   3. Last-resort: the user can use the email-OTP flow to verify
 *      identity, then create a NEW wallet under new credentials and
 *      ask support to flag the old wallet as compromised. (This is
 *      a future flow — described here so users know what to do.)
 *
 * @module screens/ForgotPasswordScreen
 */

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';

/** Props for {@link ForgotPasswordScreen}. */
export interface ForgotPasswordScreenProps {
  /** Back to login. */
  onBack: () => void;
  /** Open the contact-support / email path. */
  onContactSupport: () => void;
}

/**
 * Render the recovery-options page.
 *
 * @param props - See {@link ForgotPasswordScreenProps}.
 * @returns JSX.
 */
export default function ForgotPasswordScreen(
  props: ForgotPasswordScreenProps,
): JSX.Element {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('forgotPassword.title', { defaultValue: 'Forgot Password' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('forgotPassword.heading', {
            defaultValue: 'Recovering your wallet',
          })}
        </Text>
        <Text style={styles.body}>
          {t('forgotPassword.body1', {
            defaultValue:
              'Your wallet is derived deterministically from your username + password. Because nobody — including us — stores those credentials, we cannot reset them on your behalf.',
          })}
        </Text>

        <Card style={styles.note}>
          <Text style={styles.noteHeading}>
            {t('forgotPassword.option1', {
              defaultValue: 'Option 1 — try possible passwords',
            })}
          </Text>
          <Text style={styles.body}>
            {t('forgotPassword.option1Body', {
              defaultValue:
                'Go back to the login screen and try the passwords you might have used. Each attempt that fails just gets a "wrong password" — there is no lockout, no rate limit on the device side. The validator detects mismatched signatures and rejects the login challenge cleanly.',
            })}
          </Text>
        </Card>

        <Card style={styles.note}>
          <Text style={styles.noteHeading}>
            {t('forgotPassword.option2', {
              defaultValue: 'Option 2 — start a new wallet',
            })}
          </Text>
          <Text style={styles.body}>
            {t('forgotPassword.option2Body', {
              defaultValue:
                'If you cannot remember your password, you can register a NEW wallet under a new username and password. Anything in the old wallet stays unreachable — including any pending balances or NFTs — but you regain control of an account moving forward.',
            })}
          </Text>
        </Card>

        <Card style={styles.note}>
          <Text style={styles.noteHeading}>
            {t('forgotPassword.option3', {
              defaultValue: 'Option 3 — contact support (legacy users)',
            })}
          </Text>
          <Text style={styles.body}>
            {t('forgotPassword.option3Body', {
              defaultValue:
                'Pre-launch (V1) users have a separate claim path on `LegacyBalanceClaim.sol`. If you used OmniBazaar before April 2026 and your username has a balance there, contact support with your email of record and we can help you claim it into a new wallet.',
            })}
          </Text>
        </Card>

        <Button
          title={t('forgotPassword.cta.docs', {
            defaultValue: 'Read more in docs',
          })}
          variant="secondary"
          onPress={() => void Linking.openURL('https://omnibazaar.com/help/account-recovery')}
          style={styles.cta}
        />
        <Button
          title={t('forgotPassword.cta.support', {
            defaultValue: 'Contact Support',
          })}
          variant="secondary"
          onPress={props.onContactSupport}
          style={styles.cta}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  note: { marginVertical: 8 },
  noteHeading: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cta: { marginTop: 8 },
});
