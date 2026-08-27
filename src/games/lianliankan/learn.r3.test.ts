/**
 * 连连看 · 窗口 4 档A · 第 3 轮学习优化员（A-L14）。
 *
 * 三次提示用光之后，原来按钮就灰掉，屏幕上只剩一句
 * 「最后一次提示用完啦，接下来靠自己扫盘」——这不是方法，
 * 是把问题原样退回去。改成「指个方向」：报出此刻还有几对连得上、
 * 最好找的那一对在哪一带、贴不贴边。答案仍旧孩子自己找。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { createBoard, findPath, removePair, type BoardSpec, type BoardState, type Pt } from "./board";
import { LEVELS, boardSeed } from "./levels";
import { hintsLeft, selfHelp, turnCount, HINT_MAX } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜", "怎么还"];

/** 老老实实全盘数一遍：现在有几对连得上、最少拐几次弯 */
function bruteForce(b: BoardState, maxTurns = 2): { pairs: number; minTurns: number } {
  let pairs = 0;
  let minTurns = Infinity;
  for (let r = 0; r < b.R; r++) {
    for (let c = 0; c < b.C; c++) {
      if (b.grid[r][c] < 0) continue;
      for (let r2 = r; r2 < b.R; r2++) {
        for (let c2 = r2 === r ? c + 1 : 0; c2 < b.C; c2++) {
          if (b.grid[r2][c2] < 0 || b.grid[r][c] !== b.grid[r2][c2]) continue;
          const p = findPath(b, [r, c], [r2, c2], maxTurns);
          if (!p) continue;
          pairs++;
          minTurns = Math.min(minTurns, turnCount(p));
        }
      }
    }
  }
  return { pairs, minTurns };
}

const spec: BoardSpec = { rows: 8, cols: 8, kinds: 10, gravity: "none", maxTurns: 2 };

describe("连连看 · A-L14 · 提示用光之后仍给方法", () => {
  it("报出来的对数就是场上真实的对数，不是估的", () => {
    for (let s = 0; s < 25; s++) {
      const board = createBoard(spec, mulberry32(3100 + s));
      expect(selfHelp(board).pairs, `seed ${s}`).toBe(bruteForce(board).pairs);
    }
  });

  it("指的那一带里真的有连得上的一对，不会把孩子支到空地上", () => {
    for (let s = 0; s < 25; s++) {
      const board = createBoard(spec, mulberry32(4200 + s));
      const help = selfHelp(board);
      expect(help.pairs).toBeGreaterThan(0);
      // 把「上 / 中 / 下」翻回行号区间，看这一带里是不是真的有一对
      const lo = help.band === "上" ? 1 : help.band === "中" ? 1 + board.rows / 3 : 1 + (board.rows * 2) / 3;
      const hi = help.band === "上" ? 1 + board.rows / 3 : help.band === "中" ? 1 + (board.rows * 2) / 3 : board.rows;
      let found = false;
      for (let r = 0; r < board.R && !found; r++) {
        for (let c = 0; c < board.C && !found; c++) {
          if (board.grid[r][c] < 0) continue;
          for (let r2 = 0; r2 < board.R && !found; r2++) {
            for (let c2 = 0; c2 < board.C && !found; c2++) {
              if (board.grid[r2][c2] < 0 || board.grid[r][c] !== board.grid[r2][c2]) continue;
              if (r === r2 && c === c2) continue;
              if (!findPath(board, [r, c], [r2, c2], 2)) continue;
              const mid = (r + r2) / 2;
              if (mid >= lo - 1e-9 && mid <= hi + 1e-9) found = true;
            }
          }
        }
      }
      expect(found, `seed ${s} 指的「${help.band}半场」里一对都没有`).toBe(true);
    }
  });

  it("能连成直线的时候就说「同行同列先扫」，那条规矩下一局还用得上", () => {
    let sawStraight = 0;
    for (let s = 0; s < 40; s++) {
      const board = createBoard(spec, mulberry32(5300 + s));
      const help = selfHelp(board);
      const bf = bruteForce(board);
      if (bf.minTurns === 0) {
        sawStraight++;
        expect(help.word, `seed ${s}`).toContain("同行同列");
      } else {
        expect(help.word, `seed ${s}`).toContain("行和列");
      }
    }
    expect(sawStraight, "四十个盘里一个直线对都没有，测得不够").toBeGreaterThan(0);
  });

  it("指方向不指格子：话里不出现行号列号，不会把答案直接说出来", () => {
    for (let s = 0; s < 20; s++) {
      const help = selfHelp(createBoard(spec, mulberry32(6400 + s)));
      expect(help.word).not.toMatch(/第\s*\d+\s*[行列格]/);
      expect(help.word).not.toMatch(/\(\d+\s*,\s*\d+\)/);
      // 只有「还有几对」这一个数字，那是范围不是答案
      expect(help.word.match(/\d+/g)?.length, `seed ${s} 话里数字太多`).toBe(1);
    }
  });

  it("真的一对都连不上时改口叫重排，不硬凑一句「再找找」", () => {
    // 把盘面消到只剩一对，再把这一对也消掉
    const board = createBoard({ rows: 2, cols: 2, kinds: 2, gravity: "none", maxTurns: 2 }, mulberry32(11));
    let guard = 0;
    while (bruteForce(board).pairs > 0 && guard++ < 10) {
      outer: for (let r = 1; r <= 2; r++) {
        for (let c = 1; c <= 2; c++) {
          if (board.grid[r][c] < 0) continue;
          for (let r2 = 1; r2 <= 2; r2++) {
            for (let c2 = 1; c2 <= 2; c2++) {
              if ((r === r2 && c === c2) || board.grid[r2][c2] < 0) continue;
              if (board.grid[r][c] !== board.grid[r2][c2]) continue;
              if (!findPath(board, [r, c], [r2, c2], 2)) continue;
              removePair(board, [r, c] as Pt, [r2, c2] as Pt);
              break outer;
            }
          }
        }
      }
    }
    const help = selfHelp(board);
    expect(help.pairs).toBe(0);
    expect(help.word).toContain("重排");
  });

  it("每一句都只指方向、只鼓励，没有一句是数落", () => {
    for (let lv of [0, 45, 99, 143, 187]) {
      const l = LEVELS[lv];
      const board = createBoard(
        { rows: l.rows, cols: l.cols, kinds: l.kinds, gravity: l.gravity ?? "none", maxTurns: l.maxTurns ?? 2 },
        mulberry32(boardSeed(lv))
      );
      const word = selfHelp(board, l.maxTurns ?? 2).word;
      for (const w of BLAME_WORDS) expect(word, `第 ${lv + 1} 关不该说「${w}」`).not.toContain(w);
      expect(word.length).toBeGreaterThan(10);
    }
  });

  it("按钮不再灰掉：用完三次改成「指个方向」，而且不再多扣星", () => {
    expect(hintsLeft(HINT_MAX)).toBe(0);
    expect(SRC).toContain("指个方向");
    expect(SRC).toContain("selfHelp");
    // 原来那句「用完就灰掉」已经拆了
    expect(SRC).not.toContain("hintBtn.disabled = hintsLeft(hintsUsed) <= 0");
    // 指方向不算一次提示：hintsUsed 只在真提示那条路上加
    const uses = [...SRC.matchAll(/hintsUsed\+\+/g)];
    expect(uses.length).toBe(1);
  });
});
