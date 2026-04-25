/**
 * compose-from-omnibazaar-branding.mjs — derive every Mobile asset
 * slot from the assets that already live in `OmniBazaar/branding/`.
 *
 * Sources used (relative to the repo root, two levels above Mobile/):
 *   branding/OmniBazaar Globe-clear-256x256.png   → icon + adaptive + favicon
 *   branding/icons/xom-icon-blue-512.png          → upscale fallback if Globe is too small
 *   branding/OmniCoin1000x300.png                 → splash centrepiece
 *   branding/icons/xom-icon-outline-128.png       → notification icon (silhouetted to white)
 *
 * Outputs go to `Mobile/branding/` (NOT directly to `assets/`) so the
 * existing `generate-placeholder-assets.js` then copies them into
 * `assets/`. Two-stage so the team can manually drop real overrides
 * into `branding/` and they always win — this script doesn't clobber
 * anything that already exists.
 *
 * Run:
 *   cd Mobile && node scripts/compose-from-omnibazaar-branding.mjs
 *   cd Mobile && node scripts/generate-placeholder-assets.js
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..");
const brandingSrc = path.join(repoRoot, "branding");
const brandingDst = path.join(mobileRoot, "branding");
await fs.mkdir(brandingDst, { recursive: true });

// `sharp` is hoisted at the workspace root — load via createRequire so
// we can reach across the workspace boundary cleanly.
const requireFromMobile = createRequire(import.meta.url);
let sharp;
try {
  sharp = requireFromMobile(path.join(repoRoot, "node_modules", "sharp"));
} catch {
  console.error(
    "sharp not found — run `npm install sharp` at the workspace root first.",
  );
  process.exit(1);
}

/** OmniBazaar background colour from app.json + omnibazaar-theme.css. */
const BG = { r: 0x1a, g: 0x1a, b: 0x1a, alpha: 1 };

/**
 * Skip overwrite when the destination already exists. Prevents the
 * composer from clobbering hand-tuned artwork the team dropped in.
 *
 * @param {string} dst - Destination path.
 * @returns {Promise<boolean>} true if we should skip writing.
 */
async function exists(dst) {
  try {
    await fs.access(dst);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write `dst` only when it doesn't already exist (or `force` is true).
 *
 * @param {string} label - Label for the run summary.
 * @param {string} dst - Destination path.
 * @param {() => Promise<Buffer>} build - Async builder returning PNG bytes.
 * @param {boolean} [force] - When true, overwrite an existing file.
 */
async function writeIfMissing(label, dst, build, force = false) {
  if (!force && (await exists(dst))) {
    console.log(`  ○ skip      ${label} (already exists)`);
    return;
  }
  const buf = await build();
  await fs.writeFile(dst, buf);
  console.log(`  ✓ wrote     ${label}`);
}

const globe256 = path.join(brandingSrc, "OmniBazaar Globe-clear-256x256.png");
const wordmark = path.join(brandingSrc, "OmniCoin1000x300.png");
const wordmarkWhite = path.join(brandingSrc, "OmniCoin-WhiteLetters1000x300.png");
const outlineIcon = path.join(brandingSrc, "icons", "xom-icon-outline-128.png");
const xomBlue512 = path.join(brandingSrc, "icons", "xom-icon-blue-512.png");

// ── icon.png — 1024×1024, NO alpha ────────────────────────────────────────
// App Store rejects icons with transparency. Composite the globe over
// the brand background so the resulting PNG is fully opaque.
await writeIfMissing(
  "icon.png",
  path.join(brandingDst, "icon.png"),
  async () => {
    // App Store rejects alpha on the iOS icon. `flatten` paints the
    // alpha channel against `BG` and `removeAlpha` strips the channel
    // outright so the final PNG ships as RGB.
    return sharp({
      create: { width: 1024, height: 1024, channels: 3, background: BG },
    })
      .composite([
        {
          input: await sharp(globe256)
            .resize(820, 820, { fit: "contain", background: { ...BG, alpha: 0 } })
            .toBuffer(),
          gravity: "center",
        },
      ])
      .flatten({ background: BG })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();
  },
  /* force */ true,
);

// ── adaptive-icon.png — 1024×1024 with alpha, foreground inside 432² safe ──
// Android applies its launcher mask. We pad to 1024 so the launcher's
// circular / squircle / rounded-rect mask doesn't clip the globe.
// Safe area is the centre 432² (≈ 42 % of 1024).
await writeIfMissing(
  "adaptive-icon.png",
  path.join(brandingDst, "adaptive-icon.png"),
  async () => {
    const safe = 720; // wider than the 432 safe minimum, looks better in circles
    return sharp({
      create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp(globe256)
            .resize(safe, safe, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer(),
          gravity: "center",
        },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();
  },
);

// ── splash.png — 1284×2778 portrait, OmniCoin wordmark on dark bg ─────────
await writeIfMissing("splash.png", path.join(brandingDst, "splash.png"), async () => {
  // Prefer the white-letters variant against our dark background — the
  // black-letters variant would disappear.
  const src = (await exists(wordmarkWhite)) ? wordmarkWhite : wordmark;
  return sharp({
    create: { width: 1284, height: 2778, channels: 3, background: BG },
  })
    .composite([
      {
        input: await sharp(src)
          .resize(900, 270, { fit: "contain", background: { ...BG, alpha: 0 } })
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
});

// ── favicon.png — 48×48, the same globe for browser-tab consistency ───────
await writeIfMissing("favicon.png", path.join(brandingDst, "favicon.png"), async () => {
  return sharp(globe256).resize(48, 48, { fit: "cover" }).png().toBuffer();
});

// ── notification-icon.png — 96×96 transparent monochrome WHITE silhouette ──
// Android's status bar renders this as a tinted silhouette regardless
// of the source colours, so we threshold first to avoid surprises.
await writeIfMissing(
  "notification-icon.png",
  path.join(brandingDst, "notification-icon.png"),
  async () => {
    const src = (await exists(outlineIcon)) ? outlineIcon : xomBlue512;
    // Read the icon, threshold its alpha, then re-paint every visible
    // pixel as opaque white. Anything under 30 / 255 alpha becomes
    // fully transparent.
    const raw = await sharp(src)
      .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const flipped = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i += 4) {
      const a = raw[i + 3];
      const visible = a >= 30;
      flipped[i] = 255;
      flipped[i + 1] = 255;
      flipped[i + 2] = 255;
      flipped[i + 3] = visible ? 255 : 0;
    }
    return sharp(flipped, { raw: { width: 96, height: 96, channels: 4 } })
      .png()
      .toBuffer();
  },
);

console.log("\nDone. Now run: node scripts/generate-placeholder-assets.js");
console.log(
  "(That copies the freshly-composed branding/*.png into assets/images/ — placeholders only fill any slots branding/ leaves empty.)",
);
