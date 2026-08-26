/**
 * 红蓝点点 · 1.1 新机制的纯逻辑与无头对局模拟器。
 *
 * `index.ts` 的实机玩法和 `levels.test.ts` 的可通关校验共用这里的公式，
 * 测试算出来的胜负就是孩子实际会遇到的胜负。
 *
 * 四个新机制：
 *  · 连击加成：连抢若干个不失手就进连击，之后每个点算双倍分；
 *  · 道具点：❄️ 冻住对手一小会儿、🧲 自动吸走下一个点；
 *  · 序列谜阵：点点带号码，必须按 1→2→3 的顺序拍，拍错把分让给对手；
 *  · 读招电脑：你领先越多它出手越快，落后时会稍稍放慢。
 */
import { mulberry32 } from "../level99";
import type { TapLevel } from "./levels";

/** ❄️ 冻结期间小电脑的出手时间要乘上的倍数 */
export const FREEZE_FACTOR = 1.8;
/** 一次 ❄️ 能冻住对手几轮 */
export const FREEZE_ROUNDS = 2;
/** 读招电脑最快也只能压到基础出手时间的这个比例 */
export const AI_DELAY_FLOOR = 0.62;
/** 场上有陷阱点时，认一眼要多花的时间 */
export const TRAP_READ_MS = 120;
/** 小电脑出手时间的随机抖动上限（与 index.ts 里的 `+ Math.random() * 200` 一致） */
export const AI_JITTER_MS = 200;
/** 孩子反应时间的波动幅度（±18%），手再稳也不可能每次一模一样 */
export const REACTION_JITTER = 0.18;
/** 序列点每多一个号码，整条链就多亮这么久（不然按顺序拍根本来不及） */
export const SEQ_GRACE_MS = 320;

/** 序列链在场上多待多久：链越长给的宽限越多 */
export function sequenceGrace(chain: number): number {
  return Math.max(0, Math.floor(chain) - 1) * SEQ_GRACE_MS;
}

/** 连击是否已经点着了 */
export function inCombo(streak: number, cfg: TapLevel): boolean {
  const need = cfg.comboNeed ?? 0;
  return need > 0 && streak >= need;
}

/** 这一次抢到手值几分（连击状态下翻倍，序列链按链长整段计分） */
export function pointsFor(streak: number, stake: number, cfg: TapLevel): number {
  return inCombo(streak, cfg) ? stake * (cfg.comboScore ?? 2) : stake;
}

/**
 * 读招电脑的实时出手时间：你领先越多它越快（最多快到 AI_DELAY_FLOOR），
 * 你落后时它会稍稍放慢（最多慢两成），保证被追分的时候还能翻盘。
 */
export function adaptiveAiDelay(cfg: TapLevel, me: number, ai: number): number {
  const adapt = cfg.aiAdapt ?? 0;
  if (adapt <= 0) return cfg.aiDelayMs;
  const target = Math.max(1, cfg.targetPoints);
  const lead = Math.max(-1, Math.min(1, (me - ai) / target));
  const factor = lead >= 0 ? 1 - adapt * lead : 1 - adapt * 0.5 * lead;
  return cfg.aiDelayMs * Math.max(AI_DELAY_FLOOR, Math.min(1.2, factor));
}

/** 这一关启用了哪些新机制，给关卡提示语与测试用 */
export function mechanicsOf(cfg: TapLevel): string[] {
  const out: string[] = [];
  if (cfg.comboNeed) out.push("连击加成");
  if (cfg.powerChance) out.push("道具点");
  if (cfg.sequence) out.push("序列抢点");
  if (cfg.aiAdapt) out.push("读招电脑");
  return out;
}

/** 序列链上号码从 1 开始，返回这一轮该拍的号码顺序 */
export function sequenceLabels(chain: number): number[] {
  const n = Math.max(0, Math.floor(chain));
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** 序列链拍到第 index 个时，下一个该拍几号；拍错返回 null */
export function nextSequenceStep(current: number, tapped: number, chain: number): number | null {
  if (tapped !== current + 1) return null;
  return tapped >= chain ? chain : tapped;
}

// ---------------------------------------------------------------------------
// 无头对局模拟器
// ---------------------------------------------------------------------------

export interface TapSimOptions {
  /** 点亮起到手指按下去的反应时间（毫秒） */
  reactionMs: number;
  /** 抢完一个点挪到下一个点要的时间 */
  switchMs: number;
  /** 序列链上每多一个号码要多花的时间 */
  sequenceStepMs: number;
  /** 会不会用道具点（❄️🧲） */
  usePowers: boolean;
  /** 认不认得出陷阱点 */
  avoidTraps: boolean;
}

export interface TapSimResult {
  won: boolean;
  me: number;
  ai: number;
  rounds: number;
  /** 全场最长的连击 */
  bestStreak: number;
}

/** 约小学六年级、认真打的一局（看到点、认清是不是陷阱、把手指挪过去，合起来半秒上下） */
export const SKILLED_PLAY: TapSimOptions = {
  reactionMs: 520,
  switchMs: 240,
  sequenceStepMs: 300,
  usePowers: true,
  avoidTraps: true
};

/** 心不在焉的一局：反应慢、看不出陷阱、道具也不会用——用来证明新关不是白送 */
export const CASUAL_PLAY: TapSimOptions = {
  reactionMs: 950,
  switchMs: 450,
  sequenceStepMs: 700,
  usePowers: false,
  avoidTraps: false
};

const MAX_ROUNDS = 400;

/**
 * 按 `index.ts` 的同一套规则一轮一轮抢点，直到有人先到目标分。
 * 陷阱点与道具点的出现用固定种子的伪随机，同一关同一 seed 结果完全确定。
 */
export function simulateTapDuel(cfg: TapLevel, opt: TapSimOptions, seed = 1): TapSimResult {
  const rand = mulberry32(seed >>> 0);
  let me = 0;
  let ai = 0;
  let streak = 0;
  let bestStreak = 0;
  let frozen = 0;
  let magnetReady = false;
  let rounds = 0;

  while (me < cfg.targetPoints && ai < cfg.targetPoints && rounds < MAX_ROUNDS) {
    rounds++;
    let aiDelay = adaptiveAiDelay(cfg, me, ai) + rand() * AI_JITTER_MS;
    if (frozen > 0) {
      aiDelay *= FREEZE_FACTOR;
      frozen--;
    }

    // 道具点：这一轮场上多冒一个 ❄️ 或 🧲，认得出来的孩子会先去拿
    if ((cfg.powerChance ?? 0) > 0 && rand() < (cfg.powerChance ?? 0)) {
      if (opt.usePowers && opt.reactionMs < aiDelay) {
        if (rand() < 0.5) frozen = FREEZE_ROUNDS;
        else magnetReady = true;
        continue;
      }
    }

    // 磁铁：下一个能抢的点直接吸过来，不用比手速
    if (magnetReady) {
      magnetReady = false;
      const gained = pointsFor(streak, 1, cfg);
      me += gained;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      continue;
    }

    // 陷阱点：认得出来只是多看一眼，认不出来就白送对手一分
    let react = opt.reactionMs * (1 - REACTION_JITTER + rand() * REACTION_JITTER * 2);
    if (cfg.trapChance > 0 && rand() < cfg.trapChance) {
      if (!opt.avoidTraps) {
        ai += 1;
        streak = 0;
        continue;
      }
      react += TRAP_READ_MS;
    }

    const chain = cfg.sequence ?? 0;
    if (chain > 0) {
      // 序列链：整条链算一次胜负，赢了拿链长那么多分
      const need = react + (chain - 1) * opt.sequenceStepMs;
      if (need < aiDelay + sequenceGrace(chain)) {
        me += pointsFor(streak, chain, cfg);
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        ai += 1;
        streak = 0;
      }
      continue;
    }

    if (react < aiDelay) {
      me += pointsFor(streak, 1, cfg);
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      // 双子挑战：第二个点还来得及就一起收走，来不及就被对手拿走
      if (cfg.double) {
        if (react + opt.switchMs < aiDelay) {
          me += pointsFor(streak, 1, cfg);
          streak++;
          bestStreak = Math.max(bestStreak, streak);
        } else {
          ai += 1;
        }
      }
    } else {
      ai += cfg.double ? 2 : 1;
      streak = 0;
    }
  }

  return { won: me >= cfg.targetPoints && me > ai, me, ai, rounds, bestStreak };
}

// ---------------------------------------------------------------------------
// 无尽模式「霓虹抢点」：点点一轮比一轮快，丢三次爱心就结束
// ---------------------------------------------------------------------------

/** 无尽模式的爱心数 */
export const ENDLESS_LIVES = 3;

/** 无尽模式第 n 轮小电脑的出手时间：越来越快，但留着人类做得到的下限 */
export function endlessAiDelay(round: number): number {
  const r = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return Math.max(430, 1250 - r * 22);
}

/** 无尽模式第 n 轮的陷阱概率：越往后越花，封顶四成 */
export function endlessTrapChance(round: number): number {
  const r = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return Math.min(0.4, 0.08 + r * 0.012);
}

/** 无尽模式第 n 轮一次冒几个点：三轮一档，最多三个 */
export function endlessDotCount(round: number): number {
  const r = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  if (r >= 24) return 3;
  if (r >= 10) return 2;
  return 1;
}

/** 破纪录判定：0 分不算 */
export function isNewRecord(score: number, best: number): boolean {
  return Math.floor(score) > Math.max(0, Math.floor(best));
}
