/**
 * 窗口 6 · 第 2 轮 · B 档学习优化员 · 文案快照测试。
 *
 * 本轮把 C 档第 1 轮修复的视觉亮点讲进对应章节的攻略提示
 * (报告见 docs/qa/1.3-window6-round2-learner.md 第六节):
 * 迷宫拾取物徽章 / 文物纹石与门上清单 / 胶囊图标 / 闪光鼠天线星 /
 * 铁盔钢护面 / 瞌睡泡串 / 夜场月牙布景 / 特殊球几何徽记 / 舞台底纹 /
 * 双鼠侧背认人(W6R2-01 的文案级兜底)。
 * 只测文案,不 import 任何绘制或玩法代码;第 1 轮的 general 钉子在
 * window6.r1.learner.copy.test.ts 里继续跑,这里只钉本轮新增。
 */
import { describe, expect, it } from "vitest";
import bravePath from "./brave-path/guide";
import adventureKing from "./adventure-king/guide";
import brickBreak from "./brick-break/guide";
import molePop from "./mole-pop/guide";
import boxHamster from "./box-hamster/guide";
import balloonPop from "./balloon-pop/guide";
import type { GuideBook } from "../ui/level188Contract";

/** 一本攻略里的全部文字(通用心得 + 各章标题与提示) */
function allLines(book: GuideBook): string[] {
  return [
    ...book.general,
    ...book.entries.flatMap((e) => [e.title, ...e.tips]),
  ];
}

/** 本轮每处文案改动:命中关键词就算钉住(与真实绘制事实一一对应) */
const R2_PINS: ReadonlyArray<{ book: GuideBook; must: RegExp; why: string }> = [
  { book: bravePath, must: /终点旗.*徽章|徽章.*终点旗/, why: "迷宫拾取物换徽章族(mazeItemSvg 钥匙/门/锁/终点)" },
  { book: adventureKing, must: /日纹石.*菱形/, why: "三种纹石剪影(gemOutline 日菱/月六边/星圆珠)" },
  { book: adventureKing, must: /三格小清单/, why: "首领之门收集清单(drawArtifactGem 实色/25% 透明)" },
  { book: brickBreak, must: /空心圈.*向内收箭头|向内收箭头.*空心圈/, why: "缩板胶囊空心圈 + 内收箭头(capsuleLook / drawCapsuleIcon)" },
  { book: brickBreak, must: /U 形磁铁/, why: "六种胶囊双色矢量图标(drawCapsuleIcon)" },
  { book: molePop, must: /瞌睡泡/, why: "瞌睡鼠加粗闭眼弧 + 描边瞌睡泡(drowseBoldGroup)" },
  { book: molePop, must: /天线/, why: "闪光鼠头顶天线星(flashCrestGroup)" },
  { book: molePop, must: /冷灰钢色/, why: "铁盔鼠钢护面(shieldSteelGroup)" },
  { book: molePop, must: /月牙/, why: "夜场月牙与星子布景(nightSceneSvg,栅栏线以上)" },
  { book: balloonPop, must: /云朵小徽记/, why: "乌云球白底云朵徽记(kindBadgeSvg cloud)" },
  { book: balloonPop, must: /三个小圆连成一排/, why: "连锁球三连小圆徽记(kindBadgeSvg chain)" },
  { book: balloonPop, must: /盾形白底小徽记/, why: "护盾球盾形徽记(kindBadgeSvg iron)" },
  { book: boxHamster, must: /底纹/, why: "舞台底纹三主题(BH_THEMES mat,布景不影响走路)" },
  { book: boxHamster, must: /呆毛/, why: "双鼠侧背朝向认人的文案级兜底(W6R2-01:毛色+顶饰双通道)" },
];

describe("窗口6 R2 学习优化员 · 视觉亮点文案钉住", () => {
  it("C 档第 1 轮修复的视觉亮点已讲进对应款的攻略", () => {
    for (const { book, must, why } of R2_PINS) {
      const hit = allLines(book).some((line) => must.test(line));
      expect(hit, `${book.gameId} 的攻略缺本轮视觉亮点文案(${why})`).toBe(true);
    }
  });

  it("通用心得仍守 3–6 条契约(本轮只加章节提示,不动 general 条数)", () => {
    const books = [bravePath, adventureKing, brickBreak, molePop, boxHamster, balloonPop];
    for (const book of books) {
      expect(book.general.length, `${book.gameId} 通用心得条数越界`).toBeGreaterThanOrEqual(3);
      expect(book.general.length, `${book.gameId} 通用心得条数越界`).toBeLessThanOrEqual(6);
    }
  });

  it("本轮新文案(含全部章节提示)不沾商标黑名单,也不奶声奶气", () => {
    // 贴题抽查(完整黑名单巡检在 copy.test.ts,那边会自动覆盖 guide 全量文字);
    // 这里把第 1 轮只查 general 的口径扩到章节提示,量级上只增不减。
    const spot = [
      "皮卡丘", "宝可梦", "马里奥", "塞尔达", "米奇", "佩奇", "汤姆猫",
      "泡泡龙", "哈姆太郎", "吃豆人",
      "mario", "pokemon", "kirby", "tetris", "kitty", "arkanoid",
      "宝宝", "乖乖", "笨蛋", "萌萌哒", "棒棒哒",
    ];
    const books = [bravePath, adventureKing, brickBreak, molePop, boxHamster, balloonPop];
    for (const book of books) {
      for (const line of allLines(book)) {
        const low = line.toLowerCase();
        for (const w of spot) {
          expect(low.includes(w.toLowerCase()), `${book.gameId} 文案踩词「${w}」:${line}`).toBe(false);
        }
      }
    }
  });

  it("第 1 轮的视觉引导心得没有被 rebase 冲掉(6 款抽验)", () => {
    // r1 测试文件整体还在跑;这里再抽 6 款钉一次,双保险防误删。
    expect(bravePath.general.some((t) => /徽章/.test(t))).toBe(true);
    expect(adventureKing.general.some((t) => /微光|光柱/.test(t))).toBe(true);
    expect(brickBreak.general.some((t) => /裂纹/.test(t))).toBe(true);
    expect(molePop.general.some((t) => /装备/.test(t))).toBe(true);
    expect(boxHamster.general.some((t) => /耳朵|礼物盒/.test(t))).toBe(true);
    expect(balloonPop.general.some((t) => /铆钉|球皮/.test(t))).toBe(true);
  });

  it("新章节提示不触发答案过滤器(一条都不会被隐藏)", async () => {
    const { stripAnswerLeaks } = await import("../ui/guide");
    const books = [bravePath, adventureKing, brickBreak, molePop, boxHamster, balloonPop];
    for (const book of books) {
      for (const entry of book.entries) {
        expect(
          stripAnswerLeaks(entry.tips).length,
          `${book.gameId}「${entry.title}」有提示被答案过滤器拦掉`
        ).toBe(entry.tips.length);
      }
    }
  });
});
