/**
 * 临时取证探针：给 `block-drop` 的走查假人算一份「按得出来」的通关剧本。
 *
 * 战役关的出块顺序由 seed 定死，落点用仓库自带的 `enumeratePlacements` /
 * `scorePlacement` 离线挑，所以整关「该转几下、往哪挪」可以先算完再按。
 * 只收「转好再直落」的落点（`spun === false`）—— 落地之后再转身那一手假人按不出来。
 * 取完即删。
 */
import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { COLS, cloneBoard } from "./games/block-drop/board";
import { PieceQueue, rng, spawnX } from "./games/block-drop/pieces";
import {
  WEIGHTS,
  applyPlacement,
  enumeratePlacements,
  measure,
  scorePlacement
} from "./games/block-drop/ai";
import { levelConfig, levelWon, startBoard } from "./games/block-drop/levels";

/**
 * 一层一层地往前搜。
 *
 * 贪心（每一手只看眼前分数最高的落点）在入门章里会一路把场地铺平却一行都不消 ——
 * 实测第 1 关 22 个块下完，消行 0。所以改成定宽束搜索：出块顺序是定死的，
 * 先整串取出来，再在这串上留 `WIDTH` 条最有希望的路线往下走。
 */
const WIDTH = 60;

function planFor(level: number): { steps: Array<{ rot: number; dx: number }>; lines: number; won: boolean } {
  const cfg = levelConfig(level - 1);
  const queue = new PieceQueue(rng(cfg.seed), cfg.bag);
  const budget = cfg.pieceBudget > 0 ? cfg.pieceBudget : 60;
  const seq = Array.from({ length: budget }, () => queue.take());

  type Node = { board: ReturnType<typeof cloneBoard>; lines: number; steps: Array<{ rot: number; dx: number }> };
  let beam: Node[] = [{ board: cloneBoard(startBoard(level - 1)), lines: 0, steps: [] }];
  let bestSeen: Node = beam[0];

  for (const id of seq) {
    const next: Array<Node & { score: number }> = [];
    for (const node of beam) {
      for (const p of enumeratePlacements(node.board, id)) {
        if (p.spun) continue; // 落地之后再转身那一手假人按不出来
        const m = measure(node.board, p);
        const applied = applyPlacement(node.board, p);
        const kid: Node = {
          board: applied.board,
          lines: node.lines + applied.lines,
          steps: [...node.steps, { rot: p.rot, dx: p.x - spawnX(id, COLS) }]
        };
        next.push({ ...kid, score: kid.lines * 1000 + scorePlacement(m, WEIGHTS.pro) });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, WIDTH);
    for (const node of beam) {
      if (node.lines > bestSeen.lines) bestSeen = node;
      if (levelWon(cfg, { lines: node.lines, toppedOut: false })) {
        return { steps: node.steps, lines: node.lines, won: true };
      }
    }
  }
  return { steps: bestSeen.steps, lines: bestSeen.lines, won: levelWon(cfg, { lines: bestSeen.lines, toppedOut: false }) };
}

describe("probe", () => {
  it("算 block-drop 的通关剧本", () => {
    mkdirSync(".qa-tmp", { recursive: true });
    const out: Record<string, { steps: Array<{ rot: number; dx: number }> }> = {};
    const notes: string[] = [];
    for (const lv of [1, 12, 60, 140]) {
      const r = planFor(lv);
      out[String(lv)] = { steps: r.steps };
      const cfg = levelConfig(lv - 1);
      notes.push(
        `lv=${lv} 步数=${r.steps.length} 消行=${r.lines} 算得出过关=${r.won} 目标=${JSON.stringify(cfg.goal)} 块预算=${cfg.pieceBudget}`
      );
    }
    writeFileSync(".qa-tmp/block-drop-plan.json", JSON.stringify(out));
    writeFileSync(".qa-tmp/block-drop-plan.txt", `${notes.join("\n")}\n`);
  });
});
