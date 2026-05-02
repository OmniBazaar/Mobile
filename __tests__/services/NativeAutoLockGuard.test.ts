/**
 * NativeAutoLockGuard.test.ts — bundle-kill-resistant auto-lock.
 *
 * The guard persists a `lockByMs` timestamp on every AutoLock arm.
 * `evaluateNativeGuard()` reads it on cold-start + AppState=active and
 * returns `true` when the timer would have fired by now.
 *
 * Verified properties:
 *   - arm writes the right shape
 *   - arm with Infinity clears the entry (user picked "Never")
 *   - disarm removes it
 *   - evaluate returns true when overdue, false when in the future,
 *     false when missing/malformed/storage-down
 *   - storage failures never throw — callers see false / no-op
 */

const _store = new Map<string, unknown>();
const getItem = jest.fn(async <T>(k: string): Promise<T | undefined> => _store.get(k) as T | undefined);
const setItem = jest.fn(async (k: string, v: unknown): Promise<void> => {
  _store.set(k, v);
});
const removeItem = jest.fn(async (k: string): Promise<void> => {
  _store.delete(k);
});

jest.mock('@wallet/platform/registry', () => ({
  getStorageAdapter: () => ({ getItem, setItem, removeItem }),
}));

import {
  armNativeGuard,
  disarmNativeGuard,
  evaluateNativeGuard,
} from '../../src/services/NativeAutoLockGuard';

const KEY = 'omnibazaar.autolock.lockByMs';

beforeEach(() => {
  _store.clear();
  getItem.mockClear();
  setItem.mockClear();
  removeItem.mockClear();
});

describe('NativeAutoLockGuard', () => {
  it('arms with a future lockByMs', async () => {
    const before = Date.now();
    await armNativeGuard(60_000);
    const after = Date.now();
    expect(setItem).toHaveBeenCalledTimes(1);
    const written = setItem.mock.calls[0]?.[1] as { lockByMs?: number } | undefined;
    expect(written?.lockByMs).toBeGreaterThanOrEqual(before + 60_000);
    expect(written?.lockByMs).toBeLessThanOrEqual(after + 60_000);
  });

  it('clears the entry when armed with Infinity (user picked "Never")', async () => {
    _store.set(KEY, { lockByMs: Date.now() + 60_000 });
    await armNativeGuard(Number.POSITIVE_INFINITY);
    expect(removeItem).toHaveBeenCalledWith(KEY);
    expect(_store.has(KEY)).toBe(false);
  });

  it('disarm removes the entry', async () => {
    _store.set(KEY, { lockByMs: Date.now() + 1 });
    await disarmNativeGuard();
    expect(_store.has(KEY)).toBe(false);
  });

  it('evaluate returns false when no entry is persisted', async () => {
    expect(await evaluateNativeGuard()).toBe(false);
  });

  it('evaluate returns false when lockByMs is in the future', async () => {
    _store.set(KEY, { lockByMs: Date.now() + 60_000 });
    expect(await evaluateNativeGuard()).toBe(false);
  });

  it('evaluate returns true when lockByMs has elapsed (bundle-kill scenario)', async () => {
    _store.set(KEY, { lockByMs: Date.now() - 1 });
    expect(await evaluateNativeGuard()).toBe(true);
  });

  it('evaluate returns false when the stored value is malformed', async () => {
    _store.set(KEY, { wrongShape: true });
    expect(await evaluateNativeGuard()).toBe(false);
  });

  it('arm and evaluate compose — a 1ms-arm reads true after a 5ms wait', async () => {
    await armNativeGuard(1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await evaluateNativeGuard()).toBe(true);
  });

  it('storage rejections do not throw — arm path', async () => {
    setItem.mockRejectedValueOnce(new Error('SecureStore denied'));
    await expect(armNativeGuard(60_000)).resolves.toBeUndefined();
  });

  it('storage rejections do not throw — evaluate path (returns false)', async () => {
    getItem.mockRejectedValueOnce(new Error('SecureStore denied'));
    expect(await evaluateNativeGuard()).toBe(false);
  });
});
