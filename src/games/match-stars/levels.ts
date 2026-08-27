/**
 * 星星消消乐 · 188 关关卡表。
 * 前 99 关是 1.0 的七个主题，生成参数一个字都没动；
 * 1.1 在末尾追加四个新主题（第 100–188 关）：
 *  ⑧订单甜品铺=按订单消出指定组合  ⑨传送带工厂=整行会循环平移
 *  ⑩双层糖霜=一格糖霜要消两次      ⑪云顶石巨人=先敲掉护甲才过关
 * 1.0 的七个主题章节，每章引入不同机关，章节内难度渐进：
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

/** 1.1 订单：要求消出指定的「大场面」，一步最多记一笔 */
export type MatchOrderKind = "big4" | "big5" | "chain2" | "chain3";

export interface MatchOrder {
  kind: MatchOrderKind;
  count: number;
}

/** 1.1 传送带：这一行每走完一步就循环平移一格 */
export interface MatchBelt {
  row: number;
  /** 1 = 往右转，-1 = 往左转 */
  dir: 1 | -1;
}

/** 1.1 石巨人：护甲要靠消掉指定图案一层层敲掉 */
export interface MatchBoss {
  /** 敲护甲用的图案 */
  token: number;
  armor: number;
  /** 每隔几步它会冻住一颗星星捣乱 */
  roarEvery: number;
}

/** 1.0 的七个主题：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [15, 14, 14, 14, 14, 14, 14];
/** 1.0 的总关数（新主题从这里开始往后排） */
export const LEGACY_LEVELS = 99;

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
  /** 1.1 订单清单，前 99 关不带 */
  orders?: MatchOrder[];
  /** 1.1 传送带行，前 99 关不带 */
  belts?: MatchBelt[];
  /** 1.1 铺糖霜的格子数，前 99 关不带 */
  frost?: number;
  /** 1.1 每格糖霜几层（1..2），前 99 关不带 */
  frostLayers?: number;
  /** 1.1 石巨人，前 99 关不带 */
  boss?: MatchBoss;
  /**
   * 1.2 挡板数量：挡板挡住下落，上面的星星落不下来、底下也补不进新块，
   * 得先在它旁边消一次把它敲掉。只出现在末章尾段，前 99 关不带。
   */
  blockers?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "糖果草原", emoji: "🍬", color: "#FFE3F1", desc: "收集目标图案，步数省着用！", size: 15 },
  { name: "冰雪山谷", emoji: "🧊", color: "#DDF2FF", desc: "在冰块旁边消除，敲开所有冰块！", size: 14 },
  { name: "藤蔓森林", emoji: "🌿", color: "#DFF7DC", desc: "在藤蔓格子上消除，才能剪断藤蔓！", size: 14 },
  { name: "彩虹果园", emoji: "🌈", color: "#FFF3C4", desc: "彩虹星和谁交换，就消掉全场那种图案！", size: 14 },
  { name: "星夜城堡", emoji: "🌙", color: "#E6E0FF", desc: "冰块和藤蔓一起出现啦！", size: 14 },
  { name: "糖霜云端", emoji: "☁️", color: "#FFE8D1", desc: "三种收集目标加彩虹星，考验小计划！", size: 14 },
  { name: "流星圣殿", emoji: "☄️", color: "#FFD9E8", desc: "全部机关一起上，终极大挑战！", size: 14 },
  // ↓ 1.1 追加：四个新主题，合计 89 关
  { name: "订单甜品铺", emoji: "🧁", color: "#FFEFD6", desc: "客人点单啦：要一次消出四颗以上，还要连锁！", size: 23 },
  { name: "传送带工厂", emoji: "🏭", color: "#E1EEF7", desc: "每走一步，传送带那几行就整排平移一格。", size: 22 },
  { name: "双层糖霜", emoji: "🍥", color: "#FFE6F0", desc: "盖着糖霜的格子要在上面消两次才刮干净。", size: 22 },
  { name: "云顶石巨人", emoji: "🗿", color: "#E4E9E0", desc: "石巨人披着护甲，末尾还会搬挡板拦住下落，先敲挡板再砸护甲。", size: 22 }
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
    case 6: {
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
    case 7: {
      // 订单甜品铺：客人点单，要求消出「大场面」
      const colors = 5;
      const moves = 24 + Math.floor(t / 3) * 2;
      const goals = pickTokens(1, colors).map((token) => ({ token, count: 14 + t }));
      const orders: MatchOrder[] = [{ kind: "big4", count: 2 + Math.floor(t / 4) }];
      if (t >= 8) orders.push({ kind: "chain2", count: 1 + Math.floor((t - 8) / 6) });
      if (t >= 16) orders.push({ kind: "big5", count: 1 + Math.floor((t - 16) / 5) });
      return { colors, moves, goals, ice: 0, vine: 0, rainbow: t >= 12, orders, ...stars(moves) };
    }
    case 8: {
      // 传送带工厂：一到两条传送带，转向轮着来
      const colors = 5;
      const moves = 24 + Math.floor(t / 3) * 2;
      const goals = pickTokens(t < 10 ? 1 : 2, colors).map((token) => ({ token, count: 14 + Math.floor(t / 2) }));
      const belts: MatchBelt[] = [{ row: 3 + (t % 3), dir: t % 2 === 0 ? 1 : -1 }];
      if (t >= 9) belts.push({ row: 1 + (t % 2), dir: t % 2 === 0 ? -1 : 1 });
      return { colors, moves, goals, ice: t >= 14 ? 3 : 0, vine: 0, rainbow: false, belts, ...stars(moves) };
    }
    case 9: {
      // 双层糖霜：糖霜格越来越多，后半章加厚到两层
      const colors = 5;
      const moves = 28 + Math.floor(t / 3) * 2;
      const goals = pickTokens(1, colors).map((token) => ({ token, count: 13 + Math.floor(t / 2) }));
      const layers = t < 11 ? 1 : 2;
      return {
        colors, moves, goals,
        ice: 0, vine: t >= 15 ? 2 : 0, rainbow: t >= 8,
        frost: 5 + Math.floor(t / 3),
        frostLayers: layers,
        ...stars(moves)
      };
    }
    default: {
      // 云顶石巨人：护甲越来越厚，咆哮越来越勤，末段把糖霜、传送带和挡板一起请回来
      const colors = 5;
      const moves = 26 + Math.floor(t / 3) * 2;
      const tokens = pickTokens(2, colors);
      const goals = [{ token: tokens[1], count: 12 + Math.floor(t / 2) }];
      const boss: MatchBoss = {
        token: tokens[0],
        armor: 18 + t,
        roarEvery: Math.max(3, 6 - Math.floor(t / 8))
      };
      return {
        colors, moves, goals,
        ice: 0, vine: 0, rainbow: true,
        boss,
        frost: t >= 11 ? 4 : undefined,
        frostLayers: t >= 11 ? 1 : undefined,
        belts: t >= 17 ? [{ row: 4, dir: 1 }] : undefined,
        // 1.2 新机制：末尾八关放挡板，逼着孩子先想「怎么让上面的星星掉下来」
        blockers: t >= 14 ? 2 + Math.floor((t - 14) / 4) : undefined,
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

/** 订单的中文说明（面板与攻略共用） */
export function orderLabel(order: MatchOrder): string {
  const what =
    order.kind === "big4" ? "一次消掉 4 颗以上"
      : order.kind === "big5" ? "一次消掉 5 颗以上"
        : order.kind === "chain2" ? "连锁 2 次"
          : "连锁 3 次";
  return `${what} ×${order.count}`;
}

/** 本关的棋盘种子：同一关每次进入的初始牌面一致 */
export function boardSeed(level: number): number {
  return level * 4517 + 971;
}
