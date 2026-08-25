/**
 * 把 public/icons/icon.svg 渲染成 Android 启动图标(各密度 mipmap):
 *   node scripts/gen-android-icons.mjs
 * 需要先执行过 `npx cap add android`(存在 android/ 工程)。
 */
import sharp from "sharp";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resDir = path.join(root, "android", "app", "src", "main", "res");

try {
  await access(resDir);
} catch {
  console.error("未找到 android 工程,请先运行:npx cap add android");
  process.exit(1);
}

const svg = await readFile(path.join(root, "public", "icons", "icon.svg"));

const densities = [
  { dir: "mipmap-mdpi", launcher: 48, foreground: 108 },
  { dir: "mipmap-hdpi", launcher: 72, foreground: 162 },
  { dir: "mipmap-xhdpi", launcher: 96, foreground: 216 },
  { dir: "mipmap-xxhdpi", launcher: 144, foreground: 324 },
  { dir: "mipmap-xxxhdpi", launcher: 192, foreground: 432 }
];

function circleMask(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
}

for (const { dir, launcher, foreground } of densities) {
  const outDir = path.join(resDir, dir);

  // 常规图标
  await sharp(svg, { density: 300 })
    .resize(launcher, launcher)
    .png()
    .toFile(path.join(outDir, "ic_launcher.png"));

  // 圆形图标
  const square = await sharp(svg, { density: 300 }).resize(launcher, launcher).png().toBuffer();
  await sharp(square)
    .composite([{ input: circleMask(launcher), blend: "dest-in" }])
    .png()
    .toFile(path.join(outDir, "ic_launcher_round.png"));

  // 自适应图标前景:内容缩到 62%,四周留安全区
  const inner = Math.round(foreground * 0.62);
  const pad = Math.round((foreground - inner) / 2);
  const innerPng = await sharp(svg, { density: 300 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: foreground, height: foreground, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: innerPng, top: pad, left: pad }])
    .png()
    .toFile(path.join(outDir, "ic_launcher_foreground.png"));

  console.log(`生成 ${dir} (${launcher}px / 前景 ${foreground}px)`);
}

// 自适应图标背景色改成主题粉
const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFE9F5</color>
</resources>
`;
await writeFile(path.join(resDir, "values", "ic_launcher_background.xml"), bgXml);
console.log("更新 ic_launcher_background 为 #FFE9F5");
