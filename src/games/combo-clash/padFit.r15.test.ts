import { describe, expect, it } from "vitest";
import { CSS, MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";

describe("N-76 combo-clash 轻/重/必杀矮横屏", () => {
  it("矮屏钉三键并收摇杆,默认钳高下限不变", () => {
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".cc-pad{position:sticky;bottom:0");
    expect(CSS).toContain(".cc-info{max-height:52px;overflow:auto");
    expect(canvasDisplayCapPx(250, 80)).toBe(MIN_CANVAS_DISPLAY_PX);
  });
});
