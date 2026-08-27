/**
 * 泡泡噗噗 · 1.2 塌陷时间线与新机关。
 *
 * 1.1 消完一组是「一次 render 直达终态」——泡泡瞬移补位，孩子看不懂盘面怎么变的。
 * 1.2 把塌陷拆成一条时间线，并且只有这一条：
 *   消除 180ms → 同列下落（每格 70ms，同列相邻错峰 20ms）→ 空列左移 120ms → 稳定后判定。
 * `prefers-reduced-motion` 下把每段压到一帧，但走的还是同一个状态机（不另开分支）。
 *
 * 本文件是纯函数 + 纯数据：计划怎么落、落到一半视觉坐标在哪、死局怎么重排、
 * 连锁泡炸哪一圈、分数怎么算、无尽「泡泡海」怎么上推。index.ts 与单测共用。
 */
import { EMPTY, FROZEN_OFFSET, STONE, colorOf, hasMovesOn, isFrozen } from "./logic";

// ---------------------------------------------------------------------------
// 时间线常量
// ---------------------------------------------------------------------------

/** 消除:泡泡「噗」地散开 */
export const POP_MS = 180;
/** 下落:每掉一格花多少毫秒(规格给的是 60–80ms) */
export const FALL_MS_PER_CELL = 70;
/** 同一列里相邻两颗的错峰,免得整列像一块砖一样掉下来 */
export const FALL_STAGGER_MS = 20;
/** 空列左移 */
export const SHIFT_MS = 120;
/** reduced-motion 下每一段压到一帧 */
export const REDUCED_FRAME_MS = 16;

export type CollapsePhase = "pop" | "fall" | "shift" | "done";

export interface FallMove {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  /** 相对下落段开始的延迟 */
  delayMs: number;
  /** 这一颗自己走完要多久 */
  durMs: number;
}

export interface ColumnShift {
  fromC: number;
  toC: number;
}

export interface CollapsePlan {
  popMs: number;
  fallStartMs: number;
  fallEndMs: number;
  shiftStartMs: number;
  shiftMs: number;
  totalMs: number;
  falls: FallMove[];
  shifts: ColumnShift[];
  /** 下落落定、还没左移并拢时的中间盘面(渲染第二段用) */
  afterFall: number[][];
  /** 落定之后的盘面(逻辑终态) */
  next: number[][];
}

function cloneGrid(grid: readonly number[][]): number[][] {
  return grid.map((row) => row.slice());
}

/**
 * 算出这一次塌陷「谁往哪走、什么时候走」。
 * 不改动传进来的盘面；终态放在 plan.next 里，动画播完再整片换上去。
 */
export function planCollapse(
  grid: readonly number[][],
  cols: number,
  up: boolean,
  opts: { reduced?: boolean } = {}
): CollapsePlan {
  const reduced = opts.reduced === true;
  const perCell = reduced ? 0 : FALL_MS_PER_CELL;
  const stagger = reduced ? 0 : FALL_STAGGER_MS;
  const popMs = reduced ? REDUCED_FRAME_MS : POP_MS;
  const shiftMs = reduced ? REDUCED_FRAME_MS : SHIFT_MS;

  const rows = grid.length;
  const work = cloneGrid(grid);
  const falls: FallMove[] = [];

  // 第一步:每一列各自压实(重力朝下就往下压,倒影天湖翻过来就往上压)
  for (let c = 0; c < cols; c++) {
    let order = 0;
    if (up) {
      let write = 0;
      for (let r = 0; r < rows; r++) {
        if (work[r][c] < 0) continue;
        if (write !== r) {
          falls.push({
            fromR: r,
            fromC: c,
            toR: write,
            toC: c,
            delayMs: order * stagger,
            durMs: Math.abs(r - write) * perCell,
          });
          order++;
        }
        work[write][c] = work[r][c];
        if (write !== r) work[r][c] = EMPTY;
        write++;
      }
      for (let r = write; r < rows; r++) work[r][c] = EMPTY;
    } else {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (work[r][c] < 0) continue;
        if (write !== r) {
          falls.push({
            fromR: r,
            fromC: c,
            toR: write,
            toC: c,
            delayMs: order * stagger,
            durMs: Math.abs(r - write) * perCell,
          });
          order++;
        }
        work[write][c] = work[r][c];
        if (write !== r) work[r][c] = EMPTY;
        write--;
      }
      for (let r = write; r >= 0; r--) work[r][c] = EMPTY;
    }
  }

  const afterFall = cloneGrid(work);

  // 第二步:整列空了就往左并拢
  const shifts: ColumnShift[] = [];
  let writeCol = 0;
  for (let c = 0; c < cols; c++) {
    const hasAny = work.some((row) => row[c] >= 0);
    if (!hasAny) continue;
    if (writeCol !== c) {
      shifts.push({ fromC: c, toC: writeCol });
      for (let r = 0; r < rows; r++) {
        work[r][writeCol] = work[r][c];
        work[r][c] = EMPTY;
      }
    }
    writeCol++;
  }

  const fallSpan = falls.reduce((m, f) => Math.max(m, f.delayMs + f.durMs), 0);
  const fallStartMs = popMs;
  const fallEndMs = fallStartMs + fallSpan;
  const shiftStartMs = fallEndMs;
  const totalMs = shiftStartMs + (shifts.length > 0 ? shiftMs : 0);

  return { popMs, fallStartMs, fallEndMs, shiftStartMs, shiftMs, totalMs, falls, shifts, afterFall, next: work };
}

/** 现在走到哪一段了 */
export function phaseAt(plan: CollapsePlan, t: number): CollapsePhase {
  if (t < plan.popMs) return "pop";
  if (t < plan.fallEndMs) return "fall";
  if (t < plan.totalMs) return "shift";
  return "done";
}

/** 0..1 之间的缓动:落下时稍微加速,收尾不生硬 */
export function easeFall(k: number): number {
  const x = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return x * x * (3 - 2 * x);
}

/**
 * 某一颗正在下落的泡泡此刻的「视觉行号」(小数)。
 * 塌陷进行中它一定不等于逻辑行号——这条是本步的铁律，单测直接盯着它。
 */
export function visualRowAt(plan: CollapsePlan, move: FallMove, t: number): number {
  const local = t - plan.fallStartMs - move.delayMs;
  if (local <= 0) return move.fromR;
  if (move.durMs <= 0 || local >= move.durMs) return move.toR;
  return move.fromR + (move.toR - move.fromR) * easeFall(local / move.durMs);
}

/** 某一列此刻的「视觉列号」(小数),左移进行中同样不等于逻辑列号 */
export function visualColAt(plan: CollapsePlan, shift: ColumnShift, t: number): number {
  if (t <= plan.shiftStartMs) return shift.fromC;
  if (plan.shiftMs <= 0 || t >= plan.totalMs) return shift.toC;
  const k = (t - plan.shiftStartMs) / plan.shiftMs;
  return shift.fromC + (shift.toC - shift.fromC) * easeFall(k);
}

/** 塌陷过程中还没落定的泡泡数量(演出用) */
export function movingCount(plan: CollapsePlan, t: number): number {
  return plan.falls.filter((f) => t < plan.fallStartMs + f.delayMs + f.durMs).length;
}

// ---------------------------------------------------------------------------
// 分数:n² 式,消得越多越划算
// ---------------------------------------------------------------------------

/** 一组 n 颗的得分:少于 2 颗消不掉记 0 分 */
export function groupScore(n: number): number {
  const k = Number.isFinite(n) ? Math.floor(n) : 0;
  if (k < 2) return 0;
  return k * k;
}

/** 大群加成的门槛:8 颗起给一次水波演出 */
export const BIG_GROUP = 8;

// ---------------------------------------------------------------------------
// 连锁泡:消掉后炸开一圈
// ---------------------------------------------------------------------------

/** 连锁泡的格子值(接在 logic.ts 的 96 之前那些之后,不和老值冲突) */
export const CHAIN = 96;

export function isChain(v: number): boolean {
  return v === CHAIN;
}

/** 连锁泡炸开的那一圈(八邻,石头不炸) */
export function chainRing(grid: readonly number[][], cols: number, r: number, c: number): Array<[number, number]> {
  const rows = grid.length;
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const v = grid[nr][nc];
      if (v < 0 || v === STONE) continue;
      out.push([nr, nc]);
    }
  }
  return out;
}

/**
 * 点掉一颗连锁泡:自己碎掉,再把周围一圈也带走;
 * 圈里如果又碰到连锁泡就继续往外接,一路连下去(有 seen 表,不会绕回来)。
 * 返回要清掉的全部格子,原盘不动。
 */
export function chainBlast(grid: readonly number[][], cols: number, r: number, c: number): Array<[number, number]> {
  if (!isChain(grid[r]?.[c] ?? EMPTY)) return [];
  const seen = new Set<number>([r * cols + c]);
  const out: Array<[number, number]> = [[r, c]];
  const queue: Array<[number, number]> = [[r, c]];
  while (queue.length > 0) {
    const [cr, cc] = queue.shift() as [number, number];
    for (const [nr, nc] of chainRing(grid, cols, cr, cc)) {
      const key = nr * cols + nc;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([nr, nc]);
      if (isChain(grid[nr][nc])) queue.push([nr, nc]);
    }
  }
  return out;
}

/** 冰泡:相邻消一次先化半层,再消一次才真的碎(logic.ts 的 isFrozen 判定不变) */
export function thawFrozen(v: number): number {
  return isFrozen(v) ? v - 10 : v;
}

// ---------------------------------------------------------------------------
// 死局:吹一口气重排
// ---------------------------------------------------------------------------

/** 现在是不是走不动了(没有可消的群、也没有机关可点) */
export function isDeadlock(grid: readonly number[][], cols: number, colors: number): boolean {
  return !hasMovesOn(grid as number[][], cols, colors);
}

/**
 * 吹一口气:把场上的泡泡原样打散重排(数量与种类一颗不多一颗不少),
 * 直到至少有一步可走。实在排不出来就手动把两颗同色摆到一起兜底。
 * 返回新的盘面,不改原盘。
 */
export function blowShuffle(
  grid: readonly number[][],
  cols: number,
  colors: number,
  rand: () => number
): number[][] {
  const rows = grid.length;
  const spots: Array<[number, number]> = [];
  const values: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] < 0) continue;
      spots.push([r, c]);
      values.push(grid[r][c]);
    }
  }
  const next = (): number[][] => {
    const g = grid.map((row) => row.map(() => EMPTY));
    const pool = values.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    spots.forEach(([r, c], i) => {
      g[r][c] = pool[i];
    });
    return g;
  };

  for (let guard = 0; guard < 40; guard++) {
    const g = next();
    if (hasMovesOn(g, cols, colors)) return g;
  }

  // 兜底:强行把两颗同色摆成邻居(只在极端牌型下才走到这里)
  const g = next();
  for (let i = 0; i + 1 < spots.length; i++) {
    const [r1, c1] = spots[i];
    const [r2, c2] = spots[i + 1];
    const adjacent = (r1 === r2 && Math.abs(c1 - c2) === 1) || (c1 === c2 && Math.abs(r1 - r2) === 1);
    if (!adjacent) continue;
    const color = colorOf(g[r1][c1], colors);
    if (color < 0) continue;
    g[r2][c2] = color;
    return g;
  }
  return g;
}

// ---------------------------------------------------------------------------
// 无尽「泡泡海」
// ---------------------------------------------------------------------------

/** 泡泡海的盘面高度:顶到第 0 行就收摊 */
export const SEA_ROWS = 12;

/** 第一段收紧拧到底是第几推 */
export const SEA_TIGHTEN_CAP = 18;

/** 涨潮间隔的下限:再快也得留 1.8 秒看一眼盘面 */
export const SEA_PUSH_FLOOR_MS = 1800;

/** 从第几推开始会来「大潮」(一次涨两行) */
export const SEA_BIG_TIDE_FROM = 20;

/** 大潮最勤也是三推来一次,不会推推都是大潮 */
export const SEA_BIG_TIDE_MIN_EVERY = 3;

/**
 * 第 n 次上推之间隔多久(毫秒):越玩越紧,但有下限。
 * 第一段坡（每推快 220ms）第 18 推就拧到 2600ms 到底了,
 * 原来到这儿就彻底不变——第 200 推和第 18 推是同一件事。
 * 现在接一段更缓的坡（每推快 20ms）走到 1800ms 再稳住。
 */
export function seaPushMs(pushes: number): number {
  const n = Math.max(0, Math.round(pushes) || 0);
  if (n <= SEA_TIGHTEN_CAP) return Math.max(2600, 6500 - n * 220);
  return Math.max(SEA_PUSH_FLOOR_MS, 2600 - (n - SEA_TIGHTEN_CAP) * 20);
}

/**
 * 第 n 次上推涨几行。
 * 间隔一项旋钮拧不出多少花样,所以后段再加一个「大潮」:
 * 每隔几推来一次双行,越到后面来得越勤,但最勤也是三推一次。
 */
export function seaTideRows(pushes: number): number {
  const n = Math.max(0, Math.round(pushes) || 0);
  if (n < SEA_BIG_TIDE_FROM) return 1;
  const every = Math.max(SEA_BIG_TIDE_MIN_EVERY, 8 - Math.floor((n - SEA_BIG_TIDE_FROM) / 12));
  return (n - SEA_BIG_TIDE_FROM) % every === 0 ? 2 : 1;
}

/** 泡泡海第 n 次上推用几种颜色:先少后多 */
export function seaColors(pushes: number): number {
  const n = Math.max(0, Math.round(pushes) || 0);
  return Math.min(5, 3 + Math.floor(n / 6));
}

/** 从第几推开始,涨上来的新行里会夹冰冻泡泡 */
export const SEA_FROZEN_FROM = 12;

/** 一行最多夹几颗冰冻:留够能下手的地方,不能整行都是冰 */
export const SEA_FROZEN_MAX = 2;

/**
 * 第 n 次上推的新行里夹几颗冰冻泡泡。
 *
 * 战役里有石头/冰冻/彩虹/闪电四种花样,泡泡海却从头到尾只涨纯色——
 * 越玩越只剩「点最大的一团」这一件事。这里给深海加一味:
 * 冰冻泡泡自己不成组,得在它旁边消一组才化得开。
 *
 * 挑冰冻而不挑石头,是因为石头永远消不掉:它会跟着涨潮一路顶到警戒线,
 * 攒够十来颗就成了「必死」,那不是加压是断路。冰冻随时化得开,只是让人多绕一步。
 */
export function seaFrozen(pushes: number): number {
  const n = Math.max(0, Math.round(pushes) || 0);
  if (n < SEA_FROZEN_FROM) return 0;
  return Math.min(SEA_FROZEN_MAX, 1 + Math.floor((n - SEA_FROZEN_FROM) / 40));
}

/**
 * 底部推上来一行:整片往上挪一格,最底下补一行新的。
 * 返回新盘面与「有没有顶到线」。原盘不动。
 */
export function pushUpRow(
  grid: readonly number[][],
  cols: number,
  colors: number,
  rand: () => number,
  frozen = 0
): { grid: number[][]; overflow: boolean } {
  const rows = grid.length;
  const overflow = grid[0].some((v) => v >= 0);
  const out: number[][] = [];
  for (let r = 1; r < rows; r++) out.push(grid[r].slice());
  const fresh: number[] = [];
  for (let c = 0; c < cols; c++) fresh.push(Math.floor(rand() * colors) % Math.max(1, colors));
  // 冰冻只挑不重样的列,而且最多冻半行——整行冻住就没地方下手了
  const chill = Math.max(0, Math.min(Math.floor(frozen), Math.floor(cols / 2), SEA_FROZEN_MAX));
  const picked = new Set<number>();
  for (let i = 0; i < chill; i++) {
    let c = Math.floor(rand() * cols) % Math.max(1, cols);
    for (let tries = 0; picked.has(c) && tries < cols; tries++) c = (c + 1) % cols;
    if (picked.has(c)) break;
    picked.add(c);
    fresh[c] += FROZEN_OFFSET;
  }
  out.push(fresh);
  return { grid: out, overflow };
}

/** 泡泡海收摊时的一句话(只鼓励) */
export function seaLine(score: number, best: number): string {
  if (score <= 0) return "泡泡海刚涨潮就退场啦,先从最大的一团点起,下一趟稳得多!";
  if (score > best) return `新纪录!你在泡泡海里点出了 ${score} 分!`;
  return `这趟拿到 ${score} 分,最好纪录是 ${best} 分。留意底下涨上来的新行,先消下面收益最高。`;
}

// ---------------------------------------------------------------------------
// 收摊清理:定时器 + rAF 统一记账,destroy 一把倒干净
// ---------------------------------------------------------------------------

/** 定时器与 rAF 的宿主;单测传一个假的进来就能数「还剩几个没清」 */
export interface BubbleBagHost {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  cancelRaf: (id: number) => void;
}

export function globalBubbleBagHost(): BubbleBagHost {
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
    cancelRaf: (id) => cancelAnimationFrame(id),
  };
}

/**
 * 闯关与无尽两条路原本各手抄了一份「timeouts Set + destroyed 标记 + raf」,
 * 这里收成一个口袋:延时都从 `after` 过一手,rAF 交给 `onRaf` 记住最新的一帧,
 * `close()` 之后既不会再回调,也不会留下任何没清的东西。
 */
export class BubbleBag {
  private timeouts = new Set<number>();
  private raf = 0;
  private closed = false;

  constructor(private host: BubbleBagHost = globalBubbleBagHost()) {}

  /** 还活着(没收摊)才继续跑动画与回调 */
  get alive(): boolean {
    return !this.closed;
  }

  /** 还挂着几件东西(close 后必须是 0) */
  get size(): number {
    return this.timeouts.size + (this.raf ? 1 : 0);
  }

  /** 延时回调:收摊之后到点也不会再执行 */
  after(fn: () => void, ms: number): void {
    if (this.closed) return;
    const id = this.host.setTimeout(() => {
      this.timeouts.delete(id);
      if (!this.closed) fn();
    }, ms);
    this.timeouts.add(id);
  }

  /** 记住最新的一帧;收摊之后再来的一帧直接取消 */
  onRaf(id: number): void {
    if (this.closed) {
      this.host.cancelRaf(id);
      return;
    }
    this.raf = id;
  }

  /** 把手上排着的活全清掉,但口袋还能接着用(无尽「再涨一次潮」就走这条) */
  clearPending(): void {
    if (this.raf) this.host.cancelRaf(this.raf);
    this.raf = 0;
    for (const id of this.timeouts) this.host.clearTimeout(id);
    this.timeouts.clear();
  }

  close(): void {
    this.clearPending();
    this.closed = true;
  }
}

/** 按住时给的预览提示:高亮整群 + 预计得分 */
export function previewLabel(n: number): string {
  if (n < 2) return "单颗消不掉～找挨在一起的同色泡泡";
  return `×${n} · 预计 ${groupScore(n)} 分`;
}
