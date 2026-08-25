/**
 * 地鼠嘭嘭 · 99 关关卡表。
 * 六个主题章节、六种地鼠组合（并非同一模板）：
 *  ①草地新手=普通地鼠  ②瞌睡午后=瞌睡地鼠待得久
 *  ③闪电竞技=地鼠冒头飞快  ④金矿乐园=金地鼠一只顶两只
 *  ⑤小兔保护区=千万别拍小兔子  ⑥地鼠嘉年华=全员出动终极挑战
 */
import type { Chapter } from "../level99";

export interface MoleLevel {
  /** 本关时长（秒） */
  duration: number;
  /** 需要拍中的分数（普通/瞌睡=1 分，金地鼠=2 分） */
  target: number;
  /** 地鼠冒头停留时间范围（毫秒） */
  upMsMin: number;
  upMsMax: number;
  /** 两次冒头的间隔（毫秒） */
  gapMs: number;
  /** 同时最多几只 */
  maxConcurrent: number;
  goldChance: number;
  bunnyChance: number;
  sleepyChance: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "草地新手", emoji: "🌱", color: "#E4F3D4", desc: "地鼠冒头就拍它，练练手速！", size: 17 },
  { name: "瞌睡午后", emoji: "😴", color: "#FFF0C9", desc: "瞌睡地鼠待得久，别被它骗了节奏！", size: 17 },
  { name: "闪电竞技", emoji: "⚡", color: "#FFE9D6", desc: "地鼠冒头飞快，眼疾手快才行！", size: 17 },
  { name: "金矿乐园", emoji: "🌟", color: "#FFF6D8", desc: "金地鼠一只顶两只，专挑亮的拍！", size: 16 },
  { name: "小兔保护区", emoji: "🐰", color: "#FFE0EC", desc: "小兔子会混进来，千万别拍它！", size: 16 },
  { name: "地鼠嘉年华", emoji: "🎪", color: "#EBDFFB", desc: "金地鼠、小兔、闪电速度全都来啦！", size: 16 }
];

function buildLevel(ci: number, t: number): MoleLevel {
  switch (ci) {
    case 0:
      return {
        duration: 30, target: 8 + Math.floor(t / 2),
        upMsMin: 1250 - t * 20, upMsMax: 1700 - t * 20,
        gapMs: 800 - t * 10, maxConcurrent: t < 9 ? 1 : 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0
      };
    case 1:
      return {
        duration: 32, target: 10 + Math.floor(t / 2),
        upMsMin: 1000 - t * 15, upMsMax: 1500 - t * 15,
        gapMs: 750 - t * 10, maxConcurrent: 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0.35
      };
    case 2:
      return {
        duration: 30, target: 11 + Math.floor(t / 2),
        upMsMin: 700 - t * 12, upMsMax: 1050 - t * 12,
        gapMs: 620 - t * 10, maxConcurrent: 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0
      };
    case 3:
      return {
        duration: 32, target: 14 + Math.floor(t / 2),
        upMsMin: 850 - t * 10, upMsMax: 1250 - t * 10,
        gapMs: 600 - t * 8, maxConcurrent: 2,
        goldChance: 0.25, bunnyChance: 0, sleepyChance: 0
      };
    case 4:
      return {
        duration: 32, target: 12 + Math.floor(t / 2),
        upMsMin: 850 - t * 10, upMsMax: 1300 - t * 10,
        gapMs: 620 - t * 8, maxConcurrent: 2,
        goldChance: 0, bunnyChance: 0.2 + t * 0.006, sleepyChance: 0
      };
    default:
      return {
        duration: 34, target: 15 + Math.floor(t / 2),
        upMsMin: 700 - t * 8, upMsMax: 1050 - t * 8,
        gapMs: 540 - t * 8, maxConcurrent: 3,
        goldChance: 0.18, bunnyChance: 0.16, sleepyChance: 0.15
      };
  }
}

export const LEVELS: MoleLevel[] = (() => {
  const out: MoleLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
