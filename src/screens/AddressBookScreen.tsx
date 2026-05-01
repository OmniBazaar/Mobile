/**
 * AddressBookScreen — saved-contact list + edit.
 *
 * Persists to local SecureStore via the existing platform StorageAdapter.
 * Each row carries a label + EVM address; the user can add, rename,
 * delete, and tap-to-copy. The Send screen reads the same store via a
 * future hook (Sprint 3 follow-up — for now AddressBook is read/manage
 * only; the user types an address into Send manually until that hook
 * lands).
 *
 * @module screens/AddressBookScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '@components/ScreenHeader';
import Button from '@components/Button';
import { colors } from '@theme/colors';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'mobile-address-book';

/** Single saved contact. */
export interface AddressBookEntry {
  /** Stable opaque ID. */
  id: string;
  /** User-supplied label. */
  label: string;
  /** Lowercased EVM address. */
  address: string;
}

/** Read the storage adapter wrapper. Lazily required so test env compiles. */
async function readBook(): Promise<AddressBookEntry[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStorageAdapter } = require('@wallet/platform/registry') as {
      getStorageAdapter: () => {
        getItem: <T>(k: string) => Promise<T | undefined>;
      };
    };
    const raw = await getStorageAdapter().getItem<AddressBookEntry[]>(STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    logger.debug('[address-book] read failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function writeBook(entries: AddressBookEntry[]): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStorageAdapter } = require('@wallet/platform/registry') as {
      getStorageAdapter: () => {
        setItem: (k: string, v: unknown) => Promise<void>;
      };
    };
    await getStorageAdapter().setItem(STORAGE_KEY, entries);
  } catch (err) {
    logger.warn('[address-book] write failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

const ADDR_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Generate an opaque ID. */
function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Props accepted by AddressBookScreen. */
export interface AddressBookScreenProps {
  /** Back-navigation. */
  onBack: () => void;
}

/**
 * Render the address book.
 *
 * @param props - See {@link AddressBookScreenProps}.
 * @returns JSX.
 */
export default function AddressBookScreen(
  props: AddressBookScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void readBook().then(setEntries);
  }, []);

  const onAdd = useCallback(async (): Promise<void> => {
    setError(undefined);
    const label = draftLabel.trim();
    const addr = draftAddress.trim();
    if (label.length < 1 || label.length > 32) {
      setError(t('addressBook.errors.label', {
        defaultValue: 'Label must be 1–32 characters.',
      }));
      return;
    }
    if (!ADDR_PATTERN.test(addr)) {
      setError(t('addressBook.errors.address', {
        defaultValue: 'Enter a valid 0x-prefixed Ethereum address.',
      }));
      return;
    }
    const entry: AddressBookEntry = {
      id: newId(),
      label,
      address: addr.toLowerCase(),
    };
    const next = [...entries, entry].sort((a, b) => a.label.localeCompare(b.label));
    setEntries(next);
    await writeBook(next);
    setDraftLabel('');
    setDraftAddress('');
  }, [draftLabel, draftAddress, entries, t]);

  const onDelete = useCallback(
    (id: string): void => {
      const target = entries.find((e) => e.id === id);
      if (target === undefined) return;
      Alert.alert(
        t('addressBook.deleteTitle', { defaultValue: 'Delete contact?' }),
        t('addressBook.deleteBody', {
          defaultValue: 'Remove "{{label}}" from your address book?',
          label: target.label,
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('common.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: () => {
              const next = entries.filter((e) => e.id !== id);
              setEntries(next);
              void writeBook(next);
            },
          },
        ],
      );
    },
    [entries, t],
  );

  const onCopy = useCallback(async (entry: AddressBookEntry): Promise<void> => {
    await Clipboard.setStringAsync(entry.address);
    Alert.alert(
      t('addressBook.copied', { defaultValue: 'Address copied' }),
      `${entry.label} → ${entry.address}`,
    );
  }, [t]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('addressBook.title', { defaultValue: 'Address Book' })}
        onBack={props.onBack}
      />
      <View style={styles.addRow}>
        <TextInput
          value={draftLabel}
          onChangeText={setDraftLabel}
          placeholder={t('addressBook.label', { defaultValue: 'Label (e.g. Alice)' })}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.labelInput]}
          maxLength={32}
        />
        <TextInput
          value={draftAddress}
          onChangeText={setDraftAddress}
          placeholder="0x…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.addressInput]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
      <Button
        title={t('addressBook.add', { defaultValue: 'Save Contact' })}
        onPress={(): void => void onAdd()}
        style={styles.addBtn}
      />
      <FlashList
        data={entries}
        keyExtractor={(e): string => e.id}
        estimatedItemSize={64}
        renderItem={({ item }): React.ReactElement => (
          <Pressable
            onPress={(): void => void onCopy(item)}
            onLongPress={(): void => onDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} ${item.address}`}
            accessibilityHint={t('addressBook.entryHint', {
              defaultValue: 'Tap to copy. Long-press to delete.',
            })}
            style={styles.row}
          >
            <View style={styles.rowMid}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowAddress} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
            <Ionicons name="copy-outline" size={20} color={colors.primary} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t('addressBook.empty', {
              defaultValue: 'No saved contacts yet. Add one above.',
            })}
          </Text>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  addRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    color: colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  labelInput: { width: 110 },
  addressInput: { flex: 1 },
  addBtn: { marginHorizontal: 16, marginTop: 12 },
  error: { color: colors.danger, fontSize: 12, marginTop: 8, paddingHorizontal: 16 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowMid: { flex: 1 },
  rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowAddress: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
});
