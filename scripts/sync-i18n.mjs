#!/usr/bin/env node
/**
 * sync-i18n — Mirror the Wallet extension's i18n locale JSON into Mobile.
 *
 * Wallet is the canonical source of OmniBazaar's translation corpus
 * (10 locales: en, es, fr, de, it, pt, zh, ja, ko, ru). Mobile tracks
 * that corpus by copying the JSON from `../Wallet/src/i18n/locales/`
 * into `./src/i18n/locales/`. Mirrors the pattern that originally
 * brought the locales from WebApp into Wallet.
 *
 * Namespaces:
 *   - translation.json   — shared with WebApp
 *   - wallet-popup.json  — extension-specific (keys may be reused in
 *                          Mobile screens for parity; missing keys will
 *                          fall back to English at render time)
 *
 * Usage:
 *   node Mobile/scripts/sync-i18n.mjs
 *   OR from Mobile/ directly:  npm run sync:i18n
 *
 * Exit codes:
 *   0 — success (all 10 locales copied)
 *   1 — source directory missing
 *   2 — fs error copying a file
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WALLET_LOCALES = resolve(__dirname, '..', '..', 'Wallet', 'src', 'i18n', 'locales');
const MOBILE_LOCALES = resolve(__dirname, '..', 'src', 'i18n', 'locales');

const EXPECTED_LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ru'];

if (!existsSync(WALLET_LOCALES)) {
  console.error(`[sync-i18n] source missing: ${WALLET_LOCALES}`);
  console.error('  Is this a fresh clone?  Check `git submodule update` or fetch the Wallet repo.');
  process.exit(1);
}

if (!existsSync(MOBILE_LOCALES)) {
  mkdirSync(MOBILE_LOCALES, { recursive: true });
}

const sourceLocales = readdirSync(WALLET_LOCALES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let copied = 0;
let skipped = 0;

for (const locale of sourceLocales) {
  const src = resolve(WALLET_LOCALES, locale);
  const dst = resolve(MOBILE_LOCALES, locale);
  try {
    cpSync(src, dst, { recursive: true, force: true });
    copied += 1;
  } catch (err) {
    console.error(`[sync-i18n] failed to copy ${locale}:`, err.message ?? err);
    process.exit(2);
  }
}

const missing = EXPECTED_LOCALES.filter((l) => !sourceLocales.includes(l));
if (missing.length > 0) {
  console.warn(`[sync-i18n] upstream is missing locales: ${missing.join(', ')}`);
  console.warn('  Mobile will fall back to English for those languages at runtime.');
}

const extras = sourceLocales.filter((l) => !EXPECTED_LOCALES.includes(l));
if (extras.length > 0) {
  console.log(`[sync-i18n] also copied extras not in the expected list: ${extras.join(', ')}`);
}

console.log(`[sync-i18n] ${copied} locale(s) copied into Mobile/src/i18n/locales (${skipped} skipped).`);
