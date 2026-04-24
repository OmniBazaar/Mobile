/**
 * Regression guard: Mobile source must not hardcode RPC endpoints.
 *
 * Every chain-RPC URL must come from the shared ClientRPCRegistry +
 * rpc-endpoints.ts in Wallet (imported via @wallet/*). Catches accidental
 * regressions that would force every mobile device to hit one validator
 * instead of public RPCs.
 *
 * Mirrors Wallet/tests/no-hardcoded-rpc-urls.test.ts — the same spirit
 * applies on Mobile: RPC calls originate from the user's device IP,
 * not the validator.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** File extensions to scan. */
const EXTENSIONS = new Set(['.ts', '.tsx']);

/** Directories to skip entirely. */
const SKIP = new Set(['node_modules', 'ios', 'android', '.expo', 'dist']);

/** Mobile source roots — everything under these counts. */
const ROOTS = [
  join(__dirname, '..', '..', 'src'),
  join(__dirname, '..', '..', 'App.tsx'),
];

/** Files exempt from the check (see per-file reason). */
const EXEMPT_FILES = new Set<string>([
  // validatorSeeds.ts when introduced will carry the 5 Hetzner seeds;
  // they're the ONLY allowed hardcoded endpoint list in Mobile.
  'validatorSeeds.ts',
]);

/** Patterns that count as a hardcoded RPC URL. */
const BANNED_PATTERNS: RegExp[] = [
  // Public RPC provider hosts — anything referencing them directly is
  // a bypass of the ClientRPCRegistry failover + circuit-breaker logic.
  /\bhttps?:\/\/[^"'\s]*infura\.io\b/i,
  /\bhttps?:\/\/[^"'\s]*alchemy(api)?\.com\b/i,
  /\bhttps?:\/\/[^"'\s]*quicknode\.com\b/i,
  /\bhttps?:\/\/[^"'\s]*ankr\.com\b/i,
  /\bhttps?:\/\/[^"'\s]*llamarpc\.com\b/i,
  /\bhttps?:\/\/[^"'\s]*publicnode\.com\b/i,
  // Fixed validator IP — ValidatorDiscoveryService's fallback is the
  // only place this may appear in Wallet; Mobile should never reach
  // for it directly.
  /65\.108\.205\.\d{1,3}:3001/,
];

interface Finding {
  file: string;
  line: number;
  snippet: string;
  pattern: string;
}

/**
 * Walk a directory tree recursively, calling `visit` on every .ts/.tsx
 * file we don't skip.
 *
 * @param root - Directory to walk.
 * @param visit - Callback receiving absolute file paths.
 */
function walk(root: string, visit: (filePath: string) => void): void {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return;
  }
  if (!stat.isDirectory()) {
    if (EXTENSIONS.has(root.slice(root.lastIndexOf('.')))) visit(root);
    return;
  }
  for (const entry of readdirSync(root)) {
    if (SKIP.has(entry)) continue;
    const full = join(root, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walk(full, visit);
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      visit(full);
    }
  }
}

describe('no-hardcoded-rpc-urls regression guard', () => {
  it('Mobile source contains no forbidden RPC-host references', () => {
    const findings: Finding[] = [];
    for (const root of ROOTS) {
      walk(root, (file) => {
        const basename = file.slice(file.lastIndexOf('/') + 1);
        if (EXEMPT_FILES.has(basename)) return;
        const contents = readFileSync(file, 'utf8').split(/\r?\n/);
        contents.forEach((line, i) => {
          // Skip lines inside comments — we tolerate commentary / doc mentions
          // of RPC hosts so the code reviewer can explain *why* we avoid them.
          const trimmed = line.trimStart();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
          for (const pattern of BANNED_PATTERNS) {
            if (pattern.test(line)) {
              findings.push({
                file,
                line: i + 1,
                snippet: line.trim().slice(0, 120),
                pattern: pattern.source,
              });
            }
          }
        });
      });
    }
    if (findings.length > 0) {
      const lines = findings.map(
        (f) => `  ${f.file}:${f.line}\n    pattern: ${f.pattern}\n    line: ${f.snippet}`,
      );
      throw new Error(
        `Hardcoded RPC references detected in Mobile source:\n${lines.join('\n')}\n` +
          'Move these behind @wallet/core/providers/ClientRPCRegistry + rpc-endpoints.ts.',
      );
    }
    expect(findings).toEqual([]);
  });
});
