/**
 * compose-feature-graphic.mjs — Google Play feature graphic 1024×500.
 *
 * Composes the OmniBazaar globe (left half) + the OmniCoin wordmark
 * (right half) on a `#1a1a1a` brand background. Output goes to
 * `Mobile/store-assets/google-play-feature-graphic-1024x500.png`.
 *
 * Designer can replace later; this placeholder is store-listing-
 * acceptable so we can submit before custom artwork lands.
 *
 * Run:  node scripts/compose-feature-graphic.mjs
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..");

const requireFromMobile = createRequire(import.meta.url);
const sharp = requireFromMobile(path.join(repoRoot, "node_modules", "sharp"));

const BG = { r: 0x1a, g: 0x1a, b: 0x1a };

const globe = path.join(repoRoot, "branding", "globe-extracted-1024.png");
const wordmark = path.join(repoRoot, "branding", "OmniCoin-WhiteLetters1000x300.png");

const outDir = path.join(mobileRoot, "store-assets");
await fs.mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "google-play-feature-graphic-1024x500.png");

// Globe: 420×420 centred in the left third.
const globePng = await sharp(globe)
  .resize(420, 420, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
// Wordmark: 600×180 centred in the right two-thirds.
const wordmarkPng = await sharp(wordmark)
  .resize(600, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await sharp({
  create: { width: 1024, height: 500, channels: 3, background: BG },
})
  .composite([
    // Globe at left, vertically centred.
    { input: globePng, left: 30, top: 40 },
    // Wordmark at right, vertically centred.
    { input: wordmarkPng, left: 410, top: 160 },
  ])
  .flatten({ background: BG })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(outFile);

const stat = await fs.stat(outFile);
console.log(`Wrote ${path.relative(mobileRoot, outFile)} (${stat.size} bytes)`);
console.log("Verify dimensions: should be 1024×500.");
