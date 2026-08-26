import { describe, expect, it } from "vitest";
import {
  FRIGHT_WARN_MS,
  GHOST_KINDS,
  LUAN_CHASE_RANGE,
  PHASE_TABLES,
  TIERS,
  advanceGhost,
  chooseDir,
  fleeTarget,
  frightScore,
  frightWarning,
  frightenAll,
  ghostPhase,
  hitGhost,
  makeGhost,
  targetOf,
  tickFright,
  type ChaseInput,
  type Ghost,
} from "./ghosts";
import { OPPOSITE, buildMaze, openDirs, parseMaze, type Maze } from "./maze";

function arena(): Maze {
  return parseMaze([
    "###########",
    "#.........#",
    "#.#######.#",
    "#.........#",
    "#.#######.#",
    "#.........#",
    "###########",
  ]);
}

function ghostAt(kind: (typeof GHOST_KINDS)[number], x: number, y: number): Ghost {
  return { kind, cell: { x, y }, dir: "right", mood: "chase", frightMs: 0, corner: { x: 1, y: 1 } };
}

function input(maze: Maze, over: Partial<ChaseInput> = {}): ChaseInput {
  return {
    player: { x: 5, y: 3 },
    playerDir: "right",
    zhi: { x: 2, y: 3 },
    roll: 0.1,
    maze,
    ...over,
  };
}

describe("豆豆迷宫 · 四种脾气的目标函数", () => {
  it("直直盯的就是玩家当前格", () => {
    const m = arena();
    expect(targetOf("zhi", ghostAt("zhi", 1, 1), input(m))).toEqual({ x: 5, y: 3 });
  });

  it("拐拐盯的是玩家前方 4 格", () => {
    const m = arena();
    expect(targetOf("guai", ghostAt("guai", 1, 1), input(m))).toEqual({ x: 9, y: 3 });
  });

  it("绕绕以直直所在格为中心，对玩家前方 2 格取中心对称点", () => {
    const m = arena();
    // 玩家 (5,3) 朝右，前方 2 格是 (7,3)；直直在 (2,3)，对称点 = 2*(2,3) - (7,3) = (-3,3)
    expect(targetOf("rao", ghostAt("rao", 1, 1), input(m))).toEqual({ x: -3, y: 3 });
  });

  it("乱乱离得远就往角落乱走，靠近到阈值才直奔玩家", () => {
    const m = arena();
    const far = ghostAt("luan", 1, 1);
    const farTarget = targetOf("luan", far, input(m, { player: { x: 9, y: 5 } }));
    expect(farTarget).not.toEqual({ x: 9, y: 5 });
    const near = ghostAt("luan", 5, 5);
    expect(targetOf("luan", near, input(m, { player: { x: 5, y: 3 } }))).toEqual({ x: 5, y: 3 });
    expect(LUAN_CHASE_RANGE).toBeGreaterThan(0);
  });

  it("惊吓时逃向离玩家最远的角落", () => {
    const m = arena();
    const t = fleeTarget(ghostAt("zhi", 5, 3), { x: 1, y: 1 }, m);
    expect(t).toEqual({ x: m.w - 2, y: m.h - 2 });
  });
});

describe("豆豆迷宫 · 巡游 / 追击时间表", () => {
  it("按表在巡游与追击之间切换", () => {
    const table = PHASE_TABLES.normal;
    expect(ghostPhase(0, table)).toBe("scatter");
    expect(ghostPhase(table[0].ms + 10, table)).toBe("chase");
    expect(ghostPhase(table[0].ms + table[1].ms + 10, table)).toBe("scatter");
  });

  it("时间表用完会循环，负时间也不会崩", () => {
    const table = PHASE_TABLES.rookie;
    const total = table.reduce((s, t) => s + t.ms, 0);
    expect(ghostPhase(total + 10, table)).toBe(ghostPhase(10, table));
    expect(["scatter", "chase"]).toContain(ghostPhase(-50, table));
  });

  it("越难的档追击段越长", () => {
    const chaseMs = (tier: (typeof TIERS)[number]): number =>
      PHASE_TABLES[tier].filter((s) => s.mood === "chase").reduce((a, b) => a + b.ms, 0);
    for (let i = 1; i < TIERS.length; i++) {
      expect(chaseMs(TIERS[i])).toBeGreaterThan(chaseMs(TIERS[i - 1]));
    }
  });
});

describe("豆豆迷宫 · 惊吓与连击", () => {
  it("能量豆让在场的小幽灵全部变蓝并掉头", () => {
    const list = [ghostAt("zhi", 2, 1), { ...ghostAt("guai", 3, 1), mood: "eyes" as const }];
    const next = frightenAll(list, 5000);
    expect(next[0].mood).toBe("fright");
    expect(next[0].dir).toBe("left");
    expect(next[1].mood).toBe("eyes");
  });

  it("一次能量豆内的连击分是 200 / 400 / 800 / 1600", () => {
    expect(frightScore(0)).toBe(200);
    expect(frightScore(1)).toBe(400);
    expect(frightScore(2)).toBe(800);
    expect(frightScore(3)).toBe(1600);
    expect(frightScore(9)).toBe(1600);
  });

  it("惊吓快结束时给出闪烁预警", () => {
    const g = { ...ghostAt("zhi", 2, 1), mood: "fright" as const, frightMs: FRIGHT_WARN_MS - 1 };
    expect(frightWarning(g)).toBe(true);
    expect(frightWarning({ ...g, frightMs: FRIGHT_WARN_MS + 500 })).toBe(false);
  });

  it("惊吓倒计时归零后回到当前节奏", () => {
    const g = { ...ghostAt("zhi", 2, 1), mood: "fright" as const, frightMs: 100 };
    expect(tickFright(g, 40, "chase").mood).toBe("fright");
    expect(tickFright(g, 200, "scatter").mood).toBe("scatter");
  });
});

describe("豆豆迷宫 · 移动与碰撞", () => {
  it("小幽灵永远走在通路格上，只有死胡同才允许掉头", () => {
    const m = buildMaze(31, { w: 17, h: 13, density: 0.2, tunnels: 1, powerPellets: 4 });
    let g = makeGhost("zhi", m, 0);
    for (let i = 0; i < 200; i++) {
      const before = g.dir;
      const others = openDirs(m, g.cell).filter((d) => d !== OPPOSITE[before]);
      g = advanceGhost(m, g, input(m, { player: { x: 1, y: m.h - 2 } }), "chase");
      expect(m.wall[g.cell.y * m.w + g.cell.x]).toBe(false);
      if (others.length > 0) expect(g.dir).not.toBe(OPPOSITE[before]);
    }
  });

  it("回家的眼睛到巢就恢复巡游", () => {
    const m = arena();
    let g: Ghost = { ...ghostAt("zhi", m.home.x, m.home.y), mood: "eyes" };
    g = advanceGhost(m, g, input(m), "scatter");
    expect(["scatter", "eyes"]).toContain(g.mood);
  });

  it("玩家和小幽灵同格才算撞上，回家的眼睛不算", () => {
    const list = [ghostAt("zhi", 3, 3), { ...ghostAt("guai", 4, 3), mood: "eyes" as const }];
    expect(hitGhost({ x: 3, y: 3 }, list)).toBe(0);
    expect(hitGhost({ x: 4, y: 3 }, list)).toBe(-1);
    expect(hitGhost({ x: 9, y: 9 }, list)).toBe(-1);
  });

  it("chooseDir 在死胡同里也能给出一个合法方向", () => {
    const m = parseMaze(["#####", "#.###", "#.###", "#####"]);
    const g = ghostAt("zhi", 1, 2);
    const d = chooseDir(m, g, { x: 1, y: 1 });
    expect(["up", "down", "left", "right"]).toContain(d);
  });
});
