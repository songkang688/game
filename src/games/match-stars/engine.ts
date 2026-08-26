/**
 * 星星消消乐的棋盘引擎（纯函数，不碰 DOM）。
 * 1.1 把 1.0 内联在 index.ts 里的匹配 / 下落 / 机关结算抽了出来，
 * 界面和单测跑的是同一套规则，第 100–188 关的可解性才能真跑一遍自动玩家。
 */
import { mulberry32 } from "../level99";
import type { MatchBelt, MatchLevel } from "./levels";

export const SIZE = 8;
/** 彩虹星：和谁交换就清掉全场那种图案 */
export const RAINBOW = -2;
export const EMPTY = -1;

export interface MatchState {
  grid: number[];
  /** 冰块：旁边消除就能敲开 */
  ice: boolean[];
  /** 藤蔓：必须在它上面消除才能剪断 */
  vine: boolean[];
  /** 1.1 糖霜层数（0..2）：在它上面每消一次剥一层 */
  frost: number[];
  iceLeft: number;
  vineLeft: number;
  frostLeft: number;
  /** 各收集目标已收到的数量 */
  collected: number[];
  /** 1.1 各订单已完成的次数 */
  orders: number[];
  /** 1.1 石巨人剩余护甲 */
  armor: number;
  /** 已经走掉的步数（石巨人靠它决定什么时候捣乱） */
  used: number;
}

/** 一次消除连锁的战果 */
export interface CascadeInfo {
  /** 连锁了几轮 */
  steps: number;
  /** 一共消掉多少颗 */
  total: number;
  /** 单轮消掉最多的一次是多少颗 */
  best: number;
}

export function idx(r: number, c: number): number {
  return r * SIZE + c;
}

export function rowOf(i: number): number {
  return Math.floor(i / SIZE);
}

export function colOf(i: number): number {
  return i % SIZE;
}

/** 把 n 个机关摆在中间区域且互不相邻（1.0 的老规矩） */
export function placeMarks(marks: boolean[], n: number, avoid: boolean[], rand: () => number): number {
  const candidates: number[] = [];
  for (let r = 2; r < SIZE - 2; r++) for (let c = 1; c < SIZE - 1; c++) candidates.push(r * SIZE + c);
  let placed = 0;
  let guard = 0;
  while (placed < n && guard < 600) {
    guard++;
    const i = candidates[Math.floor(rand() * candidates.length)];
    if (marks[i] || avoid[i]) continue;
    const r = Math.floor(i / SIZE), c = i % SIZE;
    const near =
      (r > 0 && (marks[i - SIZE] || avoid[i - SIZE])) || (r < SIZE - 1 && (marks[i + SIZE] || avoid[i + SIZE])) ||
      (c > 0 && (marks[i - 1] || avoid[i - 1])) || (c < SIZE - 1 && (marks[i + 1] || avoid[i + 1]));
    if (near) continue;
    marks[i] = true;
    placed++;
  }
  return placed;
}

/** 1.1 糖霜可以铺得密一点：只要不压在冰块 / 藤蔓上就行 */
export function placeFrost(frost: number[], n: number, layers: number, blocked: boolean[], rand: () => number): number {
  const candidates: number[] = [];
  for (let r = 1; r < SIZE - 1; r++) for (let c = 0; c < SIZE; c++) candidates.push(r * SIZE + c);
  let placed = 0;
  let guard = 0;
  while (placed < n && guard < 900) {
    guard++;
    const i = candidates[Math.floor(rand() * candidates.length)];
    if (frost[i] > 0 || blocked[i]) continue;
    frost[i] = layers;
    placed += layers;
  }
  return placed;
}

export function createState(cfg: MatchLevel, rand: () => number): MatchState {
  const grid = new Array<number>(SIZE * SIZE).fill(0);
  const ice = new Array<boolean>(SIZE * SIZE).fill(false);
  const vine = new Array<boolean>(SIZE * SIZE).fill(false);
  const frost = new Array<number>(SIZE * SIZE).fill(0);
  const iceLeft = placeMarks(ice, cfg.ice, vine, rand);
  const vineLeft = placeMarks(vine, cfg.vine, ice, rand);
  const blocked = ice.map((v, i) => v || vine[i]);
  const frostLeft = placeFrost(frost, cfg.frost ?? 0, cfg.frostLayers ?? 1, blocked, rand);
  const randToken = (): number => Math.floor(rand() * cfg.colors);
  for (let i = 0; i < grid.length; i++) {
    let v = randToken();
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    while (
      (c >= 2 && grid[i - 1] === v && grid[i - 2] === v) ||
      (r >= 2 && grid[i - SIZE] === v && grid[i - 2 * SIZE] === v)
    ) {
      v = randToken();
    }
    grid[i] = v;
  }
  return {
    grid,
    ice,
    vine,
    frost,
    iceLeft,
    vineLeft,
    frostLeft,
    collected: cfg.goals.map(() => 0),
    orders: (cfg.orders ?? []).map(() => 0),
    armor: cfg.boss?.armor ?? 0,
    used: 0
  };
}

export function cloneState(s: MatchState): MatchState {
  return {
    grid: s.grid.slice(),
    ice: s.ice.slice(),
    vine: s.vine.slice(),
    frost: s.frost.slice(),
    iceLeft: s.iceLeft,
    vineLeft: s.vineLeft,
    frostLeft: s.frostLeft,
    collected: s.collected.slice(),
    orders: s.orders.slice(),
    armor: s.armor,
    used: s.used
  };
}

/** 找出棋盘上所有三连及以上的格子 */
export function findMatches(g: number[]): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = r * SIZE + c;
      const v = g[i];
      if (v < 0) continue;
      if (c <= SIZE - 3 && g[i + 1] === v && g[i + 2] === v) {
        out.add(i); out.add(i + 1); out.add(i + 2);
      }
      if (r <= SIZE - 3 && g[i + SIZE] === v && g[i + 2 * SIZE] === v) {
        out.add(i); out.add(i + SIZE); out.add(i + 2 * SIZE);
      }
    }
  }
  return out;
}

/** 单点快查：格子 i 现在是不是某个三连的一员（挑候选交换用，比全盘扫快得多） */
export function matchesAt(g: number[], i: number): boolean {
  const v = g[i];
  if (v < 0) return false;
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  let run = 1;
  for (let x = c - 1; x >= 0 && g[r * SIZE + x] === v; x--) run++;
  for (let x = c + 1; x < SIZE && g[r * SIZE + x] === v; x++) run++;
  if (run >= 3) return true;
  run = 1;
  for (let y = r - 1; y >= 0 && g[y * SIZE + c] === v; y--) run++;
  for (let y = r + 1; y < SIZE && g[y * SIZE + c] === v; y++) run++;
  return run >= 3;
}

export function adjacent(a: number, b: number): boolean {
  const ra = Math.floor(a / SIZE), ca = a % SIZE;
  const rb = Math.floor(b / SIZE), cb = b % SIZE;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

function refillToken(cfg: MatchLevel, rand: () => number): number {
  if (cfg.rainbow && rand() < 0.06) return RAINBOW;
  return Math.floor(rand() * cfg.colors);
}

/** 消掉一组格子：计目标、敲冰、剪藤、剥糖霜、打护甲 */
export function clearCells(s: MatchState, cfg: MatchLevel, set: Set<number>): void {
  set.forEach((i) => {
    const v = s.grid[i];
    cfg.goals.forEach((g, gi) => {
      if (g.token === v) s.collected[gi]++;
    });
    if (cfg.boss && v === cfg.boss.token && s.armor > 0) s.armor--;
    if (s.frost[i] > 0) { s.frost[i]--; s.frostLeft--; }
    if (s.vine[i]) { s.vine[i] = false; s.vineLeft--; }
    if (s.ice[i]) { s.ice[i] = false; s.iceLeft--; }
    const r = Math.floor(i / SIZE), c = i % SIZE;
    const neighbors = [
      r > 0 ? i - SIZE : -1, r < SIZE - 1 ? i + SIZE : -1,
      c > 0 ? i - 1 : -1, c < SIZE - 1 ? i + 1 : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && s.ice[n]) { s.ice[n] = false; s.iceLeft--; }
    }
    s.grid[i] = EMPTY;
  });
}

export function applyGravity(s: MatchState, cfg: MatchLevel, rand: () => number): void {
  for (let c = 0; c < SIZE; c++) {
    const vals: number[] = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const i = r * SIZE + c;
      if (!s.ice[i] && !s.vine[i] && s.grid[i] >= 0) vals.push(s.grid[i]);
    }
    let vi = 0;
    for (let r = SIZE - 1; r >= 0; r--) {
      const i = r * SIZE + c;
      if (s.ice[i] || s.vine[i]) continue;
      s.grid[i] = vi < vals.length ? vals[vi++] : refillToken(cfg, rand);
    }
  }
}

/**
 * 1.1 传送带：整行的图案循环平移一格（冰块 / 藤蔓 卡着的格子不动）。
 * 每走完一步就转一下，节奏和真机一致。
 */
export function shiftBelt(s: MatchState, belt: MatchBelt): void {
  const row = ((belt.row % SIZE) + SIZE) % SIZE;
  const slots: number[] = [];
  for (let c = 0; c < SIZE; c++) {
    const i = row * SIZE + c;
    if (!s.ice[i] && !s.vine[i] && s.grid[i] >= 0) slots.push(i);
  }
  if (slots.length < 2) return;
  const vals = slots.map((i) => s.grid[i]);
  const n = vals.length;
  const step = belt.dir >= 0 ? 1 : -1;
  slots.forEach((i, k) => {
    s.grid[i] = vals[((k - step) % n + n) % n];
  });
}

export function runBelts(s: MatchState, cfg: MatchLevel): void {
  for (const belt of cfg.belts ?? []) shiftBelt(s, belt);
}

/** 1.1 石巨人捣乱：每隔几步冻住一颗还没被机关占着的星星 */
export function bossRoar(s: MatchState, cfg: MatchLevel, rand: () => number): number {
  if (!cfg.boss || s.armor <= 0) return -1;
  const free: number[] = [];
  for (let i = 0; i < s.grid.length; i++) {
    if (!s.ice[i] && !s.vine[i] && s.frost[i] === 0 && s.grid[i] >= 0) free.push(i);
  }
  if (free.length === 0) return -1;
  const pick = free[Math.floor(rand() * free.length)];
  s.ice[pick] = true;
  s.iceLeft++;
  return pick;
}

/** 把连锁一路消到底，返回这一步的战果 */
export function resolveAll(s: MatchState, cfg: MatchLevel, rand: () => number): CascadeInfo {
  let steps = 0;
  let total = 0;
  let best = 0;
  for (let guard = 0; guard < 60; guard++) {
    const matched = findMatches(s.grid);
    if (matched.size === 0) break;
    steps++;
    total += matched.size;
    best = Math.max(best, matched.size);
    clearCells(s, cfg, matched);
    applyGravity(s, cfg, rand);
  }
  return { steps, total, best };
}

/** 这一步的战果够不够记一笔订单 */
export function orderSatisfied(kind: string, info: CascadeInfo): boolean {
  if (kind === "big4") return info.best >= 4;
  if (kind === "big5") return info.best >= 5;
  if (kind === "chain2") return info.steps >= 2;
  if (kind === "chain3") return info.steps >= 3;
  return false;
}

/** 结算订单进度：一步最多给同一张订单记一笔 */
export function creditOrders(s: MatchState, cfg: MatchLevel, info: CascadeInfo): number {
  let gained = 0;
  (cfg.orders ?? []).forEach((order, oi) => {
    if (s.orders[oi] >= order.count) return;
    if (orderSatisfied(order.kind, info)) {
      s.orders[oi]++;
      gained++;
    }
  });
  return gained;
}

/** 彩虹星交换：把全场某种图案一次清光 */
export function rainbowTargets(s: MatchState, a: number, b: number, colors: number, rand: () => number): Set<number> {
  const other = s.grid[a] === RAINBOW ? s.grid[b] : s.grid[a];
  const target = other === RAINBOW ? Math.floor(rand() * colors) : other;
  const set = new Set<number>([a, b]);
  for (let i = 0; i < s.grid.length; i++) {
    if (s.grid[i] === target) set.add(i);
  }
  return set;
}

/** 本关的全部过关条件都达成了吗 */
export function goalsMet(s: MatchState, cfg: MatchLevel): boolean {
  if (!cfg.goals.every((g, gi) => s.collected[gi] >= g.count)) return false;
  if (s.iceLeft > 0 || s.vineLeft > 0 || s.frostLeft > 0) return false;
  if ((cfg.orders ?? []).some((o, oi) => s.orders[oi] < o.count)) return false;
  if (cfg.boss && s.armor > 0) return false;
  return true;
}

/** 还差多少：给自动玩家打分用（越小越接近过关） */
export function remaining(s: MatchState, cfg: MatchLevel): number {
  let left = 0;
  cfg.goals.forEach((g, gi) => { left += Math.max(0, g.count - s.collected[gi]); });
  left += s.iceLeft * 3 + s.vineLeft * 3 + s.frostLeft * 3;
  (cfg.orders ?? []).forEach((o, oi) => { left += Math.max(0, o.count - s.orders[oi]) * 6; });
  left += s.armor;
  return left;
}

// ---------------------------------------------------------------------------
// 自动玩家：第 100–188 关的可解性靠它证明
// ---------------------------------------------------------------------------

export interface SimResult {
  won: boolean;
  movesUsed: number;
  movesLeft: number;
  /** 收尾时还差多少（0 表示全达成） */
  left: number;
}

/** 列出所有「换了就能消」的相邻交换 */
export function legalSwaps(s: MatchState, cfg: MatchLevel): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const locked = (i: number): boolean => s.ice[i] || s.vine[i];
  for (let i = 0; i < s.grid.length; i++) {
    if (locked(i) || s.grid[i] === EMPTY) continue;
    const c = i % SIZE;
    const cands = [c < SIZE - 1 ? i + 1 : -1, i + SIZE < s.grid.length ? i + SIZE : -1];
    for (const j of cands) {
      if (j < 0 || locked(j) || s.grid[j] === EMPTY) continue;
      if (cfg.rainbow && (s.grid[i] === RAINBOW || s.grid[j] === RAINBOW)) {
        out.push([i, j]);
        continue;
      }
      [s.grid[i], s.grid[j]] = [s.grid[j], s.grid[i]];
      const ok = matchesAt(s.grid, i) || matchesAt(s.grid, j);
      [s.grid[i], s.grid[j]] = [s.grid[j], s.grid[i]];
      if (ok) out.push([i, j]);
    }
  }
  return out;
}

/** 走一步（含彩虹星、连锁、订单、传送带与石巨人捣乱） */
export function playSwap(s: MatchState, cfg: MatchLevel, a: number, b: number, rand: () => number): CascadeInfo {
  let info: CascadeInfo;
  if (cfg.rainbow && (s.grid[a] === RAINBOW || s.grid[b] === RAINBOW)) {
    const set = rainbowTargets(s, a, b, cfg.colors, rand);
    clearCells(s, cfg, set);
    applyGravity(s, cfg, rand);
    const rest = resolveAll(s, cfg, rand);
    info = { steps: rest.steps + 1, total: rest.total + set.size, best: Math.max(rest.best, set.size) };
  } else {
    [s.grid[a], s.grid[b]] = [s.grid[b], s.grid[a]];
    info = resolveAll(s, cfg, rand);
  }
  creditOrders(s, cfg, info);
  s.used++;
  runBelts(s, cfg);
  // 传送带转完可能又凑出三连，让它自然连锁掉
  const after = resolveAll(s, cfg, rand);
  info = { steps: info.steps + after.steps, total: info.total + after.total, best: Math.max(info.best, after.best) };
  if (cfg.boss && cfg.boss.roarEvery > 0 && s.used % cfg.boss.roarEvery === 0) {
    bossRoar(s, cfg, rand);
  }
  return info;
}

/**
 * 自动玩家：每一步都在「能消的交换」里挑最能推进目标的那个。
 * 跑完还能达成全部条件，就说明这一关真的能过。
 */
export function simulateLevel(cfg: MatchLevel, seed: number): SimResult {
  const rand = mulberry32(seed);
  const state = createState(cfg, rand);
  // 开局先把自然形成的三连消掉（1.0 的发牌已经避开了，这里是保险）
  resolveAll(state, cfg, rand);
  let evalSeed = seed * 7919 + 13;
  let stalled = 0;
  for (let move = 0; move < cfg.moves; move++) {
    if (goalsMet(state, cfg)) break;
    const swaps = legalSwaps(state, cfg);
    if (swaps.length === 0) break;
    const before = remaining(state, cfg);
    let bestSwap = swaps[0];
    if (stalled >= 4) {
      // 连着几步没进展就换个思路随便走一步，真人卡住时也是这么干的
      bestSwap = swaps[Math.floor(rand() * swaps.length)];
      stalled = 0;
    } else {
      let bestScore = -Infinity;
      for (const [a, b] of swaps) {
        const trial = cloneState(state);
        const info = playSwap(trial, cfg, a, b, mulberry32(evalSeed++));
        // 主要看离过关近了多少，再稍微偏好大消除与连锁
        const score = (before - remaining(trial, cfg)) * 10 + info.best + info.steps * 2;
        if (score > bestScore) {
          bestScore = score;
          bestSwap = [a, b];
        }
      }
    }
    playSwap(state, cfg, bestSwap[0], bestSwap[1], rand);
    stalled = remaining(state, cfg) < before ? 0 : stalled + 1;
  }
  const won = goalsMet(state, cfg);
  return { won, movesUsed: state.used, movesLeft: cfg.moves - state.used, left: remaining(state, cfg) };
}
