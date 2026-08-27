/**
 * 窗口 2 · 1.3 第 1 轮学习优化员（B 档）的文案快照。
 *
 * 本轮往本窗 9 款的攻略里各加了一句「把 1.3 新视觉讲进引导」的提示
 * （星级角标 / 种子点 / 枯叶 / 瞳孔看路 / 担忧脸 / 阵营压印 / 军衔条 / 小绿芽红三角 / 战力点与炮弧）。
 * 这里把每一句逐字钉死，防止后续轮次把视觉引导改丢；同时复查这些新句子
 * 本身不踩红线（不吓人、无商标、360px 一行放得下）。
 */
import { describe, expect, it } from "vitest";
import chessGuide from "../chess-garden/guide";
import darkGuide from "../dark-chess/guide";
import dotGuide from "../dot-maze/guide";
import fruitGuide from "../fruit-stack/guide";
import junqiGuide from "../junqi-camp/guide";
import mergeGuide from "../merge-2048/guide";
import mineGuide from "../mine-garden/guide";
import poolGuide from "../pool-stars/guide";
import sudokuGuide from "../sudoku-petal/guide";

/** gameId → 本轮新增的那（几）句视觉引导，逐字快照 */
const ADDED: ReadonlyArray<[string, typeof mergeGuide, readonly string[]]> = [
  ["merge-2048", mergeGuide, ["块角上的小星星是段位:铜星、银星、金星一路升,合到 2048 亮彩虹星。"]],
  [
    "mine-garden",
    mineGuide,
    [
      "数字底下还有一排小种子点：数一数几颗、认一认圆菱方，不靠颜色也分得清。",
      "大田下方有一张花园鸟瞰小图，横着拖之前先瞄它一眼认方向。"
    ]
  ],
  ["sudoku-petal", sudokuGuide, ["冲突的格子除了变红,还会摆出一片卷边枯叶,看形状也认得出来。"]],
  ["dot-maze", dotGuide, ["小幽灵的瞳孔会顺着跑动方向看路，盯住眼睛就能猜到它下一步。"]],
  ["fruit-stack", fruitGuide, ["果子们全体睁眼皱眉,就是堆得太高的信号,先消掉最顶上那一层。"]],
  ["pool-stars", poolGuide, ["认不清颜色就看压印:朵朵的暖组球印小花,星星的冷组球印五角星。"]],
  ["junqi-camp", junqiGuide, ["认不得字也不怕：军衔条上三颗星就是司令，数星星数杠杠比大小。"]],
  ["chess-garden", chessGuide, ["亮起的格子里冒小绿芽是能走的位置，四角红三角的格子能吃子。"]],
  [
    "dark-chess",
    darkGuide,
    [
      "记不住就数棋面汉字下那排小圆点：将 7 点、兵 1 点，点多请点少。",
      "棋面上带一道虚线小弧的就是炮，看到这道弧就想起要隔一个打。"
    ]
  ]
];

/** 分级红线：新句子里一个吓人的字都不许有 */
const SCARY = ["死", "血", "尸", "阵亡", "牺牲", "伤害", "恐怖", "笨", "太差"];

/** 商标黑名单抽查（全量扫描在各款自己的 copy/smoke 用例里，这里只兜底新句子） */
const BRANDS = ["4399", "马里奥", "皮卡丘", "托马斯", "hello kitty", "吃豆人", "pac-man", "俄罗斯方块"];

describe("窗口2 · r1 学习优化员 · 视觉引导文案快照", () => {
  it("九款的新句子逐字都在攻略里（快照锁定，改丢即红）", () => {
    for (const [id, guide, lines] of ADDED) {
      expect(guide.gameId).toBe(id);
      const tips = guide.entries.flatMap((e) => e.tips);
      for (const line of lines) {
        expect(tips, `${id} 丢了视觉引导句:${line}`).toContain(line);
      }
    }
  });

  it("每一句都讲到了看得见的视觉线索，不是空话", () => {
    // 每句至少点名一个具体的视觉元素（星星/种子点/枯叶/瞳孔/皱眉/压印/军衔条/绿芽/圆点/弧）
    const cueWords = ["星", "种子点", "枯叶", "瞳孔", "皱眉", "压印", "军衔条", "绿芽", "圆点", "弧", "小图"];
    for (const [id, , lines] of ADDED) {
      for (const line of lines) {
        expect(
          cueWords.some((w) => line.includes(w)),
          `${id} 的新句子没点名视觉元素:${line}`
        ).toBe(true);
      }
    }
  });

  it("新句子不踩分级红线，也不蹭任何商标", () => {
    for (const [id, , lines] of ADDED) {
      for (const line of lines) {
        for (const bad of SCARY) {
          expect(line.includes(bad), `${id} 新句子里出现了「${bad}」`).toBe(false);
        }
        const low = line.toLowerCase();
        for (const bad of BRANDS) {
          expect(low.includes(bad), `${id} 新句子里出现了「${bad}」`).toBe(false);
        }
      }
    }
  });

  it("每一句 360px 一行放得下（≤ 64 字），且不打破各款攻略的结构契约", () => {
    for (const [id, guide, lines] of ADDED) {
      for (const line of lines) {
        expect(line.length, `${id} 的新句子太长:${line}`).toBeLessThanOrEqual(64);
      }
      // 结构契约与各款既有用例同口径：八章、区间首尾相接、每章至少 2 条 tips
      expect(guide.entries, `${id} 章节数变了`).toHaveLength(8);
      expect(guide.general.length, `${id} 通用心得超出 3–6 条`).toBeGreaterThanOrEqual(3);
      expect(guide.general.length, `${id} 通用心得超出 3–6 条`).toBeLessThanOrEqual(6);
      for (const e of guide.entries) {
        expect(e.tips.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
