/**
 * 豆豆迷宫 · 一局的状态机（纯逻辑，不碰 DOM）。
 *
 * 用「格子 + 步进」建模：每走满一格才结算一次，前端负责在两格之间插值渲染。
 */
import {
  GHOST_KINDS,
  PHASE_TABLES,
  TIER_FRIGHT_MS,
  TIER_GHOST_SPEED,
  advanceGhost,
  frightScore,
  frightenAll,
  ghostPhase,
  hitGhost,
  makeGhost,
  tickFright,
  type ChaseInput,
  type Ghost,
  type Tier,
} from "./ghosts";
import {
  TUNNEL_SPEED_SCALE,
  bufferedTurn,
  canTurn,
  cellIndex,
  dotsLeft,
  emptyBuffer,
  isTunnelRow,
  stepCell,
  type Cell,
  type Dir,
  type Maze,
  type TurnBuffer,
} from "./maze";

/** 三种原创奖励果子 */
export const FRUITS = [
  { name: "星果", emoji: "⭐", score: 100 },
  { name: "糖梨", emoji: "🍐", score: 200 },
  { name: "蜜柑", emoji: "🍊", score: 300 },
] as const;

export type FruitIndex = 0 | 1 | 2;

export interface RunConfig {
  maze: Maze;
  tier: Tier;
  /** 场上小幽灵数量 0–4 */
  ghostCount: number;
  /** 小星命数 */
  lives: number;
  /** 玩家每走一格需要多少毫秒 */
  stepMs: number;
  /** 果子出现的时刻（毫秒，相对开局），空数组表示不出果子 */
  fruitAt: number[];
  /** 视野变小（迷雾章节），只影响渲染 */
  fog: boolean;
}

export interface RunState {
  cfg: RunConfig;
  maze: Maze;
  /** 玩家格 */
  player: Cell;
  dir: Dir;
  /** 缓存的转向 */
  buffer: TurnBuffer;
  ghosts: Ghost[];
  score: number;
  lives: number;
  /** 一次能量豆内已经绕晕了几只 */
  chain: number;
  /** 开局至今的毫秒 */
  elapsed: number;
  /** 玩家离下一格还差多少毫秒 */
  playerCd: number;
  /** 小幽灵离下一格还差多少毫秒 */
  ghostCd: number;
  /** 场上的果子（null 表示没有） */
  fruit: { cell: Cell; kind: FruitIndex; leftMs: number } | null;
  fruitDone: number;
  over: boolean;
  won: boolean;
  /** 最近一条播报（给 HUD 用） */
  notice: string;
  /** 掉命后的短暂无敌时间 */
  graceMs: number;
  /** 确定性随机游标（乱乱与果子位置用） */
  rollSeed: number;
}

/** 果子在场上停留多久 */
export const FRUIT_LIFE_MS = 9000;

/** 掉命后重置的无敌宽限 */
export const RESPAWN_GRACE_MS = 1200;

function nextRoll(state: RunState): number {
  state.rollSeed = (Math.imul(state.rollSeed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1;
  return (state.rollSeed >>> 8) / 0x1000000;
}

export function createRun(cfg: RunConfig, seed = 1): RunState {
  const maze: Maze = {
    ...cfg.maze,
    wall: cfg.maze.wall.slice(),
    dot: cfg.maze.dot.slice(),
    power: cfg.maze.power.slice(),
    tunnelRows: cfg.maze.tunnelRows.slice(),
  };
  const ghosts: Ghost[] = [];
  for (let i = 0; i < Math.max(0, Math.min(4, cfg.ghostCount)); i++) {
    ghosts.push(makeGhost(GHOST_KINDS[i], maze, i));
  }
  return {
    cfg,
    maze,
    player: { ...maze.spawn },
    dir: "right",
    buffer: emptyBuffer(),
    ghosts,
    score: 0,
    lives: cfg.lives,
    chain: 0,
    elapsed: 0,
    playerCd: cfg.stepMs,
    ghostCd: cfg.stepMs / TIER_GHOST_SPEED[cfg.tier],
    fruit: null,
    fruitDone: 0,
    over: false,
    won: false,
    notice: "",
    graceMs: 0,
    rollSeed: (seed >>> 0) || 1,
  };
}

/** 记录一次转向请求（输入缓冲） */
export function requestTurn(state: RunState, dir: Dir, now: number): void {
  state.buffer = { dir, at: now };
}

/** 立刻转向（合法才生效）。给自动演示与测试机器人用，真人输入一律走 requestTurn */
export function setDir(state: RunState, dir: Dir): boolean {
  if (!canTurn(state.maze, state.player, dir)) return false;
  state.dir = dir;
  state.buffer = emptyBuffer();
  return true;
}

/** 玩家当前格是否在隧道行的最外侧两格上（穿隧道要减速） */
export function inTunnel(state: RunState): boolean {
  const { maze, player } = state;
  if (!isTunnelRow(maze, player.y)) return false;
  return player.x <= 1 || player.x >= maze.w - 2;
}

function playerStepMs(state: RunState): number {
  return inTunnel(state) ? state.cfg.stepMs / TUNNEL_SPEED_SCALE : state.cfg.stepMs;
}

function eatAt(state: RunState, cell: Cell): void {
  const i = cellIndex(state.maze, cell.x, cell.y);
  if (state.maze.dot[i]) {
    state.maze.dot[i] = false;
    state.score += 10;
    state.notice = "";
  } else if (state.maze.power[i]) {
    state.maze.power[i] = false;
    state.score += 50;
    state.chain = 0;
    state.ghosts = frightenAll(state.ghosts, TIER_FRIGHT_MS[state.cfg.tier]);
    state.notice = "能量豆亮啦，小幽灵变成昏昏蓝！";
  }
  if (state.fruit && state.fruit.cell.x === cell.x && state.fruit.cell.y === cell.y) {
    state.score += FRUITS[state.fruit.kind].score;
    state.notice = `吃到${FRUITS[state.fruit.kind].name}，加 ${FRUITS[state.fruit.kind].score} 分！`;
    state.fruit = null;
  }
}

function resetPositions(state: RunState): void {
  state.player = { ...state.maze.spawn };
  state.dir = "right";
  state.buffer = emptyBuffer();
  state.ghosts = state.ghosts.map((g, i) => makeGhost(g.kind, state.maze, i));
  state.playerCd = state.cfg.stepMs;
  state.ghostCd = state.cfg.stepMs / TIER_GHOST_SPEED[state.cfg.tier];
  state.graceMs = RESPAWN_GRACE_MS;
  state.chain = 0;
}

function loseLife(state: RunState): void {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    state.over = true;
    state.notice = "今天玩到这里，休息一下再来。";
    return;
  }
  state.notice = "被绕晕啦，深呼吸再来一次。";
  resetPositions(state);
}

function checkCollision(state: RunState): void {
  if (state.over || state.graceMs > 0) return;
  const i = hitGhost(state.player, state.ghosts);
  if (i < 0) return;
  const g = state.ghosts[i];
  if (g.mood === "fright") {
    const gain = frightScore(state.chain);
    state.chain += 1;
    state.score += gain;
    state.ghosts = state.ghosts.map((x, k) =>
      k === i ? { ...x, mood: "eyes" as const, frightMs: 0 } : x
    );
    state.notice = `绕回来啦，+${gain} 分！`;
    return;
  }
  loseLife(state);
}

function spawnFruitIfDue(state: RunState): void {
  if (state.fruitDone >= state.cfg.fruitAt.length) return;
  if (state.elapsed < state.cfg.fruitAt[state.fruitDone]) return;
  state.fruitDone += 1;
  const kind = Math.min(2, Math.floor(nextRoll(state) * 3)) as FruitIndex;
  const open: Cell[] = [];
  for (let y = 1; y < state.maze.h - 1; y++) {
    for (let x = 1; x < state.maze.w - 1; x++) {
      if (state.maze.wall[cellIndex(state.maze, x, y)]) continue;
      open.push({ x, y });
    }
  }
  if (open.length === 0) return;
  // 尽量放在地图中央附近
  const cx = Math.floor(state.maze.w / 2);
  const cy = Math.floor(state.maze.h / 2);
  open.sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)));
  state.fruit = { cell: open[0], kind, leftMs: FRUIT_LIFE_MS };
  state.notice = `${FRUITS[kind].name}出现在中间啦！`;
}

/** 场上还剩多少豆 */
export function remaining(state: RunState): number {
  return dotsLeft(state.maze);
}

/**
 * 推进 dt 毫秒。玩家与小幽灵各有自己的步进冷却，走满一格才结算一次。
 */
export function stepRun(state: RunState, dt: number): RunState {
  if (state.over) return state;
  const clamped = Math.max(0, Math.min(200, dt));
  state.elapsed += clamped;
  if (state.graceMs > 0) state.graceMs = Math.max(0, state.graceMs - clamped);

  spawnFruitIfDue(state);
  if (state.fruit) {
    state.fruit.leftMs -= clamped;
    if (state.fruit.leftMs <= 0) state.fruit = null;
  }

  const phase = ghostPhase(state.elapsed, PHASE_TABLES[state.cfg.tier]);
  state.ghosts = state.ghosts.map((g) => tickFright(g, clamped, phase));

  // 玩家
  state.playerCd -= clamped;
  let guard = 0;
  while (state.playerCd <= 0 && !state.over && guard++ < 8) {
    const wanted = bufferedTurn(state.maze, state.player, state.buffer, state.elapsed);
    if (wanted) {
      state.dir = wanted;
      state.buffer = emptyBuffer();
    }
    if (canTurn(state.maze, state.player, state.dir)) {
      state.player = stepCell(state.maze, state.player, state.dir);
      eatAt(state, state.player);
      checkCollision(state);
    }
    state.playerCd += playerStepMs(state);
    if (remaining(state) === 0) {
      state.won = true;
      state.over = true;
      state.notice = "豆子全部吃光，过关！";
      return state;
    }
  }

  // 小幽灵
  state.ghostCd -= clamped;
  guard = 0;
  while (state.ghostCd <= 0 && !state.over && guard++ < 8) {
    const zhi = state.ghosts.find((g) => g.kind === "zhi")?.cell ?? state.player;
    const input: ChaseInput = {
      player: state.player,
      playerDir: state.dir,
      zhi,
      roll: nextRoll(state),
      maze: state.maze,
    };
    state.ghosts = state.ghosts.map((g) => advanceGhost(state.maze, g, input, phase));
    checkCollision(state);
    const frightSlow = state.ghosts.some((g) => g.mood === "fright") ? 1.6 : 1;
    state.ghostCd += (state.cfg.stepMs / TIER_GHOST_SPEED[state.cfg.tier]) * frightSlow;
  }
  return state;
}

/**
 * 朝「最近的一颗豆」迈一步应该走哪个方向（BFS 最短路），没有豆时返回 null。
 * 教学关的自动演示与测试里的清图机器人都用它。
 */
export function dirToNearestDot(maze: Maze, from: Cell): Dir | null {
  const total = maze.w * maze.h;
  const seen = new Array<boolean>(total).fill(false);
  const start = cellIndex(maze, from.x, from.y);
  seen[start] = true;
  const queue: Cell[] = [from];
  const firstDir = new Array<Dir | null>(total).fill(null);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const ci = cellIndex(maze, cur.x, cur.y);
    if (ci !== start && (maze.dot[ci] || maze.power[ci])) return firstDir[ci];
    for (const d of ["up", "right", "down", "left"] as Dir[]) {
      if (!canTurn(maze, cur, d)) continue;
      const next = stepCell(maze, cur, d);
      const ni = cellIndex(maze, next.x, next.y);
      if (seen[ni]) continue;
      seen[ni] = true;
      firstDir[ni] = ci === start ? d : firstDir[ci];
      queue.push(next);
    }
  }
  return null;
}

/**
 * 清图机器人：一直朝最近的豆走。没有小幽灵时一定能把整张图吃干净，
 * 188 关的「可清性」断言直接用它跑通。
 */
export function autoClear(cfg: RunConfig, seed = 3, maxSteps = 20000): RunState {
  const state = createRun(cfg, seed);
  for (let i = 0; i < maxSteps && !state.over; i++) {
    const d = dirToNearestDot(state.maze, state.player);
    if (d) setDir(state, d);
    stepRun(state, cfg.stepMs);
  }
  return state;
}

/** 假人玩家：一直朝豆子最多的方向走，用来给难度做回归断言 */
export function dummySurviveMs(cfg: RunConfig, seed = 7, limitMs = 60000): number {
  const state = createRun(cfg, seed);
  let t = 0;
  const dt = 40;
  while (!state.over && t < limitMs) {
    // 简单策略：能直走就直走，撞墙再挑第一个能走的方向
    if (!canTurn(state.maze, state.player, state.dir)) {
      const options = (["up", "right", "down", "left"] as Dir[]).filter((d) =>
        canTurn(state.maze, state.player, d)
      );
      if (options.length) {
        const pick = options[Math.floor(nextRoll(state) * options.length) % options.length];
        requestTurn(state, pick, state.elapsed);
      }
    }
    stepRun(state, dt);
    t += dt;
  }
  return t;
}
