/**
 * ProfileScreen — hub for Staking / KYC / Settings / About.
 *
 * Phase 5 navigation hub that the Mobile app exposes as the 5th bottom-
 * tab equivalent once the tab bar lands. For now it's reachable from
 * a "Profile" tile on WalletHomeScreen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Card from '@components/Card';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';

/** Destination key a ProfileScreen tile can emit. */
export type ProfileDestination = 'settings' | 'staking' | 'kyc' | 'about' | 'tx-history';

/** Props accepted by ProfileScreen. */
export interface ProfileScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Called when the user taps a hub tile. */
  onNavigate: (destination: ProfileDestination) => void;
}

/**
 * Render the profile hub.
 * @param props - See {@link ProfileScreenProps}.
 * @returns JSX.
 */
export default function ProfileScreen(props: ProfileScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const username = useAuthStore((s) => s.username);

  const rows: Array<{ key: ProfileDestination; label: string; hint: string }> = [
    {
      key: 'tx-history',
      label: t('profile.txHistory', { defaultValue: 'Activity' }),
      hint: t('profile.txHistoryHint', { defaultValue: 'Transactions, shielded + public' }),
    },
    {
      key: 'staking',
      label: t('profile.staking', { defaultValue: 'Staking' }),
      hint: t('profile.stakingHint', { defaultValue: 'Earn 5–12% APR on XOM' }),
    },
    {
      key: 'kyc',
      label: t('profile.kyc', { defaultValue: 'Identity Verification' }),
      hint: t('profile.kycHint', { defaultValue: 'Unlock higher limits and more marketplaces' }),
    },
    {
      key: 'settings',
      label: t('profile.settings', { defaultValue: 'Settings' }),
      hint: t('profile.settingsHint', { defaultValue: 'Language, auto-lock, biometrics' }),
    },
    {
      key: 'about',
      label: t('profile.about', { defaultValue: 'About' }),
      hint: t('profile.aboutHint', { defaultValue: 'Version, legal, documentation' }),
    },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('profile.title', { defaultValue: 'Profile' })}
        </Text>
      </View>

      <Card style={styles.identityCard}>
        <Text style={styles.username}>
          {username !== '' ? `@${username}` : t('profile.anonymous', { defaultValue: 'Anonymous wallet' })}
        </Text>
        <Text style={styles.address}>{short(address)}</Text>
      </Card>

      {rows.map((row, i) => (
        <Pressable
          key={row.key}
          onPress={() => props.onNavigate(row.key)}
          style={[styles.hubRow, i < rows.length - 1 && styles.hubRowDivider]}
          accessibilityRole="button"
          accessibilityLabel={row.label}
        >
          <View style={styles.hubLabelBox}>
            <Text style={styles.hubLabel}>{row.label}</Text>
            <Text style={styles.hubHint}>{row.hint}</Text>
          </View>
          <Text style={styles.hubArrow}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Short-form address for inline display. */
function short(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  identityCard: { marginHorizontal: 16, marginBottom: 16, alignItems: 'center' },
  username: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  address: { color: colors.primary, fontSize: 13, marginTop: 4 },
  hubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
  },
  hubRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  hubLabelBox: { flex: 1 },
  hubLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  hubHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hubArrow: { color: colors.textMuted, fontSize: 18 },
});
