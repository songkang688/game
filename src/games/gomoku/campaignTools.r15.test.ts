import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-83 gomoku 闯关工具行", () => {
  it("进局钉悔棋/确认,开始下棋仍只钉在设置面板", () => {
    expect(CSS).toContain(".gmk-panel .gmk-start{position:sticky;bottom:0");
    expect(CSS).toContain(".gmk-btns,.gmk-claimbar{position:sticky;bottom:0");
    expect(CSS).toContain(".gmk-canvas{max-height:min(168px,42dvh)");
  });
});
