/**
 * 连招对决 · 188 关挑战塔配置(纯数据 + 纯函数)。
 *
 * 八章把这套系统一样一样拆开教:先只用轻击练距离,再练取消,
 * 然后跳入、破防、超必取消、贴边、起身猜拳,最后全角色轮换的连招杯。
 *
 * 每一关都固定 seed、固定对手、固定舞台宽度,所以"这一关打不打得赢"
 * 是可以用无头模拟一关一关跑出来的。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";
import { CHARACTER_IDS, characterById } from "./frames";
import type { MoveSlot } from "./frames";
import { NARROW_STAGE_WIDTH, STAGE_WIDTH, defaultConfig, type MatchConfig, type SideStats } from "./engine";
import type { AiTier, FoeStyle } from "./ai";

export type { FoeStyle };

export const CHAPTERS: Chapter[] = [
  { name: "轻击学堂", emoji: "🌸", color: "#FFE1EF", desc: "只用轻击,先把距离和收招摸熟。", size: 24 },
  { name: "取消入门", emoji: "🔁", color: "#E7E1FB", desc: "轻击命中之后取消成重击,连段才打得动。", size: 24 },
  { name: "跳入花园", emoji: "🕊️", color: "#DCEEFF", desc: "先跳过去空中命中,落地再接一串地面连。", size: 24 },
  { name: "破防工坊", emoji: "🛡️", color: "#FFF0D6", desc: "对手一直挡,用下段、投技和破防招撬开它。", size: 24 },
  { name: "超必剧场", emoji: "💫", color: "#F6DDF2", desc: "必杀命中的那几帧里花槽换成超必收尾。", size: 24 },
  { name: "贴边悬崖", emoji: "🧗", color: "#DDF3E7", desc: "场地变窄,贴着边角连段更容易接住。", size: 22 },
  { name: "起身猜拳", emoji: "🎲", color: "#FFE6DC", desc: "对手会抓起身,也会逆转;起身三选一要选对。", size: 22 },
  { name: "连招杯", emoji: "🏆", color: "#FFF3C9", desc: "全角色轮换,三局两胜,把学过的全用上。", size: 24 }
];

/** 每一章要教的那一手 */
export type Mechanic = "light" | "cancel" | "jumpIn" | "guardCrush" | "superCancel" | "corner" | "wakeup" | "cup";

export const MECHANIC_LABELS: Record<Mechanic, string> = {
  light: "轻击与距离",
  cancel: "取消窗口",
  jumpIn: "跳入落地接",
  guardCrush: "破防",
  superCancel: "超级取消",
  corner: "贴边连段",
  wakeup: "起身猜拳",
  cup: "全能连招杯"
};

export interface ClashLevel {
  /** 0 基关号 */
  level: number;
  chapter: number;
  mechanic: Mechanic;
  /** 固定 seed:同一关每次的对手行为完全一样 */
  seed: number;
  playerChar: string;
  foeChar: string;
  tier: AiTier;
  foeStyle: FoeStyle;
  stageWidth: number;
  roundsToWin: number;
  roundSeconds: number;
  /** 对手有玩家的几成元气(始终 ≤ 1:再难也不让对手比你还耐打) */
  foeVigor: number;
  /** 开局送给玩家多少能量 */
  startMeter: number;
  /** 这一关**两边**都只许用这些槽(null = 不限)。教学章限招是为了把那一手讲清楚,单方面限招就成了刁难 */
  allowedSlots: MoveSlot[] | null;
}

const MECHANIC_BY_CHAPTER: Mechanic[] = [
  "light",
  "cancel",
  "jumpIn",
  "guardCrush",
  "superCancel",
  "corner",
  "wakeup",
  "cup"
];

/** 关号 → 章节下标 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 章节起始关号(0 基) */
export function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 轻击学堂只开这几个槽 */
export const LIGHT_ONLY_SLOTS: MoveSlot[] = ["5L", "2L", "jL", "throw"];
/** 取消入门再开重击与必杀 */
export const CANCEL_SLOTS: MoveSlot[] = ["5L", "2L", "jL", "5H", "2H", "throw"];

function tierFor(ci: number, ramp: number): AiTier {
  if (ci <= 0) return "rookie";
  if (ci === 1) return ramp > 0.6 ? "normal" : "rookie";
  if (ci <= 3) return "normal";
  if (ci <= 5) return ramp > 0.5 ? "pro" : "normal";
  if (ci === 6) return ramp > 0.5 ? "hell" : "pro";
  return ramp > 0.7 ? "hell" : "pro";
}

export function levelConfig(level: number, playerChar = "duoduo"): ClashLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - chapterStartOf(ci);
  const ramp = inCh / Math.max(1, CHAPTERS[ci].size - 1);
  const mechanic = MECHANIC_BY_CHAPTER[ci];

  const foePool = CHARACTER_IDS.filter((id) => id !== playerChar);
  const foeChar = ci === 7 ? CHARACTER_IDS[lv % CHARACTER_IDS.length] : foePool[(lv * 3 + ci) % foePool.length];

  return {
    level: lv,
    chapter: ci,
    mechanic,
    seed: 3100 + lv * 137,
    playerChar,
    foeChar: foeChar === playerChar ? foePool[0] : foeChar,
    tier: tierFor(ci, ramp),
    foeStyle: mechanic === "guardCrush" ? "turtle" : mechanic === "jumpIn" ? "jumper" : "normal",
    stageWidth: mechanic === "corner" ? NARROW_STAGE_WIDTH : STAGE_WIDTH,
    roundsToWin: ci === 7 ? 2 : 1,
    roundSeconds: ci === 7 ? 60 : 50,
    // 五成起步、九成三封顶。难度靠人机档位和三局两胜往上抬,不靠给对手加元气
    foeVigor: Math.round((0.5 + ci * 0.05 + ramp * 0.08) * 100) / 100,
    startMeter: mechanic === "superCancel" ? 60 : ci >= 6 ? 30 : 0,
    allowedSlots: mechanic === "light" ? [...LIGHT_ONLY_SLOTS] : mechanic === "cancel" ? [...CANCEL_SLOTS] : null
  };
}

/**
 * 关卡里的 `foeVigor` 说的是「对手有玩家的几成元气」。
 *
 * 引擎那边的 `vigorScale` 是乘在**角色自己**的元气上的,直接把 0.7 递进去,
 * 换个厚墩墩那样的重量级对手就会比玩家还耐打,难度曲线全乱。
 * 所以这里按两边的底子先折算一次,让「七成」在任何配对下都真是七成。
 */
export function foeVigorScale(playerChar: string, foeChar: string, want: number): number {
  const mine = characterById(playerChar).vigor;
  const theirs = characterById(foeChar).vigor;
  if (theirs <= 0) return want;
  return Math.round(((want * mine) / theirs) * 1000) / 1000;
}

/** 把一关的配置翻译成对局配置 */
export function matchConfigFor(cfg: ClashLevel, reducedMotion = false): MatchConfig {
  return defaultConfig({
    chars: [cfg.playerChar, cfg.foeChar],
    stageWidth: cfg.stageWidth,
    roundsToWin: cfg.roundsToWin,
    roundFrames: cfg.roundSeconds * 60,
    reducedMotion,
    vigorScale: [1, foeVigorScale(cfg.playerChar, cfg.foeChar, cfg.foeVigor)],
    allowedSlots: [cfg.allowedSlots, cfg.allowedSlots],
    startMeter: [cfg.startMeter, 0]
  });
}

export interface LevelResult {
  /** 玩家赢了整场吗 */
  won: boolean;
  /** 玩家这一场的统计 */
  stats: SideStats;
  /** 打完时玩家剩多少元气 */
  vigorLeft: number;
  vigorMax: number;
  /** 玩家赢了几个回合 */
  roundsWon: number;
}

/** 这一关算不算过:打赢就算过,教学项只影响星星 */
export function levelWon(_cfg: ClashLevel, r: LevelResult): boolean {
  return r.won;
}

/** 这一章要教的那一手,做到了没有 */
export function mechanicDone(cfg: ClashLevel, s: SideStats): boolean {
  switch (cfg.mechanic) {
    case "light":
      return s.lightHits >= 3;
    case "cancel":
      return s.cancels >= 1;
    case "jumpIn":
      return s.jumpInCombos >= 1;
    case "guardCrush":
      return s.guardCrushes >= 1 || s.throws >= 1 || s.lowHits >= 2;
    case "superCancel":
      return s.superCancels >= 1;
    case "corner":
      return s.cornerHits >= 3;
    case "wakeup":
      return s.throws >= 1 || s.maxCombo >= 3;
    default:
      return s.maxCombo >= 3 || s.supersUsed >= 1;
  }
}

/** 三星:打赢一星,元气留得多加一星,把这一章要教的那一手打出来再加一星 */
export function starsFor(cfg: ClashLevel, r: LevelResult): 1 | 2 | 3 {
  if (!r.won) return 1;
  const ratio = r.vigorMax > 0 ? r.vigorLeft / r.vigorMax : 0;
  const healthy = ratio >= 0.5;
  const taught = mechanicDone(cfg, r.stats);
  if (healthy && taught) return 3;
  if (healthy || taught) return 2;
  return 1;
}

const MECHANIC_TIP: Record<Mechanic, string> = {
  light: "只开轻击,靠距离和收招取胜",
  cancel: "轻击命中后取消成重击能拿第三颗星",
  jumpIn: "跳入命中再落地接一串能拿第三颗星",
  guardCrush: "用下段、投技或破防招撬开格挡能拿第三颗星",
  superCancel: "必杀命中时超级取消成超必能拿第三颗星",
  corner: "把对手逼到边角上打三下能拿第三颗星",
  wakeup: "抓一次起身或者接满三段能拿第三颗星",
  cup: "接满三段或者放一次超必能拿第三颗星"
};

/** 关卡目标写成一句话 */
export function goalLine(cfg: ClashLevel): string {
  const parts = [cfg.roundsToWin > 1 ? "三局两胜" : "一回合定胜负", `${cfg.roundSeconds} 秒`];
  parts.push(MECHANIC_TIP[cfg.mechanic]);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// 无尽:连胜,对手一场比一场强
// ---------------------------------------------------------------------------

export interface EndlessConfig {
  streak: number;
  foeChar: string;
  tier: AiTier;
  foeVigor: number;
  roundsToWin: number;
  roundSeconds: number;
}

export function endlessConfig(streak: number, playerChar = "duoduo"): EndlessConfig {
  const n = Math.max(0, Math.round(Number.isFinite(streak) ? streak : 0));
  const pool = CHARACTER_IDS.filter((id) => id !== playerChar);
  const tier: AiTier = n >= 9 ? "hell" : n >= 5 ? "pro" : n >= 2 ? "normal" : "rookie";
  return {
    streak: n,
    foeChar: pool[(n * 7) % pool.length],
    tier,
    foeVigor: Math.round((0.7 + Math.min(0.6, n * 0.06)) * 100) / 100,
    roundsToWin: 1,
    roundSeconds: 45
  };
}

export function endlessMatchConfig(cfg: EndlessConfig, playerChar: string, reducedMotion = false): MatchConfig {
  return defaultConfig({
    chars: [playerChar, cfg.foeChar],
    stageWidth: STAGE_WIDTH,
    roundsToWin: cfg.roundsToWin,
    roundFrames: cfg.roundSeconds * 60,
    reducedMotion,
    vigorScale: [1, foeVigorScale(playerChar, cfg.foeChar, cfg.foeVigor)],
    startMeter: [Math.min(50, cfg.streak * 10), 0]
  });
}

// ---------------------------------------------------------------------------
// 对战 / 双人 / 训练
// ---------------------------------------------------------------------------

export function versusMatchConfig(
  playerChar: string,
  foeChar: string,
  reducedMotion = false,
  roundSeconds = 60
): MatchConfig {
  return defaultConfig({
    chars: [playerChar, foeChar],
    stageWidth: STAGE_WIDTH,
    roundsToWin: 2,
    roundFrames: roundSeconds * 60,
    reducedMotion
  });
}

export function trainingMatchConfig(playerChar: string, foeChar: string, reducedMotion = false): MatchConfig {
  return defaultConfig({
    chars: [playerChar, foeChar],
    stageWidth: STAGE_WIDTH,
    roundsToWin: 99,
    roundFrames: 99 * 60 * 60,
    reducedMotion,
    startMeter: [100, 0]
  });
}
