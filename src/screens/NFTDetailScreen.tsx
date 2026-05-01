/**
 * NFTDetailScreen — Collection detail + floor-sweep buy flow.
 *
 * Shown when the user taps an NFT collection card from `NFTBrowseScreen`.
 * Fetches the cheapest currently-listed NFT via
 * `MarketplaceClient.getFloorListing`, and — when the user confirms — runs
 * `NFTBuyService.buyNFT` end-to-end (allowance check → approve → sign
 * BuyNFT intent → POST to validator). All on-chain activity is gasless on
 * OmniCoin L1 via OmniRelay.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getMarketplaceClient,
  type NFTCollectionSummary,
  type NFTFloorListing,
} from '@wallet/services/marketplace/MarketplaceClient';

import { Button } from '../components';
import { useRequireAuth } from '../components/RequireAuth';
import { colors } from '../theme/colors';
import { buyNFT, type BuyNFTResult } from '../services/NFTBuyService';

/** Props. */
export interface NFTDetailScreenProps {
  /** The collection the user tapped. */
  collection: NFTCollectionSummary;
  /** Authenticated buyer address (from authStore). */
  buyer: string;
  /** BIP39 mnemonic for signing approve + intent. */
  mnemonic: string;
  /** Back nav. */
  onBack: () => void;
}

/**
 * Render collection metadata + floor listing + "Buy" button.
 * @param props - See {@link NFTDetailScreenProps}.
 * @returns JSX.
 */
export default function NFTDetailScreen(props: NFTDetailScreenProps): JSX.Element {
  const { collection, buyer, mnemonic, onBack } = props;
  const { t } = useTranslation();
  const requireAuth = useRequireAuth();

  const [floor, setFloor] = useState<NFTFloorListing | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState<BuyNFTResult | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const row = await getMarketplaceClient().getFloorListing(
        collection.chainId,
        collection.contractAddress,
      );
      setFloor(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [collection.chainId, collection.contractAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConfirm = useCallback(async (): Promise<void> => {
    if (floor === undefined) return;
    setBuying(true);
    setResult(undefined);
    try {
      const res = await buyNFT({
        listingId: floor.listingId,
        nftTokenId: floor.tokenId,
        nftContract: floor.contractAddress,
        seller: floor.sellerAddress,
        buyer,
        paymentAmount: floor.priceWei,
        mnemonic,
      });
      setResult(res);
    } finally {
      setBuying(false);
    }
  }, [floor, buyer, mnemonic]);

  const rawConfirmBuy = useCallback((): void => {
    if (floor === undefined) return;
    Alert.alert(
      t('nft.buyConfirmTitle', { defaultValue: 'Confirm NFT purchase' }),
      t('nft.buyConfirmBody', {
        defaultValue: `Pay ${floor.priceDisplay} ${floor.currency} for token #${floor.tokenId}?`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: () => {
            void onConfirm();
          },
        },
      ],
    );
  }, [floor, onConfirm, t]);

  const confirmBuy = useCallback((): void => {
    requireAuth(
      t('authPrompt.toBuyNft', {
        defaultValue: 'Sign in to buy this NFT.',
      }),
      rawConfirmBuy,
    );
  }, [requireAuth, rawConfirmBuy, t]);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
      </Pressable>

      <View style={styles.header}>
        {collection.imageUrl !== undefined ? (
          <Image
            source={{ uri: collection.imageUrl }}
            style={styles.cover}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>NFT</Text>
          </View>
        )}
        <Text style={styles.title}>{collection.name}</Text>
        <Text style={styles.contractLine} numberOfLines={1}>
          {collection.contractAddress}
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {floor !== undefined ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('nft.floorListing', { defaultValue: 'Floor listing' })}
          </Text>
          <Row label={t('nft.tokenId', { defaultValue: 'Token id' })} value={`#${floor.tokenId}`} />
          <Row
            label={t('nft.seller', { defaultValue: 'Seller' })}
            value={shortAddress(floor.sellerAddress)}
          />
          <Row
            label={t('nft.price', { defaultValue: 'Price' })}
            value={`${floor.priceDisplay} ${floor.currency}`}
            highlight
          />
          <Text style={styles.note}>
            {t('nft.gaslessL1', {
              defaultValue: 'Approval + settlement on OmniCoin L1 are gasless via OmniRelay.',
            })}
          </Text>
          <View style={styles.buyRow}>
            <Button
              title={
                buying
                  ? t('nft.buying', { defaultValue: 'Purchasing…' })
                  : t('nft.buy', { defaultValue: 'Buy now' })
              }
              onPress={confirmBuy}
              disabled={buying}
            />
          </View>
        </View>
      ) : (
        !loading && (
          <Text style={styles.empty}>
            {t('nft.noFloor', { defaultValue: 'No active listings in this collection.' })}
          </Text>
        )
      )}

      {result !== undefined && (
        <View style={[styles.card, result.ok ? styles.cardSuccess : styles.cardError]}>
          {result.ok ? (
            <>
              <Text style={styles.sectionTitle}>
                {t('nft.success', { defaultValue: 'Purchase confirmed' })}
              </Text>
              <Row label="saleId" value={result.saleId} />
              <Row label="txHash" value={shortHash(result.txHash)} />
              {result.approvedInline && (
                <Text style={styles.note}>
                  {t('nft.approvedInline', {
                    defaultValue: 'OmniCoin allowance was auto-approved before purchase.',
                  })}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {t('nft.failure', { defaultValue: 'Purchase failed' })}
              </Text>
              <Row label="code" value={result.code} />
              <Row label="message" value={result.message} />
              {result.detail !== undefined && <Row label="detail" value={result.detail} />}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/** Labeled key/value row. */
function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight === true && styles.rowValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 48 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  header: { alignItems: 'center', marginVertical: 16 },
  cover: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderText: {
    color: colors.textMuted,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  contractLine: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cardSuccess: { borderColor: colors.primary },
  cardError: { borderColor: colors.danger },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.textPrimary, fontSize: 13, maxWidth: '60%', textAlign: 'right' },
  rowValueHighlight: { color: colors.primary, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  buyRow: { marginTop: 16 },
  loadingRow: { alignItems: 'center', padding: 24 },
  error: { color: colors.danger, marginVertical: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 32 },
});
