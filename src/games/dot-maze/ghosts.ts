/**
 * 豆豆迷宫 · 四只迷途小幽灵。
 *
 * 它们不是怪物，是在迷宫里迷路的圆头圆脑小伙伴：碰到玩家只是把人绕晕，
 * 玩家掉一颗小星命，小伙伴自己捂着眼睛飘回巢里重新开始。
 */
import {
  DELTA,
  DIRS,
  OPPOSITE,
  canTurn,
  openDirs,
  stepCell,
  wrapTunnel,
  type Cell,
  type Dir,
  type Maze,
} from "./maze";

/** 四种脾气：直直=直追，拐拐=抄前方，绕绕=对称包夹，乱乱=远则乱走近才追 */
export type GhostKind = "zhi" | "guai" | "rao" | "luan";

export const GHOST_KINDS: readonly GhostKind[] = ["zhi", "guai", "rao", "luan"];

export const GHOST_NAMES: Record<GhostKind, string> = {
  zhi: "直直",
  guai: "拐拐",
  rao: "绕绕",
  luan: "乱乱",
};

export const GHOST_COLORS: Record<GhostKind, string> = {
  zhi: "#FF9AB0",
  guai: "#FFC48A",
  rao: "#9FD8F5",
  luan: "#C7B3F2",
};

/** 乱乱在这个曼哈顿距离之内才开始认真追 */
export const LUAN_CHASE_RANGE = 8;

export type GhostMood = "scatter" | "chase" | "fright" | "eyes";

export interface Ghost {
  kind: GhostKind;
  cell: Cell;
  dir: Dir;
  mood: GhostMood;
  /** 惊吓剩余毫秒（mood==="fright" 时有效） */
  frightMs: number;
  /** 各自的巡游角落 */
  corner: Cell;
}

export interface PhaseSlot {
  mood: "scatter" | "chase";
  /** 这一段持续多少毫秒 */
  ms: number;
}

/** 节奏表：巡游 → 追击 交替，越往后追击段越长 */
export const PHASE_TABLES: Record<string, PhaseSlot[]> = {
  rookie: [
    { mood: "scatter", ms: 9000 },
    { mood: "chase", ms: 8000 },
    { mood: "scatter", ms: 8000 },
    { mood: "chase", ms: 10000 },
  ],
  normal: [
    { mood: "scatter", ms: 7000 },
    { mood: "chase", ms: 20000 },
    { mood: "scatter", ms: 7000 },
    { mood: "chase", ms: 20000 },
  ],
  pro: [
    { mood: "scatter", ms: 5000 },
    { mood: "chase", ms: 25000 },
    { mood: "scatter", ms: 5000 },
    { mood: "chase", ms: 30000 },
  ],
  hell: [
    { mood: "scatter", ms: 3000 },
    { mood: "chase", ms: 40000 },
    { mood: "scatter", ms: 2000 },
    { mood: "chase", ms: 60000 },
  ],
};

export type Tier = keyof typeof PHASE_TABLES;

export const TIERS: readonly Tier[] = ["rookie", "normal", "pro", "hell"];

export const TIER_LABELS: Record<Tier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱",
};

/** 各档幽灵速度倍率（玩家恒定 1） */
export const TIER_GHOST_SPEED: Record<Tier, number> = {
  rookie: 0.72,
  normal: 0.86,
  pro: 0.95,
  hell: 1.04,
};

/** 惊吓持续时间（毫秒），越难越短 */
export const TIER_FRIGHT_MS: Record<Tier, number> = {
  rookie: 9000,
  normal: 7000,
  pro: 5000,
  hell: 3500,
};

/** 惊吓即将结束时开始闪烁预警的剩余毫秒 */
export const FRIGHT_WARN_MS = 1600;

/**
 * 按时间表算出此刻是巡游还是追击。表会循环使用，最后一段用完就从头再来。
 */
export function ghostPhase(elapsedMs: number, table: readonly PhaseSlot[]): "scatter" | "chase" {
  if (table.length === 0) return "chase";
  const total = table.reduce((s, t) => s + t.ms, 0);
  if (total <= 0) return "chase";
  let t = elapsedMs % total;
  if (t < 0) t += total;
  for (const slot of table) {
    if (t < slot.ms) return slot.mood;
    t -= slot.ms;
  }
  return table[table.length - 1].mood;
}

export interface ChaseInput {
  /** 玩家所在格 */
  player: Cell;
  /** 玩家朝向 */
  playerDir: Dir;
  /** 直直所在格（绕绕要用） */
  zhi: Cell;
  /** 乱乱的随机数（0–1），远距离时决定往哪个角落乱走 */
  roll: number;
  maze: Maze;
  /** 地狱档的包抄：拐拐走玩家前方、绕绕绕到玩家后方，把人夹在中间 */
  flank?: boolean;
}

function ahead(cell: Cell, dir: Dir, n: number): Cell {
  const d = DELTA[dir];
  return { x: cell.x + d.dx * n, y: cell.y + d.dy * n };
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * 四种脾气各自的目标格（可能落在墙里甚至地图外，寻路时按最近方向逼近即可）：
 *  - 直直：玩家当前格；
 *  - 拐拐：玩家前方 4 格；
 *  - 绕绕：以直直所在格为中心，对「玩家前方 2 格」取中心对称点；
 *  - 乱乱：离得远就随便挑个角落，靠近到阈值才直奔玩家。
 */
export function targetOf(kind: GhostKind, self: Ghost, input: ChaseInput): Cell {
  if (kind === "zhi") return { ...input.player };
  if (kind === "guai") return ahead(input.player, input.playerDir, 4);
  if (kind === "rao") {
    const front = ahead(input.player, input.playerDir, 2);
    return { x: 2 * input.zhi.x - front.x, y: 2 * input.zhi.y - front.y };
  }
  // 乱乱
  if (manhattan(self.cell, input.player) <= LUAN_CHASE_RANGE) return { ...input.player };
  const corners: Cell[] = [
    { x: 1, y: 1 },
    { x: input.maze.w - 2, y: 1 },
    { x: 1, y: input.maze.h - 2 },
    { x: input.maze.w - 2, y: input.maze.h - 2 },
  ];
  const pick = Math.min(corners.length - 1, Math.max(0, Math.floor(input.roll * corners.length)));
  return corners[pick];
}

/** 惊吓状态下逃跑的目标：离玩家最远的角落 */
export function fleeTarget(self: Ghost, player: Cell, maze: Maze): Cell {
  const corners: Cell[] = [
    { x: 1, y: 1 },
    { x: maze.w - 2, y: 1 },
    { x: 1, y: maze.h - 2 },
    { x: maze.w - 2, y: maze.h - 2 },
  ];
  let best = corners[0];
  let bestD = -1;
  for (const c of corners) {
    const d = manhattan(c, player);
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * 选择下一步方向：不许原地掉头（除非无路可走），在可走方向里挑离目标最近的。
 * 平手时按 上→右→下→左 的固定顺序，保证同一 seed 完全可复现。
 */
export function chooseDir(maze: Maze, ghost: Ghost, target: Cell): Dir {
  const options = openDirs(maze, ghost.cell).filter((d) => d !== OPPOSITE[ghost.dir]);
  const usable = options.length > 0 ? options : openDirs(maze, ghost.cell);
  if (usable.length === 0) return ghost.dir;
  let best = usable[0];
  let bestD = Infinity;
  for (const d of usable) {
    const next = stepCell(maze, ghost.cell, d);
    const dist = (next.x - target.x) ** 2 + (next.y - target.y) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

/** 让全体在场小幽灵进入惊吓（回家路上的眼睛不受影响），并立即掉头 */
export function frightenAll(ghosts: Ghost[], ms: number): Ghost[] {
  return ghosts.map((g) => {
    if (g.mood === "eyes") return g;
    return { ...g, mood: "fright" as GhostMood, frightMs: ms, dir: OPPOSITE[g.dir] };
  });
}

/** 一次能量豆内连续绕晕第 chain 只（0 基）的得分：200 / 400 / 800 / 1600 */
export function frightScore(chain: number): number {
  const n = Math.max(0, Math.floor(chain));
  return 200 * 2 ** Math.min(n, 3);
}

/** 惊吓快结束了，该闪烁提醒 */
export function frightWarning(ghost: Ghost): boolean {
  return ghost.mood === "fright" && ghost.frightMs <= FRIGHT_WARN_MS;
}

/** 玩家和哪只小幽灵撞在同一格上（返回下标，没有返回 -1） */
export function hitGhost(player: Cell, ghosts: readonly Ghost[]): number {
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    if (g.mood === "eyes") continue;
    if (g.cell.x === player.x && g.cell.y === player.y) return i;
  }
  return -1;
}

/**
 * 巢门口的第 slot 个位置。四只小幽灵不能叠在同一格上出生，
 * 否则脾气再不一样也会成对地走同一条路线。往巢的各个出口依次排开，
 * 排不下就退回巢里。
 */
export function homeSlot(maze: Maze, slot: number): Cell {
  const n = Math.max(0, Math.floor(slot));
  if (n === 0) return wrapTunnel(maze, maze.home.x, maze.home.y);
  const exits = openDirs(maze, maze.home);
  if (exits.length === 0) return wrapTunnel(maze, maze.home.x, maze.home.y);
  const dir = exits[(n - 1) % exits.length];
  const first = stepCell(maze, maze.home, dir);
  // 出口不够用时，第二圈往同一个方向再走一格
  if (n - 1 < exits.length) return first;
  return canTurn(maze, first, dir) ? stepCell(maze, first, dir) : first;
}

/** 建一只小幽灵 */
export function makeGhost(kind: GhostKind, maze: Maze, slot: number): Ghost {
  const corners: Cell[] = [
    { x: maze.w - 2, y: 1 },
    { x: 1, y: 1 },
    { x: maze.w - 2, y: maze.h - 2 },
    { x: 1, y: maze.h - 2 },
  ];
  const start = homeSlot(maze, slot);
  return {
    kind,
    cell: start,
    dir: slot % 2 === 0 ? "up" : "left",
    mood: "scatter",
    frightMs: 0,
    corner: corners[slot % corners.length],
  };
}

/**
 * 让一只小幽灵往前走一格。回家（eyes）的直奔巢穴，到家就恢复巡游。
 * 返回新的小幽灵对象，不改原对象。
 */
export function advanceGhost(maze: Maze, ghost: Ghost, input: ChaseInput, phase: "scatter" | "chase"): Ghost {
  let target: Cell;
  if (ghost.mood === "eyes") target = maze.home;
  else if (ghost.mood === "fright") target = fleeTarget(ghost, input.player, maze);
  else if (phase === "scatter") target = ghost.corner;
  else if (input.flank && FLANK_KINDS[ghost.kind] !== undefined) {
    target = flankTarget(input, FLANK_KINDS[ghost.kind]!);
  } else target = targetOf(ghost.kind, ghost, input);

  const dir = chooseDir(maze, ghost, target);
  const cell = canTurn(maze, ghost.cell, dir) ? stepCell(maze, ghost.cell, dir) : ghost.cell;
  const next: Ghost = { ...ghost, dir, cell };
  if (next.mood === "eyes" && cell.x === maze.home.x && cell.y === maze.home.y) {
    next.mood = phase;
    next.frightMs = 0;
  }
  if (next.mood !== "eyes" && next.mood !== "fright") next.mood = phase;
  return next;
}

/** 惊吓倒计时；归零后回到当前节奏 */
export function tickFright(ghost: Ghost, dtMs: number, phase: "scatter" | "chase"): Ghost {
  if (ghost.mood !== "fright") return ghost;
  const left = ghost.frightMs - dtMs;
  if (left <= 0) return { ...ghost, mood: phase, frightMs: 0 };
  return { ...ghost, frightMs: left };
}

/** 地狱档的包抄：让其中两只改用「玩家前方 6 格」与「玩家后方 6 格」当目标 */
export function flankTarget(input: ChaseInput, back: boolean): Cell {
  const dir: Dir = back ? OPPOSITE[input.playerDir] : input.playerDir;
  return ahead(input.player, dir, 6);
}

/** 包抄时哪两只改走对侧路线：拐拐堵前面，绕绕绕到后面。直直和乱乱照旧 */
export const FLANK_KINDS: Partial<Record<GhostKind, boolean>> = {
  guai: false,
  rao: true,
};

/** 包抄只在地狱档打开 */
export function tierFlanks(tier: Tier): boolean {
  return tier === "hell";
}

/** 保证 DIRS 顺序稳定（渲染与测试都依赖它） */
export const DIR_ORDER: readonly Dir[] = DIRS;
