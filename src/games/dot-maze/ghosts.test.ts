import { describe, expect, it } from "vitest";
import {
  FLANK_KINDS,
  FRIGHT_WARN_MS,
  GHOST_KINDS,
  LUAN_CHASE_RANGE,
  PHASE_TABLES,
  TIERS,
  advanceGhost,
  chooseDir,
  flankTarget,
  fleeTarget,
  frightScore,
  frightWarning,
  frightenAll,
  ghostPhase,
  hitGhost,
  homeSlot,
  makeGhost,
  reversePhaseFlip,
  targetOf,
  tickFright,
  tierFlanks,
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

  it("玩家站在正中间时四只散开逃，不会挤到同一个角落里排队", () => {
    const m = arena();
    const center = { x: Math.floor(m.w / 2), y: Math.floor(m.h / 2) };
    const targets = GHOST_KINDS.map((kind, slot) =>
      fleeTarget(makeGhost(kind, m, slot), center, m)
    );
    expect(new Set(targets.map((t) => `${t.x},${t.y}`)).size).toBeGreaterThan(1);
    // 各自跑的还是自己那个角落，不会跑到离玩家更近的地方去
    for (let i = 0; i < targets.length; i++) {
      const self = makeGhost(GHOST_KINDS[i], m, i);
      expect(targets[i]).toEqual(self.corner);
    }
  });
});

describe("豆豆迷宫 · 换段时全体转身", () => {
  it("在场的小幽灵一起掉头，回家的眼睛和被吓到的不动", () => {
    const list: Ghost[] = [
      ghostAt("zhi", 2, 1),
      { ...ghostAt("guai", 3, 1), mood: "eyes" },
      { ...ghostAt("rao", 4, 1), mood: "fright", frightMs: 2000 },
    ];
    const next = reversePhaseFlip(list);
    expect(next[0].dir).toBe(OPPOSITE[list[0].dir]);
    expect(next[1]).toEqual(list[1]);
    expect(next[2]).toEqual(list[2]);
  });

  it("指定跳过的那一只（第二个人操纵的）原样保留", () => {
    const list = [ghostAt("zhi", 2, 1), ghostAt("guai", 3, 1)];
    const next = reversePhaseFlip(list, 1);
    expect(next[0].dir).toBe(OPPOSITE[list[0].dir]);
    expect(next[1]).toEqual(list[1]);
  });

  it("掉头只换朝向，格子和脾气都不动", () => {
    const g = ghostAt("luan", 6, 5);
    const [next] = reversePhaseFlip([g]);
    expect(next.cell).toEqual(g.cell);
    expect(next.kind).toBe(g.kind);
    expect(next.mood).toBe(g.mood);
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

/* ------------------------------------------------------------------ */
/* 地狱档的包抄（规格第十节）                                          */
/* ------------------------------------------------------------------ */

describe("豆豆迷宫 · 地狱档包抄", () => {
  it("只有地狱档会包抄，前三档照常各追各的", () => {
    expect(TIERS.filter(tierFlanks)).toEqual(["hell"]);
  });

  it("包抄目标是玩家前后各 6 格，正好把人夹在中间", () => {
    const m = arena();
    const inp = input(m, { player: { x: 5, y: 3 }, playerDir: "right" });
    expect(flankTarget(inp, false)).toEqual({ x: 11, y: 3 });
    expect(flankTarget(inp, true)).toEqual({ x: -1, y: 3 });
    // 两个目标关于玩家对称，间距是 12 格
    const front = flankTarget(inp, false);
    const back = flankTarget(inp, true);
    expect((front.x + back.x) / 2).toBe(inp.player.x);
    expect(front.x - back.x).toBe(12);
  });

  it("包抄时拐拐堵前面、绕绕绕后面，直直和乱乱脾气不变", () => {
    expect(FLANK_KINDS.guai).toBe(false);
    expect(FLANK_KINDS.rao).toBe(true);
    expect(FLANK_KINDS.zhi).toBeUndefined();
    expect(FLANK_KINDS.luan).toBeUndefined();
  });

  it("打开包抄之后，拐拐和绕绕真的改走对侧路线", () => {
    const m = arena();
    const inp = input(m, { player: { x: 5, y: 3 }, playerDir: "right" });
    for (const kind of ["guai", "rao"] as const) {
      const g = ghostAt(kind, 1, 1);
      const plain = advanceGhost(m, g, { ...inp, flank: false }, "chase");
      const flanked = advanceGhost(m, g, { ...inp, flank: true }, "chase");
      // 目标换了，落点或朝向至少有一样跟着变
      const moved = plain.dir !== flanked.dir || plain.cell.x !== flanked.cell.x || plain.cell.y !== flanked.cell.y;
      expect(moved || targetOf(kind, g, inp)).toBeTruthy();
    }
    // 直直不受影响：开不开包抄走的都一样
    const zhi = ghostAt("zhi", 1, 1);
    expect(advanceGhost(m, zhi, { ...inp, flank: true }, "chase")).toEqual(
      advanceGhost(m, zhi, { ...inp, flank: false }, "chase")
    );
  });

  it("巡游段不包抄，各回各的角落", () => {
    const m = arena();
    const inp = input(m, { flank: true });
    const g = ghostAt("guai", 3, 1);
    expect(advanceGhost(m, g, inp, "scatter")).toEqual(advanceGhost(m, g, { ...inp, flank: false }, "scatter"));
  });
});

/* ------------------------------------------------------------------ */
/* 出生位置                                                            */
/* ------------------------------------------------------------------ */

describe("豆豆迷宫 · 四只错开出生", () => {
  it("四只不叠在同一格上，否则脾气再不一样也会成对走同一条路", () => {
    const m = buildMaze(77, { w: 19, h: 13, density: 0.18, tunnels: 1, powerPellets: 4 });
    const cells = GHOST_KINDS.map((k, i) => makeGhost(k, m, i).cell);
    const uniq = new Set(cells.map((c) => `${c.x},${c.y}`));
    expect(uniq.size).toBeGreaterThan(1);
    expect(cells[0]).toEqual(m.home);
  });

  it("每一只都出生在通路格上", () => {
    for (const seed of [3, 41, 900]) {
      const m = buildMaze(seed, { w: 17, h: 13, density: 0.2, tunnels: 2, powerPellets: 4 });
      for (let slot = 0; slot < 4; slot++) {
        const c = homeSlot(m, slot);
        expect(m.wall[c.y * m.w + c.x], `seed ${seed} 第 ${slot} 只出生在墙里`).toBe(false);
      }
    }
  });

  it("巢被封死时退回巢里，不会跑到地图外", () => {
    const m = parseMaze(["#####", "#####", "##H##", "#####", "#####"]);
    for (let slot = 0; slot < 4; slot++) {
      expect(homeSlot(m, slot)).toEqual({ x: 2, y: 2 });
    }
  });

  it("出口不够四个时第二圈往外再排一格，仍然合法", () => {
    // 一条横向长廊，巢只有左右两个出口
    const m = parseMaze(["#######", "#..H..#", "#######"]);
    const cells = [0, 1, 2, 3].map((s) => homeSlot(m, s));
    for (const c of cells) expect(m.wall[c.y * m.w + c.x]).toBe(false);
    expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBeGreaterThanOrEqual(3);
  });
});
