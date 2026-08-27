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
import {
  applyTightDock,
  needsTightDock,
  scrollToShowPx,
  showBoard,
  TIGHT_DOCK_CLASS,
  TIGHT_DOCK_CSS,
} from "./dockTight";
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

describe("图形王国 · scrollToShowPx", () => {
  it("滚最小的那一段：图形下沿进来就收手，题面尽量留在眼里", () => {
    // 图形在内容里 120..321，可视段 332、dock 94 → 可用窗口 238
    expect(scrollToShowPx(120, 321, 332, 97, 94)).toBe(83);
  });

  it("不减掉 dock 就当图形早就看得见了，一格都不滚——这条钉的是缺陷本身", () => {
    // 201 高的点阵塞进 332 的可视段确实「装得下」，可下面 94px 被常驻控件盖着，
    // 真正能用的窗口只有 238。不减这一刀算出来的就是「不用滚」，也就是缺陷现场。
    expect(scrollToShowPx(120, 321, 332, 97, 0)).toBe(0);
    expect(scrollToShowPx(120, 321, 332, 97, 94)).toBe(83);
  });

  it("图形自己比窗口还高就从上沿开始露，先看得见头", () => {
    expect(scrollToShowPx(120, 600, 332, 400, 94)).toBe(120);
  });

  it("不许滚过头，也不许滚成负的", () => {
    expect(scrollToShowPx(120, 321, 332, 40, 94)).toBe(40);
    expect(scrollToShowPx(0, 60, 332, 97, 94)).toBe(0);
  });

  it("没得滚 / 量不出数 / dock 比整个可视段还高，一律不动", () => {
    expect(scrollToShowPx(120, 321, 332, 0, 94)).toBe(0);
    expect(scrollToShowPx(120, 321, 0, 97, 94)).toBe(0);
    expect(scrollToShowPx(Number.NaN, 321, 332, 97, 94)).toBe(0);
    expect(scrollToShowPx(120, 321, 332, 97, 400)).toBe(0);
  });
});

describe("图形王国 · showBoard", () => {
  /** showBoard 要量位置，桩得比上面那个多给 top / clientHeight / scrollHeight */
  class PosEl {
    constructor(readonly top: number, readonly h: number) {}
    getBoundingClientRect(): { top: number; height: number } {
      return { top: this.top, height: this.h };
    }
  }
  class PosWrap {
    scrollTop = 0;
    clientHeight = 332;
    scrollHeight = 429;
    classList = new FakeList();
    private readonly kids = new Map<string, PosEl>();
    put(sel: string, el: PosEl): void {
      this.kids.set(sel, el);
    }
    querySelector(sel: string): PosEl | null {
      return this.kids.get(sel) ?? null;
    }
    getBoundingClientRect(): { top: number } {
      return { top: 218 };
    }
  }
  const asW = (w: PosWrap): HTMLElement => w as unknown as HTMLElement;

  it("真机第 117 关那一档：落地滚一次，整张点阵进眼里", () => {
    const wrap = new PosWrap();
    // 屏上 y=338..539 = 内容里 120..321（宿主顶 218、scrollTop 0）
    wrap.put(".shk-board", new PosEl(338, 201));
    wrap.put(".shk-dock", new PosEl(448, 94));
    const moved = showBoard(asW(wrap));
    expect(moved).toBeGreaterThan(0);
    expect(wrap.scrollTop).toBe(moved);
    // 滚完之后图形下沿落在「可视段减去 dock」以内
    expect(321 - wrap.scrollTop).toBeLessThanOrEqual(wrap.clientHeight - 94);
  });

  it("图形本来就整张在眼里就一格都不滚", () => {
    const wrap = new PosWrap();
    wrap.put(".shk-board", new PosEl(238, 100));
    wrap.put(".shk-dock", new PosEl(448, 94));
    expect(showBoard(asW(wrap))).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });

  it("没挂滚动条（高屏）就返回 0", () => {
    const wrap = new PosWrap();
    wrap.scrollHeight = wrap.clientHeight;
    wrap.put(".shk-board", new PosEl(338, 201));
    wrap.put(".shk-dock", new PosEl(448, 94));
    expect(showBoard(asW(wrap))).toBe(0);
  });

  it("没有图形（答题小题）/ 传 null 都不抛", () => {
    expect(showBoard(asW(new PosWrap()))).toBe(0);
    expect(showBoard(null)).toBe(0);
    expect(showBoard({} as HTMLElement)).toBe(0);
  });

  it("接线：收薄之后才滚——没收薄就滚，滚到的还是那个看不全的位置", () => {
    const tight = drawSource.indexOf("applyTightDock(wrap);");
    const show = drawSource.indexOf("showBoard(wrap);");
    expect(tight).toBeGreaterThan(-1);
    expect(show).toBeGreaterThan(tight);
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
