/**
 * 泡泡噗噗 · 99 关关卡表。
 * 六个主题章节、六种泡泡机关（并非同一模板）：
 *  ①清泉湖=经典同色连消  ②彩虹湾=彩虹泡泡  ③石头滩=敲不破的石头
 *  ④闪电云=闪电泡泡清一行一列  ⑤冻冻港=冰冻泡泡两步消
 *  ⑥星星塔=全机关混合终极挑战
 */
import type { Chapter } from "../level99";

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
}

export const CHAPTERS: Chapter[] = [
  { name: "清泉湖", emoji: "🫧", color: "#DCF3FF", desc: "点破挨在一起的同色泡泡！", size: 17 },
  { name: "彩虹湾", emoji: "🌈", color: "#FFE9F6", desc: "彩虹泡泡一点，最多的颜色全消光！", size: 17 },
  { name: "石头滩", emoji: "🪨", color: "#EDEBE4", desc: "石头敲不破，绕开它们做计划！", size: 17 },
  { name: "闪电云", emoji: "⚡", color: "#FFF6D8", desc: "闪电泡泡能清掉整行整列！", size: 16 },
  { name: "冻冻港", emoji: "🧊", color: "#E4F2FF", desc: "冰冻泡泡要先在旁边消一次才解冻！", size: 16 },
  { name: "星星塔", emoji: "⭐", color: "#F0E5FF", desc: "所有特殊泡泡一起来，终极挑战！", size: 16 }
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
    default: {
      const stone = t >= 5 ? 2 : 0;
      return {
        rows: 10 + Math.floor(t / 8),
        colors: 5,
        maxLeft: stone + Math.max(4, 10 - Math.floor(t / 3)),
        rainbow: t % 2, stone, bolt: 1, frozen: 2 + Math.floor(t / 4)
      };
    }
  }
}

export const LEVELS: BubbleLevel[] = (() => {
  const out: BubbleLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

/**
 * 进关目标朗读（识字量有限的孩子靠听懂机关）。
 * 与画面小字提示同逻辑，用中文名字代替表情符号，纯函数便于测试。
 */
export function goalSpeechLine(cfg: BubbleLevel): string {
  const parts = [`点破挨在一起的同色泡泡，最后剩下不超过 ${cfg.maxLeft} 个就过关！`];
  if (cfg.rainbow > 0) parts.push("彩虹泡泡一点，就消掉最多的那种颜色！");
  if (cfg.stone > 0) parts.push("石头敲不破，绕开它！");
  if (cfg.bolt > 0) parts.push("闪电泡泡清掉一整行一整列！");
  if (cfg.frozen > 0) parts.push("冻住的泡泡，在它旁边消一次才解冻！");
  return parts.join("");
}
