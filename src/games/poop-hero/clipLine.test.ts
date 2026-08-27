/**
 * 便便英雄 · 裁切线量到了边框外面（窗口5 第2轮 档C 监督修复员 · W5R2-FC-05）。
 *
 * `canvasRoomPx()` 已经按可视段收过画布了，320×640 第 41 / 141 关的提示行
 * `.ph-tip`（「🧹 清扫 · 踩上弹簧蘑菇能弹得特别高…」）还是被切掉 8px：17px 高只露 9px。
 * 差的就是 `.game-stage` 那圈 `border:4px solid #fff`——滚动口是 padding box，
 * 下边框照不进内容，而 `stageRoomPx()` 量的是 border box 的下沿。
 */
import { describe, expect, it } from "vitest";

import { clipBottomPx, stageRoomPx } from "./runtime";

interface StubStyle {
  overflowY: string;
  borderBottomWidth: string;
}

interface StubEl {
  parentElement: StubEl | null;
  ownerDocument?: { defaultView: unknown };
  getBoundingClientRect(): { top: number; bottom: number };
  style: StubStyle;
}

function realChain(): StubEl {
  const view = { getComputedStyle: (p: StubEl) => p.style };
  const stage: StubEl = {
    parentElement: null,
    getBoundingClientRect: () => ({ top: 88, bottom: 626 }),
    style: { overflowY: "hidden", borderBottomWidth: "4px" }
  };
  const stageWrap: StubEl = {
    parentElement: stage,
    getBoundingClientRect: () => ({ top: 92, bottom: 636 }),
    style: { overflowY: "hidden", borderBottomWidth: "0px" }
  };
  return {
    parentElement: stageWrap,
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ top: 218, bottom: 626 }),
    style: { overflowY: "visible", borderBottomWidth: "0px" }
  };
}

describe("便便英雄 · 裁切线取 padding box（W5R2-FC-05）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(626, "4px")).toBe(622);
    expect(clipBottomPx(626, "0px")).toBe(626);
  });

  it("量不出边框宽度就当没有，绝不算成 NaN", () => {
    expect(clipBottomPx(626, "")).toBe(626);
    expect(clipBottomPx(626, "medium")).toBe(626);
  });

  it("真机那条链上，可视段是 404 而不是 408", () => {
    expect(stageRoomPx(realChain() as unknown as HTMLElement)).toBe(404);
  });
});
