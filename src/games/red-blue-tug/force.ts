/**
 * 红蓝拔河 · 1.2 力量模型(纯函数,`index.ts` 与无头模拟器共用同一份)。
 *
 * 三件事:
 *  1. **体力**:按住掉、松开回;掉到 0 就「脱力」,力量骤降到三成,
 *     必须松手把体力缓回 `WINDED_CLEAR` 才恢复 —— 所以一直按住是最差的打法;
 *  2. **蓄力 / 突然发力**:松手攒够 `CHARGE_MS` 再按下,开头一段有爆发加成,
 *     于是最优解是「歇半秒、发力大半秒」的节奏,而不是狂按;
 *  3. **加油点**:绳子上飘过来的加油点经过中线时发力(±120ms),额外拉一把;
 *     这一下必须是松手之后的发力,连点蹭不到。
 *
 * `stepSide` 内部按 `MAX_SUBSTEP` 切子步,30fps 和 120fps 推出来的结果一样。
 */
import { mulberry32 } from "../level99";
import { TUG12, type Tuning } from "./tuning";

// ---------------------------------------------------------------------------
// 1. 体力与出力
// ---------------------------------------------------------------------------

/** 一侧选手的力量状态;`index.ts` 里红蓝各持一份 */
export interface SideState {
  /** 当前体力 */
  stamina: number;
  /** 上一步是不是按着 */
  pressed: boolean;
  /** 体力见底后的脱力标记 */
  winded: boolean;
  /** 已经松手多久(毫秒),用来判蓄力与加油点 */
  restMs: number;
  /** 这一次按住持续了多久(毫秒) */
  holdMs: number;
  /** 爆发还剩多少毫秒 */
  burstMs: number;
}

/** 一侧选手的体力参数;关卡可以按 `cfg.stamina` / `cfg.staminaRegen` 覆盖 */
export interface SideConfig {
  staminaMax: number;
  drain: number;
  regen: number;
}

export function sideConfig(patch: Partial<SideConfig> = {}, tune: Tuning = TUG12): SideConfig {
  return {
    staminaMax: patch.staminaMax ?? tune.STAMINA_MAX,
    drain: patch.drain ?? tune.DRAIN_PER_SEC,
    regen: patch.regen ?? tune.REGEN_PER_SEC,
  };
}

export function createSide(cfg: SideConfig): SideState {
  return { stamina: cfg.staminaMax, pressed: false, winded: false, restMs: 9999, holdMs: 0, burstMs: 0 };
}

/**
 * 体力对力量的折扣:满力段是 1,往下线性掉到 `LOW_FACTOR`,脱力直接砍到 `EXHAUST_FACTOR`。
 * 这条曲线就是「连续猛按见底后力量骤降」的那一跌。
 */
export function powerFactor(stamina: number, winded: boolean, tune: Tuning = TUG12): number {
  if (winded) return tune.EXHAUST_FACTOR;
  const s = Number.isFinite(stamina) ? Math.max(0, Math.min(tune.STAMINA_MAX, stamina)) : 0;
  if (s >= tune.STRONG_AT) return 1;
  return tune.LOW_FACTOR + (1 - tune.LOW_FACTOR) * (s / tune.STRONG_AT);
}

/**
 * 抓绳系数:刚按下只有 `GRIP_MIN` 的力,抓满 `GRIP_RAMP_MS` 才使得出全力。
 * 一抽一放的狂按每一下都停在这条曲线的最下面,这是「狂按不划算」的另一半原因。
 */
export function gripFactor(holdMs: number, tune: Tuning = TUG12): number {
  if (!Number.isFinite(holdMs) || holdMs <= 0) return tune.GRIP_MIN;
  if (holdMs >= tune.GRIP_RAMP_MS) return 1;
  return tune.GRIP_MIN + (1 - tune.GRIP_MIN) * (holdMs / tune.GRIP_RAMP_MS);
}

/** 这一下按下算不算「蓄够了力」 */
export function isCharged(restMs: number, tune: Tuning = TUG12): boolean {
  return Number.isFinite(restMs) && restMs >= tune.CHARGE_MS;
}

export interface SideStep {
  side: SideState;
  /** 这一段时间的平均力量倍率(0 表示没在拉);乘本方基础力量就是每秒拉多少 */
  factor: number;
  /** 这一段里有没有「刚按下」的那一下 */
  pressEdge: boolean;
  /** 按下的那一刻已经松手多久(没有按下就是 -1) */
  edgeRestMs: number;
}

/** 一个子步:dt 必须已经足够小(调用方保证) */
function subStep(side: SideState, press: boolean, dt: number, cfg: SideConfig, tune: Tuning): SideStep {
  const dtMs = dt * 1000;
  let { stamina, winded, restMs, holdMs, burstMs } = side;
  const edge = press && !side.pressed;
  const edgeRestMs = edge ? restMs : -1;

  if (edge) {
    burstMs = isCharged(restMs, tune) ? tune.BURST_MS : 0;
    holdMs = 0;
  }

  if (press) {
    restMs = 0;
    holdMs += dtMs;
    stamina = Math.max(0, stamina - cfg.drain * dt);
    if (stamina <= 0) winded = true;
  } else {
    restMs += dtMs;
    holdMs = 0;
    burstMs = 0;
    stamina = Math.min(cfg.staminaMax, stamina + cfg.regen * dt);
  }
  if (winded && stamina >= tune.WINDED_CLEAR) winded = false;

  let factor = 0;
  if (press) {
    // 用这一小步中点的抓绳时间,子步再细也不会把斜坡算歪
    factor = powerFactor(stamina, winded, tune) * gripFactor(holdMs - dtMs / 2, tune);
    if (burstMs > 0) {
      const burstPart = Math.min(burstMs, dtMs) / dtMs;
      factor *= 1 + (tune.BURST_GAIN - 1) * burstPart;
      burstMs = Math.max(0, burstMs - dtMs);
    }
  }

  return {
    side: { stamina, pressed: press, winded, restMs, holdMs, burstMs },
    factor,
    pressEdge: edge,
    edgeRestMs,
  };
}

/**
 * 推进一侧选手 dt 秒。dt 再大也会被切成 ≤ `MAX_SUBSTEP` 的小步,
 * 返回的 `factor` 是这一段时间的**平均**倍率,所以 30fps 与 120fps 的位移几乎一致。
 */
export function stepSide(
  side: SideState,
  press: boolean,
  dt: number,
  cfg: SideConfig,
  tune: Tuning = TUG12
): SideStep {
  const total = Number.isFinite(dt) && dt > 0 ? Math.min(0.25, dt) : 0;
  if (total <= 0) return { side, factor: 0, pressEdge: false, edgeRestMs: -1 };
  const steps = Math.max(1, Math.ceil(total / tune.MAX_SUBSTEP));
  const h = total / steps;
  let cur = side;
  let impulse = 0;
  let edge = false;
  let edgeRest = -1;
  for (let i = 0; i < steps; i++) {
    const r = subStep(cur, press, h, cfg, tune);
    cur = r.side;
    impulse += r.factor * h;
    if (r.pressEdge) {
      edge = true;
      edgeRest = r.edgeRestMs;
    }
  }
  return { side: cur, factor: impulse / total, pressEdge: edge, edgeRestMs: edgeRest };
}

/** 体力条显示成几成(0..1),画面与用例共用 */
export function staminaRatio(side: SideState, cfg: SideConfig): number {
  if (!(cfg.staminaMax > 0)) return 1;
  return Math.max(0, Math.min(1, side.stamina / cfg.staminaMax));
}

// ---------------------------------------------------------------------------
// 2. 加油点(节奏点)
// ---------------------------------------------------------------------------

/**
 * 排一串加油点经过中线的时刻(毫秒)。
 * 同一场对局红蓝两边**共用同一串**,所以两边的机会完全对称。
 */
export function buildBeats(seed: number, spanMs: number, gapScale = 1, tune: Tuning = TUG12): number[] {
  const rand = mulberry32(Math.floor(Number.isFinite(seed) ? seed : 1) >>> 0);
  const scale = Number.isFinite(gapScale) && gapScale > 0 ? gapScale : 1;
  const span = Number.isFinite(spanMs) && spanMs > 0 ? spanMs : 0;
  const out: number[] = [];
  let t = tune.BEAT_TRAVEL_MS;
  while (t <= span) {
    out.push(Math.round(t));
    t += (tune.BEAT_GAP_MIN_MS + rand() * (tune.BEAT_GAP_MAX_MS - tune.BEAT_GAP_MIN_MS)) * scale;
  }
  return out;
}

/** 这一下发力和加油点差多少毫秒,算不算踩上(±120ms) */
export function withinBeatWindow(beatAt: number, pressAt: number, tune: Tuning = TUG12): boolean {
  if (!Number.isFinite(beatAt) || !Number.isFinite(pressAt)) return false;
  return Math.abs(pressAt - beatAt) <= tune.BEAT_WINDOW_MS;
}

/**
 * 这一下发力踩中了第几个加油点;没踩中返回 -1。
 * 三个条件缺一不可:落在 ±120ms 窗口里、这一下是**松手 ≥250ms 之后**的发力、这一颗还没被自己领走。
 */
export function beatHitIndex(
  beats: readonly number[],
  pressAt: number,
  restMs: number,
  from: number,
  tune: Tuning = TUG12
): number {
  if (!Number.isFinite(restMs) || restMs < tune.BEAT_MIN_REST_MS) return -1;
  for (let i = Math.max(0, from); i < beats.length; i++) {
    if (beats[i] < pressAt - tune.BEAT_WINDOW_MS) continue;
    if (beats[i] > pressAt + tune.BEAT_WINDOW_MS) return -1;
    return i;
  }
  return -1;
}

/** 下一颗还没过中线的加油点下标(画面提示与 AI 都用它) */
export function nextBeatFrom(beats: readonly number[], nowMs: number, from = 0): number {
  for (let i = Math.max(0, from); i < beats.length; i++) {
    if (beats[i] >= nowMs) return i;
  }
  return -1;
}

/** 加油点此刻在绳子上的位置:-1 在自己这边场外,0 正过中线,1 在对面场外 */
export function beatTrack(beatAt: number, nowMs: number, tune: Tuning = TUG12): number {
  const travel = tune.BEAT_TRAVEL_MS;
  return Math.max(-1, Math.min(1, (nowMs - (beatAt - travel)) / travel - 1));
}

// ---------------------------------------------------------------------------
// 3. 反拉「拼一把」
// ---------------------------------------------------------------------------

export interface ComebackState {
  /** 窗口开到什么时候 */
  activeUntil: number;
  /** 冷却到什么时候才允许再开 */
  readyAt: number;
}

export function createComeback(): ComebackState {
  return { activeUntil: -1, readyAt: 0 };
}

export interface ComebackStep {
  state: ComebackState;
  /** 这一刻的拉力加成(0 或 COMEBACK_GAIN,永远不叠加) */
  gain: number;
  /** 这一步刚好开窗(画面播提示用) */
  opened: boolean;
}

/**
 * 落后一方被拉到 ≥80% 位置时开 2 秒「拼一把」窗口。
 *
 * `side` 是 +1(朵朵,绳子往正方向算赢)或 -1(星星);
 * `enabled` 关掉就永远没有加成 —— 这条是可开关的,默认开。
 */
export function comebackStep(
  state: ComebackState,
  rope: number,
  side: 1 | -1,
  nowMs: number,
  enabled: boolean,
  tune: Tuning = TUG12
): ComebackStep {
  if (!enabled) return { state: { activeUntil: -1, readyAt: state.readyAt }, gain: 0, opened: false };
  const edge = tune.COMEBACK_AT * tune.ROPE_WIN;
  const behind = side === 1 ? rope <= -edge : rope >= edge;
  let { activeUntil, readyAt } = state;
  let opened = false;
  if (behind && nowMs >= activeUntil && nowMs >= readyAt) {
    activeUntil = nowMs + tune.COMEBACK_MS;
    readyAt = activeUntil + tune.COMEBACK_COOLDOWN_MS;
    opened = true;
  }
  const gain = nowMs < activeUntil ? tune.COMEBACK_GAIN : 0;
  return { state: { activeUntil, readyAt }, gain, opened };
}

// ---------------------------------------------------------------------------
// 4. 红绿灯(1.1 的机关,在连续模型里改成「红灯按着就往回滑」)
// ---------------------------------------------------------------------------

/** 固定周期的红绿灯:模拟器与实机用同一条曲线 */
export function lightGreenAt(nowMs: number, tune: Tuning = TUG12): boolean {
  const cycle = tune.LIGHT_GREEN_MS + tune.LIGHT_RED_MS;
  const at = ((nowMs % cycle) + cycle) % cycle;
  return at < tune.LIGHT_GREEN_MS;
}
