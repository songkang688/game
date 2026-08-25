// 海底大胃王 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 99 关九大海域战役:浅浅海湾 → 珊瑚花园 → 海带森林 → 沉船湾 → 深深海沟
// → 冰冰海域 → 火山温泉 → 午夜深渊 → 珍珠龙宫。
// 每片海域 11 关(8 关手写 + 3 关生成),都有专属配色、障碍组合和区域 BOSS。

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
  | "pearl";

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
];

/** 每章 11 关:8 关手写 + 3 关生成。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;

export type HazardKind =
  | "jelly" // 水母:碰到会痛
  | "puffer" // 鼓鼓鱼:鼓起来带刺
  | "current" // 水流:横向推着你跑
  | "urchin" // 刺刺球:慢慢漂的刺球
  | "bubbleWall" // 气泡墙:整面墙,只能从缺口穿过
  | "squid" // 墨墨鱼:靠近就喷墨遮眼
  | "vortex" // 涡流:把你往中心吸
  | "eel"; // 电电草:周期通电,碰到会麻

export type BossKind =
  | "crab"
  | "octopus"
  | "turtle"
  | "sword"
  | "angler"
  | "whale"
  | "lobster"
  | "shark"
  | "dragon";

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
  /** 血越少冲刺越快 */
  enrages?: boolean;
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
}

/** idx(0 起)关属于哪片海域。 */
export function themeOfLevel(idx: number): ZoneId {
  return ZONE_ORDER[Math.floor(idx / LEVELS_PER_THEME)];
}

/** 章节 ci(0 起)包含的关卡下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LEVELS_PER_THEME; i++) out.push(ci * LEVELS_PER_THEME + i);
  return out;
}

/* ---- 生成关卡:每章 3 关,障碍组合不与本章任何手写关重复 ---- */

const GEN_HAZARDS: Record<ZoneId, HazardKind[][]> = {
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
  const zone = ZONE_ORDER[zoneIdx];
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
  const zi = Math.floor(levelIdx / LEVELS_PER_THEME);
  if (zi <= 2) return 1;
  if (zi <= 5) return 2;
  return 3;
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
  { id: "dragon", name: "海龙王", emoji: "🐉", desc: "龙宫之主,最终 BOSS!" },
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
