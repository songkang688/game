/**
 * 方块叠叠乐 · 新手也走得通的那条路线。
 *
 * `levels.test.ts` 已经用 `solveLevel`（地狱档、带预读、允许「落地之后再转身」）
 * 证明过 188 关每一关都有解。但那条路线里有小凸转身这种进阶手法 ——
 * 刚上手的孩子（和自动化假人）都按不出来。
 *
 * 这一份钉的是更低的那道门槛:**只用「先转好、再左右挪、然后直落」这三下**,
 * 头两关能不能打通。三下都是攻略第一页就教的动作,没有任何进阶手法。
 * 打不通就说明入门章对新手过不去,是关卡设计问题,不是手残。
 *
 * 顺带:同一段推演的落点可以直接翻译成按键，`QA_EMIT_PLAN=1` 时写到
 * `.qa-tmp/block-drop-plan.json`，给 `scripts/qa-1.2-window1-winlose.mjs`
 * 的真操作假人当剧本（那边只会照着按 `f` / `a` / `d` / `w`）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyPlacement, enumeratePlacements, measure, scorePlacement, WEIGHTS, type Weights } from "./ai";
import { cloneBoard } from "./board";
import { levelConfig, startBoard } from "./levels";
import { PieceQueue, rng, spawnX } from "./pieces";

/** 假人按得出来的一步:转几下、往哪挪几格,然后硬降 */
interface KeyStep {
  id: string;
  rot: number;
  dx: number;
}

interface Route {
  tier: string;
  targetLines: number;
  budget: number;
  lines: number;
  used: number;
  steps: KeyStep[];
}

/**
 * 只用「转好再直落」的落点推一遍这一关。
 * 带一步预读（跟游戏里地狱档同一个思路）:把下一块也摆一遍再回头看这一步值不值。
 */
function beginnerRoute(human: number, w: Weights, tier: string): Route {
  const lv = human - 1;
  const cfg = levelConfig(lv);
  let board = cloneBoard(startBoard(lv));
  const queue = new PieceQueue(rng(cfg.seed), cfg.bag);
  const steps: KeyStep[] = [];
  let lines = 0;
  let used = 0;

  while (used < cfg.pieceBudget && lines < cfg.targetLines) {
    const id = queue.take();
    const next = queue.peek(1)[0] ?? null;
    const cands = enumeratePlacements(board, id).filter((p) => !p.spun);
    if (cands.length === 0) break;

    let best = cands[0];
    let bestScore = -Infinity;
    for (const p of cands) {
      let s = scorePlacement(measure(board, p), w);
      if (next) {
        const after = applyPlacement(board, p).board;
        let bestNext = -Infinity;
        for (const q of enumeratePlacements(after, next)) {
          if (q.spun) continue;
          bestNext = Math.max(bestNext, scorePlacement(measure(after, q), w));
        }
        if (bestNext > -Infinity) s += bestNext;
      }
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }

    steps.push({ id, rot: best.rot, dx: best.x - spawnX(id, board[0].length) });
    const r = applyPlacement(board, best);
    board = r.board;
    lines += r.lines;
    used += 1;
  }
  return { tier, targetLines: cfg.targetLines, budget: cfg.pieceBudget, lines, used, steps };
}

/** 四档权重都试一遍，取第一条走得通的（走不通就返回消行最多的那条） */
function bestRoute(human: number): Route {
  let best: Route | null = null;
  for (const tier of ["normal", "rookie", "pro", "hell"] as const) {
    const r = beginnerRoute(human, WEIGHTS[tier], tier);
    if (!best || r.lines > best.lines) best = r;
    if (r.lines >= r.targetLines) return r;
  }
  return best as Route;
}

const LEVELS = [1, 12];

describe("入门两关:只用转 / 挪 / 直落这三下就能过", () => {
  const routes = new Map<number, Route>(LEVELS.map((n) => [n, bestRoute(n)]));

  for (const n of LEVELS) {
    it(`第 ${n} 关不用小凸转身也打得通`, () => {
      const r = routes.get(n) as Route;
      expect(r.lines, `第 ${n} 关只用基础三下最多消 ${r.lines} 行,目标是 ${r.targetLines} 行`).toBeGreaterThanOrEqual(
        r.targetLines
      );
    });

    it(`第 ${n} 关这条路线还剩得下块数预算`, () => {
      const r = routes.get(n) as Route;
      expect(r.used).toBeLessThanOrEqual(r.budget);
    });

    it(`第 ${n} 关每一步都按得出来:转不超过 3 下、挪不出场地`, () => {
      const r = routes.get(n) as Route;
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) {
        expect(s.rot, `${s.id} 要转 ${s.rot} 下`).toBeGreaterThanOrEqual(0);
        expect(s.rot).toBeLessThanOrEqual(3);
        expect(Math.abs(s.dx), `${s.id} 要横着挪 ${s.dx} 格`).toBeLessThanOrEqual(10);
      }
    });
  }

  it("要用的话就把按键剧本写出来（QA_EMIT_PLAN=1 时才写盘）", () => {
    if (process.env.QA_EMIT_PLAN !== "1") return;
    mkdirSync(".qa-tmp", { recursive: true });
    writeFileSync(".qa-tmp/block-drop-plan.json", JSON.stringify(Object.fromEntries(routes), null, 2));
    expect(routes.size).toBe(LEVELS.length);
  });
});
