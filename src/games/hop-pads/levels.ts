/**
 * 跳跳台 · 188 关切分与每关难度。
 *
 * 8 章:直线台 24、左右摆 24、圆心课 24、移动台 24、缩小台 22、弹簧台 22、一次台 24、跳跳杯 24。
 * 24×4 + 22×2 + 24×2 = 188。
 *
 * 每一关只是一份「难度配方 + 目标座数 + 评星线」,台序由 `pads.ts` 的生成器按 seed 现算,
 * 所以关卡数据是常数级的,不用把 188 张地图写死在仓库里。
 */
import { assertTotal, rateAbove, type Chapter } from "../level99";
import { KIND_ICONS, KIND_NAMES, type Difficulty, type PadKind } from "./pads";

export const CHAPTERS: Chapter[] = [
  {
    name: "直线台",
    emoji: "⭕",
    color: "#FFE0C8",
    desc: "台子排成一条直线,先把「按多久 = 跳多远」记进手里。",
    size: 24,
  },
  {
    name: "左右摆",
    emoji: "🔶",
    color: "#FFE7D2",
    desc: "台子开始往左右偏,起跳方向会自动对准,你只管把力度调对。",
    size: 24,
  },
  {
    name: "圆心课",
    emoji: "🎯",
    color: "#FFD9E6",
    desc: "台面变小了:想拿三星,每一跳都得踩进中间那个圆心。",
    size: 24,
  },
  {
    name: "移动台",
    emoji: "↔️",
    color: "#D9ECFF",
    desc: "台子左右滑。瞄准是起跳那一刻定的,落点却按落地那一刻算。",
    size: 24,
  },
  {
    name: "缩小台",
    emoji: "🌀",
    color: "#E2E0FF",
    desc: "看到就开始缩,越磨蹭台面越小。想清楚再按,别把力度攒过头。",
    size: 22,
  },
  {
    name: "弹簧台",
    emoji: "🌸",
    color: "#FFE0F0",
    desc: "落到弹簧台会自动再弹一跳,而且稳稳踩中下一座的圆心,连击直接翻倍。",
    size: 22,
  },
  {
    name: "一次台",
    emoji: "💠",
    color: "#D8F5EC",
    desc: "跳走的那一座立刻塌掉,没有回头路,只能一直往前。",
    size: 24,
  },
  {
    name: "跳跳杯",
    emoji: "🏆",
    color: "#FFF0C8",
    desc: "五种台面混在一起,台子更小、跨度更大,把前面练的全用上。",
    size: 24,
  },
];

/** 章节和必须恒等 188 —— levels.test.ts 会盯着这一行 */
export const CHAPTERS_OK = assertTotal(CHAPTERS, 188, "hop-pads");

/** 每一章会出现的台面类型(攻略与关卡简介共用) */
export const CHAPTER_KINDS: ReadonlyArray<readonly PadKind[]> = [
  ["steady"],
  ["steady"],
  ["steady"],
  ["steady", "slider"],
  ["steady", "shrink"],
  ["steady", "spring"],
  ["steady", "once"],
  ["steady", "slider", "shrink", "spring", "once"],
];

export interface HopLevel {
  /** 0 基关号 */
  level: number;
  chapterIndex: number;
  /** 本章内的序号(0 基) */
  indexInChapter: number;
  seed: number;
  difficulty: Difficulty;
  /** 要连着站住几座台才算过关 */
  goal: number;
  /** 三星 / 二星需要的完美次数 */
  perfectFor3: number;
  perfectFor2: number;
  /** 训练关:画出落点辅助圆 */
  assist: boolean;
  hint: string;
}

/** 每关的随机种子:关号一变台序就换一套,但同一关永远一样 */
export function levelSeed(level: number): number {
  return 8_200_000 + level * 977;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 章节内进度 0→1 */
function ramp(indexInChapter: number, size: number): number {
  return size <= 1 ? 0 : indexInChapter / (size - 1);
}

/** 按章节与章内进度拼一份难度配方 */
export function levelDifficulty(chapterIndex: number, t: number): Difficulty {
  const kinds = CHAPTER_KINDS[chapterIndex] ?? CHAPTER_KINDS[0];
  const base: Difficulty = {
    kinds,
    minPower: lerp(0.3, 0.34, t),
    maxPower: lerp(0.5, 0.72, t),
    maxYaw: 0,
    minR: Math.round(lerp(38, 30, t)),
    maxR: Math.round(lerp(46, 38, t)),
    slideAmp: 0,
    minPeriod: 3.4,
    maxPeriod: 4.6,
    shrink: 0,
    minRRatio: 1,
  };
  switch (chapterIndex) {
    case 0:
      return base;
    case 1:
      return { ...base, maxYaw: lerp(0.12, 0.38, t) };
    case 2:
      // 圆心课:台面明显更小,逼着人把落点收进圆心
      return {
        ...base,
        maxYaw: lerp(0.1, 0.3, t),
        minR: Math.round(lerp(30, 22, t)),
        maxR: Math.round(lerp(38, 28, t)),
      };
    case 3:
      return {
        ...base,
        maxYaw: lerp(0.12, 0.32, t),
        minPower: lerp(0.38, 0.42, t),
        maxPower: lerp(0.58, 0.74, t),
        slideAmp: lerp(10, 26, t),
        minPeriod: lerp(4.4, 3.2, t),
        maxPeriod: lerp(5.6, 4.2, t),
      };
    case 4:
      return {
        ...base,
        maxYaw: lerp(0.12, 0.32, t),
        shrink: lerp(4, 12, t),
        minRRatio: lerp(0.75, 0.5, t),
      };
    case 5:
      return { ...base, maxYaw: lerp(0.12, 0.34, t) };
    case 6:
      return { ...base, maxYaw: lerp(0.12, 0.36, t) };
    default:
      return {
        ...base,
        maxYaw: lerp(0.2, 0.44, t),
        minPower: lerp(0.34, 0.4, t),
        maxPower: lerp(0.66, 0.82, t),
        minR: Math.round(lerp(32, 24, t)),
        maxR: Math.round(lerp(40, 30, t)),
        slideAmp: lerp(14, 26, t),
        minPeriod: lerp(4.2, 3.2, t),
        maxPeriod: lerp(5.4, 4.2, t),
        shrink: lerp(5, 11, t),
        minRRatio: lerp(0.7, 0.5, t),
      };
  }
}

/** 章节起始关号(0 基) */
function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 这一章都有哪些台面,拼成一句中文 */
export function kindsLine(chapterIndex: number): string {
  const kinds = CHAPTER_KINDS[chapterIndex] ?? CHAPTER_KINDS[0];
  return kinds.map((k) => `${KIND_ICONS[k]}${KIND_NAMES[k]}`).join(" ");
}

/** 组装第 level 关(0 基) */
export function buildLevel(level: number): HopLevel {
  const lv = Math.max(0, Math.min(187, Math.round(level)));
  let ci = 0;
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (lv < acc) {
      ci = i;
      break;
    }
    ci = i;
  }
  const inCh = lv - chapterStartOf(ci);
  const size = CHAPTERS[ci].size;
  const t = ramp(inCh, size);
  const difficulty = levelDifficulty(ci, t);
  const goal = Math.round(lerp(5, ci === 7 ? 16 : 12, t));
  // 圆心课整章都要求全完美才三星;别的章按比例往上走
  const ratio3 = ci === 2 ? 1 : lerp(0.5, 0.8, t);
  const ratio2 = ci === 2 ? lerp(0.6, 0.8, t) : lerp(0.25, 0.5, t);
  return {
    level: lv,
    chapterIndex: ci,
    indexInChapter: inCh,
    seed: levelSeed(lv),
    difficulty,
    goal,
    perfectFor3: Math.min(goal, Math.ceil(goal * ratio3)),
    perfectFor2: Math.min(goal, Math.ceil(goal * ratio2)),
    // 每章前三关都开辅助圆,第 1 章前八关一直开
    assist: inCh < 3 || (ci === 0 && inCh < 8),
    hint: `站住 ${goal} 座 · ${kindsLine(ci)}`,
  };
}

/** 本关成绩 */
export interface LevelResult {
  /** 站住了几座 */
  cleared: number;
  perfects: number;
  score: number;
  bestCombo: number;
}

/** 达标了没有:座数够了就算过关,评星再看完美次数 */
export function levelPassed(lv: HopLevel, res: LevelResult): boolean {
  return res.cleared >= lv.goal;
}

/** 评星:过关 1 星,完美够多给 2 星 / 3 星 */
export function levelStars(lv: HopLevel, res: LevelResult): 1 | 2 | 3 {
  return rateAbove(res.perfects, lv.perfectFor3, lv.perfectFor2);
}

/** 过关那句夸奖 */
export function winLine(lv: HopLevel, res: LevelResult, stars: 1 | 2 | 3): string {
  if (stars === 3) return `${res.cleared} 座全站稳,${res.perfects} 次踩中圆心,这一关满分!`;
  if (stars === 2) return `站满 ${lv.goal} 座啦!再多踩中 ${Math.max(1, lv.perfectFor3 - res.perfects)} 次圆心就是三星。`;
  return `过关!这一关踩中圆心 ${res.perfects} 次,下次试着让落点再往中间收一点。`;
}

/** 掉下去那句话:云朵接住,不是死亡 */
export const CATCH_LINE = "云朵接住你啦,再来一次";

/** 失败文案:只鼓励,不批评 */
export function loseLine(lv: HopLevel, res: LevelResult): string {
  const left = Math.max(1, lv.goal - res.cleared);
  return `${CATCH_LINE}。这次站住了 ${res.cleared} 座,再站住 ${left} 座就过关啦。`;
}

/** 无尽模式:跳得越远台子越小、跨度越大,但永远在可达范围内 */
export function endlessDifficulty(hops: number): Difficulty {
  const t = Math.min(1, Math.max(0, hops) / 40);
  return {
    kinds: ["steady", "steady", "slider", "shrink", "spring", "once"],
    minPower: lerp(0.3, 0.4, t),
    maxPower: lerp(0.56, 0.82, t),
    maxYaw: lerp(0.14, 0.42, t),
    minR: Math.round(lerp(36, 24, t)),
    maxR: Math.round(lerp(46, 32, t)),
    slideAmp: lerp(8, 26, t),
    minPeriod: lerp(4.6, 3.2, t),
    maxPeriod: lerp(5.8, 4.2, t),
    shrink: lerp(3, 11, t),
    minRRatio: lerp(0.8, 0.5, t),
  };
}

/** 对战 / 双人:双方跑同一条台序,难度固定,比的是手感 */
export function matchDifficulty(round: number): Difficulty {
  const t = Math.min(1, Math.max(0, round - 1) / 6);
  return {
    kinds: ["steady", "slider", "shrink", "spring", "once"],
    minPower: lerp(0.32, 0.4, t),
    maxPower: lerp(0.6, 0.78, t),
    maxYaw: lerp(0.18, 0.38, t),
    minR: Math.round(lerp(34, 26, t)),
    maxR: Math.round(lerp(44, 34, t)),
    slideAmp: lerp(10, 24, t),
    minPeriod: lerp(4.4, 3.4, t),
    maxPeriod: lerp(5.6, 4.4, t),
    shrink: lerp(4, 10, t),
    minRRatio: lerp(0.75, 0.55, t),
  };
}

/** 对战每一局的台序种子 */
export function matchSeed(round: number): number {
  return 8_800_000 + round * 3181;
}
