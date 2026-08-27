/**
 * 音乐星星 · 节奏判定（1.2 新增，纯函数，无副作用）。
 *
 * 1.1 的节奏关只比对长短音的**顺序**，隔一分钟再敲也算对——练的是记忆不是节奏。
 * 1.2 补上真正的时间判定：
 *
 *  - 三档窗口：完美 ±60ms、良好 ±120ms、勉强 ±200ms，超出算漏；
 *  - **判定基准一律 `AudioContext.currentTime`**（秒，单调，与音频输出同一把尺），
 *    不用 `Date.now()`——后者会被系统对时、页面卡顿拽偏，和实际听到的声音对不上；
 *  - 开局测一次输出延迟：声音从「排上日程」到「进耳朵」有一段路，
 *    孩子自然会晚这么多敲下去，这一段不算他的错，判定时先减掉。
 */

/** 完美档：±60ms */
export const PERFECT_MS = 60;
/** 良好档：±120ms */
export const GOOD_MS = 120;
/** 勉强档：±200ms，再超就算漏 */
export const OK_MS = 200;

/** 三档窗口的常量表（从严到宽） */
export const JUDGE_WINDOWS_MS: readonly number[] = [PERFECT_MS, GOOD_MS, OK_MS];

export type HitGrade = "perfect" | "good" | "ok" | "miss";

/** 每一档的中文说法（面向孩子，漏掉也只说「差一点」，不打叉） */
export const GRADE_WORDS: Readonly<Record<HitGrade, string>> = {
  perfect: "刚刚好",
  good: "很准",
  ok: "跟上了",
  miss: "差一点",
};

/** 每一档折算的分数：三档拉开差距，但漏一拍不扣成负数 */
export const GRADE_POINTS: Readonly<Record<HitGrade, number>> = {
  perfect: 3,
  good: 2,
  ok: 1,
  miss: 0,
};

/** 偏差毫秒（可正可负）落在哪一档 */
export function judgeHit(deltaMs: number): HitGrade {
  if (!Number.isFinite(deltaMs)) return "miss";
  const d = Math.abs(deltaMs);
  if (d <= PERFECT_MS) return "perfect";
  if (d <= GOOD_MS) return "good";
  if (d <= OK_MS) return "ok";
  return "miss";
}

/** 输出延迟最多补偿这么多，再大就当读数不可信（有的浏览器会给出离谱的值） */
export const MAX_LATENCY_MS = 400;

/** 只要求这两个可选读数，真 `AudioContext` 与测试桩都对得上 */
export interface LatencySource {
  outputLatency?: number;
  baseLatency?: number;
}

/**
 * 测一次输出延迟（毫秒）。
 * 优先 `outputLatency`（真正的「到扬声器」延迟），没有就退 `baseLatency`（缓冲区延迟），
 * 都没有就当 0；负数、NaN、离谱的大数一律夹回 0–400ms。
 */
export function measureLatencyMs(ctx: LatencySource | null | undefined): number {
  if (!ctx) return 0;
  const raw = typeof ctx.outputLatency === "number" && Number.isFinite(ctx.outputLatency) && ctx.outputLatency > 0
    ? ctx.outputLatency
    : typeof ctx.baseLatency === "number" && Number.isFinite(ctx.baseLatency) && ctx.baseLatency > 0
      ? ctx.baseLatency
      : 0;
  return Math.max(0, Math.min(MAX_LATENCY_MS, raw * 1000));
}

/**
 * 把玩家敲下去的时刻（秒，`AudioContext.currentTime`）换算成「他心里对准的那一刻」：
 * 声音晚到耳朵 latency 毫秒，他就自然晚敲 latency 毫秒，减掉才公平。
 */
export function compensate(tapSec: number, latencyMs: number): number {
  return tapSec - latencyMs / 1000;
}

/** 一次敲击的判定结果 */
export interface TapJudgement {
  /** 对上的拍点下标；一个都没对上是 -1 */
  index: number;
  grade: HitGrade;
  /** 敲击相对拍点的偏差（毫秒，正数是敲晚了） */
  deltaMs: number;
}

/**
 * 把一次敲击对到最近的、还没被占用的拍点上。
 *
 * @param beats  拍点时刻（秒，`AudioContext` 时钟）
 * @param tapSec 敲击时刻（秒，同一把尺）
 * @param taken  已经被前面的敲击占掉的拍点
 * @param latencyMs 开局测出来的输出延迟
 */
export function judgeTap(
  beats: readonly number[],
  tapSec: number,
  taken: readonly boolean[] = [],
  latencyMs = 0
): TapJudgement {
  const at = compensate(tapSec, latencyMs);
  let best = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < beats.length; i++) {
    if (taken[i]) continue;
    const delta = (at - beats[i]) * 1000;
    if (Math.abs(delta) < Math.abs(bestDelta)) {
      best = i;
      bestDelta = delta;
    }
  }
  if (best < 0) return { index: -1, grade: "miss", deltaMs: Number.POSITIVE_INFINITY };
  const grade = judgeHit(bestDelta);
  return grade === "miss"
    ? { index: -1, grade: "miss", deltaMs: bestDelta }
    : { index: best, grade, deltaMs: bestDelta };
}

/**
 * 一句节奏的拍点时刻表（秒）。
 * @param startSec 第一拍的时刻
 * @param durations 每一拍占多久（毫秒）
 * @param gapMs 拍与拍之间的空隙
 */
export function beatSchedule(startSec: number, durations: readonly number[], gapMs = 0): number[] {
  const out: number[] = [];
  let at = startSec;
  for (const dur of durations) {
    out.push(at);
    at += (dur + gapMs) / 1000;
  }
  return out;
}

/** 整句敲完的成绩：几个完美、几个良好、漏了几个 */
export interface RhythmScore {
  perfect: number;
  good: number;
  ok: number;
  miss: number;
  /** 折算总分，满分是「全部完美」 */
  points: number;
  full: number;
}

/** 汇总一整句的判定档位 */
export function summarize(grades: readonly HitGrade[], total = grades.length): RhythmScore {
  const out: RhythmScore = { perfect: 0, good: 0, ok: 0, miss: 0, points: 0, full: total * GRADE_POINTS.perfect };
  for (const g of grades) {
    out[g]++;
    out.points += GRADE_POINTS[g];
  }
  out.miss += Math.max(0, total - grades.length);
  return out;
}
