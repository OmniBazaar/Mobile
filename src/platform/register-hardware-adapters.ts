/**
 * Lazy hardware-adapter registration.
 *
 * Called the first time the user opens a hardware-wallet flow. Kept
 * out of the cold-start `register-mobile-adapters.ts` path because the
 * native modules (`react-native-ble-plx`, Ledger HID transport) are
 * heavy and not everyone uses hardware wallets.
 *
 * Platform-specific: BLE is registered on iOS + Android; USB-HID is
 * Android-only. Failures from either side are swallowed so a missing
 * native module doesn't break the common case — the adapter itself
 * throws a clear error on first method call instead.
 */

import { Platform } from "react-native";

import {
  registerBLEAdapter,
  registerUSBHIDAdapter,
} from "@wallet/platform/registry";

import { MobileBLEAdapter } from "./MobileBLEAdapter";
import { MobileUSBHIDAdapter } from "./MobileUSBHIDAdapter";

let registered = false;

/**
 * Register every hardware-wallet transport available on the current
 * platform. Idempotent — subsequent calls are no-ops.
 *
 * Trezor is not registered here; it runs via a hosted WebView from
 * `HardwareWalletScreen` and doesn't implement the platform-adapter
 * contract.
 */
export function registerHardwareAdapters(): void {
  if (registered) return;
  registered = true;

  // BLE ships on every platform. The adapter constructor is cheap;
  // the native module itself is lazy-loaded on first `scan`.
  try {
    registerBLEAdapter(new MobileBLEAdapter());
  } catch {
    /* BLE unavailable on this build — adapter methods surface the real error. */
  }

  // USB-HID is Android-only. iOS doesn't expose a HID API; attempting
  // to register would throw at module-load time because the native
  // transport is never linked into the iOS binary.
  if (Platform.OS === "android") {
    try {
      registerUSBHIDAdapter(new MobileUSBHIDAdapter());
    } catch {
      /* @ledgerhq/hw-transport-react-native-hid not installed yet. */
    }
  }
}
