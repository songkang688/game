/**
 * 红蓝拔河 · 1.1 新机制的纯逻辑与无头对局模拟器。
 *
 * `index.ts` 的实机玩法和 `levels.test.ts` 的可通关校验共用这里的公式。
 *
 * 四个新机制：
 *  · 体力条：每拉一下耗 1 点体力，见底后力气减半，松手才回气；
 *  · 补给争夺：🧤 防滑粉自己变强、💧 水袋被对手拿到就打滑，谁先抢到谁占便宜；
 *  · 号子连击：踩着「嘿—哟」的节拍拉才使得上劲，齐心值攒满猛拉一大把；
 *  · 读招电脑：眼看你要赢，它就发力反扑。
 */
import type { TugLevel } from "./levels";

/** 胜负线：+100 你赢，-100 小电脑赢 */
export const WIN_AT = 100;

/** 加油星拉回来的距离 */
export const STAR_PULL = 12;
/** 加油星每隔多久冒一个（毫秒） */
export const STAR_EVERY_MS = 2600;

/** 补给每隔多久掉一次（毫秒） */
export const SUPPLY_EVERY_MS = 5000;
/** 抢到 🧤 防滑粉，接下来这段时间力气变大 */
export const SUPPLY_BUFF = 1.32;
/** 补给被对手拿走，接下来这段时间它拉得更凶 */
export const SUPPLY_DEBUFF = 1.26;
/** 补给的效果持续时间（毫秒） */
export const SUPPLY_MS = 4000;

/** 体力见底时力气打几折 */
export const TIRED_PULL_FACTOR = 0.5;
/** 松手换气到体力回到几成才缓得过来 */
export const STAMINA_RESUME_RATIO = 0.4;

/** 号子的容差（毫秒） */
export const CHANT_WINDOW_MS = 150;
/** 没踩上号子的那一下只使得出几成劲 */
export const CHANT_OFFBEAT_FACTOR = 0.5;
/** 齐心值攒满后猛拉多少 */
export const CHANT_BURST = 18;

/** 红灯绿灯的节奏（毫秒），取实机随机区间的中位数，模拟器用它算平均可拉时间 */
export const LIGHT_GREEN_MS = 2500;
export const LIGHT_RED_MS = 1250;
/** 红灯硬拉一下要倒退多少 */
export const REDLIGHT_SLIP = 6;

/** 这一下算不算踩上号子 */
export function onChant(gapMs: number, chantMs: number): boolean {
  if (!chantMs || chantMs <= 0) return false;
  return Math.abs(gapMs - chantMs) <= CHANT_WINDOW_MS;
}

/** 踩上号子齐心值 +1（攒满会在外面清零），没踩上就清零 */
export function nextChant(chant: number, gapMs: number, cfg: TugLevel): number {
  if (!cfg.chantMs) return 0;
  return onChant(gapMs, cfg.chantMs) ? chant + 1 : 0;
}

/** 齐心值攒满了没有 */
export function chantReady(chant: number, cfg: TugLevel): boolean {
  return !!cfg.chantMs && chant >= (cfg.chantMax ?? 8);
}

/** 体力见底就把力气打折（没启用体力条的关永远满力） */
export function staminaPullFactor(stamina: number, cfg: TugLevel): number {
  if (!cfg.stamina) return 1;
  return stamina >= 1 ? 1 : TIRED_PULL_FACTOR;
}

/** 松手换气后，体力回到几点才算缓过来 */
export function staminaResumeAt(cfg: TugLevel): number {
  return (cfg.stamina ?? 0) * STAMINA_RESUME_RATIO;
}

/**
 * 读招电脑的实时拉力：绳子越靠你这边它拉得越凶，
 * 被它拉过中线时反而会收一点力，给孩子留翻盘的余地。
 */
export function adaptiveAiRate(cfg: TugLevel, pos: number): number {
  const adapt = cfg.aiAdapt ?? 0;
  if (adapt <= 0) return cfg.aiRate;
  const lead = Math.max(-1, Math.min(1, pos / WIN_AT));
  const factor = lead >= 0 ? 1 + adapt * lead : 1 + adapt * 0.4 * lead;
  return cfg.aiRate * Math.max(0.5, factor);
}

/** 这一关启用了哪些新机制，给关卡提示语与测试用 */
export function mechanicsOf(cfg: TugLevel): string[] {
  const out: string[] = [];
  if (cfg.stamina) out.push("体力条");
  if (cfg.supply) out.push("补给争夺");
  if (cfg.chantMs) out.push("号子连击");
  if (cfg.aiAdapt) out.push("读招电脑");
  return out;
}

// ---------------------------------------------------------------------------
// 无头对局模拟器
// ---------------------------------------------------------------------------

export interface TugSimOptions {
  /** 每秒点几下 */
  tapsPerSec: number;
  /** 会不会看红绿灯（不看就在红灯硬拉，一拉就打滑） */
  watchLight: boolean;
  /** 节奏关会不会左右手交替（不交替就有一半的点白点） */
  alternate: boolean;
  /** 会不会抢加油星与补给 */
  grab: boolean;
  /** 体力见底会不会松手换气 */
  pace: boolean;
  /** 会不会踩号子的拍子 */
  keepChant: boolean;
}

export interface TugSimResult {
  won: boolean;
  /** 分出胜负用了多少秒，没分出来是 Infinity */
  seconds: number;
  pos: number;
  /** 触发了几次齐心猛拉 */
  bursts: number;
  /** 抢到几次补给 */
  supplies: number;
}

/** 约小学六年级、认真打的一局 */
export const SKILLED_PLAY: TugSimOptions = {
  tapsPerSec: 6,
  watchLight: true,
  alternate: true,
  grab: true,
  pace: true,
  keepChant: true
};

/** 只会闷头狂点的一局：不看灯、不换手、不抢补给、不换气、不踩号子 */
export const CASUAL_PLAY: TugSimOptions = {
  tapsPerSec: 3.2,
  watchLight: false,
  alternate: false,
  grab: false,
  pace: false,
  keepChant: false
};

const DT = 1 / 60;
const MAX_SECONDS = 120;

/**
 * 按 `index.ts` 的同一套规则拔完一整局，返回谁把小旗拉过了线。
 * 帧步长固定 1/60 秒，红绿灯与补给按固定周期出现，结果完全确定。
 */
export function simulateTug(cfg: TugLevel, opt: TugSimOptions): TugSimResult {
  let pos = 0;
  let t = 0;
  let bursts = 0;
  let supplies = 0;

  const staminaMax = cfg.stamina ?? 0;
  let stamina = staminaMax;
  let resting = false;
  let chant = 0;

  let buffUntil = -1;
  let debuffUntil = -1;
  let nextStarAt = STAR_EVERY_MS / 1000;
  let nextSupplyAt = SUPPLY_EVERY_MS / 1000;

  // 号子关按号子的拍子拉，其余情况按自己的手速拉
  const chantGap = cfg.chantMs && opt.keepChant ? cfg.chantMs / 1000 : 1 / opt.tapsPerSec;
  // 节奏关不换手，等于一半的点白点了
  const rhythmFactor = cfg.rhythm && !opt.alternate ? 0.5 : 1;
  let tapTimer = 0;

  let done = false;
  while (t < MAX_SECONDS && !done) {
    t += DT;

    // 红灯绿灯：按固定周期切换，看灯的孩子红灯时不拉
    const cyclePos = (t * 1000) % (LIGHT_GREEN_MS + LIGHT_RED_MS);
    const green = !cfg.redlight || cyclePos < LIGHT_GREEN_MS;

    if (staminaMax > 0) {
      stamina = Math.min(staminaMax, stamina + (cfg.staminaRegen ?? 0) * DT);
      if (opt.pace) {
        if (resting && stamina >= staminaResumeAt(cfg)) resting = false;
        else if (!resting && stamina < 1) resting = true;
      }
    }

    tapTimer += DT;
    if (tapTimer >= chantGap && !resting) {
      const gapMs = tapTimer * 1000;
      tapTimer = 0;
      if (!green && opt.watchLight) {
        // 看着灯呢，红灯就先不拉——什么都不做
      } else if (!green) {
        pos = Math.max(-WIN_AT, pos - REDLIGHT_SLIP);
        chant = 0;
      } else {
        let power = cfg.pullPower * rhythmFactor * staminaPullFactor(stamina, cfg);
        if (cfg.chantMs) {
          // 不跟号子的孩子只是闷头狂点，齐心值一直攒不起来
          chant = opt.keepChant ? nextChant(chant, gapMs, cfg) : 0;
          if (chant === 0) power *= CHANT_OFFBEAT_FACTOR;
        }
        if (t < buffUntil) power *= SUPPLY_BUFF;
        if (staminaMax > 0) stamina = Math.max(0, stamina - 1);
        pos = Math.min(WIN_AT, pos + power);
        if (chantReady(chant, cfg)) {
          chant = 0;
          bursts++;
          pos = Math.min(WIN_AT, pos + CHANT_BURST);
        }
      }
      if (pos >= WIN_AT) break;
    }

    // 加油星：会抢的孩子一冒出来就点掉
    if (cfg.star && t >= nextStarAt) {
      nextStarAt += STAR_EVERY_MS / 1000;
      if (opt.grab) {
        pos = Math.min(WIN_AT, pos + STAR_PULL);
        if (pos >= WIN_AT) break;
      }
    }

    // 补给：抢到手自己变强，抢不到就轮到对手变强
    if (cfg.supply && t >= nextSupplyAt) {
      nextSupplyAt += SUPPLY_EVERY_MS / 1000;
      if (opt.grab) {
        supplies++;
        buffUntil = t + SUPPLY_MS / 1000;
      } else {
        debuffUntil = t + SUPPLY_MS / 1000;
      }
    }

    let rate = adaptiveAiRate(cfg, pos);
    if (t < debuffUntil) rate *= SUPPLY_DEBUFF;
    pos = Math.max(-WIN_AT, pos - rate * DT);
    if (pos <= -WIN_AT) done = true;
  }

  const settled = pos >= WIN_AT || pos <= -WIN_AT;
  return { won: pos >= WIN_AT, seconds: settled ? t : Infinity, pos, bursts, supplies };
}

// ---------------------------------------------------------------------------
// 无尽模式「绳王连胜」：赢一局小电脑就换一个更大力气的，输一局就结束
// ---------------------------------------------------------------------------

/** 无尽模式第 n 局小电脑的拉力：越往后越大，有封顶 */
export function endlessAiRate(round: number): number {
  const r = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return Math.min(19, 6.5 + r * 0.85);
}

/** 无尽模式第 n 局给你的力气：小幅补偿，但补不满对手的涨幅 */
export function endlessPullPower(round: number): number {
  const r = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return Math.min(3.6, 2.8 + r * 0.05);
}

/** 无尽模式第 n 局会不会开红绿灯（第 4 局起隔局来一次） */
export function endlessHasLight(round: number): boolean {
  const r = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return r >= 3 && r % 2 === 1;
}

/** 破纪录判定：0 局不算 */
export function isNewRecord(rounds: number, best: number): boolean {
  return Math.floor(rounds) > Math.max(0, Math.floor(best));
}
