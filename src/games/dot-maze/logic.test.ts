import { describe, expect, it } from "vitest";
import { TIER_FRIGHT_MS } from "./ghosts";
import {
  FRUITS,
  RESPAWN_GRACE_MS,
  createRun,
  inTunnel,
  remaining,
  requestTurn,
  steerGhost,
  stepRun,
} from "./logic";
import { cellIndex, parseMaze, type Maze } from "./maze";
import type { RunConfig } from "./logic";

function ring(): Maze {
  return parseMaze([
    "#########",
    "#.......#",
    "#.#####.#",
    "-.......-",
    "#.#####.#",
    "#..o....#",
    "#########",
  ]);
}

function cfg(over: Partial<RunConfig> = {}): RunConfig {
  return {
    maze: ring(),
    tier: "rookie",
    ghostCount: 0,
    lives: 3,
    stepMs: 100,
    fruitAt: [],
    fog: false,
    ...over,
  };
}

describe("豆豆迷宫 · 一局的推进", () => {
  it("吃豆加分，场上豆子随之减少", () => {
    const state = createRun(cfg(), 1);
    const before = remaining(state);
    requestTurn(state, "right", 0);
    stepRun(state, 400);
    expect(state.score).toBeGreaterThan(0);
    expect(remaining(state)).toBeLessThan(before);
  });

  it("能量豆让在场小幽灵变蓝，持续时间按档位来", () => {
    const state = createRun(cfg({ ghostCount: 2, maze: ring() }), 2);
    const m = state.maze;
    // 直接把玩家挪到能量豆旁边
    state.player = { x: 2, y: 5 };
    state.dir = "right";
    stepRun(state, 120);
    expect(m.power[cellIndex(m, 3, 5)]).toBe(false);
    expect(state.ghosts.every((g) => g.mood === "fright")).toBe(true);
    expect(state.ghosts[0].frightMs).toBeLessThanOrEqual(TIER_FRIGHT_MS.rookie);
  });

  it("惊吓中撞上小幽灵是得分而不是掉命，连击 200 起跳", () => {
    const state = createRun(cfg({ ghostCount: 1 }), 3);
    state.player = { x: 2, y: 5 };
    state.dir = "right";
    stepRun(state, 120);
    const lives = state.lives;
    state.ghosts = state.ghosts.map((g) => ({ ...g, cell: { x: 4, y: 5 } }));
    state.graceMs = 0;
    stepRun(state, 120);
    expect(state.lives).toBe(lives);
    expect(state.score).toBeGreaterThanOrEqual(200);
  });

  it("被追上掉一颗小星命并重置位置，还给一段无敌宽限", () => {
    const state = createRun(cfg({ ghostCount: 1 }), 4);
    state.graceMs = 0;
    state.ghosts = state.ghosts.map((g) => ({ ...g, mood: "chase" as const, cell: { ...state.player } }));
    state.player = { x: 1, y: 1 };
    state.dir = "right";
    state.ghosts = state.ghosts.map((g) => ({ ...g, cell: { x: 2, y: 1 } }));
    stepRun(state, 120);
    expect(state.lives).toBe(2);
    expect(state.graceMs).toBeGreaterThan(0);
    expect(state.graceMs).toBeLessThanOrEqual(RESPAWN_GRACE_MS);
    expect(state.player).toEqual(state.maze.spawn);
  });

  it("小星命掉光本局结束，文案是温柔的", () => {
    const state = createRun(cfg({ ghostCount: 1, lives: 1 }), 5);
    state.graceMs = 0;
    state.player = { x: 1, y: 1 };
    state.dir = "right";
    state.ghosts = state.ghosts.map((g) => ({ ...g, mood: "chase" as const, cell: { x: 2, y: 1 } }));
    stepRun(state, 120);
    expect(state.over).toBe(true);
    expect(state.won).toBe(false);
    expect(state.notice).toContain("休息");
  });

  it("豆子吃光就算赢", () => {
    const state = createRun(cfg(), 6);
    const m = state.maze;
    m.dot.fill(false);
    m.power.fill(false);
    m.dot[cellIndex(m, 2, 1)] = true;
    state.player = { x: 1, y: 1 };
    state.dir = "right";
    stepRun(state, 120);
    expect(state.won).toBe(true);
    expect(state.over).toBe(true);
  });

  it("隧道行的最外两格算穿隧道，速度会变化", () => {
    const state = createRun(cfg(), 7);
    state.player = { x: 1, y: 3 };
    expect(inTunnel(state)).toBe(true);
    state.player = { x: 4, y: 3 };
    expect(inTunnel(state)).toBe(false);
  });

  it("玩家永远不会走进墙里", () => {
    const state = createRun(cfg({ ghostCount: 2 }), 8);
    const dirs = ["up", "left", "down", "right"] as const;
    for (let i = 0; i < 400; i++) {
      requestTurn(state, dirs[i % 4], state.elapsed);
      stepRun(state, 30);
      const m = state.maze;
      expect(m.wall[cellIndex(m, state.player.x, state.player.y)]).toBe(false);
      if (state.over) break;
    }
  });

  it("果子按时间表出现，走上去就能加分", () => {
    const state = createRun(cfg({ fruitAt: [300] }), 9);
    for (let i = 0; i < 5; i++) stepRun(state, 100);
    expect(state.fruit).not.toBeNull();
    const fruitCell = state.fruit!.cell;
    const kind = state.fruit!.kind;
    // 站到果子左边一格，往右走一步吃掉它
    const from = { x: fruitCell.x - 1, y: fruitCell.y };
    expect(state.maze.wall[cellIndex(state.maze, from.x, from.y)]).toBe(false);
    state.player = from;
    state.dir = "right";
    const before = state.score;
    stepRun(state, 110);
    expect(state.fruit).toBeNull();
    expect(state.score - before).toBeGreaterThanOrEqual(FRUITS[kind].score);
  });

  it("结束之后再推进不会改变结果", () => {
    const state = createRun(cfg({ ghostCount: 0 }), 10);
    state.over = true;
    const snapshot = { score: state.score, elapsed: state.elapsed };
    stepRun(state, 500);
    expect(state.score).toBe(snapshot.score);
    expect(state.elapsed).toBe(snapshot.elapsed);
  });
});

/* ------------------------------------------------------------------ */
/* 双人追逃：星星操纵的那只小幽灵                                       */
/* ------------------------------------------------------------------ */

/**
 * 上排是一条笔直的长廊，巢在最右头，出生点在最左头；
 * 下排另开一条通道，方便把朵朵停在角落里单独看小幽灵怎么走。
 */
function corridor(): Maze {
  return parseMaze([
    "###########",
    "#S.......H#",
    "#.#######.#",
    "#.........#",
    "###########",
  ]);
}

/** 把朵朵停在左下角：脚下那格的下方是墙，它就走不动了，观察小幽灵不受干扰 */
function parkPlayer(state: ReturnType<typeof createRun>): void {
  state.player = { x: 1, y: 3 };
  state.dir = "down";
}

describe("豆豆迷宫 · 星星操纵一只小幽灵", () => {
  it("没有指定 controlled 时四只全归 AI", () => {
    const state = createRun(cfg({ ghostCount: 4 }), 1);
    expect(state.controlled).toBe(-1);
    expect(steerGhost(state, "up")).toBe(false);
  });

  it("越界的 controlled 下标会被忽略，不会指到不存在的小幽灵上", () => {
    expect(createRun(cfg({ ghostCount: 2, controlled: 5 }), 1).controlled).toBe(-1);
    expect(createRun(cfg({ ghostCount: 0, controlled: 0 }), 1).controlled).toBe(-1);
    expect(createRun(cfg({ ghostCount: 2, controlled: 1 }), 1).controlled).toBe(1);
  });

  it("被操纵的那只完全听星星的，AI 不会再把方向覆盖掉", () => {
    const state = createRun(cfg({ maze: corridor(), ghostCount: 1, controlled: 0 }), 1);
    parkPlayer(state);
    expect(state.ghosts[0].cell).toEqual({ x: 9, y: 1 });
    expect(steerGhost(state, "left")).toBe(true);
    let x = state.ghosts[0].cell.x;
    for (let i = 0; i < 4; i++) {
      stepRun(state, 200);
      expect(state.ghosts[0].dir).toBe("left");
      expect(state.ghosts[0].cell.x).toBeLessThan(x);
      x = state.ghosts[0].cell.x;
    }
  });

  it("撞墙的方向不采纳，小幽灵保持原方向继续走，不会卡死", () => {
    const state = createRun(cfg({ maze: corridor(), ghostCount: 1, controlled: 0 }), 1);
    parkPlayer(state);
    steerGhost(state, "left");
    stepRun(state, 200);
    const before = state.ghosts[0].cell.x;
    // 长廊上方整排都是墙，硬按「上」不该让它停在原地
    steerGhost(state, "up");
    stepRun(state, 200);
    expect(state.ghosts[0].dir).toBe("left");
    expect(state.ghosts[0].cell.x).toBeLessThan(before);
  });

  it("被绕晕变成眼睛之后交还给自动寻路，自己飘回巢", () => {
    const state = createRun(cfg({ maze: corridor(), ghostCount: 1, controlled: 0 }), 1);
    parkPlayer(state);
    state.ghosts = state.ghosts.map((g) => ({ ...g, mood: "eyes" as const, cell: { x: 3, y: 3 } }));
    // 星星这时按什么都不算数，眼睛只认巢
    steerGhost(state, "left");
    for (let i = 0; i < 40 && state.ghosts[0].mood === "eyes"; i++) stepRun(state, 200);
    expect(state.ghosts[0].mood).not.toBe("eyes");
    expect(state.ghosts[0].cell).toEqual({ x: 9, y: 1 });
  });

  it("掉一次命之后 controlled 还指着同一只，位置也回到巢", () => {
    const state = createRun(cfg({ maze: corridor(), ghostCount: 2, controlled: 1, lives: 3 }), 1);
    const kind = state.ghosts[1].kind;
    // 把被操纵的那只搬到朵朵下一步要踩的格子上
    state.ghosts = state.ghosts.map((g, i) => (i === 1 ? { ...g, cell: { x: 2, y: 1 } } : g));
    requestTurn(state, "right", state.elapsed);
    stepRun(state, 100);
    expect(state.lives).toBe(2);
    expect(state.notice).toContain("绕晕");
    expect(state.controlled).toBe(1);
    expect(state.ghosts[1].kind).toBe(kind);
  });
});
