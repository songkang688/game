/**
 * 梨康地产 · 原创棋盘（纯数据 + 查表函数，不碰 DOM、不 import 玩法状态）。
 *
 * 正方形环线 40 格：四角 + 每边 9 格。
 * 8 个色组共 22 块地、4 个车站、2 个公共设施、机会 3 格、命运 3 格、税金 2 格。
 * 地名、色组名、卡面文字全部原创，和任何现实里的地产桌游没有一个字重合。
 */

/** 环线格数 */
export const BOARD_LEN = 40;

/** 经过出发花园领到的星币 */
export const GO_SALARY = 200;

/** 开局现金 */
export const START_CASH = 1500;

/** 出小黑屋的罚款 */
export const JAIL_FINE = 50;

/** 反思角（会把人送进小黑屋的那一角）的格号 */
export const JAIL_TILE = 30;

/** 小黑屋本身借用休息亭那一角显示，位置索引与休息亭同格 */
export const JAIL_VISIT_TILE = 10;

/** 赎回抵押要加的一成利息 */
export const UNMORTGAGE_RATE = 1.1;

/** 接手别人抵押地时立刻要交的手续费比例 */
export const TRANSFER_FEE_RATE = 0.1;

/** 一块地最多盖到第几级（1–4 是小屋，5 是大屋） */
export const MAX_HOUSES = 5;

export type TileKind =
  | "go"
  | "rest"
  | "park"
  | "jail"
  | "prop"
  | "station"
  | "util"
  | "chance"
  | "fate"
  | "tax";

/** 8 个原创色组 */
export type ColorGroup =
  | "cotton"
  | "soda"
  | "rainbow"
  | "windmill"
  | "sugar"
  | "library"
  | "observatory"
  | "moon";

export interface ColorGroupInfo {
  id: ColorGroup;
  name: string;
  /** 色块颜色（粉彩） */
  color: string;
  /** 每盖一栋要多少星币 */
  houseCost: number;
}

export const COLOR_GROUPS: readonly ColorGroupInfo[] = [
  { id: "cotton", name: "棉花巷", color: "#F6D8E4", houseCost: 50 },
  { id: "soda", name: "汽水街", color: "#CFE7F7", houseCost: 50 },
  { id: "rainbow", name: "彩虹滨", color: "#F9E0C4", houseCost: 100 },
  { id: "windmill", name: "风车坡", color: "#D8EDD2", houseCost: 100 },
  { id: "sugar", name: "星糖路", color: "#F3D3F0", houseCost: 150 },
  { id: "library", name: "图书馆大街", color: "#E2DCF6", houseCost: 150 },
  { id: "observatory", name: "天文台坡", color: "#CFE3DC", houseCost: 200 },
  { id: "moon", name: "月亮广场", color: "#FBE7B2", houseCost: 200 }
];

const GROUP_BY_ID = new Map<ColorGroup, ColorGroupInfo>(COLOR_GROUPS.map((g) => [g.id, g]));

export function groupInfo(id: ColorGroup): ColorGroupInfo {
  return GROUP_BY_ID.get(id) ?? COLOR_GROUPS[0];
}

export interface Tile {
  /** 格号 0..39 */
  pos: number;
  kind: TileKind;
  name: string;
  emoji: string;
  /** 地块 / 车站 / 设施的售价 */
  price?: number;
  /** 色组（只有 kind === "prop" 有） */
  group?: ColorGroup;
  /**
   * 租金表，下标 0..5：0 栋（空地）、1–4 栋小屋、5 是大屋。
   * 空地租金遇到「整组垄断且都没抵押」时另外 ×2，不写进表里。
   */
  rent?: readonly number[];
  /** 税金格要交多少 */
  tax?: number;
}

/**
 * 40 格环线。
 * 四角：0 出发花园（经过 +200）、10 休息亭（只是参观）、20 鸭梨公园（免费停留）、30 反思角（进小黑屋）。
 */
export const BOARD: readonly Tile[] = [
  { pos: 0, kind: "go", name: "出发花园", emoji: "🌷" },
  {
    pos: 1,
    kind: "prop",
    name: "棉花巷·软软角",
    emoji: "🧶",
    group: "cotton",
    price: 60,
    rent: [2, 10, 30, 90, 160, 250]
  },
  { pos: 2, kind: "fate", name: "命运信箱", emoji: "💌" },
  {
    pos: 3,
    kind: "prop",
    name: "棉花巷·晒被场",
    emoji: "🧺",
    group: "cotton",
    price: 60,
    rent: [4, 20, 60, 180, 320, 450]
  },
  { pos: 4, kind: "tax", name: "星币税亭", emoji: "🧾", tax: 100 },
  { pos: 5, kind: "station", name: "东站", emoji: "🚉", price: 200 },
  {
    pos: 6,
    kind: "prop",
    name: "汽水街·气泡口",
    emoji: "🥤",
    group: "soda",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550]
  },
  { pos: 7, kind: "chance", name: "机会转盘", emoji: "🎡" },
  {
    pos: 8,
    kind: "prop",
    name: "汽水街·冰块铺",
    emoji: "🧊",
    group: "soda",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550]
  },
  {
    pos: 9,
    kind: "prop",
    name: "汽水街·柠檬摊",
    emoji: "🍋",
    group: "soda",
    price: 120,
    rent: [8, 40, 100, 300, 450, 600]
  },
  { pos: 10, kind: "rest", name: "休息亭", emoji: "⛱️" },
  {
    pos: 11,
    kind: "prop",
    name: "彩虹滨·贝壳滩",
    emoji: "🐚",
    group: "rainbow",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750]
  },
  { pos: 12, kind: "util", name: "喷泉站", emoji: "⛲", price: 150 },
  {
    pos: 13,
    kind: "prop",
    name: "彩虹滨·浪花道",
    emoji: "🌊",
    group: "rainbow",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750]
  },
  {
    pos: 14,
    kind: "prop",
    name: "彩虹滨·灯塔角",
    emoji: "🗼",
    group: "rainbow",
    price: 160,
    rent: [12, 60, 180, 500, 700, 900]
  },
  { pos: 15, kind: "station", name: "南站", emoji: "🚉", price: 200 },
  {
    pos: 16,
    kind: "prop",
    name: "风车坡·麦浪弯",
    emoji: "🌾",
    group: "windmill",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950]
  },
  { pos: 17, kind: "fate", name: "命运信箱", emoji: "💌" },
  {
    pos: 18,
    kind: "prop",
    name: "风车坡·转叶台",
    emoji: "🌀",
    group: "windmill",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950]
  },
  {
    pos: 19,
    kind: "prop",
    name: "风车坡·面粉坊",
    emoji: "🍞",
    group: "windmill",
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000]
  },
  { pos: 20, kind: "park", name: "鸭梨公园", emoji: "🏞️" },
  {
    pos: 21,
    kind: "prop",
    name: "星糖路·棉花糖摊",
    emoji: "🍬",
    group: "sugar",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050]
  },
  { pos: 22, kind: "chance", name: "机会转盘", emoji: "🎡" },
  {
    pos: 23,
    kind: "prop",
    name: "星糖路·焦糖角",
    emoji: "🍮",
    group: "sugar",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050]
  },
  {
    pos: 24,
    kind: "prop",
    name: "星糖路·糖霜坊",
    emoji: "🧁",
    group: "sugar",
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100]
  },
  { pos: 25, kind: "station", name: "西站", emoji: "🚉", price: 200 },
  {
    pos: 26,
    kind: "prop",
    name: "图书馆大街·绘本厅",
    emoji: "📚",
    group: "library",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150]
  },
  {
    pos: 27,
    kind: "prop",
    name: "图书馆大街·手抄室",
    emoji: "✒️",
    group: "library",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150]
  },
  { pos: 28, kind: "util", name: "风车站", emoji: "🌬️", price: 150 },
  {
    pos: 29,
    kind: "prop",
    name: "图书馆大街·朗读廊",
    emoji: "🗣️",
    group: "library",
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200]
  },
  { pos: 30, kind: "jail", name: "反思角", emoji: "🪑" },
  {
    pos: 31,
    kind: "prop",
    name: "天文台坡·望远镜台",
    emoji: "🔭",
    group: "observatory",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275]
  },
  {
    pos: 32,
    kind: "prop",
    name: "天文台坡·星图室",
    emoji: "🗺️",
    group: "observatory",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275]
  },
  { pos: 33, kind: "fate", name: "命运信箱", emoji: "💌" },
  {
    pos: 34,
    kind: "prop",
    name: "天文台坡·流星坪",
    emoji: "☄️",
    group: "observatory",
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400]
  },
  { pos: 35, kind: "station", name: "北站", emoji: "🚉", price: 200 },
  { pos: 36, kind: "chance", name: "机会转盘", emoji: "🎡" },
  {
    pos: 37,
    kind: "prop",
    name: "月亮广场·银河阶",
    emoji: "🌌",
    group: "moon",
    price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500]
  },
  { pos: 38, kind: "tax", name: "图书捐箱", emoji: "📦", tax: 75 },
  {
    pos: 39,
    kind: "prop",
    name: "月亮广场·满月顶",
    emoji: "🌕",
    group: "moon",
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000]
  }
];

/** 车站按持有数收租：1 站 25、2 站 50、3 站 100、4 站 200 */
export const STATION_RENT: readonly number[] = [0, 25, 50, 100, 200];

/** 公共设施按骰子点数收租：持 1 家 ×4，持 2 家 ×10 */
export const UTIL_MULTIPLIER: readonly number[] = [0, 4, 10];

/** 全部车站的格号 */
export const STATION_TILES: readonly number[] = BOARD.filter((t) => t.kind === "station").map((t) => t.pos);

/** 全部公共设施的格号 */
export const UTIL_TILES: readonly number[] = BOARD.filter((t) => t.kind === "util").map((t) => t.pos);

/** 能被买下来的格子（地块 + 车站 + 设施） */
export const BUYABLE_TILES: readonly number[] = BOARD.filter(
  (t) => t.kind === "prop" || t.kind === "station" || t.kind === "util"
).map((t) => t.pos);

/** 某个色组包含哪几格 */
export function groupTiles(group: ColorGroup): number[] {
  return BOARD.filter((t) => t.group === group).map((t) => t.pos);
}

/** 色组 → 格号列表（查表，避免每次 filter） */
export const GROUP_TILES: Readonly<Record<ColorGroup, readonly number[]>> = COLOR_GROUPS.reduce(
  (acc, g) => {
    acc[g.id] = groupTiles(g.id);
    return acc;
  },
  {} as Record<ColorGroup, readonly number[]>
);

/** 取某一格，越界会绕回环线内，绝不返回 undefined */
export function tileAt(pos: number): Tile {
  const p = ((Math.round(pos) % BOARD_LEN) + BOARD_LEN) % BOARD_LEN;
  return BOARD[p];
}

/** 这一格能不能买 */
export function isBuyable(pos: number): boolean {
  const k = tileAt(pos).kind;
  return k === "prop" || k === "station" || k === "util";
}

/** 抵押价：售价的一半 */
export function mortgageValue(pos: number): number {
  return Math.floor((tileAt(pos).price ?? 0) / 2);
}

/**
 * 赎回价：抵押价 × 110%（向上取整，不让玩家白赚零头）。
 * 用整数百分比算，免得 200 × 1.1 变成 220.000000…3 再被向上取整成 221。
 */
export function unmortgageCost(pos: number): number {
  return Math.ceil((mortgageValue(pos) * Math.round(UNMORTGAGE_RATE * 100)) / 100);
}

/** 接手抵押地要交的手续费：抵押价的 10% */
export function transferFee(pos: number): number {
  return Math.ceil((mortgageValue(pos) * Math.round(TRANSFER_FEE_RATE * 100)) / 100);
}

/** 这一格盖一栋要多少钱（不是地块就返回 0） */
export function houseCostOf(pos: number): number {
  const t = tileAt(pos);
  return t.group ? groupInfo(t.group).houseCost : 0;
}

/** 拆一栋退回一半 */
export function houseSellValue(pos: number): number {
  return Math.floor(houseCostOf(pos) / 2);
}

/** 房屋数写成中文（0 栋是空地，5 栋是大屋） */
export function housesLabel(houses: number): string {
  const n = Math.max(0, Math.min(MAX_HOUSES, Math.round(houses)));
  if (n === 0) return "空地";
  if (n === MAX_HOUSES) return "大屋";
  return `${n} 栋小屋`;
}

/**
 * 棋盘四边的方向：0=下边（从右往左）、1=左边（从下往上）、2=上边（从左往右）、3=右边（从上往下）。
 * 只给界面排格子用，规则层用不上。
 */
export function sideOf(pos: number): 0 | 1 | 2 | 3 {
  const p = ((Math.round(pos) % BOARD_LEN) + BOARD_LEN) % BOARD_LEN;
  if (p < 10) return 0;
  if (p < 20) return 1;
  if (p < 30) return 2;
  return 3;
}

/** 11×11 网格里这一格该放在第几行第几列（1 起，给 CSS Grid 用） */
export function gridCell(pos: number): { row: number; col: number } {
  const p = ((Math.round(pos) % BOARD_LEN) + BOARD_LEN) % BOARD_LEN;
  if (p <= 10) return { row: 11, col: 11 - p };
  if (p <= 20) return { row: 11 - (p - 10), col: 1 };
  if (p <= 30) return { row: 1, col: 1 + (p - 20) };
  return { row: 1 + (p - 30), col: 11 };
}
