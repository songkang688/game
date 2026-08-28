/**
 * N-44 · 算数小农场竖式插图关：矮横屏三枚答案钮不许整排线下。
 * 题目数据 / 对错零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FARM_CSS, MIN_CROP_PX } from "./farmScene";

const QUIZ = readFileSync(fileURLToPath(new URL("../quiz99.ts", import.meta.url)), "utf8");
const RUNNER = readFileSync(fileURLToPath(new URL("./runner.ts", import.meta.url)), "utf8");
const GEN = readFileSync(fileURLToPath(new URL("./gen.ts", import.meta.url)), "utf8");

describe("N-44 math-farm 竖式插图矮横屏收高", () => {
  it("quiz99 紧凑档把农场 DOM 插图也钳进去，不只 svg", () => {
    const start = QUIZ.indexOf("@media (max-height: 500px)");
    const block = QUIZ.slice(start, QUIZ.indexOf("`;", start));
    expect(block).toMatch(/\.qz-prompt svg, \.qz-prompt img \{ max-height: \d+px/);
    expect(block).toContain(".qz-prompt .mtf-vert");
    expect(block).toContain(".qz-wrap > .mtf-illus");
    expect(block).toMatch(/max-height: 64px/);
  });

  it("农场皮肤矮屏钳作物卡，木牌热区仍 ≥44px", () => {
    expect(FARM_CSS).toContain("@media (max-height: 500px)");
    const short = FARM_CSS.slice(FARM_CSS.indexOf("@media (max-height: 500px)"));
    const end = short.indexOf("@media", 10);
    const block = end < 0 ? short : short.slice(0, end);
    expect(block).toContain(".mtf-illus { max-height: 56px;");
    expect(block).toContain(`width: ${MIN_CROP_PX}px; height: ${MIN_CROP_PX}px;`);
    expect(block).toContain(".mtf-quizhost .qz-choice { min-height: 46px; }");
    expect(MIN_CROP_PX).toBeGreaterThanOrEqual(16);
  });

  it("竖式字号紧凑档在 runner，出题函数零触碰", () => {
    expect(RUNNER).toContain("@media (max-height: 500px)");
    expect(RUNNER).toContain(".mtf-vert-row { font-size:");
    expect(GEN).toContain("function verticalHTML");
    expect(GEN).toContain('case "vertical"');
  });
});
