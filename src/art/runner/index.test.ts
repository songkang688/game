// 1.3 第 1 步 C · 出口冒烟:四个模块的关键 API 都能从 src/art/runner 一站式拿到。
import { describe, expect, it } from "vitest";
import * as runner from "./index";

describe("runner/index · 汇总出口", () => {
  it("跑道 / 天空 / 精灵 / 速度四组 API 都在出口上", () => {
    expect(typeof runner.drawTrack).toBe("function");
    expect(typeof runner.laneCenterX).toBe("function");
    expect(typeof runner.curveOffset).toBe("function");
    expect(typeof runner.makeSkyLayers).toBe("function");
    expect(typeof runner.drawSky).toBe("function");
    expect(typeof runner.drawAtDepth).toBe("function");
    expect(typeof runner.sortByDepth).toBe("function");
    expect(typeof runner.fogTint).toBe("function");
    expect(typeof runner.makeSpeedLines).toBe("function");
    expect(typeof runner.drawSpeedLines).toBe("function");
    expect(typeof runner.cameraNudge).toBe("function");
  });

  it("主题与常量从出口可见,两套跑道主题配两套天空主题", () => {
    expect(runner.TRACK_THEMES.length).toBe(2);
    expect(runner.SKY_THEMES.length).toBe(2);
    expect(runner.MAX_SPEED_LINES).toBeGreaterThan(0);
    expect(runner.NUDGE_MAX_SHIFT).toBeLessThanOrEqual(0.015);
    expect(runner.NUDGE_MAX_ROT).toBeLessThanOrEqual(1.2);
  });

  it("模块间没有重名导出打架:出口上的符号各归各", () => {
    // export * 若有重名会变成 undefined,这里点名抽查每组一个代表
    expect(runner.STRIPE_SPACING).toBeGreaterThan(0);
    expect(runner.HAZE_ALPHA).toBeGreaterThan(0);
    expect(runner.SHADOW_BASE_RADIUS).toBeGreaterThan(0);
    expect(typeof runner.advanceSpeedLines).toBe("function");
  });
});
