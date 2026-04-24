/**
 * NFTBrowseScreen — NFT collections catalog.
 *
 * Uses MarketplaceClient.listNFTCollections to pull the validator's
 * indexed NFT catalog for the chosen chain. Phase 4 Week 2 MVP covers
 * browse. Collection detail + buy via MinimalEscrow settlement land
 * with the NFT purchase flow in a follow-up commit.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getMarketplaceClient,
  type NFTCollectionSummary,
} from '@wallet/services/marketplace/MarketplaceClient';
import { colors } from '@theme/colors';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 8;
const CARD_WIDTH = (width - 32 - COLUMN_GAP) / 2;

/** Chains the user can pick from — NFT indexing is live on L1 + 4 EVM chains. */
const CHAINS: Array<{ chainId: number; label: string }> = [
  { chainId: 88008, label: 'OmniCoin' },
  { chainId: 1, label: 'Ethereum' },
  { chainId: 137, label: 'Polygon' },
  { chainId: 8453, label: 'Base' },
  { chainId: 42161, label: 'Arbitrum' },
];

/** Props. */
export interface NFTBrowseScreenProps {
  /** Called when the user taps a collection card. Undefined disables tap. */
  onSelectCollection?: (collection: NFTCollectionSummary) => void;
}

/**
 * Render the NFT-collections browse grid.
 * @param props - See {@link NFTBrowseScreenProps}.
 * @returns JSX.
 */
export default function NFTBrowseScreen(props: NFTBrowseScreenProps = {}): JSX.Element {
  const { t } = useTranslation();
  const { onSelectCollection } = props;
  const [chainId, setChainId] = useState(CHAINS[0]!.chainId);
  const [collections, setCollections] = useState<NFTCollectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (cid: number): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const rows = await getMarketplaceClient().listNFTCollections(cid, 1, 20);
      setCollections(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(chainId);
  }, [chainId, load]);

  return (
    <View style={styles.root}>
      <View style={styles.chainRow}>
        {CHAINS.map((c) => (
          <Pressable
            key={c.chainId}
            onPress={() => setChainId(c.chainId)}
            style={[styles.chainChip, c.chainId === chainId && styles.chainChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: c.chainId === chainId }}
          >
            <Text style={[styles.chainChipText, c.chainId === chainId && styles.chainChipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <FlatList
        data={collections}
        keyExtractor={(item) => `${item.chainId}:${item.contractAddress}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CollectionCard
            collection={item}
            onPress={onSelectCollection !== undefined ? () => onSelectCollection(item) : undefined}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load(chainId)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>
              {t('nft.loading', { defaultValue: 'Loading collections…' })}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {t('nft.empty', { defaultValue: 'No collections indexed for this chain yet.' })}
            </Text>
          )
        }
      />
    </View>
  );
}

/** Single collection card. */
function CollectionCard({
  collection,
  onPress,
}: {
  collection: NFTCollectionSummary;
  onPress?: () => void;
}): JSX.Element {
  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={collection.name}
      onPress={onPress}
    >
      {collection.imageUrl !== undefined ? (
        <Image source={{ uri: collection.imageUrl }} style={styles.cardImage} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.cardImagePlaceholderText}>NFT</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.cardTitle}>
        {collection.name}
      </Text>
      {collection.floorPrice !== undefined && (
        <Text style={styles.cardFloor}>
          Floor {collection.floorPrice} {collection.floorCurrency ?? ''}
        </Text>
      )}
      {collection.volume24h !== undefined && (
        <Text style={styles.cardVolume}>Vol 24h: {collection.volume24h}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  chainRow: { flexDirection: 'row', marginBottom: 12, flexWrap: 'wrap' },
  chainChip: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chainChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chainChipText: { color: colors.textSecondary, fontSize: 12 },
  chainChipTextActive: { color: colors.background, fontWeight: '700' },
  columnWrapper: { justifyContent: 'space-between', marginBottom: COLUMN_GAP },
  listContent: { paddingBottom: 32 },
  card: { width: CARD_WIDTH, backgroundColor: colors.surface, borderRadius: 12, padding: 8 },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardImagePlaceholderText: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardFloor: { color: colors.primary, fontSize: 12, marginTop: 4 },
  cardVolume: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48 },
});
