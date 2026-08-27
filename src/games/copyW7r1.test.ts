/**
 * 窗口 7 · 第 1 轮视觉验收 · B 档学习优化员的文案快照(只钉文案,不碰玩法)。
 *
 * 1.3 视觉升级后,九款的引导文案把新视觉亮点讲了进去(剪影认物 / 高光下刀 /
 * 披风认人 / 接缝白光 / 涟漪加密 …)。这里把每一处新增文案钉死:
 *  - 新增的视觉引导句在 guide / blurb 里必须在;
 *  - 旧有的关键事实词(188 / 迷宫 / 提示 / 图鉴)一个不许丢;
 *  - 新句子逐条过 copy.test.ts 同款商标 / 低幼黑名单(双保险);
 *  - guide.general 条数仍在全库契约的 3–6 之间。
 */
import { describe, expect, it } from "vitest";
import { BABY_TALK_WORDS, BRAND_WORDS } from "./copy.test";

import fcGuide from "./fruit-catch/guide";
import { meta as fcMeta } from "./fruit-catch/meta";
import fsGuide from "./fruit-slice/guide";
import { meta as fsMeta } from "./fruit-slice/meta";
import ssGuide from "./snake-snack/guide";
import { meta as ssMeta } from "./snake-snack/meta";
import llkGuide from "./lianliankan/guide";
import { meta as llkMeta } from "./lianliankan/meta";
import ptGuide from "./puzzle-tiles/guide";
import { meta as ptMeta } from "./puzzle-tiles/meta";
import mcGuide from "./memory-cards/guide";
import ldGuide from "./landlord-cards/guide";
import { meta as ldMeta } from "./landlord-cards/meta";
import fshGuide from "./fishing-star/guide";
import phGuide from "./poop-hero/guide";
import { meta as phMeta } from "./poop-hero/meta";

/** 一本攻略的全部文字(标题 + 通用心得 + 各章 tips)拼一串,好做包含断言 */
function guideText(g: { title: string; general: readonly string[]; entries: readonly { title: string; tips: readonly string[] }[] }): string {
  return [g.title, ...g.general, ...g.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
}

/** 本轮新增 / 改写的每一句文案(与 learner 报告第五节逐条对应) */
const NEW_LINES: ReadonlyArray<readonly [string, string]> = [
  ["fruit-catch/guide", "皱眉的小乌云和弯身的小辣椒,剪影和水果完全不同"],
  ["fruit-catch/blurb", "手绘渐变小水果掉进编织藤篮"],
  ["fruit-slice/guide", "看清果身高光再切"],
  ["fruit-slice/blurb", "六种果子六种手绘切面"],
  ["snake-snack/guide", "绿虫跟你按的左右方向一致,粉虫永远反着挪"],
  ["snake-snack/blurb", "大眼睛的圆节毛毛虫领路"],
  ["lianliankan/guide", "把「形状」和「颜色」一起记"],
  ["lianliankan/blurb", "原创手绘图标牌面"],
  ["puzzle-tiles/guide", "拼块接缝会闪一道白光"],
  ["puzzle-tiles/blurb", "拼块带纸纹齿边像真拼图"],
  ["memory-cards/guide", "配对成功的牌会盖上一枚星星印章"],
  ["landlord-cards/guide", "大王金边立绘、小王银边立绘"],
  ["landlord-cards/blurb", "手绘牌面、金银大小王立绘"],
  ["fishing-star/guide", "浮标往下点头、水面的涟漪突然变密"],
  ["poop-hero/guide", "朵朵是粉披风配蓝衣,星星是蓝披风配粉衣"],
  ["poop-hero/blurb", "街道、公园、星空屋顶三套街景轮着换"],
];

const TEXT_OF: Readonly<Record<string, string>> = {
  "fruit-catch/guide": guideText(fcGuide),
  "fruit-catch/blurb": fcMeta.blurb,
  "fruit-slice/guide": guideText(fsGuide),
  "fruit-slice/blurb": fsMeta.blurb,
  "snake-snack/guide": guideText(ssGuide),
  "snake-snack/blurb": ssMeta.blurb,
  "lianliankan/guide": guideText(llkGuide),
  "lianliankan/blurb": llkMeta.blurb,
  "puzzle-tiles/guide": guideText(ptGuide),
  "puzzle-tiles/blurb": ptMeta.blurb,
  "memory-cards/guide": guideText(mcGuide),
  "landlord-cards/guide": guideText(ldGuide),
  "landlord-cards/blurb": ldMeta.blurb,
  "fishing-star/guide": guideText(fshGuide),
  "poop-hero/guide": guideText(phGuide),
  "poop-hero/blurb": phMeta.blurb,
};

describe("W7R1 · 文案把 1.3 新视觉讲进了引导", () => {
  it("十六处新增文案一处不少", () => {
    for (const [where, phrase] of NEW_LINES) {
      expect(TEXT_OF[where], `${where} 缺了新视觉文案「${phrase}」`).toContain(phrase);
    }
  });

  it("新句子逐条过商标与低幼黑名单", () => {
    for (const [where, phrase] of NEW_LINES) {
      const low = phrase.toLowerCase();
      for (const w of BRAND_WORDS) {
        expect(low.includes(w.toLowerCase()), `${where} 的新句子沾了商标「${w}」`).toBe(false);
      }
      for (const w of BABY_TALK_WORDS) {
        expect(phrase.includes(w), `${where} 的新句子过低幼「${w}」`).toBe(false);
      }
    }
  });
});

describe("W7R1 · 旧有关键事实词一个不丢", () => {
  it("blurb 里的既有事实词保住", () => {
    expect(fcMeta.blurb).toContain("188");
    expect(fsMeta.blurb).toContain("188");
    expect(ssMeta.blurb).toContain("迷宫");
    expect(ssMeta.blurb).not.toContain("大作战");
    expect(llkMeta.blurb).toContain("188");
    expect(llkMeta.blurb).toContain("提示");
    expect(ptMeta.blurb).toContain("188");
    expect(ldMeta.blurb).toContain("提示");
    expect(ldMeta.blurb).toContain("188");
    expect(phMeta.blurb).toContain("三色桶");
  });

  it("guide.general 条数仍在 3–6 的全库契约里", () => {
    for (const g of [fcGuide, fsGuide, ssGuide, llkGuide, ptGuide, mcGuide, ldGuide, fshGuide, phGuide]) {
      expect(g.general.length, `${g.gameId} 的通用心得条数越界`).toBeGreaterThanOrEqual(3);
      expect(g.general.length, `${g.gameId} 的通用心得条数越界`).toBeLessThanOrEqual(6);
    }
  });

  it("文案描述与视觉常量对得上:披风配色 / 双虫配色", () => {
    // poop-hero:朵朵粉披风蓝衣、星星蓝披风粉衣(visual.ts HERO_VIS)
    return Promise.all([
      import("./poop-hero/visual"),
      import("./snake-snack/visual13"),
    ]).then(([ph, ss]) => {
      expect(ph.HERO_VIS[0].name).toBe("朵朵");
      expect(ph.HERO_VIS[0].capeOut0).toBe("#F4859F"); // 粉披风
      expect(ph.HERO_VIS[0].suit).toBe("#7FB2F0"); // 蓝衣
      expect(ph.HERO_VIS[1].name).toBe("星星");
      expect(ph.HERO_VIS[1].capeOut0).toBe("#7FA9F0"); // 蓝披风
      expect(ph.HERO_VIS[1].suit).toBe("#F490AC"); // 粉衣
      // snake-snack:绿虫 / 粉虫两套主色确实不同
      expect(ss.SS_WORM_GREEN.bodyA).not.toBe(ss.SS_WORM_PINK.bodyA);
      expect(ss.SS_WORM_GREEN.head).not.toBe(ss.SS_WORM_PINK.head);
    });
  });
});
