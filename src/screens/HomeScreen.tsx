/**
 * HomeScreen — minimal post-sign-in landing.
 *
 * Phase 1 placeholder. Phase 2 replaces this with the real wallet tab
 * (portfolio total + token list + send/receive/swap quick actions).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';

/**
 * Render the post-authentication home placeholder.
 * @returns JSX.
 */
export default function HomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const username = useAuthStore((s) => s.username);
  const clear = useAuthStore((s) => s.clear);

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('home.greeting', {
          defaultValue: 'Welcome{{who}}',
          who: username !== '' ? `, ${username}` : '',
        })}
      </Text>
      <Text style={styles.address}>
        {address !== '' ? truncate(address) : ''}
      </Text>
      <Text style={styles.body}>
        {t('home.placeholder', {
          defaultValue:
            'Phase 2 lands the real wallet home: portfolio, token list, and send/receive quick actions.',
        })}
      </Text>
      <View style={styles.actions}>
        <Button
          title={t('home.signOut', { defaultValue: 'Sign Out' })}
          onPress={clear}
          variant="secondary"
        />
      </View>
    </View>
  );
}

/**
 * Truncate an EVM address for inline display (`0x1234…abcd`).
 *
 * @param address - Full address.
 * @returns Short form.
 */
function truncate(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 96,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  address: { color: colors.primary, fontSize: 16, marginBottom: 24 },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: { marginTop: 'auto', marginBottom: 32, width: '100%' },
});
