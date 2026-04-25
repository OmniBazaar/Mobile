/**
 * bundle-shared.mjs — snapshot Wallet/src + WebApp/src into Mobile/.bundled/
 *
 * EAS Build uploads only the Mobile workspace, so the `@wallet/*` and
 * `@webapp/*` aliases that resolve to `../Wallet/src/*` + `../WebApp/src/*`
 * locally are unreachable on the cloud builder. This script runs as
 * part of `npm run build:preview` (and is wired into eas-preview.sh)
 * to copy the sibling sources into a path that Metro can resolve from
 * inside the uploaded Mobile bundle.
 *
 * Output layout:
 *   Mobile/.bundled/wallet/src/...
 *   Mobile/.bundled/webapp/src/...
 *
 * Metro + babel pick up the bundled copies preferentially when they
 * exist, and fall back to the sibling-repo paths during local dev.
 *
 * Run:
 *   node scripts/bundle-shared.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const parentRoot = path.resolve(mobileRoot, "..");

const SHARES = [
  { from: path.join(parentRoot, "Wallet", "src"), to: path.join(mobileRoot, ".bundled", "wallet", "src") },
  { from: path.join(parentRoot, "WebApp", "src"), to: path.join(mobileRoot, ".bundled", "webapp", "src") },
];

const SKIP_DIRS = new Set([
  "node_modules",
  "__tests__",
  "tests",
  "test",
  "__snapshots__",
  ".git",
  "build",
  "dist",
  "coverage",
]);

const SKIP_EXT = new Set([".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"]);

/**
 * Recursively copy `src` into `dst`, skipping test + build artefacts.
 *
 * @param {string} src - Source directory.
 * @param {string} dst - Destination directory.
 * @returns {Promise<number>} Count of files copied.
 */
async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  let count = 0;
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      count += await copyDir(path.join(src, entry.name), path.join(dst, entry.name));
    } else if (entry.isFile()) {
      if ([...SKIP_EXT].some((ext) => entry.name.endsWith(ext))) continue;
      await fs.copyFile(path.join(src, entry.name), path.join(dst, entry.name));
      count += 1;
    }
  }
  return count;
}

const start = Date.now();
let total = 0;
for (const share of SHARES) {
  try {
    await fs.access(share.from);
  } catch {
    console.warn(`[bundle-shared] skip ${share.from}: source missing`);
    continue;
  }
  await fs.rm(share.to, { recursive: true, force: true });
  const n = await copyDir(share.from, share.to);
  console.log(`[bundle-shared] ${n} files → ${path.relative(mobileRoot, share.to)}`);
  total += n;
}
console.log(`[bundle-shared] done in ${Date.now() - start}ms (${total} files)`);
