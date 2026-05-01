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

import type {
  MarketplaceListing,
  NFTCollectionSummary,
} from '@wallet/services/marketplace/MarketplaceClient';

import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import P2PBrowseScreen from './P2PBrowseScreen';
import P2PListingDetailScreen from './P2PListingDetailScreen';
import NFTBrowseScreen from './NFTBrowseScreen';
import NFTDetailScreen from './NFTDetailScreen';
import PredictionsBrowseScreen from './PredictionsBrowseScreen';
import PredictionsMarketDetailScreen from './PredictionsMarketDetailScreen';
import type { PredictionMarket } from '@wallet/services/predictions/PredictionsClient';

/** Marketplace identifier. */
export type MarketplaceKind = 'p2p' | 'nft' | 'rwa' | 'yield' | 'predictions';

/** Props accepted by MarketplaceHomeScreen. */
export interface MarketplaceHomeScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Called when the user wants to open the DEX swap for RWA/Yield trading. */
  onOpenSwap: () => void;
  /**
   * BIP39 phrase held in memory for the session; required for NFT + prediction
   * buy flows that sign EIP-712 intents client-side. Empty string blocks buy.
   */
  mnemonic: string;
}

/**
 * Render the 5-tab marketplace shell.
 * @param props - See {@link MarketplaceHomeScreenProps}.
 * @returns JSX.
 */
export default function MarketplaceHomeScreen(props: MarketplaceHomeScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MarketplaceKind>('p2p');
  const [selectedNFTCollection, setSelectedNFTCollection] =
    useState<NFTCollectionSummary | undefined>(undefined);
  const [selectedPredictionMarket, setSelectedPredictionMarket] =
    useState<PredictionMarket | undefined>(undefined);
  const [selectedP2PListing, setSelectedP2PListing] =
    useState<MarketplaceListing | undefined>(undefined);
  const buyerAddress = useAuthStore((s) => s.address);

  if (selectedP2PListing !== undefined) {
    return (
      <P2PListingDetailScreen
        listing={selectedP2PListing}
        buyer={buyerAddress}
        mnemonic={props.mnemonic}
        onBack={() => setSelectedP2PListing(undefined)}
      />
    );
  }

  // NFT detail — routes to the dedicated buy screen; back clears.
  if (selectedNFTCollection !== undefined) {
    return (
      <NFTDetailScreen
        collection={selectedNFTCollection}
        buyer={buyerAddress}
        mnemonic={props.mnemonic}
        onBack={() => setSelectedNFTCollection(undefined)}
      />
    );
  }

  // Prediction detail — buy/claim screen; back clears.
  if (selectedPredictionMarket !== undefined) {
    return (
      <PredictionsMarketDetailScreen
        market={selectedPredictionMarket}
        buyer={buyerAddress}
        mnemonic={props.mnemonic}
        onBack={() => setSelectedPredictionMarket(undefined)}
      />
    );
  }

  const tabs: Array<{ kind: MarketplaceKind; label: string }> = [
    { kind: 'p2p', label: t('marketplace.tab.p2p', { defaultValue: 'P2P' }) },
    { kind: 'nft', label: t('marketplace.tab.nft', { defaultValue: 'NFT' }) },
    { kind: 'rwa', label: t('marketplace.tab.rwa', { defaultValue: 'RWA' }) },
    { kind: 'yield', label: t('marketplace.tab.yield', { defaultValue: 'Yield' }) },
    { kind: 'predictions', label: t('marketplace.tab.predictions', { defaultValue: 'Predictions' }) },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('marketplace.title', { defaultValue: 'Marketplaces' })}
        onBack={props.onBack}
      />

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
        {kind === 'p2p' && (
          <P2PBrowseScreen onSelectListing={setSelectedP2PListing} />
        )}
        {kind === 'nft' && (
          <NFTBrowseScreen onSelectCollection={setSelectedNFTCollection} />
        )}
        {kind === 'predictions' && (
          <PredictionsBrowseScreen onSelectMarket={setSelectedPredictionMarket} />
        )}
        {(kind === 'rwa' || kind === 'yield') && (
          <DeepLinkToDex kind={kind} onOpenSwap={props.onOpenSwap} />
        )}
      </View>
    </View>
  );
}

/**
 * RWA + Yield marketplaces deep-link users into the DEX swap because
 * that's where actual trading / deposit happens. Mobile shows a short
 * explainer + a "Trade on DEX" button.
 */
function DeepLinkToDex({
  kind,
  onOpenSwap,
}: {
  kind: 'rwa' | 'yield';
  onOpenSwap: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const copy: Record<'rwa' | 'yield', { title: string; body: string; cta: string }> = {
    rwa: {
      title: t('marketplace.rwa.title', { defaultValue: 'Real-World Assets' }),
      body: t('marketplace.rwa.deepLink', {
        defaultValue:
          'Tokenized stocks, bonds, and treasuries trade through the OmniBazaar DEX. Jurisdiction + KYC checks run at trade time.',
      }),
      cta: t('marketplace.rwa.cta', { defaultValue: 'Trade RWA on DEX' }),
    },
    yield: {
      title: t('marketplace.yield.title', { defaultValue: 'Yield Catalog' }),
      body: t('marketplace.yield.deepLink', {
        defaultValue:
          'Yield positions across OmniCoin L1 and connected chains. Deposit and withdraw through the DEX.',
      }),
      cta: t('marketplace.yield.cta', { defaultValue: 'Open DEX' }),
    },
  };
  const { title, body, cta } = copy[kind];
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingTitle}>{title}</Text>
      <Text style={styles.comingBody}>{body}</Text>
      <Pressable onPress={onOpenSwap} accessibilityRole="button" style={styles.dexButton}>
        <Text style={styles.dexButtonText}>{cta}</Text>
      </Pressable>
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
  dexButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dexButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
