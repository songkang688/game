/**
 * 窗口 1 · 出货源码目录的摆放约定。
 *
 * `src/games/<id>/` 里只放跑得起来的东西(`meta.ts` / `index.ts` 及玩法模块与它们的测试),
 * 设计稿、工作计划这类给人看的文档一律进 `docs/` —— 它们本来就打不进 `dist/`,
 * 放在源码目录里只会让「这个文件是不是运行时要用的」变得说不清。
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = join(GAMES_DIR, "..", "..", "docs");

const WINDOW1_IDS = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
  "merge-2048",
  "mine-garden",
  "sudoku-petal"
];

/** 从 `src/games/<id>/PLAN.md` 挪出来的那几份,现在应当在这里 */
const MOVED_PLANS = [
  "combo-clash",
  "flight-chess",
  "hero-cards",
  "merge-2048",
  "mine-garden",
  "sudoku-petal",
  "weiqi-garden"
];

describe("窗口 1 · 源码目录里不夹文档", () => {
  it("12 款的目录里一个 markdown 都没有", () => {
    const stray: string[] = [];
    for (const id of WINDOW1_IDS) {
      const dir = join(GAMES_DIR, id);
      expect(existsSync(dir), `${id} 目录不见了`).toBe(true);
      for (const f of readdirSync(dir)) {
        if (f.toLowerCase().endsWith(".md")) stray.push(`${id}/${f}`);
      }
    }
    expect(stray).toEqual([]);
  });

  it("挪走的工作计划在 docs/ 里,一份都没弄丢", () => {
    for (const id of MOVED_PLANS) {
      expect(existsSync(join(DOCS_DIR, `plan-1.2-window1-${id}.md`)), `docs 里缺 ${id} 的工作计划`).toBe(true);
    }
  });

  it("12 款的目录里只有 .ts,没有别的运行时会误收的东西", () => {
    const odd: string[] = [];
    for (const id of WINDOW1_IDS) {
      for (const f of readdirSync(join(GAMES_DIR, id), { withFileTypes: true })) {
        if (f.isDirectory()) continue;
        if (!f.name.endsWith(".ts")) odd.push(`${id}/${f.name}`);
      }
    }
    expect(odd).toEqual([]);
  });
});
