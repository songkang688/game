/**
 * 拼图乐园 · 99 关关卡表。
 * 六个主题画册、四种拼图板式（并非同一模板）：
 *  ①花园画册=3×3 入门  ②动物画册=3×3 打乱更狠
 *  ③交通画册=4×3 长条拼图  ④水果派对=记忆拼图（看一眼就藏起来）
 *  ⑤星空画册=4×4 大拼图  ⑥彩虹大画展=大板+记忆混合终极挑战
 */
import type { Chapter } from "../level99";

export interface PuzzleLevel {
  rows: number;
  cols: number;
  shuffleSteps: number;
  moveLimit: number;
  hints: number;
  /** 记忆模式：完整图案只在开局展示几秒 */
  hidePreview: boolean;
  theme: number;
  /** 步数 ≤ three 得 3 星，≤ two 得 2 星 */
  three: number;
  two: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "花园画册", emoji: "🌸", color: "#FFE3F1", desc: "把花园图案推回原位！", size: 17 },
  { name: "动物画册", emoji: "🐱", color: "#FFE9D6", desc: "小动物们被打乱得更厉害啦！", size: 17 },
  { name: "交通画册", emoji: "🚗", color: "#D6EBFF", desc: "4×3 长条拼图，格子更多啦！", size: 17 },
  { name: "水果派对", emoji: "🍓", color: "#FFE0E0", desc: "记忆拼图：完整图案只给你看一小会儿！", size: 16 },
  { name: "星空画册", emoji: "🌟", color: "#E6E0FF", desc: "4×4 大拼图，星空等你复原！", size: 16 },
  { name: "彩虹大画展", emoji: "🌈", color: "#E2F7DF", desc: "大拼图+记忆模式，终极画展！", size: 16 }
];

export const THEME_TILES: Array<Array<{ emoji: string; bg: string }>> = [
  [
    { emoji: "🌸", bg: "#FFD9E8" }, { emoji: "🌞", bg: "#FFF1BD" }, { emoji: "🌈", bg: "#D9F1FF" },
    { emoji: "🍎", bg: "#FFDCD2" }, { emoji: "🐝", bg: "#FDF3C7" }, { emoji: "🍀", bg: "#D9F5D3" },
    { emoji: "⛵", bg: "#D5EAFB" }, { emoji: "🎈", bg: "#F3DBFF" }, { emoji: "🌷", bg: "#FFDDF0" },
    { emoji: "🦋", bg: "#DCEFFF" }, { emoji: "🍄", bg: "#FFE4DA" }, { emoji: "🌻", bg: "#FFF4C2" },
    { emoji: "🐞", bg: "#FFDBDB" }, { emoji: "🌿", bg: "#DDF3D5" }, { emoji: "💧", bg: "#D8EFFB" }
  ],
  [
    { emoji: "🐱", bg: "#FFE8CE" }, { emoji: "🐶", bg: "#EDE1D1" }, { emoji: "🐰", bg: "#FFE3EE" },
    { emoji: "🦊", bg: "#FFD9BE" }, { emoji: "🐼", bg: "#E8E8E8" }, { emoji: "🐸", bg: "#DDF5D0" },
    { emoji: "🐥", bg: "#FFF6C4" }, { emoji: "🐙", bg: "#F4DBF0" }, { emoji: "🐨", bg: "#E3E9EE" },
    { emoji: "🦁", bg: "#FFE8B8" }, { emoji: "🐹", bg: "#FFE9D9" }, { emoji: "🐢", bg: "#DDEED2" },
    { emoji: "🦉", bg: "#E8DFD2" }, { emoji: "🐷", bg: "#FFE0E8" }, { emoji: "🦄", bg: "#F3E3FA" }
  ],
  [
    { emoji: "🚗", bg: "#FFDBDB" }, { emoji: "🚌", bg: "#FFF0C0" }, { emoji: "🚀", bg: "#E1E7FF" },
    { emoji: "🚁", bg: "#D8F2F8" }, { emoji: "🚂", bg: "#E6DCCB" }, { emoji: "⛵", bg: "#D5EAFB" },
    { emoji: "🚲", bg: "#E0F5DC" }, { emoji: "🛸", bg: "#EFE0FA" }, { emoji: "🚜", bg: "#E8EED2" },
    { emoji: "🚒", bg: "#FFDCD2" }, { emoji: "🚕", bg: "#FFF3C2" }, { emoji: "🛶", bg: "#DDEFF5" },
    { emoji: "🚠", bg: "#E4E8F5" }, { emoji: "🛴", bg: "#E2F2E4" }, { emoji: "🚤", bg: "#D8EDF8" }
  ],
  [
    { emoji: "🍓", bg: "#FFDDE4" }, { emoji: "🍌", bg: "#FFF6BF" }, { emoji: "🍇", bg: "#EBDCF8" },
    { emoji: "🍉", bg: "#FFE0DA" }, { emoji: "🍑", bg: "#FFE9D4" }, { emoji: "🍍", bg: "#FBF0C0" },
    { emoji: "🥝", bg: "#E1F3D2" }, { emoji: "🍒", bg: "#FFD9DE" }, { emoji: "🍊", bg: "#FFE7C8" },
    { emoji: "🍋", bg: "#FDF7C0" }, { emoji: "🫐", bg: "#E0E4F8" }, { emoji: "🍈", bg: "#E8F3D8" },
    { emoji: "🥭", bg: "#FFEBC4" }, { emoji: "🍐", bg: "#EAF3D0" }, { emoji: "🍅", bg: "#FFE0D6" }
  ],
  [
    { emoji: "🌟", bg: "#FFF3C4" }, { emoji: "🌙", bg: "#DCE9FF" }, { emoji: "☀️", bg: "#FFEDB8" },
    { emoji: "☁️", bg: "#EAF2FA" }, { emoji: "🌍", bg: "#D8EFDC" }, { emoji: "⚡", bg: "#FFF2C8" },
    { emoji: "❄️", bg: "#E0F3FF" }, { emoji: "🌋", bg: "#FFDFD0" }, { emoji: "🪐", bg: "#EFE3D2" },
    { emoji: "☄️", bg: "#FFE6CC" }, { emoji: "🌊", bg: "#D5ECFA" }, { emoji: "🌪️", bg: "#E5E9EE" },
    { emoji: "🌠", bg: "#E3E0F8" }, { emoji: "🌫️", bg: "#EAEEF2" }, { emoji: "🌌", bg: "#DCD8F0" }
  ],
  [
    { emoji: "🌈", bg: "#E7F5E4" }, { emoji: "🎨", bg: "#FFE9F0" }, { emoji: "🎪", bg: "#FFE4DA" },
    { emoji: "🎡", bg: "#E0EEFA" }, { emoji: "🎠", bg: "#F5E3F5" }, { emoji: "🎢", bg: "#E2F0E0" },
    { emoji: "🎁", bg: "#FFE1E8" }, { emoji: "🎀", bg: "#FFDDEE" }, { emoji: "🧁", bg: "#FBEBD8" },
    { emoji: "🍭", bg: "#F3E1F8" }, { emoji: "🎂", bg: "#FFE9DC" }, { emoji: "🪅", bg: "#EAE4F8" },
    { emoji: "🎊", bg: "#F8F0D8" }, { emoji: "🎉", bg: "#FFE6D2" }, { emoji: "🥳", bg: "#FFF0C8" }
  ]
];

function stars(shuffleSteps: number): { three: number; two: number } {
  return { three: Math.max(10, shuffleSteps * 2), two: Math.max(20, Math.round(shuffleSteps * 3.5)) };
}

function buildLevel(ci: number, t: number): PuzzleLevel {
  switch (ci) {
    case 0: {
      const shuffleSteps = 8 + t * 3;
      return {
        rows: 3, cols: 3, shuffleSteps,
        moveLimit: Math.max(50, shuffleSteps * 6), hints: 3,
        hidePreview: false, theme: 0, ...stars(shuffleSteps)
      };
    }
    case 1: {
      const shuffleSteps = 30 + t * 4;
      return {
        rows: 3, cols: 3, shuffleSteps,
        moveLimit: Math.max(70, shuffleSteps * 5), hints: 3,
        hidePreview: false, theme: 1, ...stars(shuffleSteps)
      };
    }
    case 2: {
      const shuffleSteps = 24 + t * 4;
      return {
        rows: 3, cols: 4, shuffleSteps,
        moveLimit: Math.max(80, shuffleSteps * 6), hints: 3,
        hidePreview: false, theme: 2, ...stars(shuffleSteps)
      };
    }
    case 3: {
      const shuffleSteps = 16 + t * 3;
      return {
        rows: 3, cols: 3, shuffleSteps,
        moveLimit: Math.max(60, shuffleSteps * 6), hints: 4,
        hidePreview: true, theme: 3, ...stars(shuffleSteps)
      };
    }
    case 4: {
      const shuffleSteps = 30 + t * 5;
      return {
        rows: 4, cols: 4, shuffleSteps,
        moveLimit: Math.max(110, shuffleSteps * 6), hints: 4,
        hidePreview: false, theme: 4, ...stars(shuffleSteps)
      };
    }
    default: {
      const shuffleSteps = 40 + t * 5;
      const big = t % 2 === 1;
      return {
        rows: big ? 4 : 3, cols: 4, shuffleSteps,
        moveLimit: Math.max(120, shuffleSteps * 6), hints: 4,
        hidePreview: t % 3 === 2, theme: 5, ...stars(shuffleSteps)
      };
    }
  }
}

export const LEVELS: PuzzleLevel[] = (() => {
  const out: PuzzleLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
