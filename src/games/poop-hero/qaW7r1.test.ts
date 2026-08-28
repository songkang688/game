/**
 * 便便超人 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 点名项:2.5D 层次。钉住本轮扫描确认过的视觉保证:
 * ① 章节背景两档视差(远层 0.16 / 中层 0.45),图层序从背景到 HUD;
 * ② 车尾气 💨 emoji 已清场,换自绘小气旋 drawGust;
 * ③ FX 预算封顶:残影 ≤ 6、尾流 ≤ 6,clear() 一把归零(泄漏抽查)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PH_ANIM, PH_LAYERS, PhFx } from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 · poop-hero 专项④:2.5D 两档视差", () => {
  it("远层 0.16 / 中层 0.45 两档速度差都在 render 里", () => {
    expect(SRC).toContain("camX * 0.16");
    expect(SRC).toContain("camX * 0.45");
  });

  it("图层序:背景视差最底、残影在超人身后一层、HUD 最顶", () => {
    expect(PH_LAYERS[0]).toContain("视差");
    expect(PH_LAYERS.indexOf("扫帚残影")).toBeLessThan(PH_LAYERS.indexOf("超人"));
    expect(PH_LAYERS[PH_LAYERS.length - 1]).toBe("HUD");
  });
});

describe("窗口7 R1 · poop-hero 专项①:💨 清场", () => {
  it("车尾气不再贴 💨 emoji(换自绘 drawGust)", () => {
    expect(/emoji\([^)]*"💨"/u.test(SRC)).toBe(false);
    expect(SRC).toContain("drawGust");
  });
});

describe("窗口7 R1 · poop-hero FX 预算与泄漏", () => {
  it("残影两帧渐隐、尾流 3 颗 300ms,数组硬封顶", () => {
    expect(PH_ANIM.dashGhostFrames).toBe(2);
    expect(PH_ANIM.trailStars).toBe(3);
    const fx = new PhFx();
    for (let i = 0; i < 40; i++) {
      fx.spawnGhost(i, 0, 1, false, false);
      fx.spawnTrailStar(i, 0, 3, false);
    }
    expect(fx.ghosts.length).toBeLessThanOrEqual(PH_ANIM.dashGhostFrames * 2 + 2);
    expect(fx.trail.length).toBeLessThanOrEqual(PH_ANIM.trailStars * 2);
  });

  it("reduced 一颗不生成;clear() 一把归零", () => {
    const fx = new PhFx();
    fx.spawnGhost(0, 0, 1, false, true);
    fx.spawnTrailStar(0, 0, 3, true);
    expect(fx.count()).toBe(0);
    fx.spawnGhost(0, 0, 1, false, false);
    fx.spawnTrailStar(0, 0, 3, false);
    fx.clear();
    expect(fx.count()).toBe(0);
  });
});
