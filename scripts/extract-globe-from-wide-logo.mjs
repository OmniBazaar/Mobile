/**
 * extract-globe-from-wide-logo.mjs — pull the square globe out of a
 * "logo + wordmark" composite PNG (e.g. the
 * `Huge Logo 2 for YouTube 5825 x 1645.png` master).
 *
 * Strategy:
 *   1. Read the PNG raw, alpha included.
 *   2. For each column compute the vertical span of opaque pixels.
 *   3. The globe is the contiguous run of columns where that span is
 *      close to the image height (a tall circle); the wordmark
 *      columns have much shorter spans (letterforms).
 *   4. Take the bounding square of that run, pad to make it square,
 *      and re-render at 1024² and 256² so downstream composers can
 *      consume either size.
 *
 * Output:
 *   branding/globe-extracted-1024.png   (RGBA, square)
 *   branding/globe-extracted-256.png    (RGBA, square — handy for fall-back paths)
 *
 * Run:
 *   node scripts/extract-globe-from-wide-logo.mjs <input-png>
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

const inputArg =
  process.argv[2] ??
  path.join(repoRoot, "branding", "Huge Logo 2 for YouTube 5825 x 1645.png");
const inputPath = path.resolve(inputArg);

const stat = await fs.stat(inputPath);
console.log(`Input: ${inputPath} (${stat.size} bytes)`);

const meta = await sharp(inputPath).metadata();
console.log(
  `Dimensions: ${meta.width}×${meta.height}, channels=${meta.channels}`,
);

// Load raw RGBA pixels.
const raw = await sharp(inputPath).ensureAlpha().raw().toBuffer();
const w = meta.width;
const h = meta.height;
const ALPHA_THRESHOLD = 24; // ignore near-transparent pixels (anti-aliasing fringe)

/**
 * For each column, return [firstOpaqueRow, lastOpaqueRow, opaqueCount].
 * A column with no opaque pixels gets [-1, -1, 0].
 *
 * @returns {Array<[number, number, number]>}
 */
function columnProfiles() {
  const profiles = new Array(w);
  for (let x = 0; x < w; x++) {
    let first = -1;
    let last = -1;
    let count = 0;
    for (let y = 0; y < h; y++) {
      const a = raw[(y * w + x) * 4 + 3];
      if (a >= ALPHA_THRESHOLD) {
        if (first === -1) first = y;
        last = y;
        count++;
      }
    }
    profiles[x] = [first, last, count];
  }
  return profiles;
}

const profiles = columnProfiles();
const tallSpan = Math.floor(h * 0.7); // a "globe" column spans ≥70 % of the image height
let bestStart = -1;
let bestEnd = -1;
let curStart = -1;
let curEnd = -1;
const maxGap = Math.floor(w * 0.005); // tolerate small gaps inside the globe (≤ 0.5 % of width)

let lastTallCol = -2 * maxGap;
for (let x = 0; x < w; x++) {
  const [first, last] = profiles[x];
  const span = first === -1 ? 0 : last - first + 1;
  if (span >= tallSpan) {
    if (x - lastTallCol > maxGap) {
      // start of a new run; finalise previous run as best if larger
      if (
        curStart !== -1 &&
        curEnd - curStart > bestEnd - bestStart
      ) {
        bestStart = curStart;
        bestEnd = curEnd;
      }
      curStart = x;
    }
    curEnd = x;
    lastTallCol = x;
  }
}
if (curStart !== -1 && curEnd - curStart > bestEnd - bestStart) {
  bestStart = curStart;
  bestEnd = curEnd;
}

if (bestStart === -1) {
  console.error("No globe column detected — image has no tall circular shape?");
  process.exit(1);
}

console.log(
  `Globe detected: columns ${bestStart}..${bestEnd} (${bestEnd - bestStart + 1} px wide)`,
);

// Compute the vertical bounding box across just the globe columns so
// we crop tightly even if the globe doesn't touch the top/bottom of
// the canvas.
let topRow = h;
let bottomRow = 0;
for (let x = bestStart; x <= bestEnd; x++) {
  const [first, last] = profiles[x];
  if (first !== -1) {
    if (first < topRow) topRow = first;
    if (last > bottomRow) bottomRow = last;
  }
}
const globeHeight = bottomRow - topRow + 1;
const globeWidth = bestEnd - bestStart + 1;
console.log(
  `Globe bounding box: x=[${bestStart}, ${bestEnd}], y=[${topRow}, ${bottomRow}] (${globeWidth}×${globeHeight})`,
);

// Square the bounding box around the globe centre.
const cx = (bestStart + bestEnd) / 2;
const cy = (topRow + bottomRow) / 2;
const side = Math.max(globeWidth, globeHeight);
let cropX = Math.round(cx - side / 2);
let cropY = Math.round(cy - side / 2);
let cropSide = side;
// Add a tiny breathing margin so the launcher / icon mask doesn't
// kiss the globe rim.
const marginPct = 0.04;
const marginPx = Math.round(cropSide * marginPct);
cropX -= marginPx;
cropY -= marginPx;
cropSide += marginPx * 2;
// Clamp to canvas. If we'd go off-canvas, pad with a transparent
// extend instead of clamping (keeps the globe centred).
const padLeft = Math.max(0, -cropX);
const padTop = Math.max(0, -cropY);
const padRight = Math.max(0, cropX + cropSide - w);
const padBottom = Math.max(0, cropY + cropSide - h);
const safeCropX = Math.max(0, cropX);
const safeCropY = Math.max(0, cropY);
const safeWidth = cropSide - padLeft - padRight;
const safeHeight = cropSide - padTop - padBottom;
console.log(
  `Square crop: x=${safeCropX}, y=${safeCropY}, side=${cropSide}` +
    (padLeft + padTop + padRight + padBottom > 0
      ? ` (pad L${padLeft}/T${padTop}/R${padRight}/B${padBottom})`
      : ""),
);

const cropped = await sharp(inputPath)
  .extract({
    left: safeCropX,
    top: safeCropY,
    width: safeWidth,
    height: safeHeight,
  })
  .extend({
    top: padTop,
    bottom: padBottom,
    left: padLeft,
    right: padRight,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const outDir = path.join(repoRoot, "branding");
await fs.writeFile(path.join(outDir, "globe-extracted-1024.png"),
  await sharp(cropped).resize(1024, 1024, { fit: "contain" }).png({ compressionLevel: 9 }).toBuffer());
await fs.writeFile(path.join(outDir, "globe-extracted-256.png"),
  await sharp(cropped).resize(256, 256, { fit: "contain" }).png({ compressionLevel: 9 }).toBuffer());

console.log("\nWrote:");
console.log("  branding/globe-extracted-1024.png");
console.log("  branding/globe-extracted-256.png");
console.log("\nNext: re-run `node scripts/compose-from-omnibazaar-branding.mjs`");
console.log("(it will pick up the new globe automatically — see the GLOBE_SOURCE list).");
