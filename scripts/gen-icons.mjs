/**
 * 从 public/icons/icon.svg 生成各尺寸 PNG 图标:
 *   node scripts/gen-icons.mjs
 * 产物:icon-512/256/192.png、apple-touch-icon.png、icon-maskable-512.png
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");
const svg = await readFile(path.join(iconsDir, "icon.svg"));

const plain = [
  { size: 512, name: "icon-512.png" },
  { size: 256, name: "icon-256.png" },
  { size: 192, name: "icon-192.png" },
  { size: 180, name: "apple-touch-icon.png" }
];

for (const { size, name } of plain) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, name));
  console.log(`生成 ${name} (${size}x${size})`);
}

// maskable:图案缩到 78% 放在纯色底上,保证安全区
const inner = Math.round(512 * 0.78);
const pad = Math.round((512 - inner) / 2);
const innerPng = await sharp(svg, { density: 300 }).resize(inner, inner).png().toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 255, g: 233, b: 245, alpha: 1 }
  }
})
  .composite([{ input: innerPng, top: pad, left: pad }])
  .png()
  .toFile(path.join(iconsDir, "icon-maskable-512.png"));
console.log("生成 icon-maskable-512.png (512x512, maskable)");
