/**
 * 红蓝赛跑 · 99 关关卡表。
 * 六个主题赛道、四种赛道机关（并非同一模板）：
 *  ①操场直道=纯拼手速  ②水坑赛道=跳过水坑不打滑  ③跨栏赛场=跨栏要起跳
 *  ④上坡森林=上坡段每步变短  ⑤夜跑霓虹=踩到星星就冲刺  ⑥冠军巡回=全机关混合
 * 跑道长 100，机关位置由确定性生成器排布。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

export const TRACK_LEN = 100;

export type ObstacleType = "puddle" | "hurdle" | "hill" | "star";

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
}

export const CHAPTERS: Chapter[] = [
  { name: "操场直道", emoji: "🏃", color: "#DFF3D5", desc: "狂点按钮往前冲，比小电脑先到终点！", size: 17 },
  { name: "水坑赛道", emoji: "💧", color: "#D6EBFF", desc: "看到水坑提前跳，踩进去会打滑！", size: 17 },
  { name: "跨栏赛场", emoji: "🚧", color: "#FFE9D6", desc: "跨栏挡路，起跳才能越过去！", size: 17 },
  { name: "上坡森林", emoji: "⛰️", color: "#E4EFD8", desc: "上坡路每一步都变短，要更用力！", size: 16 },
  { name: "夜跑霓虹", emoji: "🌃", color: "#E3DFF5", desc: "踩到 ⭐ 就自动向前冲刺一大段！", size: 16 },
  { name: "冠军巡回", emoji: "🏆", color: "#FFF3C4", desc: "水坑跨栏上坡全都有，冠军之战！", size: 16 }
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

function buildLevel(ci: number, t: number, rand: () => number): RaceLevel {
  const obstacles: Obstacle[] = [];
  switch (ci) {
    case 0:
      return { aiSpeed: 7 + t * 0.45, tapStep: 1.6, obstacles, theme: 0 };
    case 1: {
      for (const pos of spread(1 + Math.floor(t / 6), rand)) obstacles.push({ type: "puddle", pos, len: 4 });
      return { aiSpeed: 7.5 + t * 0.4, tapStep: 1.6, obstacles, theme: 1 };
    }
    case 2: {
      for (const pos of spread(1 + Math.floor(t / 5), rand)) obstacles.push({ type: "hurdle", pos, len: 4 });
      return { aiSpeed: 8 + t * 0.4, tapStep: 1.6, obstacles, theme: 2 };
    }
    case 3: {
      for (const pos of spread(1 + Math.floor(t / 7), rand)) obstacles.push({ type: "hill", pos, len: 14 });
      return { aiSpeed: 8 + t * 0.4, tapStep: 1.7, obstacles, theme: 3 };
    }
    case 4: {
      for (const pos of spread(2 + Math.floor(t / 7), rand)) obstacles.push({ type: "star", pos, len: 4 });
      return { aiSpeed: 9.5 + t * 0.42, tapStep: 1.6, obstacles, theme: 4 };
    }
    default: {
      const kinds: ObstacleType[] = ["puddle", "hurdle", "hill", "star"];
      const positions = spread(3 + Math.floor(t / 8), rand);
      positions.forEach((pos, i) => {
        const type = kinds[(i + t) % kinds.length];
        obstacles.push({ type, pos, len: type === "hill" ? 12 : 4 });
      });
      return { aiSpeed: 10 + t * 0.45, tapStep: 1.6, obstacles, theme: 5 };
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
