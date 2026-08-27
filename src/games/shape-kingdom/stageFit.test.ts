/**
 * 形状王国 · 矮屏自滚必须真的滚得动（1.2 窗口5 第 1 轮 · 档B 监督修复）。
 *
 * 学习优化员在矮屏那一档里写了 `max-height:100%;overflow-y:auto`，报告记为「已落地」。
 * 复审时用真浏览器量下来这条是**空转的**：百分比高度要有一个定高父级才算得出来，
 * 而壳层这条链上 `.l99-stage` / `.l99-stage-wrap` 全是内容撑出来的 auto 高——
 * 它们自己先长到内容那么高，`100%` 于是等于内容自己的高度。实测 360×640：
 * `.shk-draw` 高 517、舞台看得见 408，`scrollHeight === clientHeight`，
 * 滚动条一次都没出现，「✅ 我摆好了」照样 `elementFromPoint` 返回 null。
 *
 * 真正定高的那一层是 `.game-stage`（平台文件，交给窗口1），本款够不着它的 CSS，
 * 但够得着它的**盒子**：量一次下沿，把像素数写成自己的 `max-height`。
 * 这一份钉的就是这套运行期钳位——先红后绿的「红」是上面那句 `canScroll === 0`。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DRAW_CSS, fitIntoStage, visibleRoomPx } from "./draw";

const dir = fileURLToPath(new URL(".", import.meta.url));
const reviewSource = readFileSync(`${dir}review.ts`, "utf8");

// ---------------------------------------------------------------------------
// 只够 fitIntoStage 用的假 DOM：它一共只碰 style / parentElement /
// getBoundingClientRect / scrollHeight / getComputedStyle().overflowY 这几样
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

  get resizeListenerCount(): number {
    return this.listeners.get("resize")?.length ?? 0;
  }
}

class FakeEl {
  readonly style: Record<string, string> = { maxHeight: "", overflowY: "" };
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  top = 0;
  bottom = 0;
  /** 内容有多高（不受 max-height 影响，浏览器里也是这个语义） */
  content = 0;

  constructor(
    readonly name: string,
    readonly view: FakeView,
  ) {}

  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }

  /** 钳过之后可视高度就是 max-height，没钳就是内容自己的高 */
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

/**
 * 复刻真机上那条祖先链：`.game-stage`(overflow:hidden，定高) →
 * `.l99-stage-wrap`(auto 高) → `.l99-stage`(auto 高) → `.shk-draw`。
 */
function makeChain(opts: { stageTop: number; stageBottom: number; selfTop: number; selfContent: number }) {
  const view = new FakeView();
  const stage = new FakeEl(".game-stage", view);
  stage.overflowY = "hidden";
  stage.top = opts.stageTop;
  stage.content = opts.stageBottom - opts.stageTop;

  const wrap = new FakeEl(".l99-stage-wrap", view);
  wrap.parentElement = stage;
  wrap.top = opts.stageTop + 8;
  // 关键：壳层这两层是内容撑出来的，比舞台看得见的那一段还高
  wrap.content = opts.selfTop + opts.selfContent - wrap.top;

  const l99 = new FakeEl(".l99-stage", view);
  l99.parentElement = wrap;
  l99.top = wrap.top;
  l99.content = wrap.content;

  const self = new FakeEl(".shk-draw", view);
  self.parentElement = l99;
  self.top = opts.selfTop;
  self.content = opts.selfContent;

  return { view, stage, wrap, l99, self };
}

describe("形状王国 · visibleRoomPx", () => {
  it("多层都在裁就听最靠上的那一层——只要有一层裁，再往下就看不见了", () => {
    expect(visibleRoomPx(218, [626, 700])).toBe(408);
    expect(visibleRoomPx(218, [700, 626])).toBe(408);
  });

  it("一层都不裁就返回 Infinity，表示这一屏压根不用钳", () => {
    expect(visibleRoomPx(218, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it("自己已经整个在裁切线以下时算出来是负数，调用方据此放弃钳位", () => {
    expect(visibleRoomPx(700, [626])).toBe(-74);
  });
});

describe("形状王国 · fitIntoStage 把作图台钳进舞台看得见的那一段", () => {
  it("360×640 那一屏：钳完真的能滚，不再是 scrollHeight === clientHeight", () => {
    // 真机实测的那组数：舞台 88…626 看得见 538，作图台从 218 起、内容 517 高
    const { view, self } = makeChain({ stageTop: 88, stageBottom: 626, selfTop: 218, selfContent: 517 });
    const fit = fitIntoStage(self.asEl());

    expect(self.style.maxHeight, "没钳住，滚动条不会出现").toBe("408px");
    expect(self.style.overflowY).toBe("auto");
    // 「能滚」的定义：内容比可视高
    expect(self.scrollHeight).toBeGreaterThan(Number.parseFloat(self.style.maxHeight));
    expect(self.scrollHeight - Number.parseFloat(self.style.maxHeight)).toBe(109);
    // 钳完盒子的下沿正好落在舞台裁切线上，交卷键不会再被切在外面
    expect(self.getBoundingClientRect().bottom).toBe(626);

    fit.dispose();
    expect(view.resizeListenerCount).toBe(0);
  });

  it("装得下就一个字都不写，高屏上不会凭空多出一个滚动容器（那会把棋盘投影裁掉）", () => {
    const { self } = makeChain({ stageTop: 88, stageBottom: 818, selfTop: 218, selfContent: 517 });
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("");
    expect(self.style.overflowY).toBe("");
    fit.dispose();
  });

  it("换一道题反复重算不会越钳越小——每次先把上一轮的值还回去再量", () => {
    const { self } = makeChain({ stageTop: 88, stageBottom: 626, selfTop: 218, selfContent: 517 });
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("408px");
    for (let i = 0; i < 5; i++) fit.relayout();
    expect(self.style.maxHeight, "越量越小说明还原那一步漏了").toBe("408px");

    // 换成一道矮题：钳位要能自己退回去
    self.content = 300;
    fit.relayout();
    expect(self.style.maxHeight).toBe("");
    expect(self.style.overflowY).toBe("");
    fit.dispose();
  });

  it("转屏之后跟着重算：resize 监听挂上了，dispose 之后拆干净", () => {
    const { view, self, stage } = makeChain({ stageTop: 88, stageBottom: 818, selfTop: 218, selfContent: 517 });
    const fit = fitIntoStage(self.asEl());
    expect(view.resizeListenerCount).toBe(1);
    expect(self.style.maxHeight).toBe("");

    // 横屏转竖屏，舞台矮了
    stage.content = 626 - 88;
    for (const fn of view.listeners.get("resize") ?? []) fn();
    expect(self.style.maxHeight).toBe("408px");

    fit.dispose();
    expect(view.resizeListenerCount).toBe(0);
  });

  it("整块已经落在裁切线以下（room ≤ 0）时不乱写 max-height:0 把内容压没", () => {
    const { self } = makeChain({ stageTop: 88, stageBottom: 300, selfTop: 400, selfContent: 517 });
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("");
    fit.dispose();
  });

  it("没有布局能力的节点（用例桩、还没进文档）直接不动手，也不抛", () => {
    const bare = { style: {} as Record<string, string> } as unknown as HTMLElement;
    expect(() => fitIntoStage(bare).dispose()).not.toThrow();
  });
});

describe("形状王国 · CSS 那半边留着，但注明它今天钳不住", () => {
  it("矮屏分支里的 max-height:100% 还在（等平台给舞台链定高就自动接上）", () => {
    expect(DRAW_CSS).toContain("max-height:100%");
    expect(DRAW_CSS).toContain("overflow-y:auto");
  });

  it("注释里点名 fitIntoStage，免得下一个人以为 CSS 那行已经够了", () => {
    expect(DRAW_CSS).toContain("fitIntoStage");
  });
});

describe("形状王国 · 答题屏也得有本款自己的滚动宿主", () => {
  it("答题器挂在 .shk-quizhost 里，而不是直接挂舞台", () => {
    // 公共文件 quiz99 生的 .qz-wrap 本档不许动，但它挂在哪儿是本款说了算
    expect(reviewSource).toContain('quizHost.className = "shk-quizhost"');
    expect(reviewSource).toContain("stage: quizHost");
    expect(reviewSource).not.toMatch(/runner\(\{\s*stage,/);
  });

  it("宿主由 fitIntoStage 钳住，换题时重算，destroy 时拆监听并摘掉宿主", () => {
    expect(reviewSource).toContain("fitIntoStage(quizHost)");
    expect(reviewSource).toContain("fit.relayout()");
    expect(reviewSource).toContain("fit.dispose()");
    expect(reviewSource).toContain("quizHost.remove()");
  });
});
