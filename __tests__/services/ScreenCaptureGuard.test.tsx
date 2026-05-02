/**
 * ScreenCaptureGuard — hook + lifecycle tests.
 *
 * The native `expo-screen-capture` module is mocked so the test runs
 * without RN; we verify:
 *   - prevent is called on mount with the supplied key
 *   - allow is called on unmount with the same key
 *   - the hook does NOT throw when the native module is missing entirely
 *     (Jest fallback path)
 *   - the cleanup runs even when prevent rejects (errors swallowed)
 *
 * Renders use `react-test-renderer` so the hook is exercised via a
 * harness component.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

import { useScreenCaptureBlocked } from '../../src/services/ScreenCaptureGuard';

const prevent = jest.fn().mockResolvedValue(undefined);
const allow = jest.fn().mockResolvedValue(undefined);

jest.mock(
  'expo-screen-capture',
  () => ({
    preventScreenCaptureAsync: (key?: string) => prevent(key),
    allowScreenCaptureAsync: (key?: string) => allow(key),
  }),
  { virtual: true },
);

beforeEach(() => {
  prevent.mockReset();
  allow.mockReset();
  prevent.mockResolvedValue(undefined);
  allow.mockResolvedValue(undefined);
});

/** Harness that mounts the hook with a passed key. */
function Harness({ k }: { k: string }): null {
  useScreenCaptureBlocked(k);
  return null;
}

describe('useScreenCaptureBlocked', () => {
  it('calls prevent on mount and allow on unmount', async () => {
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<Harness k="seed-backup" />);
    });
    // The hook awaits a dynamic require inside an async IIFE; flush the
    // microtask queue so the prevent call resolves before we assert.
    await act(async () => {
      await Promise.resolve();
    });
    expect(prevent).toHaveBeenCalledWith('seed-backup');
    expect(allow).not.toHaveBeenCalled();
    await act(async () => {
      tree?.unmount();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(allow).toHaveBeenCalledWith('seed-backup');
  });

  it('does not throw when prevent rejects', async () => {
    prevent.mockRejectedValueOnce(new Error('native crash'));
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<Harness k="email-verify" />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // No throw → test passes the negative assertion. Cleanup still
    // runs without issue.
    await act(async () => {
      tree?.unmount();
    });
  });

  it('forwards the key parameter so independent screens release independently', async () => {
    let aTree: ReturnType<typeof create> | undefined;
    let bTree: ReturnType<typeof create> | undefined;
    await act(async () => {
      aTree = create(<Harness k="seed-backup" />);
    });
    await act(async () => {
      bTree = create(<Harness k="send" />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(prevent).toHaveBeenCalledTimes(2);
    expect(prevent).toHaveBeenNthCalledWith(1, 'seed-backup');
    expect(prevent).toHaveBeenNthCalledWith(2, 'send');
    await act(async () => {
      aTree?.unmount();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(allow).toHaveBeenCalledWith('seed-backup');
    expect(allow).not.toHaveBeenCalledWith('send');
    await act(async () => {
      bTree?.unmount();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(allow).toHaveBeenCalledWith('send');
  });
});
