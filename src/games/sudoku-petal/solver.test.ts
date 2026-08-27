import { describe, expect, it } from "vitest";
import {
  EMPTY,
  candidateMask,
  cellsFromString,
  cellsToString,
  conflictsAt,
  countSolutions,
  emptyBoard,
  fullMask,
  hasUniqueSolution,
  isBoardConsistent,
  isRegionMapValid,
  isSolved,
  isValidPlacement,
  jigsawRegions,
  maskToDigits,
  neighborsOf,
  popCount,
  regionMapFor,
  rng,
  shuffle,
  solveFirst,
  solveUnique,
  variantFromRegions,
  VARIANT_KINDS,
  type SudokuBoard
} from "./solver";

function boardOf(kind: Parameters<typeof regionMapFor>[0], text: string, seed = 1): SudokuBoard {
  return { variant: regionMapFor(kind, seed), cells: cellsFromString(text) };
}

/** 9×9 空盘,再按 [行, 列, 数字] 摆几个子 */
function classic(placements: Array<[number, number, number]> = []): SudokuBoard {
  const board = emptyBoard(regionMapFor("classic"));
  for (const [r, c, d] of placements) board.cells[r * 9 + c] = d;
  return board;
}

describe("宫的划分 · regionMapFor", () => {
  it("五种变体都拿得到骨架,边长与宫数都对得上", () => {
    for (const kind of VARIANT_KINDS) {
      const v = regionMapFor(kind, 5);
      const n = kind === "mini4" ? 4 : kind === "mini6" ? 6 : 9;
      expect(v.n, `${kind} 的边长`).toBe(n);
      expect(v.regions).toHaveLength(n * n);
      expect(isRegionMapValid(v.regions, n), `${kind} 的宫图`).toBe(true);
      // 行 n 组 + 列 n 组 + 宫 n 组(对角花再加两条斜线)
      expect(v.groups).toHaveLength(n * 3 + (v.diagonal ? 2 : 0));
    }
  });

  it("4×4 的宫是 2 行 2 列", () => {
    const v = regionMapFor("mini4");
    expect(v.regions.slice(0, 4)).toEqual([0, 0, 1, 1]);
    expect(v.regions.slice(4, 8)).toEqual([0, 0, 1, 1]);
    expect(v.regions.slice(8, 12)).toEqual([2, 2, 3, 3]);
    expect(v.boxRows).toBe(2);
    expect(v.boxCols).toBe(2);
  });

  it("6×6 的宫是 2 行 3 列,一共六朵", () => {
    const v = regionMapFor("mini6");
    expect(v.regions.slice(0, 6)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(v.regions.slice(6, 12)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(v.regions.slice(12, 18)).toEqual([2, 2, 2, 3, 3, 3]);
    expect(new Set(v.regions).size).toBe(6);
  });

  it("对角花比标准盘多两条斜线约束", () => {
    const plain = regionMapFor("classic");
    const diag = regionMapFor("diagonal");
    expect(plain.diagonal).toBe(false);
    expect(diag.diagonal).toBe(true);
    expect(diag.groups.length - plain.groups.length).toBe(2);
    // 左上角同时属于行、列、宫、主对角线四组
    expect(diag.cellGroups[0]).toHaveLength(4);
    expect(plain.cellGroups[0]).toHaveLength(3);
  });

  it("异形宫:九块各九格、每块都连通,而且不是标准的九宫格", () => {
    const box = regionMapFor("classic").regions;
    let different = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const regions = jigsawRegions(seed);
      expect(isRegionMapValid(regions, 9), `seed ${seed} 的宫图不合法`).toBe(true);
      if (regions.some((v, i) => v !== box[i])) different += 1;
    }
    expect(different).toBeGreaterThanOrEqual(6);
  });

  it("邻居只算上下左右,边角不越界", () => {
    expect(neighborsOf(0, 9).sort((a, b) => a - b)).toEqual([1, 9]);
    expect(neighborsOf(80, 9).sort((a, b) => a - b)).toEqual([71, 79]);
    expect(neighborsOf(40, 9).sort((a, b) => a - b)).toEqual([31, 39, 41, 49]);
  });

  it("宫图校验筛得出坏图:格数不对、不连通都要拦下", () => {
    const good = regionMapFor("classic").regions;
    expect(isRegionMapValid(good, 9)).toBe(true);
    const tooMany = good.slice();
    tooMany[0] = 1;
    expect(isRegionMapValid(tooMany, 9)).toBe(false);
    // 把两个不相邻的角互换,块数还是九格但断成两半
    const broken = good.slice();
    broken[0] = 8;
    broken[80] = 0;
    expect(isRegionMapValid(broken, 9)).toBe(false);
  });
});

describe("合法性 · isValidPlacement", () => {
  it("同一行里已经有这个数字就不许再放", () => {
    const b = classic([[0, 0, 5]]);
    expect(isValidPlacement(b, 5, 5)).toBe(false);
    expect(isValidPlacement(b, 5, 3)).toBe(true);
  });

  it("同一列里已经有这个数字就不许再放", () => {
    const b = classic([[0, 0, 5]]);
    expect(isValidPlacement(b, 5 * 9 + 0, 5)).toBe(false);
    expect(isValidPlacement(b, 5 * 9 + 0, 6)).toBe(true);
  });

  it("同一朵花里已经有这个数字就不许再放", () => {
    const b = classic([[0, 0, 5]]);
    // (1,1) 和 (0,0) 既不同行也不同列,但在同一朵九宫花里
    expect(isValidPlacement(b, 1 * 9 + 1, 5)).toBe(false);
    expect(isValidPlacement(b, 4 * 9 + 4, 5)).toBe(true);
  });

  it("对角花上,只有斜线冲突的位置也要拦下来", () => {
    const b: SudokuBoard = { variant: regionMapFor("diagonal"), cells: new Array<number>(81).fill(EMPTY) };
    b.cells[0] = 7;
    // (4,4) 与 (0,0) 不同行、不同列、不同宫,只共一条主对角线
    expect(isValidPlacement(b, 4 * 9 + 4, 7)).toBe(false);
    const plain: SudokuBoard = { variant: regionMapFor("classic"), cells: b.cells.slice() };
    expect(isValidPlacement(plain, 4 * 9 + 4, 7)).toBe(true);
  });

  it("越界的格子和越界的数字一律不合法,填空永远合法", () => {
    const b = classic();
    expect(isValidPlacement(b, -1, 3)).toBe(false);
    expect(isValidPlacement(b, 81, 3)).toBe(false);
    expect(isValidPlacement(b, 0, 10)).toBe(false);
    expect(isValidPlacement(b, 0, 0)).toBe(true);
  });

  it("冲突高亮点得出同行同列同花的那几格", () => {
    const b = classic([
      [0, 0, 5],
      [0, 7, 5],
      [6, 0, 5],
      [1, 1, 5]
    ]);
    expect(conflictsAt(b, 0)).toEqual([7, 10, 54]);
    expect(conflictsAt(b, 40)).toEqual([]);
    expect(isBoardConsistent(b)).toBe(false);
  });
});

describe("解计数 · countSolutions", () => {
  it("数到 limit 就收手:空盘多解,只报到 2", () => {
    const b = emptyBoard(regionMapFor("mini4"));
    expect(countSolutions(b, 2)).toBe(2);
    expect(countSolutions(b, 5)).toBe(5);
    expect(hasUniqueSolution(b)).toBe(false);
  });

  it("唯一解的题正好数出 1", () => {
    // 4×4:只留下四个提示,答案被逼死
    const b = boardOf("mini4", "1234341221434321");
    expect(countSolutions(b, 2)).toBe(1);
    const dug = { variant: b.variant, cells: b.cells.slice() };
    dug.cells[0] = EMPTY;
    dug.cells[1] = EMPTY;
    expect(countSolutions(dug, 2)).toBe(1);
    expect(hasUniqueSolution(dug)).toBe(true);
  });

  it("挖出一对可以对调的空格就变成多解", () => {
    const b = boardOf("mini4", "1234341221434321");
    const two = { variant: b.variant, cells: b.cells.slice() };
    // 挖掉一个跨两朵花的矩形四角:那两个数字可以整体对调,必然两解
    for (const idx of [0, 2, 4, 6]) two.cells[idx] = EMPTY;
    expect(countSolutions(two, 2)).toBe(2);
    expect(solveUnique(two)).toBeNull();
  });

  it("自己就冲突的盘面一个解都没有", () => {
    const b = classic([
      [0, 0, 5],
      [0, 1, 5]
    ]);
    expect(countSolutions(b, 2)).toBe(0);
    expect(solveFirst(b)).toBeNull();
  });

  it("solveUnique 只在唯一解时交出那个解,而且解本身是合法的满盘", () => {
    const b = boardOf("mini4", "1234341221434321");
    const dug = { variant: b.variant, cells: b.cells.slice() };
    dug.cells[3] = EMPTY;
    const got = solveUnique(dug);
    expect(got).not.toBeNull();
    expect(cellsToString(got as number[])).toBe("1234341221434321");
    expect(isSolved({ variant: b.variant, cells: got as number[] })).toBe(true);
  });
});

describe("位运算小工具", () => {
  it("fullMask 装得下 1..n,一位不多一位不少", () => {
    expect(maskToDigits(fullMask(4))).toEqual([1, 2, 3, 4]);
    expect(maskToDigits(fullMask(9))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(popCount(fullMask(6))).toBe(6);
  });

  it("候选掩码把同行同列同花已经占掉的数字都去掉了", () => {
    const b = classic([
      [0, 1, 1],
      [0, 2, 2],
      [1, 0, 3],
      [2, 0, 4]
    ]);
    expect(maskToDigits(candidateMask(b, 0))).toEqual([5, 6, 7, 8, 9]);
    // 已经填了字的格子没有候选
    expect(candidateMask(b, 1)).toBe(0);
  });

  it("字符串与数组互转是一对可逆的操作", () => {
    const text = "1.34.2..3";
    expect(cellsToString(cellsFromString(text))).toBe(text);
  });

  it("同一个 seed 的洗牌结果永远一样,不同 seed 会分开", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng(42));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng(42));
    const c = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("拿现成宫图拼出来的变体和生成出来的一模一样", () => {
    const gen = regionMapFor("jigsaw", 11);
    const rebuilt = variantFromRegions("jigsaw", 9, gen.regions.slice());
    expect(rebuilt.groups).toEqual(gen.groups);
    expect(rebuilt.cellGroups).toEqual(gen.cellGroups);
  });
});
