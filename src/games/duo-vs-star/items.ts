/**
 * 朵朵大战星星 · 道具（纯数据 + 纯函数）。
 *
 * 道具从天上飘下来，碰到就立刻生效：有的让自己变强，有的给全场添点乱。
 * 全部是软乎乎的玩具道具，没有任何写实器械。
 */

/** 道具作用范围：自己 / 除自己以外的所有人 / 最近的一个对手 */
export type ItemTarget = "self" | "others" | "nearest";

export interface ItemDef {
  id: string;
  name: string;
  emoji: string;
  target: ItemTarget;
  /** 效果持续几秒（0 表示一次性生效） */
  duration: number;
  /** 出现权重，越大越常见 */
  weight: number;
  /** 一句话说明 */
  tip: string;
}

export const ITEMS: ItemDef[] = [
  {
    id: "hammer",
    name: "软软锤子",
    emoji: "🔨",
    target: "self",
    duration: 8,
    weight: 10,
    tip: "海绵做的大锤子，挥击力度差不多翻倍。",
  },
  {
    id: "springshoe",
    name: "弹簧鞋",
    emoji: "👟",
    target: "self",
    duration: 10,
    weight: 9,
    tip: "跳得更高，空中还能多跳两次。",
  },
  {
    id: "shield",
    name: "护盾泡泡",
    emoji: "🫧",
    target: "self",
    duration: 0,
    weight: 10,
    tip: "套一层泡泡，替你挡下接下来的几下。",
  },
  {
    id: "feather",
    name: "加速羽毛",
    emoji: "🪶",
    target: "self",
    duration: 8,
    weight: 9,
    tip: "跑动速度大幅提升，追人跑人都靠它。",
  },
  {
    id: "cookie",
    name: "大力饼干",
    emoji: "🍪",
    target: "self",
    duration: 10,
    weight: 8,
    tip: "吃完变沉，被撞飞的距离一下子短了很多。",
  },
  {
    id: "mushroom",
    name: "迷你蘑菇",
    emoji: "🍄",
    target: "self",
    duration: 9,
    weight: 6,
    tip: "缩小一圈，跑得飞快、也更容易被撞飞，敢不敢捡？",
  },
  {
    id: "honey",
    name: "蜂蜜罐",
    emoji: "🍯",
    target: "others",
    duration: 5,
    weight: 6,
    tip: "把别人脚下变得黏糊糊，跑起来慢半拍。",
  },
  {
    id: "icecream",
    name: "冰淇淋",
    emoji: "🍦",
    target: "nearest",
    duration: 1.6,
    weight: 6,
    tip: "最近的对手会原地打转，凉快一下下。",
  },
  {
    id: "balloon",
    name: "小气球",
    emoji: "🎈",
    target: "self",
    duration: 9,
    weight: 7,
    tip: "落得慢悠悠，被撞飞了也好往回飘。",
  },
  {
    id: "fountain",
    name: "星星喷泉",
    emoji: "🌟",
    target: "others",
    duration: 0,
    weight: 6,
    tip: "脚下喷出一圈星星，把身边的人轻轻推开。",
  },
  {
    id: "magnet",
    name: "吸铁石",
    emoji: "🧲",
    target: "self",
    duration: 8,
    weight: 5,
    tip: "附近的道具会自己飘过来。",
  },
  {
    id: "rainbow",
    name: "彩虹翅膀",
    emoji: "🌈",
    target: "self",
    duration: 0,
    weight: 5,
    tip: "一下子飞回场地正上方，救场专用。",
  },
  {
    id: "drum",
    name: "咚咚鼓",
    emoji: "🥁",
    target: "others",
    duration: 0,
    weight: 5,
    tip: "敲一下地面，站着的人都被震得跳起来。",
  },
  {
    id: "bell",
    name: "叮叮铃",
    emoji: "🔔",
    target: "self",
    duration: 0,
    weight: 5,
    tip: "叮的一声，自己的击退值直接减掉一半。",
  },
];

/** 按 id 找道具，找不到返回 null（调用方自己兜底） */
export function itemById(id: string): ItemDef | null {
  return ITEMS.find((i) => i.id === id) ?? null;
}

/**
 * 按权重抽一件道具。`allowed` 给关卡限定道具池（不给就是全都有）。
 * `roll` 传 0..1 的随机数，纯函数、可复现。
 */
export function rollItem(roll: number, allowed?: readonly string[]): ItemDef {
  const pool = allowed && allowed.length > 0 ? ITEMS.filter((i) => allowed.includes(i.id)) : ITEMS;
  const list = pool.length > 0 ? pool : ITEMS;
  const total = list.reduce((s, i) => s + i.weight, 0);
  const r = Math.min(0.999999, Math.max(0, Number.isFinite(roll) ? roll : 0)) * total;
  let acc = 0;
  for (const item of list) {
    acc += item.weight;
    if (r < acc) return item;
  }
  return list[list.length - 1];
}

/** 角色身上的增益状态（秒），battle.ts 每帧递减 */
export interface Buffs {
  /** 挥击力度加成剩余时间 */
  hammer: number;
  /** 跳跃加成剩余时间 */
  spring: number;
  /** 速度加成剩余时间 */
  fast: number;
  /** 变沉剩余时间 */
  heavy: number;
  /** 变小剩余时间 */
  mini: number;
  /** 被蜂蜜黏住剩余时间 */
  slow: number;
  /** 原地打转剩余时间 */
  dizzy: number;
  /** 缓降剩余时间 */
  float: number;
  /** 吸铁石剩余时间 */
  magnet: number;
}

export function emptyBuffs(): Buffs {
  return {
    hammer: 0,
    spring: 0,
    fast: 0,
    heavy: 0,
    mini: 0,
    slow: 0,
    dizzy: 0,
    float: 0,
    magnet: 0,
  };
}

/** 每帧把所有增益倒计时减掉 dt，减到 0 为止 */
export function tickBuffs(b: Buffs, dt: number): Buffs {
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const out = { ...b };
  for (const key of Object.keys(out) as Array<keyof Buffs>) {
    out[key] = Math.max(0, out[key] - step);
  }
  return out;
}

/** 综合增益后的挥击力度倍率 */
export function powerMul(b: Buffs): number {
  return b.hammer > 0 ? 1.9 : 1;
}

/** 综合增益后的跑动速度倍率 */
export function speedMul(b: Buffs): number {
  let m = 1;
  if (b.fast > 0) m *= 1.4;
  if (b.mini > 0) m *= 1.25;
  if (b.slow > 0) m *= 0.6;
  if (b.dizzy > 0) m = 0;
  return m;
}

/** 综合增益后的跳跃力倍率 */
export function jumpMul(b: Buffs): number {
  return b.spring > 0 ? 1.25 : 1;
}

/** 综合增益后的体重倍率（越大越难被撞飞） */
export function weightMul(b: Buffs): number {
  let m = 1;
  if (b.heavy > 0) m *= 1.35;
  if (b.mini > 0) m *= 0.7;
  return m;
}

/** 空中多出来的跳跃次数 */
export function extraAirJumps(b: Buffs): number {
  let n = 0;
  if (b.spring > 0) n += 2;
  if (b.float > 0) n += 1;
  return n;
}

/** 下落速度倍率（小气球让人飘着落） */
export function fallMul(b: Buffs): number {
  return b.float > 0 ? 0.55 : 1;
}
