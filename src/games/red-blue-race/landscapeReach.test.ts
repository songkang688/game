/**
 * 守门：把手机**横过来**拿，这一屏也得跑得动（窗口5 第 3 轮档A，`W5R3-TA-01`，严重）。
 *
 * 第 3 轮测试员 A13 实测（Chrome headless + CDP，命中一律 `document.elementFromPoint(键心)`）：
 *   640×360  `.rbr-step` 落地 **0/2**、`.rbr-jump-btn` **0/1**，逐档滚动累计仍是 0，
 *            可滚祖先 **无**；三颗键连同「本关新玩法」那行字一起被裁死；
 *   844×390  三颗只露 21px，中心点全在裁切线外，同样一个可滚祖先都没有。
 * 两档横屏 × 8 关 = 24 颗，真手指慢拖一趟纹丝不动 —— 纯触屏在横屏上一步都跑不了。
 *
 * 病灶：两档收紧（`rbr-tight` / `rbr-tighter`）全用尽之后就收手了——横屏上这一屏
 * 收到底仍有 277px，可视段只有 190 / 220px。
 *
 * 这一款原本立过一条硬规矩「**不许挂滚动条**：连点游戏能滚就会想按却滑走了」。
 * 那条线**就是这条缺陷本身**，本轮据实改判成「**两档收紧全用尽之后才挂**」：
 * 「偶尔滑走」和「一颗都按不着」不是同一个量级的事。顺序不许换，另有一条用例守着。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以纯函数逐条验、
 * 收紧器拿桩节点跑真流程、CSS 与接线用源码巡检钉住。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCROLL_CLASS, SCROLL_MIN_ROOM, clipBottomPx, fitRaceStage, needsScroll, scrollToShowPx, showPads } from "./fit";

const FIT = readFileSync(fileURLToPath(new URL("./fit.ts", import.meta.url)), "utf8");
const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const CSS = INDEX.slice(INDEX.indexOf("const CSS = `"), INDEX.indexOf("const ENDLESS_CSS"));

describe("红蓝跑道 · 裁切线按 padding box 算（W5R3-TA-05）", () => {
  it("量得出 clientHeight 就用它：滚动口是 padding box，下边框那 4px 照不进内容", () => {
    expect(clipBottomPx({ top: 100, bottom: 550 }, 4, 442, "4px")).toBe(546);
  });

  it("量不出来（桩节点 / SSR）就退回减掉下边框宽度，再不行照原样返回", () => {
    expect(clipBottomPx({ top: 100, bottom: 550 }, Number.NaN, Number.NaN, "4px")).toBe(546);
    expect(clipBottomPx({ top: 100, bottom: 550 }, 0, 0, "")).toBe(550);
  });
});

describe("红蓝跑道 · 两档用尽还装不下就得兜底（needsScroll）", () => {
  it("640×360 那一幕：这一屏收到底仍有 277，可视段只有 190 —— 得兜底", () => {
    expect(needsScroll(277, 190)).toBe(true);
  });

  it("844×390 那一幕：277 / 220 —— 也得兜底", () => {
    expect(needsScroll(277, 220)).toBe(true);
  });

  it("竖屏三档本来就装得下：一个像素都不许改", () => {
    expect(needsScroll(303, 313)).toBe(false);
    expect(needsScroll(378, 388)).toBe(false);
    expect(needsScroll(555, 565)).toBe(false);
    expect(needsScroll(277, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("矮到连一颗跑动键的中心点都塞不进去就真的不值得钳", () => {
    expect(SCROLL_MIN_ROOM).toBeGreaterThanOrEqual(44);
    expect(needsScroll(277, SCROLL_MIN_ROOM - 1)).toBe(false);
    expect(needsScroll(277, SCROLL_MIN_ROOM)).toBe(true);
  });

  it("差一两个像素不算装不下；量不出数就什么都不做", () => {
    expect(needsScroll(191, 190)).toBe(false);
    expect(needsScroll(192, 190)).toBe(true);
    expect(needsScroll(Number.NaN, 190)).toBe(false);
    expect(needsScroll(277, Number.NaN)).toBe(false);
  });
});

describe("红蓝跑道 · 滚最小的那一段（scrollToShowPx）", () => {
  it("要露的那一排在下面：只滚到刚好露出它的下沿", () => {
    // 640×360 实测：跑动键那一排在内容里占 [199, 251]，可视段 190，最多能滚 87
    expect(scrollToShowPx(199, 251, 190, 87)).toBe(61);
  });

  it("本来就露着就一动不动；不许滚过头", () => {
    expect(scrollToShowPx(10, 90, 190, 87)).toBe(0);
    expect(scrollToShowPx(400, 500, 190, 87)).toBe(87);
  });

  it("这一排比滚动口还高（双人场两整排键）就从它的上沿开始露", () => {
    expect(scrollToShowPx(120, 400, 190, 900)).toBe(120);
  });

  it("量不出数 / 没得滚就返回 0", () => {
    expect(scrollToShowPx(199, 251, 0, 87)).toBe(0);
    expect(scrollToShowPx(199, 251, 190, 0)).toBe(0);
  });
});

/** 只够 showPads / fitRaceStage 用的假 DOM */
class View {
  getComputedStyle(el: El): { overflowY: string; borderBottomWidth: string } {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom };
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

class El {
  readonly style: Record<string, string> = { maxHeight: "", overflowY: "", overscrollBehavior: "" };
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
  top = 0;
  content = 0;
  scrollTop = 0;
  offset = 0;
  clientTop = 0;
  /** 每一档收紧之后这一屏有多高（0 = 原样，1 = 挤一挤，2 = 再挤挤） */
  tiers: [number, number, number] = [0, 0, 0];
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
    return this.rows.get(sel) ?? null;
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
 * 640×360 实测的一幕：这一屏从 y=158 起、收到底仍有 277px，可视段 190px；
 * 跑动键那一排在内容里占 [199, 251]，「本关新玩法」那行 [255, 270]。
 */
function build(room: number, content = 277) {
  const view = new View();
  const stage = new El(view);
  stage.overflowY = "hidden";
  stage.top = 100;
  stage.content = 158 - 100 + room;
  const wrap = new El(view);
  wrap.top = 158;
  wrap.content = content;
  wrap.parentElement = stage;
  wrap.rows.set(".rbr-pads", row(view, wrap, 199, 52));
  wrap.rows.set(".rbr-msg", row(view, wrap, 255, 15));
  return { wrap, pads: wrap.rows.get(".rbr-pads")!, msg: wrap.rows.get(".rbr-msg")! };
}

describe("红蓝跑道 · 挂上滚动条之后把跑动键送进眼里（showPads）", () => {
  it("640×360：三颗键的下沿真的进了可视段（原来整排在裁切线以下）", () => {
    const { wrap, pads } = build(190);
    wrap.style.maxHeight = "190px";
    expect(showPads(wrap.asEl())).toBeGreaterThan(0);
    expect(pads.getBoundingClientRect().bottom).toBeLessThanOrEqual(158 + 190);
  });

  it("「本关新玩法」那行跟键一起装得下就连它一块儿送进来——孩子得知道这一关变了什么", () => {
    const { wrap, msg } = build(190);
    wrap.style.maxHeight = "190px";
    showPads(wrap.asEl());
    expect(msg.getBoundingClientRect().bottom).toBeLessThanOrEqual(158 + 190);
  });

  it("两者装不下时只保键——键被顶出去这一关就跑不动了", () => {
    const { wrap, pads, msg } = build(56);
    wrap.style.maxHeight = "56px";
    showPads(wrap.asEl());
    expect(pads.getBoundingClientRect().bottom).toBeLessThanOrEqual(158 + 56);
    expect(msg.getBoundingClientRect().bottom).toBeGreaterThan(158 + 56);
  });

  it("找不到那一排就安安静静返回 0", () => {
    const { wrap } = build(190);
    wrap.rows.clear();
    expect(showPads(wrap.asEl())).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });
});

describe("红蓝跑道 · 收紧器跑到第三档是什么样", () => {
  it("640×360：两档收完仍装不下，这一屏自己挂上滚动条并滚了一次", () => {
    const { wrap } = build(190);
    const fit = fitRaceStage(wrap.asEl());
    expect(wrap.worn.has(SCROLL_CLASS)).toBe(true);
    expect(wrap.style.maxHeight).toBe("190px");
    expect(wrap.style.overflowY).toBe("auto");
    expect(wrap.style.overscrollBehavior).toBe("contain");
    expect(wrap.scrollTop).toBeGreaterThan(0);
    fit.dispose();
  });

  it("390×844 那种高屏：一个像素不改", () => {
    const { wrap } = build(565, 555);
    const fit = fitRaceStage(wrap.asEl());
    expect(wrap.worn.has(SCROLL_CLASS)).toBe(false);
    expect(wrap.style.maxHeight).toBe("");
    expect(wrap.scrollTop).toBe(0);
    fit.dispose();
  });

  it("转回竖屏：钳位与滚动条一起还回去", () => {
    const { wrap } = build(190);
    const fit = fitRaceStage(wrap.asEl());
    expect(wrap.style.overflowY).toBe("auto");
    wrap.content = 250;
    (wrap.parentElement as El).content = 158 - 100 + 565;
    fit.relayout();
    expect(wrap.worn.has(SCROLL_CLASS)).toBe(false);
    expect(wrap.style.maxHeight).toBe("");
    fit.dispose();
  });

  it("dispose 之后一切还原", () => {
    const { wrap } = build(190);
    fitRaceStage(wrap.asEl()).dispose();
    expect(wrap.worn.size).toBe(0);
    expect(wrap.style.overflowY).toBe("");
  });
});

describe("红蓝跑道 · 接线与样式", () => {
  it("兜底那一档排在两档收紧之后——能让的高度先让干净", () => {
    expect(FIT.indexOf("pickTier(room, (tier) => {")).toBeLessThan(FIT.indexOf("needsScroll(wrap.scrollHeight, room)"));
  });

  it("钳完顺手叫一次 showPads，而且排在写 overflow 之后", () => {
    const at = FIT.indexOf('wrap.style.overflowY = "auto"');
    expect(at).toBeGreaterThan(-1);
    expect(FIT.indexOf("showPads(wrap)")).toBeGreaterThan(at);
  });

  it("下一帧还得再量一次；拆完台那一帧不许再动 DOM", () => {
    expect(FIT).toContain("requestAnimationFrame");
    expect(FIT).toContain("live = false");
  });

  it("样式里有兜底那一档的记号，而且它不碰任何热区", () => {
    const at = CSS.indexOf(".rbr-scroll {");
    expect(at).toBeGreaterThan(-1);
    const block = CSS.slice(at, CSS.indexOf("}", at));
    expect(block).toContain("overscroll-behavior: contain");
    for (const sel of ["min-height", "font-size"]) {
      expect(block.includes(sel), `兜底那一档动了 ${sel}`).toBe(false);
    }
  });

  it("连点手感靠的是跑动键自己的 touch-action，收紧与兜底都没碰它", () => {
    expect(CSS).toMatch(/\.rbr-step \{[^}]*touch-action: manipulation/);
    expect(CSS).toMatch(/\.rbr-jump-btn \{[^}]*touch-action: manipulation/);
  });

  it("裁切线读的是 padding box，不是 getBoundingClientRect().bottom", () => {
    expect(FIT).toContain("clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, cs.borderBottomWidth)");
  });
});
