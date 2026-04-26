/**
 * P2PBrowseScreen — P2P marketplace listing browser.
 *
 * Fetches listings via @wallet/services/marketplace/MarketplaceClient and
 * renders a 2-column grid (FlashList when the dep is available; falls
 * back to FlatList here to keep Phase 4 MVP deps minimal).
 *
 * Phase 4 MVP: browse + search. Detail / create / escrow / my-listings
 * land in Phase 4 Week 2.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';

import {
  getMarketplaceClient,
  type MarketplaceListing,
} from '@wallet/services/marketplace/MarketplaceClient';
import { colors } from '@theme/colors';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 8;
const CARD_WIDTH = (width - 32 - COLUMN_GAP) / 2;

/** Props. */
export interface P2PBrowseScreenProps {
  /** Called when the user taps a listing card. */
  onSelectListing?: (listing: MarketplaceListing) => void;
}

/**
 * Render the P2P browse grid.
 * @param props - See {@link P2PBrowseScreenProps}.
 * @returns JSX.
 */
export default function P2PBrowseScreen(props: P2PBrowseScreenProps = {}): JSX.Element {
  const { t } = useTranslation();
  const { onSelectListing } = props;
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');

  const load = useCallback(async (q: string): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const client = getMarketplaceClient();
      const page = await client.listListings({
        page: 1,
        pageSize: 20,
        sort: 'newest',
        ...(q.trim() !== '' && { q: q.trim() }),
      });
      setListings(page.listings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void load(query)}
          placeholder={t('p2p.search', { defaultValue: 'Search listings…' })}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={t('p2p.search', { defaultValue: 'Search listings' })}
        />
      </View>

      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <FlashList
        data={listings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        estimatedItemSize={CARD_WIDTH + 80}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.cellWrap}>
            <ListingCard
              listing={item}
              onPress={onSelectListing !== undefined ? () => onSelectListing(item) : undefined}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.loading}>
              {t('p2p.loading', { defaultValue: 'Loading listings…' })}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {t('p2p.empty', { defaultValue: 'No listings found.' })}
            </Text>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load(query)}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

/** Individual listing card rendered in the 2-column grid. */
function ListingCard({
  listing,
  onPress,
}: {
  listing: MarketplaceListing;
  onPress?: () => void;
}): JSX.Element {
  const imageUrl = listing.images.length > 0 ? listing.images[0] : undefined;
  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={listing.title}
      onPress={onPress}
    >
      {imageUrl !== undefined ? (
        <Image source={{ uri: imageUrl }} style={styles.cardImage} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.cardImagePlaceholderText}>{listing.category}</Text>
        </View>
      )}
      <Text numberOfLines={2} style={styles.cardTitle}>
        {listing.title}
      </Text>
      <Text style={styles.cardPrice}>
        {listing.price} {listing.currency}
      </Text>
      {listing.sellerRating !== undefined && (
        <Text style={styles.cardRating}>★ {listing.sellerRating.toFixed(1)}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  searchRow: { marginBottom: 12 },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  cellWrap: { paddingRight: COLUMN_GAP, paddingBottom: COLUMN_GAP },
  listContent: { paddingBottom: 32 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardImagePlaceholderText: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardPrice: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: 4 },
  cardRating: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  loading: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48 },
});
