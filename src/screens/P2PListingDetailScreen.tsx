/**
 * P2PListingDetailScreen — listing detail + escrow purchase flow.
 *
 * Shown when the user taps a P2P listing card. Renders images + seller +
 * price, and — when the user confirms — runs `EscrowPurchaseService.purchaseEscrow`
 * which signs a CreateEscrow EIP-712 intent and asks the validator to
 * fund the escrow on-chain via OmniRelay (gasless for the buyer).
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  CreateEscrowResult,
  MarketplaceListing,
} from '@wallet/services/marketplace/MarketplaceClient';

import { Button } from '../components';
import { useRequireAuth } from '../components/RequireAuth';
import { colors } from '../theme/colors';
import { purchaseEscrow } from '../services/EscrowPurchaseService';

/** Props. */
export interface P2PListingDetailScreenProps {
  /** Listing tapped by the user. */
  listing: MarketplaceListing;
  /** Buyer wallet address. */
  buyer: string;
  /** BIP39 mnemonic — used in-memory only for signing. */
  mnemonic: string;
  /** Back nav. */
  onBack: () => void;
}

/**
 * Render listing detail + buy button + result panel.
 * @param props - See {@link P2PListingDetailScreenProps}.
 * @returns JSX.
 */
export default function P2PListingDetailScreen(
  props: P2PListingDetailScreenProps,
): JSX.Element {
  const { listing, buyer, mnemonic, onBack } = props;
  const { t } = useTranslation();
  const requireAuth = useRequireAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateEscrowResult | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const rawOnBuy = useCallback((): void => {
    setError(undefined);
    Alert.alert(
      t('p2p.confirmBuyTitle', { defaultValue: 'Confirm escrow purchase' }),
      t('p2p.confirmBuyBody', {
        defaultValue: `Fund escrow for ${listing.price} ${listing.currency}? A 0.25% buyer fee applies.`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: () => {
            setBusy(true);
            void (async (): Promise<void> => {
              try {
                const res = await purchaseEscrow({ listing, buyer, mnemonic });
                setResult(res);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [listing, buyer, mnemonic, t]);

  const onBuy = useCallback((): void => {
    requireAuth(
      t('authPrompt.toBuyP2P', {
        defaultValue: 'Sign in to fund the escrow and buy this listing.',
      }),
      rawOnBuy,
    );
  }, [requireAuth, rawOnBuy, t]);

  const coverUrl = listing.images[0];

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
      </Pressable>

      {coverUrl !== undefined ? (
        <Image source={{ uri: coverUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverPlaceholderText}>{listing.category}</Text>
        </View>
      )}

      <Text style={styles.title}>{listing.title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>
          {listing.price} {listing.currency}
        </Text>
        {listing.sellerRating !== undefined && (
          <Text style={styles.rating}>★ {listing.sellerRating.toFixed(1)}</Text>
        )}
      </View>
      {listing.description !== '' && (
        <Text style={styles.desc}>{listing.description}</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t('p2p.seller', { defaultValue: 'Seller' })}
        </Text>
        <Text style={styles.seller}>
          {listing.sellerUsername ?? shortAddress(listing.sellerAddress)}
        </Text>
        {listing.location !== undefined && (
          <Text style={styles.meta}>{listing.location}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t('p2p.escrowFee', { defaultValue: 'Escrow fee' })}
        </Text>
        <Text style={styles.meta}>
          {t('p2p.escrowFeeNote', {
            defaultValue:
              '0.25% buyer fee (refunded if the seller cancels). Escrow is gasless on OmniCoin L1 via OmniRelay.',
          })}
        </Text>
      </View>

      <View style={styles.buyRow}>
        <Button
          title={
            busy
              ? t('p2p.purchasing', { defaultValue: 'Submitting…' })
              : t('p2p.buy', { defaultValue: 'Buy with escrow' })
          }
          onPress={onBuy}
          disabled={busy}
        />
      </View>

      {error !== undefined && (
        <View style={[styles.card, styles.cardError]}>
          <Text style={styles.sectionTitle}>
            {t('p2p.failure', { defaultValue: 'Purchase failed' })}
          </Text>
          <Text style={styles.meta}>{error}</Text>
        </View>
      )}

      {result !== undefined && (
        <View style={[styles.card, styles.cardSuccess]}>
          <Text style={styles.sectionTitle}>
            {t('p2p.success', { defaultValue: 'Escrow funded' })}
          </Text>
          <Row label="escrowId" value={result.escrowId} />
          <Row label="chatThreadId" value={result.chatThreadId} />
          <Row label="txHash" value={shortHash(result.txHash)} />
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
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
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderText: { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 16 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
  },
  price: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  rating: { color: colors.textSecondary, fontSize: 12 },
  desc: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 12 },
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
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  seller: { color: colors.textPrimary, fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  buyRow: { marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  rowLabel: { color: colors.textSecondary, fontSize: 12 },
  rowValue: { color: colors.textPrimary, fontSize: 12, maxWidth: '60%', textAlign: 'right' },
});
