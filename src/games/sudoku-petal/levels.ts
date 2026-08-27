/**
 * 数独花田 · 188 关战役配置(纯数据 + 纯函数)。
 *
 * 八章按「解这一题最少要用到哪一档技巧」一层层往上走,盘面也一路换花样:
 * 四宫 → 六宫 → 标准九宫 → 需要隐性唯一 → 需要显性数对 → 对角花 → 异形宫 → 花田杯。
 *
 * ## 为什么每一关都过得去
 *
 * 每关的题不是现场随机生成的,是出题机按 `levelSpec(level)` 的规格产出后**固化**在
 * `puzzles.ts` 里的常量。出题机挖每一个洞时都要过两道闸门:唯一解 + 允许的技巧档能纯逻辑推完。
 * 所以 188 题里**没有一题需要猜**,提示按钮永远给得出下一步方法。
 * `levels.test.ts` 对 188 题逐题断言这两条。
 */
import { TOTAL_LEVELS, assertTotal, type Chapter } from "../level99";
import type { VariantKind } from "./solver";
import type { TechniqueKind } from "./techniques";
import type { AiTier } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "四宫萌芽", emoji: "🌱", color: "#EFE7FF", desc: "四宫小花田:一行、一列、一朵花里都要有一到四。", size: 24 },
  { name: "六宫苗", emoji: "🌿", color: "#E6F2FF", desc: "六宫花田,一朵花是两行三列的长方形,数字到六。", size: 24 },
  { name: "唯余九宫", emoji: "🌼", color: "#FFF4DA", desc: "正式的九宫花田,只靠「这一格只剩一种」就能一路推完。", size: 24 },
  { name: "铅笔笔记", emoji: "✏️", color: "#E9F6E9", desc: "开始要换个角度找了,把候选写成小字更容易看出门道。", size: 24 },
  { name: "成对花", emoji: "🌸", color: "#FDE7F1", desc: "两格候选一模一样时,同组别的格子就能划掉这两个。", size: 22 },
  { name: "对角花", emoji: "💠", color: "#E3F1FA", desc: "两条斜线也要一到九不重复,多了两条线索也多了两条限制。", size: 22 },
  { name: "异形宫", emoji: "🧩", color: "#F3E9DA", desc: "九朵花长得歪歪扭扭,行和列的规矩一点没变。", size: 24 },
  { name: "花田杯", emoji: "🏆", color: "#FFE7DC", desc: "区块摒除加竞速,前面学过的招式全用上。", size: 24 }
];

// 章节加起来必须正好 188:加减关数时在这里就报错,不用等跑到首页才发现。
assertTotal(CHAPTERS, 188, "sudoku-petal");

/** 每关的出题规格:题库就是照这份规格产出来的 */
export interface LevelSpec {
  /** 0 基关号 */
  level: number;
  chapter: number;
  kind: VariantKind;
  /** 允许(也是要求)用到的最高技巧档 */
  tier: TechniqueKind;
  /** 想挖出多少空格 */
  holes: number;
  /** 要不要求这一题真的用得上 tier 这一档 */
  requireTier: boolean;
  /** 固定 seed:同一关每次出的题一模一样 */
  seed: number;
  /** 本关允许错几次;超过就本关失败 */
  errorLimit: number;
  /** 三星的目标用时(毫秒) */
  parMs: number;
  /** 竞速关:旁边有个假人同题开跑 */
  race: boolean;
  aiTier: AiTier;
}

/** 关号 → 章节下标 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

const RACE_TIERS: AiTier[] = ["rookie", "normal", "pro", "hell"];

/** 每章的盘面种类、技巧档与挖洞量:章内按 ramp 从松到紧 */
export function levelSpec(level: number): LevelSpec {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - chapterStartOf(ci);
  const span = Math.max(1, CHAPTERS[ci].size - 1);
  const ramp = inCh / span;

  let kind: VariantKind = "classic";
  let tier: TechniqueKind = "nakedSingle";
  let holes = 40;
  let requireTier = false;
  let parMs = 180_000;
  let race = false;
  let aiTier: AiTier = "normal";

  switch (ci) {
    case 0:
      kind = "mini4";
      tier = "nakedSingle";
      holes = 8 + Math.round(ramp * 4);
      parMs = 60_000;
      break;
    case 1:
      kind = "mini6";
      tier = "hiddenSingle";
      holes = 18 + Math.round(ramp * 8);
      parMs = 110_000;
      break;
    case 2:
      kind = "classic";
      tier = "nakedSingle";
      holes = 38 + Math.round(ramp * 10);
      parMs = 210_000;
      break;
    case 3:
      kind = "classic";
      tier = "hiddenSingle";
      holes = 44 + Math.round(ramp * 10);
      requireTier = true;
      parMs = 260_000;
      break;
    case 4:
      kind = "classic";
      tier = "nakedPair";
      holes = 54 + Math.round(ramp * 10);
      requireTier = true;
      parMs = 300_000;
      break;
    case 5:
      kind = "diagonal";
      tier = "nakedPair";
      holes = 48 + Math.round(ramp * 10);
      parMs = 300_000;
      break;
    case 6:
      kind = "jigsaw";
      tier = "nakedPair";
      holes = 48 + Math.round(ramp * 10);
      parMs = 320_000;
      break;
    default:
      kind = "classic";
      tier = "pointingPair";
      holes = 56 + Math.round(ramp * 8);
      requireTier = true;
      parMs = 360_000;
      // 单数关旁边站个假人同题开跑
      race = inCh % 2 === 1;
      aiTier = RACE_TIERS[Math.min(RACE_TIERS.length - 1, Math.floor(ramp * RACE_TIERS.length))];
      break;
  }

  return {
    level: lv,
    chapter: ci,
    kind,
    tier,
    holes,
    requireTier,
    seed: 90_001 + lv * 271,
    // 规格:闯关开「错 3 次本关失败」
    errorLimit: 3,
    parMs,
    race,
    aiTier
  };
}

/** 这一关的目标写成一句话 */
export function goalLine(spec: LevelSpec): string {
  const size = spec.kind === "mini4" ? "4×4" : spec.kind === "mini6" ? "6×6" : "9×9";
  const parts = [`${size} 花田`];
  if (spec.kind === "diagonal") parts.push("两条斜线也不许重复");
  if (spec.kind === "jigsaw") parts.push("九朵花是异形的");
  parts.push(`最多错 ${spec.errorLimit} 次`);
  if (spec.race) parts.push("和假人比谁先种完");
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// 评星
// ---------------------------------------------------------------------------

/**
 * 评星(规格里的 `starsByTimeAndErrors`):一次没错又在目标时间内是三星,
 * 只满足一条是两星,都没满足也有一星 —— 种完就是本事,不打击人。
 */
export function starsByTimeAndErrors(ms: number, errors: number, parMs = 180_000): 1 | 2 | 3 {
  const time = Number.isFinite(ms) && ms > 0 ? ms : Number.POSITIVE_INFINITY;
  const wrong = Number.isFinite(errors) && errors > 0 ? Math.round(errors) : 0;
  const quick = time <= parMs;
  const clean = wrong === 0;
  if (quick && clean) return 3;
  if (quick || clean) return 2;
  return 1;
}

/** 过关时的一句夸奖 */
export function winLine(ms: number, errors: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  if (errors === 0) return `一朵花都没种错,用了 ${sec} 秒,整片花田都开了！`;
  return `花田种满啦,用了 ${sec} 秒,中间改了 ${errors} 次也完全不影响。`;
}

/** 本关失败时的一句话:只鼓励,不批评 */
export function loseLine(spec: LevelSpec): string {
  if (spec.kind === "jigsaw") return "这题有点难,先把最容易的那一宫补上,异形花的形状看熟了就顺了。";
  if (spec.kind === "diagonal") return "这题有点难,先把最容易的那一宫补上,再回头看两条斜线。";
  return "这题有点难,先把最容易的那一宫补上,剩下的会跟着松动。";
}

// ---------------------------------------------------------------------------
// 无尽 · 马拉松
// ---------------------------------------------------------------------------

export type EndlessKind = "mixed" | "mini";

export interface EndlessConfig {
  kind: EndlessKind;
  label: string;
  hint: string;
  /** 错满这么多题就结束 */
  errorLimit: number;
  /** 这一档抽题的关号池 */
  pool: number[];
}

/** 无尽:连着解题,错 3 题结束(规格硬性要求) */
export function endlessConfig(kind: EndlessKind): EndlessConfig {
  if (kind === "mini") {
    return {
      kind,
      label: "🌱 小花田马拉松",
      hint: "四宫和六宫轮着来,错三题结束,看看能连着种多少片。",
      errorLimit: 3,
      pool: Array.from({ length: 48 }, (_, i) => i)
    };
  }
  return {
    kind,
    label: "♾️ 花田马拉松",
    hint: "八章的题混着抽,错三题结束,记你最长的连解纪录。",
    errorLimit: 3,
    pool: Array.from({ length: TOTAL_LEVELS }, (_, i) => i)
  };
}

/** 无尽第 n 题(0 基)抽哪一关的题:越往后越难 */
export function endlessPick(cfg: EndlessConfig, index: number, seed = 7): number {
  const pool = cfg.pool;
  if (pool.length === 0) return 0;
  // 前面从池子的浅水区抽,越往后水越深
  const depth = Math.min(pool.length, 6 + index * 3);
  const at = (index * 37 + seed * 13 + index * index) % depth;
  return pool[at];
}

// ---------------------------------------------------------------------------
// 对战 / 双人
// ---------------------------------------------------------------------------

export interface VersusConfig {
  tier: AiTier;
  /** 用哪一关的题当赛题 */
  level: number;
}

/** 对战:两边解同一题,比谁先种完 */
export function versusConfig(tier: AiTier, level = 60): VersusConfig {
  return { tier, level: Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level))) };
}

/** 对战可选的赛题(章节代表关,1 基展示用 0 基存储) */
export const VERSUS_LEVELS: readonly number[] = [11, 35, 59, 83, 105, 127, 151, 175];

/** 双人同屏:左右两块盘同一题 */
export const DUO_LEVELS: readonly number[] = [5, 29, 53, 77, 99, 121, 145, 169];
