/**
 * 窗口 2 · 1.3 第 3 轮（终验）学习优化员（B 档）的文案终查快照。
 *
 * 终验轮文案零改动（r1 的 11 句 + r2 的 6 句逐句 grep 复核全部在位，未被 rebase 冲掉），
 * 本文件做三件收官的事，与 r1 / r2 两份快照互不替代：
 *  1. 把两轮 17 句视觉引导合成一张跨轮总账逐字钉死——任何一轮的句子丢一句即红，
 *     不用再分头去查两份旧快照的差集；
 *  2. 首页入口卡片文案（本窗 9 款 meta 的 title / blurb）过分级与商标红线并钉死 title——
 *     入口卡片是终评对象，title 是卡片与 aria-label 的第一文字通道；
 *  3. 双键口径保全——WASD+F+G / 方向键+L+K / Esc 的讲法在 5 款相关攻略里逐词在位，
 *     防止后续文案润色把操作口径「解释掉」。
 */
import { describe, expect, it } from "vitest";
import type { GuideBook } from "../../ui/level188Contract";
import { meta as chessMeta } from "../chess-garden/meta";
import chessGuide from "../chess-garden/guide";
import { meta as darkMeta } from "../dark-chess/meta";
import darkGuide from "../dark-chess/guide";
import { meta as dotMeta } from "../dot-maze/meta";
import dotGuide from "../dot-maze/guide";
import { meta as fruitMeta } from "../fruit-stack/meta";
import fruitGuide from "../fruit-stack/guide";
import { meta as junqiMeta } from "../junqi-camp/meta";
import junqiGuide, { TWO_PLAYER_NOTE } from "../junqi-camp/guide";
import { meta as mergeMeta } from "../merge-2048/meta";
import mergeGuide from "../merge-2048/guide";
import { meta as mineMeta } from "../mine-garden/meta";
import mineGuide from "../mine-garden/guide";
import { meta as poolMeta } from "../pool-stars/meta";
import poolGuide from "../pool-stars/guide";
import { meta as sudokuMeta } from "../sudoku-petal/meta";
import sudokuGuide from "../sudoku-petal/guide";

/** 首页卡片终评只用得着这三个字段，用最小结构接住各款互不相同的字面量类型 */
interface CardMeta {
  id: string;
  title: string;
  blurb: string;
}

const GAMES: ReadonlyArray<[string, CardMeta, GuideBook]> = [
  ["merge-2048", mergeMeta, mergeGuide],
  ["mine-garden", mineMeta, mineGuide],
  ["sudoku-petal", sudokuMeta, sudokuGuide],
  ["dot-maze", dotMeta, dotGuide],
  ["fruit-stack", fruitMeta, fruitGuide],
  ["pool-stars", poolMeta, poolGuide],
  ["junqi-camp", junqiMeta, junqiGuide],
  ["chess-garden", chessMeta, chessGuide],
  ["dark-chess", darkMeta, darkGuide],
];

/**
 * 两轮视觉引导句跨轮总账（r1 的 11 句 + r2 的 6 句），gameId → 句子。
 * 每句都对应一处读码复核过的终态绘制特性（对应关系见
 * docs/qa/1.3-window2-round3-learner.md 第五节），逐字快照。
 */
const LEDGER: ReadonlyArray<[string, string]> = [
  // —— r1 的 11 句 ——
  ["merge-2048", "块角上的小星星是段位:铜星、银星、金星一路升,合到 2048 亮彩虹星。"],
  ["mine-garden", "数字底下还有一排小种子点：数一数几颗、认一认圆菱方，不靠颜色也分得清。"],
  ["mine-garden", "大田下方有一张花园鸟瞰小图，横着拖之前先瞄它一眼认方向。"],
  ["sudoku-petal", "冲突的格子除了变红,还会摆出一片卷边枯叶,看形状也认得出来。"],
  ["dot-maze", "小幽灵的瞳孔会顺着跑动方向看路，盯住眼睛就能猜到它下一步。"],
  ["fruit-stack", "果子们全体睁眼皱眉,就是堆得太高的信号,先消掉最顶上那一层。"],
  ["pool-stars", "认不清颜色就看压印:朵朵的暖组球印小花,星星的冷组球印五角星。"],
  ["junqi-camp", "认不得字也不怕：军衔条上三颗星就是司令，数星星数杠杠比大小。"],
  ["chess-garden", "亮起的格子里冒小绿芽是能走的位置，四角红三角的格子能吃子。"],
  ["dark-chess", "记不住就数棋面汉字下那排小圆点：将 7 点、兵 1 点，点多请点少。"],
  ["dark-chess", "棋面上带一道虚线小弧的就是炮，看到这道弧就想起要隔一个打。"],
  // —— r2 的 6 句 ——
  ["junqi-camp", "翻开的棋面左下角还有小记号：小花是朵朵的兵，小星星是星星的兵。"],
  ["mine-garden", "小地图只陪装不下一屏的大田出场，它不见了就说明整张田都在眼前。"],
  ["dark-chess", "屏幕太窄时棋面会先藏起小圆点、只留大汉字，换宽一点的屏它们就回来。"],
  ["dot-maze", "它头顶翘着一根小呆毛，裙边是三个波浪尖——这是豆豆迷宫自家的小幽灵。"],
  ["fruit-stack", "认盆看盆口的色边:玫红边是朵朵的盆,深蓝边是星星的盆,余光一扫就分清。"],
  ["chess-garden", "棋盘下边一排 a 到 h、左边一列 1 到 8 的小字是格子的门牌，攻略说的线照它找。"],
];

/** 首页入口卡片 title 逐字钉死（终评通过后的终态；title 同时是 aria-label 的素材） */
const TITLES: Readonly<Record<string, string>> = {
  "merge-2048": "星星合成",
  "mine-garden": "扫雷花园",
  "sudoku-petal": "数独花田",
  "dot-maze": "豆豆迷宫",
  "fruit-stack": "果果合成",
  "pool-stars": "朵星台球",
  "junqi-camp": "军旗对决",
  "chess-garden": "花园国际象棋",
  "dark-chess": "翻翻暗棋",
};

/** 分级红线：入口卡片与引导句一个吓人的字都不许有 */
const SCARY = ["死", "血", "尸", "阵亡", "牺牲", "伤害", "恐怖", "笨", "太差"];

/** 商标黑名单抽查（全量扫描在 copy.test.ts，这里兜底本窗 9 款终态文案） */
const BRANDS = [
  "4399",
  "马里奥",
  "皮卡丘",
  "托马斯",
  "hello kitty",
  "kitty",
  "battle city",
  "吃豆人",
  "pac-man",
  "俄罗斯方块",
  "合成大西瓜",
  "水果忍者",
];

/** 双键口径：WASD+F+G / 方向键+L+K / Esc 的讲法必须留在相关款攻略里 */
const KEY_HINTS: ReadonlyArray<[string, string, string]> = [
  ["mine-garden", "WASD 挪光标，F 翻开，G 插旗，Esc 暂停", "扫雷键位总口径"],
  ["chess-garden", "朵朵 WASD + F 选 / G 取消，星星 方向键 + L / K", "国象双人键位"],
  ["chess-garden", "Esc 按一次停、再按一次继续", "国象暂停口径"],
  ["dot-maze", "朵朵 G、星星 K", "迷宫取消键"],
  ["dot-maze", "按 Esc 或点方向键盘左上角的 ⏸", "迷宫暂停口径"],
  ["fruit-stack", "朵朵用 A / D 加 F,星星用左右方向键加 L", "合成双人键位"],
];

describe("窗口2 · r3 终验学习优化员 · 文案终查快照", () => {
  it("两轮 17 句视觉引导跨轮总账逐字在位（任何一句被 rebase 冲掉即红）", () => {
    const tipsById = new Map<string, string[]>();
    for (const [id, , guide] of GAMES) {
      tipsById.set(id, guide.entries.flatMap((e) => e.tips));
    }
    expect(LEDGER).toHaveLength(17);
    for (const [id, line] of LEDGER) {
      const tips = tipsById.get(id);
      expect(tips, `${id} 不在本窗 9 款清单里`).toBeDefined();
      expect(tips, `${id} 丢了视觉引导句:${line}`).toContain(line);
      expect(line.length, `${id} 引导句超 64 字:${line}`).toBeLessThanOrEqual(64);
    }
  });

  it("首页入口卡片 title 逐字钉死,blurb 过分级/商标红线且一行讲得完", () => {
    for (const [id, meta] of GAMES) {
      expect(meta.id).toBe(id);
      expect(meta.title, `${id} 首页标题变了`).toBe(TITLES[id]);
      expect(meta.blurb.length, `${id} blurb 空了`).toBeGreaterThan(0);
      expect(meta.blurb.length, `${id} blurb 超 64 字`).toBeLessThanOrEqual(64);
      const text = `${meta.title}${meta.blurb}`;
      for (const bad of SCARY) {
        expect(text.includes(bad), `${id} 入口文案出现「${bad}」`).toBe(false);
      }
      const low = text.toLowerCase();
      for (const bad of BRANDS) {
        expect(low.includes(bad), `${id} 入口文案出现「${bad}」`).toBe(false);
      }
    }
  });

  it("WASD+F+G / 方向键+L+K / Esc 双键口径在相关款攻略里逐词在位", () => {
    const textById = new Map<string, string>();
    for (const [id, , guide] of GAMES) {
      const all = [...guide.general, ...guide.entries.flatMap((e) => e.tips)].join("\n");
      textById.set(id, id === "junqi-camp" ? `${all}\n${TWO_PLAYER_NOTE}` : all);
    }
    for (const [id, phrase, label] of KEY_HINTS) {
      expect(textById.get(id)!.includes(phrase), `${id} 丢了${label}:「${phrase}」`).toBe(true);
    }
    // 军棋双人说明的键位口径单独钉：两侧确认/取消键一字不许换
    expect(TWO_PLAYER_NOTE).toContain("朵朵用 WASD 挪光标、F 确认、G 取消");
    expect(TWO_PLAYER_NOTE).toContain("星星用方向键、L 确认、K 取消");
  });

  it("终态结构契约:9 款全部八章、每章 ≥2 条 tips、通用心得 3–6 条", () => {
    for (const [id, , guide] of GAMES) {
      expect(guide.entries, `${id} 章节数变了`).toHaveLength(8);
      expect(guide.general.length, `${id} 通用心得少于 3 条`).toBeGreaterThanOrEqual(3);
      expect(guide.general.length, `${id} 通用心得多于 6 条`).toBeLessThanOrEqual(6);
      for (const e of guide.entries) {
        expect(e.tips.length, `${id} 第 ${e.from}–${e.to} 章 tips 不足 2 条`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
