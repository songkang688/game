/**
 * 1.2：尺寸无关的棋盘核心。
 * 闯关的 8×8 和对战的 6×6 走的是同一套匹配 / 压实 / 补块，
 * 所以这里的断言对两块盘都成立。特殊块与挡板也在这儿定规矩。
 */
import { describe, expect, it } from "vitest";
import {
  BOMB,
  EMPTY,
  PLAIN,
  RAINBOW,
  ROCKET_H,
  ROCKET_V,
  bestHintSwap,
  blastCells,
  columnSegments,
  findMatchesOn,
  holesOn,
  legalSwapsOn,
  makeCellset,
  matchesAtOn,
  nextBlastWave,
  refillOn,
  rewardAt,
  rotateSlots,
  runsOn,
  settleOn,
  shuffleLine,
  shuffleOn,
  specialOf,
  stuckHintLine,
  swapAreaWords,
  type Cellset,
} from "./board";
import { mulberry32 } from "../level99";

const C = 6;
const R = 6;

function grid(rowsText: string[]): number[] {
  return rowsText.join("").split("").map((ch) => (ch === "." ? EMPTY : Number(ch)));
}

describe("匹配", () => {
  it("横竖三连都认，两连不认", () => {
    const g = grid([
      "010101",
      "101010",
      "010101",
      "101010",
      "010101",
      "101010",
    ]);
    expect(findMatchesOn(g, C, R).size).toBe(0);
    g[0] = 1; g[1] = 1; g[2] = 1; g[3] = 0;
    expect(findMatchesOn(g, C, R).size).toBe(3);
    expect(matchesAtOn(g, C, R, 1)).toBe(true);
    expect(matchesAtOn(g, C, R, 5)).toBe(false);
  });

  it("空格与彩虹星不参与三连", () => {
    const g = new Array<number>(C * R).fill(EMPTY);
    expect(findMatchesOn(g, C, R).size).toBe(0);
    g[0] = RAINBOW; g[1] = RAINBOW; g[2] = RAINBOW;
    expect(findMatchesOn(g, C, R).size).toBe(0);
  });
});

describe("压实与补块（拆成两步才有动画可言）", () => {
  it("压实只挪不补：空洞留在顶上", () => {
    const g = new Array<number>(C * R).fill(EMPTY);
    g[0] = 1; g[C * 3] = 2;
    settleOn(g, C, R);
    expect(g[C * 5]).toBe(2);
    expect(g[C * 4]).toBe(1);
    expect(g.filter((v) => v === EMPTY)).toHaveLength(C * R - 2);
  });

  it("补块按「列 0→末列、每列自下而上」取数，顺序是确定的", () => {
    const g = new Array<number>(C * R).fill(EMPTY);
    let n = 0;
    refillOn(g, C, R, () => n++);
    // 第 0 列最底下那格拿到第 0 个数，第 1 列最底下那格拿到第 6 个数
    expect(g[(R - 1) * C + 0]).toBe(0);
    expect(g[0]).toBe(R - 1);
    expect(g[(R - 1) * C + 1]).toBe(R);
    expect(n).toBe(C * R);
  });

  it("压实 + 补块之后盘面不留空洞", () => {
    const g = new Array<number>(C * R).fill(3);
    for (let i = 0; i < 8; i++) g[i] = EMPTY;
    settleOn(g, C, R);
    expect(holesOn(g, C, R)).toBe(8);
    refillOn(g, C, R, () => 1);
    expect(holesOn(g, C, R)).toBe(0);
  });
});

describe("挡板：挡住下落，底下补不进新块", () => {
  const solid = new Array<boolean>(C * R).fill(false);
  solid[2 * C] = true;

  it("挡板把一列切成上下两段，只有顶上那段接得住新块", () => {
    const segs = columnSegments(C, R, 0, { solid });
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ rows: [5, 4, 3], open: false });
    expect(segs[1]).toEqual({ rows: [1, 0], open: true });
  });

  it("上面的星星落不过挡板，挡板底下空着就空着", () => {
    const g = new Array<number>(C * R).fill(EMPTY);
    g[0] = 7;
    settleOn(g, C, R, { solid });
    expect(g[C]).toBe(7);
    expect(g[C * 5]).toBe(EMPTY);
    refillOn(g, C, R, () => 1, { solid });
    // 顶上那段补满了，挡板底下三格还是空的
    expect(g[0]).toBe(1);
    expect(g[C * 3]).toBe(EMPTY);
    expect(g[C * 5]).toBe(EMPTY);
  });

  it("没有挡板时整列就是一段，行为和 1.1 完全一致", () => {
    expect(columnSegments(C, R, 1, { solid })).toEqual([{ rows: [5, 4, 3, 2, 1, 0], open: true }]);
  });
});

describe("特殊块：4 连火箭、5 连彩虹、L/T 炸弹", () => {
  it("横 4 连留横向火箭，竖 4 连留纵向火箭", () => {
    const g = new Array<number>(C * R).fill(EMPTY);
    g[0] = 1; g[1] = 1; g[2] = 1; g[3] = 1;
    expect(rewardAt(runsOn(g, C, R), 1)).toBe("rocketH");
    const v = new Array<number>(C * R).fill(EMPTY);
    for (let r = 0; r < 4; r++) v[r * C] = 2;
    expect(rewardAt(runsOn(v, C, R), C)).toBe("rocketV");
  });

  it("5 连留彩虹星，L / T 形留炸弹，三连什么都不留", () => {
    const five = new Array<number>(C * R).fill(EMPTY);
    for (let c = 0; c < 5; c++) five[c] = 3;
    expect(rewardAt(runsOn(five, C, R), 2)).toBe("rainbow");

    // L 形：一横三 + 一竖三 交在左上角
    const l = new Array<number>(C * R).fill(EMPTY);
    l[0] = 4; l[1] = 4; l[2] = 4; l[C] = 4; l[2 * C] = 4;
    expect(rewardAt(runsOn(l, C, R), 0)).toBe("bomb");

    const three = new Array<number>(C * R).fill(EMPTY);
    three[0] = 1; three[1] = 1; three[2] = 1;
    expect(rewardAt(runsOn(three, C, R), 0)).toBe("none");
    expect(specialOf("none")).toBe(PLAIN);
    expect(specialOf("bomb")).toBe(BOMB);
  });

  it("引爆范围：火箭清整行 / 整列，炸弹清周围 3×3", () => {
    expect(blastCells(C, R, 2 * C + 2, ROCKET_H)).toHaveLength(C);
    expect(blastCells(C, R, 2 * C + 2, ROCKET_V)).toHaveLength(R);
    expect(blastCells(C, R, 2 * C + 2, BOMB)).toHaveLength(9);
    // 贴边的炸弹只炸得到棋盘里的那几格
    expect(blastCells(C, R, 0, BOMB)).toHaveLength(4);
  });

  it("引爆只给出「下一波」，绝不自己连炸到底", () => {
    const s = makeCellset(C, R, 1);
    s.special[0] = ROCKET_H;
    const done = new Set<number>([0]);
    const wave = nextBlastWave(s, [0], done);
    expect(wave.size).toBe(C - 1);
    // 已经清过的格子不会再被点第二次
    expect(wave.has(0)).toBe(false);
  });
});

describe("传送带与候选交换", () => {
  it("整行循环平移一格，图案一个不多一个不少", () => {
    const g = [0, 1, 2, 3, 4, 5];
    const sp = new Array<number>(6).fill(PLAIN);
    rotateSlots(g, sp, [0, 1, 2, 3, 4, 5], 1);
    expect(g).toEqual([5, 0, 1, 2, 3, 4]);
    rotateSlots(g, sp, [0, 1, 2, 3, 4, 5], -1);
    expect(g).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("候选交换只列出「换了真能消」的，锁住的格子一律不列", () => {
    const s = makeCellset(C, R, 0);
    for (let i = 0; i < s.grid.length; i++) s.grid[i] = (Math.floor(i / C) + i) % 3;
    const swaps = legalSwapsOn(s);
    for (const [a, b] of swaps) {
      [s.grid[a], s.grid[b]] = [s.grid[b], s.grid[a]];
      const ok =
        matchesAtOn(s.grid, C, R, a) || matchesAtOn(s.grid, C, R, b) ||
        s.grid[a] === RAINBOW || s.grid[b] === RAINBOW || !!s.special[a] || !!s.special[b];
      [s.grid[a], s.grid[b]] = [s.grid[b], s.grid[a]];
      expect(ok).toBe(true);
    }
    s.solid[0] = true;
    expect(legalSwapsOn(s).some(([a, b]) => a === 0 || b === 0)).toBe(false);
  });
});

describe("死局洗牌", () => {
  /** 一块一步都消不动的 6×6：每格的图案只看行号，横竖都换不出三连 */
  function deadBoard(): Cellset {
    const s = makeCellset(C, R, 0);
    for (let i = 0; i < s.grid.length; i++) s.grid[i] = (Math.floor(i / C) * 2 + (i % C)) % 4;
    return s;
  }

  it("死局是真的死局：一步合法交换都列不出来", () => {
    const s = deadBoard();
    expect(findMatchesOn(s.grid, C, R).size).toBe(0);
    expect(legalSwapsOn(s)).toHaveLength(0);
  });

  it("洗完既没有现成三连，又至少有一步能消", () => {
    const s = deadBoard();
    expect(shuffleOn(s, mulberry32(9))).toBe(true);
    expect(findMatchesOn(s.grid, C, R).size).toBe(0);
    expect(legalSwapsOn(s).length).toBeGreaterThan(0);
  });

  it("洗牌只重排、不发牌：每种图案的个数一颗不差", () => {
    const s = deadBoard();
    const tally = (g: number[]): Record<number, number> => {
      const t: Record<number, number> = {};
      for (const v of g) t[v] = (t[v] ?? 0) + 1;
      return t;
    };
    const before = tally(s.grid);
    shuffleOn(s, mulberry32(3));
    expect(tally(s.grid)).toEqual(before);
  });

  it("挡板和冰块留在原地不参与洗牌", () => {
    const s = deadBoard();
    s.solid[7] = true;
    s.fixed[20] = true;
    const keptSolid = s.grid[7];
    const keptFixed = s.grid[20];
    shuffleOn(s, mulberry32(11));
    expect(s.grid[7]).toBe(keptSolid);
    expect(s.grid[20]).toBe(keptFixed);
  });

  it("能动的格子不够三个就不瞎洗，原样退回 false", () => {
    const s = makeCellset(C, R, 0);
    s.grid.fill(EMPTY);
    s.grid[0] = 1;
    s.grid[1] = 2;
    expect(shuffleOn(s, mulberry32(1))).toBe(false);
    expect(s.grid[0]).toBe(1);
  });

  it("死局里不抢洗牌的话：指路函数一句都不说", () => {
    const s = deadBoard();
    expect(bestHintSwap(s)).toBeNull();
    expect(stuckHintLine(s)).toBe("");
  });

  it("洗不出来也得说一句，不能让盘面静悄悄地卡住", () => {
    const ok = shuffleLine(true);
    const failed = shuffleLine(false);
    expect(ok).not.toBe(failed);
    expect(ok).toContain("洗");
    expect(failed).toContain("重来");
    // 洗不出来不是孩子的错，文案里不许有责怪的话
    for (const bad of ["你输了", "失败", "笨"]) expect(failed).not.toContain(bad);
  });
});

describe("卡壳指路（还有一步能消、就是找不着）", () => {
  /** 换一步就能连出三颗的 6×6 */
  function liveBoard(): Cellset {
    const s = makeCellset(C, R, 0);
    s.grid = grid([
      "112211",
      "221122",
      "112211",
      "221122",
      "112211",
      "221122",
    ]);
    return s;
  }

  it("挑出来的那一步一定在合法交换里，而且换了真能消", () => {
    const s = liveBoard();
    const sw = bestHintSwap(s);
    expect(sw).not.toBeNull();
    const swaps = legalSwapsOn(s);
    expect(swaps.some(([a, b]) => a === sw!.a && b === sw!.b)).toBe(true);
    [s.grid[sw!.a], s.grid[sw!.b]] = [s.grid[sw!.b], s.grid[sw!.a]];
    expect(matchesAtOn(s.grid, C, R, sw!.a) || matchesAtOn(s.grid, C, R, sw!.b)).toBe(true);
  });

  it("只看不动：算完之后盘面一格都没变", () => {
    const s = liveBoard();
    const before = s.grid.slice();
    const beforeSp = s.special.slice();
    bestHintSwap(s);
    stuckHintLine(s);
    expect(s.grid).toEqual(before);
    expect(s.special).toEqual(beforeSp);
  });

  it("同一个盘面永远挑到同一步（消得一样多时取枚举里最靠前的）", () => {
    const a = bestHintSwap(liveBoard());
    const b = bestHintSwap(liveBoard());
    expect(a).toEqual(b);
  });

  it("彩虹星那一步收成最大，就该挑它", () => {
    const s = liveBoard();
    // 盘面右下角塞一颗彩虹星：和谁换都清掉全场那种图案
    const at = (R - 1) * C + (C - 1);
    s.grid[at] = RAINBOW;
    const sw = bestHintSwap(s);
    expect(sw).not.toBeNull();
    expect(sw!.a === at || sw!.b === at).toBe(true);
    expect(sw!.cleared).toBeGreaterThan(5);
  });

  it("指路只说方位，一个行号列号都不报", () => {
    const s = liveBoard();
    const line = stuckHintLine(s);
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toMatch(/\d/);
    // 也不许直接把答案说破
    for (const bad of ["行", "列", "第"]) expect(line).not.toContain(bad);
  });

  it("九片方位词里都不带「行 / 列 / 第」", () => {
    const s = makeCellset(C, R, 0);
    for (let i = 0; i < s.grid.length; i++) {
      const word = swapAreaWords(s, i);
      for (const bad of ["行", "列", "第"]) expect(word).not.toContain(bad);
    }
  });

  it("消得多的那一步换一句更来劲的话", () => {
    const s = liveBoard();
    const at = (R - 1) * C + (C - 1);
    s.grid[at] = RAINBOW;
    expect(stuckHintLine(s)).toContain("一步大的");
  });

  it("方位词把盘面切成九片，四角说得各不一样", () => {
    const s = makeCellset(C, R, 0);
    const corners = [0, C - 1, (R - 1) * C, R * C - 1];
    const words = corners.map((i) => swapAreaWords(s, i));
    expect(new Set(words).size).toBe(4);
    expect(words[0]).toContain("上边");
    expect(words[0]).toContain("靠左");
    expect(words[3]).toContain("下边");
    expect(words[3]).toContain("靠右");
    expect(swapAreaWords(s, Math.floor(R / 2) * C + Math.floor(C / 2))).toBe("盘面正中间");
  });
});
