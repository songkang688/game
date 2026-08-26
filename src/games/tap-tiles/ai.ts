/**
 * 音符下落 · 假人(对战用)与机器人回放(测试与关卡校验用)。
 *
 * 假人不会作弊:它走的是和玩家一模一样的 `tapLane` / `releaseLane`,
 * 唯一的区别是按下的时刻会带上一点时间噪声——档位越低手越抖。
 */
import { mulberry32 } from "../level99";
import type { Chart } from "./chart";
import { CAMPAIGN_MAX_MISS } from "./judge";
import { createRun, finishRun, releaseLane, tapLane, type RunRules, type RunState } from "./run";

export type AiTier = "rookie" | "normal" | "expert" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "expert", "hell"];

export const TIER_NAMES: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  expert: "高手",
  hell: "地狱",
};

/** 各档位按下时刻的时间噪声(毫秒,正负都可能) */
export const TIER_NOISE_MS: Record<AiTier, number> = {
  rookie: 80,
  normal: 40,
  expert: 15,
  hell: 5,
};

/**
 * 各档位「手滑整个漏掉一个音符」的概率。
 * 光靠时间噪声不够分档:普通档的 ±40ms 全都落在完美窗口里,和地狱档一样满分,
 * 对战时四个档位就没差别了。所以低档位还会偶尔整个漏掉一个音符——连击一断,分差就出来了。
 */
export const TIER_SLIP_RATE: Record<AiTier, number> = {
  rookie: 0.09,
  normal: 0.035,
  expert: 0.012,
  hell: 0,
};

/** 假人不会因为几次 miss 就退场,给它一个宽松的容错 */
export const BOT_RULES: RunRules = { emptyRule: "combo", maxMiss: Number.POSITIVE_INFINITY };
/** 闯关里给「参考机器人」用的规则,和玩家闯关一样宽 */
export const REF_RULES: RunRules = { emptyRule: "combo", maxMiss: CAMPAIGN_MAX_MISS };

interface BotEvent {
  t: number;
  kind: "tap" | "release";
  lane: number;
}

/**
 * 让机器人把整张谱打一遍。noiseMs = 0、slipRate = 0 就是完美机器人(每一下都踩在判定线上)。
 * 长按条按到尾端之后再松手,所以只要头接住了就一定完成。
 */
export function runBot(chart: Chart, rules: RunRules, noiseMs: number, seed = 1, slipRate = 0): RunState {
  const rand = mulberry32(seed >>> 0);
  const state = createRun(chart, rules);
  const events: BotEvent[] = [];
  for (const note of chart.notes) {
    const off = noiseMs > 0 ? (rand() * 2 - 1) * noiseMs : 0;
    const slipped = slipRate > 0 && rand() < slipRate;
    if (slipped) continue;
    events.push({ t: note.time + off, kind: "tap", lane: note.lane });
    if (note.hold > 0) events.push({ t: note.time + note.hold + 10, kind: "release", lane: note.lane });
  }
  events.sort((a, b) => a.t - b.t);
  for (const ev of events) {
    if (state.over) break;
    if (ev.kind === "tap") tapLane(state, ev.lane, ev.t);
    else releaseLane(state, ev.lane, ev.t);
  }
  finishRun(state);
  return state;
}

/** 完美机器人:一下不差地打完整张谱,用来验关卡「打得完」 */
export function perfectRun(chart: Chart, rules: RunRules = REF_RULES): RunState {
  return runBot(chart, rules, 0, 1);
}

/** 某个档位的假人打这张谱 */
export function aiRun(chart: Chart, tier: AiTier, seed = 7): RunState {
  return runBot(chart, BOT_RULES, TIER_NOISE_MS[tier], seed, TIER_SLIP_RATE[tier]);
}

/** 某个档位的假人在这张谱上拿多少分 */
export function aiScore(chart: Chart, tier: AiTier, seed = 7): number {
  return aiRun(chart, tier, seed).score;
}

/** 对战里假人的开场话,只夸不损 */
export function tierLine(tier: AiTier): string {
  switch (tier) {
    case "rookie":
      return "菜鸟档手还有点抖,慢慢跟着节奏来。";
    case "normal":
      return "普通档节奏挺稳,别被它带着跑。";
    case "expert":
      return "高手档几乎都踩在线上,连击别断。";
    default:
      return "地狱档一下都不差,能追上就非常厉害了。";
  }
}
