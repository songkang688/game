// 花园守卫 1.2 —— 塔的定位、克制关系表、支援塔加成。
// 纯逻辑,不依赖 DOM,也不 import sim/index,攻略与运行时共用同一份表。
//
// 为什么要单独一份表:1.1 只有一堆散装数值(cost/range/cd/dmg),
// 「这座塔是干嘛的」「这只怪该拿什么打」全靠玩家自己猜。
// 1.2 把定位和克制写成数据,攻略照着渲染,单测照着断言,不会说一套做一套。

import {
  MONSTER_INFO,
  MonsterKind,
  TOWER_INFO,
  TOWER_KINDS,
  TowerKind,
  WeatherKind,
  chimeAffects,
  combineChime,
  effectiveRange,
  towerCooldown,
  towerRange,
  weatherRangeMult,
} from "./logic";

/* ---------------- 塔的定位 ---------------- */

export type TowerRole = "single" | "splash" | "slow" | "support" | "pierce" | "economy";

/** 规格要求必须齐的五个定位(经济是额外的第六个,不在硬性清单里)。 */
export const REQUIRED_ROLES: TowerRole[] = ["single", "splash", "slow", "support", "pierce"];

export const TOWER_ROLE: Record<TowerKind, TowerRole> = {
  bubble: "single",
  needle: "single",
  boom: "splash",
  dew: "slow",
  frost: "slow",
  mist: "pierce",
  chime: "support",
  sunny: "economy",
};

export const ROLE_LABEL: Record<TowerRole, string> = {
  single: "单体",
  splash: "溅射",
  slow: "减速",
  support: "支援",
  pierce: "穿透",
  economy: "经济",
};

/** 这个定位下有哪些塔。 */
export function towersOfRole(role: TowerRole): TowerKind[] {
  return TOWER_KINDS.filter((k) => TOWER_ROLE[k] === role);
}

/* ---------------- 怪的原型分类 ---------------- */

export type EnemyArchetype =
  | "armored" // 护甲:吃穿透
  | "swift" // 迅捷:吃减速
  | "flying" // 飞行:吃对空
  | "splitting" // 分裂:吃溅射
  | "healer" // 奶妈:吃集火
  | "sneaky" // 隐身:吃范围
  | "plain"; // 普通兵

/** 规格点名要补齐的四类。 */
export const CORE_ARCHETYPES: EnemyArchetype[] = ["armored", "swift", "flying", "splitting"];

export const ARCHETYPE_LABEL: Record<EnemyArchetype, string> = {
  armored: "护甲",
  swift: "迅捷",
  flying: "飞行",
  splitting: "分裂",
  healer: "奶妈",
  sneaky: "隐身",
  plain: "普通",
};

/** 跑多快算「迅捷」。冲刺型怪即使基础速度一般,也按迅捷算。 */
export const SWIFT_SPEED = 0.9;

/** 一只怪属于哪几个原型(可以同时属于好几个,比如又会飞又会分裂)。 */
export function enemyArchetypes(kind: MonsterKind): EnemyArchetype[] {
  const spec = MONSTER_INFO[kind];
  const out: EnemyArchetype[] = [];
  if (spec.armor > 0) out.push("armored");
  if (spec.speed >= SWIFT_SPEED || spec.dashes) out.push("swift");
  if (spec.flies) out.push("flying");
  if (spec.splits) out.push("splitting");
  if (spec.heals) out.push("healer");
  if (spec.sneaks) out.push("sneaky");
  if (out.length === 0) out.push("plain");
  return out;
}

/** 这个原型下的所有怪。 */
export function enemiesOfArchetype(archetype: EnemyArchetype): MonsterKind[] {
  return (Object.keys(MONSTER_INFO) as MonsterKind[]).filter((k) =>
    enemyArchetypes(k).includes(archetype),
  );
}

/** 这个原型有没有 boss 变体。 */
export function archetypeBosses(archetype: EnemyArchetype): MonsterKind[] {
  return enemiesOfArchetype(archetype).filter((k) => MONSTER_INFO[k].boss);
}

/* ---------------- 克制关系表 ---------------- */

export interface CounterRow {
  archetype: EnemyArchetype;
  /** 打它最顺手的塔 */
  good: TowerKind[];
  /** 打它最不划算的塔(不是没用,是明显亏) */
  bad: TowerKind[];
  /** 一句给孩子看的话 */
  why: string;
}

export const COUNTER_TABLE: CounterRow[] = [
  {
    archetype: "armored",
    good: ["mist", "bubble"],
    bad: ["needle"],
    why: "硬壳会把每一下都削掉一点,所以要么用无视壳的毒雾,要么用一下打得重的泡泡;针针塔一下只有 1 点,全被壳吃了。",
  },
  {
    archetype: "swift",
    good: ["dew", "frost"],
    bad: ["boom"],
    why: "跑太快的怪在射程里待不了几秒,先用露珠和冰晶按住它,火力才追得上;花火塔装弹慢,常常轰了个空。",
  },
  {
    archetype: "flying",
    good: ["needle", "bubble", "frost"],
    bad: ["dew", "boom", "mist"],
    why: "天上的怪只有会抬头的塔够得着;露珠光环、花火溅射、毒雾都贴着地面,飞过去就白搭。",
  },
  {
    archetype: "splitting",
    good: ["boom", "mist"],
    bad: ["bubble"],
    why: "打倒会裂成两只小的,一只一只点太慢;花火一炸一片、毒雾一罩一群,才收得住场面。",
  },
  {
    archetype: "healer",
    good: ["needle", "boom"],
    bad: ["dew"],
    why: "奶油怪一直给同伴回血,要用连发快点把它先解决;光减速它不掉血,越拖越难受。",
  },
  {
    archetype: "sneaky",
    good: ["mist", "dew"],
    bad: ["frost"],
    why: "隐身的时候塔瞄不到它,但毒雾是一整片、露珠是光环,躲起来照样罩得住;冰晶要瞄准,它一隐身就空转。",
  },
  {
    archetype: "plain",
    good: ["bubble", "needle"],
    bad: [],
    why: "普通小怪谁都打得动,拿它们练手最合适。",
  },
];

export function counterRow(archetype: EnemyArchetype): CounterRow {
  return COUNTER_TABLE.find((r) => r.archetype === archetype) ?? COUNTER_TABLE[COUNTER_TABLE.length - 1];
}

/** 塔对某个原型的克制分:2 = 克星,0 = 一般,-1 = 明显吃亏。 */
export function counterScore(kind: TowerKind, archetype: EnemyArchetype): number {
  const row = counterRow(archetype);
  if (row.good.includes(kind)) return 2;
  if (row.bad.includes(kind)) return -1;
  return 0;
}

/** 一只怪的综合克制分:它身上所有原型分加起来。 */
export function counterScoreAgainst(kind: TowerKind, monster: MonsterKind): number {
  return enemyArchetypes(monster).reduce((sum, a) => sum + counterScore(kind, a), 0);
}

/** 打这个原型该优先摆哪几座塔(按克制分从高到低)。 */
export function bestTowersFor(archetype: EnemyArchetype): TowerKind[] {
  return counterRow(archetype).good.slice();
}

/** 攻略用的一行文字。 */
export function counterLine(archetype: EnemyArchetype): string {
  const row = counterRow(archetype);
  const good = row.good.map((k) => TOWER_INFO[k].name).join("、");
  const bad = row.bad.map((k) => TOWER_INFO[k].name).join("、");
  const tail = bad ? `;别指望 ${bad}` : "";
  return `${ARCHETYPE_LABEL[row.archetype]}怪 → 用 ${good}${tail}`;
}

/* ---------------- 支援塔加成 ---------------- */

export interface TowerPos {
  kind: TowerKind;
  col: number;
  row: number;
  level: number;
}

/** 罩住 (col,row) 这格的所有铃兰铃的等级(射程也吃天气)。 */
export function chimeLevelsAt(
  col: number,
  row: number,
  towers: ReadonlyArray<TowerPos>,
  weather: WeatherKind | undefined,
): number[] {
  const out: number[] = [];
  for (const t of towers) {
    if (t.kind !== "chime") continue;
    if (t.col === col && t.row === row) continue;
    const d = Math.hypot(t.col - col, t.row - row);
    if (d <= effectiveRange("chime", t.level, weather)) out.push(t.level);
  }
  return out;
}

/** 被铃兰罩住之后的实际攻击间隔(加成越高,间隔越短)。 */
export function supportedCooldown(kind: TowerKind, level: number, chimeLevels: ReadonlyArray<number>): number {
  const base = towerCooldown(kind, level);
  if (!chimeAffects(kind) || chimeLevels.length === 0) return base;
  return base / (1 + combineChime(chimeLevels).rate);
}

/** 被铃兰罩住之后的实际射程(天气倍率先乘,再加铃兰的固定加成)。 */
export function supportedRange(
  kind: TowerKind,
  level: number,
  weather: WeatherKind | undefined,
  chimeLevels: ReadonlyArray<number>,
): number {
  const base = towerRange(kind, level) * weatherRangeMult(weather);
  if (!chimeAffects(kind) || chimeLevels.length === 0) return base;
  return base + combineChime(chimeLevels).range;
}
