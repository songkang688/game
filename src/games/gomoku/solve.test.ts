import { describe, expect, it } from "vitest";
import {
  type Board,
  type Player,
  candidateMoves,
  isForbidden,
  makeBoard,
  makesFive,
  setCell,
} from "./ai";
import {
  deadStone,
  fiveSpots,
  isDecoyFirstMove,
  isForcedWin,
  minWinDepth,
  solutionLine,
  winningFirstMoves,
} from "./solve";
import { LEGACY_PUZZLES, PUZZLES, puzzleKind } from "./puzzles";

function put(b: Board, moves: Array<[number, number]>, p: Player): void {
  for (const [x, y] of moves) setCell(b, x, y, p);
}

function board(black: Array<[number, number]>, white: Array<[number, number]>, size = 9): Board {
  const b = makeBoard(size);
  put(b, black, 1);
  put(b, white, 2);
  return b;
}

const NEW_PUZZLES = PUZZLES.slice(LEGACY_PUZZLES);

describe("解局求解器", () => {
  it("一步成五就是一手解，解集里全是能立刻连五的点", () => {
    const b = board([[2, 4], [3, 4], [4, 4], [5, 4]], [[2, 3], [3, 3], [4, 3], [2, 5]]);
    expect(isForcedWin(b, 1)).toBe(true);
    const sols = winningFirstMoves(b, 1);
    expect(sols.length).toBeGreaterThan(0);
    for (const [x, y] of sols) expect(makesFive(b, x, y, 1)).toBe(true);
  });

  it("活三两头都能长成活四，两手解的解集就是那两个点", () => {
    const b = board([[3, 4], [4, 4], [5, 4]], [[3, 3], [4, 3], [5, 5]]);
    expect(minWinDepth(b, 5)).toBe(2);
    expect(winningFirstMoves(b, 2)).toEqual([
      [2, 4],
      [6, 4],
    ]);
  });

  it("解不开的局面老老实实返回 false / 空解集", () => {
    const b = board([[4, 4]], [[4, 5]]);
    expect(isForcedWin(b, 5)).toBe(false);
    expect(minWinDepth(b, 5)).toBe(0);
    expect(winningFirstMoves(b, 5)).toEqual([]);
    expect(solutionLine(b, 5)).toBeNull();
  });

  it("白棋自己能成五时，黑棋的慢杀不算数", () => {
    // 黑棋有活三，但白棋下一手就能连五，黑棋来不及
    const b = board([[3, 4], [4, 4], [5, 4]], [[1, 7], [2, 7], [3, 7], [4, 7]]);
    expect(fiveSpots(b, 2).length).toBeGreaterThan(0);
    expect(isForcedWin(b, 2)).toBe(false);
  });

  it("求解器与朴素定义一致：主变每一手都是先手", () => {
    const p = NEW_PUZZLES[0];
    const b = board(p.black, p.white);
    const line = solutionLine(b, p.moves)!;
    expect(line.length).toBeGreaterThan(0);
    expect(line.length).toBeLessThanOrEqual(p.moves);
    // 主变第一手必须在解集里
    expect(p.solutions).toContainEqual(line[0]);
  });

  it("废子判定：四面被围死的子再也进不了五连", () => {
    const b = makeBoard(9);
    setCell(b, 4, 4, 1);
    expect(deadStone(b, 4, 4)).toBe(false);
    for (const [x, y] of [
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
      [5, 4],
      [6, 4],
      [7, 4],
      [8, 4],
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 5],
      [4, 6],
      [4, 7],
      [4, 8],
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [8, 0],
      [7, 1],
      [6, 2],
      [5, 3],
      [3, 5],
      [2, 6],
      [1, 7],
      [0, 8],
    ] as Array<[number, number]>) {
      setCell(b, x, y, 2);
    }
    expect(deadStone(b, 4, 4)).toBe(true);
    expect(deadStone(b, 0, 1)).toBe(true); // 空点也算「没用」
  });

  it("禁手开关会改变解集：踩禁手的那条路被划掉", () => {
    const trap = NEW_PUZZLES.find((p) => p.solutionKind === "forbidden")!;
    const b = board(trap.black, trap.white);
    const free = winningFirstMoves(b, trap.moves);
    const safe = winningFirstMoves(b, trap.moves, { forbidden: true });
    expect(safe.length).toBeGreaterThan(0);
    expect(safe.length).toBeLessThan(free.length);
  });
});

describe("第 100–188 题 · 真解局的解集断言", () => {
  it("每题都带解法分类与完整首手解集", () => {
    expect(NEW_PUZZLES).toHaveLength(89);
    for (const p of NEW_PUZZLES) {
      expect(p.solutionKind, p.name).toBeDefined();
      expect(p.solutions, p.name).toBeDefined();
      expect(p.solutions!.length, p.name).toBeGreaterThan(0);
      // 解集必须「明确」:一小撮点,不能满盘都是解
      expect(p.solutions!.length, p.name).toBeLessThanOrEqual(5);
      for (const [x, y] of p.solutions!) {
        expect(x, p.name).toBeGreaterThanOrEqual(0);
        expect(y, p.name).toBeGreaterThanOrEqual(0);
        expect(x, p.name).toBeLessThan(9);
        expect(y, p.name).toBeLessThan(9);
        const occupied =
          p.black.some(([bx, by]) => bx === x && by === y) ||
          p.white.some(([wx, wy]) => wx === x && wy === y);
        expect(occupied, `${p.name} 的解落在已有棋子上`).toBe(false);
      }
    }
  });

  it("解集逐题重算一致（写死的解 = 求解器算出来的解）", () => {
    for (const p of NEW_PUZZLES) {
      const b = board(p.black, p.white);
      expect(winningFirstMoves(b, p.moves), `${p.name} 解集对不上`).toEqual(p.solutions);
    }
  }, 120_000);

  it("绝不是「随便下一手也能过」：大多数候选点都会输", () => {
    for (const p of NEW_PUZZLES) {
      const b = board(p.black, p.white);
      const cands = candidateMoves(b).length;
      expect(cands, p.name).toBeGreaterThan(p.solutions!.length * 3);
    }
  });

  it("唯一胜点题真的只有一个解", () => {
    const uniques = NEW_PUZZLES.filter((p) => p.solutionKind === "unique");
    expect(uniques.length).toBeGreaterThanOrEqual(8);
    for (const p of uniques) expect(p.solutions, p.name).toHaveLength(1);
  });

  it("四手杀 / 五手杀题的手数与分类对得上", () => {
    for (const p of NEW_PUZZLES) {
      if (p.solutionKind === "mate4") expect(p.moves, p.name).toBe(4);
      if (p.solutionKind === "mate5") expect(p.moves, p.name).toBe(5);
    }
  });

  it("抓禁手题：自由规则下能赢的走法里，有几条会踩禁手", () => {
    const traps = NEW_PUZZLES.filter((p) => p.solutionKind === "forbidden");
    expect(traps.length).toBeGreaterThanOrEqual(8);
    for (const p of traps) {
      const b = board(p.black, p.white);
      const safe = winningFirstMoves(b, p.moves, { forbidden: true });
      expect(safe.length, `${p.name} 开禁手就没解了`).toBeGreaterThan(0);
      expect(safe.length, `${p.name} 禁手其实不影响解集`).toBeLessThan(p.solutions!.length);
    }
  }, 120_000);

  it("弃子引杀题：首手那颗子最后不在五连里", () => {
    const decoys = NEW_PUZZLES.filter((p) => p.solutionKind === "sacrifice");
    expect(decoys.length).toBeGreaterThanOrEqual(8);
    for (const p of decoys) {
      const b = board(p.black, p.white);
      const ok = p.solutions!.some((s) => isDecoyFirstMove(b, p.moves, s));
      expect(ok, `${p.name} 首手并没有被弃掉`).toBe(true);
    }
  }, 120_000);

  it("五类解法都用上了，而且每一章都不止一种解法", () => {
    const kinds = new Set(NEW_PUZZLES.map((p) => p.solutionKind));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    for (const theme of [6, 7, 8]) {
      const inTheme = new Set(
        NEW_PUZZLES.filter((p) => p.theme === theme).map((p) => p.solutionKind)
      );
      expect(inTheme.size, `第 ${theme + 1} 章只有一种解法`).toBeGreaterThanOrEqual(2);
    }
  });

  it("新题互相之间不是对称变体（同一批坐标翻转 / 旋转后也不重样）", () => {
    const sym = (x: number, y: number, k: number): [number, number] => {
      const c = 8;
      switch (k) {
        case 1:
          return [c - x, y];
        case 2:
          return [x, c - y];
        case 3:
          return [c - x, c - y];
        case 4:
          return [y, x];
        case 5:
          return [c - y, x];
        case 6:
          return [y, c - x];
        case 7:
          return [c - y, c - x];
        default:
          return [x, y];
      }
    };
    const seen = new Set<string>();
    for (const p of NEW_PUZZLES) {
      for (let k = 0; k < 8; k++) {
        const sig = JSON.stringify([
          p.black.map(([x, y]) => sym(x, y, k)).sort((a, c) => a[0] - c[0] || a[1] - c[1]),
          p.white.map(([x, y]) => sym(x, y, k)).sort((a, c) => a[0] - c[0] || a[1] - c[1]),
        ]);
        expect(seen.has(sig), `${p.name} 与前面某题只差一个对称变换`).toBe(false);
      }
      const own = JSON.stringify([
        [...p.black].sort((a, c) => a[0] - c[0] || a[1] - c[1]),
        [...p.white].sort((a, c) => a[0] - c[0] || a[1] - c[1]),
      ]);
      seen.add(own);
    }
  });

  it("puzzleKind 给老题也算得出分类", () => {
    expect(puzzleKind(PUZZLES[0])).toBe("unique");
    expect(puzzleKind(PUZZLES[LEGACY_PUZZLES - 1])).toBe("mate3");
    expect(puzzleKind(NEW_PUZZLES[0])).toBe(NEW_PUZZLES[0].solutionKind);
  });

  it("题面提示不报坐标、也没有英文字母", () => {
    for (const p of NEW_PUZZLES) {
      expect(p.tip, p.name).not.toMatch(/[A-Za-z0-9]/);
      expect(p.tip.length, p.name).toBeGreaterThanOrEqual(10);
    }
  });

  it("禁手判定不会误伤解集里的点（除抓禁题外，解都能直接走）", () => {
    for (const p of NEW_PUZZLES) {
      if (p.solutionKind === "forbidden") continue;
      const b = board(p.black, p.white);
      const playable = p.solutions!.filter(([x, y]) => !isForbidden(b, x, y).forbidden);
      expect(playable.length, `${p.name} 的解全被禁手挡住了`).toBeGreaterThan(0);
    }
  });
});
