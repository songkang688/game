/**
 * 英杰令 · 14 名原创英杰与技能。
 *
 * 技能一律写成纯函数 `onEvent(state, event, self) → effects`:
 * 只读局面、只吐效果,自己一个字段都不改,更不认识 DOM。
 * 引擎负责在合适的时机 `trigger` 出事件,再把效果一条条落地。
 *
 * 名字全部原创(花园 / 星空主题),不用真实历史人物,也不写任何桌游的官方武将名。
 * 分级:技能文案只说元气、花瓣、退场休息,不写死亡与流血。
 */
import { isRed, type Card, type CardKind } from "./cards";
import type { GameState } from "./engine";

// ---------------------------------------------------------------------------
// 事件与效果
// ---------------------------------------------------------------------------

/**
 * 技能能听到的事件。分两类:
 * - 数值询问(带 `base` 的):引擎用 `queryNumber` 把各家的 `delta` 加到底数上;
 * - 时机事件:引擎用 `trigger` 收集效果按顺序结算。
 */
export type HeroEvent =
  /** 摸牌阶段摸几张 */
  | { kind: "drawPhase"; who: number; base: number }
  /** 弃牌阶段的手牌上限 */
  | { kind: "handLimit"; who: number; base: number }
  /** 别人算到 who 的距离要额外 + 多少 */
  | { kind: "distanceTo"; who: number; base: number }
  /** who 使用「顺手摘花」时的距离要求 */
  | { kind: "snatchRange"; who: number; base: number }
  /** 这一击要几张「星星盾」才挡得住 */
  | { kind: "dodgeNeeded"; who: number; target: number; base: number }
  /** who 这个回合还能送几张手牌(花主的赠花) */
  | { kind: "giftLimit"; who: number; base: number }
  /** who 打出的这张「花瓣击」是不是不可被挡 */
  | { kind: "unblockable"; who: number; card: Card }
  /** who 受到「花瓣击」时能不能靠翻判定当成挡 */
  | { kind: "judgeDodge"; who: number }
  /** who 能不能把任意手牌当「星星盾」用 */
  | { kind: "anyAsDodge"; who: number }
  /** who 能不能把「星星盾」当「花瓣击」用 */
  | { kind: "dodgeAsSlash"; who: number }
  /** who 能不能改判定 */
  | { kind: "judgeSwap"; who: number }
  /** who 对这张群体锦囊免疫吗 */
  | { kind: "groupTrick"; who: number; card: CardKind }
  /** who 掉了元气,from 是让他掉的人(自己弄掉的填 null) */
  | { kind: "damaged"; who: number; from: number | null; amount: number }
  /** who 刚打出一张「星星盾」 */
  | { kind: "afterDodge"; who: number }
  /** 场上有一件装备离场了 */
  | { kind: "gearLost"; who: number }
  /** who 的元气归零,正在问有没有人救 */
  | { kind: "dying"; who: number };

export type Effect =
  | { kind: "draw"; who: number; n: number }
  | { kind: "heal"; who: number; n: number }
  /** who 从 from 手里抽 n 张牌 */
  | { kind: "steal"; who: number; from: number; n: number }
  /** 数值询问的修正量 */
  | { kind: "delta"; n: number }
  /** 布尔询问的「是」 */
  | { kind: "flag" }
  /** 朵朵的花开:弃两张手牌回到 1 点元气 */
  | { kind: "bloom"; who: number }
  /** 播报一句 */
  | { kind: "note"; text: string };

export interface Skill {
  id: string;
  name: string;
  desc: string;
  /** 纯函数:看一眼局面和事件,吐出效果,绝不改任何东西 */
  onEvent: (state: GameState, event: HeroEvent, self: number) => Effect[];
}

export interface Hero {
  id: string;
  name: string;
  emoji: string;
  /** 元气上限(主公再 +1) */
  vigor: number;
  /** 一句话人设,给界面用 */
  blurb: string;
  skills: Skill[];
  /** 适合当主公候选 */
  lordCandidate?: boolean;
}

const NONE: Effect[] = [];

/** 这一局里某个技能已经用过几次(引擎写、技能读) */
export function useCount(state: GameState, who: number, key: string): number {
  return state.players[who]?.flags?.[key] ?? 0;
}

// ---------------------------------------------------------------------------
// 14 名原创英杰
// ---------------------------------------------------------------------------

export const HEROES: readonly Hero[] = [
  {
    id: "huazhu",
    name: "花主",
    emoji: "🌷",
    vigor: 4,
    blurb: "把最好的一枝花留给同桌的人。",
    lordCandidate: true,
    skills: [
      {
        id: "gift",
        name: "赠花",
        desc: "出牌阶段每回合至多送出两张手牌;送满两张,自己回 1 点元气。",
        onEvent(_state, event, self) {
          if (event.kind !== "giftLimit" || event.who !== self) return NONE;
          return [{ kind: "delta", n: 2 }];
        }
      }
    ]
  },
  {
    id: "xingdu",
    name: "星督",
    emoji: "🔭",
    vigor: 4,
    blurb: "抬头看一眼星象,再决定躲不躲。",
    skills: [
      {
        id: "starlight",
        name: "星辉",
        desc: "每回合一次,受到「花瓣击」时翻一张判定,红门就当打出了「星星盾」。",
        onEvent(state, event, self) {
          if (event.kind !== "judgeDodge" || event.who !== self) return NONE;
          return useCount(state, self, "starlight") < 1 ? [{ kind: "flag" }] : NONE;
        }
      }
    ]
  },
  {
    id: "doujiang",
    name: "豆将",
    emoji: "🫛",
    vigor: 4,
    blurb: "手一扬,红花直接落到对面头上。",
    skills: [
      {
        id: "boldThrow",
        name: "豪掷",
        desc: "你打出红门的「花瓣击」时,对方挡不下来。",
        onEvent(_state, event, self) {
          if (event.kind !== "unblockable" || event.who !== self) return NONE;
          return event.card.kind === "slash" && isRed(event.card) ? [{ kind: "flag" }] : NONE;
        }
      }
    ]
  },
  {
    id: "yunmu",
    name: "云牧",
    emoji: "☁️",
    vigor: 4,
    blurb: "谁扯掉他一片云,他就顺走谁一张牌。",
    skills: [
      {
        id: "cloudHerd",
        name: "牧云",
        desc: "有人让你掉元气,你就从他手里抽一张牌。",
        onEvent(_state, event, self) {
          if (event.kind !== "damaged" || event.who !== self) return NONE;
          if (event.from === null || event.from === self) return NONE;
          return [{ kind: "steal", who: self, from: event.from, n: 1 }];
        }
      }
    ]
  },
  {
    id: "nuonuo",
    name: "糯糯",
    emoji: "🍡",
    vigor: 3,
    blurb: "软软地一挡,顺手再摸一张。",
    skills: [
      {
        id: "softStep",
        name: "软糯",
        desc: "你每打出一张「星星盾」,就摸一张牌。",
        onEvent(_state, event, self) {
          if (event.kind !== "afterDodge" || event.who !== self) return NONE;
          return [{ kind: "draw", who: self, n: 1 }];
        }
      }
    ]
  },
  {
    id: "dundun",
    name: "墩墩",
    emoji: "🗿",
    vigor: 4,
    blurb: "站定了就是一座小石墩,风吹不动。",
    skills: [
      {
        id: "ironPier",
        name: "铁墩",
        desc: "群体锦囊对你没用,不必响应也不掉元气。",
        onEvent(_state, event, self) {
          if (event.kind !== "groupTrick" || event.who !== self) return NONE;
          return [{ kind: "flag" }];
        }
      },
      {
        id: "stockpile",
        name: "厚积",
        desc: "弃牌阶段手牌上限 +1。",
        onEvent(_state, event, self) {
          if (event.kind !== "handLimit" || event.who !== self) return NONE;
          return [{ kind: "delta", n: 1 }];
        }
      }
    ]
  },
  {
    id: "shanshan",
    name: "闪闪",
    emoji: "✨",
    vigor: 3,
    blurb: "一闪就晃到别处去了,盾也能当花用。",
    skills: [
      {
        id: "flashStep",
        name: "疾闪",
        desc: "你的「星星盾」可以当「花瓣击」使用,距离照旧要够。",
        onEvent(_state, event, self) {
          if (event.kind !== "dodgeAsSlash" || event.who !== self) return NONE;
          return [{ kind: "flag" }];
        }
      },
      {
        id: "lightFoot",
        name: "轻身",
        desc: "别人算到你的距离 +1。",
        onEvent(_state, event, self) {
          if (event.kind !== "distanceTo" || event.who !== self) return NONE;
          return [{ kind: "delta", n: 1 }];
        }
      }
    ]
  },
  {
    id: "lvdou",
    name: "绿绿豆",
    emoji: "🌱",
    vigor: 4,
    blurb: "藤蔓伸得比手长,隔一个位子也够得着。",
    skills: [
      {
        id: "vine",
        name: "藤蔓",
        desc: "你使用「顺手摘花」时,距离要求放宽到 2。",
        onEvent(_state, event, self) {
          if (event.kind !== "snatchRange" || event.who !== self) return NONE;
          return [{ kind: "delta", n: 1 }];
        }
      }
    ]
  },
  {
    id: "jiujiu",
    name: "啾啾",
    emoji: "🐤",
    vigor: 3,
    blurb: "啾一声,随便什么都能挡一下。",
    skills: [
      {
        id: "chirp",
        name: "啾鸣",
        desc: "每回合一次,任意一张手牌都能当「星星盾」用。",
        onEvent(state, event, self) {
          if (event.kind !== "anyAsDodge" || event.who !== self) return NONE;
          return useCount(state, self, "chirp") < 1 ? [{ kind: "flag" }] : NONE;
        }
      }
    ]
  },
  {
    id: "xingxing",
    name: "星星",
    emoji: "⭐",
    vigor: 4,
    blurb: "许个愿多摸一张,代价是留不住太多牌。",
    skills: [
      {
        id: "starWish",
        name: "星愿",
        desc: "摸牌阶段多摸一张;弃牌阶段手牌上限 -1。",
        onEvent(_state, event, self) {
          if (event.kind === "drawPhase" && event.who === self) return [{ kind: "delta", n: 1 }];
          if (event.kind === "handLimit" && event.who === self) return [{ kind: "delta", n: -1 }];
          return NONE;
        }
      }
    ]
  },
  {
    id: "duoduo",
    name: "朵朵",
    emoji: "🌸",
    vigor: 4,
    blurb: "花瓣掉光了也还能再开一次。",
    skills: [
      {
        id: "bloomAgain",
        name: "花开",
        desc: "每局一次,元气归零时弃两张手牌,回到 1 点元气。",
        onEvent(state, event, self) {
          if (event.kind !== "dying" || event.who !== self) return NONE;
          if (useCount(state, self, "bloomAgain") >= 1) return NONE;
          if ((state.players[self]?.hand.length ?? 0) < 2) return NONE;
          return [{ kind: "bloom", who: self }];
        }
      }
    ]
  },
  {
    id: "shuangye",
    name: "霜叶",
    emoji: "🍁",
    vigor: 4,
    blurb: "一片霜叶压下来,一张盾是接不住的。",
    skills: [
      {
        id: "frostEdge",
        name: "霜锋",
        desc: "每回合一次,你的「花瓣击」要两张「星星盾」才挡得住。",
        onEvent(state, event, self) {
          if (event.kind !== "dodgeNeeded" || event.who !== self) return NONE;
          return useCount(state, self, "frostEdge") < 1 ? [{ kind: "delta", n: 1 }] : NONE;
        }
      }
    ]
  },
  {
    id: "lubai",
    name: "露白",
    emoji: "💧",
    vigor: 3,
    blurb: "判定牌翻出来之前,先给它换一颗露珠。",
    skills: [
      {
        id: "dewTurn",
        name: "凝露",
        desc: "判定牌生效前,可以用一张手牌把它换掉(只在对自己有利时才换)。",
        onEvent(_state, event, self) {
          if (event.kind !== "judgeSwap" || event.who !== self) return NONE;
          return [{ kind: "flag" }];
        }
      }
    ]
  },
  {
    id: "fengling",
    name: "风铃",
    emoji: "🎐",
    vigor: 3,
    blurb: "桌上掉一件装备,她的铃就响一声。",
    skills: [
      {
        id: "chime",
        name: "铃响",
        desc: "场上任何一件装备离场,你摸一张牌。",
        onEvent(_state, event, self) {
          if (event.kind !== "gearLost") return NONE;
          return [{ kind: "draw", who: self, n: 1 }];
        }
      }
    ]
  }
];

export const HERO_IDS: readonly string[] = HEROES.map((h) => h.id);

const HERO_MAP = new Map<string, Hero>(HEROES.map((h) => [h.id, h]));

export function heroOf(id: string): Hero {
  return HERO_MAP.get(id) ?? HEROES[0];
}

/** 适合当主公的英杰 */
export function lordCandidates(): Hero[] {
  return HEROES.filter((h) => h.lordCandidate);
}

/** 有两个技能的英杰(第 5 章「技能初绽」专门用他们) */
export function twoSkillHeroes(): Hero[] {
  return HEROES.filter((h) => h.skills.length >= 2);
}

// ---------------------------------------------------------------------------
// 事件分发
// ---------------------------------------------------------------------------

/**
 * 把事件发给场上每一名还在场的英杰,收集所有效果。
 * 顺序:从当前回合的人开始按座位绕一圈,保证同一个局面每次结算顺序一致。
 */
export function trigger(state: GameState, event: HeroEvent): Effect[] {
  const out: Effect[] = [];
  const n = state.players.length;
  const start = Number.isFinite(state.turn) ? state.turn : 0;
  for (let k = 0; k < n; k++) {
    const p = state.players[(start + k) % n];
    if (!p || p.out) continue;
    for (const skill of heroOf(p.heroId).skills) {
      const eff = skill.onEvent(state, event, p.id);
      for (const e of eff) out.push(e);
    }
  }
  return out;
}

/** 数值询问:底数 + 各家修正 */
export function queryNumber(state: GameState, event: HeroEvent & { base: number }): number {
  let value = event.base;
  for (const eff of trigger(state, event)) {
    if (eff.kind === "delta") value += eff.n;
  }
  return value;
}

/** 布尔询问:有人举手就是 true */
export function queryFlag(state: GameState, event: HeroEvent): boolean {
  return trigger(state, event).some((e) => e.kind === "flag");
}

/** 某人有没有这个技能 */
export function hasSkill(state: GameState, who: number, skillId: string): boolean {
  const p = state.players[who];
  if (!p) return false;
  return heroOf(p.heroId).skills.some((s) => s.id === skillId);
}
