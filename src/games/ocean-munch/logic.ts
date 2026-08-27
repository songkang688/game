// 海底大胃王 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 1.0 的 99 关九大海域战役:浅浅海湾 → 珊瑚花园 → 海带森林 → 沉船湾 → 深深海沟
// → 冰冰海域 → 火山温泉 → 午夜深渊 → 珍珠龙宫。
// 每片海域 11 关(8 关手写 + 3 关生成),都有专属配色、障碍组合和区域 BOSS。
//
// 1.1 在末尾续了三片新海域共 89 关(前 99 关一字不动):
// 洋流海峡(30)→ 荧光藻湾(30)→ 万丈压渊(29),合计 188 关。
// 新机制:洋流(整片海周期换向)、含毒生物、共生小鱼、深渊压力(体型上限)。

export const START_RADIUS = 14;

/* ---------------- 海域分区 ---------------- */

export type ZoneId =
  | "shallow"
  | "coral"
  | "kelp"
  | "wreck"
  | "deep"
  | "ice"
  | "volcano"
  | "abyss"
  | "pearl"
  | "strait"
  | "bloom"
  | "trench";

export const ZONE_ORDER: ZoneId[] = [
  "shallow",
  "coral",
  "kelp",
  "wreck",
  "deep",
  "ice",
  "volcano",
  "abyss",
  "pearl",
  "strait",
  "bloom",
  "trench",
];

/** 1.0 的九片海域(1.1 的三片新海域不参与老生成器)。 */
export type LegacyZoneId =
  | "shallow"
  | "coral"
  | "kelp"
  | "wreck"
  | "deep"
  | "ice"
  | "volcano"
  | "abyss"
  | "pearl";

/** 1.0 的九片海域,每片 11 关:8 关手写 + 3 关生成。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;
export const LEGACY_ZONES = 9;
export const LEGACY_LEVELS = LEGACY_ZONES * LEVELS_PER_THEME;

/** 1.1 新三片海域的关数(前 99 关的切分一格都没动)。 */
export const NEW_ZONE_SIZES = [30, 30, 29] as const;

/** 每章关数:前九章各 11 关,后三章 30/30/29。 */
export const THEME_SIZES: number[] = [
  ...Array.from({ length: LEGACY_ZONES }, () => LEVELS_PER_THEME),
  ...NEW_ZONE_SIZES,
];

export const TOTAL_LEVELS = THEME_SIZES.reduce((a, b) => a + b, 0);

/** 章节 ci(0 起)有几关。 */
export function themeSize(ci: number): number {
  return THEME_SIZES[ci] ?? 0;
}

/** 章节 ci(0 起)的第一关下标。 */
export function themeStart(ci: number): number {
  let s = 0;
  for (let i = 0; i < ci && i < THEME_SIZES.length; i++) s += THEME_SIZES[i];
  return s;
}

/** idx(0 起)关属于第几章。 */
export function themeIndexOf(idx: number): number {
  let s = 0;
  for (let ci = 0; ci < THEME_SIZES.length; ci++) {
    s += THEME_SIZES[ci];
    if (idx < s) return ci;
  }
  return THEME_SIZES.length - 1;
}

export type HazardKind =
  | "jelly" // 水母:碰到会痛
  | "puffer" // 鼓鼓鱼:鼓起来带刺
  | "current" // 水流:横向推着你跑
  | "urchin" // 刺刺球:慢慢漂的刺球
  | "bubbleWall" // 气泡墙:整面墙,只能从缺口穿过
  | "squid" // 墨墨鱼:靠近就喷墨遮眼
  | "vortex" // 涡流:把你往中心吸
  | "eel" // 电电草:周期通电,碰到会麻
  | "drift" // 洋流:整片海按周期换向,推着所有人走(1.1)
  | "toxin" // 毒藻鱼:看着能吃,吃下去会缩小发麻(1.1)
  | "pressure"; // 深渊压力:体型有上限,长不过头(1.1)

export type BossKind =
  | "crab"
  | "octopus"
  | "turtle"
  | "sword"
  | "angler"
  | "whale"
  | "lobster"
  | "shark"
  | "dragon"
  | "ray"
  | "anemone"
  | "clam";

export interface ZoneStyle {
  name: string;
  emoji: string;
  top: string;
  bottom: string;
  accent: string;
  /** 本海域 NPC 游速倍率(越深越湍急)。 */
  speedMult: number;
  /** 漆黑海域:只能看清自己身边一圈。 */
  dark?: boolean;
  /** 本海域会出现的障碍种类(生成关卡从这里选)。 */
  palette: HazardKind[];
  boss: BossKind;
  blurb: string;
}

export const ZONE_STYLE: Record<ZoneId, ZoneStyle> = {
  shallow: {
    name: "浅浅海湾", emoji: "🏖", top: "#c9edff", bottom: "#8fd0f0", accent: "#2a6a9a",
    speedMult: 1, palette: ["jelly", "puffer", "current", "squid"], boss: "crab",
    blurb: "阳光沙滩边的新手海湾,水母和鼓鼓鱼慢悠悠",
  },
  coral: {
    name: "珊瑚花园", emoji: "🪸", top: "#ffe3ee", bottom: "#c9b6f2", accent: "#c94a72",
    speedMult: 1, palette: ["urchin", "bubbleWall", "squid", "jelly"], boss: "octopus",
    blurb: "粉紫珊瑚丛里藏着刺刺球和会喷墨的墨墨鱼",
  },
  kelp: {
    name: "海带森林", emoji: "🌿", top: "#d8f2c9", bottom: "#7ab88a", accent: "#3a7a4a",
    speedMult: 0.96, palette: ["current", "squid", "puffer", "jelly", "urchin"], boss: "turtle",
    blurb: "绿油油的海带荡来荡去,水流在林间打转",
  },
  wreck: {
    name: "沉船湾", emoji: "⚓", top: "#d8cbb0", bottom: "#8a7a5e", accent: "#6a4a2a",
    speedMult: 1.04, palette: ["urchin", "vortex", "bubbleWall", "squid"], boss: "sword",
    blurb: "老沉船周围全是涡流,宝箱边守着刺刺球",
  },
  deep: {
    name: "深深海沟", emoji: "🌊", top: "#9fb8e8", bottom: "#5f6ea8", accent: "#3a4a8e",
    speedMult: 1.06, palette: ["vortex", "eel", "squid", "jelly"], boss: "angler",
    blurb: "蓝黑海沟里电电草噼啪作响,大鱼越来越多",
  },
  ice: {
    name: "冰冰海域", emoji: "🧊", top: "#e8f4ff", bottom: "#a8cbe8", accent: "#4a7ab8",
    speedMult: 1.12, palette: ["bubbleWall", "current", "vortex", "urchin"], boss: "whale",
    blurb: "浮冰下水流又急又滑,大家都游得飞快",
  },
  volcano: {
    name: "火山温泉", emoji: "🌋", top: "#ffd8c2", bottom: "#c95a4a", accent: "#8e2a1a",
    speedMult: 1.16, palette: ["eel", "puffer", "vortex", "current"], boss: "lobster",
    blurb: "咕嘟咕嘟的热泉眼,电流和热浪一起翻滚",
  },
  abyss: {
    name: "午夜深渊", emoji: "🌑", top: "#4a4a6e", bottom: "#1e1e34", accent: "#9a8ae8",
    speedMult: 1.1, dark: true, palette: ["eel", "vortex", "squid", "urchin", "jelly"], boss: "shark",
    blurb: "伸手不见鳍的黑海,只能看清自己身边一圈",
  },
  pearl: {
    name: "珍珠龙宫", emoji: "🏯", top: "#ffe9f8", bottom: "#b89ae0", accent: "#8a3a9a",
    speedMult: 1.2,
    palette: ["jelly", "puffer", "urchin", "bubbleWall", "eel", "vortex", "squid", "current"],
    boss: "dragon",
    blurb: "亮晶晶的龙宫大殿,所有障碍列队欢迎最终决战",
  },
  // ---- 1.1 新增三片海域 ----
  strait: {
    name: "洋流海峡", emoji: "🌀", top: "#cfeaf5", bottom: "#5f96bc", accent: "#1f6a8a",
    speedMult: 1.14,
    palette: ["drift", "current", "urchin", "squid", "bubbleWall", "puffer"],
    boss: "ray",
    blurb: "整片海峡的洋流会定时换向,顺流省力逆流费劲",
  },
  bloom: {
    name: "荧光藻湾", emoji: "✨", top: "#e6ffe9", bottom: "#5aa88a", accent: "#1f7a5a",
    speedMult: 1.1,
    palette: ["toxin", "jelly", "eel", "squid", "vortex", "urchin"],
    boss: "anemone",
    blurb: "亮闪闪的藻丛里混着毒藻鱼,好看的不一定能吃",
  },
  trench: {
    name: "万丈压渊", emoji: "🕳", top: "#b9c4e0", bottom: "#2e3450", accent: "#3f4f8e",
    speedMult: 1.24,
    palette: ["pressure", "drift", "toxin", "vortex", "eel", "bubbleWall"],
    boss: "clam",
    blurb: "越潜越挤的深渊,水压把你的体型死死摁住",
  },
};

/* ---------------- BOSS ---------------- */

export interface BossSpec {
  name: string;
  hp: number;
  r: number;
  /** 冲刺间隔(秒) */
  dashCd: number;
  /** 冲刺速度(像素/秒) */
  dashSpeed: number;
  /** 会喷墨遮眼 */
  inks: boolean;
  /** 会周期召唤小怪 */
  summons?: "jelly" | "urchin";
  /** 会把玩家往自己嘴边吸 */
  pulls?: boolean;
  /** 精神条越少冲刺越快 */
  enrages?: boolean;
  /** 1.1:会掀起洋流,把整片海的水推着换向 */
  drifts?: boolean;
  /** 1.1:会吐毒云,碰到会缩小发麻(不掉心) */
  poisons?: boolean;
  /** 1.1:会加压,把你的体型上限一点点压低 */
  crushes?: boolean;
}

export const BOSS_INFO: Record<BossKind, BossSpec> = {
  crab: { name: "钳钳蟹", hp: 4, r: 52, dashCd: 2.6, dashSpeed: 150, inks: false },
  octopus: { name: "墨墨大王", hp: 5, r: 58, dashCd: 2.4, dashSpeed: 140, inks: true },
  turtle: { name: "龟龟长老", hp: 5, r: 60, dashCd: 3.0, dashSpeed: 125, inks: false, summons: "jelly" },
  sword: { name: "剑剑鱼", hp: 6, r: 54, dashCd: 1.5, dashSpeed: 230, inks: false },
  angler: { name: "灯灯鱼", hp: 6, r: 56, dashCd: 1.8, dashSpeed: 185, inks: false },
  whale: { name: "鲸鲸大王", hp: 7, r: 68, dashCd: 2.2, dashSpeed: 165, inks: false, pulls: true },
  lobster: { name: "火火龙虾", hp: 7, r: 58, dashCd: 2.0, dashSpeed: 175, inks: false, summons: "urchin" },
  shark: { name: "鲨鲨霸王", hp: 8, r: 62, dashCd: 1.7, dashSpeed: 190, inks: false, enrages: true },
  dragon: { name: "海龙王", hp: 9, r: 72, dashCd: 1.9, dashSpeed: 180, inks: true, pulls: true },
  // ---- 1.1 新增三位海域大王 ----
  ray: { name: "旋旋鳐", hp: 9, r: 66, dashCd: 2.1, dashSpeed: 195, inks: false, drifts: true },
  anemone: {
    name: "荧荧海葵王", hp: 10, r: 70, dashCd: 2.4, dashSpeed: 170, inks: false,
    summons: "jelly", poisons: true,
  },
  clam: {
    name: "咔咔巨蚌", hp: 11, r: 76, dashCd: 1.8, dashSpeed: 200, inks: true,
    pulls: true, enrages: true, crushes: true,
  },
};

/** 长到 BOSS 的六成大就可以咬它了。 */
export function bossBiteReady(playerR: number, bossR: number): boolean {
  return playerR >= bossR * 0.62;
}

/* ---------------- 关卡 ---------------- */

export interface LevelDef {
  name: string;
  zone: ZoneId;
  /** 长到这个半径就算达成目标(BOSS 关达成后进入 BOSS 战) */
  targetR: number;
  hazards: HazardKind[];
  boss?: BossKind;
  /** 大鱼出现概率加成 */
  bigFishBias: number;
  /** 本关独特机制标记(测试用,全战役唯一) */
  feature: string;
  /** 生成器产出的关卡 */
  gen?: boolean;
  hint: string;
  /** 1.1:本关会漂来共生小鱼泡泡,捡到就有小伙伴帮你吃 */
  buddy?: boolean;
  /**
   * 1.1:深渊压力下体型上限相对目标的余量(像素)。
   * 只有 hazards 含 "pressure" 的关卡才用得上,越小压得越狠。
   */
  pressureSlack?: number;
}

/** idx(0 起)关属于哪片海域。 */
export function themeOfLevel(idx: number): ZoneId {
  return ZONE_ORDER[themeIndexOf(idx)];
}

/** 章节 ci(0 起)包含的关卡下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  const base = themeStart(ci);
  for (let i = 0; i < themeSize(ci); i++) out.push(base + i);
  return out;
}

/* ---- 生成关卡:每章 3 关,障碍组合不与本章任何手写关重复 ---- */

/** 1.0 九片海域的生成关模板(1.1 新海域走 buildDeepZone 的枚举器)。 */
const GEN_HAZARDS: Record<(typeof ZONE_ORDER)[number] & LegacyZoneId, HazardKind[][]> = {
  shallow: [["puffer", "squid"], ["current", "squid", "jelly"], ["puffer", "current"]],
  coral: [["urchin", "jelly"], ["bubbleWall", "squid"], ["urchin", "squid", "jelly"]],
  kelp: [["puffer", "urchin"], ["squid", "jelly"], ["current", "puffer", "urchin"]],
  wreck: [["squid", "urchin"], ["vortex", "squid"], ["bubbleWall", "vortex", "urchin"]],
  deep: [["squid", "jelly"], ["vortex", "squid", "jelly"], ["eel", "squid", "jelly"]],
  ice: [["bubbleWall", "current"], ["urchin", "vortex"], ["bubbleWall", "current", "urchin"]],
  volcano: [["eel", "vortex", "puffer"], ["current", "vortex"], ["eel", "current", "puffer"]],
  abyss: [["jelly", "urchin"], ["vortex", "eel", "jelly"], ["squid", "urchin", "jelly"]],
  pearl: [["current", "squid", "jelly"], ["puffer", "vortex", "urchin"], ["eel", "bubbleWall", "urchin", "current"]],
};

function genLevel(zoneIdx: number, sub: number): LevelDef {
  const zone = ZONE_ORDER[zoneIdx] as LegacyZoneId;
  const st = ZONE_STYLE[zone];
  const hazards = GEN_HAZARDS[zone][sub];
  return {
    name: `${st.name}遭遇战 ${sub + 1} 号`,
    zone,
    targetR: 32 + zoneIdx * 3 + sub,
    hazards,
    bigFishBias: Math.min(0.2, 0.05 + zoneIdx * 0.018 + sub * 0.01),
    feature: `${st.name}遭遇战${sub + 1}号`,
    gen: true,
    hint: `${st.name}的杂鱼小队突然围过来!障碍:${hazards.length} 种混着来`,
  };
}

/** 一章 = 6 关手写 + 3 关生成 + 手写挑战关 + 手写 BOSS 关。 */
function buildZone(zoneIdx: number, hand: LevelDef[]): LevelDef[] {
  if (hand.length !== HANDMADE_PER_THEME) {
    throw new Error(`zone ${zoneIdx} 手写关数量应为 ${HANDMADE_PER_THEME}`);
  }
  return [
    ...hand.slice(0, 6),
    genLevel(zoneIdx, 0),
    genLevel(zoneIdx, 1),
    genLevel(zoneIdx, 2),
    hand[6],
    hand[7],
  ];
}

/* ---- 第 1 章 · 浅浅海湾 ---- */
const shallowHand: LevelDef[] = [
  { name: "第一口小鱼", zone: "shallow", targetR: 28, hazards: [], bigFishBias: 0, feature: "入门吃鱼", hint: "移动手指,吃比你小的鱼,躲开大鱼!" },
  { name: "水母摇摇湾", zone: "shallow", targetR: 29, hazards: ["jelly"], bigFishBias: 0.02, feature: "水母登场", hint: "飘来飘去的水母碰到会痛痛!" },
  { name: "鼓鼓鱼礁石", zone: "shallow", targetR: 30, hazards: ["puffer"], bigFishBias: 0.03, feature: "鼓鼓鱼登场", hint: "鼓起来的鼓鼓鱼有刺,等它瘪了再吃!" },
  { name: "暗涌初现", zone: "shallow", targetR: 30, hazards: ["current"], bigFishBias: 0.04, feature: "水流带登场", hint: "有的水层会推着你跑,顶着游!" },
  { name: "墨墨鱼幼儿园", zone: "shallow", targetR: 31, hazards: ["squid"], bigFishBias: 0.04, feature: "墨墨鱼登场", hint: "小墨墨鱼被追急了会喷墨遮眼!" },
  { name: "水母漂流记", zone: "shallow", targetR: 32, hazards: ["jelly", "current"], bigFishBias: 0.05, feature: "水母暗涌双拼", hint: "水流会把你推进水母堆,小心!" },
  { name: "海湾大杂烩", zone: "shallow", targetR: 33, hazards: ["jelly", "puffer", "current"], bigFishBias: 0.06, feature: "海湾三重奏", hint: "毕业考!海湾学过的全都一起来" },
  { name: "钳钳蟹老大", zone: "shallow", targetR: 32, hazards: ["jelly"], boss: "crab", bigFishBias: 0.05, feature: "海湾BOSS钳钳蟹", hint: "先吃小鱼长大,再咬钳钳蟹 4 口!" },
];

/* ---- 第 2 章 · 珊瑚花园 ---- */
const coralHand: LevelDef[] = [
  { name: "珊瑚迷宫", zone: "coral", targetR: 31, hazards: ["urchin"], bigFishBias: 0.05, feature: "刺刺球登场", hint: "紫色刺刺球千万别抱!" },
  { name: "泡泡帘子", zone: "coral", targetR: 32, hazards: ["bubbleWall"], bigFishBias: 0.05, feature: "气泡墙登场", hint: "整面泡泡墙挡路,找缺口钻过去!" },
  { name: "墨墨鱼群", zone: "coral", targetR: 33, hazards: ["squid", "jelly"], bigFishBias: 0.06, feature: "墨墨鱼群混游", hint: "墨墨鱼和水母混在一起游" },
  { name: "刺球泡泡阵", zone: "coral", targetR: 33, hazards: ["urchin", "bubbleWall"], bigFishBias: 0.06, feature: "刺球泡泡阵", hint: "钻泡泡墙缺口时别撞上刺刺球!" },
  { name: "浑水摸鱼", zone: "coral", targetR: 34, hazards: ["squid", "urchin"], bigFishBias: 0.07, feature: "浑水混战", hint: "墨云里藏着刺刺球,慢慢游" },
  { name: "珊瑚捉迷藏", zone: "coral", targetR: 35, hazards: ["bubbleWall", "jelly"], bigFishBias: 0.07, feature: "泡墙水母捉迷藏", hint: "水母爱躲在泡泡墙缺口边上!" },
  { name: "花园总动员", zone: "coral", targetR: 36, hazards: ["urchin", "bubbleWall", "squid", "jelly"], bigFishBias: 0.08, feature: "珊瑚全家福", hint: "珊瑚花园全体出动,毕业考!" },
  { name: "墨墨大王", zone: "coral", targetR: 35, hazards: ["squid"], boss: "octopus", bigFishBias: 0.07, feature: "珊瑚BOSS墨墨大王", hint: "墨墨大王会喷好大一团墨!咬它 5 口" },
];

/* ---- 第 3 章 · 海带森林 ---- */
const kelpHand: LevelDef[] = [
  { name: "海带荡秋千", zone: "kelp", targetR: 34, hazards: ["current"], bigFishBias: 0.07, feature: "海带双水流", hint: "海带林里两条水流对着吹!" },
  { name: "叶影喷墨手", zone: "kelp", targetR: 35, hazards: ["squid", "current"], bigFishBias: 0.08, feature: "叶影喷墨", hint: "墨墨鱼躲在叶子影里,水流一推就撞上" },
  { name: "鼓鼓鱼树屋", zone: "kelp", targetR: 36, hazards: ["puffer", "jelly"], bigFishBias: 0.08, feature: "鼓鼓水母树屋", hint: "鼓鼓鱼和水母在海带上安了家" },
  { name: "缠人水草", zone: "kelp", targetR: 36, hazards: ["current", "urchin"], bigFishBias: 0.09, feature: "水流刺球缠缠", hint: "水流把刺刺球吹得到处飘!" },
  { name: "森林迷路记", zone: "kelp", targetR: 37, hazards: ["squid", "puffer", "current"], bigFishBias: 0.09, feature: "森林三层浪", hint: "三种麻烦一起上,记住路别迷路" },
  { name: "水母灯笼节", zone: "kelp", targetR: 38, hazards: ["jelly", "current", "urchin"], bigFishBias: 0.1, feature: "水母灯笼阵", hint: "满林子水母像小灯笼,可别去摸!" },
  { name: "海带大迷宫", zone: "kelp", targetR: 39, hazards: ["current", "squid", "puffer", "jelly"], bigFishBias: 0.1, feature: "海带全障碍", hint: "森林毕业考!四种障碍一起来" },
  { name: "龟龟长老", zone: "kelp", targetR: 38, hazards: ["jelly"], boss: "turtle", bigFishBias: 0.09, feature: "海带BOSS龟龟长老", hint: "龟龟长老会召唤水母帮手!咬它 5 口" },
];

/* ---- 第 4 章 · 沉船湾 ---- */
const wreckHand: LevelDef[] = [
  { name: "沉船探险", zone: "wreck", targetR: 37, hazards: ["vortex"], bigFishBias: 0.1, feature: "涡流登场", hint: "蓝色涡流会把你吸过去,用力游开!" },
  { name: "船舱泡泡门", zone: "wreck", targetR: 38, hazards: ["bubbleWall", "vortex"], bigFishBias: 0.1, feature: "泡门涡流", hint: "钻泡泡门时别被涡流吸歪了!" },
  { name: "宝箱守卫", zone: "wreck", targetR: 39, hazards: ["urchin", "vortex"], bigFishBias: 0.11, feature: "刺球守宝箱", hint: "刺刺球绕着涡流转圈圈守宝箱" },
  { name: "墨墨鱼水手", zone: "wreck", targetR: 39, hazards: ["squid", "bubbleWall"], bigFishBias: 0.11, feature: "墨水手泡帘", hint: "墨墨鱼水手在泡泡帘后偷袭!" },
  { name: "漩涡走廊", zone: "wreck", targetR: 40, hazards: ["vortex", "urchin", "squid"], bigFishBias: 0.12, feature: "沉船三险", hint: "走廊里涡流一个接一个,稳住!" },
  { name: "甲板大扫除", zone: "wreck", targetR: 41, hazards: ["bubbleWall", "urchin"], bigFishBias: 0.12, feature: "甲板泡刺阵", hint: "泡泡墙夹着刺刺球,找准缺口冲!" },
  { name: "幽灵船夜航", zone: "wreck", targetR: 42, hazards: ["vortex", "bubbleWall", "squid", "urchin"], bigFishBias: 0.13, feature: "幽灵船全险", hint: "沉船湾毕业考!全部障碍一起来" },
  { name: "剑剑鱼船长", zone: "wreck", targetR: 41, hazards: ["vortex"], boss: "sword", bigFishBias: 0.12, feature: "沉船BOSS剑剑鱼", hint: "剑剑鱼冲刺快得像箭!躲开再咬 6 口" },
];

/* ---- 第 5 章 · 深深海沟 ---- */
const deepHand: LevelDef[] = [
  { name: "深沟入口", zone: "deep", targetR: 40, hazards: ["eel"], bigFishBias: 0.12, feature: "电电草登场", hint: "海草会周期通电,亮的时候别碰!" },
  { name: "电草小径", zone: "deep", targetR: 41, hazards: ["eel", "jelly"], bigFishBias: 0.13, feature: "电草配水母", hint: "电草缝里还飘着水母,看准再穿" },
  { name: "涡电交响曲", zone: "deep", targetR: 42, hazards: ["vortex", "eel"], bigFishBias: 0.13, feature: "涡电交响", hint: "涡流会把你往电草上吸!" },
  { name: "墨影深处", zone: "deep", targetR: 42, hazards: ["squid", "eel"], bigFishBias: 0.14, feature: "墨影带电", hint: "墨云一糊眼就看不见电草了" },
  { name: "双涡峡谷", zone: "deep", targetR: 43, hazards: ["vortex", "jelly"], bigFishBias: 0.14, feature: "双涡峡谷", hint: "两个涡流夹一条水母峡谷" },
  { name: "深渊夜巡", zone: "deep", targetR: 44, hazards: ["eel", "vortex", "squid"], bigFishBias: 0.15, feature: "深渊三重奏", hint: "电草+涡流+墨墨鱼,深呼吸再进!" },
  { name: "海沟大冒险", zone: "deep", targetR: 45, hazards: ["eel", "vortex", "squid", "jelly"], bigFishBias: 0.15, feature: "海沟全险阵", hint: "海沟毕业考!四险齐发" },
  { name: "灯灯鱼老大", zone: "deep", targetR: 44, hazards: ["jelly"], boss: "angler", bigFishBias: 0.14, feature: "深沟BOSS灯灯鱼", hint: "灯灯鱼冲刺特别快!躲开再反咬 6 口" },
];

/* ---- 第 6 章 · 冰冰海域 ---- */
const iceHand: LevelDef[] = [
  { name: "冰冰海湾", zone: "ice", targetR: 43, hazards: ["current"], bigFishBias: 0.14, feature: "寒流开场", hint: "冰海的水流又急又滑,大家都游得快!" },
  { name: "浮冰泡泡阵", zone: "ice", targetR: 44, hazards: ["bubbleWall", "urchin"], bigFishBias: 0.15, feature: "浮冰泡刺", hint: "泡泡墙冻得硬邦邦,刺球贴着墙漂" },
  { name: "寒流漩涡", zone: "ice", targetR: 45, hazards: ["vortex", "current"], bigFishBias: 0.15, feature: "寒流加漩涡", hint: "水流推着你,涡流吸着你,稳住!" },
  { name: "冰锥雨", zone: "ice", targetR: 45, hazards: ["urchin", "current"], bigFishBias: 0.16, feature: "冰锥刺球雨", hint: "刺刺球顺着寒流像下雨一样飘!" },
  { name: "冰帘迷宫", zone: "ice", targetR: 46, hazards: ["bubbleWall", "vortex"], bigFishBias: 0.16, feature: "冰帘涡流宫", hint: "泡泡冰帘后面就是涡流,钻洞要快" },
  { name: "极光滑冰场", zone: "ice", targetR: 47, hazards: ["current", "vortex", "urchin"], bigFishBias: 0.17, feature: "极光三险", hint: "在急流里躲刺球,像滑冰一样!" },
  { name: "冰海总动员", zone: "ice", targetR: 48, hazards: ["bubbleWall", "current", "vortex", "urchin"], bigFishBias: 0.17, feature: "冰海全障碍", hint: "冰海毕业考!全险齐上" },
  { name: "鲸鲸大王", zone: "ice", targetR: 47, hazards: ["current"], boss: "whale", bigFishBias: 0.16, feature: "冰海BOSS鲸鲸大王", hint: "鲸鲸大王会把你往嘴边吸!咬它 7 口" },
];

/* ---- 第 7 章 · 火山温泉 ---- */
const volcanoHand: LevelDef[] = [
  { name: "温泉初体验", zone: "volcano", targetR: 46, hazards: ["current", "puffer"], bigFishBias: 0.16, feature: "热流鼓鼓鱼", hint: "热流冲得飞快,鼓鼓鱼泡得圆滚滚" },
  { name: "冒泡火山口", zone: "volcano", targetR: 47, hazards: ["vortex", "puffer"], bigFishBias: 0.17, feature: "火山口涡流", hint: "火山口的涡流会把你吸向鼓鼓鱼!" },
  { name: "电鳗温泉", zone: "volcano", targetR: 48, hazards: ["eel", "current"], bigFishBias: 0.17, feature: "电鳗温泉", hint: "电草在热流里噼啪响,别碰亮的!" },
  { name: "岩浆间歇泉", zone: "volcano", targetR: 48, hazards: ["vortex", "eel"], bigFishBias: 0.18, feature: "间歇泉双险", hint: "涡流+电草,找准断电空档冲过去" },
  { name: "热浪滚滚", zone: "volcano", targetR: 49, hazards: ["current", "vortex", "puffer"], bigFishBias: 0.18, feature: "热浪三险", hint: "热浪推着鼓鼓鱼到处滚!" },
  { name: "火山电网", zone: "volcano", targetR: 50, hazards: ["eel", "puffer"], bigFishBias: 0.19, feature: "火山电网", hint: "电草排成网,鼓鼓鱼守网眼" },
  { name: "喷发倒计时", zone: "volcano", targetR: 51, hazards: ["eel", "vortex", "current", "puffer"], bigFishBias: 0.19, feature: "火山全险阵", hint: "火山毕业考!全险一起喷发" },
  { name: "火火龙虾", zone: "volcano", targetR: 50, hazards: ["eel"], boss: "lobster", bigFishBias: 0.18, feature: "火山BOSS火火龙虾", hint: "火火龙虾会召唤刺刺球!咬它 7 口" },
];

/* ---- 第 8 章 · 午夜深渊 ---- */
const abyssHand: LevelDef[] = [
  { name: "摸黑觅食", zone: "abyss", targetR: 49, hazards: ["jelly"], bigFishBias: 0.18, feature: "黑暗初探", hint: "深渊漆黑一片,只能看清身边一圈!" },
  { name: "深渊路灯", zone: "abyss", targetR: 50, hazards: ["eel", "squid"], bigFishBias: 0.19, feature: "黑暗电草", hint: "电草亮起来像路灯,可千万别碰" },
  { name: "无底漩涡", zone: "abyss", targetR: 51, hazards: ["vortex", "urchin"], bigFishBias: 0.19, feature: "黑暗漩涡", hint: "黑暗里的涡流最会偷袭!" },
  { name: "影子水母团", zone: "abyss", targetR: 51, hazards: ["jelly", "squid", "eel"], bigFishBias: 0.2, feature: "影子水母团", hint: "水母混着墨云,看清再下嘴" },
  { name: "刺球流星雨", zone: "abyss", targetR: 52, hazards: ["urchin", "eel"], bigFishBias: 0.2, feature: "黑暗流星雨", hint: "刺球从黑暗里飘出来像流星!" },
  { name: "漆黑三兄弟", zone: "abyss", targetR: 53, hazards: ["vortex", "squid", "jelly"], bigFishBias: 0.2, feature: "漆黑三兄弟", hint: "涡流墨鱼水母,黑暗三兄弟!" },
  { name: "深渊大巡游", zone: "abyss", targetR: 54, hazards: ["eel", "vortex", "squid", "urchin", "jelly"], bigFishBias: 0.2, feature: "深渊全险巡游", hint: "深渊毕业考!五险黑暗巡游" },
  { name: "鲨鲨霸王", zone: "abyss", targetR: 53, hazards: ["urchin"], boss: "shark", bigFishBias: 0.2, feature: "深渊BOSS鲨鲨霸王", hint: "鲨鲨霸王越受伤冲得越快!咬它 8 口" },
];

/* ---- 第 9 章 · 珍珠龙宫 ---- */
const pearlHand: LevelDef[] = [
  { name: "龙宫大门", zone: "pearl", targetR: 52, hazards: ["bubbleWall", "jelly"], bigFishBias: 0.19, feature: "龙宫开门", hint: "龙宫的泡泡大门后全是水母侍卫!" },
  { name: "珍珠回廊", zone: "pearl", targetR: 53, hazards: ["urchin", "vortex", "jelly"], bigFishBias: 0.2, feature: "珍珠回廊", hint: "回廊里珍珠会转,刺球也会转!" },
  { name: "电光舞池", zone: "pearl", targetR: 54, hazards: ["eel", "current"], bigFishBias: 0.2, feature: "电光舞池", hint: "电草跟着水流一起跳舞,别踩点!" },
  { name: "墨墨仪仗队", zone: "pearl", targetR: 54, hazards: ["squid", "puffer", "bubbleWall"], bigFishBias: 0.2, feature: "墨墨仪仗队", hint: "墨墨鱼和鼓鼓鱼排队守宫门" },
  { name: "龙宫花园", zone: "pearl", targetR: 55, hazards: ["jelly", "puffer", "urchin", "current"], bigFishBias: 0.2, feature: "龙宫花园", hint: "御花园里四种障碍串门" },
  { name: "漩涡王座厅", zone: "pearl", targetR: 56, hazards: ["vortex", "eel", "bubbleWall"], bigFishBias: 0.2, feature: "漩涡王座", hint: "王座边的涡流和电草最忠心!" },
  { name: "龙宫大阅兵", zone: "pearl", targetR: 57, hazards: ["jelly", "puffer", "urchin", "squid", "vortex", "eel"], bigFishBias: 0.2, feature: "龙宫全员阅兵", hint: "最终毕业考!六种障碍全员列队" },
  { name: "海龙王", zone: "pearl", targetR: 56, hazards: ["vortex"], boss: "dragon", bigFishBias: 0.2, feature: "最终BOSS海龙王", hint: "最终决战!海龙王又喷墨又吸人,咬它 9 口!" },
];

/* ================ 1.1:三片新海域(第 100–188 关) ================ */
// 前 99 关一格不动,这三章整段追加在数组末尾。
// 每章 12 关手写 + 其余生成,生成关的障碍组合由固定枚举分配,保证:
// 同章内互不重复、也不和同章手写关撞车。

/** 按固定顺序枚举 pool 的 2~4 元子集(带上 forced 里必带的障碍)。 */
function hazardCombos(pool: HazardKind[], forced: HazardKind[] = []): HazardKind[][] {
  const out: HazardKind[][] = [];
  for (let size = 2; size <= 4; size++) {
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      let bits = 0;
      for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) bits++;
      if (bits !== size) continue;
      const combo: HazardKind[] = [...forced];
      for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) combo.push(pool[i]);
      out.push(combo);
    }
  }
  return out;
}

function sig(hazards: ReadonlyArray<HazardKind>): string {
  return [...hazards].sort().join(",");
}

/** 新海域的生成关:名字/机制标记全章唯一,目标随进度缓慢爬升。 */
function genDeepLevel(
  zone: ZoneId,
  sub: number,
  hazards: HazardKind[],
  targetR: number,
  bigFishBias: number,
  extra: Partial<LevelDef> = {},
): LevelDef {
  const st = ZONE_STYLE[zone];
  return {
    name: `${st.name}巡游 ${sub + 1} 号`,
    zone,
    targetR,
    hazards,
    bigFishBias,
    feature: `${st.name}巡游${sub + 1}号`,
    gen: true,
    hint: `${st.name}的常驻巡游队来了!这回是 ${hazards.length} 种麻烦混着上`,
    ...extra,
  };
}

/**
 * 拼一片新海域:手写关按 [0..7] → 生成关 → [8,9] → 生成关 → 挑战关 → BOSS 关 排布。
 * 生成关自动跳过手写关已经用掉的障碍组合。
 */
function buildDeepZone(
  zone: ZoneId,
  hand: LevelDef[],
  size: number,
  opts: {
    /** 生成关的障碍从这些里挑(不含必带的 forced) */
    pool: HazardKind[];
    forced?: HazardKind[];
    /** 生成关目标半径的起点与终点 */
    fromR: number;
    toR: number;
    bigFishBias: number;
    /** 深渊压力:生成关的体型余量(从松到紧) */
    slackFrom?: number;
    slackTo?: number;
  },
): LevelDef[] {
  if (hand.length !== 12) throw new Error(`${zone} 手写关数量应为 12`);
  const genCount = size - hand.length;
  const used = new Set(hand.map((l) => sig(l.hazards)));
  const combos = hazardCombos(opts.pool, opts.forced).filter((c) => !used.has(sig(c)));
  if (combos.length < genCount) throw new Error(`${zone} 生成关障碍组合不够用`);
  const gens: LevelDef[] = [];
  for (let i = 0; i < genCount; i++) {
    const t = genCount === 1 ? 0 : i / (genCount - 1);
    const extra: Partial<LevelDef> = {};
    if (i % 3 === 1) extra.buddy = true;
    if (opts.slackFrom !== undefined && opts.slackTo !== undefined) {
      extra.pressureSlack = Math.round(opts.slackFrom + (opts.slackTo - opts.slackFrom) * t);
    }
    gens.push(
      genDeepLevel(
        zone,
        i,
        combos[i],
        Math.round(opts.fromR + (opts.toR - opts.fromR) * t),
        opts.bigFishBias,
        extra,
      ),
    );
  }
  const firstGen = Math.ceil(genCount / 2);
  return [
    ...hand.slice(0, 8),
    ...gens.slice(0, firstGen),
    hand[8],
    hand[9],
    ...gens.slice(firstGen),
    hand[10],
    hand[11],
  ];
}

/* ---- 第 10 章 · 洋流海峡:整片海定时换向 + 共生小鱼登场 ---- */
const straitHand: LevelDef[] = [
  { name: "海峡初潮", zone: "strait", targetR: 56, hazards: ["drift"], bigFishBias: 0.16, feature: "洋流登场", hint: "整片海峡都在流动!看屏幕上的箭头,顺着流游省力气" },
  { name: "顺流逆流", zone: "strait", targetR: 56, hazards: ["drift", "current"], bigFishBias: 0.16, feature: "洋流叠水流带", hint: "洋流之外还夹着水流带,两股力气方向不一样" },
  { name: "共生小鱼", zone: "strait", targetR: 57, hazards: ["drift"], bigFishBias: 0.16, feature: "共生小鱼登场", buddy: true, hint: "捡到共生小鱼泡泡,就有小伙伴跟着你,帮你吃小鱼!" },
  { name: "泡门换向", zone: "strait", targetR: 57, hazards: ["drift", "bubbleWall"], bigFishBias: 0.17, feature: "洋流泡门", hint: "洋流一换向,泡泡墙的缺口就更难对准了" },
  { name: "刺球顺流漂", zone: "strait", targetR: 58, hazards: ["drift", "urchin"], bigFishBias: 0.17, feature: "洋流刺球漂", hint: "刺刺球被洋流推着成排漂过来,提前让开" },
  { name: "墨影借流", zone: "strait", targetR: 58, hazards: ["drift", "squid"], bigFishBias: 0.17, feature: "洋流墨影", hint: "墨墨鱼借着洋流溜得飞快,喷完墨就没影了" },
  { name: "鼓鼓鱼冲浪", zone: "strait", targetR: 59, hazards: ["drift", "puffer"], bigFishBias: 0.18, feature: "洋流鼓鼓鱼", hint: "鼓鼓鱼在洋流里像冲浪一样滚过来,等它瘪了再吃" },
  { name: "双流夹击", zone: "strait", targetR: 59, hazards: ["drift", "current", "bubbleWall"], bigFishBias: 0.18, feature: "洋流双流夹击", hint: "洋流、水流带、泡泡墙,三样一起把你往边上推" },
  { name: "换向练习场", zone: "strait", targetR: 61, hazards: ["drift", "urchin", "puffer"], bigFishBias: 0.18, feature: "洋流换向练习", buddy: true, hint: "洋流换得更勤了,记住换向前水面会先安静一下" },
  { name: "泡帘急流", zone: "strait", targetR: 61, hazards: ["drift", "current", "squid"], bigFishBias: 0.19, feature: "洋流泡帘急流", hint: "急流里的墨墨鱼最会偷袭,盯紧再下嘴" },
  { name: "海峡大回旋", zone: "strait", targetR: 63, hazards: ["drift", "current", "urchin", "squid", "bubbleWall", "puffer"], bigFishBias: 0.2, feature: "洋流海峡毕业考", hint: "海峡毕业考!六种麻烦全在洋流里打转" },
  { name: "旋旋鳐", zone: "strait", targetR: 62, hazards: ["drift", "current"], boss: "ray", bigFishBias: 0.19, feature: "海峡BOSS旋旋鳐", buddy: true, hint: "旋旋鳐一挥翅膀就把洋流掀反!顺着它掀出来的流,咬它 9 口" },
];

/* ---- 第 11 章 · 荧光藻湾:含毒生物,好看的不一定能吃 ---- */
const bloomHand: LevelDef[] = [
  { name: "荧光初见", zone: "bloom", targetR: 62, hazards: ["toxin"], bigFishBias: 0.17, feature: "毒藻鱼登场", hint: "亮紫色一闪一闪的是毒藻鱼,吃下去会缩小发麻,别贪嘴!" },
  { name: "亮亮陷阱", zone: "bloom", targetR: 62, hazards: ["toxin", "jelly"], bigFishBias: 0.17, feature: "毒藻配水母", hint: "水母也会发光,和毒藻鱼混在一起,看清颜色再张嘴" },
  { name: "电藻荧光", zone: "bloom", targetR: 63, hazards: ["toxin", "eel"], bigFishBias: 0.18, feature: "毒藻带电", hint: "电电草亮起来的时候,毒藻鱼反而看不清了" },
  { name: "毒影墨云", zone: "bloom", targetR: 63, hazards: ["toxin", "squid"], bigFishBias: 0.18, feature: "毒藻墨云", buddy: true, hint: "墨云一糊眼,毒藻鱼就趁机混进鱼群,让小伙伴帮你分辨" },
  { name: "涡里荧光", zone: "bloom", targetR: 64, hazards: ["toxin", "vortex"], bigFishBias: 0.18, feature: "毒藻漩涡", hint: "涡流会把毒藻鱼一股脑吸到你面前,绕着涡边走" },
  { name: "刺球藻田", zone: "bloom", targetR: 64, hazards: ["toxin", "urchin"], bigFishBias: 0.19, feature: "毒藻刺球田", hint: "藻田里刺刺球和毒藻鱼各占一半,慢慢挑着吃" },
  { name: "荧光夜游", zone: "bloom", targetR: 65, hazards: ["toxin", "jelly", "eel"], bigFishBias: 0.19, feature: "毒藻夜游三重", hint: "整片藻湾都在发光,越亮的地方越要当心" },
  { name: "毒涡双缠", zone: "bloom", targetR: 65, hazards: ["toxin", "vortex", "urchin"], bigFishBias: 0.19, feature: "毒藻涡刺双缠", hint: "被涡流拽进刺球堆的时候,先稳住方向再加速" },
  { name: "小鱼帮帮忙", zone: "bloom", targetR: 67, hazards: ["toxin", "jelly", "squid"], bigFishBias: 0.19, feature: "共生小鱼助攻", buddy: true, hint: "共生小鱼不会去碰毒藻鱼,让它替你清干净小鱼群" },
  { name: "藻田电网", zone: "bloom", targetR: 67, hazards: ["toxin", "eel", "vortex"], bigFishBias: 0.2, feature: "毒藻电网", hint: "电电草排成一张网,毒藻鱼就守在网眼里" },
  { name: "藻湾大绽放", zone: "bloom", targetR: 69, hazards: ["toxin", "jelly", "eel", "squid", "vortex", "urchin"], bigFishBias: 0.2, feature: "荧光藻湾毕业考", hint: "藻湾毕业考!整片海一起绽放,六种麻烦全到齐" },
  { name: "荧荧海葵王", zone: "bloom", targetR: 68, hazards: ["toxin", "jelly"], boss: "anemone", bigFishBias: 0.2, feature: "藻湾BOSS荧荧海葵王", buddy: true, hint: "荧荧海葵王会吐毒云还会叫水母帮忙!躲开紫雾,咬它 10 口" },
];

/* ---- 第 12 章 · 万丈压渊:水压把体型摁住,长不过头 ---- */
const trenchHand: LevelDef[] = [
  { name: "下潜第一压", zone: "trench", targetR: 68, hazards: ["pressure"], bigFishBias: 0.18, feature: "深渊压力登场", pressureSlack: 6, hint: "水压太大,你长到一定大小就长不动了!够到目标就够了" },
  { name: "压力与洋流", zone: "trench", targetR: 68, hazards: ["pressure", "drift"], bigFishBias: 0.18, feature: "压力叠洋流", pressureSlack: 6, hint: "又挤又流,省着点力气,专挑顺路的小鱼吃" },
  { name: "压渊毒藻", zone: "trench", targetR: 69, hazards: ["pressure", "toxin"], bigFishBias: 0.19, feature: "压力叠毒藻", pressureSlack: 5, hint: "体型本来就到顶了,再被毒藻鱼缩一口就更难追平" },
  { name: "压里漩涡", zone: "trench", targetR: 69, hazards: ["pressure", "vortex"], bigFishBias: 0.19, feature: "压力叠漩涡", pressureSlack: 5, buddy: true, hint: "涡流在高压下转得更急,让共生小鱼替你去边上捡漏" },
  { name: "深压电网", zone: "trench", targetR: 70, hazards: ["pressure", "eel"], bigFishBias: 0.19, feature: "压力叠电网", pressureSlack: 5, hint: "电电草在深压里亮得更久,数着节拍穿过去" },
  { name: "压门泡帘", zone: "trench", targetR: 70, hazards: ["pressure", "bubbleWall"], bigFishBias: 0.19, feature: "压力叠泡帘", pressureSlack: 4, hint: "泡泡墙被压得又厚又窄,缺口要早早对准" },
  { name: "洋流压顶", zone: "trench", targetR: 71, hazards: ["pressure", "drift", "vortex"], bigFishBias: 0.2, feature: "压力洋流漩涡三叠", pressureSlack: 4, hint: "洋流加漩涡,方向乱成一团,先看清再动" },
  { name: "毒压双重", zone: "trench", targetR: 71, hazards: ["pressure", "toxin", "eel"], bigFishBias: 0.2, feature: "压力毒藻电草三叠", pressureSlack: 4, hint: "毒藻鱼躲在电草缝里,宁可少吃一口也别吃错" },
  { name: "小鱼陪你潜", zone: "trench", targetR: 73, hazards: ["pressure", "drift", "toxin"], bigFishBias: 0.2, feature: "深渊共生助潜", pressureSlack: 3, buddy: true, hint: "共生小鱼不受水压影响,越到深处它越顶用" },
  { name: "压渊泡阵", zone: "trench", targetR: 73, hazards: ["pressure", "bubbleWall", "vortex"], bigFishBias: 0.2, feature: "深渊泡阵漩涡", pressureSlack: 3, hint: "泡泡墙和漩涡把海沟切成一格一格,挑空档冲" },
  { name: "万丈总压", zone: "trench", targetR: 75, hazards: ["pressure", "drift", "toxin", "vortex", "eel", "bubbleWall"], bigFishBias: 0.2, feature: "万丈压渊毕业考", pressureSlack: 3, hint: "压渊毕业考!六种麻烦压在一起,稳住呼吸慢慢来" },
  { name: "咔咔巨蚌", zone: "trench", targetR: 74, hazards: ["pressure", "drift"], boss: "clam", bigFishBias: 0.2, feature: "压渊BOSS咔咔巨蚌", pressureSlack: 4, buddy: true, hint: "咔咔巨蚌一合壳就加压,把你的体型上限越压越低!趁它张壳咬满 11 口" },
];

export const LEVELS: LevelDef[] = [
  ...buildZone(0, shallowHand),
  ...buildZone(1, coralHand),
  ...buildZone(2, kelpHand),
  ...buildZone(3, wreckHand),
  ...buildZone(4, deepHand),
  ...buildZone(5, iceHand),
  ...buildZone(6, volcanoHand),
  ...buildZone(7, abyssHand),
  ...buildZone(8, pearlHand),
  ...buildDeepZone("strait", straitHand, NEW_ZONE_SIZES[0], {
    pool: ["current", "urchin", "squid", "bubbleWall", "puffer"],
    forced: ["drift"],
    fromR: 60,
    toR: 62,
    bigFishBias: 0.18,
  }),
  ...buildDeepZone("bloom", bloomHand, NEW_ZONE_SIZES[1], {
    pool: ["jelly", "eel", "squid", "vortex", "urchin"],
    forced: ["toxin"],
    fromR: 66,
    toR: 68,
    bigFishBias: 0.19,
  }),
  ...buildDeepZone("trench", trenchHand, NEW_ZONE_SIZES[2], {
    pool: ["drift", "toxin", "vortex", "eel", "bubbleWall"],
    forced: ["pressure"],
    fromR: 72,
    toR: 74,
    bigFishBias: 0.2,
    slackFrom: 5,
    slackTo: 3,
  }),
];

/* ---------------- 吃与长大 ---------------- */

/** 两个圆是否碰到(factor 越小越宽容)。 */
export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  factor = 0.78,
): boolean {
  return Math.hypot(x2 - x1, y2 - y1) < (r1 + r2) * factor;
}

/** 我方半径明显更大才能吃掉对方。 */
export function canEat(playerR: number, otherR: number): boolean {
  return playerR >= otherR * 1.08;
}

/** 对方明显更大才有危险;差不多大就只是互相碰碰。 */
export function isDanger(playerR: number, otherR: number): boolean {
  return otherR >= playerR * 1.12;
}

/** 吃掉一条鱼后长大,封顶到目标大小。 */
export function grow(r: number, eatenR: number, target: number): number {
  return Math.min(target, r + Math.max(1.0, eatenR * 0.16));
}

/** roll ∈ [0,1) → 新鱼半径:大多数比玩家小,bigBias 越大越容易出大鱼。 */
export function spawnRadius(playerR: number, roll: number, bigBias = 0): number {
  const smallShare = Math.max(0.4, 0.66 - bigBias);
  if (roll < smallShare) {
    const t = roll / smallShare;
    return Math.max(6, playerR * (0.35 + 0.5 * t));
  }
  const t = (roll - smallShare) / (1 - smallShare);
  return Math.min(78, playerR * (1.2 + 0.7 * t));
}

/** 连吃奖励分:连吃越多每口越值钱,封顶 8 连。 */
export function eatScore(streak: number): number {
  return 5 + Math.min(Math.max(streak, 1), 8) * 5;
}

/* ---------------- 障碍参数 ---------------- */

export const SHIELD_SECONDS = 6;
/** 涡流:吸力半径与强度。 */
export const VORTEX_RADIUS = 150;
export const VORTEX_PULL = 105;
/** 电电草:通电/断电周期(秒)。 */
export const EEL_ON = 1.2;
export const EEL_OFF = 2.2;
/** 气泡墙缺口高度(像素)。 */
export const BUBBLE_GAP = 150;
/** 午夜深渊:玩家身边能看清的半径倍数。 */
export const DARK_SIGHT = 7.5;

/** 电电草在 time 时是否通电(offset 让每棵草错开)。 */
export function eelActive(time: number, offset: number): boolean {
  const cycle = EEL_ON + EEL_OFF;
  const t = (time + offset) % cycle;
  return t < EEL_ON;
}

/** 电电草的电场半宽:碰到判定是 |玩家 x − 草 x| < 体型 + 13。 */
export function eelReach(playerR: number): number {
  return playerR + 13;
}

/**
 * 一关里的电电草怎么插。前九片海按 1.0 的老样子,一棵都不动。
 *
 * 1.1 的三片深海把目标体型推到了 67~75,而电场半宽是跟着体型长的,
 * 老密度的五棵草并排就连成一张连缝都不留的电网,再稳的手也只能硬吃伤害。
 * 所以深海只留两棵、贴着左右两边站,而且相位正好错开——两棵永远不会同时
 * 通电,中间那条水道任何时候都游得过去。
 */
export function eelPlan(zone: ZoneId, tier: number): { fx: number; offset: number }[] {
  if (zone === "strait" || zone === "bloom" || zone === "trench") {
    return [
      { fx: 0.14, offset: 0 },
      { fx: 0.86, offset: EEL_ON + 0.5 },
    ];
  }
  const plan = [
    { fx: 0.28, offset: 0 },
    { fx: 0.55, offset: 1.3 },
    { fx: 0.82, offset: 2.5 },
  ];
  if (tier >= 2) plan.push({ fx: 0.12, offset: 1.9 });
  if (tier >= 3) plan.push({ fx: 0.68, offset: 0.7 });
  return plan;
}

/** 涡流对 (dx,dy) 处物体的吸力(指向涡心,越近越强;涡心外无力)。 */
export function vortexPull(dx: number, dy: number): { fx: number; fy: number } {
  const d = Math.hypot(dx, dy);
  if (d >= VORTEX_RADIUS || d < 1e-6) return { fx: 0, fy: 0 };
  const strength = VORTEX_PULL * (1 - d / VORTEX_RADIUS);
  return { fx: (-dx / d) * strength, fy: (-dy / d) * strength };
}

/** 气泡墙:这个高度是否在缺口里(能穿过去)。 */
export function inBubbleGap(y: number, gapY: number, gapH = BUBBLE_GAP): boolean {
  return y > gapY - gapH / 2 && y < gapY + gapH / 2;
}

/** 章节越深,环境障碍越密(1/2/3 档)。 */
export function hazardTier(levelIdx: number): 1 | 2 | 3 {
  const zi = themeIndexOf(levelIdx);
  if (zi <= 2) return 1;
  if (zi <= 5) return 2;
  return 3;
}

/* ---------------- 1.1 新机制 ---------------- */

/** 洋流换向周期(秒):整片海一起转,转到一半会先安静下来再反过来。 */
export const DRIFT_PERIOD = 8;
/** 洋流推力(像素/秒)。 */
export const DRIFT_SPEED = 62;

/**
 * 洋流在 time 时刻的推力(整片海一个方向,横向为主、竖向轻一点)。
 * 用连续的三角函数换向:换向前后都会自然减速到零,不会突然把人甩飞。
 */
export function driftVector(time: number, phase = 0): { fx: number; fy: number } {
  const a = ((time / DRIFT_PERIOD) + phase) * Math.PI * 2;
  return { fx: Math.cos(a) * DRIFT_SPEED, fy: Math.sin(a * 0.5) * DRIFT_SPEED * 0.4 };
}

/** 洋流现在往右推还是往左推(HUD 上画箭头用)。 */
export function driftDir(time: number, phase = 0): 1 | -1 {
  return driftVector(time, phase).fx >= 0 ? 1 : -1;
}

/** 吃到毒藻鱼会缩小的比例。 */
export const TOXIN_SHRINK = 0.86;
/** 吃到毒藻鱼后麻酥酥的秒数(只是变迟钝,不掉心)。 */
export const TOXIN_NUMB = 1.6;

/** 吃到毒藻鱼:缩一点点,但绝不会缩回比出生还小。 */
export function toxinShrink(r: number): number {
  return Math.max(START_RADIUS, r * TOXIN_SHRINK);
}

/** 麻酥酥期间跟手的迟钝程度:剩余时间越少越灵活。 */
export function numbFollowMult(left: number): number {
  if (left <= 0) return 1;
  const t = Math.min(1, left / TOXIN_NUMB);
  return 0.45 + 0.55 * (1 - t);
}

/** 共生小鱼能顺手帮你吃掉的范围(像素)。 */
export const BUDDY_REACH = 74;
/** 最多能带几条共生小鱼。 */
export const BUDDY_MAX = 2;
/** 共生小鱼吃一口给的分。 */
export const BUDDY_SCORE = 8;

/** 共生小鱼的体型:跟着你长,但只有你的四成。 */
export function buddyRadius(playerR: number): number {
  return Math.max(7, playerR * 0.4);
}

/** 共生小鱼只帮你吃不比它大的小鱼(毒藻鱼它才不碰)。 */
export function buddyCanEat(buddyR: number, fishR: number): boolean {
  return fishR <= buddyR * 0.95;
}

/** 共生小鱼跟随:朝跟随点靠拢,离得越远追得越急。 */
export function buddyStep(
  bx: number,
  by: number,
  tx: number,
  ty: number,
  dt: number,
): { x: number; y: number } {
  const k = Math.min(1, dt * 4.5);
  return { x: bx + (tx - bx) * k, y: by + (ty - by) * k };
}

/** 深渊压力没生效时,还能比目标多长 10 像素(1.0 的老手感)。 */
export const FREE_GROW_SLACK = 10;
/** 深渊压力默认余量。 */
export const PRESSURE_SLACK = 4;

/**
 * 本关能长到的体型上限。
 * 没有深渊压力就是老规矩(目标 + 10);有压力时余量收紧,想赢就得精打细算。
 */
export function sizeCapFor(def: LevelDef): number {
  if (!def.hazards.includes("pressure")) return def.targetR + FREE_GROW_SLACK;
  return def.targetR + (def.pressureSlack ?? PRESSURE_SLACK);
}

/** 咔咔巨蚌合壳加压:上限一档一档往下压,但永远不会压到够不着目标。 */
export function crushedCap(cap: number, crushes: number, targetR: number): number {
  return Math.max(targetR + 1, cap - crushes * 1.5);
}

/* ---------------- 生物图鉴 ---------------- */

export interface DexEntry {
  id: string;
  name: string;
  emoji: string;
  desc: string;
}

export const DEX: DexEntry[] = [
  { id: "minnow", name: "小圆鱼", emoji: "🐟", desc: "最常见的小鱼,一口一个" },
  { id: "stripey", name: "条纹鱼", emoji: "🐠", desc: "中等个头,游得欢快" },
  { id: "bigblue", name: "大蓝鱼", emoji: "🐡", desc: "比你大就快躲开!" },
  { id: "jelly", name: "水母", emoji: "🪼", desc: "软软的,碰到会麻麻的" },
  { id: "puffer", name: "鼓鼓鱼", emoji: "🎈", desc: "生气就鼓成刺球" },
  { id: "urchin", name: "刺刺球", emoji: "🌰", desc: "浑身是刺,千万别抱" },
  { id: "squid", name: "墨墨鱼", emoji: "🦑", desc: "着急了就喷墨逃跑" },
  { id: "crab", name: "钳钳蟹", emoji: "🦀", desc: "海湾老大,钳子咔咔" },
  { id: "octopus", name: "墨墨大王", emoji: "🐙", desc: "珊瑚老大,一喷一大团墨" },
  { id: "turtle", name: "龟龟长老", emoji: "🐢", desc: "海带长老,会叫水母帮忙" },
  { id: "sword", name: "剑剑鱼", emoji: "⚔️", desc: "沉船船长,冲刺快如箭" },
  { id: "angler", name: "灯灯鱼", emoji: "🔦", desc: "深沟老大,冲刺飞快" },
  { id: "whale", name: "鲸鲸大王", emoji: "🐳", desc: "冰海老大,会把你吸过去" },
  { id: "lobster", name: "火火龙虾", emoji: "🦞", desc: "火山老大,会召刺刺球" },
  { id: "shark", name: "鲨鲨霸王", emoji: "🦈", desc: "深渊老大,越伤越猛" },
  { id: "dragon", name: "海龙王", emoji: "🐉", desc: "龙宫之主,九大海域的终点" },
  // ---- 1.1 新收录 ----
  { id: "drift", name: "洋流", emoji: "🌀", desc: "整片海一起换向的大水流" },
  { id: "toxin", name: "毒藻鱼", emoji: "🦠", desc: "亮闪闪的,吃了会缩小发麻" },
  { id: "buddy", name: "共生小鱼", emoji: "🐬", desc: "跟着你游,顺手帮你吃小鱼" },
  { id: "ray", name: "旋旋鳐", emoji: "🪁", desc: "海峡老大,翅膀一挥掀反洋流" },
  { id: "anemone", name: "荧荧海葵王", emoji: "🪸", desc: "藻湾老大,会吐一团团毒雾" },
  { id: "clam", name: "咔咔巨蚌", emoji: "🐚", desc: "压渊之主,合壳就加压" },
  // ---- 1.2 新收录:深海马拉松里才见得到的三种 ----
  { id: "elite", name: "闪闪精英鱼", emoji: "💫", desc: "游得飞快,吃到能顶住水压十秒" },
  { id: "lantern", name: "提灯鱼", emoji: "🏮", desc: "第三层往下才有,尾巴挂着小灯" },
  { id: "ribbon", name: "飘带鱼", emoji: "🎏", desc: "深层的大个子,身子长得像飘带" },
];

export const DEX_KEY = "yiduo-yixing.ocean-munch.dex.v1";

export function parseDex(raw: string | null): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      const valid = new Set(DEX.map((d) => d.id));
      for (const v of arr) if (typeof v === "string" && valid.has(v)) out.add(v);
    }
  } catch {
    // 坏档当新档
  }
  return out;
}

export function serializeDex(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids]);
}

/** 按被吃的鱼和玩家的相对大小归类图鉴条目。 */
export function dexIdForFish(fishR: number, playerR: number): string {
  if (fishR >= playerR * 0.85) return "bigblue";
  if (fishR >= playerR * 0.55) return "stripey";
  return "minnow";
}

/* ---------------- 结算与进度 ---------------- */

export const HEARTS_PER_LEVEL = 3;

/** 单关星级:不掉心 3 星,掉 1 颗 2 星,通过 1 星。 */
export function starsForLevel(heartsLost: number): 1 | 2 | 3 {
  if (heartsLost <= 0) return 3;
  if (heartsLost <= 1) return 2;
  return 1;
}

export const PROGRESS_KEY = "yiduo-yixing.ocean-munch.campaign.v2";

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

/** 章节解锁:上一章 BOSS 关(也就是本章第一关的前一关)通过即可。 */
export function isThemeUnlocked(stars: ReadonlyArray<number>, themeIdx: number): boolean {
  return isLevelUnlocked(stars, themeStart(themeIdx));
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
export function clearSpeechLine(name: string, stars: number, eaten: number): string {
  return stars >= 3
    ? `${name}通过啦!三颗星,吃了 ${eaten} 条鱼,完美!`
    : `${name}通过啦!得到 ${stars} 颗星,吃了 ${eaten} 条鱼,真棒!`;
}

/** 失败结算面板要朗读的整句话:温柔安抚,BOSS 关再带一句悄悄提示。 */
export function retrySpeechLine(hint: string | null): string {
  const base = "小鱼晕乎乎。没关系,这片海再游一次就好!";
  return hint ? `${base}悄悄告诉你:${hint}` : base;
}
