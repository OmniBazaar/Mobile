/**
 * CreateListingScreen — seller-side P2P listing creator.
 *
 * Form fields:
 *   - Title, description, price, currency (XOM / USDC / USDT)
 *   - Category (products / services / jobs / realEstate / vehicles / personal / other)
 *   - Up to 6 images (camera capture or library pick) → uploaded to IPFS
 *   - Country / region / city (optional)
 *
 * Submit flow:
 *   1. Validate locally (length caps, price > 0, ≥1 image).
 *   2. Upload pending image assets to IPFS via {@link uploadAsset}.
 *   3. Sign the canonical EIP-191 intent string + POST via
 *      {@link createListing}.
 *   4. On success, navigate back; the new listing appears in browse +
 *      My Listings within the validator's index window (~5–10 s).
 *
 * Camera capture uses `expo-image-picker.launchCameraAsync` rather
 * than a custom `expo-camera` view — simpler UX and avoids a
 * full-screen capture screen for Sprint 2 MVP.
 *
 * @module screens/CreateListingScreen
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import Button from '@components/Button';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import type { ListingCategory } from '@wallet/services/marketplace/MarketplaceClient';

import { useAuthStore } from '../store/authStore';
import { uploadAsset, type ImageAsset } from '../services/IPFSUploadService';
import { createListing } from '../services/CreateListingService';
import { logger } from '../utils/logger';

const CATEGORIES: Array<{ key: ListingCategory; label: string }> = [
  { key: 'products', label: 'Products' },
  { key: 'services', label: 'Services' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'realEstate', label: 'Real Estate' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'personal', label: 'Personal' },
  { key: 'other', label: 'Other' },
];

const CURRENCIES = ['XOM', 'USDC', 'USDT'] as const;
type Currency = (typeof CURRENCIES)[number];

const MAX_IMAGES = 6;
const MAX_TITLE_CHARS = 80;
const MAX_DESC_CHARS = 2_000;

/** A pending image asset — uploaded URL is undefined until upload completes. */
interface PendingImage {
  asset: ImageAsset;
  uploadedUrl?: string;
  uploading: boolean;
  error?: string;
}

/** Props accepted by CreateListingScreen. */
export interface CreateListingScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Called on successful listing creation; receives the new listing ID. */
  onListed: (listingId: string) => void;
}

/**
 * Render the create-listing form.
 *
 * @param props - See {@link CreateListingScreenProps}.
 * @returns JSX.
 */
export default function CreateListingScreen(
  props: CreateListingScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const sellerAddress = useAuthStore((s) => s.address);
  const mnemonic = useAuthStore((s) => s.mnemonic);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('XOM');
  const [category, setCategory] = useState<ListingCategory>('products');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  /** Upload a single asset, mutating the row's uploadedUrl on success. */
  const uploadOne = useCallback(async (asset: ImageAsset, index: number): Promise<void> => {
    setImages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, uploading: true, error: undefined } : p)),
    );
    try {
      const result = await uploadAsset(asset);
      setImages((prev) =>
        prev.map((p, i) =>
          i === index ? { asset: p.asset, uploadedUrl: result.url, uploading: false } : p,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImages((prev) =>
        prev.map((p, i) =>
          i === index
            ? { asset: p.asset, uploading: false, error: msg }
            : p,
        ),
      );
    }
  }, []);

  /** Pick from library + queue upload. */
  const onPickFromLibrary = useCallback(async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t('createListing.errors.libraryDenied', {
        defaultValue: 'Permission to access the photo library was denied.',
      }));
      return;
    }
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (res.canceled || res.assets.length === 0) return;
    const newRows: PendingImage[] = res.assets.map((a) => ({
      asset: {
        uri: a.uri,
        ...(a.mimeType !== undefined && { mimeType: a.mimeType }),
        ...(a.fileName !== undefined && a.fileName !== null && { fileName: a.fileName }),
        ...(typeof a.fileSize === 'number' && { fileSize: a.fileSize }),
      },
      uploading: true,
    }));
    const insertAt = images.length;
    setImages((prev) => [...prev, ...newRows]);
    await Promise.all(newRows.map((r, i) => uploadOne(r.asset, insertAt + i)));
  }, [images.length, t, uploadOne]);

  /** Capture a new photo + queue upload. */
  const onCapture = useCallback(async (): Promise<void> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(t('createListing.errors.cameraDenied', {
        defaultValue: 'Camera permission was denied.',
      }));
      return;
    }
    if (images.length >= MAX_IMAGES) return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (res.canceled || res.assets.length === 0) return;
    const a = res.assets[0];
    if (a === undefined) return;
    const row: PendingImage = {
      asset: {
        uri: a.uri,
        ...(a.mimeType !== undefined && { mimeType: a.mimeType }),
        ...(a.fileName !== undefined && a.fileName !== null && { fileName: a.fileName }),
        ...(typeof a.fileSize === 'number' && { fileSize: a.fileSize }),
      },
      uploading: true,
    };
    const insertAt = images.length;
    setImages((prev) => [...prev, row]);
    await uploadOne(row.asset, insertAt);
  }, [images.length, t, uploadOne]);

  const removeImage = useCallback((index: number): void => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** Validate the form. Returns user-actionable error key or undefined. */
  const validate = useCallback((): string | undefined => {
    if (sellerAddress === '' || mnemonic === '') {
      return t('createListing.errors.notAuthed', {
        defaultValue: 'Sign in before creating a listing.',
      });
    }
    if (title.trim().length < 4) {
      return t('createListing.errors.titleTooShort', {
        defaultValue: 'Title must be at least 4 characters.',
      });
    }
    if (title.length > MAX_TITLE_CHARS) {
      return t('createListing.errors.titleTooLong', {
        defaultValue: 'Title must be 80 characters or fewer.',
      });
    }
    if (description.trim().length < 10) {
      return t('createListing.errors.descTooShort', {
        defaultValue: 'Description must be at least 10 characters.',
      });
    }
    if (description.length > MAX_DESC_CHARS) {
      return t('createListing.errors.descTooLong', {
        defaultValue: 'Description must be 2,000 characters or fewer.',
      });
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return t('createListing.errors.priceInvalid', {
        defaultValue: 'Enter a price greater than zero.',
      });
    }
    if (images.length === 0) {
      return t('createListing.errors.noImages', {
        defaultValue: 'Add at least one photo of what you are selling.',
      });
    }
    if (images.some((i) => i.uploading)) {
      return t('createListing.errors.uploadingStill', {
        defaultValue: 'Wait for image uploads to finish before publishing.',
      });
    }
    if (images.some((i) => i.uploadedUrl === undefined)) {
      return t('createListing.errors.uploadIncomplete', {
        defaultValue: 'One or more images failed to upload. Remove or retry them.',
      });
    }
    return undefined;
  }, [sellerAddress, mnemonic, title, description, price, images, t]);

  const onSubmit = useCallback(async (): Promise<void> => {
    setError(undefined);
    const invalid = validate();
    if (invalid !== undefined) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createListing({
        title: title.trim(),
        description: description.trim(),
        price,
        currency,
        category,
        imageUrls: images
          .map((i) => i.uploadedUrl)
          .filter((u): u is string => u !== undefined),
        sellerAddress,
        mnemonic,
        ...(country.trim() !== '' && { country: country.trim() }),
        ...(region.trim() !== '' && { region: region.trim() }),
        ...(city.trim() !== '' && { city: city.trim() }),
      });
      Alert.alert(
        t('createListing.success.title', { defaultValue: 'Listing published' }),
        t('createListing.success.body', {
          defaultValue:
            'Your listing is live and indexing. Buyers will see it within a few seconds.',
        }),
      );
      props.onListed(result.listingId);
    } catch (err) {
      logger.warn('[create-listing] submit failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('createListing.errors.submitFailed', {
          defaultValue: 'Could not publish the listing. Check your connection and try again.',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  }, [validate, title, description, price, currency, category, images, sellerAddress, mnemonic, country, region, city, t, props]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('createListing.title', { defaultValue: 'New Listing' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* ─── Images ─── */}
        <Text style={styles.sectionLabel}>
          {t('createListing.photos', { defaultValue: 'Photos' })} ({images.length}/{MAX_IMAGES})
        </Text>
        <View style={styles.imageGrid}>
          {images.map((row, idx) => (
            <View key={`${row.asset.uri}-${idx}`} style={styles.imageWrap}>
              <Image source={{ uri: row.asset.uri }} style={styles.image} accessibilityIgnoresInvertColors />
              {row.uploading && (
                <View style={styles.imageOverlay} accessibilityLabel={t('createListing.uploading', { defaultValue: 'Uploading…' })}>
                  <Text style={styles.imageOverlayText}>
                    {t('createListing.uploading', { defaultValue: 'Uploading…' })}
                  </Text>
                </View>
              )}
              {row.error !== undefined && (
                <View style={styles.imageError} accessibilityRole="alert">
                  <Text style={styles.imageErrorText} numberOfLines={2}>
                    {row.error}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={(): void => removeImage(idx)}
                accessibilityRole="button"
                accessibilityLabel={t('createListing.removePhoto', { defaultValue: 'Remove photo' })}
                style={styles.imageRemove}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={20} color={colors.background} />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <View style={styles.addRow}>
              <Pressable
                onPress={(): void => void onCapture()}
                accessibilityRole="button"
                accessibilityLabel={t('createListing.takePhoto', { defaultValue: 'Take a photo' })}
                style={styles.addBtn}
              >
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.addBtnText}>{t('createListing.camera', { defaultValue: 'Camera' })}</Text>
              </Pressable>
              <Pressable
                onPress={(): void => void onPickFromLibrary()}
                accessibilityRole="button"
                accessibilityLabel={t('createListing.pickFromLibrary', { defaultValue: 'Pick from library' })}
                style={styles.addBtn}
              >
                <Ionicons name="images-outline" size={24} color={colors.primary} />
                <Text style={styles.addBtnText}>{t('createListing.library', { defaultValue: 'Library' })}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ─── Title ─── */}
        <Text style={styles.sectionLabel}>{t('createListing.titleField', { defaultValue: 'Title' })}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={MAX_TITLE_CHARS}
          placeholder={t('createListing.titlePlaceholder', { defaultValue: 'What are you selling?' })}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('createListing.titleField', { defaultValue: 'Title' })}
        />

        {/* ─── Description ─── */}
        <Text style={styles.sectionLabel}>{t('createListing.descField', { defaultValue: 'Description' })}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={MAX_DESC_CHARS}
          multiline
          placeholder={t('createListing.descPlaceholder', { defaultValue: 'Condition, shipping, returns…' })}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.inputMultiline]}
          accessibilityLabel={t('createListing.descField', { defaultValue: 'Description' })}
        />

        {/* ─── Price + currency ─── */}
        <Text style={styles.sectionLabel}>{t('createListing.priceField', { defaultValue: 'Price' })}</Text>
        <View style={styles.priceRow}>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.priceInput]}
            accessibilityLabel={t('createListing.priceField', { defaultValue: 'Price' })}
          />
          <View style={styles.currencyRow}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c}
                onPress={(): void => setCurrency(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === c }}
                style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
              >
                <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ─── Category ─── */}
        <Text style={styles.sectionLabel}>{t('createListing.category', { defaultValue: 'Category' })}</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              onPress={(): void => setCategory(c.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c.key }}
              style={[styles.categoryChip, category === c.key && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, category === c.key && styles.categoryTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Location (optional) ─── */}
        <Text style={styles.sectionLabel}>
          {t('createListing.location', { defaultValue: 'Location (optional)' })}
        </Text>
        <View style={styles.locationRow}>
          <TextInput
            value={country}
            onChangeText={setCountry}
            placeholder={t('createListing.country', { defaultValue: 'Country' })}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.locationInput]}
            maxLength={4}
            autoCapitalize="characters"
          />
          <TextInput
            value={region}
            onChangeText={setRegion}
            placeholder={t('createListing.region', { defaultValue: 'Region' })}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.locationInput]}
            maxLength={64}
          />
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t('createListing.city', { defaultValue: 'City' })}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.locationInput]}
            maxLength={64}
          />
        </View>

        {error !== undefined && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Button
          title={
            submitting
              ? t('createListing.submitting', { defaultValue: 'Publishing…' })
              : t('createListing.publish', { defaultValue: 'Publish Listing' })
          }
          onPress={(): void => void onSubmit()}
          disabled={submitting}
          style={styles.cta}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 64 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
  },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageWrap: { width: 96, height: 96, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  imageOverlayText: { color: colors.background, fontSize: 11, fontWeight: '600' },
  imageError: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  imageErrorText: { color: colors.background, fontSize: 11, fontWeight: '600', paddingHorizontal: 4 },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { flex: 1 },
  currencyRow: { flexDirection: 'row', gap: 4 },
  currencyChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  currencyChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencyText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  currencyTextActive: { color: colors.background },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.textSecondary, fontSize: 13 },
  categoryTextActive: { color: colors.background, fontWeight: '700' },
  locationRow: { flexDirection: 'row', gap: 8 },
  locationInput: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },
  cta: { marginTop: 24 },
});
