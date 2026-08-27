/**
 * 梨康格斗王 —— 帧数据纯数据表。
 *
 * 这份文件只放"数字"，不放任何判定逻辑：
 *  · 八位原创小伙伴的体型 / 移动力 / 元气 / 格挡槽；
 *  · 每人 7 个普通招 + 1 个投技 + 3 个必杀 + 1 个超必杀的完整帧数据。
 *
 * 帧数据三段式：起手帧 startup → 命中帧 active → 收招帧 recovery。
 * 判定框只在 active 这一段生效，起手和收招都是空档，这就是"能被打断"的地方。
 *
 * 判定与结算全部在 `rules.ts` / `engine.ts`，那边只读这里的数字，不改这里。
 *
 * 说明：这是一款卡通切磋游戏，招式一律是花瓣、星光、云朵、豆芽这类软软的东西，
 * 被打中只会星星飞溅、转圈圈、被弹开，`power` 削的是「元气值」，攒够就换人休息。
 */

/** 一个矩形框（判定框 / 受击框）。坐标系：脚底中心为原点，y 向上为正 */
export interface Box {
  /** 朝向前方的偏移（角色朝右时就是 +x 方向） */
  x: number;
  /** 框底距地面的高度 */
  y: number;
  w: number;
  h: number;
}

/** 世界坐标里的矩形（左下角 + 宽高），判定框重叠就拿它算 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 招式类别：轻击 / 重击 / 必杀 / 超必杀 / 投技 */
export type MoveKind = "light" | "heavy" | "special" | "super" | "throw";

/**
 * 防御高度：
 *  · high 上段（跳跃攻击）——必须站着挡；
 *  · mid  中段——站挡蹲挡都行；
 *  · low  下段（扫腿）——必须蹲着挡；
 *  · throw 投技——挡不住，但贴不上身就抓空。
 */
export type GuardHeight = "high" | "mid" | "low" | "throw";

/** 招式槽位：一个角色固定这 12 个位置，键位与 AI 都按槽位说话 */
export type MoveSlot =
  | "5L"
  | "5H"
  | "2L"
  | "2H"
  | "jL"
  | "jH"
  | "throw"
  | "s1"
  | "s2"
  | "s3"
  | "super";

/** 全部槽位，按展示顺序 */
export const MOVE_SLOTS: MoveSlot[] = ["5L", "5H", "2L", "2H", "jL", "jH", "throw", "s1", "s2", "s3", "super"];

export interface Move {
  slot: MoveSlot;
  /** 招式中文名（超必杀才有专属名，普通招用通用叫法） */
  name: string;
  kind: MoveKind;
  height: GuardHeight;
  /** 起手帧：这一段还打不到人，被抢先就吃亏 */
  startup: number;
  /** 命中帧：判定框生效的帧数 */
  active: number;
  /** 收招帧：这一段动不了，被对手抓住就要挨一串 */
  recovery: number;
  /** 削减对手多少元气 */
  power: number;
  /** 命中后对手僵直帧数 */
  hitStun: number;
  /** 被挡下后对手僵直帧数 */
  blockStun: number;
  /** 命中后把对手推开多远（每帧衰减） */
  knockback: number;
  /** 上挑速度：>0 会把对手挑到空中 */
  launch: number;
  /** 出招方涨多少能量 */
  meterGain: number;
  /** 需要消耗多少能量才能放（超必杀满槽 100） */
  meterCost: number;
  /** 被挡下时消耗对手多少格挡槽 */
  guardCost: number;
  /** 同帧对拼时谁赢：数字大的赢，一样大就双方弹开 */
  priority: number;
  /** 命中帧生效时的判定框 */
  box: Box;
  /** 命中顿帧：命中瞬间双方定格几帧，手感的来源 */
  hitStop: number;
  /**
   * 突进位移：出这一招的人自己往前走多远（分摊在命中帧里）。
   * 说明里写着「冲过去 / 滚过去 / 撞过去」的招必须有这个数，
   * 否则看着是突进、打起来是原地挥空。0 就是站着出招。
   */
  advance: number;
  /**
   * 受击框往前伸出去多少：手脚伸出去了，这一截就得跟着挨打。
   * 够得越远的招伸得越多 —— 长手不再是白嫖，敢戳就得担被戳回来的风险。
   * 只在命中帧与收招帧生效（起手时手还没出去）。
   */
  hurtExtend: number;
  /** 命中直接把对手放倒（连段自然断在这里） */
  knockdown?: boolean;
  /** 只能在空中出 */
  airOnly?: boolean;
  /** 只能在地面出 */
  groundOnly?: boolean;
  /** 破防招：挡下来格挡槽掉得特别多 */
  guardCrush?: boolean;
  /** 一句话说明，训练模式里显示 */
  note: string;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  /** 主色（粉彩） */
  color: string;
  /** 描边 / 深色装饰 */
  ink: string;
  /** 一句话人设 */
  blurb: string;
  /** 打法提示，选人界面显示 */
  style: string;
  /** 元气上限 */
  vigor: number;
  /** 前进速度（每帧） */
  walk: number;
  /** 后退速度（每帧） */
  backWalk: number;
  /** 起跳初速度 */
  jump: number;
  /** 重力（每帧减速） */
  gravity: number;
  /** 身体半宽（推挤与投技距离用） */
  halfWidth: number;
  /** 站立身高 */
  height: number;
  /** 蹲下身高 */
  crouchHeight: number;
  /** 攻击范围倍率：判定框宽度按它缩放 */
  reach: number;
  /** 起手帧倍率：小于 1 就是出招快 */
  startupMod: number;
  /** 收招帧倍率：小于 1 就是硬直小 */
  recoveryMod: number;
  /** 威力倍率 */
  powerMod: number;
  /** 格挡槽上限 */
  guardMax: number;
  /** 全部招式 */
  moves: Record<MoveSlot, Move>;
}

/** 超必杀满槽消耗 */
export const SUPER_COST = 100;
/** 能量槽上限 */
export const METER_MAX = 100;

// ---------------------------------------------------------------------------
// 普通招模板：八个人共用同一份"骨架"，再按角色的三个倍率各自变形
// ---------------------------------------------------------------------------

type NormalTemplate = Omit<Move, "slot" | "name" | "note">;

const NORMAL_TEMPLATES: Record<"5L" | "5H" | "2L" | "2H" | "jL" | "jH" | "throw", NormalTemplate> = {
  // 站立轻击：起手最快的招，连段起点
  "5L": {
    kind: "light",
    height: "mid",
    startup: 4,
    active: 3,
    recovery: 8,
    power: 4,
    hitStun: 15,
    blockStun: 10,
    knockback: 2.2,
    launch: 0,
    meterGain: 5,
    meterCost: 0,
    guardCost: 5,
    priority: 2,
    box: { x: 20, y: 44, w: 40, h: 24 },
    hitStop: 5,
    advance: 0,
    hurtExtend: 6,
    groundOnly: true
  },
  // 站立重击：慢一点，收招大，挡下来格挡槽掉得多
  "5H": {
    kind: "heavy",
    height: "mid",
    startup: 10,
    active: 4,
    recovery: 16,
    power: 9,
    hitStun: 21,
    blockStun: 13,
    knockback: 5.2,
    launch: 0,
    meterGain: 9,
    meterCost: 0,
    guardCost: 11,
    priority: 4,
    box: { x: 22, y: 36, w: 56, h: 30 },
    hitStop: 7,
    advance: 6,
    hurtExtend: 16,
    groundOnly: true
  },
  // 蹲轻击：更矮更快，但打不远
  "2L": {
    kind: "light",
    height: "mid",
    startup: 4,
    active: 3,
    recovery: 9,
    power: 3,
    hitStun: 14,
    blockStun: 9,
    knockback: 1.8,
    launch: 0,
    meterGain: 4,
    meterCost: 0,
    guardCost: 4,
    priority: 2,
    box: { x: 18, y: 14, w: 38, h: 24 },
    hitStop: 4,
    advance: 0,
    hurtExtend: 4,
    groundOnly: true
  },
  // 蹲重击（扫腿）：下段，必须蹲着挡，命中直接放倒
  "2H": {
    kind: "heavy",
    height: "low",
    startup: 11,
    active: 4,
    recovery: 20,
    power: 8,
    hitStun: 22,
    blockStun: 12,
    knockback: 4.6,
    launch: 0,
    meterGain: 9,
    meterCost: 0,
    guardCost: 10,
    priority: 4,
    box: { x: 20, y: 2, w: 62, h: 24 },
    hitStop: 7,
    advance: 10,
    hurtExtend: 20,
    knockdown: true,
    groundOnly: true
  },
  // 跳轻击：上段，必须站着挡
  jL: {
    kind: "light",
    height: "high",
    startup: 5,
    active: 7,
    recovery: 6,
    power: 5,
    hitStun: 16,
    blockStun: 10,
    knockback: 2.4,
    launch: 0,
    meterGain: 6,
    meterCost: 0,
    guardCost: 6,
    priority: 3,
    box: { x: 14, y: 30, w: 42, h: 28 },
    hitStop: 5,
    advance: 0,
    hurtExtend: 6,
    airOnly: true
  },
  // 跳重击：上段，跳进去的主力
  jH: {
    kind: "heavy",
    height: "high",
    startup: 8,
    active: 7,
    recovery: 8,
    power: 9,
    hitStun: 20,
    blockStun: 12,
    knockback: 3.4,
    launch: 0,
    meterGain: 9,
    meterCost: 0,
    guardCost: 10,
    priority: 4,
    box: { x: 16, y: 24, w: 48, h: 34 },
    hitStop: 7,
    advance: 0,
    hurtExtend: 10,
    airOnly: true
  },
  // 投技：挡不住，但要贴身，抓空收招巨大
  throw: {
    kind: "throw",
    height: "throw",
    startup: 6,
    active: 2,
    recovery: 24,
    power: 11,
    hitStun: 0,
    blockStun: 0,
    knockback: 8,
    launch: 0,
    meterGain: 12,
    meterCost: 0,
    guardCost: 0,
    priority: 9,
    box: { x: 10, y: 18, w: 34, h: 52 },
    hitStop: 8,
    advance: 4,
    hurtExtend: 0,
    knockdown: true,
    groundOnly: true
  }
};

/** 普通招的通用叫法（不按角色改，训练模式里一眼能对上键位） */
const NORMAL_NAMES: Record<keyof typeof NORMAL_TEMPLATES, string> = {
  "5L": "站立轻击",
  "5H": "站立重击",
  "2L": "蹲下轻击",
  "2H": "扫堂腿",
  jL: "跳跃轻击",
  jH: "跳跃重击",
  throw: "转圈摔"
};

const NORMAL_NOTES: Record<keyof typeof NORMAL_TEMPLATES, string> = {
  "5L": "出手最快，连段就从它开始",
  "5H": "慢半拍，但挡下来对方格挡槽掉一大块",
  "2L": "矮身快手，贴脸最好用",
  "2H": "下段！对方站着挡是挡不住的",
  jL: "上段，跳起来打，对方得站着挡",
  jH: "跳进去的主力，命中就能接地面连段",
  throw: "挡不住的抱摔，但要贴身，抓空会很惨"
};

interface CharSpec {
  id: string;
  name: string;
  emoji: string;
  color: string;
  ink: string;
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
  /** 三个必杀 + 一个超必杀，逐个写全（角色差异主要就体现在这儿） */
  specials: [Move, Move, Move, Move];
}

function roundUpAtLeast(value: number, min: number): number {
  return Math.max(min, Math.round(value));
}

/** 把模板按角色倍率变形成这个角色真正的普通招 */
function tuneNormal(slot: keyof typeof NORMAL_TEMPLATES, spec: CharSpec): Move {
  const t = NORMAL_TEMPLATES[slot];
  const isThrow = t.kind === "throw";
  return {
    ...t,
    slot,
    name: NORMAL_NAMES[slot],
    note: NORMAL_NOTES[slot],
    startup: roundUpAtLeast(t.startup * spec.startupMod, 3),
    recovery: roundUpAtLeast(t.recovery * spec.recoveryMod, 4),
    power: roundUpAtLeast(t.power * spec.powerMod, 2),
    // 手伸得越长，露在外面挨打的那一截也越长
    hurtExtend: isThrow ? 0 : Math.round(t.hurtExtend * spec.reach),
    // 投技范围不跟"攻击范围"走：谁都得贴身才抓得到
    box: isThrow
      ? { ...t.box }
      : {
          x: Math.round(t.box.x * spec.reach),
          y: t.box.y,
          w: Math.round(t.box.w * spec.reach),
          h: t.box.h
        }
  };
}

function buildCharacter(spec: CharSpec): Character {
  const [s1, s2, s3, sup] = spec.specials;
  return {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    color: spec.color,
    ink: spec.ink,
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
      "5L": tuneNormal("5L", spec),
      "5H": tuneNormal("5H", spec),
      "2L": tuneNormal("2L", spec),
      "2H": tuneNormal("2H", spec),
      jL: tuneNormal("jL", spec),
      jH: tuneNormal("jH", spec),
      throw: tuneNormal("throw", spec),
      s1,
      s2,
      s3,
      super: sup
    }
  };
}

/**
 * 招式没写 `hurtExtend` 时的默认值：按判定框实际够得多远折算。
 * 超必杀是全屏演出，不按这条走（放的时候人是缩在光里的，不留把柄）。
 */
export function defaultHurtExtend(box: Box, kind: MoveKind): number {
  if (kind === "super" || kind === "throw") return 0;
  return Math.round((box.x + box.w) * 0.2);
}

/** 写必杀技时的小帮手：把默认值填满，只写关心的字段 */
function special(slot: "s1" | "s2" | "s3" | "super", m: Partial<Move> & { name: string; note: string }): Move {
  const isSuper = slot === "super";
  const merged: Move = {
    slot,
    kind: isSuper ? "super" : "special",
    height: "mid",
    startup: 12,
    active: 5,
    recovery: 20,
    power: 12,
    hitStun: 24,
    blockStun: 14,
    knockback: 6,
    launch: 0,
    meterGain: isSuper ? 0 : 12,
    meterCost: isSuper ? SUPER_COST : 0,
    guardCost: 14,
    priority: isSuper ? 8 : 5,
    box: { x: 24, y: 26, w: 70, h: 40 },
    hitStop: 8,
    advance: 0,
    hurtExtend: 0,
    groundOnly: true,
    ...m
  };
  if (m.hurtExtend === undefined) merged.hurtExtend = defaultHurtExtend(merged.box, merged.kind);
  return merged;
}

// ---------------------------------------------------------------------------
// 八位原创小伙伴
// ---------------------------------------------------------------------------

const SPECS: CharSpec[] = [
  {
    id: "duoduo",
    name: "鸭梨",
    emoji: "🍐",
    color: "#FFC7DC",
    ink: "#B24A78",
    blurb: "爱种花的小姑娘，出手干净利落。",
    style: "全能型：速度、范围、威力都在中间，招式好懂，最适合练手感。",
    vigor: 100,
    walk: 3.0,
    backWalk: 2.4,
    jump: 13,
    gravity: 0.62,
    halfWidth: 24,
    height: 92,
    crouchHeight: 62,
    reach: 1.0,
    startupMod: 1.0,
    recoveryMod: 1.0,
    powerMod: 1.0,
    guardMax: 60,
    specials: [
      special("s1", {
        name: "花瓣旋",
        note: "原地转一圈，判定框最大，中距离的看家招",
        startup: 11,
        active: 6,
        recovery: 19,
        power: 12,
        hitStun: 24,
        knockback: 6.4,
        box: { x: 22, y: 22, w: 76, h: 46 }
      }),
      // 前 + 重 = 追风踢：突进招挂在"往前"那个键上。
      // 第 3 轮 R3B-2 的根因就在这儿 —— 原来鸭梨是反的（往后按才往前冲、往前按却是对空），
      // 于是中距离每按一次「前 + 重」都在原地打空一记收招 26 帧的对空招。
      // 八位小伙伴里另外五位的对空招本来就在「后 + 重」，这一改是把她接回同一套口径。
      special("s2", {
        name: "追风踢",
        note: "向前突进一大段，能把跑远的对手追回来",
        startup: 13,
        active: 5,
        recovery: 22,
        power: 13,
        hitStun: 22,
        knockback: 8.5,
        knockdown: true,
        advance: 52,
        box: { x: 26, y: 24, w: 84, h: 36 }
      }),
      // 后 + 重 = 樱吹雪：对空招和大家一样挂在"往后"那个键上
      special("s3", {
        name: "樱吹雪",
        note: "往上挑，专门收拾跳进来的人；起手无敌感很强",
        startup: 8,
        active: 7,
        recovery: 26,
        power: 11,
        hitStun: 26,
        launch: 9,
        knockback: 3.2,
        priority: 7,
        box: { x: 12, y: 40, w: 52, h: 74 }
      }),
      special("super", {
        name: "漫天花雨",
        note: "能量满槽才放：整个屏幕都是花瓣，挡住也会掉不少格挡槽",
        startup: 9,
        active: 12,
        recovery: 34,
        power: 30,
        hitStun: 34,
        blockStun: 22,
        knockback: 11,
        knockdown: true,
        guardCost: 30,
        box: { x: 10, y: 10, w: 150, h: 96 }
      })
    ]
  },
  {
    id: "xingxing",
    name: "康康",
    emoji: "👓",
    color: "#BFD8FF",
    ink: "#3A62A8",
    blurb: "夜里最亮的那颗，跑起来一闪一闪。",
    style: "速度型：走得快、起手快，每下轻飘飘的要靠连段攒分，格斗塔默认派她上场。",
    vigor: 92,
    walk: 3.8,
    backWalk: 3.0,
    jump: 14,
    gravity: 0.6,
    halfWidth: 22,
    height: 88,
    crouchHeight: 58,
    reach: 0.94,
    startupMod: 0.85,
    recoveryMod: 0.95,
    powerMod: 0.88,
    guardMax: 54,
    specials: [
      special("s1", {
        name: "星光弹",
        note: "甩出一颗星光，是全场最长的必杀，远远地骚扰对手",
        startup: 12,
        active: 8,
        recovery: 18,
        power: 9,
        hitStun: 20,
        knockback: 5.4,
        box: { x: 30, y: 30, w: 118, h: 32 }
      }),
      special("s2", {
        name: "流星踢",
        note: "空中专用：斜着扎下来，落点难猜",
        startup: 7,
        active: 9,
        recovery: 14,
        power: 11,
        hitStun: 22,
        height: "high",
        knockback: 4.2,
        advance: 36,
        groundOnly: false,
        airOnly: true,
        box: { x: 16, y: 12, w: 54, h: 46 }
      }),
      special("s3", {
        name: "转身星芒",
        note: "转个圈把身边扫干净，还能把跳过来的人卷上天",
        startup: 9,
        active: 5,
        recovery: 20,
        power: 10,
        hitStun: 23,
        launch: 7.5,
        knockback: 3.6,
        priority: 7,
        box: { x: 12, y: 20, w: 62, h: 66 }
      }),
      special("super", {
        name: "银河大转轮",
        note: "能量满槽才放：拖着长长的星尾横扫全场",
        startup: 8,
        active: 14,
        recovery: 32,
        power: 27,
        hitStun: 32,
        blockStun: 20,
        knockback: 12,
        knockdown: true,
        guardCost: 28,
        box: { x: 12, y: 8, w: 160, h: 88 }
      })
    ]
  },
  {
    id: "nuonuo",
    name: "糯糯",
    emoji: "🍡",
    color: "#FFE6C7",
    ink: "#A9702C",
    blurb: "软软糯糯的小团子，被弹开也不生气。",
    style: "力量型：出手慢半拍，可是一下顶别人两下，扛揍。",
    vigor: 108,
    walk: 2.6,
    backWalk: 2.1,
    jump: 11.5,
    gravity: 0.66,
    halfWidth: 27,
    height: 90,
    crouchHeight: 62,
    reach: 1.02,
    startupMod: 1.1,
    recoveryMod: 1.15,
    powerMod: 1.12,
    guardMax: 66,
    specials: [
      special("s1", {
        name: "糯米滚",
        note: "缩成团滚过去，起手慢但滚起来判定很厚",
        startup: 15,
        active: 8,
        recovery: 24,
        power: 15,
        hitStun: 24,
        knockback: 8.2,
        knockdown: true,
        advance: 46,
        box: { x: 22, y: 4, w: 84, h: 46 }
      }),
      special("s2", {
        name: "年糕拉伸",
        note: "身体拉得老长，是糯糯够得最远的一招",
        startup: 16,
        active: 6,
        recovery: 22,
        power: 13,
        hitStun: 22,
        knockback: 6.4,
        box: { x: 26, y: 34, w: 112, h: 30 }
      }),
      special("s3", {
        name: "团子蹦蹦",
        note: "原地一顶，把对手挑到空中，接得上连段",
        startup: 11,
        active: 6,
        recovery: 28,
        power: 12,
        hitStun: 26,
        launch: 8.5,
        knockback: 2.8,
        priority: 7,
        box: { x: 10, y: 36, w: 56, h: 72 }
      }),
      special("super", {
        name: "糯糯大团圆",
        note: "能量满槽才放：变成超大团子把对手撞得团团转",
        startup: 12,
        active: 10,
        recovery: 36,
        power: 34,
        hitStun: 34,
        blockStun: 22,
        knockback: 12.5,
        knockdown: true,
        guardCost: 32,
        box: { x: 10, y: 4, w: 138, h: 104 }
      })
    ]
  },
  {
    id: "yunyun",
    name: "云云",
    emoji: "☁️",
    color: "#DCE8FF",
    ink: "#5A6EA8",
    blurb: "总在发呆的小云朵，飘到哪算哪。",
    style: "长手型：范围全场第一，可惜起手最慢，得会等机会。",
    vigor: 94,
    walk: 2.8,
    backWalk: 2.6,
    jump: 13.5,
    gravity: 0.55,
    halfWidth: 25,
    height: 94,
    crouchHeight: 64,
    reach: 1.22,
    startupMod: 1.15,
    recoveryMod: 1.1,
    powerMod: 0.95,
    guardMax: 58,
    specials: [
      special("s1", {
        name: "云朵推",
        note: "推出一大团云，范围极大，把人顶到墙边",
        startup: 16,
        active: 7,
        recovery: 22,
        power: 12,
        hitStun: 22,
        knockback: 9.5,
        box: { x: 28, y: 22, w: 122, h: 44 }
      }),
      special("s2", {
        name: "上升气流",
        note: "脚下卷起气流，把跳过来的人吹上天",
        startup: 10,
        active: 8,
        recovery: 26,
        power: 10,
        hitStun: 26,
        launch: 9.5,
        knockback: 2.4,
        priority: 7,
        box: { x: 8, y: 34, w: 60, h: 84 }
      }),
      special("s3", {
        name: "云雾遮眼",
        note: "破防招：挡下来格挡槽掉得飞快，逼对手不敢一直缩着",
        startup: 18,
        active: 5,
        recovery: 20,
        power: 8,
        hitStun: 20,
        blockStun: 18,
        guardCost: 34,
        guardCrush: true,
        knockback: 4.2,
        box: { x: 22, y: 20, w: 92, h: 50 }
      }),
      special("super", {
        name: "云海大回旋",
        note: "能量满槽才放：整片云海转起来，谁站着都得挨一圈",
        startup: 11,
        active: 13,
        recovery: 34,
        power: 28,
        hitStun: 32,
        blockStun: 21,
        knockback: 11.5,
        knockdown: true,
        guardCost: 30,
        box: { x: 8, y: 6, w: 168, h: 100 }
      })
    ]
  },
  {
    id: "dundun",
    name: "墩墩",
    emoji: "🐼",
    color: "#EDEDF5",
    ink: "#4B4B60",
    blurb: "圆滚滚的大块头，最爱竹筒饭和午后打盹。",
    style: "重量级：元气最多、格挡槽最厚，就是慢，靠一招定胜负。",
    vigor: 120,
    walk: 2.2,
    backWalk: 1.8,
    jump: 10.5,
    gravity: 0.72,
    halfWidth: 30,
    height: 96,
    crouchHeight: 66,
    reach: 1.08,
    startupMod: 1.25,
    recoveryMod: 1.3,
    powerMod: 1.25,
    guardMax: 74,
    specials: [
      special("s1", {
        name: "墩墩撞",
        note: "整个身子撞过去，全场最沉的一下",
        startup: 17,
        active: 7,
        recovery: 26,
        power: 18,
        hitStun: 24,
        knockback: 10.5,
        knockdown: true,
        advance: 40,
        priority: 6,
        box: { x: 24, y: 10, w: 90, h: 62 }
      }),
      special("s2", {
        name: "坐垫落下",
        note: "跳起来一屁股坐下，上段，对方必须站着挡",
        startup: 14,
        active: 8,
        recovery: 30,
        power: 16,
        hitStun: 26,
        height: "high",
        knockback: 6.5,
        knockdown: true,
        box: { x: 4, y: 2, w: 72, h: 60 }
      }),
      special("s3", {
        name: "大摆手",
        note: "手臂横着一扫，起手慢得离谱，但挡下来格挡槽掉一大半",
        startup: 20,
        active: 6,
        recovery: 24,
        power: 14,
        hitStun: 22,
        blockStun: 17,
        guardCost: 30,
        guardCrush: true,
        knockback: 8,
        box: { x: 26, y: 30, w: 104, h: 40 }
      }),
      special("super", {
        name: "天旋地转墩",
        note: "能量满槽才放：抱着对手转个十几圈，转完两个人都晕乎乎",
        startup: 13,
        active: 9,
        recovery: 40,
        power: 38,
        hitStun: 36,
        blockStun: 24,
        knockback: 13,
        knockdown: true,
        guardCost: 36,
        box: { x: 8, y: 2, w: 132, h: 106 }
      })
    ]
  },
  {
    id: "shanshan",
    name: "闪闪",
    emoji: "✨",
    color: "#FFF0B8",
    ink: "#A87A16",
    blurb: "一眨眼就跑没影的小家伙，闪来闪去。",
    style: "极速型：起手帧全场最短，可惜元气最少，挨两下就危险。",
    vigor: 86,
    walk: 4.2,
    backWalk: 3.4,
    jump: 14.5,
    gravity: 0.58,
    halfWidth: 21,
    height: 86,
    crouchHeight: 56,
    reach: 0.88,
    startupMod: 0.75,
    recoveryMod: 0.9,
    powerMod: 0.8,
    guardMax: 50,
    specials: [
      special("s1", {
        name: "闪电步",
        note: "唰地穿到对手身后，起手最快，专抢机会",
        startup: 7,
        active: 5,
        recovery: 16,
        power: 8,
        hitStun: 19,
        knockback: 4.6,
        advance: 44,
        box: { x: 18, y: 22, w: 70, h: 44 }
      }),
      special("s2", {
        name: "电光弹指",
        note: "隔空弹一下手指，够得挺远，收招也小",
        startup: 10,
        active: 6,
        recovery: 15,
        power: 9,
        hitStun: 20,
        knockback: 5.2,
        box: { x: 26, y: 32, w: 96, h: 28 }
      }),
      special("s3", {
        name: "闪电上冲",
        note: "笔直冲上天，是闪闪的对空招",
        startup: 6,
        active: 8,
        recovery: 28,
        power: 10,
        hitStun: 25,
        launch: 10,
        knockback: 2.6,
        priority: 7,
        box: { x: 10, y: 38, w: 48, h: 80 }
      }),
      special("super", {
        name: "闪闪大放光",
        note: "能量满槽才放：一口气闪十几下，最后整个场地亮成白色",
        startup: 6,
        active: 16,
        recovery: 30,
        power: 25,
        hitStun: 30,
        blockStun: 19,
        knockback: 10,
        knockdown: true,
        guardCost: 26,
        box: { x: 12, y: 8, w: 146, h: 86 }
      })
    ]
  },
  {
    id: "lvlvdou",
    name: "绿绿豆",
    emoji: "🌱",
    color: "#D6F2C4",
    ink: "#4C7A2A",
    blurb: "刚发芽的小豆芽，蹦蹦跳跳停不下来。",
    style: "连段型：单下轻飘飘，可是取消特别顺，能串出一长条。",
    vigor: 90,
    walk: 3.4,
    backWalk: 2.9,
    jump: 13,
    gravity: 0.6,
    halfWidth: 22,
    height: 84,
    crouchHeight: 56,
    reach: 0.92,
    startupMod: 0.9,
    recoveryMod: 0.85,
    powerMod: 0.82,
    guardMax: 56,
    specials: [
      special("s1", {
        name: "豆芽弹",
        note: "弹出一颗小豆芽，收招极小，连段里随便塞",
        startup: 9,
        active: 5,
        recovery: 13,
        power: 8,
        hitStun: 21,
        knockback: 3.8,
        box: { x: 22, y: 26, w: 74, h: 34 }
      }),
      special("s2", {
        name: "藤蔓缠",
        note: "藤蔓一卷把对手拉近，拉完还能继续连",
        startup: 13,
        active: 6,
        recovery: 18,
        power: 7,
        hitStun: 26,
        knockback: -3.5,
        box: { x: 26, y: 24, w: 100, h: 34 }
      }),
      special("s3", {
        name: "连环豆豆拳",
        note: "噼里啪啦一串小拳头，最后一下往上撩，跳过来的人也接得住",
        startup: 10,
        active: 12,
        recovery: 22,
        power: 11,
        hitStun: 23,
        launch: 7,
        knockback: 4.2,
        priority: 7,
        box: { x: 16, y: 28, w: 72, h: 62 }
      }),
      special("super", {
        name: "豆田大丰收",
        note: "能量满槽才放：脚下长出一整片豆田，一路顶到对面",
        startup: 10,
        active: 15,
        recovery: 30,
        power: 26,
        hitStun: 30,
        blockStun: 20,
        knockback: 10.5,
        knockdown: true,
        guardCost: 27,
        box: { x: 10, y: 2, w: 154, h: 78 }
      })
    ]
  },
  {
    id: "jiujiu",
    name: "啾啾",
    emoji: "🐤",
    color: "#FFE9A8",
    ink: "#B8862A",
    blurb: "叽叽喳喳的小黄鸟，跳得比谁都高。",
    style: "空战型：跳得最高、落得最慢，最擅长从天上压过来。",
    vigor: 88,
    walk: 3.6,
    backWalk: 3.1,
    jump: 16,
    gravity: 0.48,
    halfWidth: 20,
    height: 82,
    crouchHeight: 54,
    reach: 0.86,
    startupMod: 0.8,
    recoveryMod: 1.0,
    powerMod: 0.85,
    guardMax: 52,
    specials: [
      special("s1", {
        name: "啾啾啄",
        note: "小嘴一啄一啄，起手快得很，就是够不远",
        startup: 8,
        active: 6,
        recovery: 16,
        power: 9,
        hitStun: 20,
        knockback: 4.4,
        box: { x: 18, y: 34, w: 62, h: 26 }
      }),
      special("s2", {
        name: "展翅冲",
        note: "空中专用：张开翅膀横着冲过去，速度飞快",
        startup: 6,
        active: 10,
        recovery: 14,
        power: 10,
        hitStun: 21,
        height: "high",
        knockback: 5.4,
        advance: 54,
        groundOnly: false,
        airOnly: true,
        box: { x: 14, y: 16, w: 66, h: 40 }
      }),
      special("s3", {
        name: "羽毛旋风",
        note: "扇出一圈羽毛，把靠近的人吹起来",
        startup: 11,
        active: 7,
        recovery: 24,
        power: 9,
        hitStun: 25,
        launch: 8,
        knockback: 3.4,
        priority: 7,
        box: { x: 10, y: 30, w: 62, h: 70 }
      }),
      special("super", {
        name: "云端大合唱",
        note: "能量满槽才放：把伙伴们全喊来，天上落下一整片羽毛",
        startup: 9,
        active: 14,
        recovery: 32,
        power: 25,
        hitStun: 31,
        blockStun: 20,
        knockback: 10.5,
        knockdown: true,
        guardCost: 26,
        box: { x: 10, y: 6, w: 150, h: 108 }
      })
    ]
  }
];

/** 八位可选角色，顺序即选人界面顺序 */
export const CHARACTERS: Character[] = SPECS.map(buildCharacter);

/** 角色 id → 角色 */
const CHAR_BY_ID = new Map<string, Character>(CHARACTERS.map((c) => [c.id, c]));

/** 按 id 找角色，找不到就退回鸭梨（永远不返回 undefined，免得白屏） */
export function characterById(id: string): Character {
  return CHAR_BY_ID.get(id) ?? CHARACTERS[0];
}

/**
 * 名字太长就缩写（窄屏 HUD 用）。
 * 「绿绿豆」这种三个字的在 360px 上会把元气条挤歪，缩成「绿绿…」正好。
 */
export function shortName(name: string, max = 3): string {
  const chars = [...name];
  if (chars.length <= max) return name;
  return `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
}

/** 拿某个角色某个槽位的招式 */
export function moveOf(charId: string, slot: MoveSlot): Move {
  return characterById(charId).moves[slot];
}

/** 招式总帧数 */
export function totalFrames(move: Move): number {
  return move.startup + move.active + move.recovery;
}

/**
 * 判定框在 active 段里往前长多少的比例。
 * 第一帧只有 (1 − 这个比例) 那么长，最后一帧才是数据表上的完整长度 ——
 * 手是一点点伸出去的，所以「擦着边过去」不会在第一帧就算命中。
 */
export const BOX_GROWTH = 0.18;

/**
 * 这一帧判定框到底多大（按帧给，不是整段共用一个框）。
 * 不在命中帧就原样返回数据表里的框，画面预告用得上。
 */
export function activeBoxAt(move: Move, frame: number): Box {
  const i = frame - move.startup;
  if (i < 0 || i >= move.active) return move.box;
  const t = move.active <= 1 ? 1 : i / (move.active - 1);
  const grown = move.box.w * (1 - BOX_GROWTH * (1 - t));
  return { x: move.box.x, y: move.box.y, w: Math.max(4, Math.round(grown)), h: move.box.h };
}

/** 这一招这一帧该往前挪多少（突进位移平摊在命中帧上） */
export function advanceAt(move: Move, frame: number): number {
  if (move.advance <= 0 || move.active <= 0) return 0;
  const i = frame - move.startup;
  if (i < 0 || i >= move.active) return 0;
  return move.advance / move.active;
}

// ---------------------------------------------------------------------------
// 舞台与全局手感常数
// ---------------------------------------------------------------------------

/** 舞台宽度（逻辑单位，渲染时按比例缩放） */
export const STAGE_WIDTH = 900;
/** 两人一开始各站在中线两边这么远 */
export const START_GAP = 150;
/** 身体离场地边缘最少留这么多 */
export const WALL_MARGIN = 20;
/** 一回合时间（帧，60 帧 = 1 秒） */
export const ROUND_FRAMES = 60 * 75;
/** 一场比赛先赢几回合 */
export const ROUNDS_TO_WIN = 2;
