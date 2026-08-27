/**
 * 弹弹小鸟 —— 材质表与破坏 / 连锁倒塌的纯函数(1.2 第 12 步 A 档新增)。
 *
 * 1.1 时这张表藏在 index.ts 里,只有浏览器跑得到;搬到这里之后
 * 世界步进(world.ts)、关卡可解性模拟(sim.ts)和单测用的是同一份硬度数据。
 * 数值沿用 1.1 的手感(木 40 / 石 90 / 冰 26 …),1.2 只往上加
 * 「碎片数 / 碎裂音效 / 连锁传伤 / 倾倒加成」这些新维度。
 */
import type { BlockKind } from "./levels";

export type BreakSound = "pop" | "tap" | "oops";

export interface MatInfo {
  /** 中文名,结算与提示里用 */
  label: string;
  /** 血量:越大越硬(石 > 木 > 冰 > 玻璃) */
  hp: number;
  /** 易碎系数:同样一撞,数值越大掉血越多(冰脆、石头闷) */
  vuln: number;
  /** 被撞飞的程度:石头几乎推不动,冰面滑得很 */
  push: number;
  /** 碎裂时飞出的小方块基础数量(画质自适应时按比例缩) */
  shards: number;
  /** 碎裂音效:脆的用 pop,闷的用 tap */
  sound: BreakSound;
  /** 落地摩擦系数(冰块几乎不减速) */
  friction: number;
  fill: string;
  edge: string;
}

/**
 * 材质表。hp / vuln / push / fill / edge 与 1.1 逐字节一致,
 * 1.2 新增 label / shards / sound / friction。
 */
export const MAT: Record<BlockKind, MatInfo> = {
  wood: {
    label: "木头",
    hp: 40,
    vuln: 1,
    push: 0.55,
    shards: 12,
    sound: "tap",
    friction: 6,
    fill: "#E8C08E",
    edge: "#C79A66"
  },
  stone: {
    label: "石头",
    hp: 90,
    vuln: 0.5,
    push: 0.28,
    shards: 16,
    sound: "oops",
    friction: 7,
    fill: "#CDD2DC",
    edge: "#A6ADBC"
  },
  ice: {
    label: "冰块",
    hp: 26,
    vuln: 1.5,
    push: 0.6,
    shards: 18,
    sound: "pop",
    friction: 0.9,
    fill: "rgba(190,230,255,0.88)",
    edge: "#8FC6E8"
  },
  glass: {
    label: "玻璃",
    hp: 14,
    vuln: 2.6,
    push: 0.7,
    shards: 20,
    sound: "pop",
    friction: 5,
    fill: "rgba(226,245,255,0.72)",
    edge: "#A5D8F0"
  },
  tnt: {
    label: "冲天炮",
    hp: 10,
    vuln: 2.2,
    push: 0.5,
    shards: 10,
    sound: "pop",
    friction: 6,
    fill: "#FFB3B9",
    edge: "#E2848D"
  },
  // 1.1 岩壳块:外壳厚实,碎一层后露出脆脆的晶核(两段连锁)
  shell: {
    label: "岩壳",
    hp: 62,
    vuln: 0.7,
    push: 0.3,
    shards: 14,
    sound: "tap",
    friction: 6.5,
    fill: "#B49A85",
    edge: "#846852"
  },
  core: {
    label: "晶核",
    hp: 16,
    vuln: 2.2,
    push: 0.6,
    shards: 18,
    sound: "pop",
    friction: 5,
    fill: "#FFD98E",
    edge: "#E0A452"
  }
};

/** 三种基础材质的硬度从软到硬,教练卡与单测都按这个顺序讲 */
export const HARDNESS_ORDER: BlockKind[] = ["glass", "tnt", "core", "ice", "wood", "shell", "stone"];

/** 硬度名次:0 最软。表之外的材质返回 -1 */
export function hardnessRank(kind: BlockKind): number {
  return HARDNESS_ORDER.indexOf(kind);
}

/* ------------------------------------------------------------------ */
/* 连锁倒塌                                                            */
/* ------------------------------------------------------------------ */

/**
 * 连锁传伤的门槛(px/s):塌下来的方块必须比下面那块快这么多,
 * 才算「砸」到它。低于门槛只是靠着,不掉血,免得静止的塔自己散架。
 * 1.1 是 260(只有被小鸟直接轰飞才传得动),1.2 调到 170:
 * 三层木塔抽掉底柱后,上层自由落体就能把下面压碎,倒塌真的会传递。
 */
export const CHAIN_MIN_SPEED = 170;
/** 传伤系数:超出门槛的每 px/s 相对速度换算成多少血 */
export const CHAIN_DAMAGE_K = 0.12;
/** 砸到地面的门槛与系数(1.1 原值) */
export const LAND_MIN_SPEED = 240;
export const LAND_DAMAGE_K = 0.18;

/**
 * 上面塌下来砸到下面:按相对速度给双方传伤。
 * 低于门槛返回 0(只是压着,不掉血)。
 */
export function chainDamage(relSpeed: number, vuln: number): number {
  return Math.max(0, relSpeed - CHAIN_MIN_SPEED) * CHAIN_DAMAGE_K * vuln;
}

/** 砸到地面 / 坡面的伤害:轻轻落地不掉血 */
export function landingDamage(impactSpeed: number, vuln: number): number {
  return Math.max(0, impactSpeed - LAND_MIN_SPEED) * LAND_DAMAGE_K * vuln;
}

/**
 * 细高块的倾倒加成:柱子越细越高,侧面挨一下越容易被推倒。
 * 返回 1 表示不加成(方方正正的块),最多 1.9 倍。
 */
export function toppleBoost(w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return 1;
  const slender = h / w;
  if (slender <= 1.6) return 1;
  return Math.min(1.9, 1 + (slender - 1.6) * 0.22);
}

/**
 * 碎裂碎片数:按材质基础数乘画质系数(reduced-motion 时传 0.35),
 * 至少留 3 片——粒子可以少,但「碎了」这件事必须看得见。
 */
export function shatterShards(kind: BlockKind, quality = 1): number {
  const base = MAT[kind]?.shards ?? 12;
  return Math.max(3, Math.round(base * Math.max(0, quality)));
}

/** 碎裂音效:脆材质 pop,闷材质 tap,石头 oops */
export function breakSound(kind: BlockKind): BreakSound {
  return MAT[kind]?.sound ?? "pop";
}
