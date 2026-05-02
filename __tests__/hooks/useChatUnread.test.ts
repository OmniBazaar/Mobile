/**
 * useChatUnread.test.ts — verifies the hook fetches the initial count,
 * subscribes to the WS channel, and updates count on `unread` events.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

const getUnreadCount = jest.fn();
const subscribe = jest.fn();

jest.mock('@wallet/services/marketplace/ChatClient', () => ({
  getChatClient: () => ({ getUnreadCount, subscribe }),
}));

import { useChatUnread } from '../../src/hooks/useChatUnread';
import { useAuthStore } from '../../src/store/authStore';

let rendered: number | undefined;

function Harness(): React.ReactElement {
  rendered = useChatUnread();
  return React.createElement('text');
}

beforeEach(() => {
  rendered = undefined;
  getUnreadCount.mockReset();
  // Default — the hook calls getUnreadCount on mount + on every WS
  // `message` event. Tests that need a specific value still call
  // mockResolvedValueOnce; this default keeps the secondary calls
  // (triggered by setInterval/WS replay) from returning undefined.
  getUnreadCount.mockResolvedValue(0);
  subscribe.mockReset();
  // Default no-op subscribe — tests that need to capture the callback
  // override with mockImplementationOnce.
  subscribe.mockImplementation(() => () => undefined);
  useAuthStore.setState({ address: '', state: 'signedOut' });
});

describe('useChatUnread', () => {
  it('returns 0 when no address is signed in', async () => {
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(React.createElement(Harness));
    });
    expect(rendered).toBe(0);
    tree?.unmount();
  });

  it('fetches initial count from getUnreadCount and updates state', async () => {
    useAuthStore.setState({ address: '0xabc', state: 'unlocked' });
    getUnreadCount.mockResolvedValueOnce(7);
    subscribe.mockReturnValueOnce(() => undefined);
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(React.createElement(Harness));
    });
    await act(async () => {
      // Two ticks: one for getUnreadCount.then, one for the React state
      // commit.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(rendered).toBe(7);
    tree?.unmount();
  });

  it('updates count on `unread` WS payload', async () => {
    useAuthStore.setState({ address: '0xabc', state: 'unlocked' });
    getUnreadCount.mockResolvedValueOnce(2);
    let captured: ((event: unknown) => void) | undefined;
    subscribe.mockImplementationOnce((_addr: string, cb: (e: unknown) => void) => {
      captured = cb;
      return () => undefined;
    });
    await act(async () => {
      create(React.createElement(Harness));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(rendered).toBe(2);
    await act(async () => {
      captured?.({ type: 'unread', payload: { count: 12 } });
    });
    expect(rendered).toBe(12);
  });

  it('clamps a negative count to 0', async () => {
    useAuthStore.setState({ address: '0xabc', state: 'unlocked' });
    getUnreadCount.mockResolvedValueOnce(0);
    let captured: ((event: unknown) => void) | undefined;
    subscribe.mockImplementationOnce((_addr: string, cb: (e: unknown) => void) => {
      captured = cb;
      return () => undefined;
    });
    await act(async () => {
      create(React.createElement(Harness));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      captured?.({ type: 'unread', payload: { count: -3 } });
    });
    expect(rendered).toBe(0);
  });
});
