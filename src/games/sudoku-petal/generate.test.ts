import { describe, expect, it } from "vitest";
import {
  EMPTY,
  cellsToString,
  countSolutions,
  isRegionMapValid,
  isSolved,
  regionMapFor,
  rng,
  solveUnique,
  variantFromRegions,
  type SudokuBoard
} from "./solver";
import { digHoles, generate, generateAtTier, randomSolution, difficultyRank } from "./generate";
import { allowedUpTo, isSolvableWith, minTechniqueTier } from "./techniques";

function boardOf(p: ReturnType<typeof generate>): SudokuBoard {
  return { variant: variantFromRegions(p.kind, p.n, p.regions, p.diagonal), cells: p.puzzle };
}

describe("完整解 · randomSolution", () => {
  it("五种盘面都能回溯出一个合法的满盘", () => {
    for (const kind of ["mini4", "mini6", "classic", "diagonal", "jigsaw"] as const) {
      const variant = regionMapFor(kind, 3);
      const cells = randomSolution(variant, rng(2024));
      expect(cells, `${kind} 没解出来`).not.toBeNull();
      expect(isSolved({ variant, cells: cells as number[] }), `${kind} 的解不合法`).toBe(true);
    }
  });

  it("同一个 seed 每次都是同一个解,换 seed 就换一盘", () => {
    const variant = regionMapFor("classic");
    const a = randomSolution(variant, rng(77));
    const b = randomSolution(variant, rng(77));
    const c = randomSolution(variant, rng(78));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("挖洞 · digHoles", () => {
  it("挖完还是唯一解 —— 每挖一个都过了解计数这一关", () => {
    const variant = regionMapFor("classic");
    const solution = randomSolution(variant, rng(515)) as number[];
    const dug = digHoles({ variant, cells: solution }, {
      holes: 45,
      allowed: allowedUpTo("hiddenSingle"),
      rand: rng(99)
    });
    const holes = dug.cells.filter((v) => v === EMPTY).length;
    expect(holes).toBeGreaterThan(20);
    expect(countSolutions(dug, 2)).toBe(1);
    expect(solveUnique(dug)).toEqual(solution);
  });

  it("挖完还能纯逻辑推完,允许的档位越低挖得越少", () => {
    const variant = regionMapFor("classic");
    const solution = randomSolution(variant, rng(818)) as number[];
    const easy = digHoles({ variant, cells: solution }, {
      holes: 81,
      allowed: allowedUpTo("nakedSingle"),
      rand: rng(4)
    });
    const hard = digHoles({ variant, cells: solution }, {
      holes: 81,
      allowed: allowedUpTo("pointingPair"),
      rand: rng(4)
    });
    expect(isSolvableWith(easy, allowedUpTo("nakedSingle"))).toBe(true);
    expect(isSolvableWith(hard, allowedUpTo("pointingPair"))).toBe(true);
    const easyHoles = easy.cells.filter((v) => v === EMPTY).length;
    const hardHoles = hard.cells.filter((v) => v === EMPTY).length;
    expect(hardHoles).toBeGreaterThan(easyHoles);
  });

  it("原来的满盘一个字都没被改", () => {
    const variant = regionMapFor("mini6");
    const solution = randomSolution(variant, rng(31)) as number[];
    const before = solution.slice();
    digHoles({ variant, cells: solution }, { holes: 20, allowed: allowedUpTo("hiddenSingle"), rand: rng(7) });
    expect(solution).toEqual(before);
  });
});

describe("出题 · generate", () => {
  it("出来的题一定是唯一解,而且解就是它自己那份完整解", () => {
    for (const kind of ["mini4", "mini6", "classic"] as const) {
      const p = generate(1234, { kind, tier: "hiddenSingle", holes: kind === "mini4" ? 10 : 40 });
      const b = boardOf(p);
      expect(countSolutions(b, 2), `${kind} 不是唯一解`).toBe(1);
      expect(solveUnique(b), `${kind} 的解对不上`).toEqual(p.solution);
      expect(p.holes).toBe(p.puzzle.filter((v) => v === EMPTY).length);
    }
  });

  it("题面是完整解的子集:没挖掉的格子一个都没被改过", () => {
    const p = generate(555, { kind: "classic", tier: "nakedSingle", holes: 40 });
    for (let i = 0; i < p.puzzle.length; i++) {
      if (p.puzzle[i] !== EMPTY) expect(p.puzzle[i]).toBe(p.solution[i]);
    }
  });

  it("同一个 seed + 同一份规格,产出一字不差的同一题", () => {
    const spec = { kind: "classic" as const, tier: "nakedPair" as const, holes: 50 };
    const a = generate(20260827, spec);
    const b = generate(20260827, spec);
    expect(cellsToString(a.puzzle)).toBe(cellsToString(b.puzzle));
    expect(cellsToString(a.solution)).toBe(cellsToString(b.solution));
    expect(a.tier).toBe(b.tier);
    const c = generate(20260828, spec);
    expect(cellsToString(c.puzzle)).not.toBe(cellsToString(a.puzzle));
  });

  it("出的题不会超出允许的技巧档:低档规格绝不产出高档题", () => {
    for (const seed of [11, 222, 3333]) {
      const p = generate(seed, { kind: "classic", tier: "nakedSingle", holes: 44 });
      expect(minTechniqueTier(boardOf(p))).toBe("nakedSingle");
      expect(difficultyRank(p)).toBe(0);
    }
  });

  it("异形宫题会把宫图一起带出来,而且宫图合法", () => {
    const p = generate(4242, { kind: "jigsaw", tier: "hiddenSingle", holes: 48 });
    expect(p.kind).toBe("jigsaw");
    expect(p.regions).toHaveLength(81);
    expect(isRegionMapValid(p.regions, 9)).toBe(true);
    expect(countSolutions(boardOf(p), 2)).toBe(1);
  });

  it("对角花题的两条斜线上也是一到九各一次", () => {
    const p = generate(606, { kind: "diagonal", tier: "hiddenSingle", holes: 46 });
    expect(p.diagonal).toBe(true);
    const main = new Set<number>();
    const anti = new Set<number>();
    for (let i = 0; i < 9; i++) {
      main.add(p.solution[i * 9 + i]);
      anti.add(p.solution[i * 9 + (8 - i)]);
    }
    expect(main.size).toBe(9);
    expect(anti.size).toBe(9);
  });

  it("generateAtTier 换种子换到指定难度档为止", () => {
    const p = generateAtTier(8080, { kind: "classic", tier: "hiddenSingle", holes: 50 }, 20);
    expect(p.tier).toBe("hiddenSingle");
    expect(countSolutions(boardOf(p), 2)).toBe(1);
  });
});
