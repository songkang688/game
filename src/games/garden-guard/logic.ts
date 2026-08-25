// 花园守卫 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 99 关九大主题章节塔防战役:每章 11 关(8 关手写布局 + 3 关遭遇战),章末专属 BOSS。

export type Vec = { x: number; y: number };

export const GRID_COLS = 9;
export const GRID_ROWS = 6;

/* ---------------- 路径 ---------------- */

/** 拐点 → 格子中心坐标(单位:格)。 */
export function buildWaypoints(
  corners: ReadonlyArray<readonly [number, number]>,
): Vec[] {
  return corners.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
}

/** 折线总长度(单位:格)。 */
export function pathLength(pts: Vec[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** 沿折线走 dist 格后的位置;走完则 done=true 并停在终点。 */
export function pointAlongPath(
  pts: Vec[],
  dist: number,
): { x: number; y: number; done: boolean } {
  if (dist <= 0) return { x: pts[0].x, y: pts[0].y, done: false };
  let remaining = dist;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, done: false };
    }
    remaining -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, done: true };
}

/** 路径覆盖到的所有格子("col,row" 集合),这些格子不能放塔。 */
export function pathCellSet(
  corners: ReadonlyArray<readonly [number, number]>,
): Set<string> {
  const cells = new Set<string>();
  for (let i = 1; i < corners.length; i++) {
    const [c1, r1] = corners[i - 1];
    const [c2, r2] = corners[i];
    const dc = Math.sign(c2 - c1);
    const dr = Math.sign(r2 - r1);
    let c = c1;
    let r = r1;
    cells.add(`${c},${r}`);
    while (c !== c2 || r !== r2) {
      c += dc;
      r += dr;
      cells.add(`${c},${r}`);
    }
  }
  return cells;
}

/** 多条路径覆盖格子的并集。 */
export function pathsCellSet(
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
): Set<string> {
  const all = new Set<string>();
  for (const p of paths) for (const key of pathCellSet(p)) all.add(key);
  return all;
}

/** 这个格子能不能放塔。 */
export function canPlace(
  col: number,
  row: number,
  blocked: ReadonlySet<string>,
  occupied: ReadonlySet<string>,
): boolean {
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return false;
  const key = `${col},${row}`;
  return !blocked.has(key) && !occupied.has(key);
}

/** 挑选射程内"走得最远"且没有隐身的怪物下标;没有则返回 -1。 */
export function pickTarget(
  monsters: ReadonlyArray<{ x: number; y: number; dist: number; hp: number; hidden?: boolean }>,
  tx: number,
  ty: number,
  range: number,
): number {
  let best = -1;
  let bestDist = -1;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (m.hp <= 0 || m.hidden) continue;
    if (Math.hypot(m.x - tx, m.y - ty) <= range && m.dist > bestDist) {
      best = i;
      bestDist = m.dist;
    }
  }
  return best;
}

/* ---------------- 塔 ---------------- */

export type TowerKind = "bubble" | "needle" | "dew" | "sunny" | "boom";

export interface TowerSpec {
  name: string;
  cost: number;
  range: number;
  /** 攻击间隔(秒);0 表示不攻击(光环/产出塔) */
  cd: number;
  dmg: number;
  /** 光环减速倍率(越小怪越慢),仅露珠塔有 */
  slow?: number;
  /** 溅射半径(格),仅花火塔有 */
  splash?: number;
  /** 产花瓣间隔(秒),仅阳光花有 */
  produce?: number;
  desc: string;
}

export const TOWER_INFO: Record<TowerKind, TowerSpec> = {
  bubble: { name: "泡泡塔", cost: 3, range: 2.4, cd: 0.8, dmg: 2, desc: "慢但一下打 2 点" },
  needle: { name: "针针塔", cost: 5, range: 2.1, cd: 0.3, dmg: 1, desc: "咻咻咻连发" },
  dew: { name: "露珠塔", cost: 4, range: 1.9, cd: 0, dmg: 0, slow: 0.55, desc: "让怪走得慢慢的" },
  sunny: { name: "阳光花", cost: 4, range: 0, cd: 0, dmg: 0, produce: 5, desc: "慢慢攒花瓣" },
  boom: { name: "花火塔", cost: 7, range: 2.2, cd: 1.6, dmg: 3, splash: 1.05, desc: "轰!一片都痛" },
};

export const TOWER_KINDS: TowerKind[] = ["bubble", "needle", "dew", "sunny", "boom"];
export const MAX_TOWER_LEVEL = 3;

/** 关卡 idx(0 起)时已解锁的塔。 */
export function towersUnlockedAt(levelIdx: number, levels: ReadonlyArray<{ unlockTower?: TowerKind }>): TowerKind[] {
  const out: TowerKind[] = ["bubble", "needle", "dew"];
  for (let i = 0; i <= Math.min(levelIdx, levels.length - 1); i++) {
    const t = levels[i].unlockTower;
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** 从 level 升到 level+1 要花的花瓣。 */
export function upgradeCost(kind: TowerKind, level: number): number {
  return TOWER_INFO[kind].cost + (level - 1) * 2;
}

/** 这座塔一共投入了多少花瓣(买 + 已做的升级)。 */
export function towerInvested(kind: TowerKind, level: number): number {
  let total = TOWER_INFO[kind].cost;
  for (let l = 1; l < level; l++) total += upgradeCost(kind, l);
  return total;
}

/** 卖塔退回的花瓣(六成,至少 1)。 */
export function sellRefund(kind: TowerKind, level: number): number {
  return Math.max(1, Math.floor(towerInvested(kind, level) * 0.6));
}

export function towerDamage(kind: TowerKind, level: number): number {
  return TOWER_INFO[kind].dmg + (level - 1);
}

export function towerRange(kind: TowerKind, level: number): number {
  return TOWER_INFO[kind].range + (level - 1) * 0.25;
}

export function towerCooldown(kind: TowerKind, level: number): number {
  return TOWER_INFO[kind].cd * (1 - 0.15 * (level - 1));
}

/** 露珠塔的减速倍率(等级越高怪越慢)。 */
export function dewSlowFactor(level: number): number {
  return Math.max(0.3, (TOWER_INFO.dew.slow ?? 0.55) - (level - 1) * 0.08);
}

/** 阳光花产花瓣间隔(升级更快)。 */
export function sunnyInterval(level: number): number {
  return Math.max(2.4, (TOWER_INFO.sunny.produce ?? 5) - (level - 1) * 1.0);
}

/** 花火塔溅射半径(升级更大)。 */
export function boomSplash(level: number): number {
  return (TOWER_INFO.boom.splash ?? 1.05) + (level - 1) * 0.2;
}

/** 多个减速光环叠加:取最狠的一个,但最慢不低于 0.35。 */
export function combineSlow(factors: ReadonlyArray<number>): number {
  if (factors.length === 0) return 1;
  return Math.max(0.35, Math.min(...factors));
}

/* ---------------- 怪物 ---------------- */

export type MonsterKind =
  | "softy" // 软软怪:基础
  | "fasty" // 飘飘怪:飞快
  | "tanky" // 胖胖怪:血厚
  | "dashy" // 冲冲怪:周期加速冲刺
  | "shieldy" // 盾盾怪:有护甲,要先敲碎
  | "splity" // 分身怪:打倒后分成两只小怪
  | "sneaky" // 隐隐怪:周期隐身,塔打不到
  | "healy" // 奶油怪:给附近怪物回血
  | "mini" // 小分身
  | "boss1" // 大软软(草地 BOSS:皮厚耐揍)
  | "boss2" // 蟹蟹将军(沙滩 BOSS:重甲+召唤小兵)
  | "boss3" // 蘑菇菇王(森林 BOSS:打倒后裂成小分身)
  | "boss4" // 沙沙法老(沙漠 BOSS:超厚护甲+周期冲刺)
  | "boss5" // 泥泥大王(沼泽 BOSS:给随从回血)
  | "boss6" // 雪雪大王(雪山 BOSS:半血后暴走加速)
  | "boss7" // 岩浆巨人(熔岩 BOSS:冲刺+暴走)
  | "boss8" // 幽幽夜影(星夜 BOSS:会隐身+召唤)
  | "boss9"; // 糖果魔王(云端最终 BOSS:召唤+暴走+裂开)

export interface MonsterSpec {
  name: string;
  hp: number;
  armor: number;
  speed: number; // 格/秒
  reward: number; // 打倒奖励花瓣
  size: number; // 半径(格)
  boss: boolean;
  /** 行为开关:周期冲刺 */
  dashes?: boolean;
  /** 行为开关:周期隐身 */
  sneaks?: boolean;
  /** 行为开关:给附近怪回血 */
  heals?: boolean;
  /** 行为开关:周期召唤小分身 */
  summons?: boolean;
  /** 行为开关:半血后暴走加速 */
  enrages?: boolean;
  /** 行为开关:打倒后分裂成两只小分身 */
  splits?: boolean;
}

export const MONSTER_INFO: Record<MonsterKind, MonsterSpec> = {
  softy: { name: "软软怪", hp: 3, armor: 0, speed: 0.85, reward: 1, size: 0.3, boss: false },
  fasty: { name: "飘飘怪", hp: 2, armor: 0, speed: 1.5, reward: 1, size: 0.24, boss: false },
  tanky: { name: "胖胖怪", hp: 10, armor: 0, speed: 0.5, reward: 2, size: 0.38, boss: false },
  dashy: { name: "冲冲怪", hp: 4, armor: 0, speed: 0.7, reward: 2, size: 0.28, boss: false, dashes: true },
  shieldy: { name: "盾盾怪", hp: 5, armor: 4, speed: 0.6, reward: 2, size: 0.32, boss: false },
  splity: { name: "分身怪", hp: 6, armor: 0, speed: 0.65, reward: 2, size: 0.34, boss: false, splits: true },
  sneaky: { name: "隐隐怪", hp: 4, armor: 0, speed: 0.9, reward: 2, size: 0.28, boss: false, sneaks: true },
  healy: { name: "奶油怪", hp: 6, armor: 0, speed: 0.55, reward: 3, size: 0.32, boss: false, heals: true },
  mini: { name: "小分身", hp: 2, armor: 0, speed: 1.1, reward: 1, size: 0.2, boss: false },
  boss1: { name: "大软软", hp: 60, armor: 0, speed: 0.38, reward: 12, size: 0.55, boss: true },
  boss2: { name: "蟹蟹将军", hp: 80, armor: 8, speed: 0.34, reward: 14, size: 0.58, boss: true, summons: true },
  boss3: { name: "蘑菇菇王", hp: 95, armor: 0, speed: 0.36, reward: 15, size: 0.56, boss: true, splits: true },
  boss4: { name: "沙沙法老", hp: 90, armor: 18, speed: 0.33, reward: 16, size: 0.58, boss: true, dashes: true },
  boss5: { name: "泥泥大王", hp: 120, armor: 0, speed: 0.3, reward: 17, size: 0.6, boss: true, heals: true },
  boss6: { name: "雪雪大王", hp: 130, armor: 0, speed: 0.32, reward: 18, size: 0.6, boss: true, enrages: true },
  boss7: { name: "岩浆巨人", hp: 140, armor: 6, speed: 0.3, reward: 19, size: 0.62, boss: true, dashes: true, enrages: true },
  boss8: { name: "幽幽夜影", hp: 125, armor: 0, speed: 0.4, reward: 19, size: 0.56, boss: true, sneaks: true, summons: true },
  boss9: { name: "糖果魔王", hp: 170, armor: 8, speed: 0.3, reward: 25, size: 0.65, boss: true, summons: true, enrages: true, splits: true },
};

/** 冲冲怪节奏:平走 → 冲刺。 */
export const DASH_CYCLE = 2.1;
export const DASH_TIME = 0.55;
export const DASH_MULT = 3;
/** 隐隐怪节奏:现身 → 隐身。 */
export const SNEAK_VISIBLE = 2.2;
export const SNEAK_HIDDEN = 1.1;
/** 奶油怪:每隔几秒给附近怪 +1 血。 */
export const HEAL_INTERVAL = 2.5;
export const HEAL_RANGE = 1.3;
/** 召唤型 BOSS 每隔几秒召唤小分身。 */
export const SUMMON_INTERVAL = 6;
/** 暴走型 BOSS 半血后的加速倍率。 */
export const ENRAGE_MULT = 1.6;

/** 怪物血量随关卡缓慢加深(0 起的关卡下标,99 关全程约 5 倍)。 */
export function monsterHp(kind: MonsterKind, levelIdx: number): number {
  return Math.round(MONSTER_INFO[kind].hp * (1 + levelIdx * 0.042));
}

export function monsterArmor(kind: MonsterKind, levelIdx: number): number {
  const base = MONSTER_INFO[kind].armor;
  if (base === 0) return 0;
  return base + Math.floor(levelIdx / 10);
}

/** 打倒奖励也随关卡上涨,让后期经济跟得上怪物血量。 */
export function monsterReward(kind: MonsterKind, levelIdx: number): number {
  return MONSTER_INFO[kind].reward + Math.floor(levelIdx / 15);
}

/** 伤害先打护甲再掉血;返回新值和"这一下是否敲碎了护甲"。 */
export function applyHit(
  hp: number,
  armor: number,
  dmg: number,
): { hp: number; armor: number; brokeArmor: boolean } {
  const hadArmor = armor > 0;
  const used = Math.min(armor, dmg);
  const newArmor = armor - used;
  const newHp = hp - (dmg - used);
  return { hp: newHp, armor: newArmor, brokeArmor: hadArmor && newArmor === 0 };
}

/* ---------------- 主题章节 ---------------- */

export type ThemeId =
  | "grass" // 草地花园
  | "beach" // 沙滩海湾
  | "forest" // 蘑菇森林
  | "desert" // 沙漠绿洲
  | "swamp" // 幽幽沼泽
  | "snow" // 雪雪山坡
  | "night" // 星夜庭院
  | "lava" // 熔岩峡谷
  | "candy"; // 糖果云端

export interface ThemeStyle {
  name: string;
  emoji: string;
  bgA: string;
  bgB: string;
  path: string;
  accent: string;
  /** 本章 BOSS */
  boss: MonsterKind;
  /** 本章怪物主力阵容(生成器用) */
  palette: MonsterKind[];
  /** 本章简介 */
  blurb: string;
}

export const THEME_STYLE: Record<ThemeId, ThemeStyle> = {
  grass: {
    name: "草地花园", emoji: "🌼", bgA: "#d5f2ca", bgB: "#def5d5", path: "#f9e9bd", accent: "#4a9a5a",
    boss: "boss1", palette: ["softy", "fasty", "tanky", "dashy"], blurb: "新手花园,认识小怪和五种塔",
  },
  beach: {
    name: "沙滩海湾", emoji: "🏖️", bgA: "#fdeec9", bgB: "#faf0d8", path: "#bfe9ff", accent: "#e0a030",
    boss: "boss2", palette: ["splity", "sneaky", "healy", "fasty"], blurb: "分身怪与隐身怪的海边混战",
  },
  forest: {
    name: "蘑菇森林", emoji: "🍄", bgA: "#d8ecc0", bgB: "#e6f2d4", path: "#e8d5b0", accent: "#7a8a3a",
    boss: "boss3", palette: ["splity", "healy", "shieldy", "mini"], blurb: "小分身漫山遍野的菌菇秘境",
  },
  desert: {
    name: "沙漠绿洲", emoji: "🌵", bgA: "#f5e3b8", bgB: "#f9ecd0", path: "#c9e8d5", accent: "#c98a3a",
    boss: "boss4", palette: ["dashy", "shieldy", "tanky", "softy"], blurb: "重甲军团在热浪里冲锋",
  },
  swamp: {
    name: "幽幽沼泽", emoji: "🐸", bgA: "#c8dcc8", bgB: "#d5e5d0", path: "#a8c8b0", accent: "#4a7a5a",
    boss: "boss5", palette: ["healy", "sneaky", "tanky", "shieldy"], blurb: "奶油怪扎堆奶血的泥潭拉锯",
  },
  snow: {
    name: "雪雪山坡", emoji: "⛄", bgA: "#e8f0fb", bgB: "#f0f6ff", path: "#d8e4f5", accent: "#5a8ac9",
    boss: "boss6", palette: ["fasty", "dashy", "splity", "softy"], blurb: "冰面打滑,全员加速的雪山战",
  },
  night: {
    name: "星夜庭院", emoji: "🌙", bgA: "#c8c8e8", bgB: "#d5d5f0", path: "#e8e0c0", accent: "#6a5aa8",
    boss: "boss8", palette: ["sneaky", "splity", "mini", "fasty"], blurb: "满场隐身怪的星光捉迷藏",
  },
  lava: {
    name: "熔岩峡谷", emoji: "🌋", bgA: "#f5cdb8", bgB: "#f9dcc8", path: "#8a6a5a", accent: "#c94a3a",
    boss: "boss7", palette: ["dashy", "tanky", "shieldy", "fasty"], blurb: "岩浆边上的冲刺急行军",
  },
  candy: {
    name: "糖果云端", emoji: "🍬", bgA: "#fdd6e8", bgB: "#fde8f2", path: "#c9e8ff", accent: "#d84a8a",
    boss: "boss9", palette: ["softy", "fasty", "tanky", "dashy", "shieldy", "splity", "sneaky", "healy"], blurb: "全怪种齐聚的最终云端决战",
  },
};

export const THEME_ORDER: ThemeId[] = [
  "grass", "beach", "forest", "desert", "swamp", "snow", "night", "lava", "candy",
];

/** 每章关卡数:8 关手写 + 3 关生成 = 11 关,共 99 关。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;

export function themeOfLevel(idx: number): ThemeId {
  return THEME_ORDER[Math.floor(idx / LEVELS_PER_THEME)];
}

/** 章节 ci(0 起)包含的关卡下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LEVELS_PER_THEME; i++) out.push(ci * LEVELS_PER_THEME + i);
  return out;
}

/* ---------------- 关卡与波次 ---------------- */

export interface WaveEntry {
  kind: MonsterKind;
  count: number;
  gap: number; // 同一批怪间隔秒
}

export interface LevelDef {
  name: string;
  theme: ThemeId;
  /** 一条或两条进攻路线(绕路)。 */
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  waves: WaveEntry[][];
  startPetals: number;
  /** 本关新解锁的塔 */
  unlockTower?: TowerKind;
  /** 本关的独特机制标记(测试用) */
  feature: string;
  /** 雪地滑坡等:怪物速度倍率 */
  speedMult?: number;
  /** true = 生成器产出的遭遇战关 */
  gen?: boolean;
  /** 开场提示 */
  hint: string;
}

/* 手写路径库:每章 8 关手写布局从这里取,同章内不重复。 */
const P_STRAIGHT = [[0, 2], [5, 2], [5, 4], [8, 4]] as const;
const P_WIND = [[0, 1], [6, 1], [6, 3], [1, 3], [1, 5], [8, 5]] as const;
const P_ZIG = [[0, 4], [3, 4], [3, 1], [6, 1], [6, 4], [8, 4]] as const;
const P_LOOP = [[0, 0], [7, 0], [7, 3], [2, 3], [2, 5], [8, 5]] as const;
const P_SNAKE = [[0, 5], [7, 5], [7, 2], [3, 2], [3, 0], [8, 0]] as const;
const P_TOP = [[0, 0], [4, 0], [4, 2], [8, 2]] as const;
const P_BOT = [[0, 5], [4, 5], [4, 3], [8, 3]] as const;
const P_MID = [[0, 3], [2, 3], [2, 1], [6, 1], [6, 3], [8, 3]] as const;
const P_LONG = [[0, 0], [8, 0], [8, 2], [1, 2], [1, 4], [7, 4], [7, 5], [8, 5]] as const;
const P_HOOK = [[0, 2], [6, 2], [6, 0], [8, 0]] as const;
const P_DIP = [[0, 1], [3, 1], [3, 5], [6, 5], [6, 2], [8, 2]] as const;
const P_UTURN = [[0, 0], [7, 0], [7, 5], [0, 5]] as const;
const P_SPIRAL = [[0, 0], [8, 0], [8, 5], [1, 5], [1, 2], [6, 2]] as const;
const P_STAIRS = [[0, 5], [2, 5], [2, 3], [4, 3], [4, 1], [8, 1]] as const;
const P_CANYON = [[0, 2], [2, 2], [2, 0], [7, 0], [7, 3], [4, 3], [4, 5], [8, 5]] as const;
const P_SHORT = [[0, 3], [8, 3]] as const;
const P_FORK_A = [[0, 0], [3, 0], [3, 2], [8, 2]] as const;
const P_FORK_B = [[0, 5], [3, 5], [3, 3], [8, 3]] as const;
const P_RIVER = [[0, 4], [6, 4], [6, 1], [2, 1], [2, 0], [8, 0]] as const;
const P_GATE = [[0, 1], [4, 1], [4, 4], [0, 4]] as const;

type WSpec = readonly [MonsterKind, number, number];
/** 波次简写:W(["softy",4,1.2], ...) */
const W = (...batches: WSpec[]): WaveEntry[] =>
  batches.map(([kind, count, gap]) => ({ kind, count, gap }));

/** 生成器:每章 3 关"遭遇战"。波数 3+sub,阵容取自本章 palette,签名互不相同。 */
function genLevel(themeIdx: number, sub: number): LevelDef {
  const theme = THEME_ORDER[themeIdx];
  const st = THEME_STYLE[theme];
  const pal = st.palette;
  const genPaths = [P_STRAIGHT, P_HOOK, P_MID, P_ZIG, P_DIP, P_WIND, P_LOOP, P_STAIRS, P_SNAKE] as const;
  const path = genPaths[(themeIdx * 2 + sub * 3 + 1) % genPaths.length];
  const waveCount = 3 + sub; // 3 / 4 / 5 波
  const waves: WaveEntry[][] = [];
  for (let wi = 0; wi < waveCount; wi++) {
    const batches: WaveEntry[] = [];
    const nBatches = 1 + ((wi + sub) % 2);
    for (let b = 0; b <= nBatches - 1; b++) {
      const kind = pal[(wi + b * 2 + sub) % pal.length];
      const count = 3 + ((wi * 2 + b + sub + themeIdx) % 4) + Math.floor(themeIdx / 3);
      const gap = Math.max(0.6, 1.6 - wi * 0.15 - themeIdx * 0.05);
      batches.push({ kind, count, gap: Math.round(gap * 100) / 100 });
    }
    waves.push(batches);
  }
  return {
    name: `${st.name}遭遇战 ${sub + 1} 号`,
    theme,
    paths: [path],
    waves,
    startPetals: 8 + themeIdx + sub,
    feature: `${st.name}遭遇战${sub + 1}号`,
    speedMult: theme === "snow" || theme === "lava" ? 1.08 + sub * 0.03 : undefined,
    gen: true,
    hint: `${st.name}的杂牌军突然袭击!用熟悉的塔阵挡住 ${waveCount} 波怪`,
  };
}

/** 一章 = 6 关手写 + 3 关生成 + 手写挑战关 + 手写 BOSS 关。 */
function buildTheme(themeIdx: number, hand: LevelDef[]): LevelDef[] {
  if (hand.length !== HANDMADE_PER_THEME) {
    throw new Error(`theme ${themeIdx} 手写关数量应为 ${HANDMADE_PER_THEME}`);
  }
  return [
    ...hand.slice(0, 6),
    genLevel(themeIdx, 0),
    genLevel(themeIdx, 1),
    genLevel(themeIdx, 2),
    hand[6],
    hand[7],
  ];
}

/* ---- 第一章 · 草地花园:入门 + 全塔解锁 ---- */
const grassHand: LevelDef[] = [
  {
    name: "小花小径", theme: "grass", paths: [P_STRAIGHT], startPetals: 6, feature: "入门教学",
    hint: "选一张塔卡,点绿草地放塔,守住小花朵!",
    waves: [W(["softy", 4, 1.6]), W(["softy", 6, 1.2])],
  },
  {
    name: "飘飘出没", theme: "grass", paths: [P_HOOK], startPetals: 7, feature: "飘飘怪登场",
    hint: "飘飘怪飞得快!针针塔连发拦得住它",
    waves: [W(["softy", 4, 1.4], ["fasty", 2, 1.0]), W(["fasty", 4, 0.9], ["softy", 4, 1.2])],
  },
  {
    name: "阳光牧场", theme: "grass", paths: [P_WIND], startPetals: 6, unlockTower: "sunny", feature: "阳光花解锁",
    hint: "新塔阳光花!种下它慢慢攒花瓣",
    waves: [W(["softy", 5, 1.3]), W(["softy", 5, 1.1], ["fasty", 3, 0.9]), W(["tanky", 1, 1], ["softy", 5, 1.0])],
  },
  {
    name: "双岔路口", theme: "grass", paths: [P_TOP, P_BOT], startPetals: 9, feature: "双路绕路",
    hint: "怪物会走上下两条路!两边都要放塔哦",
    waves: [W(["softy", 6, 1.2]), W(["softy", 6, 1.0], ["fasty", 3, 0.9]), W(["tanky", 2, 1.8], ["fasty", 4, 0.8])],
  },
  {
    name: "冲冲快跑", theme: "grass", paths: [P_ZIG], startPetals: 8, unlockTower: "boom", feature: "冲冲怪+花火塔",
    hint: "冲冲怪会突然加速!新塔花火塔轰一大片",
    waves: [W(["dashy", 3, 1.6], ["softy", 4, 1.1]), W(["dashy", 4, 1.3], ["fasty", 3, 0.8]), W(["tanky", 2, 1.6], ["dashy", 4, 1.1])],
  },
  {
    name: "胖胖车队", theme: "grass", paths: [P_LOOP], startPetals: 9, feature: "胖胖怪车轮阵",
    hint: "一队胖胖怪慢慢碾过来,火力要够猛!",
    waves: [W(["tanky", 3, 1.8], ["softy", 4, 1.1]), W(["tanky", 3, 1.5], ["fasty", 4, 0.8]), W(["tanky", 4, 1.4], ["dashy", 3, 1.2])],
  },
  {
    name: "花园大巡游", theme: "grass", paths: [P_LONG], startPetals: 10, feature: "草地五波车轮战",
    hint: "整整 5 波!超长小路,露珠塔放拐角",
    waves: [
      W(["softy", 6, 1.1]), W(["fasty", 6, 0.8]), W(["dashy", 4, 1.2], ["softy", 4, 1.0]),
      W(["tanky", 3, 1.5], ["fasty", 4, 0.8]), W(["dashy", 5, 1.0], ["tanky", 2, 1.5]),
    ],
  },
  {
    name: "草地大王", theme: "grass", paths: [P_SNAKE], startPetals: 10, feature: "章节BOSS大软软",
    hint: "大软软 BOSS 来啦!多放塔、记得升级!",
    waves: [
      W(["softy", 6, 1.0], ["fasty", 4, 0.8]), W(["tanky", 2, 1.6], ["dashy", 3, 1.3]),
      W(["boss1", 1, 1], ["fasty", 4, 1.0]),
    ],
  },
];

/* ---- 第二章 · 沙滩海湾:分身/隐身/奶油 ---- */
const beachHand: LevelDef[] = [
  {
    name: "沙滩开跑", theme: "beach", paths: [P_MID], startPetals: 8, feature: "沙滩章开场",
    hint: "欢迎来到沙滩海湾!怪物皮更厚了",
    waves: [W(["softy", 6, 1.0], ["fasty", 4, 0.8]), W(["dashy", 4, 1.2], ["tanky", 2, 1.6]), W(["shieldy", 3, 1.4], ["fasty", 5, 0.7])],
  },
  {
    name: "分身沙堡", theme: "beach", paths: [P_HOOK], startPetals: 9, feature: "分身怪登场",
    hint: "分身怪打倒后会分成两只小的,别松劲!",
    waves: [W(["splity", 2, 2.2], ["softy", 4, 1.1]), W(["splity", 3, 1.8], ["fasty", 4, 0.8]), W(["splity", 4, 1.5], ["dashy", 3, 1.2])],
  },
  {
    name: "捉迷藏湾", theme: "beach", paths: [P_DIP], startPetals: 9, feature: "隐隐怪隐身",
    hint: "隐隐怪会隐身,塔打不到!等它现身再打",
    waves: [W(["sneaky", 3, 1.8], ["softy", 4, 1.0]), W(["sneaky", 4, 1.4], ["fasty", 4, 0.8]), W(["sneaky", 4, 1.2], ["splity", 2, 1.8])],
  },
  {
    name: "奶油补给站", theme: "beach", paths: [P_WIND], startPetals: 10, feature: "奶油怪回血",
    hint: "奶油怪会给附近的怪回血,先打它!",
    waves: [W(["healy", 1, 1], ["softy", 6, 1.0]), W(["healy", 2, 3.0], ["tanky", 3, 1.4]), W(["healy", 2, 2.5], ["splity", 3, 1.5])],
  },
  {
    name: "长长回廊", theme: "beach", paths: [P_LONG], startPetals: 10, feature: "沙滩超长路线",
    hint: "这条路好长呀!露珠塔放在拐角最划算",
    waves: [W(["tanky", 3, 1.6], ["softy", 6, 0.9]), W(["sneaky", 3, 1.4], ["splity", 2, 1.8]), W(["healy", 2, 2.6], ["fasty", 6, 0.7])],
  },
  {
    name: "双路狂潮", theme: "beach", paths: [P_TOP, P_BOT], startPetals: 11, feature: "沙滩双路快攻",
    hint: "两条路一起冲!飘飘怪和分身怪都超快",
    waves: [W(["fasty", 6, 0.7], ["splity", 2, 1.8]), W(["sneaky", 4, 1.2], ["splity", 3, 1.5]), W(["fasty", 8, 0.55], ["healy", 2, 2.6])],
  },
  {
    name: "退潮夺宝", theme: "beach", paths: [P_SHORT], startPetals: 7, feature: "短路极限防守",
    hint: "海水退了只剩一条直路!路短塔少,拼手速",
    waves: [
      W(["softy", 6, 1.0]), W(["sneaky", 4, 1.1], ["fasty", 4, 0.8]),
      W(["splity", 3, 1.4], ["healy", 1, 1]), W(["fasty", 7, 0.6], ["splity", 3, 1.3]),
    ],
  },
  {
    name: "蟹蟹将军", theme: "beach", paths: [P_LOOP], startPetals: 12, feature: "章节BOSS蟹蟹将军",
    hint: "蟹蟹将军有护甲还会召唤小兵,加油!",
    waves: [
      W(["sneaky", 3, 1.4], ["splity", 2, 1.8]), W(["healy", 2, 3.0], ["tanky", 3, 1.4]),
      W(["boss2", 1, 1], ["fasty", 5, 0.9]),
    ],
  },
];

/* ---- 第三章 · 蘑菇森林:分裂大军 ---- */
const forestHand: LevelDef[] = [
  {
    name: "菌菇小道", theme: "forest", paths: [P_STAIRS], startPetals: 9, feature: "森林章开场",
    hint: "蘑菇森林里全是会分身的家伙!",
    waves: [W(["splity", 3, 1.8], ["mini", 4, 0.8]), W(["splity", 4, 1.5], ["healy", 1, 1]), W(["shieldy", 3, 1.5], ["mini", 6, 0.6])],
  },
  {
    name: "小分身雨", theme: "forest", paths: [P_ZIG], startPetals: 9, feature: "小分身洪流",
    hint: "小分身又小又快,花火塔轰一大片!",
    waves: [W(["mini", 8, 0.55]), W(["mini", 10, 0.5], ["splity", 2, 1.8]), W(["mini", 12, 0.45], ["healy", 2, 2.6])],
  },
  {
    name: "蘑菇圆环", theme: "forest", paths: [P_UTURN], startPetals: 10, feature: "U型回环路",
    hint: "路绕一个大圈,中间是黄金塔位!",
    waves: [W(["splity", 3, 1.6], ["shieldy", 2, 1.8]), W(["healy", 2, 2.8], ["mini", 8, 0.55]), W(["splity", 4, 1.3], ["shieldy", 3, 1.4])],
  },
  {
    name: "硬壳菇队", theme: "forest", paths: [P_MID], startPetals: 10, feature: "森林盾盾阵",
    hint: "盾盾怪排着队来,先敲碎硬壳!",
    waves: [W(["shieldy", 3, 1.6], ["mini", 5, 0.7]), W(["shieldy", 4, 1.4], ["splity", 2, 1.8]), W(["shieldy", 5, 1.2], ["healy", 2, 2.6])],
  },
  {
    name: "奶菇温泉", theme: "forest", paths: [P_GATE], startPetals: 10, feature: "双奶油护卫队",
    hint: "两只奶油怪贴身保护大部队,先集火它们!",
    waves: [W(["healy", 2, 2.4], ["splity", 3, 1.5]), W(["healy", 3, 2.2], ["shieldy", 3, 1.4]), W(["healy", 2, 2.0], ["tanky", 3, 1.5], ["mini", 6, 0.6])],
  },
  {
    name: "双菇岔路", theme: "forest", paths: [P_FORK_A, P_FORK_B], startPetals: 12, feature: "森林双岔路",
    hint: "上下两条菌菇道一起来分身怪!",
    waves: [W(["splity", 4, 1.4], ["mini", 6, 0.6]), W(["shieldy", 4, 1.3], ["healy", 2, 2.6]), W(["splity", 5, 1.2], ["mini", 8, 0.5])],
  },
  {
    name: "孢子风暴", theme: "forest", paths: [P_SPIRAL], startPetals: 12, feature: "森林五波挑战",
    hint: "5 波孢子大军!分身套分身,数都数不清",
    waves: [
      W(["mini", 10, 0.5]), W(["splity", 4, 1.3]), W(["shieldy", 4, 1.3], ["mini", 6, 0.55]),
      W(["healy", 3, 2.2], ["splity", 4, 1.2]), W(["splity", 5, 1.0], ["shieldy", 3, 1.3], ["mini", 8, 0.45]),
    ],
  },
  {
    name: "蘑菇菇王", theme: "forest", paths: [P_SNAKE], startPetals: 13, feature: "章节BOSS蘑菇菇王",
    hint: "蘑菇菇王打倒后还会裂成小蘑菇!别大意",
    waves: [
      W(["splity", 4, 1.3], ["mini", 6, 0.55]), W(["healy", 2, 2.4], ["shieldy", 4, 1.3]),
      W(["boss3", 1, 1], ["mini", 8, 0.6]),
    ],
  },
];

/* ---- 第四章 · 沙漠绿洲:重甲冲锋 ---- */
const desertHand: LevelDef[] = [
  {
    name: "热浪初袭", theme: "desert", paths: [P_STRAIGHT], startPetals: 10, feature: "沙漠章开场",
    hint: "沙漠军团的护甲更硬,泡泡塔一下打 2 点!",
    waves: [W(["shieldy", 3, 1.6], ["softy", 5, 1.0]), W(["dashy", 4, 1.3], ["shieldy", 3, 1.4]), W(["tanky", 3, 1.5], ["dashy", 4, 1.1])],
  },
  {
    name: "沙丘冲锋", theme: "desert", paths: [P_HOOK], startPetals: 10, feature: "冲冲怪突击队",
    hint: "满屏冲冲怪轮流冲刺,露珠塔按住它们!",
    waves: [W(["dashy", 5, 1.2]), W(["dashy", 5, 1.0], ["softy", 4, 1.0]), W(["dashy", 6, 0.9], ["shieldy", 3, 1.4])],
  },
  {
    name: "绿洲环道", theme: "desert", paths: [P_UTURN], startPetals: 11, feature: "绿洲U型防线",
    hint: "抱着绿洲绕一圈,中心塔位一夫当关!",
    waves: [W(["tanky", 3, 1.5], ["dashy", 4, 1.1]), W(["shieldy", 4, 1.3], ["softy", 6, 0.9]), W(["tanky", 4, 1.3], ["shieldy", 4, 1.2])],
  },
  {
    name: "铁壳商队", theme: "desert", paths: [P_RIVER], startPetals: 11, feature: "重甲车队",
    hint: "盾盾怪+胖胖怪组成铁皮车队,慢但超硬!",
    waves: [W(["shieldy", 4, 1.4], ["tanky", 2, 1.6]), W(["shieldy", 5, 1.2], ["tanky", 3, 1.4]), W(["shieldy", 6, 1.0], ["tanky", 4, 1.3])],
  },
  {
    name: "沙暴双路", theme: "desert", paths: [P_TOP, P_BOT], startPetals: 12, feature: "沙漠双路夹击",
    hint: "沙暴里两路夹击!先守住薄弱的一边",
    waves: [W(["dashy", 4, 1.1], ["softy", 6, 0.9]), W(["shieldy", 4, 1.2], ["dashy", 4, 1.0]), W(["tanky", 4, 1.3], ["dashy", 5, 0.9])],
  },
  {
    name: "花瓣旱季", theme: "desert", paths: [P_WIND], startPetals: 5, feature: "沙漠经济挑战",
    hint: "旱季花瓣稀缺!先种阳光花攒钱再布阵",
    waves: [
      W(["softy", 5, 1.4]), W(["dashy", 3, 1.4], ["softy", 5, 1.1]),
      W(["shieldy", 3, 1.4], ["dashy", 4, 1.1]), W(["tanky", 3, 1.4], ["shieldy", 3, 1.3]),
    ],
  },
  {
    name: "金字塔迷阵", theme: "desert", paths: [P_CANYON], startPetals: 12, feature: "沙漠五波长征",
    hint: "最长的沙漠回廊,5 波车轮战!",
    waves: [
      W(["softy", 7, 0.9]), W(["dashy", 5, 1.0]), W(["shieldy", 5, 1.1], ["softy", 5, 0.9]),
      W(["tanky", 4, 1.3], ["dashy", 4, 1.0]), W(["shieldy", 5, 1.0], ["tanky", 3, 1.3], ["dashy", 4, 0.9]),
    ],
  },
  {
    name: "沙沙法老", theme: "desert", paths: [P_LOOP], startPetals: 13, feature: "章节BOSS沙沙法老",
    hint: "沙沙法老披着超厚金甲还会冲刺!敲碎它!",
    waves: [
      W(["shieldy", 4, 1.3], ["dashy", 4, 1.0]), W(["tanky", 4, 1.3], ["softy", 6, 0.9]),
      W(["boss4", 1, 1], ["dashy", 5, 1.0]),
    ],
  },
];

/* ---- 第五章 · 幽幽沼泽:回血拉锯 ---- */
const swampHand: LevelDef[] = [
  {
    name: "泥潭初探", theme: "swamp", paths: [P_DIP], startPetals: 11, feature: "沼泽章开场",
    hint: "沼泽怪又肉又会奶,做好持久战准备!",
    waves: [W(["tanky", 3, 1.5], ["healy", 1, 1]), W(["sneaky", 4, 1.2], ["tanky", 3, 1.4]), W(["healy", 2, 2.4], ["shieldy", 4, 1.2])],
  },
  {
    name: "奶油泡泡塘", theme: "swamp", paths: [P_MID], startPetals: 11, feature: "三奶护体",
    hint: "三只奶油怪一起奶!谁先倒下看你集火",
    waves: [W(["healy", 3, 2.2], ["tanky", 2, 1.6]), W(["healy", 3, 2.0], ["shieldy", 3, 1.3]), W(["healy", 3, 1.8], ["tanky", 4, 1.2])],
  },
  {
    name: "雾里藏影", theme: "swamp", paths: [P_WIND], startPetals: 12, feature: "沼泽隐身潮",
    hint: "雾气里全是隐隐怪,算好现身的节拍!",
    waves: [W(["sneaky", 4, 1.3], ["healy", 1, 1]), W(["sneaky", 5, 1.1], ["shieldy", 3, 1.3]), W(["sneaky", 6, 0.9], ["healy", 2, 2.2])],
  },
  {
    name: "烂泥减速带", theme: "swamp", paths: [P_LONG], startPetals: 12, speedMult: 0.85, feature: "泥地怪物变慢",
    hint: "烂泥地怪走得慢,但一波比一波多!",
    waves: [W(["tanky", 4, 1.3], ["sneaky", 4, 1.1]), W(["shieldy", 5, 1.1], ["healy", 2, 2.2]), W(["tanky", 5, 1.2], ["shieldy", 4, 1.1], ["healy", 2, 2.0])],
  },
  {
    name: "双沼汊口", theme: "swamp", paths: [P_FORK_A, P_FORK_B], startPetals: 13, feature: "沼泽双汊口",
    hint: "两条泥路都有奶油怪押队,两头都要拆!",
    waves: [W(["sneaky", 4, 1.2], ["healy", 2, 2.4]), W(["tanky", 4, 1.3], ["healy", 2, 2.2]), W(["shieldy", 5, 1.1], ["healy", 3, 2.0])],
  },
  {
    name: "壳壳泥浴", theme: "swamp", paths: [P_GATE], startPetals: 12, feature: "沼泽重甲奶队",
    hint: "盾盾怪泡了泥浴更硬了,还有奶!先打奶!",
    waves: [W(["shieldy", 4, 1.3], ["healy", 2, 2.2]), W(["shieldy", 5, 1.1], ["sneaky", 4, 1.0]), W(["shieldy", 6, 1.0], ["healy", 3, 1.8])],
  },
  {
    name: "沼泽马拉松", theme: "swamp", paths: [P_SPIRAL], startPetals: 13, feature: "沼泽五波鏖战",
    hint: "5 波拉锯战!奶油怪一波比一波多",
    waves: [
      W(["tanky", 4, 1.3]), W(["sneaky", 5, 1.0], ["healy", 1, 1]), W(["shieldy", 5, 1.1], ["healy", 2, 2.2]),
      W(["tanky", 4, 1.2], ["sneaky", 4, 1.0], ["healy", 2, 2.0]), W(["shieldy", 5, 1.0], ["tanky", 3, 1.2], ["healy", 3, 1.8]),
    ],
  },
  {
    name: "泥泥大王", theme: "swamp", paths: [P_SNAKE], startPetals: 14, feature: "章节BOSS泥泥大王",
    hint: "泥泥大王一边走一边给全军奶血,快拆奶源!",
    waves: [
      W(["tanky", 4, 1.3], ["healy", 2, 2.2]), W(["sneaky", 5, 1.0], ["shieldy", 4, 1.1]),
      W(["boss5", 1, 1], ["tanky", 3, 1.3], ["healy", 2, 2.0]),
    ],
  },
];

/* ---- 第六章 · 雪雪山坡:冰面加速 ---- */
const snowHand: LevelDef[] = [
  {
    name: "滑滑雪坡", theme: "snow", paths: [P_ZIG], startPetals: 12, speedMult: 1.18, feature: "冰面加速",
    hint: "雪地滑溜溜,所有怪都跑得更快!",
    waves: [W(["softy", 6, 0.9], ["fasty", 4, 0.7]), W(["dashy", 4, 1.1], ["splity", 3, 1.4]), W(["fasty", 6, 0.7], ["softy", 6, 0.8])],
  },
  {
    name: "暴风雪夜", theme: "snow", paths: [P_SNAKE], startPetals: 12, feature: "雪夜五波车轮战",
    hint: "整整 5 波怪!波与波之间抓紧补塔",
    waves: [
      W(["softy", 5, 1.0]), W(["fasty", 6, 0.7]), W(["splity", 4, 1.3]),
      W(["dashy", 5, 1.0]), W(["fasty", 5, 0.7], ["dashy", 4, 1.0]),
    ],
  },
  {
    name: "冰湖双路", theme: "snow", paths: [P_TOP, P_BOT], startPetals: 13, speedMult: 1.1, feature: "冰湖双路夹击",
    hint: "两条冰道一起加速冲刺,摆好大阵!",
    waves: [W(["fasty", 6, 0.7], ["splity", 3, 1.4]), W(["dashy", 5, 1.0], ["softy", 6, 0.8]), W(["fasty", 8, 0.55], ["dashy", 4, 1.0])],
  },
  {
    name: "花瓣寒冬", theme: "snow", paths: [P_MID], startPetals: 5, feature: "雪山经济挑战",
    hint: "寒冬花瓣特别少!先种阳光花攒钱",
    waves: [
      W(["softy", 5, 1.4]), W(["splity", 3, 1.6], ["fasty", 4, 0.8]),
      W(["dashy", 4, 1.2], ["softy", 5, 1.0]), W(["splity", 4, 1.3], ["fasty", 5, 0.7]),
    ],
  },
  {
    name: "雪崩快车", theme: "snow", paths: [P_LONG], startPetals: 13, speedMult: 1.15, feature: "极速冲刺潮",
    hint: "全是飞毛腿!露珠塔多放几座",
    waves: [W(["dashy", 5, 1.0], ["fasty", 5, 0.6]), W(["fasty", 8, 0.5], ["splity", 3, 1.3]), W(["dashy", 6, 0.8], ["mini", 6, 0.5])],
  },
  {
    name: "冰柱回廊", theme: "snow", paths: [P_CANYON], startPetals: 13, speedMult: 1.1, feature: "冰柱长廊战",
    hint: "长长的冰柱回廊,拐角就是塔位!",
    waves: [W(["softy", 7, 0.8], ["dashy", 4, 1.0]), W(["splity", 4, 1.2], ["fasty", 6, 0.6]), W(["dashy", 6, 0.8], ["splity", 4, 1.1])],
  },
  {
    name: "极寒冲刺赛", theme: "snow", paths: [P_SHORT], startPetals: 10, speedMult: 1.2, feature: "雪山短路极限",
    hint: "一条直冰道,怪冲得飞快!塔要又准又狠",
    waves: [
      W(["fasty", 6, 0.6]), W(["dashy", 5, 0.9], ["fasty", 5, 0.6]),
      W(["splity", 4, 1.2], ["mini", 6, 0.5]), W(["fasty", 8, 0.5], ["dashy", 5, 0.8]),
    ],
  },
  {
    name: "雪雪大王", theme: "snow", paths: [P_DIP], startPetals: 14, feature: "章节BOSS雪雪大王",
    hint: "雪雪大王半血后会暴走加速,留好减速塔!",
    waves: [
      W(["splity", 4, 1.2], ["fasty", 5, 0.7]), W(["dashy", 5, 0.9], ["softy", 6, 0.8]),
      W(["boss6", 1, 1], ["mini", 6, 0.8]),
    ],
  },
];

/* ---- 第七章 · 星夜庭院:隐身捉迷藏 ---- */
const nightHand: LevelDef[] = [
  {
    name: "星光初上", theme: "night", paths: [P_HOOK], startPetals: 13, feature: "星夜章开场",
    hint: "夜里隐隐怪特别多,记好它们现身的节奏!",
    waves: [W(["sneaky", 4, 1.3], ["fasty", 4, 0.8]), W(["sneaky", 5, 1.1], ["splity", 3, 1.4]), W(["sneaky", 6, 1.0], ["mini", 6, 0.55])],
  },
  {
    name: "萤火小径", theme: "night", paths: [P_STAIRS], startPetals: 13, feature: "夜路小分身群",
    hint: "萤火虫照亮小路,小分身成群结队跑!",
    waves: [W(["mini", 10, 0.5], ["sneaky", 3, 1.2]), W(["splity", 4, 1.3], ["mini", 8, 0.5]), W(["sneaky", 5, 1.0], ["mini", 10, 0.45])],
  },
  {
    name: "月影双巷", theme: "night", paths: [P_FORK_A, P_FORK_B], startPetals: 14, feature: "星夜双巷",
    hint: "两条月光小巷,隐身怪分头钻!",
    waves: [W(["sneaky", 4, 1.2], ["fasty", 5, 0.7]), W(["splity", 4, 1.3], ["sneaky", 4, 1.0]), W(["fasty", 7, 0.6], ["sneaky", 5, 0.9])],
  },
  {
    name: "梦游胖胖", theme: "night", paths: [P_UTURN], startPetals: 14, feature: "夜行胖胖团",
    hint: "梦游的胖胖怪混在隐身怪里,火力要分配好",
    waves: [W(["tanky", 3, 1.4], ["sneaky", 4, 1.1]), W(["tanky", 4, 1.3], ["splity", 3, 1.3]), W(["tanky", 4, 1.2], ["sneaky", 6, 0.9])],
  },
  {
    name: "星星雨夜", theme: "night", paths: [P_RIVER], startPetals: 14, feature: "星夜快攻潮",
    hint: "流星雨下怪跑得又急又密!",
    waves: [W(["fasty", 7, 0.6], ["mini", 8, 0.5]), W(["sneaky", 5, 1.0], ["fasty", 6, 0.6]), W(["splity", 5, 1.1], ["mini", 10, 0.45])],
  },
  {
    name: "afk守夜人", theme: "night", paths: [P_GATE], startPetals: 6, feature: "夜间经济挑战",
    hint: "守夜的花瓣只有一点点,精打细算!",
    waves: [
      W(["sneaky", 4, 1.2]), W(["mini", 8, 0.55], ["fasty", 4, 0.7]),
      W(["splity", 4, 1.2], ["sneaky", 4, 1.0]), W(["fasty", 6, 0.6], ["mini", 8, 0.5]),
    ],
  },
  {
    name: "午夜大巡游", theme: "night", paths: [P_SPIRAL], startPetals: 15, feature: "星夜五波巡游",
    hint: "5 波午夜大军,隐身+分身全都有!",
    waves: [
      W(["sneaky", 5, 1.0]), W(["mini", 12, 0.45]), W(["splity", 5, 1.1], ["fasty", 5, 0.6]),
      W(["sneaky", 6, 0.9], ["mini", 8, 0.5]), W(["splity", 5, 1.0], ["sneaky", 5, 0.9], ["fasty", 6, 0.55]),
    ],
  },
  {
    name: "幽幽夜影", theme: "night", paths: [P_LOOP], startPetals: 15, feature: "章节BOSS幽幽夜影",
    hint: "幽幽夜影会隐身还会召唤小影子,别跟丢!",
    waves: [
      W(["sneaky", 5, 1.0], ["mini", 8, 0.5]), W(["splity", 5, 1.1], ["fasty", 6, 0.6]),
      W(["boss8", 1, 1], ["sneaky", 4, 1.0]),
    ],
  },
];

/* ---- 第八章 · 熔岩峡谷:高速强袭 ---- */
const lavaHand: LevelDef[] = [
  {
    name: "峡谷热身", theme: "lava", paths: [P_STRAIGHT], startPetals: 14, speedMult: 1.1, feature: "熔岩章开场",
    hint: "岩浆烤得怪物直蹦跶,全员加速!",
    waves: [W(["dashy", 5, 1.0], ["fasty", 5, 0.6]), W(["tanky", 4, 1.2], ["dashy", 5, 0.9]), W(["shieldy", 5, 1.0], ["fasty", 6, 0.55])],
  },
  {
    name: "火山灰突袭", theme: "lava", paths: [P_ZIG], startPetals: 14, speedMult: 1.12, feature: "熔岩冲刺潮",
    hint: "冲冲怪借着火山灰一波接一波冲刺!",
    waves: [W(["dashy", 6, 0.9]), W(["dashy", 6, 0.8], ["shieldy", 4, 1.1]), W(["dashy", 7, 0.7], ["tanky", 4, 1.2])],
  },
  {
    name: "岩浆双桥", theme: "lava", paths: [P_TOP, P_BOT], startPetals: 15, speedMult: 1.1, feature: "熔岩双桥",
    hint: "两座石桥横跨岩浆,双线快攻!",
    waves: [W(["fasty", 7, 0.55], ["dashy", 5, 0.9]), W(["shieldy", 5, 1.0], ["tanky", 4, 1.2]), W(["dashy", 7, 0.7], ["fasty", 7, 0.5])],
  },
  {
    name: "铁甲熔炉", theme: "lava", paths: [P_WIND], startPetals: 15, feature: "熔岩重甲团",
    hint: "熔炉里锻出来的重甲军团,超级硬!",
    waves: [W(["shieldy", 5, 1.1], ["tanky", 4, 1.2]), W(["shieldy", 6, 1.0], ["dashy", 5, 0.9]), W(["tanky", 5, 1.1], ["shieldy", 6, 0.9])],
  },
  {
    name: "喷发倒计时", theme: "lava", paths: [P_SHORT], startPetals: 12, speedMult: 1.18, feature: "熔岩短路强攻",
    hint: "火山要喷发了!一条短道全速冲刺",
    waves: [
      W(["dashy", 6, 0.8]), W(["fasty", 8, 0.5], ["dashy", 5, 0.8]),
      W(["tanky", 4, 1.1], ["shieldy", 4, 1.0]), W(["dashy", 8, 0.6], ["fasty", 8, 0.45]),
    ],
  },
  {
    name: "余烬回廊", theme: "lava", paths: [P_CANYON], startPetals: 15, speedMult: 1.08, feature: "熔岩长廊鏖战",
    hint: "长长的余烬回廊,减速塔守拐角!",
    waves: [W(["tanky", 5, 1.1], ["dashy", 5, 0.9]), W(["shieldy", 6, 0.9], ["fasty", 7, 0.5]), W(["dashy", 7, 0.7], ["tanky", 5, 1.0])],
  },
  {
    name: "火口大围攻", theme: "lava", paths: [P_UTURN], startPetals: 16, speedMult: 1.1, feature: "熔岩五波围攻",
    hint: "5 波火口大军绕着你转圈!",
    waves: [
      W(["fasty", 8, 0.5]), W(["dashy", 6, 0.8]), W(["shieldy", 6, 0.9], ["fasty", 6, 0.55]),
      W(["tanky", 5, 1.0], ["dashy", 6, 0.75]), W(["shieldy", 6, 0.85], ["tanky", 4, 1.0], ["dashy", 6, 0.7]),
    ],
  },
  {
    name: "岩浆巨人", theme: "lava", paths: [P_SNAKE], startPetals: 16, speedMult: 1.08, feature: "章节BOSS岩浆巨人",
    hint: "岩浆巨人会冲刺,半血还会暴走!稳住!",
    waves: [
      W(["shieldy", 5, 1.0], ["dashy", 6, 0.8]), W(["tanky", 5, 1.0], ["fasty", 7, 0.5]),
      W(["boss7", 1, 1], ["dashy", 5, 0.9]),
    ],
  },
];

/* ---- 第九章 · 糖果云端:最终试炼 ---- */
const candyHand: LevelDef[] = [
  {
    name: "云端糖门", theme: "candy", paths: [P_MID], startPetals: 15, feature: "糖果章开场",
    hint: "最终章!九种怪全都会出现,拿出全部本事!",
    waves: [W(["softy", 8, 0.8], ["sneaky", 4, 1.0]), W(["splity", 4, 1.2], ["shieldy", 5, 1.0]), W(["healy", 2, 2.0], ["tanky", 5, 1.0], ["fasty", 6, 0.55])],
  },
  {
    name: "彩虹糖雨", theme: "candy", paths: [P_DIP], startPetals: 15, feature: "全家福快攻",
    hint: "彩虹糖雨里什么怪都往下掉!",
    waves: [W(["fasty", 8, 0.5], ["mini", 8, 0.45]), W(["dashy", 6, 0.8], ["sneaky", 5, 0.9]), W(["splity", 5, 1.0], ["healy", 2, 2.0], ["fasty", 7, 0.5])],
  },
  {
    name: "棉花糖要塞", theme: "candy", paths: [P_GATE], startPetals: 16, feature: "云端要塞防卫",
    hint: "短短的回形防线,重甲糖果兵压境!",
    waves: [W(["shieldy", 6, 0.9], ["healy", 2, 2.0]), W(["tanky", 5, 1.0], ["shieldy", 5, 0.9]), W(["tanky", 6, 0.9], ["healy", 3, 1.8], ["shieldy", 5, 0.85])],
  },
  {
    name: "跳跳糖双路", theme: "candy", paths: [P_TOP, P_BOT], startPetals: 17, feature: "云端双路总攻",
    hint: "两条云道一起总攻,注意分配火力!",
    waves: [W(["dashy", 6, 0.8], ["splity", 4, 1.1]), W(["sneaky", 6, 0.85], ["tanky", 4, 1.1]), W(["fasty", 9, 0.45], ["healy", 3, 1.8])],
  },
  {
    name: "糖霜风暴", theme: "candy", paths: [P_LONG], startPetals: 17, feature: "云端超长风暴",
    hint: "超长糖霜跑道,一场六波的马拉松!",
    waves: [
      W(["softy", 9, 0.7]), W(["sneaky", 6, 0.85]), W(["splity", 5, 1.0], ["mini", 8, 0.45]),
      W(["shieldy", 6, 0.85], ["dashy", 6, 0.75]), W(["healy", 3, 1.8], ["tanky", 5, 0.95]),
      W(["fasty", 10, 0.4], ["dashy", 6, 0.7]),
    ],
  },
  {
    name: "夹心饼干阵", theme: "candy", paths: [P_FORK_A, P_FORK_B], startPetals: 17, feature: "云端夹心双路",
    hint: "上下夹心一起咬过来!全塔种齐才顶得住",
    waves: [W(["splity", 5, 1.0], ["sneaky", 5, 0.9]), W(["shieldy", 6, 0.85], ["healy", 3, 1.8]), W(["tanky", 5, 0.95], ["dashy", 6, 0.75], ["mini", 10, 0.4])],
  },
  {
    name: "糖纸终极考", theme: "candy", paths: [P_SPIRAL], startPetals: 18, feature: "最终六波试炼",
    hint: "决战前的最后一考:六波全怪种!",
    waves: [
      W(["fasty", 8, 0.5]), W(["sneaky", 6, 0.85], ["mini", 8, 0.45]), W(["splity", 6, 0.95], ["healy", 3, 1.8]),
      W(["shieldy", 7, 0.8], ["dashy", 6, 0.7]), W(["tanky", 6, 0.9], ["sneaky", 6, 0.8]),
      W(["dashy", 7, 0.65], ["fasty", 9, 0.42], ["healy", 3, 1.6]),
    ],
  },
  {
    name: "糖果魔王", theme: "candy", paths: [P_UTURN], startPetals: 18, feature: "最终BOSS糖果魔王",
    hint: "最终 BOSS!糖果魔王会召唤、会暴走、倒下还会裂开!",
    waves: [
      W(["shieldy", 6, 0.85], ["sneaky", 6, 0.8]), W(["healy", 3, 1.8], ["tanky", 5, 0.9]),
      W(["splity", 6, 0.9], ["dashy", 7, 0.65]),
      W(["boss9", 1, 1], ["mini", 8, 0.6]),
    ],
  },
];

const HAND_BY_THEME: LevelDef[][] = [
  grassHand, beachHand, forestHand, desertHand, swampHand, snowHand, nightHand, lavaHand, candyHand,
];

export const LEVELS: LevelDef[] = HAND_BY_THEME.flatMap((hand, ti) => buildTheme(ti, hand));

/** 一波怪的出场时间表:各批依次登场,批内按 gap 排队。 */
export function waveSpawnTimes(
  wave: ReadonlyArray<WaveEntry>,
): Array<{ kind: MonsterKind; time: number }> {
  const out: Array<{ kind: MonsterKind; time: number }> = [];
  let offset = 0;
  for (const entry of wave) {
    for (let i = 0; i < entry.count; i++) {
      out.push({ kind: entry.kind, time: offset + i * entry.gap });
    }
    offset += entry.count * entry.gap + 0.6;
  }
  return out;
}

export function waveMonsterCount(wave: ReadonlyArray<WaveEntry>): number {
  return wave.reduce((sum, e) => sum + e.count, 0);
}

export function levelMonsterCount(def: LevelDef): number {
  return def.waves.reduce((sum, w) => sum + waveMonsterCount(w), 0);
}

/** 关卡波次结构签名(生成器查重用):怪种×数量按波拼接。 */
export function levelWaveSignature(def: LevelDef): string {
  return def.waves
    .map((w) => w.map((e) => `${e.kind}x${e.count}`).join("+"))
    .join("|");
}

/* ---------------- 结算与进度 ---------------- */

export const HEARTS_PER_LEVEL = 5;

/** 连击奖励:每连续快速打倒 5 只,奖励 2 花瓣。 */
export function comboPetalBonus(combo: number): number {
  return combo > 0 && combo % 5 === 0 ? 2 : 0;
}

/** 单关星级:一颗心不掉 3 星,掉 1 颗 2 星,守住就有 1 星。 */
export function starsForLevel(heartsLost: number): 1 | 2 | 3 {
  if (heartsLost <= 0) return 3;
  if (heartsLost <= 1) return 2;
  return 1;
}

export const PROGRESS_KEY = "yiduo-yixing.garden-guard.campaign.v2";

/** 存档解析:每关最好星级(0=未通),长度对齐关卡数。 */
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
    // 坏档就当新档
  }
  return out;
}

export function serializeProgress(stars: ReadonlyArray<number>): string {
  return JSON.stringify(stars);
}

/** 第 idx 关是否解锁:第一关永远解锁,其余要通过上一关。 */
export function isLevelUnlocked(stars: ReadonlyArray<number>, idx: number): boolean {
  if (idx <= 0) return true;
  return (stars[idx - 1] ?? 0) > 0;
}

/** 章节是否解锁:本章第一关解锁即可进入。 */
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
