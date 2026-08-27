/**
 * 窗口 2 · 1.3 第 2 轮学习优化员（B 档）的文案快照。
 *
 * 第 1 轮 C 档修出了一批看得见的视觉成果（junqi 花/星角标、fruit-stack 盆沿座位色、
 * dot-maze 幽灵三尖裙边加呆毛、mine-garden 小地图收放、dark-chess 窄屏点数收纳、
 * chess-garden 坐标小字提级）。本轮把这些亮点各用孩子能懂的一句话写进对应款攻略，
 * 这里逐字钉死，防止后续轮次改丢；同时复查新句子不踩红线（不吓人、无商标、一行放得下）。
 * 第 1 轮的 11 句由 window2-r1-learner-copy.test.ts 继续看守，两份互不替代。
 */
import { describe, expect, it } from "vitest";
import chessGuide from "../chess-garden/guide";
import darkGuide from "../dark-chess/guide";
import dotGuide from "../dot-maze/guide";
import fruitGuide from "../fruit-stack/guide";
import junqiGuide from "../junqi-camp/guide";
import mineGuide from "../mine-garden/guide";

/** gameId → 本轮新增的那一句视觉引导（对应 C 档 r1 修复的绘制成果），逐字快照 */
const ADDED: ReadonlyArray<[string, typeof junqiGuide, string]> = [
  // C r1 #3（A 3-1 严重）：sideMarkSVG 左下角形状角标——朵朵圆瓣花 / 星星尖角星
  ["junqi-camp", junqiGuide, "翻开的棋面左下角还有小记号：小花是朵朵的兵，小星星是星星的兵。"],
  // C r1 #1（A 5-1 阻断）：.mn-mini[hidden]{display:none}——小地图只陪宽盘出场，窄盘零占位
  ["mine-garden", mineGuide, "小地图只陪装不下一屏的大田出场，它不见了就说明整张田都在眼前。"],
  // dark-chess ≤400px 断点：.dc-face g.dcd{display:none}——窄屏收起战力点只留汉字
  ["dark-chess", darkGuide, "屏幕太窄时棋面会先藏起小圆点、只留大汉字，换宽一点的屏它们就回来。"],
  // C r1 #13（A 6-1 / B #6）：drawGhostFigure 三尖裙边 + 头顶呆毛——自家幽灵剪影
  ["dot-maze", dotGuide, "它头顶翘着一根小呆毛，裙边是三个波浪尖——这是豆豆迷宫自家的小幽灵。"],
  // C r1 #14（B #9）：drawRim 盆口 3px 座位色内衬（#a8306a / #28568f）
  ["fruit-stack", fruitGuide, "认盆看盆口的色边:玫红边是朵朵的盆,深蓝边是星星的盆,余光一扫就分清。"],
  // C r1 #7（A 5-3）：cg-coord 底排 a–h、左列 1–8 提级到 10.5px 加粗
  ["chess-garden", chessGuide, "棋盘下边一排 a 到 h、左边一列 1 到 8 的小字是格子的门牌，攻略说的线照它找。"]
];

/** 分级红线：新句子里一个吓人的字都不许有 */
const SCARY = ["死", "血", "尸", "阵亡", "牺牲", "伤害", "恐怖", "笨", "太差"];

/** 商标黑名单抽查（全量扫描在 copy.test.ts，这里只兜底新句子） */
const BRANDS = ["4399", "马里奥", "皮卡丘", "托马斯", "hello kitty", "吃豆人", "pac-man", "俄罗斯方块"];

describe("窗口2 · r2 学习优化员 · C 档视觉成果引导文案快照", () => {
  it("六款的新句子逐字都在攻略里（快照锁定，改丢即红）", () => {
    for (const [id, guide, line] of ADDED) {
      expect(guide.gameId).toBe(id);
      const tips = guide.entries.flatMap((e) => e.tips);
      expect(tips, `${id} 丢了视觉引导句:${line}`).toContain(line);
    }
  });

  it("每一句都点名一个 C 档修出来的可见元素，不是空话", () => {
    const cueWords = ["小记号", "小地图", "小圆点", "呆毛", "色边", "门牌"];
    for (const [id, , line] of ADDED) {
      expect(
        cueWords.some((w) => line.includes(w)),
        `${id} 的新句子没点名视觉元素:${line}`
      ).toBe(true);
    }
  });

  it("新句子不踩分级红线，也不蹭任何商标", () => {
    for (const [id, , line] of ADDED) {
      for (const bad of SCARY) {
        expect(line.includes(bad), `${id} 新句子里出现了「${bad}」`).toBe(false);
      }
      const low = line.toLowerCase();
      for (const bad of BRANDS) {
        expect(low.includes(bad), `${id} 新句子里出现了「${bad}」`).toBe(false);
      }
    }
  });

  it("每一句 360px 一行放得下（≤ 64 字），且不打破各款攻略的结构契约", () => {
    for (const [id, guide, line] of ADDED) {
      expect(line.length, `${id} 的新句子太长:${line}`).toBeLessThanOrEqual(64);
      // 结构契约与各款既有用例同口径：八章、每章至少 2 条 tips、通用心得 3–6 条
      expect(guide.entries, `${id} 章节数变了`).toHaveLength(8);
      expect(guide.general.length, `${id} 通用心得超出 3–6 条`).toBeGreaterThanOrEqual(3);
      expect(guide.general.length, `${id} 通用心得超出 3–6 条`).toBeLessThanOrEqual(6);
      for (const e of guide.entries) {
        expect(e.tips.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
