/**
 * 找不同 · 裁切线量到了边框外面（窗口5 第2轮 档C 监督修复员 · W5R2-FC-05）。
 *
 * 这一款自己没露出问题（四档视口 `.game-stage` 裁 0），但 `viewportRoomPx()`
 * 吃的正是同一支 `stageRoomPx()`，同样把 `.game-stage` 的 4px 下边框算成了可用地方。
 * 现在两张图那一块恰好留了 4px 余量才没露馅——余量一变就会跟着塌。
 * 一起改掉，免得下一轮又从头查一遍。
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
  return {
    parentElement: stage,
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ top: 222, bottom: 626 }),
    style: { overflowY: "visible", borderBottomWidth: "0px" }
  };
}

describe("找不同 · 裁切线取 padding box（W5R2-FC-05）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(626, "4px")).toBe(622);
    expect(clipBottomPx(626, "0px")).toBe(626);
  });

  it("量不出边框宽度就当没有，绝不算成 NaN", () => {
    expect(clipBottomPx(626, "")).toBe(626);
    expect(clipBottomPx(626, "medium")).toBe(626);
  });

  it("真机那条链上，可视段是 400 而不是 404", () => {
    expect(stageRoomPx(realChain() as unknown as HTMLElement)).toBe(400);
  });
});
