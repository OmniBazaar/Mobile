/**
 * MobileNetworkStatusAdapter — Mobile impl of @wallet/platform's
 * NetworkStatusAdapter. Wraps @react-native-community/netinfo.
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { NetworkStatusAdapter } from '@wallet/platform/adapters';

export class MobileNetworkStatusAdapter implements NetworkStatusAdapter {
  /**
   * Read current connectivity state. NetInfo returns `null` for unknown
   * `isConnected`; treat that as "assume online" to match the extension's
   * navigator.onLine default behavior.
   *
   * @returns True when the device believes it has network connectivity.
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected !== false;
  }

  /**
   * Subscribe to connectivity changes.
   * @param handler - Called with `true` when online, `false` when offline.
   * @returns Unsubscribe function.
   */
  onChange(handler: (online: boolean) => void): () => void {
    return NetInfo.addEventListener((state: NetInfoState) => {
      handler(state.isConnected === true);
    });
  }
}
