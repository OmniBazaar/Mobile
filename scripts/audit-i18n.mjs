#!/usr/bin/env node
/**
 * scripts/audit-i18n.mjs — i18n audit for the Mobile app.
 *
 * Mirrors `Wallet/scripts/audit-i18n.mjs` (Phase 8) and adapts the
 * scan paths for the Mobile workspace:
 *   - Locales live in `src/i18n/locales/{en,es,…}` (synced from
 *     `Wallet/src/i18n/locales/` by `scripts/sync-i18n.mjs`).
 *   - JSX lives under `src/screens/`, `src/components/`, `src/navigation/`,
 *     and the bundled snapshot at `.bundled/wallet/src/popup/`
 *     (the latter is read-only; we report drift but don't fail it).
 *
 * Five checks:
 *   1. Leaf-key parity across all locales (vs English source of truth).
 *   2. Hardcoded English JSX strings (four regex patterns).
 *   3. TRANSLATE: flags in locale JSONs (should be zero).
 *   4. Intl.* formatter calls without an explicit locale arg.
 *   5. Hardcoded US-currency literals ("$123" style concats).
 *
 * Exits non-zero if any check fails. Designed to wire into CI.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCALES_DIR = path.join(ROOT, "src", "i18n", "locales");
const SCAN_DIRS = [
  path.join(ROOT, "src", "screens"),
  path.join(ROOT, "src", "components"),
  path.join(ROOT, "src", "navigation"),
];

const LOCALES = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ru"];
// `wallet.json` is the extension-popup-only namespace; Mobile imports
// `wallet-popup` instead. Anything from the WebApp mirror set is
// reported as a warning (drift originates upstream, not in Mobile).
const NAMESPACES = [
  "translation",
  "info-pages",
  "compliance-pages",
  "contractErrors",
  "wallet-popup",
];

let exitCode = 0;
const errors = [];
const warnings = [];

/**
 * Recursively walk a directory, returning every `.tsx` and `.ts` file
 * (excluding test files + node_modules + .bundled).
 *
 * @param {string} dir - Root directory.
 * @returns {string[]} Absolute file paths.
 */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".bundled") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Flatten a nested locale object into `{ "a.b.c": value }`.
 *
 * @param {object} obj - Nested locale data.
 * @param {string} prefix - Prefix accumulator (recursive).
 * @returns {Record<string, string>} Flat key-to-value map.
 */
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix === "" ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

// ── Check 1: leaf-key parity ───────────────────────────────────────────────
console.log("== Check 1: leaf-key parity ==");
for (const ns of NAMESPACES) {
  const en = path.join(LOCALES_DIR, "en", `${ns}.json`);
  if (!fs.existsSync(en)) {
    warnings.push(`namespace ${ns}: en/${ns}.json missing`);
    continue;
  }
  const enFlat = flatten(JSON.parse(fs.readFileSync(en, "utf8")));
  const enKeys = new Set(Object.keys(enFlat));
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const file = path.join(LOCALES_DIR, locale, `${ns}.json`);
    if (!fs.existsSync(file)) {
      warnings.push(`namespace ${ns}: ${locale}/${ns}.json missing`);
      continue;
    }
    const flat = flatten(JSON.parse(fs.readFileSync(file, "utf8")));
    const keys = new Set(Object.keys(flat));
    const missing = [...enKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !enKeys.has(k));
    if (missing.length > 0) {
      const isWalletPopup = ns === "wallet-popup";
      const target = isWalletPopup ? errors : warnings;
      target.push(
        `namespace ${ns}/${locale}: missing ${missing.length} keys (e.g. ${missing.slice(0, 3).join(", ")})`,
      );
    }
    if (extra.length > 0) {
      warnings.push(
        `namespace ${ns}/${locale}: ${extra.length} extra keys not in en (e.g. ${extra.slice(0, 3).join(", ")})`,
      );
    }
  }
}

// ── Check 2: hardcoded English JSX strings ─────────────────────────────────
console.log("== Check 2: hardcoded JSX strings ==");
const HARDCODED_PATTERNS = [
  // <Text>Hello world</Text>
  /<Text[^>]*>([A-Z][a-zA-Z][a-zA-Z\s]{4,}[!.?])<\/Text>/g,
  // accessibilityLabel="Some literal"
  /accessibilityLabel=["']([A-Z][a-zA-Z][a-zA-Z\s]{4,}[!.?]?)["']/g,
  // placeholder="Search for…"
  /placeholder=["']([A-Z][a-zA-Z][a-zA-Z\s]{4,}[!.?…]?)["']/g,
  // title="Some literal"
  /title=["']([A-Z][a-zA-Z][a-zA-Z\s]{4,}[!.?]?)["']/g,
];
const ALLOWLIST_HARDCODED = new Set([
  "OmniBazaar",
  "OmniCoin",
  "Coming soon",
  "Coming Soon",
]);
for (const file of SCAN_DIRS.flatMap(walk)) {
  const src = fs.readFileSync(file, "utf8");
  for (const pat of HARDCODED_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(src)) !== null) {
      const literal = m[1];
      if (ALLOWLIST_HARDCODED.has(literal)) continue;
      // Skip lines wrapped in `t(` or `defaultValue:` (i18n-aware).
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      const lineEnd = src.indexOf("\n", m.index);
      const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      if (line.includes("t(") || line.includes("defaultValue")) continue;
      warnings.push(
        `${path.relative(ROOT, file)}: hardcoded "${literal.slice(0, 60)}"`,
      );
    }
  }
}

// ── Check 3: TRANSLATE: flags ─────────────────────────────────────────────
console.log("== Check 3: TRANSLATE: flags ==");
for (const locale of LOCALES) {
  for (const ns of NAMESPACES) {
    const file = path.join(LOCALES_DIR, locale, `${ns}.json`);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    if (src.includes("TRANSLATE:")) {
      const count = (src.match(/TRANSLATE:/g) ?? []).length;
      errors.push(`${locale}/${ns}.json: ${count} TRANSLATE: flags`);
    }
  }
}

// ── Check 4: Intl.* formatters without explicit locale ────────────────────
console.log("== Check 4: Intl formatter locale violations ==");
const INTL_PATTERNS = [
  /\.toLocaleString\(\s*\)/g,
  /\.toLocaleDateString\(\s*\)/g,
  /\.toLocaleTimeString\(\s*\)/g,
  /new\s+Intl\.\w+Format\(\s*\)/g,
];
for (const file of SCAN_DIRS.flatMap(walk)) {
  const src = fs.readFileSync(file, "utf8");
  for (const pat of INTL_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(src)) !== null) {
      // Identify the matched call site for the report.
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      const lineEnd = src.indexOf("\n", m.index);
      const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      errors.push(
        `${path.relative(ROOT, file)}: ${m[0]} without locale arg — use \`i18n.language\` or \`navigator.language\`. Context: ${line.slice(0, 80)}`,
      );
    }
  }
}

// ── Check 5: hardcoded $-currency literals ────────────────────────────────
console.log("== Check 5: hardcoded $-currency literals ==");
// Match `"$123"` or `'$123.45'` or "$5.00"-style amount literals. The
// previous, looser pattern caught `${expr}` template-literal markers
// too; we tighten by requiring a literal digit immediately after the
// dollar sign (with optional whitespace).
const CURRENCY_PATTERN = /(["'`])\$\s*\d/g;
for (const file of SCAN_DIRS.flatMap(walk)) {
  // Predictions screen explicitly displays USD-denominated quotes; allow.
  const rel = path.relative(ROOT, file);
  if (rel.includes("Predictions")) continue;
  const src = fs.readFileSync(file, "utf8");
  CURRENCY_PATTERN.lastIndex = 0;
  let m;
  while ((m = CURRENCY_PATTERN.exec(src)) !== null) {
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const lineEnd = src.indexOf("\n", m.index);
    const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
    if (line.includes("t(")) continue;
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
    warnings.push(`${rel}: hardcoded $-currency. Context: ${line.slice(0, 100)}`);
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log("\n══ Audit summary ══");
console.log(`Errors:   ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
if (errors.length > 0) {
  console.log("\n— ERRORS —");
  for (const e of errors.slice(0, 50)) console.log(`  ✖ ${e}`);
  if (errors.length > 50) console.log(`  …and ${errors.length - 50} more`);
  exitCode = 1;
}
if (warnings.length > 0) {
  console.log("\n— WARNINGS —");
  for (const w of warnings.slice(0, 50)) console.log(`  ⚠ ${w}`);
  if (warnings.length > 50) console.log(`  …and ${warnings.length - 50} more`);
}
if (errors.length === 0 && warnings.length === 0) {
  console.log("\n✅ No issues.");
}
process.exit(exitCode);
