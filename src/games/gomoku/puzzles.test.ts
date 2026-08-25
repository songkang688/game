import { describe, expect, it } from "vitest";
import {
  type Board,
  type Player,
  bestMove,
  candidateMoves,
  findWinLine,
  makesFive,
  setCell,
} from "./ai";
import { PUZZLES, puzzleBoard } from "./puzzles";

/** 当前 p 方所有"下一手就成五"的点 */
function fiveSpots(b: Board, p: Player): Array<[number, number]> {
  return candidateMoves(b).filter(([x, y]) => makesFive(b, x, y, p));
}

/**
 * 强制胜搜索（黑先）：黑棋能否在 movesLeft 步内必胜。
 * 黑棋只走"制造成五威胁"的强迫手（冲四/活四/双杀），
 * 白棋必须占掉威胁点否则立刻输，因此白方回应集合 = 全部威胁点。
 * 白棋若在任何时刻自己能成五则该分支失败。
 * 结论为 true 时一定是真的必胜（健全性），用来验证棋谜设计。
 */
function forcedWin(b: Board, movesLeft: number): boolean {
  const cands = candidateMoves(b);
  if (cands.some(([x, y]) => makesFive(b, x, y, 1))) return true;
  if (movesLeft <= 1) return false;
  for (const [x, y] of cands) {
    setCell(b, x, y, 1);
    let ok = false;
    const threats = fiveSpots(b, 1);
    if (threats.length > 0 && fiveSpots(b, 2).length === 0) {
      ok = true;
      for (const [wx, wy] of threats) {
        setCell(b, wx, wy, 2);
        const r = forcedWin(b, movesLeft - 1);
        setCell(b, wx, wy, 0);
        if (!r) {
          ok = false;
          break;
        }
      }
    }
    setCell(b, x, y, 0);
    if (ok) return true;
  }
  return false;
}

describe("gomoku 棋谜战役数据", () => {
  it("至少 16 个棋谜", () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(16);
  });

  it("全部为 9×9、步数 1-3、名字互不相同", () => {
    const names = new Set<string>();
    for (const p of PUZZLES) {
      expect(p.size).toBe(9);
      expect(p.moves).toBeGreaterThanOrEqual(1);
      expect(p.moves).toBeLessThanOrEqual(3);
      names.add(p.name);
    }
    expect(names.size).toBe(PUZZLES.length);
  });

  it("棋子都在棋盘内、无重叠，黑白数量相等（黑先行）", () => {
    for (const p of PUZZLES) {
      const seen = new Set<string>();
      for (const [x, y] of [...p.black, ...p.white]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(p.size);
        expect(y).toBeLessThan(p.size);
        const key = `${x},${y}`;
        expect(seen.has(key), `${p.name} 里 ${key} 重复`).toBe(false);
        seen.add(key);
      }
      expect(p.black.length).toBe(p.white.length);
    }
  });

  it("残局里没有已经连成的五", () => {
    for (const p of PUZZLES) {
      const b = puzzleBoard(p);
      for (const [x, y] of [...p.black, ...p.white]) {
        expect(findWinLine(b, x, y), `${p.name} 已有五连`).toBeNull();
      }
    }
  });

  it("步数梯度覆盖 1、2、3 步", () => {
    const byMoves = new Map<number, number>();
    for (const p of PUZZLES) {
      byMoves.set(p.moves, (byMoves.get(p.moves) ?? 0) + 1);
    }
    expect(byMoves.get(1) ?? 0).toBeGreaterThanOrEqual(4);
    expect(byMoves.get(2) ?? 0).toBeGreaterThanOrEqual(4);
    expect(byMoves.get(3) ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("gomoku 棋谜可解性（强制胜验证）", () => {
  for (const p of PUZZLES) {
    it(`「${p.name}」黑棋 ${p.moves} 步内必胜`, () => {
      const b = puzzleBoard(p);
      expect(forcedWin(b, p.moves)).toBe(true);
    });
  }

  it("多步棋谜不会被一步偷解（步数设计合理）", () => {
    for (const p of PUZZLES) {
      if (p.moves < 2) continue;
      const b = puzzleBoard(p);
      expect(
        fiveSpots(b, 1).length,
        `${p.name} 存在一步成五，moves 应设为 1`
      ).toBe(0);
    }
  });

  it("棋谜对局仿真：按解算走法对抗聪明档白棋，步数内取胜", () => {
    // 用求解器沿路取招，白棋用游戏里同款聪明档防守，验证真实对局可赢
    for (const p of PUZZLES) {
      const b = puzzleBoard(p);
      let won = false;
      for (let step = 0; step < p.moves && !won; step++) {
        const left = p.moves - step;
        // 取一个保持必胜的黑棋走法
        const cands = candidateMoves(b);
        let move: [number, number] | null = null;
        const winNow = cands.find(([x, y]) => makesFive(b, x, y, 1));
        if (winNow) {
          move = winNow;
        } else {
          for (const [x, y] of cands) {
            setCell(b, x, y, 1);
            let keeps = false;
            const threats = fiveSpots(b, 1);
            if (threats.length > 0 && fiveSpots(b, 2).length === 0) {
              keeps = true;
              for (const [wx, wy] of threats) {
                setCell(b, wx, wy, 2);
                if (!forcedWin(b, left - 1)) keeps = false;
                setCell(b, wx, wy, 0);
                if (!keeps) break;
              }
            }
            setCell(b, x, y, 0);
            if (keeps) {
              move = [x, y];
              break;
            }
          }
        }
        expect(move, `${p.name} 第 ${step + 1} 步找不到必胜走法`).not.toBeNull();
        setCell(b, move![0], move![1], 1);
        if (findWinLine(b, move![0], move![1])) {
          won = true;
          break;
        }
        // 白棋防守（游戏内同款）
        const reply = bestMove(b, 2, "smart", () => 0);
        expect(reply).not.toBeNull();
        setCell(b, reply!.x, reply!.y, 2);
        expect(findWinLine(b, reply!.x, reply!.y), `${p.name} 白棋反杀了`).toBeNull();
      }
      expect(won, `${p.name} 在 ${p.moves} 步内没赢`).toBe(true);
    }
  });
});
