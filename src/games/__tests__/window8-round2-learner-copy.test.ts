/**
 * 窗口 8 · 1.3 视觉升级 · 第 2 轮学习优化员的文案快照（B 档新增）。
 *
 * 本轮把 C 档第 1 轮修复落地的视觉亮点讲进了对应款的引导：
 * 跑者头饰剪影（W8R1-05）、数一数贴纸题卡（W8R1-01）、看图认字简笔图卡（W8R1-02）、
 * 喂饭同套图卡（W8R1-03）、奖励花瓣尖发亮（W8R1-06）。这里做两件事：
 *  ① 快照钉死：每处新文案的关键句在位——防止后续轮次把视觉线索改丢；
 *  ② 文案 ↔ 视觉一致性：文案里说的头饰 / 号码 / 贴纸 / 渐变方向，必须与
 *    对应实现对得上（说的必须是画出来的）。
 * 只读断言，不碰任何玩法与绘制实现；第 1 轮的 21 例快照原样保留在
 * `window8-round1-learner-copy.test.ts`，本文件只增不改。
 */
import { describe, expect, it } from "vitest";
import { RACE_LOOKS } from "../../art/kit/runnerSvg";
import { trimRunnerSvg } from "../../art/kit/runnerDuoTrim";
import { hasSticker, sticker } from "../../art/kit/stickers";
import { FLOWER_TRIO, flowerSvg } from "../../art/kit/flower";
import { renderCountIllustration } from "../math-farm/illustrate";
import { promptPicPlan } from "../word-garden/picArt";
import { PETAL_ROOT_DARK, PETAL_TIP_LIGHT, shadeFlower } from "../word-garden/flowerShade";
import { PROP_PX } from "../kitty-care/arena";
import { ALL_FOODS } from "../kitty-care/tasks";

import raceGuide from "../red-blue-race/guide";
import farmGuide from "../math-farm/guide";
import gardenGuide from "../word-garden/guide";
import kittyGuide from "../kitty-care/guide";
import type { GuideBook } from "../../ui/level188Contract";

/** 整本攻略摊平成一串文本（通用心得 + 全部章节提示） */
function allText(book: GuideBook): string {
  return [...book.general, ...book.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
}

describe("窗口8 第2轮 · 学习优化员文案快照：修复亮点讲进了引导", () => {
  it("red-blue-race：双跑者头饰剪影与号码讲进了攻略", () => {
    const text = allText(raceGuide);
    expect(text).toContain("双丸子头");
    expect(text).toContain("帽舌朝后反戴");
    expect(text).toContain("剪影");
  });

  it("math-farm：数一数贴纸题卡讲进了第一章攻略", () => {
    const chapter = farmGuide.entries[0];
    expect(chapter.tips.join("\n")).toContain("一枚贴纸就是一个");
  });

  it("word-garden：简笔图卡与开花奖励讲进了对应章节", () => {
    const text = allText(gardenGuide);
    expect(text).toContain("简笔图卡");
    expect(text).toContain("瓣尖发亮");
    expect(text).toContain("花园横条");
    // 第 1 轮的描红纠错口径不许回退
    expect(text).not.toContain("红圆点");
  });

  it("kitty-care：喂饭「同一套图卡」讲进了第一章攻略", () => {
    const chapter = kittyGuide.entries[0];
    expect(chapter.tips.join("\n")).toContain("同一套图卡");
    // general 被第 1 轮用例钉死 ≤6，本轮改动只落在章节 tips
    expect(kittyGuide.general.length).toBeLessThanOrEqual(6);
  });
});

describe("窗口8 第2轮 · 文案 ↔ 视觉一致性（说的必须是画出来的）", () => {
  it("race 文案的「红双丸子头 / 蓝帽舌反戴」真的注入了对应装饰层", () => {
    const red = trimRunnerSvg("<svg></svg>", "red");
    expect(red).toContain('data-duo-trim="red"');
    expect(red).toContain('data-trim="red-buns"');
    const blue = trimRunnerSvg("<svg></svg>", "blue");
    expect(blue).toContain('data-duo-trim="blue"');
    expect(blue).toContain('data-trim="blue-visor"');
  });

  it("race 文案的「红 1 号 / 蓝 2 号」与 RACE_LOOKS 背心号码一致", () => {
    expect(RACE_LOOKS.red.number).toBe(1);
    expect(RACE_LOOKS.blue.number).toBe(2);
  });

  it("farm 文案的「一枚贴纸就是一个」与数一数贴纸卡结构一致", () => {
    expect(hasSticker("🐮")).toBe(true);
    const html = renderCountIllustration({ emoji: "🐮", n: 5, name: "奶牛" });
    expect(html).toContain('data-n="5"');
    expect(html.split('data-unit="one"').length - 1).toBe(5);
  });

  it("garden 文案的「简笔图卡」真的画得出来（题面解析成贴纸计划）", () => {
    const plan = promptPicPlan("⛰️");
    expect(plan).not.toBeNull();
    expect(plan!.stickerCount).toBe(1);
    expect(sticker("⛰️", 58)).toContain("<svg");
  });

  it("garden 文案的「瓣尖发亮」与花瓣渐变方向一致（瓣根深 → 瓣尖亮）", () => {
    expect(PETAL_TIP_LIGHT).toBeGreaterThan(0);
    expect(PETAL_ROOT_DARK).toBeLessThan(0);
    const shaded = shadeFlower(flowerSvg({ cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[0] }), {
      cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[0], idPrefix: "w8r2copy",
    });
    expect(shaded).toContain("radialGradient");
    expect(shaded.split("<stop ").length - 1).toBe(2);
  });

  it("kitty 文案的「同一套图卡」成立：气泡与托盘都从 kit 贴纸图集取图", () => {
    expect(PROP_PX.bubble).toBeGreaterThan(0);
    expect(PROP_PX.food).toBeGreaterThan(0);
    // 全部九种食物 + 饭碗 + 逗猫棒都在同一本图集里
    for (const food of ALL_FOODS) {
      expect(hasSticker(food.emoji), `食物 ${food.name} 不在贴纸图集里`).toBe(true);
    }
    expect(hasSticker("🥣")).toBe(true);
    expect(hasSticker("🪶")).toBe(true);
  });
});
