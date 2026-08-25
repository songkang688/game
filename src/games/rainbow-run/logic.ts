// 彩虹跑跑 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

/* ---------------- 操作 ---------------- */

export type SwipeDir = "left" | "right" | "up" | "down";

/** 根据滑动位移判断方向;太短就不算滑动。 */
export function detectSwipe(dx: number, dy: number, minDist = 24): SwipeDir | null {
  if (Math.hypot(dx, dy) < minDist) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export type ObstacleKind = "rock" | "hurdle" | "bar";
export type PlayerAction = "run" | "jump" | "slide";

/** 同一车道相遇时会不会撞上:跳过小栅栏、趴过彩虹杆,大软糖只能换道。 */
export function wouldHit(kind: ObstacleKind, action: PlayerAction): boolean {
  if (kind === "hurdle") return action !== "jump";
  if (kind === "bar") return action !== "slide";
  return true;
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(2, lane));
}

/* ---------------- 赛段(3 个主题 5 个赛段) ---------------- */

export type Theme = "grass" | "sky" | "candy";

export interface Section {
  theme: Theme;
  name: string;
  /** 赛段长度(像素) */
  len: number;
  /** 基础滚动速度(像素/秒) */
  speed: number;
}

export const SECTIONS: Section[] = [
  { theme: "grass", name: "青草坡", len: 1600, speed: 250 },
  { theme: "grass", name: "花花田", len: 1900, speed: 290 },
  { theme: "sky", name: "云朵桥", len: 2100, speed: 330 },
  { theme: "candy", name: "糖果谷", len: 2300, speed: 365 },
  { theme: "candy", name: "彩虹大道", len: 2500, speed: 400 },
];

export const TOTAL_LEN = SECTIONS.reduce((s, x) => s + x.len, 0);

/** 跑了 dist 时在第几个赛段(0 起,封顶最后一段)。 */
export function sectionAt(dist: number): number {
  let acc = 0;
  for (let i = 0; i < SECTIONS.length; i++) {
    acc += SECTIONS[i].len;
    if (dist < acc) return i;
  }
  return SECTIONS.length - 1;
}

/** 第 idx 段的起点里程。 */
export function sectionStart(idx: number): number {
  let acc = 0;
  for (let i = 0; i < idx; i++) acc += SECTIONS[i].len;
  return acc;
}

export interface ThemeStyle {
  skyTop: string;
  skyBottom: string;
  lanes: [string, string, string];
  deco: string;
}

export const THEME_STYLE: Record<Theme, ThemeStyle> = {
  grass: {
    skyTop: "#dff1ff",
    skyBottom: "#fdeff5",
    lanes: ["#d5f2ca", "#e3f7dc", "#def5d5"],
    deco: "#ffb3c8",
  },
  sky: {
    skyTop: "#cfe8ff",
    skyBottom: "#e8f4ff",
    lanes: ["#eef6ff", "#e0ecff", "#e8f0ff"],
    deco: "#ffffff",
  },
  candy: {
    skyTop: "#ffe3ee",
    skyBottom: "#fff1c9",
    lanes: ["#ffd6e7", "#fff1c9", "#d4f0ff"],
    deco: "#c9a6f2",
  },
};

/* ---------------- 障碍花样 ---------------- */

export interface PatternRow {
  obstacles: Array<{ lane: number; kind: ObstacleKind }>;
  stars: number[];
  coins: number[];
}

/** 一行是否有活路:存在一条道没障碍,或障碍可以跳/趴过去。 */
export function rowIsSurvivable(row: PatternRow): boolean {
  for (let lane = 0; lane < 3; lane++) {
    const ob = row.obstacles.find((o) => o.lane === lane);
    if (!ob || ob.kind !== "rock") return true;
  }
  return false;
}

export function patternIsSurvivable(pattern: PatternRow[]): boolean {
  return pattern.every(rowIsSurvivable);
}

/** 预设障碍组合:每次取一组连续刷出,像真正的跑酷节奏。 */
export const PATTERNS: PatternRow[][] = [
  // 单挡换道 + 空道金币
  [
    { obstacles: [{ lane: 0, kind: "rock" }], stars: [], coins: [1] },
    { obstacles: [{ lane: 1, kind: "rock" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "rock" }], stars: [1], coins: [] },
  ],
  // 跳栏节奏
  [
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [1] },
    { obstacles: [{ lane: 1, kind: "hurdle" }], stars: [0], coins: [2] },
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }], stars: [], coins: [2] },
  ],
  // 趴杆走廊
  [
    { obstacles: [{ lane: 0, kind: "bar" }, { lane: 1, kind: "bar" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 1, kind: "bar" }, { lane: 2, kind: "bar" }], stars: [], coins: [0] },
    { obstacles: [{ lane: 0, kind: "bar" }], stars: [], coins: [1, 2] },
  ],
  // 软糖夹缝(中间只能跳)
  [
    { obstacles: [{ lane: 0, kind: "rock" }, { lane: 2, kind: "rock" }, { lane: 1, kind: "hurdle" }], stars: [], coins: [] },
    { obstacles: [], stars: [1], coins: [0, 2] },
    { obstacles: [{ lane: 1, kind: "rock" }], stars: [], coins: [0] },
  ],
  // 跳趴交替
  [
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "rock" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "bar" }, { lane: 1, kind: "rock" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 0, kind: "bar" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [1] },
  ],
  // 金币雨休息段
  [
    { obstacles: [], stars: [0], coins: [1, 2] },
    { obstacles: [], stars: [1], coins: [0, 2] },
    { obstacles: [], stars: [2], coins: [0, 1] },
  ],
  // 双软糖逼位
  [
    { obstacles: [{ lane: 1, kind: "rock" }, { lane: 2, kind: "rock" }], stars: [], coins: [0] },
    { obstacles: [{ lane: 0, kind: "rock" }, { lane: 1, kind: "rock" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 1, kind: "hurdle" }], stars: [], coins: [0, 2] },
  ],
];

/* ---------------- 补给小站(金币商店) ---------------- */

export interface ShopItem {
  id: "shield" | "magnet";
  name: string;
  cost: number;
  desc: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "shield", name: "泡泡护盾", cost: 8, desc: "帮你挡住一次碰撞" },
  { id: "magnet", name: "星星磁铁", cost: 6, desc: "一小段时间自动吸金币" },
];

export function canBuy(coins: number, item: ShopItem): boolean {
  return coins >= item.cost;
}

export const MAGNET_SECONDS = 10;
export const MAX_HEARTS = 3;

/* ---------------- 结算 ---------------- */

export function starsForRun(retries: number, heartsLost: number): 1 | 2 | 3 {
  if (retries === 0 && heartsLost <= 1) return 3;
  if (retries <= 1) return 2;
  return 1;
}
