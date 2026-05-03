/**
 * Mobile JS polyfills — runs at module-evaluation time, before any
 * other code in the bundle.
 *
 * **Why this is a separate module instead of inline in App.tsx:**
 *
 * ES module evaluation order is: a module's imports' bodies all
 * evaluate (recursively, dependency-first) BEFORE the importing
 * module's own body statements run. App.tsx imports `RootNavigator`,
 * `VersionCheckService`, `registerMobileAdapters`, etc. — every one
 * of those (and their transitive @wallet/@webapp imports) evaluates
 * its top-level code BEFORE App.tsx's body statements get a chance
 * to set `globalThis.Buffer = BufferPolyfill`. If anything in those
 * transitive imports reads `Buffer` (or `process.nextTick`, or
 * `AbortSignal.timeout`) at top-level evaluation, it crashes with a
 * `ReferenceError` BEFORE `AppRegistry.registerComponent` ever runs.
 *
 * Confirmed against three consecutive Pixel-class device logcats on
 * 2026-05-03: every one had `ReferenceError: Property 'Buffer' doesn't
 * exist` at bundle offset ~3.47M, deep in the `@wallet/*` import
 * graph. Reordering App.tsx body statements made no difference because
 * the offending require chain ran during App.tsx's IMPORT phase.
 *
 * The fix: put every global-polyfill assignment in this file's BODY,
 * imported as a side effect from App.tsx as the very first thing.
 * Side-effect imports are evaluated in declaration order — so when
 * App.tsx writes `import './native/polyfills';` as the first line,
 * polyfills.ts evaluates BEFORE App.tsx's other imports (and BEFORE
 * any of their transitive imports), so every global is in place by
 * the time any module reads it.
 *
 * This module must NEVER:
 *   - be lazy-loaded
 *   - depend on anything that itself reads a global that this module
 *     polyfills (chicken-and-egg)
 *
 * Order of operations within this file matters too: Buffer first
 * (heaviest dependency for crypto / chain SDKs), then process,
 * then AbortSignal.timeout. Each subsequent polyfill may rely on
 * its predecessors.
 *
 * @module native/polyfills
 */

/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

// ── 1. crypto.getRandomValues — RN polyfill, no global side-effect
// beyond `globalThis.crypto.getRandomValues = …`. Quick-crypto's
// install() (called later from App.tsx) overwrites this with a JSI
// version, so we get the fast path when available and the noble
// fallback when not.
import 'react-native-get-random-values';

// ── 2. TextEncoder / TextDecoder — Hermes (RN 0.73) doesn't expose
// these as globals. Cardano's serialization SDK destructures them
// from `require('util')` at module-load time, and the bundled `util`
// shim reads from `globalThis.{TextEncoder,TextDecoder}`. Side-effect
// import attaches both classes to `globalThis`.
import 'fast-text-encoding';

// ── 3. Buffer global. The single biggest source of boot-time crashes
// — every Buffer-using @wallet/* module (NFT escrow, Bitcoin family,
// COTI privacy, Cardano serialization, Ledger APDU framing, …) reads
// `Buffer` at top-level and would explode if we set this any later.
import { Buffer as BufferPolyfill } from 'buffer';
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = BufferPolyfill;
}

// ── 4. process polyfill — chain SDKs (algosdk, stellar, hedera, flow,
// cardano, cosmos, multiversx, tron) reference `process.nextTick`,
// `process.browser`, `process.version`, `process.env`. Hermes has a
// minimal `process` but it's missing `nextTick` and most other fields.
const __g = globalThis as any;
if (typeof __g.process?.nextTick !== 'function') {
  const queue: Array<[(...a: unknown[]) => void, unknown[]]> = [];
  let queued = false;
  const drain = (): void => {
    queued = false;
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) break;
      const [fn, args] = next;
      try {
        fn(...args);
      } catch (err) {
        void Promise.resolve().then(() => {
          throw err;
        });
      }
    }
  };
  const existing = (__g.process as Record<string, unknown> | undefined) ?? {};
  __g.process = {
    env: {},
    browser: true,
    version: '',
    versions: { node: '0.0.0' },
    title: 'browser',
    platform: 'browser',
    arch: 'arm64',
    argv: [],
    argv0: 'browser',
    pid: 0,
    cwd: () => '/',
    chdir: () => {
      throw new Error('process.chdir is not supported');
    },
    umask: () => 0,
    nextTick: (fn: (...a: unknown[]) => void, ...args: unknown[]): void => {
      if (typeof fn !== 'function') {
        throw new TypeError('process.nextTick callback must be a function');
      }
      queue.push([fn, args]);
      if (!queued) {
        queued = true;
        void Promise.resolve().then(drain);
      }
    },
    stdout: { write: (): void => undefined },
    stderr: { write: (): void => undefined },
    on: (): void => undefined,
    once: (): void => undefined,
    off: (): void => undefined,
    addListener: (): void => undefined,
    removeListener: (): void => undefined,
    removeAllListeners: (): void => undefined,
    emit: (): boolean => false,
    prependListener: (): void => undefined,
    prependOnceListener: (): void => undefined,
    listeners: (): unknown[] => [],
    ...existing,
  };
}

// ── 5. AbortSignal.timeout(ms) — added to Node 17.3 / browsers 2022.
// Several @wallet/* services pass `signal: AbortSignal.timeout(10_000)`
// to fetch(); on Hermes that's `undefined(...)` and throws.
if (typeof (AbortSignal as { timeout?: unknown }).timeout !== 'function') {
  (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout = (
    ms: number,
  ): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => {
      try {
        const reason =
          typeof (globalThis as { DOMException?: typeof DOMException }).DOMException ===
          'function'
            ? new DOMException('The operation timed out.', 'TimeoutError')
            : new Error('The operation timed out.');
        (controller.abort as (r?: unknown) => void)(reason);
      } catch {
        controller.abort();
      }
    }, ms);
    return controller.signal;
  };
}
