/**
 * MarketplaceHomeScreen — shell for the 5 marketplaces.
 *
 * Phase 4 MVP: 5 horizontal sub-tabs (P2P / NFT / RWA / Yield /
 * Predictions). P2P ships with a working browse flow in this commit;
 * the other 4 render a "Coming soon" placeholder that wires up in
 * Phase 4 Week 2 once their services land on the mobile path.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@theme/colors';
import P2PBrowseScreen from './P2PBrowseScreen';

/** Marketplace identifier. */
export type MarketplaceKind = 'p2p' | 'nft' | 'rwa' | 'yield' | 'predictions';

/** Props accepted by MarketplaceHomeScreen. */
export interface MarketplaceHomeScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the 5-tab marketplace shell.
 * @param props - See {@link MarketplaceHomeScreenProps}.
 * @returns JSX.
 */
export default function MarketplaceHomeScreen(props: MarketplaceHomeScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MarketplaceKind>('p2p');

  const tabs: Array<{ kind: MarketplaceKind; label: string }> = [
    { kind: 'p2p', label: t('marketplace.tab.p2p', { defaultValue: 'P2P' }) },
    { kind: 'nft', label: t('marketplace.tab.nft', { defaultValue: 'NFT' }) },
    { kind: 'rwa', label: t('marketplace.tab.rwa', { defaultValue: 'RWA' }) },
    { kind: 'yield', label: t('marketplace.tab.yield', { defaultValue: 'Yield' }) },
    { kind: 'predictions', label: t('marketplace.tab.predictions', { defaultValue: 'Predictions' }) },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('marketplace.title', { defaultValue: 'Marketplaces' })}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.kind}
            onPress={() => setKind(tab.kind)}
            style={[styles.tab, kind === tab.kind && styles.tabActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === tab.kind }}
          >
            <Text style={[styles.tabText, kind === tab.kind && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.body}>
        {kind === 'p2p' ? (
          <P2PBrowseScreen />
        ) : (
          <ComingSoon kind={kind} />
        )}
      </View>
    </View>
  );
}

/** Placeholder for the marketplaces not yet wired. */
function ComingSoon({ kind }: { kind: MarketplaceKind }): JSX.Element {
  const { t } = useTranslation();
  const messages: Record<MarketplaceKind, { title: string; body: string }> = {
    p2p: { title: '', body: '' },
    nft: {
      title: t('marketplace.nft.title', { defaultValue: 'NFT Marketplace' }),
      body: t('marketplace.nft.coming', {
        defaultValue: 'Collections, floor prices, buy flow — coming soon.',
      }),
    },
    rwa: {
      title: t('marketplace.rwa.title', { defaultValue: 'Real-World Assets' }),
      body: t('marketplace.rwa.coming', {
        defaultValue: 'Tokenized stocks, bonds, and treasuries — coming soon.',
      }),
    },
    yield: {
      title: t('marketplace.yield.title', { defaultValue: 'Yield Catalog' }),
      body: t('marketplace.yield.coming', {
        defaultValue: 'Browse yield positions across L1 and beyond — coming soon.',
      }),
    },
    predictions: {
      title: t('marketplace.predictions.title', { defaultValue: 'Prediction Markets' }),
      body: t('marketplace.predictions.coming', {
        defaultValue: 'Polymarket CTF markets — coming soon.',
      }),
    },
  };
  const { title, body } = messages[kind];
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingTitle}>{title}</Text>
      <Text style={styles.comingBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  tabRow: { paddingHorizontal: 16, flexGrow: 0, marginBottom: 12, maxHeight: 56 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignSelf: 'flex-start',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: colors.background, fontWeight: '700' },
  body: { flex: 1 },
  comingSoon: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  comingTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  comingBody: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
