/**
 * 窗口 8 · 1.3 视觉升级 · 第 2 轮验收沉淀的机器化复验（测试员新增）。
 *
 * 第 1 轮的扫描（fillText 禁令 / 商标 / 双人结构通道 / 2.5D / kit 契约）在
 * `window8-round1-visual-scan.test.ts` 原样继续跑；本文件只补第 2 轮新口径：
 *  ① W8R1-05 复验加码：红蓝跑者 32px「特写档」灰度可分辨（第 1 轮修复口径是 16px，
 *     本轮深度走查加测 32px，修前 0.2% → 修后 14.7–17.7%，验收线放 12%）；
 *  ② 修复接线防退化：三款裸 emoji 修复的消费端接线（farmLayer / runner / arena）
 *     不许被后续改动悄悄拆线（行为用例在各款 *.test.ts，这里钉源码接缝）；
 *  ③ reduced-motion 防线：12 款实现代码必须保有 prefers-reduced-motion 处理，
 *     修视觉不许把无障碍分支修没。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { RACE_LOOKS, runnerSvg, type RunnerPose } from "../../art/kit/runnerSvg";
import { trimRunnerSvg } from "../../art/kit/runnerDuoTrim";

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const WINDOW8_IDS = [
  "red-blue-race",
  "red-blue-tap",
  "red-blue-tug",
  "clock-house",
  "math-farm",
  "pinyin-train",
  "word-garden",
  "shape-kingdom",
  "find-diff",
  "color-fun",
  "music-stars",
  "kitty-care"
] as const;

function src(rel: string): string {
  return readFileSync(join(GAMES_DIR, rel), "utf8");
}

describe("窗口 8 第 2 轮 · W8R1-05 复验 · 32px 特写档可分辨", () => {
  const FRAMES: Array<{ key: string; pose: RunnerPose; phase: number }> = [
    { key: "run0", pose: "run", phase: 0 },
    { key: "run1", pose: "run", phase: 1 },
    { key: "jump", pose: "jump", phase: 0 },
    { key: "slip", pose: "slip", phase: 0 }
  ];

  async function gray32(svgText: string): Promise<Buffer> {
    return sharp(Buffer.from(svgText), { density: 300 })
      .resize(32, 32, { fit: "fill" })
      .flatten({ background: "#ffffff" })
      .grayscale()
      .raw()
      .toBuffer();
  }

  for (const f of FRAMES) {
    it(`${f.key} 帧 32px 灰度可分辨像素 ≥12%（修前 0.2%）`, async () => {
      const red = trimRunnerSvg(
        runnerSvg({ look: RACE_LOOKS.red, pose: f.pose, phase: f.phase, idPrefix: "r2R" }),
        "red",
        { pose: f.pose, phase: f.phase }
      );
      const blue = trimRunnerSvg(
        runnerSvg({ look: RACE_LOOKS.blue, pose: f.pose, phase: f.phase, idPrefix: "r2B" }),
        "blue",
        { pose: f.pose, phase: f.phase }
      );
      const [a, b] = await Promise.all([gray32(red), gray32(blue)]);
      let count = 0;
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) >= 24) count++;
      }
      expect((100 * count) / a.length).toBeGreaterThanOrEqual(12);
    });
  }
});

describe("窗口 8 第 2 轮 · 裸 emoji 修复的消费端接线不许拆", () => {
  it("math-farm：farmLayer 走 countPlan → renderCountIllustration（W8R1-01）", () => {
    const text = src("math-farm/farmLayer.ts");
    expect(text).toContain("countPlan(");
    expect(text).toContain("renderCountIllustration(");
    expect(text).toContain("mtf-count-sr");
  });

  it("word-garden：runner 挂 attachPicArt（W8R1-02）", () => {
    const text = src("word-garden/runner.ts");
    expect(text).toContain("attachPicArt(");
    expect(text).toMatch(/from "\.\/picArt"/);
  });

  it("kitty-care：arena 走 propIcon + kit 贴纸（W8R1-03）", () => {
    const text = src("kitty-care/arena.ts");
    expect(text).toContain("function propIcon(");
    expect(text).toMatch(/from "\.\.\/\.\.\/art\/kit\/stickers"/);
    expect(text).toContain("ktc-propsr");
  });
});

describe("窗口 8 第 2 轮 · reduced-motion 防线", () => {
  it("12 款实现代码都保有 prefers-reduced-motion 处理", () => {
    const missing: string[] = [];
    for (const id of WINDOW8_IDS) {
      const dir = join(GAMES_DIR, id);
      let found = false;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
        if (readFileSync(join(dir, f), "utf8").includes("prefers-reduced-motion")) {
          found = true;
          break;
        }
      }
      if (!found) missing.push(id);
    }
    expect(missing).toEqual([]);
  });
});
