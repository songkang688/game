/**
 * 形状王国 · 七巧板那一小题真的拼得出来吗（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 测试员在第 2 轮 B9「没做到的」里写明：七巧板小题的**判定**没能实机验到——
 * 矮屏上够不着控件（W5-B-10），压根摆不完一整题，所以「摆对了到底认不认」
 * 一次都没验过。W5-B-10 这一轮修掉了，这条覆盖也该补上。
 *
 * 这一份不改一行产品代码，只补两件事：
 *
 *  1. **每一道会发到孩子手上的七巧板都真的拼得满。**
 *     `TILING_PUZZLES` 上写着「手工验算过」，但没有任何用例验过这句话。
 *     这里写一个回溯求解器，把第 100–188 关（含错题回顾换的那几轮）能生成的
 *     每一道题都真解一遍，再把解喂给 `judgeTiling` 确认它认。
 *     只要哪天有人往题库里加一道拼不满的，这条会当场红——这是给孩子的最后一道闸：
 *     一道拼不出来的题，孩子会以为是自己笨。
 *  2. **判定该拒的都拒。** 少摆一块、摆重叠、留空、同一块用两次、
 *     摆成题目里没有的形状，一条一条钉住。
 */
import { describe, expect, it } from "vitest";
import { buildDrawTasks, judgeTiling, placePiece, type TilingTask } from "./draw";
import { cellKey, parseCellKey, pieceOrientations, sortedCells, type CellKey } from "./geometry";

/** 把 `buildDrawTasks` 在 188 关（外加错题回顾的几轮）能发出来的七巧板全收齐、去重 */
function allTilingTasks(): TilingTask[] {
  const seen = new Map<string, TilingTask>();
  for (let level = 100; level <= 188; level += 1) {
    for (let round = 0; round < 3; round += 1) {
      for (const t of buildDrawTasks(level, 6, round)) {
        if (t.kind !== "tiling") continue;
        const id = `${t.cols}x${t.rows}|${t.target.join(" ")}|${t.pieces.map((p) => p.join(",")).join("|")}`;
        if (!seen.has(id)) seen.set(id, t);
      }
    }
  }
  return [...seen.values()];
}

/**
 * 回溯求解：每次挑轮廓里**还空着的最靠前那一格**，试着让某一块的某个朝向盖住它。
 * 挑最靠前那一格是关键——它保证每一格都被谁盖住这件事一定会被问到，
 * 不会出现「绕开一格慢慢试」的组合爆炸。
 */
function solve(task: TilingTask): Array<{ piece: number; cells: CellKey[] }> | null {
  const target = new Set<CellKey>(task.target);
  const order = sortedCells(target);
  const filled = new Set<CellKey>();
  const used = new Array<boolean>(task.pieces.length).fill(false);
  const out: Array<{ piece: number; cells: CellKey[] }> = [];

  const step = (): boolean => {
    const spot = order.find((k) => !filled.has(k));
    if (spot === undefined) return used.every(Boolean);
    const { r: sr, c: sc } = parseCellKey(spot);
    for (let i = 0; i < task.pieces.length; i += 1) {
      if (used[i]) continue;
      const forms = pieceOrientations(task.pieces[i]);
      for (let o = 0; o < forms.length; o += 1) {
        // 让这一块的每一格轮流去当「盖住 spot 的那一格」
        for (const anchor of forms[o]) {
          const { r: ar, c: ac } = parseCellKey(anchor);
          const cells = [...placePiece(task.pieces[i], o, sr - ar, sc - ac)];
          if (cells.some((k) => !target.has(k) || filled.has(k))) continue;
          for (const k of cells) filled.add(k);
          used[i] = true;
          out.push({ piece: i, cells });
          if (step()) return true;
          out.pop();
          used[i] = false;
          for (const k of cells) filled.delete(k);
        }
      }
    }
    return false;
  };

  return step() ? out : null;
}

const TASKS = allTilingTasks();

describe("形状王国 · 发到孩子手上的每一道七巧板都拼得满", () => {
  it("题库确实被 188 关用上了（这一份不是在空转）", () => {
    expect(TASKS.length).toBeGreaterThanOrEqual(4);
  });

  it("每一道都解得出来，而且解出来的摆法 judgeTiling 认", () => {
    for (const task of TASKS) {
      const sol = solve(task);
      expect(sol, `这道 ${task.cols}×${task.rows} 的拼不满：${task.target.join(" ")}`).not.toBeNull();
      expect(judgeTiling(task, sol!), "解出来了却判不对").toBe(true);
    }
  });

  it("块的总格子数 = 轮廓的格子数（对不上就是题出错了，不是孩子摆错了）", () => {
    for (const task of TASKS) {
      const sum = task.pieces.reduce((n, p) => n + p.length, 0);
      expect(sum, `${task.cols}×${task.rows} 这道块数和轮廓对不上`).toBe(task.target.length);
    }
  });

  it("轮廓的每一格都在棋盘里（不许有格子摆到画面外面去）", () => {
    for (const task of TASKS) {
      for (const k of task.target) {
        const { r, c } = parseCellKey(k);
        expect(r >= 0 && r < task.rows, `${k} 的行超出 ${task.rows}`).toBe(true);
        expect(c >= 0 && c < task.cols, `${k} 的列超出 ${task.cols}`).toBe(true);
      }
    }
  });
});

describe("形状王国 · 七巧板判定该拒的都拒", () => {
  const task = TASKS[0];
  const sol = solve(task)!;

  it("正解认", () => {
    expect(judgeTiling(task, sol)).toBe(true);
  });

  it("少摆一块不认（还有空格）", () => {
    expect(judgeTiling(task, sol.slice(0, sol.length - 1))).toBe(false);
  });

  it("同一块用两次不认", () => {
    const dup = [...sol.slice(0, sol.length - 1), { ...sol[0] }];
    expect(judgeTiling(task, dup)).toBe(false);
  });

  it("两块叠在一起不认", () => {
    const overlap = sol.map((p, i) => (i === sol.length - 1 ? { ...p, cells: [...sol[0].cells] } : p));
    expect(judgeTiling(task, overlap)).toBe(false);
  });

  it("摆成题目里没有的形状不认（哪怕格子数刚好凑够）", () => {
    // 把最后一块换成一条横排：格子数一样，形状对不上任何一个朝向
    const last = sol[sol.length - 1];
    const bogus = last.cells.map((_, i) => cellKey(0, task.cols + i));
    expect(judgeTiling(task, [...sol.slice(0, -1), { piece: last.piece, cells: bogus }])).toBe(false);
  });

  it("一块都没摆不认（空着交卷不算过）", () => {
    expect(judgeTiling(task, [])).toBe(false);
  });
});
