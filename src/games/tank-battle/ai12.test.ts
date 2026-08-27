/**
 * 铁皮车脑子的用例(1.2 新增)。
 *
 * 两件事要钉死:
 *  1. 网格 A* 找得到路、绕得开死胡同(这就是「不卡墙角」的做法);
 *  2. 三档脾气真的强弱有别 —— 固定 seed 跑一批陪练对局,
 *     追人 / 绕后卡位的战绩必须稳定压过乱转,不能靠运气。
 */
import { describe, expect, it } from "vitest";
import {
  AI_TIERS,
  DEAD_END_TOLL,
  TIER_SPECS,
  approachCells,
  astar,
  cornerToll,
  firstStep,
  inGrid,
  isDeadEnd,
  manhattan,
  passable,
  pathDirs,
  pathTouchesDeadEnd,
  tierSpec,
  wallsAround,
  wanderStep,
  type AiTier,
  type Grid,
} from "./ai12";
import { ARENAS } from "./maps12";
import { IDLE_INPUT, createWorld, stepWorld, type World } from "./logic";
import { mulberry32 } from "../level99";
import type { Cell } from "./terrain12";

/** 拿一张字符表当格子图:`#` 是墙,别的都走得通 */
function gridOf(rows: readonly string[]): Grid {
  return {
    w: rows[0].length,
    h: rows.length,
    wall: (cx, cy) => cy < 0 || cy >= rows.length || cx < 0 || cx >= rows[0].length || rows[cy][cx] === "#",
  };
}

function at(path: readonly Cell[] | null, i: number): Cell {
  if (!path) throw new Error("没找到路");
  return path[i];
}

describe("网格 A*", () => {
  const open = gridOf([".....", ".....", ".....", ".....", "....."]);

  it("空地上找的是最短路:长度正好是曼哈顿距离加一", () => {
    const path = astar(open, { cx: 0, cy: 0 }, { cx: 4, cy: 3 });
    expect(path).not.toBeNull();
    expect(path).toHaveLength(manhattan({ cx: 0, cy: 0 }, { cx: 4, cy: 3 }) + 1);
    expect(at(path, 0)).toEqual({ cx: 0, cy: 0 });
    expect(at(path, (path?.length ?? 1) - 1)).toEqual({ cx: 4, cy: 3 });
  });

  it("每一步都只走一格四邻,不会斜着穿墙缝", () => {
    const rows = [".....", ".###.", ".....", ".###.", "....."];
    const path = astar(gridOf(rows), { cx: 0, cy: 0 }, { cx: 4, cy: 4 });
    expect(path).not.toBeNull();
    for (let i = 1; i < (path?.length ?? 0); i++) {
      expect(manhattan(at(path, i - 1), at(path, i))).toBe(1);
    }
    expect(pathDirs(path ?? []).every((d) => d >= 0 && d <= 3)).toBe(true);
  });

  it("彻底封死就老实返回 null,不会瞎给一条穿墙的路", () => {
    const rows = [".....", "#####", ".....", ".....", "....."];
    expect(astar(gridOf(rows), { cx: 0, cy: 0 }, { cx: 0, cy: 4 })).toBeNull();
    expect(astar(open, { cx: 0, cy: 0 }, { cx: 99, cy: 0 })).toBeNull();
  });

  it("终点本身是墙也认:走到跟前就行,不用开进去(老巢就是这种目标)", () => {
    const rows = [".....", ".....", "..#..", ".....", "....."];
    const path = astar(gridOf(rows), { cx: 0, cy: 2 }, { cx: 2, cy: 2 });
    expect(path).not.toBeNull();
    expect(at(path, (path?.length ?? 1) - 1)).toEqual({ cx: 2, cy: 2 });
  });

  it("不卡墙角:死胡同要付一大笔过路费,算出来的路一格都不踩", () => {
    // 中间一条走廊,上下各挂一串死胡同的小坑
    const rows = [
      "#.#.#.#.#",
      "#.#.#.#.#",
      ".........",
      "#.#.#.#.#",
      "#.#.#.#.#",
    ];
    const g = gridOf(rows);
    expect(isDeadEnd(g, 1, 0)).toBe(true);
    expect(wallsAround(g, 1, 0)).toBe(3);
    expect(cornerToll(g, 1, 0)).toBe(DEAD_END_TOLL);
    expect(cornerToll(g, 4, 2)).toBe(0);

    const path = astar(g, { cx: 0, cy: 2 }, { cx: 8, cy: 2 });
    expect(path).not.toBeNull();
    expect(pathTouchesDeadEnd(g, path ?? [])).toBe(false);
  });

  it("砖只是「贵」不是「墙」:代价高就绕,代价低才直接穿", () => {
    const rows = [".....", ".....", ".....", ".....", "....."];
    const base = gridOf(rows);
    const pricey: Grid = { ...base, cost: (cx, cy) => (cx === 2 && cy === 0 ? 30 : 1) };
    const cheap: Grid = { ...base, cost: () => 1 };
    const detour = astar(pricey, { cx: 0, cy: 0 }, { cx: 4, cy: 0 });
    const straight = astar(cheap, { cx: 0, cy: 0 }, { cx: 4, cy: 0 });
    expect(straight).toHaveLength(5);
    expect(straight?.some((c) => c.cx === 2 && c.cy === 0)).toBe(true);
    // 那一格贵得离谱,于是绕了一圈:路更长,但没从 (2,0) 上碾过去
    expect(detour?.length ?? 0).toBeGreaterThan(5);
    expect(detour?.some((c) => c.cx === 2 && c.cy === 0)).toBe(false);
  });

  it("blocked 名单能临时封路,封了就得绕", () => {
    const rows = ["...", "...", "..."];
    const g = gridOf(rows);
    const wall: Cell[] = [
      { cx: 1, cy: 0 },
      { cx: 1, cy: 1 },
    ];
    const path = astar(g, { cx: 0, cy: 0 }, { cx: 2, cy: 0 }, { blocked: wall });
    expect(path).not.toBeNull();
    expect(path?.some((c) => c.cx === 1 && c.cy === 0)).toBe(false);
    expect(firstStep(g, { cx: 0, cy: 0 }, { cx: 2, cy: 0 })).toBe(1);
  });

  it("inGrid / passable / approachCells 三个小工具边界不出错", () => {
    const g = gridOf(["...", ".#.", "..."]);
    expect(inGrid(g, -1, 0)).toBe(false);
    expect(inGrid(g, 2, 2)).toBe(true);
    expect(passable(g, 1, 1)).toBe(false);
    expect(approachCells(g, { cx: 1, cy: 1 })).toHaveLength(4);
    expect(approachCells(g, { cx: 0, cy: 0 })).toHaveLength(2);
  });
});

describe("瞎逛", () => {
  it("能直走就直走(不神经质地原地乱转)", () => {
    const g = gridOf([".....", ".....", "....."]);
    // rand 恒小于 0.72 → 保持原方向
    expect(wanderStep(g, { cx: 2, cy: 1 }, 1, () => 0.1)).toBe(1);
  });

  it("前面是墙就换方向,而且不掉头往回缩", () => {
    const g = gridOf(["###", "..#", "###"]);
    const next = wanderStep(g, { cx: 1, cy: 1 }, 1, () => 0.9);
    expect(next).toBe(3); // 右边是墙,只剩左边
  });

  it("被四面围死也不会崩,原方向顶着就是了", () => {
    const g = gridOf(["###", "#.#", "###"]);
    expect(wanderStep(g, { cx: 1, cy: 1 }, 2, () => 0.5)).toBe(2);
  });
});

describe("三档脾气", () => {
  it("三档是三套走法,不是同一套改个冷却", () => {
    expect(AI_TIERS).toEqual(["wander", "chase", "flank"]);
    expect(TIER_SPECS.wander.paths).toBe(false);
    expect(TIER_SPECS.chase.paths).toBe(true);
    expect(TIER_SPECS.chase.flanks).toBe(false);
    expect(TIER_SPECS.flank.flanks).toBe(true);
    expect(tierSpec("flank").fireRange).toBeGreaterThan(tierSpec("wander").fireRange);
    expect(tierSpec("flank").think).toBeLessThan(tierSpec("wander").think);
    for (const tier of AI_TIERS) {
      expect(TIER_SPECS[tier].desc.length).toBeGreaterThan(6);
      expect(TIER_SPECS[tier].desc).not.toMatch(/爆炸|死|血|杀|伤/);
    }
  });

  /**
   * 固定 seed 的胜率断言:让电脑陪练去打一个站着不动的木头人,
   * 数一数 30 秒里把对方弹飞了几次。种子写死,所以这条断言每次跑都一样。
   */
  function sparScore(tier: AiTier, seed: number): number {
    const w: World = createWorld({
      rows: [...ARENAS[0].rows],
      mode: "versus",
      players: 2,
      limit: 30,
      target: 99,
      seed,
      aiTiers: [null, tier],
    });
    // 木头人挪到一个固定位置再站桩,免得三档打的是同一个开局
    const dummy = w.tanks[0];
    const rand = mulberry32(seed);
    dummy.y += Math.round(rand() * 4) - 2;
    while (w.status === "playing") stepWorld(w, 1 / 30, [IDLE_INPUT, IDLE_INPUT]);
    return w.scores[1];
  }

  const seeds = [11, 23, 37, 41];

  it("追人和绕后卡位的战绩,稳定压过乱转", () => {
    const total = (tier: AiTier): number => seeds.reduce((n, s) => n + sparScore(tier, s), 0);
    const wander = total("wander");
    const chase = total("chase");
    const flank = total("flank");
    expect(chase).toBeGreaterThan(wander);
    expect(flank).toBeGreaterThan(wander);
    // 会找路的那两档不是摆设:平均每局至少弹飞对手一次
    expect(chase / seeds.length).toBeGreaterThanOrEqual(1);
    expect(flank / seeds.length).toBeGreaterThanOrEqual(1);
  });

  it("同样的 seed 跑两遍结果一模一样(确定性,断言才站得住)", () => {
    expect(sparScore("chase", 23)).toBe(sparScore("chase", 23));
    expect(sparScore("flank", 41)).toBe(sparScore("flank", 41));
  });

  it("乱转也不是完全的傻子:该走的时候会走,不会一动不动", () => {
    const w = createWorld({
      rows: [...ARENAS[0].rows],
      mode: "versus",
      players: 2,
      limit: 20,
      target: 99,
      seed: 7,
      aiTiers: [null, "wander"],
    });
    const ai = w.tanks[1];
    const from = { x: ai.x, y: ai.y };
    for (let i = 0; i < 300; i++) stepWorld(w, 1 / 30, [IDLE_INPUT, IDLE_INPUT]);
    expect(Math.abs(ai.x - from.x) + Math.abs(ai.y - from.y)).toBeGreaterThan(1);
  });
});
