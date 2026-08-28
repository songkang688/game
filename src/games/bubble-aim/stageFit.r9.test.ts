/** 三人组 r9 · N-29 关内发射台出屏 + N-23 地图 clamp/focusCurrent */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";
import { H } from "./logic";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-29 bubble-aim 关内画布钳高", () => {
  it("装得下不写样式", () => {
    expect(canvasDisplayCapPx(480, 500)).toBeNull();
    expect(canvasDisplayCapPx(480, 480)).toBeNull();
  });

  it("915×412 口径:原生 480、余量 ~250 → 钳 250,发射台能进屏", () => {
    const px = canvasDisplayCapPx(H, 250);
    expect(px).toBe(250);
    expect(px!).toBeLessThan(H);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });

  it("量不出数不动手", () => {
    expect(canvasDisplayCapPx(H, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(0, 200)).toBeNull();
  });

  it("resize 挂上、destroy 摘掉", () => {
    expect(src).toContain('window.addEventListener("resize", fitCanvas)');
    expect(src).toContain('window.removeEventListener("resize", fitCanvas)');
  });
});

describe("N-23 bubble-aim 地图矮横屏 + focusCurrent", () => {
  it("clamp 下限不再钉死 420px", () => {
    expect(src).not.toContain("clamp(420px");
    expect(src).toContain("max-height: min(960px, max(160px, calc(100dvh - 120px)))");
  });

  it("当前关节点 ba-lv-cur 并 scrollIntoView center", () => {
    expect(src).toContain("ba-lv-cur");
    expect(src).toContain("focusCurrentNode");
    expect(src).toContain('scrollIntoView({ block: "center" })');
  });
});
