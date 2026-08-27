/**
 * 记忆翻翻乐 · 188 关关卡表（纯数据）。
 * 1.2 起，发牌 / 翻牌状态机 / 配对判定 / 计分都搬到了 `logic.ts`，这里只留关卡参数。
 *
 * 前 99 关是 1.0 的六个主题，生成参数一个字都没动；
 * 1.1 在末尾追加四个新主题（第 100–188 关）：
 *  ⑦算式配对屋=一张算式配一张得数  ⑧旋转木马厅=牌阵会整体转一格
 *  ⑨幻影干扰卡=混进没有同伴的独苗卡  ⑩星海终极厅=新老机关全混
 * 1.0 的六个主题章节、六种玩法机关（并非同一模板）：
 *  ①动物乐园=经典配对  ②水果集市=开局偷看+失误更紧
 *  ③海底世界=调皮章鱼换牌位  ④太空基地=三张一样才配对
 *  ⑤玩具小屋=倒计时挑战  ⑥魔法城堡=机关混合终极挑战
 */
import type { Chapter } from "../level99";

/** 1.0 的六个主题：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新主题从这里开始往后排） */
export const LEGACY_LEVELS = 99;

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
  /** 1.1 配对方式改成「算式 = 得数」，前 99 关不带 */
  mathPairs?: boolean;
  /** 1.1 算式难度档（0 加减、1 乘除口诀、2 两位数），前 99 关不带 */
  mathHard?: number;
  /** 1.1 每翻几张牌，整个牌阵就整体转一格；0 / 不写 = 不转，前 99 关不带 */
  rotateEvery?: number;
  /** 1.1 混进几张没有同伴的干扰卡，前 99 关不带 */
  decoys?: number;
  /** 1.2 会移动的牌：每隔这么多毫秒换两张扣着的牌的位置（换之前先预警），前 99 关不带 */
  swapEvery?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "动物乐园", emoji: "🐱", color: "#FFE9D6", desc: "翻开卡片，找到两只一样的小动物！", size: 17 },
  { name: "水果集市", emoji: "🍎", color: "#FFE3E3", desc: "开局偷看一眼，记住水果的位置！", size: 17 },
  { name: "海底世界", emoji: "🐠", color: "#D6F0FF", desc: "调皮章鱼会偷偷交换扣着的牌！", size: 17 },
  { name: "太空基地", emoji: "🚀", color: "#E6E0FF", desc: "三张一样的卡才能配成一组！", size: 16 },
  { name: "玩具小屋", emoji: "🧸", color: "#FFF3C4", desc: "倒计时开始，比比谁记得又快又准！", size: 16 },
  { name: "魔法城堡", emoji: "🏰", color: "#F3D9FF", desc: "偷看、章鱼、限时一起来，终极记忆挑战！", size: 16 },
  // ↓ 1.1 追加：四个新主题，合计 89 关
  { name: "算式配对屋", emoji: "🧮", color: "#E4F0FF", desc: "这里配对的是算式和它的得数，先算再翻！", size: 23 },
  { name: "旋转木马厅", emoji: "🎠", color: "#FFE7F2", desc: "每翻几张，整个牌阵就整体转一格，位置全变啦。", size: 22 },
  { name: "幻影干扰卡", emoji: "🌫️", color: "#EDE8F7", desc: "牌里混进了没有同伴的独苗卡，认出它别再碰。", size: 22 },
  { name: "星海终极厅", emoji: "🌌", color: "#DDE4F5", desc: "算式、旋转、独苗卡轮番上阵，终极记忆挑战！", size: 22 }
];

export const THEME_EMOJIS: string[][] = [
  ["🐱", "🐶", "🦊", "🐰", "🐼", "🦄", "🐸", "🐥", "🐷", "🐨", "🦁", "🐭"],
  ["🍎", "🍌", "🍇", "🍓", "🍑", "🍍", "🥝", "🍉", "🍒", "🍋", "🥕", "🌽"],
  ["🐠", "🐙", "🦀", "🐬", "🐳", "🦞", "🐚", "🐡", "🦈", "🐢", "🦐", "🪼"],
  ["🚀", "🛸", "👽", "🌟", "🪐", "🌙", "☄️", "🛰️", "🌍", "👨‍🚀", "🌈", "⚡"],
  ["🧸", "🪀", "🎈", "🎁", "🪁", "🎠", "🥁", "🎺", "🦖", "🎲", "🚂", "🪆"],
  ["🧙", "🔮", "✨", "🦄", "🐉", "🏰", "🪄", "⭐", "🗝️", "👑", "🎩", "🧚"],
  // ↓ 1.1 四套新表情（各 16 个，够铺「组 + 干扰卡」）
  ["🧮", "📐", "📏", "🔢", "💯", "🧾", "📊", "🗒️", "🖇️", "🧷", "🪙", "🎯", "🔟", "⏱️", "🧩", "📌"],
  ["🎠", "🎡", "🎢", "🎪", "🎈", "🍦", "🍭", "🎫", "🥁", "🪗", "🎺", "🎷", "🪘", "🎨", "🧁", "🍿"],
  ["🌫️", "💠", "🫧", "🪞", "🔮", "🕯️", "👻", "🪄", "🧿", "🕸️", "🦇", "🌙", "⭐", "☁️", "❄️", "🌊"],
  ["🌌", "🪐", "🚀", "🛸", "☄️", "💫", "🌠", "🔭", "👾", "🌑", "🌗", "🛰️", "⚛️", "🧊", "🌟", "🌈"]
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
    case 5: {
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
    case 6: {
      // 算式配对屋：一张写算式、一张写得数，算完再配对
      const pairs = 4 + Math.floor(t / 3);
      return {
        pairs, cols: pairs >= 9 ? 5 : 4,
        maxMiss: pairs + 6, imp: 0,
        peekMs: t < 6 ? 2200 : 0,
        matchSize: 2, timeLimit: 0, theme: 6,
        mathPairs: true,
        mathHard: t < 8 ? 0 : t < 16 ? 1 : 2
      };
    }
    case 7: {
      // 旋转木马厅：牌阵每隔几张翻牌就整体转一格
      const pairs = 5 + Math.floor(t / 3);
      return {
        pairs, cols: pairs >= 10 ? 5 : 4,
        maxMiss: pairs * 2 + 2, imp: 0,
        peekMs: t < 5 ? 1800 : 0,
        matchSize: 2, timeLimit: 0, theme: 7,
        rotateEvery: Math.max(4, 7 - Math.floor(t / 7))
      };
    }
    case 8: {
      // 幻影干扰卡：独苗卡越来越多
      const pairs = 5 + Math.floor(t / 3);
      const decoys = 1 + Math.floor(t / 7);
      return {
        pairs, cols: pairs >= 10 ? 5 : 4,
        maxMiss: pairs + decoys + 6, imp: 0, peekMs: 0,
        matchSize: 2, timeLimit: 0, theme: 8,
        decoys,
        // 1.2 后半章的牌自己会挪窝，换之前会先亮一下预警
        ...(t >= 14 ? { swapEvery: 10000 } : {})
      };
    }
    default: {
      // 星海终极厅：三连 / 算式 / 独苗+旋转 三种收尾轮着来
      const mode = t % 3;
      if (mode === 0) {
        const pairs = 4 + Math.floor(t / 6);
        return {
          pairs, cols: 4,
          maxMiss: pairs * 3 + 6, imp: 0, peekMs: 0,
          matchSize: 3, timeLimit: 0, theme: 9,
          rotateEvery: 8
        };
      }
      if (mode === 1) {
        const pairs = 6 + Math.floor(t / 5);
        return {
          pairs, cols: pairs >= 10 ? 5 : 4,
          maxMiss: pairs + 8, imp: 0, peekMs: 0,
          matchSize: 2, timeLimit: 0, theme: 9,
          mathPairs: true,
          mathHard: 2,
          decoys: 1 + Math.floor(t / 12)
        };
      }
      const pairs = 6 + Math.floor(t / 5);
      const decoys = 2 + Math.floor(t / 9);
      return {
        pairs, cols: pairs >= 10 ? 5 : 4,
        maxMiss: pairs + decoys + 8, imp: t >= 14 ? 4 : 0, peekMs: 1400,
        matchSize: 2, timeLimit: 0, theme: 9,
        rotateEvery: 6,
        decoys,
        // 1.2 终极厅：牌阵会转，单张牌还会自己挪窝
        ...(t >= 8 ? { swapEvery: 10000 } : {})
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
