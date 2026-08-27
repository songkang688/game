/**
 * 窗口 6 · 第 1 轮 · B 档学习优化员 · 文案快照测试。
 *
 * 本轮给 9 款升级款的攻略各加了一条「把 1.3 新视觉讲进引导」的通用心得
 * (报告见 docs/qa/1.3-window6-round1-learner.md 第五节)。这里把每条新文案
 * 钉住:视觉关键词在、条数不超过 3–6 契约、不碰商标与低幼黑名单。
 * 只测文案,不 import 任何绘制或玩法代码。
 */
import { describe, expect, it } from "vitest";
import bravePath from "./brave-path/guide";
import adventureKing from "./adventure-king/guide";
import alienSeek from "./alien-seek/guide";
import brickBreak from "./brick-break/guide";
import molePop from "./mole-pop/guide";
import boxHamster from "./box-hamster/guide";
import balloonPop from "./balloon-pop/guide";
import bubblePop from "./bubble-pop/guide";
import bubbleAim from "./bubble-aim/guide";
import type { GuideBook } from "../ui/level188Contract";

/** 每款新增的视觉引导心得:命中关键词就算钉住(与真实绘制事实一一对应) */
const VISUAL_TIPS: ReadonlyArray<{ book: GuideBook; must: RegExp; why: string }> = [
  { book: bravePath, must: /徽章/, why: "花徽 vs 星徽的剪影认人(badge kit)" },
  { book: adventureKing, must: /微光|光柱/, why: "锚点金色微光 + 文物光柱(anchorGlow / drawArtifactSprite)" },
  { book: alienSeek, must: /轮廓/, why: "六只外星朋友剪影级差异(alienSilhouette)" },
  { book: brickBreak, must: /裂纹/, why: "多血砖裂纹层数(candyBrick crackPaths)" },
  { book: molePop, must: /装备/, why: "盾/帽第一下敲飞装备(gearFor 剩余≥2 才亮装备)" },
  { book: boxHamster, must: /耳朵|礼物盒/, why: "耳形双通道 + 礼物盒金边(hamsterSvg / giftSvg)" },
  { book: balloonPop, must: /铆钉|球皮/, why: "铁壳纵纹铆钉(ironSkin)/礼盒(giftBoxSvg)" },
  { book: bubblePop, must: /图案/, why: "五色 ●▲■★♥ 图案双通道(BP_MARKS)" },
  { book: bubbleAim, must: /记号|高光/, why: "色觉专属记号 + 高光(paintColorMark / paintBubble)" },
];

describe("窗口6 R1 学习优化员 · 视觉引导文案钉住", () => {
  it("9 款攻略各有一条讲 1.3 新视觉的通用心得", () => {
    for (const { book, must, why } of VISUAL_TIPS) {
      const hit = book.general.some((tip) => must.test(tip));
      expect(hit, `${book.gameId} 的攻略缺视觉引导心得(${why})`).toBe(true);
    }
  });

  it("加完之后通用心得仍守 3–6 条契约", () => {
    for (const { book } of VISUAL_TIPS) {
      expect(book.general.length, `${book.gameId} 通用心得条数越界`).toBeGreaterThanOrEqual(3);
      expect(book.general.length, `${book.gameId} 通用心得条数越界`).toBeLessThanOrEqual(6);
    }
  });

  it("新文案不沾商标黑名单,也不奶声奶气(全量黑名单另有 copy.test.ts 兜底)", () => {
    // 本题材最容易被联想到的商标词 + 低幼词抽样;完整黑名单巡检在 copy.test.ts,
    // 这里不 import 那份测试文件(避免其用例被二次注册),只做贴题抽查。
    const spot = [
      "皮卡丘", "宝可梦", "马里奥", "塞尔达", "米奇", "佩奇", "汤姆猫",
      "mario", "pokemon", "kirby", "tetris",
      "宝宝", "乖乖", "笨蛋", "萌萌哒", "棒棒哒",
    ];
    for (const { book } of VISUAL_TIPS) {
      for (const tip of book.general) {
        const low = tip.toLowerCase();
        for (const w of spot) {
          expect(low.includes(w.toLowerCase()), `${book.gameId} 心得踩词「${w}」:${tip}`).toBe(false);
        }
      }
    }
  });

  it("既有内容级断言未被文案改动破坏(星芒仍在勇者小路攻略里)", () => {
    const all = [
      ...bravePath.general,
      ...bravePath.entries.flatMap((e) => [e.title, ...e.tips]),
    ];
    expect(all.some((l) => l.includes("星芒"))).toBe(true);
  });
});
