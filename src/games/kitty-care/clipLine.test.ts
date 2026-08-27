/**
 * 萌猫小屋 · 裁切线量到了边框外面（窗口5 第2轮 档C 监督修复员 · W5R2-FC-05）。
 *
 * 现象：`fitIntoStage()` 已经按可视段钳过一遍了，390×844 这种一点都不挤的屏上
 * `.game-stage` 照样 `scrollHeight 744 > clientHeight 730`，第 141 关搓澡那句
 * 「用手指画圈搓，把 90% 的泡泡都搓开～」被切掉 5px（360×720 / 360×640 / 320×640
 * 上整句 0 像素可见）。
 *
 * 原因：`.game-stage` 写着 `border:4px solid #fff`（`src/styles.css`，禁改）。
 * 滚动口是 **padding box**，下边框那 4px 照不进内容；而钳位量的是
 * `getBoundingClientRect().bottom`，那是 **border box** 的下沿——每一层裁切祖先
 * 都白多算了自己的下边框。CDP 实测：舞台内容区下沿 826，钳位却按 830 写了
 * `max-height:608px`，正好多 4px。
 *
 * 这一条对 `fitIntoStage()`（收猫）和 `scrollIntoStage()`（相册挂滚动条）同时成立。
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

/** 照真机搭一条链：舞台（border 4px、overflow:hidden）→ 中间 auto 高的两层 → 被钳的那块 */
function realChain(): StubEl {
  const view = {
    getComputedStyle: (p: StubEl) => p.style
  };
  const stage: StubEl = {
    parentElement: null,
    getBoundingClientRect: () => ({ top: 92, bottom: 830 }),
    style: { overflowY: "hidden", borderBottomWidth: "4px" }
  };
  // `.l99-stage-wrap`：overflow:hidden 但高度是内容撑的，下沿反而在舞台外面
  const stageWrap: StubEl = {
    parentElement: stage,
    getBoundingClientRect: () => ({ top: 96, bottom: 840 }),
    style: { overflowY: "hidden", borderBottomWidth: "0px" }
  };
  return {
    parentElement: stageWrap,
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ top: 222, bottom: 830 }),
    style: { overflowY: "visible", borderBottomWidth: "0px" }
  };
}

describe("萌猫小屋 · 裁切线取 padding box（W5R2-FC-05）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(830, "4px")).toBe(826);
    expect(clipBottomPx(830, "0px")).toBe(830);
  });

  it("量不出边框宽度（测试桩 / 老浏览器）就当没有，绝不把可视段算成 NaN", () => {
    expect(clipBottomPx(830, "")).toBe(830);
    expect(clipBottomPx(830, "medium")).toBe(830);
    expect(clipBottomPx(830, "-4px")).toBe(830);
  });

  it("真机那条链上，可视段是 604 而不是 608", () => {
    expect(stageRoomPx(realChain() as unknown as HTMLElement)).toBe(604);
  });

  it("一层裁切祖先都没有就返回 Infinity（高屏上不许平白改布局）", () => {
    const bare = {
      parentElement: null,
      ownerDocument: { defaultView: { getComputedStyle: () => ({ overflowY: "visible", borderBottomWidth: "0px" }) } },
      getBoundingClientRect: () => ({ top: 0, bottom: 100 })
    };
    expect(stageRoomPx(bare as unknown as HTMLElement)).toBe(Number.POSITIVE_INFINITY);
  });
});
