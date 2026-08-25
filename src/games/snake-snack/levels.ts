/**
 * 贪吃毛毛虫 · 99 关关卡表。
 * 六个主题花园，每章用不同的墙型生成器（并非同一模板）：
 *  ①青青草原=空地热身  ②树篱花园=横排树篱  ③石柱庭院=竖排石柱
 *  ④回字迷宫=带缺口的回字墙  ⑤十字花坛=中心十字  ⑥星光夜园=混合墙+提速
 * 墙体由确定性随机生成，同一关每次进入布局一致。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

export const GRID = 13;

export interface SnakeLevel {
  /** 要吃到的点心数 */
  target: number;
  /** 移动一步的毫秒数（越小越快） */
  tickMs: number;
  /** 墙格 [x, y] 列表 */
  walls: Array<[number, number]>;
}

export const CHAPTERS: Chapter[] = [
  { name: "青青草原", emoji: "🌱", color: "#E2F7DC", desc: "空旷草原，先吃几口热热身！", size: 17 },
  { name: "树篱花园", emoji: "🌳", color: "#DDF0D0", desc: "横排树篱挡路，绕着走！", size: 17 },
  { name: "石柱庭院", emoji: "🏛️", color: "#EDEAE0", desc: "竖排石柱林立，小心转弯！", size: 17 },
  { name: "回字迷宫", emoji: "🌀", color: "#DCE9F5", desc: "回字形围墙，从缺口钻进去！", size: 16 },
  { name: "十字花坛", emoji: "🌼", color: "#FFF3D0", desc: "中间的十字花坛别撞上！", size: 16 },
  { name: "星光夜园", emoji: "🌟", color: "#E3DFF5", desc: "夜里的墙更多、爬得更快！", size: 16 }
];

function hLine(y: number, x1: number, x2: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = x1; x <= x2; x++) out.push([x, y]);
  return out;
}

function vLine(x: number, y1: number, y2: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = y1; y <= y2; y++) out.push([x, y]);
  return out;
}

/** 出生区（中间一行左半段）永远不放墙 */
function safe(walls: Array<[number, number]>): Array<[number, number]> {
  const mid = Math.floor(GRID / 2);
  return walls.filter(([x, y]) => !(y === mid && x >= 1 && x <= 7));
}

function buildLevel(ci: number, t: number, rand: () => number): SnakeLevel {
  const speedBase = [300, 290, 280, 275, 268, 258][ci];
  const tickMs = Math.max(170, speedBase - t * 3);
  switch (ci) {
    case 0: {
      // 空地或一小段树篱
      const walls = t < 10 ? [] : hLine(3, randInt(rand, 2, 5), randInt(rand, 7, 10));
      return { target: 5 + Math.floor(t / 3), tickMs, walls: safe(walls) };
    }
    case 1: {
      // 1~3 条横树篱，位置随机
      const n = 1 + Math.floor(t / 6);
      const walls: Array<[number, number]> = [];
      const ys = new Set<number>();
      for (let i = 0; i < n; i++) {
        let y = randInt(rand, 2, GRID - 3);
        let guard = 0;
        while ((ys.has(y) || ys.has(y - 1) || ys.has(y + 1)) && guard++ < 30) y = randInt(rand, 2, GRID - 3);
        ys.add(y);
        const x1 = randInt(rand, 1, 4);
        walls.push(...hLine(y, x1, x1 + randInt(rand, 2, 4)), ...hLine(y, x1 + 7, Math.min(GRID - 2, x1 + 7 + randInt(rand, 1, 3))));
      }
      return { target: 7 + Math.floor(t / 3), tickMs, walls: safe(walls) };
    }
    case 2: {
      // 2~4 根竖石柱
      const n = 2 + Math.floor(t / 6);
      const walls: Array<[number, number]> = [];
      const xs = new Set<number>();
      for (let i = 0; i < n; i++) {
        let x = randInt(rand, 2, GRID - 3);
        let guard = 0;
        while ((xs.has(x) || xs.has(x - 1) || xs.has(x + 1)) && guard++ < 30) x = randInt(rand, 2, GRID - 3);
        xs.add(x);
        const y1 = randInt(rand, 1, 3);
        walls.push(...vLine(x, y1, y1 + randInt(rand, 2, 4)));
        walls.push(...vLine(x, y1 + 7, Math.min(GRID - 2, y1 + 7 + randInt(rand, 1, 2))));
      }
      return { target: 8 + Math.floor(t / 3), tickMs, walls: safe(walls) };
    }
    case 3: {
      // 回字：外圈方框，四边各留缺口
      const m = 2 + (t % 2);
      const walls: Array<[number, number]> = [
        ...hLine(m, m, GRID - 1 - m),
        ...hLine(GRID - 1 - m, m, GRID - 1 - m),
        ...vLine(m, m, GRID - 1 - m),
        ...vLine(GRID - 1 - m, m, GRID - 1 - m)
      ];
      const gaps = new Set<string>();
      const mid = Math.floor(GRID / 2);
      // 四边中点开口，开口宽 2~3
      for (const [gx, gy] of [[mid, m], [mid, GRID - 1 - m], [m, mid], [GRID - 1 - m, mid]] as Array<[number, number]>) {
        for (let d = -1; d <= (t < 8 ? 1 : 0); d++) {
          gaps.add(`${gx + (gy === mid ? 0 : d)},${gy + (gy === mid ? d : 0)}`);
        }
      }
      return {
        target: 9 + Math.floor(t / 3), tickMs,
        walls: safe(walls.filter(([x, y]) => !gaps.has(`${x},${y}`)))
      };
    }
    case 4: {
      // 中心十字，臂长渐长
      const mid = Math.floor(GRID / 2);
      const arm = 2 + Math.floor(t / 5);
      const walls = [
        ...hLine(mid, mid - arm, mid + arm),
        ...vLine(mid, mid - arm, mid + arm)
      ];
      return { target: 10 + Math.floor(t / 3), tickMs, walls: safe(walls) };
    }
    default: {
      // 混合：随机横竖小段墙
      const n = 3 + Math.floor(t / 4);
      const walls: Array<[number, number]> = [];
      for (let i = 0; i < n; i++) {
        if (rand() < 0.5) {
          const y = randInt(rand, 1, GRID - 2);
          const x1 = randInt(rand, 1, GRID - 5);
          walls.push(...hLine(y, x1, x1 + randInt(rand, 2, 3)));
        } else {
          const x = randInt(rand, 1, GRID - 2);
          const y1 = randInt(rand, 1, GRID - 5);
          walls.push(...vLine(x, y1, y1 + randInt(rand, 2, 3)));
        }
      }
      return { target: 11 + Math.floor(t / 3), tickMs, walls: safe(walls) };
    }
  }
}

export const LEVELS: SnakeLevel[] = (() => {
  const out: SnakeLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) {
      out.push(buildLevel(ci, t, mulberry32(ci * 4096 + t * 31 + 11)));
    }
  });
  return out;
})();
