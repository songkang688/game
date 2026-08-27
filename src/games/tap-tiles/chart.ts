/**
 * 音符下落 · 谱面生成与约束校验(纯函数)。
 *
 * 谱面只由 seed 决定,同一关每次生成的音符一模一样,所以能拿机器人回放跑通。
 * 生成时就守住三条约束,`validateChart` 再独立复查一遍:
 *  1. 同一时刻最多 maxConcurrent 条轨有块(默认 2,Boss 关显式放开到 3);
 *  2. 不同时刻的相邻音符间隔 ≥ minGapMs(speed);
 *  3. 长按条的区间不与同轨任何别的块重叠。
 */
import { mulberry32 } from "../level99";

/** 四条轨 */
export const LANE_COUNT = 4;
/** 所有轨道的编号 */
export const ALL_LANES: readonly number[] = [0, 1, 2, 3];

/** 相邻音符的最小间隔下限:再快也不许比这更密,手指跟得上才算数 */
export const MIN_GAP_FLOOR = 150;
/** 速度 1 时的最小间隔基准 */
export const GAP_BASE = 320;
/** 默认同一时刻最多两条轨有块 */
export const DEFAULT_MAX_CONCURRENT = 2;
/** Boss 关放开到三押 */
export const BOSS_MAX_CONCURRENT = 3;

/** 这个速度下的最小间隔(毫秒):速度越快间隔越短,但不会低于 MIN_GAP_FLOOR */
export function minGapMs(speed: number): number {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return Math.max(MIN_GAP_FLOOR, Math.round(GAP_BASE / s));
}

export interface Note {
  /** 第几条轨(0..3) */
  lane: number;
  /** 音符头落到判定线的时刻(毫秒) */
  time: number;
  /** 长按时长(毫秒);0 是普通块 */
  hold: number;
}

export interface Chart {
  seed: number;
  speed: number;
  /** 本谱采用的最小间隔 */
  minGap: number;
  /** 同一时刻最多几条轨有块 */
  maxConcurrent: number;
  /** 这张谱用到的轨道 */
  lanes: number[];
  notes: Note[];
  /** 整张谱多长(毫秒),最后一个音符后面留一段收尾 */
  durationMs: number;
}

export interface ChartOpts {
  /** 用哪几条轨,默认四条全用 */
  lanes?: readonly number[];
  /** 生成多少个音符 */
  count?: number;
  /** 出长按条的概率 */
  holdChance?: number;
  /** 同一时刻出双押的概率 */
  chordChance?: number;
  /** 同时最多几条轨有块 */
  maxConcurrent?: number;
  /** 第一个音符从什么时候开始落 */
  startMs?: number;
}

/** 收尾留白:最后一个音符走完还留这么久再算整张谱结束 */
export const CHART_TAIL_MS = 1400;
/** 第一个音符默认什么时候到判定线(给玩家一点准备时间) */
export const CHART_LEAD_MS = 1200;

/** 某一时刻 t 上有几条轨被占着(长按条整段都算占着) */
export function concurrentAt(notes: readonly Note[], t: number): number {
  let n = 0;
  for (const note of notes) {
    if (note.time <= t && t <= note.time + note.hold) n++;
  }
  return n;
}

/**
 * 按 seed 生成一张谱。density 越大音符越密(0.6 稀疏 ~ 1.6 密集),
 * speed 决定最小间隔。生成过程本身就守着三条约束,不靠事后过滤。
 */
export function chartFromSeed(seed: number, density: number, speed: number, opts: ChartOpts = {}): Chart {
  const lanes = [...(opts.lanes ?? ALL_LANES)].filter((l) => l >= 0 && l < LANE_COUNT).sort((a, b) => a - b);
  const useLanes = lanes.length > 0 ? lanes : [...ALL_LANES];
  const maxConcurrent = Math.max(1, Math.min(useLanes.length, opts.maxConcurrent ?? DEFAULT_MAX_CONCURRENT));
  const gap = minGapMs(speed);
  const count = Math.max(1, Math.round(opts.count ?? 24));
  const holdChance = Math.min(1, Math.max(0, opts.holdChance ?? 0));
  const chordChance = Math.min(1, Math.max(0, opts.chordChance ?? 0));
  const dens = Math.min(1.6, Math.max(0.6, Number.isFinite(density) ? density : 1));
  // 密度低的时候间隔拉得开一些:在最小间隔之上再随机加一段
  const spread = Math.max(0, Math.round(gap * (1.6 / dens - 1)));

  const rand = mulberry32(seed >>> 0);
  const notes: Note[] = [];
  /** 每条轨要空到什么时候才允许再放块(长按条会把自己那条轨占住) */
  const laneFree = new Array<number>(LANE_COUNT).fill(-1);

  let t = Math.max(0, Math.round(opts.startMs ?? CHART_LEAD_MS));
  let guard = 0;
  while (notes.length < count && guard++ < count * 40) {
    const active = concurrentAt(notes, t);
    let want = 1;
    if (chordChance > 0 && rand() < chordChance) want = 2;
    if (maxConcurrent >= 3 && chordChance > 0 && rand() < chordChance * 0.4) want = 3;
    want = Math.min(want, maxConcurrent - active, useLanes.length);

    if (want > 0) {
      const free = useLanes.filter((l) => laneFree[l] <= t);
      // 洗一遍再取前 want 条,免得总是落在同几条轨上
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      for (const lane of free.slice(0, want)) {
        if (notes.length >= count) break;
        // 长按条会把后面一段时间都占住,所以只在剩余并发够用时才放
        const canHold = holdChance > 0 && rand() < holdChance;
        const hold = canHold ? (2 + Math.floor(rand() * 3)) * gap : 0;
        notes.push({ lane, time: t, hold });
        laneFree[lane] = t + hold + gap;
      }
    }
    t += gap + Math.round(rand() * spread);
  }

  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  const last = notes.reduce((m, n) => Math.max(m, n.time + n.hold), 0);
  return {
    seed,
    speed,
    minGap: gap,
    maxConcurrent,
    lanes: useLanes,
    notes,
    durationMs: last + CHART_TAIL_MS,
  };
}

export interface ChartCheck {
  ok: boolean;
  errors: string[];
}

/**
 * 独立复查三条约束(生成器写错了这里必须红)。
 * 并发只需要在每个音符的起点上查:一堆区间的最大重叠一定出现在某个区间的起点。
 */
export function validateChart(chart: Chart): ChartCheck {
  const errors: string[] = [];
  const notes = [...chart.notes].sort((a, b) => a.time - b.time || a.lane - b.lane);

  for (const n of notes) {
    if (!chart.lanes.includes(n.lane)) errors.push(`第 ${n.time}ms 的音符落在没启用的第 ${n.lane} 轨`);
    if (n.hold < 0) errors.push(`第 ${n.time}ms 的长按时长是负数`);
  }

  // 1. 同一时刻最多 maxConcurrent 条轨
  for (const n of notes) {
    const at = concurrentAt(notes, n.time);
    if (at > chart.maxConcurrent) {
      errors.push(`第 ${n.time}ms 同时有 ${at} 条轨有块,超过上限 ${chart.maxConcurrent}`);
    }
  }

  // 2. 不同时刻的相邻音符间隔 ≥ minGap
  const times = [...new Set(notes.map((n) => n.time))].sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    if (d < chart.minGap) errors.push(`第 ${times[i - 1]}ms 与第 ${times[i]}ms 只隔了 ${d}ms,比最小间隔还密`);
  }

  // 3. 同一条轨上,长按条不与别的块重叠
  for (const lane of chart.lanes) {
    const own = notes.filter((n) => n.lane === lane);
    for (let i = 1; i < own.length; i++) {
      const prev = own[i - 1];
      const cur = own[i];
      if (cur.time <= prev.time + prev.hold) {
        errors.push(`第 ${lane} 轨:第 ${prev.time}ms 的块拖到 ${prev.time + prev.hold}ms,和第 ${cur.time}ms 的块叠上了`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** 谱面里有几个长按条 */
export function holdCount(chart: Chart): number {
  return chart.notes.filter((n) => n.hold > 0).length;
}

/** 谱面里有几个「同一时刻多条轨」的和弦时刻 */
export function chordCount(chart: Chart): number {
  const byTime = new Map<number, number>();
  for (const n of chart.notes) byTime.set(n.time, (byTime.get(n.time) ?? 0) + 1);
  return [...byTime.values()].filter((v) => v >= 2).length;
}
