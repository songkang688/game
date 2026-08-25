/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// base 使用相对路径,保证 Electron(file://)与 Capacitor 都能直接加载 dist。
export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "一朵一星",
        short_name: "一朵一星",
        description: "一朵一星 —— 送给小朋友的原创小游戏合集,无广告、无内购。",
        lang: "zh-CN",
        display: "standalone",
        orientation: "any",
        theme_color: "#ffd9ea",
        background_color: "#fff5fa",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"]
      }
    })
  ],
  build: {
    target: "es2019",
    outDir: "dist"
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [
      "src/games/math-farm/**",
      "src/games/word-garden/**",
      "src/games/pinyin-train/**",
      "src/games/shape-kingdom/**",
      "src/games/music-stars/**",
      "src/games/find-diff/**",
      "src/games/clock-house/**"
    ]
  }
});
