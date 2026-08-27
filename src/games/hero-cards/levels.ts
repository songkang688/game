/**
 * 英杰令 · 188 关残局战役。
 *
 * 每一关是一副摆好的残局:给定身份、给定手牌,要在限定的回合数里让本阵营赢下来。
 * 关卡是**构造式**生成的 —— 先想好「这一关打算让人怎么赢」,再按这条线发牌,
 * `solveLevel()` 用同一套规则引擎把这条线真的走一遍,测试断言每一关都 `solvable`。
 */
import { GEARS, makeCard, type Card, type DeckEntry } from "./cards";
import {
  advanceTurn,
  aliveIds,
  campOf,
  canPlay,
  canSlash,
  countCards,
  createGame,
  distanceBetween,
  endTurn,
  exposedCards,
  giftCard,
  giftLeft,
  legalTargets,
  playCard,
  runFlow,
  slashLeft,
  startTurn,
  type GameState,
  type Reply,
  type Request,
  type Role,
  type SeatSpec
} from "./engine";
import { assertTotal, type Chapter } from "../level99";
import { decideRespond, runAiTurn, type AiTier } from "./ai";

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  {
    name: "击挡愈",
    emoji: "🌸",
    color: "#FFE3D6",
    desc: "只有三张基本牌:花瓣击、星星盾、蜜桃愈。先把出牌与响应摸熟。",
    size: 24
  },
  {
    name: "距离学堂",
    emoji: "📏",
    color: "#FFEFD6",
    desc: "坐骑与武器登场。够不够得着,先算距离再出手。",
    size: 24
  },
  {
    name: "锦囊风雨",
    emoji: "🎏",
    color: "#E6F2FF",
    desc: "顺手摘花、拆花篮、对花令、群体锦囊,还有能抵消一切的春风无懈。",
    size: 24
  },
  {
    name: "延时与判定",
    emoji: "🪁",
    color: "#EDE6FF",
    desc: "贪玩令贴到面前,回合一开始先翻判定。红门飘走,黑门就只能干看着。",
    size: 24
  },
  {
    name: "技能初绽",
    emoji: "✨",
    color: "#FFE6F2",
    desc: "带两个技能的英杰上场。技能会改写距离、改写要几张盾。",
    size: 22
  },
  {
    name: "身份推理",
    emoji: "🕵️",
    color: "#E6FFF0",
    desc: "身份牌全扣着。谁打谁、谁救谁,看出牌顺序自己判断。",
    size: 22
  },
  {
    name: "藏花残局",
    emoji: "🎭",
    color: "#FFF3D6",
    desc: "你是藏花。先把别人一个个请下桌,花主要留到最后一个。",
    size: 24
  },
  {
    name: "英杰杯",
    emoji: "🏆",
    color: "#FFDCD6",
    desc: "全套牌堆 + 地狱档对手,还有两家结盟的合作局。",
    size: 24
  }
];

/** 章节大小之和恒等于 188 */
export const TOTAL = 188;

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

// ---------------------------------------------------------------------------
// 牌堆配方:一章一章往里加新牌
// ---------------------------------------------------------------------------

const RECIPES: DeckEntry[][] = [
  // 1 只有基本牌
  [
    { kind: "slash", count: 24 },
    { kind: "dodge", count: 4 },
    { kind: "heal", count: 2 }
  ],
  // 2 加坐骑与武器
  [
    { kind: "slash", count: 22 },
    { kind: "dodge", count: 5 },
    { kind: "heal", count: 3 },
    { kind: "weapon", count: 2, gear: "fan" },
    { kind: "weapon", count: 1, gear: "ribbon" },
    { kind: "horsePlus", count: 2, gear: "plus" },
    { kind: "horseMinus", count: 2, gear: "minus" }
  ],
  // 3 加非延时锦囊
  [
    { kind: "slash", count: 20 },
    { kind: "dodge", count: 8 },
    { kind: "heal", count: 4 },
    { kind: "snatch", count: 3 },
    { kind: "dismantle", count: 3 },
    { kind: "duel", count: 2 },
    { kind: "petalStorm", count: 2 },
    { kind: "starShower", count: 2 },
    { kind: "nullify", count: 2 },
    { kind: "weapon", count: 2, gear: "fan" },
    { kind: "horseMinus", count: 2, gear: "minus" }
  ],
  // 4 加延时锦囊与防具
  [
    { kind: "slash", count: 20 },
    { kind: "dodge", count: 8 },
    { kind: "heal", count: 4 },
    { kind: "snatch", count: 2 },
    { kind: "dismantle", count: 3 },
    { kind: "playful", count: 3 },
    { kind: "nullify", count: 2 },
    { kind: "armor", count: 2, gear: "cloak" },
    { kind: "weapon", count: 2, gear: "fan" },
    { kind: "horseMinus", count: 2, gear: "minus" }
  ]
];

/** 第 5 章往后一律用整套牌 */
function recipeFor(ci: number): DeckEntry[] | undefined {
  return RECIPES[ci];
}

// ---------------------------------------------------------------------------
// 关卡配置
// ---------------------------------------------------------------------------

export interface LevelConfig {
  level: number;
  chapterIndex: number;
  seed: number;
  seats: SeatSpec[];
  /** 玩家最多能过几个自己的回合 */
  maxTurns: number;
  tier: AiTier;
  recipe?: DeckEntry[];
  factionLock: boolean;
  /** 本关目标的一句话 */
  goal: string;
  /** 本关新机制的一句话 */
  hint: string;
  /** 三星要求:几个回合内拿下 */
  threeStarTurns: number;
}

function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

/** 一手牌:按 [种类, 张数] 铺开 */
function hand(spec: Array<[Parameters<typeof makeCard>[0], number]>): Card[] {
  const out: Card[] = [];
  let i = 0;
  for (const [kind, n] of spec) {
    for (let k = 0; k < n; k++) {
      // 红黑轮流发,判定与「豪掷」这类看花色的技能才有得玩
      out.push(makeCard(kind, i % 2 === 0 ? "flower" : "leaf", (i % 13) + 1));
      i++;
    }
  }
  return out;
}

/**
 * 残局里玩家的元气:对手每多一个,压力就多一分,所以按人头给足。
 * 这一类关卡的难点是「几个回合之内拿下」,不是「能不能活下来」。
 */
function playerVigor(foes: number, extra = 0): number {
  return Math.min(12, 5 + foes * 2 + extra);
}

function gearCard(gear: "flute" | "fan" | "ribbon" | "kite" | "wheel" | "cloak" | "plus" | "minus"): Card {
  const kind =
    gear === "cloak" ? "armor" : gear === "plus" ? "horsePlus" : gear === "minus" ? "horseMinus" : "weapon";
  return makeCard(kind, "berry", 6, gear);
}

const FOE_NAMES = ["糯糯", "云云", "闪闪", "啾啾", "墩墩", "绿绿豆", "风铃", "霜叶"];
const SIMPLE_HEROES = ["duoduo", "xingxing", "nuonuo", "yunmu", "doujiang", "lubai"];
const SKILL_HEROES = ["dundun", "shanshan", "xingdu", "jiujiu", "lvdou", "shuangye", "fengling", "huazhu"];
/**
 * 前几章的对手只用「不会额外挡刀」的英杰。
 * 啾啾(任意牌当盾)、星督(翻判定当盾)、朵朵(元气归零还能再开一次)这几位
 * 放在入门章里会让残局算不清,他们留到第 4 章往后再登场。
 */
const PLAIN_FOES = ["nuonuo", "doujiang", "yunmu", "xingxing", "lvdou", "fengling", "shuangye", "lubai"];

/** 第 n 关的完整配置(纯函数,同一关每次都一样) */
export function levelConfig(level: number): LevelConfig {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.floor(level)));
  const ci = chapterIndexOf(lv);
  const k = lv - chapterStartOf(ci);
  const rand = rng(9173 + lv * 131);
  const seed = 4400 + lv * 17;
  const step = Math.floor(k / 6); // 每章内四段难度

  switch (ci) {
    case 0:
      return chapter1(lv, ci, k, step, seed, rand);
    case 1:
      return chapter2(lv, ci, k, step, seed, rand);
    case 2:
      return chapter3(lv, ci, k, step, seed, rand);
    case 3:
      return chapter4(lv, ci, k, step, seed, rand);
    case 4:
      return chapter5(lv, ci, k, step, seed, rand);
    case 5:
      return chapter6(lv, ci, k, step, seed, rand);
    case 6:
      return chapter7(lv, ci, k, step, seed, rand);
    default:
      return chapter8(lv, ci, k, step, seed, rand);
  }
}

/** 第 1 章:三个人坐一圈,谁都够得着,只有基本牌 */
function chapter1(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const foeVigor = step >= 3 ? 2 : step >= 1 ? 1 + (k % 2) : 1;
  const foeDodge = step >= 2 ? 1 : 0;
  const total = foeVigor * 2 + foeDodge * 2;
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: pick(rand, SIMPLE_HEROES),
      role: "lord",
      vigor: playerVigor(2),
      hand: hand([
        ["slash", total + 3],
        ["dodge", 2],
        ["heal", 1]
      ])
    },
    {
      name: FOE_NAMES[k % FOE_NAMES.length],
      heroId: PLAIN_FOES[k % PLAIN_FOES.length],
      role: "rebel",
      vigor: foeVigor,
      hand: hand([["dodge", foeDodge], ["slash", 1]])
    },
    {
      name: FOE_NAMES[(k + 3) % FOE_NAMES.length],
      heroId: PLAIN_FOES[(k + 3) % PLAIN_FOES.length],
      role: "rebel",
      vigor: foeVigor,
      hand: hand([["dodge", foeDodge], ["slash", 1]])
    }
  ];
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: total + 6,
    tier: "rookie",
    recipe: recipeFor(ci),
    factionLock: false,
    goal: "把两位夺花都请下桌",
    hint: "每回合只能出一张花瓣击,先打元气少的那个。",
    threeStarTurns: total + 2
  };
}

/** 第 2 章:座位变多、有人骑着 +1 坐骑,得先换武器 */
function chapter2(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const seatCount = step >= 2 ? 5 : 4;
  const weapon = step >= 3 ? "ribbon" : "fan";
  const foeVigor = 1 + (step >= 2 ? 1 : 0);
  const foes = seatCount - 1;
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: pick(rand, SIMPLE_HEROES),
      role: "lord",
      vigor: playerVigor(foes),
      hand: [
        ...hand([
          ["slash", foes * foeVigor + 5],
          ["dodge", 2],
          ["heal", 1]
        ]),
        gearCard(weapon),
        gearCard("minus")
      ]
    }
  ];
  for (let i = 1; i < seatCount; i++) {
    seats.push({
      name: FOE_NAMES[(k + i) % FOE_NAMES.length],
      heroId: PLAIN_FOES[(k + i) % PLAIN_FOES.length],
      role: "rebel",
      vigor: foeVigor,
      hand: hand([["slash", 1]]),
      // 有人骑着 +1 坐骑,距离就要重新算
      gear: i === 1 && step >= 1 ? [gearCard("plus")] : []
    });
  }
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: foes * foeVigor + 8,
    tier: "rookie",
    recipe: recipeFor(ci),
    factionLock: false,
    goal: `把 ${foes} 位夺花都请下桌`,
    hint: "先挂武器再出手。对面骑着小马,距离要 +1。",
    threeStarTurns: foes * foeVigor + 4
  };
}

/** 第 3 章:锦囊上桌,对面有盾有装备,得先拆再打 */
function chapter3(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const foes = step >= 2 ? 3 : 2;
  const foeVigor = 1 + (step >= 3 ? 1 : 0);
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: pick(rand, SIMPLE_HEROES),
      role: "lord",
      vigor: playerVigor(foes),
      hand: [
        ...hand([
          ["slash", foes * foeVigor + 5],
          ["dismantle", 2],
          ["snatch", 1],
          ["duel", 1],
          ["dodge", 1]
        ]),
        gearCard("ribbon")
      ]
    }
  ];
  for (let i = 1; i <= foes; i++) {
    seats.push({
      name: FOE_NAMES[(k + i) % FOE_NAMES.length],
      heroId: PLAIN_FOES[(k + i) % PLAIN_FOES.length],
      role: "rebel",
      vigor: foeVigor,
      hand: hand([["dodge", step >= 1 ? 1 : 0], ["slash", 1]]),
      gear: i === 1 ? [gearCard("plus")] : []
    });
  }
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: foes * foeVigor + 9,
    tier: step >= 2 ? "normal" : "rookie",
    recipe: recipeFor(ci),
    factionLock: false,
    goal: `把 ${foes} 位夺花都请下桌`,
    hint: "拆花篮能把对面的坐骑拆走,距离一下就近了。",
    threeStarTurns: foes * foeVigor + 4
  };
}

/** 第 4 章:面前贴着贪玩令,回合一开始先翻判定 */
function chapter4(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  // 这一章的对手个个会翻判定挡刀,人多了就变成拉锯战,所以固定两个人、
  // 换成能连射的连珠花轮 —— 三个人的圈子里谁都够得着。
  const foes = 2;
  const foeVigor = 1 + (step >= 2 ? 1 : 0);
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: step >= 1 ? "lubai" : pick(rand, SIMPLE_HEROES),
      role: "lord",
      vigor: playerVigor(foes, 1),
      hand: [
        ...hand([
          ["slash", foes * foeVigor + 8],
          ["dismantle", 2],
          ["playful", 1],
          ["dodge", 1],
          ["heal", 1]
        ]),
        gearCard("wheel"),
        gearCard("minus")
      ],
      // 开局就被贴了一张贪玩令:第一个回合可能是白过的
      delayed: [makeCard("playful", "leaf", 4)]
    }
  ];
  for (let i = 1; i <= foes; i++) {
    seats.push({
      name: FOE_NAMES[(k + i) % FOE_NAMES.length],
      heroId: i === 1 ? "xingdu" : PLAIN_FOES[(k + i) % PLAIN_FOES.length],
      role: "rebel",
      vigor: foeVigor,
      hand: hand([["dodge", 1]]),
      gear: i === 2 ? [gearCard("cloak")] : []
    });
  }
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: foes * foeVigor + 11,
    tier: "normal",
    recipe: recipeFor(ci),
    factionLock: false,
    goal: `把 ${foes} 位夺花都请下桌`,
    hint: "贪玩令判定翻到红门就飘走了;披风也是翻判定,红门算挡。",
    threeStarTurns: foes * foeVigor + 6
  };
}

/** 第 5 章:双技能英杰上场 */
function chapter5(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const heroId = k % 2 === 0 ? "dundun" : "shanshan";
  // 对手也带技能,人数不再往上加,难度靠元气与档位往上走
  const foes = 2;
  const foeVigor = 1 + (step >= 1 ? 1 : 0) + (step >= 3 ? 1 : 0);
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId,
      role: "lord",
      vigor: playerVigor(foes, 1),
      hand: [
        ...hand([
          ["slash", foes * foeVigor + 5],
          ["dodge", 2],
          ["dismantle", 2],
          ["heal", 1]
        ]),
        // 三个人的小桌子上人人都够得着,这时候连珠花轮的「出击不限次」才用得上;
        // 对面若有人「轻身」把距离撑到 2,就靠踏云软靴找回这一步
        gearCard("wheel"),
        gearCard("minus")
      ]
    }
  ];
  for (let i = 1; i <= foes; i++) {
    seats.push({
      name: FOE_NAMES[(k + i) % FOE_NAMES.length],
      heroId: pick(rand, SKILL_HEROES),
      role: "rebel",
      vigor: foeVigor,
      hand: hand([["dodge", 1], ["slash", 1]])
    });
  }
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: foes * foeVigor + 10,
    tier: "normal",
    recipe: recipeFor(ci),
    factionLock: false,
    goal: "用双技能英杰把夺花都请下桌",
    hint: "技能会改写距离和要几张盾,先看清自己这两条再动手。",
    threeStarTurns: foes * foeVigor + 5
  };
}

/** 第 6 章:身份全扣着,靠出牌顺序自己判断 */
function chapter6(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const asRebel = k % 2 === 1;
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: pick(rand, SIMPLE_HEROES),
      role: asRebel ? "rebel" : "loyal",
      vigor: playerVigor(3, 1),
      hand: [
        ...hand([
          ["slash", asRebel ? 8 : 9],
          ["dodge", 2],
          ["dismantle", 2],
          ["heal", 1]
        ]),
        gearCard("kite"),
        gearCard("wheel")
      ],
      revealed: false
    },
    {
      name: "星星",
      heroId: "huazhu",
      role: "lord",
      vigor: asRebel ? 2 + (step >= 2 ? 1 : 0) : 5,
      hand: hand([["dodge", 1], ["slash", 1]]),
      revealed: true
    },
    {
      name: FOE_NAMES[k % FOE_NAMES.length],
      heroId: PLAIN_FOES[k % PLAIN_FOES.length],
      role: asRebel ? "loyal" : "rebel",
      vigor: 1 + (step >= 2 ? 1 : 0),
      hand: hand([["dodge", step >= 1 ? 1 : 0]]),
      revealed: false
    },
    {
      name: FOE_NAMES[(k + 2) % FOE_NAMES.length],
      heroId: PLAIN_FOES[(k + 2) % PLAIN_FOES.length],
      role: asRebel ? "loyal" : "spy",
      vigor: 1 + (step >= 3 ? 1 : 0),
      hand: hand([["slash", 1]]),
      revealed: false
    }
  ];
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: 12,
    tier: step >= 2 ? "pro" : "normal",
    recipe: undefined,
    factionLock: false,
    goal: asRebel ? "只要花主退场就算赢" : "把夺花与藏花都请下桌",
    hint: "身份牌全扣着。谁对花主不客气,谁就多半是夺花。",
    threeStarTurns: 6
  };
}

/** 第 7 章:你是藏花,花主要留到最后一个 */
function chapter7(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const withLoyal = step >= 1;
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: pick(rand, SIMPLE_HEROES),
      role: "spy",
      vigor: playerVigor(3, 2),
      hand: [
        ...hand([
          ["slash", 10],
          ["dodge", 2],
          ["heal", 2],
          ["dismantle", 2]
        ]),
        gearCard("kite"),
        // 桌上只剩两个人的时候换上连珠花轮,才收得了尾
        gearCard("wheel")
      ],
      revealed: false
    },
    {
      name: "星星",
      heroId: "xingxing",
      role: "lord",
      vigor: 4 + (step >= 2 ? 1 : 0),
      hand: hand([["dodge", 1]]),
      revealed: true
    },
    {
      name: FOE_NAMES[k % FOE_NAMES.length],
      heroId: PLAIN_FOES[k % PLAIN_FOES.length],
      role: "rebel",
      vigor: 1,
      hand: hand([["slash", 1]]),
      revealed: false
    }
  ];
  if (withLoyal) {
    seats.push({
      name: FOE_NAMES[(k + 4) % FOE_NAMES.length],
      heroId: PLAIN_FOES[(k + 4) % PLAIN_FOES.length],
      role: "loyal",
      vigor: 1 + (step >= 2 ? 1 : 0),
      hand: hand([["dodge", 1]]),
      revealed: false
    });
  }
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: 14,
    // 残局章也要有坡度：整章 24 关都用菜鸟档的话，这一章会夹在第 6 章
    // （normal → pro）和第 8 章（pro → hell）中间塌成一段低谷。
    // 前 6 关留菜鸟档把「花主留到最后」这条规则教清楚，之后跟上。
    tier: step >= 3 ? "pro" : step >= 1 ? "normal" : "rookie",
    recipe: undefined,
    factionLock: false,
    goal: "全场只剩你一个人,而且花主是最后一个退场的",
    hint: "花主退早了就轮不到你赢。先清干净别人,把花主留到最后。",
    threeStarTurns: 8
  };
}

/** 第 8 章:整套牌 + 地狱档,还有两家结盟的合作局 */
function chapter8(
  level: number,
  ci: number,
  k: number,
  step: number,
  seed: number,
  rand: () => number
): LevelConfig {
  const coop = k % 4 === 3;
  const seats: SeatSpec[] = [
    {
      name: "朵朵",
      heroId: pick(rand, SKILL_HEROES),
      role: coop ? "loyal" : "lord",
      vigor: playerVigor(3, 3),
      hand: [
        ...hand([
          ["slash", 10],
          ["dodge", 3],
          ["heal", 2],
          ["dismantle", 2],
          ["nullify", 1]
        ]),
        gearCard("kite"),
        gearCard("wheel"),
        gearCard("minus")
      ],
      revealed: !coop
    },
    {
      name: "星星",
      heroId: "huazhu",
      role: coop ? "lord" : "loyal",
      vigor: 5,
      hand: hand([["slash", 2], ["dodge", 2], ["heal", 1]]),
      revealed: true
    },
    {
      name: FOE_NAMES[k % FOE_NAMES.length],
      heroId: pick(rand, SKILL_HEROES),
      role: "rebel",
      vigor: 2 + (step >= 2 ? 1 : 0),
      hand: hand([["dodge", 1], ["slash", 1]]),
      revealed: false
    },
    {
      name: FOE_NAMES[(k + 5) % FOE_NAMES.length],
      heroId: pick(rand, SKILL_HEROES),
      role: "rebel",
      vigor: 2 + (step >= 3 ? 1 : 0),
      hand: hand([["dodge", 1], ["slash", 1]]),
      revealed: false
    }
  ];
  return {
    level,
    chapterIndex: ci,
    seed,
    seats,
    maxTurns: 16,
    tier: step >= 2 ? "hell" : "pro",
    recipe: undefined,
    factionLock: coop,
    goal: coop ? "和星星结盟,把两位夺花请下桌(同盟之间不能互相出击牌)" : "把两位夺花都请下桌",
    hint: coop
      ? "这一关是双势力合作:同一边的人不能互相出击牌,火力要一起对外。"
      : "整套牌堆都在,对手是地狱档。先拆装备,再集中火力。",
    threeStarTurns: 9
  };
}

// ---------------------------------------------------------------------------
// 建局
// ---------------------------------------------------------------------------

export function buildLevel(cfg: LevelConfig): GameState {
  return createGame({
    seats: cfg.seats,
    seed: cfg.seed,
    recipe: cfg.recipe,
    factionLock: cfg.factionLock,
    openHand: 0
  });
}

// ---------------------------------------------------------------------------
// 参考解法:按目标顺序清场
// ---------------------------------------------------------------------------

/** 我这一关要请谁下桌,按顺序来(藏花要把花主留到最后) */
export function killOrder(state: GameState, me: number): number[] {
  const my = state.players[me];
  if (!my) return [];
  const alive = aliveIds(state).filter((id) => id !== me);
  const lordId = state.players.findIndex((p) => p.role === "lord");
  if (my.role === "spy") {
    return [...alive.filter((id) => id !== lordId), ...alive.filter((id) => id === lordId)];
  }
  if (my.role === "rebel") {
    return lordId >= 0 && alive.includes(lordId) ? [lordId] : alive.filter((id) => state.players[id].role !== "rebel");
  }
  // 花主与护花:把夺花与藏花都清干净
  return alive.filter((id) => state.players[id].role === "rebel" || state.players[id].role === "spy");
}

type SolverAction = { kind: "play"; card: Card; targets: number[] } | { kind: "gift"; card: Card; to: number } | { kind: "end" };

/** 求解器的一步:先补装备、再保元气、然后拆掉挡路的东西、最后出击 */
export function solverStep(state: GameState, me: number): SolverAction {
  const p = state.players[me];
  if (!p || p.out || state.over) return { kind: "end" };
  const order = killOrder(state, me);
  if (order.length === 0) return { kind: "end" };
  const target = order[0];

  // 1. 武器 / 坐骑先挂上,距离才够。踏云软靴先穿:对面有人「轻身」时全靠它找回一步
  const boots = p.hand.find((c) => c.kind === "horseMinus");
  if (boots && !p.gear.horseMinus && !canSlash(state, me, target)) {
    return { kind: "play", card: boots, targets: [me] };
  }
  const weapons = p.hand.filter((c) => c.kind === "weapon" && c.gear);
  if (weapons.length > 0) {
    const longest = [...weapons].sort((a, b) => (GEARS[b.gear!].range ?? 1) - (GEARS[a.gear!].range ?? 1))[0];
    if (!canSlash(state, me, target)) return { kind: "play", card: longest, targets: [me] };
    // 够得着了,再看看有没有能连射的武器可以换上
    const wheel = weapons.find((c) => GEARS[c.gear!].unlimitedSlash);
    const cur = p.gear.weapon;
    if (wheel && distanceBetween(state, me, target) <= 1 && !(cur?.gear && GEARS[cur.gear].unlimitedSlash)) {
      return { kind: "play", card: wheel, targets: [me] };
    }
    if (!cur) return { kind: "play", card: longest, targets: [me] };
  }
  const minus = p.hand.find((c) => c.kind === "horseMinus");
  if (minus && !p.gear.horseMinus && !canSlash(state, me, target)) return { kind: "play", card: minus, targets: [me] };
  const plus = p.hand.find((c) => c.kind === "horsePlus");
  if (plus && !p.gear.horsePlus) return { kind: "play", card: plus, targets: [me] };
  const armor = p.hand.find((c) => c.kind === "armor");
  if (armor && !p.gear.armor) return { kind: "play", card: armor, targets: [me] };

  // 2. 元气见底就先回一口
  const heal = p.hand.find((c) => c.kind === "heal");
  if (heal && p.vigor <= 2 && p.vigor < p.maxVigor) return { kind: "play", card: heal, targets: [me] };

  // 3. 拆掉挡路的东西:够不着就拆坐骑,老是被翻判定挡下就拆披风
  const dismantle = p.hand.find((c) => c.kind === "dismantle");
  if (dismantle && countCards(state.players[target]) > 0 && legalTargets(dismantle, state, me).includes(target)) {
    const pool = exposedCards(state.players[target]);
    const horse = pool.find((c) => c.kind === "horsePlus");
    if (horse && !canSlash(state, me, target)) return { kind: "play", card: dismantle, targets: [target] };
    if (pool.some((c) => c.kind === "armor")) return { kind: "play", card: dismantle, targets: [target] };
  }

  // 4. 出击
  const slash = p.hand.find((c) => c.kind === "slash");
  if (slash && slashLeft(state, me) && canPlay(state, me, slash, [target])) {
    return { kind: "play", card: slash, targets: [target] };
  }
  // 打不到第一个就换个能打的
  if (slash && slashLeft(state, me)) {
    const legal = legalTargets(slash, state, me).filter((id) => order.includes(id));
    if (legal.length > 0) return { kind: "play", card: slash, targets: [legal[0]] };
  }

  // 5. 出不了击就用锦囊换点便宜
  const duel = p.hand.find((c) => c.kind === "duel");
  if (duel && canPlay(state, me, duel, [target])) return { kind: "play", card: duel, targets: [target] };
  const snatch = p.hand.find((c) => c.kind === "snatch");
  if (snatch && canPlay(state, me, snatch, [target])) return { kind: "play", card: snatch, targets: [target] };
  if (dismantle && canPlay(state, me, dismantle, [target])) return { kind: "play", card: dismantle, targets: [target] };
  const playful = p.hand.find((c) => c.kind === "playful");
  if (playful && canPlay(state, me, playful, [target])) return { kind: "play", card: playful, targets: [target] };

  // 6. 花主的赠花:送张闲牌换 1 点元气
  if (giftLeft(state, me) > 0 && p.vigor < p.maxVigor && p.hand.length > 1) {
    const friend = aliveIds(state).find((id) => id !== me && !order.includes(id));
    const spare = p.hand.find((c) => c.kind !== "slash" && c.kind !== "dodge" && c.kind !== "heal");
    if (typeof friend === "number" && spare) return { kind: "gift", card: spare, to: friend };
  }
  return { kind: "end" };
}

export interface SolveResult {
  solvable: boolean;
  /** 玩家用掉了几个回合 */
  turns: number;
  note: string;
  /** 这一局的播报,关卡体检失败时照着看 */
  log: string[];
}

/** 用同一套规则引擎把参考解法真的走一遍 */
export function solveLevel(level: number, cfg: LevelConfig = levelConfig(level)): SolveResult {
  const state = buildLevel(cfg);
  const me = 0;
  const myCamp = campOf(cfg.seats[me].role);
  const respond = (req: Request): Reply => {
    if (req.who === me) return solverRespond(state, req);
    return decideRespond(state, req, cfg.tier);
  };

  let turns = 0;
  let guard = 0;
  while (!state.over && turns <= cfg.maxTurns && guard++ < 400) {
    const who = state.turn;
    if (state.players[who].out) {
      advanceTurn(state);
      continue;
    }
    if (who === me) {
      turns++;
      startTurn(state, me);
      if (!state.players[me].skipPlay) {
        let steps = 0;
        while (steps++ < 24 && !state.over && !state.players[me].out) {
          const action = solverStep(state, me);
          if (action.kind === "end") break;
          if (action.kind === "gift") {
            if (!giftCard(state, me, action.to, action.card)) break;
            continue;
          }
          if (!canPlay(state, me, action.card, action.targets)) break;
          runFlow(playCard(state, me, action.card, action.targets), respond);
        }
      }
      if (!state.over && !state.players[me].out) runFlow(endTurn(state, me), respond);
    } else {
      runFlow(runAiTurn(state, who, cfg.tier), respond);
    }
    if (state.over) break;
    advanceTurn(state);
  }

  const solvable = state.winner === myCamp;
  return {
    solvable,
    turns,
    note: solvable
      ? `第 ${level + 1} 关:${turns} 个回合拿下`
      : `第 ${level + 1} 关:${turns} 个回合没打完(赢家 ${state.winner ?? "无"},存活 ${aliveIds(state).join("/")})`,
    log: state.log
  };
}

/** 求解器自己的响应:能挡就挡,能救自己就救自己 */
function solverRespond(state: GameState, req: Request): Reply {
  const me = state.players[req.who];
  if (!me) return { card: null };
  if (req.kind === "discard") {
    // 弃牌先弃闲牌:花瓣击是命,还没挂上的武器与拆花篮也不能当垃圾扔掉
    const rank = (c: Card): number => {
      switch (c.kind) {
        case "slash":
          return 6;
        case "weapon":
          return me.gear.weapon ? 2 : 5;
        case "dismantle":
          return 4;
        case "dodge":
        case "heal":
          return 3;
        case "horseMinus":
          return me.gear.horseMinus ? 1 : 3;
        default:
          return 1;
      }
    };
    return { cards: [...me.hand].sort((a, b) => rank(a) - rank(b)).slice(0, req.count) };
  }
  if (req.kind === "pick") {
    const pool = exposedCards(state.players[req.target]);
    const horse = pool.find((c) => c.kind === "horsePlus");
    const gear = pool.find((c) => c.kind === "weapon" || c.kind === "armor");
    return { card: horse ?? gear ?? pool[0] ?? null };
  }
  switch (req.need) {
    case "dodge":
      return { card: me.hand.find((c) => c.kind === "dodge") ?? null };
    case "slash":
      return { card: me.hand.find((c) => c.kind === "slash") ?? null };
    case "heal":
      return req.from === req.who ? { card: me.hand.find((c) => c.kind === "heal") ?? null } : { card: null };
    case "nullify":
      return { card: null };
    default:
      return { card: null };
  }
}

/** 星级:回合越少越漂亮 */
export function starsFor(cfg: LevelConfig, turns: number): 1 | 2 | 3 {
  if (turns <= cfg.threeStarTurns) return 3;
  if (turns <= cfg.threeStarTurns + 3) return 2;
  return 1;
}

/** 界面上那一行「本关目标」 */
export function goalLine(cfg: LevelConfig): string {
  return `🎯 ${cfg.goal} · ${cfg.maxTurns} 个回合内`;
}

/** 章节和恒等 188 */
export function chaptersOk(): boolean {
  return assertTotal(CHAPTERS, TOTAL, "hero-cards");
}

/** 无尽模式:连胜越多,对手越硬 */
export function endlessTier(streak: number): AiTier {
  if (streak >= 9) return "hell";
  if (streak >= 5) return "pro";
  if (streak >= 2) return "normal";
  return "rookie";
}

/** 无尽模式:连胜越多,自己的起手牌越少 */
export function endlessOpenHand(streak: number): number {
  return Math.max(3, 5 - Math.floor(streak / 4));
}
