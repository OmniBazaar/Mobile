/**
 * OwnedNFTsScreen — grid of NFTs the user currently owns.
 *
 * Sourced from `InventoryService.listOwnedNFTs` which queries the
 * validator's aggregated per-chain ownership index
 * (`/api/v1/nft/owned/:address`). Empty state surfaces honestly when
 * indexing is incomplete — we do not fall back to on-chain Transfer-log
 * scans from the phone.
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

import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { listOwnedNFTs, type OwnedNFT } from '../services/InventoryService';

const { width } = Dimensions.get('window');
const GAP = 8;
const CARD = (width - 32 - GAP) / 2;

/** Props. */
export interface OwnedNFTsScreenProps {
  /** Back-nav. */
  onBack: () => void;
}

/**
 * Render the owned-NFT grid.
 * @param props - See {@link OwnedNFTsScreenProps}.
 * @returns JSX.
 */
export default function OwnedNFTsScreen(props: OwnedNFTsScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const [items, setItems] = useState<OwnedNFT[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (address === '') return;
    setLoading(true);
    try {
      setItems(await listOwnedNFTs(address));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('nft.owned.title', { defaultValue: 'Your NFTs' })}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(row) => `${row.chainId}:${row.contractAddress}:${row.tokenId}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <OwnedCard nft={item} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>
              {t('nft.owned.loading', { defaultValue: 'Loading your NFTs…' })}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {t('nft.owned.empty', {
                defaultValue:
                  'No NFTs indexed for this address yet. New mints show up after the validator indexes them.',
              })}
            </Text>
          )
        }
      />
    </View>
  );
}

/** Single card in the grid. */
function OwnedCard({ nft }: { nft: OwnedNFT }): JSX.Element {
  return (
    <View style={styles.card}>
      {nft.imageUrl !== undefined ? (
        <Image source={{ uri: nft.imageUrl }} style={styles.cardImage} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.cardImagePlaceholderText}>NFT</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.cardTitle}>
        {nft.collectionName ?? `#${nft.tokenId}`}
      </Text>
      <Text style={styles.cardMeta}>#{nft.tokenId}</Text>
      {nft.activeListingId !== undefined && (
        <Text style={styles.listedChip}>Listed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: GAP, paddingHorizontal: 16 },
  listContent: { paddingBottom: 32 },
  card: { width: CARD, backgroundColor: colors.surface, borderRadius: 12, padding: 8 },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardImagePlaceholderText: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  listedChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48, paddingHorizontal: 24 },
});
