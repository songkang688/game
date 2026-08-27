/**
 * 窗口 4 · 档B · 第 2 轮学习优化员 —— 泡泡噗噗
 *
 * 落地 B2-04：泡泡海第 18 推之后接着变紧，后段还会来「大潮」。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  SEA_BIG_TIDE_FROM,
  SEA_PUSH_FLOOR_MS,
  SEA_ROWS,
  SEA_TIGHTEN_CAP,
  pushUpRow,
  seaColors,
  seaPushMs,
  seaTideRows,
} from "./collapse";
import { BOARD_COLS } from "./levels";

const COLS = BOARD_COLS;

describe("档B R2 学习优化员 · 泡泡噗噗 · 泡泡海封顶之后还在走", () => {
  it("第 18 推之前那条坡一个数都没动", () => {
    expect(seaPushMs(0)).toBe(6500);
    expect(seaPushMs(10)).toBe(4300);
    expect(seaPushMs(SEA_TIGHTEN_CAP)).toBe(2600);
    for (let n = 0; n < SEA_BIG_TIDE_FROM; n++) expect(seaTideRows(n)).toBe(1);
  });

  it("第 18 推之后换一段更缓的坡接着紧，走到 1.8 秒稳住", () => {
    // 改之前：seaPushMs 第 18 推封在 2600ms，第 200 推和第 18 推是同一件事
    expect(seaPushMs(SEA_TIGHTEN_CAP + 1)).toBeLessThan(2600);
    expect(seaPushMs(40)).toBeLessThan(seaPushMs(25));
    expect(seaPushMs(999)).toBe(SEA_PUSH_FLOOR_MS);
    // 一路只紧不松
    for (let n = 1; n <= 400; n++) {
      expect(seaPushMs(n), `第 ${n} 推比上一推还松`).toBeLessThanOrEqual(seaPushMs(n - 1));
      expect(seaPushMs(n)).toBeGreaterThanOrEqual(SEA_PUSH_FLOOR_MS);
    }
  });

  it("后段的「大潮」一次涨两行，而且越到后面来得越勤", () => {
    expect(seaTideRows(SEA_BIG_TIDE_FROM)).toBe(2);
    const density = (from: number): number => {
      let big = 0;
      for (let i = 0; i < 60; i++) if (seaTideRows(from + i) === 2) big++;
      return big;
    };
    expect(density(200)).toBeGreaterThan(density(SEA_BIG_TIDE_FROM));
  });

  it("大潮不会连着来：任意三推里最多一次", () => {
    for (let n = 0; n <= 400 - 3; n++) {
      let big = 0;
      for (let i = 0; i < 3; i++) if (seaTideRows(n + i) === 2) big++;
      expect(big, `第 ${n} 推起连着三推来了 ${big} 次大潮`).toBeLessThanOrEqual(1);
    }
  });

  it("大潮把结算提前了，但不会一上来就把人顶穿", () => {
    // 空盘从头涨潮：算上大潮，撑得到的推数应当比只涨一行少，但仍旧要涨够 SEA_ROWS 行
    let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
    const rand = mulberry32(20260827);
    let pushes = 0;
    let rowsUp = 0;
    let overflowed = false;
    while (!overflowed && pushes < 200) {
      for (let i = 0; i < seaTideRows(pushes) && !overflowed; i++) {
        const res = pushUpRow(grid, COLS, seaColors(pushes), rand);
        grid = res.grid;
        overflowed = res.overflow;
        if (!overflowed) rowsUp++;
      }
      if (!overflowed) pushes++;
    }
    expect(overflowed, "一直不消居然也顶不穿").toBe(true);
    expect(rowsUp, "还没涨满一屏就判顶穿了").toBeGreaterThanOrEqual(SEA_ROWS - 1);
  });
});
