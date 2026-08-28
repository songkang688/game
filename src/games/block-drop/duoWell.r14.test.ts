import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WELL_DISPLAY_MIN, wellDisplayPx, wellRoomMin } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-74 block-drop 双人井字", () => {
  it("余量不足下限时贴余量，不再用 180 顶出舞台滚条", () => {
    expect(wellRoomMin(120)).toBe(120);
    expect(wellRoomMin(200)).toBe(WELL_DISPLAY_MIN);
    expect(wellDisplayPx(488, 120, wellRoomMin(120))).toBe(120);
    expect(SRC).toContain("wellRoomMin(room)");
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".bd-wrap{height:100%;max-height:100%");
    expect(SRC).toContain(".bd-seats.bd-split{flex-direction:row");
    expect(SRC).toContain(".bd-mode{height:100%;max-height:100%");
    expect(SRC).toContain("stageEl.scrollTop = 0");
  });
});

describe("N-50 block-drop 闯关七键", () => {
  it("矮屏把七键排 sticky 底，与双人井分测", () => {
    expect(SRC).toContain(".bd-pad{position:sticky;bottom:0");
    expect(SRC).toContain("◀");
  });
});
