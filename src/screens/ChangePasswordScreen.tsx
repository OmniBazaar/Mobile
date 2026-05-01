/**
 * ChangePasswordScreen — explains the deterministic-credentials
 * constraint to users who expect "change password" to work like a
 * traditional account.
 *
 * The OmniBazaar wallet is derived from `(username, password)` via
 * PBKDF2 — there is no separate "credential record" to update. To
 * "change" a password the user must derive a NEW wallet under new
 * credentials and migrate their funds + identity. We surface that
 * flow honestly here rather than pretending change-password is a
 * one-tap operation.
 *
 * @module screens/ChangePasswordScreen
 */

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';

/** Props for {@link ChangePasswordScreen}. */
export interface ChangePasswordScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Sign out so the user can create a new wallet under new credentials. */
  onSignOutAndStartOver: () => void;
}

/**
 * Render the explanatory screen.
 *
 * @param props - See {@link ChangePasswordScreenProps}.
 * @returns JSX.
 */
export default function ChangePasswordScreen(
  props: ChangePasswordScreenProps,
): JSX.Element {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('changePassword.title', { defaultValue: 'Change Password' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('changePassword.heading', {
            defaultValue: 'Your password IS your wallet',
          })}
        </Text>
        <Text style={styles.body}>
          {t('changePassword.body1', {
            defaultValue:
              'OmniBazaar wallets are generated deterministically from your username and password using PBKDF2-SHA512. The same credentials always produce the same private keys — that is what lets you log in from any device with no separate seed phrase.',
          })}
        </Text>
        <Text style={styles.body}>
          {t('changePassword.body2', {
            defaultValue:
              'There is no separate "password record" we can rotate. Changing your password means deriving a new wallet under new credentials and moving your assets to it.',
          })}
        </Text>

        <Card style={styles.note}>
          <Text style={styles.noteHeading}>
            {t('changePassword.howTo', { defaultValue: 'How to change credentials' })}
          </Text>
          <Text style={styles.body}>
            {t('changePassword.step1', {
              defaultValue: '1. Send all assets you want to keep to a centralised exchange or to a friend\u2019s address as a temporary parking spot.',
            })}
          </Text>
          <Text style={styles.body}>
            {t('changePassword.step2', {
              defaultValue: '2. Sign out of this wallet and create a new account with your new username + password.',
            })}
          </Text>
          <Text style={styles.body}>
            {t('changePassword.step3', {
              defaultValue: '3. Transfer the assets back from the parking spot into the new wallet.',
            })}
          </Text>
        </Card>

        <Text style={styles.warning}>
          {t('changePassword.warning', {
            defaultValue:
              'WARNING: Until you move funds out, anyone with your old password retains access to the old wallet. Treat your password like the master key it is.',
          })}
        </Text>

        <Button
          title={t('changePassword.cta.signOut', {
            defaultValue: 'Sign Out and Start Over',
          })}
          variant="secondary"
          onPress={props.onSignOutAndStartOver}
          style={styles.cta}
        />
        <Button
          title={t('changePassword.cta.docs', {
            defaultValue: 'Read More in Docs',
          })}
          variant="secondary"
          onPress={() => void Linking.openURL('https://omnibazaar.com/help/wallet-passwords')}
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
  note: { marginVertical: 16 },
  noteHeading: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  warning: {
    color: colors.warning,
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 16,
    fontWeight: '600',
  },
  cta: { marginTop: 8 },
});
