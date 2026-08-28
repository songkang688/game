/**
 * N-36(trio-r9):描红米字格按可视余量钳边长。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clampTracePadPx, MIN_PAD_PX, WGD_CSS } from "./tracing";

const SRC = readFileSync(new URL("./tracing.ts", import.meta.url), "utf8");

describe("N-36 描红 pad 高度尺", () => {
  it("915×412 一族:72vw 被 300 顶住后再被余量钳到整格进屏", () => {
    expect(clampTracePadPx(0.72 * 915, 262)).toBe(262);
    expect(clampTracePadPx(0.72 * 915, 262)).toBeLessThan(300);
  });

  it("竖屏三档余量充足时仍按 72vw/300 走", () => {
    expect(clampTracePadPx(0.72 * 360, 400)).toBe(Math.min(0.72 * 360, 300));
    expect(clampTracePadPx(0.72 * 390, 600)).toBe(Math.min(0.72 * 390, 300));
    expect(clampTracePadPx(0.72 * 412, 700)).toBe(Math.min(0.72 * 412, 300));
  });

  it("余量低于 MIN_PAD_PX 时保底", () => {
    expect(MIN_PAD_PX).toBe(240);
    expect(clampTracePadPx(300, 180)).toBe(MIN_PAD_PX);
  });

  it("接线:CSS 吃 --wgd-pad-room", () => {
    expect(WGD_CSS).toContain("var(--wgd-pad-room,300px)");
    expect(SRC).toContain('wrap.style.setProperty("--wgd-pad-room"');
    expect(SRC).toContain("judgeTrace(c.char, done, drawn)");
  });
});
