/**
 * Babel config — runs locally and on EAS Build's cloud worker.
 *
 * The `@wallet/*` + `@webapp/*` aliases prefer `.bundled/{wallet,webapp}/src`
 * when the snapshot directory exists (populated by
 * `scripts/bundle-shared.mjs` before any EAS upload). On a developer
 * machine where the snapshot may not exist, they fall back to the
 * sibling repos' live sources via `../Wallet/src` and `../WebApp/src`.
 *
 * Keep this file in lock-step with `metro.config.js` — both layers
 * resolve aliases independently.
 */
const fs = require('fs');
const path = require('path');

const bundledWallet = path.resolve(__dirname, '.bundled', 'wallet', 'src');
const bundledWebApp = path.resolve(__dirname, '.bundled', 'webapp', 'src');
const walletAlias = fs.existsSync(bundledWallet) ? './.bundled/wallet/src' : '../Wallet/src';
const webappAlias = fs.existsSync(bundledWebApp) ? './.bundled/webapp/src' : '../WebApp/src';

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-reanimated/plugin'],
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@services': './src/services',
            '@store': './src/store',
            '@native': './src/native',
            '@theme': './src/theme',
            '@utils': './src/utils',
            '@assets': './assets',
            '@shared': '../shared',
            // See bundled-vs-sibling fallback above.
            '@wallet': walletAlias,
            '@webapp': webappAlias,
            // Node core polyfills. Metro silently auto-stubs Node-core
            // requires (crypto, stream) BEFORE its own extraNodeModules
            // check runs, so neither `extraNodeModules` nor the resolver
            // hook in metro.config.js intercept them. babel-plugin-
            // module-resolver runs at TRANSFORM time, rewriting the
            // require() literal before Metro ever sees it. Without this,
            // ethers v6's CJS `var crypto_1 = require("crypto")` reads
            // an empty stub on Hermes and `crypto_1.pbkdf2Sync` is
            // undefined → "undefined is not a function" at the first
            // call site (Mnemonic.computeSeed / HDNodeWallet.fromSeed).
            crypto: 'crypto-browserify',
            stream: 'stream-browserify',
          },
        },
      ],
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};
