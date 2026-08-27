// 棋盘视图：坐标换算、按住瞄准、键盘可达、动画帧与清理。
// 这里也守一条硬规矩：**不许在 window 上挂监听，更不许 preventDefault 空格键**
// （那会把整页的滚动吞掉）。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeBoard, setCell } from "./ai";
import { installDom, restoreDom, windowListenerCount, type Dom, type El } from "./domStub";
import { VIEW_W, createBoardView } from "./view";

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
