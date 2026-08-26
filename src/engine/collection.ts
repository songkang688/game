/**
 * 收藏册:人物 / 宠物 / 装备(1.1 第 6 步新增,跨游戏通用)。
 *
 * 三条铁律:
 *  1. **只用星星解锁**——星星就是 `save.ts` 里那个现成钱包,没有内购、没有广告;
 *  2. **不动老存档**——`yiduo-yixing.save.v1` 的字段含义一个都不改,
 *     收藏数据自己开一个新 key `yiduo-yixing.collection.v1`;
 *  3. **加成必须温和**——全套满级对任何一项属性的总加成都不超过基础值的 +35%,
 *     免得没攒够星星的孩子觉得自己被挡在门外。这条有单测盯着(见 `maxBonus`)。
 *
 * 属性一律用**千分之一**的整数存(66 就是 +6.6%),避免小数相加的浮点误差,
 * 也让「不超过 350」这种上限断言可以写得干干净净。
 */
import type { StorageLike } from "./save";
import { save } from "./save";

/** 收藏数据自己的存档 key(只增不改,老 key 一个都不碰) */
export const COLLECTION_KEY = "yiduo-yixing.collection.v1";

/** 每件收藏品最高能升到第几级 */
export const MAX_LEVEL = 3;

/** 全套满级后,单项属性的总加成上限(千分之一;350 = +35%) */
export const BONUS_CAP_PERMILLE = 350;

// ---------------------------------------------------------------------------
// 属性与槽位
// ---------------------------------------------------------------------------

export type StatKey = "speed" | "jump" | "magnet" | "coin" | "luck";

export const STAT_KEYS: readonly StatKey[] = ["speed", "jump", "magnet", "coin", "luck"];

export const STAT_LABELS: Record<StatKey, string> = {
  speed: "速度",
  jump: "弹跳",
  magnet: "吸金范围",
  coin: "金币收益",
  luck: "好运"
};

/** 每升一级增加多少(千分之一);没写的项就是 0 */
export type StatBlock = Partial<Record<StatKey, number>>;

/** 算好的总加成(千分之一) */
export type Bonus = Record<StatKey, number>;

export type ItemKind = "hero" | "pet" | "gear";

/** 装备槽:一个槽同时只能穿一件 */
export const GEAR_SLOTS = ["shoes", "cape", "hat", "goggles", "gloves", "scarf"] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];

export type SlotId = "hero" | "pet" | GearSlot;

export const SLOT_IDS: readonly SlotId[] = ["hero", "pet", ...GEAR_SLOTS];

export const SLOT_LABELS: Record<SlotId, string> = {
  hero: "人物",
  pet: "宠物",
  shoes: "鞋",
  cape: "披风",
  hat: "帽子",
  goggles: "护目镜",
  gloves: "手套",
  scarf: "围巾"
};

/** 宠物的一次性被动(不按百分比算,单独一档) */
export type PerkId = "revive" | "startShield";

/** 起步无敌每级多少毫秒(满级正好 2.4 秒,再多就不温和了) */
export const START_SHIELD_MS_PER_LEVEL = 800;

export interface CollectionItem {
  id: string;
  kind: ItemKind;
  slot: SlotId;
  name: string;
  /** 卡片上那句介绍 */
  blurb: string;
  /** 解锁要花多少星星;0 = 一开始就跟着你 */
  cost: number;
  /** 每升一级增加的属性(千分之一) */
  stats: StatBlock;
  /** 宠物专属的一次性被动 */
  perk?: PerkId;
  /** 画小人时的主色与配色(纯 Canvas 绘制,不用任何外部图片) */
  color: string;
  color2: string;
}

// ---------------------------------------------------------------------------
// 图鉴数据:全部本作原创,不沾任何商标与别家官方角色名
// ---------------------------------------------------------------------------

export const HEROES: readonly CollectionItem[] = [
  {
    id: "duoduo",
    kind: "hero",
    slot: "hero",
    name: "朵朵",
    blurb: "扎双马尾的小队长,起跑前总要把鞋带系两遍。",
    cost: 0,
    stats: { coin: 5, luck: 4 },
    color: "#ff9ec4",
    color2: "#fff0f6"
  },
  {
    id: "xingxing",
    kind: "hero",
    slot: "hero",
    name: "星星",
    blurb: "背蓝书包的短跑手,最爱在下坡那一段加速。",
    cost: 0,
    stats: { speed: 5, jump: 4 },
    color: "#6ec1ff",
    color2: "#eaf6ff"
  },
  {
    id: "nuonuo",
    kind: "hero",
    slot: "hero",
    name: "糯糯",
    blurb: "米糕铺子里长大的小妹妹,口袋里永远备着零钱。",
    cost: 60,
    stats: { magnet: 6, coin: 3 },
    color: "#ffd9a0",
    color2: "#fff7ea"
  },
  {
    id: "yunyun",
    kind: "hero",
    slot: "hero",
    name: "云云",
    blurb: "轻得像一片云,落地几乎听不见声音。",
    cost: 90,
    stats: { jump: 6, speed: 3 },
    color: "#c9b8ff",
    color2: "#f4f0ff"
  },
  {
    id: "dundun",
    kind: "hero",
    slot: "hero",
    name: "墩墩",
    blurb: "肩宽腿稳的小力士,再颠簸的路面也站得住。",
    cost: 120,
    stats: { coin: 6, luck: 3 },
    color: "#8fd6a6",
    color2: "#effaf2"
  },
  {
    id: "shanshan",
    kind: "hero",
    slot: "hero",
    name: "闪闪",
    blurb: "跑起来辫子甩出一道残影的急性子。",
    cost: 150,
    stats: { speed: 6, magnet: 3 },
    color: "#ffe066",
    color2: "#fffbe0"
  }
];

export const PETS: readonly CollectionItem[] = [
  {
    id: "lvludou",
    kind: "pet",
    slot: "pet",
    name: "绿绿豆",
    blurb: "豆荚小松鼠,把金币当松果收,方圆一圈都逃不掉。",
    cost: 80,
    stats: { magnet: 66 },
    color: "#9ede7a",
    color2: "#f0fbe8"
  },
  {
    id: "jiujiu",
    kind: "pet",
    slot: "pet",
    name: "啾啾",
    blurb: "圆头小黄鸟,总在头顶盘旋,起跳时替你托一把。",
    cost: 100,
    stats: { jump: 20 },
    color: "#ffd93d",
    color2: "#fff9db"
  },
  {
    id: "paopao",
    kind: "pet",
    slot: "pet",
    name: "泡泡",
    blurb: "半透明的小水母,出发时罩一层泡泡,前两秒撞什么都不怕。",
    cost: 120,
    stats: {},
    perk: "startShield",
    color: "#8ee6ea",
    color2: "#e9fbfc"
  },
  {
    id: "mianmian",
    kind: "pet",
    slot: "pet",
    name: "绵绵",
    blurb: "棉花小兔,摔倒时铺成一团软垫,一局能接住你一次。",
    cost: 140,
    stats: {},
    perk: "revive",
    color: "#ffc2d6",
    color2: "#fff2f6"
  },
  {
    id: "nuannuan",
    kind: "pet",
    slot: "pet",
    name: "暖暖",
    blurb: "小火狐,尾巴一扫,捡到的金币会多出一点点。",
    cost: 160,
    stats: { coin: 40 },
    color: "#ffa86b",
    color2: "#fff1e6"
  },
  {
    id: "dingding",
    kind: "pet",
    slot: "pet",
    name: "叮叮",
    blurb: "戴铃铛的小花猫,铃声一响,好运就往你这边偏一偏。",
    cost: 180,
    stats: { luck: 40 },
    color: "#c3a6ff",
    color2: "#f3eeff"
  }
];

export const GEARS: readonly CollectionItem[] = [
  {
    id: "shoes-cloud",
    kind: "gear",
    slot: "shoes",
    name: "云朵跑鞋",
    blurb: "鞋底软得像踩着云,蹬地更省力。",
    cost: 50,
    stats: { speed: 8 },
    color: "#bfe3ff",
    color2: "#ffffff"
  },
  {
    id: "shoes-spring",
    kind: "gear",
    slot: "shoes",
    name: "弹簧短靴",
    blurb: "靴底两根小弹簧,起跳时高出一小截。",
    cost: 70,
    stats: { jump: 10 },
    color: "#ffb3c7",
    color2: "#ffffff"
  },
  {
    id: "cape-star",
    kind: "gear",
    slot: "cape",
    name: "星屑披风",
    blurb: "跑起来会掉星屑,风阻也小一些。",
    cost: 90,
    stats: { speed: 6, luck: 6 },
    color: "#a5b8ff",
    color2: "#e9edff"
  },
  {
    id: "cape-leaf",
    kind: "gear",
    slot: "cape",
    name: "叶脉斗篷",
    blurb: "叶脉里缝着小口袋,金币一枚都不会漏。",
    cost: 110,
    stats: { coin: 10 },
    color: "#8fd6a6",
    color2: "#e6f7ec"
  },
  {
    id: "hat-straw",
    kind: "gear",
    slot: "hat",
    name: "草编凉帽",
    blurb: "编帽子的草是自己在坡上割回来的。",
    cost: 60,
    stats: { luck: 10 },
    color: "#e8cf94",
    color2: "#fbf3dd"
  },
  {
    id: "hat-crown",
    kind: "gear",
    slot: "hat",
    name: "糖霜小皇冠",
    blurb: "赛道尽头发的纪念品,结算金币时更划算。",
    cost: 130,
    stats: { coin: 8, luck: 4 },
    color: "#ffd966",
    color2: "#fff6d5"
  },
  {
    id: "goggles-rainbow",
    kind: "gear",
    slot: "goggles",
    name: "彩虹护目镜",
    blurb: "镜片会给金币描一圈光,老远就看得见。",
    cost: 100,
    stats: { magnet: 12 },
    color: "#7fd8ff",
    color2: "#ffe0f0"
  },
  {
    id: "goggles-night",
    kind: "gear",
    slot: "goggles",
    name: "夜光护目镜",
    blurb: "夜路也看得清,岔口不容易选错。",
    cost: 120,
    stats: { magnet: 8, luck: 6 },
    color: "#9be8c9",
    color2: "#e6fff5"
  },
  {
    id: "gloves-mitten",
    kind: "gear",
    slot: "gloves",
    name: "毛线手套",
    blurb: "抓横杆不打滑,手心也不出汗。",
    cost: 80,
    stats: { coin: 6, speed: 4 },
    color: "#ffb4a2",
    color2: "#ffeee9"
  },
  {
    id: "scarf-candy",
    kind: "gear",
    slot: "scarf",
    name: "糖果围巾",
    blurb: "像尾巴一样甩在身后,轻飘飘地带着人往上跳。",
    cost: 95,
    stats: { jump: 6, magnet: 6 },
    color: "#ff9ec4",
    color2: "#ffe3ef"
  }
];

/** 全部收藏品,顺序固定:人物 → 宠物 → 装备 */
export const ITEMS: readonly CollectionItem[] = [...HEROES, ...PETS, ...GEARS];

const ITEM_BY_ID = new Map<string, CollectionItem>(ITEMS.map((it) => [it.id, it]));

/** 按 id 找收藏品;找不到返回 null */
export function itemById(id: string): CollectionItem | null {
  return ITEM_BY_ID.get(id) ?? null;
}

/** 某个槽位里的全部收藏品(顺序与图鉴一致) */
export function itemsInSlot(slot: SlotId): CollectionItem[] {
  return ITEMS.filter((it) => it.slot === slot);
}

/** 某一类的全部收藏品 */
export function itemsOfKind(kind: ItemKind): CollectionItem[] {
  return ITEMS.filter((it) => it.kind === kind);
}

/** 开局就跟着你的那两位(朵朵和星星),不花星星 */
export const STARTER_IDS: readonly string[] = ITEMS.filter((it) => it.cost === 0).map(
  (it) => it.id
);

// ---------------------------------------------------------------------------
// 花费
// ---------------------------------------------------------------------------

/** 解锁要花多少星星 */
export function unlockCost(item: CollectionItem): number {
  return Math.max(0, Math.round(item.cost));
}

/**
 * 从 `fromLevel` 升到下一级要花多少星星。
 * 越贵的收藏品升级越贵,但起步价压在 20 颗,保证白送的朵朵和星星也能慢慢练。
 */
export function upgradeCost(item: CollectionItem, fromLevel: number): number {
  const lv = Math.min(MAX_LEVEL - 1, Math.max(1, Math.floor(fromLevel) || 1));
  return Math.round((unlockCost(item) + 40) * 0.5) * lv;
}

/** 从没有到满级一共要花多少星星 */
export function totalCost(item: CollectionItem): number {
  let sum = unlockCost(item);
  for (let lv = 1; lv < MAX_LEVEL; lv++) sum += upgradeCost(item, lv);
  return sum;
}

// ---------------------------------------------------------------------------
// 加成计算
// ---------------------------------------------------------------------------

export function emptyBonus(): Bonus {
  return { speed: 0, jump: 0, magnet: 0, coin: 0, luck: 0 };
}

/** 某件收藏品在某一级时的加成(千分之一) */
export function statsAtLevel(item: CollectionItem, level: number): Bonus {
  const out = emptyBonus();
  const lv = Math.min(MAX_LEVEL, Math.max(0, Math.floor(level) || 0));
  if (lv <= 0) return out;
  for (const key of STAT_KEYS) {
    const per = item.stats[key];
    if (typeof per === "number" && Number.isFinite(per)) out[key] = Math.round(per) * lv;
  }
  return out;
}

/** 把若干份加成加在一起 */
export function sumBonus(parts: readonly Bonus[]): Bonus {
  const out = emptyBonus();
  for (const part of parts) {
    for (const key of STAT_KEYS) out[key] += part[key];
  }
  return out;
}

/**
 * 理论上限:每个槽都挑该项属性最强的一件、并且全部升到满级。
 * 一个槽只穿一件,所以逐项取各槽最大值就是真正能达到的最大值。
 */
export function maxBonus(): Bonus {
  const out = emptyBonus();
  for (const slot of SLOT_IDS) {
    const pool = itemsInSlot(slot);
    for (const key of STAT_KEYS) {
      let best = 0;
      for (const item of pool) {
        const per = item.stats[key];
        if (typeof per === "number" && per > best) best = per;
      }
      out[key] += Math.round(best) * MAX_LEVEL;
    }
  }
  return out;
}

/**
 * 各项属性折成一个「综合强度」时的权重(和为 1)。
 * 单项上限之外再看一眼综合值,免得五项各卡在上限、合起来还是变成付费墙。
 */
export const STAT_WEIGHTS: Record<StatKey, number> = {
  speed: 0.25,
  jump: 0.2,
  magnet: 0.2,
  coin: 0.2,
  luck: 0.15
};

/** 综合强度提升(千分之一) */
export function overallGain(bonus: Bonus): number {
  let sum = 0;
  for (const key of STAT_KEYS) sum += bonus[key] * STAT_WEIGHTS[key];
  return Math.round(sum);
}

/** 千分之一转成好读的百分比文字:66 → "6.6%",240 → "24%" */
export function formatPermille(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const pct = v / 10;
  const text = Math.abs(pct - Math.round(pct)) < 1e-9 ? String(Math.round(pct)) : pct.toFixed(1);
  return `${text}%`;
}

/** 一件收藏品在某一级的加成文字,例如「速度 +1.5%、好运 +1.8%」 */
export function describeStats(item: CollectionItem, level: number): string {
  const bonus = statsAtLevel(item, level);
  const parts: string[] = [];
  for (const key of STAT_KEYS) {
    if (bonus[key] > 0) parts.push(`${STAT_LABELS[key]} +${formatPermille(bonus[key])}`);
  }
  if (item.perk === "revive") parts.push("摔倒后能接住一次");
  if (item.perk === "startShield") {
    const ms = START_SHIELD_MS_PER_LEVEL * Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
    parts.push(`起步无敌 ${(ms / 1000).toFixed(1)} 秒`);
  }
  return parts.length > 0 ? parts.join("、") : "陪你一起跑";
}

// ---------------------------------------------------------------------------
// 存档:坏数据降级为默认,隐私模式降级为内存(与 save.ts 同口径)
// ---------------------------------------------------------------------------

export interface CollectionData {
  /** 收藏品 id → 等级(1..MAX_LEVEL);不在表里就是还没解锁 */
  levels: Record<string, number>;
  /** 槽位 → 正在穿戴的收藏品 id */
  equipped: Partial<Record<SlotId, string>>;
}

export function defaultCollection(): CollectionData {
  const levels: Record<string, number> = {};
  for (const id of STARTER_IDS) levels[id] = 1;
  return { levels, equipped: { hero: "duoduo" } };
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()]
  };
}

function pickStorage(): StorageLike {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      // 隐私模式下读写会抛异常,先探一次;探测 key 以 .probe 结尾,不会混进备份
      const probe = "yiduo-yixing.collection.probe";
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    // 落到内存存储:这一局照样能试穿,只是关掉页面不留痕
  }
  return createMemoryStorage();
}

/** 坏数据一律降级:认不出的 id、越界的等级、穿着没解锁的东西,全部丢掉 */
export function sanitizeCollection(raw: unknown): CollectionData {
  const data = defaultCollection();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return data;
  const obj = raw as Record<string, unknown>;

  const levels = obj.levels;
  if (typeof levels === "object" && levels !== null && !Array.isArray(levels)) {
    for (const [id, value] of Object.entries(levels as Record<string, unknown>)) {
      if (!ITEM_BY_ID.has(id)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const lv = Math.min(MAX_LEVEL, Math.floor(value));
      if (lv < 1) continue;
      data.levels[id] = Math.max(data.levels[id] ?? 0, lv);
    }
  }

  const equipped = obj.equipped;
  if (typeof equipped === "object" && equipped !== null && !Array.isArray(equipped)) {
    for (const slot of SLOT_IDS) {
      const id = (equipped as Record<string, unknown>)[slot];
      if (typeof id !== "string") continue;
      const item = ITEM_BY_ID.get(id);
      if (!item || item.slot !== slot) continue;
      if (!data.levels[id]) continue;
      data.equipped[slot] = id;
    }
  }

  // 人物槽永远得有人站着,不然画不出小人
  const hero = data.equipped.hero;
  if (!hero || !data.levels[hero]) data.equipped.hero = "duoduo";
  return data;
}

/** 写成稳定文本(key 排过序,同一份收藏永远得到同一段文字) */
export function serializeCollection(data: CollectionData): string {
  const levels: Record<string, number> = {};
  for (const id of Object.keys(data.levels).sort()) {
    const lv = data.levels[id];
    if (typeof lv === "number" && lv >= 1) levels[id] = Math.min(MAX_LEVEL, Math.floor(lv));
  }
  const equipped: Record<string, string> = {};
  for (const slot of SLOT_IDS) {
    const id = data.equipped[slot];
    if (typeof id === "string") equipped[slot] = id;
  }
  return JSON.stringify({ v: 1, levels, equipped });
}

/** 从文本读回来;读不动就当没存过 */
export function parseCollection(text: string | null | undefined): CollectionData {
  if (!text) return defaultCollection();
  try {
    return sanitizeCollection(JSON.parse(text));
  } catch {
    return defaultCollection();
  }
}

// ---------------------------------------------------------------------------
// 穿戴结果
// ---------------------------------------------------------------------------

export interface Loadout {
  hero: CollectionItem;
  pet: CollectionItem | null;
  gear: CollectionItem[];
  /** 上面这些各自是几级 */
  levels: Record<string, number>;
}

/** 游戏侧直接拿来用的乘数(1.08 = 比基础值高 8%) */
export interface CollectionEffects {
  speedMul: number;
  jumpMul: number;
  magnetMul: number;
  coinMul: number;
  luckMul: number;
  /** 摔倒后能不能接住一次 */
  reviveOnce: boolean;
  /** 起步无敌毫秒数 */
  startShieldMs: number;
}

export function effectsFrom(bonus: Bonus, perks: PerkState): CollectionEffects {
  return {
    speedMul: 1 + bonus.speed / 1000,
    jumpMul: 1 + bonus.jump / 1000,
    magnetMul: 1 + bonus.magnet / 1000,
    coinMul: 1 + bonus.coin / 1000,
    luckMul: 1 + bonus.luck / 1000,
    reviveOnce: perks.reviveOnce,
    startShieldMs: perks.startShieldMs
  };
}

export interface PerkState {
  reviveOnce: boolean;
  startShieldMs: number;
}

export function emptyPerks(): PerkState {
  return { reviveOnce: false, startShieldMs: 0 };
}

/** 宠物带来的一次性效果(只有正在陪跑的那只算数) */
export function perksOf(pet: CollectionItem | null, level: number): PerkState {
  const out = emptyPerks();
  if (!pet) return out;
  const lv = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
  if (pet.perk === "revive") out.reviveOnce = true;
  if (pet.perk === "startShield") out.startShieldMs = START_SHIELD_MS_PER_LEVEL * lv;
  return out;
}

// ---------------------------------------------------------------------------
// 买卖结果
// ---------------------------------------------------------------------------

export type BuyReason =
  /** 成了 */
  | "ok"
  /** 没有这件收藏品 */
  | "unknown"
  /** 已经有了 */
  | "owned"
  /** 还没解锁 */
  | "locked"
  /** 已经满级 */
  | "max"
  /** 星星不够 */
  | "poor";

export interface BuyResult {
  ok: boolean;
  reason: BuyReason;
  /** 花掉的星星(没成交就是 0) */
  spent: number;
  /** 交易后的星星余额 */
  stars: number;
  /** 交易后的等级(0 = 还没解锁) */
  level: number;
}

/** 收藏册要用到的钱包能力,方便单测塞一个假钱包进来 */
export interface Wallet {
  getStars(): number;
  addStars(n: number): number;
}

// ---------------------------------------------------------------------------
// 存档仓库
// ---------------------------------------------------------------------------

export class CollectionStore {
  private data: CollectionData;
  private listeners = new Set<() => void>();

  constructor(
    private readonly wallet: Wallet = save,
    private readonly storage: StorageLike = pickStorage()
  ) {
    this.data = this.load();
  }

  private load(): CollectionData {
    try {
      return parseCollection(this.storage.getItem(COLLECTION_KEY));
    } catch {
      return defaultCollection();
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(COLLECTION_KEY, serializeCollection(this.data));
    } catch {
      // 存储满 / 被禁用时静默失败,这一局照样能玩
    }
    for (const fn of this.listeners) fn();
  }

  /** 订阅收藏变化(面板刷新用),返回取消订阅函数 */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** 现在有多少星星 */
  stars(): number {
    try {
      return Math.max(0, Math.floor(this.wallet.getStars()));
    } catch {
      return 0;
    }
  }

  /** 这件收藏品是几级(0 = 还没解锁) */
  getLevel(id: string): number {
    return this.data.levels[id] ?? 0;
  }

  isUnlocked(id: string): boolean {
    return this.getLevel(id) > 0;
  }

  /** 全部已解锁的 id,按图鉴顺序 */
  unlockedIds(): string[] {
    return ITEMS.filter((it) => this.isUnlocked(it.id)).map((it) => it.id);
  }

  private result(reason: BuyReason, spent: number, id: string): BuyResult {
    return {
      ok: reason === "ok",
      reason,
      spent,
      stars: this.stars(),
      level: this.getLevel(id)
    };
  }

  /** 花星星解锁一件收藏品 */
  unlock(id: string): BuyResult {
    const item = itemById(id);
    if (!item) return this.result("unknown", 0, id);
    if (this.isUnlocked(id)) return this.result("owned", 0, id);
    const cost = unlockCost(item);
    if (this.stars() < cost) return this.result("poor", 0, id);
    if (cost > 0) this.wallet.addStars(-cost);
    this.data.levels[id] = 1;
    this.persist();
    return this.result("ok", cost, id);
  }

  /** 花星星升一级 */
  upgrade(id: string): BuyResult {
    const item = itemById(id);
    if (!item) return this.result("unknown", 0, id);
    const level = this.getLevel(id);
    if (level <= 0) return this.result("locked", 0, id);
    if (level >= MAX_LEVEL) return this.result("max", 0, id);
    const cost = upgradeCost(item, level);
    if (this.stars() < cost) return this.result("poor", 0, id);
    if (cost > 0) this.wallet.addStars(-cost);
    this.data.levels[id] = level + 1;
    this.persist();
    return this.result("ok", cost, id);
  }

  /** 试穿:只有解锁过的才穿得上 */
  equip(id: string): boolean {
    const item = itemById(id);
    if (!item || !this.isUnlocked(id)) return false;
    if (this.data.equipped[item.slot] === id) return true;
    this.data.equipped[item.slot] = id;
    this.persist();
    return true;
  }

  /** 脱下来(人物槽不能空着,会被忽略) */
  unequip(slot: SlotId): boolean {
    if (slot === "hero") return false;
    if (!this.data.equipped[slot]) return false;
    delete this.data.equipped[slot];
    this.persist();
    return true;
  }

  equippedId(slot: SlotId): string | null {
    return this.data.equipped[slot] ?? null;
  }

  isEquipped(id: string): boolean {
    const item = itemById(id);
    return !!item && this.data.equipped[item.slot] === id;
  }

  /** 现在这一身:人物 + 宠物 + 装备 */
  loadout(): Loadout {
    const heroId = this.data.equipped.hero ?? "duoduo";
    const hero = itemById(heroId) ?? (HEROES[0] as CollectionItem);
    const petId = this.data.equipped.pet ?? null;
    const pet = petId ? itemById(petId) : null;
    const gear: CollectionItem[] = [];
    for (const slot of GEAR_SLOTS) {
      const id = this.data.equipped[slot];
      const item = id ? itemById(id) : null;
      if (item) gear.push(item);
    }
    const levels: Record<string, number> = {};
    for (const item of [hero, pet, ...gear]) {
      if (item) levels[item.id] = this.getLevel(item.id) || 1;
    }
    return { hero, pet, gear, levels };
  }

  /** 现在这一身的总加成(千分之一) */
  bonus(): Bonus {
    const { hero, pet, gear, levels } = this.loadout();
    const parts: Bonus[] = [statsAtLevel(hero, levels[hero.id] ?? 1)];
    if (pet) parts.push(statsAtLevel(pet, levels[pet.id] ?? 1));
    for (const item of gear) parts.push(statsAtLevel(item, levels[item.id] ?? 1));
    return sumBonus(parts);
  }

  perks(): PerkState {
    const { pet, levels } = this.loadout();
    return perksOf(pet, pet ? (levels[pet.id] ?? 1) : 0);
  }

  /** 游戏侧直接拿去乘的那几个数 */
  effects(): CollectionEffects {
    return effectsFrom(this.bonus(), this.perks());
  }

  /** 当前收藏的快照(只读副本) */
  snapshot(): CollectionData {
    return { levels: { ...this.data.levels }, equipped: { ...this.data.equipped } };
  }

  /** 导出成稳定文本(序列化往返用) */
  serialize(): string {
    return serializeCollection(this.data);
  }

  /** 从文本读回来;坏文本会整体降级成默认收藏 */
  restore(text: string | null | undefined): void {
    this.data = parseCollection(text);
    this.persist();
  }

  /** 只清收藏,不动星星钱包 */
  resetAll(): void {
    this.data = defaultCollection();
    try {
      this.storage.removeItem(COLLECTION_KEY);
    } catch {
      // 删不掉就算了,下次写入会覆盖
    }
    for (const fn of this.listeners) fn();
  }
}

/** 全局单例:面板和各游戏共用同一本收藏册 */
export const collection = new CollectionStore();

/** 任何游戏都可以直接拿这一份加成(没解锁任何东西时就是一串 1) */
export function collectionEffects(): CollectionEffects {
  return collection.effects();
}
