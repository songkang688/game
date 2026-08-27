/**
 * 点点广场 · 裁切线量到了边框外面（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FB-01）。
 *
 * `.game-stage` 写着 `border:4px solid #fff`（`src/styles.css`，禁改），
 * 滚动口是 **padding box**，下边框那 4px 照不进内容；而 `fitArena()` 量的是
 * `getBoundingClientRect().bottom`，那是 border box 的下沿。
 *
 * 这一款尤其吃这 4px：点是按**百分比**摆在竞技场里的，竞技场压不干净，
 * 掉在裁切线以下的那一条里的点就是真的按不着——而点又是随机摆的，
 * 表现成「时灵时不灵」，比一直坏更难查。竞技场不走滚动条（连点游戏一能滚就会点飞），
 * 所以这 4px 没有任何补救余地，只能一开始就别多算。
 */
import { describe, expect, it } from "vitest";
import { clipBottomPx, fitArena } from "./index";

interface StubStyle {
  overflowY: string;
  borderBottomWidth: string;
}

class FakeView {
  readonly listeners: Array<() => void> = [];
  getComputedStyle(el: FakeEl): StubStyle {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom };
  }
  addEventListener(_type: string, fn: () => void): void {
    this.listeners.push(fn);
  }
  removeEventListener(_type: string, fn: () => void): void {
    const i = this.listeners.indexOf(fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }
}

class FakeEl {
  readonly style: Record<string, string> = { height: "" };
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  borderBottom = "0px";
  top = 0;
  /** CSS 想要的高（没写内联 height 时量到的就是它） */
  css = 0;
  constructor(readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    const forced = Number.parseFloat(this.style.height);
    const h = Number.isFinite(forced) ? forced : this.css;
    return { top: this.top, bottom: this.top + h, height: h };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

/**
 * 真机 320×640 那条链：舞台 88…626（border 4px），竞技场从 350 起、CSS 想要 280 高。
 * 起点特意选在 `ARENA_MIN_PX`（216）咬不到的位置——不然收多收少都被下限拉平，量不出这 4px。
 */
function realChain(borderBottom: string) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.borderBottom = borderBottom;
  stage.top = 88;
  stage.css = 626 - 88;

  const arena = new FakeEl(view);
  arena.parentElement = stage;
  arena.top = 350;
  arena.css = 280;
  return { arena, stage, view };
}

describe("点点广场 · 裁切线取 padding box（W5R2-FB-01）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(626, "4px")).toBe(622);
    expect(clipBottomPx(626, "0px")).toBe(626);
  });

  it("量不出边框宽度就当没有，绝不算成 NaN", () => {
    for (const bad of ["", "medium", "-4px", "auto"]) {
      expect(clipBottomPx(626, bad), `borderBottomWidth="${bad}"`).toBe(626);
    }
  });

  it("竞技场收到内容照得进的那条线上，底下那一条里的点不再按不着", () => {
    const { arena } = realChain("4px");
    const off = fitArena(arena.asEl());
    // 旧算法按 626 收（=276 高），下沿正好压在白边上，最后 4px 的点按不着
    expect(arena.style.height).toBe("272px");
    expect(arena.getBoundingClientRect().bottom, "收完的下沿要落在内容照得进的线上").toBe(622);
    off();
  });

  it("舞台没有下边框时一像素都不多收，行为和原来一模一样", () => {
    const { arena } = realChain("0px");
    const off = fitArena(arena.asEl());
    expect(arena.style.height).toBe("276px");
    off();
  });

  it("装得下就一个字都不写：高屏上竞技场保持 CSS 想要的那个高", () => {
    const { arena } = realChain("4px");
    arena.top = 200;
    const off = fitArena(arena.asEl());
    expect(arena.style.height).toBe("");
    off();
  });

  it("转屏之后跟着重收，dispose 之后拆干净", () => {
    const { arena, stage, view } = realChain("4px");
    const off = fitArena(arena.asEl());
    expect(view.listeners.length).toBe(1);
    stage.css = 818 - 88;
    for (const fn of [...view.listeners]) fn();
    expect(arena.style.height, "舞台变高之后不该还压着").toBe("");
    off();
    expect(view.listeners.length).toBe(0);
  });
});
