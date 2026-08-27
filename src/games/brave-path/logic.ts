/**
 * 勇者小路 —— 养成与模式逻辑（纯函数 + 纯数据，不碰 DOM）。
 *
 * 管四件事：
 *  1. 勇者成长：等级、经验、金币、技能点、装备四个槽（武器 / 护甲 / 挂饰 / 属性徽章）；
 *  2. 有限背包：出发前只能带 4 格道具，仓库里剩下的这一趟就用不上；
 *  3. 无尽深渊：越往下越难，走不动了就是「探险结束 · 回城休息」；
 *  4. 康康的队伍：三对三接力自动对战，配装改一改结果就会变。
 */
import {
  BAG_SLOTS,
  type BagSlot,
  type Element,
  type Fighter,
  type FighterSpec,
  ITEMS,
  MAX_SKILL_RANK,
  SKILLS,
  cloneFighter,
  makeFighter,
  mulberry32,
  simulateTeamBattle,
  type TeamBattleResult
} from "./combat";

// ---------------------------------------------------------------------------
// 勇者等级与基础数值
// ---------------------------------------------------------------------------

export const MAX_HERO_LEVEL = 60;

/** 从 lv 升到 lv+1 需要的经验 */
export function expToNext(level: number): number {
  const lv = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.round(level)));
  if (lv >= MAX_HERO_LEVEL) return Number.POSITIVE_INFINITY;
  return 64 + lv * 12;
}

export interface BaseStats {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
}

/** 光着身子的勇者在 lv 级时的数值（装备加成另算） */
export function baseHeroStats(level: number): BaseStats {
  const lv = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.round(level)));
  return {
    maxHp: Math.round(70 + (lv - 1) * 10),
    atk: Math.round(11 + (lv - 1) * 2),
    def: Math.round(4 + (lv - 1) * 1),
    spd: Math.round(11 + (lv - 1) * 0.3),
    crit: 0.08
  };
}

// ---------------------------------------------------------------------------
// 装备
// ---------------------------------------------------------------------------

export type GearSlot = "weapon" | "armor" | "charm" | "badge";

export interface GearDef {
  id: string;
  slot: GearSlot;
  name: string;
  emoji: string;
  /** 买它需要的勇者等级 */
  reqLevel: number;
  price: number;
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  crit?: number;
  /** 属性徽章专用：决定勇者出招的属性 */
  element?: Element;
  desc: string;
}

export const GEARS: GearDef[] = [
  // ---- 武器 ----
  { id: "w1", slot: "weapon", name: "木枝小剑", emoji: "🪵", reqLevel: 1, price: 0, atk: 0, desc: "出门前在院子里捡的，轻是真的轻。" },
  { id: "w2", slot: "weapon", name: "花铃短刃", emoji: "🌸", reqLevel: 8, price: 120, atk: 8, desc: "挥起来叮当响，攻击力 +8。" },
  { id: "w3", slot: "weapon", name: "溪石长剑", emoji: "🗡️", reqLevel: 16, price: 300, atk: 17, desc: "溪水磨了好多年的石头，攻击力 +17。" },
  { id: "w4", slot: "weapon", name: "熔纹弯刀", emoji: "🔥", reqLevel: 26, price: 620, atk: 26, crit: 0.03, desc: "刀身有暖暖的纹路，攻击力 +26，暴击 +3%。" },
  { id: "w5", slot: "weapon", name: "霜糖细剑", emoji: "❄️", reqLevel: 38, price: 1100, atk: 35, crit: 0.05, desc: "冰冰凉凉的一柄细剑，攻击力 +35，暴击 +5%。" },
  { id: "w6", slot: "weapon", name: "星辉长锋", emoji: "✨", reqLevel: 50, price: 1900, atk: 44, crit: 0.08, desc: "剑刃上有会流动的星光，攻击力 +44，暴击 +8%。" },
  // ---- 护甲 ----
  { id: "a1", slot: "armor", name: "布片小衣", emoji: "👕", reqLevel: 1, price: 0, desc: "妈妈缝的小衣服，穿着舒服。" },
  { id: "a2", slot: "armor", name: "藤叶软甲", emoji: "🌿", reqLevel: 8, price: 130, hp: 30, def: 4, desc: "星芒上限 +30，防御 +4。" },
  { id: "a3", slot: "armor", name: "贝壳胸铠", emoji: "🐚", reqLevel: 16, price: 320, hp: 70, def: 9, desc: "星芒上限 +70，防御 +9。" },
  { id: "a4", slot: "armor", name: "熔岩护胸", emoji: "🧱", reqLevel: 26, price: 660, hp: 110, def: 13, desc: "星芒上限 +110，防御 +13。" },
  { id: "a5", slot: "armor", name: "霜羽披风", emoji: "🕊️", reqLevel: 38, price: 1150, hp: 150, def: 18, desc: "星芒上限 +150，防御 +18。" },
  { id: "a6", slot: "armor", name: "星辉战衣", emoji: "🌟", reqLevel: 50, price: 1950, hp: 190, def: 22, desc: "星芒上限 +190，防御 +22。" },
  // ---- 挂饰 ----
  { id: "c1", slot: "charm", name: "小草结", emoji: "🍀", reqLevel: 1, price: 0, desc: "随手打的一个结，图个吉利。" },
  { id: "c2", slot: "charm", name: "露珠坠", emoji: "💧", reqLevel: 8, price: 110, atk: 2, def: 1, spd: 1, desc: "全面小幅提升。" },
  { id: "c3", slot: "charm", name: "蜜蜡铃", emoji: "🔔", reqLevel: 16, price: 290, atk: 3, def: 2, spd: 1, crit: 0.02, desc: "多一点暴击机会。" },
  { id: "c4", slot: "charm", name: "火纹符", emoji: "🎴", reqLevel: 26, price: 600, atk: 5, def: 3, spd: 2, crit: 0.03, desc: "越打越有劲。" },
  { id: "c5", slot: "charm", name: "霜花簪", emoji: "🌨️", reqLevel: 38, price: 1080, atk: 6, def: 4, spd: 3, crit: 0.045, desc: "速度提升明显，容易抢到先手。" },
  { id: "c6", slot: "charm", name: "星辉之心", emoji: "💠", reqLevel: 50, price: 1850, atk: 8, def: 6, spd: 4, crit: 0.06, desc: "所有数值都往上抬一截。" },
  // ---- 属性徽章：决定你出招的属性，配装的核心选择 ----
  { id: "b-grass", slot: "badge", name: "草叶徽章", emoji: "🌿", reqLevel: 1, price: 0, element: "grass", atk: 1, desc: "出招变成草系。草克水，被火克。" },
  { id: "b-fire", slot: "badge", name: "火苗徽章", emoji: "🔥", reqLevel: 1, price: 60, element: "fire", atk: 1, desc: "出招变成火系。火克草，被水克。" },
  { id: "b-water", slot: "badge", name: "水滴徽章", emoji: "💧", reqLevel: 1, price: 60, element: "water", atk: 1, desc: "出招变成水系。水克火，被草克。" },
  { id: "b-light", slot: "badge", name: "光点徽章", emoji: "✨", reqLevel: 4, price: 90, element: "light", atk: 1, desc: "出招变成光系。光与暗互相克制。" },
  { id: "b-dark", slot: "badge", name: "月牙徽章", emoji: "🌙", reqLevel: 4, price: 90, element: "dark", atk: 1, desc: "出招变成暗系。暗与光互相克制。" }
];

export function gearById(id: string): GearDef | undefined {
  return GEARS.find((g) => g.id === id);
}

export function gearsOfSlot(slot: GearSlot): GearDef[] {
  return GEARS.filter((g) => g.slot === slot);
}

/** 一开始就白送的四件（每个槽最便宜的那件） */
export const STARTER_GEAR: Record<GearSlot, string> = {
  weapon: "w1",
  armor: "a1",
  charm: "c1",
  badge: "b-grass"
};

// ---------------------------------------------------------------------------
// 技能解锁
// ---------------------------------------------------------------------------

export interface SkillUnlock {
  id: string;
  reqLevel: number;
  /** 学会它要花几点技能点 */
  cost: number;
}

export const SKILL_UNLOCKS: SkillUnlock[] = [
  { id: "gustStep", reqLevel: 1, cost: 1 },
  { id: "petalSlash", reqLevel: 3, cost: 1 },
  { id: "emberDance", reqLevel: 6, cost: 1 },
  { id: "dewSplash", reqLevel: 9, cost: 1 },
  { id: "crackHammer", reqLevel: 12, cost: 2 },
  { id: "warmSong", reqLevel: 15, cost: 2 },
  { id: "moonVeil", reqLevel: 18, cost: 2 },
  { id: "starPoke", reqLevel: 22, cost: 2 },
  { id: "braveHorn", reqLevel: 26, cost: 2 },
  { id: "chimeBreak", reqLevel: 31, cost: 3 },
  { id: "tideCall", reqLevel: 37, cost: 3 },
  { id: "duskFang", reqLevel: 44, cost: 3 },
  { id: "sunBloom", reqLevel: 52, cost: 4 }
];

/** 升 1 级技能要花几点（等级越高越贵） */
export function rankUpCost(currentRank: number): number {
  return Math.max(1, Math.round(currentRank));
}

/** 战斗时最多能带几个技能 */
export const LOADOUT_SLOTS = 4;

/** 每升一级勇者送几点技能点 */
export const SKILL_POINTS_PER_LEVEL = 1;

// ---------------------------------------------------------------------------
// 存档
// ---------------------------------------------------------------------------

export interface HeroSave {
  v: 1;
  level: number;
  exp: number;
  coins: number;
  skillPoints: number;
  /** 已学技能 id → 等级（1..5） */
  ranks: Record<string, number>;
  /** 上阵技能（最多 4 个） */
  loadout: string[];
  gear: Record<GearSlot, string>;
  owned: string[];
  /** 带上路的道具（最多 4 格） */
  bag: BagSlot[];
  /** 仓库里的道具 */
  stash: Record<string, number>;
  /** 对战模式的两位同伴 */
  party: string[];
  endlessBest: number;
  arenaWins: number;
  arenaPlays: number;
}

export const SAVE_KEY = "yiduo-yixing.bravepath";

export function defaultSave(): HeroSave {
  return {
    v: 1,
    level: 1,
    exp: 0,
    coins: 40,
    skillPoints: 1,
    ranks: {},
    loadout: [],
    gear: { ...STARTER_GEAR },
    owned: [STARTER_GEAR.weapon, STARTER_GEAR.armor, STARTER_GEAR.charm, STARTER_GEAR.badge],
    bag: [{ id: "berry", count: 2 }],
    stash: { berry: 1 },
    party: ["nuonuo", "yunyun"],
    endlessBest: 0,
    arenaWins: 0,
    arenaPlays: 0
  };
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/** 把任何来路不明的存档整理成合法形状（纯函数，坏数据一律回落到默认值） */
export function migrateSave(parsed: unknown): HeroSave {
  const base = defaultSave();
  if (typeof parsed !== "object" || parsed === null) return base;
  const raw = parsed as Record<string, unknown>;

  const level = num(raw.level, base.level, 1, MAX_HERO_LEVEL);
  const ranks: Record<string, number> = {};
  if (typeof raw.ranks === "object" && raw.ranks !== null) {
    for (const [id, v] of Object.entries(raw.ranks as Record<string, unknown>)) {
      if (!SKILLS[id]) continue;
      ranks[id] = num(v, 1, 1, MAX_SKILL_RANK);
    }
  }
  const owned = Array.isArray(raw.owned)
    ? (raw.owned as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(gearById(x)))
    : [];
  for (const id of Object.values(STARTER_GEAR)) if (!owned.includes(id)) owned.push(id);

  const gear: Record<GearSlot, string> = { ...STARTER_GEAR };
  if (typeof raw.gear === "object" && raw.gear !== null) {
    for (const slot of ["weapon", "armor", "charm", "badge"] as GearSlot[]) {
      const id = (raw.gear as Record<string, unknown>)[slot];
      const def = typeof id === "string" ? gearById(id) : undefined;
      if (def && def.slot === slot && owned.includes(def.id)) gear[slot] = def.id;
    }
  }

  const loadout = Array.isArray(raw.loadout)
    ? (raw.loadout as unknown[])
        .filter((x): x is string => typeof x === "string" && Boolean(SKILLS[x]) && ranks[x] > 0)
        .slice(0, LOADOUT_SLOTS)
    : [];

  const stash: Record<string, number> = {};
  if (typeof raw.stash === "object" && raw.stash !== null) {
    for (const [id, v] of Object.entries(raw.stash as Record<string, unknown>)) {
      if (!ITEMS[id]) continue;
      stash[id] = num(v, 0, 0, 99);
    }
  }

  const bag: BagSlot[] = Array.isArray(raw.bag)
    ? (raw.bag as unknown[])
        .map((x) => {
          if (typeof x !== "object" || x === null) return null;
          const s = x as Record<string, unknown>;
          if (typeof s.id !== "string" || !ITEMS[s.id]) return null;
          const count = num(s.count, 0, 0, 9);
          return count > 0 ? { id: s.id, count } : null;
        })
        .filter((x): x is BagSlot => x !== null)
        .slice(0, BAG_SLOTS)
    : base.bag;

  const party = Array.isArray(raw.party)
    ? (raw.party as unknown[])
        .filter((x): x is string => typeof x === "string" && COMPANIONS.some((c) => c.id === x))
        .slice(0, 2)
    : base.party;
  while (party.length < 2) {
    const next = COMPANIONS.find((c) => !party.includes(c.id));
    if (!next) break;
    party.push(next.id);
  }

  return {
    v: 1,
    level,
    exp: num(raw.exp, 0, 0, 9_999_999),
    coins: num(raw.coins, base.coins, 0, 9_999_999),
    skillPoints: num(raw.skillPoints, base.skillPoints, 0, 999),
    ranks,
    loadout,
    gear,
    owned,
    bag,
    stash,
    party,
    endlessBest: num(raw.endlessBest, 0, 0, 9999),
    arenaWins: num(raw.arenaWins, 0, 0, 999999),
    arenaPlays: num(raw.arenaPlays, 0, 0, 999999)
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const memoryStore = new Map<string, string>();

function pickStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) return ls;
  } catch {
    // 隐私模式：这一趟的进度只留在内存里
  }
  return null;
}

export function loadSave(storage?: StorageLike | null): HeroSave {
  const store = pickStorage(storage);
  try {
    const raw = store ? store.getItem(SAVE_KEY) : memoryStore.get(SAVE_KEY) ?? null;
    if (!raw) return defaultSave();
    return migrateSave(JSON.parse(raw) as unknown);
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: HeroSave, storage?: StorageLike | null): void {
  const store = pickStorage(storage);
  try {
    const raw = JSON.stringify(save);
    if (store) store.setItem(SAVE_KEY, raw);
    else memoryStore.set(SAVE_KEY, raw);
  } catch {
    // 存不进去也不影响继续玩
  }
}

// ---------------------------------------------------------------------------
// 成长运算（全部返回新的存档对象）
// ---------------------------------------------------------------------------

export interface ExpResult {
  save: HeroSave;
  levelsGained: number;
}

/** 吃经验，够了就升级；每升一级送 1 点技能点。满级后经验不再累计 */
export function gainExp(save: HeroSave, exp: number): ExpResult {
  const next: HeroSave = { ...save, ranks: { ...save.ranks } };
  const add = Number.isFinite(exp) ? Math.max(0, Math.round(exp)) : 0;
  next.exp += add;
  let gained = 0;
  while (next.level < MAX_HERO_LEVEL && next.exp >= expToNext(next.level)) {
    next.exp -= expToNext(next.level);
    next.level += 1;
    next.skillPoints += SKILL_POINTS_PER_LEVEL;
    gained += 1;
  }
  if (next.level >= MAX_HERO_LEVEL) next.exp = 0;
  return { save: next, levelsGained: gained };
}

export function gainCoins(save: HeroSave, coins: number): HeroSave {
  const add = Number.isFinite(coins) ? Math.round(coins) : 0;
  return { ...save, coins: Math.max(0, Math.min(9_999_999, save.coins + add)) };
}

export type BuyResult = { ok: true; save: HeroSave } | { ok: false; reason: string };

export function buyGear(save: HeroSave, gearId: string): BuyResult {
  const def = gearById(gearId);
  if (!def) return { ok: false, reason: "小摊上没有这件东西。" };
  if (save.owned.includes(gearId)) return { ok: false, reason: "这件你已经有啦。" };
  if (save.level < def.reqLevel) return { ok: false, reason: `要到 ${def.reqLevel} 级才拿得动。` };
  if (save.coins < def.price) return { ok: false, reason: `还差 ${def.price - save.coins} 枚金币。` };
  return {
    ok: true,
    save: { ...save, coins: save.coins - def.price, owned: [...save.owned, gearId] }
  };
}

export function equipGear(save: HeroSave, gearId: string): HeroSave {
  const def = gearById(gearId);
  if (!def || !save.owned.includes(gearId)) return save;
  return { ...save, gear: { ...save.gear, [def.slot]: gearId } };
}

export type LearnResult = { ok: true; save: HeroSave } | { ok: false; reason: string };

/** 学一个新技能（第一次学）或者给已学技能升一级 */
export function learnSkill(save: HeroSave, skillId: string): LearnResult {
  const unlock = SKILL_UNLOCKS.find((u) => u.id === skillId);
  if (!unlock || !SKILLS[skillId]) return { ok: false, reason: "还没有这个招式。" };
  if (save.level < unlock.reqLevel) return { ok: false, reason: `要到 ${unlock.reqLevel} 级才学得会。` };
  const current = save.ranks[skillId] ?? 0;
  if (current >= MAX_SKILL_RANK) return { ok: false, reason: "这一招已经练到顶啦。" };
  const cost = current === 0 ? unlock.cost : rankUpCost(current);
  if (save.skillPoints < cost) return { ok: false, reason: `还差 ${cost - save.skillPoints} 点技能点。` };
  const ranks = { ...save.ranks, [skillId]: current + 1 };
  const loadout = save.loadout.slice();
  if (current === 0 && loadout.length < LOADOUT_SLOTS) loadout.push(skillId);
  return { ok: true, save: { ...save, skillPoints: save.skillPoints - cost, ranks, loadout } };
}

/**
 * 学会一招之后，身上至少留一招。
 *
 * 技能栏本来能一个一个卸干净。卸干净之后康康那边照样带三个随等级涨阶的技能，
 * 鸭梨只剩平砍——20 级的擂台胜率从 20/20 掉到 4/20，而孩子从界面上看不出
 * 是自己把招式卸光了，只会觉得「这游戏突然打不赢了」。
 */
export const MIN_LOADOUT = 1;

/** 现在还能不能再卸一招下来（身上只剩一招时不行） */
export function canUnequip(save: HeroSave): boolean {
  return save.loadout.length > MIN_LOADOUT;
}

/** 上阵 / 下阵一个技能（最多 4 个，至少留 1 个），返回新存档 */
export function toggleLoadout(save: HeroSave, skillId: string): HeroSave {
  if (!(save.ranks[skillId] > 0)) return save;
  if (save.loadout.includes(skillId)) {
    if (!canUnequip(save)) return save;
    return { ...save, loadout: save.loadout.filter((id) => id !== skillId) };
  }
  if (save.loadout.length >= LOADOUT_SLOTS) return save;
  return { ...save, loadout: [...save.loadout, skillId] };
}

/** 仓库里某个道具还剩几个 */
export function stashCount(save: HeroSave, itemId: string): number {
  return Math.max(0, save.stash[itemId] ?? 0);
}

/** 背包里已经占了几格 */
export function bagUsedSlots(save: HeroSave): number {
  return save.bag.filter((s) => s.count > 0).length;
}

/** 往仓库里放道具（宝箱、买东西都走它） */
export function addToStash(save: HeroSave, itemId: string, count = 1): HeroSave {
  if (!ITEMS[itemId]) return save;
  const n = Math.max(0, Math.round(count));
  if (n === 0) return save;
  return { ...save, stash: { ...save.stash, [itemId]: Math.min(99, stashCount(save, itemId) + n) } };
}

export type BagResult = { ok: true; save: HeroSave } | { ok: false; reason: string };

/** 从仓库拿一个道具塞进背包；背包格子满了就拿不了，这是要做取舍的地方 */
export function carryItem(save: HeroSave, itemId: string): BagResult {
  if (!ITEMS[itemId]) return { ok: false, reason: "没有这样的道具。" };
  if (stashCount(save, itemId) <= 0) return { ok: false, reason: "仓库里没有了。" };
  const bag = save.bag.map((s) => ({ ...s }));
  const slot = bag.find((s) => s.id === itemId);
  if (!slot && bagUsedSlots(save) >= BAG_SLOTS) {
    return { ok: false, reason: `背包只有 ${BAG_SLOTS} 格，先放回去一样再拿。` };
  }
  if (slot) slot.count = Math.min(9, slot.count + 1);
  else bag.push({ id: itemId, count: 1 });
  return {
    ok: true,
    save: { ...save, bag, stash: { ...save.stash, [itemId]: stashCount(save, itemId) - 1 } }
  };
}

/** 把背包里的一个道具放回仓库 */
export function unpackItem(save: HeroSave, itemId: string): HeroSave {
  const bag = save.bag.map((s) => ({ ...s }));
  const slot = bag.find((s) => s.id === itemId);
  if (!slot || slot.count <= 0) return save;
  slot.count -= 1;
  return {
    ...save,
    bag: bag.filter((s) => s.count > 0),
    stash: { ...save.stash, [itemId]: Math.min(99, stashCount(save, itemId) + 1) }
  };
}

/** 一趟冒险回来，把背包里剩下的道具数量写回存档 */
export function syncBagAfterRun(save: HeroSave, bag: BagSlot[]): HeroSave {
  const clean = bag
    .filter((s) => ITEMS[s.id] && s.count > 0)
    .slice(0, BAG_SLOTS)
    .map((s) => ({ id: s.id, count: Math.max(0, Math.min(9, Math.round(s.count))) }));
  return { ...save, bag: clean };
}

// ---------------------------------------------------------------------------
// 把存档变成一个能上场的勇者
// ---------------------------------------------------------------------------

export interface HeroSummary extends BaseStats {
  element: Element;
}

/** 算上装备之后的最终数值 */
export function heroStats(save: HeroSave): HeroSummary {
  const base = baseHeroStats(save.level);
  let { maxHp, atk, def, spd, crit } = base;
  let element: Element = "grass";
  for (const slot of ["weapon", "armor", "charm", "badge"] as GearSlot[]) {
    const g = gearById(save.gear[slot]);
    if (!g) continue;
    maxHp += g.hp ?? 0;
    atk += g.atk ?? 0;
    def += g.def ?? 0;
    spd += g.spd ?? 0;
    crit += g.crit ?? 0;
    if (g.element) element = g.element;
  }
  return {
    maxHp: Math.round(maxHp),
    atk: Math.round(atk),
    def: Math.round(def),
    spd: Math.round(spd),
    crit: Math.max(0, Math.min(1, Math.round(crit * 1000) / 1000)),
    element
  };
}

/** 一个粗略的「战力」数字，只用来给孩子一个直观对比 */
export function powerScore(stats: BaseStats): number {
  return Math.round(stats.maxHp * 0.5 + stats.atk * 6 + stats.def * 5 + stats.spd * 2 + stats.crit * 220);
}

export const HERO_NAME = "鸭梨";
export const HERO_EMOJI = "🌸";

/** 造一个能直接上场的勇者（hp 传进来就是带伤续战，不传就是满状态） */
export function buildHero(save: HeroSave, hp?: number): Fighter {
  const s = heroStats(save);
  return makeFighter({
    name: HERO_NAME,
    emoji: HERO_EMOJI,
    element: s.element,
    maxHp: s.maxHp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    crit: s.crit,
    skills: save.loadout
      .filter((id) => SKILLS[id] && save.ranks[id] > 0)
      .slice(0, LOADOUT_SLOTS)
      .map((id) => ({ id, rank: save.ranks[id] })),
    bag: save.bag.map((s2) => ({ ...s2 })),
    hp
  });
}

// ---------------------------------------------------------------------------
// 无尽深渊
// ---------------------------------------------------------------------------

/** 第 depth 层（1 起）大致相当于战役第几关的强度 */
export function endlessTier(depth: number): number {
  const d = Math.max(1, Math.round(depth));
  return Math.min(187, Math.round((d - 1) * 2.1));
}

/** 深渊每深一层，对手强 4.5% */
export const ENDLESS_GROWTH = 1.045;

/**
 * 第一位守关排在第 4 层。
 *
 * 之前是「每 8 层一位」，可 1 级的鸭梨大概第 4 层就走不动了——
 * 第一次下深渊的孩子永远见不到守关长什么样，也就体会不到
 * 「练一练能多走几层」的那个甜头。挪到第 4 层，第一趟就撞得上。
 */
export const FIRST_GUARDIAN = 4;

/** 第 4 层来第一位，之后每 8 层一位 */
export function isEndlessGuardian(depth: number): boolean {
  const d = Math.max(1, Math.round(depth));
  return d === FIRST_GUARDIAN || d % 8 === 0;
}

/** 守关比同层的小怪厚多少倍：浅层薄一点，第 16 层起满厚 */
export const GUARDIAN_THICK_MIN = 1.5;
export const GUARDIAN_THICK_MAX = 2.3;
export const GUARDIAN_FULL_DEPTH = 16;

/**
 * 第 depth 层守关的厚度倍率。
 *
 * 第 4 层那位要是照原来的 2.3 倍配，就成了一堵谁也翻不过的墙——
 * 「见得着」得配上「偶尔打得赢」才算数。所以浅层的守关薄一档，
 * 一路爬到第 16 层回到原来的 2.3 倍，深层的分量一点没少。
 */
export function guardianThickness(depth: number): number {
  const d = Math.max(1, Math.round(depth));
  const span = GUARDIAN_FULL_DEPTH - FIRST_GUARDIAN;
  const k = Math.min(1, Math.max(0, (d - FIRST_GUARDIAN) / span));
  return GUARDIAN_THICK_MIN + (GUARDIAN_THICK_MAX - GUARDIAN_THICK_MIN) * k;
}

const ENDLESS_NAMES = ["苔绒小兽", "雾气小灯", "回音蝙蝠", "石纹小龟", "碎星飞虫", "藤影守卫"];
const ENDLESS_EMOJI = ["🧸", "🏮", "🦇", "🐢", "💫", "🌿"];
const ENDLESS_ELEMENTS: Element[] = ["fire", "water", "grass", "light", "dark"];

/** 深渊第 depth 层的对手 */
export function endlessFoeSpec(depth: number): FighterSpec {
  const d = Math.max(1, Math.round(depth));
  const rng = mulberry32((d * 2654435761) >>> 0);
  const tier = endlessTier(d);
  const guardian = isEndlessGuardian(d);
  const idx = Math.floor(rng() * ENDLESS_NAMES.length) % ENDLESS_NAMES.length;
  const element = ENDLESS_ELEMENTS[Math.floor(rng() * ENDLESS_ELEMENTS.length) % ENDLESS_ELEMENTS.length];
  // 深渊是复利式变难：每深一层强 4.5%。祝福也是复利，所以曲线必须比祝福更陡，
  // 不然攒够祝福的勇者就能一直走下去，「无尽」也就不成立了。
  const boost = Math.pow(ENDLESS_GROWTH, d - 1);
  const cap = (n: number): number => Math.min(9_999_999, Math.round(n));
  const base = {
    maxHp: cap((36 + tier * 1.92) * (guardian ? guardianThickness(d) : 1) * boost),
    atk: cap((9.5 + tier * 0.63) * (guardian ? 1.15 : 1) * boost),
    def: cap((2 + tier * 0.16) * (guardian ? 1.35 : 1) * boost),
    spd: Math.round(9 + tier * 0.09)
  };
  const rank = Math.max(1, Math.min(5, 1 + Math.floor(d / 12)));
  const skillPool: Record<Element, string[]> = {
    fire: ["emberDance", "crackHammer"],
    water: ["dewSplash", "tideCall"],
    grass: ["gustStep", "petalSlash"],
    light: ["starPoke", "chimeBreak"],
    dark: ["moonVeil", "duskFang"]
  };
  return {
    name: `${guardian ? "深渊守门的" : "第 " + d + " 层的"}${ENDLESS_NAMES[idx]}`,
    emoji: ENDLESS_EMOJI[idx],
    element,
    maxHp: base.maxHp,
    atk: base.atk,
    def: base.def,
    spd: base.spd,
    crit: guardian ? 0.1 : 0.06,
    skills: d >= 4 ? skillPool[element].slice(0, guardian ? 2 : 1).map((id) => ({ id, rank })) : [],
    weakness: guardian ? ENDLESS_ELEMENTS[(idx + 2) % ENDLESS_ELEMENTS.length] : null,
    isBoss: guardian,
    boss: guardian
      ? {
          chargeEvery: 3,
          chargePower: 1.85,
          chargeName: "深渊回响",
          shieldEvery: 4,
          shieldAmount: Math.round(base.maxHp * 0.14)
        }
      : null
  };
}

/** 打完第 depth 层拿多少金币 */
export function endlessCoins(depth: number): number {
  const d = Math.max(1, Math.round(depth));
  return Math.round((10 + d * 2.2) * (isEndlessGuardian(d) ? 2.5 : 1));
}

/** 一趟深渊结束后换多少经验 */
export function endlessExp(depth: number): number {
  const d = Math.max(0, Math.round(depth));
  return Math.round(d * (10 + d * 0.35));
}

/** 一趟深渊结束后给平台钱包加几颗小星星（最多 5 颗，不刷星） */
export function endlessStarReward(depth: number, best: number): number {
  const d = Math.max(0, Math.round(depth));
  if (d <= 0) return 0;
  let n = d >= 24 ? 4 : d >= 16 ? 3 : d >= 8 ? 2 : 1;
  if (d > best) n += 1;
  return Math.min(5, n);
}

/** 探险结束时的说法：只说累了要回城，绝不写受伤 */
export function endlessEndText(depth: number, best: number): string {
  const d = Math.max(0, Math.round(depth));
  if (d <= 0) return "刚下到第一层就折返啦，整理一下装备再来一趟吧！";
  if (d > best) return `探险结束 · 回城休息。这一趟走到了第 ${d} 层，是新纪录！`;
  return `探险结束 · 回城休息。这一趟走到了第 ${d} 层，最好成绩是第 ${best} 层。`;
}

// ---- 深渊祝福：每打完几层挑一个，选择本身就是策略 ----

export type BlessingKind = "heal" | "maxhp" | "atk" | "def" | "crit" | "coins";

export interface Blessing {
  id: string;
  kind: BlessingKind;
  name: string;
  emoji: string;
  amount: number;
  desc: string;
}

const BLESSING_POOL: Blessing[] = [
  { id: "bl-heal", kind: "heal", name: "温泉小憩", emoji: "♨️", amount: 0.4, desc: "立刻回复最大星芒的 40%。" },
  { id: "bl-hp", kind: "maxhp", name: "结实果子", emoji: "🍎", amount: 0.14, desc: "星芒上限 +14%，并回满这部分。" },
  { id: "bl-atk", kind: "atk", name: "锋利磨石", emoji: "🪨", amount: 0.16, desc: "攻击力 +16%。" },
  { id: "bl-def", kind: "def", name: "厚实叶垫", emoji: "🍂", amount: 0.22, desc: "防御力 +22%。" },
  { id: "bl-crit", kind: "crit", name: "幸运铃铛", emoji: "🔔", amount: 0.06, desc: "暴击率 +6%。" },
  { id: "bl-coin", kind: "coins", name: "散落金币", emoji: "🪙", amount: 60, desc: "立刻捡到 60 枚金币。" }
];

/** 每隔几层给一次祝福 */
export const BLESSING_EVERY = 3;

export function isBlessingFloor(depth: number): boolean {
  const d = Math.max(1, Math.round(depth));
  return d % BLESSING_EVERY === 0;
}

/** 星芒掉到这个比例以下，两个祝福里保证有一个能立刻补回来 */
export const BLESSING_RESCUE_FRAC = 0.35;

function healsUp(b: Blessing): boolean {
  return b.kind === "heal" || b.kind === "maxhp";
}

/**
 * 抽两个不一样的祝福让玩家二选一（同 depth + 同星芒比例结果固定）。
 *
 * `hpFrac` 是现在的星芒比例。快见底的时候还只给「攻击 + 暴击」两个选项，
 * 等于逼孩子带着 20% 的星芒继续下潜，下一层多半就被送回城了——
 * 这种时候一定留一个回复位，让「稳一手」始终是个能选的选择。
 */
export function rollBlessings(depth: number, hpFrac = 1): Blessing[] {
  const rng = mulberry32((Math.max(1, Math.round(depth)) * 40503 + 7) >>> 0);
  const pool = BLESSING_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const pick = pool.slice(0, 2);
  if (hpFrac <= BLESSING_RESCUE_FRAC && !pick.some(healsUp)) {
    const rescue = BLESSING_POOL.find(healsUp) as Blessing;
    pick[1] = rescue;
  }
  return pick;
}

/** 把祝福作用在勇者身上（纯函数，返回新的 Fighter） */
export function applyBlessing(hero: Fighter, blessing: Blessing): Fighter {
  const next = cloneFighter(hero);
  switch (blessing.kind) {
    case "heal":
      next.hp = Math.min(next.maxHp, next.hp + Math.round(next.maxHp * blessing.amount));
      break;
    case "maxhp": {
      const add = Math.max(1, Math.round(next.maxHp * blessing.amount));
      next.maxHp += add;
      next.hp = Math.min(next.maxHp, next.hp + add);
      break;
    }
    case "atk":
      next.atk = Math.max(1, Math.round(next.atk * (1 + blessing.amount)));
      break;
    case "def":
      next.def = Math.max(0, Math.round(next.def * (1 + blessing.amount)));
      break;
    case "crit":
      next.crit = Math.max(0, Math.min(1, Math.round((next.crit + blessing.amount) * 1000) / 1000));
      break;
    case "coins":
    default:
      break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// 对战：我的队伍 VS 康康的队伍
// ---------------------------------------------------------------------------

export interface CompanionDef {
  id: string;
  name: string;
  emoji: string;
  element: Element;
  /** 相对勇者基础数值的倍率 */
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  skills: string[];
  desc: string;
}

/** 六位可以组队的小伙伴，全部是本作原创角色 */
export const COMPANIONS: CompanionDef[] = [
  {
    id: "nuonuo",
    name: "糯糯",
    emoji: "🍡",
    element: "grass",
    hp: 1.1,
    atk: 0.86,
    def: 1.2,
    spd: 0.85,
    crit: 0.05,
    skills: ["petalSlash", "warmSong"],
    desc: "软软糯糯特别耐打，会唱暖心歌给自己回星芒。"
  },
  {
    id: "yunyun",
    name: "云云",
    emoji: "☁️",
    element: "light",
    hp: 0.92,
    atk: 1.0,
    def: 0.9,
    spd: 1.1,
    crit: 0.1,
    skills: ["starPoke", "chimeBreak"],
    desc: "光系的破盾好手，对手一张盾她就来劲。"
  },
  {
    id: "dundun",
    name: "墩墩",
    emoji: "🧱",
    element: "fire",
    hp: 1.25,
    atk: 0.92,
    def: 1.3,
    spd: 0.7,
    crit: 0.04,
    skills: ["crackHammer", "braveHorn"],
    desc: "站在最前面最合适，慢是慢了点，但真的很稳。"
  },
  {
    id: "shanshan",
    name: "闪闪",
    emoji: "⚡",
    element: "light",
    hp: 0.82,
    atk: 1.14,
    def: 0.78,
    spd: 1.35,
    crit: 0.16,
    skills: ["gustStep", "sunBloom"],
    desc: "全场最快，几乎每回合都抢先手，但不太扛打。"
  },
  {
    id: "lvlvdou",
    name: "绿绿豆",
    emoji: "🫛",
    element: "grass",
    hp: 1.0,
    atk: 1.02,
    def: 0.95,
    spd: 1.05,
    crit: 0.09,
    skills: ["gustStep", "petalSlash"],
    desc: "草系全能选手，冷却短，连招打得很顺。"
  },
  {
    id: "jiujiu",
    name: "啾啾",
    emoji: "🐤",
    element: "water",
    hp: 0.9,
    atk: 1.12,
    def: 0.84,
    spd: 1.18,
    crit: 0.12,
    skills: ["dewSplash", "tideCall"],
    desc: "水系爆发很高，潮汐唤一放出来对面就得掂量掂量。"
  }
];

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

/** 按勇者当前水平造一位同伴 */
export function buildCompanion(id: string, heroLevel: number, scale = 1): Fighter {
  const def = companionById(id) ?? COMPANIONS[0];
  const base = baseHeroStats(heroLevel);
  const rank = Math.max(1, Math.min(MAX_SKILL_RANK, 1 + Math.floor(heroLevel / 14)));
  return makeFighter({
    name: def.name,
    emoji: def.emoji,
    element: def.element,
    maxHp: Math.round(base.maxHp * def.hp * scale),
    atk: Math.round(base.atk * def.atk * scale),
    def: Math.round(base.def * def.def * scale),
    spd: Math.round(base.spd * def.spd),
    crit: def.crit,
    skills: def.skills.map((sid) => ({ id: sid, rank }))
  });
}

export const RIVAL_NAME = "康康";
export const RIVAL_EMOJI = "⭐";

/** 康康本人：光系，速度快，会破盾也会大招 */
export function buildRivalLeader(heroLevel: number, scale: number): Fighter {
  const base = baseHeroStats(heroLevel);
  const rank = Math.max(1, Math.min(MAX_SKILL_RANK, 1 + Math.floor(heroLevel / 12)));
  return makeFighter({
    name: RIVAL_NAME,
    emoji: RIVAL_EMOJI,
    element: "light",
    maxHp: Math.round(base.maxHp * 1.06 * scale),
    atk: Math.round(base.atk * 1.04 * scale),
    def: Math.round(base.def * 1.02 * scale),
    spd: Math.round(base.spd * 1.12),
    crit: 0.12,
    skills: [
      { id: "chimeBreak", rank },
      { id: "sunBloom", rank },
      { id: "warmSong", rank }
    ]
  });
}

/**
 * 装备带来的强度倍数：满配的勇者比光着身子的自己强多少。
 * 擂台要用它来抬对手，不然一身好装备下去就是碾压，配装也就没得研究了。
 */
export function gearFactor(save: HeroSave): number {
  const bare = powerScore(baseHeroStats(save.level));
  if (bare <= 0) return 1;
  const geared = powerScore(heroStats(save));
  return Math.max(1, Math.min(2.2, Math.round((geared / bare) * 1000) / 1000));
}

/** 对手跟多少装备差距：小于 1 就意味着「配得越好，赢面越大」 */
export const GEAR_MATCH_EXPONENT = 0.6;

/**
 * 擂台难度：赢得越多，康康的队伍越强（倍数封顶，永远留得住翻盘的余地）。
 * gear 是勇者的装备倍数，对手会跟着抬一部分，比的是「配得好不好」而不是「肝没肝」。
 *
 * 三对三是接力打的，一点点数值差会被放大成几乎必胜或几乎必输。所以随胜场的
 * 爬升要迈小步：从略低于平手起步，慢慢爬过对方，让「打到打不动为止」是一段
 * 缓坡而不是一道坎。配装越好，这道坎就越靠后。
 */
export function arenaScale(wins: number, gear = 1): number {
  const w = Math.max(0, Math.round(wins));
  const byWins = Math.min(1.2, 0.94 + w * 0.006);
  // 只跟一部分装备差距，剩下的那部分留给玩家：认真配装就该看得见回报
  const byGear = Math.pow(Math.max(1, Math.min(2.2, gear)), GEAR_MATCH_EXPONENT);
  return Math.round(byWins * byGear * 1000) / 1000;
}

/** 康康的三人队伍（第几次挑战决定同伴组合，配置固定可预测） */
export function buildRivalTeam(heroLevel: number, wins: number, gear = 1): Fighter[] {
  const scale = arenaScale(wins, gear);
  const order = ["shanshan", "dundun", "jiujiu", "yunyun", "lvlvdou", "nuonuo"];
  const a = order[wins % order.length];
  const b = order[(wins + 3) % order.length];
  return [
    buildRivalLeader(heroLevel, scale),
    buildCompanion(a, heroLevel, scale),
    buildCompanion(b, heroLevel, scale)
  ];
}

/** 同伴能分到多少装备红利：鸭梨把换下来的装备匀给他们，但匀不满 */
export const MATE_GEAR_SHARE = 0.75;

/** 我的三人队伍：鸭梨打头，后面跟着选好的两位同伴 */
export function buildMyTeam(save: HeroSave): Fighter[] {
  const mates = save.party.filter((id) => companionById(id)).slice(0, 2);
  while (mates.length < 2) {
    const next = COMPANIONS.find((c) => !mates.includes(c.id));
    if (!next) break;
    mates.push(next.id);
  }
  const share = 1 + (gearFactor(save) - 1) * MATE_GEAR_SHARE;
  return [buildHero(save), ...mates.map((id) => buildCompanion(id, save.level, share))];
}

export interface ArenaOutcome {
  result: TeamBattleResult;
  win: boolean;
  coins: number;
  exp: number;
  /** 给平台钱包加几颗小星星 */
  stars: 0 | 1 | 2 | 3;
  text: string;
}

/** 打一场擂台，纯函数：同样的存档 + 同样的种子必然同样的结果 */
export function runArena(save: HeroSave, seed: number): ArenaOutcome {
  const mine = buildMyTeam(save);
  const theirs = buildRivalTeam(save.level, save.arenaWins, gearFactor(save));
  const result = simulateTeamBattle(mine, theirs, seed >>> 0);
  const win = result.winner === "a";
  const coins = win ? 70 + save.arenaWins * 12 : 24;
  const exp = win ? 60 + save.arenaWins * 8 : 20;
  const stars: 0 | 1 | 2 | 3 = win ? (result.aLeft >= 3 ? 3 : result.aLeft === 2 ? 2 : 1) : 0;
  const text = win
    ? `${result.aLeft} 位队友还站着，这一场是我们的！康康笑着说下次要换个阵容。`
    : "康康的队伍这次更有默契。换换徽章属性、调调上阵技能，再来一场！";
  return { result, win, coins, exp, stars, text };
}

/** 擂台打完写回存档 */
export function applyArena(save: HeroSave, outcome: ArenaOutcome): HeroSave {
  const withCoins = gainCoins(save, outcome.coins);
  const { save: leveled } = gainExp(withCoins, outcome.exp);
  return {
    ...leveled,
    arenaPlays: leveled.arenaPlays + 1,
    arenaWins: outcome.win ? leveled.arenaWins + 1 : leveled.arenaWins
  };
}

/** 换一位上场同伴（同一个人不能站两个位置） */
export function setPartyMember(save: HeroSave, index: 0 | 1, id: string): HeroSave {
  if (!companionById(id)) return save;
  const party = save.party.slice(0, 2);
  while (party.length < 2) party.push(COMPANIONS[party.length].id);
  const otherIdx = index === 0 ? 1 : 0;
  if (party[otherIdx] === id) party[otherIdx] = party[index];
  party[index] = id;
  return { ...save, party };
}
