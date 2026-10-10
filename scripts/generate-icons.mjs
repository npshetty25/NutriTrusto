// Renders the PWA icon set from public/logo.svg into public/icons/.
//
//   node scripts/generate-icons.mjs
//
// `sharp` is not a direct dependency: Next.js lists it as an optional
// dependency for image optimisation, so it is present after `npm install` on
// every supported platform. If it is missing the script says so rather than
// failing obscurely.
//
// Three kinds of icon, because they have different rules:
//   - "any"       drawn on an opaque white square with modest padding.
//   - "maskable"  the OS crops this one to a circle/squircle, so the artwork
//                 must sit inside the central safe zone: a circle whose
//                 diameter is 80% of the icon. The artwork's bounding-box
//                 diagonal is sized to that circle exactly.
//   - apple-touch iOS ignores the manifest icons and wants an opaque PNG.

import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error("sharp is not installed. Run `npm install` first (Next.js pulls it in as an optional dependency).");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(path.join(root, "public", "logo.svg"));
const outDir = path.join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const BACKGROUND = "#ffffff";
const SAFE_ZONE = 0.8;

// logo.svg has wide empty margins inside its 600x480 canvas, so scaling the
// canvas leaves the artwork at about a third of the icon. Rasterise once at
// high density and trim the transparent border; every icon then scales the
// artwork itself, so the ratios below mean what they say.
const artwork = await sharp(await sharp(svg, { density: 300 }).png().toBuffer())
  .trim()
  .png()
  .toBuffer();
const { width: artW, height: artH } = await sharp(artwork).metadata();
const heightOverWidth = artH / artW;

async function render({ size, file, widthRatio }) {
  // Maskable icons derive the width from the safe-zone circle; the rest
  // take a plain fraction of the icon width.
  const ratio = widthRatio ?? SAFE_ZONE / Math.sqrt(1 + heightOverWidth ** 2);
  const logoWidth = Math.round(size * ratio);
  const logo = await sharp(artwork).resize({ width: logoWidth }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: "center" }])
    // Fully opaque already; dropping the channel makes that explicit, so no
    // platform can ever paint transparency as black.
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, file));
  console.log(`wrote public/icons/${file} (${size}x${size}, artwork ${logoWidth}px wide)`);
}

console.log(`artwork after trim: ${artW}x${artH}`);
await render({ size: 192, widthRatio: 0.72, file: "icon-192.png" });
await render({ size: 512, widthRatio: 0.72, file: "icon-512.png" });
await render({ size: 512, file: "icon-maskable-512.png" });
await render({ size: 180, widthRatio: 0.7, file: "apple-touch-icon.png" });
