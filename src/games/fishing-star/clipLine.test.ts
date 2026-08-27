/**
 * 钓场 · 裁切线量到了边框外面（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FB-01）。
 *
 * `.game-stage` 写着 `border:4px solid #fff`（`src/styles.css`，禁改），
 * 滚动口是 **padding box**，下边框那 4px 照不进内容；而 `clipperBottoms()`
 * 收的是 `getBoundingClientRect().bottom`，那是 border box 的下沿。
 *
 * 这一款拿这条线做两件事，两件都会被那 4px 带偏：
 * ① `seaHeightPx()` 倒推水面高度——水面多摊 4px，最下面那行（抛竿键那一排）就往下挪 4px；
 * ② `overflowBelowPx()` / `createClipWatch()` 判「抛竿键掉出去没有」——门槛松了 4px，
 *    正好卡在边界上的那一档会被判成「没掉出去」，于是不收，键就真的被切掉一条。
 *
 * 真机 CDP 实测（第 3 关，360×640 / 320×640）：舞台 border box 下沿 626、
 * 内容照得进的下沿 622，舞台 `scrollHeight - clientHeight` 仍是 9px。
 */
import { describe, expect, it } from "vitest";
import { clipBottomPx, clipperBottoms, stageRoomPx, visibleRoomPx } from "./fit";

interface StubStyle {
  overflowY: string;
  borderBottomWidth: string;
}

class FakeEl {
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  borderBottom = "0px";
  top = 0;
  height = 0;
  /** 定高盒子：内容比自己高，`isRealClipper` 才认它是一条真裁切线 */
  scrollHeight = 0;
  clientHeight = 0;
  constructor(readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    return { top: this.top, bottom: this.top + this.height, height: this.height };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

class FakeView {
  getComputedStyle(el: FakeEl): StubStyle {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom };
  }
}

/** 真机那条链：`.game-stage`（border 4px、overflow:hidden，88…626）→ 本款的壳（222 起） */
function realChain(borderBottom: string) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.borderBottom = borderBottom;
  stage.top = 88;
  stage.height = 626 - 88;
  stage.clientHeight = 626 - 88;
  stage.scrollHeight = 700;

  const self = new FakeEl(view);
  self.parentElement = stage;
  self.top = 222;
  self.height = 400;
  return { self, stage, view };
}

describe("钓场 · 裁切线取 padding box（W5R2-FB-01）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(626, "4px")).toBe(622);
    expect(clipBottomPx(626, "0px")).toBe(626);
  });

  it("量不出边框宽度就当没有，绝不算成 NaN", () => {
    for (const bad of ["", "medium", "-4px", "auto"]) {
      expect(clipBottomPx(626, bad), `borderBottomWidth="${bad}"`).toBe(626);
    }
  });

  it("clipperBottoms 交出来的就是内容照得进的那条线", () => {
    const { self, view } = realChain("4px");
    expect(clipperBottoms(self.asEl(), view as never)).toEqual([622]);
  });

  it("可视段跟着少 4px：水面倒推与「掉出去没有」两处判定都不再多算白边", () => {
    const { self } = realChain("4px");
    expect(stageRoomPx(self.asEl())).toBe(400);
    // 同一条链，舞台不带边框时才是原来那个数
    const none = realChain("0px");
    expect(stageRoomPx(none.self.asEl())).toBe(404);
    expect(visibleRoomPx(222, [622])).toBe(400);
  });
});
