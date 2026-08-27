/**
 * 音乐星星 · 矮屏自滚与沙盒键盘的收口守门（1.2 窗口5 第 1 轮 · 档B 监督修复）。
 *
 * 复审学习优化员那两条时逐条量下来，两条都没真正落地：
 *
 * ① 矮屏那一档写的 `max-height:100%;overflow-y:auto` 是**空转**的——百分比高度要有
 *    定高父级，而 `.l99-stage` / `.l99-stage-wrap` 都是内容撑出来的 auto 高。
 *    真机 360×640 第 188 关：`.mst-wrap` 高 416、舞台看得见 362，`canScroll` 为 0，
 *    声音设置栏那三颗芯片 `elementFromPoint` 一律返回 null。
 * ② 沙盒七声八键改成了 `mst-keys-scroll`，可键身自己还挂着 `touch-action:none`。
 *    键 44px、缝 4px，手指落哪儿都在键上，这一行**滚不动**——「哆」和「高哆」
 *    还是按不到，只是从「切在屏外」变成了「滚不过去」。程序化 `el.click()` 照样绿，
 *    所以上一轮没抓到。
 *
 * 另外 `.mst-chip` 一直是 38px，是本档五款里唯一一批不到 44px 触屏底线的热区。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHIP_MIN_PX, MST_CSS, SKY_MAX_PX, boardWidth, fitIntoStage, hostWidth, visibleRoomPx } from "./ui";

const dir = fileURLToPath(new URL(".", import.meta.url));
const sandboxSource = readFileSync(`${dir}sandboxUi.ts`, "utf8");
const indexSource = readFileSync(`${dir}index.ts`, "utf8");
const advancedSource = readFileSync(`${dir}advanced.ts`, "utf8");

/** 取一条 CSS 规则的声明体 */
function rule(css: string, selector: string): string {
  const at = css.indexOf(selector + "{");
  if (at < 0) return "";
  return css.slice(at + selector.length + 1, css.indexOf("}", at));
}

class FakeView {
  readonly listeners: Array<() => void> = [];
  getComputedStyle(el: FakeEl): { overflowY: string } {
    return { overflowY: el.overflowY };
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
  readonly style: Record<string, string> = { maxHeight: "", overflowY: "" };
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

function makeChain(stageTop: number, stageBottom: number, selfTop: number, selfContent: number) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.top = stageTop;
  stage.content = stageBottom - stageTop;
  // 壳层这一层是内容撑出来的 auto 高，正是 max-height:100% 算不出数的原因
  const l99 = new FakeEl(view);
  l99.parentElement = stage;
  l99.top = stageTop + 8;
  l99.content = selfTop + selfContent - l99.top;
  const self = new FakeEl(view);
  self.parentElement = l99;
  self.top = selfTop;
  self.content = selfContent;
  return { view, stage, self };
}

describe("音乐星星 · fitIntoStage 把这一屏钳进舞台看得见的那一段", () => {
  it("visibleRoomPx 听最靠上那一层裁切线；一层不裁就不用钳", () => {
    expect(visibleRoomPx(206, [568, 640])).toBe(362);
    expect(visibleRoomPx(206, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it("360×640 第 188 关那一屏：钳完真的滚得动（原来 canScroll 是 0）", () => {
    // 真机实测：舞台 88…568 看得见 480，.mst-wrap 从 206 起、内容 416 高
    const { view, self } = makeChain(88, 568, 206, 416);
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("362px");
    expect(self.style.overflowY).toBe("auto");
    expect(self.scrollHeight - 362, "滚不动就还是点不着声音设置栏").toBe(54);
    expect(self.getBoundingClientRect().bottom).toBe(568);
    fit.dispose();
    expect(view.listeners).toHaveLength(0);
  });

  it("屏够高就一行都不写，桌面上不会凭空多一个滚动容器", () => {
    const { self } = makeChain(88, 818, 206, 416);
    const fit = fitIntoStage(self.asEl());
    expect(self.style.maxHeight).toBe("");
    expect(self.style.overflowY).toBe("");
    fit.dispose();
  });

  it("每一轮换一批音就重算一次，反复重算不会越钳越小", () => {
    const { self } = makeChain(88, 568, 206, 416);
    const fit = fitIntoStage(self.asEl());
    for (let i = 0; i < 5; i++) fit.relayout();
    expect(self.style.maxHeight).toBe("362px");
    self.content = 300;
    fit.relayout();
    expect(self.style.maxHeight).toBe("");
    fit.dispose();
  });

  it("三个入口（战役 / 进阶 / 沙盒）都接上了钳位，destroy 时都拆监听", () => {
    for (const [name, src] of [["index.ts", indexSource], ["advanced.ts", advancedSource], ["sandboxUi.ts", sandboxSource]] as const) {
      expect(src, `${name} 没接钳位`).toContain("fitIntoStage(");
      expect(src, `${name} 的 destroy 漏了 fit.dispose()`).toContain("fit.dispose()");
    }
  });
});

describe("音乐星星 · 键盘宽度量真实容器，不再凭屏宽估", () => {
  it("hostWidth 量得到就用它，并按 .mst-sky 的上限夹住", () => {
    expect(hostWidth({ clientWidth: 292 } as HTMLElement)).toBe(292);
    expect(hostWidth({ clientWidth: 1280 } as HTMLElement)).toBe(SKY_MAX_PX);
    expect(hostWidth({ clientWidth: 292.7 } as HTMLElement)).toBe(292);
  });

  it("量不到（游离节点 clientWidth 恒为 0、用例桩压根没有布局）就返回 null 退回估算", () => {
    expect(hostWidth(null)).toBeNull();
    expect(hostWidth(undefined)).toBeNull();
    expect(hostWidth({ clientWidth: 0 } as HTMLElement)).toBeNull();
    expect(hostWidth({} as HTMLElement)).toBeNull();
    expect(hostWidth({ clientWidth: Number.NaN } as HTMLElement)).toBeNull();
  });

  it("估算比真实容器宽——这正是「算着放得下、实际探到舞台外」的来源", () => {
    // 360px 的机器上 boardWidth 只减得掉 .mst-wrap 自己的内边距，
    // 减不掉壳层顶栏与 .l99-stage 的内边距，真实容器实测 292px
    expect(boardWidth(360)).toBeGreaterThan(292);
  });

  it("沙盒进文档之后才重排一次键盘，游离时那次量不准的不算数", () => {
    expect(sandboxSource).toContain("relayout(): void");
    expect(indexSource).toContain("sandboxHost.appendChild(sandbox.el)");
    const appendAt = indexSource.indexOf("sandboxHost.appendChild(sandbox.el)");
    const relayoutAt = indexSource.indexOf("sandbox.relayout()");
    expect(relayoutAt, "relayout 必须排在挂进文档之后，否则量到的还是 0").toBeGreaterThan(appendAt);
  });

  it("三个入口都把真实宿主传给了 createStarBoard", () => {
    expect(sandboxSource).toContain("host: keysHost");
    expect(indexSource).toContain("host: wrap");
    expect(advancedSource).toContain("host: wrap");
  });
});

describe("音乐星星 · 沙盒键盘横着划得动，两端的键才真按得到", () => {
  it("滚起来那一档里键自己让出横向手势——不让就滚不动，等于还是按不到", () => {
    const scrolledStar = rule(MST_CSS, ".mst-keys-scroll .mst-star");
    expect(scrolledStar, "键还挂着 touch-action:none 的话这一行滚不动").toContain("touch-action:pan-x");
    expect(scrolledStar).not.toContain("touch-action:none");
    // 只在滚动那一档里让手势；不滚的时候键仍然是 touch-action:none，按下去就出声
    expect(rule(MST_CSS, "\n.mst-star")).toContain("touch-action:none");
    expect(rule(MST_CSS, ".mst-keys-scroll")).toContain("overflow-x:auto");
  });

  it("星空的 max-width 跟容器一起夹，不许 shrink-to-fit 到内容的 max-content", () => {
    // 只写 max-width:${SKY_MAX_PX}px 的话，沙盒那个空 div 会被键排撑到 max-content，
    // 整块星空探到舞台外面，横向再怎么滚也把两端的键滚不回可视区
    expect(rule(MST_CSS, ".mst-sky")).toContain(`max-width:min(${SKY_MAX_PX}px,100%)`);
    const keys = rule(MST_CSS, ".mst-sb-keys");
    expect(keys).toContain("width:100%");
    expect(keys).toContain("min-width:0");
  });
});

describe("音乐星星 · 触屏热区不许低于 44px", () => {
  it("芯片抬到 44px（原来 38px，是本档唯一一批破底线的热区）", () => {
    expect(CHIP_MIN_PX).toBe(44);
    const chip = rule(MST_CSS, ".mst-chip");
    expect(chip).toContain(`min-height:${CHIP_MIN_PX}px`);
    // 抬高之后文字得居中，不然贴着上边更难按
    expect(chip).toContain("align-items:center");
    expect(MST_CSS).not.toContain("min-height:38px");
  });

  it("矮屏那一档不许把热区又收回去", () => {
    const at = MST_CSS.indexOf("@media (max-height:");
    const block = MST_CSS.slice(at).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(block).not.toContain(".mst-chip{");
    expect(block).not.toContain(".mst-btn{");
  });
});
