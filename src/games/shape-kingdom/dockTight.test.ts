/**
 * 图形王国 · 常驻控件摞不许盖住图形（1.2 窗口5 · 第 3 轮 · 档B，W5R3-B-01）。
 *
 * 复现场景（真机 320×568 第 117 关，「面积是 6 平方厘米的长方形」）：
 * 作图台可视段 332px，`.shk-dock` 一块占 174px（三颗键在 256px 里排不下折成两行 = 96px），
 * 图形只剩 158px 窗口，点阵本身 201px——滚到顶 7/35 颗点够得着，滚到底 28/35，
 * 没有任何一个滚动位置看得全整张点阵。画长方形要点对角两颗点，中途必须滚一次屏。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyTightDock, needsTightDock, TIGHT_DOCK_CLASS, TIGHT_DOCK_CSS } from "./dockTight";
import { DRAW_CSS } from "./draw";

const dir = fileURLToPath(new URL(".", import.meta.url));
const drawSource = readFileSync(`${dir}draw.ts`, "utf8");

describe("图形王国 · needsTightDock", () => {
  it("真机 320×568 那一档要收：332 的可视段被 174 的常驻摞占去，201 的点阵塞不进剩下的 158", () => {
    expect(needsTightDock(332, 201, 174)).toBe(true);
  });

  it("收薄之后就不该再收——同一档量到的 dock 掉到 112，剩 220 的窗口装得下 201", () => {
    expect(needsTightDock(332, 201, 112)).toBe(false);
  });

  it("高屏装得下就不收：留白是给孩子看的，能留就留", () => {
    expect(needsTightDock(700, 280, 200)).toBe(false);
  });

  it("刚好齐平算装得下，不收（差一像素才算盖住）", () => {
    expect(needsTightDock(400, 200, 200)).toBe(false);
    expect(needsTightDock(400, 201, 200)).toBe(true);
  });

  it("量不出数一律不收，绝不凭空改样式", () => {
    expect(needsTightDock(0, 201, 174)).toBe(false);
    expect(needsTightDock(332, 0, 174)).toBe(false);
    expect(needsTightDock(332, 201, 0)).toBe(false);
    expect(needsTightDock(Number.NaN, 201, 174)).toBe(false);
    expect(needsTightDock(332, Number.POSITIVE_INFINITY, 174)).toBe(false);
  });
});

// --- DOM 桩：只实现本函数用到的那几样 ---

class FakeList {
  private readonly set = new Set<string>();
  add(c: string): void {
    this.set.add(c);
  }
  remove(c: string): void {
    this.set.delete(c);
  }
  contains(c: string): boolean {
    return this.set.has(c);
  }
}

class FakeEl {
  classList = new FakeList();
  clientHeight = 0;
  private readonly kids = new Map<string, FakeEl>();
  /** 挂了收薄记号之后 dock 自己会变矮，桩里用这一对高度模拟 */
  constructor(
    public h = 0,
    private readonly tightH = h,
    private readonly owner: FakeEl | null = null,
  ) {}
  put(sel: string, el: FakeEl): FakeEl {
    this.kids.set(sel, el);
    return el;
  }
  querySelector(sel: string): FakeEl | null {
    return this.kids.get(sel) ?? null;
  }
  getBoundingClientRect(): { height: number } {
    const host = this.owner;
    const tight = host ? host.classList.contains(TIGHT_DOCK_CLASS) : false;
    return { height: tight ? this.tightH : this.h };
  }
}

const as = (el: FakeEl | null): HTMLElement => el as unknown as HTMLElement;

function stage(viewportH: number, boardH: number, dockH: number, dockTightH = dockH): FakeEl {
  const wrap = new FakeEl();
  wrap.clientHeight = viewportH;
  wrap.put(".shk-board", new FakeEl(boardH, boardH, wrap));
  wrap.put(".shk-dock", new FakeEl(dockH, dockTightH, wrap));
  return wrap;
}

describe("图形王国 · applyTightDock", () => {
  it("真机那一档挂上记号", () => {
    const wrap = stage(332, 201, 174, 112);
    expect(applyTightDock(as(wrap))).toBe(true);
    expect(wrap.classList.contains(TIGHT_DOCK_CLASS)).toBe(true);
  });

  it("装得下的题一个像素都不动", () => {
    const wrap = stage(700, 280, 200);
    expect(applyTightDock(as(wrap))).toBe(false);
    expect(wrap.classList.contains(TIGHT_DOCK_CLASS)).toBe(false);
  });

  it("先摘记号再量：不然收完的 dock 会被当成原始高度，一收就退不回去", () => {
    // 换到一道矮题（点阵 120px）：带着上一题的记号量到的是收薄后的 112，
    // 摘掉记号量到的才是真的 174。两种量法在这一档给的结论必须都是「不收」，
    // 但只有摘了记号才谈得上「退回去」——所以先跑一次收薄档，再换题。
    const wrap = stage(332, 201, 174, 112);
    expect(applyTightDock(as(wrap))).toBe(true);
    const relaxed = stage(332, 120, 174, 112);
    relaxed.classList.add(TIGHT_DOCK_CLASS);
    expect(applyTightDock(as(relaxed))).toBe(false);
    expect(relaxed.classList.contains(TIGHT_DOCK_CLASS), "记号没摘掉，收薄档卡死了").toBe(false);
  });

  it("反复量结论稳定，不会在两档之间抖", () => {
    const wrap = stage(332, 201, 174, 112);
    const seen = [applyTightDock(as(wrap)), applyTightDock(as(wrap)), applyTightDock(as(wrap))];
    expect(seen).toEqual([true, true, true]);
  });

  it("传 null / 缺子节点都不抛", () => {
    expect(applyTightDock(null)).toBe(false);
    const bare = new FakeEl();
    bare.clientHeight = 332;
    expect(applyTightDock(as(bare))).toBe(false);
  });
});

describe("图形王国 · 收薄档的样式与接线", () => {
  it("收的全是留白和字号，热区一个都不动——44px 在收薄档里原样重申", () => {
    expect(TIGHT_DOCK_CSS).toContain("min-height:44px");
    expect(TIGHT_DOCK_CSS, "收薄档里出现了小于 44px 的按钮高度").not.toMatch(
      /\.shk-btn\{[^}]*min-height:(?:[0-3]?\d|4[0-3])px/,
    );
  });

  it("三颗键改成一行排：折行才是 96px 的由来", () => {
    expect(TIGHT_DOCK_CSS).toMatch(/\.shk-tools\{[^}]*flex-wrap:nowrap/);
  });

  it("样式真的进了本款的样式表", () => {
    expect(DRAW_CSS).toContain(TIGHT_DOCK_CSS.trim().split("\n")[0]);
    expect(DRAW_CSS).toContain(`.${TIGHT_DOCK_CLASS} .shk-btn`);
  });

  it("换题重排之后要重量一次——题一换点阵高度就变了", () => {
    const at = drawSource.indexOf("fit.relayout();\n    tighten();");
    expect(at, "换题那条路上没接收薄重量").toBeGreaterThan(-1);
  });

  it("收薄排在钳位之后：可视段没钳完就量，量到的窗口是错的", () => {
    const fit = drawSource.indexOf("const fit = fitIntoStage(wrap);");
    const tight = drawSource.indexOf("const tighten =");
    expect(fit).toBeGreaterThan(-1);
    expect(tight).toBeGreaterThan(fit);
  });

  it("resize 那条监听在 destroy 里拆掉了", () => {
    expect(drawSource).toContain('winRef?.addEventListener("resize", tighten)');
    expect(drawSource).toContain('winRef?.removeEventListener("resize", tighten)');
  });
});
