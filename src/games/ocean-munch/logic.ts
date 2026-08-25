// 海底大胃王 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 20 关四大海域战役:浅浅海湾 → 珊瑚花园 → 深深海沟 → 冰冰海域,每片海域都有区域 BOSS。

export const START_RADIUS = 14;

/* ---------------- 海域分区 ---------------- */

export type ZoneId = "shallow" | "coral" | "deep" | "ice";

export interface ZoneStyle {
  name: string;
  top: string;
  bottom: string;
  accent: string;
}

export const ZONE_STYLE: Record<ZoneId, ZoneStyle> = {
  shallow: { name: "浅浅海湾", top: "#c9edff", bottom: "#8fd0f0", accent: "#ffeeba" },
  coral: { name: "珊瑚花园", top: "#ffe3ee", bottom: "#c9b6f2", accent: "#ff9eb5" },
  deep: { name: "深深海沟", top: "#9fb8e8", bottom: "#6f86c8", accent: "#bfe9ff" },
  ice: { name: "冰冰海域", top: "#e8f4ff", bottom: "#a8cbe8", accent: "#ffffff" },
};

/* ---------------- 障碍与 BOSS ---------------- */

export type HazardKind =
  | "jelly" // 水母:碰到会痛
  | "puffer" // 鼓鼓鱼:鼓起来带刺
  | "current" // 水流:横向推着你跑
  | "urchin" // 刺刺球:慢慢漂的刺球
  | "bubbleWall" // 气泡墙:整面墙,只能从缺口穿过
  | "squid" // 墨墨鱼:靠近就喷墨遮眼
  | "vortex" // 涡流:把你往中心吸
  | "eel"; // 电电草:周期通电,碰到会麻

export type BossKind = "crab" | "octopus" | "angler" | "whale";

export interface BossSpec {
  name: string;
  hp: number;
  r: number;
  /** 冲刺间隔(秒) */
  dashCd: number;
  /** 冲刺速度(像素/秒) */
  dashSpeed: number;
  /** 章鱼会喷墨 */
  inks: boolean;
}

export const BOSS_INFO: Record<BossKind, BossSpec> = {
  crab: { name: "钳钳蟹", hp: 4, r: 52, dashCd: 2.6, dashSpeed: 150, inks: false },
  octopus: { name: "墨墨大王", hp: 5, r: 58, dashCd: 2.4, dashSpeed: 140, inks: true },
  angler: { name: "灯灯鱼", hp: 6, r: 56, dashCd: 1.8, dashSpeed: 185, inks: false },
  whale: { name: "鲸鲸大王", hp: 7, r: 68, dashCd: 2.2, dashSpeed: 165, inks: false },
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
  /** 本关独特机制标记(测试用) */
  feature: string;
  hint: string;
}

export const LEVELS: LevelDef[] = [
  // ---- 浅浅海湾 ----
  { name: "第一口小鱼", zone: "shallow", targetR: 28, hazards: [], bigFishBias: 0, feature: "入门吃鱼", hint: "移动手指,吃比你小的鱼,躲开大鱼!" },
  { name: "水母摇摇湾", zone: "shallow", targetR: 30, hazards: ["jelly"], bigFishBias: 0.02, feature: "水母登场", hint: "飘来飘去的水母碰到会痛痛!" },
  { name: "鼓鼓鱼礁石", zone: "shallow", targetR: 32, hazards: ["puffer"], bigFishBias: 0.04, feature: "鼓鼓鱼登场", hint: "鼓起来的鼓鼓鱼有刺,等它瘪了再吃!" },
  { name: "暗涌初现", zone: "shallow", targetR: 33, hazards: ["jelly", "current"], bigFishBias: 0.05, feature: "水流带登场", hint: "有的水层会推着你跑,顶着游!" },
  { name: "钳钳蟹老大", zone: "shallow", targetR: 32, hazards: ["jelly"], boss: "crab", bigFishBias: 0.05, feature: "海湾BOSS钳钳蟹", hint: "先吃小鱼长大,再咬钳钳蟹 4 口!" },
  // ---- 珊瑚花园 ----
  { name: "珊瑚迷宫", zone: "coral", targetR: 34, hazards: ["urchin"], bigFishBias: 0.06, feature: "刺刺球登场", hint: "紫色刺刺球千万别抱!" },
  { name: "泡泡帘子", zone: "coral", targetR: 35, hazards: ["bubbleWall", "jelly"], bigFishBias: 0.06, feature: "气泡墙登场", hint: "整面泡泡墙挡路,找缺口钻过去!" },
  { name: "墨墨鱼群", zone: "coral", targetR: 36, hazards: ["squid"], bigFishBias: 0.08, feature: "墨墨鱼登场", hint: "小墨墨鱼被追急了会喷墨遮眼!" },
  { name: "浑水摸鱼", zone: "coral", targetR: 37, hazards: ["squid", "jelly", "current"], bigFishBias: 0.08, feature: "浑水混战", hint: "水母+墨墨鱼+水流,小心慢慢游" },
  { name: "墨墨大王", zone: "coral", targetR: 36, hazards: ["squid"], boss: "octopus", bigFishBias: 0.08, feature: "珊瑚BOSS墨墨大王", hint: "墨墨大王会喷好大一团墨!咬它 5 口" },
  // ---- 深深海沟 ----
  { name: "深沟入口", zone: "deep", targetR: 38, hazards: ["jelly", "puffer"], bigFishBias: 0.12, feature: "深海大鱼", hint: "深海的鱼都好大,别贪嘴!" },
  { name: "涡流走廊", zone: "deep", targetR: 39, hazards: ["vortex", "jelly"], bigFishBias: 0.12, feature: "涡流登场", hint: "蓝色涡流会把你吸过去,用力游开!" },
  { name: "电电草丛", zone: "deep", targetR: 40, hazards: ["eel"], bigFishBias: 0.12, feature: "电流海草登场", hint: "海草会周期通电,亮的时候别碰!" },
  { name: "深渊夜巡", zone: "deep", targetR: 41, hazards: ["eel", "vortex", "squid"], bigFishBias: 0.14, feature: "深渊三重奏", hint: "电草+涡流+墨墨鱼,深呼吸再进!" },
  { name: "灯灯鱼老大", zone: "deep", targetR: 40, hazards: ["jelly"], boss: "angler", bigFishBias: 0.12, feature: "深沟BOSS灯灯鱼", hint: "灯灯鱼冲刺特别快!躲开再反咬 6 口" },
  // ---- 冰冰海域 ----
  { name: "冰冰海湾", zone: "ice", targetR: 42, hazards: ["urchin", "bubbleWall"], bigFishBias: 0.14, feature: "冰海开场", hint: "冰海里刺球和泡泡墙一起来!" },
  { name: "寒流漩涡", zone: "ice", targetR: 43, hazards: ["vortex", "current"], bigFishBias: 0.15, feature: "寒流+漩涡", hint: "水流推着你,涡流吸着你,稳住!" },
  { name: "冰晶电网", zone: "ice", targetR: 44, hazards: ["eel", "urchin"], bigFishBias: 0.16, feature: "电网阵", hint: "电草和刺球摆成阵,找空隙!" },
  { name: "万象全开", zone: "ice", targetR: 45, hazards: ["jelly", "puffer", "vortex", "eel", "squid"], bigFishBias: 0.17, feature: "全障碍混战", hint: "学过的全都来啦!你已经是大鱼啦" },
  { name: "鲸鲸大王", zone: "ice", targetR: 44, hazards: ["jelly"], boss: "whale", bigFishBias: 0.15, feature: "最终BOSS鲸鲸大王", hint: "最终决战!咬鲸鲸大王 7 口!" },
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
  return Math.min(70, playerR * (1.2 + 0.7 * t));
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
  { id: "angler", name: "灯灯鱼", emoji: "🔦", desc: "深沟老大,冲刺飞快" },
  { id: "whale", name: "鲸鲸大王", emoji: "🐳", desc: "冰海最终 BOSS!" },
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

export const PROGRESS_KEY = "yiduo-yixing.ocean-munch.campaign.v1";

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
