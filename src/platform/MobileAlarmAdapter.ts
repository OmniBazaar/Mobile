/**
 * MobileAlarmAdapter — Mobile impl of @wallet/platform's AlarmAdapter.
 *
 * Alarms map to JavaScript setTimeout for the in-foreground case.
 * Background execution on mobile is severely constrained (iOS especially),
 * so the adapter does NOT try to fire when the app is killed. Services
 * that depend on "always-on" wake-ups (e.g., balance alerts while the
 * app is backgrounded) should use push notifications instead — the push
 * server posts a silent notification at the right time.
 *
 * Callers that persist alarms across app restarts (e.g., auto-lock TTLs)
 * should store their target time separately and re-create the alarm on
 * app boot via {@link MobileAlarmAdapter.create}.
 */

import type { AlarmAdapter } from '@wallet/platform/adapters';

type FireHandler = (name: string) => void;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const handlers = new Set<FireHandler>();

export class MobileAlarmAdapter implements AlarmAdapter {
  /**
   * Schedule a single-fire alarm. Any previously-registered alarm with
   * the same name is cancelled first.
   *
   * @param name - Unique alarm identifier.
   * @param whenMs - Absolute Unix ms when the alarm should fire.
   */
  async create(name: string, whenMs: number): Promise<void> {
    await this.clear(name);
    const delay = Math.max(0, whenMs - Date.now());
    const handle = setTimeout(() => {
      timers.delete(name);
      for (const handler of handlers) {
        try {
          handler(name);
        } catch {
          /* handlers must not kill the loop */
        }
      }
    }, delay);
    timers.set(name, handle);
  }

  /**
   * Cancel a pending alarm. No-op if no alarm with the given name exists.
   * @param name - Alarm identifier.
   */
  async clear(name: string): Promise<void> {
    const existing = timers.get(name);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.delete(name);
    }
  }

  /**
   * Subscribe to alarm-fire events. Returns an unsubscribe function.
   * @param handler - Receives the alarm name.
   * @returns Unsubscribe function.
   */
  onFire(handler: FireHandler): () => void {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }
}
