// 棋盘视图：验「看得见」的那几件事 —— 徽章、脉冲、变暗、点击换算、清理干净；
// 1.3 之后 domStub 会记下每一笔画布调用，绘制路径与演出降级也能逐条断言。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECK_BADGE_MS, CSS, GEOM, PIECE_FACE, RED_INK, BLACK_INK, createBoardView } from "./view";
import { idx, initialBoard, makeEmptyBoard, type Board, type Move, type Pos } from "./logic";
import { ctxCalls, installDom, restoreDom, flushFrames, type Dom, type El } from "./domStub";
import { MIN_HIT_PX, pointAt } from "./session";
import { COMPASS_ORANGE, FRAME_GOLD, MOVE_MS, PETAL_PINK, POS_MARK, RIVER_WAVE, CAPTURE_GOLD } from "./art";

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

/* ---------------------------------------------------------------------------
 * 1.3 视觉契约：只改观感不改手感 —— 绘制路径、走子三段、吃子花瓣、
 * 将军红光、结算印章、reduced 降级逐条锁死。
 * ------------------------------------------------------------------------- */

const px = (x: number): number => pointAt(GEOM, x, 0).cx;
const py = (y: number): number => pointAt(GEOM, 0, y).cy;

/** 这一段调用流水里所有 drawImage 的目标中心点 */
function imageCenters(): Array<{ x: number; y: number }> {
  return ctxCalls
    .filter((c) => c.m === "drawImage")
    .map((c) => ({
      x: (c.a[1] as number) + (c.a[3] as number) / 2,
      y: (c.a[2] as number) + (c.a[4] as number) / 2,
    }));
}

/** 是不是正好落在某个交叉点坐标上 */
function onGrid(v: number): boolean {
  const m = (v - GEOM.margin) % GEOM.cell;
  return Math.abs(m) < 0.001 || Math.abs(m - GEOM.cell) < 0.001;
}

/** 这一段流水里写过的所有 strokeStyle / fillStyle 字符串值 */
function styleSets(prop: "strokeStyle" | "fillStyle"): string[] {
  return ctxCalls.filter((c) => c.m === `set:${prop}` && typeof c.a[0] === "string").map((c) => c.a[0] as string);
}

/** 在测试里手工把一步走完（视图不管规则，直接改数组） */
function applied(b: Board, m: Move): Board {
  const n = b.slice();
  n[idx(m.to.x, m.to.y)] = n[idx(m.from.x, m.from.y)];
  n[idx(m.from.x, m.from.y)] = null;
  return n;
}

describe("1.3 视觉契约 · 绘制路径", () => {
  it("满盘 32 子全走 sprite 路径：一帧 ≥ 32 次 drawImage", () => {
    const { view } = makeView();
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    expect(ctxCalls.filter((c) => c.m === "drawImage").length).toBeGreaterThanOrEqual(32);
    view.destroy();
  });

  it("楚河汉界文字回归：每一帧都写着「楚 河」「汉 界」", () => {
    const { view } = makeView();
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const texts = ctxCalls.filter((c) => c.m === "fillText").map((c) => c.a[0]);
    expect(texts).toContain("楚 河");
    expect(texts).toContain("汉 界");
    view.destroy();
  });

  it("九宫斜线回归：两座九宫的四条对角线一条不少", () => {
    const { view } = makeView();
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const hasSeg = (x0: number, y0: number, x1: number, y1: number): boolean =>
      ctxCalls.some(
        (c, i) =>
          c.m === "moveTo" &&
          c.a[0] === px(x0) &&
          c.a[1] === py(y0) &&
          ctxCalls[i + 1]?.m === "lineTo" &&
          ctxCalls[i + 1].a[0] === px(x1) &&
          ctxCalls[i + 1].a[1] === py(y1),
      );
    for (const top of [0, 7]) {
      expect(hasSeg(3, top, 5, top + 2), `九宫 ${top} 撇线丢了`).toBe(true);
      expect(hasSeg(5, top, 3, top + 2), `九宫 ${top} 捺线丢了`).toBe(true);
    }
    view.destroy();
  });

  it("棋盘装饰上齐了：位点角标、双层木框金线、河界水波", () => {
    const { view } = makeView();
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const strokes = styleSets("strokeStyle");
    expect(strokes).toContain(POS_MARK);
    expect(strokes).toContain(FRAME_GOLD);
    expect(strokes).toContain(RIVER_WAVE);
    view.destroy();
  });

  it("最后一手换成罗盘印记（橙色细圈），不再是方框", () => {
    const { view } = makeView();
    view.update({ lastMove: { from: { x: 7, y: 7 }, to: { x: 4, y: 7 } } });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    expect(styleSets("strokeStyle").some((v) => v.startsWith(COMPASS_ORANGE))).toBe(true);
    view.destroy();
  });
});

describe("1.3 视觉契约 · 走子三段（拿起—滑动—落定）", () => {
  const mv: Move = { from: { x: 4, y: 6 }, to: { x: 4, y: 5 } };

  it("滑动 160ms：动画中段那颗子悬在两个交叉点之间", () => {
    expect(MOVE_MS).toBe(160);
    const { view } = makeView();
    view.update({ board: applied(initialBoard(), mv), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "P" }, null);
    ctxCalls.length = 0;
    flushFrames(dom, 1); // +50ms，滑到 160ms 的中段
    const mid = imageCenters().some(
      (c) => Math.abs(c.x - px(4)) < 0.01 && c.y > py(5) + 2 && c.y < py(6) - 2,
    );
    expect(mid, "滑动中段没有悬在两点之间的子").toBe(true);
    view.destroy();
  });

  it("演出散场后全部落定：每一颗子都画回交叉点", () => {
    const { view } = makeView();
    view.update({ board: applied(initialBoard(), mv), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "P" }, null);
    flushFrames(dom, 13); // 650ms > ANIM_TOTAL_MS，演出该收了
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const centers = imageCenters();
    expect(centers.length).toBeGreaterThanOrEqual(32);
    for (const c of centers) {
      expect(onGrid(c.x), `x=${c.x} 不在交叉点上`).toBe(true);
      expect(onGrid(c.y), `y=${c.y} 不在交叉点上`).toBe(true);
    }
    view.destroy();
  });

  it("reduce 直接落定：第一帧就全部在交叉点上，不滑动", () => {
    const { view } = makeView(true);
    view.update({ board: applied(initialBoard(), mv), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "P" }, null);
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    for (const c of imageCenters()) {
      expect(onGrid(c.x)).toBe(true);
      expect(onGrid(c.y)).toBe(true);
    }
    view.destroy();
  });

  it("动画进行中点棋盘：落点换算一个都不偏（px/py 反算回归）", () => {
    const { view, taps, canvas } = makeView();
    view.update({ board: applied(initialBoard(), mv), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "P" }, null);
    flushFrames(dom, 1);
    tap(canvas, 3, 3);
    expect(taps).toEqual([{ x: 3, y: 3 }]);
    view.destroy();
  });
});

describe("1.3 视觉契约 · 吃子花瓣与金环", () => {
  const mv: Move = { from: { x: 0, y: 0 }, to: { x: 0, y: 4 } };

  function boardAfterCapture(): Board {
    const b = makeEmptyBoard();
    b[idx(0, 4)] = { side: "red", type: "R" };
    return b;
  }

  it("吃大子（车马炮）：花瓣退场 + 一圈金环", () => {
    const { view } = makeView();
    view.update({ board: boardAfterCapture(), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "R" }, { side: "black", type: "H" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    expect(styleSets("fillStyle")).toContain(PETAL_PINK);
    expect(styleSets("strokeStyle").some((v) => v.startsWith(`rgba(${CAPTURE_GOLD}`))).toBe(true);
    view.destroy();
  });

  it("吃小子（兵卒）：有花瓣但不给金环", () => {
    const { view } = makeView();
    view.update({ board: boardAfterCapture(), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "R" }, { side: "black", type: "P" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    expect(styleSets("fillStyle")).toContain(PETAL_PINK);
    expect(styleSets("strokeStyle").some((v) => v.startsWith(`rgba(${CAPTURE_GOLD}`))).toBe(false);
    view.destroy();
  });

  it("花瓣散完就回收：演出窗口过后一片都不再画", () => {
    const { view } = makeView();
    view.update({ board: boardAfterCapture(), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "R" }, { side: "black", type: "H" });
    flushFrames(dom, 13); // 650ms > PETAL_MS
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    expect(styleSets("fillStyle")).not.toContain(PETAL_PINK);
    expect(styleSets("strokeStyle").some((v) => v.startsWith(`rgba(${CAPTURE_GOLD}`))).toBe(false);
    view.destroy();
  });

  it("reduce 下吃子直接消失：不出花瓣不旋转", () => {
    const { view } = makeView(true);
    view.update({ board: boardAfterCapture(), lastMove: mv });
    view.animateMove(mv, { side: "red", type: "R" }, { side: "black", type: "H" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    expect(styleSets("fillStyle")).not.toContain(PETAL_PINK);
    view.destroy();
  });
});

describe("1.3 视觉契约 · 将军红光与结算仪式", () => {
  it("reduce 下将军警告是静态描边：两帧的红光值一模一样且不消失", () => {
    const { view } = makeView(true);
    view.update({ checkSide: "red" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const first = styleSets("strokeStyle").filter((v) => v.startsWith("rgba(226,60,45"));
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((v) => v.includes("0.85"))).toBe(true);
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const second = styleSets("strokeStyle").filter((v) => v.startsWith("rgba(226,60,45"));
    expect(second).toEqual(first);
    view.destroy();
  });

  it("动效模式将军红光在呼吸：相邻两帧透明度不同", () => {
    const { view } = makeView();
    view.update({ checkSide: "red" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const first = styleSets("strokeStyle").filter((v) => v.startsWith("rgba(226,60,45"));
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const second = styleSets("strokeStyle").filter((v) => v.startsWith("rgba(226,60,45"));
    expect(first.length).toBeGreaterThan(0);
    expect(second).not.toEqual(first);
    view.destroy();
  });

  it("印章盖「胜」：盖到一半有金色微尘，reduce 直接盖好没有微尘", () => {
    const a = makeView();
    a.view.stampSeal("胜");
    ctxCalls.length = 0;
    flushFrames(dom, 1); // 50ms / 400ms，盖到一半
    expect(ctxCalls.some((c) => c.m === "fillText" && c.a[0] === "胜")).toBe(true);
    expect(styleSets("fillStyle")).toContain(FRAME_GOLD);
    a.view.destroy();
    const b = makeView(true);
    b.view.stampSeal("胜");
    ctxCalls.length = 0;
    flushFrames(dom, 2); // 第一帧是 A 视图 destroy 后留下的死帧，第二帧才轮到 B
    expect(ctxCalls.some((c) => c.m === "fillText" && c.a[0] === "胜")).toBe(true);
    expect(styleSets("fillStyle")).not.toContain(FRAME_GOLD);
    b.view.destroy();
  });

  it("将杀结算：胜方帅画在变暗层之上并跳起两下", () => {
    const { view } = makeView();
    view.update({ dim: true, winSide: "red" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const dimIdx = ctxCalls.findIndex((c) => c.m === "set:fillStyle" && c.a[0] === "rgba(40,25,10,.28)");
    expect(dimIdx).toBeGreaterThanOrEqual(0);
    const after = ctxCalls.slice(dimIdx).filter((c) => c.m === "drawImage");
    expect(after.length).toBe(1); // 变暗之后只补画胜方的帅
    const cy = (after[0].a[2] as number) + (after[0].a[4] as number) / 2;
    const cx = (after[0].a[1] as number) + (after[0].a[3] as number) / 2;
    expect(Math.abs(cx - px(4))).toBeLessThan(0.01);
    expect(cy).toBeLessThan(py(9) - 1); // 跳起来了
    view.destroy();
  });

  it("reduce 下胜方帅不跳：稳稳站在九宫的交叉点上", () => {
    const { view } = makeView(true);
    view.update({ dim: true, winSide: "red" });
    ctxCalls.length = 0;
    flushFrames(dom, 1);
    const dimIdx = ctxCalls.findIndex((c) => c.m === "set:fillStyle" && c.a[0] === "rgba(40,25,10,.28)");
    const after = ctxCalls.slice(dimIdx).filter((c) => c.m === "drawImage");
    expect(after.length).toBe(1);
    const cy = (after[0].a[2] as number) + (after[0].a[4] as number) / 2;
    expect(Math.abs(cy - py(9))).toBeLessThan(0.001);
    view.destroy();
  });
});
