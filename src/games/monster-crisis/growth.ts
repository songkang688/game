// 小怪物危机 —— 关内成长「三选一」(纯函数,不碰 DOM)。
//
// 1.1 的升级是三条常驻科技线,颜料线利滚利,先点它永远不亏 —— 没有取舍就没有 build 感。
// 1.2 改成:每清 3 波发一次三选一,从五张成长卡里按稀有度抽,同一次不出重复、
// 叠满的卡自动退出卡池。抽卡只吃一个 seed,同一局同一次抽到的三张永远一样(可回放、可测)。
//
// 五张卡刻意做成「互相搭台」而不是「谁碾压谁」:
//   范围+ 让多向+ 的散射真能覆盖到人,吸附+ 让站桩输出变成跑位收集,
//   护盾泡把「被撞」从打断变成消耗,攻速+ 单卡最强但叠满只有三层。

import { mulberry32 } from "./logic";

export type GrowthId = "range" | "rapid" | "multi" | "magnet" | "shield";

export interface GrowthCard {
  id: GrowthId;
  name: string;
  emoji: string;
  /** 一句话说明:孩子看得懂,不写百分比黑话 */
  desc: string;
  /** 1 = 常见, 2 = 少见, 3 = 稀有;越稀有越难抽到 */
  rarity: 1 | 2 | 3;
  /** 最多叠几层,叠满就不再进卡池 */
  max: number;
}

export const GROWTH_CARDS: Record<GrowthId, GrowthCard> = {
  range: {
    id: "range",
    name: "长手刷",
    emoji: "🖌️",
    desc: "颜料弹飞得更远,站远一点也够得着。",
    rarity: 1,
    max: 3,
  },
  rapid: {
    id: "rapid",
    name: "快手腕",
    emoji: "⚡",
    desc: "甩得更快,一口气多甩好几下。",
    rarity: 1,
    max: 3,
  },
  multi: {
    id: "multi",
    name: "多彩喷",
    emoji: "🎆",
    desc: "一次甩出好几发,像小扇子一样铺开。",
    rarity: 3,
    max: 2,
  },
  magnet: {
    id: "magnet",
    name: "吸吸糖",
    emoji: "🧲",
    desc: "掉在地上的元气糖会自己飞过来。",
    rarity: 2,
    max: 3,
  },
  shield: {
    id: "shield",
    name: "护盾泡",
    emoji: "🫧",
    desc: "身上多一个泡泡,被撞一下先破泡泡。",
    rarity: 2,
    max: 2,
  },
};

export const GROWTH_IDS: GrowthId[] = ["range", "rapid", "multi", "magnet", "shield"];

export type GrowthState = Record<GrowthId, number>;

export function emptyGrowth(): GrowthState {
  return { range: 0, rapid: 0, multi: 0, magnet: 0, shield: 0 };
}

/** 稀有度换成抽奖权重:常见 6 份、少见 3 份、稀有 1 份。 */
export function cardWeight(rarity: 1 | 2 | 3): number {
  return rarity === 1 ? 6 : rarity === 2 ? 3 : 1;
}

/** 还没叠满的卡才进卡池。 */
export function availableCards(taken: GrowthState): GrowthCard[] {
  return GROWTH_IDS.filter((id) => (taken[id] ?? 0) < GROWTH_CARDS[id].max).map((id) => GROWTH_CARDS[id]);
}

/**
 * 抽三张:按权重不放回地抽,所以同一次一定不出重复;
 * 卡池不够三张就有几张给几张(全叠满时返回空数组,调用方直接跳过这次成长)。
 */
export function rollGrowth(seed: number, taken: GrowthState, count = 3): GrowthCard[] {
  const rand = mulberry32(seed >>> 0);
  const pool = availableCards(taken);
  const out: GrowthCard[] = [];
  while (out.length < count && pool.length > 0) {
    let total = 0;
    for (const c of pool) total += cardWeight(c.rarity);
    let roll = rand() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= cardWeight(pool[i].rarity);
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

/** 吃下一张卡(纯函数:返回新状态,不改原来的)。叠满了就原样返回。 */
export function applyGrowth(state: GrowthState, id: GrowthId): GrowthState {
  const next: GrowthState = { ...state };
  if (next[id] < GROWTH_CARDS[id].max) next[id] = next[id] + 1;
  return next;
}

/** 清完第几波该发成长:每 3 波一次。 */
export function shouldOfferGrowth(wavesCleared: number): boolean {
  return wavesCleared > 0 && wavesCleared % 3 === 0;
}

/** 同一局里第 n 次三选一用的种子:局种子 + 次数,回放时能对上。 */
export function growthSeed(runSeed: number, draftIndex: number): number {
  return (runSeed ^ ((draftIndex + 1) * 0x9e3779b9)) >>> 0;
}

/* ------------------------------------------------------------------ */
/* 成长 → 手感数值                                                      */
/* ------------------------------------------------------------------ */

/** 主角的基础手感:射程、装填、发数、吸附半径、护盾泡个数。 */
export const HERO_BASE = {
  /** 颜料弹能飞多远(场地单位;场地宽 360) */
  reach: 118,
  /** 两发之间隔多久(秒) */
  reload: 0.46,
  /** 出手前摇(秒):看得见抬手才有「打中了」的实感 */
  windup: 0.1,
  /** 一次甩几发 */
  shots: 1,
  /** 多发时相邻两发的夹角(弧度) */
  spread: 0.26,
  /** 元气糖的吸附半径 */
  magnet: 24,
  /** 身上能挂几个护盾泡 */
  shields: 0,
  /** 破掉的护盾泡多久鼓回来(秒) */
  shieldRecharge: 9,
  /** 每发颜料弹的上色量 */
  damage: 4,
  /** 走位速度(单位/秒) */
  speed: 96,
} as const;

export interface HeroStats {
  reach: number;
  reload: number;
  windup: number;
  shots: number;
  spread: number;
  magnet: number;
  shields: number;
  shieldRecharge: number;
  damage: number;
  speed: number;
}

/**
 * 把成长状态换算成实际手感。
 * 攻速最猛但只有三层,多向每层多一发但很稀有,两张一起吃才是真的「铺满屏」。
 */
export function heroStats(state: GrowthState): HeroStats {
  const range = state.range ?? 0;
  const rapid = state.rapid ?? 0;
  const multi = state.multi ?? 0;
  const magnet = state.magnet ?? 0;
  const shield = state.shield ?? 0;
  return {
    reach: HERO_BASE.reach * (1 + 0.28 * range),
    reload: HERO_BASE.reload * Math.pow(0.82, rapid),
    windup: HERO_BASE.windup,
    shots: HERO_BASE.shots + multi,
    spread: HERO_BASE.spread,
    magnet: HERO_BASE.magnet + 26 * magnet,
    shields: shield,
    shieldRecharge: HERO_BASE.shieldRecharge,
    damage: HERO_BASE.damage,
    speed: HERO_BASE.speed,
  };
}

/** 顶部那一行成长图标:吃过的卡按顺序排出来,没吃过的不占位。 */
export function growthBadges(state: GrowthState): string[] {
  const out: string[] = [];
  for (const id of GROWTH_IDS) {
    const n = state[id] ?? 0;
    if (n > 0) out.push(`${GROWTH_CARDS[id].emoji}${n}`);
  }
  return out;
}
