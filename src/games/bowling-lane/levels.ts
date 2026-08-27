// 保龄球小馆 · 188 关关卡表(确定性:同一关每次的瓶型与目标完全一样)。
//
// 八个主题章节合计 188 关,章节和由 level99 的 assertTotal 兜底校验。
// 一关不用打满十格——低章节只打两格,越往后格数越多、目标分越高,
// 中间几章还会往瓶阵里混特殊瓶(铁瓶站得稳、冰瓶滑得远、弹簧瓶撞得狠……),
// 逼着孩子换落点、换旋转,而不是一招鲜打到底。
import { TOTAL_LEVELS, mulberry32, type Chapter } from "../level99";
import { GUTTER_EDGE, PIN_TRAITS, guideAlpha, splitRack, type AiLevel, type PinKind } from "./logic";
import { PINS } from "./scoring";

export const CHAPTERS: Chapter[] = [
  { name: "新手球道", emoji: "🎳", color: "#ffe6ef", desc: "先摸熟蓄力、落点、旋转这三下,把球稳稳送到瓶阵里", size: 24 },
  { name: "口袋练习场", emoji: "🎯", color: "#e7f4e9", desc: "学会瞄「口袋」——头瓶旁边那条缝,全中都是从这里来的", size: 24 },
  { name: "铁瓶车间", emoji: "⚙️", color: "#f1eadd", desc: "又重又稳的铁瓶登场,得撞得更实才推得动", size: 24 },
  { name: "冰瓶滑道", emoji: "🧊", color: "#e5f2f8", desc: "冰瓶一撞就滑很远,顺手把旁边的一起带倒", size: 24 },
  { name: "弹簧游乐场", emoji: "🪀", color: "#fff3d9", desc: "弹簧瓶撞人力气翻倍,专治怎么都不倒的角瓶", size: 23 },
  { name: "气球嘉年华", emoji: "🎈", color: "#f0e9fb", desc: "气球瓶轻得擦一下就飞,但也容易被吹偏", size: 23 },
  { name: "油面挑战", emoji: "🛢️", color: "#e6f0ff", desc: "球道油厚,旋转几乎拐不动,得靠落点吃饭", size: 23 },
  { name: "冠军球馆", emoji: "🏆", color: "#fde9dd", desc: "四格连打、混合瓶阵,目标分只有稳定发挥才够得着", size: 23 },
];

export interface BowlLevel {
  /** 0 基关号 */
  index: number;
  chapter: number;
  /** 这一关打几格 */
  frames: number;
  /** 过关要拿到的分数 */
  target: number;
  /** 长度 10 的瓶种 */
  kinds: PinKind[];
  /** 打油量 0..1 */
  oil: number;
  /** 开球时哪几个瓶站着:少瓶挑战那一章会留下经典分瓶 */
  standing: boolean[];
  /** 球沟上有没有护栏(有护栏就洗不了沟,是给新手的托底) */
  bumpers: boolean;
  /** 瓶阵横移幅度:0 = 不动 */
  drift: number;
  /** 这一关最多投几球;0 = 不限 */
  ballLimit: number;
  /** 额外目标:连续全中几次(0 = 没有这项);做到了多给一颗星 */
  chainNeed: number;
  /** 瞄准辅助线的浓淡 0..1 */
  guide: number;
  seed: number;
  hint: string;
}

interface Recipe {
  frames: number;
  /** 每格的目标分:章内从 from 走到 to */
  perFrom: number;
  perTo: number;
  oil: number;
  /** 这一章会往瓶阵里混哪种特殊瓶(不混就是 null) */
  special: PinKind | null;
  /** 章末最多混几个特殊瓶 */
  specialMax: number;
  /**
   * 这一章的**玩法花样**(1.2 新增)。八章各是一种,不是同一个模板换数字:
   * 标准阵 / 口袋教学 / 有护栏 / 移动瓶 / 少瓶分瓶 / 无护栏窄道 / 油路弯曲 / 限球数 + 连续全中。
   */
  twist: LevelTwist;
  hint: string;
}

export type LevelTwist = "plain" | "pocket" | "bumper" | "moving" | "split" | "open" | "oily" | "limit";

const RECIPES: Recipe[] = [
  {
    frames: 2, perFrom: 6, perTo: 12, oil: 0.25, special: null, specialMax: 0, twist: "plain",
    hint: "三下按键:先定力度,再定落点,最后定旋转。每一段确认前都能按「↩ 重来」反悔。",
  },
  {
    frames: 2, perFrom: 11, perTo: 15, oil: 0.35, special: null, specialMax: 0, twist: "pocket",
    hint: "口袋在 1 号瓶和 3 号瓶之间那条缝,球道上那两条虚线指的就是它。落点正对头瓶反而会剩下两边的角瓶。",
  },
  {
    frames: 3, perFrom: 11, perTo: 14, oil: 0.4, special: "iron", specialMax: 2, twist: "bumper",
    hint: "这一章球沟上架了护栏,洗不了沟,放心把力度给足——铁瓶要正面撞实才推得动。",
  },
  {
    frames: 3, perFrom: 12, perTo: 15, oil: 0.4, special: "ice", specialMax: 3, twist: "moving",
    hint: "瓶阵会左右挪,球快到跟前才定住:要瞄的是它「等一下在哪」,不是现在在哪。",
  },
  {
    frames: 3, perFrom: 12, perTo: 15, oil: 0.45, special: "spring", specialMax: 3, twist: "split",
    hint: "开球就是留好的分瓶,瓶少但分得开。弹簧瓶是免费的帮手,让球先碰它。",
  },
  {
    frames: 3, perFrom: 13, perTo: 17, oil: 0.5, special: "balloon", specialMax: 4, twist: "open",
    hint: "护栏撤了,球沟还更宽——球道窄了一圈,落点差一点就下沟。气球瓶太轻,别指望它连锁。",
  },
  {
    frames: 4, perFrom: 13, perTo: 16, oil: 0.85, special: "iron", specialMax: 2, twist: "oily",
    hint: "油厚的球道旋转几乎拐不动,老老实实用落点对准口袋。辅助线到这一章已经没有了。",
  },
  {
    frames: 4, perFrom: 13, perTo: 17, oil: 0.6, special: "iron", specialMax: 3, twist: "limit",
    hint: "四格连打还限了球数,稳定第一:能补中就别赌全中。连着全中两次另有一颗星。",
  },
];

/** 每一章的玩法花样(导出给单测横向对比:八章确实各不相同) */
export const CHAPTER_TWISTS: LevelTwist[] = RECIPES.map((r) => r.twist);

/**
 * 少瓶挑战用的几副经典分瓶(瓶号是 1 基)。
 * 都是留得开、但一球还够得着的那种,不放「7-10 大分瓶」这种成年人都头疼的。
 */
export const SPLITS: number[][] = [
  [3, 7, 9],
  [2, 4, 8, 10],
  [1, 3, 6, 10],
  [2, 3, 5, 8, 9],
  [3, 5, 7, 9],
];

/** 章节起始关号(0 基) */
export function chapterStartLevel(chapter: number): number {
  let acc = 0;
  for (let i = 0; i < chapter && i < CHAPTERS.length; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** level(0 基)属于第几章 */
export function chapterOfLevel(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/**
 * 按配方摆一架瓶:特殊瓶从后排往前排挑(后排的瓶最难打,
 * 把特殊瓶放在那里才算真的加难度),数量随章内进度增加。
 */
export function rackKinds(recipe: Recipe, rand: () => number, ramp: number): PinKind[] {
  const kinds: PinKind[] = new Array<PinKind>(PINS).fill("wood");
  if (!recipe.special || recipe.specialMax <= 0) return kinds;
  const count = Math.max(1, Math.round(recipe.specialMax * (0.4 + ramp * 0.6)));
  // 候选顺序:先角瓶(7、10),再后排,再中排
  const order = [6, 9, 7, 8, 3, 5, 4, 1, 2, 0];
  const picked = new Set<number>();
  let cursor = Math.floor(rand() * order.length);
  while (picked.size < Math.min(count, order.length)) {
    picked.add(order[cursor % order.length]);
    cursor += 1 + Math.floor(rand() * 2);
  }
  for (const i of picked) kinds[i] = recipe.special;
  return kinds;
}

/** 第 index 关(0 基)的完整关卡数据 */
export function buildLevel(index: number): BowlLevel {
  const level = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(index)));
  const chapter = chapterOfLevel(level);
  const inChapter = level - chapterStartLevel(chapter);
  const size = CHAPTERS[chapter].size;
  const recipe = RECIPES[chapter];
  const seed = 4409 + level * 811;
  const rand = mulberry32(seed);
  const ramp = size <= 1 ? 1 : inChapter / (size - 1);
  const perFrame = recipe.perFrom + (recipe.perTo - recipe.perFrom) * ramp;
  const kinds = rackKinds(recipe, rand, ramp);
  const specials = kinds.filter((k) => k !== "wood").length;
  const extra = specials > 0 ? `本关有 ${specials} 个${PIN_TRAITS[kinds.find((k) => k !== "wood") as PinKind].name}:${
    PIN_TRAITS[kinds.find((k) => k !== "wood") as PinKind].line
  }` : "";
  const twist = recipe.twist;
  // 少瓶挑战:开球就摆一副留好的分瓶,瓶少了目标分也要跟着降,不然是刁难人
  const standing =
    twist === "split" ? splitRack(SPLITS[Math.floor(ramp * (SPLITS.length - 0.001))] ?? SPLITS[0]) : new Array<boolean>(PINS).fill(true);
  const pinsUp = standing.filter(Boolean).length;
  const scale = pinsUp >= PINS ? 1 : pinsUp / PINS;
  // 限球数那一章:章内越往后球越紧,但永远给得起「每格两球」的底线
  const ballLimit = twist === "limit" ? recipe.frames * 2 - (ramp > 0.55 ? 1 : 0) : 0;
  const chainNeed = twist === "limit" ? 2 : 0;
  return {
    index: level,
    chapter,
    frames: recipe.frames,
    target: Math.round(recipe.frames * perFrame * scale),
    kinds,
    oil: recipe.oil,
    standing,
    bumpers: twist === "bumper",
    drift: twist === "moving" ? 2.6 + ramp * 2.2 : 0,
    ballLimit,
    chainNeed,
    guide: guideAlpha(chapter),
    seed,
    hint: extra ? `${recipe.hint} ${extra}` : recipe.hint,
  };
}

/** 全部关号,给单测全量扫描用 */
export const ALL_LEVELS: number[] = Array.from({ length: TOTAL_LEVELS }, (_, i) => i);

// ---------------------------------------------------------------------------
// 双人对战:整整十格,两个人轮流投
// ---------------------------------------------------------------------------

export interface VersusSetup {
  frames: number;
  kinds: PinKind[];
  oil: number;
  name: string;
  hint: string;
  seed: number;
}

const VS_LANES = [
  { name: "樱花道", oil: 0.3, special: null as PinKind | null, hint: "油不多,旋转能拐得动,试试从边上拐进口袋。" },
  { name: "薄荷道", oil: 0.55, special: null as PinKind | null, hint: "中等油量,落点比旋转靠谱。" },
  { name: "铁艺道", oil: 0.45, special: "iron" as PinKind | null, hint: "两个铁瓶站在角上,撞实了才倒。" },
  { name: "冰晶道", oil: 0.35, special: "ice" as PinKind | null, hint: "冰瓶会滑很远,连锁特别容易起来。" },
  { name: "弹簧道", oil: 0.5, special: "spring" as PinKind | null, hint: "弹簧瓶帮你干活,先撞它准没错。" },
];

/** 第 round 局(1 基)的对战球道 */
export function buildVersus(round: number): VersusSetup {
  const idx = (Math.max(1, Math.round(round)) - 1) % VS_LANES.length;
  const lane = VS_LANES[idx];
  const seed = 6203 + idx * 419 + Math.max(1, Math.round(round));
  const kinds: PinKind[] = new Array<PinKind>(PINS).fill("wood");
  if (lane.special) {
    kinds[6] = lane.special;
    kinds[9] = lane.special;
  }
  return { frames: 10, kinds, oil: lane.oil, name: lane.name, hint: lane.hint, seed };
}

// ---------------------------------------------------------------------------
// 无尽:一格一格往下打,某一格没够到目标就结束
// ---------------------------------------------------------------------------

/**
 * 无尽第 n 格(1 基)的过关分。
 *
 * 门槛是**跟着档位跳**的:一档之内一格一格慢慢加,跨到下一档才明显抬一级。
 * 头几格特意留得很松——开局就要求补中,孩子刚上手就被劝退了。
 */
export function endlessTarget(frame: number): number {
  const f = Math.max(1, Math.round(frame));
  const tier = endlessTier(f);
  const inTier = (f - 1) % TIER_SIZE;
  return Math.min(28, 6 + tier * 5 + Math.round(inTier * 0.5));
}

/** 每多少格抬一档 */
export const TIER_SIZE = 10;

/**
 * 无尽的难度是**每十格抬一档**的(第 1–10 格是第 0 档,11–20 格第 1 档……)。
 * 一档一档抬,孩子才感觉得到「又上了一层」,而不是每一格都莫名其妙难一点。
 */
export function endlessTier(frame: number): number {
  return Math.floor((Math.max(1, Math.round(frame)) - 1) / TIER_SIZE);
}

/** 这一档的球沟宽度:每抬一档球道就窄一圈(球沟往里长) */
export function endlessGutter(frame: number): number {
  return GUTTER_EDGE + Math.min(4, endlessTier(frame) * 1.1);
}

export interface EndlessFrame {
  kinds: PinKind[];
  oil: number;
  target: number;
  /** 球沟宽度:越往后越宽,球道就越窄 */
  gutter: number;
  /** 开球站着哪几瓶:第三档起开始摆分瓶 */
  standing: boolean[];
  /** 这一档第几层(0 基) */
  tier: number;
  hint: string;
}

/** 无尽第 n 格的球道:每十格抬一档——球道变窄、分瓶更刁、油路更强 */
export function buildEndlessFrame(frame: number): EndlessFrame {
  const f = Math.max(1, Math.round(frame));
  const tier = endlessTier(f);
  const rand = mulberry32(3301 + f * 577);
  const kinds: PinKind[] = new Array<PinKind>(PINS).fill("wood");
  const pool: PinKind[] = ["iron", "ice", "spring", "balloon"];
  const count = Math.min(5, Math.floor((f - 1) / 3));
  const order = [6, 9, 7, 8, 3, 5, 4, 1, 2, 0];
  for (let i = 0; i < count; i++) {
    kinds[order[i]] = pool[Math.floor(rand() * pool.length)];
  }
  // 第三档(第 21 格)起开始摆分瓶,再往后换更刁的一副
  const standing = tier >= 2 ? splitRack(SPLITS[(tier - 2) % SPLITS.length]) : new Array<boolean>(PINS).fill(true);
  const notes: string[] = [];
  if (count > 0) notes.push("混进了特殊瓶,先看清楚哪几个不一样再投");
  if (tier >= 1) notes.push("球道窄了一圈,落点要更小心");
  if (tier >= 2) notes.push("这一档开球就是分瓶,先想好一球能扫掉哪几个");
  return {
    kinds,
    oil: Math.min(0.92, 0.3 + tier * 0.14 + (f % 10) * 0.008),
    target: endlessTarget(f),
    gutter: endlessGutter(f),
    standing,
    tier,
    hint: notes.length > 0 ? `${notes.join(";")}。` : "先把节奏稳住,每一格都够到目标分就能一直打下去。",
  };
}

/** 人机对战里电脑的默认档位:章节越靠后越强(给闯关里的陪练用) */
export function skillForChapter(chapter: number): AiLevel {
  if (chapter <= 2) return 1;
  if (chapter <= 5) return 2;
  return 3;
}
