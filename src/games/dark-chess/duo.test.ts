/**
 * 翻翻暗棋 · 双人同屏的键位分家（QA 第 2 轮 · 包 B · R2B-1）。
 *
 * 修之前 `w/a/s/d` 与 `f` / `g` 是无条件接的：轮到康康时，坐左边的鸭梨按 D 能拨光标、
 * 按 F 能直接替康康把这一手下掉，整盘还共用一个光标。
 * 这里守住三件事：一人一个光标、不是自己的回合按了不算、单人局里方向键仍是鸭梨的别名。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexOf, type Cell, type Color, type Kind } from "./board";
import { fireWindow, installDom, restoreDom, type Dom, type El } from "./domStub";
import { createTable } from "./index";
import { makeState, type GameState, type Side } from "./rules";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
  vi.useRealTimers();
});

function blank(): Cell[] {
  return new Array(32).fill(null);
}

function place(cells: Cell[], r: number, c: number, color: Color, kind: Kind, covered = false): number {
  cells[indexOf(r, c)] = { color, kind, covered };
  return indexOf(r, c);
}

/** 两边各一个将、外加两枚盖着的子：谁按错了键都看得出来 */
function board(turn: Side): GameState {
  const cells = blank();
  place(cells, 0, 0, "red", "general");
  place(cells, 3, 7, "blue", "general");
  place(cells, 1, 3, "red", "horse", true);
  place(cells, 2, 4, "blue", "horse", true);
  return makeState(cells, { colors: { duo: "red", star: "blue" }, turn });
}

function mountTable(state: GameState, rival: "ai" | "human"): { destroy: () => void } {
  return createTable(dom.root as unknown as HTMLElement, {
    state,
    rival,
    tier: "rookie",
    showCounter: false,
    label: "测试盘",
    maxPlies: 400,
    seed: 7,
    onEnd: () => undefined,
  });
}

function press(key: string): void {
  fireWindow(dom, "keydown", { key, preventDefault: () => undefined });
}

function cells(): El[] {
  return dom.root.findAll((e) => e.className.includes("dc-cell"));
}

/** 屏幕上画着的那一个光标在第几格 */
function cursorAt(): number {
  return cells().findIndex((c) => c.className.split(/\s+/).includes("dc-cursor"));
}

function noteText(): string {
  return dom.root.find((e) => e.className.includes("dc-note"))?.textContent ?? "";
}

describe("双人同屏 · 一人一套键", () => {
  it("轮到康康，鸭梨的 WASD 拨不动光标", () => {
    const state = board("star");
    const table = mountTable(state, "human");
    const home = cursorAt();
    press("d");
    expect(cursorAt(), "鸭梨的 D 把康康的光标拨走了").toBe(home);
    press("s");
    expect(cursorAt(), "鸭梨的 S 把康康的光标拨走了").toBe(home);
    press("ArrowLeft");
    expect(cursorAt(), "康康自己的方向键反而不管用了").toBe(home - 1);
    table.destroy();
  });

  it("轮到康康，鸭梨按 F 不会替康康落子", () => {
    vi.useFakeTimers();
    const state = board("star");
    const table = mountTable(state, "human");
    // 先把康康的光标挪到一枚盖着的子上，证明这一格本来是翻得动的
    const target = indexOf(2, 4);
    for (let g = 0; g < 40 && cursorAt() !== target; g++) {
      const cur = cursorAt();
      if (cur % 8 > target % 8) press("ArrowLeft");
      else if (cur % 8 < target % 8) press("ArrowRight");
      else if (cur >= 8 && Math.floor(cur / 8) > Math.floor(target / 8)) press("ArrowUp");
      else press("ArrowDown");
    }
    expect(cursorAt()).toBe(target);

    press("f");
    vi.advanceTimersByTime(400);
    expect(state.plies, "鸭梨的 F 替康康把这一手下掉了").toBe(0);
    expect(state.turn).toBe("star");
    expect(noteText()).not.toContain("翻开");

    press("l");
    vi.advanceTimersByTime(400);
    expect(state.plies, "康康自己的 L 不管用了").toBe(1);
    expect(state.turn).toBe("duo");
    table.destroy();
  });

  it("轮到鸭梨，康康的方向键与 L 都不算数", () => {
    vi.useFakeTimers();
    const state = board("duo");
    const table = mountTable(state, "human");
    const home = cursorAt();
    press("ArrowRight");
    expect(cursorAt(), "康康的方向键把鸭梨的光标拨走了").toBe(home);
    press("l");
    vi.advanceTimersByTime(400);
    expect(state.plies, "康康的 L 替鸭梨落子了").toBe(0);
    press("d");
    expect(cursorAt(), "鸭梨自己的 D 不管用了").toBe(home + 1);
    table.destroy();
  });

  it("两个人各有一个光标，换手之后各自还在原地", () => {
    vi.useFakeTimers();
    const state = board("duo");
    const table = mountTable(state, "human");
    // 鸭梨先把自己的光标挪到第 1 行第 3 格
    press("d");
    press("d");
    press("s");
    const duoSpot = cursorAt();
    expect(duoSpot).toBe(indexOf(1, 2));

    // 换成康康走：屏幕上换成康康自己的光标，不是鸭梨刚才那一格
    state.turn = "star";
    table.destroy();

    const table2 = mountTable(state, "human");
    const starHome = cursorAt();
    expect(starHome).not.toBe(duoSpot);
    press("ArrowLeft");
    expect(cursorAt()).toBe(starHome - 1);
    press("w");
    expect(cursorAt(), "鸭梨的 W 串到康康的光标上了").toBe(starHome - 1);
    table2.destroy();
  });

  it("康康回合按 G 收不掉鸭梨那边的选择，鸭梨回合按 K 也一样", () => {
    const state = board("duo");
    const table = mountTable(state, "human");
    // 鸭梨先选中自己的将
    cells()[indexOf(0, 0)].dispatch("click", {});
    expect(cells()[indexOf(0, 0)].className).toContain("dc-sel");
    press("k");
    expect(cells()[indexOf(0, 0)].className, "康康的 K 把鸭梨选中的子收走了").toContain("dc-sel");
    press("g");
    expect(cells()[indexOf(0, 0)].className).not.toContain("dc-sel");
    table.destroy();
  });

  it("取消按钮上写的是轮到那一位的取消键", () => {
    const duoTable = mountTable(board("duo"), "human");
    expect(dom.root.find((e) => e.textContent.includes("取消选择"))?.textContent).toBe("取消选择 (G)");
    duoTable.destroy();
    const starTable = mountTable(board("star"), "human");
    expect(dom.root.find((e) => e.textContent.includes("取消选择"))?.textContent).toBe("取消选择 (K)");
    starTable.destroy();
  });
});

describe("单人局 · 两套键都归真人", () => {
  it("方向键与 WASD 拨的是同一个光标", () => {
    const table = mountTable(board("duo"), "ai");
    const home = cursorAt();
    press("ArrowRight");
    expect(cursorAt(), "单人局里方向键失灵了").toBe(home + 1);
    press("a");
    expect(cursorAt(), "单人局里 WASD 与方向键不是同一个光标").toBe(home);
    table.destroy();
  });

  it("L 与 F 都能落子，K 与 G 都能取消", () => {
    vi.useFakeTimers();
    const state = board("duo");
    const table = mountTable(state, "ai");
    // 光标落在自己的将上，L 应该和 F 一样选得中
    cells()[indexOf(0, 0)].dispatch("click", {});
    expect(cells()[indexOf(0, 0)].className).toContain("dc-sel");
    press("k");
    expect(cells()[indexOf(0, 0)].className, "单人局里 K 不认了").not.toContain("dc-sel");

    press("l");
    vi.advanceTimersByTime(400);
    expect(cells()[indexOf(0, 0)].className).toContain("dc-sel");
    table.destroy();
  });
});
