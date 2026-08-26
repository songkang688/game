/**
 * 红蓝赛跑 · 1.1 新机制的纯逻辑与无头对局模拟器。
 *
 * 这里只放不碰 DOM 的算法，`index.ts` 的实机玩法和 `levels.test.ts` 的可通关校验
 * 共用同一套公式，测试跑出来的胜负就是孩子实际会遇到的胜负。
 *
 * 四个新机制：
 *  · 体力条：每点一下耗 1 点体力，见底后步子减半，松手才回气；
 *  · 道具抢夺：礼物箱谁先冲到谁拿，自己前冲一段、对手打滑一小会儿；
 *  · 节拍连击：点击间隔踩中鼓点才累连击，连击层数换步长加成，抢拍会清零；
 *  · 读招电脑：你领先越多它跑得越猛，你落后时它会稍稍收力。
 */
import { TRACK_LEN, type Obstacle, type RaceLevel } from "./levels";

/** 抢到礼物箱立刻前冲的格数 */
export const ITEM_BOOST = 7;
/** 礼物箱被对手抢走后，自己这一段时间的速度倍率 */
export const ITEM_SLOW_FACTOR = 0.62;
/** 礼物箱造成的打滑时长（毫秒） */
export const ITEM_SLOW_MS = 1500;

/** 体力见底时步子打几折 */
export const TIRED_STEP_FACTOR = 0.5;
/** 松手换气到体力回到几成才缓得过来 */
export const STAMINA_RESUME_RATIO = 0.4;

/** 踩鼓点的容差（毫秒），前后各留这么多 */
export const BEAT_WINDOW_MS = 150;
/** 每层连击给的步长加成 */
export const COMBO_STEP_BONUS = 0.06;

/** 连击层数换算成步长倍率 */
export function comboMultiplier(combo: number, comboMax: number): number {
  const capped = Math.max(0, Math.min(Math.max(0, comboMax), Math.floor(combo)));
  return 1 + capped * COMBO_STEP_BONUS;
}

/** 这一次点击的间隔算不算踩中鼓点 */
export function onBeat(gapMs: number, beatMs: number): boolean {
  if (!beatMs || beatMs <= 0) return false;
  return Math.abs(gapMs - beatMs) <= BEAT_WINDOW_MS;
}

/** 踩中鼓点连击 +1（封顶），抢拍 / 拖拍直接清零 */
export function nextCombo(combo: number, gapMs: number, cfg: RaceLevel): number {
  if (!cfg.beatMs) return 0;
  const cap = cfg.comboMax ?? 10;
  return onBeat(gapMs, cfg.beatMs) ? Math.min(cap, combo + 1) : 0;
}

/** 体力见底就把步子打折（没启用体力条的关永远是满步） */
export function staminaStepFactor(stamina: number, cfg: RaceLevel): number {
  if (!cfg.stamina) return 1;
  return stamina >= 1 ? 1 : TIRED_STEP_FACTOR;
}

/** 松手换气后，体力回到几点才算缓过来 */
export function staminaResumeAt(cfg: RaceLevel): number {
  return (cfg.stamina ?? 0) * STAMINA_RESUME_RATIO;
}

/**
 * 读招电脑的实时速度：领先它就提速追（最多 +aiAdapt），
 * 你落后时它稍稍收力（最多 -aiAdapt 的四成），永远不会停下不跑。
 */
export function adaptiveAiSpeed(cfg: RaceLevel, mePos: number, aiPos: number): number {
  const adapt = cfg.aiAdapt ?? 0;
  if (adapt <= 0) return cfg.aiSpeed;
  const lead = Math.max(-1, Math.min(1, (mePos - aiPos) / TRACK_LEN));
  const factor = lead >= 0 ? 1 + adapt * lead : 1 + adapt * 0.4 * lead;
  return cfg.aiSpeed * Math.max(0.5, factor);
}

/** 位置落在机关区间里（上坡段判定用） */
export function inZone(pos: number, ob: Obstacle): boolean {
  return pos >= ob.pos && pos <= ob.pos + ob.len;
}

/** 这一关启用了哪些新机制，给关卡头部的提示语与测试用 */
export function mechanicsOf(cfg: RaceLevel): string[] {
  const out: string[] = [];
  if (cfg.stamina) out.push("体力条");
  if (cfg.obstacles.some((o) => o.type === "item")) out.push("道具抢夺");
  if (cfg.beatMs) out.push("节拍连击");
  if (cfg.aiAdapt) out.push("读招电脑");
  return out;
}

// ---------------------------------------------------------------------------
// 无头对局模拟器：给「第 100–188 关能不能打得过」这件事一个可测量的答案
// ---------------------------------------------------------------------------

export interface RaceSimOptions {
  /** 每秒点几下（约小学六年级的稳定手速在 5.5~6.5 之间） */
  tapsPerSec: number;
  /** 会不会提前起跳躲开水坑与栏架 */
  jumps: boolean;
  /** 会不会踩着鼓点点（拿连击加成） */
  keepBeat: boolean;
  /** 体力见底会不会松手换气 */
  pace: boolean;
}

export interface RaceSimResult {
  won: boolean;
  /** 玩家冲线用时（秒），没跑完就是 Infinity */
  meTime: number;
  aiTime: number;
  mePos: number;
  aiPos: number;
  /** 抢到手的礼物箱数量 */
  itemsTaken: number;
}

/** 约小学六年级、认真打的一局：手速稳、会跳、会踩点、会换气 */
export const SKILLED_PLAY: RaceSimOptions = { tapsPerSec: 6, jumps: true, keepBeat: true, pace: true };
/** 随便乱点的一局：手慢、不跳、不看节拍、不换气——用来证明新关不是白送 */
export const CASUAL_PLAY: RaceSimOptions = { tapsPerSec: 3, jumps: false, keepBeat: false, pace: false };

const DT = 1 / 60;
const MAX_SECONDS = 90;

/**
 * 按 `index.ts` 的同一套规则跑完一整局，返回谁先冲线。
 * 帧步长固定 1/60 秒，结果完全确定，不依赖随机数。
 */
export function simulateRace(cfg: RaceLevel, opt: RaceSimOptions): RaceSimResult {
  let me = 0;
  let ai = 0;
  let t = 0;
  let meTime = Infinity;
  let aiTime = Infinity;
  let itemsTaken = 0;

  const taken = new Set<Obstacle>();
  const aiPaused = new Set<Obstacle>();
  let aiPauseUntil = -1;
  let aiSlowUntil = -1;
  let meSlowUntil = -1;
  let meStunUntil = -1;

  const staminaMax = cfg.stamina ?? 0;
  let stamina = staminaMax;
  let resting = false;
  let combo = 0;

  const beatGap = cfg.beatMs && opt.keepBeat ? cfg.beatMs / 1000 : 1 / opt.tapsPerSec;
  let tapTimer = 0;

  while (t < MAX_SECONDS && (meTime === Infinity || aiTime === Infinity)) {
    t += DT;

    // ---- 玩家 ----
    if (meTime === Infinity) {
      if (staminaMax > 0) {
        stamina = Math.min(staminaMax, stamina + (cfg.staminaRegen ?? 0) * DT);
        if (opt.pace) {
          if (resting && stamina >= staminaResumeAt(cfg)) resting = false;
          else if (!resting && stamina < 1) resting = true;
        }
      }
      tapTimer += DT;
      const canTap = t >= meStunUntil && !resting && tapTimer >= beatGap;
      if (canTap) {
        const gapMs = tapTimer * 1000;
        tapTimer = 0;
        combo = cfg.beatMs && opt.keepBeat ? nextCombo(combo, gapMs, cfg) : 0;

        let step = cfg.tapStep * comboMultiplier(combo, cfg.comboMax ?? 0) * staminaStepFactor(stamina, cfg);
        if (t < meSlowUntil) step *= ITEM_SLOW_FACTOR;
        for (const ob of cfg.obstacles) {
          if (ob.type === "hill" && inZone(me, ob)) step *= 0.5;
        }
        if (staminaMax > 0) stamina = Math.max(0, stamina - 1);

        const before = me;
        me = Math.min(TRACK_LEN, me + step);
        for (const ob of cfg.obstacles) {
          if (taken.has(ob) || !(before < ob.pos && me >= ob.pos)) continue;
          if (ob.type === "star") {
            taken.add(ob);
            me = Math.min(TRACK_LEN, me + 8);
          } else if (ob.type === "item") {
            taken.add(ob);
            itemsTaken++;
            me = Math.min(TRACK_LEN, me + ITEM_BOOST);
            aiSlowUntil = t + ITEM_SLOW_MS / 1000;
          } else if (ob.type === "puddle" || ob.type === "hurdle") {
            taken.add(ob);
            if (opt.jumps) {
              // 熟练玩家提前一下起跳越过去，落点就在机关后面
              me = Math.min(TRACK_LEN, ob.pos + ob.len + 1);
            } else if (ob.type === "puddle") {
              me = Math.max(0, ob.pos - 2);
              meStunUntil = t + 0.8;
            } else {
              me = Math.max(0, ob.pos - 4);
              meStunUntil = t + 0.6;
            }
          }
        }
        if (me >= TRACK_LEN) meTime = t;
      }
    }

    // ---- 小电脑 ----
    if (aiTime === Infinity && t >= aiPauseUntil) {
      let speed = adaptiveAiSpeed(cfg, me, ai);
      if (t < aiSlowUntil) speed *= ITEM_SLOW_FACTOR;
      for (const ob of cfg.obstacles) {
        if (ob.type === "hill" && inZone(ai, ob)) speed *= 0.7;
      }
      const before = ai;
      ai = Math.min(TRACK_LEN, ai + speed * DT);
      for (const ob of cfg.obstacles) {
        if (!(before < ob.pos && ai >= ob.pos)) continue;
        if (ob.type === "item" && !taken.has(ob)) {
          taken.add(ob);
          ai = Math.min(TRACK_LEN, ai + ITEM_BOOST);
          meSlowUntil = t + ITEM_SLOW_MS / 1000;
        } else if ((ob.type === "puddle" || ob.type === "hurdle") && !aiPaused.has(ob)) {
          aiPaused.add(ob);
          aiPauseUntil = t + 0.55;
        }
      }
      if (ai >= TRACK_LEN) aiTime = t;
    }
  }

  return { won: meTime < aiTime, meTime, aiTime, mePos: me, aiPos: ai, itemsTaken };
}

// ---------------------------------------------------------------------------
// 无尽模式「星轨长跑」：赛道不设终点，身后的追赶者越跑越快，被追上就结束
// ---------------------------------------------------------------------------

/** 无尽模式的追赶者速度：每 60 米提一档，有封顶，不会快到追不上也跑不掉 */
export function endlessChaserSpeed(meters: number): number {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  return Math.min(13.5, 6.4 + Math.floor(m / 60) * 0.42);
}

/** 无尽模式里两个机关之间的间距：越跑越密，但留着最小安全距离 */
export function endlessGapMeters(meters: number): number {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  return Math.max(16, 34 - Math.floor(m / 90) * 2);
}

/** 无尽模式跑到多少米算破纪录（0 分不写档，免得刚开跑就弹「新纪录」） */
export function isNewRecord(meters: number, best: number): boolean {
  return Math.floor(meters) > Math.max(0, Math.floor(best));
}
