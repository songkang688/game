// 音乐星星：99 关 · 六大音乐会章节关卡生成（跟弹旋律，确定性可测试）
import { chapterOf, indexInChapter, mulberry32, type Chapter } from "../level99";
import { makeSequence, TWINKLE_FINALE } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "三星广场", emoji: "✨", color: "#d0f0fd", desc: "三颗星星，跟着弹短乐句", size: 17 },
  { name: "四星舞台", emoji: "🎭", color: "#ffe8cc", desc: "第四颗星星加入啦", size: 17 },
  { name: "五星剧院", emoji: "🎪", color: "#e5dbff", desc: "五声音阶全到齐", size: 17 },
  { name: "回声森林", emoji: "🌲", color: "#d3f9d8", desc: "回声只重播一遍，要用心记", size: 16 },
  { name: "闪电音符", emoji: "⚡", color: "#fff3bf", desc: "星星唱得越来越快", size: 16 },
  { name: "星光音乐会", emoji: "🎆", color: "#ffdeeb", desc: "长乐句 + 小星星终曲", size: 16 },
];

export interface MusicLevel {
  /** 可用星星（音符）数：3..5 */
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
    default:
      return {
        starCount: 5, rounds: 2 + (t > 0.3 ? 1 : 0), seqLen: 6 + Math.floor(t * 2), maxJump: 2,
        noteMs: 640, replays: 2, maxMiss: 4, finale: t > 0.4, theme: 5,
      };
  }
}

export const LEVELS: MusicLevel[] = Array.from({ length: 99 }, (_, i) => buildLevel(i));

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
