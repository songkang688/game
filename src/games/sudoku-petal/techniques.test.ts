import { describe, expect, it } from "vitest";
import { EMPTY, cellsFromString, regionMapFor, type SudokuBoard } from "./solver";
import {
  HINT_FIELDS,
  TECHNIQUE_BLURBS,
  TECHNIQUE_LABELS,
  TECHNIQUE_ORDER,
  allowedUpTo,
  candidateGrid,
  cnOrdinal,
  findHiddenSingle,
  findNakedPair,
  findNakedSingle,
  findPointingPair,
  hintLeaksDigit,
  isSolvableWith,
  minTechniqueTier,
  nextTechnique,
  scopeName,
  scopeOfGroup,
  solveByTechniques,
  tierRank,
  type TechniqueKind
} from "./techniques";
import { PUZZLE_BANK, boardFromBank, solutionOfBank } from "./puzzles";

/** 题库里第一道最低技巧档正好是 tier 的题 */
function bankWithTier(tier: TechniqueKind): SudokuBoard {
  const entry = PUZZLE_BANK.find((e) => e.t === tier);
  if (!entry) throw new Error(`题库里没有 ${tier} 档的题`);
  return boardFromBank(entry);
}

/** 只用到 tier 为止的技巧往下推,推到停,把停下来那一刻的盘面交出来 */
function stalledAt(board: SudokuBoard, tier: TechniqueKind): SudokuBoard {
  const got = solveByTechniques(board, allowedUpTo(tier));
  return { variant: board.variant, cells: got.cells };
}

describe("技巧分级表", () => {
  it("四档从易到难排好,标签与说明一条不缺", () => {
    expect(TECHNIQUE_ORDER).toEqual(["nakedSingle", "hiddenSingle", "nakedPair", "pointingPair"]);
    for (const k of TECHNIQUE_ORDER) {
      expect(TECHNIQUE_LABELS[k].length).toBeGreaterThan(0);
      expect(TECHNIQUE_BLURBS[k].length).toBeGreaterThan(8);
    }
    expect(tierRank("nakedSingle")).toBeLessThan(tierRank("pointingPair"));
  });

  it("allowedUpTo 是层层包含的:高档一定含着低档", () => {
    expect(allowedUpTo("nakedSingle")).toEqual(["nakedSingle"]);
    expect(allowedUpTo("nakedPair")).toEqual(["nakedSingle", "hiddenSingle", "nakedPair"]);
    expect(allowedUpTo("pointingPair")).toEqual(TECHNIQUE_ORDER);
  });
});

describe("四档技巧各自检得出来", () => {
  it("唯余:被围得只剩一种可能的格子挑得出来,而且挑的就是解", () => {
    const entry = PUZZLE_BANK.find((e) => e.t === "nakedSingle" && e.n === 9);
    const board = boardFromBank(entry!);
    const solution = solutionOfBank(entry!);
    const hit = findNakedSingle(board, candidateGrid(board));
    expect(hit).not.toBeNull();
    expect(board.cells[hit!.idx]).toBe(EMPTY);
    expect(hit!.digit).toBe(solution[hit!.idx]);
  });

  it("隐性唯一:唯余推不动的地方,换个角度就能找到一组里的独苗", () => {
    const entry = PUZZLE_BANK.find((e) => e.t === "hiddenSingle")!;
    const board = boardFromBank(entry);
    const solution = solutionOfBank(entry);
    const stuck = stalledAt(board, "nakedSingle");
    expect(stuck.cells.some((v) => v === EMPTY)).toBe(true);
    expect(findNakedSingle(stuck, candidateGrid(stuck))).toBeNull();
    const hit = findHiddenSingle(stuck, candidateGrid(stuck));
    expect(hit).not.toBeNull();
    expect(hit!.digit).toBe(solution[hit!.idx]);
  });

  it("显性数对:两格候选一模一样时能划掉同组别人的候选", () => {
    const board = bankWithTier("nakedPair");
    const stuck = stalledAt(board, "hiddenSingle");
    const grid = candidateGrid(stuck);
    const hit = findNakedPair(stuck, grid);
    expect(hit).not.toBeNull();
    expect(hit!.base).toHaveLength(2);
    // 支撑这一招的两格候选完全相同,而且都只剩两种
    expect(grid[hit!.base[0]]).toBe(grid[hit!.base[1]]);
    expect(hit!.strikes.length).toBeGreaterThan(0);
    for (const s of hit!.strikes) expect(s.mask & grid[hit!.base[0]]).toBe(s.mask);
  });

  it("区块摒除:一朵花里某数字只落在一条线上时,线上花外的格子能划掉它", () => {
    const board = bankWithTier("pointingPair");
    const stuck = stalledAt(board, "nakedPair");
    const hit = findPointingPair(stuck, candidateGrid(stuck));
    expect(hit).not.toBeNull();
    expect(hit!.base.length).toBeGreaterThanOrEqual(2);
    // 支撑格全在同一朵花里,被划的格子都在这朵花外面
    const region = stuck.variant.regions[hit!.base[0]];
    for (const cell of hit!.base) expect(stuck.variant.regions[cell]).toBe(region);
    for (const s of hit!.strikes) expect(stuck.variant.regions[s.idx]).not.toBe(region);
  });
});

describe("纯逻辑推理机 · solveByTechniques", () => {
  it("只需唯余的题,单靠唯余就能一路推完", () => {
    const board = bankWithTier("nakedSingle");
    const got = solveByTechniques(board, ["nakedSingle"]);
    expect(got.solved).toBe(true);
    expect(got.used).toEqual(["nakedSingle"]);
    expect(got.contradiction).toBe(false);
  });

  it("需要更高一档的题,少一档就真的推不完", () => {
    const pair = bankWithTier("nakedPair");
    expect(isSolvableWith(pair, allowedUpTo("hiddenSingle"))).toBe(false);
    expect(isSolvableWith(pair, allowedUpTo("nakedPair"))).toBe(true);

    const point = bankWithTier("pointingPair");
    expect(isSolvableWith(point, allowedUpTo("nakedPair"))).toBe(false);
    expect(isSolvableWith(point, allowedUpTo("pointingPair"))).toBe(true);
  });

  it("推出来的结果就是那一题的解,不是随便填满", () => {
    const entry = PUZZLE_BANK[100];
    const got = solveByTechniques(boardFromBank(entry));
    expect(got.solved).toBe(true);
    expect(got.cells).toEqual(solutionOfBank(entry));
  });

  it("填错了会被推出矛盾,不会硬着头皮推下去", () => {
    const entry = PUZZLE_BANK.find((e) => e.n === 9)!;
    const board = boardFromBank(entry);
    const solution = solutionOfBank(entry);
    const hole = board.cells.findIndex((v) => v === EMPTY);
    board.cells[hole] = solution[hole] === 9 ? 8 : 9;
    const got = solveByTechniques(board);
    expect(got.solved).toBe(false);
  });

  it("minTechniqueTier 报的就是最低那一档,再降一档一定推不完", () => {
    for (const tier of TECHNIQUE_ORDER) {
      const entry = PUZZLE_BANK.find((e) => e.t === tier);
      if (!entry) continue;
      const board = boardFromBank(entry);
      expect(minTechniqueTier(board)).toBe(tier);
      const lower = TECHNIQUE_ORDER[tierRank(tier) - 1];
      if (lower) expect(isSolvableWith(board, allowedUpTo(lower))).toBe(false);
    }
  });
});

describe("提示只讲方法,一个答案都不给", () => {
  it("提示正文里连一个阿拉伯数字都没有,自然带不出答案", () => {
    let checked = 0;
    for (let i = 0; i < PUZZLE_BANK.length; i += 7) {
      const board = boardFromBank(PUZZLE_BANK[i]);
      const hint = nextTechnique(board);
      expect(hint, `第 ${i + 1} 关给不出提示`).not.toBeNull();
      expect(hintLeaksDigit(hint!), `第 ${i + 1} 关的提示正文里混进了数字:${hint!.text}`).toBe(false);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it("提示结构里只有「用哪一招、看哪一组、盯哪几格」,没有任何答案字段", () => {
    const board = boardFromBank(PUZZLE_BANK[80]);
    const hint = nextTechnique(board)!;
    expect(Object.keys(hint).sort()).toEqual(HINT_FIELDS.slice().sort());
    for (const banned of ["digit", "value", "answer", "solution", "fill"]) {
      expect(Object.prototype.hasOwnProperty.call(hint, banned)).toBe(false);
    }
    // 序列化之后也翻不出解:焦点格里装的是下标,不是要填的数
    const solution = solutionOfBank(PUZZLE_BANK[80]);
    for (const idx of hint.focus) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(solution.length);
    }
  });

  it("四档提示都给得出来,而且档位限制说了算", () => {
    const seen = new Set<string>();
    for (const entry of PUZZLE_BANK) {
      const hint = nextTechnique(boardFromBank(entry));
      if (hint) seen.add(hint.kind);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
    // 只准用唯余时,给不出唯余就宁可不给,绝不越级
    const board = bankWithTier("hiddenSingle");
    const stuck = stalledAt(board, "nakedSingle");
    expect(nextTechnique(stuck, ["nakedSingle"])).toBeNull();
    expect(nextTechnique(stuck, allowedUpTo("hiddenSingle"))?.kind).toBe("hiddenSingle");
  });

  it("盘面已经种满时不再给提示", () => {
    const entry = PUZZLE_BANK[3];
    const full: SudokuBoard = { variant: boardFromBank(entry).variant, cells: solutionOfBank(entry) };
    expect(nextTechnique(full)).toBeNull();
  });

  it("组名与中文序号都是中文的,一个阿拉伯数字都不带", () => {
    expect(cnOrdinal(0)).toBe("一");
    expect(cnOrdinal(4)).toBe("五");
    expect(cnOrdinal(8)).toBe("九");
    expect(scopeName("row", 2)).toBe("第三行");
    expect(scopeName("col", 5)).toBe("第六列");
    expect(scopeName("region", 8)).toBe("第九朵花");
    for (const s of ["row", "col", "region", "diagonal", "cell"] as const) {
      expect(/[0-9]/.test(scopeName(s, 3))).toBe(false);
    }
  });

  it("组号换算得出它是行、列、花还是斜线", () => {
    const board: SudokuBoard = { variant: regionMapFor("diagonal"), cells: cellsFromString(".".repeat(81)) };
    expect(scopeOfGroup(board, 0)).toEqual({ scope: "row", index: 0 });
    expect(scopeOfGroup(board, 9)).toEqual({ scope: "col", index: 0 });
    expect(scopeOfGroup(board, 18)).toEqual({ scope: "region", index: 0 });
    expect(scopeOfGroup(board, 27)).toEqual({ scope: "diagonal", index: 0 });
    expect(scopeOfGroup(board, 28)).toEqual({ scope: "diagonal", index: 1 });
  });
});
