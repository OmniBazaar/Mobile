/**
 * ChromeStub — install a no-op `globalThis.chrome` shim so the bundled
 * Wallet code can run unmodified on React Native.
 *
 * Why this exists:
 *   The Wallet's bundled code (`@wallet/*` from
 *   `Mobile/.bundled/wallet/src`) was authored for Manifest V3 service
 *   workers, where `globalThis.chrome` is the extension API surface.
 *   Several call sites — most notably `ValidatorDiscoveryService` and
 *   `ChallengeAuthClient.hardwareSigner` — call `chrome.runtime.X`
 *   directly. On Hermes (RN's JS engine), `chrome` is undefined, so
 *   every such call throws `ReferenceError: Property 'chrome' doesn't
 *   exist`. That's the root cause of the "undefined is not a function"
 *   the user reported during login: the verify-challenge path runs
 *   `chrome.runtime.sendMessage(...)` on a missing global.
 *
 *   Rather than guard every call site, we install a stub that:
 *
 *     - Has `chrome.runtime.id === undefined` so extension-only
 *       branches that gate on `chrome.runtime?.id !== undefined`
 *       (e.g. ValidatorDiscoveryService.setupExtensionListeners,
 *       SW initialization) are skipped on Mobile.
 *
 *     - Provides safe no-op implementations of `getURL`,
 *       `sendMessage`, and the `addListener` family so unguarded
 *       call sites don't throw. The popup-only message round-trip
 *       (`sendMessage` round-tripping to the SW handler set) returns
 *       a never-resolving / rejected promise, which callers either
 *       wrap in try/catch or fan-out to a local handler instead.
 *
 *   Storage access (`chrome.storage.local.*`) is routed through the
 *   platform StorageAdapter elsewhere, so we deliberately leave
 *   `chrome.storage` UNDEFINED here — code that needs persistent
 *   storage must reach for `getStorageAdapter()` instead, which is
 *   already the canonical mobile path.
 *
 * @module services/ChromeStub
 */

let installed = false;

/**
 * Build a simple event registration target whose `addListener`
 * accepts a callback but never fires — matching what the SW lifecycle
 * APIs `onStartup` / `onInstalled` / `onMessage` look like to
 * code-paths that expect them.
 */
function noopEventTarget(): {
  addListener: (cb: unknown) => void;
  removeListener: (cb: unknown) => void;
  hasListener: () => boolean;
} {
  return {
    addListener: (): void => {},
    removeListener: (): void => {},
    hasListener: (): boolean => false,
  };
}

/**
 * Install a `globalThis.chrome` stub. Idempotent.
 *
 * Must run BEFORE any `@wallet/*` code is imported (which happens via
 * static imports in many Mobile services). App.tsx invokes this at
 * the top of the boot sequence, alongside the Buffer / process /
 * ethers-crypto polyfills.
 */
export function installChromeStub(): void {
  if (installed) return;
  installed = true;

  const g = globalThis as Record<string, unknown>;
  if (g['chrome'] !== undefined) return;

  const chromeStub = {
    runtime: {
      // `id === undefined` — the canonical signal "not running inside
      // an extension". Extension-only branches in
      // ValidatorDiscoveryService et al. gate on this and skip
      // themselves.
      id: undefined,
      // Not all code paths read `lastError`; provide it as undefined
      // so reads don't throw.
      lastError: undefined,
      // Bundled assets like `bootstrap.json` aren't shipped with the
      // RN bundle. Returning empty makes the fetch fail and the
      // caller falls back to its other discovery methods.
      getURL: (_path: string): string => '',
      // Popup-only messaging is unsupported on RN. Return a rejected
      // promise so callers' .catch / try-catch handlers run cleanly
      // and surface a useful error if anyone reaches this path.
      sendMessage: (..._args: unknown[]): Promise<never> =>
        Promise.reject(new Error('chrome.runtime.sendMessage is not available on mobile')),
      // Lifecycle hooks — fire never.
      onStartup: noopEventTarget(),
      onInstalled: noopEventTarget(),
      onMessage: noopEventTarget(),
      onConnect: noopEventTarget(),
    },
    // Deliberately omit `storage` so any code path that reaches for
    // `chrome.storage.local` lights up loudly during testing instead
    // of silently no-oping. Persistent storage on Mobile must go
    // through `getStorageAdapter()`.
  };

  Object.defineProperty(g, 'chrome', {
    value: chromeStub,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}
