/**
 * 音乐星星 · 裁切线量到了边框外面（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FB-01）。
 *
 * 和 `shape-kingdom/clipLine.test.ts` 是同一条：`.game-stage` 写着
 * `border:4px solid #fff`（`src/styles.css`，禁改），滚动口是 **padding box**，
 * 下边框那 4px 照不进内容；而 `fitIntoStage()` 量的是 `getBoundingClientRect().bottom`，
 * 也就是 border box 的下沿。
 *
 * 真机 CDP 实测（第 3 关）：
 *
 * ```
 * 视口       舞台 border box 下沿  内容照得进的下沿  钳出来的 .mst-wrap  可滚
 * 360×720   706                 702            706（max-height 436）  0px
 * 360×640   626                 622            626（max-height 356）  42px
 * 320×640   626                 622            626（max-height 356）  42px
 * ```
 *
 * 360×720 那一档最难看：钳是钳了，可多算的 4px 正好等于超出的量，
 * `canScroll` 于是是 0——底下那 4px 被舞台硬裁，还一点都滚不回来。
 */
import { describe, expect, it } from "vitest";
import { clipBottomPx, fitIntoStage } from "./ui";

interface StubStyle {
  overflowY: string;
  borderBottomWidth: string;
}

class FakeView {
  getComputedStyle(el: FakeEl): StubStyle {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom };
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

class FakeEl {
  readonly style: Record<string, string> = { maxHeight: "", overflowY: "" };
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  borderBottom = "0px";
  top = 0;
  content = 0;
  constructor(readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  get scrollHeight(): number {
    return this.content;
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    const capped = Number.parseFloat(this.style.maxHeight);
    const h = Number.isFinite(capped) ? Math.min(this.content, capped) : this.content;
    return { top: this.top, bottom: this.top + h, height: h };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

/** 真机那条链：`.game-stage`（overflow:hidden，88…706）→ `.mst-wrap`（270 起） */
function realChain(borderBottom: string, content: number) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.borderBottom = borderBottom;
  stage.top = 88;
  stage.content = 706 - 88;

  const self = new FakeEl(view);
  self.parentElement = stage;
  self.top = 270;
  self.content = content;
  return { self, stage };
}

describe("音乐星星 · 裁切线取 padding box（W5R2-FB-01）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(706, "4px")).toBe(702);
    expect(clipBottomPx(706, "0px")).toBe(706);
  });

  it("量不出边框宽度就当没有，绝不算成 NaN", () => {
    for (const bad of ["", "medium", "-4px", "auto"]) {
      expect(clipBottomPx(706, bad), `borderBottomWidth="${bad}"`).toBe(706);
    }
  });

  it("360×720 那一屏：钳完的下沿落在内容照得进的那条线上，不再压在白边上", () => {
    const { self } = realChain("4px", 500);
    const fit = fitIntoStage(self.asEl());
    // 旧算法写 436px（=706-270），下沿 706 正好压在 border box 上
    expect(self.style.maxHeight).toBe("432px");
    expect(self.getBoundingClientRect().bottom).toBe(702);
    fit.dispose();
  });

  it("多算的 4px 正好等于超出量时，旧算法钳完 canScroll 还是 0——现在滚得动了", () => {
    // 内容 436：按 border box 算刚好装得下，按 padding box 算超出 4px
    const { self } = realChain("4px", 436);
    const fit = fitIntoStage(self.asEl());
    expect(self.style.overflowY).toBe("auto");
    expect(self.scrollHeight - Number.parseFloat(self.style.maxHeight)).toBe(4);
    fit.dispose();
  });

  it("舞台没有下边框时一像素都不多减", () => {
    const { self } = realChain("0px", 500);
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("436px");
    fit.dispose();
  });
});
