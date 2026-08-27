import { describe, expect, it } from "vitest";
import { COLS, COUNT, KINDS, RANK, dealCovered, indexOf, type Cell, type Color, type Kind } from "./board";
import {
  CANNON_CAN_TAKE_COVERED,
  QUIET_LIMIT,
  SOLDIER_BEATS_GENERAL,
  applyAction,
  canCapture,
  cannonCaptures,
  coveredCount,
  firstFlipColor,
  legalActions,
  makeState,
  movesFrom,
  mustFlip,
  newGame,
  remainingUnknown,
  status,
  stepMoves,
} from "./rules";

function blank(): Cell[] {
  return new Array(32).fill(null);
}

function place(cells: Cell[], r: number, c: number, color: Color, kind: Kind, covered = false): number {
  const i = indexOf(r, c);
  cells[i] = { color, kind, covered };
  return i;
}

describe("翻翻暗棋 · 发盘", () => {
  it("32 格全部盖着，红蓝各 16 枚，兵种数量对得上", () => {
    const cells = dealCovered(1234);
    expect(cells.length).toBe(32);
    expect(cells.every((c) => c !== null && c.covered)).toBe(true);
    for (const color of ["red", "blue"] as Color[]) {
      const mine = cells.filter((c) => c && c.color === color);
      expect(mine.length).toBe(16);
      for (const kind of KINDS) {
        expect(mine.filter((c) => c && c.kind === kind).length).toBe(COUNT[kind]);
      }
    }
  });

  it("同一个 seed 洗出来的盘面完全一样，换 seed 就不一样", () => {
    const a = dealCovered(77).map((c) => `${c?.color}${c?.kind}`).join(",");
    const b = dealCovered(77).map((c) => `${c?.color}${c?.kind}`).join(",");
    const c = dealCovered(78).map((x) => `${x?.color}${x?.kind}`).join(",");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("翻翻暗棋 · 第一手与定阵营", () => {
  it("第一手只能翻子：走子动作一个都不给", () => {
    const state = newGame(9);
    expect(mustFlip(state)).toBe(true);
    const acts = legalActions(state, "duo");
    expect(acts.length).toBe(32);
    expect(acts.every((a) => a.type === "flip")).toBe(true);
  });

  it("翻到什么颜色，翻的人就是那一色，另一色归对方", () => {
    const cells = blank();
    place(cells, 0, 0, "blue", "horse", true);
    const state = makeState(cells);
    expect(firstFlipColor(state, indexOf(0, 0))).toBe("blue");
    applyAction(state, { type: "flip", at: indexOf(0, 0) });
    expect(state.colors.duo).toBe("blue");
    expect(state.colors.star).toBe("red");
  });

  it("第一手翻到「将」也合法，照样定阵营", () => {
    const cells = blank();
    place(cells, 1, 1, "red", "general", true);
    place(cells, 3, 7, "blue", "general", true);
    const state = makeState(cells);
    const res = applyAction(state, { type: "flip", at: indexOf(1, 1) });
    expect(res.ok).toBe(true);
    expect(res.revealed?.kind).toBe("general");
    expect(state.colors.duo).toBe("red");
    expect(state.winner).toBe(null);
  });
});

describe("翻翻暗棋 · 走子与相克", () => {
  it("只走一格正交，不能斜走", () => {
    const cells = blank();
    const from = place(cells, 1, 3, "red", "chariot");
    const moves = stepMoves(cells, from);
    expect(moves.sort()).toEqual([indexOf(0, 3), indexOf(1, 2), indexOf(1, 4), indexOf(2, 3)].sort());
    expect(moves).not.toContain(indexOf(0, 2));
    expect(moves).not.toContain(indexOf(2, 4));
  });

  it("不能吃盖着的子", () => {
    const cells = blank();
    const from = place(cells, 1, 3, "red", "general");
    place(cells, 1, 4, "blue", "soldier", true);
    expect(stepMoves(cells, from)).not.toContain(indexOf(1, 4));
  });

  it("相克表：大的能吃小的，小的吃不了大的", () => {
    const big: Kind[] = ["general", "guard", "elephant", "chariot", "horse"];
    for (let i = 0; i < big.length - 1; i++) {
      const hi = { color: "red" as Color, kind: big[i], covered: false };
      const lo = { color: "blue" as Color, kind: big[i + 1], covered: false };
      expect(canCapture(hi, lo)).toBe(true);
      expect(canCapture(lo, hi)).toBe(false);
      expect(RANK[big[i]]).toBeGreaterThan(RANK[big[i + 1]]);
    }
  });

  it("同级可以互吃", () => {
    const a = { color: "red" as Color, kind: "horse" as Kind, covered: false };
    const b = { color: "blue" as Color, kind: "horse" as Kind, covered: false };
    expect(canCapture(a, b)).toBe(true);
    expect(canCapture(b, a)).toBe(true);
  });

  it("兵能请将去休息，将请不动兵", () => {
    expect(SOLDIER_BEATS_GENERAL).toBe(true);
    const soldier = { color: "red" as Color, kind: "soldier" as Kind, covered: false };
    const general = { color: "blue" as Color, kind: "general" as Kind, covered: false };
    expect(canCapture(soldier, general)).toBe(true);
    expect(canCapture(general, soldier)).toBe(false);
  });

  it("不能吃自己的子", () => {
    const a = { color: "red" as Color, kind: "general" as Kind, covered: false };
    const b = { color: "red" as Color, kind: "soldier" as Kind, covered: false };
    expect(canCapture(a, b)).toBe(false);
  });
});

describe("翻翻暗棋 · 炮", () => {
  it("隔恰好一个子才吃得到", () => {
    const cells = blank();
    const from = place(cells, 0, 0, "red", "cannon");
    place(cells, 0, 1, "blue", "horse"); // 炮架
    place(cells, 0, 2, "blue", "chariot"); // 目标
    expect(cannonCaptures(cells, from)).toContain(indexOf(0, 2));
  });

  it("中间隔两个就吃不到", () => {
    const cells = blank();
    const from = place(cells, 0, 0, "red", "cannon");
    place(cells, 0, 1, "blue", "horse");
    place(cells, 0, 2, "red", "horse");
    place(cells, 0, 3, "blue", "chariot");
    expect(cannonCaptures(cells, from)).not.toContain(indexOf(0, 3));
  });

  it("贴身（中间没有炮架）吃不到", () => {
    const cells = blank();
    const from = place(cells, 0, 0, "red", "cannon");
    place(cells, 0, 1, "blue", "chariot");
    expect(cannonCaptures(cells, from)).not.toContain(indexOf(0, 1));
    expect(stepMoves(cells, from)).not.toContain(indexOf(0, 1));
  });

  it("炮架可以是盖着的子，但落点必须是已经翻开的敌子", () => {
    expect(CANNON_CAN_TAKE_COVERED).toBe(false);
    const cells = blank();
    const from = place(cells, 0, 0, "red", "cannon");
    place(cells, 0, 1, "blue", "horse", true); // 盖着也能当炮架
    place(cells, 0, 2, "blue", "chariot");
    expect(cannonCaptures(cells, from)).toContain(indexOf(0, 2));

    const covered = blank();
    const f2 = place(covered, 0, 0, "red", "cannon");
    place(covered, 0, 1, "blue", "horse");
    place(covered, 0, 2, "blue", "chariot", true);
    expect(cannonCaptures(covered, f2)).not.toContain(indexOf(0, 2));
  });

  it("炮走路那一步不能吃子，只能挪到空格", () => {
    const cells = blank();
    const from = place(cells, 1, 1, "red", "cannon");
    place(cells, 1, 2, "blue", "soldier");
    const steps = stepMoves(cells, from);
    expect(steps).not.toContain(indexOf(1, 2));
    expect(steps).toContain(indexOf(0, 1));
  });

  it("炮不能隔着子吃自己人", () => {
    const cells = blank();
    const from = place(cells, 2, 0, "red", "cannon");
    place(cells, 2, 1, "blue", "horse");
    place(cells, 2, 2, "red", "chariot");
    expect(cannonCaptures(cells, from)).not.toContain(indexOf(2, 2));
  });

  it("炮的全部落点 = 一步空格 + 隔子吃", () => {
    const cells = blank();
    const from = place(cells, 0, 0, "red", "cannon");
    place(cells, 0, 1, "blue", "horse");
    place(cells, 0, 4, "blue", "chariot");
    const all = movesFrom(cells, from);
    expect(all).toContain(indexOf(1, 0));
    expect(all).toContain(indexOf(0, 4));
    expect(all).not.toContain(indexOf(0, 1));
  });
});

describe("翻翻暗棋 · 胜负与和棋", () => {
  it("把对方的将请去休息就赢（兵吃将）", () => {
    const cells = blank();
    const from = place(cells, 0, 0, "red", "soldier");
    place(cells, 0, 1, "blue", "general");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" });
    applyAction(state, { type: "move", from, to: indexOf(0, 1) });
    expect(status(state)).toEqual({ kind: "win", side: "duo" });
  });

  it("对方既没子可动也没盖子可翻就判负", () => {
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    place(cells, 3, 7, "blue", "general");
    // 蓝将被两枚红兵和边界围死（将请不动兵），红方走一步之后蓝方无路可走
    place(cells, 2, 7, "red", "soldier");
    place(cells, 3, 6, "red", "soldier");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" });
    applyAction(state, { type: "move", from: indexOf(0, 0), to: indexOf(0, 1) });
    expect(state.winner).toBe("duo");
  });

  it("连续 20 手不吃不翻判平局", () => {
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    place(cells, 3, 7, "blue", "general");
    const state = makeState(cells, {
      colors: { duo: "red", star: "blue" },
      turn: "duo",
      quiet: QUIET_LIMIT - 1,
    });
    applyAction(state, { type: "move", from: indexOf(0, 0), to: indexOf(0, 1) });
    expect(state.draw).toBe(true);
    expect(status(state)).toEqual({ kind: "draw" });
  });

  it("翻子会把「安静手数」清零", () => {
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    place(cells, 3, 7, "blue", "general");
    place(cells, 1, 1, "blue", "horse", true);
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo", quiet: 12 });
    applyAction(state, { type: "flip", at: indexOf(1, 1) });
    expect(state.quiet).toBe(0);
  });
});

describe("翻翻暗棋 · 合法手与记牌", () => {
  it("不能走对方的子", () => {
    const cells = blank();
    place(cells, 0, 0, "red", "general");
    const from = place(cells, 2, 2, "blue", "chariot");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" });
    const res = applyAction(state, { type: "move", from, to: indexOf(2, 3) });
    expect(res.ok).toBe(false);
    expect(state.plies).toBe(0);
  });

  it("记牌面板数得清还盖着哪些子", () => {
    const state = newGame(31);
    const left = remainingUnknown(state);
    expect(left.red.soldier).toBe(COUNT.soldier);
    expect(coveredCount(state)).toBe(32);
    applyAction(state, { type: "flip", at: 0 });
    expect(coveredCount(state)).toBe(31);
  });

  it("盘面越走越空：走一步之后原来那一格变成空格", () => {
    const cells = blank();
    const from = place(cells, 1, 1, "red", "horse");
    place(cells, 3, 7, "blue", "general");
    place(cells, 0, 0, "red", "general");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" });
    applyAction(state, { type: "move", from, to: indexOf(1, 2) });
    expect(state.cells[from]).toBe(null);
    expect(state.cells[indexOf(1, 2)]?.kind).toBe("horse");
  });

  it("棋盘是 4 行 8 列", () => {
    expect(COLS).toBe(8);
    expect(dealCovered(1).length).toBe(32);
  });
});
