/**
 * MobileRuntimeAdapter — Mobile impl of @wallet/platform's RuntimeAdapter.
 *
 * Surfaces Expo Constants (version, app name) and the bundled-asset
 * resolution that the Extension counterpart exposes via chrome.runtime.
 *
 * `onStartup` fires exactly once — the handler is invoked on the next tick
 * after registration, modelling the "first boot in this JS realm" semantics
 * the Extension service worker had.
 *
 * `onInstalled` is effectively a no-op on Mobile (app-store installs don't
 * surface an event to the JS side); callers that wanted to seed default
 * storage on first install should instead check `AsyncStorage.getItem('installed')`
 * or equivalent during their own init path.
 */

import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import type { RuntimeAdapter } from '@wallet/platform/adapters';

export class MobileRuntimeAdapter implements RuntimeAdapter {
  public readonly platform = 'mobile' as const;

  /**
   * Return basic app metadata. Expo Constants exposes `expoConfig` (SDK 50+);
   * we surface name and version with a safe fallback when expoConfig is
   * unavailable (e.g., bare workflow).
   *
   * @returns Manifest-shaped record.
   */
  getManifest(): { name: string; version: string; [k: string]: unknown } {
    const cfg = Constants.expoConfig;
    if (cfg !== null && cfg !== undefined) {
      return {
        name: cfg.name ?? 'OmniBazaar Mobile',
        version: cfg.version ?? '0.0.0',
        slug: cfg.slug ?? 'omnibazaar-mobile',
      };
    }
    return { name: 'OmniBazaar Mobile', version: '0.0.0' };
  }

  /**
   * Resolve a path relative to the bundled asset root.
   *
   * This is a best-effort static resolver. Callers that need to actually
   * read the asset should use `Asset.fromModule(require(...))` instead —
   * this function exists only so extension code that called
   * `chrome.runtime.getURL('bootstrap.json')` to fetch a JSON file keeps
   * returning a URL the caller can hand to `fetch()`.
   *
   * @param relativePath - Path relative to the bundled asset root.
   * @returns Best-guess URI for the asset.
   */
  getURL(relativePath: string): string {
    // Expo doesn't expose a synchronous getURL like chrome.runtime.getURL.
    // For bundled JSON assets like `bootstrap.json`, callers should
    // `require()` the module directly. For runtime-downloaded assets the
    // Expo Updates URL is the closest analog.
    const base = Constants.expoConfig?.hostUri ?? 'asset:/';
    const clean = relativePath.replace(/^\/+/, '');
    return `${base.replace(/\/+$/, '')}/${clean}`;
  }

  /**
   * Fire the handler on the next tick. Returns a no-op unsubscribe.
   * @param handler - Called once.
   * @returns Unsubscribe (no-op after fire).
   */
  onInstalled(_handler: (details: { reason: string; previousVersion?: string }) => void): () => void {
    // No Mobile analog — store-delivered app updates don't surface an
    // event to JS. Callers that want "first-install" behavior should use
    // a flag in SecureStore.
    return () => {
      /* noop */
    };
  }

  /**
   * Fire the handler on the next tick to model "app just booted".
   * Returns an unsubscribe that only matters before the initial tick.
   *
   * @param handler - Called once on next tick.
   * @returns Unsubscribe function (effective only before the tick fires).
   */
  onStartup(handler: () => void): () => void {
    let cancelled = false;
    setTimeout(() => {
      if (!cancelled) handler();
    }, 0);
    return () => {
      cancelled = true;
    };
  }
}

// Suppress the unused-import warning for Asset; kept in the import block
// for the bootstrap-json preload callers (see Phase 1 wiring).
void Asset;
