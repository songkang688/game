/**
 * 记忆翻翻乐 · 99 关关卡表。
 * 六个主题章节、六种玩法机关（并非同一模板）：
 *  ①动物乐园=经典配对  ②水果集市=开局偷看+失误更紧
 *  ③海底世界=调皮章鱼换牌位  ④太空基地=三张一样才配对
 *  ⑤玩具小屋=倒计时挑战  ⑥魔法城堡=机关混合终极挑战
 */
import type { Chapter } from "../level99";

export interface MemoryLevel {
  /** 需要配成的组数 */
  pairs: number;
  cols: number;
  /** 允许翻错次数（超过就重试本关） */
  maxMiss: number;
  /** 每翻错 imp 次，交换两张扣着的牌；0 = 无 */
  imp: number;
  /** 开局偷看毫秒数；0 = 不偷看 */
  peekMs: number;
  /** 一组几张（2 = 对对碰，3 = 三连卡） */
  matchSize: 2 | 3;
  /** 倒计时秒数；0 = 不限时 */
  timeLimit: number;
  /** 用第几套主题表情 */
  theme: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "动物乐园", emoji: "🐱", color: "#FFE9D6", desc: "翻开卡片，找到两只一样的小动物！", size: 17 },
  { name: "水果集市", emoji: "🍎", color: "#FFE3E3", desc: "开局偷看一眼，记住水果的位置！", size: 17 },
  { name: "海底世界", emoji: "🐠", color: "#D6F0FF", desc: "调皮章鱼会偷偷交换扣着的牌！", size: 17 },
  { name: "太空基地", emoji: "🚀", color: "#E6E0FF", desc: "三张一样的卡才能配成一组！", size: 16 },
  { name: "玩具小屋", emoji: "🧸", color: "#FFF3C4", desc: "倒计时开始，比比谁记得又快又准！", size: 16 },
  { name: "魔法城堡", emoji: "🏰", color: "#F3D9FF", desc: "偷看、章鱼、限时一起来，终极记忆挑战！", size: 16 }
];

export const THEME_EMOJIS: string[][] = [
  ["🐱", "🐶", "🦊", "🐰", "🐼", "🦄", "🐸", "🐥", "🐷", "🐨", "🦁", "🐭"],
  ["🍎", "🍌", "🍇", "🍓", "🍑", "🍍", "🥝", "🍉", "🍒", "🍋", "🥕", "🌽"],
  ["🐠", "🐙", "🦀", "🐬", "🐳", "🦞", "🐚", "🐡", "🦈", "🐢", "🦐", "🪼"],
  ["🚀", "🛸", "👽", "🌟", "🪐", "🌙", "☄️", "🛰️", "🌍", "👨‍🚀", "🌈", "⚡"],
  ["🧸", "🪀", "🎈", "🎁", "🪁", "🎠", "🥁", "🎺", "🦖", "🎲", "🚂", "🪆"],
  ["🧙", "🔮", "✨", "🦄", "🐉", "🏰", "🪄", "⭐", "🗝️", "👑", "🎩", "🧚"]
];

function buildLevel(ci: number, t: number): MemoryLevel {
  switch (ci) {
    case 0: {
      // 动物乐园：3 → 10 对，失误宽松
      const pairs = 3 + Math.floor(t / 2.5);
      return {
        pairs, cols: pairs <= 4 ? 3 : 4,
        maxMiss: pairs * 2 + 2, imp: 0, peekMs: 0, matchSize: 2, timeLimit: 0, theme: 0
      };
    }
    case 1: {
      // 水果集市：偷看时间越来越短，失误预算更紧
      const pairs = 4 + Math.floor(t / 2.5);
      return {
        pairs, cols: 4,
        maxMiss: pairs + 3, imp: 0,
        peekMs: Math.max(1200, 3200 - t * 130),
        matchSize: 2, timeLimit: 0, theme: 1
      };
    }
    case 2: {
      // 海底世界：章鱼越来越勤快
      const pairs = 5 + Math.floor(t / 3);
      return {
        pairs, cols: 4,
        maxMiss: pairs * 2, imp: Math.max(2, 4 - Math.floor(t / 6)),
        peekMs: 0, matchSize: 2, timeLimit: 0, theme: 2
      };
    }
    case 3: {
      // 太空基地：三连卡，组数少但更烧脑
      const pairs = 3 + Math.floor(t / 4);
      return {
        pairs, cols: pairs <= 4 ? 3 : 4,
        maxMiss: pairs * 3 + 4, imp: 0, peekMs: 0, matchSize: 3, timeLimit: 0, theme: 3
      };
    }
    case 4: {
      // 玩具小屋：限时挑战
      const pairs = 5 + Math.floor(t / 3);
      return {
        pairs, cols: 4,
        maxMiss: pairs * 2 + 2, imp: 0, peekMs: 0, matchSize: 2,
        timeLimit: 30 + pairs * 6 - t, theme: 4
      };
    }
    default: {
      // 魔法城堡：偷看 + 章鱼 + 限时轮流混合
      const pairs = 6 + Math.floor(t / 3);
      const mode = t % 3;
      return {
        pairs, cols: pairs >= 9 ? 5 : 4,
        maxMiss: pairs + 4,
        imp: mode === 1 ? 3 : 0,
        peekMs: mode === 0 ? 1600 : 0,
        matchSize: 2,
        timeLimit: mode === 2 ? 26 + pairs * 5 : 0,
        theme: 5
      };
    }
  }
}

export const LEVELS: MemoryLevel[] = (() => {
  const out: MemoryLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

/**
 * 进关目标朗读（识字量有限的孩子靠听懂规则与机关）。
 * 与画面小字提示同逻辑，纯函数便于测试。
 */
export function goalSpeechLine(cfg: MemoryLevel): string {
  const parts = [
    cfg.matchSize === 3
      ? `翻开卡片，找到三张一样的才算一组，配齐 ${cfg.pairs} 组！`
      : `翻开卡片，找到两张一样的配成一对，配齐 ${cfg.pairs} 对！`
  ];
  if (cfg.peekMs > 0) parts.push("开局先偷看一下，快记住它们的位置！");
  if (cfg.imp > 0) parts.push("小心调皮章鱼会偷偷换牌！");
  if (cfg.timeLimit > 0) parts.push(`要在 ${cfg.timeLimit} 秒内完成哦！`);
  return parts.join("");
}
