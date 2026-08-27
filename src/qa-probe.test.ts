/**
 * 临时取证探针（第 3 轮）：给 `block-drop` 的战役关算一份**按键剧本**。
 *
 * 关卡的出块顺序由 seed 定死，落点又可以用仓库里现成的 `enumeratePlacements` /
 * `scorePlacement` 挑出来，所以「这一关该怎么打」是可以离线算完的。
 * 这里只挑「转好再直落」的落点（`spun === false`），因为落地之后再转身那一手
 * 浏览器假人没法照着按。算完写成 JSON，给 `qa-1.2-window1-winlose.mjs` 当剧本用。
 *
 * 这个文件只在取证时存在，取完就删。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { applyPlacement, enumeratePlacements, measure, scorePlacement, WEIGHTS } from "./games/block-drop/ai";
import { cloneBoard } from "./games/block-drop/board";
import { levelConfig, startBoard } from "./games/block-drop/levels";
import { PieceQueue, rng, spawnX } from "./games/block-drop/pieces";

const LEVELS = [1, 12];

describe("probe", () => {
  it("算出按键剧本", () => {
    const out: Record<string, unknown> = {};
    for (const human of LEVELS) {
      const lv = human - 1;
      const cfg = levelConfig(lv);
      // `hell` 那档带 `well: 0.5`，会一直留井等长条打满四行；本关只要 3 行，
      // 留井反而一行都消不掉。四档都试一遍，取第一档打得穿的。
      let picked: Record<string, unknown> | null = null;
      for (const tier of ["normal", "rookie", "pro", "hell"] as const) {
        let board = cloneBoard(startBoard(lv));
        const queue = new PieceQueue(rng(cfg.seed), cfg.bag);
        const steps: { id: string; rot: number; dx: number }[] = [];
        let lines = 0;
        let used = 0;
        while (used < cfg.pieceBudget && lines < cfg.targetLines) {
          const id = queue.take();
          const next = queue.peek(1)[0] ?? null;
          // 只要「转好再直落」的落点：假人按得出来的就这一类
          const cands = enumeratePlacements(board, id).filter((p) => !p.spun);
          if (cands.length === 0) break;
          let best = cands[0];
          let bestScore = -Infinity;
          for (const p of cands) {
            let s = scorePlacement(measure(board, p), WEIGHTS[tier]);
            // 跟游戏里地狱档一样带一步预读：把下一块也摆一遍再回头看这一步值不值
            if (next) {
              const after = applyPlacement(board, p).board;
              let bestNext = -Infinity;
              for (const q of enumeratePlacements(after, next)) {
                if (q.spun) continue;
                bestNext = Math.max(bestNext, scorePlacement(measure(after, q), WEIGHTS[tier]));
              }
              if (bestNext > -Infinity) s += bestNext;
            }
            if (s > bestScore) {
              bestScore = s;
              best = p;
            }
          }
          const r = applyPlacement(board, best);
          board = r.board;
          lines += r.lines;
          used += 1;
          steps.push({ id, rot: best.rot, dx: best.x - spawnX(id, board[0].length) });
        }
        const rec = { tier, targetLines: cfg.targetLines, budget: cfg.pieceBudget, lines, used, steps };
        if (!picked || lines >= cfg.targetLines) picked = rec;
        if (lines >= cfg.targetLines) break;
      }
      out[String(human)] = picked;
    }
    mkdirSync(".qa-tmp", { recursive: true });
    writeFileSync(".qa-tmp/block-drop-plan.json", JSON.stringify(out, null, 2));
  });
});
