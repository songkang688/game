// 彩虹跑跑 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 经典战役 99 关九大主题世界:青草→云朵→糖果→森林→海滩→沙漠→冰雪→火山→星夜,
// 每个世界 11 关(8 关手写 + 3 关生成),每关一个小任务,先选世界再选关。
// 1.1:末尾追加三个新世界(霓虹地铁站 30 / 云上索道 30 / 星屑隧道 29)补足 188 关,
// 带来彩纸箱(可破坏)、加速滑轨、三连完美跳节奏段、随机分岔路线四种新机制,
// 以及三位章节大王。前 99 关的数据一字不动。

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
  | "zapper" // 电光门:周期通电,亮的时候碰不得
  | "crate"; // 1.1 彩纸箱:可破坏,下滑铲碎或起跳越过,平跑会撞

export type PlayerAction = "run" | "jump" | "slide";

/** 只能换道躲、跳趴都没用的障碍。 */
const BLOCKING = new Set<ObstacleKind>(["rock", "cloudy", "roller", "zapper"]);

/** 同一车道相遇时会不会撞上。 */
export function wouldHit(kind: ObstacleKind, action: PlayerAction): boolean {
  if (kind === "hurdle" || kind === "pit") return action !== "jump";
  if (kind === "bar") return action !== "slide";
  // 彩纸箱是唯一「两种动作都有解」的障碍:铲碎或越过都行
  if (kind === "crate") return action === "run";
  return true; // rock / cloudy / roller / zapper 只能换道
}

/* ---------------- 1.1 机制一:可破坏的彩纸箱 ---------------- */

/** 只有下滑铲过去才算把彩纸箱撞碎(起跳只是越过,不计数)。 */
export function smashesCrate(kind: ObstacleKind, action: PlayerAction): boolean {
  return kind === "crate" && action === "slide";
}

/** 撞碎一个彩纸箱给的分数。 */
export const CRATE_SCORE = 12;

/* ---------------- 1.1 机制二:加速滑轨 ---------------- */

/** 踩上滑轨后加速持续多久(秒)。 */
export const RAIL_SECONDS = 2.8;
/** 滑轨加速倍率:跑得更快,留给自己的反应窗口也更短。 */
export const RAIL_SPEED_MULT = 1.32;

/** 当前该用的滑轨倍率。 */
export function railSpeedMult(railTimer: number): number {
  return railTimer > 0 ? RAIL_SPEED_MULT : 1;
}

/* ---------------- 1.1 机制三:三连完美跳节奏段 ---------------- */

/** 起跳后多久之内蹭过障碍算「完美跳」:越接近障碍才起跳越精准。 */
export const PERFECT_WINDOW = 0.26;
/** 连续几次完美跳算完成一组。 */
export const PERFECT_STREAK_GOAL = 3;

/**
 * 这一次跨越是不是完美跳(elapsed = 起跳到蹭过障碍之间的秒数)。
 * 只判定「起跳后跨过的第一个障碍」:一跳带过两道栏时,第二道不参与连击判定,
 * 既不算完美也不清零——不然节奏段会因为跳得太远反而断连,那不讲道理。
 */
export function isPerfectJump(elapsed: number): boolean {
  return elapsed >= 0 && elapsed <= PERFECT_WINDOW;
}

/** 完美跳连击计数:完美就 +1,失手清零;满一组回到 0 重新数。 */
export function nextPerfectStreak(streak: number, perfect: boolean): number {
  if (!perfect) return 0;
  const next = streak + 1;
  return next >= PERFECT_STREAK_GOAL ? 0 : next;
}

/** 这一次完美跳有没有刚好凑满一组三连。 */
export function completesPerfectRun(streak: number, perfect: boolean): boolean {
  return perfect && streak + 1 >= PERFECT_STREAK_GOAL;
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

/* ---------------- 跑图节拍(渲染层与模拟器共用一套) ---------------- */

/** 一次跳跃在空中停留多久(秒)。 */
export const JUMP_TIME = 0.55;
/** 一次下滑贴地多久(秒)。 */
export const SLIDE_TIME = 0.6;
/** 判定为「撞上/蹭过」的纵向窗口(像素)。 */
export const HIT_WINDOW = 34;
/** 每跑多远刷一行花样(像素)。 */
export const ROW_GAP = 250;

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
  | "space"
  // ---- 1.1 新世界 ----
  | "neon"
  | "ropeway"
  | "stardust";

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
  "neon",
  "ropeway",
  "stardust",
];

/** 经典九章每章 11 关:8 关手写 + 3 关生成。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;
/** 1.0 战役规模:9 章 99 关,1.1 只在末尾追加。 */
export const CLASSIC_THEME_COUNT = 9;
export const CLASSIC_LEVEL_COUNT = CLASSIC_THEME_COUNT * LEVELS_PER_THEME;

/** 1.1 变长章节:前 9 章各 11 关,新三章 30/30/29 关,共 188 关。 */
export const THEME_SIZES: number[] = [11, 11, 11, 11, 11, 11, 11, 11, 11, 30, 30, 29];
export const TOTAL_LEVELS = THEME_SIZES.reduce((s, n) => s + n, 0);

/** 1.1 新世界的集合:只有这三章会用到彩纸箱、滑轨、分岔这些新花样。 */
export const NEW_THEMES: ReadonlySet<Theme> = new Set<Theme>(["neon", "ropeway", "stardust"]);

/** 章节 ci 的第一关下标。 */
export function themeOffset(ci: number): number {
  let off = 0;
  for (let i = 0; i < ci; i++) off += THEME_SIZES[i];
  return off;
}

/** 章节 ci 的关卡数。 */
export function themeSize(ci: number): number {
  return THEME_SIZES[ci];
}

/** 关卡下标 → 章节下标(0 起)。 */
export function themeIndexOfLevel(idx: number): number {
  let off = 0;
  for (let ci = 0; ci < THEME_SIZES.length; ci++) {
    off += THEME_SIZES[ci];
    if (idx < off) return ci;
  }
  return THEME_SIZES.length - 1;
}

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
  /* ---- 1.1 新增三章 ---- */
  neon: {
    name: "霓虹地铁站", emoji: "🚇",
    skyTop: "#231a3e", skyBottom: "#4a2f6e",
    lanes: ["#3a2b58", "#463465", "#3f2f5e"],
    deco: "#5ae0d0", accent: "#ff6ab0",
    palette: ["rock", "hurdle", "bar", "pit", "roller", "zapper", "crate"],
    blurb: "灯牌闪烁的地下月台,彩纸箱可以铲碎,滑轨带你加速",
  },
  ropeway: {
    name: "云上索道", emoji: "🚡",
    skyTop: "#bfe4ff", skyBottom: "#fbe6f2",
    lanes: ["#d8ecff", "#e6f2ff", "#dceeff"],
    deco: "#7fb8e8", accent: "#2f7ab0",
    palette: ["hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"],
    blurb: "高空缆车索道,岔路一条接一条,节奏跳最考验人",
  },
  stardust: {
    name: "星屑隧道", emoji: "✨",
    skyTop: "#1b2340", skyBottom: "#3d2b5e",
    lanes: ["#2c3357", "#353c64", "#30375d"],
    deco: "#ffd6f2", accent: "#c98aff",
    palette: ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"],
    blurb: "星屑翻涌的终极隧道,八种障碍与三种新机制全部登场",
  },
};

/* ---------------- 障碍花样 ---------------- */

export interface PatternRow {
  obstacles: Array<{ lane: number; kind: ObstacleKind }>;
  stars: number[];
  coins: number[];
  /** 1.1:这一行哪几条道上铺了加速滑轨。 */
  rails?: number[];
  /** 1.1:这一行属于「三连完美跳」节奏段(三条道等距同款障碍)。 */
  beat?: boolean;
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

function filterPatterns(
  pool: ReadonlyArray<PatternRow[]>,
  allowed: ReadonlyArray<ObstacleKind>,
): PatternRow[][] {
  const set = new Set(allowed);
  return pool.filter((pat) => pat.every((row) => row.obstacles.every((o) => set.has(o.kind))));
}

/** 只挑"用到的障碍全都在 allowed 里"的花样组(经典花样池)。 */
export function patternsForKinds(allowed: ReadonlyArray<ObstacleKind>): PatternRow[][] {
  return filterPatterns(PATTERNS, allowed);
}

/* ---------------- 1.1 新花样:彩纸箱与加速滑轨 ---------------- */
// 单独一池,只有新三章会接上,前 99 关的花样池一行都不会变。

export const NEW_PATTERNS: PatternRow[][] = [
  // 纸箱走廊:一路铲过去
  [
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [1] },
    { obstacles: [{ lane: 1, kind: "crate" }], stars: [0], coins: [2] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
  ],
  // 纸箱三连:三条道都是箱子,只能铲或跳
  [
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 1, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [] },
    { obstacles: [], stars: [1], coins: [0, 2] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 1, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [1] },
  ],
  // 纸箱加软糖:软糖只能躲,箱子随便挑一种解法
  [
    { obstacles: [{ lane: 0, kind: "rock" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "rock" }, { lane: 1, kind: "crate" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [1] },
  ],
  // 滑轨直道:踩上去一路加速
  [
    { obstacles: [], stars: [], coins: [0, 2], rails: [1] },
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [1], coins: [] },
    { obstacles: [], stars: [], coins: [1], rails: [0, 2] },
  ],
  // 滑轨加纸箱:加速之后再铲箱子
  [
    { obstacles: [], stars: [0], coins: [2], rails: [1] },
    { obstacles: [{ lane: 1, kind: "crate" }], stars: [], coins: [0, 2] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [1], coins: [] },
  ],
  // 节奏跳三连:连着三行栅栏,练三连完美跳
  [
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [1], beat: true },
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [1], coins: [], beat: true },
    { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [0, 2], beat: true },
  ],
  // 节奏坑三连:坑洞版的三连跳
  [
    { obstacles: [{ lane: 0, kind: "pit" }, { lane: 1, kind: "pit" }, { lane: 2, kind: "pit" }], stars: [], coins: [1], beat: true },
    { obstacles: [{ lane: 0, kind: "pit" }, { lane: 1, kind: "pit" }, { lane: 2, kind: "pit" }], stars: [1], coins: [], beat: true },
    { obstacles: [{ lane: 0, kind: "pit" }, { lane: 1, kind: "pit" }, { lane: 2, kind: "pit" }], stars: [], coins: [0, 2], beat: true },
  ],
  // 纸箱与彩虹杆:两种都要下滑,连着趴
  [
    { obstacles: [{ lane: 0, kind: "bar" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 1, kind: "bar" }, { lane: 2, kind: "crate" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "bar" }], stars: [], coins: [1] },
  ],
  // 滑轨绕电门:加速冲过闪着的门缝
  [
    { obstacles: [{ lane: 0, kind: "zapper" }], stars: [], coins: [1, 2], rails: [2] },
    { obstacles: [{ lane: 2, kind: "zapper" }], stars: [1], coins: [0], rails: [0] },
    { obstacles: [{ lane: 1, kind: "zapper" }, { lane: 0, kind: "crate" }], stars: [], coins: [2] },
  ],
  // 纸箱与滚球:滚球只能躲,箱子顺手铲
  [
    { obstacles: [{ lane: 0, kind: "roller" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 2, kind: "roller" }, { lane: 1, kind: "crate" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 1, kind: "roller" }, { lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [] },
  ],
  // 纸箱雨:箱子多得像下雨,专为砸大王准备
  [
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 1, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [0], coins: [] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [1] },
    { obstacles: [{ lane: 0, kind: "crate" }, { lane: 1, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [1], coins: [] },
  ],
  // 云怪与纸箱:飘的要躲,箱子要铲
  [
    { obstacles: [{ lane: 1, kind: "cloudy" }, { lane: 0, kind: "crate" }], stars: [], coins: [2] },
    { obstacles: [{ lane: 0, kind: "cloudy" }, { lane: 2, kind: "crate" }], stars: [1], coins: [] },
    { obstacles: [{ lane: 2, kind: "cloudy" }, { lane: 1, kind: "crate" }], stars: [], coins: [0] },
  ],
];

/** 关卡有没有开滑轨 / 节奏段(没开就把对应的花样从池子里摘掉)。 */
export interface PatternPoolSpec {
  world: Theme;
  obstacleKinds: ObstacleKind[];
  rails?: boolean;
  rhythm?: number;
  boss?: BossId;
}

function hasRails(pat: PatternRow[]): boolean {
  return pat.some((row) => (row.rails?.length ?? 0) > 0);
}

function hasBeat(pat: PatternRow[]): boolean {
  return pat.some((row) => row.beat === true);
}

/**
 * 关卡真正能用的花样池:经典九章只用老花样,1.1 新三章额外接上新花样。
 * `rhythm` 是「这一关安排几段节奏段」,数字越大,节奏花样在池子里出现得越密。
 */
export function patternsForLevel(def: PatternPoolSpec): PatternRow[][] {
  const raw = NEW_THEMES.has(def.world) ? [...PATTERNS, ...NEW_PATTERNS] : PATTERNS;
  const pool = filterPatterns(raw, def.obstacleKinds).filter(
    (pat) => (def.rails ? true : !hasRails(pat)) && (def.rhythm ? true : !hasBeat(pat)),
  );
  const extra = Math.max(0, (def.rhythm ?? 0) - 1);
  if (extra > 0) {
    const beats = pool.filter(hasBeat);
    for (let i = 0; i < extra; i++) pool.push(...beats);
  }
  // 大王把整条轨道都堆上了彩纸箱:带箱子的花样在大王关出现得更密,
  // 不然八种障碍摊薄之后,把护甲卸满的机会太少。
  if (def.boss) {
    const crates = pool.filter((pat) =>
      pat.some((row) => row.obstacles.some((o) => o.kind === "crate")),
    );
    pool.push(...crates, ...crates);
  }
  return pool;
}

/* ---------------- 1.1 机制四:随机分岔路线 ---------------- */

export interface ForkGate {
  /** 岔路口的名字,跑到牌子前会亮出来。 */
  name: string;
  /** 站在左道或中道时走的那一边。 */
  left: PatternRow[];
  /** 站在右道时走的那一边。 */
  right: PatternRow[];
}

/** 分岔口的判定:右道(2)拐右,左道和中道都拐左。 */
export function forkSideForLane(lane: number): "left" | "right" {
  return lane >= 2 ? "right" : "left";
}

export const FORKS: ForkGate[] = [
  {
    name: "纸箱仓库 / 滑轨快线",
    left: [
      { obstacles: [{ lane: 0, kind: "crate" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
      { obstacles: [{ lane: 1, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [0], coins: [] },
      { obstacles: [{ lane: 0, kind: "crate" }], stars: [], coins: [1, 2] },
    ],
    right: [
      { obstacles: [], stars: [], coins: [1, 2], rails: [2] },
      { obstacles: [{ lane: 0, kind: "hurdle" }], stars: [2], coins: [] },
      { obstacles: [{ lane: 1, kind: "hurdle" }], stars: [], coins: [0, 2] },
    ],
  },
  {
    name: "节奏跳台 / 绕行小道",
    left: [
      { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [1], coins: [] },
      { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [0, 2] },
      { obstacles: [{ lane: 0, kind: "hurdle" }, { lane: 1, kind: "hurdle" }, { lane: 2, kind: "hurdle" }], stars: [], coins: [1] },
    ],
    right: [
      { obstacles: [{ lane: 0, kind: "rock" }], stars: [], coins: [1, 2] },
      { obstacles: [{ lane: 2, kind: "rock" }], stars: [1], coins: [0] },
      { obstacles: [{ lane: 1, kind: "rock" }], stars: [], coins: [0, 2] },
    ],
  },
  {
    name: "低矮涵洞 / 高架平台",
    left: [
      { obstacles: [{ lane: 0, kind: "bar" }, { lane: 1, kind: "bar" }], stars: [2], coins: [] },
      { obstacles: [{ lane: 1, kind: "bar" }, { lane: 2, kind: "bar" }], stars: [], coins: [0] },
      { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [], coins: [1] },
    ],
    right: [
      { obstacles: [{ lane: 0, kind: "pit" }, { lane: 1, kind: "pit" }], stars: [], coins: [2] },
      { obstacles: [{ lane: 1, kind: "pit" }, { lane: 2, kind: "pit" }], stars: [0], coins: [] },
      { obstacles: [], stars: [1], coins: [0, 2], rails: [1] },
    ],
  },
  {
    name: "检修通道 / 星屑快轨",
    left: [
      { obstacles: [{ lane: 1, kind: "zapper" }], stars: [], coins: [0, 2] },
      { obstacles: [{ lane: 0, kind: "crate" }, { lane: 2, kind: "crate" }], stars: [1], coins: [] },
      { obstacles: [{ lane: 2, kind: "zapper" }, { lane: 1, kind: "crate" }], stars: [], coins: [0] },
    ],
    right: [
      { obstacles: [], stars: [], coins: [0, 1], rails: [0] },
      { obstacles: [{ lane: 2, kind: "roller" }], stars: [1], coins: [] },
      { obstacles: [{ lane: 0, kind: "roller" }, { lane: 1, kind: "crate" }], stars: [], coins: [2] },
    ],
  },
];

/** 按随机数抽一个岔路口(r 取 [0,1))。 */
export function pickFork(r: number): ForkGate {
  const i = Math.min(FORKS.length - 1, Math.max(0, Math.floor(r * FORKS.length)));
  return FORKS[i];
}

/** 分岔口选定之后要塞进待刷队列的那几行。 */
export function forkRows(gate: ForkGate, lane: number): PatternRow[] {
  return forkSideForLane(lane) === "right" ? gate.right : gate.left;
}

/* ---------------- 任务 ---------------- */

export type MissionType =
  | "coins"
  | "stars"
  | "dodge"
  | "noHit"
  // ---- 1.1 新任务 ----
  | "smash" // 铲碎 N 个彩纸箱
  | "perfect" // 打出 N 组三连完美跳
  | "boss"; // 把章节大王打到 N 下

export interface Mission {
  type: MissionType;
  n: number;
}

export interface RunStats {
  coins: number;
  stars: number;
  dodged: number;
  heartsLost: number;
  /** 1.1:铲碎的彩纸箱数 */
  smashed?: number;
  /** 1.1:完成的三连完美跳组数 */
  perfectRuns?: number;
  /** 1.1:打在章节大王身上的次数 */
  bossHits?: number;
}

export function missionProgress(mission: Mission, stats: RunStats): number {
  if (mission.type === "coins") return Math.min(stats.coins, mission.n);
  if (mission.type === "stars") return Math.min(stats.stars, mission.n);
  if (mission.type === "dodge") return Math.min(stats.dodged, mission.n);
  if (mission.type === "smash") return Math.min(stats.smashed ?? 0, mission.n);
  if (mission.type === "perfect") return Math.min(stats.perfectRuns ?? 0, mission.n);
  if (mission.type === "boss") return Math.min(stats.bossHits ?? 0, mission.n);
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
  if (mission.type === "smash") return `铲碎 ${mission.n} 个彩纸箱`;
  if (mission.type === "perfect") return `打出 ${mission.n} 组三连完美跳`;
  if (mission.type === "boss") return `打中大王 ${mission.n} 下`;
  return "一路不撞到终点";
}

/* ---------------- 1.1 章节大王 ---------------- */

export type BossId = "conductor" | "windLord" | "stardustLord";

export interface BossDef {
  name: string;
  emoji: string;
  /** 要打中多少下才算打赢。 */
  hp: number;
  blurb: string;
}

export const BOSSES: Record<BossId, BossDef> = {
  conductor: {
    name: "霓虹车长",
    emoji: "🎩",
    hp: 8,
    blurb: "他把整站的彩纸箱堆到轨道上,铲碎一个就等于打他一下",
  },
  windLord: {
    name: "索道风王",
    emoji: "🌪",
    hp: 10,
    blurb: "他掀起乱流让缆车摇晃,三连完美跳能把他的风阵直接吹散",
  },
  stardustLord: {
    name: "星屑之主",
    emoji: "👑",
    hp: 12,
    blurb: "隧道尽头的最终对手,铲箱与节奏跳都要用上才打得动他",
  },
};

/** 铲碎一箱算 1 下,打出一组三连完美跳算 2 下。 */
export const PERFECT_RUN_BOSS_DAMAGE = 2;

export function bossHitsOf(stats: RunStats): number {
  return (stats.smashed ?? 0) + (stats.perfectRuns ?? 0) * PERFECT_RUN_BOSS_DAMAGE;
}

/** 大王有没有被打趴下。 */
export function bossDefeated(boss: BossDef, stats: RunStats): boolean {
  return bossHitsOf(stats) >= boss.hp;
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
  /** 1.1:这一关会铺加速滑轨 */
  rails?: boolean;
  /** 1.1:这一关安排几段三连完美跳节奏段 */
  rhythm?: number;
  /** 1.1:这一关中途会出现随机岔路口 */
  fork?: boolean;
  /** 1.1:章节大王关 */
  boss?: BossId;
}

/** idx(0 起)关属于哪个世界。 */
export function themeOfLevel(idx: number): Theme {
  return THEME_ORDER[themeIndexOfLevel(idx)];
}

/** 章节 ci(0 起)包含的关卡下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  const off = themeOffset(ci);
  for (let i = 0; i < THEME_SIZES[ci]; i++) out.push(off + i);
  return out;
}

/** 关卡在章内位置(0-10)对应的速度与长度,越靠后越快越长。 */
function speedFor(worldIdx: number, pos: number): number {
  return 235 + worldIdx * 20 + pos * 5;
}
// 全关修复:原赛道 1450~3410 只够跑 6~8 秒、刷 3~11 行花样,
// 收糖果/躲障碍类任务在数学上不可能完成;加长到 14~19 秒让任务真正可达。
function lenFor(worldIdx: number, pos: number): number {
  return 3400 + worldIdx * 480 + pos * 140;
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

/** 生成关只出现在经典九章;1.1 新三章全部手写,不进这张表。 */
const GEN_KINDS: Partial<Record<Theme, ObstacleKind[][]>> = {
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
  const kinds = (GEN_KINDS[world] ?? [])[sub] ?? [];
  // 生成关(每章第 7/8/9 关)修复:原任务数(糖果 15+4w/躲避 12+4w)按 6 秒赛道
  // 也配不平,按新赛道的花样池供给(约 45%~60%)重定,保证一年级能三星。
  const mission: Mission =
    sub === 0
      ? { type: "coins", n: 8 + worldIdx }
      : sub === 1
        ? { type: "dodge", n: 9 + worldIdx }
        : { type: "stars", n: 4 + Math.floor(worldIdx / 3) };
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
// 第 1~99 关任务数修复:原目标按 6 秒赛道配的,几乎全部超过花样池供给(数学上不可能),
// 统一按新赛道供给的 45%~60% 重定,保证一年级(≤3 次点击/秒)能完成并三星。
const grassHand: LevelDef[] = [
  L(0, 0, "青草热身跑", ["rock"], [], { type: "coins", n: 6 }, "入门换道", "左右滑换道躲大软糖,吃糖果币!"), // 第1关修复:糖果 10 超供给,调 6
  L(0, 1, "跳跳栏比赛", ["rock", "hurdle"], [], { type: "coins", n: 6 }, "跳栏登场", "上滑跳过小栅栏!"), // 第2关修复:糖果 12→6
  L(0, 2, "趴趴杆隧道", ["rock", "hurdle", "bar"], [], { type: "noHit", n: 1 }, "趴杆登场", "下滑趴过彩虹杆!挑战一路不撞"),
  L(0, 3, "花田三连拍", ["hurdle", "bar"], [], { type: "stars", n: 3 }, "跳趴节奏", "跳、趴混着来,捡小星星!"),
  L(0, 4, "磁铁小站", ["rock", "bar"], ["magnet"], { type: "coins", n: 9 }, "磁铁道具", "吃到🧲磁铁,糖果币自己飞过来!"), // 第5关修复:糖果 18→9
  L(0, 5, "彩虹杆走廊", ["bar"], ["magnet"], { type: "dodge", n: 7 }, "趴杆走廊", "一整条趴杆走廊,贴地滑行!"), // 第6关修复:躲避 12→7(纯杆花样障碍稀)
  L(0, 9, "青草毕业跑", ["rock", "hurdle", "bar"], ["magnet"], { type: "dodge", n: 13 }, "青草毕业考", "青草世界学的全用上!"), // 第10关修复:躲避 20→13
  L(0, 10, "青草终点冲刺", ["rock", "hurdle", "bar"], ["magnet"], { type: "coins", n: 9 }, "青草终点", "冲过花田,下一站云朵世界!"), // 第11关修复:糖果 25→9
];

/* ---- 第 2 章 · 云朵世界 ---- */
const skyHand: LevelDef[] = [
  L(1, 0, "云朵桥入口", ["rock", "hurdle", "bar", "cloudy"], ["magnet"], { type: "dodge", n: 11 }, "云朵怪登场", "云朵怪会左右飘!看准再换道"), // 第12关修复:躲避 15→11
  L(1, 1, "坑坑云桥", ["rock", "hurdle", "pit"], ["magnet"], { type: "coins", n: 7 }, "坑洞登场", "云桥上有洞!必须跳过去"), // 第13关修复:糖果 20→7
  L(1, 2, "喷气鞋试飞", ["rock", "hurdle", "bar", "pit"], ["jet", "magnet"], { type: "coins", n: 8 }, "喷气鞋道具", "吃到🚀喷气鞋,飞起来什么都不怕!"), // 第14关修复:糖果 25→8
  L(1, 3, "云中穿梭", ["rock", "hurdle", "bar", "pit", "cloudy"], ["jet", "magnet"], { type: "dodge", n: 13 }, "云端全家福", "所有云朵障碍都来啦!"), // 第15关修复:躲避 25→13
  L(1, 4, "云洞二重奏", ["cloudy", "pit"], ["jet"], { type: "stars", n: 3 }, "云洞二重奏", "飘云和坑洞轮流上场"), // 第16关修复:星星 4→3(无磁铁)
  L(1, 5, "飘云无伤路", ["rock", "cloudy"], ["magnet"], { type: "noHit", n: 1 }, "飘云无伤", "云朵怪飘来飘去,挑战不撞!"),
  L(1, 9, "云端冲刺", ["rock", "hurdle", "bar", "cloudy"], ["jet"], { type: "noHit", n: 1 }, "高速无伤挑战", "风好大!挑战一路不撞"),
  L(1, 10, "云朵终点站", ["rock", "hurdle", "bar", "pit", "cloudy"], ["jet", "magnet"], { type: "coins", n: 10 }, "云朵终点", "跳下云桥就是糖果世界!"), // 第22关修复:糖果 30→10
];

/* ---- 第 3 章 · 糖果世界 ---- */
const candyHand: LevelDef[] = [
  L(2, 0, "糖果谷入口", ["rock", "hurdle", "bar", "pit"], ["magnet", "jet"], { type: "coins", n: 8 }, "糖果章开场", "欢迎来到糖果世界!"), // 第23关修复:糖果 25→8
  L(2, 1, "滑板时间", ["rock", "hurdle", "bar", "pit"], ["board", "magnet"], { type: "coins", n: 9 }, "滑板二段跳", "吃到🛹滑板:能二段跳,还帮你挡一次!"), // 第24关修复:糖果 30→9
  L(2, 2, "糖果雨", ["rock", "hurdle", "bar"], ["magnet", "board"], { type: "coins", n: 10 }, "金币暴雨", "满天都是糖果币,能吃多少吃多少!"), // 第25关修复:糖果 40→10(原值超全程供给 4 倍)
  L(2, 3, "滚滚糖球道", ["roller"], ["board"], { type: "dodge", n: 5 }, "滚滚球登场", "滚滚糖球比路还快!赶紧换道"), // 第26关修复:躲避 10→5(纯滚球花样稀)
  L(2, 4, "糖球夹心路", ["rock", "roller"], ["board", "magnet"], { type: "noHit", n: 1 }, "糖球夹心", "软糖挡路,糖球追尾,一下都别碰!"),
  L(2, 5, "弹跳糖山", ["hurdle", "pit", "roller"], ["board", "jet"], { type: "dodge", n: 13 }, "弹跳糖山", "连着跳!滑板二段跳更稳"), // 第28关修复:躲避 22→13
  L(2, 9, "糖果马拉松", ["rock", "hurdle", "bar", "pit", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 18 }, "糖果毕业考", "最长的一段糖果路,加油!"), // 第32关修复:躲避 30→18
  L(2, 10, "糖果终点站", ["rock", "hurdle", "bar", "pit", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 10 }, "糖果终点", "甜甜的终点,前面是大森林!"), // 第33关修复:糖果 45→10
];

/* ---- 第 4 章 · 森林世界 ---- */
const forestHand: LevelDef[] = [
  L(3, 0, "森林小路", ["rock", "hurdle", "bar"], ["magnet", "board"], { type: "coins", n: 9 }, "森林开场", "树影下的小路,先热热身"), // 第34关修复:糖果 28→9
  L(3, 1, "松果滚滚", ["rock", "cloudy", "roller"], ["board"], { type: "dodge", n: 8 }, "松果滚滚", "滚下来的是大松果!别接"), // 第35关修复:躲避 18→8
  L(3, 2, "树影跳趴", ["hurdle", "bar", "cloudy"], ["jet"], { type: "stars", n: 3 }, "树影跳趴", "跳过树根,趴过树枝!"), // 第36关修复:星星 5→3(无磁铁)
  L(3, 3, "无伤穿林", ["rock", "hurdle", "roller"], ["magnet"], { type: "noHit", n: 1 }, "无伤穿林", "安安静静穿过森林,一下都不撞"),
  L(3, 4, "藤蔓走廊", ["bar", "roller"], ["board", "magnet"], { type: "coins", n: 12 }, "藤蔓走廊", "低垂的藤蔓全要趴着过!"), // 第38关修复:糖果 32→12
  L(3, 5, "雾中精灵", ["rock", "hurdle", "bar", "cloudy"], ["jet", "board"], { type: "dodge", n: 16 }, "雾中精灵", "雾里的云朵精灵飘忽不定"), // 第39关修复:躲避 28→16
  L(3, 9, "森林毕业跑", ["rock", "hurdle", "bar", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 18 }, "森林毕业考", "森林全体障碍来送行!"), // 第43关修复:躲避 35→18
  L(3, 10, "森林终点", ["rock", "hurdle", "bar", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 11 }, "森林终点", "穿出森林就能看到海啦!"), // 第44关修复:糖果 40→11
];

/* ---- 第 5 章 · 海滩世界 ---- */
const beachHand: LevelDef[] = [
  L(4, 0, "沙滩开跑", ["rock", "hurdle", "pit"], ["magnet", "board"], { type: "coins", n: 10 }, "沙滩开场", "沙子软软的,坑洞可不软!"), // 第45关修复:糖果 30→10
  L(4, 1, "海风泡泡", ["rock", "bar", "cloudy"], ["jet"], { type: "stars", n: 4 }, "海风泡泡", "海风吹着泡泡云飘来飘去"), // 第46关修复:星星 5→4
  L(4, 2, "浪花跳跳", ["hurdle", "pit", "cloudy"], ["jet", "magnet"], { type: "dodge", n: 14 }, "浪花跳跳", "跟着浪花的节奏起跳!"), // 第47关修复:躲避 25→14
  L(4, 3, "椰子滚滚", ["rock", "hurdle", "bar", "roller"], ["board"], { type: "coins", n: 7 }, "椰子滚滚", "树上掉下来的椰子满地滚!"), // 第48关修复:糖果 35→7(无磁铁)
  L(4, 4, "沙坑无伤挑战", ["pit", "roller"], ["board", "jet"], { type: "noHit", n: 1 }, "沙坑无伤", "全是坑和椰子,一下都别碰!"),
  L(4, 5, "海滩全家福", ["rock", "hurdle", "bar", "pit", "cloudy"], ["magnet", "jet", "board"], { type: "dodge", n: 19 }, "海滩全家福", "海滩上见过的全来啦"), // 第50关修复:躲避 30→19
  L(4, 9, "沙滩毕业跑", ["rock", "hurdle", "bar", "pit", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 21 }, "海滩毕业考", "六种障碍的沙滩大考!"), // 第54关修复:躲避 38→21
  L(4, 10, "海滩终点", ["rock", "hurdle", "bar", "pit", "cloudy", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 12 }, "海滩终点", "跑过灯塔,沙漠就在前面!"), // 第55关修复:糖果 48→12
];

/* ---- 第 6 章 · 沙漠世界 ---- */
const desertHand: LevelDef[] = [
  L(5, 0, "沙海起跑线", ["rock", "hurdle"], ["magnet", "board"], { type: "coins", n: 11 }, "沙漠开场", "热热的沙海,注意补水哦!"), // 第56关修复:糖果 32→11
  L(5, 1, "流沙坑洞", ["rock", "pit"], ["jet"], { type: "dodge", n: 15 }, "流沙坑洞", "流沙坑一个接一个,跳稳!"), // 第57关修复:躲避 26→15
  L(5, 2, "滚石阵", ["hurdle", "roller"], ["board"], { type: "stars", n: 5 }, "滚石阵", "大滚石从沙丘上冲下来!"), // 第58关修复:星星 6→5
  L(5, 3, "海市蜃楼", ["rock", "hurdle", "pit"], ["magnet"], { type: "noHit", n: 1 }, "海市蜃楼无伤", "别被幻影骗了,一下都不撞!"),
  L(5, 4, "龙卷滚石", ["pit", "roller"], ["jet", "board"], { type: "coins", n: 9 }, "龙卷滚石", "坑洞加滚石,眼睛要够快"), // 第60关修复:糖果 38→9(无磁铁)
  L(5, 5, "落石峡谷", ["rock", "hurdle", "roller"], ["board", "magnet"], { type: "dodge", n: 16 }, "落石峡谷", "峡谷里滚石特别多!"), // 第61关修复:躲避 32→16
  L(5, 9, "沙漠毕业跑", ["rock", "hurdle", "pit", "roller"], ["magnet", "jet", "board"], { type: "dodge", n: 20 }, "沙漠毕业考", "沙漠全部障碍一起上!"), // 第65关修复:躲避 40→20
  L(5, 10, "沙漠终点", ["rock", "hurdle", "pit", "roller"], ["magnet", "jet", "board"], { type: "coins", n: 13 }, "沙漠终点", "翻过最后一座沙丘就是雪山!"), // 第66关修复:糖果 50→13
];

/* ---- 第 7 章 · 冰雪世界 ---- */
const snowHand: LevelDef[] = [
  L(6, 0, "雪原开跑", ["rock", "hurdle", "bar"], ["magnet", "board"], { type: "coins", n: 11 }, "冰雪开场", "脚下滑滑的,转弯要提前!"), // 第67关修复:糖果 35→11
  L(6, 1, "极光电门", ["zapper"], ["magnet"], { type: "dodge", n: 12 }, "电光门登场", "极光电门亮的时候碰不得!等灭了再过"), // 第68关修复:躲避 15→12
  L(6, 2, "电门滑冰场", ["rock", "zapper"], ["board"], { type: "stars", n: 5 }, "电门滑冰", "在电门间滑来滑去捡星星"), // 第69关修复:星星 6→5
  L(6, 3, "冰桥电网", ["hurdle", "bar", "zapper"], ["jet"], { type: "dodge", n: 18 }, "冰桥电网", "跳栏趴杆加电门,节奏全开!"), // 第70关修复:躲避 30→18
  L(6, 4, "冰面无伤挑战", ["rock", "hurdle", "pit"], ["magnet", "jet"], { type: "noHit", n: 1 }, "冰面无伤", "冰面太滑,更要稳稳地跑!"),
  L(6, 5, "暴风雪电门", ["pit", "cloudy", "zapper"], ["jet", "board"], { type: "coins", n: 10 }, "暴风雪电门", "雪云飘,电门闪,坑洞藏!"), // 第72关修复:糖果 42→10(无磁铁)
  L(6, 9, "冰雪毕业跑", ["rock", "hurdle", "bar", "pit", "cloudy", "zapper"], ["magnet", "jet", "board"], { type: "dodge", n: 25 }, "冰雪毕业考", "冰雪世界全障碍大考!"), // 第76关修复:躲避 42→25
  L(6, 10, "冰雪终点", ["rock", "hurdle", "bar", "pit", "cloudy", "zapper"], ["magnet", "jet", "board"], { type: "coins", n: 13 }, "冰雪终点", "雪山那边红红的就是火山!"), // 第77关修复:糖果 52→13
];

/* ---- 第 8 章 · 火山世界 ---- */
const lavaHand: LevelDef[] = [
  L(7, 0, "火山口起跑", ["rock", "hurdle", "pit"], ["magnet", "board"], { type: "coins", n: 12 }, "火山开场", "地上烫烫的,跑快点!"), // 第78关修复:糖果 38→12
  L(7, 1, "岩浆滚石", ["roller", "zapper"], ["jet"], { type: "dodge", n: 13 }, "岩浆滚石电门", "火滚石加电网,超刺激!"), // 第79关修复:躲避 28→13
  L(7, 2, "火石走廊", ["rock", "bar", "roller"], ["board"], { type: "stars", n: 5 }, "火石走廊", "趴着躲热浪,再闪开滚石!"), // 第80关修复:星星 7→5
  L(7, 3, "喷发电网", ["hurdle", "pit", "zapper"], ["jet", "magnet"], { type: "dodge", n: 21 }, "喷发电网", "火山要喷发,电网全亮了!"), // 第81关修复:躲避 35→21
  L(7, 4, "熔岩之桥", ["rock", "hurdle", "bar", "roller"], ["board", "magnet"], { type: "coins", n: 13 }, "熔岩之桥", "桥下就是岩浆,别掉下去!"), // 第82关修复:糖果 45→13
  L(7, 5, "火山无伤挑战", ["rock", "pit", "roller", "zapper"], ["jet", "board"], { type: "noHit", n: 1 }, "火山无伤", "最烫的路,一下都不能碰!"),
  L(7, 9, "火山毕业跑", ["rock", "hurdle", "bar", "pit", "roller", "zapper"], ["magnet", "jet", "board"], { type: "dodge", n: 27 }, "火山毕业考", "火山全障碍喷发式大考!"), // 第87关修复:躲避 45→27
  L(7, 10, "火山终点", ["rock", "hurdle", "bar", "pit", "roller", "zapper"], ["magnet", "jet", "board"], { type: "coins", n: 14 }, "火山终点", "冲出火山,夜空的星星在等你!"), // 第88关修复:糖果 55→14
];

/* ---- 第 9 章 · 星夜世界 ---- */
const spaceHand: LevelDef[] = [
  L(8, 0, "星夜大门", ["rock", "hurdle", "bar", "pit"], ["magnet", "jet"], { type: "stars", n: 6 }, "星夜章开场", "夜空亮晶晶,星星特别多!"), // 第89关修复:星星 7→6
  L(8, 1, "流星阵", ["rock", "hurdle", "cloudy"], ["jet", "board"], { type: "dodge", n: 18 }, "云怪流星群", "一大群会飘的流星云!"), // 第90关修复:躲避 35→18
  L(8, 2, "星光坑洞", ["rock", "pit", "bar"], ["board", "magnet"], { type: "noHit", n: 1 }, "坑洞无伤挑战", "星桥到处是洞,跳稳一点!"),
  L(8, 3, "银河滚石带", ["cloudy", "roller", "zapper"], ["jet"], { type: "dodge", n: 15 }, "银河滚石电门", "滚石、电门和流星云一起转!"), // 第92关修复:躲避 40→15(该池障碍稀)
  L(8, 4, "极速银河", ["rock", "hurdle", "bar", "pit", "cloudy"], ["magnet", "jet", "board"], { type: "coins", n: 14 }, "全障碍极速", "最快的一关!所有老朋友一起上"), // 第93关修复:糖果 50→14
  L(8, 5, "星轨电门", ["hurdle", "bar", "roller", "zapper"], ["board"], { type: "stars", n: 5 }, "星轨电门", "沿着星轨跳趴,躲开电门!"), // 第94关修复:星星 8→5(无磁铁)
  L(8, 9, "银河毕业跑", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper"], ["magnet", "jet", "board"], { type: "dodge", n: 28 }, "银河毕业考", "全部七种障碍的终极大考!"), // 第98关修复:躲避 50→28
  L(8, 10, "彩虹终点站", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper"], ["magnet", "jet", "board"], { type: "coins", n: 15 }, "最终大关", "冲过这里就是彩虹终点!!"), // 第99关修复:糖果 60→15
];

/* ================= 1.1 新章节(第 100–188 关,只在末尾追加) ================= */
// 新三章一律手写:每关自己挑障碍组合与任务,不再走生成器。
// 速度与长度继续沿用 speedFor / lenFor,曲线自然接在星夜世界后面。

const FULL_POWERS: PowerKind[] = ["magnet", "jet", "board"];

interface NewLevelOpts {
  powerups?: PowerKind[];
  rails?: boolean;
  rhythm?: number;
  fork?: boolean;
  boss?: BossId;
}

function N(
  worldIdx: number,
  pos: number,
  name: string,
  kinds: ObstacleKind[],
  mission: Mission,
  feature: string,
  hint: string,
  opts: NewLevelOpts = {},
): LevelDef {
  const def: LevelDef = {
    name,
    world: THEME_ORDER[worldIdx],
    len: lenFor(worldIdx, pos),
    speed: speedFor(worldIdx, pos),
    obstacleKinds: kinds,
    powerups: opts.powerups ?? FULL_POWERS,
    mission,
    feature,
    hint,
  };
  if (opts.rails) def.rails = true;
  if (opts.rhythm) def.rhythm = opts.rhythm;
  if (opts.fork) def.fork = true;
  if (opts.boss) def.boss = opts.boss;
  return def;
}

/* ---- 第 10 章 · 霓虹地铁站(第 100–129 关) ---- */
const neonHand: LevelDef[] = [
  N(9, 0, "月台第一班", ["rock", "hurdle", "crate"], { type: "coins", n: 12 }, "霓虹章开场",
    "地下月台开跑!新障碍彩纸箱:下滑铲碎它,起跳越过也行", { powerups: ["magnet"] }),
  N(9, 1, "铲箱练习场", ["crate"], { type: "smash", n: 6 }, "彩纸箱专项",
    "整条轨道都摆着彩纸箱,下滑一路铲过去", { powerups: ["magnet"] }),
  N(9, 2, "灯牌走廊", ["bar", "crate"], { type: "noHit", n: 1 }, "霓虹灯牌走廊",
    "灯牌挂得很低,趴下的同时顺手把箱子铲了", { powerups: ["magnet", "board"] }),
  N(9, 3, "滑轨初体验", ["hurdle", "crate"], { type: "coins", n: 14 }, "加速滑轨登场",
    "蓝色滑轨踩上去会加速一小段,所有动作都要提前", { rails: true, powerups: ["magnet"] }),
  N(9, 4, "快线滑轨", ["hurdle", "bar", "crate"], { type: "dodge", n: 16 }, "滑轨长直道",
    "长直滑轨接力,加速状态下别为一枚币冲错道", { rails: true }),
  N(9, 5, "检票闸机", ["zapper", "crate"], { type: "dodge", n: 14 }, "闸机电门",
    "闸机亮着就是不让过,等它灭掉那一拍再冲", { powerups: ["board"] }),
  N(9, 6, "换乘通道", ["rock", "hurdle", "bar", "crate"], { type: "coins", n: 13 }, "换乘岔路",
    "通道中间会分成两条:站右道往右拐,其他都往左", { fork: true }),
  N(9, 7, "节拍跳台", ["hurdle", "crate"], { type: "perfect", n: 2 }, "三连完美跳登场",
    "贴到栅栏跟前再起跳算完美,连着三次凑成一组", { rhythm: 3, powerups: ["board"] }),
  N(9, 8, "纸箱仓库", ["rock", "crate"], { type: "smash", n: 8 }, "仓库堆箱",
    "仓库里箱子堆成排,专心铲箱,金币顺路收就好", { powerups: ["magnet"] }),
  N(9, 9, "末班车滚轮", ["roller", "crate"], { type: "dodge", n: 12 }, "末班滚轮",
    "清运车的滚轮比路面还快,只能靠换道让开", { powerups: ["board"] }),
  N(9, 10, "霓虹夜跑", ["rock", "hurdle", "bar", "pit", "crate"], { type: "noHit", n: 1 }, "霓虹五障无伤",
    "五种障碍轮着来,保持节奏比抢速度重要"),
  N(9, 11, "站台风口", ["pit", "crate"], { type: "dodge", n: 13 }, "站台风口",
    "风口把地板吹出了缺口,看清坑沿再起跳"),
  N(9, 12, "霓虹招牌走廊", ["bar", "rock"], { type: "stars", n: 5 }, "霓虹招牌走廊",
    "霓虹招牌一块接一块,趴着过时留意星星在哪条道"),
  N(9, 13, "深夜滑轨", ["pit", "crate"], { type: "coins", n: 16 }, "深夜滑轨",
    "夜里滑轨最长的一段,加速时坑洞来得特别急", { rails: true }),
  N(9, 14, "三连跳月台", ["hurdle", "pit"], { type: "perfect", n: 3 }, "月台三连跳",
    "整段月台都是等距障碍,把起跳节拍数出来", { rhythm: 3 }),
  N(9, 15, "检修隧道", ["bar", "zapper", "crate"], { type: "dodge", n: 15 }, "检修隧道电网",
    "检修灯和低矮支架混在一起,趴与换道要接得上"),
  N(9, 16, "分岔月台", ["rock", "bar", "crate"], { type: "coins", n: 13 }, "月台分流",
    "岔路牌前先想好走哪边,右边的路总是更空一点", { fork: true }),
  N(9, 17, "纸箱与电闸", ["hurdle", "zapper", "crate"], { type: "smash", n: 7 }, "电闸旁的箱子",
    "电闸灭掉的那几秒,正好用来铲掉旁边的箱子"),
  N(9, 18, "地下水道", ["bar", "pit", "crate"], { type: "stars", n: 6 }, "地下水道",
    "水道又低又有缺口,趴和跳要连着切换"),
  N(9, 19, "反向轨道", ["rock", "roller", "crate"], { type: "dodge", n: 17 }, "反向轨道",
    "对面轨道有东西滚过来,提前挪到空的那条道"),
  N(9, 20, "霓虹马拉松", ["rock", "hurdle", "bar", "pit", "roller", "crate"], { type: "dodge", n: 20 }, "霓虹长跑",
    "本章最长的一段路,前半程先求稳再谈金币"),
  N(9, 21, "深夜清运车", ["roller", "zapper"], { type: "stars", n: 5 }, "清运车电网",
    "清运车和电网轮着挡路,星星常常挂在最险的那条道"),
  N(9, 22, "静音夜行", ["roller", "zapper", "crate"], { type: "noHit", n: 1 }, "清运线无伤",
    "整条清运线一次都不能碰,宁可绕远也别硬冲"),
  N(9, 23, "闪灯连环", ["zapper"], { type: "dodge", n: 11 }, "闪灯连环",
    "一整排电门轮流亮,记住它们的间隔就不慌"),
  N(9, 24, "滑轨接力", ["hurdle", "zapper", "crate"], { type: "coins", n: 17 }, "滑轨接力",
    "滑轨一段接一段,加速中经过电门要提前判断", { rails: true }),
  N(9, 25, "大堂分流", ["rock", "pit", "crate"], { type: "coins", n: 14 }, "大堂分流",
    "大堂中央分成两股人流,挑金币多的那一边", { fork: true }),
  N(9, 26, "节奏终段", ["hurdle", "pit", "crate"], { type: "perfect", n: 3 }, "霓虹节奏终段",
    "本章节奏最密的一段,三连完美跳能连着刷出来", { rhythm: 3 }),
  N(9, 27, "纸箱山", ["rock", "hurdle", "crate"], { type: "smash", n: 9 }, "纸箱山",
    "箱子堆得像小山,铲碎的越多,待会儿越好打"),
  N(9, 28, "车长的前哨", ["rock", "hurdle", "bar", "pit", "roller", "zapper", "crate"], { type: "dodge", n: 22 }, "车长前哨全障碍",
    "车长把全站的障碍都搬来了,当成大王前的热身"),
  N(9, 29, "霓虹车长", ["rock", "hurdle", "bar", "pit", "roller", "zapper", "crate"], { type: "boss", n: BOSSES.conductor.hp }, "章节大王霓虹车长",
    "铲碎一个箱子就等于打他一下,三连完美跳算两下,跑到终点前打满才算赢",
    { boss: "conductor", rails: true, rhythm: 2 }),
];

/* ---- 第 11 章 · 云上索道(第 130–159 关) ---- */
const ropewayHand: LevelDef[] = [
  N(10, 0, "索道起点站", ["hurdle", "bar"], { type: "coins", n: 13 }, "索道章开场",
    "缆车索道悬在半空,先把跳和趴的手感找回来", { powerups: ["magnet"] }),
  N(10, 1, "缆绳跳台", ["hurdle", "pit"], { type: "dodge", n: 15 }, "缆绳跳台",
    "跳台之间有缺口,落地马上准备下一次起跳"),
  N(10, 2, "云中吊桥", ["bar", "pit", "crate"], { type: "coins", n: 15 }, "云中吊桥",
    "吊桥两侧都是低横梁,趴过去之后紧跟着是缺口"),
  N(10, 3, "风口岔路", ["hurdle", "cloudy", "crate"], { type: "coins", n: 14 }, "风口分岔",
    "岔路口正对着风口,飘云会挡住其中一条", { fork: true }),
  N(10, 4, "空中纸箱", ["cloudy", "crate"], { type: "smash", n: 7 }, "空中货箱",
    "货箱吊在半空,铲碎它比绕开更省时间"),
  N(10, 5, "滑索加速", ["hurdle", "crate"], { type: "coins", n: 16 }, "云端滑索",
    "滑索会把速度顶上去,收币也要顺着滑索的方向", { rails: true }),
  N(10, 6, "三连缆绳", ["hurdle", "crate"], { type: "perfect", n: 2 }, "缆绳三连跳",
    "三根缆绳间距一样,数着拍子起跳最稳", { rhythm: 3 }),
  N(10, 7, "雾里飘云", ["bar", "cloudy"], { type: "dodge", n: 13 }, "雾中飘云",
    "雾里的云怪飘忽不定,别在它正下方停留"),
  N(10, 8, "高空检修", ["zapper", "crate"], { type: "dodge", n: 14 }, "高空检修电门",
    "检修电网在高空更密,灭灯的窗口只有一瞬"),
  N(10, 9, "断桥连跳", ["pit", "crate"], { type: "perfect", n: 3 }, "断桥连跳",
    "断桥的缺口等距排列,是练三连完美跳的好地方", { rhythm: 4 }),
  N(10, 10, "缆车顶盖", ["bar", "crate"], { type: "noHit", n: 1 }, "缆车顶盖无伤",
    "顶盖压得很低,全程贴地滑行,一次都别碰"),
  N(10, 11, "双线索道", ["bar", "pit", "crate"], { type: "coins", n: 17 }, "双线索道",
    "两条索道并排走,岔路牌决定你能吃到哪一串币", { fork: true }),
  N(10, 12, "滚轮吊篮", ["roller", "crate"], { type: "dodge", n: 12 }, "滚轮吊篮",
    "吊篮的滚轮松脱了,滚得比缆车还快"),
  N(10, 13, "星光缆车站", ["hurdle", "bar", "pit", "cloudy"], { type: "stars", n: 6 }, "星光缆车站",
    "站台上星星最多,规划一条能连着收的路线"),
  N(10, 14, "云海滑索", ["pit", "cloudy", "crate"], { type: "coins", n: 16 }, "云海滑索",
    "滑索穿过云海,加速时飘云的位置更难判断", { rails: true }),
  N(10, 15, "节拍风口", ["hurdle", "pit", "crate"], { type: "perfect", n: 3 }, "风口节奏段",
    "风一阵一阵地吹,起跳的拍子跟着风走", { rhythm: 3 }),
  N(10, 16, "纸箱货运舱", ["cloudy", "roller", "crate"], { type: "smash", n: 8 }, "货运舱堆箱",
    "货运舱里箱子最多,铲箱的手感在这一关练熟"),
  N(10, 17, "高塔换乘", ["bar", "zapper", "crate"], { type: "coins", n: 15 }, "高塔换乘",
    "换乘塔里两条路都通,选那条电门少的", { fork: true }),
  N(10, 18, "雷雨索道", ["cloudy", "zapper"], { type: "dodge", n: 13 }, "雷雨索道",
    "雷雨天电门亮得更久,宁可多等半拍"),
  N(10, 19, "逆风长线", ["hurdle", "bar", "pit", "cloudy", "roller"], { type: "dodge", n: 21 }, "逆风长线",
    "逆风段又长又乱,把注意力分给远处的那几行"),
  N(10, 20, "云梯连跳", ["hurdle", "bar", "pit"], { type: "stars", n: 6 }, "云梯连跳",
    "云梯一级一级往上,星星藏在跳跃的最高点旁边"),
  N(10, 21, "静音夜航", ["cloudy", "roller", "zapper"], { type: "noHit", n: 1 }, "夜航无伤",
    "夜航看不清,只能靠记住这三种障碍的行为"),
  N(10, 22, "货运滑轨", ["hurdle", "roller", "crate"], { type: "coins", n: 18 }, "货运滑轨",
    "货运滑轨最长,加速之后滚轮追得更紧", { rails: true }),
  N(10, 23, "三岔云台", ["hurdle", "pit", "cloudy", "crate"], { type: "coins", n: 16 }, "三岔云台",
    "云台上岔路接岔路,选完就别犹豫", { fork: true }),
  N(10, 24, "完美跳走廊", ["hurdle", "bar", "pit", "crate"], { type: "perfect", n: 4 }, "完美跳走廊",
    "整条走廊都在考起跳时机,四组三连是本章的门槛", { rhythm: 4 }),
  N(10, 25, "缆索大清仓", ["bar", "roller", "crate"], { type: "smash", n: 9 }, "缆索清仓",
    "清仓日货箱堆满索道,能铲多少铲多少"),
  N(10, 26, "高空马拉松", ["hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"], { type: "dodge", n: 23 }, "高空长跑",
    "本章最长的一程,七种障碍全部登场"),
  N(10, 27, "风阵前奏", ["cloudy", "zapper", "crate"], { type: "dodge", n: 15 }, "风阵前奏",
    "风王的乱流已经开始了,先摸清它的节奏"),
  N(10, 28, "星尘缆车顶", ["pit", "cloudy", "zapper", "crate"], { type: "stars", n: 7 }, "缆车顶星尘",
    "缆车顶上的星星最亮,也最难收齐"),
  N(10, 29, "索道风王", ["hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"], { type: "boss", n: BOSSES.windLord.hp }, "章节大王索道风王",
    "风王的风阵怕三连完美跳,一组抵两下;铲箱同样管用",
    { boss: "windLord", rails: true, rhythm: 3, fork: true }),
];

/* ---- 第 12 章 · 星屑隧道(第 160–188 关) ---- */
const stardustHand: LevelDef[] = [
  N(11, 0, "隧道入口", ["rock", "hurdle", "bar"], { type: "coins", n: 14 }, "星屑章开场",
    "最后一章开跑,先用熟悉的三种障碍热身", { powerups: ["magnet", "jet"] }),
  N(11, 1, "星屑滑轨", ["hurdle", "crate"], { type: "coins", n: 17 }, "星屑滑轨",
    "隧道里的滑轨闪着星屑,速度上得比之前都快", { rails: true }),
  N(11, 2, "陨石纸箱", ["rock", "crate"], { type: "smash", n: 8 }, "陨石区堆箱",
    "陨石之间卡着一排箱子,铲开才有路"),
  N(11, 3, "隧道岔口", ["rock", "hurdle", "crate"], { type: "coins", n: 15 }, "隧道岔口",
    "岔口的两条支线难度不同,看清再决定", { fork: true }),
  N(11, 4, "星轨三连", ["hurdle", "pit"], { type: "perfect", n: 3 }, "星轨三连跳",
    "星轨的间距是固定的,把拍子记住就能连出三连", { rhythm: 3 }),
  N(11, 5, "幽光电门", ["zapper", "crate"], { type: "dodge", n: 15 }, "幽光电门",
    "幽光电门亮得很暗,靠数拍子比靠看更准"),
  N(11, 6, "陨石滚道", ["rock", "roller"], { type: "dodge", n: 14 }, "陨石滚道",
    "滚下来的陨石只能躲,提前把中间道让出来"),
  N(11, 7, "星尘低廊", ["bar", "crate"], { type: "noHit", n: 1 }, "星尘低廊无伤",
    "低廊全程贴地,滑行时顺手铲箱也不能碰到横梁"),
  N(11, 8, "引力坑洞", ["rock", "pit", "crate"], { type: "dodge", n: 16 }, "引力坑洞",
    "坑洞边缘有引力,起跳要比平时早半拍"),
  N(11, 9, "双色岔路", ["bar", "pit", "crate"], { type: "coins", n: 16 }, "双色岔路",
    "两条支线一条低一条高,按自己顺手的选", { fork: true }),
  N(11, 10, "星云飘怪", ["cloudy", "crate"], { type: "smash", n: 9 }, "星云货箱",
    "飘怪会挡住箱子,先躲开它再回头铲"),
  N(11, 11, "极速滑轨", ["pit", "crate"], { type: "coins", n: 18 }, "极速滑轨",
    "全章最快的滑轨段,坑洞来得比想象中急", { rails: true }),
  N(11, 12, "节拍隧道", ["hurdle", "pit", "crate"], { type: "perfect", n: 4 }, "隧道节奏段",
    "隧道回声就是节拍器,跟着它连出四组三连", { rhythm: 4 }),
  N(11, 13, "碎石连环", ["rock", "roller", "crate"], { type: "dodge", n: 18 }, "碎石连环",
    "碎石一波接一波,换道要连着做两三次"),
  N(11, 14, "星屑马拉松", ["rock", "hurdle", "bar", "pit", "cloudy"], { type: "dodge", n: 21 }, "星屑长跑",
    "长跑段考的是耐心,别在前半程把心用完"),
  N(11, 15, "银河电网", ["roller", "zapper", "crate"], { type: "dodge", n: 16 }, "银河电网",
    "电网和滚石同时来,先算电门的拍子再挑道"),
  N(11, 16, "无声星海", ["rock", "cloudy", "zapper"], { type: "noHit", n: 1 }, "星海无伤",
    "星海一片安静,三种只能躲的障碍,靠预判过关"),
  N(11, 17, "星桥岔路", ["hurdle", "cloudy", "crate"], { type: "coins", n: 17 }, "星桥岔路",
    "星桥中段分成两条,右边的币多但飘怪也多", { fork: true }),
  N(11, 18, "流星滑轨", ["hurdle", "roller", "crate"], { type: "coins", n: 19 }, "流星滑轨",
    "流星带着滑轨一起冲,加速时视线要放得更远", { rails: true }),
  N(11, 19, "三连星门", ["pit", "zapper"], { type: "perfect", n: 3 }, "星门三连跳",
    "星门之间的缺口等距排列,是最后一段节奏练习", { rhythm: 3 }),
  N(11, 20, "陨石清仓", ["rock", "hurdle", "crate"], { type: "smash", n: 10 }, "陨石清仓",
    "把陨石区的箱子全部清掉,为最后一战攒手感"),
  N(11, 21, "星屑洪流", ["rock", "hurdle", "bar", "pit", "roller", "crate"], { type: "dodge", n: 22 }, "星屑洪流",
    "洪流一样的障碍密度,只看最近的两行就够"),
  N(11, 22, "静默隧道", ["bar", "pit", "zapper", "crate"], { type: "noHit", n: 1 }, "静默隧道无伤",
    "静默段没有提示音,全靠眼睛盯着远处"),
  N(11, 23, "光年快线", ["hurdle", "bar", "crate"], { type: "coins", n: 18 }, "光年快线",
    "快线一路直冲,滑轨接得很密", { rails: true }),
  N(11, 24, "星尘岔口", ["rock", "pit", "cloudy", "crate"], { type: "coins", n: 16 }, "星尘岔口",
    "最后一个岔口,两边都不轻松,挑熟悉的那种", { fork: true }),
  N(11, 25, "完美跳终考", ["hurdle", "bar", "pit", "crate"], { type: "perfect", n: 4 }, "完美跳终考",
    "五组三连完美跳,是整个战役对节奏感的最终考核", { rhythm: 5 }),
  N(11, 26, "全障碍演练", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"], { type: "dodge", n: 24 }, "八障碍演练",
    "八种障碍同场,把这一章学到的全用上"),
  N(11, 27, "之主前哨", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"], { type: "stars", n: 7 }, "之主前哨",
    "星屑之主的前哨站,星星就摆在最险的位置"),
  N(11, 28, "星屑之主", ["rock", "hurdle", "bar", "pit", "cloudy", "roller", "zapper", "crate"], { type: "boss", n: BOSSES.stardustLord.hp }, "最终大王星屑之主",
    "最后一关!铲箱与三连完美跳一起上,跑到终点前把他打满才算通关",
    { boss: "stardustLord", rails: true, rhythm: 4, fork: true }),
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
  // ---- 1.1 追加 ----
  ...neonHand,
  ...ropewayHand,
  ...stardustHand,
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
  return isLevelUnlocked(stars, themeOffset(themeIdx));
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

/* ---------------- 结算面板朗读 ---------------- */
// 结算面板不走 level99 浮层,识字量有限的孩子靠听。
// 纯函数便于测试;朗读本身走 speech.ts,无中文语音包时静默降级。

/** 过关结算面板要朗读的整句话。 */
export function clearSpeechLine(name: string, stars: number, missionOk: boolean): string {
  return missionOk
    ? `${name}跑完啦!小任务完成,得到 ${stars} 颗星,真棒!`
    : `${name}跑完啦!得到 ${stars} 颗星,下次试试完成小任务!`;
}

/** 失败结算面板要朗读的整句话:战役温柔安抚;无尽模式报里程,破纪录要大声夸。 */
export function retrySpeechLine(endless: boolean, meters: number, newBest: boolean): string {
  if (!endless) return "摔了一跤,晕乎乎。没关系,就从这一关重新出发!";
  return newBest
    ? `这次跑了 ${meters} 米,新纪录!太厉害啦!`
    : `这次跑了 ${meters} 米!休息一下,再来挑战纪录!`;
}
