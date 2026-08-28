/**
 * C-6 alien-seek:画布钳高 + 矮横屏双栏。验收含推理关(isDeduceLevel,进度格 121)。
 * 探索判定 / 关卡数据零触碰。不要写成 B 的双人分屏款。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCENE_H, SCENE_W } from "./logic";
import { isDeduceLevel } from "./levels";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./stageFit";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const LOGIC = readFileSync(fileURLToPath(new URL("./logic.ts", import.meta.url)), "utf8");
const LEVELS = readFileSync(fileURLToPath(new URL("./levels.ts", import.meta.url)), "utf8");

describe("C-6 canvasDisplayCapPx", () => {
  it("装得下不写样式", () => {
    expect(canvasDisplayCapPx(200, 220)).toBeNull();
    expect(canvasDisplayCapPx(200, 200)).toBeNull();
  });

  it("915 宽按比例 wantH≈586,余量 180 则钳到 180", () => {
    const wantH = Math.round(915 * (SCENE_H / SCENE_W));
    expect(wantH).toBeGreaterThan(500);
    const px = canvasDisplayCapPx(wantH, 180);
    expect(px).toBe(180);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });

  it("余量再小也不低于 MIN", () => {
    expect(canvasDisplayCapPx(400, 40)).toBe(MIN_CANVAS_DISPLAY_PX);
  });

  it("量不出数时不动手", () => {
    expect(canvasDisplayCapPx(400, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 200)).toBeNull();
  });
});

describe("C-6 接线与推理关验收样本", () => {
  it("createRunner.syncSize 走 canvasRoomPx / canvasDisplayCapPx", () => {
    expect(INDEX).toContain("canvasRoomPx(canvas, wrap)");
    expect(INDEX).toContain("canvasDisplayCapPx(wantH, room)");
  });

  it("矮横屏双栏,线索与 D-pad 在右栏,不是 duo-arena 那套垫", () => {
    expect(INDEX).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(INDEX).toContain(".as-pads{grid-column:2;}");
    expect(INDEX).toContain(".as-clues{grid-column:2;");
    expect(INDEX).not.toContain("duo-arena");
  });

  it("推理关 121(0 基,ch6 idx 2)是 deduce;判定源码未改", () => {
    expect(isDeduceLevel(121)).toBe(true);
    expect(INDEX).toContain('lv.mode === "deduce"');
    expect(LOGIC).toContain("export function clueHolds");
    expect(LEVELS).toContain("export function isDeduceLevel");
  });
});
