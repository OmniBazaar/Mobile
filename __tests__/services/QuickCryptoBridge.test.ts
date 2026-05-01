/**
 * QuickCryptoBridge — fallback / availability test.
 *
 * The Jest run does NOT have `react-native-quick-crypto` installed
 * (it's a native module), so `isQuickCryptoAvailable()` should be
 * `false` and `nativePbkdf2Sha512Sync` should throw with a clear
 * actionable error when called directly. Production builds carry the
 * native module and the deterministic-derivation path uses it
 * automatically — see `WalletCreationService.deriveDeterministicWallet`.
 */

import { isQuickCryptoAvailable, nativePbkdf2Sha512Sync, installQuickCrypto } from '../../src/services/QuickCryptoBridge';

describe('QuickCryptoBridge', () => {
  it('reports the bridge as unavailable in a Jest environment', () => {
    expect(isQuickCryptoAvailable()).toBe(false);
  });

  it('throws an actionable error when nativePbkdf2Sha512Sync is called without the bridge', () => {
    const password = new TextEncoder().encode('hunter2');
    const salt = new TextEncoder().encode('alice');
    expect(() => nativePbkdf2Sha512Sync(password, salt, 100_000, 32)).toThrow(/native bridge not loaded/);
  });

  it('installQuickCrypto is a no-op (does not throw) when the native module is absent', () => {
    expect(() => installQuickCrypto()).not.toThrow();
  });
});
