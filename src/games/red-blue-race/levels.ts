/**
 * 红蓝赛跑 · 188 关关卡表。
 *
 * 1.0 的前 99 关（六个主题赛道、四种赛道机关）一字未改：
 *  ①操场直道=纯拼手速  ②水坑赛道=跳过水坑不打滑  ③跨栏赛场=跨栏要起跳
 *  ④上坡森林=上坡段每步变短  ⑤夜跑霓虹=踩到星星就冲刺  ⑥冠军巡回=全机关混合
 *
 * 1.1 在末尾追加 89 关、4 个全新章节，各带一种前 99 关没有的对抗机制：
 *  ⑦云顶接力=体力条（连点会喘）  ⑧拾光集市=道具抢夺（礼物箱谁先到谁拿）
 *  ⑨节拍风廊=节拍连击（踩鼓点才有加成）  ⑩决胜星轨=读招电脑（你领先它就发力）
 *
 * 跑道长 100，机关位置由确定性生成器排布。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

export const TRACK_LEN = 100;

/** `item` 是 1.1 新增的礼物箱：谁先冲到谁拿走，自己加速、对手打滑 */
export type ObstacleType = "puddle" | "hurdle" | "hill" | "star" | "item";

export interface Obstacle {
  type: ObstacleType;
  /** 起点位置（0..100） */
  pos: number;
  /** 区间长度（hill 用，其他为 4） */
  len: number;
}

export interface RaceLevel {
  /** 电脑速度（每秒跑多少格） */
  aiSpeed: number;
  /** 玩家每次点击前进的格数 */
  tapStep: number;
  obstacles: Obstacle[];
  theme: number;
  /** 1.1 新增 · 体力上限（每点一下耗 1 点）；0 / 省略表示这一关不启用体力条 */
  stamina?: number;
  /** 1.1 新增 · 体力每秒回复量，只在启用体力条时有意义 */
  staminaRegen?: number;
  /** 1.1 新增 · 节拍鼓点间隔（毫秒）；0 / 省略表示这一关不启用节拍连击 */
  beatMs?: number;
  /** 1.1 新增 · 连击层数上限，每层给一点步长加成 */
  comboMax?: number;
  /** 1.1 新增 · 读招强度 0..1：你领先越多，小电脑追得越凶；0 / 省略表示匀速 */
  aiAdapt?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "操场直道", emoji: "🏃", color: "#DFF3D5", desc: "狂点按钮往前冲，比小电脑先到终点！", size: 17 },
  { name: "水坑赛道", emoji: "💧", color: "#D6EBFF", desc: "看到水坑提前跳，踩进去会打滑！", size: 17 },
  { name: "跨栏赛场", emoji: "🚧", color: "#FFE9D6", desc: "跨栏挡路，起跳才能越过去！", size: 17 },
  { name: "上坡森林", emoji: "⛰️", color: "#E4EFD8", desc: "上坡路每一步都变短，要更用力！", size: 16 },
  { name: "夜跑霓虹", emoji: "🌃", color: "#E3DFF5", desc: "踩到 ⭐ 就自动向前冲刺一大段！", size: 16 },
  { name: "冠军巡回", emoji: "🏆", color: "#FFF3C4", desc: "水坑跨栏上坡全都有，冠军之战！", size: 16 },
  // ---- 1.1 追加的 89 关：四个全新章节，各带一种前 99 关没有的对抗机制 ----
  { name: "云顶接力", emoji: "☁️", color: "#E6EEFF", desc: "连点会喘气，看着体力条松手换气再冲刺！", size: 23 },
  { name: "拾光集市", emoji: "🎁", color: "#FFE7F2", desc: "赛道上的礼物箱谁先冲到就归谁，抢到能甩开对手！", size: 22 },
  { name: "节拍风廊", emoji: "🎵", color: "#DFF3EC", desc: "踩着鼓点稳稳地点，连击接得越长步子越大！", size: 22 },
  { name: "决胜星轨", emoji: "🌠", color: "#E8DFF7", desc: "小电脑会读招：你一领先它就发力，全机关混战！", size: 22 }
];

/** 在 [20, 88] 之间排 n 个互不重叠的机关位置 */
function spread(n: number, rand: () => number): number[] {
  const out: number[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const p = randInt(rand, 20, 88);
    if (out.every((q) => Math.abs(q - p) >= 12)) out.push(p);
  }
  return out.sort((a, b) => a - b);
}

/**
 * 1.1 新章专用的机关排布：在 [16, maxPos] 之间排 n 个至少相隔 10 的位置。
 * 前 99 关继续用上面的 `spread`，一个数都不动。
 */
function spreadWide(n: number, rand: () => number, maxPos: number): number[] {
  const out: number[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 300) {
    const p = randInt(rand, 16, maxPos);
    if (out.every((q) => Math.abs(q - p) >= 10)) out.push(p);
  }
  return out.sort((a, b) => a - b);
}

/**
 * 小电脑速度按「一年级每秒 4~5 次点击（每次 1.6 格）」校准：
 * 全程约 63 次点击，AI 跑完全程要留出 12 秒以上；上坡章点击减半格、
 * 拖累最大，AI 基线与上坡数量都放缓，保证章末仍追得上。
 */
function buildLevel(ci: number, t: number, rand: () => number): RaceLevel {
  const obstacles: Obstacle[] = [];
  switch (ci) {
    case 0:
      return { aiSpeed: 6.2 + t * 0.09, tapStep: 1.6, obstacles, theme: 0 };
    case 1: {
      for (const pos of spread(1 + Math.floor(t / 6), rand)) obstacles.push({ type: "puddle", pos, len: 4 });
      return { aiSpeed: 6.4 + t * 0.1, tapStep: 1.6, obstacles, theme: 1 };
    }
    case 2: {
      for (const pos of spread(1 + Math.floor(t / 5), rand)) obstacles.push({ type: "hurdle", pos, len: 4 });
      return { aiSpeed: 6.6 + t * 0.1, tapStep: 1.6, obstacles, theme: 2 };
    }
    case 3: {
      for (const pos of spread(1 + Math.floor(t / 9), rand)) obstacles.push({ type: "hill", pos, len: 14 });
      return { aiSpeed: 6.2 + t * 0.08, tapStep: 1.7, obstacles, theme: 3 };
    }
    case 4: {
      for (const pos of spread(2 + Math.floor(t / 7), rand)) obstacles.push({ type: "star", pos, len: 4 });
      return { aiSpeed: 7 + t * 0.12, tapStep: 1.6, obstacles, theme: 4 };
    }
    // ---- 1.1 新章：小学六年级向，节奏更紧、要边跑边管理资源 ----
    case 6: {
      // 云顶接力：栏架不多，难点是体力——一路狂点会喘，得学会松手换气
      for (const pos of spreadWide(1 + Math.floor(t / 7), rand, 88)) {
        obstacles.push({ type: "hurdle", pos, len: 4 });
      }
      return {
        aiSpeed: 8.7 + t * 0.06,
        tapStep: 1.7,
        obstacles,
        theme: 6,
        stamina: 22 - Math.floor(t / 6),
        staminaRegen: 5.2 - t * 0.04
      };
    }
    case 7: {
      // 拾光集市：礼物箱是「谁先冲到谁拿」的抢夺点，中间夹着水坑逼你算路线
      const positions = spreadWide(2 + Math.floor(t / 8), rand, 88);
      positions.forEach((pos, i) => {
        obstacles.push({ type: i % 3 === 2 ? "puddle" : "item", pos, len: 4 });
      });
      return { aiSpeed: 8.3 + t * 0.03, tapStep: 1.6, obstacles, theme: 7 };
    }
    case 8: {
      // 节拍风廊：单纯狂点跑不快，要卡着鼓点点，连击层数换步长
      for (const pos of spreadWide(1 + Math.floor(t / 6), rand, 86)) {
        obstacles.push({ type: "hurdle", pos, len: 4 });
      }
      return {
        aiSpeed: 8.6 + t * 0.05,
        tapStep: 1.5,
        obstacles,
        theme: 8,
        beatMs: 250 - t * 2,
        comboMax: 10 + Math.floor(t / 6)
      };
    }
    case 9: {
      // 决胜星轨：读招电脑 + 体力条 + 隔关加节拍，五种机关全上场
      const kinds: ObstacleType[] = ["puddle", "hurdle", "hill", "star", "item"];
      const positions = spreadWide(3 + Math.floor(t / 7), rand, 84);
      positions.forEach((pos, i) => {
        const type = kinds[(i + t) % kinds.length];
        obstacles.push({ type, pos, len: type === "hill" ? 12 : 4 });
      });
      return {
        aiSpeed: 9.1 + t * 0.055,
        tapStep: 1.7,
        obstacles,
        theme: 9,
        aiAdapt: 0.16 + t * 0.009,
        stamina: 24 - Math.floor(t / 8),
        staminaRegen: 5.4 - t * 0.03,
        beatMs: t % 2 === 1 ? 250 - t * 2 : 0,
        comboMax: 10
      };
    }
    default: {
      const kinds: ObstacleType[] = ["puddle", "hurdle", "hill", "star"];
      const positions = spread(3 + Math.floor(t / 8), rand);
      positions.forEach((pos, i) => {
        const type = kinds[(i + t) % kinds.length];
        obstacles.push({ type, pos, len: type === "hill" ? 12 : 4 });
      });
      return { aiSpeed: 7.2 + t * 0.12, tapStep: 1.6, obstacles, theme: 5 };
    }
  }
}

export const LEVELS: RaceLevel[] = (() => {
  const out: RaceLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) {
      out.push(buildLevel(ci, t, mulberry32(ci * 333 + t * 19 + 7)));
    }
  });
  return out;
})();
