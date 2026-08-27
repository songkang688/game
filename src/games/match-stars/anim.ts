/**
 * 星星消消乐 · 时间线（纯函数 + 一个没有 DOM 依赖的段落播放器）。
 *
 * 这个文件是本次升级的核心。1.1 的消除是「状态 A 直接写成状态 B」，
 * 方块只是原地换了个图案；1.2 起中间多了一份**移动清单**：
 * 谁从第几行掉到第几行、什么时候开始掉、掉多久，全在 `FallTween` 里。
 *
 * 两条规矩：
 *  1. `planGravity` / `planRefill` 不改规则、不吃随机数，只读盘面算清单，可以单独单测；
 *  2. `prefers-reduced-motion` 只换一张时长表（每段压到 1 帧），
 *     状态机一段都不少走——绝不另开一条「瞬变」分支。
 */
import { columnSegments, EMPTY, type ColumnMask } from "./board";

// ---------------------------------------------------------------------------
// 时长表
// ---------------------------------------------------------------------------

export interface Timings {
  /** 交换 / 回弹：120–160ms */
  swapMs: number;
  /** 匹配格爆开：180–220ms */
  boomMs: number;
  /** 下落每格：60–80ms */
  perCellMs: number;
  /** 同列每个块错开多少毫秒出「瀑布感」 */
  staggerMs: number;
  /** 落地压扁回弹 */
  landMs: number;
  /** 传送带滑移 */
  beltMs: number;
  /** 稳定之后、结算之前的一口气 */
  settleMs: number;
}

export const FULL_TIMINGS: Timings = {
  swapMs: 140,
  boomMs: 200,
  perCellMs: 70,
  staggerMs: 20,
  landMs: 90,
  beltMs: 200,
  settleMs: 120,
};

/**
 * `prefers-reduced-motion`：每段压到 1 帧（16ms）。
 * 下落那一段整段也要在 1 帧内跑完，所以每格 2ms、不再错峰——
 * 但 `fall` 这一段依然存在、依然会被 tick 到，走的是同一个状态机。
 */
export const CALM_TIMINGS: Timings = {
  swapMs: 16,
  boomMs: 16,
  perCellMs: 2,
  staggerMs: 0,
  landMs: 16,
  beltMs: 16,
  settleMs: 16,
};

export function timings(reduced: boolean): Timings {
  return reduced ? CALM_TIMINGS : FULL_TIMINGS;
}

/** 读一次系统的「减少动态效果」偏好；读不到就当没开 */
export function prefersReducedMotion(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return !!mm?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 移动清单
// ---------------------------------------------------------------------------

/** 一个方块的下落：从 `fromRow` 掉到 `toRow`（同一列） */
export interface FallTween {
  /** 掉下来的是哪个图案 */
  cell: number;
  fromRow: number;
  toRow: number;
  col: number;
  delayMs: number;
  durMs: number;
}

/** 新块的落入：`fromRow` 是负数，表示它还在棋盘顶外面 */
export type SpawnTween = FallTween;

/**
 * 交换与传送带用的任意方向滑移。
 * 注意 `cell` 在这里是**落进哪一格的格子下标**（视图拿它当 key），
 * 而 `FallTween.cell` 是掉下来的那个图案本身——两者语义不同，转换走 `asSlide`。
 */
export interface SlideTween {
  cell: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  delayMs: number;
  durMs: number;
}

export interface PlanOpts extends ColumnMask {
  perCellMs?: number;
  staggerMs?: number;
  /** 整段往后推多少毫秒（补块要接在下落后面时用） */
  baseDelayMs?: number;
}

function opt(o: PlanOpts | undefined, k: "perCellMs" | "staggerMs" | "baseDelayMs"): number {
  const v = o?.[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (k === "perCellMs") return FULL_TIMINGS.perCellMs;
  if (k === "staggerMs") return FULL_TIMINGS.staggerMs;
  return 0;
}

/**
 * 算出每个**幸存块**从哪一行掉到哪一行。
 *
 * @param before 消除完、还没压实的盘面（空位是 `EMPTY`）
 * @param after  压实之后的盘面；补没补新块都行——配对只看「自下而上的第 k 个」，
 *               幸存块永远占着一段的最下面 k 位，所以两种盘面算出来一样
 * @param cols   列数
 *
 * 不改规则、不吃随机数：同样的入参永远给出同样的清单。
 */
export function planGravity(before: number[], after: number[], cols: number, opts?: PlanOpts): FallTween[] {
  const rows = Math.floor(before.length / cols);
  const perCell = opt(opts, "perCellMs");
  const stagger = opt(opts, "staggerMs");
  const base = opt(opts, "baseDelayMs");
  const out: FallTween[] = [];
  for (let c = 0; c < cols; c++) {
    for (const seg of columnSegments(cols, rows, c, opts ?? {})) {
      const src: number[] = [];
      const dst: number[] = [];
      for (const r of seg.rows) {
        if (before[r * cols + c] >= 0) src.push(r);
        if (after[r * cols + c] >= 0) dst.push(r);
      }
      for (let k = 0; k < src.length && k < dst.length; k++) {
        const fromRow = src[k];
        const toRow = dst[k];
        if (fromRow === toRow) continue;
        out.push({
          cell: before[fromRow * cols + c],
          fromRow,
          toRow,
          col: c,
          delayMs: base + k * stagger,
          // 行号往下是变大的，掉几格就是 toRow - fromRow
          durMs: Math.max(1, (toRow - fromRow) * perCell),
        });
      }
    }
  }
  return out;
}

/**
 * 算出要补几个新块、每个从棋盘顶外的第几行落进来。
 *
 * @param settled 压实之后、还没补块的盘面（顶上的洞是 `EMPTY`）
 *
 * 一列里自下而上第 j 个洞，配一个从第 `-(j+1)` 行落进来的新块——
 * 它们本来就在棋盘外排着队，最下面那个先掉。挡板底下的洞不补，那是设计好的。
 */
export function planRefill(settled: number[], cols: number, opts?: PlanOpts): SpawnTween[] {
  const rows = Math.floor(settled.length / cols);
  const perCell = opt(opts, "perCellMs");
  const stagger = opt(opts, "staggerMs");
  const base = opt(opts, "baseDelayMs");
  const out: SpawnTween[] = [];
  for (let c = 0; c < cols; c++) {
    const segs = columnSegments(cols, rows, c, opts ?? {});
    const top = segs[segs.length - 1];
    if (!top || !top.open) continue;
    let j = 0;
    for (const r of top.rows) {
      if (settled[r * cols + c] !== EMPTY) continue;
      const fromRow = -(j + 1);
      out.push({
        cell: EMPTY,
        fromRow,
        toRow: r,
        col: c,
        delayMs: base + j * stagger,
        durMs: Math.max(1, (r - fromRow) * perCell),
      });
      j++;
    }
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 下落是加速的：越掉越快，落地那一下才有分量 */
export function fallEase(t: number): number {
  const x = clamp01(t);
  return x * x;
}

/** 交换 / 滑移用的缓动：两头慢中间快 */
export function slideEase(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}

/** 某一时刻这个方块的**视觉行**（浮点）。下落没走完时它必然不等于 `toRow` */
export function tweenRow(tw: FallTween, elapsedMs: number): number {
  const t = fallEase((elapsedMs - tw.delayMs) / Math.max(1, tw.durMs));
  return tw.fromRow + (tw.toRow - tw.fromRow) * t;
}

/** 某一时刻这个方块的视觉坐标（浮点行列） */
export function tweenPos(tw: SlideTween, elapsedMs: number): { row: number; col: number } {
  const t = slideEase((elapsedMs - tw.delayMs) / Math.max(1, tw.durMs));
  return {
    row: tw.fromRow + (tw.toRow - tw.fromRow) * t,
    col: tw.fromCol + (tw.toCol - tw.fromCol) * t,
  };
}

/** 整段动画什么时候结束（最晚一条 tween 的结束时刻） */
export function planEndMs(tweens: Array<{ delayMs: number; durMs: number }>): number {
  let end = 0;
  for (const t of tweens) end = Math.max(end, t.delayMs + t.durMs);
  return end;
}

/** 把下落清单转成通用滑移（视图只认一种）：`cell` 换成落点的格子下标 */
export function asSlide(tw: FallTween, cols: number): SlideTween {
  return {
    cell: tw.toRow * cols + tw.col,
    fromRow: tw.fromRow,
    fromCol: tw.col,
    toRow: tw.toRow,
    toCol: tw.col,
    delayMs: tw.delayMs,
    durMs: tw.durMs,
  };
}

/** 两格交换：各自从对方的位置滑过来 */
export function planSwap(a: number, b: number, cols: number, durMs: number): SlideTween[] {
  const ra = Math.floor(a / cols), ca = a % cols;
  const rb = Math.floor(b / cols), cb = b % cols;
  return [
    { cell: a, fromRow: rb, fromCol: cb, toRow: ra, toCol: ca, delayMs: 0, durMs },
    { cell: b, fromRow: ra, fromCol: ca, toRow: rb, toCol: cb, delayMs: 0, durMs },
  ];
}

/**
 * 传送带：整行循环平移一格，每一格都是**滑过去**的，不许瞬跳。
 * `slots` 是这一行还能动的格子（自左而右）。
 */
export function planBelt(slots: number[], dir: 1 | -1, cols: number, durMs: number): SlideTween[] {
  if (slots.length < 2) return [];
  const step = dir >= 0 ? 1 : -1;
  const n = slots.length;
  const out: SlideTween[] = [];
  slots.forEach((to, k) => {
    const from = slots[((k - step) % n + n) % n];
    out.push({
      cell: to,
      fromRow: Math.floor(from / cols),
      fromCol: from % cols,
      toRow: Math.floor(to / cols),
      toCol: to % cols,
      delayMs: 0,
      durMs,
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// 段落播放器：时间线的骨架
// ---------------------------------------------------------------------------

/**
 * 一次出手会依次经过这些段，顺序不可跳：
 * `swap`（换过去）→ `revert`（没匹配就换回来）/ `boom`（爆开）→
 * `fall`（下落 + 补块）→ `land`（落地回弹）→ 连锁回 `boom` →
 * `belt`（传送带滑移）→ `settle`（结算）→ `idle`。
 */
export type Phase = "idle" | "swap" | "revert" | "boom" | "fall" | "land" | "belt" | "settle";

export interface Step {
  phase: Phase;
  durMs: number;
  /** 这一段开始的瞬间做什么（改逻辑盘面就放这儿） */
  enter?: () => void;
  /** 这一段走完做什么（可以再往队尾推新段，连锁就是这么接上的） */
  done?: () => void;
}

/**
 * 按毫秒顺序播放一串段落。没有 DOM、没有 rAF、没有 setTimeout：
 * 时间从外面 `tick(now)` 喂进来，所以单测可以拿虚拟时钟一帧一帧地走。
 */
export class Runner {
  private queue: Step[] = [];
  private cur: Step | null = null;
  private startedAt = 0;
  private now = 0;
  /** 走过的段落轨迹（单测用来证明 reduced-motion 走的是同一条路） */
  readonly trace: Phase[] = [];

  push(...steps: Step[]): void {
    for (const s of steps) this.queue.push(s);
  }

  /** 插到队首：连锁要紧接着当前这一段走 */
  unshift(...steps: Step[]): void {
    this.queue.unshift(...steps);
  }

  clear(): void {
    this.queue.length = 0;
    this.cur = null;
  }

  get phase(): Phase {
    return this.cur?.phase ?? "idle";
  }

  get busy(): boolean {
    return this.cur !== null || this.queue.length > 0;
  }

  /** 当前这一段已经走了多少毫秒 */
  get elapsed(): number {
    return this.cur ? this.now - this.startedAt : 0;
  }

  /** 当前这一段走完了百分之多少 */
  get progress(): number {
    if (!this.cur || this.cur.durMs <= 0) return 1;
    return clamp01(this.elapsed / this.cur.durMs);
  }

  tick(now: number): void {
    this.now = now;
    // 一帧内可能走完好几段（reduced-motion 尤其常见），但状态机一段都不跳过
    for (let guard = 0; guard < 400; guard++) {
      if (!this.cur) {
        const next = this.queue.shift();
        if (!next) return;
        this.cur = next;
        this.startedAt = now;
        this.trace.push(next.phase);
        next.enter?.();
        // 零长度的段也要占一帧的位置，免得 enter 的效果一帧都没显示过
        if (next.durMs > 0) return;
      }
      const cur = this.cur;
      if (now - this.startedAt < cur.durMs) return;
      this.cur = null;
      cur.done?.();
    }
  }
}
