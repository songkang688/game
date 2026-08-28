/**
 * 翻翻暗棋 · 1.3 第 3 轮（终验）C 档修复契约。
 *
 * 遗留清零（r1 遗留 1 → r2 fixer 移交 → A 档 r3 对账 #12）：`setCellContent` 里的
 * textContent 降级桩在真实 DOM 中总被紧随的 innerHTML 整体抹掉，零渲染零读屏价值，
 * 只被两条旧断言当契约用。r3 起删掉死桩，格子文字口径统一走 `refresh()` 逐格重设的
 * aria-label（空格 / 还盖着 / 红蓝 + 兵种）——读屏正文即测试契约，一份口径两头用。
 * 玩法、判定、回调时序零触碰：本文件只钉「桩层恒空 + aria-label 三态」的修后状态。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexOf, labelOf, type Cell, type Color, type Kind } from "./board";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { applyAction, makeState, type GameState } from "./rules";
import { createBoard, type BoardHandle } from "./view";

const VIEW_SRC = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

function blank(): Cell[] {
  return new Array(32).fill(null);
}

function place(cells: Cell[], r: number, c: number, color: Color, kind: Kind, covered = false): number {
  const i = indexOf(r, c);
  cells[i] = { color, kind, covered };
  return i;
}

function mountBoard(state: GameState): BoardHandle {
  return createBoard(dom.root as unknown as HTMLElement, {
    state,
    humans: ["duo", "star"],
    showCounter: false,
    onHumanAction: () => undefined,
    onNote: () => undefined,
  });
}

function cellEls(): El[] {
  return dom.root.findAll((e) => e.className.includes("dc-cell"));
}

describe("dark-chess · textContent 死桩清零（r3 终验 · r1 遗留 1）", () => {
  it("三态格子的文字口径都在 aria-label 上：还盖着 / 红蓝 + 兵种 / 空格", () => {
    const cells = blank();
    const covered = place(cells, 0, 0, "blue", "soldier", true);
    const open = place(cells, 1, 2, "red", "general");
    const board = mountBoard(makeState(cells, { colors: { duo: "red", star: "blue" } }));
    const els = cellEls();
    expect(els[covered].getAttribute("aria-label")).toBe("第 1 行第 1 列 还盖着");
    expect(els[open].getAttribute("aria-label")).toBe(`第 2 行第 3 列 红${labelOf("red", "general")}`);
    expect(els[indexOf(3, 7)].getAttribute("aria-label")).toBe("第 4 行第 8 列 空格");
    board.destroy();
  });

  it("桩层恒空：盖着 / 翻开 / 空格三态都不再往格子里写 textContent", () => {
    // dom 桩里 textContent 与 innerHTML 相互独立：textContent 恒为空串，
    // 即证明视图不再写这条真实 DOM 里必被 innerHTML 抹掉的死桩
    const cells = blank();
    const covered = place(cells, 0, 0, "blue", "soldier", true);
    const open = place(cells, 1, 2, "red", "general");
    const board = mountBoard(makeState(cells, { colors: { duo: "red", star: "blue" } }));
    const els = cellEls();
    for (const i of [covered, open, indexOf(3, 7)]) expect(els[i].textContent).toBe("");
    board.destroy();
  });

  it("翻开一枚后 aria-label 从「还盖着」换成兵种名，SVG 面板层同步换脸，桩层仍空", () => {
    const cells = blank();
    place(cells, 0, 0, "red", "horse", true);
    const state = makeState(cells);
    const board = mountBoard(state);
    expect(cellEls()[0].getAttribute("aria-label")).toBe("第 1 行第 1 列 还盖着");
    applyAction(state, { type: "flip", at: 0 });
    board.refresh();
    const b = cellEls()[0];
    expect(b.getAttribute("aria-label")).toBe(`第 1 行第 1 列 红${labelOf("red", "horse")}`);
    expect(b.innerHTML).toContain(labelOf("red", "horse"));
    expect(b.textContent).toBe("");
    board.destroy();
  });

  it("源码契约：视图里不再有牌背桩字符，格子层不再写 textContent", () => {
    expect(VIEW_SRC).not.toContain("🌸");
    expect(VIEW_SRC).not.toMatch(/b\.textContent/);
  });
});
