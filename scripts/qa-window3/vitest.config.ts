/**
 * 窗口 3 验收 · 测试员自建模拟走查的专用 vitest 配置。
 * 刻意放在 src/ 之外、用独立 include,`npm test` 不会收集到它,
 * 免得测试员的取证脚本混进产品测试基线里。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/qa-window3/**/*.qa.test.ts"],
    testTimeout: 900000,
    hookTimeout: 900000,
    reporters: ["default"],
  },
});
