/**
 * 形状王国 · 矮屏上「摆哪一块」和「交卷」得同时够得着（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 测试员 W5-B-10（一般）：七巧板那一小题在 ≤640 高的屏上，**没有任何一个滚动位置
 * 能同时够着所有控件**——滚到顶才看得见骨牌架（要摆哪一块），滚到底才够得着
 * 「✅ 我摆好了」（交卷）。一道题要来回滚两趟，中班孩子基本放弃。
 *
 * 这一题装不下是真的装不下:轮廓要 ≥280px（再小格子热区就掉到 44px 以下，那是
 * 换一种点不着），加上骨牌架 + 按钮排怎么摆都超。所以不缩东西，改摆法：
 * 把图形以下的那一摞（骨牌架 / 读数 / 提示 / 按钮 / 反馈）合成一个 `.shk-dock`，
 * 矮屏那一档让它 `position:sticky;bottom:0` 整块贴住作图台底边常驻，
 * 要滚的只剩上面的图形。第 1 轮那套 `fitIntoStage` 运行期钳位照旧,两者叠着用。
 */
import { describe, expect, it, afterEach } from "vitest";
import { StubEl, findAll, findOne, installDom } from "./domStub";
import { DRAW_CSS, SHORT_SCREEN_PX, runDrawRound } from "./draw";
import type { PlayCtx } from "../level99";

let restoreDom: (() => void) | null = null;
afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function stubCtx(): PlayCtx {
  return {
    level: 0,
    chapterIndex: 0,
    indexInChapter: 0,
    sfx: () => {},
    bonusStars: () => {},
    win: () => {},
    lose: () => {},
  } as PlayCtx;
}

/** 挂一局七巧板（拼骨牌），把作图台的 DOM 交出来 */
function mountTiling(): StubEl {
  const dom = installDom();
  restoreDom = dom.restore;
  const stage = new StubEl("div");
  runDrawRound({
    stage: stage as unknown as HTMLElement,
    ctx: stubCtx(),
    theme: { bg: "#f3f0ff", accent: "#5f3dc4" },
    tasks: [
      {
        kind: "tiling",
        cols: 3,
        rows: 2,
        target: ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2"],
        pieces: [
          ["0,0", "0,1", "0,2"],
          ["0,0", "0,1", "0,2"],
        ],
        ask: "拼满轮廓",
        hints: ["一二三四五六七八", "二二三四五六七八", "三二三四五六七八"],
      },
    ],
    viewportWidth: 360,
  });
  return stage;
}

/** 从 DRAW_CSS 里抠一条规则（`sel{...}`），可以限定在某段 media 里找 */
function rule(sel: string, within = DRAW_CSS): string {
  const at = within.indexOf(`${sel}{`);
  if (at < 0) return "";
  return within.slice(at, within.indexOf("}", at) + 1);
}

/** 矮屏那一档 media 块的正文（门槛就是 `SHORT_SCREEN_PX`，测试员量的 ≤640 在这一档里） */
function shortScreenBlock(): string {
  const at = DRAW_CSS.indexOf(`@media (max-height:${SHORT_SCREEN_PX}px)`);
  expect(at, "矮屏那一档 media 不见了，这一份得跟着改").toBeGreaterThan(0);
  const next = DRAW_CSS.indexOf("@media", at + 10);
  return DRAW_CSS.slice(at, next < 0 ? DRAW_CSS.length : next);
}

describe("形状王国 · 控件合成一摞常驻在底边（W5-B-10）", () => {
  it("骨牌架 / 读数 / 提示 / 按钮排 / 反馈，五样全在 dock 里", () => {
    const stage = mountTiling();
    const dock = findOne(stage, "shk-dock");
    expect(dock, "作图台上没有 .shk-dock").not.toBeNull();
    for (const cls of ["shk-rack", "shk-readout", "shk-hint", "shk-tools", "shk-msg"]) {
      expect(findOne(dock!, cls), `${cls} 没进 dock，矮屏上还是会被滚走`).not.toBeNull();
    }
  });

  it("图形本身留在 dock 外面——要滚的就是它", () => {
    const stage = mountTiling();
    const dock = findOne(stage, "shk-dock")!;
    expect(findOne(stage, "shk-boardwrap"), "作图台上没有图形区").not.toBeNull();
    expect(findOne(dock, "shk-boardwrap"), "图形被塞进 dock 了，那就一起钉住不滚了").toBeNull();
  });

  it("dock 排在图形后面，读起来的顺序一个都没换", () => {
    const stage = mountTiling();
    const wrap = findOne(stage, "shk-draw")!;
    const order = wrap.children.map((c) => c.className.split(" ")[0]);
    expect(order.indexOf("shk-dock")).toBeGreaterThan(order.indexOf("shk-boardwrap"));
    const dock = findOne(stage, "shk-dock")!;
    expect(dock.children.map((c) => c.className.split(" ")[0])).toEqual([
      "shk-rack",
      "shk-readout",
      "shk-hint",
      "shk-tools",
      "shk-msg",
    ]);
  });

  it("dock 有底色，图形从它下面滚过去不会透出来", () => {
    const stage = mountTiling();
    expect(findOne(stage, "shk-dock")!.style.background, "dock 没上本关主题的底色").toBe("#f3f0ff");
  });

  it("按钮与骨牌全都还够得着（点得动、不 disabled）", () => {
    const stage = mountTiling();
    const dock = findOne(stage, "shk-dock")!;
    const labels = findAll(dock, "shk-btn").map((b) => b.textContent);
    expect(labels).toContain("✅ 我摆好了");
    expect(labels.some((t) => t.startsWith("💡 提示")), "提示键没进 dock").toBe(true);
    expect(labels).toContain("🧹 重来");
    expect(findAll(dock, "shk-btn").every((b) => !b.disabled), "有按钮是禁用的").toBe(true);
    expect(findAll(dock, "shk-piece").length, "骨牌架是空的").toBeGreaterThan(0);
  });
});

describe("形状王国 · 矮屏那一档的样式（W5-B-10）", () => {
  it(`≤${SHORT_SCREEN_PX} 高才钉住，高屏上还是普通一摞`, () => {
    expect(rule(".shk-dock")).not.toContain("position:sticky");
    const short = rule(".shk-dock", shortScreenBlock());
    expect(short, "矮屏那一档里没给 dock 钉住").toContain("position:sticky");
    expect(short).toContain("bottom:0");
  });

  it("钉住的那一层要压在图形上面，不然图形会盖过按钮", () => {
    const short = rule(".shk-dock", shortScreenBlock());
    const z = /z-index:(\d+)/.exec(short);
    expect(z, "dock 没写 z-index").not.toBeNull();
    expect(Number(z![1])).toBeGreaterThanOrEqual(1);
  });

  it("要滚的那一层还在（第 1 轮的运行期钳位没被这次改动顶掉）", () => {
    expect(rule(".shk-draw", shortScreenBlock())).toContain("overflow-y:auto");
  });

  it("热区一个都没被这一档收小：按钮与骨牌仍是 44px 起", () => {
    expect(rule(".shk-btn")).toContain("min-height:44px");
    for (const sel of [".shk-btn", ".shk-piece", ".shk-dot"]) {
      expect(rule(sel, shortScreenBlock()), `矮屏那一档把 ${sel} 收小了`).not.toMatch(
        /min-height:(\d|[123]\d)px/
      );
    }
  });
});
