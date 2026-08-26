// 小怪物危机 —— 纯逻辑层,不碰 DOM,方便单独跑测试。
//
// 玩法一句话:小怪物一波波从右边溜达过来,你在左边摆路障、架炮台,
// 同时亲自操作主角甩颜料弹。被颜料糊到的小怪物会「噗」一声冒烟,
// 然后变成一朵小花或者一颗棉花糖弹回家去 —— 全程没有一点伤害描写。
//
// 这里放四类东西:
//  1. 场地尺寸与坐标换算(UI 与无头模拟器共用同一套几何);
//  2. 建筑 / 小怪物的属性表与战斗结算(纯函数);
//  3. 颜料经济与三条科技线;
//  4. 评星与全部结算文案。

/* ------------------------------------------------------------------ */
/* 场地几何                                                            */
/* ------------------------------------------------------------------ */

/** 车道数(横排)。 */
export const LANES = 5;

/** 可建造的格子列数,列号 0..7。 */
export const BUILD_COLS = 8;

/** 家门线:小怪物走到这里就抢走一罐颜料,然后被弹回去。 */
export const HOME_X = 0;

/** 小怪物出场的位置(屏幕右侧外面一点)。 */
export const SPAWN_X = 9.6;

/** 主角能来回跑的横向范围(贴着家门口守着)。 */
export const HERO_MIN_X = 0.35;
export const HERO_MAX_X = 3.2;

/** 第 col 列格子的中心 x 坐标。 */
export function colX(col: number): number {
  return col + 1;
}

/** x 坐标落在哪一列(超出建造区返回 -1)。 */
export function colAtX(x: number): number {
  const col = Math.round(x - 1);
  return col >= 0 && col < BUILD_COLS ? col : -1;
}

/** 把 0..1 的归一化纵坐标换算成车道号。 */
export function laneAtRatio(ratio: number): number {
  const lane = Math.floor(ratio * LANES);
  return Math.max(0, Math.min(LANES - 1, lane));
}

/** 夹在合法范围里(车道 / 主角横坐标都用得上)。 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ------------------------------------------------------------------ */
/* 确定性随机:同一关每次生成的波次完全一致                              */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/* ------------------------------------------------------------------ */
/* 建筑:路障 + 自动炮台 + 颜料罐                                        */
/* ------------------------------------------------------------------ */

export type TowerKind = "wall" | "jar" | "pop" | "boom" | "frost" | "beam";

export interface TowerSpec {
  /** 建造要花的颜料 */
  cost: number;
  /** 被啃的耐久(啃光只是散成一堆棉花,不会怎么样) */
  hp: number;
  name: string;
  desc: string;
  /** 自动炮台的单发伤害 */
  dmg?: number;
  /** 自动炮台的发射间隔(秒) */
  cd?: number;
  /** 打得到飞在天上的小怪物吗 */
  hitsAir?: boolean;
  /** 命中会让小怪物慢下来 */
  slows?: boolean;
  /** 颜料罐:每 produceEvery 秒产 produce 罐颜料 */
  produce?: number;
  produceEvery?: number;
  /** 一次性大喷发:小怪物靠到 trigger 格以内就喷,波及 range 格 */
  blast?: { dmg: number; range: number; trigger: number };
}

export const TOWER_INFO: Record<TowerKind, TowerSpec> = {
  wall: { cost: 2, hp: 26, name: "棉花墙", desc: "软软一堵墙,小怪物要啃好久" },
  jar: { cost: 3, hp: 8, name: "颜料罐", desc: "咕嘟咕嘟冒颜料", produce: 2, produceEvery: 7 },
  pop: { cost: 4, hp: 10, name: "泡泡炮", desc: "连发泡泡,打地上的", dmg: 2, cd: 1.15, hitsAir: false },
  boom: {
    cost: 4,
    hp: 5,
    name: "爆米花桶",
    desc: "靠太近就砰地喷一大片爆米花",
    blast: { dmg: 24, range: 1.7, trigger: 0.65 },
  },
  frost: {
    cost: 5,
    hp: 10,
    name: "冰沙台",
    desc: "浇一身冰沙,走路变慢吞吞",
    dmg: 1,
    cd: 1.5,
    hitsAir: false,
    slows: true,
  },
  beam: { cost: 7, hp: 10, name: "彩虹灯塔", desc: "彩虹光连天上的也照得到", dmg: 3, cd: 1.05, hitsAir: true },
};

export const TOWER_KINDS: TowerKind[] = ["wall", "jar", "pop", "boom", "frost", "beam"];

/** 拆掉自己的建筑退回一半颜料(向上取整),摆错位置不至于血本无归。 */
export function towerRefund(kind: TowerKind): number {
  return Math.ceil(TOWER_INFO[kind].cost / 2);
}

/** 这一关解锁了哪些建筑:开局三件套,后面按章节逐件加。 */
export const TOWER_UNLOCK_CHAPTER: Record<TowerKind, number> = {
  wall: 0,
  jar: 0,
  pop: 0,
  boom: 1,
  frost: 2,
  beam: 3,
};

export function towersUnlockedAt(chapter: number): TowerKind[] {
  return TOWER_KINDS.filter((k) => chapter >= TOWER_UNLOCK_CHAPTER[k]);
}

/** 这个格子现在能不能摆东西:格子在场内、没被占、也不是花坛水洼这类障碍格。 */
export function canBuildOn(col: number, lane: number, occupied: boolean, blocked: boolean): boolean {
  if (!Number.isInteger(col) || !Number.isInteger(lane)) return false;
  if (col < 0 || col >= BUILD_COLS) return false;
  if (lane < 0 || lane >= LANES) return false;
  return !occupied && !blocked;
}

/* ------------------------------------------------------------------ */
/* 小怪物:全员卡通,被打中只会冒烟、变花、弹飞                          */
/* ------------------------------------------------------------------ */

export type MonsterKind =
  | "doodle" // 涂涂怪:最常见的小方块,慢悠悠
  | "cotton" // 棉花怪:软乎乎一大团,厚但慢
  | "spinner" // 陀螺怪:转着圈冲过来,很快
  | "pumpkin" // 南瓜灯怪:戴着南瓜壳,要先把壳糊花
  | "balloon" // 气球怪:飘在天上,路障拦不住
  | "box" // 纸箱怪:整个人躲在纸箱里,壳超厚
  | "jelly" // 果冻怪:被糊到会「啵」地分成两只涂涂怪
  | "hopper" // 跳跳怪:蹦一下就越过挡在最前面的那堵墙
  | "bossDoodle" // 大涂涂王
  | "bossCotton" // 棉花糖巨人
  | "bossPumpkin" // 南瓜灯校长
  | "bossCarousel" // 旋转木马怪
  | "bossGear" // 齿轮怪王
  | "bossCloud" // 棉花云王
  | "bossFilm" // 胶片怪王
  | "bossRainbow"; // 彩虹大怪

export interface MonsterSpec {
  hp: number;
  /** 外壳:颜料要先把壳糊花才碰得到本体 */
  armor: number;
  /** 每秒走过的格数 */
  speed: number;
  /** 飘在天上,地面路障和泡泡炮都够不着 */
  flying?: boolean;
  /** 会蹦过挡在最前面的那一堵建筑 */
  jumps?: boolean;
  /** 被糊花时会分裂出几只涂涂怪 */
  splits?: number;
  /** 打倒后掉几罐颜料 */
  reward: number;
  /** 章节大怪 */
  boss?: boolean;
  name: string;
  /** 被糊花之后变成什么(结算与动画都用这句) */
  becomes: string;
}

export const MONSTER_INFO: Record<MonsterKind, MonsterSpec> = {
  doodle: { hp: 7, armor: 0, speed: 0.42, reward: 1, name: "涂涂怪", becomes: "小雏菊" },
  cotton: { hp: 16, armor: 0, speed: 0.3, reward: 2, name: "棉花怪", becomes: "棉花糖" },
  spinner: { hp: 6, armor: 0, speed: 0.92, reward: 2, name: "陀螺怪", becomes: "小陀螺糖" },
  pumpkin: { hp: 9, armor: 5, speed: 0.36, reward: 2, name: "南瓜灯怪", becomes: "南瓜派" },
  balloon: { hp: 7, armor: 0, speed: 0.52, flying: true, reward: 2, name: "气球怪", becomes: "彩色气球" },
  box: { hp: 12, armor: 12, speed: 0.26, reward: 3, name: "纸箱怪", becomes: "礼物盒" },
  jelly: { hp: 10, armor: 0, speed: 0.4, splits: 2, reward: 2, name: "果冻怪", becomes: "果冻布丁" },
  hopper: { hp: 9, armor: 2, speed: 0.5, jumps: true, reward: 2, name: "跳跳怪", becomes: "跳跳糖" },
  bossDoodle: { hp: 70, armor: 4, speed: 0.2, reward: 10, boss: true, name: "大涂涂王", becomes: "一大丛向日葵" },
  bossCotton: { hp: 95, armor: 6, speed: 0.19, reward: 10, boss: true, name: "棉花糖巨人", becomes: "云朵棉花糖" },
  bossPumpkin: { hp: 120, armor: 8, speed: 0.18, reward: 12, boss: true, name: "南瓜灯校长", becomes: "南瓜马车" },
  bossCarousel: { hp: 145, armor: 8, speed: 0.22, reward: 12, boss: true, name: "旋转木马怪", becomes: "旋转木马" },
  bossGear: { hp: 170, armor: 12, speed: 0.18, reward: 14, boss: true, name: "齿轮怪王", becomes: "八音盒" },
  bossCloud: { hp: 190, armor: 10, speed: 0.2, reward: 14, boss: true, name: "棉花云王", becomes: "一朵大云" },
  bossFilm: { hp: 215, armor: 14, speed: 0.19, reward: 16, boss: true, name: "胶片怪王", becomes: "动画短片" },
  bossRainbow: { hp: 250, armor: 16, speed: 0.18, reward: 20, boss: true, name: "彩虹大怪", becomes: "一整道彩虹" },
};

/** 每种小怪物的身体颜色(粉彩系,画布与图例共用)。 */
export const MONSTER_COLOR: Record<MonsterKind, string> = {
  doodle: "#8fd3a8",
  cotton: "#ffd7e6",
  spinner: "#ffd08a",
  pumpkin: "#ffb26b",
  balloon: "#a9d6ff",
  box: "#d8b98c",
  jelly: "#c6a8ff",
  hopper: "#9be0d8",
  bossDoodle: "#5fb98a",
  bossCotton: "#ff9ec4",
  bossPumpkin: "#f59243",
  bossCarousel: "#7fb7f0",
  bossGear: "#9d8fd6",
  bossCloud: "#bcd4ff",
  bossFilm: "#8fa3b8",
  bossRainbow: "#e07ac4",
};

/** 小怪物在按钮 / 图例上的表情图标。 */
export const MONSTER_EMOJI: Record<MonsterKind, string> = {
  doodle: "🟩",
  cotton: "🩷",
  spinner: "🌀",
  pumpkin: "🎃",
  balloon: "🎈",
  box: "📦",
  jelly: "🍇",
  hopper: "🦘",
  bossDoodle: "👑",
  bossCotton: "👑",
  bossPumpkin: "👑",
  bossCarousel: "👑",
  bossGear: "👑",
  bossCloud: "👑",
  bossFilm: "👑",
  bossRainbow: "👑",
};

/** 被颜料糊花之后冒出来的小东西(全是甜的、香的、好看的)。 */
export const POP_EMOJI: Record<MonsterKind, string> = {
  doodle: "🌼",
  cotton: "🍬",
  spinner: "🍥",
  pumpkin: "🥧",
  balloon: "🎈",
  box: "🎁",
  jelly: "🍮",
  hopper: "🍭",
  bossDoodle: "🌻",
  bossCotton: "☁️",
  bossPumpkin: "🎠",
  bossCarousel: "🎠",
  bossGear: "🎶",
  bossCloud: "☁️",
  bossFilm: "🎬",
  bossRainbow: "🌈",
};

/** 建筑在按钮上的表情图标。 */
export const TOWER_EMOJI: Record<TowerKind, string> = {
  wall: "🧱",
  jar: "🎨",
  pop: "🫧",
  boom: "🍿",
  frost: "🧊",
  beam: "🌈",
};

/** 普通小怪物名单(波次生成器只从这里挑)。 */
export const NORMAL_KINDS: MonsterKind[] = [
  "doodle",
  "cotton",
  "spinner",
  "pumpkin",
  "balloon",
  "box",
  "jelly",
  "hopper",
];

/** 八个章节各自的大怪,顺序与 CHAPTERS 一一对应。 */
export const CHAPTER_BOSSES: MonsterKind[] = [
  "bossDoodle",
  "bossCotton",
  "bossPumpkin",
  "bossCarousel",
  "bossGear",
  "bossCloud",
  "bossFilm",
  "bossRainbow",
];

/**
 * 小怪物血量随关数缓慢变厚。
 * 大怪不吃这个加成 —— 它们本来就一章比一章壮,再叠一层会直接变成算不过来的死局。
 */
export function monsterHp(kind: MonsterKind, levelIdx: number): number {
  const spec = MONSTER_INFO[kind];
  if (spec.boss) return spec.hp;
  return spec.hp + Math.floor(Math.max(0, levelIdx) / 16);
}

/** 外壳同理,加得比血量还慢。 */
export function monsterArmor(kind: MonsterKind, levelIdx: number): number {
  const spec = MONSTER_INFO[kind];
  if (spec.armor <= 0 || spec.boss) return spec.armor;
  return spec.armor + Math.floor(Math.max(0, levelIdx) / 48);
}

/** 波次生成器给每种小怪物估的「难缠分」,用来把一关的难度预算花出去。 */
export const MONSTER_THREAT: Record<MonsterKind, number> = {
  doodle: 3,
  cotton: 5,
  spinner: 5,
  pumpkin: 6,
  balloon: 6,
  box: 9,
  jelly: 7,
  hopper: 6,
  bossDoodle: 40,
  bossCotton: 44,
  bossPumpkin: 48,
  bossCarousel: 52,
  bossGear: 56,
  bossCloud: 60,
  bossFilm: 64,
  bossRainbow: 70,
};

/* ------------------------------------------------------------------ */
/* 战斗结算                                                            */
/* ------------------------------------------------------------------ */

export type ProjectileKind = "paint" | "bubble" | "ice" | "beam";

/** 泡泡炮和冰沙台都够不着天上的气球怪;主角的颜料弹和彩虹灯塔什么都能糊到。 */
export function canHit(proj: ProjectileKind, flying: boolean): boolean {
  if (!flying) return true;
  return proj === "paint" || proj === "beam";
}

export interface HitResult {
  hp: number;
  armor: number;
  /** 这一下正好把外壳糊花了 */
  shellOff: boolean;
  /** 这一下让它变成花花了 */
  popped: boolean;
}

/** 颜料先糊外壳,壳花了才染到本体。 */
export function applyHit(target: { hp: number; armor: number }, dmg: number): HitResult {
  let { hp, armor } = target;
  const hadArmor = armor > 0;
  const used = Math.min(armor, Math.max(0, dmg));
  armor -= used;
  hp -= Math.max(0, dmg) - used;
  return { hp, armor, shellOff: hadArmor && armor <= 0, popped: hp <= 0 };
}

/** 冰沙的减速倍率与持续时间。 */
export const FROST_SLOW = 0.55;
export const FROST_SECONDS = 2.4;

/** 现在这只小怪物走多快(冰沙没化就慢吞吞)。 */
export function monsterSpeed(base: number, frostLeft: number): number {
  return frostLeft > 0 ? base * FROST_SLOW : base;
}

/** 啃建筑的节奏:大怪啃得又快又猛,普通小怪物慢慢磨。 */
export const CHEW_DMG = 2;
export const CHEW_EVERY = 0.8;
export const BOSS_CHEW_DMG = 7;
export const BOSS_CHEW_EVERY = 0.7;

export function chewDamage(boss: boolean): number {
  return boss ? BOSS_CHEW_DMG : CHEW_DMG;
}

export function chewInterval(boss: boolean): number {
  return boss ? BOSS_CHEW_EVERY : CHEW_EVERY;
}

/** 小怪物走到建筑跟前就停下来啃:身位差在这个范围内算「贴上了」。 */
export const CHEW_REACH = 0.45;

export function reachesTower(monsterX: number, towerCol: number): boolean {
  return monsterX <= colX(towerCol) + CHEW_REACH;
}

/** 爆米花桶波及范围里的目标(只管地面的,天上的够不着)。 */
export function blastTargets<T extends { x: number; lane: number; flying: boolean }>(
  list: readonly T[],
  col: number,
  lane: number,
  range: number
): T[] {
  const cx = colX(col);
  return list.filter((m) => !m.flying && m.lane === lane && Math.abs(m.x - cx) <= range);
}

/** 果冻怪被糊花后蹦出来的小家伙。 */
export function splitChildren(kind: MonsterKind): MonsterKind[] {
  const n = MONSTER_INFO[kind].splits ?? 0;
  return new Array<MonsterKind>(n).fill("doodle");
}

/** 跳跳怪只肯蹦一次,而且只蹦地面建筑。 */
export function willJump(kind: MonsterKind, alreadyJumped: boolean): boolean {
  return !!MONSTER_INFO[kind].jumps && !alreadyJumped;
}

/* ------------------------------------------------------------------ */
/* 主角:亲手甩颜料弹                                                   */
/* ------------------------------------------------------------------ */

export const HERO_BASE_DAMAGE = 3;
export const HERO_BASE_RELOAD = 0.55;
export const HERO_BASE_SPEED = 3.4;
export const HERO_BULLET_SPEED = 9;

/* ------------------------------------------------------------------ */
/* 颜料经济与三条科技线                                                 */
/* ------------------------------------------------------------------ */

export type TechLine = "paint" | "tower" | "hero";

export const TECH_LINES: TechLine[] = ["paint", "tower", "hero"];

export const TECH_MAX = 5;

export const TECH_INFO: Record<TechLine, { name: string; emoji: string; desc: string }> = {
  paint: { name: "颜料线", emoji: "🎨", desc: "颜料攒得更快,罐子也装得更多" },
  tower: { name: "炮台线", emoji: "🫧", desc: "所有炮台的颜料打得更浓" },
  hero: { name: "主角线", emoji: "🏃", desc: "自己跑得更快、甩得更快更狠" },
};

const TECH_BASE: Record<TechLine, number> = { paint: 6, tower: 7, hero: 6 };
const TECH_STEP: Record<TechLine, number> = { paint: 3, tower: 4, hero: 3 };

/** 把某条科技线从 level 级升到 level+1 级要花多少颜料;满级返回 Infinity。 */
export function techCost(line: TechLine, level: number): number {
  if (level >= TECH_MAX) return Number.POSITIVE_INFINITY;
  return TECH_BASE[line] + Math.max(0, level) * TECH_STEP[line];
}

export type TechState = Record<TechLine, number>;

export function emptyTech(): TechState {
  return { paint: 0, tower: 0, hero: 0 };
}

/** 自然攒颜料的间隔(秒):颜料线越高越快。 */
export const PASSIVE_PAINT_EVERY = 5;

export function paintInterval(paintTech: number): number {
  return PASSIVE_PAINT_EVERY / (1 + 0.22 * Math.max(0, paintTech));
}

/** 颜料罐的产出间隔(秒)。 */
export function jarInterval(paintTech: number): number {
  const every = TOWER_INFO.jar.produceEvery ?? 7;
  return every / (1 + 0.15 * Math.max(0, paintTech));
}

/** 颜料上限。 */
export function paintCap(paintTech: number): number {
  return 24 + 8 * Math.max(0, paintTech);
}

export function clampPaint(value: number, cap: number): number {
  return clamp(Math.round(value), 0, cap);
}

/** 炮台线给所有自动炮台的伤害倍率。 */
export function towerDamageMult(towerTech: number): number {
  return 1 + 0.15 * Math.max(0, towerTech);
}

export function towerDamage(kind: TowerKind, towerTech: number): number {
  const dmg = TOWER_INFO[kind].dmg ?? 0;
  return dmg * towerDamageMult(towerTech);
}

export function blastDamage(towerTech: number): number {
  return (TOWER_INFO.boom.blast?.dmg ?? 0) * towerDamageMult(towerTech);
}

/** 主角线:颜料弹更狠、装填更快、跑得更快。 */
export function heroDamage(heroTech: number): number {
  return HERO_BASE_DAMAGE + Math.max(0, heroTech) * 0.6;
}

export function heroReload(heroTech: number): number {
  return HERO_BASE_RELOAD * (1 - 0.07 * Math.max(0, heroTech));
}

export function heroSpeed(heroTech: number): number {
  return HERO_BASE_SPEED * (1 + 0.08 * Math.max(0, heroTech));
}

/* ------------------------------------------------------------------ */
/* 波次节奏                                                            */
/* ------------------------------------------------------------------ */

/** 两波之间的备战时间(秒):专门留给「摆建筑 + 升科技」。 */
export const INTERMISSION_SECONDS = 8;

/** 备战时颜料攒得快一点,好让人真的有东西可买。 */
export const INTERMISSION_PAINT_BOOST = 1.6;

export interface Spawn {
  /** 相对本波开始的秒数 */
  time: number;
  lane: number;
  kind: MonsterKind;
}

export interface WaveDef {
  spawns: Spawn[];
  /** 这一波最后一只出场后还要留的收尾时间 */
  tail: number;
}

/** 一波从开始到最后一只出场要多久。 */
export function waveSpawnSpan(wave: WaveDef): number {
  return wave.spawns.reduce((m, s) => Math.max(m, s.time), 0);
}

/* ------------------------------------------------------------------ */
/* 评星与文案                                                          */
/* ------------------------------------------------------------------ */

/** 一颗颜料都没被抢走就是三星,被抢一罐两星,再多一星(照样过关)。 */
export function campaignStars(heartsLeft: number, homeHp: number): 1 | 2 | 3 {
  if (heartsLeft >= homeHp) return 3;
  if (heartsLeft >= homeHp - 1) return 2;
  return 1;
}

/** 秒数格式化成 0:08 这样的钟点。 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 过关时的一句夸奖:说清楚这次好在哪里、下次可以往哪儿使劲。 */
export function winLine(heartsLeft: number, homeHp: number, popped: number): string {
  if (heartsLeft >= homeHp) {
    return `一罐颜料都没丢!${popped} 只小怪物全变成花花啦,路障和炮台摆得太合适了。`;
  }
  if (heartsLeft >= homeHp - 1) {
    return `守住啦!只被抢走一罐颜料,下次在漏掉的那条道上早点补一堵棉花墙就是三星。`;
  }
  return `守住啦!这次有点惊险,下一次先把颜料罐架起来,钱多了炮台才跟得上。`;
}

/** 没守住时的鼓励:只讲下一步怎么做,不说一句丧气话。 */
export function loseLine(waveReached: number, waveTotal: number, weakLane: number): string {
  const lane = weakLane >= 0 ? `第 ${weakLane + 1} 条道` : "中间那条道";
  if (waveReached <= 1) {
    return `第一波就有点急啦,开局先摆两个颜料罐再架炮台,钱够了后面就轻松。再来一次!`;
  }
  if (waveReached >= waveTotal) {
    return `就差最后一波!把${lane}的棉花墙补厚一点,主角守在那条道上,这关就是你的了。`;
  }
  return `已经挡到第 ${waveReached} 波啦!${lane}漏得最多,下一次先在那儿加墙加炮。`;
}

/** 无尽模式结算。 */
export function endlessLine(reached: number, best: number): string {
  if (reached >= best && reached > 0) return `第 ${reached} 波!这是你的新纪录,厉害!`;
  if (reached <= 0) return "刚热身呢,先把颜料罐摆够再往上冲,下一局一定更远!";
  return `挡住了 ${reached} 波,离最好成绩第 ${best} 波还差一点点,再来!`;
}

/** 双人合作结算。 */
export function coopLine(waves: number, target: number, popped: number): string {
  if (waves >= target) return `两个人一起把 ${target} 波全挡下来啦,${popped} 只小怪物变成了花花!`;
  return `一起挡到第 ${waves} 波!下一次一人守两条道、中间那条轮着补,肯定更远。`;
}

export type VersusSide = "defender" | "commander";

/** 非对称对战:守家的活到时间就赢,指挥官把颜料抢光就赢。 */
export function versusWinner(heartsLeft: number, timeLeft: number): VersusSide | null {
  if (heartsLeft <= 0) return "commander";
  if (timeLeft <= 0) return "defender";
  return null;
}

export function versusLine(side: VersusSide, heartsLeft: number, seconds: number): string {
  if (side === "defender") {
    return `朵朵撑满了 ${formatClock(seconds)},还剩 ${heartsLeft} 罐颜料,守家成功!`;
  }
  return `星星在 ${formatClock(seconds)} 里把颜料全搬走啦,指挥得真妙!`;
}

/* ------------------------------------------------------------------ */
/* 非对称对战:指挥官的出兵能量                                          */
/* ------------------------------------------------------------------ */

/** 指挥官每秒回多少能量(随时间缓慢加速,免得后期没兵可派)。 */
export const COMMANDER_ENERGY_BASE = 1.5;
export const COMMANDER_ENERGY_CAP = 26;

export function commanderRegen(elapsed: number): number {
  return COMMANDER_ENERGY_BASE * (1 + Math.min(1.2, Math.max(0, elapsed) / 60));
}

/** 指挥官派一只小怪物要花多少能量:难缠分越高越贵。 */
export function commanderCost(kind: MonsterKind): number {
  return Math.max(2, Math.round(MONSTER_THREAT[kind] * 0.9));
}

export function canCommand(energy: number, kind: MonsterKind): boolean {
  return energy >= commanderCost(kind);
}

/** 指挥官手里能派的兵:一开始只有两种,越打越多。 */
export function commanderDeck(elapsed: number): MonsterKind[] {
  const deck: MonsterKind[] = ["doodle", "spinner"];
  if (elapsed >= 15) deck.push("cotton");
  if (elapsed >= 30) deck.push("pumpkin");
  if (elapsed >= 45) deck.push("balloon");
  if (elapsed >= 60) deck.push("jelly");
  if (elapsed >= 80) deck.push("hopper");
  if (elapsed >= 100) deck.push("box");
  return deck;
}
