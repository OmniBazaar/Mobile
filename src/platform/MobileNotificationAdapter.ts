/**
 * MobileNotificationAdapter — Mobile impl of @wallet/platform's NotificationAdapter.
 *
 * Wraps expo-notifications for local notifications (NOT push — FCM / APNs
 * registration happens at a higher layer so app-level push metadata can
 * be wired in). Notification identifiers returned from scheduleNotificationAsync
 * are opaque strings issued by Expo.
 */

import * as Notifications from 'expo-notifications';
import type { NotificationAdapter } from '@wallet/platform/adapters';

/** onClick subscriptions registered via {@link MobileNotificationAdapter.onClick}. */
type ClickHandler = (id: string, data?: Record<string, string>) => void;

const clickHandlers = new Set<ClickHandler>();
let clickListenerStarted = false;

/**
 * Start the single `addNotificationResponseReceivedListener` subscription
 * that multicasts to every registered handler. Called lazily on the first
 * onClick() registration so the adapter has no boot-time side effects.
 */
function ensureClickListener(): void {
  if (clickListenerStarted) return;
  clickListenerStarted = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.notification.request.identifier;
    const raw = response.notification.request.content.data;
    // expo-notifications types data as `Record<string, any>`; coerce to
    // the narrower `Record<string, string>` the adapter contract exposes.
    const data: Record<string, string> = {};
    if (raw !== null && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === 'string') data[k] = v;
      }
    }
    for (const handler of clickHandlers) {
      try {
        handler(id, data);
      } catch {
        /* handler errors must not kill the listener */
      }
    }
  });
}

export class MobileNotificationAdapter implements NotificationAdapter {
  /**
   * Schedule a local notification to fire immediately. expo-notifications
   * requires a trigger, so we pass `null` — "deliver as soon as possible".
   *
   * @param opts - Notification spec.
   * @returns The Expo-issued identifier used by {@link clear}.
   */
  async create(opts: {
    id?: string;
    title: string;
    body: string;
    iconUrl?: string;
    data?: Record<string, string>;
  }): Promise<string> {
    // expo-notifications assigns its own ID if `identifier` is omitted,
    // but accepting a caller-supplied one keeps behavior parity with the
    // Extension adapter.
    const scheduleArgs: Notifications.NotificationRequestInput = {
      identifier: opts.id,
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
      },
      trigger: null, // deliver immediately
    } as Notifications.NotificationRequestInput;

    return await Notifications.scheduleNotificationAsync(scheduleArgs);
  }

  /**
   * Dismiss a scheduled/delivered notification by identifier.
   * @param id - Expo identifier returned from {@link create}.
   */
  async clear(id: string): Promise<void> {
    try {
      await Notifications.dismissNotificationAsync(id);
    } catch {
      // Some notifications may already be gone; mirror the extension
      // adapter's "no-op on unknown id" contract.
    }
  }

  /**
   * Subscribe to notification-tap events. Returns an unsubscribe function.
   * @param handler - Called with the identifier and optional data payload.
   * @returns Unsubscribe function.
   */
  onClick(handler: ClickHandler): () => void {
    clickHandlers.add(handler);
    ensureClickListener();
    return () => {
      clickHandlers.delete(handler);
    };
  }
}
