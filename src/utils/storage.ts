/**
 * Deprecated placeholder.
 *
 * Older Mobile scaffolding referenced `@/utils/storage` as a local wrapper.
 * Mobile has since adopted the platform-adapter pattern — see
 * `src/platform/SecureStoreAdapter.ts` and
 * `@wallet/platform/registry::getStorageAdapter()`. This module now
 * re-exports the registry accessor so any straggling import continues
 * to work while we remove the callsites.
 *
 * Once every `@/utils/storage` caller has migrated to
 * `getStorageAdapter()`, this file can be deleted.
 */

import { getStorageAdapter } from '@wallet/platform/registry';

/** Known logical storage keys used across the mobile app. */
export type StorageKeys =
  | 'omniauth'
  | 'hardwareAccounts'
  | 'onramp_api_keys'
  | 'omnibazaar_address_book'
  | 'omnibazaar_balance_alerts'
  | 'omnibazaar_custom_networks'
  | 'antiPhishingBanner'
  | 'mevProtectionEnabled'
  | 'transactionSimulationEnabled'
  | 'clientRegion'
  | 'validators'
  | 'validatorList';

/**
 * Thin default export that mirrors the shape legacy callers expected:
 * `storage.get(key)` / `storage.set(key, value)` / `storage.remove(key)`.
 * Delegates to the platform StorageAdapter.
 */
const storage = {
  async get<T = unknown>(key: StorageKeys | string): Promise<T | undefined> {
    return await getStorageAdapter().getItem<T>(key);
  },
  async set<T = unknown>(key: StorageKeys | string, value: T): Promise<void> {
    await getStorageAdapter().setItem<T>(key, value);
  },
  async remove(key: StorageKeys | string): Promise<void> {
    await getStorageAdapter().removeItem(key);
  },
};

export default storage;
