/**
 * 贪吃毛毛虫 · 188 关关卡表。
 * 前 99 关是 1.0 的六座花园，生成参数一个字都没动；
 * 1.1 在末尾追加四座新花园（第 100–188 关）：
 *  ⑦双子藤园=两条毛毛虫左右镜像一起走  ⑧星门花园=踩进星门从对面钻出来
 *  ⑨巡逻小刺猬=会移动的障碍来回巡逻  ⑩窄门大考=身子太长挤不过窄门，先吃剪刀果
 * 1.0 的六个主题花园，每章用不同的墙型生成器（并非同一模板）：
 *  ①青青草原=空地热身  ②树篱花园=横排树篱  ③石柱庭院=竖排石柱
 *  ④回字迷宫=带缺口的回字墙  ⑤十字花坛=中心十字  ⑥星光夜园=混合墙+提速
 * 墙体由确定性随机生成，同一关每次进入布局一致。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

export const GRID = 13;

/** 1.0 的六座花园：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新花园从这里开始往后排） */
export const LEGACY_LEVELS = 99;

/** 会移动的小刺猬：[起点 x, 起点 y, 方向 dx, 方向 dy, 来回巡逻的格数] */
export type Mover = [number, number, number, number, number];
/** 一对星门：[甲门 x, 甲门 y, 乙门 x, 乙门 y] */
export type Portal = [number, number, number, number];

export interface SnakeLevel {
  /** 要吃到的点心数 */
  target: number;
  /** 移动一步的毫秒数（越小越快） */
  tickMs: number;
  /** 墙格 [x, y] 列表 */
  walls: Array<[number, number]>;
  /** 1.1 双身位：第二条毛毛虫左右镜像跟着走，前 99 关不带 */
  twin?: boolean;
  /** 1.1 传送门：踩进一扇就从对面那扇钻出来，前 99 关不带 */
  portals?: Portal[];
  /** 1.1 会移动的障碍：小刺猬沿直线来回巡逻，前 99 关不带 */
  movers?: Mover[];
  /** 1.1 窄门：身子不超过 gateMax 节才挤得过去，前 99 关不带 */
  gate?: Array<[number, number]>;
  gateMax?: number;
  /** 1.1 剪刀果：每隔这么多口出现一次，吃了身子短三节，前 99 关不带 */
  trimEvery?: number;
  /** 1.2 可推的小石头：顶一下滑一格，推不动就原地停住（不算撞），前 99 关不带 */
  stones?: Array<[number, number]>;
  /** 1.2 绕圈开门：踩遍这一圈格子，ringDoor 才会打开，前 99 关不带 */
  ring?: Array<[number, number]>;
  /** 1.2 绕圈门本身占的格子（不是墙，只是关着时走不过去） */
  ringDoor?: Array<[number, number]>;
}

export const CHAPTERS: Chapter[] = [
  { name: "青青草原", emoji: "🌱", color: "#E2F7DC", desc: "空旷草原，先吃几口热热身！", size: 17 },
  { name: "树篱花园", emoji: "🌳", color: "#DDF0D0", desc: "横排树篱挡路，绕着走！", size: 17 },
  { name: "石柱庭院", emoji: "🏛️", color: "#EDEAE0", desc: "竖排石柱林立，小心转弯！", size: 17 },
  { name: "回字迷宫", emoji: "🌀", color: "#DCE9F5", desc: "回字形围墙，从缺口钻进去！", size: 16 },
  { name: "十字花坛", emoji: "🌼", color: "#FFF3D0", desc: "中间的十字花坛别撞上！", size: 16 },
  { name: "星光夜园", emoji: "🌟", color: "#E3DFF5", desc: "夜里的墙更多、爬得更快！", size: 16 },
  // ↓ 1.1 追加：四座新花园，合计 89 关
  { name: "双子藤园", emoji: "👯", color: "#E8F6E0", desc: "两条毛毛虫左右镜像一起走，哪条撞了都不行！", size: 23 },
  { name: "星门花园", emoji: "🌀", color: "#E1EAFB", desc: "踩进星门，就会从对面那扇门钻出来！", size: 22 },
  { name: "巡逻小刺猬", emoji: "🦔", color: "#F6EBDA", desc: "小刺猬沿着固定路线来回巡逻，看准空档再过！", size: 22 },
  { name: "窄门大考", emoji: "🚪", color: "#F2E3F0", desc: "身子太长挤不过窄门，先吃把剪刀果变短再走！", size: 22 }
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

/** 双子藤园还要多留一段：第二条毛毛虫出生在第 2 行右半段 */
function safeTwin(walls: Array<[number, number]>): Array<[number, number]> {
  return safe(walls).filter(([x, y]) => !(y === 2 && x >= GRID - 8 && x <= GRID - 2));
}

/** 去掉重复的墙格（镜像生成时可能撞车） */
function dedupe(walls: Array<[number, number]>): Array<[number, number]> {
  const seen = new Set<number>();
  const out: Array<[number, number]> = [];
  for (const [x, y] of walls) {
    const k = y * GRID + x;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([x, y]);
  }
  return out;
}

/** 小刺猬来回踩过的所有格子（放石头时要躲开，不然它俩会卡在一起） */
function moverPathOf(movers: Mover[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [x, y, dx, dy, span] of movers) {
    for (let s = 0; s <= Math.max(1, Math.round(span)); s++) out.push([x + dx * s, y + dy * s]);
  }
  return out;
}

/**
 * 挑几个放小石头的空格：躲开墙、巡逻线、两条毛毛虫的出生段，
 * 也不贴边（贴边的石头一顶就顶死，孩子会觉得这块石头坏掉了）。
 */
function pickStones(
  rand: () => number,
  count: number,
  busy: Array<[number, number]>
): Array<[number, number]> {
  const taken = new Set(busy.map(([x, y]) => y * GRID + x));
  const mid = Math.floor(GRID / 2);
  for (const [x, y] of [...spawnCells(), ...spawnCellsB()]) taken.add(y * GRID + x);
  for (let x = 0; x < GRID; x++) taken.add(mid * GRID + x);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    for (let guard = 0; guard < 40; guard++) {
      const x = randInt(rand, 2, GRID - 3);
      const y = randInt(rand, 2, GRID - 3);
      const k = y * GRID + x;
      if (taken.has(k)) continue;
      taken.add(k);
      out.push([x, y]);
      break;
    }
  }
  return out;
}

/** 绕圈开门用的小花坛：绕着它走满一圈，角落那扇小门就开 */
export const BED: [number, number] = [4, 3];
/** 小门后面的兜：里面藏一颗星星果，只有开了门才进得去 */
export const POCKET: [number, number] = [GRID - 1, GRID - 1];
/** 小门本身占的格子（不是墙，只是关着时走不过去） */
export const POCKET_DOOR: [number, number] = [GRID - 2, GRID - 1];

/** 花坛四周那一圈（顺着走就是绕一圈） */
function ringAroundBed(cx: number, cy: number): Array<[number, number]> {
  const order: Array<[number, number]> = [
    [cx - 1, cy - 1], [cx, cy - 1], [cx + 1, cy - 1],
    [cx + 1, cy], [cx + 1, cy + 1], [cx, cy + 1],
    [cx - 1, cy + 1], [cx - 1, cy],
  ];
  return order.filter(([x, y]) => x >= 0 && x < GRID && y >= 0 && y < GRID);
}

/** 出生段（和 logic.ts 的 spawnA 保持一致，这里不 import 免得循环依赖） */
function spawnCells(): Array<[number, number]> {
  const mid = Math.floor(GRID / 2);
  return [[3, mid], [2, mid], [1, mid]];
}

function spawnCellsB(): Array<[number, number]> {
  return [[GRID - 4, 2], [GRID - 3, 2], [GRID - 2, 2]];
}

function buildLevel(ci: number, t: number, rand: () => number): SnakeLevel {
  const speedBase = [300, 290, 280, 275, 268, 258, 300, 292, 286, 280][ci];
  const tickMs = Math.max(170, speedBase - t * 3);
  const mid = Math.floor(GRID / 2);
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
      const arm = 2 + Math.floor(t / 5);
      const walls = [
        ...hLine(mid, mid - arm, mid + arm),
        ...vLine(mid, mid - arm, mid + arm)
      ];
      return { target: 10 + Math.floor(t / 3), tickMs, walls: safe(walls) };
    }
    case 5: {
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
    case 6: {
      // 双子藤园：墙左右对称，两条毛毛虫的出生行一律留空
      const pairs = Math.floor(t / 5);
      const walls: Array<[number, number]> = [];
      for (let i = 0; i < pairs; i++) {
        const x = randInt(rand, 2, 5);
        const y = i % 2 === 0 ? 4 : 9;
        walls.push([x, y], [x, y + 1], [GRID - 1 - x, y], [GRID - 1 - x, y + 1]);
      }
      return { target: 6 + Math.floor(t / 3), tickMs, walls: dedupe(safeTwin(walls)), twin: true };
    }
    case 7: {
      // 星门花园：一道竖墙把园子分成两半，只能靠星门穿过去
      const walls: Array<[number, number]> = [];
      if (t >= 4) walls.push(...vLine(9, 0, GRID - 1));
      const n = Math.floor(t / 6);
      for (let i = 0; i < n; i++) {
        const y = randInt(rand, 3, GRID - 4);
        const x1 = randInt(rand, 1, 4);
        walls.push(...hLine(y, x1, x1 + randInt(rand, 1, 2)));
      }
      const portals: Portal[] = [[7, 1, 11, 1], [7, GRID - 2, 11, GRID - 2]];
      if (t >= 12) portals.push([1, 4, 11, 8]);
      const blocked = new Set(portals.flatMap(([ax, ay, bx, by]) => [ay * GRID + ax, by * GRID + bx]));
      return {
        target: 8 + Math.floor(t / 3), tickMs,
        walls: dedupe(safe(walls)).filter(([x, y]) => !blocked.has(y * GRID + x)),
        portals
      };
    }
    case 8: {
      // 巡逻小刺猬：固定石柱少，主要靠躲会动的小刺猬
      const walls: Array<[number, number]> = [];
      const pillars = 1 + Math.floor(t / 8);
      for (let i = 0; i < pillars; i++) {
        const x = randInt(rand, 2, GRID - 3);
        const y = i % 2 === 0 ? 1 : GRID - 2;
        walls.push([x, y]);
      }
      const clean = dedupe(safe(walls));
      const taken = new Set(clean.map(([x, y]) => y * GRID + x));
      const movers: Mover[] = [];
      const n = 1 + Math.floor(t / 5);
      for (let i = 0; i < n; i++) {
        const span = randInt(rand, 2, 4);
        let m: Mover;
        if (i % 2 === 0) {
          // 竖着巡逻：上半场或下半场，绝不压到出生那一行
          const x = randInt(rand, 2, GRID - 3);
          const y1 = i % 4 === 0 ? randInt(rand, 0, mid - 1 - span) : randInt(rand, mid + 1, GRID - 1 - span);
          m = [x, y1, 0, 1, span];
        } else {
          // 横着巡逻：贴着上下边巡，出生行照样留空
          const y = i % 4 === 1 ? randInt(rand, 0, mid - 2) : randInt(rand, mid + 1, GRID - 2);
          const x1 = randInt(rand, 1, GRID - 2 - span);
          m = [x1, y, 1, 0, span];
        }
        // 巡逻路线压到石柱就挪走这根石柱，别让小刺猬卡死
        for (let s = 0; s <= m[4]; s++) taken.delete((m[1] + m[3] * s) * GRID + (m[0] + m[2] * s));
        movers.push(m);
      }
      const keptWalls = clean.filter(([x, y]) => taken.has(y * GRID + x));
      // 1.2 小石头：后半章补几块推得动的石头，给孩子多一条自己开路的办法
      const stones = t >= 8
        ? pickStones(rand, 1 + Math.floor((t - 8) / 6), [
          ...keptWalls,
          ...moverPathOf(movers),
        ])
        : undefined;
      return {
        target: 9 + Math.floor(t / 3), tickMs,
        walls: keptWalls,
        movers,
        ...(stones && stones.length > 0 ? { stones } : {})
      };
    }
    default: {
      // 窄门大考：竖墙留一扇窄门，身子短才挤得过去；剪刀果负责让你变短
      const gy = 3 + (t % 7);
      const walls: Array<[number, number]> = vLine(9, 0, GRID - 1).filter(([, y]) => y !== gy);
      const gate: Array<[number, number]> = [[9, gy]];
      if (t >= 8) {
        const dx = 3 + (t % 5);
        walls.push(...hLine(2, 1, GRID - 2).filter(([x]) => x !== dx));
        gate.push([dx, 2]);
      }
      return {
        target: 10 + Math.floor(t / 3), tickMs,
        walls: dedupe(safe(walls)),
        gate,
        gateMax: Math.max(6, 11 - Math.floor(t / 4)),
        trimEvery: 5
      };
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

// ---------------------------------------------------------------------------
// 1.1 无尽花园（纯函数，可测试）
// ---------------------------------------------------------------------------

/** 无尽花园每一座的名字：每 3 座换一种风景 */
export const ENDLESS_GARDENS = ["露水园", "藤蔓园", "星门园", "刺猬园", "窄门园"];

/** 无尽花园第 garden 座（1 基）的名字 */
export function endlessGardenName(garden: number): string {
  const n = Math.max(1, Math.round(garden) || 1);
  return ENDLESS_GARDENS[(n - 1) % ENDLESS_GARDENS.length];
}

/** 无尽第一段爬坡爬到第几座封顶（1 基）：速度、墙量、机关都在这里到顶 */
export const ENDLESS_RAMP_GARDENS = 16;
/** 清一座园最多要吃几口 */
export const ENDLESS_MAX_TARGET = 18;

/**
 * 第 garden 座（1 基）要吃几口才算清园。
 *
 * 前 16 座跟着 `k` 每两座多一口，吃到 13 口；再往后每 4 座多一口，到 18 口封顶。
 * 分第二段是给「休闲无尽」用的：经典档还能靠 `endlessTickMs` 按累计口数继续加速，
 * 休闲档速度恒定，第 16 座之后要是连目标口数都不动，后面就纯粹是换风景。
 */
export function endlessTarget(garden: number): number {
  const n = Math.max(1, Math.round(garden) || 1);
  const base = 6 + Math.floor(Math.min(n - 1, 15) / 2);
  return Math.min(ENDLESS_MAX_TARGET, base + Math.floor(Math.max(0, n - ENDLESS_RAMP_GARDENS) / 4));
}

/**
 * 无尽第 garden 座的难度分：速度和目标口数合成一个数（和另外四款一个口径），
 * 单测拿它钉住「休闲档的曲线也一路不掉头」。第 36 座到顶。
 */
export function endlessDifficulty(garden: number): number {
  const n = Math.max(1, Math.round(garden) || 1);
  const k = Math.min(n - 1, 15);
  return endlessTarget(n) * 10 + (300 - Math.max(180, 300 - k * 8));
}

/** 难度分到顶的那一座；再往后只换风景 */
export const ENDLESS_PEAK_GARDEN = 36;

/**
 * 无尽花园第 garden 座（1 基）：四种新机制轮着上，越往后越快，
 * 但速度、墙量与目标口数都有封顶。
 */
export function endlessGarden(garden: number): SnakeLevel {
  const n = Math.max(1, Math.round(garden) || 1);
  const k = Math.min(n - 1, 15);
  const rand = mulberry32(60000 + n * 197);
  const mid = Math.floor(GRID / 2);
  const tickMs = Math.max(180, 300 - k * 8);
  const target = endlessTarget(n);
  switch ((n - 1) % 5) {
    case 1: {
      const walls: Array<[number, number]> = [];
      for (let i = 0; i < 1 + Math.floor(k / 4); i++) {
        const x = randInt(rand, 2, 5);
        const y = i % 2 === 0 ? 4 : 9;
        walls.push([x, y], [x, y + 1], [GRID - 1 - x, y], [GRID - 1 - x, y + 1]);
      }
      return { target, tickMs, walls: dedupe(safeTwin(walls)), twin: true };
    }
    case 2: {
      const portals: Portal[] = [[7, 1, 11, 1], [7, GRID - 2, 11, GRID - 2]];
      const blocked = new Set(portals.flatMap(([ax, ay, bx, by]) => [ay * GRID + ax, by * GRID + bx]));
      return {
        target, tickMs,
        walls: dedupe(safe(vLine(9, 0, GRID - 1))).filter(([x, y]) => !blocked.has(y * GRID + x)),
        portals
      };
    }
    case 3: {
      const movers: Mover[] = [];
      for (let i = 0; i < 1 + Math.floor(k / 4); i++) {
        const span = randInt(rand, 2, 4);
        const x = randInt(rand, 2, GRID - 3);
        const y1 = i % 2 === 0 ? randInt(rand, 0, mid - 1 - span) : randInt(rand, mid + 1, GRID - 1 - span);
        movers.push([x, y1, 0, 1, span]);
      }
      return { target, tickMs, walls: [], movers };
    }
    case 4: {
      const gy = 3 + (k % 7);
      return {
        target, tickMs,
        walls: dedupe(safe(vLine(9, 0, GRID - 1).filter(([, y]) => y !== gy))),
        gate: [[9, gy]],
        gateMax: Math.max(6, 11 - Math.floor(k / 4)),
        trimEvery: 5
      };
    }
    default: {
      const walls: Array<[number, number]> = [];
      for (let i = 0; i < Math.floor(k / 3); i++) {
        const y = randInt(rand, 1, GRID - 2);
        const x1 = randInt(rand, 1, GRID - 5);
        walls.push(...hLine(y, x1, x1 + randInt(rand, 2, 3)));
      }
      // 1.2 露水园补两样新机关：绕圈开门的小花坛，以及推得动的小石头
      const ring = k >= 5 ? ringAroundBed(BED[0], BED[1]) : undefined;
      const ringDoor: Array<[number, number]> | undefined = ring ? [POCKET_DOOR] : undefined;
      if (ring) walls.push([BED[0], BED[1]], [POCKET[0], POCKET[1] - 1]);
      const reserved = new Set<number>(
        [...(ring ?? []), ...(ringDoor ?? []), ...(ring ? [POCKET] : [])].map(([x, y]) => y * GRID + x)
      );
      const clean = dedupe(safe(walls)).filter(([x, y]) => !reserved.has(y * GRID + x));
      const stones = k >= 3
        ? pickStones(rand, 1 + Math.floor(k / 6), [
          ...clean,
          ...(ring ?? []),
          ...(ringDoor ?? []),
          ...(ring ? [POCKET] : []),
        ])
        : undefined;
      return {
        target, tickMs, walls: clean,
        ...(ring ? { ring, ringDoor } : {}),
        ...(stones && stones.length > 0 ? { stones } : {})
      };
    }
  }
}

/** 无尽花园收工时的一句话（只鼓励，不批评） */
export function endlessLine(eaten: number, best: number): string {
  if (eaten <= 0) return "刚出发就停下啦，慢慢转弯、别贴着围栏，下一次一定吃得到！";
  if (eaten > best) return `新纪录！这一路你吃了 ${eaten} 口点心！`;
  return `这次吃了 ${eaten} 口，最好成绩是 ${best} 口，再来一次准能追上！`;
}
