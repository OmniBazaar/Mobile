/**
 * SecureStoreAdapter — Mobile implementation of @wallet/platform's StorageAdapter.
 *
 * Persists key/value pairs in `expo-secure-store` (iOS Keychain /
 * Android Keystore). Values are JSON-serialized; only strings physically
 * hit the OS store. Keys with special characters are hex-escaped since
 * expo-secure-store rejects anything outside `[A-Za-z0-9._-]`.
 *
 * The `watch()` surface of the StorageAdapter interface is not supported
 * here — expo-secure-store has no change-event channel. Returns a no-op
 * unsubscribe function so callers that rely on eventual consistency
 * (refetch-on-focus is the usual alternative) work without modification.
 */

import * as SecureStore from 'expo-secure-store';
import type { StorageAdapter } from '@wallet/platform/adapters';

/**
 * expo-secure-store only accepts keys matching `/[A-Za-z0-9._-]+/`. We
 * hex-encode any other byte so the escaped key is reversible and
 * collision-free.
 *
 * @param key - Raw storage key (may contain any UTF-8 character).
 * @returns Escaped key safe for expo-secure-store.
 */
function escapeKey(key: string): string {
  return Array.from(key)
    .map((c) => {
      if (/[A-Za-z0-9._-]/.test(c)) return c;
      const hex = c.charCodeAt(0).toString(16).padStart(4, '0');
      return `_x${hex}_`;
    })
    .join('');
}

/**
 * Index-key prefix used to maintain a parallel Set of every key the caller
 * has written. Used by {@link getAll} since expo-secure-store has no
 * "list all keys" primitive.
 */
const INDEX_KEY = '__omnibazaar_secure_store_index__';

/**
 * StorageAdapter backed by expo-secure-store. Instantiated and registered
 * at app boot in `Mobile/src/platform/register-mobile-adapters.ts`.
 */
export class SecureStoreAdapter implements StorageAdapter {
  /**
   * Read the current set of known keys, or an empty array if absent.
   * @returns The stored key list.
   */
  private async readIndex(): Promise<string[]> {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Persist the key list.
   * @param keys - New key list to store.
   */
  private async writeIndex(keys: string[]): Promise<void> {
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(keys));
  }

  /**
   * Read a value from secure storage.
   * Returns `undefined` when the key is absent or the stored JSON fails
   * to parse (corruption — rare but possible if the store was written
   * by an older binary).
   *
   * @param key - Logical storage key.
   * @returns Parsed value or undefined.
   */
  async getItem<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await SecureStore.getItemAsync(escapeKey(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  /**
   * Persist a value to secure storage.
   * @param key - Logical storage key.
   * @param value - Any JSON-serializable value.
   */
  async setItem<T = unknown>(key: string, value: T): Promise<void> {
    await SecureStore.setItemAsync(escapeKey(key), JSON.stringify(value));
    const index = await this.readIndex();
    if (!index.includes(key)) {
      index.push(key);
      await this.writeIndex(index);
    }
  }

  /**
   * Remove a key. No-op when the key doesn't exist.
   * @param key - Logical storage key to remove.
   */
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(escapeKey(key));
    const index = await this.readIndex();
    const next = index.filter((k) => k !== key);
    if (next.length !== index.length) {
      await this.writeIndex(next);
    }
  }

  /**
   * Return every known key/value pair. Skips keys that fail to parse.
   * @returns Record of all known keys to their parsed values.
   */
  async getAll(): Promise<Record<string, unknown>> {
    const index = await this.readIndex();
    const out: Record<string, unknown> = {};
    for (const key of index) {
      const v = await this.getItem(key);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }

  /**
   * expo-secure-store exposes no change-event API, so `watch` returns a
   * no-op. Callers that need live updates should refetch on focus via
   * `useFocusEffect` / `AppState` subscriptions.
   *
   * @returns A no-op unsubscribe function.
   */
  watch<T = unknown>(_key: string, _callback: (value: T | undefined) => void): () => void {
    return () => {
      /* expo-secure-store has no onChanged listener */
    };
  }
}
