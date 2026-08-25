import { describe, expect, it } from "vitest";
import {
  COLS,
  DEADLINE_ROW,
  MAX_ROWS,
  R,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  crossedDeadline,
  findFloating,
  floodSameColor,
  neighbors,
  parseLayout,
  rowLength,
  settleShot,
  simulateShot,
  snapCell,
  starsForShotsLeft,
} from "./logic";
import { LEVELS } from "./levels";

describe("bubble-aim 网格", () => {
  it("偶数行 9 格、奇数行 8 格", () => {
    expect(rowLength(0)).toBe(9);
    expect(rowLength(1)).toBe(8);
    expect(rowLength(2)).toBe(9);
  });

  it("奇数行中心右移半格", () => {
    const even = cellCenter(0, 0);
    const odd = cellCenter(1, 0);
    expect(odd.x - even.x).toBeCloseTo(R);
    expect(odd.y).toBeGreaterThan(even.y);
  });

  it("六边形邻居：偶数行", () => {
    const n = neighbors(2, 4).map(([r, c]) => `${r},${c}`);
    expect(n).toContain("2,3");
    expect(n).toContain("2,5");
    expect(n).toContain("1,3");
    expect(n).toContain("1,4");
    expect(n).toContain("3,3");
    expect(n).toContain("3,4");
    expect(n).toHaveLength(6);
  });

  it("六边形邻居：奇数行", () => {
    const n = neighbors(1, 3).map(([r, c]) => `${r},${c}`);
    expect(n).toContain("0,3");
    expect(n).toContain("0,4");
    expect(n).toContain("2,3");
    expect(n).toContain("2,4");
    expect(n).toHaveLength(6);
  });

  it("边界格邻居会被裁剪", () => {
    const n = neighbors(0, 0);
    for (const [r, c] of n) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("bubble-aim 解析与连消", () => {
  it("parseLayout 校验行长并补空行", () => {
    const g = parseLayout(["RRRGGGBBB", "RRRGGBBB"]);
    expect(g.length).toBe(MAX_ROWS);
    expect(g[0][0]).toBe("R");
    expect(g[2].every((c) => c === null)).toBe(true);
    expect(() => parseLayout(["RR"])).toThrow();
  });

  it("同色连通块", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    expect(floodSameColor(g, 0, 0)).toHaveLength(3);
    expect(floodSameColor(g, 0, 4)).toHaveLength(3);
  });

  it("跨行同色也连通", () => {
    const g = parseLayout(["RRGGGGBBB", "RRGGGBBB"]);
    // (0,0)(0,1)(1,0)(1,1) 四个 R 连成一块
    expect(floodSameColor(g, 0, 0)).toHaveLength(4);
  });

  it("消 3 个：settleShot 弹出同色块", () => {
    const g = parseLayout(["RRGGGGBBB"]);
    // 在 (1,0) 补一个 R → R 有 3 个 → 全消
    g[1][0] = "R";
    const result = settleShot(g, 1, 0);
    expect(result.popped).toHaveLength(3);
    expect(g[0][0]).toBeNull();
    expect(g[1][0]).toBeNull();
  });

  it("只有 2 个同色不消", () => {
    const g = parseLayout(["RRGGGGBBB"]);
    const result = settleShot(g, 0, 0);
    expect(result.popped).toHaveLength(0);
    expect(g[0][0]).toBe("R");
  });

  it("悬空的泡泡跟着掉落", () => {
    const g = parseLayout([
      "GGG......",
      "RR......",
      "BB.......",
    ]);
    // B 挂在 R 下面，R 挂在 G 下面；补一个 R 消掉 R 后，B 悬空掉落
    g[1][2] = "R";
    const result = settleShot(g, 1, 2);
    expect(result.popped).toHaveLength(3);
    expect(result.dropped.map((d) => d.color)).toEqual(["B", "B"]);
    expect(countBubbles(g)).toBe(3); // 只剩 3 个 G
  });

  it("findFloating 找到断开的块", () => {
    const g = parseLayout(["R........"]);
    g[3][4] = "B";
    const floating = findFloating(g);
    expect(floating).toContainEqual([3, 4]);
  });

  it("colorsInGrid 只报告在场颜色", () => {
    const g = parseLayout(["RRGG....."]);
    const colors = colorsInGrid(g).sort();
    expect(colors).toEqual(["G", "R"]);
  });
});

describe("bubble-aim 弹道", () => {
  it("直射向上会打到顶或泡泡", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const result = simulateShot(g, W / 2, 440, 0, -1);
    expect(result.landing).not.toBeNull();
    // 直射中间应落在第 1 行附近（贴着 G 下面）
    expect(result.landing!.r).toBeLessThanOrEqual(2);
  });

  it("斜射碰墙反弹，路径出现折点且不出界", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    // 很平的角度往右上打 → 必定撞右墙反弹
    const result = simulateShot(g, W / 2, 440, 0.96, -0.28);
    expect(result.path.length).toBeGreaterThan(2);
    for (const p of result.path) {
      expect(p.x).toBeGreaterThanOrEqual(R - 0.01);
      expect(p.x).toBeLessThanOrEqual(W - R + 0.01);
    }
    expect(result.landing).not.toBeNull();
  });

  it("落位一定是贴着泡泡或顶行的空格", () => {
    const g = parseLayout(["RRRGGGBBB", "RRRGGBBB"]);
    const result = simulateShot(g, W / 2, 440, 0.3, -0.9);
    const landing = result.landing!;
    expect(g[landing.r][landing.c]).toBeNull();
    const anchored =
      landing.r === 0 ||
      neighbors(landing.r, landing.c).some(([r, c]) => g[r][c] !== null);
    expect(anchored).toBe(true);
  });

  it("snapCell 空网格吸附到顶行", () => {
    const g = parseLayout(["........."]);
    const cell = snapCell(g, W / 2, 20)!;
    expect(cell.r).toBe(0);
  });
});

describe("bubble-aim 胜负与星级", () => {
  it("crossedDeadline", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    expect(crossedDeadline(g)).toBe(false);
    g[DEADLINE_ROW][0] = "R";
    expect(crossedDeadline(g)).toBe(true);
  });

  it("starsForShotsLeft 阈值", () => {
    expect(starsForShotsLeft(10, 20)).toBe(3);
    expect(starsForShotsLeft(8, 20)).toBe(3);
    expect(starsForShotsLeft(4, 20)).toBe(2);
    expect(starsForShotsLeft(1, 20)).toBe(1);
    expect(starsForShotsLeft(0, 0)).toBe(1);
  });
});

describe("bubble-aim 关卡数据", () => {
  it("至少 5 关且布局都合法", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
    for (const lv of LEVELS) {
      expect(() => parseLayout(lv.layout)).not.toThrow();
      expect(lv.shots).toBeGreaterThan(0);
    }
  });

  it("开局没有悬空泡泡", () => {
    for (const lv of LEVELS) {
      const g = parseLayout(lv.layout);
      expect(findFloating(g)).toHaveLength(0);
    }
  });

  it("每关布局不同且泡泡数合理", () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      const key = lv.layout.join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const g = parseLayout(lv.layout);
      const n = countBubbles(g);
      expect(n).toBeGreaterThanOrEqual(15);
      // 子弹数要够消完（每 3 个泡泡至少 1 发，再留余量）
      expect(lv.shots).toBeGreaterThan(n / 3);
    }
  });

  it("布局不会一开局就越线", () => {
    for (const lv of LEVELS) {
      expect(crossedDeadline(parseLayout(lv.layout))).toBe(false);
    }
  });

  it("布局宽度不超过列数", () => {
    for (const lv of LEVELS) {
      lv.layout.forEach((row, r) => {
        expect(row.length).toBe(r % 2 === 0 ? COLS : COLS - 1);
      });
    }
  });
});
