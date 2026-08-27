/**
 * 记忆翻翻乐 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 牌面图标体积三件套阈值(专项②:描边 1.5px / 高光 / 角标降级 48px);
 * ② 发牌波浪总时长封顶 + reduced 瞬到位;
 * ③ 双人模式存在且靠 HUD 轮次区分(专项③:同屏无角色贴纸,不依赖色觉)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MC_BACK_GOLD_PX,
  MC_CORNER_MIN_PX,
  MC_OUTLINE_PX,
  MC_WAVE_MAX_TOTAL_MS,
  waveDelayMs
} from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 · memory-cards 专项②:牌面体积阈值", () => {
  it("图标描边 1.5px、牌背金线 1.5px、窄于 48px 角标省略", () => {
    expect(MC_OUTLINE_PX).toBe(1.5);
    expect(MC_BACK_GOLD_PX).toBe(1.5);
    expect(MC_CORNER_MIN_PX).toBe(48);
  });
});

describe("窗口7 R1 · memory-cards 动效预算与 reduced", () => {
  it("发牌波浪总时长 ≤ 690ms,reduced 所有牌 0 延迟", () => {
    expect(MC_WAVE_MAX_TOTAL_MS).toBeLessThanOrEqual(690);
    expect(waveDelayMs(23, 24, false)).toBeLessThanOrEqual(MC_WAVE_MAX_TOTAL_MS);
    for (const s of [0, 5, 23]) expect(waveDelayMs(s, 24, true)).toBe(0);
  });
});

describe("窗口7 R1 · memory-cards 专项③:双人轮流翻", () => {
  it("双人同屏模式存在,轮次提示走 HUD 文案(非角色贴纸)", () => {
    expect(SRC).toContain("双人轮流翻");
    expect(SRC).toContain("mountVersus");
  });
});
