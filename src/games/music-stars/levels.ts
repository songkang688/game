// 音乐星星：188 关 · 十场音乐会章节关卡生成（确定性可测试）
// 前 99 关是 1.0 的六场音乐会（跟弹旋律），一个字都没动；
// 1.1 在末尾追加四场（第 100–188 关）：节奏跟打、音程听辨、双声部合奏、简谱视奏。
import { chapterOf, indexInChapter, mulberry32, type Chapter } from "../level99";
import {
  intervalLabel,
  makeChords,
  makeIntervalPair,
  makeRhythm,
  makeSequence,
  TWINKLE_FINALE,
} from "./logic";
import { pentatonicIntervalName } from "./tuning";
import { DUET_MIN_GAP_STEPS } from "./touch";

/** 1.0 的六场音乐会：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新音乐会从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export const CHAPTERS: Chapter[] = [
  { name: "三星广场", emoji: "✨", color: "#d0f0fd", desc: "三颗星星，跟着弹短乐句", size: 17 },
  { name: "四星舞台", emoji: "🎭", color: "#ffe8cc", desc: "第四颗星星加入啦", size: 17 },
  { name: "五星剧院", emoji: "🎪", color: "#e5dbff", desc: "五声音阶全到齐", size: 17 },
  { name: "回声森林", emoji: "🌲", color: "#d3f9d8", desc: "回声只重播一遍，要用心记", size: 16 },
  { name: "闪电音符", emoji: "⚡", color: "#fff3bf", desc: "星星唱得越来越快", size: 16 },
  { name: "星光音乐会", emoji: "🎆", color: "#ffdeeb", desc: "长乐句 + 小星星终曲", size: 16 },
  // ↓ 1.1 追加：四场高年级音乐会，合计 89 关
  { name: "节奏鼓点坡", emoji: "🥁", color: "#ffe3e3", desc: "不看音高只听长短，跟着敲出节奏型", size: 22 },
  { name: "音程听辨馆", emoji: "🎧", color: "#e6fcf5", desc: "两个音一比，听出高低差几格", size: 22 },
  { name: "双声部合奏厅", emoji: "🎻", color: "#f8f0fc", desc: "一拍两个音，两只手一起来", size: 23 },
  { name: "简谱视奏台", emoji: "🎼", color: "#edf2ff", desc: "不放范奏，照着简谱直接弹", size: 22 },
];

/** 1.1 追加的四种新玩法；不填就是 1.0 的「听回声跟弹」 */
export type MusicMode = "rhythm" | "interval" | "duet" | "score";

export interface MusicLevel {
  /** 可用星星（音符）数：3..5；节奏关是两个鼓点键 */
  starCount: number;
  /** 本关要跟弹的乐句数 */
  rounds: number;
  /** 每句音符数 */
  seqLen: number;
  /** 相邻音最大跨度（越小越顺口） */
  maxJump: number;
  /** 每个音符亮灯时长（毫秒），越小越快 */
  noteMs: number;
  /** 每句允许再听的次数（-1 = 不限） */
  replays: number;
  /** 允许弹错的总次数，超过则温柔失败 */
  maxMiss: number;
  /** 最后是否加《一闪一闪亮晶晶》终曲片段 */
  finale: boolean;
  theme: number;
  /** 1.1 新玩法；前 99 关一律不带这个字段 */
  mode?: MusicMode;
}

function buildLevel(level: number): MusicLevel {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      return {
        starCount: 3, rounds: 2, seqLen: 3 + Math.floor(t * 2), maxJump: 2,
        noteMs: 750, replays: -1, maxMiss: 5, finale: false, theme: 0,
      };
    case 1:
      return {
        starCount: 4, rounds: 2 + (t > 0.6 ? 1 : 0), seqLen: 3 + Math.floor(t * 3), maxJump: 2,
        noteMs: 720, replays: -1, maxMiss: 5, finale: false, theme: 1,
      };
    case 2:
      return {
        starCount: 5, rounds: 3, seqLen: 4 + Math.floor(t * 2), maxJump: 2,
        noteMs: 700, replays: -1, maxMiss: 4, finale: false, theme: 2,
      };
    case 3:
      // 回声森林：只许再听一遍，乐句稍短作补偿
      return {
        starCount: 4 + (t > 0.5 ? 1 : 0), rounds: 2 + (t > 0.4 ? 1 : 0), seqLen: 4 + Math.floor(t * 2), maxJump: 2,
        noteMs: 700, replays: 1, maxMiss: 4, finale: false, theme: 3,
      };
    case 4:
      // 闪电音符：越来越快
      return {
        starCount: 5, rounds: 3, seqLen: 5 + Math.floor(t * 2), maxJump: 3,
        noteMs: 560 - Math.floor(t * 140), replays: -1, maxMiss: 4, finale: false, theme: 4,
      };
    case 5:
      return {
        starCount: 5, rounds: 2 + (t > 0.3 ? 1 : 0), seqLen: 6 + Math.floor(t * 2), maxJump: 2,
        noteMs: 640, replays: 2, maxMiss: 4, finale: t > 0.4, theme: 5,
      };
    case 6:
      // 节奏鼓点坡：两个鼓点键（短 / 长），只跟长短不跟音高
      return {
        starCount: 2, rounds: 3, seqLen: 5 + Math.floor(t * 3), maxJump: 1,
        noteMs: 620 - Math.floor(t * 80), replays: t > 0.5 ? 2 : -1, maxMiss: 4, finale: false,
        theme: 6, mode: "rhythm",
      };
    case 7:
      // 音程听辨馆：一题两个音，答高低和格数
      return {
        starCount: 5, rounds: 4 + (t > 0.6 ? 1 : 0), seqLen: 2, maxJump: 4,
        noteMs: 640, replays: t > 0.5 ? 2 : -1, maxMiss: 3, finale: false,
        theme: 7, mode: "interval",
      };
    case 8:
      // 双声部合奏厅：一拍两个音，两颗星星都要按到
      return {
        starCount: 5, rounds: 2 + (t > 0.4 ? 1 : 0), seqLen: 3 + Math.floor(t * 2), maxJump: 4,
        noteMs: 700, replays: t > 0.6 ? 1 : 2, maxMiss: 4, finale: false,
        theme: 8, mode: "duet",
      };
    default:
      // 简谱视奏台：没有范奏，照着谱子直接弹
      return {
        starCount: 5, rounds: 2 + (t > 0.5 ? 1 : 0), seqLen: 6 + Math.floor(t * 2), maxJump: 3,
        noteMs: 600, replays: 0, maxMiss: 4, finale: t > 0.8,
        theme: 9, mode: "score",
      };
  }
}

export const LEVELS: MusicLevel[] = Array.from({ length: 188 }, (_, i) => buildLevel(i));

/**
 * 生成某一关全部乐句（确定性：同一关重试旋律不变）。
 * 终曲关最后附加《一闪一闪亮晶晶》片段。
 */
export function buildMelodies(level: number): number[][] {
  const cfg = LEVELS[level];
  const rand = mulberry32(9600 + level * 7919);
  const out: number[][] = [];
  for (let r = 0; r < cfg.rounds; r++) {
    out.push(makeSequence(cfg.seqLen, cfg.starCount, rand, cfg.maxJump));
  }
  if (cfg.finale) out.push(TWINKLE_FINALE.slice());
  return out;
}

// ---------------------------------------------------------------------------
// 1.1 追加：四种新玩法的每关内容（确定性，重玩不换题）
// ---------------------------------------------------------------------------

/** 节奏鼓点坡：每句一串长短音（0 短 / 1 长） */
export function buildRhythms(level: number): number[][] {
  const cfg = LEVELS[level];
  const rand = mulberry32(15200 + level * 7919);
  return Array.from({ length: cfg.rounds }, () => makeRhythm(cfg.seqLen, rand));
}

/** 音程听辨馆的一道题：先后放两个音，选出它们的关系 */
export interface IntervalRound {
  a: number;
  b: number;
  choices: string[];
  correct: number;
  /**
   * 1.2 新增：这一对音在乐理上的真名（大三度 / 纯四度…）。
   * 选项文案仍然是 1.1 的「往上几格」——「格」好懂，但同样的格数在五声音阶上
   * 可能是三度也可能是四度，所以答对之后要把真名亮出来，别让孩子记岔。
   */
  theory: string;
}

/** 音程听辨馆：每关若干道听辨题 */
export function buildIntervals(level: number): IntervalRound[] {
  const cfg = LEVELS[level];
  const rand = mulberry32(15900 + level * 7919);
  const out: IntervalRound[] = [];
  for (let r = 0; r < cfg.rounds; r++) {
    const [a, b] = makeIntervalPair(cfg.starCount, rand, cfg.maxJump);
    const answer = intervalLabel(a, b);
    const pool: string[] = [];
    for (let gap = 1; gap < cfg.starCount; gap++) {
      pool.push(intervalLabel(0, gap), intervalLabel(gap, 0));
    }
    const choices = [answer];
    for (const c of shuffledBy(pool, rand)) {
      if (choices.length >= 3) break;
      if (!choices.includes(c)) choices.push(c);
    }
    const mixed = shuffledBy(choices, rand);
    out.push({
      a,
      b,
      choices: mixed,
      correct: mixed.indexOf(answer),
      theory: pentatonicIntervalName(a, b),
    });
  }
  return out;
}

/**
 * 双声部合奏厅：每句若干拍，每拍两个音。
 * 1.2 起两个音至少隔 2 格——这一章要真的同时按下去，挨着的两颗星星
 * 会被一根手指同时盖住（`touch.ts` 的 `DUET_MIN_GAP_PX`）。
 */
export function buildDuets(level: number): number[][][] {
  const cfg = LEVELS[level];
  const rand = mulberry32(16700 + level * 7919);
  return Array.from({ length: cfg.rounds }, () =>
    makeChords(cfg.seqLen, cfg.starCount, rand, DUET_MIN_GAP_STEPS)
  );
}

/** 简谱视奏台：谱面直接给出来，不放范奏 */
export function buildScores(level: number): number[][] {
  return buildMelodies(level);
}

/**
 * 简谱视奏台的时值（1.2 新增）：0 是半拍（数字下加横线），1 是两拍（数字后加增时线）。
 * 1.1 的谱面只有裸数字，节奏在谱上完全看不出来；这里给每个音配一个时值，
 * 谱面第一次真的能读出长短。判定仍然只看音高顺序，不因此变难。
 */
export function buildScoreValues(level: number): number[][] {
  const rounds = buildScores(level);
  const rand = mulberry32(17300 + level * 7919);
  return rounds.map((seq) => makeRhythm(seq.length, rand));
}

function shuffledBy<T>(arr: readonly T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
