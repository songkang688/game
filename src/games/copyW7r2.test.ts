/**
 * 窗口 7 · 第 2 轮视觉验收 · B 档学习优化员的文案快照(只钉文案,不碰玩法)。
 *
 * 第 1 轮 C 档把五处视觉严重项换成了自绘(场景画切片 / 小牌灵头像 / 香香星 /
 * 18 款垃圾条目 / 果王皇冠 + 星星发卡),本轮把这些新视觉亮点讲进对应款的引导。
 * 这里把每一处新增文案钉死,并和视觉/玩法常量互证,防止文案吹牛:
 *  - 新增的视觉引导句在 guide / blurb 里必须在;
 *  - 第 1 轮 copyW7r1 钉的关键短语一个不许因本轮改写而丢(改写只做「保留 + 追加」);
 *  - 新句子逐条过 copy.test.ts 同款商标 / 低幼黑名单;
 *  - 文案里的事实(果王珠色身份 / 垃圾归桶 / 头像双形)与源码常量对表。
 */
import { describe, expect, it } from "vitest";
import { BABY_TALK_WORDS, BRAND_WORDS } from "./copy.test";

import fsGuide from "./fruit-slice/guide";
import ptGuide from "./puzzle-tiles/guide";
import { meta as ptMeta } from "./puzzle-tiles/meta";
import ldGuide from "./landlord-cards/guide";
import phGuide from "./poop-hero/guide";

/** 一本攻略的全部文字(标题 + 通用心得 + 各章 tips)拼一串,好做包含断言 */
function guideText(g: { title: string; general: readonly string[]; entries: readonly { title: string; tips: readonly string[] }[] }): string {
  return [g.title, ...g.general, ...g.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
}

/** 本轮新增 / 改写的每一句文案(与 learner 报告第六节逐条对应) */
const NEW_LINES: ReadonlyArray<readonly [string, string]> = [
  ["puzzle-tiles/blurb", "每关拼的都是一整幅手绘场景画"],
  ["puzzle-tiles/guide", "天上一轮光斑、远近两条坡带"],
  ["puzzle-tiles/guide", "干扰块画的是同一族画稿的另一种配色"],
  ["landlord-cards/guide", "团团竖着两只长耳朵,圆圆是圆耳朵加黑眼圈"],
  ["poop-hero/guide", "金灿灿的小星星自带一圈柔光"],
  ["poop-hero/guide", "星星头上还别着一枚小星星发卡"],
  ["poop-hero/guide", "水瓶、易拉罐这些能回收的投蓝桶,香蕉皮、菜叶进绿桶"],
  ["fruit-slice/guide", "蓝珠的是回旋果王、粉珠的是令牌果王、金珠的是压轴的大果王"],
];

const TEXT_OF: Readonly<Record<string, string>> = {
  "puzzle-tiles/blurb": ptMeta.blurb,
  "puzzle-tiles/guide": guideText(ptGuide),
  "landlord-cards/guide": guideText(ldGuide),
  "poop-hero/guide": guideText(phGuide),
  "fruit-slice/guide": guideText(fsGuide),
};

describe("W7R2 · 文案把 R1 修复的视觉亮点讲进了引导", () => {
  it("八处新增文案一处不少", () => {
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

  it("第 1 轮钉过的短语在本轮改写后原样保留(只追加不覆盖)", () => {
    // 本轮动过的三句都是「保留 R1 短语 + 追加新亮点」,这里把保留部分再钉一遍
    expect(ptMeta.blurb).toContain("拼块带纸纹齿边像真拼图");
    expect(TEXT_OF["poop-hero/guide"]).toContain("朵朵是粉披风配蓝衣,星星是蓝披风配粉衣");
    expect(TEXT_OF["landlord-cards/guide"]).toContain("大王金边立绘、小王银边立绘");
  });

  it("guide.general 条数仍在 3–6 的全库契约里", () => {
    for (const g of [fsGuide, ptGuide, ldGuide, phGuide]) {
      expect(g.general.length, `${g.gameId} 的通用心得条数越界`).toBeGreaterThanOrEqual(3);
      expect(g.general.length, `${g.gameId} 的通用心得条数越界`).toBeLessThanOrEqual(6);
    }
  });
});

describe("W7R2 · 文案与视觉/玩法常量互证,不许吹牛", () => {
  it("果王珠色身份:蓝=回旋 / 粉=令牌 / 金=大果王,与 kingBeadColor 对表", () => {
    return import("./fruit-slice/visual").then(({ kingBeadColor }) => {
      const rgb = (hex: string): [number, number, number] => {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      // 回旋果王(无 decrees / flips)蓝珠:B 分量最大
      const [sr, , sb] = rgb(kingBeadColor({}));
      expect(sb, "回旋果王的珠色应是蓝色系").toBeGreaterThan(sr);
      // 令牌果王(decrees)粉珠:R > B
      const [dr, , db] = rgb(kingBeadColor({ decrees: true }));
      expect(dr, "令牌果王的珠色应是粉色系").toBeGreaterThan(db);
      // 大果王(flips,哪怕同时 decrees)金珠:R ≈ G 高、B 低
      const [gr, gg, gb] = rgb(kingBeadColor({ flips: true, decrees: true }));
      expect(gr, "大果王的珠色应是暖金色系").toBeGreaterThan(gb);
      expect(gg, "大果王的珠色应是暖金色系").toBeGreaterThan(gb);
      // 三色互不相同,身份通道成立
      expect(new Set([kingBeadColor({}), kingBeadColor({ decrees: true }), kingBeadColor({ flips: true })]).size).toBe(3);
    });
  });

  it("垃圾归桶事实:水瓶 / 易拉罐进蓝桶(可回收),香蕉皮 / 菜叶进绿桶(厨余)", () => {
    return import("./poop-hero/trash").then(({ binOf }) => {
      expect(binOf("bottle")).toBe("recycle");
      expect(binOf("can")).toBe("recycle");
      expect(binOf("banana")).toBe("kitchen");
      expect(binOf("leaf")).toBe("kitchen");
    });
  });

  it("小牌灵头像双形:团团长耳 / 圆圆圆耳加眼周深色块,两张 SVG 确实不同", () => {
    return import("./landlord-cards/visual").then(({ botFaceSvg }) => {
      const tt = botFaceSvg("tuantuan");
      const yy = botFaceSvg("yuanyuan");
      expect(tt).not.toBe(yy);
      // 团团的长耳:竖椭圆 ry 明显大于 rx(耳长 ≈ 脸径 0.7)
      expect(tt).toContain('ry="5.6"');
      // 圆圆的眼周深色椭圆(黑眼圈)与深色圆耳
      expect(yy).toContain("#4A4A55");
      // 都不再是 emoji 字符
      expect(tt.includes("🐰")).toBe(false);
      expect(yy.includes("🐼")).toBe(false);
    });
  });

  it("星星发卡与香香星文案有视觉源:HERO_VIS 双人仍是粉/蓝披风互撞", () => {
    return import("./poop-hero/visual").then(({ HERO_VIS }) => {
      expect(HERO_VIS[0].name).toBe("朵朵");
      expect(HERO_VIS[1].name).toBe("星星");
      // 文案「凭披风认人」的前提:两人披风主色不同
      expect(HERO_VIS[0].capeOut0).not.toBe(HERO_VIS[1].capeOut0);
    });
  });
});
