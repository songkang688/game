/**
 * 图形王国 · 裁切线量到了边框外面（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FB-01）。
 *
 * 档C 在自己那五款里抓到 `W5R2-FC-05`：`.game-stage` 写着 `border:4px solid #fff`
 * （`src/styles.css`，禁改），而**滚动口是 padding box**——下边框那 4px 照不进内容。
 * 钳位量的却是 `getBoundingClientRect().bottom`，那是 **border box** 的下沿，
 * 每一层裁切祖先都白多算了自己的下边框。本档的 `fitIntoStage()` 是同一套写法，
 * 同一个坑，所以在这儿独立复量了一遍。
 *
 * 真机 CDP 实测（作图关 L102，`.game-stage` 下边框 4px）：
 *
 * ```
 * 视口       舞台 border box 下沿  内容照得进的下沿  钳出来的 .shk-draw 下沿  越线
 * 360×720   706                 702            706                    4px
 * 360×640   626                 622            626                    4px
 * 320×640   626                 622            626                    4px
 * ```
 *
 * 钳完还越线 4px，`.shk-dock` 最底下那行反馈就被切掉一条。改法照抄档C：
 * 裁切线一律减掉那一层自己的下边框，量不出宽度（测试桩 / 老浏览器）就当没有，
 * 绝不把可视段算成 NaN。
 */
import { describe, expect, it } from "vitest";
import { FIT_SCROLL_CLASS, clipBottomPx, fitIntoStage } from "./draw";

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
  readonly names = new Set<string>();
  readonly classList = {
    add: (n: string): void => void this.names.add(n),
    remove: (n: string): void => void this.names.delete(n),
  };
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

/** 真机那条链：`.game-stage`（border 4px、overflow:hidden，88…626）→ `.shk-draw`（218 起、517 高） */
function realChain(borderBottom: string) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.borderBottom = borderBottom;
  stage.top = 88;
  stage.content = 626 - 88;

  const self = new FakeEl(view);
  self.parentElement = stage;
  self.top = 218;
  self.content = 517;
  return { self, stage };
}

describe("图形王国 · 裁切线取 padding box（W5R2-FB-01）", () => {
  it("下边框那几像素不算可用地方", () => {
    expect(clipBottomPx(626, "4px")).toBe(622);
    expect(clipBottomPx(626, "0px")).toBe(626);
  });

  it("量不出边框宽度（测试桩 / 老浏览器）就当没有，绝不算成 NaN", () => {
    for (const bad of ["", "medium", "-4px", "auto"]) {
      expect(clipBottomPx(626, bad), `borderBottomWidth="${bad}"`).toBe(626);
    }
  });

  it("360×640 那一屏：钳位少算掉舞台那圈 4px 白边，钳完不再越线", () => {
    const { self } = realChain("4px");
    const fit = fitIntoStage(self.asEl());
    // 旧算法写的是 408px（=626-218），下沿正好压在 border box 上，越线 4px
    expect(self.style.maxHeight).toBe("404px");
    expect(self.getBoundingClientRect().bottom, "钳完的下沿要落在内容照得进的那条线上").toBe(622);
    expect(self.names.has(FIT_SCROLL_CLASS)).toBe(true);
    fit.dispose();
  });

  it("舞台没有下边框时一像素都不多减，行为和原来一模一样", () => {
    const { self } = realChain("0px");
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("408px");
    fit.dispose();
  });

  it("只差那 4px 就装得下的题，减完才会真的钳出滚动条", () => {
    // 内容 406：按 border box 算 408 装得下（不钳，于是底下 2px 被舞台硬裁）
    const { self } = realChain("4px");
    self.content = 406;
    const fit = fitIntoStage(self.asEl());
    expect(self.style.overflowY, "少算 4px 就会漏掉这一档，内容被硬裁还没得滚").toBe("auto");
    expect(self.style.maxHeight).toBe("404px");
    fit.dispose();
  });
});
