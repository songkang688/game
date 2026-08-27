/**
 * 红蓝拔河 · 1.2 的「谁在按按钮」。
 *
 * 一侧选手的大脑就是一个纯函数 `Controller`:看一眼当前状态,回答这一帧按不按。
 * 实机里玩家那一侧由手指 / 键盘驱动,小电脑那一侧和无头模拟器都跑这里的大脑。
 *
 * 四档小电脑的差别只有三样,全部可量化:
 *  · **体力管理**:按多久松一次(`pullMs` / `restMs`)—— 按太久会脱力,一抽一放又抓不稳绳子;
 *  · **节奏点命中率**:`beatRate` 决定它有多大概率去踩绳子上的加油点。
 *
 * 四档的**基础力气完全一样**,差的全是这两件事,所以「档位差」量的就是打法水平。
 *
 * 所有随机都走 `mulberry32(seed)`,同一个 seed 跑出来的对局逐帧一致。
 */
import { mulberry32 } from "../level99";
import { TUG12, type Tuning } from "./tuning";
import type { SideConfig, SideState } from "./force";

export interface ControlCtx {
  /** 开局到现在多少毫秒 */
  nowMs: number;
  side: SideState;
  cfg: SideConfig;
  /** 从本方视角看的绳子位置:正数表示自己占上风 */
  rope: number;
  /** 红绿灯:false 的时候拉绳会打滑 */
  green: boolean;
  /** 本场的加油点时刻表(红蓝共用,完全对称) */
  beats: readonly number[];
  /** 下一颗还没过中线的加油点下标,-1 表示没有了 */
  nextBeat: number;
}

export type Controller = (ctx: ControlCtx) => boolean;

// ---------------------------------------------------------------------------
// 三种可对比的操作策略(用例靠它们证明「狂按不是最优」)
// ---------------------------------------------------------------------------

/** 一直按住不放:体力见底之后力量骤降,是最差的打法 */
export function holdController(): Controller {
  return () => true;
}

/** 高频狂按:按住松开各半,体力不掉,但蓄不上力、也蹭不到加油点 */
export function mashController(hz = 8): Controller {
  const period = 1000 / (Number.isFinite(hz) && hz > 0 ? hz : 8);
  return (ctx) => ((ctx.nowMs % period) / period) < 0.5;
}

export interface RhythmOptions {
  /** 一次发力按多久 */
  pullMs?: number;
  /** 一次换气松多久 */
  restMs?: number;
  /** 会不会去踩加油点 */
  beats?: boolean;
  /** 会不会看红绿灯 */
  watchLight?: boolean;
}

/**
 * 有节奏地发力:歇够蓄力时间再按下,按到该松手就松手,顺带把加油点踩上。
 * 这是这一版想教给孩子的打法,也是模拟器里的「认真打」。
 */
export function rhythmController(opt: RhythmOptions = {}, tune: Tuning = TUG12): Controller {
  const pullMs = opt.pullMs ?? 700;
  const restMs = opt.restMs ?? tune.CHARGE_MS + 60;
  const useBeats = opt.beats !== false;
  const watchLight = opt.watchLight !== false;

  return (ctx) => {
    if (watchLight && !ctx.green) return false;
    // 脱力了先把气缓回来,硬拉只有三成力
    if (ctx.side.winded) return false;

    if (useBeats && ctx.nextBeat >= 0) {
      const at = ctx.beats[ctx.nextBeat];
      const lead = at - ctx.nowMs;
      if (lead > 0 && lead <= tune.BEAT_MIN_REST_MS + 80) return false;
      if (lead <= 0 && lead > -260) return true;
    }

    return ctx.side.pressed ? ctx.side.holdMs < pullMs : ctx.side.restMs >= restMs;
  };
}

// ---------------------------------------------------------------------------
// AI 四档
// ---------------------------------------------------------------------------

export type AiTierKey = "easy" | "steady" | "sharp" | "king";

export interface AiTier {
  key: AiTierKey;
  name: string;
  emoji: string;
  /** 一句话说清这一档强在哪 */
  blurb: string;
  /** 一次发力按多久(体力管理水平) */
  pullMs: number;
  /** 一次换气松多久(体力管理水平) */
  restMs: number;
  /** 加油点命中率 0..1 */
  beatRate: number;
  /** 踩点的手抖(毫秒),越小越准 */
  jitterMs: number;
}

/** 四档小电脑,从「刚学会」到「绳王」;顺序就是强度顺序 */
export const AI_TIERS: readonly AiTier[] = Object.freeze([
  {
    key: "easy",
    name: "小苗队",
    emoji: "🌱",
    blurb: "一按就不松手,拉一会儿就累到没力气。",
    pullMs: 2600,
    restMs: 240,
    beatRate: 0.06,
    jitterMs: 90,
  },
  {
    key: "steady",
    name: "稳稳队",
    emoji: "🌿",
    blurb: "学会松手了,可惜一抽一放的,手还没抓稳就撒开。",
    pullMs: 320,
    restMs: 320,
    beatRate: 0.28,
    jitterMs: 70,
  },
  {
    key: "sharp",
    name: "快手队",
    emoji: "⚡",
    blurb: "体力管得住,一多半的加油点都能踩上,就是换气还稍微久了点。",
    pullMs: 700,
    restMs: 900,
    beatRate: 0.6,
    jitterMs: 50,
  },
  {
    key: "king",
    name: "绳王队",
    emoji: "👑",
    blurb: "蓄力、发力、踩点样样不落,几乎不浪费一分力气。",
    pullMs: 700,
    restMs: 560,
    beatRate: 0.92,
    jitterMs: 30,
  },
] as const);

export function tierOf(key: AiTierKey): AiTier {
  return AI_TIERS.find((t) => t.key === key) ?? AI_TIERS[0];
}

/** 档位下标(0..3);给用例与画面上的「第几档」用 */
export function tierIndex(key: AiTierKey): number {
  const i = AI_TIERS.findIndex((t) => t.key === key);
  return i < 0 ? 0 : i;
}

/**
 * 188 关每一关对上第几档:前三章小苗、四到六章稳稳、七到九章快手、末章绳王。
 * 关卡数据一个字没改,只是给老的 `aiRate` 配上一个会管体力的大脑。
 */
export function aiTierForLevel(level: number): AiTier {
  const i = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  if (i < 51) return AI_TIERS[0];
  if (i < 99) return AI_TIERS[1];
  if (i < 166) return AI_TIERS[2];
  return AI_TIERS[3];
}

/** 无尽「拉不完的绳」:连胜越多档位越高,第 7 局起就是绳王 */
export function endlessTier(streak: number): AiTier {
  const s = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  if (s < 2) return AI_TIERS[0];
  if (s < 4) return AI_TIERS[1];
  if (s < 6) return AI_TIERS[2];
  return AI_TIERS[3];
}

/**
 * 一档小电脑的大脑。除了按体力节奏发力,它还会盯着加油点:
 * 掷一次骰子决定这一颗踩不踩,决定踩就提前松手蓄力,在窗口里按下去。
 */
export function aiController(tier: AiTier, seed: number, tune: Tuning = TUG12): Controller {
  const rand = mulberry32(Math.floor(Number.isFinite(seed) ? seed : 7) >>> 0);
  let decidedFor = -1;
  let takeIt = false;
  let jitter = 0;

  return (ctx) => {
    if (!ctx.green) return false;

    if (ctx.nextBeat >= 0) {
      if (decidedFor !== ctx.nextBeat) {
        decidedFor = ctx.nextBeat;
        takeIt = rand() < tier.beatRate;
        jitter = (rand() * 2 - 1) * tier.jitterMs;
      }
      if (takeIt) {
        const at = ctx.beats[ctx.nextBeat] + jitter;
        const lead = at - ctx.nowMs;
        if (lead > 0 && lead <= tune.BEAT_MIN_REST_MS + 80) return false;
        if (lead <= 0 && lead > -260) return true;
      }
    }

    return ctx.side.pressed ? ctx.side.holdMs < tier.pullMs : ctx.side.restMs >= tier.restMs;
  };
}
