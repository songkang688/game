/**
 * 守门：把手机**横过来**拿，这一桌也得点得动（窗口5 第 3 轮档A，`W5R3-TA-01`，严重）。
 *
 * 第 3 轮测试员 A13 实测（Chrome headless + CDP，命中一律 `document.elementFromPoint(键心)`）：
 *   640×360  `.ldc-mainbar .ld-btn` 落地 **0/4**、逐档滚动累计 **0/4**，可滚祖先 **无**；
 *            `.ldc-subbar .ld-btn`（⏸ 暂停）**0/1**，同样一个可滚祖先都没有；
 *   844×390  同上。两档横屏 × 8 关 = 40 颗，真手指慢拖一趟纹丝不动。
 * 叫不了地主 = 这一局开不了。桌面键盘能玩，所以测试员判严重不判阻断。
 *
 * 病灶：两档收紧（`ldc-tight` / `ldc-tighter`）全用尽之后就收手了——横屏上这一桌
 * 收到底仍有 422px，可视段只有 190 / 220px，多出来的 200 多像素连同底下两排键
 * 一起停在裁切线以下，而这条祖先链上**没有任何一层是能滚的**。
 *
 * 修法照搬同窗口档C `562790f`（`poop-hero` / `red-blue-tug` 那一套）：
 * **本款壳层自己钳到可视段、自己挂滚动条，再把动手那一排送进眼里**。
 * `.game-stage{overflow:hidden}` 一个字没动（平台文件，禁改，交窗口1）。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以纯函数逐条验、
 * 收紧器拿桩节点跑真流程、CSS 与接线用源码巡检钉住。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCROLL_CLASS, SCROLL_MIN_ROOM, clipBottomPx, fitTableStage, needsScroll, scrollToShowPx, showCtrl } from "./fit";

const FIT = readFileSync(fileURLToPath(new URL("./fit.ts", import.meta.url)), "utf8");
const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const CSS = INDEX.slice(INDEX.indexOf("const CSS = `"), INDEX.indexOf("\n`;\n", INDEX.indexOf("const CSS = `")));

describe("朵朵抢地主 · 裁切线按 padding box 算（W5R3-TA-05）", () => {
  it("量得出 clientHeight 就用它：滚动口是 padding box，下边框那 4px 照不进内容", () => {
    // 真机 320×568：`.game-stage` border box 下沿 y=550，padding box 只到 y=546
    expect(clipBottomPx({ top: 100, bottom: 550 }, 4, 442, "4px")).toBe(546);
  });

  it("量不出来（桩节点 / SSR）就退回减掉下边框宽度", () => {
    expect(clipBottomPx({ top: 100, bottom: 550 }, Number.NaN, Number.NaN, "4px")).toBe(546);
    expect(clipBottomPx({ top: 100, bottom: 550 }, 0, 0, "4px")).toBe(546);
  });

  it("连边框宽度都读不到就照原样返回，绝不算成 NaN", () => {
    expect(clipBottomPx({ top: 100, bottom: 550 }, 0, 0, "")).toBe(550);
    expect(clipBottomPx({ top: 100, bottom: 550 }, 0, 0, "0px")).toBe(550);
  });
});

describe("朵朵抢地主 · 两档用尽还装不下就得兜底（needsScroll）", () => {
  it("640×360 那一幕：这一桌收到底仍有 422，可视段只有 190 —— 得兜底", () => {
    expect(needsScroll(422, 190)).toBe(true);
  });

  it("844×390 那一幕：422 / 220 —— 也得兜底", () => {
    expect(needsScroll(422, 220)).toBe(true);
  });

  it("竖屏五档本来就装得下：一个像素都不许改（320×568 / 360×640 / 390×844）", () => {
    expect(needsScroll(339, 330)).toBe(true); // 320×568 收完还差 9px，这一档也该兜
    expect(needsScroll(380, 390)).toBe(false);
    expect(needsScroll(475, 485)).toBe(false);
    expect(needsScroll(422, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("差一两个像素不算装不下，免得边界上反复横跳", () => {
    expect(needsScroll(191, 190)).toBe(false);
    expect(needsScroll(192, 190)).toBe(true);
  });

  it("矮到连一颗出牌键的中心点都塞不进去就真的不值得钳", () => {
    expect(SCROLL_MIN_ROOM).toBeGreaterThanOrEqual(44);
    expect(needsScroll(422, SCROLL_MIN_ROOM - 1)).toBe(false);
    expect(needsScroll(422, SCROLL_MIN_ROOM)).toBe(true);
  });

  it("量不出数就什么都不做", () => {
    expect(needsScroll(Number.NaN, 190)).toBe(false);
    expect(needsScroll(422, Number.NaN)).toBe(false);
    expect(needsScroll(0, 190)).toBe(false);
  });
});

describe("朵朵抢地主 · 滚最小的那一段（scrollToShowPx）", () => {
  it("要露的那一排在下面：只滚到刚好露出它的下沿", () => {
    // 640×360 实测：出牌那一排在内容里占 [321, 369]，可视段 190，最多能滚 232
    expect(scrollToShowPx(321, 369, 190, 232)).toBe(179);
  });

  it("本来就露着就一动不动", () => {
    expect(scrollToShowPx(20, 120, 190, 232)).toBe(0);
  });

  it("这一段比滚动口还高就从它的上沿开始露", () => {
    expect(scrollToShowPx(120, 600, 190, 900)).toBe(120);
  });

  it("不许滚过头，卡在能滚的上限里", () => {
    expect(scrollToShowPx(900, 1200, 190, 232)).toBe(232);
  });

  it("量不出数 / 没得滚就返回 0", () => {
    expect(scrollToShowPx(321, 369, 0, 232)).toBe(0);
    expect(scrollToShowPx(321, 369, 190, 0)).toBe(0);
    expect(scrollToShowPx(Number.NaN, 369, 190, 232)).toBe(0);
  });
});

/** 只够 showCtrl / fitTableStage 用的假 DOM */
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

/** 一排：位置写在内容坐标里，屏幕坐标＝宿主上沿 + 内容位置 − 已经滚掉的那一段 */
function row(view: View, host: El, offset: number, height: number): El {
  const el = new El(view);
  el.content = height;
  el.offset = offset;
  Object.defineProperty(el, "top", { get: () => host.top + el.offset - host.scrollTop });
  return el;
}

/**
 * 640×360 实测的一幕：这一桌从 y=158 起、收到底仍有 422px；
 * `.game-stage` 的 padding box 下沿在 y=348，可视段 190px；
 * 出牌那一排在内容里占 [321, 369]，「⏸ 暂停」那一排 [372, 416]。
 */
function build(room: number, content = 422) {
  const view = new View();
  const stage = new El(view);
  stage.overflowY = "hidden";
  stage.top = 100;
  stage.content = 158 - 100 + room;
  stage.clientTop = 0;
  const wrap = new El(view);
  wrap.top = 158;
  wrap.content = content;
  wrap.parentElement = stage;
  const main = row(view, wrap, 321, 48);
  const sub = row(view, wrap, 372, 44);
  wrap.rows.set(".ldc-mainbar", main);
  wrap.rows.set(".ldc-subbar", sub);
  return { wrap, main, sub };
}

describe("朵朵抢地主 · 挂上滚动条之后把动手那一排送进眼里（showCtrl）", () => {
  it("640×360：出牌那一排的下沿真的进了可视段（原来整排在裁切线以下）", () => {
    const { wrap, main } = build(190);
    wrap.style.maxHeight = "190px";
    const at = showCtrl(wrap.asEl());
    expect(at).toBeGreaterThan(0);
    expect(main.getBoundingClientRect().bottom).toBeLessThanOrEqual(158 + 190);
  });

  it("底下那一排跟出牌那一排一起装得下就连它一块儿送进来", () => {
    const { wrap, sub } = build(190);
    wrap.style.maxHeight = "190px";
    showCtrl(wrap.asEl());
    // 两排一共只跨 95px，190px 的口子装得下，暂停键不该被落下
    expect(sub.getBoundingClientRect().bottom).toBeLessThanOrEqual(158 + 190);
  });

  it("两排一起装不下时只保出牌那一排——出牌键被顶出去这一局就没法打了", () => {
    const { wrap, main, sub } = build(60);
    wrap.style.maxHeight = "60px";
    showCtrl(wrap.asEl());
    expect(main.getBoundingClientRect().bottom).toBeLessThanOrEqual(158 + 60);
    expect(sub.getBoundingClientRect().bottom).toBeGreaterThan(158 + 60);
  });

  it("找不到那一排就安安静静返回 0，不往 DOM 上写一个假的 scrollTop", () => {
    const { wrap } = build(190);
    wrap.rows.clear();
    expect(showCtrl(wrap.asEl())).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });
});

describe("朵朵抢地主 · 收紧器跑到第三档是什么样", () => {
  it("640×360：两档收完仍装不下，这一桌自己挂上滚动条并滚了一次", () => {
    const { wrap } = build(190);
    const fit = fitTableStage(wrap.asEl());
    expect(wrap.worn.has(SCROLL_CLASS)).toBe(true);
    expect(wrap.style.maxHeight).toBe("190px");
    expect(wrap.style.overflowY).toBe("auto");
    expect(wrap.style.overscrollBehavior).toBe("contain");
    expect(wrap.scrollTop).toBeGreaterThan(0);
    fit.dispose();
  });

  it("390×844 那种高屏：一个像素不改，不许凭空多出一个滚动容器", () => {
    const { wrap } = build(485, 475);
    const fit = fitTableStage(wrap.asEl());
    expect(wrap.worn.has(SCROLL_CLASS)).toBe(false);
    expect(wrap.style.maxHeight).toBe("");
    expect(wrap.style.overflowY).toBe("");
    expect(wrap.scrollTop).toBe(0);
    fit.dispose();
  });

  it("转回竖屏：钳位、滚动条、滚过的位置一起还回去", () => {
    const { wrap } = build(190);
    const fit = fitTableStage(wrap.asEl());
    expect(wrap.style.overflowY).toBe("auto");
    wrap.content = 300;
    (wrap.parentElement as El).content = 158 - 100 + 485;
    fit.relayout();
    expect(wrap.worn.has(SCROLL_CLASS)).toBe(false);
    expect(wrap.style.maxHeight).toBe("");
    expect(wrap.style.overflowY).toBe("");
    fit.dispose();
  });

  it("dispose 之后一切还原，拆完台那一帧也不许再动 DOM", () => {
    const { wrap } = build(190);
    fitTableStage(wrap.asEl()).dispose();
    expect(wrap.worn.size).toBe(0);
    expect(wrap.style.maxHeight).toBe("");
    expect(wrap.style.overflowY).toBe("");
  });
});

describe("朵朵抢地主 · 接线与样式", () => {
  it("兜底那一档排在两档收紧之后——能让的高度先让干净", () => {
    expect(FIT.indexOf("wear(tier);")).toBeLessThan(FIT.indexOf("needsScroll(wrap.scrollHeight, room)"));
  });

  it("钳完顺手叫一次 showCtrl，而且排在写 overflow 之后", () => {
    const at = FIT.indexOf('wrap.style.overflowY = "auto"');
    expect(at).toBeGreaterThan(-1);
    expect(FIT.indexOf("showCtrl(wrap)")).toBeGreaterThan(at);
  });

  it("下一帧还得再量一次——平台顶栏折行之前量到的是「装得下」", () => {
    expect(FIT).toContain("requestAnimationFrame");
    // 拆完台那一帧不许再动 DOM
    expect(FIT).toContain("live = false");
  });

  it("翻到底不许把外面那层也带着走", () => {
    expect(FIT).toContain('wrap.style.overscrollBehavior = "contain"');
  });

  it("样式里有兜底那一档的记号，而且它不碰任何热区", () => {
    const at = CSS.indexOf(".ldc-scroll{");
    expect(at).toBeGreaterThan(-1);
    const block = CSS.slice(at, CSS.indexOf("}", at));
    expect(block).toContain("overscroll-behavior:contain");
    for (const sel of ["min-height", "font-size", "padding"]) {
      expect(block.includes(sel), `兜底那一档动了 ${sel}`).toBe(false);
    }
  });

  it("裁切线读的是 padding box，不是 getBoundingClientRect().bottom", () => {
    expect(FIT).toContain("clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, cs.borderBottomWidth)");
  });
});
