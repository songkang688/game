/**
 * N-73：music-stars 简谱视奏琴键须进 915×412。≠ 沙盒、≠ 只抬芯片。
 * 旋律 / 判定（onScoreTap 对下标）零触碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { CHIP_MIN_PX, MST_CSS, SCORE_LANDSCAPE_MAX_H, SCORE_LANDSCAPE_MIN_W } from "./ui";

const ADV = readFileSync(new URL("./advanced.ts", import.meta.url), "utf8");
const SANDBOX = readFileSync(new URL("./sandboxUi.ts", import.meta.url), "utf8");
const INDEX = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function rule(css: string, selector: string): string {
  const at = css.indexOf(selector + "{");
  if (at < 0) return "";
  return css.slice(at + selector.length + 1, css.indexOf("}", at));
}

describe("N-73 简谱视奏 · 矮横屏琴键", () => {
  it("第 167 关（下标 166）是 score，不是节奏/沙盒", () => {
    expect(LEVELS[166]?.mode).toBe("score");
    expect(LEVELS[99]?.mode).toBe("rhythm");
  });

  it("只给视奏壳加 mst-wrap-score；沙盒与跟弹入口不加", () => {
    expect(ADV).toContain('cfg.mode === "score" ? "mst-wrap mst-wrap-score" : "mst-wrap"');
    expect(SANDBOX).not.toContain("mst-wrap-score");
    expect(INDEX).not.toContain("mst-wrap-score");
  });

  it("915×412 一族把琴键放到右栏吃满高，不靠收芯片热区", () => {
    expect(SCORE_LANDSCAPE_MAX_H).toBe(500);
    expect(SCORE_LANDSCAPE_MIN_W).toBe(600);
    expect(MST_CSS).toContain(`@media (max-height:${SCORE_LANDSCAPE_MAX_H}px) and (min-width:${SCORE_LANDSCAPE_MIN_W}px)`);
    const land = MST_CSS.slice(MST_CSS.indexOf(`@media (max-height:${SCORE_LANDSCAPE_MAX_H}px)`));
    expect(land).toContain(".mst-wrap.mst-wrap-score > .mst-sky");
    expect(land).toContain("justify-content:flex-end");
    expect(land).toContain("grid-template-columns:minmax(0,1fr) minmax(240px,46%)");
    expect(CHIP_MIN_PX).toBe(44);
    expect(rule(MST_CSS, ".mst-chip")).toContain(`min-height:${CHIP_MIN_PX}px`);
    expect(land.slice(0, land.indexOf("@media (prefers-reduced-motion"))).not.toContain(".mst-chip{");
  });

  it("判定仍是谱面下标对琴键下标，时值/旋律生成器未改入口", () => {
    expect(ADV).toContain("if (i === seq[inputPos])");
    expect(ADV).toContain("function onScoreTap(i: number)");
    expect(ADV).toContain("buildScores(level)");
  });
});
