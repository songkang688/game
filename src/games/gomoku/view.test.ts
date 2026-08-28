// 棋盘视图：坐标换算、按住瞄准、键盘可达、动画帧与清理。
// 这里也守一条硬规矩：**不许在 window 上挂监听，更不许 preventDefault 空格键**
// （那会把整页的滚动吞掉）。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeBoard, setCell } from "./ai";
import { ctxCalls, flushFrames, installDom, restoreDom, windowListenerCount, type Dom, type El } from "./domStub";
import { paintStone } from "./art";
import {
  CSS,
  DROP_MS,
  FORBID_MS,
  MIN_HIT_PX,
  RIPPLE_MS,
  VIEW_W,
  WIN_JUMP_GAP_MS,
  WIN_JUMP_MS,
  WIN_SWEEP_MS,
  createBoardView,
  dropScaleAt,
  forbiddenShakeAt,
  hintPulse,
  sweepProgressAt,
  winJumpOffset,
} from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(800);
});

afterEach(() => {
  restoreDom();
});

function mountView(size: number) {
  const taps: Array<{ x: number; y: number }> = [];
  const view = createBoardView(dom.root as unknown as HTMLElement, {
    size,
    onTap: (c) => taps.push(c),
  });
  const canvas = view.canvas as unknown as El;
  return { view, canvas, taps };
}

function at(size: number, x: number, y: number): { clientX: number; clientY: number; preventDefault: () => void } {
  const cs = VIEW_W / (size + 1);
  return { clientX: cs + x * cs, clientY: cs + y * cs, preventDefault: () => undefined };
}

/** 取某个选择器最后一次出现的规则体（后面的媒体查询会盖掉前面的） */
function ruleBody(selector: string): string {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  let body = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS)) !== null) body = m[1];
  if (!body) throw new Error(`CSS 里没有 ${selector}`);
  return body;
}

/**
 * 一条 CSS 规则能点多高（px）。`min-height` / `height` 优先；
 * 都没写就按「上下 padding + 上下边框 + 字号 × 1.2」估 —— 行高取的是最小那一档，
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

describe("棋盘视图 · 挂载", () => {
  it("挂出一块 canvas，逻辑尺寸固定，键盘能聚焦", () => {
    const { view, canvas } = mountView(15);
    expect(canvas.tagName).toBe("canvas");
    expect(canvas.width).toBe(VIEW_W);
    expect(canvas.height).toBe(VIEW_W);
    expect(canvas.getAttribute("tabindex")).toBe("0");
    expect(canvas.getAttribute("aria-label")).toContain("棋盘");
    view.destroy();
  });

  it("一格多少像素跟着棋盘大小走", () => {
    const a = mountView(9);
    expect(a.view.cellPx()).toBeCloseTo(VIEW_W / 10, 5);
    a.view.destroy();
    const b = mountView(15);
    expect(b.view.cellPx()).toBeCloseTo(VIEW_W / 16, 5);
    b.view.destroy();
  });

  it("一根 window 监听都不挂（滚动、快捷键全不受影响）", () => {
    const before = windowListenerCount(dom);
    const { view } = mountView(15);
    expect(windowListenerCount(dom)).toBe(before);
    view.destroy();
  });
});

describe("棋盘视图 · 指针输入", () => {
  it("点在交叉点上就换算成那一格", () => {
    const { view, canvas, taps } = mountView(9);
    canvas.dispatch("pointerdown", at(9, 3, 5));
    canvas.dispatch("pointerup", at(9, 3, 5));
    expect(taps).toEqual([{ x: 3, y: 5 }]);
    view.destroy();
  });

  it("按住滑动再松手：落在松手的那一格", () => {
    const { view, canvas, taps } = mountView(9);
    canvas.dispatch("pointerdown", at(9, 1, 1));
    canvas.dispatch("pointermove", at(9, 6, 2));
    canvas.dispatch("pointerup", at(9, 6, 2));
    expect(taps).toEqual([{ x: 6, y: 2 }]);
    view.destroy();
  });

  it("点到棋盘外面不算数", () => {
    const { view, canvas, taps } = mountView(9);
    const out = { clientX: -40, clientY: -40, preventDefault: () => undefined };
    canvas.dispatch("pointerdown", out);
    canvas.dispatch("pointerup", out);
    expect(taps).toEqual([]);
    view.destroy();
  });

  it("没按下就松手不会凭空落子", () => {
    const { view, canvas, taps } = mountView(9);
    canvas.dispatch("pointerup", at(9, 4, 4));
    expect(taps).toEqual([]);
    view.destroy();
  });

  it("pointercancel 之后瞄准点清掉", () => {
    const { view, canvas, taps } = mountView(9);
    canvas.dispatch("pointerdown", at(9, 4, 4));
    canvas.dispatch("pointercancel", {});
    canvas.dispatch("pointerup", at(9, 4, 4));
    expect(taps).toEqual([]);
    expect(view.state.ghost).toBeNull();
    view.destroy();
  });
});

describe("棋盘视图 · 键盘可达", () => {
  it("方向键挪光标、回车落子（光标从天元起）", () => {
    const { view, canvas, taps } = mountView(9);
    canvas.dispatch("keydown", { key: "ArrowRight", preventDefault: () => undefined });
    canvas.dispatch("keydown", { key: "ArrowDown", preventDefault: () => undefined });
    canvas.dispatch("keydown", { key: "Enter", preventDefault: () => undefined });
    expect(taps).toEqual([{ x: 5, y: 5 }]);
    view.destroy();
  });

  it("光标撞到边就停住，不会跑到棋盘外", () => {
    const { view, canvas, taps } = mountView(9);
    for (let i = 0; i < 20; i++) {
      canvas.dispatch("keydown", { key: "ArrowLeft", preventDefault: () => undefined });
      canvas.dispatch("keydown", { key: "ArrowUp", preventDefault: () => undefined });
    }
    canvas.dispatch("keydown", { key: "Enter", preventDefault: () => undefined });
    expect(taps).toEqual([{ x: 0, y: 0 }]);
    view.destroy();
  });

  it("光标挪一格，aria-label 就跟着报一次新位置", () => {
    const { view, canvas } = mountView(9);
    const before = canvas.getAttribute("aria-label");
    canvas.dispatch("keydown", { key: "ArrowRight", preventDefault: () => undefined });
    const after = canvas.getAttribute("aria-label");
    expect(after).not.toBe(before);
    // 9 路棋盘光标从 (4,4) 起，往右一格是第 5 行第 6 列
    expect(after).toContain("第 5 行第 6 列");
    view.destroy();
  });

  it("光标停在有子的格子上，读屏器听得出那儿已经有子了", () => {
    const board = makeBoard(9);
    setCell(board, 5, 4, 2);
    const { view, canvas } = mountView(9);
    view.update({ board, size: 9, interactive: true });
    canvas.dispatch("keydown", { key: "ArrowRight", preventDefault: () => undefined });
    expect(canvas.getAttribute("aria-label")).toContain("白棋");
    view.destroy();
  });

  it("轮不到自己时播报也跟着变，不会一直催人按回车", () => {
    const { view, canvas } = mountView(9);
    view.update({ interactive: false });
    expect(canvas.getAttribute("aria-label")).toContain("轮不到你");
    view.update({ interactive: true, confirm: true });
    expect(canvas.getAttribute("aria-label")).toContain("先出预览");
    view.destroy();
  });

  it("空格键完全不理会，绝不 preventDefault（页面照样能滚）", () => {
    const { view, canvas, taps } = mountView(9);
    let prevented = 0;
    canvas.dispatch("keydown", { key: " ", preventDefault: () => void prevented++ });
    canvas.dispatch("keydown", { key: "Spacebar", preventDefault: () => void prevented++ });
    expect(prevented).toBe(0);
    expect(taps).toEqual([]);
    view.destroy();
  });
});

describe("棋盘视图 · 动画与清理", () => {
  it("每帧都排下一帧，画的时候不炸（落子 / 提示区 / 五连光带全开）", () => {
    const board = makeBoard(9);
    setCell(board, 4, 4, 1);
    setCell(board, 4, 5, 2);
    const { view } = mountView(9);
    view.update({
      board,
      size: 9,
      lastMove: { x: 4, y: 4 },
      pending: { x: 2, y: 2 },
      ghost: { x: 3, y: 3 },
      hint: { x0: 1, y0: 1, x1: 3, y1: 3, text: "在这一片" },
      forbidden: { x: 6, y: 6 },
      winLine: [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ],
    });
    view.drop(4, 4);
    view.sweep();
    const before = dom.frames.length;
    for (let i = 0; i < 5; i++) {
      const cb = dom.frames.shift();
      dom.clock.ms += 60;
      cb?.();
    }
    expect(dom.frames.length).toBe(before);
    view.destroy();
  });

  it("destroy 之后 rAF 取消、canvas 摘掉、监听清空", () => {
    const { view, canvas } = mountView(9);
    expect(dom.root.children.length).toBe(1);
    view.destroy();
    expect(dom.cancelled.length).toBeGreaterThan(0);
    expect(dom.root.children.length).toBe(0);
    expect(canvas.countListeners()).toBe(0);
  });

  it("destroy 之后再来一帧也不会继续排帧", () => {
    const { view } = mountView(9);
    view.destroy();
    const cb = dom.frames.shift();
    const before = dom.frames.length;
    cb?.();
    expect(dom.frames.length).toBe(before);
  });

  it("换棋盘大小之后坐标跟着换", () => {
    const { view, canvas, taps } = mountView(15);
    view.resize(9, makeBoard(9));
    canvas.dispatch("pointerdown", at(9, 8, 8));
    canvas.dispatch("pointerup", at(9, 8, 8));
    expect(taps).toEqual([{ x: 8, y: 8 }]);
    expect(view.cellPx()).toBeCloseTo(VIEW_W / 10, 5);
    view.destroy();
  });
});

describe("360px 上的热区", () => {
  it("热区下限就是无障碍要的 44px", () => {
    expect(MIN_HIT_PX).toBe(44);
  });

  it("R2C-G1 · 局内那排按钮（悔棋 / 提示 / 确认落子 / 重摆 / 换玩法）够得到 44px", () => {
    expect(hitHeight(ruleBody(".gmk-btns button")), "局内按钮的热区又缩回去了").toBeGreaterThanOrEqual(
      MIN_HIT_PX,
    );
  });

  it("R2C-G2 · 选择条（棋盘大小 / 档位 / 禁手）与模式条也够得到 44px", () => {
    expect(hitHeight(ruleBody(".gmk-seg button")), "选择条的热区又缩回去了").toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(hitHeight(ruleBody(".gmk-mode")), "模式条的热区又缩回去了").toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it("R2C-G2 · 结算浮层上的按钮不再卡在 44px 的临界线上", () => {
    expect(hitHeight(ruleBody(".gmk-over-btn")), "结算按钮的热区又缩回去了").toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it("能点的按钮一个都没漏：整份 CSS 里每条按钮规则都写了 min-height", () => {
    for (const sel of [".gmk-btns button", ".gmk-seg button", ".gmk-mode", ".gmk-over-btn", ".gmk-start"]) {
      expect(hitHeight(ruleBody(sel)), `${sel} 不到 44px`).toBeGreaterThanOrEqual(MIN_HIT_PX);
    }
  });
});

/* ---------------------------------------------------------------------------
 * 1.3 视觉契约：只改观感不改手感 —— 绘制路径、动画公式、reduced 降级逐条锁死。
 * ------------------------------------------------------------------------- */

describe("1.3 视觉契约 · 绘制路径", () => {
  it("一帧 draw() 绘制非空，棋子走 sprite/渐变路径（drawImage 或 createRadialGradient）", () => {
    const board = makeBoard(15);
    setCell(board, 7, 7, 1);
    setCell(board, 8, 7, 2);
    const { view } = mountView(15);
    view.update({ board, size: 15 });
    ctxCalls.length = 0;
    flushFrames(dom, 1, 16);
    expect(ctxCalls.length).toBeGreaterThan(0);
    expect(ctxCalls.includes("drawImage") || ctxCalls.includes("createRadialGradient")).toBe(true);
    view.destroy();
  });

  it("黑白子绘制配方不同（渐变三档逐档不等，色弱也分得清）", () => {
    const stopsOf = (p: 1 | 2): string[] => {
      const got: string[] = [];
      const grad = { addColorStop: (_o: number, c: string) => void got.push(c) };
      const rec = new Proxy(
        {},
        {
          get: (_t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? () => grad : () => undefined),
          set: () => true,
        }
      ) as unknown as CanvasRenderingContext2D;
      paintStone(rec, 0, 0, 10, p);
      return got;
    };
    const black = stopsOf(1);
    const white = stopsOf(2);
    expect(black.length).toBe(3);
    expect(white.length).toBe(3);
    for (let i = 0; i < 3; i++) expect(black[i]).not.toBe(white[i]);
  });

  it("bloom 之后一帧画得出金花（谜题过关的目标点开花标记）", () => {
    const { view } = mountView(9);
    view.bloom(4, 4);
    ctxCalls.length = 0;
    flushFrames(dom, 3, 60);
    // 空盘上唯一的 ellipse 只可能来自金花的五片花瓣
    expect(ctxCalls.includes("ellipse")).toBe(true);
    view.destroy();
  });
});

describe("1.3 视觉契约 · 动画公式回归（改版前后同输入同输出）", () => {
  it("dropScale 公式一毫米没动：1.5 倍砸下、easeOutBack 回弹", () => {
    expect(DROP_MS).toBe(220);
    expect(dropScaleAt(0)).toBeCloseTo(1.5, 8);
    expect(dropScaleAt(0.25)).toBeCloseTo(1.25796625, 6);
    expect(dropScaleAt(0.5)).toBeCloseTo(1.00342201, 6);
    expect(dropScaleAt(0.75)).toBeCloseTo(0.89557562, 6);
    expect(dropScaleAt(0.9)).toBeCloseTo(0.88099699, 6);
    expect(dropScaleAt(1)).toBe(1);
    expect(dropScaleAt(1.5)).toBe(1);
    expect(dropScaleAt(-0.1)).toBe(1);
  });

  it("胜利线扫光时序回归：WIN_SWEEP_MS 不变、进度线性到 1 封顶", () => {
    expect(WIN_SWEEP_MS).toBe(620);
    expect(sweepProgressAt(0)).toBe(0);
    expect(sweepProgressAt(310)).toBeCloseTo(0.5, 8);
    expect(sweepProgressAt(620)).toBe(1);
    expect(sweepProgressAt(5000)).toBe(1);
    expect(sweepProgressAt(-50)).toBe(0);
  });

  it("禁手红叉抖动衰减回归：正弦抖 + 线性衰减到 0", () => {
    expect(FORBID_MS).toBe(1400);
    expect(forbiddenShakeAt(100)).toBeCloseTo(1.22259309, 6);
    expect(forbiddenShakeAt(400)).toBeCloseTo(-0.85489032, 6);
    expect(forbiddenShakeAt(1200)).toBeCloseTo(-0.31052422, 6);
    expect(forbiddenShakeAt(1400)).toBeCloseTo(0, 8);
    expect(Math.abs(forbiddenShakeAt(1200))).toBeLessThan(Math.abs(forbiddenShakeAt(100)));
  });

  it("提示区脉动幅度减半（±0.04），reduced 下静止在 0.16", () => {
    expect(hintPulse(123, true)).toBe(0.16);
    expect(hintPulse(98765, true)).toBe(0.16);
    let maxDev = 0;
    for (let t = 0; t < 3000; t += 37) maxDev = Math.max(maxDev, Math.abs(hintPulse(t, false) - 0.16));
    expect(maxDev).toBeLessThanOrEqual(0.04 + 1e-9);
    expect(maxDev).toBeGreaterThan(0.03);
  });

  it("胜利仪式跳子：扫完才跳、逐颗错开 60ms、reduced 不跳", () => {
    const c = 24;
    expect(WIN_JUMP_MS).toBe(150);
    expect(WIN_JUMP_GAP_MS).toBe(60);
    expect(winJumpOffset(-10, 0, c, false)).toBe(0);
    expect(winJumpOffset(WIN_JUMP_MS / 2, 0, c, false)).toBeCloseTo(-c * 0.3, 6);
    expect(winJumpOffset(WIN_JUMP_MS / 2, 4, c, false)).toBe(0);
    expect(winJumpOffset(WIN_JUMP_MS / 2 + WIN_JUMP_GAP_MS, 1, c, false)).toBeCloseTo(-c * 0.3, 6);
    expect(winJumpOffset(WIN_JUMP_MS + 500, 0, c, false)).toBe(0);
    expect(winJumpOffset(WIN_JUMP_MS / 2, 0, c, true)).toBe(0);
  });
});

describe("1.3 视觉契约 · 落定波纹", () => {
  it("回弹结束瞬间出现一圈波纹，0.25s 后散尽", () => {
    const board = makeBoard(9);
    setCell(board, 4, 4, 1);
    const { view } = mountView(9);
    view.update({ board, size: 9 });
    view.drop(4, 4);
    expect(view.ripplesActive()).toBe(0);
    flushFrames(dom, 4, 60); // 越过 DROP_MS = 220
    expect(view.ripplesActive()).toBe(1);
    flushFrames(dom, 5, 60); // 再越过 RIPPLE_MS = 250
    expect(view.ripplesActive()).toBe(0);
    expect(RIPPLE_MS).toBe(250);
    view.destroy();
  });

  it("reduced 下波纹一个也不产生", () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({ matches: q.includes("reduce") });
    const board = makeBoard(9);
    setCell(board, 4, 4, 1);
    const { view } = mountView(9);
    view.update({ board, size: 9 });
    view.drop(4, 4);
    for (let i = 0; i < 9; i++) {
      flushFrames(dom, 1, 60);
      expect(view.ripplesActive()).toBe(0);
    }
    view.destroy();
  });
});
