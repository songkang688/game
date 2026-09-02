/**
 * 从 public/icons/cover.png 生成各尺寸应用图标:
 *   node scripts/gen-icons.mjs
 * 产物: icon-512/256/192.png、apple-touch-icon.png、icon-maskable-512.png,
 *       以及 android/app/src/main/res/mipmap-* 下的 launcher。
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");
const coverPath = path.join(iconsDir, "cover.png");
const androidRes = path.join(root, "android", "app", "src", "main", "res");

const SKY = { r: 122, g: 196, b: 236, alpha: 1 };

async function writePng(src, size, dest, extra = {}) {
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png(extra)
    .toFile(dest);
  console.log(`生成 ${path.relative(root, dest)} (${size}x${size})`);
}

const plain = [
  { size: 512, name: "icon-512.png" },
  { size: 256, name: "icon-256.png" },
  { size: 192, name: "icon-192.png" },
  { size: 180, name: "apple-touch-icon.png" }
];

for (const { size, name } of plain) {
  await writePng(coverPath, size, path.join(iconsDir, name));
}

// maskable: 图案缩到 78% 放在天空色底上,保证安全区
const inner = Math.round(512 * 0.78);
const pad = Math.round((512 - inner) / 2);
const innerPng = await sharp(coverPath).resize(inner, inner, { fit: "cover" }).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: SKY }
})
  .composite([{ input: innerPng, top: pad, left: pad }])
  .png()
  .toFile(path.join(iconsDir, "icon-maskable-512.png"));
console.log("生成 icon-maskable-512.png (512x512, maskable)");

// Android 传统 launcher: 48dp 基准
const launcher = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 }
];

// Adaptive foreground: 108dp 基准,四周留白,系统圆形裁切时标题和人还在
const adaptive = [
  { folder: "mipmap-mdpi", size: 108 },
  { folder: "mipmap-hdpi", size: 162 },
  { folder: "mipmap-xhdpi", size: 216 },
  { folder: "mipmap-xxhdpi", size: 324 },
  { folder: "mipmap-xxxhdpi", size: 432 }
];

for (const { folder, size } of launcher) {
  const dir = path.join(androidRes, folder);
  await mkdir(dir, { recursive: true });
  await writePng(coverPath, size, path.join(dir, "ic_launcher.png"));
  await writePng(coverPath, size, path.join(dir, "ic_launcher_round.png"));
}

for (const { folder, size } of adaptive) {
  const dir = path.join(androidRes, folder);
  await mkdir(dir, { recursive: true });
  const inset = Math.round(size * 0.72);
  const padPx = Math.round((size - inset) / 2);
  const face = await sharp(coverPath).resize(inset, inset, { fit: "cover" }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: SKY }
  })
    .composite([{ input: face, top: padPx, left: padPx }])
    .png()
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
  console.log(`生成 android .../${folder}/ic_launcher_foreground.png (${size}x${size})`);
}
