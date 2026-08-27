import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { LEVELS } from "./levels";
import { EMPTY, STONE, countLeftOn, groupAt, hasMovesOn } from "./logic";
import {
  BIG_GROUP,
  CHAIN,
  FALL_MS_PER_CELL,
  FALL_STAGGER_MS,
  POP_MS,
  REDUCED_FRAME_MS,
  SEA_BIG_TIDE_FROM,
  SEA_BIG_TIDE_MIN_EVERY,
  SEA_PUSH_FLOOR_MS,
  SEA_ROWS,
  SEA_TIGHTEN_CAP,
  SHIFT_MS,
  blowShuffle,
  chainBlast,
  chainRing,
  groupScore,
  isChain,
  isDeadlock,
  movingCount,
  phaseAt,
  planCollapse,
  previewLabel,
  pushUpRow,
  seaColors,
  seaLine,
  seaPushMs,
  seaTideRows,
  thawFrozen,
  visualColAt,
  visualRowAt,
} from "./collapse";

const COLS = 4;

/** 用字符画摆一个小盘面：`.` = 空，数字 = 颜色 */
function board(rows: string[]): number[][] {
  return rows.map((row) => row.split("").map((ch) => (ch === "." ? EMPTY : Number(ch))));
}

describe("泡泡噗噗 · 塌陷时间线", () => {
  it("三段时间线按 消除 → 下落 → 左移 排好,同列相邻错峰", () => {
    const grid = board(["0123", "....", "0123"]);
    const plan = planCollapse(grid, COLS, false);
    expect(plan.popMs).toBe(POP_MS);
    expect(plan.fallStartMs).toBe(POP_MS);
    expect(plan.fallEndMs).toBeGreaterThan(plan.fallStartMs);
    expect(plan.shiftStartMs).toBe(plan.fallEndMs);
    expect(plan.falls).toHaveLength(4);
    for (const f of plan.falls) {
      expect(f.durMs).toBe(Math.abs(f.toR - f.fromR) * FALL_MS_PER_CELL);
      expect(f.delayMs % FALL_STAGGER_MS).toBe(0);
    }
  });

  it("每一列各自压实,落定的盘面就是逻辑终态", () => {
    const grid = board(["01.3", "....", "2.13"]);
    const plan = planCollapse(grid, COLS, false);
    expect(plan.next[2]).toEqual([2, 1, 1, 3]);
    expect(plan.next[1]).toEqual([0, EMPTY, EMPTY, 3]);
    expect(countLeftOn(plan.next)).toBe(countLeftOn(grid));
  });

  it("重力翻面时改往上压", () => {
    const grid = board(["....", "0...", "1..."]);
    const plan = planCollapse(grid, COLS, true);
    expect(plan.next[0][0]).toBe(0);
    expect(plan.next[1][0]).toBe(1);
    expect(plan.next[2][0]).toBe(EMPTY);
  });

  it("整列空了就往左并拢,并记下左移清单", () => {
    const grid = board(["0.2.", "1.3."]);
    const plan = planCollapse(grid, COLS, false);
    expect(plan.shifts).toEqual([{ fromC: 2, toC: 1 }]);
    expect(plan.next[0]).toEqual([0, 2, EMPTY, EMPTY]);
    expect(plan.next[1]).toEqual([1, 3, EMPTY, EMPTY]);
  });

  it("下落落定与左移并拢是两张不同的中间盘面", () => {
    const grid = board(["0.2.", "..3."]);
    const plan = planCollapse(grid, COLS, false);
    expect(plan.afterFall[0]).toEqual([EMPTY, EMPTY, 2, EMPTY]);
    expect(plan.afterFall[1]).toEqual([0, EMPTY, 3, EMPTY]);
    expect(plan.next[1]).toEqual([0, 3, EMPTY, EMPTY]);
    expect(plan.afterFall).not.toEqual(plan.next);
  });

  it("塌陷中途:视觉坐标 ≠ 逻辑坐标(禁止瞬移补位)", () => {
    const grid = board(["0...", "....", "....", "...."]);
    const plan = planCollapse(grid, COLS, false);
    const move = plan.falls[0];
    expect(move.fromR).toBe(0);
    expect(move.toR).toBe(3);
    const mid = plan.fallStartMs + move.delayMs + move.durMs / 2;
    const shown = visualRowAt(plan, move, mid);
    expect(shown).toBeGreaterThan(move.fromR);
    expect(shown).toBeLessThan(move.toR);
    expect(visualRowAt(plan, move, plan.fallStartMs - 1)).toBe(move.fromR);
    expect(visualRowAt(plan, move, plan.totalMs)).toBe(move.toR);
  });

  it("左移中途的视觉列号也是渐变的", () => {
    const grid = board(["0.2."]);
    const plan = planCollapse(grid, COLS, false);
    const shift = plan.shifts[0];
    const mid = plan.shiftStartMs + SHIFT_MS / 2;
    const shown = visualColAt(plan, shift, mid);
    expect(shown).toBeLessThan(shift.fromC);
    expect(shown).toBeGreaterThan(shift.toC);
  });

  it("phaseAt 把整条时间线切成四段,还没落定的颗数会递减", () => {
    const grid = board(["0.2.", "....", "1..."]);
    const plan = planCollapse(grid, COLS, false);
    expect(phaseAt(plan, 0)).toBe("pop");
    expect(phaseAt(plan, plan.popMs)).toBe("fall");
    expect(phaseAt(plan, plan.shiftStartMs)).toBe("shift");
    expect(phaseAt(plan, plan.totalMs)).toBe("done");
    expect(movingCount(plan, plan.fallStartMs)).toBeGreaterThan(0);
    expect(movingCount(plan, plan.totalMs)).toBe(0);
  });

  it("reduced-motion 压到一帧,但走的是同一个状态机", () => {
    const grid = board(["0.2.", "....", "1..."]);
    const full = planCollapse(grid, COLS, false);
    const quick = planCollapse(grid, COLS, false, { reduced: true });
    expect(quick.popMs).toBe(REDUCED_FRAME_MS);
    expect(quick.totalMs).toBeLessThan(full.totalMs);
    expect(quick.next).toEqual(full.next);
    expect(phaseAt(quick, 0)).toBe("pop");
    expect(phaseAt(quick, quick.totalMs)).toBe("done");
  });
});

describe("泡泡噗噗 · 连通群与分数", () => {
  it("同色连通群按四邻找,单颗不算一群", () => {
    const grid = board(["0012", "0112", "3312"]);
    expect(groupAt(grid, COLS, 0, 0, 4)).toHaveLength(3);
    expect(groupAt(grid, COLS, 0, 3, 4)).toHaveLength(3);
    expect(groupAt(grid, COLS, 2, 0, 4)).toHaveLength(2);
  });

  it("分数是 n² 式:消得越多越划算", () => {
    expect(groupScore(1)).toBe(0);
    expect(groupScore(2)).toBe(4);
    expect(groupScore(5)).toBe(25);
    expect(groupScore(10)).toBe(100);
    expect(groupScore(10)).toBeGreaterThan(groupScore(5) * 2);
    expect(groupScore(Number.NaN)).toBe(0);
  });

  it("按住预览给出 ×N 与预计得分", () => {
    expect(previewLabel(1)).toContain("单颗");
    expect(previewLabel(6)).toBe("×6 · 预计 36 分");
    expect(BIG_GROUP).toBe(8);
  });
});

describe("泡泡噗噗 · 特殊泡", () => {
  it("连锁泡消掉后炸开一圈,石头不炸,边角只炸盘内", () => {
    const grid = board(["0120", "1CS1", "2101"].map((r) => r.replace("C", "0").replace("S", "8")));
    grid[1][1] = CHAIN;
    grid[1][2] = STONE;
    expect(isChain(grid[1][1])).toBe(true);
    const ring = chainRing(grid, COLS, 1, 1);
    expect(ring).toHaveLength(7);
    expect(ring.some(([r, c]) => r === 1 && c === 2)).toBe(false);
    expect(chainRing(grid, COLS, 0, 0).length).toBe(3);
  });

  it("连锁泡碰到连锁泡会一路接下去,普通泡不会", () => {
    const grid = board(["0000", "0000", "0000"]);
    grid[1][1] = CHAIN;
    grid[0][2] = CHAIN;
    const blast = chainBlast(grid, COLS, 1, 1);
    const keys = new Set(blast.map(([r, c]) => `${r},${c}`));
    expect(keys.has("1,1")).toBe(true);
    expect(keys.has("0,2")).toBe(true);
    // 第二颗连锁泡再往外炸一圈,把它右边那列也带走
    expect(keys.has("0,3")).toBe(true);
    expect(keys.size).toBe(blast.length);
    expect(chainBlast(grid, COLS, 2, 0)).toEqual([]);
  });

  it("冰泡要相邻消两次:先化一层再碎", () => {
    const frozen = 12;
    const once = thawFrozen(frozen);
    expect(once).toBe(2);
    expect(thawFrozen(once)).toBe(2);
  });

  it("彩虹泡的老规则没被动过(仍然按当前颜色统计)", () => {
    const grid = board(["0011", "0011"]);
    expect(hasMovesOn(grid, COLS, 4)).toBe(true);
    expect(groupAt(grid, COLS, 0, 0, 4)).toHaveLength(4);
  });
});

describe("泡泡噗噗 · 死局与重排", () => {
  it("认得出死局", () => {
    const stuck = board(["0101", "1010", "0101"]);
    expect(isDeadlock(stuck, COLS, 4)).toBe(true);
    const fine = board(["0011", "1010", "0101"]);
    expect(isDeadlock(fine, COLS, 4)).toBe(false);
  });

  it("吹一口气重排:数量种类一颗不差,重排后一定有得消", () => {
    const stuck = board(["0101", "1010", "0101"]);
    const rand = mulberry32(7);
    const next = blowShuffle(stuck, COLS, 4, rand);
    expect(countLeftOn(next)).toBe(countLeftOn(stuck));
    const before = stuck.flat().filter((v) => v >= 0).sort();
    const after = next.flat().filter((v) => v >= 0).sort();
    expect(after).toEqual(before);
    expect(isDeadlock(next, COLS, 4)).toBe(false);
    expect(stuck).toEqual(board(["0101", "1010", "0101"]));
  });

  it("重排随机 200 次都能给出可走的盘面", () => {
    for (let i = 0; i < 200; i++) {
      const rand = mulberry32(1000 + i);
      const grid: number[][] = [];
      for (let r = 0; r < 5; r++) {
        grid.push(Array.from({ length: COLS }, () => Math.floor(rand() * 4)));
      }
      const next = blowShuffle(grid, COLS, 4, rand);
      expect(isDeadlock(next, COLS, 4), `第 ${i} 次重排还是死局`).toBe(false);
    }
  });
});

describe("泡泡噗噗 · 无尽泡泡海", () => {
  it("底部上推一行,整片往上挪,顶到线就收摊", () => {
    const grid = board(["....", "0011", "1100"]);
    const rand = mulberry32(3);
    const first = pushUpRow(grid, COLS, 4, rand);
    expect(first.overflow).toBe(false);
    expect(first.grid).toHaveLength(3);
    expect(first.grid[0]).toEqual([0, 0, 1, 1]);
    expect(first.grid[2].every((v) => v >= 0 && v < 4)).toBe(true);
    const second = pushUpRow(first.grid, COLS, 4, rand);
    expect(second.overflow).toBe(true);
  });

  it("上推节奏越来越紧但有下限,颜色数逐步变多", () => {
    expect(seaPushMs(0)).toBeGreaterThan(seaPushMs(6));
    // 第一段坡到第 18 推拧到 2600ms,原来到这儿就再也不动了
    expect(seaPushMs(SEA_TIGHTEN_CAP)).toBe(2600);
    // 接一段更缓的坡走到 1800ms 再稳住
    expect(seaPushMs(SEA_TIGHTEN_CAP + 1)).toBeLessThan(2600);
    expect(seaPushMs(999)).toBe(SEA_PUSH_FLOOR_MS);
    expect(seaColors(0)).toBe(3);
    expect(seaColors(30)).toBe(5);
    expect(seaColors(-3)).toBe(3);
    expect(SEA_ROWS).toBeGreaterThanOrEqual(10);
  });

  it("后段会来「大潮」:一次涨两行,但最勤也是三推一次", () => {
    for (let n = 0; n < SEA_BIG_TIDE_FROM; n++) {
      expect(seaTideRows(n), `第 ${n} 推还没到大潮的时候就涨了两行`).toBe(1);
    }
    expect(seaTideRows(SEA_BIG_TIDE_FROM)).toBe(2);
    for (let n = 0; n <= 400; n++) {
      expect(seaTideRows(n)).toBeGreaterThanOrEqual(1);
      expect(seaTideRows(n)).toBeLessThanOrEqual(2);
    }
    // 任意连续 SEA_BIG_TIDE_MIN_EVERY 推里，大潮最多一次
    for (let n = SEA_BIG_TIDE_FROM; n <= 400 - SEA_BIG_TIDE_MIN_EVERY; n++) {
      let big = 0;
      for (let i = 0; i < SEA_BIG_TIDE_MIN_EVERY; i++) if (seaTideRows(n + i) === 2) big++;
      expect(big, `第 ${n} 推起连着 ${SEA_BIG_TIDE_MIN_EVERY} 推来了 ${big} 次大潮`).toBeLessThanOrEqual(1);
    }
    // 后段的大潮确实比刚开放时来得勤
    const density = (from: number): number => {
      let big = 0;
      for (let i = 0; i < 60; i++) if (seaTideRows(from + i) === 2) big++;
      return big;
    };
    expect(density(200)).toBeGreaterThan(density(SEA_BIG_TIDE_FROM));
  });

  it("收摊只鼓励,不批评", () => {
    expect(seaLine(320, 100)).toContain("新纪录");
    expect(seaLine(50, 900)).toContain("收益最高");
    expect(seaLine(0, 0)).not.toContain("失败");
  });
});

describe("泡泡噗噗 · 188 关抽样", () => {
  it("抽样各章:目标剩余数合理,盘面塌陷后颗数不变", () => {
    const rand = mulberry32(2026);
    for (let lv = 0; lv < 188; lv += 9) {
      const cfg = LEVELS[lv];
      expect(cfg.maxLeft).toBeGreaterThan(0);
      expect(cfg.rows * 8).toBeGreaterThan(cfg.maxLeft);
      const grid: number[][] = [];
      for (let r = 0; r < cfg.rows; r++) {
        grid.push(Array.from({ length: 8 }, () => Math.floor(rand() * cfg.colors)));
      }
      const plan = planCollapse(grid, 8, false);
      expect(countLeftOn(plan.next), `第 ${lv + 1} 关塌陷后颗数变了`).toBe(countLeftOn(grid));
    }
  });

  it("前 99 关的关卡参数没有被 1.2 动过", () => {
    expect(LEVELS[0]).toEqual({ rows: 8, colors: 3, maxLeft: 14, rainbow: 0, stone: 0, bolt: 0, frozen: 0 });
    expect(LEVELS[98].rows).toBe(11);
    expect(LEVELS[98].colors).toBe(5);
    for (let lv = 0; lv < 99; lv++) {
      expect(LEVELS[lv].flipGravity).toBeUndefined();
      expect(LEVELS[lv].chameleon).toBeUndefined();
      expect(LEVELS[lv].hidden).toBeUndefined();
      expect(LEVELS[lv].moveLimit).toBeUndefined();
      expect(LEVELS[lv].chain).toBeUndefined();
    }
  });

  it("连锁泡只在第 100 关之后登场,数量克制", () => {
    let withChain = 0;
    for (let lv = 99; lv < 188; lv++) {
      const n = LEVELS[lv].chain ?? 0;
      expect(n).toBeLessThanOrEqual(3);
      if (n > 0) withChain++;
    }
    expect(withChain).toBeGreaterThan(0);
  });
});
