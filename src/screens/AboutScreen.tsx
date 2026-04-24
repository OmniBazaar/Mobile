/**
 * AboutScreen — app version + legal + social links.
 *
 * Reads app metadata from the platform RuntimeAdapter so the display
 * stays accurate across Expo OTA bumps. External links open through
 * the TabsAdapter (expo-web-browser) so the app never inserts itself
 * between the user and the target site.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Card from '@components/Card';
import { colors } from '@theme/colors';
import { getRuntimeAdapter, getTabsAdapter } from '@wallet/platform/registry';

/** External URL. */
interface LinkRow {
  labelKey: string;
  labelFallback: string;
  url: string;
}

const LINKS: LinkRow[] = [
  {
    labelKey: 'about.link.terms',
    labelFallback: 'Terms of Service',
    url: 'https://omnibazaar.com/legal/terms',
  },
  {
    labelKey: 'about.link.privacy',
    labelFallback: 'Privacy Policy',
    url: 'https://omnibazaar.com/legal/privacy',
  },
  {
    labelKey: 'about.link.docs',
    labelFallback: 'Documentation',
    url: 'https://omnibazaar.com/docs',
  },
  {
    labelKey: 'about.link.support',
    labelFallback: 'Support',
    url: 'https://omnibazaar.com/support',
  },
  {
    labelKey: 'about.link.github',
    labelFallback: 'GitHub',
    url: 'https://github.com/OmniBazaar',
  },
];

/** Props accepted by AboutScreen. */
export interface AboutScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the About screen.
 * @param props - See {@link AboutScreenProps}.
 * @returns JSX.
 */
export default function AboutScreen(props: AboutScreenProps): JSX.Element {
  const { t } = useTranslation();

  // Safe read; RuntimeAdapter always surfaces at least a minimal shim.
  let manifest = { name: 'OmniBazaar Mobile', version: '0.0.0' };
  try {
    manifest = getRuntimeAdapter().getManifest() as typeof manifest;
  } catch {
    /* not registered in a test context — keep defaults */
  }

  const openUrl = async (url: string): Promise<void> => {
    try {
      await getTabsAdapter().openUrl(url);
    } catch (err) {
      console.warn('[about] failed to open', url, err);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('about.title', { defaultValue: 'About' })}
        </Text>
      </View>

      <Card style={styles.heroCard}>
        <Text style={styles.heroName}>{manifest.name}</Text>
        <Text style={styles.heroVersion}>
          {t('about.version', { defaultValue: 'Version {{v}}', v: manifest.version })}
        </Text>
        <Text style={styles.heroTag}>
          {t('about.tagline', {
            defaultValue: 'Decentralized marketplace, wallet, and DEX.',
          })}
        </Text>
      </Card>

      <Card style={styles.linksCard}>
        {LINKS.map((link, i) => (
          <Pressable
            key={link.url}
            onPress={() => void openUrl(link.url)}
            style={[styles.linkRow, i < LINKS.length - 1 && styles.linkRowDivider]}
            accessibilityRole="link"
          >
            <Text style={styles.linkLabel}>
              {t(link.labelKey, { defaultValue: link.labelFallback })}
            </Text>
            <Text style={styles.linkArrow}>›</Text>
          </Pressable>
        ))}
      </Card>

      <Text style={styles.footer}>
        {t('about.copyright', {
          defaultValue: '© {{year}} OmniBazaar. Your keys, your wallet.',
          year: new Date().getFullYear(),
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  heroCard: { marginHorizontal: 16, marginBottom: 12, alignItems: 'center' },
  heroName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  heroVersion: { color: colors.primary, fontSize: 14, marginTop: 4 },
  heroTag: { color: colors.textSecondary, fontSize: 13, marginTop: 12, textAlign: 'center' },
  linksCard: { marginHorizontal: 16, marginBottom: 12, paddingVertical: 4 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  linkRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  linkLabel: { color: colors.textPrimary, fontSize: 15 },
  linkArrow: { color: colors.textMuted, fontSize: 18 },
  footer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16 },
});
