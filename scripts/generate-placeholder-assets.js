/**
 * generate-placeholder-assets.js — emits the minimal-required image
 * + sound assets app.json points at, so EAS prebuild doesn't fail on
 * a missing PNG. Designs are placeholders (solid OmniBazaar dark
 * background with a centred white square as a visual anchor) that
 * any designer should replace before App Store / Play Store
 * submission.
 *
 * Run from Mobile/:  node scripts/generate-placeholder-assets.js
 */

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const imagesDir = path.join(root, "assets", "images");
const soundsDir = path.join(root, "assets", "sounds");
fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(soundsDir, { recursive: true });

const BG = { r: 0x1a, g: 0x1a, b: 0x1a };
const FG = { r: 0xff, g: 0xff, b: 0xff };

/**
 * Write a square PNG with a centred white square anchor. Solid-only
 * canvases work for icons + splash; the centre square keeps the
 * placeholder visually distinct from "no asset at all".
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

writeSquarePng("icon.png", 1024, 0.45);
writeSquarePng("adaptive-icon.png", 1024, 0.55);
writeSquarePng("splash.png", 1242, 0.35);
writeSquarePng("favicon.png", 48, 0.5);
writeSquarePng("notification-icon.png", 96, 0.55);

/**
 * Write a tiny valid silent .wav (PCM 16-bit mono, 8000 Hz, 0.05s).
 * Expo just needs the file to exist + be a parseable WAV; size doesn't
 * matter for the placeholder.
 *
 * @param {string} file - Output filename in soundsDir.
 */
function writeSilentWav(file) {
  const sampleRate = 8000;
  const samples = 400; // 50 ms
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(path.join(soundsDir, file), buf);
}

writeSilentWav("notification.wav");

console.log("Wrote placeholder assets to", imagesDir, "and", soundsDir);
