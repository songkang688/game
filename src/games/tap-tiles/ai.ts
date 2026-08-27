/**
 * 音符下落 · 假人(对战用)与机器人回放(测试与关卡校验用)。
 *
 * 假人不会作弊:它走的是和玩家一模一样的 `tapLane` / `releaseLane`,
 * 唯一的区别是按下的时刻会带上一点时间噪声——档位越低手越抖。
 */
import { mulberry32 } from "../level99";
import type { Chart, Note } from "./chart";
import { CAMPAIGN_MAX_MISS, PERFECT_MS } from "./judge";
import { createRun, finishRun, releaseLane, tapLane, type RunRules, type RunState } from "./run";

export type AiTier = "rookie" | "normal" | "expert" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "expert", "hell"];

export const TIER_NAMES: Record<AiTier, string> = {
  rookie: "新手",
  normal: "普通",
  expert: "高手",
  hell: "大师",
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
 * 光靠时间噪声不够分档:普通档的 ±40ms 全都落在完美窗口里,和大师档一样满分,
 * 对战时四个档位就没差别了。所以低档位还会偶尔整个漏掉一个音符——连击一断,分差就出来了。
 */
export const TIER_SLIP_RATE: Record<AiTier, number> = {
  rookie: 0.09,
  normal: 0.035,
  expert: 0.012,
  hell: 0,
};

/**
 * 各档位「每这么多个音符故意打偏一个到良好窗口」,0 表示一下不差。
 *
 * 时间噪声与手滑只在长谱上分得开档:普通档 ±40ms 整个落在 ±45ms 的完美窗口里,
 * 而对战头几局的谱只有十几个音符,3.5% 的手滑多半一次都抽不到 ——
 * 于是普通 / 高手 / 大师三档同为满分,满分玩家最好也只能打平。
 * 这一层是**确定性**的:同一张谱同一档,偏的永远是同样那几个音符,
 * 四档从第 1 局起就分得开,最高档仍旧一下不差。
 */
export const TIER_LOOSE_EVERY: Record<AiTier, number> = {
  rookie: 3,
  normal: 5,
  expert: 9,
  hell: 0,
};

/** 故意打偏的偏移(毫秒):落在完美窗口外、良好窗口内,所以只掉分不断连击 */
export const LOOSE_OFFSET_MS = 70;

/**
 * 这一下往后偏多少,既算「良好」又不至于偏进同轨下一个块的判定窗口。
 * 挤不出这么大的余量就不偏(返回 0),宁可这一下打准也不要判到隔壁块上去。
 */
export function looseOffsetFor(notes: readonly Note[], i: number): number {
  const note = notes[i];
  if (!note) return 0;
  let gap = Number.POSITIVE_INFINITY;
  for (const other of notes) {
    if (other.lane !== note.lane || other.time <= note.time) continue;
    gap = Math.min(gap, other.time - note.time);
  }
  const off = Math.min(LOOSE_OFFSET_MS, Math.floor(gap / 2));
  return off > PERFECT_MS ? off : 0;
}

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
 * 让机器人把整张谱打一遍。noiseMs = 0、slipRate = 0、looseEvery = 0 就是完美机器人
 * (每一下都踩在判定线上)。长按条按到尾端之后再松手,所以只要头接住了就一定完成。
 */
export function runBot(
  chart: Chart,
  rules: RunRules,
  noiseMs: number,
  seed = 1,
  slipRate = 0,
  looseEvery = 0
): RunState {
  const rand = mulberry32(seed >>> 0);
  const state = createRun(chart, rules);
  const events: BotEvent[] = [];
  for (let i = 0; i < chart.notes.length; i++) {
    const note = chart.notes[i];
    const off = noiseMs > 0 ? (rand() * 2 - 1) * noiseMs : 0;
    const slipped = slipRate > 0 && rand() < slipRate;
    if (slipped) continue;
    const loose = looseEvery > 0 && (i + 1) % looseEvery === 0 ? looseOffsetFor(chart.notes, i) : 0;
    events.push({ t: note.time + (loose > 0 ? loose : off), kind: "tap", lane: note.lane });
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
  return runBot(chart, BOT_RULES, TIER_NOISE_MS[tier], seed, TIER_SLIP_RATE[tier], TIER_LOOSE_EVERY[tier]);
}

/** 某个档位的假人在这张谱上拿多少分 */
export function aiScore(chart: Chart, tier: AiTier, seed = 7): number {
  return aiRun(chart, tier, seed).score;
}

/** 对战里假人的开场话,只夸不损 */
export function tierLine(tier: AiTier): string {
  switch (tier) {
    case "rookie":
      return "新手档手还有点抖,慢慢跟着节奏来。";
    case "normal":
      return "普通档节奏挺稳,别被它带着跑。";
    case "expert":
      return "高手档几乎都踩在线上,连击别断。";
    default:
      return "大师档一下都不差,能追上就非常厉害了。";
  }
}
