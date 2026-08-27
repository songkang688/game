import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import {
  cellsToString,
  countSolutions,
  isRegionMapValid,
  isSolved,
  solveUnique,
  type SudokuBoard
} from "./solver";
import { PUZZLE_BANK, bankAt, boardFromBank, holesOfBank, solutionOfBank, variantOfBank } from "./puzzles";
import { allowedUpTo, isSolvableWith, tierRank } from "./techniques";
import { generate } from "./generate";
import {
  CHAPTERS,
  DUO_LEVELS,
  VERSUS_LEVELS,
  chapterIndexOf,
  endlessConfig,
  endlessPick,
  goalLine,
  levelSpec,
  loseLine,
  starsByTimeAndErrors,
  versusConfig,
  winLine
} from "./levels";
import guide from "./guide";

const ALL = Array.from({ length: TOTAL_LEVELS }, (_, i) => i);

describe("八章 188 关", () => {
  it("章节和恒等 188,assertTotal 说了算", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("八章的名字与新机制按规格落地", () => {
    expect(CHAPTERS.map((c) => c.name)).toEqual([
      "四宫萌芽",
      "六宫苗",
      "唯余九宫",
      "铅笔笔记",
      "成对花",
      "对角花",
      "异形宫",
      "花田杯"
    ]);
    for (const ch of CHAPTERS) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("每一关都落在对的章里,盘面种类跟着章走", () => {
    const wantKind = ["mini4", "mini6", "classic", "classic", "classic", "diagonal", "jigsaw", "classic"];
    for (const lv of ALL) {
      const spec = levelSpec(lv);
      expect(spec.chapter).toBe(chapterIndexOf(lv));
      expect(spec.kind, `第 ${lv + 1} 关的盘面种类`).toBe(wantKind[spec.chapter]);
      expect(spec.errorLimit).toBe(3);
    }
  });

  it("越界的关号夹回有效区间,不会炸也不会白屏", () => {
    expect(levelSpec(-5).level).toBe(0);
    expect(levelSpec(9999).level).toBe(187);
    expect(levelSpec(Number.NaN).level).toBe(0);
    expect(bankAt(-1)).toBe(PUZZLE_BANK[0]);
    expect(bankAt(9999)).toBe(PUZZLE_BANK[187]);
  });

  it("花田杯里单数关是竞速,四档假人从菜鸟一路排到地狱", () => {
    const tiers = new Set<string>();
    let races = 0;
    for (const lv of ALL) {
      const spec = levelSpec(lv);
      if (!spec.race) continue;
      races += 1;
      expect(spec.chapter).toBe(7);
      tiers.add(spec.aiTier);
    }
    expect(races).toBe(12);
    expect([...tiers].sort()).toEqual(["hell", "normal", "pro", "rookie"]);
  });
});

describe("188 题题库", () => {
  it("题库正好 188 条,与关号一一对上", () => {
    expect(PUZZLE_BANK).toHaveLength(TOTAL_LEVELS);
    for (const lv of ALL) {
      const entry = bankAt(lv);
      const spec = levelSpec(lv);
      expect(entry.k, `第 ${lv + 1} 关的盘面种类`).toBe(spec.kind);
      expect(entry.n).toBe(spec.kind === "mini4" ? 4 : spec.kind === "mini6" ? 6 : 9);
      expect(entry.p).toHaveLength(entry.n * entry.n);
      expect(entry.s).toHaveLength(entry.n * entry.n);
    }
  });

  it("188 题**逐题**都是唯一解", () => {
    for (const lv of ALL) {
      const board = boardFromBank(bankAt(lv));
      expect(countSolutions(board, 2), `第 ${lv + 1} 关不是唯一解`).toBe(1);
    }
  });

  it("188 题记着的解就是那个唯一解,而且是合法满盘", () => {
    for (const lv of ALL) {
      const entry = bankAt(lv);
      const board = boardFromBank(entry);
      const solution = solutionOfBank(entry);
      expect(isSolved({ variant: board.variant, cells: solution }), `第 ${lv + 1} 关的解不合法`).toBe(true);
      expect(solveUnique(board), `第 ${lv + 1} 关的解对不上`).toEqual(solution);
    }
  });

  it("188 题**逐题**都能纯逻辑推完,一题都不用猜", () => {
    for (const lv of ALL) {
      const entry = bankAt(lv);
      const allowed = allowedUpTo(levelSpec(lv).tier);
      expect(isSolvableWith(boardFromBank(entry), allowed), `第 ${lv + 1} 关推不完`).toBe(true);
      // 记着的难度档也不能超过本章教过的那一档
      expect(tierRank(entry.t), `第 ${lv + 1} 关超纲了`).toBeLessThanOrEqual(tierRank(entry.a));
    }
  });

  it("题面确实是完整解挖出来的:留着的格子一个都没改过", () => {
    for (const lv of ALL) {
      const entry = bankAt(lv);
      const puzzle = boardFromBank(entry).cells;
      const solution = solutionOfBank(entry);
      for (let i = 0; i < puzzle.length; i++) {
        if (puzzle[i] > 0) expect(puzzle[i], `第 ${lv + 1} 关第 ${i} 格`).toBe(solution[i]);
      }
      expect(holesOfBank(entry)).toBeGreaterThan(0);
    }
  });

  it("抽样重跑出题机:固化下来的题面能用记下的 seed 一字不差地复现", () => {
    // 整批重跑要十几秒,顶破 CI 超时;这里按章各抽一题,证明题库确实是生成器产出的
    const picks = [3, 30, 55, 80, 100, 125, 150, 180];
    for (const lv of picks) {
      const entry = bankAt(lv);
      const again = generate(entry.e, { kind: entry.k, tier: entry.a, holes: entry.h });
      expect(cellsToString(again.puzzle), `第 ${lv + 1} 关复现不了`).toBe(entry.p);
      expect(cellsToString(again.solution), `第 ${lv + 1} 关的解复现不了`).toBe(entry.s);
      expect(again.tier).toBe(entry.t);
    }
  });

  it("异形宫章的宫图都合法,而且真的不是标准九宫格", () => {
    let jigsaw = 0;
    for (const lv of ALL) {
      const entry = bankAt(lv);
      if (entry.k !== "jigsaw") {
        expect(entry.g).toBe("");
        continue;
      }
      jigsaw += 1;
      expect(entry.g).toHaveLength(81);
      const variant = variantOfBank(entry);
      expect(isRegionMapValid(variant.regions, 9), `第 ${lv + 1} 关的宫图不合法`).toBe(true);
      const box = Array.from({ length: 81 }, (_, i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));
      expect(variant.regions.some((v, i) => v !== box[i]), `第 ${lv + 1} 关还是标准九宫格`).toBe(true);
    }
    expect(jigsaw).toBe(24);
  });

  it("对角花章真的开着斜线约束,别的章一律不开", () => {
    for (const lv of ALL) {
      const variant = variantOfBank(bankAt(lv));
      expect(variant.diagonal).toBe(levelSpec(lv).kind === "diagonal");
    }
    const diag = PUZZLE_BANK.filter((e) => e.k === "diagonal");
    expect(diag).toHaveLength(22);
    for (const entry of diag) {
      const solution = solutionOfBank(entry);
      const main = new Set<number>();
      const anti = new Set<number>();
      for (let i = 0; i < 9; i++) {
        main.add(solution[i * 9 + i]);
        anti.add(solution[i * 9 + (8 - i)]);
      }
      expect(main.size).toBe(9);
      expect(anti.size).toBe(9);
    }
  });

  it("章内难度是往上走的:后半章的空格平均比前半章多", () => {
    let start = 0;
    for (const ch of CHAPTERS) {
      const holes = Array.from({ length: ch.size }, (_, i) => holesOfBank(bankAt(start + i)));
      const half = Math.floor(ch.size / 2);
      const front = holes.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const back = holes.slice(half).reduce((a, b) => a + b, 0) / (ch.size - half);
      expect(back, `${ch.name} 的后半章没有更难`).toBeGreaterThan(front);
      start += ch.size;
    }
  });

  it("四档技巧真的各自被某一章挑起大梁", () => {
    const tierIn = (from: number, size: number, tier: string): number =>
      Array.from({ length: size }, (_, i) => bankAt(from + i)).filter((e) => e.t === tier).length;
    // 唯余九宫:整章只需要唯余
    expect(tierIn(48, 24, "nakedSingle")).toBe(24);
    // 铅笔笔记:整章都需要隐性唯一
    expect(tierIn(72, 24, "hiddenSingle")).toBeGreaterThanOrEqual(20);
    // 成对花:大多数关真的要用显性数对
    expect(tierIn(96, 22, "nakedPair")).toBeGreaterThanOrEqual(18);
    // 花田杯:大多数关真的要用区块摒除
    expect(tierIn(164, 24, "pointingPair")).toBeGreaterThanOrEqual(18);
  });
});

describe("评星与文案", () => {
  it("又快又不出错才三星,只占一头两星,都没占也有一星", () => {
    expect(starsByTimeAndErrors(60_000, 0, 120_000)).toBe(3);
    expect(starsByTimeAndErrors(60_000, 2, 120_000)).toBe(2);
    expect(starsByTimeAndErrors(300_000, 0, 120_000)).toBe(2);
    expect(starsByTimeAndErrors(300_000, 3, 120_000)).toBe(1);
    // 种完就是本事,再慢再多改也保底一星
    for (const ms of [1, 10_000, 999_999]) {
      for (const err of [0, 1, 9]) {
        expect(starsByTimeAndErrors(ms, err, 120_000)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("坏数据进来也评得出星,不会炸", () => {
    expect(starsByTimeAndErrors(Number.NaN, Number.NaN, 120_000)).toBe(2);
    expect(starsByTimeAndErrors(-1, -1, 120_000)).toBe(2);
  });

  it("目标句子说清盘面、错几次和竞速,失败句子只鼓励", () => {
    expect(goalLine(levelSpec(0))).toContain("4×4");
    expect(goalLine(levelSpec(30))).toContain("6×6");
    expect(goalLine(levelSpec(120))).toContain("斜线");
    expect(goalLine(levelSpec(150))).toContain("异形");
    expect(goalLine(levelSpec(165))).toContain("假人");
    for (const lv of [0, 60, 120, 150, 187]) {
      const line = loseLine(levelSpec(lv));
      expect(line).toContain("先把最容易的那一宫补上");
      for (const bad of ["笨", "又错", "太差", "不行"]) expect(line).not.toContain(bad);
    }
    expect(winLine(42_000, 0)).toContain("一朵花都没种错");
    expect(winLine(42_000, 2)).toContain("完全不影响");
  });
});

describe("无尽与对战", () => {
  it("无尽两档都是错三题结束,题池不空", () => {
    for (const kind of ["mixed", "mini"] as const) {
      const cfg = endlessConfig(kind);
      expect(cfg.errorLimit).toBe(3);
      expect(cfg.pool.length).toBeGreaterThan(0);
      expect(cfg.label.length).toBeGreaterThan(0);
      for (const lv of cfg.pool) {
        expect(lv).toBeGreaterThanOrEqual(0);
        expect(lv).toBeLessThan(TOTAL_LEVELS);
      }
    }
    expect(endlessConfig("mini").pool.every((lv) => lv < 48)).toBe(true);
  });

  it("无尽抽题永远落在题池里,越往后越深", () => {
    const cfg = endlessConfig("mixed");
    for (let i = 0; i < 40; i++) {
      const lv = endlessPick(cfg, i, 7);
      expect(cfg.pool).toContain(lv);
    }
    const early = Array.from({ length: 5 }, (_, i) => endlessPick(cfg, i, 7));
    const late = Array.from({ length: 5 }, (_, i) => endlessPick(cfg, 40 + i, 7));
    expect(Math.max(...late)).toBeGreaterThan(Math.max(...early));
  });

  it("对战与双人的赛题都在 188 关之内,而且八章各出一题", () => {
    expect(VERSUS_LEVELS).toHaveLength(8);
    expect(DUO_LEVELS).toHaveLength(8);
    for (const list of [VERSUS_LEVELS, DUO_LEVELS]) {
      const chapters = list.map((lv) => chapterIndexOf(lv));
      expect(chapters).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      for (const lv of list) expect(lv).toBeLessThan(TOTAL_LEVELS);
    }
    expect(versusConfig("pro", 9999).level).toBe(187);
    expect(versusConfig("pro").tier).toBe("pro");
  });
});

describe("攻略只讲方法", () => {
  it("八段攻略接得上,一关都不漏", () => {
    expect(guide.gameId).toBe("sudoku-petal");
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[7].to).toBe(188);
    for (let i = 1; i < guide.entries.length; i++) {
      expect(guide.entries[i].from).toBe(guide.entries[i - 1].to + 1);
    }
    // 每一段正好盖住对应的那一章
    let start = 1;
    CHAPTERS.forEach((ch, i) => {
      expect(guide.entries[i].from).toBe(start);
      expect(guide.entries[i].to).toBe(start + ch.size - 1);
      start += ch.size;
    });
    for (const e of guide.entries) expect(e.tips.length).toBeGreaterThanOrEqual(3);
    expect(guide.general.length).toBeGreaterThanOrEqual(3);
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });

  it("攻略里没有任何一关的题面或解:找不到连着 20 位以上的数字串", () => {
    const lines = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])];
    for (const line of lines) {
      expect(/\d{20,}/.test(line), `攻略里混进了一长串数字:${line}`).toBe(false);
      // 也不许出现任何一关的题面或解的片段
      expect(line).not.toContain("答案");
    }
    const joined = lines.join("");
    for (const lv of [0, 60, 120, 187]) {
      const entry = bankAt(lv);
      expect(joined.includes(entry.s.slice(0, 12))).toBe(false);
      expect(joined.includes(entry.p.replace(/\./g, "").slice(0, 12))).toBe(false);
    }
  });
});
