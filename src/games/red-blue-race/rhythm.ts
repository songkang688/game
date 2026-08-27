/**
 * 红蓝赛跑 · 1.2 交替节奏模型(纯函数,不碰 DOM)。
 *
 * 1.1 的输入是「一个键狂点」,点得越快越快,砸键就是最优解。
 * 1.2 换成左右交替的步子,一次点击能推多远由三件事相乘决定:
 *
 *  1. **交替**:左右换着按拿满收益;连续按同一个键,每多按一次就乘一次衰减系数
 *     (有地板,砸到底也还能挪一点,不至于原地卡死);
 *  2. **上限**:比「人真按得出来的最快交替频率」还密的点击不再多给距离
 *     ——两倍频率只换来半步,总速度封顶,乱砸键不会更快;
 *  3. **稳定**:每一拍与上一拍的间隔够接近就攒一层「稳」,攒满给一份固定上限的加成
 *     ——奖励的是把节奏踩稳,而不是把按钮砸烂。
 *
 * 基线故意定成「交替 + 还没攒稳」= ×1.0:`logic.ts` 里那套 188 关可通关模拟
 * 用的就是这个基线,所以真人只要会交替就跑得不比模拟慢,前 99 关的难度一格没动。
 */

/** 一步用哪只脚:左右交替按才跑得开 */
export type StepKey = "left" | "right";

/**
 * 人真按得出来的最快交替频率(每秒次数)。
 * 小学中高年级两指交替的稳定上限大约在 6 次/秒,极限手速冲到 7~8 次/秒,
 * 这里取 7.5 当上限:既不冤枉手快的孩子,也给 AI 的目标节奏封了顶
 * (`ai.ts` 的四档全部拿它做断言,不许出现玩家做不到的频率)。
 */
export const HUMAN_TAP_CAP_HZ = 7.5;

/** 与上限对应的最小有效间隔(毫秒):比这更密的点击按比例打折 */
export const MIN_EFFECTIVE_GAP_MS = 1000 / HUMAN_TAP_CAP_HZ;

/** 连续按同一个键,每多按一次乘一次这个系数 */
export const SAME_KEY_DECAY = 0.68;

/** 同键衰减的地板:再怎么砸同一个键,一步也还有这么多 */
export const SAME_KEY_FLOOR = 0.3;

/** 这一拍与上一拍相差多少毫秒之内算「踩稳了」 */
export const STEADY_TOLERANCE_MS = 55;

/** 节奏稳定最多给多少加成 */
export const STEADY_BONUS = 0.18;

/** 连续稳几拍才攒满加成 */
export const STEADY_FULL_TAPS = 6;

/** 第一拍没有「上一拍」可比,按最小有效间隔算,拿到不亏不赚的 ×1.0 */
export const FIRST_TAP_GAP_MS = MIN_EFFECTIVE_GAP_MS;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 连续同键的收益系数:交替(streak 0)拿满 1,
 * 之后每多按一次同键乘一次 `SAME_KEY_DECAY`,跌到 `SAME_KEY_FLOOR` 为止。
 */
export function sameKeyFactor(sameStreak: number): number {
  if (!Number.isFinite(sameStreak) || sameStreak <= 0) return 1;
  return Math.max(SAME_KEY_FLOOR, SAME_KEY_DECAY ** Math.floor(sameStreak));
}

/**
 * 频率系数:间隔不短于最小有效间隔就是满收益,
 * 更密的点击按比例打折——砸出两倍频率只有半步,总速度封顶。
 */
export function cadenceFactor(gapMs: number): number {
  if (!Number.isFinite(gapMs) || gapMs <= 0) return 0;
  return Math.min(1, gapMs / MIN_EFFECTIVE_GAP_MS);
}

/** 稳定层数换成加成:攒满 `STEADY_FULL_TAPS` 拿满 `STEADY_BONUS` */
export function steadyFactor(steadyTaps: number): number {
  return 1 + STEADY_BONUS * (clamp(steadyTaps, 0, STEADY_FULL_TAPS) / STEADY_FULL_TAPS);
}

/**
 * 这一拍算不算踩稳:要和上一拍的间隔够接近,
 * 而且本身不能是砸键(间隔至少要到最小有效间隔),砸键攒不出稳定加成。
 */
export function isSteadyTap(gapMs: number, lastGapMs: number): boolean {
  if (!Number.isFinite(gapMs) || !Number.isFinite(lastGapMs)) return false;
  if (lastGapMs <= 0) return false;
  if (gapMs < MIN_EFFECTIVE_GAP_MS) return false;
  return Math.abs(gapMs - lastGapMs) <= STEADY_TOLERANCE_MS;
}

export interface RhythmState {
  /** 上一步用的哪只脚,没跑过是 null */
  lastKey: StepKey | null;
  /** 连续按同一个键的次数(0 表示刚刚交替过) */
  sameStreak: number;
  /** 上一拍的间隔(毫秒) */
  lastGapMs: number;
  /** 已经连续踩稳几拍 */
  steadyTaps: number;
}

export interface TapResult {
  state: RhythmState;
  /** 这一步的步长倍率:乘在关卡的 `tapStep` 上 */
  multiplier: number;
  /** 这一步是不是和上一步换了脚 */
  alternated: boolean;
  /** 这一步算不算踩稳 */
  steady: boolean;
}

export function initRhythm(): RhythmState {
  return { lastKey: null, sameStreak: 0, lastGapMs: 0, steadyTaps: 0 };
}

/**
 * 走一步:传入这一步用的脚与距上一步的间隔,返回新状态和这一步的步长倍率。
 * 纯函数,不改传进来的 state。
 */
export function tapRhythm(state: RhythmState, key: StepKey, gapMs: number): TapResult {
  const gap = Number.isFinite(gapMs) && gapMs > 0 ? gapMs : 0;
  const alternated = state.lastKey !== null && state.lastKey !== key;
  const sameStreak = state.lastKey === key ? state.sameStreak + 1 : 0;
  const steady = isSteadyTap(gap, state.lastGapMs);
  const steadyTaps = steady ? Math.min(STEADY_FULL_TAPS, state.steadyTaps + 1) : 0;
  const multiplier = sameKeyFactor(sameStreak) * cadenceFactor(gap) * steadyFactor(steadyTaps);
  return {
    state: { lastKey: key, sameStreak, lastGapMs: gap, steadyTaps },
    multiplier,
    alternated,
    steady
  };
}

/**
 * 一串按键按固定间隔敲下来能推多远(以步长倍率累计)。
 * 「左右交替比连按同一个键跑得快」这条规格就靠它写断言。
 */
export function tapSeriesDistance(keys: readonly StepKey[], gapMs: number): number {
  let state = initRhythm();
  let sum = 0;
  for (const [i, key] of keys.entries()) {
    const res = tapRhythm(state, key, i === 0 ? FIRST_TAP_GAP_MS : gapMs);
    state = res.state;
    sum += res.multiplier;
  }
  return sum;
}

/** 生成一串左右交替的脚:`alternating(4)` = 左右左右 */
export function alternating(n: number): StepKey[] {
  const out: StepKey[] = [];
  for (let i = 0; i < Math.max(0, Math.floor(n)); i++) out.push(i % 2 === 0 ? "left" : "right");
  return out;
}

/** 生成一串只按同一只脚的序列(拿来和交替对照) */
export function sameFoot(n: number, key: StepKey = "left"): StepKey[] {
  return new Array<StepKey>(Math.max(0, Math.floor(n))).fill(key);
}

/**
 * 一位玩家按某个频率交替跑,每秒能推进多少格(用来和 AI 四档的目标节奏对表)。
 * 只算「交替 + 踩稳」的理想情况,是这套模型的天花板。
 */
export function pacePerSec(tapsPerSec: number, tapStep: number): number {
  const hz = Number.isFinite(tapsPerSec) && tapsPerSec > 0 ? tapsPerSec : 0;
  const gap = hz > 0 ? 1000 / hz : 0;
  return hz * tapStep * cadenceFactor(gap) * steadyFactor(STEADY_FULL_TAPS);
}
