/**
 * 扫雷花园 · 棋盘与规则内核（纯函数，不碰 DOM）。
 *
 * 花园是一张 w×h 的格子地。土里藏着若干**刺种**（带刺的种子），
 * 翻开一格会看到周围 8 格里刺种的数量；数字 0 就说明周围一颗都没有，
 * 于是整片连通的空地连同边界数字会一次性翻开（洪水展开）。
 *
 * 术语只用「刺种 / 扫种 / 插旗 / 开花」，其余说法一律不用。
 * 内部字段名保留 `mine`（玩家看不到），方便和通用算法对上。
 */

/** 一格的显示状态 */
export const HIDDEN = 0;
export const OPEN = 1;
export const FLAG = 2;
/** 拿不准的时候先打个问号，问号格既不算旗也不挡翻开 */
export const GUESS = 3;

export type CellState = typeof HIDDEN | typeof OPEN | typeof FLAG | typeof GUESS;

export interface Board {
  w: number;
  h: number;
  /** 1 = 这一格埋着刺种 */
  mine: Uint8Array;
  /** 每格的显示状态 */
  state: Uint8Array;
  /** 周围 8 格的刺种数（0..8）；本格是刺种时同样按周围算，展示时用不到 */
  hint: Uint8Array;
  /** 刺种总数 */
  mines: number;
}

/** 网格上限：再大就不适合小孩子在手机上玩了 */
export const MAX_W = 30;
export const MAX_H = 24;

export function cellCount(w: number, h: number): number {
  return w * h;
}

export function indexOf(w: number, x: number, y: number): number {
  return y * w + x;
}

export function xOf(w: number, index: number): number {
  return index % w;
}

export function yOf(w: number, index: number): number {
  return Math.floor(index / w);
}

export function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

// ---------------------------------------------------------------------------
// 邻格表：同一个尺寸只算一次，后面所有推理都靠它
// ---------------------------------------------------------------------------

const NEIGHBOR_CACHE = new Map<string, number[][]>();

/** w×h 每一格的 8 邻格下标表（缓存，调用方不要改返回的数组） */
export function neighborTable(w: number, h: number): number[][] {
  const key = `${w}x${h}`;
  const hit = NEIGHBOR_CACHE.get(key);
  if (hit) return hit;
  const table: number[][] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const out: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(w, h, nx, ny)) out.push(indexOf(w, nx, ny));
        }
      }
      table[indexOf(w, x, y)] = out;
    }
  }
  NEIGHBOR_CACHE.set(key, table);
  return table;
}

/** 首点安全区：这一格加它的 8 个邻格，生成时一颗刺种都不许落进来 */
export function safeZone(w: number, h: number, index: number): number[] {
  if (index < 0 || index >= w * h) return [];
  return [index, ...neighborTable(w, h)[index]];
}

// ---------------------------------------------------------------------------
// 确定性随机：同一个 seed 永远布出同一张图
// ---------------------------------------------------------------------------

export function makeRand(seed: number): () => number {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 布种
// ---------------------------------------------------------------------------

/** 某个尺寸在保住首点安全区之后，最多还能埋多少颗刺种 */
export function maxMines(w: number, h: number, safeIndex: number): number {
  const zone = safeIndex >= 0 && safeIndex < w * h ? safeZone(w, h, safeIndex).length : 0;
  return Math.max(0, w * h - zone);
}

/**
 * 布种：从「首点及其 8 邻格以外」的格子里选 n 格埋刺种。
 *
 * 安全区是**按构造排除**的，所以首次翻开的那一格连同周围 8 格一定干净，
 * 也就一定会触发一次洪水展开 —— 第一下永远开出一片空地。
 * `safeIndex` 传 -1 表示不留安全区（自由布种，给测试与假人用）。
 */
export function placeMines(w: number, h: number, n: number, safeIndex: number, seed: number): Uint8Array {
  const total = w * h;
  const mine = new Uint8Array(total);
  if (total <= 0) return mine;
  const blocked = new Uint8Array(total);
  for (const i of safeZone(w, h, safeIndex)) blocked[i] = 1;
  const pool: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!blocked[i]) pool.push(i);
  }
  const want = Math.max(0, Math.min(Math.floor(n), pool.length));
  const rand = makeRand(seed);
  // 部分洗牌：只把前 want 个位置洗出来，剩下的不用管
  for (let i = 0; i < want; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
    mine[pool[i]] = 1;
  }
  return mine;
}

/** 数字图：每格周围 8 格的刺种数 */
export function hintMap(w: number, h: number, mine: Uint8Array): Uint8Array {
  const table = neighborTable(w, h);
  const hint = new Uint8Array(w * h);
  for (let i = 0; i < hint.length; i++) {
    let n = 0;
    for (const j of table[i]) n += mine[j];
    hint[i] = n;
  }
  return hint;
}

/** 用现成的刺种分布造一张可玩的花园 */
export function boardFromMines(w: number, h: number, mine: Uint8Array): Board {
  let mines = 0;
  for (let i = 0; i < mine.length; i++) mines += mine[i] ? 1 : 0;
  return { w, h, mine, state: new Uint8Array(w * h), hint: hintMap(w, h, mine), mines };
}

/** 空花园：一颗刺种都还没埋（首点之后再布种） */
export function createBoard(w: number, h: number): Board {
  return boardFromMines(w, h, new Uint8Array(w * h));
}

export function cloneBoard(b: Board): Board {
  return {
    w: b.w,
    h: b.h,
    mine: Uint8Array.from(b.mine),
    state: Uint8Array.from(b.state),
    hint: Uint8Array.from(b.hint),
    mines: b.mines
  };
}

/** 把一张图重新埋种（首点之后调用），数字图跟着重算，显示状态不动 */
export function replantMines(b: Board, mine: Uint8Array): void {
  b.mine.set(mine);
  b.hint.set(hintMap(b.w, b.h, mine));
  let mines = 0;
  for (let i = 0; i < mine.length; i++) mines += mine[i] ? 1 : 0;
  b.mines = mines;
}

// ---------------------------------------------------------------------------
// 翻开
// ---------------------------------------------------------------------------

export interface OpenResult {
  /** 本次真正翻开的格子（按翻开顺序，动画一格一格播） */
  opened: number[];
  /** 翻到了刺种（这一颗会当场开出一朵花） */
  hit: boolean;
  /** 踩到的那一颗刺种的位置 */
  hitAt: number;
}

const NO_OPEN: OpenResult = { opened: [], hit: false, hitAt: -1 };

function emptyResult(): OpenResult {
  return { opened: [], hit: false, hitAt: -1 };
}

/**
 * 翻开一格。数字是 0 就洪水展开：整片连通的空地连同贴着它的数字格一起翻开。
 * 插了旗的格子点不动（防误触），问号格可以直接翻。
 */
export function floodOpen(b: Board, index: number): OpenResult {
  if (index < 0 || index >= b.state.length) return NO_OPEN;
  if (b.state[index] === OPEN || b.state[index] === FLAG) return emptyResult();
  if (b.mine[index]) {
    b.state[index] = OPEN;
    return { opened: [index], hit: true, hitAt: index };
  }
  const table = neighborTable(b.w, b.h);
  const opened: number[] = [];
  const queue = [index];
  b.state[index] = OPEN;
  opened.push(index);
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (b.hint[cur] !== 0) continue;
    for (const nb of table[cur]) {
      if (b.state[nb] === OPEN || b.state[nb] === FLAG) continue;
      if (b.mine[nb]) continue;
      b.state[nb] = OPEN;
      opened.push(nb);
      if (b.hint[nb] === 0) queue.push(nb);
    }
  }
  return { opened, hit: false, hitAt: -1 };
}

/**
 * 双键和弦：某个已翻开的数字格，周围插的旗数正好等于它的数字时，
 * 一次把周围没插旗的格子全翻开。
 *
 * 旗要是插错了地方，翻开的那一批里就真的有刺种 —— 和弦是提速手段，不是保险。
 */
export function chord(b: Board, index: number): OpenResult {
  if (index < 0 || index >= b.state.length) return NO_OPEN;
  if (b.state[index] !== OPEN || b.hint[index] === 0) return emptyResult();
  const table = neighborTable(b.w, b.h);
  let flags = 0;
  for (const nb of table[index]) {
    if (b.state[nb] === FLAG) flags++;
  }
  if (flags !== b.hint[index]) return emptyResult();
  const out = emptyResult();
  for (const nb of table[index]) {
    if (b.state[nb] === OPEN || b.state[nb] === FLAG) continue;
    const r = floodOpen(b, nb);
    out.opened.push(...r.opened);
    if (r.hit && !out.hit) {
      out.hit = true;
      out.hitAt = r.hitAt;
    }
  }
  return out;
}

/** 和弦能不能按（界面上给个高亮，孩子一眼看得出这一格可以双击） */
export function canChord(b: Board, index: number): boolean {
  if (index < 0 || index >= b.state.length) return false;
  if (b.state[index] !== OPEN || b.hint[index] === 0) return false;
  const table = neighborTable(b.w, b.h);
  let flags = 0;
  let hidden = 0;
  for (const nb of table[index]) {
    if (b.state[nb] === FLAG) flags++;
    else if (b.state[nb] !== OPEN) hidden++;
  }
  return flags === b.hint[index] && hidden > 0;
}

// ---------------------------------------------------------------------------
// 插旗
// ---------------------------------------------------------------------------

export function flagCount(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.state.length; i++) {
    if (b.state[i] === FLAG) n++;
  }
  return n;
}

/** 剩余可插的小旗数（刺种总数 − 已插旗数，可以是负数，界面照实显示） */
export function flagsLeft(b: Board): number {
  return b.mines - flagCount(b);
}

export interface FlagOptions {
  /** 限旗关：最多只能同时插这么多面旗；不传就不限 */
  limit?: number;
  /** 允许问号档（隐藏 → 旗 → 问号 → 隐藏） */
  useGuess?: boolean;
}

export type FlagOutcome = "flag" | "guess" | "clear" | "blocked" | "none";

/**
 * 插旗 / 收旗。已翻开的格子不理会。
 * 限旗关插满之后再插会返回 `blocked`，界面提示「小旗用完了，先收一面再插」。
 */
export function toggleFlag(b: Board, index: number, opts: FlagOptions = {}): FlagOutcome {
  if (index < 0 || index >= b.state.length) return "none";
  const st = b.state[index];
  if (st === OPEN) return "none";
  if (st === FLAG) {
    b.state[index] = opts.useGuess ? GUESS : HIDDEN;
    return opts.useGuess ? "guess" : "clear";
  }
  if (st === GUESS) {
    b.state[index] = HIDDEN;
    return "clear";
  }
  if (typeof opts.limit === "number" && flagCount(b) >= opts.limit) return "blocked";
  b.state[index] = FLAG;
  return "flag";
}

// ---------------------------------------------------------------------------
// 胜负
// ---------------------------------------------------------------------------

/**
 * 胜利：所有**非刺种**格都被翻开就赢了。
 * 旗插对了几面完全不影响判定 —— 一面旗都不插也能赢。
 */
export function won(b: Board): boolean {
  for (let i = 0; i < b.state.length; i++) {
    if (!b.mine[i] && b.state[i] !== OPEN) return false;
  }
  return true;
}

/** 失败：有一格刺种被翻开了 */
export function lost(b: Board): boolean {
  for (let i = 0; i < b.state.length; i++) {
    if (b.mine[i] && b.state[i] === OPEN) return true;
  }
  return false;
}

/** 还没翻开的非刺种格数（进度条用） */
export function safeLeft(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.state.length; i++) {
    if (!b.mine[i] && b.state[i] !== OPEN) n++;
  }
  return n;
}

/** 已翻开的格子数 */
export function openedCount(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.state.length; i++) {
    if (b.state[i] === OPEN) n++;
  }
  return n;
}

/** 完成度 0..1 */
export function progress(b: Board): number {
  const total = b.w * b.h - b.mines;
  if (total <= 0) return 1;
  return Math.min(1, (total - safeLeft(b)) / total);
}

/** 赢了之后把没插的刺种自动补上小旗（只是收尾好看，不参与判定） */
export function autoFlagRest(b: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.state.length; i++) {
    if (b.mine[i] && b.state[i] !== FLAG) {
      b.state[i] = FLAG;
      out.push(i);
    }
  }
  return out;
}

/**
 * 输了之后温柔揭开剩下的刺种：按「离踩中那一格由近到远」排好序，
 * 界面一颗一颗慢慢开出花，绝不一下子全部掀开。
 */
export function revealOrder(b: Board, from: number): number[] {
  const fx = xOf(b.w, from);
  const fy = yOf(b.w, from);
  const rest: number[] = [];
  for (let i = 0; i < b.mine.length; i++) {
    if (b.mine[i] && i !== from && b.state[i] !== OPEN) rest.push(i);
  }
  rest.sort((a, c) => {
    const da = Math.hypot(xOf(b.w, a) - fx, yOf(b.w, a) - fy);
    const dc = Math.hypot(xOf(b.w, c) - fx, yOf(b.w, c) - fy);
    return da === dc ? a - c : da - dc;
  });
  return rest;
}

/** 插错地方的小旗（输了之后标出来，只是复盘，不批评） */
export function wrongFlags(b: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.state.length; i++) {
    if (b.state[i] === FLAG && !b.mine[i]) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 迷雾（只挡显示，不挡判定）
// ---------------------------------------------------------------------------

/**
 * 迷雾园：只照亮光标周围 3×3。
 *
 * 这是**纯显示**的滤镜 —— 传进来的格子看不看得见，与它能不能被翻开、
 * 与胜负判定统统无关，所以雾里照样能靠数字推理，也照样能一把清盘。
 */
export function fogVisible(w: number, h: number, cursor: number, index: number, radius = 1): boolean {
  if (cursor < 0) return true;
  const dx = Math.abs(xOf(w, index) - xOf(w, cursor));
  const dy = Math.abs(yOf(w, index) - yOf(w, cursor));
  return dx <= radius && dy <= radius;
}

// ---------------------------------------------------------------------------
// 光标（键盘玩家）
// ---------------------------------------------------------------------------

export type Dir = "up" | "down" | "left" | "right";

/** 移光标：撞到边就停在边上，不绕回另一头（免得孩子找不着自己在哪） */
export function moveCursor(w: number, h: number, index: number, dir: Dir): number {
  const x = xOf(w, index);
  const y = yOf(w, index);
  const nx = dir === "left" ? x - 1 : dir === "right" ? x + 1 : x;
  const ny = dir === "up" ? y - 1 : dir === "down" ? y + 1 : y;
  if (!inBounds(w, h, nx, ny)) return index;
  return indexOf(w, nx, ny);
}
