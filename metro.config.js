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

// Don't let duplicate React instances slip in from sibling node_modules
// — force every import to resolve from Mobile's own tree.
config.resolver.resolveRequest = undefined;

module.exports = config;
