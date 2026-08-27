/**
 * 拼音小火车 · 裁切线量到了边框外面（窗口5 第2轮 档C 监督修复员 · W5R2-FC-05）。
 *
 * `fitQuizHost()` 已经给答题区挂上滚动条了，360×640 / 320×640 上
 * `.game-stage` 仍 `scrollHeight − clientHeight = 14`：写进去的 `max-height`
 * 比真正剩下的地方大 4px，最后一排选项 `zhǐ` 80px 高只露 72px。
 * 差的正是 `.game-stage` 那圈 `border:4px solid #fff`——滚动口是 padding box。
 */
import { describe, expect, it } from "vitest";

import { clipBottomPx, stageRoomPx } from "./fit";

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

describe("拼音小火车 · 裁切线取 padding box（W5R2-FC-05）", () => {
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
