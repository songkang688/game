/**
 * 连连看 · 99 关关卡表。
 * 六个主题章节，各有专属图案与玩法（并非同一模板）：
 *  ①果园入门=经典静止棋盘  ②萌宠动物园=棋盘更大
 *  ③玩具馆=消一对就下落  ④海洋馆=消一对向左滑
 *  ⑤星光夜市=时间紧+洗牌少  ⑥彩虹广场=大棋盘+重力混合
 */
import type { Chapter } from "../level99";

export type Gravity = "none" | "down" | "left";

export interface LlkLevel {
  rows: number;
  cols: number;
  kinds: number;
  seconds: number;
  shuffles: number;
  gravity: Gravity;
  /** 用第几套主题图案 */
  theme: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "果园入门", emoji: "🍎", color: "#FFE9DD", desc: "两个一样的图案，拐弯不超过两次就能连！", size: 17 },
  { name: "萌宠动物园", emoji: "🐻", color: "#FFF3CE", desc: "棋盘变大了，小动物等你来连！", size: 17 },
  { name: "玩具馆", emoji: "🧸", color: "#EBDDFB", desc: "新玩法：消掉一对，上面的玩具会掉下来！", size: 17 },
  { name: "海洋馆", emoji: "🐠", color: "#D6F0FF", desc: "新玩法：消掉一对，右边的鱼儿向左游！", size: 16 },
  { name: "星光夜市", emoji: "🌟", color: "#FFE0EC", desc: "时间更紧、洗牌更少，考验眼力！", size: 16 },
  { name: "彩虹广场", emoji: "🌈", color: "#E2F7DF", desc: "大棋盘加重力变化，终极连连挑战！", size: 16 }
];

export const THEME_EMOJIS: string[][] = [
  ["🍎", "🍌", "🍇", "🍓", "🍑", "🍍", "🥝", "🍉", "🍒", "🍋", "🍊", "🫐", "🍈", "🥭"],
  ["🐱", "🐶", "🦊", "🐰", "🐼", "🐨", "🦁", "🐸", "🐥", "🐷", "🐭", "🐻", "🐹", "🦉"],
  ["🧸", "🪀", "🎈", "🎁", "🪁", "🎠", "🥁", "🎺", "🦖", "🎲", "🚂", "🪆", "🎪", "🎨"],
  ["🐠", "🐙", "🦀", "🐬", "🐳", "🦞", "🐚", "🐡", "🦈", "🐢", "🦐", "🪸", "🐟", "🦑"],
  ["🌟", "🌙", "🎇", "🏮", "🍭", "🍡", "🧋", "🍿", "🎡", "🎢", "🌃", "🎑", "🍧", "🥠"],
  ["🌈", "🌸", "⭐", "🚗", "🎈", "🦄", "🍀", "🌻", "🦋", "🐞", "🍄", "🌼", "☂️", "🎀"]
];

function buildLevel(ci: number, t: number): LlkLevel {
  switch (ci) {
    case 0:
      return {
        rows: 4, cols: t < 8 ? 4 : 6,
        kinds: 6 + Math.floor(t / 4),
        seconds: 90 + Math.floor(t / 4) * 10,
        shuffles: 3, gravity: "none", theme: 0
      };
    case 1:
      return {
        rows: 5 + Math.floor(t / 9), cols: 6,
        kinds: 8 + Math.floor(t / 4),
        seconds: 130 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "none", theme: 1
      };
    case 2:
      return {
        rows: 5 + Math.floor(t / 9), cols: 6,
        kinds: 8 + Math.floor(t / 4),
        seconds: 150 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "down", theme: 2
      };
    case 3:
      return {
        rows: 6, cols: 6 + (t >= 10 ? 2 : 0),
        kinds: 9 + Math.floor(t / 4),
        seconds: 160 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "left", theme: 3
      };
    case 4:
      return {
        rows: 6, cols: 8,
        kinds: 10 + Math.floor(t / 4),
        seconds: 150 + Math.floor(t / 4) * 10,
        shuffles: 2, gravity: "none", theme: 4
      };
    default: {
      const gravity: Gravity = t % 3 === 0 ? "none" : t % 3 === 1 ? "down" : "left";
      return {
        rows: 6 + Math.floor(t / 8), cols: 8,
        kinds: 12 + Math.floor(t / 6),
        seconds: 180 + Math.floor(t / 3) * 10,
        shuffles: 2, gravity, theme: 5
      };
    }
  }
}

export const LEVELS: LlkLevel[] = (() => {
  const out: LlkLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
