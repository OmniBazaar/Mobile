/**
 * RequireAuth.test.tsx — three-branch lifecycle coverage.
 *
 *   - unlocked → callback runs synchronously, no nav.
 *   - locked   → unlock-guard is enqueued, no nav.
 *   - guest / signedOut / bootstrapping → AuthPrompt nav.
 *
 * @react-navigation/native is mocked so we can spy on `nav.navigate`
 * without bootstrapping a real navigator.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

const navigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate }),
}));

import { useRequireAuth } from '../../src/components/RequireAuth';
import { useAuthStore } from '../../src/store/authStore';
import { useUnlockGuardStore } from '../../src/store/unlockGuardStore';

let invoke: ((reason: string, action: () => void, intended?: string, key?: string) => void) | undefined;

function Harness(): null {
  invoke = useRequireAuth();
  return null;
}

beforeEach(() => {
  navigate.mockReset();
  invoke = undefined;
  useAuthStore.setState({ state: 'signedOut', address: '', mnemonic: '', familyAddresses: {} });
  useUnlockGuardStore.setState({ pending: null });
});

describe('useRequireAuth', () => {
  it('runs the callback synchronously when state === unlocked', async () => {
    useAuthStore.setState({ state: 'unlocked', address: '0xabc', mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' });
    await act(async () => {
      create(<Harness />);
    });
    const action = jest.fn();
    act(() => {
      invoke?.('reason', action, 'route', 'buy');
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(useUnlockGuardStore.getState().pending).toBeNull();
  });

  it('enqueues an unlock-guard when state === locked (no nav, no run)', async () => {
    useAuthStore.setState({ state: 'locked' });
    await act(async () => {
      create(<Harness />);
    });
    const action = jest.fn();
    act(() => {
      invoke?.('reason', action, 'route', 'buy');
    });
    expect(action).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    const pending = useUnlockGuardStore.getState().pending;
    expect(pending).not.toBeNull();
    expect(pending?.actionKey).toBe('buy');
    // The pending action should be the supplied callback — when the
    // UnlockSheet resolves with success it will invoke it.
    pending?.run();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('routes to AuthPrompt when state === guest', async () => {
    useAuthStore.setState({ state: 'guest' });
    await act(async () => {
      create(<Harness />);
    });
    const action = jest.fn();
    act(() => {
      invoke?.('Sign in to buy', action, '/shop/listing/123', 'buy');
    });
    expect(action).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    const [route, params] = navigate.mock.calls[0] as [string, Record<string, unknown>];
    expect(route).toBe('AuthPrompt');
    expect(params['reason']).toBe('Sign in to buy');
    expect(params['intendedRoute']).toBe('/shop/listing/123');
  });

  it('routes to AuthPrompt when state === signedOut', async () => {
    useAuthStore.setState({ state: 'signedOut' });
    await act(async () => {
      create(<Harness />);
    });
    act(() => {
      invoke?.('reason', jest.fn());
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect((navigate.mock.calls[0]?.[0] as string)).toBe('AuthPrompt');
  });

  it('routes to AuthPrompt when state === bootstrapping (cold-start gate)', async () => {
    useAuthStore.setState({ state: 'bootstrapping' });
    await act(async () => {
      create(<Harness />);
    });
    act(() => {
      invoke?.('reason', jest.fn());
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect((navigate.mock.calls[0]?.[0] as string)).toBe('AuthPrompt');
  });

  it('omits intendedRoute from navigate params when not supplied (guest path)', async () => {
    useAuthStore.setState({ state: 'guest' });
    await act(async () => {
      create(<Harness />);
    });
    act(() => {
      invoke?.('reason', jest.fn());
    });
    const [, params] = navigate.mock.calls[0] as [string, Record<string, unknown>];
    expect(params['intendedRoute']).toBeUndefined();
  });

  it('default actionKey is "default" when caller omits it (locked path)', async () => {
    useAuthStore.setState({ state: 'locked' });
    await act(async () => {
      create(<Harness />);
    });
    act(() => {
      invoke?.('reason', jest.fn());
    });
    expect(useUnlockGuardStore.getState().pending?.actionKey).toBe('default');
  });
});
