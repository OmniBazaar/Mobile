/**
 * generate-placeholder-assets.js — emits the image + sound assets
 * `app.json` references.
 *
 * Two modes:
 *   1. **Real-asset mode (preferred).** When `Mobile/branding/` contains
 *      a source PNG of the right name, it's copied to `assets/images/`
 *      verbatim. Use this for the OmniBazaar logo, splash artwork, etc.
 *   2. **Placeholder mode (fallback).** When no `branding/` source
 *      exists for a slot, a solid-color anchor PNG is generated so EAS
 *      prebuild doesn't fail on a missing file.
 *
 * Required `branding/` files (any subset — missing slots fall back):
 *   branding/icon.png              → assets/images/icon.png            (1024×1024, no alpha)
 *   branding/adaptive-icon.png     → assets/images/adaptive-icon.png   (1024×1024, foreground only — safe area is centre 66%)
 *   branding/splash.png            → assets/images/splash.png          (1284×2778 or 1242×2436)
 *   branding/favicon.png           → assets/images/favicon.png         (48×48)
 *   branding/notification-icon.png → assets/images/notification-icon.png (96×96, transparent monochrome white)
 *   branding/notification.wav      → assets/sounds/notification.wav    (PCM WAV)
 *
 * Run from Mobile/:
 *   node scripts/generate-placeholder-assets.js
 */

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const brandingDir = path.join(root, "branding");
const imagesDir = path.join(root, "assets", "images");
fs.mkdirSync(imagesDir, { recursive: true });

const BG = { r: 0x1a, g: 0x1a, b: 0x1a };
const FG = { r: 0xff, g: 0xff, b: 0xff };

/**
 * Copy `branding/<name>` to the target if it exists; otherwise fall back
 * to the `placeholder` builder.
 *
 * @param {string} name - Source filename in `branding/`.
 * @param {string} outDir - Output directory.
 * @param {() => void} placeholder - Builder that writes a stub.
 * @returns {string} 'real' or 'placeholder', for the run summary.
 */
function copyOrFallback(name, outDir, placeholder) {
  const src = path.join(brandingDir, name);
  const dst = path.join(outDir, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    return "real";
  }
  placeholder();
  return "placeholder";
}

/**
 * Write a square PNG with a centred white square anchor.
 *
 * @param {string} file - Output filename in imagesDir.
 * @param {number} size - Edge length in pixels.
 * @param {number} anchorRatio - Centre-square edge as a fraction of size.
 */
function writeSquarePng(file, size, anchorRatio = 0) {
  const png = new PNG({ width: size, height: size });
  const min = Math.floor((size * (1 - anchorRatio)) / 2);
  const max = size - min;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const inAnchor =
        anchorRatio > 0 && x >= min && x < max && y >= min && y < max;
      const c = inAnchor ? FG : BG;
      png.data[idx] = c.r;
      png.data[idx + 1] = c.g;
      png.data[idx + 2] = c.b;
      png.data[idx + 3] = 0xff;
    }
  }
  const out = path.join(imagesDir, file);
  png.pack().pipe(fs.createWriteStream(out));
}

// Note: app.json's expo-notifications plugin no longer references a
// custom sound — the OS default chime plays. If a brand chime ships
// later, re-add the `sounds` array in app.json + reintroduce a
// notification.wav slot here.

const summary = [];
summary.push(["icon.png", copyOrFallback("icon.png", imagesDir, () => writeSquarePng("icon.png", 1024, 0.45))]);
summary.push(["adaptive-icon.png", copyOrFallback("adaptive-icon.png", imagesDir, () => writeSquarePng("adaptive-icon.png", 1024, 0.55))]);
summary.push(["splash.png", copyOrFallback("splash.png", imagesDir, () => writeSquarePng("splash.png", 1242, 0.35))]);
summary.push(["favicon.png", copyOrFallback("favicon.png", imagesDir, () => writeSquarePng("favicon.png", 48, 0.5))]);
summary.push(["notification-icon.png", copyOrFallback("notification-icon.png", imagesDir, () => writeSquarePng("notification-icon.png", 96, 0.55))]);

for (const [name, kind] of summary) {
  const tag = kind === "real" ? "✓ real    " : "○ placeholder";
  console.log(`  ${tag}  ${name}`);
}
const realCount = summary.filter(([, k]) => k === "real").length;
console.log(`Wrote ${summary.length} assets (${realCount} from branding/, ${summary.length - realCount} placeholder).`);
