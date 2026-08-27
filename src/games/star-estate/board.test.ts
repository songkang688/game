import { describe, expect, it } from "vitest";
import {
  BOARD,
  BOARD_LEN,
  BUYABLE_TILES,
  COLOR_GROUPS,
  GROUP_TILES,
  MAX_HOUSES,
  STATION_RENT,
  STATION_TILES,
  UTIL_MULTIPLIER,
  UTIL_TILES,
  gridCell,
  houseCostOf,
  houseSellValue,
  housesLabel,
  isBuyable,
  mortgageValue,
  sideOf,
  tileAt,
  transferFee,
  unmortgageCost
} from "./board";

describe("朵星地产 · 原创棋盘", () => {
  it("正好 40 格，格号连续，四角就位", () => {
    expect(BOARD.length).toBe(BOARD_LEN);
    BOARD.forEach((t, i) => expect(t.pos).toBe(i));
    expect(BOARD[0].kind).toBe("go");
    expect(BOARD[10].kind).toBe("rest");
    expect(BOARD[20].kind).toBe("park");
    expect(BOARD[30].kind).toBe("jail");
  });

  it("格子构成对得上：22 块地 + 4 车站 + 2 设施 + 3 机会 + 3 命运 + 2 税 + 4 角", () => {
    const count = (k: string): number => BOARD.filter((t) => t.kind === k).length;
    expect(count("prop")).toBe(22);
    expect(count("station")).toBe(4);
    expect(count("util")).toBe(2);
    expect(count("chance")).toBe(3);
    expect(count("fate")).toBe(3);
    expect(count("tax")).toBe(2);
    expect(count("go") + count("rest") + count("park") + count("jail")).toBe(4);
    expect(BUYABLE_TILES.length).toBe(28);
  });

  it("8 个色组，每组 2 或 3 块，加起来 22 块", () => {
    expect(COLOR_GROUPS.length).toBe(8);
    let sum = 0;
    for (const g of COLOR_GROUPS) {
      const tiles = GROUP_TILES[g.id];
      expect(tiles.length === 2 || tiles.length === 3, `${g.name} 应该是 2 或 3 块`).toBe(true);
      sum += tiles.length;
      expect(g.houseCost).toBeGreaterThan(0);
    }
    expect(sum).toBe(22);
  });

  it("每块地的租金表都是 6 档而且严格递增", () => {
    for (const t of BOARD) {
      if (t.kind !== "prop") continue;
      expect(t.rent, `${t.name} 缺租金表`).toBeTruthy();
      expect(t.rent!.length).toBe(MAX_HOUSES + 1);
      for (let i = 1; i < t.rent!.length; i++) {
        expect(t.rent![i], `${t.name} 第 ${i} 档没涨`).toBeGreaterThan(t.rent![i - 1]);
      }
      expect(t.price).toBeGreaterThan(0);
    }
  });

  it("越贵的色组租金越高（8 个色组的空地租金单调上升）", () => {
    const base = COLOR_GROUPS.map((g) => Math.min(...GROUP_TILES[g.id].map((p) => tileAt(p).rent?.[0] ?? 0)));
    for (let i = 1; i < base.length; i++) expect(base[i]).toBeGreaterThan(base[i - 1]);
  });

  it("车站 25/50/100/200，设施按点数 ×4 或 ×10", () => {
    expect(STATION_TILES.length).toBe(4);
    expect(STATION_RENT).toEqual([0, 25, 50, 100, 200]);
    expect(UTIL_TILES.length).toBe(2);
    expect(UTIL_MULTIPLIER).toEqual([0, 4, 10]);
  });

  it("抵押半价、赎回 110%、转手手续费 10%、拆房退一半", () => {
    const pos = 39;
    expect(tileAt(pos).price).toBe(400);
    expect(mortgageValue(pos)).toBe(200);
    expect(unmortgageCost(pos)).toBe(220);
    expect(transferFee(pos)).toBe(20);
    expect(houseCostOf(pos)).toBe(200);
    expect(houseSellValue(pos)).toBe(100);
  });

  it("tileAt 越界会绕回环线内，不会返回 undefined", () => {
    expect(tileAt(40).pos).toBe(0);
    expect(tileAt(-1).pos).toBe(39);
    expect(tileAt(83).pos).toBe(3);
    expect(isBuyable(0)).toBe(false);
    expect(isBuyable(1)).toBe(true);
    expect(isBuyable(30)).toBe(false);
  });

  it("房屋数写成中文：0 是空地，5 是大屋", () => {
    expect(housesLabel(0)).toBe("空地");
    expect(housesLabel(3)).toBe("3 栋小屋");
    expect(housesLabel(MAX_HOUSES)).toBe("大屋");
    expect(housesLabel(99)).toBe("大屋");
  });

  it("11×11 网格排布：40 个格子互不重叠，全部贴着边", () => {
    const seen = new Set<string>();
    for (let p = 0; p < BOARD_LEN; p++) {
      const { row, col } = gridCell(p);
      expect(row >= 1 && row <= 11).toBe(true);
      expect(col >= 1 && col <= 11).toBe(true);
      expect(row === 1 || row === 11 || col === 1 || col === 11).toBe(true);
      const key = `${row}-${col}`;
      expect(seen.has(key), `第 ${p} 格和别人挤在同一个位置`).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(40);
    expect(sideOf(0)).toBe(0);
    expect(sideOf(15)).toBe(1);
    expect(sideOf(25)).toBe(2);
    expect(sideOf(35)).toBe(3);
  });
});
