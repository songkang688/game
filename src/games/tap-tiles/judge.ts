/**
 * 音符下落 · 判定与计分(纯函数,不碰 DOM)。
 *
 * 判定窗口、连击倍率、长按条的完成条件、速度表全在这儿,
 * 视图层只负责把时间戳喂进来,规则一步都不自己算。
 */

export type Judgement = "perfect" | "good" | "miss";

/** 完美窗口:|Δt| ≤ 45ms */
export const PERFECT_MS = 45;
/** 良好窗口:45ms < |Δt| ≤ 100ms;超出就是 miss */
export const GOOD_MS = 100;
/** 长按条尾端这么多毫秒之内松手,都算按到了尾 */
export const HOLD_TAIL_MS = 100;

/** 闯关允许 miss 三次,第四次才收工 */
export const CAMPAIGN_MAX_MISS = 3;
/** 无尽 0 容错 */
export const ENDLESS_MAX_MISS = 0;

/** 判定名(界面上给孩子看的) */
export const JUDGE_NAMES: Record<Judgement, string> = {
  perfect: "完美",
  good: "良好",
  miss: "溜走",
};

/** miss 只说这一句,不批评人 */
export const MISS_LINE = "这个音符溜走啦";
/** 点到空白格的提示,同样只提醒不责怪 */
export const EMPTY_LINE = "空白格轻轻放过就好";

/**
 * 按偏差毫秒判一个音符。
 * 早点晚点一视同仁,所以先取绝对值;边界值算在窗口里面(45 是完美,46 就是良好)。
 */
export function judge(offsetMs: number): Judgement {
  if (!Number.isFinite(offsetMs)) return "miss";
  const d = Math.abs(offsetMs);
  if (d <= PERFECT_MS) return "perfect";
  if (d <= GOOD_MS) return "good";
  return "miss";
}

/** 完美的底分 */
export const PERFECT_SCORE = 100;
/** 良好的底分 */
export const GOOD_SCORE = 50;
/** 连击倍率封顶 */
export const MAX_MULTIPLIER = 4;

/** 连击倍率:每 10 连加 0.5 倍,最多 4 倍 */
export function comboMultiplier(combo: number): number {
  if (!Number.isFinite(combo) || combo <= 0) return 1;
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / 10) * 0.5);
}

/** 一次判定拿多少分:miss 一分没有,其余按底分乘连击倍率 */
export function scoreCombo(judgement: Judgement, combo: number): number {
  if (judgement === "miss") return 0;
  const base = judgement === "perfect" ? PERFECT_SCORE : GOOD_SCORE;
  return Math.round(base * comboMultiplier(combo));
}

export interface HoldNote {
  /** 音符头落到判定线的时刻(毫秒) */
  time: number;
  /** 长按时长(毫秒);0 表示普通块 */
  hold: number;
}

export interface HoldResult {
  judgement: Judgement;
  /** 按到尾了没有 */
  complete: boolean;
  /** 没完成时的原因,给界面提示用 */
  reason: "" | "head" | "early";
}

/**
 * 长按条:按下的时刻决定判定档,松手的时刻决定完不完成。
 * 头没接住直接 miss;接住了但中途松手也是 miss;撑到尾端 100ms 之内松手才算完成。
 */
export function holdTrack(note: HoldNote, downMs: number, upMs: number): HoldResult {
  const head = judge(downMs - note.time);
  if (head === "miss") return { judgement: "miss", complete: false, reason: "head" };
  const end = note.time + Math.max(0, note.hold);
  if (upMs >= end - HOLD_TAIL_MS) return { judgement: head, complete: true, reason: "" };
  return { judgement: "miss", complete: false, reason: "early" };
}

// ---------------------------------------------------------------------------
// 速度表(纯数据换算,单调递增)
// ---------------------------------------------------------------------------

/** 第 1 关的速度 */
export const SPEED_BASE = 1;
/** 每往后一关加多少速度 */
export const SPEED_STEP = 0.0115;
/** 闯关速度上限 */
export const SPEED_MAX = 3.2;
/** 速度 1 时音符从顶上落到判定线要多久(毫秒) */
export const APPROACH_BASE_MS = 2200;

/** 第 level 关(0 基)的下落速度:随关卡严格递增,到顶就封在 SPEED_MAX */
export function speedAt(level: number): number {
  const n = Number.isFinite(level) ? Math.max(0, Math.round(level)) : 0;
  return Math.round(Math.min(SPEED_MAX, SPEED_BASE + n * SPEED_STEP) * 1e4) / 1e4;
}

/** 无尽第一档速度 */
export const ENDLESS_SPEED_BASE = 1.1;
/** 无尽每 8 秒提一档 */
export const ENDLESS_STEP_MS = 8000;
export const ENDLESS_SPEED_STEP = 0.12;
export const ENDLESS_SPEED_MAX = 3.6;

/** 无尽模式:每撑过 8 秒提一档速度,越玩越快,到顶封住 */
export function endlessSpeedAt(elapsedMs: number): number {
  const ms = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const steps = Math.floor(ms / ENDLESS_STEP_MS);
  return (
    Math.round(Math.min(ENDLESS_SPEED_MAX, ENDLESS_SPEED_BASE + steps * ENDLESS_SPEED_STEP) * 1e4) / 1e4
  );
}

/** 这个速度下,音符从顶上落到判定线要多少毫秒(速度越大越短) */
export function approachMs(speed: number): number {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return Math.round(APPROACH_BASE_MS / s);
}
