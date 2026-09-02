/**
 * 连招对决 —— 帧数据纯数据表。
 *
 * 这份文件只放"数字":十位原创小伙伴的体型 / 移动力 / 三条槽,
 * 以及每人 12 个招式槽的完整帧数据。判定与结算全在 `rules.ts` / `engine.ts`。
 *
 * 帧数据四段式(比三段多一段):
 *   起手 startup → 命中 active → **取消窗口 cancelLag** → 收招 recovery。
 * 判定框只在 active 生效;取消窗口只有在 active **打中了** 才打开,
 * 空振想取消一律失败、老老实实进收招 —— 这是本款和一般三段帧最大的区别。
 *
 * 分级:这是一款卡通切磋游戏。招式全是花瓣、星光、云朵、豆芽这类软东西,
 * `power` 削的是「元气」,元气见底就是坐下休息、换下一回合,没有血也没有伤。
 */

/** 一个矩形框(判定框 / 受击框)。坐标系:脚底中心为原点,y 向上为正 */
export interface Box {
  /** 朝向前方的偏移(角色朝右时就是 +x 方向) */
  x: number;
  /** 框底距地面的高度 */
  y: number;
  w: number;
  h: number;
}

/** 世界坐标里的矩形(左下角 + 宽高) */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 招式类别:轻击 / 重击 / 必杀 / 超必杀 / 投技 */
export type MoveKind = "light" | "heavy" | "special" | "super" | "throw";

/**
 * 防御高度:
 *  · high 上段(空中招 / 下踢)——必须**站着**挡,蹲着要挨;
 *  · mid  中段——站挡蹲挡都行;
 *  · low  下段(扫腿)——必须**蹲着**挡,站着要挨;
 *  · throw 投技——挡不住,但贴不上身就抓空。
 */
export type GuardHeight = "high" | "mid" | "low" | "throw";

/** 招式槽位:每个角色固定这 12 个位置,键位、AI、训练模式都按槽位说话 */
export type MoveSlot =
  | "5L"
  | "5H"
  | "2L"
  | "2H"
  | "jL"
  | "jH"
  | "throw"
  | "airThrow"
  | "s1"
  | "s2"
  | "sv1"
  | "sv2";

/** 全部槽位,按展示顺序 */
export const MOVE_SLOTS: MoveSlot[] = [
  "5L",
  "5H",
  "2L",
  "2H",
  "jL",
  "jH",
  "throw",
  "airThrow",
  "s1",
  "s2",
  "sv1",
  "sv2"
];

/** 普通招槽位(用模板生成的那一批) */
export type NormalSlot = "5L" | "5H" | "2L" | "2H" | "jL" | "jH" | "throw" | "airThrow";

export const NORMAL_SLOTS: NormalSlot[] = ["5L", "5H", "2L", "2H", "jL", "jH", "throw", "airThrow"];

/** 槽位中文名(HUD / 训练模式显示) */
export const SLOT_LABELS: Record<MoveSlot, string> = {
  "5L": "站轻",
  "5H": "站重",
  "2L": "蹲轻",
  "2H": "蹲重",
  jL: "空轻",
  jH: "空重",
  throw: "投技",
  airThrow: "跳投",
  s1: "必杀一",
  s2: "必杀二",
  sv1: "超必 LV1",
  sv2: "超必 LV2"
};

/** 头饰造型 id(1.3 视觉升级新增,纯外观查表,不参与任何判定) */
export type LookHat =
  | "flower"
  | "star"
  | "dango"
  | "cloud"
  | "bear"
  | "spark"
  | "sprout"
  | "chick"
  | "snow"
  | "peach";

/**
 * 角色纯外观字段(1.3 视觉升级新增):头饰剪影 + 服装二色。
 * 只被 `index.ts` / `art.ts` 的绘制层读取,引擎与判定一个字节都不碰它。
 */
export interface CharLook {
  hat: LookHat;
  /** 服装主色 */
  dress: string;
  /** 服装点缀色(披风 / 腰带 / 头饰配色) */
  trim: string;
}

/** 打法类型:体术 / 投射 / 抓投 / 蓄力 */
export type Archetype = "rush" | "zoner" | "grappler" | "charge";

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  rush: "体术型",
  zoner: "投射型",
  grappler: "抓投型",
  charge: "蓄力型"
};

export interface Move {
  slot: MoveSlot;
  /** 招式中文名,全部原创粉彩系 */
  name: string;
  kind: MoveKind;
  height: GuardHeight;
  /** 起手帧:这一段还打不到人,被抢先就吃亏 */
  startup: number;
  /** 命中帧:判定框生效的帧数 */
  active: number;
  /** 收招帧:这一段动不了 */
  recovery: number;
  /**
   * 取消窗口帧:**命中之后**从命中那一帧起算,这么多帧内可以取消成下一招。
   * 空振(没打中也没被挡)时这个窗口不开,想取消只会照常进收招。
   */
  cancelLag: number;
  /** 削减对手多少元气(只写威力,不写伤害) */
  power: number;
  /** 命中后对手僵直帧数 */
  hitStun: number;
  /** 被挡下后对手僵直帧数 */
  blockStun: number;
  /** 命中后把对手推开多远 */
  knockback: number;
  /** 上挑速度:>0 会把对手挑到空中,进入空中连状态 */
  launch: number;
  /** 出招方涨多少能量 */
  meterGain: number;
  /** 需要消耗多少能量才放得出 */
  meterCost: number;
  /** 被挡下时削对手多少护盾槽 */
  guardCost: number;
  /** 同帧对拼谁赢:差 ≤ 1 就是火花互退 */
  priority: number;
  /** 命中帧生效时的判定框 */
  box: Box;
  /** 命中顿帧:命中瞬间双方定格几帧(`prefers-reduced-motion` 下为 0) */
  hitStop: number;
  /** 无敌起始帧(含),超必才有 */
  invulnFrom?: number;
  /** 无敌结束帧(含) */
  invulnTo?: number;
  /** 命中直接放倒 */
  knockdown?: boolean;
  /** 只能在空中出 */
  airOnly?: boolean;
  /** 只能在地面出 */
  groundOnly?: boolean;
  /** 破防招:挡下来护盾掉得特别多 */
  guardCrush?: boolean;
  /** 投射招:判定框会离开身体往前飞 */
  projectile?: boolean;
  /** 投射飞行速度(像素/帧) */
  projectileSpeed?: number;
  /** 一句话说明,训练模式显示 */
  note: string;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  /** 主色(粉彩) */
  color: string;
  /** 描边 / 深色装饰 */
  ink: string;
  /** 纯外观:头饰与服装二色(1.3 视觉升级) */
  look: CharLook;
  archetype: Archetype;
  /** 一句话人设 */
  blurb: string;
  /** 打法提示,选人界面显示 */
  style: string;
  /** 元气上限 */
  vigor: number;
  /** 前进速度(每帧) */
  walk: number;
  /** 后退速度(每帧) */
  backWalk: number;
  /** 起跳初速度 */
  jump: number;
  /** 重力(每帧减速) */
  gravity: number;
  /** 身体半宽 */
  halfWidth: number;
  /** 站立身高 */
  height: number;
  /** 蹲下身高 */
  crouchHeight: number;
  /** 攻击范围倍率:判定框宽度按它缩放 */
  reach: number;
  /** 起手帧倍率:小于 1 就是出招快 */
  startupMod: number;
  /** 收招帧倍率:小于 1 就是硬直小 */
  recoveryMod: number;
  /** 威力倍率 */
  powerMod: number;
  /** 护盾槽上限 */
  guardMax: number;
  /** 全部招式 */
  moves: Record<MoveSlot, Move>;
}

/** 能量槽上限 */
export const METER_MAX = 100;
/** LV1 超必要多少能量 */
export const SUPER_LV1_COST = 50;
/** LV2 超必要多少能量 */
export const SUPER_LV2_COST = 100;
/** 一招从起手到收完一共多少帧 */
export function totalFrames(move: Move): number {
  return move.startup + move.active + move.recovery;
}

// ---------------------------------------------------------------------------
// 普通招骨架:十个人共用同一份底稿,再按打法类型与角色倍率各自变形
// ---------------------------------------------------------------------------

type NormalTemplate = Omit<Move, "slot" | "name" | "note">;

const BASE_NORMALS: Record<NormalSlot, NormalTemplate> = {
  // 站立轻击:最快的起手,连段的第一段
  "5L": {
    kind: "light",
    height: "mid",
    startup: 5,
    active: 3,
    recovery: 9,
    cancelLag: 10,
    power: 5,
    hitStun: 16,
    blockStun: 9,
    knockback: 2.4,
    launch: 0,
    meterGain: 6,
    meterCost: 0,
    guardCost: 6,
    priority: 2,
    box: { x: 18, y: 46, w: 42, h: 26 },
    hitStop: 4,
    groundOnly: true
  },
  // 站立重击:慢、收招大,但挡下来护盾掉得多
  "5H": {
    kind: "heavy",
    height: "mid",
    startup: 11,
    active: 4,
    recovery: 18,
    cancelLag: 12,
    power: 11,
    hitStun: 23,
    blockStun: 12,
    knockback: 5.6,
    launch: 0,
    meterGain: 10,
    meterCost: 0,
    guardCost: 13,
    priority: 4,
    box: { x: 20, y: 34, w: 60, h: 34 },
    hitStop: 6,
    groundOnly: true
  },
  // 蹲轻:出得快、判定低,站着挡的人挡不住
  "2L": {
    kind: "light",
    height: "low",
    startup: 6,
    active: 3,
    recovery: 10,
    cancelLag: 9,
    power: 4,
    hitStun: 14,
    blockStun: 8,
    knockback: 1.8,
    launch: 0,
    meterGain: 5,
    meterCost: 0,
    guardCost: 5,
    priority: 2,
    box: { x: 16, y: 6, w: 44, h: 22 },
    hitStop: 4,
    groundOnly: true
  },
  // 蹲重:扫腿,命中放倒,是起身猜拳的起点
  "2H": {
    kind: "heavy",
    height: "low",
    startup: 12,
    active: 4,
    recovery: 21,
    cancelLag: 11,
    power: 10,
    hitStun: 20,
    blockStun: 11,
    knockback: 4.4,
    launch: 0,
    meterGain: 9,
    meterCost: 0,
    guardCost: 12,
    priority: 3,
    box: { x: 18, y: 2, w: 64, h: 24 },
    hitStop: 6,
    knockdown: true,
    groundOnly: true
  },
  // 空中轻击:跳入的起手,算上段
  jL: {
    kind: "light",
    height: "high",
    startup: 6,
    active: 6,
    recovery: 10,
    cancelLag: 12,
    power: 6,
    hitStun: 18,
    blockStun: 10,
    knockback: 2.2,
    launch: 0,
    meterGain: 6,
    meterCost: 0,
    guardCost: 7,
    priority: 3,
    box: { x: 14, y: 22, w: 46, h: 30 },
    hitStop: 5,
    airOnly: true
  },
  // 空中重击(下踢):算上段,必须站着挡;命中后落地能接地面连
  jH: {
    kind: "heavy",
    height: "high",
    startup: 9,
    active: 7,
    recovery: 12,
    cancelLag: 14,
    power: 12,
    hitStun: 24,
    blockStun: 13,
    knockback: 3.2,
    launch: 0,
    meterGain: 10,
    meterCost: 0,
    guardCost: 14,
    priority: 4,
    box: { x: 12, y: 4, w: 50, h: 36 },
    hitStop: 6,
    airOnly: true
  },
  // 投技:挡不住,但要贴身,而且对手不能在硬直或投无敌里
  throw: {
    kind: "throw",
    height: "throw",
    startup: 5,
    active: 2,
    recovery: 22,
    cancelLag: 0,
    power: 14,
    hitStun: 40,
    blockStun: 0,
    knockback: 26,
    launch: 0,
    meterGain: 8,
    meterCost: 0,
    guardCost: 0,
    priority: 9,
    box: { x: 6, y: 20, w: 30, h: 40 },
    hitStop: 8,
    knockdown: true,
    groundOnly: true
  },
  // 跳投:空中按投,抱起来转个圈再轻轻放下
  airThrow: {
    kind: "throw",
    height: "throw",
    startup: 4,
    active: 3,
    recovery: 16,
    cancelLag: 0,
    power: 13,
    hitStun: 38,
    blockStun: 0,
    knockback: 20,
    launch: 0,
    meterGain: 8,
    meterCost: 0,
    guardCost: 0,
    priority: 9,
    box: { x: 6, y: 14, w: 32, h: 34 },
    hitStop: 8,
    knockdown: true,
    airOnly: true
  }
};

/** 打法类型对普通招的整体调校 */
interface ArchetypeTune {
  startup: number;
  recovery: number;
  power: number;
  reach: number;
  /** 投技威力另算:抓投型的投特别重 */
  throwPower: number;
}

const ARCHETYPE_TUNE: Record<Archetype, ArchetypeTune> = {
  rush: { startup: 0.9, recovery: 0.92, power: 0.92, reach: 0.95, throwPower: 1 },
  zoner: { startup: 1.08, recovery: 1.06, power: 0.95, reach: 1.12, throwPower: 0.85 },
  grappler: { startup: 1.12, recovery: 1.1, power: 1.12, reach: 0.92, throwPower: 1.45 },
  charge: { startup: 1.05, recovery: 1.02, power: 1.08, reach: 1.04, throwPower: 1.05 }
};

/** 普通招的中文名:同一个槽位,不同打法类型叫法不一样 */
const NORMAL_NAMES: Record<Archetype, Record<NormalSlot, string>> = {
  rush: {
    "5L": "轻点掌",
    "5H": "旋身推",
    "2L": "低扫花",
    "2H": "滑地扫",
    jL: "空中点",
    jH: "落叶踢",
    throw: "转圈抱",
    airThrow: "空中抱"
  },
  zoner: {
    "5L": "远指弹",
    "5H": "长杆推",
    "2L": "贴地弹",
    "2H": "扫地光",
    jL: "空中弹",
    jH: "俯冲光",
    throw: "拉近抱",
    airThrow: "空中拽"
  },
  grappler: {
    "5L": "短掌",
    "5H": "厚墩撞",
    "2L": "矮身推",
    "2H": "沉地扫",
    jL: "空中拍",
    jH: "坠身压",
    throw: "大回旋抱",
    airThrow: "空中大抱"
  },
  charge: {
    "5L": "起手弹",
    "5H": "蓄力推",
    "2L": "低蓄弹",
    "2H": "蓄地扫",
    jL: "空中弹",
    jH: "重踩落",
    throw: "旋身抱",
    airThrow: "空中旋抱"
  }
};

const NORMAL_NOTES: Record<NormalSlot, string> = {
  "5L": "起手最快,连段从这里开始",
  "5H": "威力高、收招大,挡下来护盾掉得多",
  "2L": "下段,站着挡的人挡不住",
  "2H": "下段扫腿,命中放倒,起身猜拳从这里开始",
  jL: "上段,跳过去先用它探一下",
  jH: "上段下踢,命中落地能接地面连",
  throw: "挡不住,但要贴身;对手在硬直或投无敌里抓不着",
  airThrow: "空中抱起来转个圈,再轻轻放下"
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function scaleBox(box: Box, reach: number): Box {
  return { x: Math.round(box.x * reach), y: box.y, w: Math.round(box.w * reach), h: box.h };
}

interface CharSpec {
  id: string;
  name: string;
  emoji: string;
  color: string;
  ink: string;
  look: CharLook;
  archetype: Archetype;
  blurb: string;
  style: string;
  vigor: number;
  walk: number;
  backWalk: number;
  jump: number;
  gravity: number;
  halfWidth: number;
  height: number;
  crouchHeight: number;
  reach: number;
  startupMod: number;
  recoveryMod: number;
  powerMod: number;
  guardMax: number;
  specials: {
    s1: SpecialSpec;
    s2: SpecialSpec;
    sv1: SpecialSpec;
    sv2: SpecialSpec;
  };
}

type SpecialSpec = Partial<Omit<Move, "slot" | "name" | "note">> & { name: string; note: string };

/** 必杀底稿 */
const SPECIAL_BASE: Omit<Move, "slot" | "name" | "note"> = {
  kind: "special",
  height: "mid",
  startup: 13,
  active: 5,
  recovery: 24,
  cancelLag: 14,
  power: 15,
  hitStun: 26,
  blockStun: 14,
  knockback: 7,
  launch: 0,
  meterGain: 12,
  meterCost: 0,
  guardCost: 16,
  priority: 6,
  box: { x: 22, y: 26, w: 70, h: 44 },
  hitStop: 7
};

/** LV1 超必底稿:槽 50,起手有短无敌 */
const SUPER1_BASE: Omit<Move, "slot" | "name" | "note"> = {
  kind: "super",
  height: "mid",
  startup: 9,
  active: 8,
  recovery: 30,
  cancelLag: 0,
  power: 26,
  hitStun: 34,
  blockStun: 18,
  knockback: 12,
  launch: 0,
  meterGain: 0,
  meterCost: SUPER_LV1_COST,
  guardCost: 26,
  priority: 8,
  box: { x: 20, y: 20, w: 92, h: 62 },
  hitStop: 9,
  invulnFrom: 0,
  invulnTo: 8,
  knockdown: true
};

/** LV2 超必底稿:槽 100,无敌更长、演出更足 */
const SUPER2_BASE: Omit<Move, "slot" | "name" | "note"> = {
  kind: "super",
  height: "mid",
  startup: 7,
  active: 10,
  recovery: 34,
  cancelLag: 0,
  power: 38,
  hitStun: 40,
  blockStun: 20,
  knockback: 16,
  launch: 0,
  meterGain: 0,
  meterCost: SUPER_LV2_COST,
  guardCost: 40,
  priority: 9,
  box: { x: 18, y: 14, w: 108, h: 76 },
  hitStop: 11,
  invulnFrom: 0,
  invulnTo: 12,
  knockdown: true,
  guardCrush: true
};

function buildNormals(spec: CharSpec): Record<NormalSlot, Move> {
  const tune = ARCHETYPE_TUNE[spec.archetype];
  const out = {} as Record<NormalSlot, Move>;
  for (const slot of NORMAL_SLOTS) {
    const t = BASE_NORMALS[slot];
    const reach = tune.reach * spec.reach;
    const powerMul = slot === "throw" || slot === "airThrow" ? tune.throwPower : tune.power;
    out[slot] = {
      ...t,
      slot,
      name: NORMAL_NAMES[spec.archetype][slot],
      note: NORMAL_NOTES[slot],
      startup: Math.max(3, Math.round(t.startup * tune.startup * spec.startupMod)),
      recovery: Math.max(5, Math.round(t.recovery * tune.recovery * spec.recoveryMod)),
      power: Math.max(2, Math.round(t.power * powerMul * spec.powerMod)),
      knockback: round1(t.knockback * (spec.archetype === "grappler" ? 1.15 : 1)),
      box: scaleBox(t.box, reach)
    };
  }
  return out;
}

function buildSpecial(slot: MoveSlot, base: Omit<Move, "slot" | "name" | "note">, spec: SpecialSpec, powerMod: number): Move {
  const merged: Move = { ...base, ...spec, slot, name: spec.name, note: spec.note };
  return { ...merged, power: Math.max(3, Math.round(merged.power * powerMod)) };
}

// ---------------------------------------------------------------------------
// 十位原创小伙伴
// ---------------------------------------------------------------------------

const CHAR_SPECS: CharSpec[] = [
  {
    id: "duoduo",
    name: "朵朵",
    emoji: "🌸",
    color: "#FFC1DC",
    ink: "#B85C8A",
    look: { hat: "flower", dress: "#f78bb8", trim: "#79c86e" },
    archetype: "rush",
    blurb: "一朵爱练招的小花,连招接得又快又顺。",
    style: "起手快、连段长,适合第一次上手",
    vigor: 120,
    walk: 2.5,
    backWalk: 1.9,
    jump: 11.4,
    gravity: 0.62,
    halfWidth: 15,
    height: 74,
    crouchHeight: 48,
    reach: 1,
    startupMod: 1,
    recoveryMod: 1,
    powerMod: 1,
    guardMax: 100,
    specials: {
      s1: { name: "花瓣掌", note: "近身必杀,命中后取消窗口很宽", power: 15, startup: 11, cancelLag: 16 },
      s2: {
        name: "花瓣升旋",
        note: "把对手挑到空中,接空中连的起点",
        power: 13,
        startup: 9,
        launch: 7.5,
        knockback: 3,
        height: "mid"
      },
      sv1: { name: "漫天花瓣阵", note: "LV1 超必:花瓣从四面围上来", power: 26 },
      sv2: { name: "花海终章", note: "LV2 超必:整片花海推过去,挡下来护盾直接见底", power: 38 }
    }
  },
  {
    id: "xingxing",
    name: "星星",
    emoji: "⭐",
    color: "#FFE08A",
    ink: "#B98A1E",
    look: { hat: "star", dress: "#ffd25e", trim: "#5fa8e8" },
    archetype: "zoner",
    blurb: "会丢星光弹的小星星,喜欢在远处点人。",
    style: "远距离压制,靠星光弹逼对手跳过来",
    vigor: 112,
    walk: 2.2,
    backWalk: 2.1,
    jump: 11,
    gravity: 0.6,
    halfWidth: 15,
    height: 72,
    crouchHeight: 47,
    reach: 1.05,
    startupMod: 1,
    recoveryMod: 1,
    powerMod: 0.98,
    guardMax: 96,
    specials: {
      s1: {
        name: "星光弹",
        note: "投射必杀:一颗星光往前飘,逼对手动起来",
        power: 11,
        startup: 15,
        active: 3,
        recovery: 26,
        projectile: true,
        projectileSpeed: 6.4,
        box: { x: 26, y: 30, w: 34, h: 30 },
        knockback: 5
      },
      s2: { name: "星星回旋", note: "转身一圈,贴边时特别好接", power: 16, startup: 12, launch: 5.5 },
      sv1: { name: "满天星幕", note: "LV1 超必:一排星光同时亮起来", power: 25 },
      sv2: { name: "银河长河", note: "LV2 超必:一整条星河横着推过去", power: 37 }
    }
  },
  {
    id: "nuonuo",
    name: "糯糯",
    emoji: "🍡",
    color: "#FFD9C7",
    ink: "#B5744F",
    look: { hat: "dango", dress: "#ffbf9e", trim: "#f28bb1" },
    archetype: "grappler",
    blurb: "软软糯糯的小团子,抱住了就转圈圈。",
    style: "近身抓投,投技威力最高的一档",
    vigor: 132,
    walk: 2,
    backWalk: 1.6,
    jump: 10.2,
    gravity: 0.68,
    halfWidth: 17,
    height: 70,
    crouchHeight: 46,
    reach: 0.96,
    startupMod: 1,
    recoveryMod: 1,
    powerMod: 1.04,
    guardMax: 112,
    specials: {
      s1: {
        name: "糯米抱抱",
        note: "指令投:近身抓住转两圈,挡不住",
        kind: "special",
        height: "throw",
        power: 20,
        startup: 8,
        active: 3,
        recovery: 28,
        knockdown: true,
        knockback: 22,
        box: { x: 4, y: 16, w: 36, h: 44 }
      },
      s2: { name: "团团滚地", note: "滚过去撞人,能穿过投射物", power: 14, startup: 14, priority: 7 },
      sv1: { name: "糯米大团圆", note: "LV1 超必:抱起来转好多圈再放下", power: 28 },
      sv2: { name: "团团大回旋", note: "LV2 超必:超长回旋,落地时全场都在飘糯米粉", power: 40 }
    }
  },
  {
    id: "yunyun",
    name: "云云",
    emoji: "☁️",
    color: "#CFE3FF",
    ink: "#5B7FB5",
    look: { hat: "cloud", dress: "#a9cdf7", trim: "#ffffff" },
    archetype: "charge",
    blurb: "慢吞吞的小云朵,蓄好了一下就很沉。",
    style: "蓄力型:憋住一招,放出来又高又远",
    vigor: 124,
    walk: 1.9,
    backWalk: 1.7,
    jump: 10.6,
    gravity: 0.55,
    halfWidth: 16,
    height: 73,
    crouchHeight: 49,
    reach: 1.06,
    startupMod: 1.04,
    recoveryMod: 1,
    powerMod: 1.05,
    guardMax: 104,
    specials: {
      s1: { name: "云朵托举", note: "把对手轻轻托到空中,空中连从这里开始", power: 13, startup: 12, launch: 8.2 },
      s2: {
        name: "厚云压顶",
        note: "蓄力必杀:起手慢,但挡下来护盾掉一大截",
        power: 18,
        startup: 19,
        guardCost: 30,
        guardCrush: true,
        knockdown: true
      },
      sv1: { name: "云海翻涌", note: "LV1 超必:云层从脚下涌上来", power: 27 },
      sv2: { name: "万里云端", note: "LV2 超必:整片天空都是云,收招前一直有判定", power: 39 }
    }
  },
  {
    id: "dundun",
    name: "墩墩",
    emoji: "🧸",
    color: "#E7D2B8",
    ink: "#8A6A45",
    look: { hat: "bear", dress: "#d3b48c", trim: "#8a6a45" },
    archetype: "grappler",
    blurb: "圆滚滚的小墩子,站在那儿就很难推动。",
    style: "元气最厚,近身一抱定胜负",
    vigor: 140,
    walk: 1.8,
    backWalk: 1.4,
    jump: 9.8,
    gravity: 0.72,
    halfWidth: 18,
    height: 68,
    crouchHeight: 45,
    reach: 0.94,
    startupMod: 1.05,
    recoveryMod: 1.05,
    powerMod: 1.08,
    guardMax: 120,
    specials: {
      s1: {
        name: "墩墩巨抱",
        note: "指令投:抓住举高高,再稳稳放下",
        height: "throw",
        power: 22,
        startup: 9,
        active: 3,
        recovery: 30,
        knockdown: true,
        knockback: 24,
        box: { x: 4, y: 14, w: 38, h: 46 }
      },
      s2: { name: "厚墩铁壁", note: "原地一沉,起手有护盾加成,再撞回去", power: 15, startup: 15, guardCost: 24 },
      sv1: { name: "墩墩大车轮", note: "LV1 超必:抱着转成一个大车轮", power: 29 },
      sv2: { name: "满天绒毛", note: "LV2 超必:绒毛炸开,全场都是软软的一团", power: 41 }
    }
  },
  {
    id: "shanshan",
    name: "闪闪",
    emoji: "✨",
    color: "#FFF0B8",
    ink: "#C29A18",
    look: { hat: "spark", dress: "#ffe793", trim: "#ffb14e" },
    archetype: "rush",
    blurb: "一闪一闪的小光点,快得看不清。",
    style: "全场最快的起手,靠速度压满连段",
    vigor: 106,
    walk: 3,
    backWalk: 2.4,
    jump: 12,
    gravity: 0.66,
    halfWidth: 14,
    height: 70,
    crouchHeight: 45,
    reach: 0.96,
    startupMod: 0.9,
    recoveryMod: 0.94,
    powerMod: 0.9,
    guardMax: 92,
    specials: {
      s1: { name: "闪身穿花", note: "瞬间冲过去,命中后取消窗口特别宽", power: 12, startup: 9, cancelLag: 18 },
      s2: { name: "光点连击", note: "连点三下,最后一下把人挑起来", power: 14, startup: 11, launch: 6.4 },
      sv1: { name: "流光穿场", note: "LV1 超必:一道光横穿整个舞台", power: 24 },
      sv2: { name: "满场星火", note: "LV2 超必:全场亮起来,收尾干脆利落", power: 36 }
    }
  },
  {
    id: "lvlvdou",
    name: "绿绿豆",
    emoji: "🌱",
    color: "#CFEFC2",
    ink: "#5C8A44",
    look: { hat: "sprout", dress: "#a9de92", trim: "#5c8a44" },
    archetype: "zoner",
    blurb: "一颗刚发芽的小豆子,豆芽伸得可长了。",
    style: "判定框最长,远远地就能碰到人",
    vigor: 110,
    walk: 2.1,
    backWalk: 2,
    jump: 10.8,
    gravity: 0.58,
    halfWidth: 15,
    height: 75,
    crouchHeight: 48,
    reach: 1.14,
    startupMod: 1.02,
    recoveryMod: 1.04,
    powerMod: 0.96,
    guardMax: 94,
    specials: {
      s1: {
        name: "豆芽弹",
        note: "投射必杀:一颗豆芽贴地滚过去,是下段",
        height: "low",
        power: 10,
        startup: 16,
        active: 3,
        recovery: 25,
        projectile: true,
        projectileSpeed: 5.6,
        box: { x: 24, y: 2, w: 32, h: 24 }
      },
      s2: { name: "长藤缠绕", note: "藤蔓伸得最长,专门戳跳过来的人", power: 15, startup: 13, priority: 7 },
      sv1: { name: "豆田齐发", note: "LV1 超必:一整排豆芽同时冒出来", power: 25 },
      sv2: { name: "藤蔓花园", note: "LV2 超必:藤蔓铺满整个舞台", power: 36 }
    }
  },
  {
    id: "jiujiu",
    name: "啾啾",
    emoji: "🐣",
    color: "#FFE0B2",
    ink: "#C08033",
    look: { hat: "chick", dress: "#ffcf8c", trim: "#ff9d5c" },
    archetype: "rush",
    blurb: "刚学会飞的小啾啾,最喜欢从天上扑下来。",
    style: "跳入最强,空中招判定又大又久",
    vigor: 108,
    walk: 2.6,
    backWalk: 2.2,
    jump: 12.6,
    gravity: 0.52,
    halfWidth: 14,
    height: 68,
    crouchHeight: 44,
    reach: 1,
    startupMod: 0.95,
    recoveryMod: 0.98,
    powerMod: 0.94,
    guardMax: 94,
    specials: {
      s1: { name: "翅膀拍拍", note: "对空必杀:起手就有判定,专治跳过来的人", power: 14, startup: 8, launch: 6, priority: 7 },
      s2: {
        name: "俯冲啄啄",
        note: "空中必杀:斜着冲下来,命中落地能接地面连",
        airOnly: true,
        height: "high",
        power: 13,
        startup: 10,
        active: 8,
        recovery: 14
      },
      sv1: { name: "羽毛旋风", note: "LV1 超必:羽毛卷成一个小旋风", power: 25 },
      sv2: { name: "云上飞翔", note: "LV2 超必:飞到云上再一口气冲下来", power: 37 }
    }
  },
  {
    id: "shuangshuang",
    name: "霜霜",
    emoji: "❄️",
    color: "#D6F0F7",
    ink: "#4E8CA0",
    look: { hat: "snow", dress: "#b3e0ee", trim: "#7fc2d8" },
    archetype: "charge",
    blurb: "住在窗花里的小霜花,慢慢结,结好了很硬。",
    style: "蓄力型:憋一招破防,擅长逼对手放开格挡",
    vigor: 118,
    walk: 2,
    backWalk: 1.8,
    jump: 10.4,
    gravity: 0.6,
    halfWidth: 15,
    height: 72,
    crouchHeight: 47,
    reach: 1.04,
    startupMod: 1.03,
    recoveryMod: 1.01,
    powerMod: 1.02,
    guardMax: 106,
    specials: {
      s1: {
        name: "霜花绽开",
        note: "破防必杀:挡下来护盾掉得最狠",
        power: 14,
        startup: 17,
        guardCost: 32,
        guardCrush: true
      },
      s2: { name: "冰晶托起", note: "冰晶从地上长出来,把对手托到空中", power: 14, startup: 13, launch: 7.8 },
      sv1: { name: "窗花漫舞", note: "LV1 超必:窗花一片片贴上来", power: 26 },
      sv2: { name: "霜原尽头", note: "LV2 超必:整片霜原亮起来,收尾非常干净", power: 38 }
    }
  },
  {
    id: "taotao",
    name: "桃桃",
    emoji: "🍑",
    color: "#FFD3D3",
    ink: "#C06A72",
    look: { hat: "peach", dress: "#ffb0b8", trim: "#8fca6e" },
    archetype: "grappler",
    blurb: "圆圆的小桃子,抱起人来软软的。",
    style: "抓投型里跑得最快,擅长跑过去就抱",
    vigor: 128,
    walk: 2.2,
    backWalk: 1.7,
    jump: 10.6,
    gravity: 0.65,
    halfWidth: 16,
    height: 71,
    crouchHeight: 46,
    reach: 0.98,
    startupMod: 0.98,
    recoveryMod: 1.02,
    powerMod: 1.02,
    guardMax: 108,
    specials: {
      s1: {
        name: "桃花抱转",
        note: "指令投:冲过去抱住转两圈",
        height: "throw",
        power: 19,
        startup: 8,
        active: 3,
        recovery: 26,
        knockdown: true,
        knockback: 20,
        box: { x: 6, y: 16, w: 40, h: 42 }
      },
      s2: { name: "滚桃冲撞", note: "滚过去撞人,贴边时接得特别顺", power: 15, startup: 12, knockback: 5 },
      sv1: { name: "桃林抱抱", note: "LV1 超必:抱着在桃林里转一圈", power: 27 },
      sv2: { name: "满园桃花", note: "LV2 超必:桃花铺满整个舞台", power: 39 }
    }
  }
];

function buildCharacter(spec: CharSpec): Character {
  const normals = buildNormals(spec);
  return {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    color: spec.color,
    ink: spec.ink,
    look: spec.look,
    archetype: spec.archetype,
    blurb: spec.blurb,
    style: spec.style,
    vigor: spec.vigor,
    walk: spec.walk,
    backWalk: spec.backWalk,
    jump: spec.jump,
    gravity: spec.gravity,
    halfWidth: spec.halfWidth,
    height: spec.height,
    crouchHeight: spec.crouchHeight,
    reach: spec.reach,
    startupMod: spec.startupMod,
    recoveryMod: spec.recoveryMod,
    powerMod: spec.powerMod,
    guardMax: spec.guardMax,
    moves: {
      ...normals,
      s1: buildSpecial("s1", SPECIAL_BASE, spec.specials.s1, spec.powerMod),
      s2: buildSpecial("s2", SPECIAL_BASE, spec.specials.s2, spec.powerMod),
      sv1: buildSpecial("sv1", SUPER1_BASE, spec.specials.sv1, spec.powerMod),
      sv2: buildSpecial("sv2", SUPER2_BASE, spec.specials.sv2, spec.powerMod)
    }
  };
}

/** 十位原创角色的完整帧数据 */
export const CHARACTERS: Character[] = CHAR_SPECS.map(buildCharacter);

/** 角色 id 列表(选人界面按这个顺序排) */
export const CHARACTER_IDS: string[] = CHARACTERS.map((c) => c.id);

const BY_ID = new Map<string, Character>(CHARACTERS.map((c) => [c.id, c]));

/** 按 id 取角色;取不到就退回第一个,绝不返回 undefined */
export function characterById(id: string): Character {
  return BY_ID.get(id) ?? CHARACTERS[0];
}

/** 某个打法类型有哪几位角色 */
export function charactersOf(archetype: Archetype): Character[] {
  return CHARACTERS.filter((c) => c.archetype === archetype);
}
