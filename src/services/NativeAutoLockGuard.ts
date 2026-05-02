/**
 * NativeAutoLockGuard — auto-lock that survives a JS-bundle kill.
 *
 * The plain `AutoLockService` uses `setTimeout` and an `AppState`
 * listener. Both die when the OS suspends or kills the JS bundle. A
 * sleeping phone with a 5-minute lock policy can wake up at hour 6
 * with the bundle still alive in RAM; if `setTimeout` was scheduled
 * for 5 minutes from the last interaction, it would fire — but if the
 * OS kills + restarts the bundle in the meantime, the timer is
 * forgotten and the wallet remains "unlocked" until the user
 * interacts again.
 *
 * The guard closes that hole with a tiny SecureStore-persisted
 * timestamp:
 *
 *   1. Whenever the wallet unlocks, AutoLock starts arming itself.
 *      `armNativeGuard(intervalMs)` writes `lockByMs = now + interval`
 *      to SecureStore.
 *   2. On every AppState=active transition AND on cold-start boot,
 *      `evaluateNativeGuard()` reads the timestamp. If it has elapsed,
 *      `lockKeystore()` runs immediately — before any UI renders.
 *   3. `disarmNativeGuard()` clears the timestamp; called by
 *      `markUnlocked()` (fresh unlock window) and `clear()` (sign-out).
 *
 * No native module, no config plugin, no expo-task-manager dependency
 * — just a single `expo-secure-store` write per lifecycle transition.
 * Resistant to bundle suspension AND to a full process kill.
 *
 * Companion to `AutoLockService`: AutoLockService handles the live
 * "user is here, count down" timer; NativeAutoLockGuard handles the
 * "user came back" check.
 *
 * @module services/NativeAutoLockGuard
 */

import { logger } from '../utils/logger';

/** SecureStore key for the persisted lockBy timestamp. */
const STORAGE_KEY = 'omnibazaar.autolock.lockByMs';

/** Lazy-load the platform StorageAdapter so test bundles compile. */
async function loadStorage(): Promise<{
  getItem: <T>(k: string) => Promise<T | undefined>;
  setItem: (k: string, v: unknown) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
} | undefined> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: unknown = require('@wallet/platform/registry');
    if (mod !== undefined && mod !== null && typeof mod === 'object') {
      const get = (mod as { getStorageAdapter?: () => unknown }).getStorageAdapter;
      if (typeof get === 'function') {
        return get() as Awaited<ReturnType<typeof loadStorage>>;
      }
    }
  } catch (err) {
    logger.debug('[autolock-guard] storage adapter unavailable', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return undefined;
}

/**
 * Persist the new "lock by" timestamp. Called whenever AutoLock
 * (re)arms its idle timer.
 *
 * @param intervalMs - Idle interval in ms. Pass `Infinity` to clear
 *   the guard (user picked "Never").
 */
export async function armNativeGuard(intervalMs: number): Promise<void> {
  const storage = await loadStorage();
  if (storage === undefined) return;
  if (!Number.isFinite(intervalMs)) {
    await storage.removeItem(STORAGE_KEY).catch(() => undefined);
    return;
  }
  const lockByMs = Date.now() + intervalMs;
  try {
    await storage.setItem(STORAGE_KEY, { lockByMs });
  } catch (err) {
    logger.debug('[autolock-guard] arm write failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Drop the persisted timestamp. Called on fresh unlock + sign-out so
 * the next AppState=active doesn't trigger a stale lock.
 */
export async function disarmNativeGuard(): Promise<void> {
  const storage = await loadStorage();
  if (storage === undefined) return;
  try {
    await storage.removeItem(STORAGE_KEY);
  } catch (err) {
    logger.debug('[autolock-guard] disarm failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Read the persisted timestamp and decide whether the lock is overdue.
 *
 * @returns `true` when the previously-armed timer would have fired
 *   before now (caller must immediately invoke `lockKeystore()`).
 *   `false` when the timestamp is missing, in the future, or storage
 *   isn't reachable.
 */
export async function evaluateNativeGuard(): Promise<boolean> {
  const storage = await loadStorage();
  if (storage === undefined) return false;
  try {
    const stored = await storage.getItem<{ lockByMs?: number }>(STORAGE_KEY);
    const lockByMs = stored?.lockByMs;
    if (typeof lockByMs !== 'number' || !Number.isFinite(lockByMs)) return false;
    return Date.now() >= lockByMs;
  } catch (err) {
    logger.debug('[autolock-guard] evaluate failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
