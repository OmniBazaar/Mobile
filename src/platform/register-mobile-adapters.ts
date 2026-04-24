/**
 * Mobile platform-adapter registration.
 *
 * Mirrors `Wallet/src/platform/register-defaults.ts` (the Extension's
 * equivalent). Called exactly once from `Mobile/App.tsx` (or the
 * `_layout.tsx` route root) before any code paths that call
 * `getStorageAdapter()` / `getNotificationAdapter()` etc.
 *
 * Camera, BLE, and USB-HID adapters are NOT registered here because
 * those are lazy-loaded on first use — they pull in heavy native
 * dependencies (`expo-camera`, `react-native-ble-plx`,
 * `react-native-hid`) that we don't want in the cold-start path.
 * The Phase 6 (Hardware Wallets) work registers them when the user
 * first opens the hardware-sign screen.
 */

import {
  registerAlarmAdapter,
  registerBiometricAdapter,
  registerMessagingAdapter,
  registerNetworkStatusAdapter,
  registerNotificationAdapter,
  registerRuntimeAdapter,
  registerStorageAdapter,
  registerTabsAdapter,
} from '@wallet/platform/registry';

import { MobileAlarmAdapter } from './MobileAlarmAdapter';
import { MobileBiometricAdapter } from './MobileBiometricAdapter';
import { MobileMessagingAdapter } from './MobileMessagingAdapter';
import { MobileNetworkStatusAdapter } from './MobileNetworkStatusAdapter';
import { MobileNotificationAdapter } from './MobileNotificationAdapter';
import { MobileRuntimeAdapter } from './MobileRuntimeAdapter';
import { MobileTabsAdapter } from './MobileTabsAdapter';
import { SecureStoreAdapter } from './SecureStoreAdapter';

let registered = false;

/**
 * Register every Mobile platform adapter. Safe to call more than once;
 * subsequent calls are no-ops. Should be invoked once at Mobile app
 * boot before any service module is imported.
 */
export function registerMobileAdapters(): void {
  if (registered) return;
  registered = true;

  registerStorageAdapter(new SecureStoreAdapter());
  registerNotificationAdapter(new MobileNotificationAdapter());
  registerAlarmAdapter(new MobileAlarmAdapter());
  registerMessagingAdapter(new MobileMessagingAdapter());
  registerTabsAdapter(new MobileTabsAdapter());
  registerRuntimeAdapter(new MobileRuntimeAdapter());
  registerNetworkStatusAdapter(new MobileNetworkStatusAdapter());
  registerBiometricAdapter(new MobileBiometricAdapter());
}
