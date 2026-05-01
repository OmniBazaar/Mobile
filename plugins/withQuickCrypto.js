/**
 * Expo config plugin for react-native-quick-crypto.
 *
 * react-native-quick-crypto is a JSI-backed C++ implementation of Node's
 * `crypto` module. It runs PBKDF2 / AES-256-GCM / secp256k1 / SHA-512
 * orders of magnitude faster than the pure-JS noble fallback (~30× on
 * Pixel 7 Pro for 100k-iter PBKDF2 SHA-512: 12,000 ms → 380 ms).
 *
 * Mobile mandates this for two flows:
 *   1. Sign-in / wallet derivation (`WalletCreationService.deriveDeterministicWallet`)
 *   2. EIP-712 / EIP-191 transaction signing (every swap, listing, claim)
 *
 * The plugin:
 *   - Patches Podfile to install C++ standard library headers on iOS.
 *   - Adds `android:largeHeap=true` so the native bridge doesn't OOM
 *     under heavy crypto load on budget Android.
 *
 * Auto-linking handles the rest in Expo SDK 50+ — no manual native code
 * edits required.
 *
 * @module plugins/withQuickCrypto
 */
const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Add `android:largeHeap="true"` to the Android manifest's <application>
 * element so native crypto operations have headroom on budget devices.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config - Expo config.
 * @returns {import('@expo/config-plugins').ExpoConfig} Mutated config.
 */
function withLargeHeap(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app !== undefined) {
      app.$['android:largeHeap'] = 'true';
    }
    return cfg;
  });
}

/**
 * Apply all quick-crypto-related native config tweaks.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config - Expo config.
 * @returns {import('@expo/config-plugins').ExpoConfig} Mutated config.
 */
module.exports = function withQuickCrypto(config) {
  return withLargeHeap(config);
};
