// 花园守卫 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

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

/** 挑选射程内"走得最远"的怪物下标;没有则返回 -1。 */
export function pickTarget(
  monsters: ReadonlyArray<{ x: number; y: number; dist: number; hp: number }>,
  tx: number,
  ty: number,
  range: number,
): number {
  let best = -1;
  let bestDist = -1;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - tx, m.y - ty) <= range && m.dist > bestDist) {
      best = i;
      bestDist = m.dist;
    }
  }
  return best;
}

/* ---------------- 塔 ---------------- */

export type TowerKind = "bubble" | "needle" | "dew";

export interface TowerSpec {
  name: string;
  cost: number;
  range: number;
  /** 攻击间隔(秒);0 表示光环塔不攻击 */
  cd: number;
  dmg: number;
  /** 光环减速倍率(越小怪越慢),仅露珠塔有 */
  slow?: number;
  desc: string;
}

export const TOWER_INFO: Record<TowerKind, TowerSpec> = {
  bubble: { name: "泡泡塔", cost: 3, range: 2.4, cd: 0.8, dmg: 2, desc: "慢但一下打 2 点" },
  needle: { name: "针针塔", cost: 5, range: 2.1, cd: 0.3, dmg: 1, desc: "咻咻咻连发" },
  dew: { name: "露珠塔", cost: 4, range: 1.9, cd: 0, dmg: 0, slow: 0.55, desc: "让怪走得慢慢的" },
};

export const TOWER_KINDS: TowerKind[] = ["bubble", "needle", "dew"];
export const MAX_TOWER_LEVEL = 3;

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

/** 多个减速光环叠加:取最狠的一个,但最慢不低于 0.35。 */
export function combineSlow(factors: ReadonlyArray<number>): number {
  if (factors.length === 0) return 1;
  return Math.max(0.35, Math.min(...factors));
}

/* ---------------- 怪物 ---------------- */

export type MonsterKind = "softy" | "fasty" | "tanky" | "boss";

export interface MonsterSpec {
  name: string;
  hp: number;
  speed: number; // 格/秒
  reward: number; // 打倒奖励花瓣
  size: number; // 半径(格)
}

export const MONSTER_INFO: Record<MonsterKind, MonsterSpec> = {
  softy: { name: "软软怪", hp: 3, speed: 0.85, reward: 1, size: 0.3 },
  fasty: { name: "飘飘怪", hp: 2, speed: 1.5, reward: 1, size: 0.24 },
  tanky: { name: "胖胖怪", hp: 10, speed: 0.5, reward: 2, size: 0.38 },
  boss: { name: "大软软", hp: 60, speed: 0.38, reward: 12, size: 0.55 },
};

/** 怪物血量随关卡加深。 */
export function monsterHp(kind: MonsterKind, level: number): number {
  return Math.round(MONSTER_INFO[kind].hp * (1 + (level - 1) * 0.35));
}

/* ---------------- 关卡与波次 ---------------- */

export interface WaveEntry {
  kind: MonsterKind;
  count: number;
  gap: number; // 同一批怪间隔秒
}

export interface LevelDef {
  name: string;
  corners: ReadonlyArray<readonly [number, number]>;
  waves: WaveEntry[][];
  startPetals: number;
}

export const LEVELS: LevelDef[] = [
  {
    name: "小花小径",
    corners: [
      [0, 2],
      [5, 2],
      [5, 4],
      [8, 4],
    ],
    startPetals: 6,
    waves: [
      [{ kind: "softy", count: 4, gap: 1.6 }],
      [
        { kind: "softy", count: 5, gap: 1.3 },
        { kind: "fasty", count: 2, gap: 1.0 },
      ],
      [
        { kind: "softy", count: 4, gap: 1.1 },
        { kind: "tanky", count: 1, gap: 1.0 },
      ],
    ],
  },
  {
    name: "弯弯绕花园",
    corners: [
      [0, 1],
      [6, 1],
      [6, 3],
      [1, 3],
      [1, 5],
      [8, 5],
    ],
    startPetals: 7,
    waves: [
      [
        { kind: "softy", count: 5, gap: 1.4 },
        { kind: "fasty", count: 3, gap: 0.9 },
      ],
      [
        { kind: "fasty", count: 5, gap: 0.8 },
        { kind: "softy", count: 4, gap: 1.2 },
      ],
      [
        { kind: "tanky", count: 2, gap: 2.0 },
        { kind: "fasty", count: 4, gap: 0.8 },
      ],
    ],
  },
  {
    name: "之字山坡",
    corners: [
      [0, 4],
      [3, 4],
      [3, 1],
      [6, 1],
      [6, 4],
      [8, 4],
    ],
    startPetals: 8,
    waves: [
      [
        { kind: "softy", count: 6, gap: 1.2 },
        { kind: "tanky", count: 1, gap: 1.0 },
      ],
      [
        { kind: "fasty", count: 6, gap: 0.7 },
        { kind: "tanky", count: 2, gap: 1.8 },
      ],
      [
        { kind: "softy", count: 6, gap: 0.9 },
        { kind: "fasty", count: 4, gap: 0.7 },
        { kind: "tanky", count: 2, gap: 1.6 },
      ],
    ],
  },
  {
    name: "绕圈圈果园",
    corners: [
      [0, 0],
      [7, 0],
      [7, 3],
      [2, 3],
      [2, 5],
      [8, 5],
    ],
    startPetals: 9,
    waves: [
      [
        { kind: "fasty", count: 6, gap: 0.7 },
        { kind: "softy", count: 5, gap: 1.0 },
      ],
      [
        { kind: "tanky", count: 3, gap: 1.6 },
        { kind: "fasty", count: 5, gap: 0.7 },
      ],
      [
        { kind: "softy", count: 8, gap: 0.8 },
        { kind: "tanky", count: 2, gap: 1.5 },
        { kind: "fasty", count: 4, gap: 0.6 },
      ],
    ],
  },
  {
    name: "彩虹终点站",
    corners: [
      [0, 5],
      [7, 5],
      [7, 2],
      [3, 2],
      [3, 0],
      [8, 0],
    ],
    startPetals: 10,
    waves: [
      [
        { kind: "softy", count: 6, gap: 1.0 },
        { kind: "fasty", count: 5, gap: 0.7 },
      ],
      [
        { kind: "tanky", count: 3, gap: 1.5 },
        { kind: "fasty", count: 6, gap: 0.6 },
      ],
      [
        { kind: "tanky", count: 2, gap: 1.6 },
        { kind: "boss", count: 1, gap: 1.0 },
      ],
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

/* ---------------- 结算 ---------------- */

/** 连击奖励:每连续快速打倒 5 只,奖励 2 花瓣。 */
export function comboPetalBonus(combo: number): number {
  return combo > 0 && combo % 5 === 0 ? 2 : 0;
}

/** 整局星级:不重试且几乎不掉心 → 3 星。 */
export function starsForRun(retries: number, heartsLost: number): 1 | 2 | 3 {
  if (retries === 0 && heartsLost <= 1) return 3;
  if (retries <= 1) return 2;
  return 1;
}
