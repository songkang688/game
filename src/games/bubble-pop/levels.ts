/**
 * 泡泡噗噗 · 188 关关卡表。
 * 前 99 关是 1.0 的六大主题，生成参数一个字都没动；
 * 1.1 在末尾追加四个新主题（第 100–188 关）：
 *  ⑦倒影天湖=每消一组重力翻转  ⑧幻彩溶洞=变色泡泡每步换色
 *  ⑨步数栈桥=限步数达标  ⑩灯影迷宫=隐藏泡泡先点亮
 * 1.0 的六个主题章节、六种泡泡机关（并非同一模板）：
 *  ①清泉湖=经典同色连消  ②彩虹湾=彩虹泡泡  ③石头滩=敲不破的石头
 *  ④闪电云=闪电泡泡清一行一列  ⑤冻冻港=冰冻泡泡两步消
 *  ⑥星星塔=全机关混合终极挑战
 */
import type { Chapter } from "../level99";

/** 棋盘列数（与 index.ts 的渲染一致） */
export const BOARD_COLS = 8;

/** 1.0 的六个主题：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新主题从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface BubbleLevel {
  rows: number;
  colors: number;
  /** 结束时最多允许剩下多少个泡泡（含石头） */
  maxLeft: number;
  /** 各种特殊泡泡的数量 */
  rainbow: number;
  stone: number;
  bolt: number;
  frozen: number;
  /** 1.1 重力翻转：每消一组，重力上下对调，前 99 关不带 */
  flipGravity?: boolean;
  /** 1.1 变色泡泡数量（每消一组换一种颜色），前 99 关不带 */
  chameleon?: number;
  /** 1.1 步数上限（0/不带 = 不限步），前 99 关不带 */
  moveLimit?: number;
  /** 1.1 隐藏泡泡数量（要先点亮才看得见颜色），前 99 关不带 */
  hidden?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "清泉湖", emoji: "🫧", color: "#DCF3FF", desc: "点破挨在一起的同色泡泡！", size: 17 },
  { name: "彩虹湾", emoji: "🌈", color: "#FFE9F6", desc: "彩虹泡泡一点，最多的颜色全消光！", size: 17 },
  { name: "石头滩", emoji: "🪨", color: "#EDEBE4", desc: "石头敲不破，绕开它们做计划！", size: 17 },
  { name: "闪电云", emoji: "⚡", color: "#FFF6D8", desc: "闪电泡泡能清掉整行整列！", size: 16 },
  { name: "冻冻港", emoji: "🧊", color: "#E4F2FF", desc: "冰冻泡泡要先在旁边消一次才解冻！", size: 16 },
  { name: "星星塔", emoji: "⭐", color: "#F0E5FF", desc: "所有特殊泡泡一起来，终极挑战！", size: 16 },
  // ↓ 1.1 追加：四个新主题，合计 89 关
  { name: "倒影天湖", emoji: "🙃", color: "#D8EFF7", desc: "每消一组，重力就上下对调，泡泡改往天上飘！", size: 23 },
  { name: "幻彩溶洞", emoji: "🦎", color: "#E4F7E9", desc: "变色泡泡每消一组就换一种颜色，抓准时机！", size: 22 },
  { name: "步数栈桥", emoji: "🌉", color: "#FFEEDC", desc: "步数有限，先数一数再出手，一步都别浪费！", size: 22 },
  { name: "灯影迷宫", emoji: "🏮", color: "#F0E3F7", desc: "黑黑的泡泡要先点亮，才知道它是什么颜色！", size: 22 }
];

function buildLevel(ci: number, t: number): BubbleLevel {
  switch (ci) {
    case 0:
      return {
        rows: 8 + Math.floor(t / 6),
        colors: t < 6 ? 3 : 4,
        maxLeft: Math.max(6, 14 - Math.floor(t / 2)),
        rainbow: 0, stone: 0, bolt: 0, frozen: 0
      };
    case 1:
      return {
        rows: 9 + Math.floor(t / 8),
        colors: 4,
        maxLeft: Math.max(6, 13 - Math.floor(t / 2)),
        rainbow: 1 + Math.floor(t / 8), stone: 0, bolt: 0, frozen: 0
      };
    case 2: {
      const stone = 2 + Math.floor(t / 4);
      return {
        rows: 9 + Math.floor(t / 8),
        colors: 4,
        maxLeft: stone + Math.max(4, 12 - Math.floor(t / 2)),
        rainbow: 0, stone, bolt: 0, frozen: 0
      };
    }
    case 3:
      return {
        rows: 10,
        colors: t < 8 ? 4 : 5,
        maxLeft: Math.max(5, 12 - Math.floor(t / 2)),
        rainbow: 0, stone: 0, bolt: 1 + Math.floor(t / 6), frozen: 0
      };
    case 4:
      return {
        rows: 10,
        colors: t < 8 ? 4 : 5,
        maxLeft: Math.max(6, 14 - Math.floor(t / 2)),
        rainbow: 0, stone: 0, bolt: 0, frozen: 3 + Math.floor(t / 3)
      };
    case 5: {
      const stone = t >= 5 ? 2 : 0;
      return {
        rows: 10 + Math.floor(t / 8),
        colors: 5,
        maxLeft: stone + Math.max(4, 10 - Math.floor(t / 3)),
        rainbow: t % 2, stone, bolt: 1, frozen: 2 + Math.floor(t / 4)
      };
    }
    case 6:
      // 倒影天湖：重力翻转，泡泡一会儿往下掉一会儿往上飘
      return {
        rows: 9 + Math.floor(t / 10),
        colors: t < 8 ? 4 : 5,
        maxLeft: Math.max(6, 14 - Math.floor(t / 2)),
        rainbow: 0, stone: 0, bolt: 0, frozen: 0,
        flipGravity: true
      };
    case 7:
      // 幻彩溶洞：变色泡泡每步换色
      return {
        rows: 9,
        colors: t < 10 ? 4 : 5,
        maxLeft: Math.max(6, 13 - Math.floor(t / 2)),
        rainbow: t >= 16 ? 1 : 0, stone: 0, bolt: 0, frozen: 0,
        chameleon: 3 + Math.floor(t / 5)
      };
    case 8: {
      // 步数栈桥：步数上限 = 理论最少步数 + 逐关收紧的余量
      const rows = 9 + Math.floor(t / 8);
      const maxLeft = Math.max(8, 16 - Math.floor(t / 2));
      const minMoves = Math.ceil((rows * BOARD_COLS - maxLeft) / 2);
      return {
        rows,
        colors: 4,
        maxLeft,
        rainbow: 0, stone: 0, bolt: t >= 12 ? 1 : 0, frozen: 0,
        moveLimit: minMoves + 8 - Math.floor(t / 4)
      };
    }
    default:
      // 灯影迷宫：隐藏泡泡 + 少量老机关客串
      return {
        rows: 10,
        colors: t < 8 ? 4 : 5,
        maxLeft: Math.max(6, 12 - Math.floor(t / 3)),
        rainbow: 0, stone: 0, bolt: t >= 10 ? 1 : 0, frozen: t >= 16 ? 2 : 0,
        hidden: 6 + Math.floor(t / 2)
      };
  }
}

export const LEVELS: BubbleLevel[] = (() => {
  const out: BubbleLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
