/**
 * BootstrapService — single entry point Mobile calls at app cold start.
 *
 * Responsibilities:
 *   1. Call `getDiscoveryService().initialize()` from Wallet (the
 *      validator discovery singleton doesn't auto-init on Mobile the way
 *      it does in the extension service worker).
 *   2. Surface a single `ready` Promise so screens can gate their first
 *      network call behind it.
 *   3. Expose `getBaseUrl()` for direct consumers that need the active
 *      validator URL without going through a service client.
 *
 * Timeouts are generous (discovery can probe 5 seeds in parallel) but
 * not unbounded — if every validator is unreachable after 8s we settle
 * for the hardcoded seed URL in ValidatorDiscoveryService and let the
 * UI render an offline state.
 */

import { getDiscoveryService } from '@wallet/background/services/ValidatorDiscoveryService';

const DISCOVERY_TIMEOUT_MS = 8_000;

let readyPromise: Promise<void> | undefined;

/**
 * Kick off validator discovery. Idempotent — subsequent calls return the
 * same Promise.
 *
 * @returns A Promise that resolves once discovery has settled or the
 *   timeout has elapsed (whichever comes first). Never rejects.
 */
export function bootstrap(): Promise<void> {
  if (readyPromise !== undefined) return readyPromise;

  readyPromise = (async (): Promise<void> => {
    const service = getDiscoveryService();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const discovery = service.initialize().catch((err: unknown) => {
      // Swallow — the getBaseUrl() fallback will serve a seed URL while
      // discovery retries in the background.
      console.warn('[bootstrap] validator discovery failed:', err);
    });
    const timeout = new Promise<void>((resolve) => {
      timeoutHandle = setTimeout(resolve, DISCOVERY_TIMEOUT_MS);
    });
    try {
      await Promise.race([discovery, timeout]);
    } finally {
      // Clear the timer whichever side of the race resolved first so
      // Jest doesn't complain about lingering async handles.
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  })();

  return readyPromise;
}

/**
 * Resolve the current best validator base URL. May return the seed
 * fallback if discovery hasn't completed yet.
 *
 * @returns Validator HTTP base URL without trailing slash.
 */
export function getBaseUrl(): string {
  return getDiscoveryService().getBaseUrl();
}
