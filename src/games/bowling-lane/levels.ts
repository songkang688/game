// 保龄球小馆 · 188 关关卡表(确定性:同一关每次的瓶型与目标完全一样)。
//
// 八个主题章节合计 188 关,章节和由 level99 的 assertTotal 兜底校验。
// 一关不用打满十格——低章节只打两格,越往后格数越多、目标分越高,
// 中间几章还会往瓶阵里混特殊瓶(铁瓶站得稳、冰瓶滑得远、弹簧瓶撞得狠……),
// 逼着孩子换落点、换旋转,而不是一招鲜打到底。
import { TOTAL_LEVELS, mulberry32, type Chapter } from "../level99";
import { PIN_TRAITS, type AiLevel, type PinKind } from "./logic";
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
  hint: string;
}

const RECIPES: Recipe[] = [
  {
    frames: 2, perFrom: 8, perTo: 12, oil: 0.25, special: null, specialMax: 0,
    hint: "三下按键:先定力度,再定落点,最后定旋转。落点条停在正中间偏一点点就够了。",
  },
  {
    frames: 2, perFrom: 11, perTo: 15, oil: 0.35, special: null, specialMax: 0,
    hint: "口袋在头瓶稍微偏一点的位置。落点正对头瓶反而会剩下两边的角瓶。",
  },
  {
    frames: 3, perFrom: 11, perTo: 14, oil: 0.4, special: "iron", specialMax: 2,
    hint: "铁瓶要正面撞实才推得动,力度别留手。",
  },
  {
    frames: 3, perFrom: 12, perTo: 15, oil: 0.4, special: "ice", specialMax: 3,
    hint: "冰瓶滑得远,把它撞向瓶阵里侧,能顺带扫掉一整排。",
  },
  {
    frames: 3, perFrom: 12, perTo: 15, oil: 0.45, special: "spring", specialMax: 3,
    hint: "弹簧瓶是免费的帮手,让球先碰它,它会替你把角瓶撞飞。",
  },
  {
    frames: 3, perFrom: 13, perTo: 17, oil: 0.5, special: "balloon", specialMax: 4,
    hint: "气球瓶太轻,撞飞了也带不动别人,别指望它连锁。",
  },
  {
    frames: 4, perFrom: 13, perTo: 16, oil: 0.85, special: "iron", specialMax: 2,
    hint: "油厚的球道旋转几乎不起作用,老老实实用落点对准口袋。",
  },
  {
    frames: 4, perFrom: 13, perTo: 17, oil: 0.6, special: "iron", specialMax: 3,
    hint: "四格连打,稳定第一:能补中就别赌全中,分数是一格一格攒出来的。",
  },
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
  return {
    index: level,
    chapter,
    frames: recipe.frames,
    target: Math.round(recipe.frames * perFrame),
    kinds,
    oil: recipe.oil,
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

/** 无尽第 n 格(1 基)的过关分:越往后要求越高 */
export function endlessTarget(frame: number): number {
  const f = Math.max(1, Math.round(frame));
  return Math.min(28, 8 + Math.floor((f - 1) * 1.2));
}

/** 无尽第 n 格的球道:越往后油越厚、特殊瓶越多 */
export function buildEndlessFrame(frame: number): { kinds: PinKind[]; oil: number; target: number; hint: string } {
  const f = Math.max(1, Math.round(frame));
  const rand = mulberry32(3301 + f * 577);
  const kinds: PinKind[] = new Array<PinKind>(PINS).fill("wood");
  const pool: PinKind[] = ["iron", "ice", "spring", "balloon"];
  const count = Math.min(5, Math.floor((f - 1) / 3));
  const order = [6, 9, 7, 8, 3, 5, 4, 1, 2, 0];
  for (let i = 0; i < count; i++) {
    kinds[order[i]] = pool[Math.floor(rand() * pool.length)];
  }
  return {
    kinds,
    oil: Math.min(0.9, 0.3 + f * 0.03),
    target: endlessTarget(f),
    hint: count > 0 ? "混进了特殊瓶,先看清楚哪几个不一样再投。" : "先把节奏稳住,每一格都够到目标分就能一直打下去。",
  };
}

/** 人机对战里电脑的默认档位:章节越靠后越强(给闯关里的陪练用) */
export function skillForChapter(chapter: number): AiLevel {
  if (chapter <= 2) return 1;
  if (chapter <= 5) return 2;
  return 3;
}
