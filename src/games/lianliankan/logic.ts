/**
 * 连连看 · 玩法逻辑层（1.2 抽出，不碰 DOM）
 *
 * 棋盘本身的连通 / 收拢 / 洗牌在 `board.ts`；这里管的是「点下去之后发生了什么」：
 *
 *  - **连线状态机**：选中 → 画出带拐点的发光折线 → 撑够 180–260ms → 两块一起缩掉 →
 *    收拢滑动 → 回到待命。1.1 那种「点两下直接不见」在 1.2 是不允许的，
 *    所以消除必须经过 `linking` 这个相位，测试直接盯着相位序列。
 *  - **提示经济**：每关 3 次，走的是真求解，而且优先给拐弯最少的一对；用过就封顶两星。
 *  - **收拢时长**：每格 60–80ms，格子挪得越远滑得越久。
 *  - **色觉友好**：同一色系的图案底色必须配不同形状，靠形状也分得开。
 *  - **无尽「连到底」**：清完一盘自动补新盘，累计对数计分，每 3 盘加一档难度。
 */

import type { SoundName } from "../../engine/types";
import { findPath, tilesLeft, type BoardSpec, type BoardState, type Pt } from "./board";

/** 棋盘视图往外喊音效时只认这几个内置音，别处不许自己合成 */
export type Sfx = SoundName;

// ---------------------------------------------------------------------------
// 一、连线状态机
// ---------------------------------------------------------------------------

/** 折线撑在屏幕上的时长（规格要求 180–260ms） */
export const LINK_HOLD_MS = 220;
/** 关掉动效时也要走同一套状态机，只是折线只闪一帧 */
export const LINK_HOLD_CALM_MS = 16;
/** 两块一起缩小消失的时长 */
export const CLEAR_MS = 180;
/** 连错时抖一下，不扣任何东西 */
export const SHAKE_MS = 120;
/** 收拢时每挪一格花多久（规格要求 60–80ms） */
export const COLLAPSE_STEP_MS = 70;
/** 收拢动画最长撑多久，免得大盘子挪半天 */
export const COLLAPSE_MAX_MS = 420;

export function linkHoldMs(calm: boolean): number {
  return calm ? LINK_HOLD_CALM_MS : LINK_HOLD_MS;
}

export function clearMs(calm: boolean): number {
  return calm ? 1 : CLEAR_MS;
}

/** 挪 n 格要滑多久 */
export function collapseMs(cells: number, calm = false, step = COLLAPSE_STEP_MS): number {
  if (calm) return 0;
  return Math.min(COLLAPSE_MAX_MS, Math.max(0, Math.round(cells)) * step);
}

export type LinkPhase = "idle" | "picked" | "linking" | "collapsing";

export interface LinkState {
  phase: LinkPhase;
  first: Pt | null;
  path: Pt[] | null;
}

export function linkInit(): LinkState {
  return { phase: "idle", first: null, path: null };
}

export type TapKind = "ignore" | "reveal" | "select" | "deselect" | "switch" | "reject" | "link";

export interface TapOutcome {
  kind: TapKind;
  state: LinkState;
  /** kind === "link" 时带上真实路径（含拐点） */
  path?: Pt[];
  /** kind === "reject" / "link" 时涉及的两格 */
  pair?: [Pt, Pt];
  /** 连不上时给孩子的解释，只说规则不说人 */
  reason?: string;
}

export function samePt(a: Pt | null, b: Pt | null): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

export interface TapOptions {
  maxTurns?: number;
  /** 这一格还盖着面具吗（盖着的第一下只翻面，不参与配对） */
  hidden?: boolean;
}

/**
 * 点一格之后棋局怎么走。纯函数：不改棋盘，只回报「该演什么」。
 * `linking` / `collapsing` 相位里点任何格子都不理，动画放完再说。
 */
export function tapCell(board: BoardState, st: LinkState, r: number, c: number, opts: TapOptions = {}): TapOutcome {
  const maxTurns = opts.maxTurns ?? 2;
  if (st.phase === "linking" || st.phase === "collapsing") return { kind: "ignore", state: st };
  if (board.grid[r][c] < 0) return { kind: "ignore", state: st };
  if (opts.hidden) return { kind: "reveal", state: { phase: "picked", first: [r, c], path: null } };

  const here: Pt = [r, c];
  if (!st.first) return { kind: "select", state: { phase: "picked", first: here, path: null } };
  if (samePt(st.first, here)) return { kind: "deselect", state: linkInit() };

  const [sr, sc] = st.first;
  if (board.grid[sr][sc] !== board.grid[r][c]) {
    return { kind: "switch", state: { phase: "picked", first: here, path: null } };
  }
  const path = findPath(board, st.first, here, maxTurns);
  if (!path) {
    return {
      kind: "reject",
      state: { phase: "picked", first: here, path: null },
      pair: [st.first, here],
      reason:
        maxTurns <= 1
          ? "这两个连不上：这一关的线只准拐一次弯，先找同行同列的～"
          : "这两个连不上：线最多拐两次弯，中间还不能有别的图案～"
    };
  }
  return { kind: "link", state: { phase: "linking", first: st.first, path }, path, pair: [st.first, here] };
}

/** 折线撑完了，进入「两块一起缩掉 + 收拢滑动」 */
export function beginCollapse(): LinkState {
  return { phase: "collapsing", first: null, path: null };
}

/** 收拢滑完了，回到待命 */
export function settle(): LinkState {
  return linkInit();
}

/** 折线的拐点个数（0 = 直线，最多 2） */
export function turnCount(path: readonly Pt[]): number {
  return Math.max(0, path.length - 2);
}

/** 折线每一段都必须是横平竖直的（斜着连是 bug） */
export function pathIsOrthogonal(path: readonly Pt[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a[0] !== b[0] && a[1] !== b[1]) return false;
  }
  return path.length >= 2;
}

// ---------------------------------------------------------------------------
// 二、提示经济
// ---------------------------------------------------------------------------

/** 每关能用几次提示 */
export const HINT_MAX = 3;

export interface HintPick {
  pair: [Pt, Pt];
  /** 这一对连起来要拐几次弯 */
  turns: number;
  path: Pt[];
}

/**
 * 提示走的是真求解，而且**挑最好懂的那一对**：
 * 先看拐弯少的（直线 > 一拐 > 两拐），一样少就挑离得近的。
 *
 * `anyMove` 返回的是「碰巧最先扫到」的那一对，常常是横跨大半个盘的两拐线；
 * 孩子照着按掉，学到的只是「原来这两个能连」。改成先给直线之后，
 * 提示教的是「同行同列先看」这条自己能反复用的规矩。
 */
export function hintBest(board: BoardState, maxTurns = 2): HintPick | null {
  const spots = new Map<number, Pt[]>();
  for (let r = 0; r < board.R; r++) {
    for (let c = 0; c < board.C; c++) {
      const v = board.grid[r][c];
      if (v < 0) continue;
      const list = spots.get(v);
      if (list) list.push([r, c]);
      else spots.set(v, [[r, c]]);
    }
  }
  let best: HintPick | null = null;
  let bestDist = Infinity;
  for (const list of spots.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const path = findPath(board, list[i], list[j], maxTurns);
        if (!path) continue;
        const turns = turnCount(path);
        const dist = Math.abs(list[i][0] - list[j][0]) + Math.abs(list[i][1] - list[j][1]);
        if (best && (turns > best.turns || (turns === best.turns && dist >= bestDist))) continue;
        best = { pair: [list[i], list[j]], turns, path };
        bestDist = dist;
      }
    }
  }
  return best;
}

/** 提示走的是真求解，不是随便挑两个高亮 */
export function hintPair(board: BoardState, maxTurns = 2): [Pt, Pt] | null {
  return hintBest(board, maxTurns)?.pair ?? null;
}

/** 提示还剩几次 */
export function hintsLeft(used: number, max = HINT_MAX): number {
  return Math.max(0, max - used);
}

/**
 * 星星：剩的时间越多越好，但**只要用过提示就封顶两星**。
 * 一次都不给三星是太严了，孩子会不敢按；封顶两星刚好。
 */
export function starsFor(timeLeft: number, seconds: number, hintsUsed = 0): 1 | 2 | 3 {
  const frac = seconds > 0 ? timeLeft / seconds : 1;
  const base: 1 | 2 | 3 = frac >= 0.4 ? 3 : frac >= 0.15 ? 2 : 1;
  return hintsUsed > 0 ? (Math.min(2, base) as 1 | 2) : base;
}

/** 通关时说的话：用过提示也照样夸 */
export function winWord(timeLeft: number, hintsUsed: number): string {
  if (hintsUsed === 0) return `还剩 ${timeLeft} 秒，一次提示都没用，扫盘的效率很高！`;
  return `还剩 ${timeLeft} 秒，全连完啦！用了 ${hintsUsed} 次提示，下一局试试先扫边角，说不定就不用提示了～`;
}

/** 时间到时说的话：只给方法，不说重话 */
export function timeUpWord(): string {
  return "时间到～下一局先清边角，边角的线拐弯少，还能给里面让出通道！";
}

// ---------------------------------------------------------------------------
// 三、色觉友好：同色系必须靠形状分得开
// ---------------------------------------------------------------------------

/** 格子底色（跟 1.0 的一致），以及它属于哪个色系 */
export const TILE_BGS = [
  "#FFE3E3", "#FFF3CE", "#EBDDFB", "#FFE0EC", "#E0F0FF", "#FFE9F3", "#FFF6D8",
  "#E2F0FF", "#F6E3FF", "#FFEFE0", "#FFE4D0", "#FFDFE8", "#E3EBFF", "#E2F7DF"
] as const;

export type ColorFamily = "粉" | "奶黄" | "紫" | "蓝" | "绿";

export const TILE_FAMILY: readonly ColorFamily[] = [
  "粉", "奶黄", "紫", "粉", "蓝", "粉", "奶黄",
  "蓝", "紫", "奶黄", "奶黄", "粉", "蓝", "绿"
];

/** 五种轮廓：同一色系里的图案一定各配一种，色觉不敏感也分得开 */
export const TILE_SHAPES = ["圆", "方", "叶", "菱", "花"] as const;
export type TileShape = (typeof TILE_SHAPES)[number];

/** 第 v 号图案的轮廓下标（同色系内部依次错开） */
export const SHAPE_INDEX: readonly number[] = (() => {
  const seen = new Map<ColorFamily, number>();
  return TILE_FAMILY.map((fam) => {
    const n = seen.get(fam) ?? 0;
    seen.set(fam, n + 1);
    return n % TILE_SHAPES.length;
  });
})();

export function bgOf(v: number): string {
  return TILE_BGS[((v % TILE_BGS.length) + TILE_BGS.length) % TILE_BGS.length];
}

export function familyOf(v: number): ColorFamily {
  return TILE_FAMILY[((v % TILE_FAMILY.length) + TILE_FAMILY.length) % TILE_FAMILY.length];
}

export function shapeOf(v: number): TileShape {
  return TILE_SHAPES[SHAPE_INDEX[((v % SHAPE_INDEX.length) + SHAPE_INDEX.length) % SHAPE_INDEX.length]];
}

/** 给 UI 用的轮廓类名 */
export function shapeClass(v: number): string {
  return `llk-shape${SHAPE_INDEX[((v % SHAPE_INDEX.length) + SHAPE_INDEX.length) % SHAPE_INDEX.length]}`;
}

// ---------------------------------------------------------------------------
// 四、手机 360px：格子不能小于 32px，整盘不许滚动
// ---------------------------------------------------------------------------

/** 棋盘可用宽度（360px 屏减去卡片内边距） */
export const PHONE_BOARD_W = 336;
export const MIN_CELL_PX = 32;
export const CELL_GAP_PX = 3;
/**
 * 四周那圈「空边」只是给连线借道用的，本身点不着，
 * 所以只占正常格子的一小截宽度——不然 8 列的关在 360px 上就挤成 30px 了。
 */
export const RING_FRAC = 0.45;

/** cols 列（不含空边）在 360px 上一格有多大 */
export function cellSizePx(cols: number, boardW = PHONE_BOARD_W, gap = CELL_GAP_PX): number {
  const tracks = cols + RING_FRAC * 2;
  return (boardW - gap * (cols + 1)) / tracks;
}

/** 整盘塞得进 360px 而且每格 ≥ 32px 吗 */
export function fitsPhone(cols: number, boardW = PHONE_BOARD_W): boolean {
  return cellSizePx(cols, boardW) >= MIN_CELL_PX;
}

/** 棋盘的 grid-template-columns：两头是窄空边，中间才是真格子 */
export function gridTemplate(cols: number): string {
  return `${RING_FRAC}fr repeat(${cols}, 1fr) ${RING_FRAC}fr`;
}

// ---------------------------------------------------------------------------
// 五、无尽「连到底」
// ---------------------------------------------------------------------------

export const ENDLESS_ROWS = 6;
export const ENDLESS_COLS = 6;
/** 每几盘加一档难度 */
export const ENDLESS_STEP = 3;
/** 前几盘不限时，让孩子先热身 */
export const ENDLESS_FREE_ROUNDS = 3;

/** 第 round 盘（从 1 开始）有几种图案：每 3 盘 +1，封顶 14 */
export function endlessKinds(round: number): number {
  return Math.min(14, 6 + Math.floor((Math.max(1, round) - 1) / ENDLESS_STEP));
}

/** 第 round 盘限时几秒（0 = 不限时）：前 3 盘不限时，之后越来越紧 */
export function endlessSeconds(round: number): number {
  const r = Math.max(1, round);
  if (r <= ENDLESS_FREE_ROUNDS) return 0;
  return Math.max(45, 120 - (r - ENDLESS_FREE_ROUNDS - 1) * 6);
}

/** 越往后越花：从第 7 盘起开始收拢，第 13 盘起只准拐一次 */
export function endlessSpec(round: number): BoardSpec {
  const r = Math.max(1, round);
  return {
    rows: ENDLESS_ROWS,
    cols: ENDLESS_COLS,
    kinds: endlessKinds(r),
    gravity: r < 7 ? "none" : r < 10 ? "down" : r < 13 ? "left" : "center",
    maxTurns: r >= 13 ? 1 : 2
  };
}

/**
 * 这一盘比上一盘拧动了哪几个旋钮，按「先说最要命的」排好。
 *
 * 第 7 / 10 / 13 盘是一次拧三四个的大台阶（图案又多一种、收拢方向又换、
 * 线还只准拐一次）。只报其中一条的话，孩子照着上一盘的打法下手，
 * 撞几次墙才慢慢明白规矩已经变了——变的还不止一条。
 */
export function endlessStepChanges(round: number): string[] {
  const r = Math.max(1, round);
  if (r <= 1) return [];
  const out: string[] = [];
  if (endlessSpec(r).maxTurns < endlessSpec(r - 1).maxTurns) out.push("线只准拐一次弯");
  if (endlessSeconds(r - 1) === 0 && endlessSeconds(r) > 0) out.push(`要看表啦，${endlessSeconds(r)} 秒`);
  else if (endlessSeconds(r) > 0 && endlessSeconds(r) < endlessSeconds(r - 1)) out.push(`时间收到 ${endlessSeconds(r)} 秒`);
  if (endlessSpec(r).gravity !== endlessSpec(r - 1).gravity) out.push("换收拢方向啦");
  if (endlessKinds(r) > endlessKinds(r - 1)) out.push(`图案多了一种（${endlessKinds(r)} 种）`);
  return out;
}

/** 这一盘比上一盘难在哪，用来在屏幕上说一句人话——变了几样就说几样 */
export function endlessStepWord(round: number): string {
  const r = Math.max(1, round);
  if (r === 1) return "第 1 盘，先热热身，不限时～";
  const changes = endlessStepChanges(r);
  if (changes.length === 0) return `第 ${r} 盘，接着连！`;
  return `第 ${r} 盘：${changes.join("，")}！`;
}

export interface EndlessState {
  round: number;
  /** 累计消掉多少对 */
  pairs: number;
  /** 这一盘已经消掉多少对 */
  roundPairs: number;
  over: boolean;
}

export function endlessInit(): EndlessState {
  return { round: 1, pairs: 0, roundPairs: 0, over: false };
}

export function endlessPair(st: EndlessState): EndlessState {
  if (st.over) return st;
  return { ...st, pairs: st.pairs + 1, roundPairs: st.roundPairs + 1 };
}

/** 一盘清完，换下一盘 */
export function endlessNext(st: EndlessState): EndlessState {
  if (st.over) return st;
  return { ...st, round: st.round + 1, roundPairs: 0 };
}

/** 时间到就收工（不限时的盘永远不会被叫停） */
export function endlessTimeUp(st: EndlessState): EndlessState {
  if (st.over) return st;
  return { ...st, over: true };
}

export function endlessWord(st: EndlessState, best: number): string {
  if (st.pairs > best) return `🎉 连到第 ${st.round} 盘、总共 ${st.pairs} 对，新纪录！`;
  return `这次连到第 ${st.round} 盘、总共 ${st.pairs} 对～离最好成绩 ${best} 对不远啦，再来一次！`;
}

/** 棋盘清空了没有 */
export function boardCleared(b: BoardState): boolean {
  return tilesLeft(b) === 0;
}

// ---------------------------------------------------------------------------
// 六、资源看管：destroy 之后必须一件不剩
// ---------------------------------------------------------------------------

export interface TimerHost {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval?(fn: () => void, ms: number): number;
  clearInterval?(id: number): void;
}

export interface ListenerTarget {
  addEventListener(type: string, fn: (ev: Event) => void): void;
  removeEventListener(type: string, fn: (ev: Event) => void): void;
}

function defaultHost(): TimerHost {
  const g = globalThis as unknown as TimerHost;
  return {
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (id) => g.clearTimeout(id),
    setInterval: g.setInterval ? (fn, ms) => (g.setInterval as (f: () => void, m: number) => number)(fn, ms) : undefined,
    clearInterval: g.clearInterval ? (id) => (g.clearInterval as (i: number) => void)(id) : undefined
  };
}

/** 定时器 / 计时器 / 监听的总管：`pending()` 在 destroy 之后必须是 0 */
export class Janitor {
  private timers = new Set<number>();
  private tickers = new Set<number>();
  private offs: Array<() => void> = [];
  private readonly host: TimerHost;
  dead = false;

  constructor(host?: TimerHost) {
    this.host = host ?? defaultHost();
  }

  pending(): number {
    return this.timers.size + this.tickers.size + this.offs.length;
  }

  after(ms: number, fn: () => void): number {
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  every(ms: number, fn: () => void): number {
    if (!this.host.setInterval) return 0;
    const id = this.host.setInterval(() => {
      if (!this.dead) fn();
    }, ms);
    this.tickers.add(id);
    return id;
  }

  on<T extends ListenerTarget>(target: T, type: string, fn: (ev: Event) => void): void {
    target.addEventListener(type, fn);
    this.own(() => target.removeEventListener(type, fn));
  }

  own(off: () => void): void {
    this.offs.push(off);
  }

  destroy(): void {
    this.dead = true;
    for (const id of this.timers) this.host.clearTimeout(id);
    this.timers.clear();
    for (const id of this.tickers) this.host.clearInterval?.(id);
    this.tickers.clear();
    while (this.offs.length) {
      try {
        this.offs.pop()?.();
      } catch (err) {
        console.warn("[一朵一星] 连连看清理时出错:", err);
      }
    }
  }
}
