/**
 * Metro bundler configuration — monorepo-aware.
 *
 * Mobile imports from Wallet/src/* and WebApp/src/* via the `@wallet/*` and
 * `@webapp/*` path aliases declared in both babel.config.js and tsconfig.json.
 * For Metro to actually resolve those alias targets at bundle time we have
 * to:
 *   1. Watch the parent OmniBazaar/ directory so file changes in siblings
 *      trigger rebuilds here.
 *   2. Include sibling `node_modules/` directories on the resolver path so
 *      Wallet's + WebApp's deps (ethers, zustand, i18next, etc.) resolve
 *      whether Mobile or the sibling installed them.
 *   3. Map the `@wallet` / `@webapp` aliases in `extraNodeModules` so Metro
 *      recognizes them even if babel-plugin-module-resolver isn't active
 *      during the Metro transform pass.
 *
 * See Validator/ADD_MOBILE_APP.md Phase 0 for the overall approach.
 */

const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const parentRoot = path.resolve(projectRoot, '..');

// `.bundled/` is populated by `scripts/bundle-shared.mjs` before any
// EAS upload — see ADD_MOBILE_APP.md Phase 0. When the bundled snapshot
// exists, it's the source of truth (this is what runs on EAS where
// the sibling repos aren't uploaded). When it doesn't, fall back to
// the live sibling sources for local Metro dev.
const bundledWallet = path.resolve(projectRoot, '.bundled', 'wallet', 'src');
const bundledWebApp = path.resolve(projectRoot, '.bundled', 'webapp', 'src');
const walletSrc = fs.existsSync(bundledWallet)
  ? bundledWallet
  : path.resolve(parentRoot, 'Wallet', 'src');
const webappSrc = fs.existsSync(bundledWebApp)
  ? bundledWebApp
  : path.resolve(parentRoot, 'WebApp', 'src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [parentRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(parentRoot, 'Wallet', 'node_modules'),
  path.resolve(parentRoot, 'WebApp', 'node_modules'),
  path.resolve(parentRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  '@wallet': walletSrc,
  '@webapp': webappSrc,
};

// Module aliases that must take effect at resolve time, not transform
// time. Two cases here:
//
//   1. Bare-specifier `util` → `./util-shim.js`. The bundled `util`
//      polyfill (npm `util` 0.12.5) does NOT export TextDecoder /
//      TextEncoder, but several chain SDKs (Cardano, others) do
//      `const { TextDecoder, TextEncoder } = require('util')` at
//      module-eval and immediately `new TextDecoder(...)`. The
//      destructured `undefined` crashed the bundle on Pixel 7 Pro
//      (Android 14) at top-level eval — same root cause as the
//      Wallet MV3 SW status-15 crash we shipped a util-shim for.
//      The regex anchors `^util$` so nested paths like
//      `util/util.js` (which our shim itself imports) still
//      resolve through node_modules.
//
//   2. `@emurgo/cardano-serialization-lib-nodejs` → local stub. The
//      Cardano SDK is a WebAssembly module; Hermes (RN 0.73) does
//      not support WASM in any form — neither the `-nodejs` variant
//      (uses `fs.readFileSync`) nor the `-browser` variant (uses
//      `import.meta.url + fetch`) can ever run here. The lib is
//      loaded transitively by familyAddressDerivation at module-eval,
//      so without a stub it crashes the boot. Mobile V1 has no
//      Cardano UX, so a stub that throws on use is the right
//      no-functionality-loss escape hatch.
const utilShimPath = path.resolve(projectRoot, 'util-shim.js');
const cardanoStubPath = path.resolve(projectRoot, 'stubs', 'cardano-stub.js');
const CARDANO_NODEJS = '@emurgo/cardano-serialization-lib-nodejs';

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'util') {
    return { type: 'sourceFile', filePath: utilShimPath };
  }
  if (moduleName === CARDANO_NODEJS || moduleName.startsWith(`${CARDANO_NODEJS}/`)) {
    return { type: 'sourceFile', filePath: cardanoStubPath };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
