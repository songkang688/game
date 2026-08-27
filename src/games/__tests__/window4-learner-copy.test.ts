/**
 * 窗口 4 · 第 1 轮学习优化员 —— 文案快照(1.3 视觉线索讲进攻略)。
 *
 * 学习优化员这一轮往 9 款攻略里各补了一条「看画面就能用」的提示,
 * 把 1.3 新画的视觉语言(流动箭头 / 出手圈变色 / 裂纹分级 / 传送门双色 /
 * 金块扫光 / 升级叶环 / 坚果缺口 / 彩虹上色条)明说给玩家。
 * 这里逐款钉住关键词:文案是跟着绘制代码写的,谁改了画法记得回来对词,
 * 别让攻略描述和画面对不上。
 *
 * 报告:docs/qa/1.3-window4-round1-learner.md 第五节。
 */
import { describe, expect, it } from "vitest";
import type { GuideBook } from "../../ui/level188Contract";

/** 把一整本攻略拍平成一段文字,方便 contains 断言 */
function flat(book: GuideBook): string {
  return [
    book.title,
    ...book.general,
    ...book.entries.flatMap((e) => [e.title, ...e.tips]),
  ].join("\n");
}

/** 游戏 id → 这条视觉线索必须出现的关键词(全部来自该款 1.3 的真实画法) */
const VISUAL_CUES: ReadonlyArray<{ id: string; cues: string[] }> = [
  // drawBoostPad 的流动箭头 + 双主角呆毛剪影 + drawPowerIcon 的四枚图标
  { id: "duo-rush", cues: ["箭头一直往前流", "花苞", "披风", "金星带弧线"] },
  // drawCourt 出手圈:前摇淡橙细圈 → 生效深橙加粗 + 外圈扩散
  { id: "duo-arena", cues: ["淡橙细圈", "深橙加粗"] },
  // drawCracks:wobble 越大裂纹越多(1→3 条)
  { id: "duo-vs-star", cues: ["裂纹就是倒计时", "三道"] },
  // drawBlockArt 残血分级:≤50% 一条折线,≤25% 再加三条放射纹
  { id: "sling-birds", cues: ["一条折线", "三条放射纹"] },
  // PORTAL_IN_COLOR 紫 / PORTAL_OUT_COLOR 青
  { id: "candy-swing", cues: ["紫色圈是进口", "青色圈是出口"] },
  // drawOre:金块家族独有的斜向扫光(约每 2 秒一趟)
  { id: "gold-hook", cues: ["斜斜的亮光"] },
  // drawLevelRing:2 级银叶环 / 3 级金叶环
  { id: "garden-guard", cues: ["银叶", "金叶"] },
  // drawPlantIcon 坚果三档缺口 + 担忧表情
  { id: "sprout-defense", cues: ["缺口", "担忧的表情"] },
  // drawMonster 的彩虹上色条 + drawFarewell 开心离场
  { id: "monster-crisis", cues: ["彩虹条", "小云朵"] },
];

describe("窗口4 学习优化员:9 款攻略都讲明了 1.3 的视觉线索", () => {
  for (const { id, cues } of VISUAL_CUES) {
    it(`${id} 的攻略里能找到视觉线索关键词`, async () => {
      const mod = (await import(`../${id}/guide.ts`)) as { default: GuideBook };
      const text = flat(mod.default);
      for (const cue of cues) {
        expect(text, `${id} 攻略缺关键词「${cue}」`).toContain(cue);
      }
    });
  }
});
