// 棋盘视图：只验「看得见」的那几件事 —— 徽章、脉冲、变暗、点击换算、清理干净。
// canvas 上画了什么没法断言，所以画笔本身只保证不抛错。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECK_BADGE_MS, CSS, GEOM, PIECE_FACE, RED_INK, BLACK_INK, createBoardView } from "./view";
import { initialBoard, type Pos } from "./logic";
import { installDom, restoreDom, flushFrames, type Dom, type El } from "./domStub";
import { MIN_HIT_PX, pointAt } from "./session";

let dom: Dom;

beforeEach(() => {
  dom = installDom(800);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom();
});

function makeView(reduceMotion = false) {
  const taps: Pos[] = [];
  const host = dom.root;
  const view = createBoardView(host as unknown as HTMLElement, initialBoard(), {
    reduceMotion,
    onTap: (p) => taps.push(p),
  });
  return { view, taps, canvas: view.canvas as unknown as El };
}

/** 取某个选择器的基础规则体（`@media` 那几段单独切出来看） */
function ruleBody(selector: string): string {
  const base = CSS.slice(0, CSS.indexOf("@media"));
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const m = re.exec(base);
  if (!m) throw new Error(`CSS 里没有 ${selector}`);
  return m[1];
}

/**
 * 一条 CSS 规则能点多高（px）。`min-height` / `height` 优先；
 * 都没写就按「上下 padding + 上下边框 + 字号 × 1.2」估 —— 行高取最小那一档，
 * 估出来的是**下限**，所以 ≥ 44 的结论只会更保守。
 */
function hitHeight(body: string): number {
  const explicit = /(?:^|;)\s*(?:min-)?height:\s*([\d.]+)px/.exec(body);
  if (explicit) return Number(explicit[1]);
  const pad = /(?:^|;)\s*padding:\s*([\d.]+)px/.exec(body);
  const font = /(?:^|;)\s*font-size:\s*([\d.]+)px/.exec(body);
  const border = /(?:^|;)\s*border:\s*([\d.]+)px/.exec(body);
  if (!pad || !font) return Number.NaN;
  return Number(pad[1]) * 2 + (border ? Number(border[1]) * 2 : 0) + Number(font[1]) * 1.2;
}

/** 按交叉点坐标点一下 canvas */
function tap(canvas: El, x: number, y: number, cssWidth = GEOM.width): void {
  canvas.width = cssWidth;
  canvas.height = Math.round((cssWidth / GEOM.width) * GEOM.height);
  const p = pointAt(GEOM, x, y);
  canvas.dispatch("pointerdown", {
    clientX: (p.cx / GEOM.width) * cssWidth,
    clientY: (p.cy / GEOM.height) * canvas.height,
    preventDefault: () => undefined,
  });
}

describe("棋盘几何", () => {
  it("9 列 10 行，画布尺寸按格距算出来", () => {
    expect(GEOM.width).toBe(GEOM.margin * 2 + GEOM.cell * 8);
    expect(GEOM.height).toBe(GEOM.margin * 2 + GEOM.cell * 9);
  });

  it("棋盘比例是竖着的（象棋不是正方形）", () => {
    expect(GEOM.height).toBeGreaterThan(GEOM.width);
  });
});

describe("挂载与清理", () => {
  it("挂出来一张 canvas，尺寸就是逻辑尺寸", () => {
    const { view, canvas } = makeView();
    expect(canvas.tagName).toBe("canvas");
    expect(canvas.className).toContain("xq-canvas");
    expect(canvas.width).toBe(GEOM.width);
    expect(canvas.height).toBe(GEOM.height);
    view.destroy();
  });

  it("destroy 之后 canvas 摘掉、监听清空、动画帧取消", () => {
    const { view, canvas } = makeView();
    expect(dom.root.countListeners()).toBeGreaterThan(0);
    const before = dom.cancelled.length;
    view.destroy();
    expect(dom.root.children.length).toBe(0);
    expect(canvas.countListeners()).toBe(0);
    expect(dom.cancelled.length).toBeGreaterThan(before);
  });

  it("destroy 之后再来帧也不画（不抛错）", () => {
    const { view } = makeView();
    view.destroy();
    expect(() => flushFrames(dom, 3)).not.toThrow();
  });

  it("连着跑几十帧不出错（脉冲一直在动）", () => {
    const { view } = makeView();
    view.update({ selected: { x: 4, y: 9 }, targets: [{ x: 4, y: 8 }] });
    expect(() => flushFrames(dom, 40)).not.toThrow();
    view.destroy();
  });
});

describe("点棋盘换算成交叉点", () => {
  it("点哪个交叉点就报哪个", () => {
    const { view, taps, canvas } = makeView();
    tap(canvas, 4, 9);
    tap(canvas, 0, 0);
    tap(canvas, 8, 4);
    expect(taps).toEqual([{ x: 4, y: 9 }, { x: 0, y: 0 }, { x: 8, y: 4 }]);
    view.destroy();
  });

  it("360px 的窄屏上也点得准", () => {
    const { view, taps, canvas } = makeView();
    tap(canvas, 7, 7, 336);
    expect(taps).toEqual([{ x: 7, y: 7 }]);
    view.destroy();
  });

  it("不能点的时候（轮到对方 / 已结束）点了不报", () => {
    const { view, taps, canvas } = makeView();
    view.update({ interactive: false });
    tap(canvas, 4, 9);
    expect(taps).toEqual([]);
    view.update({ interactive: true });
    tap(canvas, 4, 9);
    expect(taps.length).toBe(1);
    view.destroy();
  });

  it("点在棋盘边角外面不报", () => {
    const { view, taps, canvas } = makeView();
    canvas.width = GEOM.width;
    canvas.height = GEOM.height;
    canvas.dispatch("pointerdown", { clientX: 2, clientY: 2, preventDefault: () => undefined });
    expect(taps).toEqual([]);
    view.destroy();
  });
});

describe("将军徽章", () => {
  it("flashCheck 飞出「将！」，四百毫秒后自己收回去", () => {
    const { view } = makeView();
    view.flashCheck();
    const badge = dom.root.find((e) => e.className.includes("xq-badge"));
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("将");
    vi.advanceTimersByTime(CHECK_BADGE_MS + 100);
    expect(dom.root.find((e) => e.className.includes("xq-badge"))).toBeNull();
    view.destroy();
  });

  it("连着将两次只留一个徽章，不会叠一堆", () => {
    const { view } = makeView();
    view.flashCheck();
    view.flashCheck();
    expect(dom.root.findAll((e) => e.className.includes("xq-badge")).length).toBe(1);
    vi.advanceTimersByTime(CHECK_BADGE_MS + 100);
    expect(dom.root.findAll((e) => e.className.includes("xq-badge")).length).toBe(0);
    view.destroy();
  });

  it("徽章还没散场就 destroy，也不会留在页面上", () => {
    const { view } = makeView();
    view.flashCheck();
    view.destroy();
    expect(dom.root.find((e) => e.className.includes("xq-badge"))).toBeNull();
    vi.advanceTimersByTime(CHECK_BADGE_MS + 100);
    expect(dom.root.find((e) => e.className.includes("xq-badge"))).toBeNull();
  });

  it("徽章动画时长和 CHECK_BADGE_MS 对得上", () => {
    expect(CHECK_BADGE_MS).toBe(400);
    expect(CSS).toContain(`${CHECK_BADGE_MS}ms`);
  });
});

describe("被将一方的脉冲描边与将死变暗", () => {
  it("checkSide 打开再关掉都不抛错（应将成功后描边就没了）", () => {
    const { view } = makeView();
    view.update({ checkSide: "black" });
    flushFrames(dom, 3);
    view.update({ checkSide: null });
    flushFrames(dom, 3);
    view.destroy();
  });

  it("dim 打开时画一层暗色（将死 / 困毙的结算画面）", () => {
    const { view } = makeView();
    expect(() => view.update({ dim: true })).not.toThrow();
    view.destroy();
  });

  it("半透明预览子：pending 有值时不抛错", () => {
    const { view } = makeView();
    view.update({ selected: { x: 7, y: 7 }, pending: { x: 4, y: 7 }, targets: [{ x: 4, y: 7 }] });
    flushFrames(dom, 2);
    view.destroy();
  });
});

describe("prefers-reduced-motion", () => {
  it("静态模式下连跑几十帧也不抛错（徽章静帧、不脉冲）", () => {
    const { view } = makeView(true);
    view.update({ selected: { x: 4, y: 9 }, checkSide: "red", targets: [{ x: 4, y: 8 }] });
    expect(() => flushFrames(dom, 30)).not.toThrow();
    view.destroy();
  });

  it("CSS 里给 reduce 留了不动的那一份", () => {
    expect(CSS).toContain("prefers-reduced-motion");
    const block = CSS.slice(CSS.indexOf("prefers-reduced-motion"));
    expect(block).toContain("animation:none");
  });
});

describe("看得清：颜色与手机适配", () => {
  /** 相对亮度（WCAG） */
  function luminance(hex: string): number {
    const n = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => {
      const v = parseInt(n.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it("红字与黑字对着棋子底色都到 4.5:1（红别用浅粉）", () => {
    expect(contrast(RED_INK, PIECE_FACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(BLACK_INK, PIECE_FACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("红黑两方彼此也分得开", () => {
    expect(contrast(RED_INK, BLACK_INK)).toBeGreaterThan(1.8);
  });

  it("canvas 宽度撑满容器，棋盘不会被记谱条挤窄", () => {
    expect(CSS).toContain(".xq-canvas{width:100%");
    expect(CSS).toContain(".xq-record{display:flex");
    expect(CSS).toContain("overflow-x:auto");
  });

  it("窄屏有专门的一档样式，按钮不会挤成一团", () => {
    expect(CSS).toContain("@media (max-width:380px)");
  });

  it("热区下限就是无障碍要的 44px", () => {
    expect(MIN_HIT_PX).toBe(44);
  });

  it("R2C-X1 · 局内那排按钮（悔棋 / 确认落子 / 提示 / 重摆 / 认输 / 求和 / 换玩法）够得到 44px", () => {
    expect(hitHeight(ruleBody(".xq-btns button")), "局内按钮的热区又缩回去了").toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it("R2C-X1 · 360px 那一档也得兜住 —— 窄屏把 padding 压小了，min-height 不能跟着丢", () => {
    const narrow = CSS.slice(CSS.indexOf("@media (max-width:380px)"));
    expect(hitHeight(/\.xq-btns button\{([^}]*)\}/.exec(narrow)?.[1] ?? "")).toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it("R2C-X1 · 模式条与结算按钮不再卡在 44px 的临界线上", () => {
    expect(hitHeight(ruleBody(".xq-mode")), "模式条的热区又缩回去了").toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(hitHeight(ruleBody(".xq-over-btn")), "结算按钮的热区又缩回去了").toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it("能点的按钮一个都没漏：逐条量过整份 CSS", () => {
    for (const sel of [
      ".xq-btns button",
      ".xq-seg button",
      ".xq-mode",
      ".xq-over-btn",
      ".xq-start",
      ".xq-rules-close",
    ]) {
      expect(hitHeight(ruleBody(sel)), `${sel} 不到 44px`).toBeGreaterThanOrEqual(MIN_HIT_PX);
    }
  });
});
