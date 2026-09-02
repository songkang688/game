/**
 * 1.3 窗口 1 · 第 2 轮学习优化员 · 文案契约(只增不减)。
 *
 * 第 1 轮 fixer 落地的十二项视觉修复里,只有两处带「玩家可用的信息」且
 * 第 1 轮文案(window1-copy-r1.test.ts 那一批)尚未讲到:
 * - block-drop 井壁主题浮雕(P9,art.ts paintWallRelief,随井壁主题换装);
 * - star-estate 地格手绘图标(P1,art.ts tileIconSVG,认图标记路)。
 * 本轮把这两处讲进攻略并在此钉住;其余修复(orb 贴片 / snake 色岛 /
 * combo 土丘明暗 / fc 草云 / mj 织纹 / hc 纸感)为纯背景层次,不进攻略,
 * 理由登记在 docs/qa/1.3-window1-round2-learner.md 第五节。
 */
import { describe, expect, it } from "vitest";

import blockDropGuide from "./block-drop/guide";
import starEstateGuide from "./star-estate/guide";

describe("窗口1 · 第 2 轮学习优化员 · r1 修复亮点讲进攻略", () => {
  it("block-drop general 讲到井壁浮雕随主题换装(art.ts paintWallRelief)", () => {
    const text = blockDropGuide.general.join("\n");
    expect(text).toContain("浮雕");
    expect(text).toContain("小花窗");
    expect(text).toContain("小星窗");
    // 并入既有「换主题」条,不挤掉 r1 已钉住的任何信号
    expect(blockDropGuide.general.length).toBe(6);
  });

  it("star-estate 第一章 tips 讲到地格手绘图标(art.ts tileIconSVG)", () => {
    const first = starEstateGuide.entries[0];
    expect(first.from).toBe(1);
    const tips = first.tips.join("\n");
    expect(tips).toContain("小图标");
    expect(tips).toContain("毛线团");
    expect(tips).toContain("认图标记路");
    // 章节结构与条数不减
    expect(starEstateGuide.entries.length).toBe(8);
    expect(first.tips.length).toBeGreaterThanOrEqual(4);
  });
});
