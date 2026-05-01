/**
 * useChatUnread — React hook that exposes the live unread chat count.
 *
 * Initial fetch comes from `ChatClient.getUnreadCount(address)`, then
 * the hook subscribes to the `chat` WS channel and re-fetches when the
 * server sends an `unread` delta. Cheap re-fetch is fine: the endpoint
 * returns a single integer and the user typically has <50 threads.
 *
 * @module hooks/useChatUnread
 */

import { useEffect, useState } from 'react';

import { getChatClient } from '@wallet/services/marketplace/ChatClient';
import { useAuthStore } from '../store/authStore';

/**
 * Returns the current unread chat count for the signed-in user. Returns
 * 0 when the user is signed out / in guest mode.
 *
 * @returns Live unread count.
 */
export function useChatUnread(): number {
  const address = useAuthStore((s) => s.address);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (address === '') {
      setCount(0);
      return;
    }
    let cancelled = false;
    void getChatClient()
      .getUnreadCount(address)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        /* validator may not yet be reachable — show 0 */
      });
    const unsub = getChatClient().subscribe(address, (event) => {
      if (event.type === 'unread') {
        const payload = event.payload as { count?: number } | undefined;
        if (payload !== undefined && typeof payload.count === 'number') {
          if (!cancelled) setCount(Math.max(0, payload.count));
          return;
        }
      }
      if (event.type === 'message') {
        // Pull a fresh aggregate — message frames don't include the
        // updated total.
        void getChatClient()
          .getUnreadCount(address)
          .then((n) => {
            if (!cancelled) setCount(n);
          })
          .catch(() => {
            /* ignore — keep last known value */
          });
      }
    });
    return (): void => {
      cancelled = true;
      unsub();
    };
  }, [address]);

  return count;
}
