/**
 * Lazy hardware-adapter registration.
 *
 * Called the first time the user opens a hardware-wallet flow. Kept out
 * of the cold-start `register-mobile-adapters.ts` path because the
 * native modules (`react-native-ble-plx` et al) are heavy and not
 * everyone uses hardware wallets.
 */

import { registerBLEAdapter } from '@wallet/platform/registry';

import { MobileBLEAdapter } from './MobileBLEAdapter';

let registered = false;

/**
 * Register every hardware-wallet transport. Idempotent.
 *
 * USB-HID (Ledger USB-C on Android) is intentionally omitted — the
 * official `@ledgerhq/hw-transport-react-native-hid` package is
 * Android-only and requires a prebuild step we haven't landed yet.
 * Ledger Nano X via BLE covers both iOS and Android day one.
 */
export function registerHardwareAdapters(): void {
  if (registered) return;
  registered = true;
  registerBLEAdapter(new MobileBLEAdapter());
}
