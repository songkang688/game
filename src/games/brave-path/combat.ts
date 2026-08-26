/**
 * 勇者小路 —— 回合制战斗结算（**全部是纯函数**，不碰 DOM、不读时间、不用全局随机）。
 *
 * 设计目标：一场普通遭遇战 2–4 个回合就能打完，但每个回合都值得想一想：
 *  1. 属性克制：火 → 草 → 水 → 火 三角，光 ↔ 暗 互相克制；
 *  2. 技能冷却：强招打完要凉几个回合，得排顺序；
 *  3. 有限背包位：出发前只能带几样道具，什么时候用是学问；
 *  4. Boss 机制：读条大招（要防御）、护盾（要破盾）、弱点系（打弱点特别管用）。
 *
 * 全篇没有流血、受伤、死亡的说法。生命值叫「星芒」，被打中就是星星飞溅、
 * 转圈圈眩晕、被弹开；星芒见底就是「累啦，坐下来歇口气」。
 */

/** 平台内置合成音效名（只用这七个） */
export type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

// ---------------------------------------------------------------------------
// 属性克制
// ---------------------------------------------------------------------------

export type Element = "fire" | "water" | "grass" | "light" | "dark";

export const ELEMENTS: readonly Element[] = ["fire", "water", "grass", "light", "dark"];

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: "火",
  water: "水",
  grass: "草",
  light: "光",
  dark: "暗"
};

export const ELEMENT_EMOJI: Record<Element, string> = {
  fire: "🔥",
  water: "💧",
  grass: "🌿",
  light: "✨",
  dark: "🌙"
};

/** 谁克谁：火烧草、草吸水、水浇火，光和暗互相克 */
const STRONG_AGAINST: Record<Element, readonly Element[]> = {
  fire: ["grass"],
  grass: ["water"],
  water: ["fire"],
  light: ["dark"],
  dark: ["light"]
};

/** 克制加成 */
export const STRONG_MULTIPLIER = 1.5;
/** 被克制时的衰减 */
export const RESIST_MULTIPLIER = 0.75;
/** 互不相干 */
export const NEUTRAL_MULTIPLIER = 1;
/** 打中 Boss 弱点系的额外加成（叠在克制倍率上） */
export const WEAKNESS_BONUS = 1.4;
/** 防御姿态把这一回合受到的伤害砍掉一半 */
export const GUARD_REDUCE = 0.5;
/** 再怎么被减伤，也至少掉 1 点星芒，免得战斗卡死 */
export const MIN_DAMAGE = 1;
/** 默认暴击倍率 */
export const DEFAULT_CRIT_MULTIPLIER = 1.8;
/** 破盾技能打在护盾上的额外倍率 */
export const BREAKER_SHIELD_MULTIPLIER = 2;
/**
 * 「一下打不空」的保险，只护着勇者这一边。
 *
 * 暴击、属性克制、高阶招式的倍率是乘在一起的，运气差的时候一记普通小怪的招
 * 能掏空大半条星芒条。孩子还没看清发生了什么，这一趟就结束了——委屈，也学不到东西。
 * 所以打在勇者身上的单次命中最多削掉星芒上限的这么多，剩下的靠回合数堆，
 * 至少留出一个回合去防御、去嗑蜂蜜、去换招。
 *
 * 对手不受这条保护：一套克制连招把小怪一口气打退，那份痛快要留着。
 * 防御姿态是在这个上限**之后**再砍一半，所以防御永远还是有用的。
 */
export const MAX_SINGLE_HIT_RATIO = 0.45;
/** 背包位上限：带什么去冒险，出发前就得想清楚 */
export const BAG_SLOTS = 4;

/**
 * 攻击方属性打防守方属性的倍率。
 * 同系互打是 1 倍；光暗互相克，所以两个方向都是 1.5 倍。
 */
export function elementMultiplier(attack: Element, defend: Element): number {
  if (STRONG_AGAINST[attack].includes(defend)) return STRONG_MULTIPLIER;
  if (STRONG_AGAINST[defend].includes(attack)) return RESIST_MULTIPLIER;
  return NEUTRAL_MULTIPLIER;
}

/** 给界面用的一句话：这一招打过去是占便宜还是吃亏 */
export function affinityHint(attack: Element, defend: Element): string {
  const m = elementMultiplier(attack, defend);
  if (m > 1) return "克制！这一下特别管用";
  if (m < 1) return "被克制，威力打折";
  return "不吃亏也不占便宜";
}

// ---------------------------------------------------------------------------
// 暴击
// ---------------------------------------------------------------------------

/** 把暴击率夹到 0..1，脏数据一律当 0 */
export function clampChance(chance: number): number {
  if (!Number.isFinite(chance)) return 0;
  return Math.max(0, Math.min(1, chance));
}

/**
 * 是否暴击：`roll < chance` 才算。
 * 边界一律取「不暴击」——roll 正好等于暴击率时不触发，0 暴击率永远不触发。
 */
export function rollCrit(chance: number, roll: number): boolean {
  const c = clampChance(chance);
  if (c <= 0) return false;
  if (!Number.isFinite(roll)) return false;
  return roll < c;
}

// ---------------------------------------------------------------------------
// 单次伤害结算
// ---------------------------------------------------------------------------

export interface DamageInput {
  atk: number;
  def: number;
  /** 招式倍率：普通攻击是 1 */
  power: number;
  attackElement: Element;
  defendElement: Element;
  /** 防守方这一回合摆了防御姿态 */
  guarding?: boolean;
  /** 这一下是不是暴击（由 rollCrit 事先决定，保持本函数纯净） */
  crit?: boolean;
  critMultiplier?: number;
  /** 防守方当前护盾 */
  shield?: number;
  /** 打在护盾上的倍率（破盾招是 2） */
  shieldMultiplier?: number;
  /** 防守方的弱点系（Boss 专属，普通怪是 null） */
  weakness?: Element | null;
  /** 穿透：直接绕过护盾打星芒 */
  pierce?: boolean;
  /**
   * 防守方的星芒上限。只有护着勇者那一下才会传，传了就启用「一下打不空」的保险；
   * 不传就按老规矩硬算（纯函数，方便单独测公式）。
   */
  defendMaxHp?: number;
}

export interface DamageResult {
  /** 掉了多少星芒 */
  hpDamage: number;
  /** 削掉多少护盾 */
  shieldDamage: number;
  /** 结算后还剩多少护盾 */
  shieldLeft: number;
  /** 这一下的克制倍率 */
  elementMultiplier: number;
  crit: boolean;
  guarded: boolean;
  weakHit: boolean;
  /** 这一下把护盾打碎了 */
  shieldBroken: boolean;
}

/**
 * 一次攻击的完整结算。顺序固定，方便讲给孩子听也方便写测试：
 *
 *   攻击力 × 招式倍率 × 克制倍率 ×（弱点加成）×（暴击倍率）
 *     − 防御力 →（防御姿态再砍一半）→ 先扣护盾，溢出的才掉星芒
 */
export function computeDamage(input: DamageInput): DamageResult {
  const power = Number.isFinite(input.power) ? Math.max(0, input.power) : 0;
  const atk = Number.isFinite(input.atk) ? Math.max(0, input.atk) : 0;
  const def = Number.isFinite(input.def) ? Math.max(0, input.def) : 0;
  const shield = Number.isFinite(input.shield ?? 0) ? Math.max(0, input.shield ?? 0) : 0;
  const shieldMul = Math.max(1, input.shieldMultiplier ?? 1);
  const critMul = Math.max(1, input.critMultiplier ?? DEFAULT_CRIT_MULTIPLIER);

  const mul = elementMultiplier(input.attackElement, input.defendElement);
  const weakHit = input.weakness ? input.attackElement === input.weakness : false;
  const guarded = input.guarding === true;
  const crit = input.crit === true;

  let raw = atk * power * mul;
  if (weakHit) raw *= WEAKNESS_BONUS;
  if (crit) raw *= critMul;

  let after = Math.max(MIN_DAMAGE, Math.round(raw) - def);
  const maxHp = Number.isFinite(input.defendMaxHp ?? 0) ? Math.max(0, input.defendMaxHp ?? 0) : 0;
  if (maxHp > 0) {
    after = Math.min(after, Math.max(MIN_DAMAGE, Math.floor(maxHp * MAX_SINGLE_HIT_RATIO)));
  }
  if (guarded) after = Math.max(MIN_DAMAGE, Math.floor(after * GUARD_REDUCE));

  let hpDamage = 0;
  let shieldDamage = 0;
  let shieldLeft = shield;
  let shieldBroken = false;

  if (shield > 0 && input.pierce !== true) {
    const hit = Math.floor(after * shieldMul);
    if (hit >= shield) {
      shieldDamage = shield;
      shieldLeft = 0;
      shieldBroken = true;
      // 打碎护盾后溢出的力道按同样的倍率折回星芒
      hpDamage = Math.floor((hit - shield) / shieldMul);
    } else {
      shieldDamage = hit;
      shieldLeft = shield - hit;
    }
  } else {
    hpDamage = after;
  }

  return {
    hpDamage,
    shieldDamage,
    shieldLeft,
    elementMultiplier: mul,
    crit,
    guarded,
    weakHit,
    shieldBroken
  };
}

// ---------------------------------------------------------------------------
// 技能 / 道具
// ---------------------------------------------------------------------------

export type SkillKind = "damage" | "breaker" | "pierce" | "heal" | "buff";

export interface SkillDef {
  id: string;
  name: string;
  emoji: string;
  element: Element;
  kind: SkillKind;
  /** damage/breaker/pierce：招式倍率；heal：回复量占最大星芒的比例；buff：攻击加成比例 */
  power: number;
  /** 用完要凉几个回合 */
  cooldown: number;
  /** buff 持续回合 */
  duration?: number;
  desc: string;
}

export type ItemKind = "heal" | "wake" | "power" | "shieldbreak";

export interface ItemDef {
  id: string;
  name: string;
  emoji: string;
  kind: ItemKind;
  amount: number;
  price: number;
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  berry: {
    id: "berry",
    name: "甜甜莓果",
    emoji: "🍓",
    kind: "heal",
    amount: 30,
    price: 18,
    desc: "咬一口回 30 点星芒，路上最常见的补给。"
  },
  honey: {
    id: "honey",
    name: "花蜜罐",
    emoji: "🍯",
    kind: "heal",
    amount: 70,
    price: 40,
    desc: "浓浓的花蜜，一口回 70 点星芒。"
  },
  bell: {
    id: "bell",
    name: "叮当小铃",
    emoji: "🔔",
    kind: "wake",
    amount: 12,
    price: 22,
    desc: "清脆一响，立刻从转圈圈里回过神，还顺带回一点星芒。"
  },
  pepper: {
    id: "pepper",
    name: "劲头辣椒",
    emoji: "🌶️",
    kind: "power",
    amount: 3,
    price: 30,
    desc: "三个回合攻击力提升四成，追击的好帮手。"
  },
  hammer: {
    id: "hammer",
    name: "小木槌",
    emoji: "🔨",
    kind: "shieldbreak",
    amount: 60,
    price: 34,
    desc: "咚地一下敲掉对手 60 点护盾，专治硬邦邦的家伙。"
  }
};

/** 攻击加成 buff 的强度（劲头辣椒与激励类技能共用） */
export const POWER_BUFF_RATIO = 0.4;

export const SKILLS: Record<string, SkillDef> = {
  petalSlash: {
    id: "petalSlash",
    name: "花瓣斩",
    emoji: "🌸",
    element: "grass",
    kind: "damage",
    power: 1.55,
    cooldown: 2,
    desc: "草系。挥出一圈花瓣，威力 1.55 倍，凉 2 个回合。"
  },
  emberDance: {
    id: "emberDance",
    name: "火星舞",
    emoji: "🔥",
    element: "fire",
    kind: "damage",
    power: 1.7,
    cooldown: 3,
    desc: "火系。踩着火星转一圈，威力 1.7 倍，凉 3 个回合。"
  },
  dewSplash: {
    id: "dewSplash",
    name: "露珠溅",
    emoji: "💧",
    element: "water",
    kind: "damage",
    power: 1.6,
    cooldown: 2,
    desc: "水系。甩出一串露珠，威力 1.6 倍，凉 2 个回合。"
  },
  starPoke: {
    id: "starPoke",
    name: "星尖刺",
    emoji: "✨",
    element: "light",
    kind: "pierce",
    power: 1.25,
    cooldown: 3,
    desc: "光系穿透。绕过护盾直接戳到本体，威力 1.25 倍。"
  },
  moonVeil: {
    id: "moonVeil",
    name: "月纱拂",
    emoji: "🌙",
    element: "dark",
    kind: "damage",
    power: 1.65,
    cooldown: 3,
    desc: "暗系。月色一拂，威力 1.65 倍，凉 3 个回合。"
  },
  crackHammer: {
    id: "crackHammer",
    name: "碎壳锤",
    emoji: "🔨",
    element: "fire",
    kind: "breaker",
    power: 1.15,
    cooldown: 2,
    desc: "破盾招。打在护盾上是双倍，专门拆硬壳。"
  },
  chimeBreak: {
    id: "chimeBreak",
    name: "鸣钟击",
    emoji: "🔔",
    element: "light",
    kind: "breaker",
    power: 1.3,
    cooldown: 3,
    desc: "破盾招。一记钟声震碎护盾，打盾双倍。"
  },
  warmSong: {
    id: "warmSong",
    name: "暖心歌",
    emoji: "🎵",
    element: "light",
    kind: "heal",
    power: 0.35,
    cooldown: 4,
    desc: "唱一首歌，回复最大星芒的 35%，凉 4 个回合。"
  },
  braveHorn: {
    id: "braveHorn",
    name: "勇气号角",
    emoji: "📯",
    element: "fire",
    kind: "buff",
    power: POWER_BUFF_RATIO,
    cooldown: 4,
    duration: 3,
    desc: "吹响号角，接下来 3 个回合攻击力提升四成。"
  },
  gustStep: {
    id: "gustStep",
    name: "疾风步",
    emoji: "🍃",
    element: "grass",
    kind: "damage",
    power: 1.35,
    cooldown: 1,
    desc: "草系轻招。威力 1.35 倍，只凉 1 个回合，可以连着用。"
  },
  tideCall: {
    id: "tideCall",
    name: "潮汐唤",
    emoji: "🌊",
    element: "water",
    kind: "damage",
    power: 2.05,
    cooldown: 4,
    desc: "水系大招。威力 2.05 倍，凉 4 个回合，留给关键时刻。"
  },
  duskFang: {
    id: "duskFang",
    name: "暮色牙",
    emoji: "🦇",
    element: "dark",
    kind: "pierce",
    power: 1.45,
    cooldown: 4,
    desc: "暗系穿透大招。无视护盾，威力 1.45 倍。"
  },
  sunBloom: {
    id: "sunBloom",
    name: "日光绽",
    emoji: "🌞",
    element: "light",
    kind: "damage",
    power: 2.2,
    cooldown: 5,
    desc: "光系终极招。威力 2.2 倍，凉 5 个回合。"
  }
};

/** 技能倍率随技能等级成长：每升 1 级 +8% */
export const SKILL_RANK_STEP = 0.08;

/** 技能最高等级 */
export const MAX_SKILL_RANK = 5;

/** 某个技能在 rank 级时的实际倍率 */
export function skillPowerAtRank(skill: SkillDef, rank: number): number {
  const r = Math.max(1, Math.min(MAX_SKILL_RANK, Math.round(rank || 1)));
  return Math.round(skill.power * (1 + (r - 1) * SKILL_RANK_STEP) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// 战斗中的角色
// ---------------------------------------------------------------------------

export interface BagSlot {
  id: string;
  count: number;
}

/** Boss 的机制表：读条大招 + 定期张盾 + 弱点系 */
export interface BossPlan {
  /** 每隔几个回合读一次大招；0 表示不读条 */
  chargeEvery: number;
  /** 大招倍率 */
  chargePower: number;
  chargeName: string;
  /** 每隔几个回合张一次护盾；0 表示不张盾 */
  shieldEvery: number;
  shieldAmount: number;
}

export interface ChargeState {
  name: string;
  power: number;
  /** 还要等几个回合才放出来；0 表示这个回合就放 */
  turnsLeft: number;
}

export interface Fighter {
  name: string;
  emoji: string;
  element: Element;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** 0..1 */
  crit: number;
  critMultiplier: number;
  shield: number;
  /** 技能条：技能 id + 当前等级 */
  skills: Array<{ id: string; rank: number }>;
  /** 技能 id → 还要凉几个回合 */
  cooldowns: Record<string, number>;
  /** 这一回合摆了防御姿态 */
  guarding: boolean;
  /** 还要转几个回合的圈圈 */
  stun: number;
  /** 攻击加成剩余回合 */
  powerTurns: number;
  bag: BagSlot[];
  /** 弱点系（Boss 才有） */
  weakness: Element | null;
  boss: BossPlan | null;
  charge: ChargeState | null;
  /**
   * 还差几个回合张盾 / 读条。用倒计时而不是「回合数取余」，
   * 是因为放大招那一回合会占掉行动，取余的窗口一旦错过就再也补不上了。
   */
  shieldTimer: number;
  chargeTimer: number;
  /** 是不是 Boss（界面用来画星芒条样式） */
  isBoss: boolean;
}

export type Side = "hero" | "foe";

export interface CombatState {
  hero: Fighter;
  foe: Fighter;
  /** 回合数，从 1 开始 */
  round: number;
  over: boolean;
  winner: Side | null;
}

export type Action =
  | { kind: "attack" }
  | { kind: "skill"; skillId: string }
  | { kind: "guard" }
  | { kind: "item"; itemId: string }
  /** Boss 专用：这个回合在读条 */
  | { kind: "charge" }
  /** Boss 专用：把读好的大招放出来 */
  | { kind: "unleash" }
  /** Boss 专用：张开护盾 */
  | { kind: "shieldUp" };

export type EventKind =
  | "damage"
  | "heal"
  | "guard"
  | "buff"
  | "charge"
  | "unleash"
  | "shield"
  | "stun"
  | "item"
  | "cooling"
  | "end";

export interface CombatEvent {
  side: Side | "none";
  kind: EventKind;
  text: string;
  sound?: SoundName;
  amount?: number;
  crit?: boolean;
  weakHit?: boolean;
  shieldBroken?: boolean;
}

export interface RoundResult {
  state: CombatState;
  events: CombatEvent[];
}

// ---------------------------------------------------------------------------
// 构造与克隆（全部返回新对象，绝不改传进来的东西）
// ---------------------------------------------------------------------------

export interface FighterSpec {
  name: string;
  emoji: string;
  element: Element;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  crit?: number;
  critMultiplier?: number;
  skills?: Array<{ id: string; rank: number }>;
  bag?: BagSlot[];
  weakness?: Element | null;
  boss?: BossPlan | null;
  isBoss?: boolean;
  shield?: number;
  hp?: number;
}

export function makeFighter(spec: FighterSpec): Fighter {
  const maxHp = Math.max(1, Math.round(spec.maxHp));
  return {
    name: spec.name,
    emoji: spec.emoji,
    element: spec.element,
    maxHp,
    hp: Math.max(0, Math.min(maxHp, Math.round(spec.hp ?? maxHp))),
    atk: Math.max(1, Math.round(spec.atk)),
    def: Math.max(0, Math.round(spec.def)),
    spd: Math.max(1, Math.round(spec.spd)),
    crit: clampChance(spec.crit ?? 0.08),
    critMultiplier: Math.max(1, spec.critMultiplier ?? DEFAULT_CRIT_MULTIPLIER),
    shield: Math.max(0, Math.round(spec.shield ?? 0)),
    skills: (spec.skills ?? []).filter((s) => Boolean(SKILLS[s.id])).slice(0, 6).map((s) => ({ ...s })),
    cooldowns: {},
    guarding: false,
    stun: 0,
    powerTurns: 0,
    bag: (spec.bag ?? []).slice(0, BAG_SLOTS).map((s) => ({ ...s })),
    weakness: spec.weakness ?? null,
    boss: spec.boss ? { ...spec.boss } : null,
    charge: null,
    shieldTimer: Math.max(0, (spec.boss?.shieldEvery ?? 0) - 1),
    chargeTimer: Math.max(0, (spec.boss?.chargeEvery ?? 0) - 1),
    isBoss: spec.isBoss === true
  };
}

export function cloneFighter(f: Fighter): Fighter {
  return {
    ...f,
    skills: f.skills.map((s) => ({ ...s })),
    cooldowns: { ...f.cooldowns },
    bag: f.bag.map((s) => ({ ...s })),
    boss: f.boss ? { ...f.boss } : null,
    charge: f.charge ? { ...f.charge } : null
  };
}

export function cloneState(s: CombatState): CombatState {
  return { hero: cloneFighter(s.hero), foe: cloneFighter(s.foe), round: s.round, over: s.over, winner: s.winner };
}

export function startCombat(hero: Fighter, foe: Fighter): CombatState {
  return { hero: cloneFighter(hero), foe: cloneFighter(foe), round: 1, over: false, winner: null };
}

// ---------------------------------------------------------------------------
// 查询小工具
// ---------------------------------------------------------------------------

/** 这个技能现在能不能放（学了 + 冷却好了） */
export function skillReady(f: Fighter, skillId: string): boolean {
  if (!f.skills.some((s) => s.id === skillId)) return false;
  return (f.cooldowns[skillId] ?? 0) <= 0;
}

/** 这个角色现在能放的技能 id 列表 */
export function readySkills(f: Fighter): string[] {
  return f.skills.filter((s) => skillReady(f, s.id)).map((s) => s.id);
}

/** 现在实际生效的攻击力（算上攻击加成 buff） */
export function effectiveAtk(f: Fighter): number {
  return f.powerTurns > 0 ? Math.round(f.atk * (1 + POWER_BUFF_RATIO)) : f.atk;
}

/** 背包里还剩几个这种道具 */
export function itemCount(f: Fighter, itemId: string): number {
  const slot = f.bag.find((s) => s.id === itemId);
  return slot ? Math.max(0, slot.count) : 0;
}

/** 星芒百分比（0..1），画星芒条用 */
export function hpRatio(f: Fighter): number {
  if (f.maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, f.hp / f.maxHp));
}

/** 这个动作现在合不合法（界面按钮用它来决定灰不灰） */
export function actionAllowed(f: Fighter, action: Action): boolean {
  if (action.kind === "attack" || action.kind === "guard") return true;
  if (action.kind === "skill") return skillReady(f, action.skillId);
  if (action.kind === "item") return itemCount(f, action.itemId) > 0;
  return false;
}

// ---------------------------------------------------------------------------
// 敌方 AI（纯函数：同样的局面 + 同样的随机序列 = 同样的选择）
// ---------------------------------------------------------------------------

/** Boss 这个回合该干嘛：读条 → 放大招 → 张盾 → 技能 / 普攻 */
export function planFoeAction(state: CombatState, rng: () => number): Action {
  const foe = state.foe;
  if (foe.charge) {
    return foe.charge.turnsLeft <= 0 ? { kind: "unleash" } : { kind: "charge" };
  }
  const plan = foe.boss;
  if (plan) {
    if (plan.shieldEvery > 0 && foe.shield <= 0 && foe.shieldTimer <= 0) {
      return { kind: "shieldUp" };
    }
    if (plan.chargeEvery > 0 && foe.chargeTimer <= 0) {
      return { kind: "charge" };
    }
  }
  const ready = readySkills(foe);
  const roll = rng();
  if (ready.length > 0 && roll < 0.5) {
    const pickRoll = rng();
    return { kind: "skill", skillId: ready[Math.min(ready.length - 1, Math.floor(pickRoll * ready.length))] };
  }
  if (!foe.isBoss && roll > 0.88) return { kind: "guard" };
  return { kind: "attack" };
}

/**
 * 自动战斗时勇者这边的思路（对战模式与「自动打一场」都用它）。
 * 顺序就是要教给孩子的策略优先级：
 *  1. 对手在读大招 → 先防御把伤害砍一半；
 *  2. 对手有护盾 → 先用破盾 / 穿透招；
 *  3. 自己星芒见底 → 先补一口；
 *  4. 有克制对手的技能 → 打克制；
 *  5. 其余情况 → 把每一招和普通攻击一起算一遍期望伤害，谁高用谁。
 *
 * 第 5 条很要紧：技能自带属性，普通攻击走徽章属性。徽章正好戳中对手弱点时，
 * 一记普通攻击可能比属性不对路的大招还管用，AI 得算得过这笔账。
 */
export function planHeroAction(state: CombatState, rng: () => number): Action {
  const me = state.hero;
  const foe = state.foe;

  if (foe.charge && foe.charge.turnsLeft <= 0) return { kind: "guard" };

  const ready = readySkills(me);
  const def = (id: string): SkillDef => SKILLS[id];

  if (foe.shield > 0) {
    const breaker = ready.find((id) => def(id).kind === "breaker" || def(id).kind === "pierce");
    if (breaker) return { kind: "skill", skillId: breaker };
    if (itemCount(me, "hammer") > 0) return { kind: "item", itemId: "hammer" };
  }

  if (me.hp <= me.maxHp * 0.35) {
    const heal = ready.find((id) => def(id).kind === "heal");
    if (heal) return { kind: "skill", skillId: heal };
    const potion = me.bag.find((s) => s.count > 0 && ITEMS[s.id]?.kind === "heal");
    if (potion) return { kind: "item", itemId: potion.id };
  }

  if (me.stun > 0 && itemCount(me, "bell") > 0) return { kind: "item", itemId: "bell" };

  /** 某个属性以某个倍率打过去，大概能打出几倍伤害 */
  const expect = (element: Element, power: number): number =>
    elementMultiplier(element, foe.element) * (foe.weakness === element ? WEAKNESS_BONUS : 1) * power;

  const attackScore = expect(me.element, 1);
  const damaging = ready.filter((id) => def(id).kind !== "heal" && def(id).kind !== "buff");
  let bestSkill: string | null = null;
  let bestScore = attackScore;
  for (const id of damaging) {
    const rank = me.skills.find((s) => s.id === id)?.rank ?? 1;
    const score = expect(def(id).element, skillPowerAtRank(def(id), rank));
    if (score > bestScore) {
      bestScore = score;
      bestSkill = id;
    }
  }
  if (bestSkill) return { kind: "skill", skillId: bestSkill };

  const buff = ready.find((id) => def(id).kind === "buff");
  if (buff && me.powerTurns <= 0 && rng() < 0.4) return { kind: "skill", skillId: buff };

  return { kind: "attack" };
}

// ---------------------------------------------------------------------------
// 回合结算
// ---------------------------------------------------------------------------

function other(side: Side): Side {
  return side === "hero" ? "foe" : "hero";
}

function knockOutText(f: Fighter, side: Side): string {
  if (side === "hero") return `${f.name}有点累啦，坐下来歇口气，这趟先到这里～`;
  return `${f.name}转着圈圈让开了小路，你可以过去啦！`;
}

interface ApplyOut {
  events: CombatEvent[];
  /** 这个回合刚放出去的技能：回合末不给它减冷却，免得「凉 2 回合」变成只凉 1 回合 */
  usedSkill?: string;
}

/** 把一次伤害写进防守方，并产出事件文本 */
function landHit(
  attacker: Fighter,
  defender: Fighter,
  side: Side,
  label: string,
  element: Element,
  power: number,
  opts: { pierce?: boolean; shieldMultiplier?: number; crit: boolean },
  out: CombatEvent[]
): void {
  const res = computeDamage({
    atk: effectiveAtk(attacker),
    def: defender.def,
    power,
    attackElement: element,
    defendElement: defender.element,
    guarding: defender.guarding,
    crit: opts.crit,
    critMultiplier: attacker.critMultiplier,
    shield: defender.shield,
    shieldMultiplier: opts.shieldMultiplier,
    weakness: defender.weakness,
    pierce: opts.pierce,
    // 只有挨打的是勇者时才开保险，小怪该被一口气打退还是打退
    defendMaxHp: side === "foe" ? defender.maxHp : undefined
  });
  defender.shield = res.shieldLeft;
  defender.hp = Math.max(0, defender.hp - res.hpDamage);

  const bits: string[] = [];
  if (res.crit) bits.push("暴击");
  if (res.weakHit) bits.push("正中弱点");
  if (res.elementMultiplier > 1) bits.push("克制");
  else if (res.elementMultiplier < 1) bits.push("被克制");
  if (res.guarded) bits.push("对方防住了大半");
  if (res.shieldBroken) bits.push("护盾碎成小星星");

  const tail = bits.length > 0 ? `（${bits.join("·")}）` : "";
  const hitText =
    res.hpDamage > 0
      ? `${label}命中，${defender.name} 星芒 -${res.hpDamage}${tail}`
      : `${label}全被护盾挡下了，护盾 -${res.shieldDamage}${tail}`;

  out.push({
    side,
    kind: "damage",
    text: hitText,
    sound: res.crit ? "pop" : "tap",
    amount: res.hpDamage,
    crit: res.crit,
    weakHit: res.weakHit,
    shieldBroken: res.shieldBroken
  });
}

/** 执行一个角色的行动（就地改传进来的 state 副本） */
function applyAction(state: CombatState, side: Side, action: Action, rng: () => number): ApplyOut {
  const events: CombatEvent[] = [];
  const me = side === "hero" ? state.hero : state.foe;
  const foe = side === "hero" ? state.foe : state.hero;
  let usedSkill: string | undefined;

  switch (action.kind) {
    case "guard": {
      // 防御在回合一开始就生效了，这里只补一条提示
      events.push({ side, kind: "guard", text: `${me.name}举起护身叶，稳稳站住。`, sound: "tap" });
      break;
    }
    case "attack": {
      const crit = rollCrit(me.crit, rng());
      landHit(me, foe, side, `${me.name}的普通攻击`, me.element, 1, { crit }, events);
      break;
    }
    case "skill": {
      const entry = me.skills.find((s) => s.id === action.skillId);
      const def = entry ? SKILLS[entry.id] : undefined;
      if (!entry || !def || (me.cooldowns[entry.id] ?? 0) > 0) {
        events.push({ side, kind: "cooling", text: `${me.name}的招式还在歇着，改成普通攻击。`, sound: "tap" });
        const crit = rollCrit(me.crit, rng());
        landHit(me, foe, side, `${me.name}的普通攻击`, me.element, 1, { crit }, events);
        break;
      }
      const power = skillPowerAtRank(def, entry.rank);
      me.cooldowns[entry.id] = def.cooldown;
      usedSkill = entry.id;
      if (def.kind === "heal") {
        const back = Math.max(1, Math.round(me.maxHp * power));
        const before = me.hp;
        me.hp = Math.min(me.maxHp, me.hp + back);
        events.push({
          side,
          kind: "heal",
          text: `${me.emoji} ${def.name}！${me.name} 星芒 +${me.hp - before}`,
          sound: "meow",
          amount: me.hp - before
        });
        break;
      }
      if (def.kind === "buff") {
        me.powerTurns = Math.max(me.powerTurns, def.duration ?? 3);
        events.push({
          side,
          kind: "buff",
          text: `${me.emoji} ${def.name}！${me.name}接下来 ${me.powerTurns} 个回合更有劲了。`,
          sound: "jump"
        });
        break;
      }
      const crit = rollCrit(me.crit, rng());
      landHit(
        me,
        foe,
        side,
        `${def.emoji} ${def.name}`,
        def.element,
        power,
        {
          crit,
          pierce: def.kind === "pierce",
          shieldMultiplier: def.kind === "breaker" ? BREAKER_SHIELD_MULTIPLIER : 1
        },
        events
      );
      break;
    }
    case "item": {
      const slot = me.bag.find((s) => s.id === action.itemId && s.count > 0);
      const def = slot ? ITEMS[slot.id] : undefined;
      if (!slot || !def) {
        events.push({ side, kind: "item", text: `${me.name}翻了翻背包，这个已经用完啦。`, sound: "oops" });
        break;
      }
      slot.count -= 1;
      if (def.kind === "heal") {
        const before = me.hp;
        me.hp = Math.min(me.maxHp, me.hp + def.amount);
        events.push({
          side,
          kind: "item",
          text: `${def.emoji} ${def.name}！${me.name} 星芒 +${me.hp - before}`,
          sound: "coin",
          amount: me.hp - before
        });
      } else if (def.kind === "wake") {
        const before = me.hp;
        me.stun = 0;
        me.hp = Math.min(me.maxHp, me.hp + def.amount);
        events.push({
          side,
          kind: "item",
          text: `${def.emoji} ${def.name}叮当一响，${me.name}立刻回过神，星芒 +${me.hp - before}`,
          sound: "coin"
        });
      } else if (def.kind === "power") {
        me.powerTurns = Math.max(me.powerTurns, def.amount);
        events.push({
          side,
          kind: "item",
          text: `${def.emoji} ${def.name}！${me.name}接下来 ${me.powerTurns} 个回合攻击力提升。`,
          sound: "coin"
        });
      } else {
        const cut = Math.min(foe.shield, def.amount);
        foe.shield -= cut;
        events.push({
          side,
          kind: "item",
          text:
            cut > 0
              ? `${def.emoji} ${def.name}咚地一下，${foe.name}的护盾 -${cut}`
              : `${def.emoji} ${def.name}挥了个空，对方现在没有护盾。`,
          sound: "coin",
          amount: cut,
          shieldBroken: cut > 0 && foe.shield <= 0
        });
      }
      break;
    }
    case "shieldUp": {
      const amount = me.boss?.shieldAmount ?? 0;
      me.shield += amount;
      me.shieldTimer = me.boss?.shieldEvery ?? 0;
      events.push({
        side,
        kind: "shield",
        text: `${me.name}张开了 ${amount} 点亮闪闪的护盾，普通招式先得把它敲开。`,
        sound: "pop",
        amount
      });
      break;
    }
    case "charge": {
      const plan = me.boss;
      const name = plan?.chargeName ?? "大招";
      me.charge = { name, power: plan?.chargePower ?? 2, turnsLeft: 0 };
      me.chargeTimer = plan?.chargeEvery ?? 0;
      events.push({
        side,
        kind: "charge",
        text: `⚠️ ${me.name}开始蓄力「${name}」，下个回合就放出来——快摆防御！`,
        sound: "oops"
      });
      break;
    }
    case "unleash": {
      const ch = me.charge ?? { name: "大招", power: 2, turnsLeft: 0 };
      me.charge = null;
      const crit = rollCrit(me.crit, rng());
      landHit(me, foe, side, `💥 ${ch.name}`, me.element, ch.power, { crit }, events);
      // 大招过后自己会晃一下神，这是反打的窗口
      me.stun = Math.max(me.stun, 1);
      events.push({ side, kind: "stun", text: `${me.name}放完大招喘得厉害，下回合转圈圈——机会来了！`, sound: "pop" });
      break;
    }
    default:
      break;
  }

  return { events, usedSkill };
}

/**
 * 结算一个完整回合：**纯函数**。
 * 传进来的 state 一根汗毛都不动，返回全新的 state 与这一回合发生的事件列表。
 *
 * 回合顺序：
 *  1. 双方的「防御」在回合一开始就生效（不看速度，孩子按了防御就一定挡得住）；
 *  2. 速度高的先动，速度一样勇者先动；
 *  3. 谁的星芒先见底，战斗立刻结束；
 *  4. 回合末统一扣冷却、扣 buff 回合、收起防御姿态。
 */
export function resolveRound(state: CombatState, heroAction: Action, rng: () => number): RoundResult {
  if (state.over) return { state: cloneState(state), events: [] };

  const next = cloneState(state);
  const events: CombatEvent[] = [];
  const foeAction = planFoeAction(next, rng);

  next.hero.guarding = heroAction.kind === "guard";
  next.foe.guarding = foeAction.kind === "guard";

  const order: Side[] = next.hero.spd >= next.foe.spd ? ["hero", "foe"] : ["foe", "hero"];
  const justUsed: Record<Side, string | undefined> = { hero: undefined, foe: undefined };

  for (const side of order) {
    if (next.over) break;
    const actor = side === "hero" ? next.hero : next.foe;
    if (actor.hp <= 0) continue;
    if (actor.stun > 0) {
      actor.stun -= 1;
      events.push({ side, kind: "stun", text: `${actor.name}还在转圈圈，这个回合动不了。`, sound: "oops" });
      continue;
    }
    const action = side === "hero" ? heroAction : foeAction;
    const out = applyAction(next, side, action, rng);
    justUsed[side] = out.usedSkill;
    events.push(...out.events);

    const target = side === "hero" ? next.foe : next.hero;
    if (target.hp <= 0) {
      next.over = true;
      next.winner = side;
      events.push({
        side,
        kind: "end",
        text: knockOutText(target, other(side)),
        sound: side === "hero" ? "win" : "oops"
      });
      break;
    }
  }

  // 回合末的统一维护
  for (const side of ["hero", "foe"] as Side[]) {
    const f = side === "hero" ? next.hero : next.foe;
    for (const id of Object.keys(f.cooldowns)) {
      if (id === justUsed[side]) continue;
      if (f.cooldowns[id] > 0) f.cooldowns[id] -= 1;
    }
    if (f.powerTurns > 0) f.powerTurns -= 1;
    if (f.charge && f.charge.turnsLeft > 0) f.charge.turnsLeft -= 1;
    if (f.shieldTimer > 0) f.shieldTimer -= 1;
    if (f.chargeTimer > 0) f.chargeTimer -= 1;
    f.guarding = false;
  }
  if (!next.over) next.round += 1;

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// 自动对战（对战模式 / 平衡性测试都靠它）
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AutoBattleResult {
  winner: Side | null;
  rounds: number;
  events: CombatEvent[];
  final: CombatState;
}

/** 打满 maxRounds 还没分出胜负就按剩余星芒比例判定（平局返回 null） */
export function judgeByHp(state: CombatState): Side | null {
  const a = hpRatio(state.hero);
  const b = hpRatio(state.foe);
  if (a > b) return "hero";
  if (b > a) return "foe";
  return null;
}

/** 双方都交给 AI 跑完一整场，纯函数（同 seed 必然同结果） */
export function simulateBattle(
  hero: Fighter,
  foe: Fighter,
  seed: number,
  maxRounds = 40
): AutoBattleResult {
  const rng = mulberry32(seed);
  let state = startCombat(hero, foe);
  const events: CombatEvent[] = [];
  let rounds = 0;
  while (!state.over && rounds < maxRounds) {
    const action = planHeroAction(state, rng);
    const res = resolveRound(state, action, rng);
    state = res.state;
    events.push(...res.events);
    rounds += 1;
  }
  return { winner: state.winner ?? judgeByHp(state), rounds, events, final: state };
}

/** 玩家挑好的行动列表跑完一场（脚本化战斗，测试 Boss 机制时特别好用） */
export function simulateScript(
  hero: Fighter,
  foe: Fighter,
  actions: Action[],
  seed: number
): AutoBattleResult {
  const rng = mulberry32(seed);
  let state = startCombat(hero, foe);
  const events: CombatEvent[] = [];
  let rounds = 0;
  for (const action of actions) {
    if (state.over) break;
    const res = resolveRound(state, action, rng);
    state = res.state;
    events.push(...res.events);
    rounds += 1;
  }
  return { winner: state.winner ?? judgeByHp(state), rounds, events, final: state };
}

// ---------------------------------------------------------------------------
// 队伍接力战（对战模式：三个人排成一队，前面的歇下了就换下一个上）
// ---------------------------------------------------------------------------

export interface TeamBattleResult {
  winner: "a" | "b";
  /** 每一小场的结果 */
  bouts: Array<{ a: string; b: string; winner: Side | null; rounds: number }>;
  /** 各自还站着几个人 */
  aLeft: number;
  bLeft: number;
  events: CombatEvent[];
}

/**
 * 三对三接力：双方各排一队，队首对打，谁歇下了就换后面的人顶上，
 * 一整队都歇下的那方算输。全程 AI 自动结算，纯函数。
 */
export function simulateTeamBattle(
  teamA: Fighter[],
  teamB: Fighter[],
  seed: number,
  maxRoundsPerBout = 40
): TeamBattleResult {
  const a = teamA.map(cloneFighter);
  const b = teamB.map(cloneFighter);
  const bouts: TeamBattleResult["bouts"] = [];
  const events: CombatEvent[] = [];
  let ai = 0;
  let bi = 0;
  let guard = 0;

  while (ai < a.length && bi < b.length && guard < a.length + b.length + 8) {
    guard += 1;
    const res = simulateBattle(a[ai], b[bi], (seed + guard * 7919) >>> 0, maxRoundsPerBout);
    bouts.push({ a: a[ai].name, b: b[bi].name, winner: res.winner, rounds: res.rounds });
    events.push(...res.events);
    if (res.winner === "hero") {
      // 赢下这一场的人带着剩下的星芒继续顶着
      a[ai] = { ...res.final.hero, guarding: false, stun: 0, charge: null };
      bi += 1;
    } else if (res.winner === "foe") {
      b[bi] = { ...res.final.foe, guarding: false, stun: 0, charge: null };
      ai += 1;
    } else {
      // 真的打平就两边一起换人
      ai += 1;
      bi += 1;
    }
  }

  const aLeft = Math.max(0, a.length - ai);
  const bLeft = Math.max(0, b.length - bi);
  return { winner: aLeft >= bLeft && aLeft > 0 ? "a" : bLeft > 0 ? "b" : "a", bouts, aLeft, bLeft, events };
}
