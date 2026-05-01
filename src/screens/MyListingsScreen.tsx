/**
 * MyListingsScreen — listings created by the signed-in seller.
 *
 * Calls `MarketplaceClient.listListings({ seller })` to fetch the
 * caller's own listings, regardless of status. Renders a 1-column
 * `FlashList`; tap a row to push the existing P2PListingDetailScreen
 * (the buyer-facing detail view doubles as a "preview as buyer" for
 * sellers — Sprint 3 can add seller-only "Edit / Hide / Delete"
 * actions on top).
 *
 * @module screens/MyListingsScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import {
  getMarketplaceClient,
  type MarketplaceListing,
} from '@wallet/services/marketplace/MarketplaceClient';

import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

/** Props accepted by MyListingsScreen. */
export interface MyListingsScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Tap handler — opens the chosen listing's detail. */
  onSelect: (listing: MarketplaceListing) => void;
  /** Tap handler — opens the create-listing flow (FAB). */
  onCreate: () => void;
}

/**
 * Render the seller's own listings.
 *
 * @param props - See {@link MyListingsScreenProps}.
 * @returns JSX.
 */
export default function MyListingsScreen(
  props: MyListingsScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const sellerAddress = useAuthStore((s) => s.address);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    if (sellerAddress === '') {
      setListings([]);
      return;
    }
    try {
      const page = await getMarketplaceClient().listListings({ seller: sellerAddress });
      setListings(page.listings);
      setError(undefined);
    } catch (err) {
      logger.warn('[my-listings] listListings failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('myListings.errors.loadFailed', {
          defaultValue: 'Could not load your listings. Pull to refresh.',
        }),
      );
    }
  }, [sellerAddress, t]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  if (loading && listings.length === 0) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title={t('myListings.title', { defaultValue: 'My Listings' })}
          onBack={props.onBack}
        />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (listings.length === 0) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title={t('myListings.title', { defaultValue: 'My Listings' })}
          onBack={props.onBack}
        />
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {t('myListings.empty.title', { defaultValue: 'No listings yet' })}
          </Text>
          <Text style={styles.emptyBody}>
            {t('myListings.empty.body', {
              defaultValue:
                'Create your first listing to start selling. Goods, services, jobs — all welcome.',
            })}
          </Text>
          {error !== undefined && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={props.onCreate}
            accessibilityRole="button"
            accessibilityLabel={t('myListings.create', { defaultValue: 'Create a new listing' })}
            style={styles.createCta}
          >
            <Text style={styles.createCtaText}>
              {t('myListings.create', { defaultValue: 'Create a Listing' })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('myListings.title', { defaultValue: 'My Listings' })}
        onBack={props.onBack}
      />
      <FlashList
        data={listings}
        estimatedItemSize={92}
        keyExtractor={(l): string => l.id}
        renderItem={({ item }): React.ReactElement => (
          <ListingRow listing={item} onPress={(): void => props.onSelect(item)} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.list}
      />
      <Pressable
        onPress={props.onCreate}
        accessibilityRole="button"
        accessibilityLabel={t('myListings.create', { defaultValue: 'Create a new listing' })}
        style={styles.fab}
        hitSlop={6}
      >
        <Ionicons name="add" size={28} color={colors.background} />
      </Pressable>
    </View>
  );
}

/** Single listing row. */
function ListingRow({
  listing,
  onPress,
}: {
  listing: MarketplaceListing;
  onPress: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const cover = listing.images[0];
  const statusColor =
    listing.status === 'active'
      ? colors.success
      : listing.status === 'sold'
        ? colors.primary
        : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('myListings.row.a11y', {
        defaultValue: '{{title}} — {{status}}',
        title: listing.title,
        status: listing.status,
      })}
      style={styles.row}
    >
      {cover !== undefined ? (
        <Image source={{ uri: cover }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="image-outline" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.rowMid}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.rowPrice}>
          {listing.price} {listing.currency}
        </Text>
        <View style={styles.rowMeta}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.rowStatus}>{listing.status}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyBody: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  createCta: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  createCtaText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  thumbPlaceholder: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1 },
  rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowPrice: { color: colors.primary, fontSize: 14, marginTop: 4, fontWeight: '600' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  rowStatus: { color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
});
