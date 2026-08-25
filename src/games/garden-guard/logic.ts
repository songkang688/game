// 花园守卫 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 20 关三大章节塔防战役:草地花园 → 沙滩海湾 → 雪雪山坡。

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
  | "boss1" // 大软软(草地章 BOSS)
  | "boss2" // 蟹蟹将军(沙滩章 BOSS,会召唤小怪)
  | "boss3"; // 雪雪大王(雪地章 BOSS,半血后暴走加速)

export interface MonsterSpec {
  name: string;
  hp: number;
  armor: number;
  speed: number; // 格/秒
  reward: number; // 打倒奖励花瓣
  size: number; // 半径(格)
  boss: boolean;
}

export const MONSTER_INFO: Record<MonsterKind, MonsterSpec> = {
  softy: { name: "软软怪", hp: 3, armor: 0, speed: 0.85, reward: 1, size: 0.3, boss: false },
  fasty: { name: "飘飘怪", hp: 2, armor: 0, speed: 1.5, reward: 1, size: 0.24, boss: false },
  tanky: { name: "胖胖怪", hp: 10, armor: 0, speed: 0.5, reward: 2, size: 0.38, boss: false },
  dashy: { name: "冲冲怪", hp: 4, armor: 0, speed: 0.7, reward: 2, size: 0.28, boss: false },
  shieldy: { name: "盾盾怪", hp: 5, armor: 4, speed: 0.6, reward: 2, size: 0.32, boss: false },
  splity: { name: "分身怪", hp: 6, armor: 0, speed: 0.65, reward: 2, size: 0.34, boss: false },
  sneaky: { name: "隐隐怪", hp: 4, armor: 0, speed: 0.9, reward: 2, size: 0.28, boss: false },
  healy: { name: "奶油怪", hp: 6, armor: 0, speed: 0.55, reward: 3, size: 0.32, boss: false },
  mini: { name: "小分身", hp: 2, armor: 0, speed: 1.1, reward: 1, size: 0.2, boss: false },
  boss1: { name: "大软软", hp: 60, armor: 0, speed: 0.38, reward: 12, size: 0.55, boss: true },
  boss2: { name: "蟹蟹将军", hp: 95, armor: 6, speed: 0.34, reward: 16, size: 0.58, boss: true },
  boss3: { name: "雪雪大王", hp: 140, armor: 0, speed: 0.32, reward: 20, size: 0.6, boss: true },
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
/** 蟹蟹将军每隔几秒召唤小分身。 */
export const SUMMON_INTERVAL = 6;
/** 雪雪大王半血后的加速倍率。 */
export const ENRAGE_MULT = 1.6;

/** 怪物血量随关卡加深(0 起的关卡下标)。 */
export function monsterHp(kind: MonsterKind, levelIdx: number): number {
  return Math.round(MONSTER_INFO[kind].hp * (1 + levelIdx * 0.12));
}

export function monsterArmor(kind: MonsterKind, levelIdx: number): number {
  const base = MONSTER_INFO[kind].armor;
  if (base === 0) return 0;
  return base + Math.floor(levelIdx / 6);
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

/* ---------------- 关卡与波次 ---------------- */

export type ThemeId = "grass" | "beach" | "snow";

export interface ThemeStyle {
  name: string;
  bgA: string;
  bgB: string;
  path: string;
  accent: string;
}

export const THEME_STYLE: Record<ThemeId, ThemeStyle> = {
  grass: { name: "草地花园", bgA: "#d5f2ca", bgB: "#def5d5", path: "#f9e9bd", accent: "#4a9a5a" },
  beach: { name: "沙滩海湾", bgA: "#fdeec9", bgB: "#faf0d8", path: "#bfe9ff", accent: "#e0a030" },
  snow: { name: "雪雪山坡", bgA: "#e8f0fb", bgB: "#f0f6ff", path: "#d8e4f5", accent: "#5a8ac9" },
};

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
  /** 开场提示 */
  hint: string;
}

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

export const LEVELS: LevelDef[] = [
  // ---- 第一章 · 草地花园 (1-7) ----
  {
    name: "小花小径", theme: "grass", paths: [P_STRAIGHT], startPetals: 6, feature: "入门教学",
    hint: "选一张塔卡,点绿草地放塔,守住小花朵!",
    waves: [
      [{ kind: "softy", count: 4, gap: 1.6 }],
      [{ kind: "softy", count: 6, gap: 1.2 }],
    ],
  },
  {
    name: "飘飘出没", theme: "grass", paths: [P_HOOK], startPetals: 7, feature: "飘飘怪登场",
    hint: "飘飘怪飞得快!针针塔连发拦得住它",
    waves: [
      [{ kind: "softy", count: 4, gap: 1.4 }, { kind: "fasty", count: 2, gap: 1.0 }],
      [{ kind: "fasty", count: 4, gap: 0.9 }, { kind: "softy", count: 4, gap: 1.2 }],
    ],
  },
  {
    name: "阳光牧场", theme: "grass", paths: [P_WIND], startPetals: 6, unlockTower: "sunny", feature: "阳光花解锁",
    hint: "新塔阳光花!种下它慢慢攒花瓣",
    waves: [
      [{ kind: "softy", count: 5, gap: 1.3 }],
      [{ kind: "softy", count: 5, gap: 1.1 }, { kind: "fasty", count: 3, gap: 0.9 }],
      [{ kind: "tanky", count: 1, gap: 1 }, { kind: "softy", count: 5, gap: 1.0 }],
    ],
  },
  {
    name: "双岔路口", theme: "grass", paths: [P_TOP, P_BOT], startPetals: 9, feature: "双路绕路",
    hint: "怪物会走上下两条路!两边都要放塔哦",
    waves: [
      [{ kind: "softy", count: 6, gap: 1.2 }],
      [{ kind: "softy", count: 6, gap: 1.0 }, { kind: "fasty", count: 3, gap: 0.9 }],
      [{ kind: "tanky", count: 2, gap: 1.8 }, { kind: "fasty", count: 4, gap: 0.8 }],
    ],
  },
  {
    name: "冲冲快跑", theme: "grass", paths: [P_ZIG], startPetals: 8, unlockTower: "boom", feature: "冲冲怪+花火塔",
    hint: "冲冲怪会突然加速!新塔花火塔轰一大片",
    waves: [
      [{ kind: "dashy", count: 3, gap: 1.6 }, { kind: "softy", count: 4, gap: 1.1 }],
      [{ kind: "dashy", count: 4, gap: 1.3 }, { kind: "fasty", count: 3, gap: 0.8 }],
      [{ kind: "tanky", count: 2, gap: 1.6 }, { kind: "dashy", count: 4, gap: 1.1 }],
    ],
  },
  {
    name: "盾盾小队", theme: "grass", paths: [P_LOOP], startPetals: 9, feature: "盾盾怪护甲",
    hint: "盾盾怪有硬壳,要先敲碎护甲再掉血!",
    waves: [
      [{ kind: "shieldy", count: 2, gap: 2.0 }, { kind: "softy", count: 5, gap: 1.1 }],
      [{ kind: "shieldy", count: 3, gap: 1.6 }, { kind: "fasty", count: 4, gap: 0.8 }],
      [{ kind: "shieldy", count: 3, gap: 1.4 }, { kind: "dashy", count: 3, gap: 1.2 }],
    ],
  },
  {
    name: "草地大王", theme: "grass", paths: [P_SNAKE], startPetals: 10, feature: "章节BOSS大软软",
    hint: "大软软 BOSS 来啦!多放塔、记得升级!",
    waves: [
      [{ kind: "softy", count: 6, gap: 1.0 }, { kind: "fasty", count: 4, gap: 0.8 }],
      [{ kind: "tanky", count: 2, gap: 1.6 }, { kind: "shieldy", count: 2, gap: 1.6 }],
      [{ kind: "boss1", count: 1, gap: 1 }, { kind: "fasty", count: 4, gap: 1.0 }],
    ],
  },
  // ---- 第二章 · 沙滩海湾 (8-14) ----
  {
    name: "沙滩开跑", theme: "beach", paths: [P_MID], startPetals: 8, feature: "沙滩章开场",
    hint: "欢迎来到沙滩海湾!怪物皮更厚了",
    waves: [
      [{ kind: "softy", count: 6, gap: 1.0 }, { kind: "fasty", count: 4, gap: 0.8 }],
      [{ kind: "dashy", count: 4, gap: 1.2 }, { kind: "tanky", count: 2, gap: 1.6 }],
      [{ kind: "shieldy", count: 3, gap: 1.4 }, { kind: "fasty", count: 5, gap: 0.7 }],
    ],
  },
  {
    name: "分身沙堡", theme: "beach", paths: [P_HOOK], startPetals: 9, feature: "分身怪登场",
    hint: "分身怪打倒后会分成两只小的,别松劲!",
    waves: [
      [{ kind: "splity", count: 2, gap: 2.2 }, { kind: "softy", count: 4, gap: 1.1 }],
      [{ kind: "splity", count: 3, gap: 1.8 }, { kind: "fasty", count: 4, gap: 0.8 }],
      [{ kind: "splity", count: 4, gap: 1.5 }, { kind: "dashy", count: 3, gap: 1.2 }],
    ],
  },
  {
    name: "长长回廊", theme: "beach", paths: [P_LONG], startPetals: 10, feature: "超长路线",
    hint: "这条路好长呀!露珠塔放在拐角最划算",
    waves: [
      [{ kind: "tanky", count: 3, gap: 1.6 }, { kind: "softy", count: 6, gap: 0.9 }],
      [{ kind: "shieldy", count: 3, gap: 1.4 }, { kind: "splity", count: 2, gap: 1.8 }],
      [{ kind: "dashy", count: 5, gap: 1.0 }, { kind: "fasty", count: 5, gap: 0.7 }],
    ],
  },
  {
    name: "捉迷藏湾", theme: "beach", paths: [P_DIP], startPetals: 10, feature: "隐隐怪隐身",
    hint: "隐隐怪会隐身,塔打不到!等它现身再打",
    waves: [
      [{ kind: "sneaky", count: 3, gap: 1.8 }, { kind: "softy", count: 4, gap: 1.0 }],
      [{ kind: "sneaky", count: 4, gap: 1.4 }, { kind: "fasty", count: 4, gap: 0.8 }],
      [{ kind: "sneaky", count: 4, gap: 1.2 }, { kind: "shieldy", count: 2, gap: 1.6 }],
    ],
  },
  {
    name: "双路狂潮", theme: "beach", paths: [P_TOP, P_BOT], startPetals: 11, feature: "双路+快攻",
    hint: "两条路一起冲!飘飘怪和冲冲怪都超快",
    waves: [
      [{ kind: "fasty", count: 6, gap: 0.7 }, { kind: "dashy", count: 3, gap: 1.2 }],
      [{ kind: "dashy", count: 5, gap: 1.0 }, { kind: "splity", count: 2, gap: 1.8 }],
      [{ kind: "fasty", count: 8, gap: 0.55 }, { kind: "tanky", count: 2, gap: 1.6 }],
    ],
  },
  {
    name: "奶油补给站", theme: "beach", paths: [P_WIND], startPetals: 11, feature: "奶油怪回血",
    hint: "奶油怪会给附近的怪回血,先打它!",
    waves: [
      [{ kind: "healy", count: 1, gap: 1 }, { kind: "softy", count: 6, gap: 1.0 }],
      [{ kind: "healy", count: 2, gap: 3.0 }, { kind: "tanky", count: 3, gap: 1.4 }],
      [{ kind: "healy", count: 2, gap: 2.5 }, { kind: "shieldy", count: 3, gap: 1.3 }],
    ],
  },
  {
    name: "蟹蟹将军", theme: "beach", paths: [P_LOOP], startPetals: 12, feature: "章节BOSS蟹蟹将军",
    hint: "蟹蟹将军有护甲还会召唤小兵,加油!",
    waves: [
      [{ kind: "shieldy", count: 3, gap: 1.4 }, { kind: "splity", count: 2, gap: 1.8 }],
      [{ kind: "healy", count: 1, gap: 1 }, { kind: "tanky", count: 3, gap: 1.4 }],
      [{ kind: "boss2", count: 1, gap: 1 }, { kind: "fasty", count: 5, gap: 0.9 }],
    ],
  },
  // ---- 第三章 · 雪雪山坡 (15-20) ----
  {
    name: "滑滑雪坡", theme: "snow", paths: [P_ZIG], startPetals: 10, speedMult: 1.18, feature: "冰面加速",
    hint: "雪地滑溜溜,所有怪都跑得更快!",
    waves: [
      [{ kind: "softy", count: 6, gap: 0.9 }, { kind: "fasty", count: 4, gap: 0.7 }],
      [{ kind: "dashy", count: 4, gap: 1.1 }, { kind: "shieldy", count: 3, gap: 1.3 }],
      [{ kind: "splity", count: 3, gap: 1.5 }, { kind: "tanky", count: 2, gap: 1.5 }],
    ],
  },
  {
    name: "暴风雪夜", theme: "snow", paths: [P_SNAKE], startPetals: 11, feature: "五波车轮战",
    hint: "整整 5 波怪!波与波之间抓紧补塔",
    waves: [
      [{ kind: "softy", count: 5, gap: 1.0 }],
      [{ kind: "fasty", count: 6, gap: 0.7 }],
      [{ kind: "shieldy", count: 4, gap: 1.2 }],
      [{ kind: "sneaky", count: 4, gap: 1.2 }],
      [{ kind: "tanky", count: 3, gap: 1.4 }, { kind: "dashy", count: 4, gap: 1.0 }],
    ],
  },
  {
    name: "双路混雪", theme: "snow", paths: [P_TOP, P_BOT], startPetals: 12, speedMult: 1.1, feature: "双路+全怪种",
    hint: "两条雪路,什么怪都有,摆好大阵!",
    waves: [
      [{ kind: "sneaky", count: 3, gap: 1.4 }, { kind: "splity", count: 2, gap: 1.8 }],
      [{ kind: "healy", count: 2, gap: 3.0 }, { kind: "shieldy", count: 3, gap: 1.3 }],
      [{ kind: "dashy", count: 5, gap: 0.9 }, { kind: "tanky", count: 3, gap: 1.4 }],
    ],
  },
  {
    name: "花瓣紧缺", theme: "snow", paths: [P_MID], startPetals: 5, feature: "经济挑战",
    hint: "开局花瓣特别少!先种阳光花攒钱",
    waves: [
      [{ kind: "softy", count: 5, gap: 1.4 }],
      [{ kind: "splity", count: 3, gap: 1.6 }, { kind: "fasty", count: 4, gap: 0.8 }],
      [{ kind: "shieldy", count: 3, gap: 1.3 }, { kind: "healy", count: 1, gap: 1 }],
      [{ kind: "tanky", count: 3, gap: 1.3 }, { kind: "dashy", count: 4, gap: 1.0 }],
    ],
  },
  {
    name: "冲刺大军", theme: "snow", paths: [P_LONG], startPetals: 12, speedMult: 1.12, feature: "极速冲刺潮",
    hint: "全是飞毛腿!露珠塔多放几座",
    waves: [
      [{ kind: "dashy", count: 5, gap: 1.0 }, { kind: "fasty", count: 5, gap: 0.6 }],
      [{ kind: "fasty", count: 8, gap: 0.5 }, { kind: "sneaky", count: 3, gap: 1.2 }],
      [{ kind: "dashy", count: 6, gap: 0.8 }, { kind: "mini", count: 6, gap: 0.5 }],
    ],
  },
  {
    name: "雪雪大王", theme: "snow", paths: [P_DIP], startPetals: 13, feature: "最终BOSS雪雪大王",
    hint: "最终 BOSS!雪雪大王半血后会暴走!",
    waves: [
      [{ kind: "shieldy", count: 3, gap: 1.3 }, { kind: "sneaky", count: 3, gap: 1.2 }],
      [{ kind: "healy", count: 2, gap: 3.0 }, { kind: "splity", count: 3, gap: 1.5 }],
      [{ kind: "tanky", count: 3, gap: 1.3 }, { kind: "dashy", count: 4, gap: 1.0 }],
      [{ kind: "boss3", count: 1, gap: 1 }, { kind: "mini", count: 6, gap: 0.8 }],
    ],
  },
];

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

export const PROGRESS_KEY = "yiduo-yixing.garden-guard.campaign.v1";

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

export function totalStars(stars: ReadonlyArray<number>): number {
  return stars.reduce((s, v) => s + v, 0);
}
