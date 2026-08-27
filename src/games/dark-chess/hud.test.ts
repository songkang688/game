/**
 * 翻翻暗棋 · 顶栏的和棋倒数（QA 第 2 轮 · 包 B · 第 1 轮 L-12）。
 *
 * 连着 `QUIET_LIMIT` 手不吃不翻就判和，可这个计数以前只活在 `state.quiet` 里，
 * 屏幕上一个字都没有 —— 第 188 关那局就是这么「突然就结束了」的。
 * 这里守住：快到线才摆出来、数字随手数往下走、吃子翻子清零之后就收回去、判和之后不再挂着。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexOf, type Cell, type Color, type Kind } from "./board";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { createTable, PLY_WARN_AT, QUIET_WARN_AT } from "./index";
import { QUIET_LIMIT, makeState, type GameState } from "./rules";
import { CSS as BOARD_CSS } from "./view";

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
  const i = indexOf(r, c);
  cells[i] = { color, kind, covered };
  return i;
}

/** 一盘只剩两个将、谁都吃不着谁的残局：走一步就是一手「不吃不翻」 */
function quietBoard(quiet: number): { state: GameState; from: number } {
  const cells = blank();
  const from = place(cells, 0, 0, "red", "general");
  place(cells, 3, 7, "blue", "general");
  return {
    state: makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo", quiet }),
    from,
  };
}

function mountTable(state: GameState): { host: El; destroy: () => void } {
  const host = dom.root;
  const handle = createTable(host as unknown as HTMLElement, {
    state,
    rival: "human",
    tier: "rookie",
    showCounter: false,
    label: "测试盘",
    maxPlies: 400,
    seed: 7,
    onEnd: () => undefined,
  });
  return { host, destroy: handle.destroy };
}

function quietChip(): El | null {
  return dom.root.find((e) => e.className.includes("dc-quiet"));
}

function chipText(): string {
  const chip = quietChip();
  return chip && !chip.hidden ? chip.textContent : "";
}

describe("和棋倒数", () => {
  it("离判和还早的时候不摆出来，免得喧宾夺主", () => {
    const { state } = quietBoard(0);
    const table = mountTable(state);
    expect(quietChip()).toBeTruthy();
    expect(quietChip()?.hidden).toBe(true);
    expect(chipText()).toBe("");
    table.destroy();
  });

  it("走到还剩 8 手就把倒数摆出来，数字和 state 对得上", () => {
    const { state } = quietBoard(QUIET_LIMIT - QUIET_WARN_AT);
    const table = mountTable(state);
    expect(quietChip()?.hidden).toBe(false);
    expect(chipText()).toBe(`再 ${QUIET_WARN_AT} 手不吃不翻就算和`);
    table.destroy();
  });

  it("再走一手不吃不翻，倒数就少一个", () => {
    vi.useFakeTimers();
    const { state, from } = quietBoard(QUIET_LIMIT - QUIET_WARN_AT);
    const table = mountTable(state);
    expect(chipText()).toBe(`再 ${QUIET_WARN_AT} 手不吃不翻就算和`);

    const cells = dom.root.findAll((e) => e.className.includes("dc-cell"));
    cells[from].dispatch("click", {});
    cells[indexOf(0, 1)].dispatch("click", {});
    vi.advanceTimersByTime(400);

    expect(state.quiet).toBe(QUIET_LIMIT - QUIET_WARN_AT + 1);
    expect(chipText()).toBe(`再 ${QUIET_WARN_AT - 1} 手不吃不翻就算和`);
    table.destroy();
  });

  it("剩最后一手时写的就是「再 1 手」", () => {
    const { state } = quietBoard(QUIET_LIMIT - 1);
    const table = mountTable(state);
    expect(chipText()).toBe("再 1 手不吃不翻就算和");
    table.destroy();
  });

  it("翻一枚子把安静手数清零，倒数就收回去", () => {
    vi.useFakeTimers();
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    place(cells, 3, 7, "blue", "general");
    place(cells, 1, 1, "blue", "horse", true);
    const state = makeState(cells, {
      colors: { duo: "red", star: "blue" },
      turn: "duo",
      quiet: QUIET_LIMIT - 2,
    });
    const table = mountTable(state);
    expect(chipText()).toBe("再 2 手不吃不翻就算和");

    const board = dom.root.findAll((e) => e.className.includes("dc-cell"));
    board[indexOf(1, 1)].dispatch("click", {});
    vi.advanceTimersByTime(400);

    expect(state.quiet).toBe(0);
    expect(quietChip()?.hidden).toBe(true);
    table.destroy();
  });

  it("真判和之后倒数不再挂着，结算文案一个字没变", () => {
    let why = "";
    const { state } = quietBoard(QUIET_LIMIT);
    state.draw = true;
    const handle = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "human",
      tier: "rookie",
      showCounter: false,
      label: "测试盘",
      maxPlies: 400,
      seed: 7,
      onEnd: (r) => {
        why = r.why;
      },
    });
    expect(quietChip()?.hidden).toBe(true);
    expect(why).toBe("连着二十手不吃不翻，这一盘算平局。");
    handle.destroy();
  });

  it("倒数的提示条有自己的配色，不和「轮到谁」那一枚撞在一起", () => {
    expect(BOARD_CSS).toContain(".dc-chip.dc-quiet{");
    expect(QUIET_WARN_AT).toBeLessThan(QUIET_LIMIT);
  });
});

describe("手数上限倒数", () => {
  function capTable(maxPlies: number, plies: number, quiet = 0): { state: GameState; destroy: () => void } {
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    place(cells, 3, 7, "blue", "general");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo", quiet, plies });
    const handle = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "human",
      tier: "rookie",
      showCounter: false,
      label: "测试盘",
      maxPlies,
      seed: 7,
      onEnd: () => undefined,
    });
    return { state, destroy: handle.destroy };
  }

  function capChip(): El | null {
    return dom.root.find((e) => e.className.includes("dc-cap"));
  }

  function capText(): string {
    const chip = capChip();
    return chip && !chip.hidden ? chip.textContent : "";
  }

  it("离上限还早的时候不摆出来", () => {
    const table = capTable(60, 0);
    expect(capChip()).toBeTruthy();
    expect(capChip()?.hidden).toBe(true);
    expect(capText()).toBe("");
    table.destroy();
  });

  it("走到还剩 10 手就摆出来，数字和上限对得上", () => {
    const table = capTable(60, 60 - PLY_WARN_AT);
    expect(capText()).toBe(`再 ${PLY_WARN_AT} 手就到手数上限`);
    table.destroy();
  });

  it("再走一手，倒数就少一个", () => {
    vi.useFakeTimers();
    const table = capTable(60, 60 - PLY_WARN_AT);
    const cells = dom.root.findAll((e) => e.className.includes("dc-cell"));
    cells[indexOf(0, 0)].dispatch("click", {});
    cells[indexOf(0, 1)].dispatch("click", {});
    vi.advanceTimersByTime(400);
    expect(capText()).toBe(`再 ${PLY_WARN_AT - 1} 手就到手数上限`);
    table.destroy();
  });

  it("两条线一起逼近时只摆更紧的那一枚", () => {
    // 和棋只剩 2 手、手数上限还剩 9 手：说和棋
    const near = capTable(60, 60 - 9, QUIET_LIMIT - 2);
    expect(chipText()).toBe("再 2 手不吃不翻就算和");
    expect(capText()).toBe("");
    near.destroy();

    // 反过来：手数上限只剩 3 手、和棋还剩 8 手：说手数
    const cap = capTable(60, 60 - 3, QUIET_LIMIT - QUIET_WARN_AT);
    expect(capText()).toBe("再 3 手就到手数上限");
    expect(chipText()).toBe("");
    cap.destroy();
  });

  it("到线收场之后不再挂着，结算文案一个字没变", () => {
    let why = "";
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    place(cells, 3, 7, "blue", "general");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo", plies: 60 });
    const handle = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "human",
      tier: "rookie",
      showCounter: false,
      label: "测试盘",
      maxPlies: 60,
      seed: 7,
      onEnd: (r) => {
        why = r.why;
      },
    });
    expect(capChip()?.hidden).toBe(true);
    expect(why).toBe("手数用完啦，这一盘算平局收场。");
    handle.destroy();
  });

  it("手数倒数有自己的配色，和和棋倒数分得开", () => {
    expect(BOARD_CSS).toContain(".dc-chip.dc-cap{");
    expect(BOARD_CSS).not.toContain(".dc-chip.dc-cap{background:#EDE7FF");
    expect(PLY_WARN_AT).toBeGreaterThan(0);
  });
});
