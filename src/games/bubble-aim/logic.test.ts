import { describe, expect, it } from "vitest";
import {
  type Grid,
  type Obstacles,
  type ShotResult,
  COLS,
  DEADLINE_ROW,
  HOLE_R,
  MAX_ROWS,
  R,
  RAINBOW,
  ROW_H,
  STONE,
  STONE_CRACKED,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  countStones,
  crossedDeadline,
  damageStone,
  descend,
  findFloating,
  floodSameColor,
  isClearable,
  isStone,
  neighbors,
  parseLayout,
  releaseLoneRainbows,
  rowLength,
  settleShot,
  simulateShot,
  snapCell,
  starsForShotsLeft,
} from "./logic";
import {
  type BubbleLevelDef,
  type MechKind,
  LEVELS,
  levelMechanisms,
} from "./levels";

const SHOOTER_X = W / 2;
const SHOOTER_Y = 444;

describe("bubble-aim 网格", () => {
  it("偶数行 9 格、奇数行 8 格", () => {
    const g = parseLayout([]);
    expect(rowLength(g, 0)).toBe(9);
    expect(rowLength(g, 1)).toBe(8);
    expect(rowLength(g, 2)).toBe(9);
  });

  it("奇数行中心右移半格", () => {
    const g = parseLayout([]);
    const even = cellCenter(g, 0, 0);
    const odd = cellCenter(g, 1, 0);
    expect(odd.x - even.x).toBeCloseTo(R);
    expect(odd.y).toBeGreaterThan(even.y);
  });

  it("六边形邻居：偶数行", () => {
    const g = parseLayout([]);
    const n = neighbors(g, 2, 4).map(([r, c]) => `${r},${c}`);
    expect(n).toContain("2,3");
    expect(n).toContain("2,5");
    expect(n).toContain("1,3");
    expect(n).toContain("1,4");
    expect(n).toContain("3,3");
    expect(n).toContain("3,4");
    expect(n).toHaveLength(6);
  });

  it("六边形邻居：奇数行", () => {
    const g = parseLayout([]);
    const n = neighbors(g, 1, 3).map(([r, c]) => `${r},${c}`);
    expect(n).toContain("0,3");
    expect(n).toContain("0,4");
    expect(n).toContain("2,3");
    expect(n).toContain("2,4");
    expect(n).toHaveLength(6);
  });

  it("边界格邻居会被裁剪", () => {
    const g = parseLayout([]);
    const n = neighbors(g, 0, 0);
    for (const [r, c] of n) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("bubble-aim 下落新行", () => {
  it("descend 翻转奇偶：顶行变 8 格，原有行几何位置整体下移一行", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const before = cellCenter(g, 0, 0);
    descend(g, "YYYYYYYY");
    expect(g.flip).toBe(1);
    expect(rowLength(g, 0)).toBe(8);
    expect(g.rows[0].every((c) => c === "Y")).toBe(true);
    expect(g.rows[1][0]).toBe("R");
    const after = cellCenter(g, 1, 0);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y + ROW_H);
  });

  it("连降两行回到原奇偶，行长校验严格", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    descend(g, "YYYYYYYY");
    expect(() => descend(g, "YYYYYYYY")).toThrow(); // 该 9 格却给 8
    descend(g, "PPPPPPPPP");
    expect(g.flip).toBe(0);
    expect(rowLength(g, 0)).toBe(9);
    expect(g.rows[2][0]).toBe("R");
  });

  it("下落后邻居关系仍然一致", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    descend(g, "YYYYYYYY");
    // 顶行现在是短行：下方邻居是 (1,c) 和 (1,c+1)
    const n = neighbors(g, 0, 0).map(([r, c]) => `${r},${c}`);
    expect(n).toContain("1,0");
    expect(n).toContain("1,1");
  });
});

describe("bubble-aim 解析与连消", () => {
  it("parseLayout 校验行长并补空行", () => {
    const g = parseLayout(["RRRGGGBBB", "RRRGGBBB"]);
    expect(g.rows.length).toBe(MAX_ROWS);
    expect(g.rows[0][0]).toBe("R");
    expect(g.rows[2].every((c) => c === null)).toBe(true);
    expect(() => parseLayout(["RR"])).toThrow();
  });

  it("同色连通块", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    expect(floodSameColor(g, 0, 0)).toHaveLength(3);
    expect(floodSameColor(g, 0, 4)).toHaveLength(3);
  });

  it("跨行同色也连通", () => {
    const g = parseLayout(["RRGGGGBBB", "RRGGGBBB"]);
    expect(floodSameColor(g, 0, 0)).toHaveLength(4);
  });

  it("消 3 个：settleShot 弹出同色块", () => {
    const g = parseLayout(["RRGGGGBBB"]);
    g.rows[1][0] = "R";
    const result = settleShot(g, 1, 0);
    expect(result.popped).toHaveLength(3);
    expect(g.rows[0][0]).toBeNull();
    expect(g.rows[1][0]).toBeNull();
  });

  it("只有 2 个同色不消", () => {
    const g = parseLayout(["RRGGGGBBB"]);
    const result = settleShot(g, 0, 0);
    expect(result.popped).toHaveLength(0);
    expect(g.rows[0][0]).toBe("R");
  });

  it("悬空的泡泡跟着掉落", () => {
    const g = parseLayout([
      "GGG......",
      "RR......",
      "BB.......",
    ]);
    g.rows[1][2] = "R";
    const result = settleShot(g, 1, 2);
    expect(result.popped).toHaveLength(3);
    expect(result.dropped.map((d) => d.color)).toEqual(["B", "B"]);
    expect(countBubbles(g)).toBe(3);
  });

  it("findFloating 找到断开的块", () => {
    const g = parseLayout(["R........"]);
    g.rows[3][4] = "B";
    expect(findFloating(g)).toContainEqual([3, 4]);
  });

  it("colorsInGrid 只报告普通颜色（不含石泡彩虹）", () => {
    const g = parseLayout(["RRGGSW..."]);
    expect(colorsInGrid(g).sort()).toEqual(["G", "R"]);
  });
});

describe("bubble-aim 彩虹泡", () => {
  it("彩虹泡百搭：R-W 连成一块", () => {
    const g = parseLayout(["RRW......"]);
    expect(floodSameColor(g, 0, 0)).toHaveLength(3);
  });

  it("彩虹不会把两种颜色串成一次消除以外的跳色", () => {
    const g = parseLayout(["RWB......"]);
    // 从 R 出发：R + W，但不会烧到 B
    expect(floodSameColor(g, 0, 0)).toHaveLength(2);
  });

  it("floodSameColor 不能从彩虹/石泡出发", () => {
    const g = parseLayout(["WSR......"]);
    expect(floodSameColor(g, 0, 0)).toHaveLength(0);
    expect(floodSameColor(g, 0, 1)).toHaveLength(0);
  });

  it("场上没普通颜色时孤零零的彩虹自动飞走", () => {
    const g = parseLayout(["WW......."]);
    const popped = releaseLoneRainbows(g);
    expect(popped).toHaveLength(2);
    expect(countBubbles(g)).toBe(0);
  });

  it("还有普通颜色时彩虹不会自己飞", () => {
    const g = parseLayout(["WWR......"]);
    expect(releaseLoneRainbows(g)).toHaveLength(0);
  });
});

describe("bubble-aim 石泡", () => {
  it("石泡不算待清空泡泡", () => {
    expect(isClearable(STONE)).toBe(false);
    expect(isClearable(STONE_CRACKED)).toBe(false);
    expect(isClearable("R")).toBe(true);
    expect(isClearable(RAINBOW)).toBe(true);
    expect(isStone(STONE)).toBe(true);
    expect(isStone(STONE_CRACKED)).toBe(true);
  });

  it("countStones 统计石泡", () => {
    const g = parseLayout(["SST......"]);
    expect(countStones(g)).toBe(3);
    expect(countBubbles(g)).toBe(0);
  });

  it("直接命中石泡两次才碎：先裂后碎", () => {
    const g = parseLayout(["....S...."]);
    const first = damageStone(g, 0, 4);
    expect(first.result).toBe("cracked");
    expect(g.rows[0][4]).toBe(STONE_CRACKED);
    const second = damageStone(g, 0, 4);
    expect(second.result).toBe("broken");
    expect(g.rows[0][4]).toBeNull();
  });

  it("石泡碎掉后吊着的泡泡一起掉", () => {
    const g = parseLayout(["....S....", "...GG..."]);
    damageStone(g, 0, 4);
    const { result, dropped } = damageStone(g, 0, 4);
    expect(result).toBe("broken");
    expect(dropped).toHaveLength(2);
    expect(countBubbles(g)).toBe(0);
  });

  it("弹道命中石泡：不吸附，返回 hitCell", () => {
    const g = parseLayout(["....S...."]);
    const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1);
    expect(res.landing).toBeNull();
    expect(res.hitCell).toEqual({ r: 0, c: 4 });
    expect(res.swallowed).toBe(false);
  });
});

describe("bubble-aim 弹道", () => {
  it("直射向上会打到顶或泡泡", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const result = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1);
    expect(result.landing).not.toBeNull();
    expect(result.landing!.r).toBeLessThanOrEqual(2);
  });

  it("斜射碰墙反弹，路径出现折点且不出界", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const result = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0.96, -0.28);
    expect(result.path.length).toBeGreaterThan(2);
    for (const p of result.path) {
      expect(p.x).toBeGreaterThanOrEqual(R - 0.01);
      expect(p.x).toBeLessThanOrEqual(W - R + 0.01);
    }
    expect(result.landing).not.toBeNull();
  });

  it("落位一定是贴着泡泡或顶行的空格", () => {
    const g = parseLayout(["RRRGGGBBB", "RRRGGBBB"]);
    const result = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0.3, -0.9);
    const landing = result.landing!;
    expect(g.rows[landing.r][landing.c]).toBeNull();
    const anchored =
      landing.r === 0 ||
      neighbors(g, landing.r, landing.c).some(([r, c]) => g.rows[r][c] !== null);
    expect(anchored).toBe(true);
  });

  it("snapCell 空网格吸附到顶行", () => {
    const g = parseLayout(["........."]);
    const cell = snapCell(g, W / 2, 20)!;
    expect(cell.r).toBe(0);
  });

  it("瞄准预览与真实弹道完全一致（同函数同结果）", () => {
    const g = parseLayout(["RRRGGGBBB", "RRRGGBBB"]);
    const obs: Obstacles = {
      clouds: [{ x: 42, y: 310, w: 70, h: 22 }],
      holes: [{ x: 270, y: 280 }],
    };
    for (const [dx, dy] of [[0.4, -0.9], [-0.7, -0.6], [0.05, -1]]) {
      const preview = simulateShot(g, SHOOTER_X, SHOOTER_Y, dx, dy, obs);
      const real = simulateShot(g, SHOOTER_X, SHOOTER_Y, dx, dy, obs);
      expect(real).toEqual(preview);
    }
  });
});

describe("bubble-aim 云挡板与黑洞", () => {
  it("云挡板把直射弹开：碰不到顶", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const cloud = { x: 100, y: 300, w: 160, h: 20 };
    const blocked = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1, { clouds: [cloud] });
    expect(blocked.landing).toBeNull();
    // 反弹点出现在云的下边缘附近
    expect(blocked.path.some((p) => Math.abs(p.y - (cloud.y + cloud.h + R)) < 6)).toBe(true);
    // 没有云时同一条线能落位
    const open = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1);
    expect(open.landing).not.toBeNull();
  });

  it("绕开云挡板的斜线不受影响", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const cloud = { x: 130, y: 296, w: 100, h: 24 };
    const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, -0.85, -0.55, { clouds: [cloud] });
    expect(res.landing).not.toBeNull();
  });

  it("黑洞吞掉直射泡泡", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const hole = { x: SHOOTER_X, y: 250 };
    const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1, { holes: [hole] });
    expect(res.swallowed).toBe(true);
    expect(res.landing).toBeNull();
    const last = res.path[res.path.length - 1];
    expect(last.x).toBeCloseTo(hole.x);
    expect(last.y).toBeCloseTo(hole.y);
  });

  it("躲开黑洞的线路照常落位", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, -0.8, -0.6, {
      holes: [{ x: SHOOTER_X, y: 250 }],
    });
    expect(res.swallowed).toBe(false);
    expect(res.landing).not.toBeNull();
  });
});

describe("bubble-aim 胜负与星级", () => {
  it("crossedDeadline", () => {
    const g = parseLayout(["RRRGGGBBB"]);
    expect(crossedDeadline(g)).toBe(false);
    g.rows[DEADLINE_ROW][0] = "R";
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
  it("至少 18 关且布局都合法", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(18);
    for (const lv of LEVELS) {
      expect(() => parseLayout(lv.layout)).not.toThrow();
      expect(lv.shots).toBeGreaterThan(0);
    }
  });

  it("五种机关都有，且每种至少出现在 4 关", () => {
    const count = new Map<MechKind, number>();
    for (const lv of LEVELS) {
      for (const m of levelMechanisms(lv)) {
        count.set(m, (count.get(m) ?? 0) + 1);
      }
    }
    const kinds: MechKind[] = ["stone", "rainbow", "cloud", "hole", "drop"];
    for (const k of kinds) {
      expect(count.get(k) ?? 0, `机关 ${k} 出现次数`).toBeGreaterThanOrEqual(4);
    }
  });

  it("前 4 关无机关热身，机关逐个引入，后段组合出现", () => {
    for (let i = 0; i < 4; i++) {
      expect(levelMechanisms(LEVELS[i])).toHaveLength(0);
    }
    // 后 7 关每关至少 2 种机关，且至少 5 关有 3 种以上
    const late = LEVELS.slice(-7).map((lv) => levelMechanisms(lv).length);
    for (const n of late) expect(n).toBeGreaterThanOrEqual(2);
    expect(late.filter((n) => n >= 3).length).toBeGreaterThanOrEqual(5);
  });

  it("开局没有悬空泡泡", () => {
    for (const lv of LEVELS) {
      expect(findFloating(parseLayout(lv.layout)), lv.name).toHaveLength(0);
    }
  });

  it("每个普通泡泡都有同色/彩虹邻居或贴着石泡（不会出现死单泡）", () => {
    for (const lv of LEVELS) {
      const g = parseLayout(lv.layout);
      for (let r = 0; r < g.rows.length; r++) {
        for (let c = 0; c < rowLength(g, r); c++) {
          const cell = g.rows[r][c];
          if (!cell || isStone(cell) || cell === RAINBOW) continue;
          const ok = neighbors(g, r, c).some(([nr, nc]) => {
            const n = g.rows[nr][nc];
            return n === cell || n === RAINBOW || isStone(n);
          });
          expect(ok, `${lv.name} (${r},${c}) ${cell} 是死单泡`).toBe(true);
        }
      }
    }
  });

  it("下落行长度按 8/9 交替且颜色成对（没有死单色）", () => {
    for (const lv of LEVELS) {
      (lv.dropRows ?? []).forEach((row, k) => {
        expect(row.length, `${lv.name} 第 ${k} 行`).toBe(k % 2 === 0 ? COLS - 1 : COLS);
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          expect(ch, `${lv.name} 下落行含空格`).not.toBe(".");
          if (ch === RAINBOW || ch === STONE || ch === STONE_CRACKED) continue;
          expect(
            row[i - 1] === ch || row[i + 1] === ch,
            `${lv.name} 下落行 (${k},${i}) ${ch} 是死单色`
          ).toBe(true);
        }
      });
      if (lv.dropRows && lv.dropRows.length > 0) {
        expect(lv.dropEvery ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("黑洞和云挡板不压住初始泡泡、不糊住墙边和发射台", () => {
    for (const lv of LEVELS) {
      const g = parseLayout(lv.layout);
      const centers: Array<{ x: number; y: number }> = [];
      for (let r = 0; r < g.rows.length; r++) {
        for (let c = 0; c < rowLength(g, r); c++) {
          if (g.rows[r][c]) centers.push(cellCenter(g, r, c));
        }
      }
      for (const hole of lv.holes ?? []) {
        for (const p of centers) {
          expect(
            Math.hypot(p.x - hole.x, p.y - hole.y),
            `${lv.name} 黑洞压住泡泡`
          ).toBeGreaterThan(HOLE_R + R);
        }
        expect(Math.hypot(hole.x - SHOOTER_X, hole.y - SHOOTER_Y)).toBeGreaterThan(HOLE_R * 2);
      }
      for (const cl of lv.clouds ?? []) {
        expect(cl.x - R, `${lv.name} 云贴左墙`).toBeGreaterThanOrEqual(22);
        expect(cl.x + cl.w + R, `${lv.name} 云贴右墙`).toBeLessThanOrEqual(W - 22);
        for (const p of centers) {
          const inside =
            p.x > cl.x - R && p.x < cl.x + cl.w + R &&
            p.y > cl.y - R && p.y < cl.y + cl.h + R;
          expect(inside, `${lv.name} 云压住泡泡`).toBe(false);
        }
        const shooterIn =
          SHOOTER_X > cl.x - R && SHOOTER_X < cl.x + cl.w + R &&
          SHOOTER_Y > cl.y - R && SHOOTER_Y < cl.y + cl.h + R;
        expect(shooterIn, `${lv.name} 云糊住发射台`).toBe(false);
      }
    }
  });

  it("每关布局不同且泡泡数、子弹数合理", () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      const key = lv.layout.join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const g = parseLayout(lv.layout);
      expect(countBubbles(g)).toBeGreaterThanOrEqual(12);
      expect(crossedDeadline(g)).toBe(false);
    }
  });
});

// ---------- 贪心机器人可解性 ----------

function cloneGrid(g: Grid): Grid {
  return { rows: g.rows.map((row) => [...row]), flip: g.flip };
}

interface BotOutcome {
  won: boolean;
  shotsUsed: number;
}

/**
 * 贪心机器人：每发在 20°~160° 里扫一遍角度，用和游戏完全相同的
 * simulateShot / settleShot / damageStone 结算，挑得分最高的一击。
 * 颜色用种子随机从场上颜色里抽，模拟真实弹药队列。
 */
function botPlay(def: BubbleLevelDef, seed = 1): BotOutcome {
  const g = parseLayout(def.layout);
  const obs: Obstacles = { clouds: def.clouds, holes: def.holes };
  const dropQueue = [...(def.dropRows ?? [])];
  const dropEvery = def.dropEvery ?? 0;
  let rng = seed >>> 0;
  const rand = (): number => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const pick = (): string => {
    const pool = colorsInGrid(g);
    return pool[Math.floor(rand() * pool.length)] ?? "R";
  };
  let cur = pick();
  let next = pick();
  let fired = 0;

  for (let shot = 0; shot < def.shots; shot++) {
    releaseLoneRainbows(g);
    if (countBubbles(g) === 0) return { won: true, shotsUsed: fired };

    let bestScore = -Infinity;
    let best: ShotResult | null = null;
    for (let deg = 20; deg <= 160; deg += 2.5) {
      const a = (deg * Math.PI) / 180;
      const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, Math.cos(a), -Math.sin(a), obs);
      let score: number;
      if (res.swallowed) {
        score = -50;
      } else if (res.hitCell && isStone(g.rows[res.hitCell.r][res.hitCell.c])) {
        const sim = cloneGrid(g);
        const hit = damageStone(sim, res.hitCell.r, res.hitCell.c);
        score = hit.result === "broken" ? 3 + hit.dropped.length * 2.5 : 1;
      } else if (res.landing) {
        const sim = cloneGrid(g);
        sim.rows[res.landing.r][res.landing.c] = cur;
        const settle = settleShot(sim, res.landing.r, res.landing.c);
        const bonus = releaseLoneRainbows(sim).length;
        if (settle.popped.length > 0) {
          score = settle.popped.length * 2 + settle.dropped.length * 3 + bonus * 2;
        } else {
          const nearSame = neighbors(g, res.landing.r, res.landing.c).some(([nr, nc]) => {
            const n = g.rows[nr][nc];
            return n === cur || n === RAINBOW;
          });
          score = (nearSame ? 0.5 : -1) - res.landing.r * 0.15;
        }
      } else {
        score = -30;
      }
      if (score > bestScore) {
        bestScore = score;
        best = res;
      }
    }

    if (best) {
      if (best.swallowed) {
        // 没辙，只能浪费一发
      } else if (best.hitCell && isStone(g.rows[best.hitCell.r][best.hitCell.c])) {
        damageStone(g, best.hitCell.r, best.hitCell.c);
      } else if (best.landing) {
        g.rows[best.landing.r][best.landing.c] = cur;
        settleShot(g, best.landing.r, best.landing.c);
      }
    }
    fired++;
    if (dropEvery > 0 && dropQueue.length > 0 && fired % dropEvery === 0) {
      descend(g, dropQueue.shift()!);
    }
    releaseLoneRainbows(g);
    if (countBubbles(g) === 0) return { won: true, shotsUsed: fired };
    if (crossedDeadline(g)) return { won: false, shotsUsed: fired };
    cur = next;
    const pool = colorsInGrid(g);
    if (!pool.includes(cur)) cur = pick();
    next = pick();
  }
  releaseLoneRainbows(g);
  return { won: countBubbles(g) === 0, shotsUsed: fired };
}

describe("bubble-aim 可解性（贪心机器人实测过关）", () => {
  // 覆盖：纯颜色、石泡、彩虹、云挡板、黑洞、下落新行以及后期大杂烩
  const CASES: Array<{ index: number; seed?: number }> = [
    { index: 0 },  // 三色小塔：入门
    { index: 4 },  // 石头城门：石泡
    { index: 5 },  // 彩虹桥：彩虹泡
    { index: 7 },  // 白云索道：云挡板
    { index: 9 },  // 黑洞警报：黑洞
    { index: 11 }, // 天降泡雨：下落新行
    { index: 13 }, // 彩虹黑洞：三种机关组合
    { index: 18 }, // 全能试炼：四种机关组合
    { index: 19 }, // 终极嘉年华：五种机关全上
  ];

  for (const { index, seed } of CASES) {
    const def = LEVELS[index];
    it(`第 ${index + 1} 关「${def.name}」在 ${def.shots} 发内可以打通`, () => {
      const outcome = botPlay(def, seed ?? 1);
      expect(outcome.won, `${def.name} 机器人没打通`).toBe(true);
      expect(outcome.shotsUsed).toBeLessThanOrEqual(def.shots);
    });
  }
});
