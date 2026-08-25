// 彩虹跑跑 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 99 关九大主题世界跑酷战役:青草→云朵→糖果→森林→海滩→沙漠→冰雪→火山→星夜。
// 每个世界 11 关(8 关手写 + 3 关生成),每关一个小任务,先选世界再选关。

/* ---------------- 操作 ---------------- */

export type SwipeDir = "left" | "right" | "up" | "down";

/** 根据滑动位移判断方向;太短就不算滑动。 */
export function detectSwipe(dx: number, dy: number, minDist = 24): SwipeDir | null {
  if (Math.hypot(dx, dy) < minDist) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export type ObstacleKind =
  | "rock" // 大软糖:只能换道躲
  | "hurdle" // 小栅栏:跳过去
  | "bar" // 彩虹杆:趴过去
  | "pit" // 坑洞:必须跳
  | "cloudy" // 云朵怪:会左右飘,只能躲
  | "roller" // 滚滚球:滚得比路还快,只能躲
  | "zapper"; // 电光门:周期通电,亮的时候碰不得

export type PlayerAction = "run" | "jump" | "slide";

/** 只能换道躲、跳趴都没用的障碍。 */
const BLOCKING = new Set<ObstacleKind>(["rock", "cloudy", "roller", "zapper"]);

/** 同一车道相遇时会不会撞上。 */
export function wouldHit(kind: ObstacleKind, action: PlayerAction): boolean {
  if (kind === "hurdle" || kind === "pit") return action !== "jump";
  if (kind === "bar") return action !== "slide";
  return true; // rock / cloudy / roller / zapper 只能换道
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(2, lane));
}

/* ---------------- 电光门 ---------------- */

export const ZAPPER_ON = 1.1;
export const ZAPPER_OFF = 1.6;

/** 电光门在 time 时是否通电(offset 让每扇门错开)。 */
export function zapperActive(time: number, offset: number): boolean {
  const cycle = ZAPPER_ON + ZAPPER_OFF;
  const t = (time + offset) % cycle;
  return t < ZAPPER_ON;
}

/** 滚滚球比路面快多少倍。 */
export const ROLLER_SPEED_MULT = 1.45;

/* ---------------- 主题世界 ---------------- */

export type Theme =
  | "grass"
  | "sky"
  | "candy"
  | "forest"
  | "beach"
  | "desert"
  | "snow"
  | "lava"
  | "space";

export const THEME_ORDER: Theme[] = [
  "grass",
  "sky",
  "candy",
  "forest",
  "beach",
  "desert",
  "snow",
  "lava",
  "space",
];

/** 每章 11 关:8 关手写 + 3 关生成。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;

export interface ThemeStyle {
  name: string;
  emoji: string;
  skyTop: string;
  skyBottom: string;
  lanes: [string, string, string];
  deco: string;
  accent: string;
  /** 本世界会出现的障碍种类(生成关卡从这里选)。 */
  palette: ObstacleKind[];
  blurb: string;
}

export const THEME_STYLE: Record<Theme, ThemeStyle> = {
  grass: {
    name: "青草世界", emoji: "🌱",
    skyTop: "#dff1ff", skyBottom: "#fdeff5",
    lanes: ["#d5f2ca", "#e3f7dc", "#def5d5"],
    deco: "#ffb3c8", accent: "#4a9a5a",
    palette: ["rock", "hurdle", "bar"],
    blurb: "开满小花的新手跑道,学会换道、跳和趴",
  },
  sky: {
    name: "云朵世界", emoji: "☁️",
    skyTop: "#cfe8ff", skyBottom: "#e8f4ff",
    lanes: ["#eef6ff", "#e0ecff", "#e8f0ff"],
    deco: "#ffffff", accent: "#5a8ac9",
    palette: ["rock", "hurdle", "bar", "cloudy", "pit"],
    blurb: "云桥上有坑洞和会飘的云朵怪,小心脚下",
  },
  candy: {
    name: "糖果世界", emoji: "🍬",
    skyTop: "#ffe3ee", skyBottom: "#fff1c9",
    lanes: ["#ffd6e7", "#fff1c9", "#d4f0ff"],
    deco: "#c9a6f2", accent: "#e05a7a",
    palette: ["rock", "hurdle", "bar", "pit", "roller"],
    blurb: "甜甜的跑道上滚滚糖球追着人跑",
  },
  forest: {
    name: "森林世界", emoji: "🌲",
    skyTop: "#cfe8c2", skyBottom: "#eaf7dc",
    lanes: ["#c2e0b2", "#d0e8c2", "#c9e4ba"],
    deco: "#8a5a3a", accent: "#3a7a3a",
    palette: ["rock", "hurdle", "bar", "cloudy", "roller"],
    blurb: "松果滚滚、树影摇摇的绿色大森林",
  },
  beach: {
    name: "海滩世界", emoji: "🏝",
    skyTop: "#ffeccf", skyBottom: "#cfeffc",
    lanes: ["#ffe9c2", "#fff2d8", "#ffedcc"],
    deco: "#2ab8c9", accent: "#c9862a",
    palette: ["rock", "hurdle", "bar", "pit", "cloudy", "roller"],
    blurb: "阳光沙滩,椰子滚滚,浪花边的欢乐跑",
  },
  desert: {
    name: "沙漠世界", emoji: "🌵",
    skyTop: "#ffe2b8", skyBottom: "#ffd0a0",
    lanes: ["#f2d8a8", "#f8e0b5", "#f5dcae"],
    deco: "#4a9a5a", accent: "#b8622a",
    palette: ["rock", "hurdle", "pit", "roller"],
    blurb: "滚石和流沙坑洞的金色沙海,没有彩虹杆",
  },
  snow: {
    name: "冰雪世界", emoji: "❄️",
    skyTop: "#dfefff", skyBottom: "#f8fbff",
    lanes: ["#eaf4fb", "#f2f8fd", "#eef6fc"],
    deco: "#9adcf0", accent: "#4a7ab8",
    palette: ["rock", "hurdle", "bar", "pit", "cloudy", "zapper"],
    blurb: "极光电门第一次亮相!亮的时候千万别碰",
  },
  lava: {
    name: "火山世界", emoji: "🌋",
    skyTop: "#5a2a2a", skyBottom: "#8e4a3a",
    lanes: ["#6e3a35", "#7a453c", "#744038"],
    deco: "#ffb84d", accent: "#e05a3a",
    palette: ["rock", "hurdle", "bar", "pit", "roller", "zapper"],
    blurb: "岩浆边的滚石和电网,最烫的一段路",
  },
  space: {
    name: "星夜世界", emoji: "🌌",
    skyTop: "#3e4468", skyBottom: "#6a6f9e",
    lanes: ["#565c88", "#606694", "#5a608c"],
    deco: "#ffe387", accent: "#8a5ac9",
    palette: ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper"],
    blurb: "全部障碍列队的银河终点,冲向彩虹终点站!",
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
    if (!ob || !BLOCKING.has(ob.kind)) return true;
  }
  return false;
}

export function patternIsSurvivable(pattern: PatternRow[]): boolean {
  return pattern.every(rowIsSurvivable);
}

/** 预设障碍组合:每次取一组连续刷出,像真正的跑酷节奏。 */
export const PATTERNS: PatternRow[][] = [
  // 单软糖换道
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
  // 坑洞跳桥
  [
    { obstacles: [{ lane: 0, kind: "pit" }, { lane: 1, kind: "pit" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 1, kind: "pit" }, { lane: 2, kind: "pit" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 0, kind: "pit" }, { lane: 2, kind: "pit" }], stars: [], coins: [1] },
  ],
  // 坑洞加软糖
  [
    { obstacles: [{ lane: 0, kind: "rock" }, { lane: 1, kind: "pit" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "rock" }, { lane: 1, kind: "pit" }], stars: [1], coins: [] },
    { obstacles: [{ lane: 1, kind: "rock" }], stars: [], coins: [0, 2] },
  ],
  // 云朵怪出没
  [
    { obstacles: [{ lane: 1, kind: "cloudy" }], stars: [], coins: [0, 2] },
    { obstacles: [{ lane: 0, kind: "cloudy" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 2, kind: "cloudy" }], stars: [], coins: [1] },
  ],
  // 云朵怪加跳栏
  [
    { obstacles: [{ lane: 1, kind: "cloudy" }, { lane: 0, kind: "hurdle" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "cloudy" }, { lane: 1, kind: "hurdle" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 0, kind: "bar" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [1] },
  ],
  // 滚滚球单滚
  [
    { obstacles: [{ lane: 1, kind: "roller" }], stars: [], coins: [0, 2] },
    { obstacles: [{ lane: 0, kind: "roller" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 2, kind: "roller" }], stars: [], coins: [1] },
  ],
  // 滚滚球加跳栏
  [
    { obstacles: [{ lane: 0, kind: "roller" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [1] },
    { obstacles: [{ lane: 1, kind: "roller" }, { lane: 0, kind: "hurdle" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 2, kind: "roller" }, { lane: 1, kind: "bar" }], stars: [], coins: [0] },
  ],
  // 双滚球逼位
  [
    { obstacles: [{ lane: 0, kind: "roller" }, { lane: 1, kind: "roller" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 1, kind: "roller" }, { lane: 2, kind: "roller" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 1, kind: "pit" }], stars: [], coins: [0, 2] },
  ],
  // 电光门走廊
  [
    { obstacles: [{ lane: 0, kind: "zapper" }, { lane: 1, kind: "zapper" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 2, kind: "zapper" }], stars: [], coins: [0, 1] },
    { obstacles: [{ lane: 1, kind: "zapper" }, { lane: 2, kind: "zapper" }], stars: [], coins: [0] },
  ],
  // 电光门加软糖
  [
    { obstacles: [{ lane: 0, kind: "zapper" }, { lane: 2, kind: "rock" }], stars: [], coins: [1] },
    { obstacles: [{ lane: 1, kind: "zapper" }, { lane: 0, kind: "rock" }], stars: [2], coins: [] },
    { obstacles: [{ lane: 2, kind: "zapper" }, { lane: 1, kind: "hurdle" }], stars: [], coins: [0] },
  ],
  // 滚球电门混合
  [
    { obstacles: [{ lane: 0, kind: "roller" }, { lane: 1, kind: "zapper" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "roller" }, { lane: 0, kind: "zapper" }], stars: [1], coins: [] },
    { obstacles: [{ lane: 1, kind: "roller" }, { lane: 2, kind: "bar" }], stars: [], coins: [0] },
  ],
];

/** 只挑"用到的障碍全都在 allowed 里"的花样组。 */
export function patternsForKinds(allowed: ReadonlyArray<ObstacleKind>): PatternRow[][] {
  const set = new Set(allowed);
  return PATTERNS.filter((pat) =>
    pat.every((row) => row.obstacles.every((o) => set.has(o.kind))),
  );
}

/* ---------------- 任务 ---------------- */

export type MissionType = "coins" | "stars" | "dodge" | "noHit";

export interface Mission {
  type: MissionType;
  n: number;
}

export interface RunStats {
  coins: number;
  stars: number;
  dodged: number;
  heartsLost: number;
}

export function missionProgress(mission: Mission, stats: RunStats): number {
  if (mission.type === "coins") return Math.min(stats.coins, mission.n);
  if (mission.type === "stars") return Math.min(stats.stars, mission.n);
  if (mission.type === "dodge") return Math.min(stats.dodged, mission.n);
  return stats.heartsLost === 0 ? 1 : 0;
}

export function missionDone(mission: Mission, stats: RunStats): boolean {
  if (mission.type === "noHit") return stats.heartsLost === 0;
  return missionProgress(mission, stats) >= mission.n;
}

export function missionLabel(mission: Mission): string {
  if (mission.type === "coins") return `吃到 ${mission.n} 颗糖果币`;
  if (mission.type === "stars") return `捡到 ${mission.n} 颗小星星`;
  if (mission.type === "dodge") return `躲过 ${mission.n} 个障碍`;
  return "一路不撞到终点";
}

/* ---------------- 关卡 ---------------- */

export type PowerKind = "magnet" | "jet" | "board";

export interface LevelDef {
  name: string;
  world: Theme;
  /** 赛道长度(像素) */
  len: number;
  /** 基础滚动速度(像素/秒) */
  speed: number;
  obstacleKinds: ObstacleKind[];
  powerups: PowerKind[];
  mission: Mission;
  feature: string;
  /** 生成器产出的关卡 */
  gen?: boolean;
  hint: string;
}

/** idx(0 起)关属于哪个世界。 */
export function themeOfLevel(idx: number): Theme {
  return THEME_ORDER[Math.floor(idx / LEVELS_PER_THEME)];
}

/** 章节 ci(0 起)包含的关卡下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LEVELS_PER_THEME; i++) out.push(ci * LEVELS_PER_THEME + i);
  return out;
}

/** 关卡在章内位置(0-10)对应的速度与长度,越靠后越快越长。 */
function speedFor(worldIdx: number, pos: number): number {
  return 235 + worldIdx * 20 + pos * 5;
}
function lenFor(worldIdx: number, pos: number): number {
  return 1450 + worldIdx * 170 + pos * 60;
}

/** 手写关卡的简写构造器(速度/长度按世界和章内位置自动升级)。 */
function L(
  worldIdx: number,
  pos: number,
  name: string,
  kinds: ObstacleKind[],
  powerups: PowerKind[],
  mission: Mission,
  feature: string,
  hint: string,
): LevelDef {
  return {
    name,
    world: THEME_ORDER[worldIdx],
    len: lenFor(worldIdx, pos),
    speed: speedFor(worldIdx, pos),
    obstacleKinds: kinds,
    powerups,
    mission,
    feature,
    hint,
  };
}

/* ---- 生成关卡:每章 3 关,障碍组合+任务不与本章手写关重复 ---- */

const GEN_KINDS: Record<Theme, ObstacleKind[][]> = {
  grass: [["hurdle"], ["rock", "hurdle"], ["hurdle", "bar"]],
  sky: [["bar", "cloudy"], ["bar", "pit"], ["hurdle", "cloudy"]],
  candy: [["bar", "roller"], ["pit", "roller"], ["rock", "hurdle", "roller"]],
  forest: [["cloudy", "roller"], ["rock", "bar", "cloudy"], ["hurdle", "roller"]],
  beach: [["rock", "pit", "cloudy"], ["bar", "pit", "roller"], ["hurdle", "cloudy", "roller"]],
  desert: [["rock", "roller"], ["hurdle", "pit"], ["hurdle", "pit", "roller"]],
  snow: [["cloudy", "zapper"], ["rock", "hurdle", "zapper"], ["bar", "pit", "zapper"]],
  lava: [["rock", "roller", "zapper"], ["bar", "pit", "zapper"], ["hurdle", "roller"]],
  space: [["pit", "roller", "zapper"], ["rock", "cloudy", "zapper"], ["bar", "cloudy", "roller"]],
};

function genLevel(worldIdx: number, sub: number): LevelDef {
  const world = THEME_ORDER[worldIdx];
  const st = THEME_STYLE[world];
  const kinds = GEN_KINDS[world][sub];
  const mission: Mission =
    sub === 0
      ? { type: "coins", n: 15 + worldIdx * 4 }
      : sub === 1
        ? { type: "dodge", n: 12 + worldIdx * 4 }
        : { type: "stars", n: 4 + Math.floor(worldIdx / 2) };
  const pos = 6 + sub;
  return {
    name: `${st.name}加时赛 ${sub + 1} 号`,
    world,
    len: lenFor(worldIdx, pos),
    speed: speedFor(worldIdx, pos),
    obstacleKinds: kinds,
    powerups: worldIdx === 0 ? ["magnet"] : worldIdx === 1 ? ["magnet", "jet"] : ["magnet", "jet", "board"],
    mission,
    feature: `${st.name}加时赛${sub + 1}号`,
    gen: true,
    hint: `${st.name}的加时小考!这段路只考 ${kinds.length} 种障碍`,
  };
}

/** 一章 = 6 关手写 + 3 关生成 + 手写挑战关 + 手写终点关。 */
function buildWorld(worldIdx: number, hand: LevelDef[]): LevelDef[] {
  if (hand.length !== HANDMADE_PER_THEME) {
    throw new Error(`world ${worldIdx} 手写关数量应为 ${HANDMADE_PER_THEME}`);
  }
  return [
    ...hand.slice(0, 6),
    genLevel(worldIdx, 0),
    genLevel(worldIdx, 1),
    genLevel(worldIdx, 2),
    hand[6],
    hand[7],
  ];
}

/* ---- 第 1 章 · 青草世界 ---- */
const grassHand: LevelDef[] = [
  L(0, 0, "青草热身跑", ["rock"], [], { type: "coins", n: 10 }, "入门换道", "左右滑换道躲大软糖,吃糖果币!"),
  L(0, 1, "跳跳栏比赛", ["rock", "hurdle"], [], { type: "coins", n: 12 }, "跳栏登场", "上滑跳过小栅栏!"),
  L(0, 2, "趴趴杆隧道", ["rock", "hurdle", "bar"], [], { type: "noHit", n: 1 }, "趴杆登场", "下滑趴过彩虹杆!挑战一路不撞"),
  L(0, 3, "花田三连拍", ["hurdle", "bar"], [], { type: "stars", n: 3 }, "跳趴节奏", "跳、趴混着来,捡小星星!"),
  L(0, 4, "磁铁小站", ["rock", "bar"], ["magnet"], { type: "coins", n: 18 }, "磁铁道具", "吃到🧲磁铁,糖果币自己飞过来!"),
  L(0, 5, "彩虹杆走廊", ["bar"], ["magnet"], { type: "dodge", n: 12 }, "趴杆走廊", "一整条趴杆走廊,贴地滑行!"),
  L(0, 9, "青草毕业跑", ["rock", "hurdle", "bar"], ["magnet"], { type: "dodge", n: 20 }, "青草毕业考", "青草世界学的全用上!"),
  L(0, 10, "青草终点冲刺", ["rock", "hurdle", "bar"], ["magnet"], { type: "coins", n: 25 }, "青草终点", "冲过花田,下一站云朵世界!"),
];

/* ---- 第 2 章 · 云朵世界 ---- */
const skyHand: LevelDef[] = [
  L(1, 0, "云朵桥入口", ["rock", "hurdle", "bar", "cloudy"], ["magnet"], { type: "dodge", n: 15 }, "云朵怪登场", "云朵怪会左右飘!看准再换道"),
  L(1, 1, "坑坑云桥", ["rock", "hurdle", "pit"], ["magnet"], { type: "coins", n: 20 }, "坑洞登场", "云桥上有洞!必须跳过去"),
  L(1, 2, "喷气鞋试飞", ["rock", "hurdle", "bar", "pit"], ["jet", "magnet"], { type: "coins", n: 25 }, "喷气鞋道具", "吃到🚀喷气鞋,飞起来什么都不怕!"),
  L(1, 3, "云中穿梭", ["rock", "hurdle", "bar", "pit", "cloudy"], ["jet", "magnet"], { type: "dodge", n: 25 }, "云端全家福", "所有云朵障碍都来啦!"),
  L(1, 4, "云洞二重奏", ["cloudy", "pit"], ["jet"], { type: "stars", n: 4 }, "云洞二重奏", "飘云和坑洞轮流上场"),
  L(1, 5, "飘云无伤路", ["rock", "cloudy"], ["magnet"], { type: "noHit", n: 1 }, "飘云无伤", "云朵怪飘来飘去,挑战不撞!"),
  L(1, 9, "云端冲刺", ["rock", "hurdle", "bar", "cloudy"], ["jet"], { type: "noHit", n: 1 }, "高速无伤挑战", "风好大!挑战一路不撞"),
  L(1, 10, "云朵终点站", ["rock", "hurdle", "bar", "pit", "cloudy"], ["jet", "magnet"], { type: "coins", n: 30 }, "云朵终点", "跳下云桥就是糖果世界!"),
];

/* ---- 第 3 章 · 糖果世界 ---- */
const candyHand: LevelDef[] = [
  L(2, 0, "糖果谷入口", ["rock", "hurdle", "bar", "pit"], ["magnet", "jet"], { type: "coins", n: 25 }, "糖果章开场", "欢迎来到糖果世界!"),
  L(2, 1, "滑板时间", ["rock", "hurdle", "bar", "pit"], ["board", "magnet"], { type: "coins", n: 30 }, "滑板二段跳", "吃到🛹滑板:能二段跳,还帮你挡一次!"),
  L(2, 2, "糖果雨", ["rock", "hurdle", "bar"], ["magnet", "board"], { type: "coins", n: 40 }, "金币暴雨", "满天都是糖果币,能吃多少吃多少!"),
  L(2, 3, "滚滚糖球道", ["roller"], ["board"], { type: "dodge", n: 10 }, "滚滚球登场", "滚滚糖球比路还快!赶紧换道"),
  L(2, 4, "糖球夹心路", ["rock", "roller"], ["board", "magnet"], { type: "noHit", n: 1 }, "糖球夹心", "软糖挡路,糖球追尾,一下都别碰!"),
  L(2, 5, "弹跳糖山", ["hurdle", "pit", "roller"], ["board", "jet"], { type: "dodge", n: 22 }, "弹跳糖山", "连着跳!滑板二段跳更稳"),
  L(2, 9, "糖果马拉松", ["rock", "hurdle", "bar", "pit", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 30 }, "糖果毕业考", "最长的一段糖果路,加油!"),
  L(2, 10, "糖果终点站", ["rock", "hurdle", "bar", "pit", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 45 }, "糖果终点", "甜甜的终点,前面是大森林!"),
];

/* ---- 第 4 章 · 森林世界 ---- */
const forestHand: LevelDef[] = [
  L(3, 0, "森林小路", ["rock", "hurdle", "bar"], ["magnet", "board"], { type: "coins", n: 28 }, "森林开场", "树影下的小路,先热热身"),
  L(3, 1, "松果滚滚", ["rock", "cloudy", "roller"], ["board"], { type: "dodge", n: 18 }, "松果滚滚", "滚下来的是大松果!别接"),
  L(3, 2, "树影跳趴", ["hurdle", "bar", "cloudy"], ["jet"], { type: "stars", n: 5 }, "树影跳趴", "跳过树根,趴过树枝!"),
  L(3, 3, "无伤穿林", ["rock", "hurdle", "roller"], ["magnet"], { type: "noHit", n: 1 }, "无伤穿林", "安安静静穿过森林,一下都不撞"),
  L(3, 4, "藤蔓走廊", ["bar", "roller"], ["board", "magnet"], { type: "coins", n: 32 }, "藤蔓走廊", "低垂的藤蔓全要趴着过!"),
  L(3, 5, "雾中精灵", ["rock", "hurdle", "bar", "cloudy"], ["jet", "board"], { type: "dodge", n: 28 }, "雾中精灵", "雾里的云朵精灵飘忽不定"),
  L(3, 9, "森林毕业跑", ["rock", "hurdle", "bar", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 35 }, "森林毕业考", "森林全体障碍来送行!"),
  L(3, 10, "森林终点", ["rock", "hurdle", "bar", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 40 }, "森林终点", "穿出森林就能看到海啦!"),
];

/* ---- 第 5 章 · 海滩世界 ---- */
const beachHand: LevelDef[] = [
  L(4, 0, "沙滩开跑", ["rock", "hurdle", "pit"], ["magnet", "board"], { type: "coins", n: 30 }, "沙滩开场", "沙子软软的,坑洞可不软!"),
  L(4, 1, "海风泡泡", ["rock", "bar", "cloudy"], ["jet"], { type: "stars", n: 5 }, "海风泡泡", "海风吹着泡泡云飘来飘去"),
  L(4, 2, "浪花跳跳", ["hurdle", "pit", "cloudy"], ["jet", "magnet"], { type: "dodge", n: 25 }, "浪花跳跳", "跟着浪花的节奏起跳!"),
  L(4, 3, "椰子滚滚", ["rock", "hurdle", "bar", "roller"], ["board"], { type: "coins", n: 35 }, "椰子滚滚", "树上掉下来的椰子满地滚!"),
  L(4, 4, "沙坑无伤挑战", ["pit", "roller"], ["board", "jet"], { type: "noHit", n: 1 }, "沙坑无伤", "全是坑和椰子,一下都别碰!"),
  L(4, 5, "海滩全家福", ["rock", "hurdle", "bar", "pit", "cloudy"], ["magnet", "jet", "board"], { type: "dodge", n: 30 }, "海滩全家福", "海滩上见过的全来啦"),
  L(4, 9, "沙滩毕业跑", ["rock", "hurdle", "bar", "pit", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 38 }, "海滩毕业考", "六种障碍的沙滩大考!"),
  L(4, 10, "海滩终点", ["rock", "hurdle", "bar", "pit", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 48 }, "海滩终点", "跑过灯塔,沙漠就在前面!"),
];

/* ---- 第 6 章 · 沙漠世界 ---- */
const desertHand: LevelDef[] = [
  L(5, 0, "沙海起跑线", ["rock", "hurdle"], ["magnet", "board"], { type: "coins", n: 32 }, "沙漠开场", "热热的沙海,注意补水哦!"),
  L(5, 1, "流沙坑洞", ["rock", "pit"], ["jet"], { type: "dodge", n: 26 }, "流沙坑洞", "流沙坑一个接一个,跳稳!"),
  L(5, 2, "滚石阵", ["hurdle", "roller"], ["board"], { type: "stars", n: 6 }, "滚石阵", "大滚石从沙丘上冲下来!"),
  L(5, 3, "海市蜃楼", ["rock", "hurdle", "pit"], ["magnet"], { type: "noHit", n: 1 }, "海市蜃楼无伤", "别被幻影骗了,一下都不撞!"),
  L(5, 4, "龙卷滚石", ["pit", "roller"], ["jet", "board"], { type: "coins", n: 38 }, "龙卷滚石", "坑洞加滚石,眼睛要够快"),
  L(5, 5, "落石峡谷", ["rock", "hurdle", "roller"], ["board", "magnet"], { type: "dodge", n: 32 }, "落石峡谷", "峡谷里滚石特别多!"),
  L(5, 9, "沙漠毕业跑", ["rock", "hurdle", "pit", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 40 }, "沙漠毕业考", "沙漠全部障碍一起上!"),
  L(5, 10, "沙漠终点", ["rock", "hurdle", "pit", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 50 }, "沙漠终点", "翻过最后一座沙丘就是雪山!"),
];

/* ---- 第 7 章 · 冰雪世界 ---- */
const snowHand: LevelDef[] = [
  L(6, 0, "雪原开跑", ["rock", "hurdle", "bar"], ["magnet", "board"], { type: "coins", n: 35 }, "冰雪开场", "脚下滑滑的,转弯要提前!"),
  L(6, 1, "极光电门", ["zapper"], ["magnet"], { type: "dodge", n: 15 }, "电光门登场", "极光电门亮的时候碰不得!等灭了再过"),
  L(6, 2, "电门滑冰场", ["rock", "zapper"], ["board"], { type: "stars", n: 6 }, "电门滑冰", "在电门间滑来滑去捡星星"),
  L(6, 3, "冰桥电网", ["hurdle", "bar", "zapper"], ["jet"], { type: "dodge", n: 30 }, "冰桥电网", "跳栏趴杆加电门,节奏全开!"),
  L(6, 4, "冰面无伤挑战", ["rock", "hurdle", "pit"], ["magnet", "jet"], { type: "noHit", n: 1 }, "冰面无伤", "冰面太滑,更要稳稳地跑!"),
  L(6, 5, "暴风雪电门", ["pit", "cloudy", "zapper"], ["jet", "board"], { type: "coins", n: 42 }, "暴风雪电门", "雪云飘,电门闪,坑洞藏!"),
  L(6, 9, "冰雪毕业跑", ["rock", "hurdle", "bar", "pit", "cloudy", "zapper"], ["magnet", "jet", "board"], { type: "dodge", n: 42 }, "冰雪毕业考", "冰雪世界全障碍大考!"),
  L(6, 10, "冰雪终点", ["rock", "hurdle", "bar", "pit", "cloudy", "zapper"], ["magnet", "jet", "board"], { type: "coins", n: 52 }, "冰雪终点", "雪山那边红红的就是火山!"),
];

/* ---- 第 8 章 · 火山世界 ---- */
const lavaHand: LevelDef[] = [
  L(7, 0, "火山口起跑", ["rock", "hurdle", "pit"], ["magnet", "board"], { type: "coins", n: 38 }, "火山开场", "地上烫烫的,跑快点!"),
  L(7, 1, "岩浆滚石", ["roller", "zapper"], ["jet"], { type: "dodge", n: 28 }, "岩浆滚石电门", "火滚石加电网,超刺激!"),
  L(7, 2, "火石走廊", ["rock", "bar", "roller"], ["board"], { type: "stars", n: 7 }, "火石走廊", "趴着躲热浪,再闪开滚石!"),
  L(7, 3, "喷发电网", ["hurdle", "pit", "zapper"], ["jet", "magnet"], { type: "dodge", n: 35 }, "喷发电网", "火山要喷发,电网全亮了!"),
  L(7, 4, "熔岩之桥", ["rock", "hurdle", "bar", "roller"], ["board", "magnet"], { type: "coins", n: 45 }, "熔岩之桥", "桥下就是岩浆,别掉下去!"),
  L(7, 5, "火山无伤挑战", ["rock", "pit", "roller", "zapper"], ["jet", "board"], { type: "noHit", n: 1 }, "火山无伤", "最烫的路,一下都不能碰!"),
  L(7, 9, "火山毕业跑", ["rock", "hurdle", "bar", "pit", "roller", "zapper"], ["magnet", "jet", "board"], { type: "dodge", n: 45 }, "火山毕业考", "火山全障碍喷发式大考!"),
  L(7, 10, "火山终点", ["rock", "hurdle", "bar", "pit", "roller", "zapper"], ["magnet", "jet", "board"], { type: "coins", n: 55 }, "火山终点", "冲出火山,夜空的星星在等你!"),
];

/* ---- 第 9 章 · 星夜世界 ---- */
const spaceHand: LevelDef[] = [
  L(8, 0, "星夜大门", ["rock", "hurdle", "bar", "pit"], ["magnet", "jet"], { type: "stars", n: 7 }, "星夜章开场", "夜空亮晶晶,星星特别多!"),
  L(8, 1, "流星阵", ["rock", "hurdle", "cloudy"], ["jet", "board"], { type: "dodge", n: 35 }, "云怪流星群", "一大群会飘的流星云!"),
  L(8, 2, "星光坑洞", ["rock", "pit", "bar"], ["board", "magnet"], { type: "noHit", n: 1 }, "坑洞无伤挑战", "星桥到处是洞,跳稳一点!"),
  L(8, 3, "银河滚石带", ["cloudy", "roller", "zapper"], ["jet"], { type: "dodge", n: 40 }, "银河滚石电门", "滚石、电门和流星云一起转!"),
  L(8, 4, "极速银河", ["rock", "hurdle", "bar", "pit", "cloudy"], ["magnet", "jet", "board"], { type: "coins", n: 50 }, "全障碍极速", "最快的一关!所有老朋友一起上"),
  L(8, 5, "星轨电门", ["hurdle", "bar", "roller", "zapper"], ["board"], { type: "stars", n: 8 }, "星轨电门", "沿着星轨跳趴,躲开电门!"),
  L(8, 9, "银河毕业跑", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper"], ["magnet", "jet", "board"], { type: "dodge", n: 50 }, "银河毕业考", "全部七种障碍的终极大考!"),
  L(8, 10, "彩虹终点站", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper"], ["magnet", "jet", "board"], { type: "coins", n: 60 }, "最终大关", "冲过这里就是彩虹终点!!"),
];

export const LEVELS: LevelDef[] = [
  ...buildWorld(0, grassHand),
  ...buildWorld(1, skyHand),
  ...buildWorld(2, candyHand),
  ...buildWorld(3, forestHand),
  ...buildWorld(4, beachHand),
  ...buildWorld(5, desertHand),
  ...buildWorld(6, snowHand),
  ...buildWorld(7, lavaHand),
  ...buildWorld(8, spaceHand),
];

/* ---------------- 道具 ---------------- */

export const MAGNET_SECONDS = 6;
export const JET_SECONDS = 3.5;
export const BOARD_SECONDS = 9;
export const MAX_HEARTS = 3;
/** 复活要花的星星(平台星星余额)。 */
export const REVIVE_COST = 3;

/* ---------------- 结算与进度 ---------------- */

/** 单关星级:任务完成+不掉心 3 星;完成任务或不掉心 2 星;跑到终点 1 星。 */
export function starsForLevel(missionOk: boolean, heartsLost: number): 1 | 2 | 3 {
  if (missionOk && heartsLost === 0) return 3;
  if (missionOk || heartsLost === 0) return 2;
  return 1;
}

export const PROGRESS_KEY = "yiduo-yixing.rainbow-run.campaign.v2";

export function parseProgress(raw: string | null, count: number): number[] {
  const out = new Array<number>(count).fill(0);
  if (!raw) return out;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      for (let i = 0; i < Math.min(arr.length, count); i++) {
        const v = arr[i];
        if (typeof v === "number") out[i] = Math.max(0, Math.min(3, Math.round(v)));
      }
    }
  } catch {
    // 坏档当新档
  }
  return out;
}

export function serializeProgress(stars: ReadonlyArray<number>): string {
  return JSON.stringify(stars);
}

export function isLevelUnlocked(stars: ReadonlyArray<number>, idx: number): boolean {
  if (idx <= 0) return true;
  return (stars[idx - 1] ?? 0) > 0;
}

/** 章节解锁:上一章终点关通过即可。 */
export function isThemeUnlocked(stars: ReadonlyArray<number>, themeIdx: number): boolean {
  return isLevelUnlocked(stars, themeIdx * LEVELS_PER_THEME);
}

/** 本章已得的星星数。 */
export function themeStars(stars: ReadonlyArray<number>, themeIdx: number): number {
  let s = 0;
  for (const i of levelIndicesOfTheme(themeIdx)) s += stars[i] ?? 0;
  return s;
}

/** 本章已通过的关卡数。 */
export function themeCleared(stars: ReadonlyArray<number>, themeIdx: number): number {
  let n = 0;
  for (const i of levelIndicesOfTheme(themeIdx)) if ((stars[i] ?? 0) > 0) n++;
  return n;
}

export function totalStars(stars: ReadonlyArray<number>): number {
  return stars.reduce((s, v) => s + v, 0);
}
