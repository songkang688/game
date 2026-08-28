/**
 * 守门：描红台钳完之后，「这一笔该怎么描」和田字格都得在眼里
 * （窗口5 第 3 轮档A，`W5R3-TA-03`，一般）。
 *
 * 第 3 轮测试员 A14 复测 `W5R3-A-03`：那一笔补接 `fitQuizHost` 是真修（田字格从
 * 241/259 好到 245/259），但只走了一半——本轮我自己五档复量：
 *   320×568  `.wgd-msg`（「顺着虚线慢慢描第 1 笔『撇』，从圆点起笔。」）26px **露 0px**；
 *   360×640  同上，26px 露 0px；
 *   640×360  `.wgd-msg` 露 0px，**连田字格自己都只露 101/300**；
 *   844×390  `.wgd-msg` 露 0px，田字格 131/300。
 * 滚动条早就有了（`.wgd-trace` 能滚 102 / 61 / 293 / 263px），
 * 缺的是**钳完之后把该看的送进眼里**那一步——本款答题屏与组字工坊早就做了，描红台漏着。
 *
 * 为什么不干脆滚到底：滚到底就把顶上「正在描第 N 笔」那行顶出去了，两句都要。
 * 所以分两件事办：
 *  1. 那句提示在**真钳住**的时候粘到可视区下沿（`wgd-scroll` 那条规则）；
 *  2. 「送进眼里」的名单认了描红台的 `.wgd-padwrap`，而且算的是**减掉粘住那一行之后的净空间**。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCROLL_CLASS, clipBottomPx, fitQuizHost, stickyTailPx } from "./fit";
import { WGD_CSS } from "./tracing";

const FIT = readFileSync(fileURLToPath(new URL("./fit.ts", import.meta.url)), "utf8");
const TRACING = readFileSync(fileURLToPath(new URL("./tracing.ts", import.meta.url)), "utf8");

describe("识字小花园 · 裁切线按 padding box 算（W5R3-TA-05）", () => {
  it("量得出 clientHeight 就用它：五档实测钳出来的天花板恒定比真裁切线低 4px", () => {
    // 320×568：border box 下沿让 room 算成 334，padding box 只有 330
    expect(clipBottomPx({ top: 220, bottom: 554 }, 4, 326, "4px")).toBe(550);
    // 640×360：194 → 190
    expect(clipBottomPx({ top: 158, bottom: 352 }, 4, 186, "4px")).toBe(348);
  });

  it("量不出来（桩节点 / SSR）就退回减掉下边框宽度，再不行照原样返回", () => {
    expect(clipBottomPx({ top: 220, bottom: 554 }, Number.NaN, Number.NaN, "4px")).toBe(550);
    expect(clipBottomPx({ top: 220, bottom: 554 }, 0, 0, "")).toBe(554);
  });

  it("钳位那一路真的按 padding box 量，不是 getBoundingClientRect().bottom", () => {
    expect(FIT).toContain("clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, cs.borderBottomWidth)");
  });
});

describe("识字小花园 · 描红台那句提示粘在可视区下沿（W5R3-TA-03）", () => {
  it("样式里真的有这一条，而且只在**钳住了**才生效", () => {
    expect(WGD_CSS).toContain(".wgd-trace.wgd-scroll .wgd-msg{");
    const at = WGD_CSS.indexOf(".wgd-trace.wgd-scroll .wgd-msg{");
    const block = WGD_CSS.slice(at, WGD_CSS.indexOf("}", at));
    expect(block).toContain("position:sticky");
    expect(block).toContain("bottom:0");
    // 粘住之后底下是田字格，得给它一层不透明底，不然两层字叠在一起
    expect(block).toMatch(/background:#[0-9a-f]{6,8}/);
  });

  it("没钳住的高屏上一个字节都不改——不然粘性会拿整个视口当参照物", () => {
    // 装得下那一档 `.wgd-msg` 只有基准那一条规则，没有 position
    const base = WGD_CSS.slice(WGD_CSS.indexOf(".wgd-msg{"), WGD_CSS.indexOf("}", WGD_CSS.indexOf(".wgd-msg{")));
    expect(base).not.toContain("position");
  });

  it("记号由收紧器在真钳住那一步挂上、在还原那一步摘掉", () => {
    expect(SCROLL_CLASS).toBe("wgd-scroll");
    const on = FIT.indexOf(`host.classList?.toggle?.(SCROLL_CLASS, true)`);
    const off = FIT.indexOf(`host.classList?.toggle?.(SCROLL_CLASS, false)`);
    expect(on).toBeGreaterThan(-1);
    expect(off).toBeGreaterThan(-1);
    expect(off).toBeLessThan(on);
  });

  it("描红台的注释里写明了这一条治的是什么，别人接手时别又把它拆了", () => {
    expect(TRACING).toContain("W5R3-TA-03");
  });
});

describe("识字小花园 ·「送进眼里」认得描红台的田字格", () => {
  it("名单里三屏都在：答题屏、组字工坊、描红台", () => {
    const at = FIT.indexOf("const FOCUS_ROWS");
    expect(at).toBeGreaterThan(-1);
    const line = FIT.slice(at, at + 140);
    expect(line).toContain(".qz-choices");
    expect(line).toContain(".bc-choices");
    expect(line).toContain(".wgd-padwrap");
  });

  it("算的是「减掉粘住那一行之后的净空间」，不然田字格正好停在提示底下", () => {
    expect(FIT).toContain("host.clientHeight - stickyTailPx(host)");
  });
});

/** 只够 fitQuizHost / stickyTailPx 用的假 DOM */
class View {
  getComputedStyle(el: El): { overflowY: string; borderBottomWidth: string; position: string } {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom, position: el.position };
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

class El {
  readonly style: Record<string, string> = { maxHeight: "", minHeight: "", overflowY: "", overscrollBehavior: "" };
  readonly worn = new Set<string>();
  readonly classList = {
    toggle: (name: string, on: boolean): void => {
      if (on) this.worn.add(name);
      else this.worn.delete(name);
    },
  };
  parentElement: El | null = null;
  overflowY = "visible";
  borderBottom = "0px";
  position = "static";
  top = 0;
  content = 0;
  scrollTop = 0;
  offset = 0;
  clientTop = 0;
  rows = new Map<string, El>();
  constructor(readonly view: View) {}
  get ownerDocument(): { defaultView: View } {
    return { defaultView: this.view };
  }
  get scrollHeight(): number {
    return this.content;
  }
  get clientHeight(): number {
    const capped = Number.parseFloat(this.style.maxHeight);
    return Number.isFinite(capped) ? Math.min(this.content, capped) : this.content;
  }
  querySelector(sel: string): El | null {
    for (const one of sel.split(",")) {
      const hit = this.rows.get(one.trim());
      if (hit) return hit;
    }
    return null;
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    return { top: this.top, bottom: this.top + this.clientHeight, height: this.clientHeight };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

function row(view: View, host: El, offset: number, height: number): El {
  const el = new El(view);
  el.content = height;
  el.offset = offset;
  Object.defineProperty(el, "top", { get: () => host.top + el.offset - host.scrollTop });
  return el;
}

/**
 * 360×640 实测的一幕：描红台从 y=220 起、内容 467px，`.game-stage` 的 padding box
 * 下沿在 y=622，可视段 402px（border box 那把尺子会多算成 406）。
 * 田字格那一块在内容里占 [56, 356]，那句提示 [441, 467]。
 */
function build(room: number, content = 467) {
  const view = new View();
  const stage = new El(view);
  stage.overflowY = "hidden";
  stage.top = 120;
  stage.content = 220 - 120 + room;
  const host = new El(view);
  host.top = 220;
  host.content = content;
  host.parentElement = stage;
  const pad = row(view, host, 56, 300);
  const msg = row(view, host, content - 26, 26);
  msg.position = "sticky";
  host.rows.set(".wgd-padwrap", pad);
  host.rows.set(".wgd-msg", msg);
  return { host, pad, msg };
}

describe("识字小花园 · stickyTailPx", () => {
  it("粘住了就把它的高度让出来", () => {
    const { host } = build(402);
    expect(stickyTailPx(host.asEl())).toBe(26);
  });

  it("没粘住（高屏、答题屏）就返回 0，行为跟改前一模一样", () => {
    const { host, msg } = build(402);
    msg.position = "static";
    expect(stickyTailPx(host.asEl())).toBe(0);
  });

  it("根本没有那一行也返回 0", () => {
    const { host } = build(402);
    host.rows.delete(".wgd-msg");
    expect(stickyTailPx(host.asEl())).toBe(0);
  });
});

describe("识字小花园 · 描红台钳完之后真的送进眼里了", () => {
  it("360×640：钳住、挂上记号、田字格被送进净空间里（原来只滚了个寂寞）", () => {
    const { host, pad } = build(402);
    const fit = fitQuizHost(host.asEl());
    expect(host.style.overflowY).toBe("auto");
    expect(host.style.maxHeight).toBe("402px");
    expect(host.worn.has(SCROLL_CLASS)).toBe(true);
    // 田字格 300px 比净空间（402−26＝376）矮，整块都该进来
    expect(pad.getBoundingClientRect().top).toBeGreaterThanOrEqual(220);
    expect(pad.getBoundingClientRect().bottom).toBeLessThanOrEqual(220 + 402 - 26);
    fit.dispose();
  });

  it("640×360 横屏：净空间比田字格还矮，就从格子的上沿开始露，先看得见头", () => {
    const { host, pad } = build(190);
    const fit = fitQuizHost(host.asEl());
    expect(host.worn.has(SCROLL_CLASS)).toBe(true);
    expect(pad.getBoundingClientRect().top).toBe(220);
    fit.dispose();
  });

  it("390×844 装得下那一档：不钳、不滚、不挂记号，一个像素不改", () => {
    const { host } = build(520, 467);
    const fit = fitQuizHost(host.asEl());
    expect(host.style.overflowY).toBe("");
    expect(host.style.maxHeight).toBe("");
    expect(host.worn.has(SCROLL_CLASS)).toBe(false);
    expect(host.scrollTop).toBe(0);
    fit.dispose();
  });

  it("换一个字重量：这一屏变矮到装得下，钳位、滚动与记号一起还回去", () => {
    const { host } = build(402);
    const fit = fitQuizHost(host.asEl());
    expect(host.worn.has(SCROLL_CLASS)).toBe(true);
    host.content = 300;
    fit.relayout();
    expect(host.style.maxHeight).toBe("");
    expect(host.worn.has(SCROLL_CLASS)).toBe(false);
    expect(host.scrollTop).toBe(0);
    fit.dispose();
  });
});
