// 绿芽保卫战 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 1.1 版:188 关十三大花园战役。前 99 关(九章 × 11 关)一字不动;
// 新增月光花田/地底根须园/糖霜花圃/虫巢王庭四章(22/22/22/23 关),
// 新植物望望草·月月菇,新虫地地虫·扑扑蛾·分分虫,昼夜循环、露珠上限,
// 终章 BOSS「虫虫女王进化体」。

/* ---------------- 植物 ---------------- */

export type PlantKind =
  | "sparkle" // 闪光芽:攒露珠(经济)
  | "bubble" // 泡泡芽:基础射手
  | "nut" // 果果墩:肉盾墙
  | "star" // 星星芽:连飞虫都能打
  | "ice" // 冰冰花:子弹会减速虫虫
  | "boom" // 爆爆果:虫靠近就轰一大片(一次性)
  | "lily" // 荷叶垫:铺在水格上,别的植物才能种
  | "scout" // 望望草(1.1):照亮整条车道,地地虫无处遁形
  | "moon" // 月月菇(1.1):黑夜里咕嘟咕嘟冒露珠
  | "sunbud" // 暖暖花(1.2):产资源,开出☀️阳光
  | "puff" // 蓬蓬花(1.2):溅射,一团花粉打一小片
  | "netpad"; // 弹弹网(1.2):阻挡,会跳的跳不过、挖地的钻不过

export const PLANT_INFO: Record<
  PlantKind,
  { cost: number; hp: number; name: string; desc: string }
> = {
  sparkle: { cost: 1, hp: 3, name: "闪光芽", desc: "慢慢攒露珠" },
  bubble: { cost: 2, hp: 4, name: "泡泡芽", desc: "吹泡泡打地上的虫" },
  nut: { cost: 2, hp: 14, name: "果果墩", desc: "圆滚滚,挡住虫虫" },
  star: { cost: 3, hp: 3, name: "星星芽", desc: "星星连飞虫也能打" },
  ice: { cost: 3, hp: 3, name: "冰冰花", desc: "打中就冻得慢慢的" },
  boom: { cost: 4, hp: 2, name: "爆爆果", desc: "虫靠近就轰一片!" },
  lily: { cost: 1, hp: 6, name: "荷叶垫", desc: "铺水上才能种别的" },
  scout: { cost: 2, hp: 3, name: "望望草", desc: "照出这条道钻地的虫" },
  moon: { cost: 2, hp: 3, name: "月月菇", desc: "黑夜里咕嘟冒露珠" },
  sunbud: { cost: 3, hp: 4, name: "暖暖花", desc: "晒太阳,开出☀️阳光" },
  puff: { cost: 2, hp: 3, name: "蓬蓬花", desc: "花粉一团,打一小片" },
  netpad: { cost: 2, hp: 8, name: "弹弹网", desc: "会跳的跳不过去" },
};

export const PLANT_KINDS: PlantKind[] = [
  "sparkle", "bubble", "nut", "star", "ice", "boom", "lily", "scout", "moon",
  "sunbud", "puff", "netpad",
];

export const LANES = 4;
export const PLANT_COLS = 8;

export function canAfford(dew: number, kind: PlantKind): boolean {
  return dew >= PLANT_INFO[kind].cost;
}

/** 铲掉植物退回的露珠(半价向上取整)。 */
export function shovelRefund(kind: PlantKind): number {
  return Math.ceil(PLANT_INFO[kind].cost / 2);
}

/** 这一关已解锁的植物(基础 3 种 + 各关新解锁)。 */
export function plantsUnlockedAt(
  levelIdx: number,
  levels: ReadonlyArray<{ unlockPlant?: PlantKind }>,
): PlantKind[] {
  const out: PlantKind[] = ["sparkle", "bubble", "nut"];
  for (let i = 0; i <= Math.min(levelIdx, levels.length - 1); i++) {
    const p = levels[i].unlockPlant;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** 水格上只能先放荷叶垫;有荷叶后才能放别的植物。 */
export function canPlantOnCell(
  kind: PlantKind,
  isWater: boolean,
  hasLily: boolean,
  hasPlant: boolean,
): boolean {
  if (kind === "lily") return isWater && !hasLily;
  if (hasPlant) return false;
  if (isWater) return hasLily;
  return true;
}

/* ---------------- 虫虫 ---------------- */

export type BugKind =
  | "walker" // 爬爬虫:基础
  | "flyer" // 飘飘虫:会飞,泡泡打不到
  | "armor" // 壳壳虫:有护甲
  | "speedy" // 冲冲虫:飞快
  | "digger" // 钻钻虫:会跳过遇到的第一棵植物
  | "bucket" // 桶桶虫:重甲慢吞吞
  | "racer" // 风风虫:全场最快的小旋风
  | "bossbug" // 大虫王:超厚血,啃得飞快
  | "queen" // 虫虫女王:第九章 BOSS,重甲慢行血超厚
  | "mole" // 地地虫(1.1):钻在土里,要望望草照出来才打得到
  | "moth" // 扑扑蛾(1.1):会飞,一到黑夜就加速扑过来
  | "mama" // 分分虫(1.1):被打倒会蹦出两只爬爬虫宝宝
  | "queenx" // 虫虫女王进化体(1.1):终章 BOSS,血少一半就狂暴加速
  | "tunneler"; // 哧溜虫(1.2):进场就挖地,绕过前排从后面钻出来

export interface BugSpec {
  hp: number;
  armor: number;
  speed: number;
  flying: boolean;
  jumps: boolean;
  name: string;
  boss: boolean;
  /** 1.1:钻在地下,车道上没有望望草时打不到也不啃植物 */
  underground?: boolean;
  /** 1.1:被打倒时分裂出的爬爬虫宝宝数量 */
  splits?: number;
  /** 1.1:黑夜里的速度倍率(昼夜循环关生效) */
  nightMult?: number;
  /** 1.2:进场就挖地,过一会儿从前排后面钻出来 */
  digs?: boolean;
}

export const BUG_INFO: Record<BugKind, BugSpec> = {
  walker: { hp: 3, armor: 0, speed: 0.5, flying: false, jumps: false, name: "爬爬虫", boss: false },
  flyer: { hp: 2, armor: 0, speed: 0.66, flying: true, jumps: false, name: "飘飘虫", boss: false },
  armor: { hp: 3, armor: 3, speed: 0.42, flying: false, jumps: false, name: "壳壳虫", boss: false },
  speedy: { hp: 2, armor: 0, speed: 0.95, flying: false, jumps: false, name: "冲冲虫", boss: false },
  digger: { hp: 3, armor: 0, speed: 0.55, flying: false, jumps: true, name: "钻钻虫", boss: false },
  bucket: { hp: 4, armor: 6, speed: 0.34, flying: false, jumps: false, name: "桶桶虫", boss: false },
  racer: { hp: 2, armor: 0, speed: 1.25, flying: false, jumps: false, name: "风风虫", boss: false },
  bossbug: { hp: 40, armor: 4, speed: 0.24, flying: false, jumps: false, name: "大虫王", boss: true },
  queen: { hp: 70, armor: 10, speed: 0.2, flying: false, jumps: false, name: "虫虫女王", boss: true },
  mole: { hp: 3, armor: 0, speed: 0.5, flying: false, jumps: false, name: "地地虫", boss: false, underground: true },
  moth: { hp: 1, armor: 0, speed: 0.55, flying: true, jumps: false, name: "扑扑蛾", boss: false, nightMult: 1.6 },
  mama: { hp: 5, armor: 2, speed: 0.4, flying: false, jumps: false, name: "分分虫", boss: false, splits: 2 },
  queenx: { hp: 95, armor: 12, speed: 0.2, flying: false, jumps: false, name: "虫虫女王进化体", boss: true },
  tunneler: { hp: 3, armor: 0, speed: 0.6, flying: false, jumps: false, name: "哧溜虫", boss: false, digs: true },
};

/* ---------------- 1.2:挖地虫 / 会跳的虫与阻挡苗的关系 ---------------- */

/** 哧溜虫钻多久才冒出来(秒);这段时间打不到它,但出土点一直冒土花。 */
export const TUNNEL_TIME = 3.5;
/** 没有弹弹网时,哧溜虫从这一列钻出来(绕过前排的炮与墙)。 */
export const TUNNEL_EXIT_COL = 4;

/**
 * 哧溜虫的出土列:弹弹网底下钻不过去,只能在最靠里的那张网前面冒头。
 * 网铺到最后一列就等于把它按在场外(返回 PLANT_COLS)。
 */
export function tunnelExitCol(netpadColsInLane: ReadonlyArray<number>): number {
  let col = TUNNEL_EXIT_COL;
  for (const c of netpadColsInLane) col = Math.max(col, c + 1);
  return Math.min(PLANT_COLS, col);
}

/** 会跳的虫能不能跳过这棵苗:弹弹网专门治跳跃,别的阻挡苗都会被跳过。 */
export function canJumpOver(kind: PlantKind): boolean {
  return kind !== "netpad";
}

/**
 * 虫子血量随关卡(0 起)缓慢加深。
 * 1.1:前 99 关公式一字不动;新章(第 100 关起)血量回落到温和档再慢慢爬坡——
 * 新章的难度靠昼夜循环/地下虫/分裂/露珠上限这些新机制,而不是把血条堆到打不动
 * (飞虫拦不了墙,血太厚会变成数学上的死局)。
 */
export function bugHp(kind: BugKind, levelIdx: number): number {
  const extra = levelIdx <= 98 ? Math.floor(levelIdx / 8) : 6 + Math.floor((levelIdx - 99) / 32);
  return BUG_INFO[kind].hp + extra;
}

/** 会飞的子弹种类(1.2 起蓬蓬花的花粉团也算一种)。 */
export type ProjKind = "bubble" | "star" | "ice" | "puff";

/** 贴地飞的(泡泡、花粉)打不到飞虫;星星和冰冰什么都能打。 */
export function projectileCanHit(proj: ProjKind, flying: boolean): boolean {
  return (proj !== "bubble" && proj !== "puff") || !flying;
}

/** 伤害先打护甲再掉血;返回新状态和"这一下是否敲碎了护甲"。 */
export function applyDamage(
  bug: { hp: number; armor: number },
  dmg: number,
): { hp: number; armor: number; brokeArmor: boolean } {
  let { hp, armor } = bug;
  let remaining = dmg;
  const hadArmor = armor > 0;
  const used = Math.min(armor, remaining);
  armor -= used;
  remaining -= used;
  hp -= remaining;
  return { hp, armor, brokeArmor: hadArmor && armor === 0 };
}

/** 冰冻减速:冻住时速度打五折。 */
export const ICE_SLOW = 0.5;
export const ICE_SECONDS = 2.2;
/** 爆爆果:触发距离(格)与波及范围(格)。 */
export const BOOM_TRIGGER = 0.55;
export const BOOM_RANGE = 1.6;
export const BOOM_DAMAGE = 10;

/* ---------------- 1.1 新机制:昼夜循环 / 地下虫 / 露珠上限 / 分裂 / 进化体 ---------------- */

/** 昼夜循环:白天 day 秒,黑夜 night 秒,循环往复(开局是白天)。 */
export interface DayNightCycle {
  day: number;
  night: number;
}

export function cyclePhase(time: number, cycle?: DayNightCycle): "day" | "night" {
  if (!cycle) return "day";
  const period = cycle.day + cycle.night;
  const t = ((time % period) + period) % period;
  return t < cycle.day ? "day" : "night";
}

/** 黑夜里自然露珠攒得更慢的倍率。 */
export const NIGHT_DEW_SLOW = 1.45;

/** 露珠自然产出间隔:场景倍率 × 黑夜倍率。 */
export function passiveDewIntervalAt(scene: SceneId, night: boolean): number {
  return passiveDewInterval(scene) * (night ? NIGHT_DEW_SLOW : 1);
}

/** 月月菇产露间隔(比闪光芽快,但只在"月光时段"工作)。 */
export const MOON_DEW_EVERY = 3.0;

/** 月月菇何时工作:昼夜循环关看夜晚,没有循环的暗场景(星夜/洞穴等)整关工作。 */
export function moonActive(hasCycle: boolean, night: boolean, sceneDark: boolean): boolean {
  return hasCycle ? night : sceneDark;
}

/** 黑夜速度倍率:扑扑蛾在昼夜循环关的黑夜里扑得飞快。 */
export function bugNightSpeedMult(kind: BugKind, night: boolean): number {
  const m = BUG_INFO[kind].nightMult;
  return night && m ? m : 1;
}

/** 地下虫是否露出地面:车道上有望望草才现形(现形才能被打、才会啃植物)。 */
export function moleRevealed(kind: BugKind, scoutInLane: boolean): boolean {
  return !BUG_INFO[kind].underground || scoutInLane;
}

/** 露珠上限管理:关卡有上限时,每棵产露植物(闪光芽/月月菇)把罐子加大一点。 */
export const DEW_CAP_PER_PRODUCER = 3;

export function effectiveDewCap(dewCap: number | undefined, producerCount: number): number {
  if (dewCap === undefined) return Infinity;
  return dewCap + producerCount * DEW_CAP_PER_PRODUCER;
}

export function clampDew(dew: number, cap: number): number {
  return Math.min(dew, cap);
}

/** 分分虫被打倒后蹦出的宝宝种类。 */
export const MAMA_SPLIT_KIND: BugKind = "walker";

/** 女王进化体:血量剩一半以下进入狂暴,速度倍增。 */
export const QUEENX_RAGE_FRAC = 0.5;
export const QUEENX_RAGE_SPEED = 1.35;

export function queenxSpeedMult(kind: BugKind, hpFrac: number): number {
  return kind === "queenx" && hpFrac <= QUEENX_RAGE_FRAC ? QUEENX_RAGE_SPEED : 1;
}

/* ---------------- 主题场景(九大花园) ---------------- */

export type SceneId =
  | "day" // 阳光小院
  | "night" // 星星夜晚
  | "pool" // 池塘夏天
  | "fog" // 迷雾清晨
  | "autumn" // 落叶庭院
  | "beach" // 沙滩园圃
  | "winter" // 冰霜花园
  | "cave" // 萤光洞穴
  | "storm" // 雷雨之夜
  | "moonfield" // 月光花田(1.1):昼夜循环 + 扑扑蛾
  | "burrow" // 地底根须园(1.1):地地虫要望望草照
  | "candy" // 糖霜花圃(1.1):分分虫 + 露珠上限
  | "hive"; // 虫巢王庭(1.1):终章,女王进化体

export interface SceneStyle {
  name: string;
  emoji: string;
  /** 场地明暗:暗场景画星星/萤火 */
  dark: boolean;
  /** 草地双色 */
  laneA: string;
  laneB: string;
  bg: string;
  accent: string;
  /** 露珠自然产出间隔倍率(越大攒得越慢) */
  dewMult: number;
  /** 虫子速度倍率 */
  speedMult: number;
  /** 本章虫虫主力阵容(生成器用) */
  palette: BugKind[];
  /** 章末 BOSS */
  boss: BugKind;
  blurb: string;
}

export const SCENE_STYLE: Record<SceneId, SceneStyle> = {
  day: {
    name: "阳光小院", emoji: "☀️", dark: false, laneA: "#d5f2ca", laneB: "#def5d5", bg: "#eafbe0", accent: "#4a9a5a",
    dewMult: 1, speedMult: 1, palette: ["walker", "flyer", "speedy"], boss: "bossbug", blurb: "新手小院,认识虫虫和植物",
  },
  night: {
    name: "星星夜晚", emoji: "🌙", dark: true, laneA: "#4e5878", laneB: "#576184", bg: "#3e4468", accent: "#8a5ac9",
    dewMult: 1.85, speedMult: 1, palette: ["walker", "armor", "flyer"], boss: "bossbug", blurb: "露珠稀少的星空夜战",
  },
  pool: {
    name: "池塘夏天", emoji: "💧", dark: false, laneA: "#d5f2ca", laneB: "#def5d5", bg: "#e0f6ff", accent: "#5a8ac9",
    dewMult: 1, speedMult: 1, palette: ["walker", "speedy", "digger"], boss: "bossbug", blurb: "先铺荷叶再种植物的水路战",
  },
  fog: {
    name: "迷雾清晨", emoji: "🌫️", dark: false, laneA: "#dce4dc", laneB: "#e4ece4", bg: "#e8eee8", accent: "#7a8a8a",
    dewMult: 1.2, speedMult: 0.95, palette: ["digger", "armor", "walker"], boss: "bossbug", blurb: "雾蒙蒙里钻钻虫最爱偷袭",
  },
  autumn: {
    name: "落叶庭院", emoji: "🍂", dark: false, laneA: "#f2e0c0", laneB: "#f7e8ce", bg: "#faf0dc", accent: "#c9803a",
    dewMult: 1, speedMult: 1.12, palette: ["racer", "speedy", "flyer"], boss: "bossbug", blurb: "秋风送虫,全员加速的落叶战",
  },
  beach: {
    name: "沙滩园圃", emoji: "🏖️", dark: false, laneA: "#f7ecc8", laneB: "#fbf2d8", bg: "#fdf6e0", accent: "#e0a030",
    dewMult: 0.85, speedMult: 1, palette: ["digger", "racer", "flyer"], boss: "bossbug", blurb: "露珠丰沛但潮水里有水路",
  },
  winter: {
    name: "冰霜花园", emoji: "❄️", dark: false, laneA: "#dce8f7", laneB: "#e6effb", bg: "#eef4fd", accent: "#5a8ac9",
    dewMult: 1.25, speedMult: 0.88, palette: ["armor", "bucket", "walker"], boss: "bossbug", blurb: "重甲虫裹着冰壳慢慢碾过来",
  },
  cave: {
    name: "萤光洞穴", emoji: "🕯️", dark: true, laneA: "#4a5468", laneB: "#525c74", bg: "#3a4258", accent: "#4ac9a8",
    dewMult: 1.5, speedMult: 1, palette: ["digger", "bucket", "racer"], boss: "bossbug", blurb: "萤火照路,露珠最难攒的深洞",
  },
  storm: {
    name: "雷雨之夜", emoji: "⛈️", dark: true, laneA: "#465074", laneB: "#4e5880", bg: "#363e60", accent: "#c9a84a",
    dewMult: 1.6, speedMult: 1.15, palette: ["racer", "armor", "bucket", "speedy"], boss: "queen", blurb: "虫虫女王率全军的最终决战",
  },
  moonfield: {
    name: "月光花田", emoji: "🌕", dark: true, laneA: "#5a628c", laneB: "#636b98", bg: "#454c74", accent: "#b9a6e8",
    dewMult: 1.3, speedMult: 1, palette: ["moth", "walker", "speedy", "flyer"], boss: "bossbug", blurb: "昼夜交替,扑扑蛾夜里扑得飞快",
  },
  burrow: {
    name: "地底根须园", emoji: "🕳️", dark: true, laneA: "#6a5a48", laneB: "#746450", bg: "#4a4038", accent: "#e8b878",
    dewMult: 1.35, speedMult: 0.95, palette: ["mole", "digger", "armor", "walker"], boss: "bossbug", blurb: "地地虫钻土里,望望草才照得出",
  },
  candy: {
    name: "糖霜花圃", emoji: "🧁", dark: false, laneA: "#fbdce8", laneB: "#fde8f0", bg: "#fff0f6", accent: "#e06a9a",
    dewMult: 0.9, speedMult: 1.1, palette: ["mama", "speedy", "racer", "flyer"], boss: "bossbug", blurb: "露珠罐有上限,分分虫越打越多",
  },
  hive: {
    name: "虫巢王庭", emoji: "👑", dark: true, laneA: "#5c4a6a", laneB: "#665476", bg: "#3e3450", accent: "#d88ae0",
    dewMult: 1.45, speedMult: 1.1, palette: ["mama", "mole", "moth", "bucket"], boss: "queenx", blurb: "女王进化体坐镇的最终王庭",
  },
};

export const SCENE_ORDER: SceneId[] = [
  "day", "night", "pool", "fog", "autumn", "beach", "winter", "cave", "storm",
  "moonfield", "burrow", "candy", "hive",
];

export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;
export const CLASSIC_THEME_COUNT = 9;
export const CLASSIC_LEVEL_COUNT = 99;

/** 1.1 变长章节:前 9 章各 11 关,新 4 章 22/22/22/23 关,共 188 关。 */
export const THEME_SIZES: number[] = [11, 11, 11, 11, 11, 11, 11, 11, 11, 22, 22, 22, 23];
export const TOTAL_LEVELS = THEME_SIZES.reduce((s, n) => s + n, 0);

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

export function themeOfLevel(idx: number): SceneId {
  return SCENE_ORDER[themeIndexOfLevel(idx)];
}

export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  const off = themeOffset(ci);
  for (let i = 0; i < THEME_SIZES[ci]; i++) out.push(off + i);
  return out;
}

/* ---------------- 关卡 ---------------- */

export interface WaveEntry {
  kind: BugKind;
  count: number;
  gap: number;
}

/* ---------------- 1.2 特殊关:解谜 / 传送 / 速攻 ---------------- */

export type SpecialKind = "puzzle" | "conveyor" | "blitz";

/** 解谜关发的一沓固定苗。 */
export interface PlantStock {
  kind: PlantKind;
  count: number;
}

export interface SpecialSpec {
  kind: SpecialKind;
  /** 解谜关:全关只有这些苗,没有露珠收入,考的是摆在哪儿 */
  stock?: PlantStock[];
  /** 传送关:传送带循环发这一串苗 */
  belt?: PlantKind[];
  /** 传送带每隔几秒送一株 */
  beltEvery?: number;
}

/** 传送带每隔几秒送一株。 */
export const BELT_EVERY = 1.0;
/** 传送带上最多同时候着几张苗卡(满了就先不发,催着你赶紧种)。 */
export const BELT_QUEUE_MAX = 5;
/** 速攻关:最后一只虫出场之后还留多少秒清场。 */
export const BLITZ_GRACE = 22;
/** 速攻关的波次间隔压缩比(普通关 9~11 秒 → 速攻关一半)。 */
export const BLITZ_GAP_SCALE = 0.5;
/** 波与波之间至少留这么多秒布置。 */
export const PREP_SECONDS = 3;

export interface LevelDef {
  name: string;
  scene: SceneId;
  /** 水路车道(要先铺荷叶) */
  waterLanes: number[];
  waves: WaveEntry[][];
  /** 旗帜大波的波次下标(超大规模,有横幅) */
  flagWaves: number[];
  startDew: number;
  unlockPlant?: PlantKind;
  /** 本关独特机制标记(测试用) */
  feature: string;
  /** true = 生成器产出的遭遇战关 */
  gen?: boolean;
  hint: string;
  /** 1.1:昼夜循环(白天/黑夜各多少秒,开局白天) */
  cycle?: DayNightCycle;
  /** 1.1:露珠上限(不设 = 无上限;产露植物每棵 +3) */
  dewCap?: number;
  /** 1.2:特殊关配置(解谜/传送/速攻);不填 = 普通波次关 */
  special?: SpecialSpec;
}

type WSpec = readonly [BugKind, number, number];
const W = (...batches: WSpec[]): WaveEntry[] =>
  batches.map(([kind, count, gap]) => ({ kind, count, gap }));

/** 生成器:每章 3 关"虫潮遭遇战",波数 3+sub,阵容覆盖本章主力,签名互不相同。 */
function genLevel(sceneIdx: number, sub: number): LevelDef {
  const scene = SCENE_ORDER[sceneIdx];
  const st = SCENE_STYLE[scene];
  const pal = st.palette;
  const waveCount = 3 + sub;
  const waves: WaveEntry[][] = [];
  for (let wi = 0; wi < waveCount; wi++) {
    const batches: WaveEntry[] = [];
    const nBatches = 1 + ((wi + sub) % 2);
    for (let b = 0; b < nBatches; b++) {
      const kind = pal[(wi + b * 2 + sub) % pal.length];
      const count = 3 + ((wi * 2 + b + sub + sceneIdx) % 4) + Math.floor(sceneIdx / 3);
      const gap = Math.max(0.8, 2.0 - wi * 0.2 - sceneIdx * 0.05);
      batches.push({ kind, count, gap: Math.round(gap * 100) / 100 });
    }
    waves.push(batches);
  }
  const water = scene === "pool" ? [1, 2] : scene === "beach" ? [3] : [];
  return {
    name: `${st.name}虫潮 ${sub + 1} 号`,
    scene,
    waterLanes: water,
    waves,
    flagWaves: [waveCount - 1],
    startDew: 6 + sceneIdx + sub,
    feature: `${st.name}虫潮${sub + 1}号`,
    gen: true,
    hint: `${st.name}的杂虫突袭!顶住 ${waveCount} 波,最后一波是大旗!`,
  };
}

function buildTheme(sceneIdx: number, hand: LevelDef[]): LevelDef[] {
  if (hand.length !== HANDMADE_PER_THEME) {
    throw new Error(`scene ${sceneIdx} 手写关数量应为 ${HANDMADE_PER_THEME}`);
  }
  return [
    ...hand.slice(0, 6),
    genLevel(sceneIdx, 0),
    genLevel(sceneIdx, 1),
    genLevel(sceneIdx, 2),
    hand[6],
    hand[7],
  ];
}

/* ---- 第一章 · 阳光小院 ---- */
const dayHand: LevelDef[] = [
  {
    name: "小院第一步", scene: "day", waterLanes: [], startDew: 4, feature: "入门教学",
    hint: "先选卡再点格子种植物,别让虫虫进小屋!", flagWaves: [],
    waves: [W(["walker", 4, 2.2]), W(["walker", 6, 1.8])],
  },
  {
    name: "飞虫来袭", scene: "day", waterLanes: [], startDew: 5, unlockPlant: "star", feature: "飘飘虫登场",
    hint: "飘飘虫会飞,泡泡打不到,快种星星芽!", flagWaves: [],
    waves: [W(["walker", 4, 2.0], ["flyer", 2, 1.6]), W(["flyer", 3, 1.6], ["walker", 4, 1.6])],
  },
  {
    name: "冲冲小队", scene: "day", waterLanes: [], startDew: 5, unlockPlant: "ice", feature: "冰冰花+冲冲虫",
    hint: "冲冲虫跑得快!新植物冰冰花能把它冻慢", flagWaves: [],
    waves: [W(["speedy", 3, 1.8], ["walker", 4, 1.6]), W(["speedy", 4, 1.4], ["flyer", 3, 1.5]), W(["speedy", 5, 1.2], ["walker", 5, 1.3])],
  },
  {
    name: "第一面大旗", scene: "day", waterLanes: [], startDew: 6, feature: "旗帜大波登场",
    hint: "看到大旗就是超大一波!提前摆好阵", flagWaves: [2],
    waves: [
      W(["walker", 5, 1.6], ["flyer", 2, 1.6]), W(["speedy", 3, 1.3], ["walker", 4, 1.5]),
      W(["walker", 6, 1.0], ["flyer", 3, 1.2], ["speedy", 3, 1.2]),
    ],
  },
  {
    name: "小院快跑日", scene: "day", waterLanes: [], startDew: 6, feature: "白天快攻潮",
    hint: "冲冲虫组团冲刺,冰冰花是好朋友!", flagWaves: [2],
    waves: [W(["speedy", 5, 1.2], ["flyer", 3, 1.3]), W(["speedy", 6, 1.0], ["walker", 4, 1.3]), W(["speedy", 7, 0.9], ["flyer", 4, 1.0])],
  },
  {
    name: "篱笆保卫战", scene: "day", waterLanes: [], startDew: 7, feature: "白天四波混战",
    hint: "四波虫虫轮着上,波间抓紧补种!", flagWaves: [3],
    waves: [
      W(["walker", 5, 1.5]), W(["flyer", 4, 1.3], ["walker", 4, 1.4]),
      W(["speedy", 5, 1.1], ["flyer", 3, 1.2]), W(["walker", 6, 1.0], ["speedy", 5, 1.0], ["flyer", 4, 1.1]),
    ],
  },
  {
    name: "阳光马拉松", scene: "day", waterLanes: [], startDew: 7, feature: "白天五波车轮战",
    hint: "整整 5 波!合理安排闪光芽的位置", flagWaves: [4],
    waves: [
      W(["walker", 5, 1.5]), W(["flyer", 4, 1.3]), W(["speedy", 5, 1.1]),
      W(["walker", 5, 1.2], ["flyer", 4, 1.1]), W(["speedy", 6, 0.9], ["walker", 6, 1.0], ["flyer", 4, 1.0]),
    ],
  },
  {
    name: "小虫王驾到", scene: "day", waterLanes: [], startDew: 8, feature: "阳光章BOSS小虫王",
    hint: "大块头来啦!它啃得特别快,集中火力!", flagWaves: [2],
    waves: [
      W(["walker", 5, 1.4], ["speedy", 3, 1.2]), W(["flyer", 4, 1.2], ["walker", 4, 1.3]),
      W(["bossbug", 1, 1], ["flyer", 4, 1.2]),
    ],
  },
];

/* ---- 第二章 · 星星夜晚 ---- */
const nightHand: LevelDef[] = [
  {
    name: "夜幕降临", scene: "night", waterLanes: [], startDew: 7, unlockPlant: "boom", feature: "夜战开场+爆爆果",
    hint: "晚上露珠攒得慢,多种闪光芽!新植物爆爆果", flagWaves: [1],
    waves: [W(["walker", 5, 1.6]), W(["flyer", 4, 1.4], ["walker", 4, 1.5])],
  },
  {
    name: "硬壳巡夜队", scene: "night", waterLanes: [], startDew: 7, feature: "壳壳虫夜巡",
    hint: "壳壳虫有硬壳,要先敲碎再掉血!", flagWaves: [2],
    waves: [W(["armor", 2, 2.4], ["walker", 4, 1.8]), W(["armor", 3, 2.0], ["flyer", 2, 1.6]), W(["armor", 3, 1.8], ["walker", 5, 1.4])],
  },
  {
    name: "月光小径", scene: "night", waterLanes: [], startDew: 8, feature: "夜间飞虫群",
    hint: "夜里飘飘虫成群,星星芽多种两排!", flagWaves: [2],
    waves: [W(["flyer", 4, 1.4], ["walker", 4, 1.5]), W(["flyer", 5, 1.2], ["armor", 2, 2.0]), W(["flyer", 6, 1.0], ["walker", 5, 1.2])],
  },
  {
    name: "露珠荒夜", scene: "night", waterLanes: [], startDew: 5, feature: "夜间经济挑战",
    hint: "开局露珠特别少,精打细算慢慢攒!", flagWaves: [2],
    waves: [W(["walker", 4, 2.0]), W(["armor", 3, 1.8], ["walker", 4, 1.6]), W(["flyer", 4, 1.2], ["armor", 3, 1.6])],
  },
  {
    name: "星夜双旗", scene: "night", waterLanes: [], startDew: 8, feature: "夜战双旗大波",
    hint: "这一关有两面大旗!中间千万别松劲", flagWaves: [1, 3],
    waves: [
      W(["walker", 5, 1.4], ["flyer", 3, 1.3]), W(["armor", 4, 1.5], ["walker", 5, 1.2]),
      W(["flyer", 5, 1.1]), W(["armor", 4, 1.3], ["flyer", 4, 1.0], ["walker", 5, 1.1]),
    ],
  },
  {
    name: "午夜车轮战", scene: "night", waterLanes: [], startDew: 9, feature: "夜间五波鏖战",
    hint: "五波夜袭!爆爆果留给最挤的一波", flagWaves: [4],
    waves: [
      W(["walker", 5, 1.4]), W(["flyer", 5, 1.1]), W(["armor", 4, 1.4]),
      W(["walker", 5, 1.2], ["flyer", 4, 1.1]), W(["armor", 5, 1.2], ["walker", 6, 1.0], ["flyer", 4, 1.0]),
    ],
  },
  {
    name: "流星雨夜", scene: "night", waterLanes: [], startDew: 9, feature: "夜战全家福",
    hint: "夜里的虫全来了,布下你的完整阵型!", flagWaves: [3],
    waves: [
      W(["armor", 3, 1.6], ["walker", 5, 1.2]), W(["flyer", 5, 1.0], ["armor", 3, 1.4]),
      W(["walker", 6, 1.0], ["flyer", 4, 1.0]), W(["armor", 5, 1.1], ["flyer", 5, 0.9], ["walker", 6, 0.9]),
    ],
  },
  {
    name: "月下虫王", scene: "night", waterLanes: [], startDew: 10, feature: "星夜章BOSS虫王",
    hint: "大虫王趁夜来袭!露珠不够就先攒经济", flagWaves: [2],
    waves: [
      W(["armor", 3, 1.5], ["flyer", 4, 1.1]), W(["walker", 6, 1.0], ["armor", 3, 1.3]),
      W(["bossbug", 1, 1], ["flyer", 4, 1.0]),
    ],
  },
];

/* ---- 第三章 · 池塘夏天 ---- */
const poolHand: LevelDef[] = [
  {
    name: "水池初见", scene: "pool", waterLanes: [1, 2], startDew: 7, unlockPlant: "lily", feature: "水路荷叶",
    hint: "中间两条是水!先铺荷叶垫才能种植物", flagWaves: [2],
    waves: [W(["walker", 5, 1.6]), W(["walker", 5, 1.4], ["flyer", 3, 1.4]), W(["speedy", 4, 1.2], ["walker", 5, 1.2])],
  },
  {
    name: "钻钻戏水", scene: "pool", waterLanes: [1, 2], startDew: 7, feature: "钻钻虫登场",
    hint: "钻钻虫会跳过第一棵植物!果果墩前再补一棵", flagWaves: [2],
    waves: [W(["digger", 3, 2.0], ["walker", 4, 1.6]), W(["digger", 4, 1.6], ["flyer", 3, 1.4]), W(["digger", 5, 1.3], ["speedy", 3, 1.3])],
  },
  {
    name: "荷叶排排铺", scene: "pool", waterLanes: [0, 1, 2], startDew: 8, feature: "三条水路",
    hint: "整整三条水路!荷叶垫要铺得又快又省", flagWaves: [2],
    waves: [W(["walker", 5, 1.5], ["speedy", 3, 1.3]), W(["digger", 4, 1.5], ["walker", 5, 1.3]), W(["speedy", 5, 1.1], ["flyer", 4, 1.2])],
  },
  {
    name: "池畔快攻", scene: "pool", waterLanes: [1, 2], startDew: 8, feature: "水边冲冲潮",
    hint: "冲冲虫沿着岸边猛冲,冰冰花守两边!", flagWaves: [2],
    waves: [W(["speedy", 5, 1.2], ["walker", 4, 1.4]), W(["speedy", 6, 1.0], ["digger", 3, 1.5]), W(["speedy", 7, 0.85], ["flyer", 4, 1.1])],
  },
  {
    name: "上下夹岸", scene: "pool", waterLanes: [0, 3], startDew: 9, feature: "上下都是水路",
    hint: "最上最下都是水!中间陆路是主战场", flagWaves: [3],
    waves: [
      W(["walker", 5, 1.3], ["flyer", 3, 1.2]), W(["speedy", 5, 1.0], ["digger", 3, 1.4]),
      W(["walker", 6, 1.1], ["speedy", 4, 1.1]), W(["digger", 5, 1.2], ["speedy", 5, 0.95], ["flyer", 4, 1.0]),
    ],
  },
  {
    name: "池塘双旗日", scene: "pool", waterLanes: [1, 2], startDew: 9, feature: "水战双旗",
    hint: "两面大旗接连来袭,荷叶阵要提前铺好!", flagWaves: [1, 3],
    waves: [
      W(["walker", 5, 1.4], ["digger", 3, 1.5]), W(["speedy", 6, 1.0], ["walker", 5, 1.2]),
      W(["digger", 4, 1.3], ["flyer", 4, 1.1]), W(["speedy", 6, 0.9], ["digger", 4, 1.2], ["walker", 6, 1.0]),
    ],
  },
  {
    name: "荷塘听雨", scene: "pool", waterLanes: [1, 2], startDew: 10, feature: "水战五波",
    hint: "五波水陆混攻,荷叶上也要有输出!", flagWaves: [4],
    waves: [
      W(["walker", 6, 1.2]), W(["digger", 4, 1.4]), W(["speedy", 6, 1.0]),
      W(["flyer", 5, 1.0], ["walker", 5, 1.1]), W(["digger", 5, 1.1], ["speedy", 6, 0.9], ["flyer", 4, 1.0]),
    ],
  },
  {
    name: "池塘大虫王", scene: "pool", waterLanes: [1, 2], startDew: 10, feature: "池塘章BOSS",
    hint: "大虫王踩着荷叶来啦!水路火力别断档", flagWaves: [2],
    waves: [
      W(["digger", 4, 1.3], ["walker", 5, 1.2]), W(["speedy", 6, 0.95], ["flyer", 4, 1.0]),
      W(["bossbug", 1, 1], ["digger", 4, 1.2]),
    ],
  },
];

/* ---- 第四章 · 迷雾清晨 ---- */
const fogHand: LevelDef[] = [
  {
    name: "雾里看花", scene: "fog", waterLanes: [], startDew: 8, feature: "迷雾章开场",
    hint: "雾蒙蒙的清晨,钻钻虫最爱偷袭!", flagWaves: [2],
    waves: [W(["digger", 3, 1.8], ["walker", 5, 1.4]), W(["armor", 3, 1.6], ["digger", 3, 1.6]), W(["walker", 6, 1.1], ["armor", 3, 1.4])],
  },
  {
    name: "晨雾突袭", scene: "fog", waterLanes: [], startDew: 8, feature: "钻钻突击队",
    hint: "一整队钻钻虫!每条道都要两层植物", flagWaves: [2],
    waves: [W(["digger", 4, 1.6], ["walker", 4, 1.5]), W(["digger", 5, 1.3], ["armor", 3, 1.5]), W(["digger", 6, 1.1], ["walker", 5, 1.2])],
  },
  {
    name: "雾中铁壳阵", scene: "fog", waterLanes: [], startDew: 9, feature: "迷雾重甲阵",
    hint: "壳壳虫在雾里列队推进,先敲壳!", flagWaves: [2],
    waves: [W(["armor", 4, 1.6], ["walker", 4, 1.4]), W(["armor", 5, 1.4], ["digger", 3, 1.5]), W(["armor", 6, 1.2], ["walker", 6, 1.1])],
  },
  {
    name: "露珠薄雾", scene: "fog", waterLanes: [], startDew: 5, feature: "迷雾经济挑战",
    hint: "雾天露珠也变少了,能省则省!", flagWaves: [2],
    waves: [W(["walker", 5, 1.6]), W(["digger", 4, 1.5], ["armor", 3, 1.5]), W(["walker", 6, 1.2], ["digger", 4, 1.3])],
  },
  {
    name: "雾锁四方", scene: "fog", waterLanes: [], startDew: 10, feature: "迷雾四波混战",
    hint: "四波混编虫潮从雾里钻出来!", flagWaves: [3],
    waves: [
      W(["walker", 5, 1.4], ["armor", 3, 1.5]), W(["digger", 5, 1.2], ["walker", 4, 1.3]),
      W(["armor", 4, 1.3], ["digger", 4, 1.3]), W(["walker", 6, 1.0], ["armor", 4, 1.2], ["digger", 5, 1.1]),
    ],
  },
  {
    name: "浓雾双旗", scene: "fog", waterLanes: [], startDew: 10, feature: "迷雾双旗大波",
    hint: "雾里两面大旗,爆爆果埋伏在后排!", flagWaves: [1, 3],
    waves: [
      W(["digger", 4, 1.4], ["armor", 3, 1.4]), W(["walker", 7, 1.0], ["digger", 4, 1.2]),
      W(["armor", 5, 1.2]), W(["digger", 6, 1.0], ["armor", 4, 1.1], ["walker", 6, 1.0]),
    ],
  },
  {
    name: "雾散大冲锋", scene: "fog", waterLanes: [], startDew: 11, feature: "迷雾五波长跑",
    hint: "雾快散了,虫虫做最后五波冲锋!", flagWaves: [4],
    waves: [
      W(["walker", 6, 1.2]), W(["digger", 5, 1.2]), W(["armor", 5, 1.2]),
      W(["digger", 5, 1.1], ["walker", 5, 1.1]), W(["armor", 5, 1.1], ["digger", 6, 0.95], ["walker", 6, 0.95]),
    ],
  },
  {
    name: "雾中虫王", scene: "fog", waterLanes: [], startDew: 11, feature: "迷雾章BOSS",
    hint: "大虫王藏在雾里冒出来!果果墩顶住!", flagWaves: [2],
    waves: [
      W(["armor", 4, 1.3], ["digger", 4, 1.3]), W(["walker", 7, 1.0], ["armor", 4, 1.2]),
      W(["bossbug", 1, 1], ["digger", 5, 1.1]),
    ],
  },
];

/* ---- 第五章 · 落叶庭院 ---- */
const autumnHand: LevelDef[] = [
  {
    name: "秋风起", scene: "autumn", waterLanes: [], startDew: 9, feature: "落叶章开场",
    hint: "秋风把虫虫吹得更快!风风虫登场!", flagWaves: [2],
    waves: [W(["racer", 3, 1.5], ["walker", 4, 1.4]), W(["racer", 4, 1.2], ["speedy", 4, 1.2]), W(["racer", 5, 1.0], ["flyer", 4, 1.1])],
  },
  {
    name: "落叶旋风", scene: "autumn", waterLanes: [], startDew: 9, feature: "风风虫旋风潮",
    hint: "风风虫是全场最快的!冰冰花排一排", flagWaves: [2],
    waves: [W(["racer", 5, 1.1]), W(["racer", 6, 0.95], ["speedy", 4, 1.1]), W(["racer", 7, 0.8], ["flyer", 4, 1.0])],
  },
  {
    name: "银杏道飞车", scene: "autumn", waterLanes: [], startDew: 10, feature: "秋日双快组合",
    hint: "冲冲虫+风风虫双快组合,前排要厚!", flagWaves: [2],
    waves: [W(["speedy", 5, 1.1], ["racer", 4, 1.0]), W(["speedy", 6, 0.95], ["flyer", 4, 1.1]), W(["racer", 6, 0.85], ["speedy", 5, 0.95])],
  },
  {
    name: "落叶纷飞", scene: "autumn", waterLanes: [], startDew: 10, feature: "秋日飞虫群舞",
    hint: "飘飘虫乘着秋风漫天飞舞!", flagWaves: [2],
    waves: [W(["flyer", 5, 1.2], ["racer", 3, 1.1]), W(["flyer", 6, 1.0], ["speedy", 4, 1.0]), W(["flyer", 7, 0.9], ["racer", 5, 0.9])],
  },
  {
    name: "庭院四重奏", scene: "autumn", waterLanes: [], startDew: 11, feature: "秋日四波快攻",
    hint: "四波快攻一浪高过一浪!", flagWaves: [3],
    waves: [
      W(["walker", 6, 1.2], ["racer", 3, 1.1]), W(["speedy", 5, 1.0], ["flyer", 4, 1.0]),
      W(["racer", 6, 0.9], ["walker", 5, 1.0]), W(["speedy", 6, 0.9], ["racer", 6, 0.8], ["flyer", 5, 0.9]),
    ],
  },
  {
    name: "风卷双旗", scene: "autumn", waterLanes: [], startDew: 11, feature: "秋日双旗风暴",
    hint: "秋风卷着两面大旗呼啸而来!", flagWaves: [1, 3],
    waves: [
      W(["racer", 5, 1.0], ["flyer", 4, 1.0]), W(["speedy", 7, 0.9], ["racer", 5, 0.9]),
      W(["walker", 7, 1.0], ["flyer", 5, 0.95]), W(["racer", 7, 0.75], ["speedy", 6, 0.85], ["flyer", 5, 0.9]),
    ],
  },
  {
    name: "秋收总动员", scene: "autumn", waterLanes: [], startDew: 12, feature: "秋日五波盛宴",
    hint: "五波大军想抢秋收的果实,守住!", flagWaves: [4],
    waves: [
      W(["walker", 7, 1.1]), W(["racer", 6, 0.9]), W(["flyer", 6, 0.95]),
      W(["speedy", 6, 0.9], ["racer", 5, 0.85]), W(["racer", 7, 0.75], ["flyer", 6, 0.85], ["walker", 7, 0.9]),
    ],
  },
  {
    name: "旋风大虫王", scene: "autumn", waterLanes: [], startDew: 12, feature: "落叶章BOSS",
    hint: "大虫王乘着旋风来了,比以前更快!", flagWaves: [2],
    waves: [
      W(["racer", 6, 0.9], ["speedy", 5, 0.95]), W(["flyer", 6, 0.9], ["walker", 6, 1.0]),
      W(["bossbug", 1, 1], ["racer", 5, 0.9]),
    ],
  },
];

/* ---- 第六章 · 沙滩园圃 ---- */
const beachHand: LevelDef[] = [
  {
    name: "潮汐花园", scene: "beach", waterLanes: [3], startDew: 10, feature: "沙滩章开场",
    hint: "沙滩露珠多,但最下面一条是潮水!", flagWaves: [2],
    waves: [W(["walker", 6, 1.3], ["digger", 3, 1.5]), W(["racer", 5, 1.0], ["flyer", 4, 1.1]), W(["digger", 5, 1.2], ["walker", 6, 1.1])],
  },
  {
    name: "沙蟹快跑", scene: "beach", waterLanes: [3], startDew: 10, feature: "沙滩双快潮",
    hint: "风风虫在沙滩上跑得欢!", flagWaves: [2],
    waves: [W(["racer", 5, 1.0], ["walker", 5, 1.2]), W(["racer", 6, 0.9], ["digger", 4, 1.3]), W(["racer", 7, 0.8], ["flyer", 5, 1.0])],
  },
  {
    name: "跳跳沙丘", scene: "beach", waterLanes: [3], startDew: 11, feature: "沙滩钻钻大队",
    hint: "钻钻虫在沙丘里神出鬼没!", flagWaves: [2],
    waves: [W(["digger", 5, 1.3], ["flyer", 4, 1.1]), W(["digger", 6, 1.1], ["racer", 4, 1.0]), W(["digger", 7, 0.95], ["walker", 6, 1.0])],
  },
  {
    name: "双潮夹击", scene: "beach", waterLanes: [0, 3], startDew: 11, feature: "沙滩双水路",
    hint: "涨潮啦!上下两条水路一起来虫", flagWaves: [2],
    waves: [W(["walker", 6, 1.2], ["racer", 4, 1.0]), W(["digger", 5, 1.2], ["flyer", 5, 1.0]), W(["racer", 6, 0.85], ["digger", 5, 1.1])],
  },
  {
    name: "椰林四连波", scene: "beach", waterLanes: [3], startDew: 12, feature: "沙滩四波混战",
    hint: "椰子树下四波混战,露珠多就是横!", flagWaves: [3],
    waves: [
      W(["walker", 7, 1.1]), W(["racer", 5, 0.95], ["digger", 4, 1.2]),
      W(["flyer", 6, 0.95], ["walker", 5, 1.0]), W(["digger", 6, 1.0], ["racer", 6, 0.8], ["flyer", 5, 0.9]),
    ],
  },
  {
    name: "海风双旗", scene: "beach", waterLanes: [3], startDew: 12, feature: "沙滩双旗",
    hint: "海风送来两面大旗,别被冲垮!", flagWaves: [1, 3],
    waves: [
      W(["digger", 5, 1.2], ["walker", 6, 1.0]), W(["racer", 7, 0.8], ["flyer", 5, 0.95]),
      W(["walker", 7, 1.0], ["digger", 5, 1.05]), W(["racer", 7, 0.75], ["digger", 6, 0.95], ["flyer", 6, 0.85]),
    ],
  },
  {
    name: "沙堡保卫战", scene: "beach", waterLanes: [1, 2], startDew: 13, feature: "沙滩中央水路五波",
    hint: "中间两条全是潮水!五波大军压境", flagWaves: [4],
    waves: [
      W(["walker", 7, 1.05]), W(["digger", 5, 1.1]), W(["racer", 6, 0.85]),
      W(["flyer", 6, 0.9], ["walker", 6, 0.95]), W(["digger", 6, 0.95], ["racer", 7, 0.72], ["flyer", 5, 0.85]),
    ],
  },
  {
    name: "沙滩大虫王", scene: "beach", waterLanes: [3], startDew: 13, feature: "沙滩章BOSS",
    hint: "大虫王晒着太阳来抢小屋,请它吃爆爆果!", flagWaves: [2],
    waves: [
      W(["digger", 6, 1.05], ["racer", 5, 0.85]), W(["walker", 7, 0.95], ["flyer", 6, 0.85]),
      W(["bossbug", 1, 1], ["digger", 5, 1.0]),
    ],
  },
];

/* ---- 第七章 · 冰霜花园 ---- */
const winterHand: LevelDef[] = [
  {
    name: "初雪降临", scene: "winter", waterLanes: [], startDew: 11, feature: "冰霜章开场",
    hint: "冬天虫子慢吞吞,但壳更硬了!", flagWaves: [2],
    waves: [W(["armor", 4, 1.5], ["walker", 5, 1.3]), W(["bucket", 2, 2.4], ["armor", 4, 1.3]), W(["walker", 7, 1.0], ["armor", 5, 1.2])],
  },
  {
    name: "铁桶雪人", scene: "winter", waterLanes: [], startDew: 11, feature: "桶桶虫登场",
    hint: "桶桶虫的铁桶超级硬,冰冻+集火!", flagWaves: [2],
    waves: [W(["bucket", 2, 3.0], ["walker", 4, 1.5]), W(["bucket", 2, 2.6], ["armor", 4, 1.3]), W(["bucket", 3, 2.2], ["walker", 6, 1.1])],
  },
  {
    name: "冰壳车队", scene: "winter", waterLanes: [], startDew: 12, feature: "重甲车队",
    hint: "壳壳虫+桶桶虫组成冰壳车队!", flagWaves: [2],
    waves: [W(["armor", 5, 1.4], ["bucket", 2, 2.4]), W(["armor", 6, 1.2], ["bucket", 2, 2.2]), W(["armor", 6, 1.1], ["bucket", 3, 2.0])],
  },
  {
    name: "冻土薄收", scene: "winter", waterLanes: [], startDew: 6, feature: "冰霜经济挑战",
    hint: "冻土上露珠稀少,先攒经济再筑防线!", flagWaves: [2],
    waves: [W(["walker", 5, 1.6]), W(["armor", 4, 1.5], ["walker", 5, 1.3]), W(["bucket", 2, 2.4], ["armor", 4, 1.3])],
  },
  {
    name: "风雪四重压", scene: "winter", waterLanes: [], startDew: 13, feature: "冰霜四波重压",
    hint: "四波重甲兵一波比一波沉!", flagWaves: [3],
    waves: [
      W(["walker", 7, 1.1]), W(["armor", 5, 1.2], ["walker", 5, 1.1]),
      W(["bucket", 3, 2.0], ["armor", 4, 1.2]), W(["bucket", 3, 1.8], ["armor", 6, 1.0], ["walker", 6, 1.0]),
    ],
  },
  {
    name: "冰封双旗", scene: "winter", waterLanes: [], startDew: 13, feature: "冰霜双旗",
    hint: "两面冰旗压阵,铁桶大军开路!", flagWaves: [1, 3],
    waves: [
      W(["armor", 5, 1.3], ["walker", 6, 1.1]), W(["bucket", 3, 1.9], ["armor", 5, 1.1]),
      W(["walker", 8, 0.95], ["armor", 4, 1.15]), W(["bucket", 4, 1.7], ["armor", 6, 1.0], ["walker", 6, 0.95]),
    ],
  },
  {
    name: "极寒五连击", scene: "winter", waterLanes: [], startDew: 14, feature: "冰霜五波极寒",
    hint: "极寒天里五连波,火力千万别冻住!", flagWaves: [4],
    waves: [
      W(["walker", 8, 1.0]), W(["armor", 6, 1.1]), W(["bucket", 3, 1.9]),
      W(["armor", 6, 1.0], ["walker", 6, 1.0]), W(["bucket", 4, 1.6], ["armor", 6, 0.95], ["walker", 7, 0.9]),
    ],
  },
  {
    name: "冰甲大虫王", scene: "winter", waterLanes: [], startDew: 14, feature: "冰霜章BOSS",
    hint: "大虫王披上了冰甲,慢慢磨掉它!", flagWaves: [2],
    waves: [
      W(["bucket", 3, 1.9], ["armor", 5, 1.1]), W(["walker", 8, 0.9], ["armor", 5, 1.0]),
      W(["bossbug", 1, 1], ["bucket", 2, 2.0]),
    ],
  },
];

/* ---- 第八章 · 萤光洞穴 ---- */
const caveHand: LevelDef[] = [
  {
    name: "洞口探险", scene: "cave", waterLanes: [], startDew: 12, feature: "洞穴章开场",
    hint: "洞里露珠最难攒,闪光芽要种满!", flagWaves: [2],
    waves: [W(["digger", 4, 1.5], ["walker", 5, 1.2]), W(["bucket", 2, 2.2], ["digger", 4, 1.3]), W(["racer", 5, 0.95], ["digger", 5, 1.2])],
  },
  {
    name: "钟乳石阵", scene: "cave", waterLanes: [], startDew: 12, feature: "洞穴钻钻大军",
    hint: "钻钻虫在钟乳石间上蹿下跳!", flagWaves: [2],
    waves: [W(["digger", 5, 1.3], ["racer", 4, 1.0]), W(["digger", 6, 1.1], ["bucket", 2, 2.2]), W(["digger", 7, 0.95], ["racer", 5, 0.9])],
  },
  {
    name: "黑暗铁桶阵", scene: "cave", waterLanes: [], startDew: 13, feature: "洞穴重甲阵",
    hint: "黑暗里铁桶虫的影子越来越近……", flagWaves: [2],
    waves: [W(["bucket", 3, 2.0], ["digger", 4, 1.3]), W(["bucket", 3, 1.8], ["racer", 5, 0.9]), W(["bucket", 4, 1.6], ["digger", 5, 1.1])],
  },
  {
    name: "萤火微光", scene: "cave", waterLanes: [], startDew: 6, feature: "洞穴经济挑战",
    hint: "只有萤火一点光,露珠一滴滴省着用!", flagWaves: [2],
    waves: [W(["walker", 6, 1.4]), W(["digger", 5, 1.3], ["walker", 5, 1.2]), W(["racer", 5, 0.95], ["bucket", 2, 2.2])],
  },
  {
    name: "地底四震", scene: "cave", waterLanes: [], startDew: 14, feature: "洞穴四波地震",
    hint: "地底传来四波震动,越来越猛!", flagWaves: [3],
    waves: [
      W(["digger", 6, 1.1]), W(["racer", 6, 0.85], ["digger", 4, 1.15]),
      W(["bucket", 3, 1.8], ["walker", 6, 1.0]), W(["digger", 6, 1.0], ["bucket", 3, 1.7], ["racer", 6, 0.8]),
    ],
  },
  {
    name: "暗河双旗", scene: "cave", waterLanes: [], startDew: 14, feature: "洞穴双旗",
    hint: "暗河边两面大旗,虫虫倾巢而出!", flagWaves: [1, 3],
    waves: [
      W(["digger", 5, 1.15], ["bucket", 2, 2.0]), W(["racer", 7, 0.78], ["digger", 5, 1.05]),
      W(["walker", 8, 0.95], ["bucket", 3, 1.7]), W(["racer", 7, 0.72], ["bucket", 4, 1.5], ["digger", 6, 0.95]),
    ],
  },
  {
    name: "洞穴大远征", scene: "cave", waterLanes: [], startDew: 15, feature: "洞穴五波远征",
    hint: "五波地底大军,这是决战前最后的试炼!", flagWaves: [4],
    waves: [
      W(["walker", 8, 0.95]), W(["digger", 7, 1.0]), W(["bucket", 4, 1.6]),
      W(["racer", 7, 0.75], ["digger", 5, 1.0]), W(["bucket", 4, 1.5], ["racer", 8, 0.68], ["digger", 6, 0.9]),
    ],
  },
  {
    // 第 88 关修复:洞穴露珠产得最慢(dewMult 1.5),原 15 珠开局压力比 >1,
    // 提高开局露珠并把第二波风风虫 8→7,难度回到章末 BOSS 应有的紧张但可过。
    name: "洞穴大虫王", scene: "cave", waterLanes: [], startDew: 20, feature: "洞穴章BOSS",
    hint: "大虫王守着洞穴宝藏,拿下它!", flagWaves: [2],
    waves: [
      W(["digger", 6, 1.0], ["bucket", 3, 1.7]), W(["racer", 7, 0.7], ["walker", 7, 0.9]),
      W(["bossbug", 1, 1], ["digger", 5, 0.95]),
    ],
  },
];

/* ---- 第九章 · 雷雨之夜 ---- */
const stormHand: LevelDef[] = [
  {
    name: "乌云压境", scene: "storm", waterLanes: [], startDew: 13, feature: "雷雨章开场",
    hint: "最终章!雷雨夜虫虫又快又猛!", flagWaves: [2],
    waves: [W(["racer", 5, 0.9], ["armor", 4, 1.2]), W(["speedy", 6, 0.9], ["bucket", 2, 2.0]), W(["racer", 6, 0.8], ["armor", 5, 1.05])],
  },
  {
    name: "闪电快袭", scene: "storm", waterLanes: [], startDew: 13, feature: "雷雨极速潮",
    hint: "风风虫借着闪电冲刺,全场最快!", flagWaves: [2],
    waves: [W(["racer", 7, 0.75]), W(["racer", 7, 0.7], ["speedy", 5, 0.9]), W(["racer", 8, 0.65], ["armor", 4, 1.1])],
  },
  {
    name: "雷鸣铁阵", scene: "storm", waterLanes: [], startDew: 14, feature: "雷雨重甲阵",
    hint: "雷声里铁桶阵推进,前排要顶得住!", flagWaves: [2],
    waves: [W(["bucket", 3, 1.8], ["armor", 5, 1.1]), W(["bucket", 4, 1.6], ["speedy", 5, 0.9]), W(["bucket", 4, 1.5], ["armor", 6, 1.0])],
  },
  {
    name: "暴雨断粮", scene: "storm", waterLanes: [], startDew: 7, feature: "雷雨经济挑战",
    hint: "暴雨冲走了露珠,穷也要守住!", flagWaves: [2],
    waves: [W(["walker", 6, 1.3]), W(["racer", 6, 0.85], ["armor", 4, 1.15]), W(["speedy", 7, 0.8], ["bucket", 2, 2.0])],
  },
  {
    name: "风暴眼", scene: "storm", waterLanes: [], startDew: 15, feature: "雷雨五波风暴",
    hint: "风暴中心五连波,一刻不停!", flagWaves: [4],
    waves: [
      W(["speedy", 7, 0.85]), W(["armor", 6, 1.05]), W(["racer", 7, 0.72]),
      W(["bucket", 4, 1.5], ["speedy", 6, 0.85]), W(["racer", 8, 0.65], ["armor", 6, 0.95], ["bucket", 3, 1.5]),
    ],
  },
  {
    name: "雷暴双旗", scene: "storm", waterLanes: [], startDew: 15, feature: "雷雨双旗决堤",
    hint: "两面雷暴大旗,虫虫女王的先锋军!", flagWaves: [1, 3],
    waves: [
      W(["racer", 7, 0.72], ["armor", 5, 1.05]), W(["bucket", 4, 1.5], ["speedy", 7, 0.8]),
      W(["armor", 6, 0.95], ["racer", 6, 0.75]), W(["bucket", 4, 1.4], ["racer", 8, 0.62], ["speedy", 7, 0.75]),
    ],
  },
  {
    name: "女王亲卫队", scene: "storm", waterLanes: [], startDew: 16, feature: "决战前哨六波",
    hint: "女王的亲卫队倾巢而出,整整六波!", flagWaves: [2, 5],
    waves: [
      W(["speedy", 7, 0.8]), W(["armor", 6, 1.0]), W(["racer", 8, 0.65], ["bucket", 3, 1.5]),
      W(["walker", 9, 0.85]), W(["bucket", 4, 1.4], ["armor", 6, 0.9]),
      W(["racer", 8, 0.6], ["speedy", 7, 0.72], ["bucket", 3, 1.4]),
    ],
  },
  {
    // 第 99 关修复:雷雨夜露珠最慢(dewMult 1.6)+全重甲阵容,原压力比 1.20 过难,
    // 开局露珠 16→28、铁桶 4→3/3→2、飞虫 7→6、终波风风虫 7→6;
    // 女王本体不动,压力比回到 ~0.95,仍是全战役最难一关。
    name: "虫虫女王决战", scene: "storm", waterLanes: [], startDew: 28, feature: "最终BOSS虫虫女王",
    hint: "最终决战!虫虫女王和大虫王一起来啦!", flagWaves: [3],
    waves: [
      W(["armor", 6, 1.0], ["racer", 6, 0.75]), W(["bucket", 3, 1.4], ["speedy", 6, 0.75]),
      W(["bossbug", 1, 1], ["racer", 6, 0.7]),
      W(["queen", 1, 1], ["bucket", 2, 1.4], ["racer", 6, 0.65]),
    ],
  },
];

const HAND_BY_SCENE: LevelDef[][] = [
  dayHand, nightHand, poolHand, fogHand, autumnHand, beachHand, winterHand, caveHand, stormHand,
];

/* ================= 1.1 新章(第 100–188 关,前 99 关一字不动) ================= */

/* ---- 第十章 · 月光花田:昼夜循环 + 扑扑蛾 + 月月菇 ---- */
const moonfieldHand: LevelDef[] = [
  {
    name: "月出东篱", scene: "moonfield", waterLanes: [], startDew: 14, unlockPlant: "moon",
    feature: "月光章开场+月月菇", cycle: { day: 24, night: 10 },
    hint: "天黑露珠攒得慢,新植物月月菇夜里冒露珠!", flagWaves: [2],
    waves: [W(["walker", 5, 1.5]), W(["walker", 5, 1.2], ["speedy", 4, 1.1]), W(["walker", 6, 1.0], ["flyer", 4, 1.1])],
  },
  {
    name: "扑扑蛾初见", scene: "moonfield", waterLanes: [], startDew: 17, unlockPlant: "sunbud",
    feature: "扑扑蛾登场+暖暖花", cycle: { day: 24, night: 12 },
    hint: "新绿芽暖暖花会开出☀️阳光,白天开得快;扑扑蛾一到黑夜就加速!", flagWaves: [2],
    waves: [W(["moth", 2, 1.8], ["walker", 4, 1.4]), W(["moth", 3, 1.4], ["speedy", 3, 1.0]), W(["walker", 6, 1.0], ["moth", 4, 1.2])],
  },
  {
    name: "银辉水洼", scene: "moonfield", waterLanes: [2], startDew: 17,
    feature: "月光水洼战", cycle: { day: 22, night: 12 },
    hint: "月光下有一条水洼道,先铺荷叶垫!", flagWaves: [2],
    waves: [W(["walker", 5, 1.3], ["flyer", 3, 1.4]), W(["speedy", 4, 1.0], ["moth", 3, 1.4]), W(["flyer", 5, 1.0], ["walker", 6, 1.0])],
  },
  {
    name: "月食断粮夜", scene: "moonfield", waterLanes: [], startDew: 8, unlockPlant: "puff",
    feature: "月光经济挑战+蓬蓬花", cycle: { day: 14, night: 16 },
    hint: "新绿芽蓬蓬花吃 2 点☀️阳光,一团花粉能扫一小片;月食之夜月月菇是救星!", flagWaves: [2],
    waves: [W(["walker", 4, 1.8]), W(["speedy", 4, 1.2], ["walker", 5, 1.3]), W(["moth", 4, 1.3], ["walker", 5, 1.1])],
  },
  {
    name: "四更虫鸣", scene: "moonfield", waterLanes: [], startDew: 16,
    feature: "月光四波夜战", cycle: { day: 18, night: 12 },
    hint: "四波虫虫轮着叫,黑夜里别松劲!", flagWaves: [3],
    waves: [
      W(["walker", 5, 1.3]), W(["moth", 3, 1.3], ["speedy", 3, 1.0]),
      W(["flyer", 5, 1.0], ["walker", 5, 1.1]), W(["moth", 5, 1.1], ["speedy", 5, 0.9], ["walker", 5, 1.0]),
    ],
  },
  {
    name: "双月大旗", scene: "moonfield", waterLanes: [], startDew: 17,
    feature: "月光双旗", cycle: { day: 18, night: 14 },
    hint: "两面月光大旗!蛾群趁夜色猛扑", flagWaves: [1, 3],
    waves: [
      W(["walker", 5, 1.2], ["moth", 3, 1.3]), W(["speedy", 6, 0.9], ["flyer", 4, 1.0]),
      W(["moth", 4, 1.2], ["walker", 5, 1.0]), W(["moth", 5, 1.0], ["speedy", 5, 0.9], ["flyer", 4, 0.95]),
    ],
  },
  {
    name: "月光马拉松", scene: "moonfield", waterLanes: [], startDew: 18,
    feature: "月光五波长跑", cycle: { day: 20, night: 12 },
    hint: "五波昼夜连轴转,月月菇闪光芽一起攒!", flagWaves: [4],
    waves: [
      W(["walker", 6, 1.2]), W(["speedy", 5, 1.0]), W(["moth", 5, 1.2]),
      W(["flyer", 5, 0.95], ["walker", 5, 1.0]), W(["moth", 5, 1.0], ["speedy", 6, 0.85], ["walker", 6, 0.9]),
    ],
  },
  {
    name: "月下大虫王", scene: "moonfield", waterLanes: [], startDew: 22,
    feature: "月光章BOSS", cycle: { day: 26, night: 12 },
    hint: "大虫王披着月光来啦,蛾群给它开路!", flagWaves: [2],
    waves: [
      W(["walker", 6, 1.1], ["moth", 3, 1.3]), W(["speedy", 6, 0.9], ["flyer", 4, 1.0]),
      W(["bossbug", 1, 1], ["moth", 4, 1.1]),
    ],
  },
];

/* ---- 第十一章 · 地底根须园:地地虫 + 望望草 ---- */
const burrowHand: LevelDef[] = [
  {
    name: "根须洞口", scene: "burrow", waterLanes: [], startDew: 18, unlockPlant: "scout",
    feature: "地底章开场+望望草",
    hint: "地地虫钻在土里打不到!快种望望草照出它", flagWaves: [2],
    waves: [W(["mole", 3, 2.0], ["walker", 4, 1.5]), W(["mole", 4, 1.6], ["digger", 2, 1.5]), W(["walker", 5, 1.1], ["mole", 3, 1.4])],
  },
  {
    name: "钻地小队", scene: "burrow", waterLanes: [], startDew: 18, unlockPlant: "netpad",
    feature: "地地虫小队+哧溜虫",
    hint: "哧溜虫一进场就挖地,会绕到前排后面冒出来;弹弹网铺一张,它就只能在网前冒头!",
    flagWaves: [2],
    waves: [
      W(["mole", 4, 1.6], ["walker", 4, 1.3]),
      W(["tunneler", 3, 1.8], ["armor", 3, 1.5]),
      W(["mole", 5, 1.2], ["tunneler", 3, 1.4]),
    ],
  },
  {
    name: "泥壳车队", scene: "burrow", waterLanes: [], startDew: 17,
    feature: "地底重甲阵",
    hint: "壳壳虫在地面列队,地地虫在土里配合!", flagWaves: [2],
    waves: [W(["armor", 4, 1.4], ["mole", 3, 1.5]), W(["armor", 5, 1.2], ["digger", 4, 1.3]), W(["mole", 5, 1.2], ["armor", 5, 1.1])],
  },
  {
    name: "黑土断粮", scene: "burrow", waterLanes: [], startDew: 14,
    feature: "地底经济挑战",
    hint: "黑土里露珠难攒,望望草和弹弹网都得挑最要紧的道铺!", flagWaves: [2],
    waves: [W(["walker", 5, 1.5]), W(["mole", 4, 1.5], ["tunneler", 3, 1.5]), W(["digger", 4, 1.2], ["mole", 4, 1.3])],
  },
  {
    name: "地道四震", scene: "burrow", waterLanes: [], startDew: 18,
    feature: "地底四波震动",
    hint: "地道里传来四波震动,越来越近!", flagWaves: [3],
    waves: [
      W(["walker", 6, 1.2]), W(["mole", 5, 1.3], ["digger", 4, 1.2]),
      W(["armor", 5, 1.15], ["walker", 5, 1.05]), W(["mole", 6, 1.05], ["armor", 5, 1.0], ["digger", 4, 1.05]),
    ],
  },
  {
    name: "根须双旗", scene: "burrow", waterLanes: [], startDew: 20,
    feature: "地底双旗",
    hint: "两面泥土大旗,地上、地下、挖地的一起上!", flagWaves: [1, 3],
    waves: [
      W(["mole", 4, 1.4], ["walker", 5, 1.2]), W(["digger", 5, 1.1], ["tunneler", 4, 1.3]),
      W(["armor", 5, 1.1], ["walker", 5, 1.0]), W(["mole", 6, 1.0], ["armor", 5, 0.95], ["tunneler", 4, 1.1]),
    ],
  },
  {
    name: "地心五连震", scene: "burrow", waterLanes: [], startDew: 19,
    feature: "地底五波远征",
    hint: "五波地心大军!望望草阵一棵都不能倒", flagWaves: [4],
    waves: [
      W(["walker", 6, 1.15]), W(["mole", 5, 1.2]), W(["digger", 5, 1.1], ["armor", 4, 1.1]),
      W(["mole", 5, 1.1], ["walker", 5, 1.0]), W(["armor", 5, 1.0], ["mole", 6, 0.95], ["digger", 5, 0.95]),
    ],
  },
  {
    name: "地底大虫王", scene: "burrow", waterLanes: [], startDew: 26,
    feature: "地底章BOSS",
    hint: "大虫王从最深的地道钻出来啦,哧溜虫在前头给它开路!", flagWaves: [2],
    waves: [
      W(["mole", 5, 1.2], ["armor", 4, 1.15]), W(["tunneler", 4, 1.1], ["walker", 6, 0.95]),
      W(["bossbug", 1, 1], ["mole", 5, 1.1]),
    ],
  },
];

/* ---- 第十二章 · 糖霜花圃:分分虫 + 露珠上限 ---- */
const candyHand: LevelDef[] = [
  {
    name: "糖霜初雪", scene: "candy", waterLanes: [], startDew: 15, dewCap: 26,
    feature: "糖霜章开场+分分虫",
    hint: "露珠罐装满就溢出来!分分虫倒下还会分身", flagWaves: [2],
    waves: [W(["mama", 2, 2.0], ["walker", 4, 1.4]), W(["mama", 3, 1.6], ["speedy", 4, 1.0]), W(["walker", 6, 1.0], ["mama", 3, 1.4])],
  },
  {
    name: "分分小队", scene: "candy", waterLanes: [], startDew: 19, dewCap: 26,
    feature: "分分虫小队",
    hint: "分分虫组团来袭,爆爆果一锅端最划算!", flagWaves: [2],
    waves: [W(["mama", 2, 1.6], ["speedy", 3, 1.1]), W(["mama", 3, 1.4], ["flyer", 3, 1.0]), W(["mama", 3, 1.2], ["racer", 3, 0.9])],
  },
  {
    name: "蜜糖水渠", scene: "candy", waterLanes: [1], startDew: 18, dewCap: 28,
    feature: "糖霜水渠战",
    hint: "蜜糖渠是条水路,风风虫沿着岸边飙!", flagWaves: [2],
    waves: [W(["walker", 5, 1.2], ["racer", 2, 1.0]), W(["speedy", 4, 0.95], ["mama", 3, 1.4]), W(["racer", 3, 0.85], ["flyer", 3, 0.95])],
  },
  {
    name: "小糖罐挑战", scene: "candy", waterLanes: [], startDew: 12, dewCap: 16,
    feature: "糖霜上限挑战",
    hint: "罐子特别小,攒到就赶紧花掉!", flagWaves: [2],
    waves: [W(["walker", 5, 1.4]), W(["speedy", 4, 1.05], ["mama", 2, 1.6]), W(["racer", 3, 0.9], ["walker", 5, 1.05])],
  },
  {
    name: "果酱四连波", scene: "candy", waterLanes: [], startDew: 17, dewCap: 30,
    feature: "糖霜四波混战",
    hint: "四波果酱大军,一波更比一波甜(凶)!", flagWaves: [3],
    waves: [
      W(["walker", 6, 1.15]), W(["mama", 3, 1.4], ["speedy", 4, 1.0]),
      W(["racer", 5, 0.85], ["flyer", 4, 0.95]), W(["mama", 4, 1.15], ["speedy", 5, 0.9], ["walker", 5, 0.95]),
    ],
  },
  {
    name: "糖霜双旗", scene: "candy", waterLanes: [], startDew: 17, dewCap: 30,
    feature: "糖霜双旗",
    hint: "两面糖霜大旗,分分虫越打越多!", flagWaves: [1, 3],
    waves: [
      W(["speedy", 3, 1.0], ["mama", 2, 1.5]), W(["racer", 3, 0.85], ["mama", 2, 1.3]),
      W(["flyer", 5, 0.95], ["walker", 4, 1.0]), W(["mama", 2, 1.1], ["racer", 4, 0.8], ["speedy", 4, 0.85]),
    ],
  },
  {
    name: "甜蜜马拉松", scene: "candy", waterLanes: [], startDew: 18, dewCap: 32,
    feature: "糖霜五波长跑",
    hint: "五波甜蜜大军,露珠罐要精打细算!", flagWaves: [4],
    waves: [
      W(["walker", 6, 1.1]), W(["speedy", 5, 0.95]), W(["mama", 4, 1.25]),
      W(["racer", 5, 0.85], ["flyer", 4, 0.9]), W(["mama", 4, 1.1], ["racer", 5, 0.8], ["walker", 6, 0.9]),
    ],
  },
  {
    name: "糖霜大虫王", scene: "candy", waterLanes: [], startDew: 28, dewCap: 34,
    feature: "糖霜章BOSS",
    hint: "大虫王闻着糖香来啦,分分虫全程护驾!", flagWaves: [2],
    waves: [
      W(["mama", 3, 1.3], ["speedy", 5, 0.95]), W(["racer", 4, 0.8], ["flyer", 4, 0.9]),
      W(["bossbug", 1, 1], ["mama", 3, 1.2]),
    ],
  },
];

/* ---- 第十三章 · 虫巢王庭:全机制汇合,终章 BOSS 女王进化体 ---- */
const hiveHand: LevelDef[] = [
  {
    name: "王庭前哨", scene: "hive", waterLanes: [], startDew: 22,
    feature: "王庭章开场", cycle: { day: 20, night: 12 },
    hint: "终章!地上地下天上,虫虫全家出动!", flagWaves: [2],
    waves: [W(["walker", 5, 1.3], ["mole", 3, 1.4]), W(["moth", 4, 1.3], ["armor", 4, 1.2]), W(["mama", 3, 1.3], ["walker", 5, 1.0])],
  },
  {
    name: "蛾群夜袭", scene: "hive", waterLanes: [], startDew: 22,
    feature: "王庭蛾群夜战", cycle: { day: 18, night: 16 },
    hint: "长夜漫漫,蛾群一波接一波扑过来!", flagWaves: [2],
    waves: [W(["moth", 2, 1.4], ["walker", 4, 1.2]), W(["moth", 4, 1.2], ["mole", 4, 1.3]), W(["moth", 6, 1.0], ["mama", 3, 1.2])],
  },
  {
    name: "王家钻地队", scene: "hive", waterLanes: [], startDew: 23,
    feature: "王庭钻地重甲",
    hint: "女王的钻地亲卫队:哧溜虫绕后、铁桶虫殿后!", flagWaves: [2],
    waves: [W(["mole", 5, 1.3], ["bucket", 2, 2.2]), W(["tunneler", 4, 1.15], ["armor", 4, 1.1]), W(["bucket", 3, 1.8], ["mole", 5, 1.05])],
  },
  {
    name: "王庭断粮日", scene: "hive", waterLanes: [], startDew: 15, dewCap: 20,
    feature: "王庭经济挑战",
    hint: "露珠罐又小攒得又慢,这是穷日子的硬仗!", flagWaves: [2],
    waves: [W(["walker", 5, 1.4]), W(["mole", 4, 1.3], ["walker", 4, 1.15]), W(["mama", 3, 1.3], ["moth", 3, 1.2])],
  },
  {
    name: "亲卫四连阵", scene: "hive", waterLanes: [], startDew: 22,
    feature: "王庭四波亲卫", cycle: { day: 18, night: 12 },
    hint: "女王亲卫排成四阵,昼夜不停!", flagWaves: [3],
    waves: [
      W(["walker", 6, 1.1]), W(["moth", 4, 1.2], ["mole", 4, 1.2]),
      W(["bucket", 3, 1.8], ["tunneler", 3, 1.2]), W(["moth", 5, 1.0], ["mole", 5, 1.0], ["bucket", 3, 1.6]),
    ],
  },
  {
    name: "王庭双旗", scene: "hive", waterLanes: [], startDew: 26, dewCap: 32,
    feature: "王庭双旗",
    hint: "两面王旗压阵,罐子上限要靠产露植物撑大!", flagWaves: [1, 3],
    waves: [
      W(["mole", 4, 1.15], ["walker", 4, 1.05]), W(["mama", 3, 1.1], ["moth", 4, 1.1]),
      W(["bucket", 3, 1.7], ["tunneler", 2, 1.0]), W(["mama", 3, 1.0], ["moth", 5, 0.95], ["mole", 4, 0.95]),
    ],
  },
  {
    name: "决战前夜", scene: "hive", waterLanes: [], startDew: 30,
    feature: "王庭六波前夜", cycle: { day: 20, night: 14 },
    hint: "决战前的最后试炼,整整六波,四种机制全都会来!", flagWaves: [2, 5],
    waves: [
      W(["walker", 6, 1.1]), W(["moth", 4, 1.15], ["mole", 4, 1.15]),
      W(["bucket", 3, 1.7], ["mama", 3, 1.15]), W(["tunneler", 2, 1.0], ["walker", 5, 1.0]),
      W(["moth", 5, 0.95], ["armor", 5, 0.95]), W(["mama", 4, 1.0], ["bucket", 3, 1.5], ["moth", 4, 0.95]),
    ],
  },
  {
    name: "女王进化体降临", scene: "hive", waterLanes: [], startDew: 32,
    feature: "最终BOSS女王进化体", cycle: { day: 26, night: 12 },
    hint: "最终决战!进化体血少一半会狂暴加速,冰冰花备好!", flagWaves: [3],
    waves: [
      W(["mole", 4, 1.1], ["moth", 3, 1.1]), W(["mama", 3, 1.15], ["bucket", 3, 1.6]),
      W(["bossbug", 1, 1], ["moth", 4, 1.0]),
      W(["queenx", 1, 1], ["mama", 2, 1.2], ["mole", 4, 1.0]),
    ],
  },
];

/** 1.1 遭遇战生成器:新章的虫潮关,带昼夜/上限标记,签名全局唯一。 */
function genLevel2(sceneIdx: number, sub: number): LevelDef {
  const scene = SCENE_ORDER[sceneIdx];
  const st = SCENE_STYLE[scene];
  const pal = st.palette;
  const t2 = sceneIdx - CLASSIC_THEME_COUNT; // 0..3
  const waveCount = 3 + ((sub + t2) % 3); // 3~5 波
  const waves: WaveEntry[][] = [];
  for (let wi = 0; wi < waveCount; wi++) {
    const batches: WaveEntry[] = [];
    // 开场两波只派单路纵队探路,防线立起来之后才上双队混编
    const nBatches = wi <= 1 ? 1 : 1 + ((wi + sub) % 2);
    for (let b = 0; b < nBatches; b++) {
      // sub ≥ 12 时轮换阵容错开一位,避免与 sub-12 的波次模板撞车
      let kind = pal[(wi + b * 2 + sub + Math.floor(sub / 12)) % pal.length];
      // 第 1 波只派慢速地面小虫探路(飞的/钻地的/狂飙的从第 2 波起,防线来得及立)
      if (
        wi === 0 &&
        (BUG_INFO[kind].flying || BUG_INFO[kind].underground || BUG_INFO[kind].speed >= 1.1)
      ) {
        kind = "walker";
      }
      let count = 2 + Math.min(wi, 2) + ((wi * 2 + b + sub + t2) % 3);
      if (wi === 0) count = Math.min(count, 3);
      if (wi === 1) count = Math.min(count, 4);
      // 重家伙与分裂虫打六折,夜蛾一批最多 4 只
      if (kind === "bucket" || kind === "mama") count = Math.ceil(count * 0.6);
      if (kind === "moth") count = Math.min(count, 4);
      const gap = Math.max(0.7, 1.8 - wi * 0.15 - t2 * 0.05);
      batches.push({ kind, count, gap: Math.round(gap * 100) / 100 });
    }
    waves.push(batches);
  }
  const water =
    scene === "moonfield" && sub % 4 === 2 ? [2] : scene === "candy" && sub % 5 === 3 ? [1] : [];
  const cycle: DayNightCycle | undefined =
    scene === "moonfield"
      ? { day: 18 + (sub % 3) * 4, night: 10 + (sub % 2) * 4 }
      : scene === "hive" && sub % 2 === 0
        ? { day: 16 + (sub % 4) * 2, night: 12 }
        : undefined;
  const dewCap =
    scene === "candy" ? 22 + sub : scene === "hive" && sub % 2 === 1 ? 20 + sub : undefined;
  return {
    name: `${st.name}虫潮 ${sub + 1} 号`,
    scene,
    waterLanes: water,
    waves,
    flagWaves: [waveCount - 1],
    startDew: 13 + t2 * 2 + Math.floor(sub / 3),
    feature: `${st.name}虫潮${sub + 1}号`,
    gen: true,
    cycle,
    dewCap,
    hint: `${st.name}的杂虫突袭!顶住 ${waveCount} 波,最后一波是大旗!`,
  };
}

/** 一关里出现了哪些机制(生成特殊关的配苗要照着这个给)。 */
function waveTraitScan(
  waves: WaveEntry[][],
  levelIdx: number,
): { hp: number; flying: boolean; fast: boolean; jump: boolean; dig: boolean; hide: boolean; armor: boolean } {
  let hp = 0;
  let flying = false;
  let fast = false;
  let jump = false;
  let dig = false;
  let hide = false;
  let armor = false;
  for (const wave of waves) {
    for (const e of wave) {
      const info = BUG_INFO[e.kind];
      hp += e.count * (bugHp(e.kind, levelIdx) + info.armor);
      flying = flying || info.flying;
      fast = fast || info.speed >= 0.9;
      jump = jump || !!info.jumps;
      dig = dig || !!info.digs;
      hide = hide || !!info.underground;
      armor = armor || info.armor > 0;
    }
  }
  return { hp, flying, fast, jump, dig, hide, armor };
}

/** 解谜关的苗是按这一关真实的虫量配的,所以一定摆得平 —— 难在摆哪儿。 */
function puzzleStock(waves: WaveEntry[][], levelIdx: number): PlantStock[] {
  const t = waveTraitScan(waves, levelIdx);
  const stock: PlantStock[] = [
    { kind: "nut", count: 6 },
    { kind: "bubble", count: Math.max(6, Math.ceil(t.hp / 6)) },
  ];
  if (t.flying) stock.push({ kind: "star", count: Math.max(5, Math.ceil(t.hp / 8)) });
  if (t.fast) stock.push({ kind: "ice", count: 4 });
  if (t.jump || t.dig) stock.push({ kind: "netpad", count: 4 });
  if (t.hide) stock.push({ kind: "scout", count: 4 });
  stock.push({ kind: "boom", count: 3 }, { kind: "puff", count: 2 });
  return stock;
}

/**
 * 传送带发什么由这一关的虫决定,而且「先来后到」很讲究:
 * 最要紧的(照地下虫的望望草、头几门炮)排在最前面,墙和一次性的爆爆果往后放。
 * 整条带子循环发,枪占一多半 —— 传送关不产资源,火力全靠带子。
 */
function conveyorBelt(waves: WaveEntry[][], levelIdx: number): PlantKind[] {
  const t = waveTraitScan(waves, levelIdx);
  const gun: PlantKind = t.flying ? "star" : "bubble";
  const belt: PlantKind[] = [];
  if (t.hide) belt.push("scout", "scout");
  belt.push(gun, gun);
  if (t.flying) belt.push("star");
  belt.push("nut", gun);
  if (t.hide) belt.push("scout", "scout");
  if (t.fast) belt.push("ice");
  belt.push(gun, "nut", gun);
  if (t.jump || t.dig) belt.push("netpad");
  if (t.flying) belt.push("star");
  if (t.armor) belt.push("boom", "ice");
  belt.push(gun, "boom", gun, "puff", gun, "nut");
  return belt;
}

/** 波次整体缩量(解谜关的苗是有限的,虫也跟着少一些)。 */
function scaleWaves(waves: WaveEntry[][], scale: number): WaveEntry[][] {
  return waves.map((wave) =>
    wave.map((e) => ({ ...e, count: Math.max(2, Math.round(e.count * scale)) })),
  );
}

/** 把一关虫潮改造成特殊关(名字/提示/feature 都跟着换,查重仍然成立)。 */
function specialize(def: LevelDef, kind: SpecialKind, levelIdx: number): LevelDef {
  if (kind === "puzzle") {
    const waves = scaleWaves(def.waves, 0.6);
    const stock = puzzleStock(waves, levelIdx);
    // 水道关先把荷叶垫配够,不然一格都种不下去
    if (def.waterLanes.length > 0) {
      stock.unshift({ kind: "lily", count: def.waterLanes.length * 6 });
    }
    return {
      ...def,
      waves,
      name: `${def.name}·苗阵谜题`,
      feature: `${def.feature}·解谜关`,
      hint: "解谜关:没有露珠收入,只有这一沓固定的苗,想清楚每一株摆哪儿!",
      special: { kind, stock },
    };
  }
  if (kind === "conveyor") {
    let belt = conveyorBelt(def.waves, levelIdx);
    // 水道关:荷叶垫要一路跟着发,不然水道上只铺得下开头那两格
    if (def.waterLanes.length > 0) {
      belt = belt.flatMap((k, i) => (i % 3 === 2 ? [k, "lily" as PlantKind] : [k]));
      belt.unshift("lily", "lily");
    }
    return {
      ...def,
      waves: scaleWaves(def.waves, 0.8),
      name: `${def.name}·传送带`,
      feature: `${def.feature}·传送关`,
      hint: "传送关:传送带一株一株往这儿送苗,不花资源,来什么就用什么!",
      special: { kind, belt, beltEvery: BELT_EVERY },
    };
  }
  return {
    ...def,
    name: `${def.name}·限时速攻`,
    feature: `${def.feature}·速攻关`,
    hint: "速攻关:波次连着来,倒计时归零前要把全场清空,火力优先!",
    special: { kind },
  };
}

/** 新四章里第几号虫潮改成什么特殊关(每章 2 解谜 + 2 传送 + 2 速攻)。 */
const SPECIAL_BY_SUB: ReadonlyArray<[number, SpecialKind]> = [
  [1, "puzzle"],
  [3, "conveyor"],
  [5, "blitz"],
  [8, "puzzle"],
  [10, "conveyor"],
  [12, "blitz"],
];

function specialForSub(sub: number): SpecialKind | null {
  for (const [s, kind] of SPECIAL_BY_SUB) if (s === sub) return kind;
  return null;
}

/** 新章组装:手写 8 关打骨架,虫潮关填满(其中 6 关是特殊关),章末必是 BOSS。 */
function buildTheme2(sceneIdx: number, hand: LevelDef[], size: number): LevelDef[] {
  if (hand.length !== HANDMADE_PER_THEME) {
    throw new Error(`scene ${sceneIdx} 手写关数量应为 ${HANDMADE_PER_THEME}`);
  }
  const base = themeOffset(sceneIdx);
  const genCount = size - hand.length;
  const gens = Array.from({ length: genCount }, (_, i) => genLevel2(sceneIdx, i));
  const out: LevelDef[] = [hand[0]];
  let gi = 0;
  const pushGen = (): void => {
    const sub = gi;
    const raw = gens[gi++];
    const kind = specialForSub(sub);
    out.push(kind ? specialize(raw, kind, base + out.length) : raw);
  };
  for (const mid of hand.slice(1, 7)) {
    pushGen();
    pushGen();
    out.push(mid);
  }
  while (gi < genCount) pushGen();
  out.push(hand[7]);
  return out;
}

const NEW_HAND_BY_SCENE: LevelDef[][] = [moonfieldHand, burrowHand, candyHand, hiveHand];

export const LEVELS: LevelDef[] = [
  ...HAND_BY_SCENE.flatMap((hand, ci) => buildTheme(ci, hand)),
  ...NEW_HAND_BY_SCENE.flatMap((hand, i) =>
    buildTheme2(CLASSIC_THEME_COUNT + i, hand, THEME_SIZES[CLASSIC_THEME_COUNT + i]),
  ),
];

export interface BugSpawn {
  time: number;
  lane: number;
  kind: BugKind;
  wave: number;
}

/** 把一关的波次定义摊成确定性的出虫时间表。 */
export function buildLevelSchedule(levelIdx: number): BugSpawn[] {
  const def = LEVELS[levelIdx];
  // 速攻关:开场早一点、波与波之间只留一半的喘息(仍然 ≥ 3 秒布置时间)
  const blitz = def.special?.kind === "blitz";
  const gapScale = blitz ? BLITZ_GAP_SCALE : 1;
  const out: BugSpawn[] = [];
  let clock = blitz ? 4 : 5;
  for (let wi = 0; wi < def.waves.length; wi++) {
    const isFlag = def.flagWaves.includes(wi);
    let i = 0;
    let waveEnd = clock;
    for (const entry of def.waves[wi]) {
      for (let k = 0; k < entry.count; k++) {
        const t = clock + k * entry.gap;
        out.push({
          time: t,
          lane: (i * 3 + wi * 2 + levelIdx) % LANES,
          kind: entry.kind,
          wave: wi,
        });
        waveEnd = Math.max(waveEnd, t);
        i++;
      }
      clock += blitz ? 0.9 : 1.2;
    }
    clock = waveEnd + (isFlag ? 11 : 9) * gapScale;
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** 速攻关的倒计时:最后一只出场之后再给 BLITZ_GRACE 秒清场。 */
export function blitzLimit(levelIdx: number): number {
  const sched = buildLevelSchedule(levelIdx);
  const last = sched.length > 0 ? sched[sched.length - 1].time : 0;
  return Math.round((last + BLITZ_GRACE) * 10) / 10;
}

/** 这一关最短的一段波间隙(布置时间够不够就看它)。 */
export function shortestPrepGap(levelIdx: number): number {
  const sched = buildLevelSchedule(levelIdx);
  const firstOfWave = new Map<number, number>();
  const lastOfWave = new Map<number, number>();
  for (const s of sched) {
    if (!firstOfWave.has(s.wave)) firstOfWave.set(s.wave, s.time);
    firstOfWave.set(s.wave, Math.min(firstOfWave.get(s.wave)!, s.time));
    lastOfWave.set(s.wave, Math.max(lastOfWave.get(s.wave) ?? 0, s.time));
  }
  const waves = [...firstOfWave.keys()].sort((a, b) => a - b);
  let gap = firstOfWave.get(waves[0]) ?? Infinity;
  for (let i = 1; i < waves.length; i++) {
    gap = Math.min(gap, firstOfWave.get(waves[i])! - lastOfWave.get(waves[i - 1])!);
  }
  return gap;
}

export function levelBugCount(def: LevelDef): number {
  return def.waves.reduce((s, w) => s + w.reduce((x, e) => x + e.count, 0), 0);
}

/** 关卡波次结构签名(生成器查重用)。 */
export function levelWaveSignature(def: LevelDef): string {
  return def.waves
    .map((w) => w.map((e) => `${e.kind}x${e.count}`).join("+"))
    .join("|");
}

/* ---- 战斗节奏常量(运行时与模拟器共用,1.1 起集中在这里) ---- */
export const BUBBLE_SPEED = 3.5;
export const STAR_SPEED = 4.2;
export const ICE_SPEED = 3.8;
export const PUFF_SPEED = 3.0;
export const SHOOT_CD = 1.3;

/**
 * 射速表。1.1 的三门炮一律 1.3 秒,这三档 1.2 一个字不改 —— 前 99 关的手感原样保留;
 * 星星芽与冰冰花的区别改走 1.2 新加的「卡片冷却」那条轴(见 sprout12.PLANT_SPEC):
 * 星星芽 1.2 秒就能再种一株,冰冰花要歇 2.2 秒,换来命中冻住。
 * 新苗蓬蓬花打得慢,但一团花粉能扫一小片。
 */
export const SHOOT_CD_BY_KIND: Record<ProjKind, number> = {
  bubble: SHOOT_CD,
  star: SHOOT_CD,
  ice: SHOOT_CD,
  puff: 1.7,
};

export function shootCooldown(proj: ProjKind): number {
  return SHOOT_CD_BY_KIND[proj];
}

/** 蓬蓬花的花粉团:命中点前后这么多格里的地面虫一起吃 1 点溅射伤害。 */
export const PUFF_SPLASH_RANGE = 0.9;
export const PUFF_SPLASH_DAMAGE = 1;
export const CHEW_INTERVAL = 0.9;
export const BOSS_CHEW_INTERVAL = 0.35;
export const SPARKLE_DEW_EVERY = 4.5;
/** 虫子出生的 x 坐标(格)。 */
export const BUG_SPAWN_X = PLANT_COLS + 0.7;

/** 泡泡/星星打没打到虫(同车道,x 方向足够近,单位:格)。 */
export function bubbleHitsBug(bubbleX: number, bugX: number, hitRange = 0.3): boolean {
  return Math.abs(bubbleX - bugX) <= hitRange;
}

/** 虫子是否啃到了这一格的植物(单位:格)。 */
export function bugReachesPlant(bugX: number, plantCol: number): boolean {
  return bugX <= plantCol + 0.62 && bugX >= plantCol - 0.1;
}

/** 虫子走到 x <= 这个值就算进家门。 */
export const HOME_X = -0.25;

/** 露珠自然产出:基础间隔 × 场景倍率(夜晚/洞穴攒得慢,沙滩攒得快)。 */
export const PASSIVE_DEW_DAY = 3.5;
export const PASSIVE_DEW_NIGHT = PASSIVE_DEW_DAY * SCENE_STYLE.night.dewMult;

export function passiveDewInterval(scene: SceneId): number {
  return PASSIVE_DEW_DAY * SCENE_STYLE[scene].dewMult;
}

/* ---------------- 结算与进度 ---------------- */

/** 单关星级:损失 ≤1 棵植物 3 星,≤4 棵 2 星,守住 1 星。 */
export function starsForLevel(plantsLost: number): 1 | 2 | 3 {
  if (plantsLost <= 1) return 3;
  if (plantsLost <= 4) return 2;
  return 1;
}

export const PROGRESS_KEY = "yiduo-yixing.sprout-defense.campaign.v2";

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

/** 章节是否解锁:本章第一关解锁即可进入(1.1 起章节长度不一,按偏移算)。 */
export function isThemeUnlocked(stars: ReadonlyArray<number>, themeIdx: number): boolean {
  return isLevelUnlocked(stars, themeOffset(themeIdx));
}

export function themeStars(stars: ReadonlyArray<number>, themeIdx: number): number {
  let s = 0;
  for (const i of levelIndicesOfTheme(themeIdx)) s += stars[i] ?? 0;
  return s;
}

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
export function clearSpeechLine(name: string, stars: number, plantsLost: number): string {
  return plantsLost <= 1
    ? `${name}守住啦!得到 ${stars} 颗星,植物几乎无伤,完美防守!`
    : `${name}守住啦!得到 ${stars} 颗星,真棒!`;
}

/** 失败结算面板要朗读的整句话:温柔安抚,BOSS 关再带一句悄悄提示。 */
export function retrySpeechLine(hint: string | null): string {
  const base = "虫虫溜进小屋啦。没关系,就在这一关重新布阵!";
  return hint ? `${base}悄悄告诉你:${hint}` : base;
}
