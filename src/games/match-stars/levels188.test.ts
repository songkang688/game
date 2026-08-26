// 1.1：星星消消乐 99 → 188 的新主题、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, mulberry32, totalSize, TOTAL_LEVELS } from "../level99";
import {
  applyGravity,
  bossRoar,
  clearCells,
  cloneState,
  createState,
  creditOrders,
  findMatches,
  goalsMet,
  legalSwaps,
  matchesAt,
  orderSatisfied,
  remaining,
  resolveAll,
  shiftBelt,
  simulateLevel,
  SIZE,
} from "./engine";
import {
  boardSeed,
  CHAPTERS,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  orderLabel,
  type MatchLevel,
} from "./levels";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);
/** 四个新主题的关号区间（0 基，含头不含尾） */
const CH = { order: [99, 122], belt: [122, 144], frost: [144, 166], boss: [166, 188] } as const;

describe("星星消消乐 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：15/14/14/14/14/14/14", () => {
    expect(CHAPTERS.slice(0, 7).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 7).map((c) => c.name)).toEqual([
      "糖果草原", "冰雪山谷", "藤蔓森林", "彩虹果园", "星夜城堡", "糖霜云端", "流星圣殿",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("285e1b7c");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.orders).toBeUndefined();
      expect(lv.belts).toBeUndefined();
      expect(lv.frost).toBeUndefined();
      expect(lv.frostLayers).toBeUndefined();
      expect(lv.boss).toBeUndefined();
    }
  });
});

describe("星星消消乐 · 1.1 新主题", () => {
  it("总关数 188，末尾追加了 4 个全新主题共 89 关", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(totalSize(CHAPTERS)).toBe(188);
    const fresh = CHAPTERS.slice(7);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["订单甜品铺", "传送带工厂", "双层糖霜", "云顶石巨人"]);
  });

  it("新主题文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(7)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四个新主题的机制各不相同：订单 / 传送带 / 糖霜 / 石巨人", () => {
    for (let lv = CH.order[0]; lv < CH.order[1]; lv++) {
      expect((LEVELS[lv].orders ?? []).length).toBeGreaterThan(0);
    }
    for (let lv = CH.belt[0]; lv < CH.belt[1]; lv++) {
      expect((LEVELS[lv].belts ?? []).length).toBeGreaterThan(0);
    }
    for (let lv = CH.frost[0]; lv < CH.frost[1]; lv++) {
      expect(LEVELS[lv].frost ?? 0).toBeGreaterThan(0);
    }
    for (let lv = CH.boss[0]; lv < CH.boss[1]; lv++) {
      expect(LEVELS[lv].boss?.armor ?? 0).toBeGreaterThan(0);
    }
    // 招牌机制不越界：订单只在甜品铺、石巨人只在云顶
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 7) expect(LEVELS[lv].orders).toBeUndefined();
      if (ci !== 10) expect(LEVELS[lv].boss).toBeUndefined();
    }
  });

  it("第 100–188 关参数都在可玩区间内", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.colors).toBe(5);
      expect(cfg.moves).toBeGreaterThanOrEqual(24);
      expect(cfg.moves).toBeLessThanOrEqual(60);
      expect(cfg.three).toBeGreaterThan(cfg.two);
      for (const g of cfg.goals) {
        expect(g.token).toBeGreaterThanOrEqual(0);
        expect(g.token).toBeLessThan(cfg.colors);
        expect(g.count).toBeLessThanOrEqual(cfg.moves * 3);
      }
      for (const order of cfg.orders ?? []) {
        expect(order.count).toBeGreaterThanOrEqual(1);
        expect(order.count).toBeLessThanOrEqual(10);
        expect(orderLabel(order)).not.toMatch(/[A-Za-z]/);
      }
      for (const belt of cfg.belts ?? []) {
        expect(belt.row).toBeGreaterThanOrEqual(0);
        expect(belt.row).toBeLessThan(SIZE);
        expect([1, -1]).toContain(belt.dir);
      }
      if (cfg.frost) {
        expect(cfg.frost).toBeLessThanOrEqual(SIZE * 2);
        expect([1, 2]).toContain(cfg.frostLayers);
      }
      if (cfg.boss) {
        expect(cfg.boss.token).toBeLessThan(cfg.colors);
        expect(cfg.boss.roarEvery).toBeGreaterThanOrEqual(3);
        // 敲护甲的图案不能同时是收集目标，不然一步两用太糊涂
        expect(cfg.goals.some((g) => g.token === cfg.boss?.token)).toBe(false);
      }
    }
  });

  it("新主题内部难度递进：步数、订单、糖霜、护甲都往上走", () => {
    for (const [from, to] of [CH.order, CH.belt, CH.frost, CH.boss]) {
      expect(LEVELS[from].moves).toBeLessThan(LEVELS[to - 1].moves);
    }
    const orderTotal = (lv: number): number => (LEVELS[lv].orders ?? []).reduce((s, o) => s + o.count, 0);
    expect(orderTotal(CH.order[0])).toBeLessThan(orderTotal(CH.order[1] - 1));
    expect(LEVELS[CH.frost[0]].frost as number).toBeLessThan(LEVELS[CH.frost[1] - 1].frost as number);
    expect(LEVELS[CH.boss[0]].boss?.armor as number).toBeLessThan(LEVELS[CH.boss[1] - 1].boss?.armor as number);
    expect(LEVELS[CH.boss[0]].boss?.roarEvery as number).toBeGreaterThan(LEVELS[CH.boss[1] - 1].boss?.roarEvery as number);
  });
});

describe("星星消消乐 · 第 100–188 关逐关可解（自动玩家真跑一遍）", () => {
  it("第 100–129 关：自动玩家在步数用完前达成全部条件", () => {
    for (let lv = 99; lv < 129; lv++) {
      const r = simulateLevel(LEVELS[lv], boardSeed(lv));
      expect(r.won, `第 ${lv + 1} 关还差 ${r.left}（用了 ${r.movesUsed}/${LEVELS[lv].moves} 步）`).toBe(true);
      expect(r.left).toBe(0);
    }
  }, 30000);

  it("第 130–159 关：自动玩家在步数用完前达成全部条件", () => {
    for (let lv = 129; lv < 159; lv++) {
      const r = simulateLevel(LEVELS[lv], boardSeed(lv));
      expect(r.won, `第 ${lv + 1} 关还差 ${r.left}（用了 ${r.movesUsed}/${LEVELS[lv].moves} 步）`).toBe(true);
    }
  }, 30000);

  it("第 160–188 关：自动玩家在步数用完前达成全部条件", () => {
    for (let lv = 159; lv < 188; lv++) {
      const r = simulateLevel(LEVELS[lv], boardSeed(lv));
      expect(r.won, `第 ${lv + 1} 关还差 ${r.left}（用了 ${r.movesUsed}/${LEVELS[lv].moves} 步）`).toBe(true);
    }
  }, 30000);

  it("换几副牌也照样过得了（不是只有一副棋盘运气好）", () => {
    for (const lv of [99, 110, 121, 130, 143, 150, 165, 170, 180, 187]) {
      for (const salt of [1, 2, 3]) {
        const r = simulateLevel(LEVELS[lv], boardSeed(lv) + salt * 7919);
        expect(r.won, `第 ${lv + 1} 关 第 ${salt} 副棋盘还差 ${r.left}`).toBe(true);
      }
    }
  }, 30000);

  it("步数松紧和 1.0 一个量级：既不是白送，也不会逼着孩子零失误", () => {
    let ratio = 0;
    for (const lv of NEW_LEVELS) {
      const r = simulateLevel(LEVELS[lv], boardSeed(lv));
      // 一步就过关的白送关不许有
      expect(r.movesUsed, `第 ${lv + 1} 关一步就过了，太水`).toBeGreaterThanOrEqual(2);
      ratio += r.movesUsed / LEVELS[lv].moves;
    }
    const avg = ratio / NEW_LEVELS.length;
    // 1.0 前 99 关的同一把尺子量下来是 0.28
    expect(avg).toBeGreaterThanOrEqual(0.2);
    expect(avg).toBeLessThanOrEqual(0.6);
  }, 30000);
});

describe("星星消消乐 · 1.1 引擎纯函数", () => {
  const base: MatchLevel = {
    colors: 5, moves: 30, goals: [{ token: 0, count: 5 }],
    ice: 0, vine: 0, rainbow: false, three: 8, two: 3
  };

  it("匹配：三连才算，单点快查与全盘扫描结论一致", () => {
    const g = new Array<number>(SIZE * SIZE).fill(-1);
    g[0] = 1; g[1] = 1;
    expect(findMatches(g).size).toBe(0);
    expect(matchesAt(g, 0)).toBe(false);
    g[2] = 1;
    expect(findMatches(g).size).toBe(3);
    expect(matchesAt(g, 1)).toBe(true);
    // 竖着也算
    const v = new Array<number>(SIZE * SIZE).fill(-1);
    v[0] = 2; v[SIZE] = 2; v[SIZE * 2] = 2;
    expect(findMatches(v).size).toBe(3);
    expect(matchesAt(v, SIZE)).toBe(true);
  });

  it("传送带：整行循环平移一格，图案一个不多一个不少", () => {
    const s = createState(base, mulberry32(3));
    for (let c = 0; c < SIZE; c++) s.grid[2 * SIZE + c] = c;
    shiftBelt(s, { row: 2, dir: 1 });
    expect(Array.from({ length: SIZE }, (_, c) => s.grid[2 * SIZE + c])).toEqual([7, 0, 1, 2, 3, 4, 5, 6]);
    shiftBelt(s, { row: 2, dir: -1 });
    expect(Array.from({ length: SIZE }, (_, c) => s.grid[2 * SIZE + c])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // 越界的行号会绕回来，不会崩
    expect(() => shiftBelt(s, { row: 99, dir: 1 })).not.toThrow();
  });

  it("传送带绕不动被机关卡住的格子", () => {
    const s = createState({ ...base, ice: 0 }, mulberry32(5));
    for (let c = 0; c < SIZE; c++) s.grid[3 * SIZE + c] = c;
    s.ice[3 * SIZE + 4] = true;
    shiftBelt(s, { row: 3, dir: 1 });
    // 第 4 格被冻住，原地不动；其余的循环挪了一位
    expect(s.grid[3 * SIZE + 4]).toBe(4);
    expect(new Set(Array.from({ length: SIZE }, (_, c) => s.grid[3 * SIZE + c])).size).toBe(SIZE);
  });

  it("糖霜：在上面消一次剥一层，剥完才算干净", () => {
    const cfg: MatchLevel = { ...base, frost: 2, frostLayers: 2, goals: [{ token: 0, count: 1 }] };
    const s = createState(cfg, mulberry32(8));
    expect(s.frostLeft).toBeGreaterThan(0);
    const target = s.frost.findIndex((v) => v > 0);
    const before = s.frost[target];
    clearCells(s, cfg, new Set([target]));
    expect(s.frost[target]).toBe(before - 1);
    expect(s.frostLeft).toBe(cfgFrostTotal(s.frost) + (before - 1) - (before - 1));
    // 再消一次就彻底刮干净
    s.grid[target] = 0;
    clearCells(s, cfg, new Set([target]));
    expect(s.frost[target]).toBe(Math.max(0, before - 2));
  });

  function cfgFrostTotal(frost: number[]): number {
    return frost.reduce((a, b) => a + b, 0);
  }

  it("石巨人：消掉它怕的图案就掉一层护甲，护甲清零才算赢", () => {
    const cfg: MatchLevel = {
      ...base, goals: [{ token: 1, count: 1 }],
      boss: { token: 0, armor: 3, roarEvery: 4 }
    };
    const s = createState(cfg, mulberry32(11));
    s.grid[10] = 0; s.grid[11] = 0; s.grid[12] = 0;
    clearCells(s, cfg, new Set([10, 11, 12]));
    expect(s.armor).toBe(0);
    s.collected[0] = 1;
    expect(goalsMet(s, cfg)).toBe(true);
    // 护甲还在的时候，收集目标满了也不能算过关
    const s2 = createState(cfg, mulberry32(11));
    s2.collected[0] = 99;
    expect(goalsMet(s2, cfg)).toBe(false);
  });

  it("石巨人咆哮：冻住一颗自由的星星，冰块数跟着涨", () => {
    const cfg: MatchLevel = { ...base, boss: { token: 0, armor: 5, roarEvery: 3 } };
    const s = createState(cfg, mulberry32(13));
    const before = s.iceLeft;
    const at = bossRoar(s, cfg, mulberry32(17));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(s.ice[at]).toBe(true);
    expect(s.iceLeft).toBe(before + 1);
    // 护甲已经敲光了就不再捣乱
    s.armor = 0;
    expect(bossRoar(s, cfg, mulberry32(19))).toBe(-1);
  });

  it("订单：一次消 4 颗记 big4、连锁两轮记 chain2，一步最多记一笔", () => {
    expect(orderSatisfied("big4", { steps: 1, total: 4, best: 4 })).toBe(true);
    expect(orderSatisfied("big4", { steps: 1, total: 3, best: 3 })).toBe(false);
    expect(orderSatisfied("big5", { steps: 1, total: 5, best: 5 })).toBe(true);
    expect(orderSatisfied("chain2", { steps: 2, total: 6, best: 3 })).toBe(true);
    expect(orderSatisfied("chain3", { steps: 2, total: 6, best: 3 })).toBe(false);
    expect(orderSatisfied("不认识的订单", { steps: 9, total: 9, best: 9 })).toBe(false);
    const cfg: MatchLevel = { ...base, orders: [{ kind: "big4", count: 2 }] };
    const s = createState(cfg, mulberry32(21));
    expect(creditOrders(s, cfg, { steps: 1, total: 4, best: 4 })).toBe(1);
    expect(s.orders[0]).toBe(1);
    creditOrders(s, cfg, { steps: 1, total: 6, best: 6 });
    expect(s.orders[0]).toBe(2);
    // 订单满了就不再累加
    expect(creditOrders(s, cfg, { steps: 1, total: 9, best: 9 })).toBe(0);
  });

  it("订单文案是中文，四种订单说法各不相同", () => {
    const labels = (["big4", "big5", "chain2", "chain3"] as const).map((kind) => orderLabel({ kind, count: 2 }));
    expect(new Set(labels).size).toBe(4);
    for (const label of labels) expect(label).not.toMatch(/[A-Za-z]/);
  });

  it("候选交换：只列出「换了真能消」的那些，克隆棋盘互不干扰", () => {
    const s = createState(base, mulberry32(23));
    const swaps = legalSwaps(s, base);
    expect(swaps.length).toBeGreaterThan(0);
    for (const [a, b] of swaps) {
      [s.grid[a], s.grid[b]] = [s.grid[b], s.grid[a]];
      expect(matchesAt(s.grid, a) || matchesAt(s.grid, b)).toBe(true);
      [s.grid[a], s.grid[b]] = [s.grid[b], s.grid[a]];
    }
    const copy = cloneState(s);
    copy.grid[0] = 9;
    copy.collected[0] = 99;
    expect(s.grid[0]).not.toBe(9);
    expect(s.collected[0]).toBe(0);
  });

  it("连锁与下落：消完会自动补满，棋盘上不留空洞", () => {
    const s = createState(base, mulberry32(29));
    clearCells(s, base, new Set([0, 1, 2, 8, 9, 10]));
    expect(s.grid.filter((v) => v < 0).length).toBe(6);
    applyGravity(s, base, mulberry32(31));
    expect(s.grid.filter((v) => v < 0).length).toBe(0);
    resolveAll(s, base, mulberry32(37));
    expect(findMatches(s.grid).size).toBe(0);
  });

  it("剩余量：全部达成时正好是 0，缺什么都会被算进去", () => {
    const cfg: MatchLevel = {
      ...base, goals: [{ token: 0, count: 4 }], orders: [{ kind: "big4", count: 1 }],
      boss: { token: 1, armor: 2, roarEvery: 5 }
    };
    const s = createState(cfg, mulberry32(41));
    expect(remaining(s, cfg)).toBeGreaterThan(0);
    s.collected[0] = 4;
    s.orders[0] = 1;
    s.armor = 0;
    s.iceLeft = 0;
    s.vineLeft = 0;
    s.frostLeft = 0;
    expect(remaining(s, cfg)).toBe(0);
    expect(goalsMet(s, cfg)).toBe(true);
  });
});
