/**
 * 图形王国 · 高屏上也一样：钳位一生效，作图板就得让出竖向手势
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`8c70a3d` 的复测补修）。
 *
 * `8c70a3d` 把 `.shk-board{touch-action:pan-y}` 写进了 `@media (max-height:720px)`，
 * 理由是「只在真的滚得起来的那一档里让」。可「真的滚得起来」和「屏幕矮」不是一回事：
 * 真正让壳滚起来的是 `fitIntoStage()` 的运行期钳位，它只看**舞台看得见多少**，
 * 不看屏高。七巧板那一小题轮廓要 ≥280px，加上常驻 dock，390×844 这种主流高屏
 * 照样钳得住——于是壳能滚，板子却还挂着 `touch-action:none`。
 *
 * 本轮 CDP 逐格复量（七巧板 L102，起手点钉死在板子正中）：
 *
 * ```
 * 视口       .shk-draw 可滚   板子 touch-action   真手指从板子中央上划 140px   够不着的格
 * 390×844   90px            none               scrollTop 0 → 0             4 / 12
 * 360×640   104px           pan-y              scrollTop 0 → 104           0 / 12
 * 320×640   101px           pan-y              scrollTop 0 → 101           0 / 12
 * ```
 *
 * 390×844 上够不着的那 4 格是轮廓**最后一行**，被常驻的 `.shk-dock` 压着
 * （`elementFromPoint` 拿回 `.shk-piece`）——**任何**滚动位置都够不着，
 * 连拨 `scrollTop` 到底都够不着，因为手指压根滚不动。矮屏反而是好的那一档。
 *
 * 修法不再拿屏高猜：`fitIntoStage` 真的钳住时给宿主挂一个 `shk-fit-scroll`，
 * CSS 认这个类。钳位退回去（换了道矮题、转屏变宽）时类也跟着摘掉，
 * 高屏上装得下的那些题一个字都没变，按住拖仍是原来的手感。热区一个都不动。
 */
import { describe, expect, it } from "vitest";
import { DRAW_CSS, FIT_SCROLL_CLASS, SHORT_SCREEN_PX, fitIntoStage } from "./draw";

// ---------------------------------------------------------------------------
// 只够 fitIntoStage 用的假 DOM，比 stageFit.test.ts 那份多一样：classList
// ---------------------------------------------------------------------------

class FakeView {
  readonly listeners = new Map<string, Array<() => void>>();

  getComputedStyle(el: FakeEl): { overflowY: string } {
    return { overflowY: el.overflowY };
  }

  addEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
}

class FakeEl {
  readonly style: Record<string, string> = { maxHeight: "", overflowY: "" };
  readonly names = new Set<string>();
  readonly classList = {
    add: (n: string): void => void this.names.add(n),
    remove: (n: string): void => void this.names.delete(n),
    contains: (n: string): boolean => this.names.has(n),
  };
  parentElement: FakeEl | null = null;
  overflowY = "visible";
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

/** 舞台 88…stageBottom 定高裁切，作图台从 selfTop 起、内容 selfContent 高 */
function makeChain(stageBottom: number, selfTop: number, selfContent: number) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.top = 88;
  stage.content = stageBottom - 88;

  const self = new FakeEl(view);
  self.parentElement = stage;
  self.top = selfTop;
  self.content = selfContent;
  return { view, stage, self };
}

const css = DRAW_CSS;
const shortAt = css.indexOf(`@media (max-height:${SHORT_SCREEN_PX}px)`);
/** 矮屏那一档以外的通用规则 */
const baseBlock = css.slice(0, shortAt);

function rule(block: string, name: string): string {
  const at = block.indexOf(`${name}{`);
  expect(at, `这一段里没有 ${name}`).toBeGreaterThan(-1);
  return block.slice(at, block.indexOf("}", at));
}

describe("图形王国 · 钳位一生效就给宿主打记号", () => {
  it("390×844 高屏也钳得住（七巧板那一小题）——钳住就挂上记号", () => {
    // 真机实测那组数：舞台 88…770 看得见 682，作图台从 150 起、内容 710 高，可滚 90px
    const { self } = makeChain(770, 150, 710);
    const fit = fitIntoStage(self.asEl());

    expect(self.style.overflowY, "高屏上照样钳出了滚动容器").toBe("auto");
    expect(self.scrollHeight - Number.parseFloat(self.style.maxHeight)).toBe(90);
    expect(
      self.classList.contains(FIT_SCROLL_CLASS),
      "滚得起来却没挂记号，板子还会吃掉手势——正是 390×844 上那 4 格够不着的原因",
    ).toBe(true);

    fit.dispose();
  });

  it("装得下就不挂：高屏上摆得开的那些题，按住拖是原来的手感", () => {
    const { self } = makeChain(818, 218, 517);
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("");
    expect(self.classList.contains(FIT_SCROLL_CLASS)).toBe(false);
    fit.dispose();
  });

  it("钳位退回去时记号跟着摘掉——换一道矮题、转屏变宽都算", () => {
    const { self } = makeChain(626, 218, 517);
    const fit = fitIntoStage(self.asEl());
    expect(self.classList.contains(FIT_SCROLL_CLASS)).toBe(true);

    self.content = 300;
    fit.relayout();
    expect(self.style.maxHeight).toBe("");
    expect(self.classList.contains(FIT_SCROLL_CLASS), "钳位都退了还占着手势").toBe(false);

    // 再变回去还得挂上，不能只摘不挂
    self.content = 517;
    fit.relayout();
    expect(self.classList.contains(FIT_SCROLL_CLASS)).toBe(true);
    fit.dispose();
  });

  it("整块落在裁切线以下（room ≤ 0）时不挂记号，也不写 max-height", () => {
    const { self } = makeChain(300, 400, 517);
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("");
    expect(self.classList.contains(FIT_SCROLL_CLASS)).toBe(false);
    fit.dispose();
  });

  it("没有 classList 的节点（用例桩、还没进文档）不抛", () => {
    const bare = { style: {} as Record<string, string> } as unknown as HTMLElement;
    expect(() => fitIntoStage(bare).dispose()).not.toThrow();
  });
});

describe("图形王国 · CSS 认这个记号，不再拿屏高猜", () => {
  it("通用规则里就有「钳住了就让出竖向」，不锁在矮屏那一档里", () => {
    const scoped = rule(baseBlock, `.${FIT_SCROLL_CLASS} .shk-board`);
    expect(scoped).toContain("touch-action:pan-y");
  });

  it("没钳住时板子照旧吃掉全部手势", () => {
    expect(rule(baseBlock, ".shk-board")).toContain("touch-action:none");
  });

  it("让的还是只有手势：这条规则不许顺手改尺寸", () => {
    const scoped = rule(baseBlock, `.${FIT_SCROLL_CLASS} .shk-board`);
    for (const forbidden of ["min-height", "width", "transform", "font-size"]) {
      expect(scoped, `${forbidden} 不该出现在这条规则里`).not.toContain(forbidden);
    }
  });

  it("挂记号的类名 CSS 和 JS 用的是同一个常量，不各写各的", () => {
    expect(FIT_SCROLL_CLASS).toBe("shk-fit-scroll");
    expect(css).toContain(`.${FIT_SCROLL_CLASS} `);
  });
});
