// 钓鱼小达人 · 装备(纯函数)。
//
// 三件套,只用平台的**星星**升级:
//  - 鱼线:把张力硬顶往上抬一点点(更抗造);
//  - 鱼饵:稀有鱼更愿意咬钩;
//  - 浮标:红区预警提前亮,多给一点反应时间。
//
// 三条红线写死在代码里:
//  1. **没有任何货币、没有任何内购**,星星是孩子自己打关攒的,花完还能再攒;
//  2. 每一项加成都有硬上限(`GEAR_CAPS`),等级越界只会被夹回上限,不会越吃越强;
//  3. 装备只加手感,不改关卡目标 —— 不装备也能通关,装备只是更从容。

import { RED_AT, SNAP_AT, clamp } from "./logic";

export const GEAR_KEY = "yiduo-yixing.fishing-star.gear";

export type GearKind = "line" | "bait" | "float";

export const GEAR_KINDS: GearKind[] = ["line", "bait", "float"];

/** 每件装备最多升到几级 */
export const MAX_GEAR_LEVEL = 3;

export interface GearStep {
  /** 升到这一级的名字 */
  name: string;
  /** 从上一级升到这一级要几颗星星(0 级是出厂配置,不要星星) */
  cost: number;
  note: string;
}

export interface GearSpec {
  kind: GearKind;
  name: string;
  emoji: string;
  /** 这件装备管什么 */
  what: string;
  steps: GearStep[];
}

export const GEAR: Record<GearKind, GearSpec> = {
  line: {
    kind: "line",
    name: "鱼线",
    emoji: "🧵",
    what: "张力上限:线越好,红区越靠后,冲一下也不至于直接断",
    steps: [
      { name: "棉线", cost: 0, note: "出厂就有的那一卷,够用。" },
      { name: "编织线", cost: 8, note: "张力上限 +0.03。" },
      { name: "碳素线", cost: 18, note: "张力上限 +0.06。" },
      { name: "星纹线", cost: 32, note: "张力上限 +0.09(封顶)。" },
    ],
  },
  bait: {
    kind: "bait",
    name: "鱼饵",
    emoji: "🪱",
    what: "稀有度加权:好饵能把传说鱼从深处引上来",
    steps: [
      { name: "面包屑", cost: 0, note: "小鱼最爱,大鱼看都不看。" },
      { name: "河虾", cost: 6, note: "稀有加权 +0.18。" },
      { name: "亮片饵", cost: 14, note: "稀有加权 +0.36。" },
      { name: "星光饵", cost: 26, note: "稀有加权 +0.54(封顶)。" },
    ],
  },
  float: {
    kind: "float",
    name: "浮标",
    emoji: "🎈",
    what: "预警更早:红区还没到就先抖给你看,咬钩也多给一点反应时间",
    steps: [
      { name: "木浮标", cost: 0, note: "老老实实沉一下。" },
      { name: "长脚浮标", cost: 5, note: "预警提前 0.05,反应窗口 +80 毫秒。" },
      { name: "夜光浮标", cost: 12, note: "预警提前 0.10,反应窗口 +160 毫秒。" },
      { name: "星芒浮标", cost: 22, note: "预警提前 0.15,反应窗口 +240 毫秒(封顶)。" },
    ],
  },
};

/** 加成硬上限:任何等级、任何存档都不许越过这几个数 */
export const GEAR_CAPS = {
  /** 鱼线最多把张力硬顶抬多少 */
  lineSnap: 0.09,
  /** 鱼饵最多加多少稀有度权重 */
  baitLuck: 0.54,
  /** 浮标最多把预警提前多少张力 */
  floatWarn: 0.15,
  /** 浮标最多多给多少毫秒反应时间 */
  floatMs: 240,
} as const;

const PER_LEVEL = {
  lineSnap: 0.03,
  baitLuck: 0.18,
  floatWarn: 0.05,
  floatMs: 80,
} as const;

export interface GearSet {
  line: number;
  bait: number;
  float: number;
}

export function emptyGear(): GearSet {
  return { line: 0, bait: 0, float: 0 };
}

function level(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.round(clamp(v, 0, MAX_GEAR_LEVEL));
}

/** 把任意来源的装备值夹成合法等级 */
export function normalizeGear(raw: unknown): GearSet {
  if (typeof raw !== "object" || raw === null) return emptyGear();
  const o = raw as Record<string, unknown>;
  return { line: level(o.line), bait: level(o.bait), float: level(o.float) };
}

export function parseGear(raw: string | null | undefined): GearSet {
  if (!raw) return emptyGear();
  try {
    return normalizeGear(JSON.parse(raw));
  } catch {
    return emptyGear();
  }
}

export function serializeGear(gear: GearSet): string {
  return JSON.stringify(normalizeGear(gear));
}

/** 升到下一级要几颗星星;已经满级返回 null */
export function nextCost(gear: GearSet, kind: GearKind): number | null {
  const g = normalizeGear(gear);
  const lv = g[kind];
  if (lv >= MAX_GEAR_LEVEL) return null;
  return GEAR[kind].steps[lv + 1].cost;
}

/** 星星够不够升下一级 */
export function canUpgrade(gear: GearSet, kind: GearKind, stars: number): boolean {
  const cost = nextCost(gear, kind);
  if (cost === null) return false;
  return Number.isFinite(stars) && stars >= cost;
}

/** 升一级(纯函数);满级或星星不够就原样返回 */
export function upgrade(gear: GearSet, kind: GearKind, stars: number): { gear: GearSet; spent: number } {
  const g = normalizeGear(gear);
  if (!canUpgrade(g, kind, stars)) return { gear: g, spent: 0 };
  const cost = nextCost(g, kind) as number;
  return { gear: { ...g, [kind]: g[kind] + 1 }, spent: cost };
}

/** 这一套装备一共花掉了多少星星 */
export function totalSpent(gear: GearSet): number {
  const g = normalizeGear(gear);
  let sum = 0;
  for (const kind of GEAR_KINDS) {
    for (let lv = 1; lv <= g[kind]; lv++) sum += GEAR[kind].steps[lv].cost;
  }
  return sum;
}

/** 全部装备升满要多少星星 */
export function fullKitCost(): number {
  return totalSpent({ line: MAX_GEAR_LEVEL, bait: MAX_GEAR_LEVEL, float: MAX_GEAR_LEVEL });
}

export interface GearBonus {
  /** 张力硬顶 */
  snapAt: number;
  /** 抽鱼时额外的稀有度权重 */
  luck: number;
  /** 预警亮起来的张力(比红区更早) */
  warnAt: number;
  /** 咬钩后额外的反应时间(毫秒) */
  reactionMs: number;
}

/** 出厂状态的手感基准 */
export function baseBonus(): GearBonus {
  return { snapAt: SNAP_AT, luck: 0, warnAt: RED_AT, reactionMs: 0 };
}

/** 这一套装备给的加成(每一项都先按等级算、再按上限夹一次) */
export function gearBonus(gear: GearSet): GearBonus {
  const g = normalizeGear(gear);
  const lineSnap = Math.min(g.line * PER_LEVEL.lineSnap, GEAR_CAPS.lineSnap);
  const luck = Math.min(g.bait * PER_LEVEL.baitLuck, GEAR_CAPS.baitLuck);
  const warn = Math.min(g.float * PER_LEVEL.floatWarn, GEAR_CAPS.floatWarn);
  const ms = Math.min(g.float * PER_LEVEL.floatMs, GEAR_CAPS.floatMs);
  const snapAt = Math.round((SNAP_AT + lineSnap) * 1000) / 1000;
  return {
    snapAt,
    luck: Math.round(luck * 100) / 100,
    // 鱼线把红区顶上去了,预警也跟着走,再往前提 warn
    warnAt: Math.round((RED_AT + lineSnap - warn) * 1000) / 1000,
    reactionMs: Math.round(ms),
  };
}

/**
 * 封顶断言:加成越过上限就在控制台喊一声并返回 false(不抛异常,不影响孩子继续玩)。
 * 单测直接 `expect(assertGearCaps(gearBonus(任意等级))).toBe(true)`。
 */
export function assertGearCaps(bonus: GearBonus): boolean {
  const problems: string[] = [];
  if (bonus.snapAt > SNAP_AT + GEAR_CAPS.lineSnap + 1e-9) {
    problems.push(`张力上限 ${bonus.snapAt} 超过 ${SNAP_AT + GEAR_CAPS.lineSnap}`);
  }
  if (bonus.snapAt < SNAP_AT - 1e-9) problems.push(`张力上限 ${bonus.snapAt} 低于出厂值`);
  if (bonus.luck > GEAR_CAPS.baitLuck + 1e-9) problems.push(`鱼饵加权 ${bonus.luck} 超过 ${GEAR_CAPS.baitLuck}`);
  if (bonus.luck < -1e-9) problems.push(`鱼饵加权 ${bonus.luck} 是负数`);
  if (bonus.warnAt < RED_AT - GEAR_CAPS.floatWarn - 1e-9) {
    problems.push(`预警张力 ${bonus.warnAt} 提前得太多`);
  }
  if (bonus.reactionMs > GEAR_CAPS.floatMs) problems.push(`反应时间 +${bonus.reactionMs} 超过 ${GEAR_CAPS.floatMs}`);
  if (bonus.reactionMs < 0) problems.push(`反应时间 ${bonus.reactionMs} 是负数`);
  if (problems.length === 0) return true;
  console.error(`[一朵一星] fishing-star 装备加成越界:${problems.join(";")}`);
  return false;
}

/** 装备栏上的一行小字 */
export function gearSummary(gear: GearSet): string {
  const g = normalizeGear(gear);
  return GEAR_KINDS.map((k) => `${GEAR[k].emoji}${GEAR[k].steps[g[k]].name}`).join(" · ");
}

/** 某件装备当前这一级的名字 */
export function gearStepName(gear: GearSet, kind: GearKind): string {
  const g = normalizeGear(gear);
  return GEAR[kind].steps[g[kind]].name;
}
