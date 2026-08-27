/**
 * 音符下落 · 8 章 188 关关卡数据(纯数据 + 纯函数)。
 *
 * 每关一个固定 seed,谱面由 `chartFromSeed` 现算,所以关卡表本身很小,
 * 而且完美机器人能把每一关都跑一遍——「这关打得完」是测出来的,不是拍脑袋写的。
 */
import { chapterOf, indexInChapter, type Chapter } from "../level99";
import { chartFromSeed, BOSS_MAX_CONCURRENT, DEFAULT_MAX_CONCURRENT, type Chart } from "./chart";
import { CAMPAIGN_MAX_MISS, endlessSpeedAt, speedAt } from "./judge";
import type { EmptyRule, RunRules, RunState } from "./run";
import { perfectRate } from "./run";

export const CHAPTERS: Chapter[] = [
  { name: "单轨热身", emoji: "🎵", color: "#F3E9FF", desc: "只有一条轨在响,先把手指和判定线对上。", size: 24 },
  { name: "双轨对唱", emoji: "🎶", color: "#E9F0FF", desc: "两条轨轮流来,左右手各管一边。", size: 24 },
  { name: "别碰空白", emoji: "🚫", color: "#FFF0E6", desc: "从这一章起点到空白格就直接收工,看准了再点。", size: 24 },
  { name: "长按条", emoji: "➰", color: "#E8FBF0", desc: "拉长的音符要按住不放,撑到尾端才算完成。", size: 24 },
  { name: "加速跑", emoji: "⚡", color: "#FFF6DA", desc: "音符越落越快,提前一点点起手就跟得上。", size: 22 },
  { name: "双押合奏", emoji: "🤝", color: "#FDE8F3", desc: "两条轨同时亮,两根手指一起落。", size: 22 },
  { name: "双人分轨", emoji: "👫", color: "#E6F7FF", desc: "左两轨归鸭梨、右两轨归康康,一张谱两个人分着打。", size: 24 },
  { name: "音符杯", emoji: "🏆", color: "#EDE4FF", desc: "四条轨全开的综合赛,尾关还有三押的压轴谱。", size: 24 },
];

/** 章节里第几关起算的固定种子基数 */
export const SEED_BASE = 90731;

export interface TapLevel {
  /** 0 基关号 */
  level: number;
  chapter: number;
  indexInChapter: number;
  seed: number;
  speed: number;
  density: number;
  lanes: number[];
  count: number;
  holdChance: number;
  chordChance: number;
  /** 同一时刻最多几条轨有块;Boss 关显式放开到 3 */
  maxConcurrent: number;
  /** 压轴关:三押在这里才允许 */
  boss: boolean;
  /** 点空白怎么算 */
  emptyRule: EmptyRule;
  /** 这一关是不是「左右各两轨」的双人分轨关 */
  split: boolean;
  hint: string;
}

const PAIRS: number[][] = [
  [0, 1],
  [2, 3],
  [1, 2],
  [0, 3],
];

const TRIPLES: number[][] = [
  [0, 1, 2],
  [1, 2, 3],
  [0, 1, 3],
  [0, 2, 3],
];

const ALL: number[] = [0, 1, 2, 3];

const HINTS: string[] = [
  "只有一条轨,盯住判定线,块压上去就点。",
  "两条轨换着来,眼睛看中间,手放两边。",
  "空白格千万别碰,点空这一轮就结束了。",
  "长条按住别松,亮到尾端再抬手。",
  "速度上来了,提前半拍起手就不慌。",
  "两条轨同时亮就一起点,少一根手指都不行。",
  "左边两轨归鸭梨,右边两轨归康康,各管各的。",
  "四条轨全开,连击别断,压轴关还会来三押。",
];

/** 第 level 关(0 基)的全部参数 */
export function buildLevel(level: number): TapLevel {
  const lv = Math.max(0, Math.min(187, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterOf(CHAPTERS, lv);
  const idx = indexInChapter(CHAPTERS, lv);
  const size = CHAPTERS[ci].size;
  const last = idx === size - 1;
  // 压轴关只在「双押合奏」和「音符杯」两章的最后一关,三押就出在这里
  const boss = last && (ci === 5 || ci === 7);

  let lanes = ALL;
  let holdChance = 0;
  let chordChance = 0;
  switch (ci) {
    case 0:
      lanes = [idx % 4];
      break;
    case 1:
      lanes = PAIRS[idx % PAIRS.length];
      chordChance = 0.1;
      break;
    case 2:
      lanes = TRIPLES[idx % TRIPLES.length];
      chordChance = 0.12;
      break;
    case 3:
      lanes = idx % 2 === 0 ? TRIPLES[idx % TRIPLES.length] : ALL;
      holdChance = 0.26;
      chordChance = 0.1;
      break;
    case 4:
      holdChance = 0.14;
      chordChance = 0.16;
      break;
    case 5:
      holdChance = 0.12;
      chordChance = 0.45;
      break;
    case 6:
      holdChance = 0.18;
      chordChance = 0.3;
      break;
    default:
      holdChance = 0.22;
      chordChance = boss ? 0.5 : 0.38;
      break;
  }

  return {
    level: lv,
    chapter: ci,
    indexInChapter: idx,
    seed: SEED_BASE + lv * 977,
    speed: speedAt(lv),
    density: Math.min(1.6, Math.round((0.72 + idx * 0.028 + ci * 0.035) * 1e3) / 1e3),
    lanes: [...lanes],
    count: 14 + Math.round(idx * 0.7) + ci * 2,
    holdChance,
    chordChance,
    maxConcurrent: boss ? BOSS_MAX_CONCURRENT : Math.min(DEFAULT_MAX_CONCURRENT, lanes.length),
    boss,
    emptyRule: ci >= 2 ? "end" : "combo",
    split: ci === 6,
    hint: HINTS[ci],
  };
}

/** 这一关的谱面(固定 seed,每次生成都一样) */
export function levelChart(lv: TapLevel): Chart {
  return chartFromSeed(lv.seed, lv.density, lv.speed, {
    lanes: lv.lanes,
    count: lv.count,
    holdChance: lv.holdChance,
    chordChance: lv.chordChance,
    maxConcurrent: lv.maxConcurrent,
  });
}

/** 闯关规则:前两章点空只断连击,第三章起点空即结束 */
export function levelRules(lv: TapLevel): RunRules {
  return { emptyRule: lv.emptyRule, maxMiss: CAMPAIGN_MAX_MISS };
}

/** 关卡一句话简介(关内横幅用) */
export function levelBrief(lv: TapLevel): string {
  const bits = [`${lv.lanes.length} 轨`, `${lv.count} 个音符`, `速度 ${lv.speed.toFixed(2)}`];
  if (lv.holdChance > 0) bits.push("有长按条");
  if (lv.maxConcurrent >= 3) bits.push("三押压轴");
  else if (lv.chordChance >= 0.3) bits.push("多双押");
  return bits.join(" · ");
}

/** 评星:一个不漏且大多是完美给 3 星,漏一个给 2 星,其余 1 星 */
export function levelStars(state: RunState): 1 | 2 | 3 {
  if (state.miss === 0 && state.empty === 0 && perfectRate(state) >= 0.8) return 3;
  if (state.miss <= 1 && state.empty === 0) return 2;
  return 1;
}

/** 过关的夸奖 */
export function winLine(stars: 1 | 2 | 3, maxCombo: number): string {
  if (stars === 3) return `全程稳稳的,最高 ${maxCombo} 连,这一段弹得真好听。`;
  if (stars === 2) return `只漏了一个音,最高 ${maxCombo} 连,再来一遍就是满星。`;
  return `打完啦!最高 ${maxCombo} 连,先把节奏记熟,速度自然就跟上了。`;
}

/** 没过关的鼓励(只鼓励,不批评) */
export function loseLine(ended: RunState["ended"]): string {
  if (ended === "empty") return "点到空白格啦,下一次先等音符压到判定线再落手。";
  return "有几个音符溜走了,慢一点、稳一点,再试一遍准能过。";
}

// ---------------------------------------------------------------------------
// 无尽 / 对战的谱面
// ---------------------------------------------------------------------------

/** 无尽的第 wave 段(0 基):速度按时间递增,越到后面越密 */
export function endlessWave(wave: number): Chart {
  const w = Math.max(0, Math.round(wave));
  const speed = endlessSpeedAt(w * 8000);
  return chartFromSeed(SEED_BASE + 31 * (w + 1), Math.min(1.6, 0.85 + w * 0.05), speed, {
    lanes: ALL,
    count: 16 + Math.min(14, w),
    holdChance: w >= 2 ? 0.18 : 0,
    chordChance: w >= 1 ? 0.28 : 0.1,
    maxConcurrent: DEFAULT_MAX_CONCURRENT,
  });
}

/** 对战 / 双人同屏用的谱面:同一 round 双方拿到完全一样的谱 */
export function matchChart(round: number): Chart {
  const r = Math.max(1, Math.round(round));
  return chartFromSeed(SEED_BASE + 613 * r, Math.min(1.6, 0.95 + r * 0.06), Math.min(2.6, 1.3 + r * 0.12), {
    lanes: ALL,
    count: 26 + Math.min(16, r * 2),
    holdChance: 0.16,
    chordChance: 0.3,
    maxConcurrent: DEFAULT_MAX_CONCURRENT,
  });
}
