/**
 * 窗口 5 · 1.3 第 3 轮(终验)测试员 · 机器化防线守卫。
 *
 * 终验口径(docs/qa/1.3-window5-round3-tester.md):
 * 前两轮沉淀的机器化扫描用例必须全部还在跑、全绿;被删或被跳过(skip)的用例按阻断处理。
 * 这里把三件事钉死:
 *  1. 本窗 10 款的视觉扫描/修复配套测试文件一个都不许消失;
 *  2. 本窗全部测试文件里不许出现 it.skip / describe.skip / it.todo 之类的跳过语法;
 *  3. 10 款绘制文件(index/paint13/visual13/art)的 emoji 码点与画布 fillText
 *     终态水位整表锁死(R2 修复员定稿实测值),只降不升。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const W5_GAMES = [
  "shoot-range",
  "sky-squad",
  "tank-battle",
  "bomb-buddies",
  "snow-fight",
  "bumper-cars",
  "bowling-lane",
  "ice-fire-forest",
  "puff-bros",
  "prince-princess",
] as const;

/** 前两轮沉淀的机器化扫描/配套测试文件清单(谁删谁红)。 */
const GUARDED_TEST_FILES: string[] = [
  ...W5_GAMES.map((g) => `${g}/visualScan13.test.ts`),
  // visualFix13:R1 修复员 9 款(tank-battle 该轮无修复项,本就没有)
  ...W5_GAMES.filter((g) => g !== "tank-battle").map((g) => `${g}/visualFix13.test.ts`),
  // visualFixR2:R2 修复员 3 款
  "snow-fight/visualFixR2.test.ts",
  "prince-princess/visualFixR2.test.ts",
  "bumper-cars/visualFixR2.test.ts",
  // R2 测试员与两轮学习员的钉子
  "prince-princess/visualScanR2.test.ts",
  "bomb-buddies/copy13.test.ts",
  "copyW5R2.test.ts",
];

const DRAW_FILES = ["index.ts", "paint13.ts", "visual13.ts", "art.ts"];

/** R2 修复员定稿后的实测终态水位(R3 终验复测同值),只降不升。 */
const WATER_LEVELS: Record<(typeof W5_GAMES)[number], { emoji: number; fillText: number }> = {
  "shoot-range": { emoji: 52, fillText: 5 },
  "sky-squad": { emoji: 43, fillText: 0 },
  "tank-battle": { emoji: 49, fillText: 0 },
  "bomb-buddies": { emoji: 64, fillText: 3 },
  "snow-fight": { emoji: 53, fillText: 1 },
  "bumper-cars": { emoji: 43, fillText: 0 },
  "bowling-lane": { emoji: 47, fillText: 0 },
  "ice-fire-forest": { emoji: 28, fillText: 2 },
  "puff-bros": { emoji: 72, fillText: 0 },
  "prince-princess": { emoji: 38, fillText: 3 },
};

function drawSrc(game: string): string {
  return DRAW_FILES.map((f) => join(HERE, game, f))
    .filter(existsSync)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
}

describe("窗口5 · R3 终验 · 机器化防线守卫", () => {
  it("前两轮沉淀的视觉扫描/修复配套测试文件全部在位(被删按阻断处理)", () => {
    const missing = GUARDED_TEST_FILES.filter((f) => !existsSync(join(HERE, f)));
    expect(missing).toEqual([]);
  });

  it("本窗全部测试文件零 skip / todo(被跳过按阻断处理)", () => {
    const skipRe = /\b(?:it|describe|test)\s*\.\s*(?:skip|todo|fails)\s*\(/;
    const offenders = GUARDED_TEST_FILES.filter(
      (f) => existsSync(join(HERE, f)) && skipRe.test(readFileSync(join(HERE, f), "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("10 款绘制文件 emoji 码点终态水位整表锁死(只降不升)", () => {
    for (const g of W5_GAMES) {
      const n = (drawSrc(g).match(/\p{Extended_Pictographic}/gu) ?? []).length;
      expect(n, `${g} emoji 码点 ${n} 超过终验水位 ${WATER_LEVELS[g].emoji}`).toBeLessThanOrEqual(
        WATER_LEVELS[g].emoji
      );
    }
  });

  it("10 款绘制文件画布 fillText 终态水位整表锁死(只降不升,剩余全为功能文字)", () => {
    for (const g of W5_GAMES) {
      const n = (drawSrc(g).match(/fillText\(/g) ?? []).length;
      expect(n, `${g} fillText ${n} 超过终验水位 ${WATER_LEVELS[g].fillText}`).toBeLessThanOrEqual(
        WATER_LEVELS[g].fillText
      );
    }
  });
});
