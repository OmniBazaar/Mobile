/**
 * MobileMessagingAdapter — Mobile impl of @wallet/platform's MessagingAdapter.
 *
 * In the browser extension, `chrome.runtime.sendMessage` / `onMessage`
 * shuttle messages between the popup, content scripts, and the service
 * worker — three separate JS realms. On Mobile everything runs in the
 * single React Native JS realm, so this adapter implements the same
 * contract using an in-process event emitter.
 *
 * The envelope semantics (channel + payload, optional async reply) are
 * preserved so code that was written against the Extension adapter works
 * unchanged when imported on Mobile.
 */

import type { MessagingAdapter } from '@wallet/platform/adapters';

type Handler<TRequest, TResponse> = (
  message: TRequest,
) => TResponse | Promise<TResponse> | undefined;

const channels = new Map<string, Set<Handler<unknown, unknown>>>();

export class MobileMessagingAdapter implements MessagingAdapter {
  /**
   * Dispatch a message to the first handler registered on `channel` that
   * returns something non-undefined. Additional handlers still fire — this
   * mirrors the Extension behavior where the first handler to call
   * `sendResponse` wins but every listener still sees the message.
   *
   * @param channel - Channel name.
   * @param message - Payload.
   * @returns Handler's response, or undefined if no handler produced one.
   */
  async send<TRequest = unknown, TResponse = unknown>(
    channel: string,
    message: TRequest,
  ): Promise<TResponse | undefined> {
    const handlers = channels.get(channel);
    if (handlers === undefined || handlers.size === 0) return undefined;
    let firstResponse: TResponse | undefined;
    for (const h of handlers) {
      const result = (h as Handler<TRequest, TResponse>)(message);
      if (result === undefined) continue;
      const resolved = result instanceof Promise ? await result : result;
      if (firstResponse === undefined) {
        firstResponse = resolved;
      }
    }
    return firstResponse;
  }

  /**
   * Register a handler on `channel`. Returns an unsubscribe function.
   * @param channel - Channel name.
   * @param handler - Handler that may return a reply (sync or Promise).
   * @returns Unsubscribe function.
   */
  receive<TRequest = unknown, TResponse = unknown>(
    channel: string,
    handler: Handler<TRequest, TResponse>,
  ): () => void {
    let set = channels.get(channel);
    if (set === undefined) {
      set = new Set<Handler<unknown, unknown>>();
      channels.set(channel, set);
    }
    set.add(handler as Handler<unknown, unknown>);
    return () => {
      set!.delete(handler as Handler<unknown, unknown>);
      if (set!.size === 0) channels.delete(channel);
    };
  }
}
