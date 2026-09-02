/**
 * 钓鱼小达人 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 水下鱼群走 kit 自绘(index.ts 接 drawKitFish,canvas 无 emoji 鱼);
 * ② 深水去饱和映射单调(越深越淡,不会反着来);
 * ③ 花纹细节 15px 门槛(小于门槛省略,不糊成一团)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FISH_PATTERN_MIN_PX, depthFade, specForFish } from "../../art/kit/fishArt";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 匹配 fillText 第一个实参里直接写 emoji 的调用(DOM 文案不算) */
const EMOJI_FILLTEXT = /fillText\(\s*["'`][^"'`]*[\u{1F300}-\u{1FAFF}]/u;

describe("窗口7 R1 · fishing-star 专项①:鱼群自绘", () => {
  it("index.ts 接 kit drawKitFish,canvas 无 emoji 直出", () => {
    expect(SRC).toContain("drawKitFish");
    expect(EMOJI_FILLTEXT.test(SRC)).toBe(false);
  });
});

describe("窗口7 R1 · fishing-star 专项④:深水映射与细节门槛", () => {
  it("depthFade 随深度单调不增(饱和与透明都越深越低)", () => {
    const shallow = depthFade(1, 30);
    const mid = depthFade(15, 30);
    const deep = depthFade(29, 30);
    expect(mid.sat).toBeLessThanOrEqual(shallow.sat);
    expect(deep.sat).toBeLessThanOrEqual(mid.sat);
    expect(mid.alpha).toBeLessThanOrEqual(shallow.alpha);
    expect(deep.alpha).toBeLessThanOrEqual(mid.alpha);
  });

  it("花纹门槛 15px,鱼种 spec 可复现(同 id 同款)", () => {
    expect(FISH_PATTERN_MIN_PX).toBe(15);
    const a = specForFish("小银鱼", 1);
    const b = specForFish("小银鱼", 1);
    expect(a).toEqual(b);
  });
});
