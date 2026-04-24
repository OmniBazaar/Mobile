/**
 * MobileBiometricAdapter — Mobile impl of @wallet/platform's BiometricAdapter.
 *
 * Wraps expo-local-authentication. `authenticate()` prompts with the
 * strongest device-supported biometric (FaceID / TouchID / Fingerprint)
 * and falls back to the device passcode automatically if the user
 * cancels biometric or biometric isn't enrolled.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import type { BiometricAdapter } from '@wallet/platform/adapters';

export class MobileBiometricAdapter implements BiometricAdapter {
  /**
   * True when the device has biometric hardware AND at least one
   * biometric is enrolled. Returns false on emulators that have
   * hardware but no enrolled finger / face.
   *
   * @returns Availability flag.
   */
  async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  }

  /**
   * Prompt the user to authenticate.
   * Resolves:
   *   - `true` on successful biometric or passcode entry,
   *   - `false` on user cancel,
   * and rejects only on unrecoverable hardware errors.
   *
   * @param reason - Message shown in the native prompt.
   * @returns Success flag.
   */
  async authenticate(reason: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false,
      fallbackLabel: '',
    });
    return result.success;
  }
}
