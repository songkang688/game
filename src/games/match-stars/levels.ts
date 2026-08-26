/**
 * 星星消消乐 · 99 关关卡表。
 * 七个主题章节，每章引入不同机关，章节内难度渐进：
 *  ①糖果草原=纯收集  ②冰雪山谷=冰块  ③藤蔓森林=藤蔓
 *  ④彩虹果园=彩虹星  ⑤星夜城堡=冰+藤  ⑥糖霜云端=双目标+彩虹
 *  ⑦流星圣殿=全机关混合终极挑战
 * 关卡由确定性生成器产出（同一关每次进入参数一致），并非同一模板复制。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

export interface MatchGoal {
  token: number;
  count: number;
}

export interface MatchLevel {
  /** 使用的图案种类数（4..5） */
  colors: number;
  moves: number;
  goals: MatchGoal[];
  /** 冰块数量（旁边消除可敲开） */
  ice: number;
  /** 藤蔓数量（必须在藤蔓格上消除才能剪断） */
  vine: number;
  /** 是否会刷新出彩虹星（与相邻图案交换=清除全场该图案） */
  rainbow: boolean;
  /** 剩余步数 ≥ three 得 3 星，≥ two 得 2 星 */
  three: number;
  two: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "糖果草原", emoji: "🍬", color: "#FFE3F1", desc: "收集目标图案，步数省着用！", size: 15 },
  { name: "冰雪山谷", emoji: "🧊", color: "#DDF2FF", desc: "在冰块旁边消除，敲开所有冰块！", size: 14 },
  { name: "藤蔓森林", emoji: "🌿", color: "#DFF7DC", desc: "在藤蔓格子上消除，才能剪断藤蔓！", size: 14 },
  { name: "彩虹果园", emoji: "🌈", color: "#FFF3C4", desc: "彩虹星和谁交换，就消掉全场那种图案！", size: 14 },
  { name: "星夜城堡", emoji: "🌙", color: "#E6E0FF", desc: "冰块和藤蔓一起出现啦！", size: 14 },
  { name: "糖霜云端", emoji: "☁️", color: "#FFE8D1", desc: "三种收集目标加彩虹星，考验小计划！", size: 14 },
  { name: "流星圣殿", emoji: "☄️", color: "#FFD9E8", desc: "全部机关一起上，终极大挑战！", size: 14 }
];

function stars(moves: number): { three: number; two: number } {
  return {
    three: Math.max(3, Math.round(moves * 0.25)),
    two: Math.max(1, Math.round(moves * 0.1))
  };
}

/** t = 章节内序号（0 基），rand = 本关专属随机源 */
function buildLevel(ci: number, t: number, rand: () => number): MatchLevel {
  const pickTokens = (n: number, colors: number): number[] => {
    const pool = [0, 1, 2, 3, 4].slice(0, colors);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  };

  switch (ci) {
    case 0: {
      // 糖果草原：单/双收集目标，4 色起步
      const colors = t < 8 ? 4 : 5;
      const moves = 18 + Math.floor(t / 3) * 2;
      const nGoals = t < 5 ? 1 : 2;
      const goals = pickTokens(nGoals, colors).map((token) => ({
        token,
        count: 8 + t + randInt(rand, 0, 2)
      }));
      return { colors, moves, goals, ice: 0, vine: 0, rainbow: false, ...stars(moves) };
    }
    case 1: {
      // 冰雪山谷：冰块逐渐增多
      const colors = t < 7 ? 4 : 5;
      const moves = 20 + Math.floor(t / 4) * 2;
      const goals = pickTokens(1, colors).map((token) => ({ token, count: 10 + t }));
      return { colors, moves, goals, ice: 3 + Math.floor(t / 2), vine: 0, rainbow: false, ...stars(moves) };
    }
    case 2: {
      // 藤蔓森林：藤蔓逐渐增多，偶尔双目标
      const colors = 5;
      const moves = 22 + Math.floor(t / 4) * 2;
      const nGoals = t % 3 === 2 ? 2 : 1;
      const goals = pickTokens(nGoals, colors).map((token) => ({
        token,
        count: 9 + Math.floor(t / 2) + randInt(rand, 0, 2)
      }));
      return { colors, moves, goals, ice: 0, vine: 2 + Math.floor(t / 3), rainbow: false, ...stars(moves) };
    }
    case 3: {
      // 彩虹果园：彩虹星登场，收集量更大
      const colors = 5;
      const moves = 22 + Math.floor(t / 3);
      const goals = pickTokens(2, colors).map((token) => ({ token, count: 12 + t }));
      return { colors, moves, goals, ice: 0, vine: 0, rainbow: true, ...stars(moves) };
    }
    case 4: {
      // 星夜城堡：冰 + 藤混合
      const colors = 5;
      const moves = 24 + Math.floor(t / 4) * 2;
      const goals = pickTokens(1, colors).map((token) => ({ token, count: 12 + t }));
      return {
        colors, moves, goals,
        ice: 3 + Math.floor(t / 3),
        vine: 2 + Math.floor(t / 4),
        rainbow: false,
        ...stars(moves)
      };
    }
    case 5: {
      // 糖霜云端：三目标 + 彩虹星 + 少量冰
      const colors = 5;
      const moves = 26 + Math.floor(t / 4) * 2;
      const goals = pickTokens(3, colors).map((token) => ({ token, count: 8 + Math.floor(t / 2) }));
      return { colors, moves, goals, ice: t >= 7 ? 4 : 0, vine: 0, rainbow: true, ...stars(moves) };
    }
    default: {
      // 流星圣殿：全机关
      const colors = 5;
      const moves = 26 + Math.floor(t / 3) * 2;
      const goals = pickTokens(2, colors).map((token) => ({ token, count: 13 + t }));
      return {
        colors, moves, goals,
        ice: 4 + Math.floor(t / 5),
        vine: 3 + Math.floor(t / 6),
        rainbow: true,
        ...stars(moves)
      };
    }
  }
}

export const LEVELS: MatchLevel[] = (() => {
  const out: MatchLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) {
      out.push(buildLevel(ci, t, mulberry32(ci * 1000 + t * 7 + 5)));
    }
  });
  return out;
})();

/** 图案的中文名（与 index.ts 的 TOKENS 表情一一对应），朗读时用名字代替表情 */
export const TOKEN_NAMES = ["星星", "爱心", "四叶草", "月亮", "橘子"] as const;

/**
 * 进关目标朗读（识字量有限的孩子靠听懂目标与机关）。
 * 与画面小字提示同逻辑，纯函数便于测试。
 */
export function goalSpeechLine(cfg: MatchLevel): string {
  const goals = cfg.goals.map((g) => `${g.count} 个${TOKEN_NAMES[g.token]}`).join("、");
  const parts = [`用 ${cfg.moves} 步收集 ${goals}！`];
  if (cfg.ice > 0 && cfg.vine > 0) parts.push("冰块旁边消、藤蔓上面消，机关全清才过关！");
  else if (cfg.vine > 0) parts.push("在藤蔓格子上消除，才能剪断藤蔓！");
  else if (cfg.ice > 0) parts.push("在冰块上或旁边消除，就能敲开冰块！");
  else if (cfg.rainbow) parts.push("彩虹星和谁交换，就消掉全场那种图案！");
  return parts.join("");
}
