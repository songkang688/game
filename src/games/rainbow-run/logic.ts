// 彩虹跑跑 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 20 关四大主题世界跑酷战役:青草→云朵→糖果→星夜,每关一个小任务。

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
  | "cloudy"; // 云朵怪:会左右飘,只能躲

export type PlayerAction = "run" | "jump" | "slide";

/** 同一车道相遇时会不会撞上。 */
export function wouldHit(kind: ObstacleKind, action: PlayerAction): boolean {
  if (kind === "hurdle" || kind === "pit") return action !== "jump";
  if (kind === "bar") return action !== "slide";
  return true; // rock / cloudy 只能换道
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(2, lane));
}

/* ---------------- 主题世界 ---------------- */

export type Theme = "grass" | "sky" | "candy" | "space";

export interface ThemeStyle {
  name: string;
  skyTop: string;
  skyBottom: string;
  lanes: [string, string, string];
  deco: string;
  accent: string;
}

export const THEME_STYLE: Record<Theme, ThemeStyle> = {
  grass: {
    name: "青草世界",
    skyTop: "#dff1ff",
    skyBottom: "#fdeff5",
    lanes: ["#d5f2ca", "#e3f7dc", "#def5d5"],
    deco: "#ffb3c8",
    accent: "#4a9a5a",
  },
  sky: {
    name: "云朵世界",
    skyTop: "#cfe8ff",
    skyBottom: "#e8f4ff",
    lanes: ["#eef6ff", "#e0ecff", "#e8f0ff"],
    deco: "#ffffff",
    accent: "#5a8ac9",
  },
  candy: {
    name: "糖果世界",
    skyTop: "#ffe3ee",
    skyBottom: "#fff1c9",
    lanes: ["#ffd6e7", "#fff1c9", "#d4f0ff"],
    deco: "#c9a6f2",
    accent: "#e05a7a",
  },
  space: {
    name: "星夜世界",
    skyTop: "#3e4468",
    skyBottom: "#6a6f9e",
    lanes: ["#565c88", "#606694", "#5a608c"],
    deco: "#ffe387",
    accent: "#8a5ac9",
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
    if (!ob || (ob.kind !== "rock" && ob.kind !== "cloudy")) return true;
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
  hint: string;
}

export const LEVELS: LevelDef[] = [
  // ---- 青草世界 ----
  { name: "青草热身跑", world: "grass", len: 1500, speed: 240, obstacleKinds: ["rock"], powerups: [], mission: { type: "coins", n: 10 }, feature: "入门换道", hint: "左右滑换道躲大软糖,吃糖果币!" },
  { name: "跳跳栏比赛", world: "grass", len: 1600, speed: 255, obstacleKinds: ["rock", "hurdle"], powerups: [], mission: { type: "coins", n: 12 }, feature: "跳栏登场", hint: "上滑跳过小栅栏!" },
  { name: "趴趴杆隧道", world: "grass", len: 1700, speed: 265, obstacleKinds: ["rock", "hurdle", "bar"], powerups: [], mission: { type: "noHit", n: 1 }, feature: "趴杆登场", hint: "下滑趴过彩虹杆!挑战一路不撞" },
  { name: "花田三连拍", world: "grass", len: 1800, speed: 280, obstacleKinds: ["rock", "hurdle", "bar"], powerups: [], mission: { type: "stars", n: 3 }, feature: "混合节奏", hint: "跳、趴、换道混着来,捡小星星!" },
  { name: "磁铁小站", world: "grass", len: 1900, speed: 290, obstacleKinds: ["rock", "hurdle", "bar"], powerups: ["magnet"], mission: { type: "coins", n: 25 }, feature: "磁铁道具", hint: "吃到🧲磁铁,糖果币自己飞过来!" },
  // ---- 云朵世界 ----
  { name: "云朵桥入口", world: "sky", len: 1900, speed: 300, obstacleKinds: ["rock", "hurdle", "bar", "cloudy"], powerups: ["magnet"], mission: { type: "dodge", n: 15 }, feature: "云朵怪登场", hint: "云朵怪会左右飘!看准再换道" },
  { name: "坑坑云桥", world: "sky", len: 2000, speed: 310, obstacleKinds: ["rock", "hurdle", "pit"], powerups: ["magnet"], mission: { type: "coins", n: 25 }, feature: "坑洞登场", hint: "云桥上有洞!必须跳过去" },
  { name: "喷气鞋试飞", world: "sky", len: 2100, speed: 320, obstacleKinds: ["rock", "hurdle", "bar", "pit"], powerups: ["jet", "magnet"], mission: { type: "coins", n: 30 }, feature: "喷气鞋道具", hint: "吃到🚀喷气鞋,飞起来什么都不怕!" },
  { name: "云中穿梭", world: "sky", len: 2200, speed: 335, obstacleKinds: ["rock", "hurdle", "bar", "pit", "cloudy"], powerups: ["jet", "magnet"], mission: { type: "dodge", n: 25 }, feature: "云端全家福", hint: "所有云朵障碍都来啦!" },
  { name: "云端冲刺", world: "sky", len: 2300, speed: 355, obstacleKinds: ["rock", "hurdle", "bar", "cloudy"], powerups: ["jet"], mission: { type: "noHit", n: 1 }, feature: "高速无伤挑战", hint: "风好大!挑战一路不撞" },
  // ---- 糖果世界 ----
  { name: "糖果谷入口", world: "candy", len: 2300, speed: 350, obstacleKinds: ["rock", "hurdle", "bar", "pit"], powerups: ["magnet", "jet"], mission: { type: "coins", n: 30 }, feature: "糖果章开场", hint: "欢迎来到糖果世界!" },
  { name: "滑板时间", world: "candy", len: 2400, speed: 360, obstacleKinds: ["rock", "hurdle", "bar", "pit"], powerups: ["board", "magnet"], mission: { type: "coins", n: 30 }, feature: "滑板二段跳", hint: "吃到🛹滑板:能二段跳,还帮你挡一次!" },
  { name: "糖果雨", world: "candy", len: 2500, speed: 370, obstacleKinds: ["rock", "hurdle", "bar"], powerups: ["magnet", "board"], mission: { type: "coins", n: 40 }, feature: "金币暴雨", hint: "满天都是糖果币,能吃多少吃多少!" },
  { name: "弹跳软糖路", world: "candy", len: 2600, speed: 380, obstacleKinds: ["rock", "hurdle", "pit", "cloudy"], powerups: ["board", "jet"], mission: { type: "stars", n: 5 }, feature: "连跳挑战", hint: "连着跳!滑板二段跳更稳" },
  { name: "糖果马拉松", world: "candy", len: 2900, speed: 385, obstacleKinds: ["rock", "hurdle", "bar", "pit", "cloudy"], powerups: ["magnet", "jet", "board"], mission: { type: "dodge", n: 35 }, feature: "超长赛道", hint: "最长的一段糖果路,加油!" },
  // ---- 星夜世界 ----
  { name: "星夜大门", world: "space", len: 2700, speed: 395, obstacleKinds: ["rock", "hurdle", "bar", "pit"], powerups: ["magnet", "jet"], mission: { type: "stars", n: 6 }, feature: "星夜章开场", hint: "夜空亮晶晶,星星特别多!" },
  { name: "流星阵", world: "space", len: 2800, speed: 405, obstacleKinds: ["rock", "cloudy", "hurdle"], powerups: ["jet", "board"], mission: { type: "dodge", n: 30 }, feature: "云怪流星群", hint: "一大群会飘的流星云!" },
  { name: "星光坑洞", world: "space", len: 2900, speed: 415, obstacleKinds: ["rock", "pit", "bar"], powerups: ["board", "magnet"], mission: { type: "noHit", n: 1 }, feature: "坑洞无伤挑战", hint: "星桥到处是洞,跳稳一点!" },
  { name: "极速银河", world: "space", len: 3000, speed: 430, obstacleKinds: ["rock", "hurdle", "bar", "pit", "cloudy"], powerups: ["magnet", "jet", "board"], mission: { type: "coins", n: 45 }, feature: "全障碍极速", hint: "最快的一关!所有障碍一起上" },
  { name: "彩虹终点站", world: "space", len: 3200, speed: 420, obstacleKinds: ["rock", "hurdle", "bar", "pit", "cloudy"], powerups: ["magnet", "jet", "board"], mission: { type: "coins", n: 50 }, feature: "最终大关", hint: "冲过这里就是彩虹终点!!" },
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

export const PROGRESS_KEY = "yiduo-yixing.rainbow-run.campaign.v1";

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

export function totalStars(stars: ReadonlyArray<number>): number {
  return stars.reduce((s, v) => s + v, 0);
}
