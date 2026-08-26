// 朵朵抢地主 —— 188 层「地主塔」的关卡表。
//
// 每一关就是一局完整的斗地主,难度靠三件事往上推:
//  1. 电脑档位:轻松 → 认真 → 厉害;
//  2. 发牌照顾:前面几章保证把最好的一手牌发给玩家,后面越来越靠真本事;
//  3. 身份与底分:先固定当地主熟悉规则,之后轮流当地主和农民,底分也一路涨。
//
// 这里只吐数据,不画一个像素;界面(index.ts)照着数据摆牌桌,单测负责验证
// 「章节和恰好 188」「难度只升不降」「照顾力度只减不增」。
import { rateAbove, type Chapter } from "../level99";
import type { AiLevel } from "./ai";
import { dealCards, handStrength } from "./logic";
import type { DealResult } from "./sim";

export const CHAPTERS: Chapter[] = [
  { name: "客厅小牌桌", emoji: "🛋️", color: "#ffe6ef", desc: "第一次摸牌:先认清单张、对子和三张", size: 24 },
  { name: "樱花棋牌屋", emoji: "🌸", color: "#ffe0f2", desc: "学会三带一和三带一对,手里的散牌就有地方去了", size: 24 },
  { name: "云顶茶话会", emoji: "☁️", color: "#e6f0ff", desc: "顺子和连对上场,一口气走掉一长串", size: 24 },
  { name: "月光甲板", emoji: "🌙", color: "#e4e2ff", desc: "飞机起飞!电脑也开始认真算牌了", size: 24 },
  { name: "冰晶大厅", emoji: "❄️", color: "#e0f4fb", desc: "炸弹与王炸登场,倍数一下就翻上去", size: 23 },
  { name: "星火竞技场", emoji: "🔥", color: "#ffeadb", desc: "两个农民会互相配合,单打独斗要吃亏", size: 23 },
  { name: "彩虹擂台", emoji: "🌈", color: "#eafbe4", desc: "高手过招,小心被打出春天", size: 23 },
  { name: "王冠塔顶", emoji: "👑", color: "#fff3d6", desc: "最后一层全是厉害档,底分也最高", size: 23 },
];

/** 塔顶在第几关(1 基),给文案用 */
export const TOWER_TOP = 188;

export interface TowerLevel {
  /** 0 基关号 */
  index: number;
  chapter: number;
  /** 发牌种子(同一关每次发到的牌完全一样) */
  seed: number;
  aiLevel: AiLevel;
  /** 这一关玩家当地主还是农民 */
  playerIsLandlord: boolean;
  /** 底分 1..3 */
  base: number;
  /** 发牌照顾:2 = 把最好的一手给玩家,1 = 给中间那手,0 = 全凭手气 */
  boost: 0 | 1 | 2;
  /** 赢下来时对手阵营还剩这么多张就是 3 星(按预设身份给的预告) */
  starThree: number;
  /** …这么多张就是 2 星 */
  starTwo: number;
  hint: string;
}

/**
 * 评星门槛:当地主时对面是两个人(最多 34 张),当农民时只对一个地主(最多 20 张),
 * 所以两种身份的门槛不一样。真正评星按「这一局实际当了什么」算,叫分叫到哪算哪。
 */
export function starGate(isLandlord: boolean): { three: number; two: number } {
  return isLandlord ? { three: 14, two: 7 } : { three: 10, two: 5 };
}

const CHAPTER_HINTS = [
  "点一下牌它就会跳起来,再点「出牌」把它打出去。",
  "三张一样的可以带一张散牌走,手里就清爽多了。",
  "五张连着就是顺子,一口气能走掉一大串。",
  "两组连着的三张就是飞机,还能带上翅膀。",
  "四张一样的是炸弹,压得住除了王炸以外的所有牌。",
  "当农民时看看队友:队友已经压住了,就别急着抢。",
  "别把 2 和王随手甩掉,留着最后一手翻盘。",
  "塔顶的对手会算牌,先想好这副牌要分几手走完。",
];

function chapterOfIndex(index: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (index < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 第 index 关的电脑档位:每章往上抬一档,章内后半段先尝到下一档的滋味 */
export function aiLevelOf(index: number): AiLevel {
  const ch = chapterOfIndex(index);
  if (ch <= 1) return "easy";
  if (ch === 2) return index % 3 === 2 ? "normal" : "easy";
  if (ch <= 4) return "normal";
  if (ch === 5) return index % 3 === 2 ? "hard" : "normal";
  return "hard";
}

/** 发牌照顾力度:只减不增 */
export function boostOf(index: number): 0 | 1 | 2 {
  const ch = chapterOfIndex(index);
  if (ch <= 1) return 2;
  if (ch <= 4) return 1;
  return 0;
}

/** 生成第 index 关(0 基) */
export function buildLevel(index: number): TowerLevel {
  const i = Math.max(0, Math.min(TOWER_TOP - 1, Math.round(index)));
  const chapter = chapterOfIndex(i);
  // 第一章一律当地主,先把规则玩熟;之后每三关轮一次农民
  const playerIsLandlord = i < CHAPTERS[0].size ? true : i % 3 !== 2;
  const base = chapter <= 1 ? 1 : chapter <= 5 ? 2 : 3;
  const gate = starGate(playerIsLandlord);
  return {
    index: i,
    chapter,
    seed: 70000 + i * 1013,
    aiLevel: aiLevelOf(i),
    playerIsLandlord,
    base,
    boost: boostOf(i),
    starThree: gate.three,
    starTwo: gate.two,
    hint: CHAPTER_HINTS[chapter],
  };
}

/** 188 层塔的完整关卡表 */
export const LEVELS: TowerLevel[] = Array.from({ length: TOWER_TOP }, (_, i) => buildLevel(i));

/**
 * 按关卡配置发一副牌,并告诉界面玩家坐哪家。
 * boost 决定「三手牌里把哪一手给玩家」:数值越大给得越好,这就是新手照顾。
 */
export function dealForLevel(lv: TowerLevel): DealResult & { playerSeat: number; landlord: number } {
  const d = dealCards(lv.seed);
  const order = [0, 1, 2].sort((a, b) => handStrength(d.hands[b]) - handStrength(d.hands[a]));
  // boost=2 把最好的一手给玩家,boost=1 给中间那手,boost=0 不做任何安排(按种子落座,发到什么算什么)
  const playerSeat = lv.boost === 0 ? lv.seed % 3 : order[2 - lv.boost];
  const landlord = lv.playerIsLandlord ? playerSeat : (playerSeat + 1) % 3;
  return { ...d, playerSeat, landlord };
}

/** 赢下这一关能拿几星:对手阵营手上剩的牌越多,赢得越漂亮 */
export function towerStars(remaining: number, isLandlord: boolean): 1 | 2 | 3 {
  const gate = starGate(isLandlord);
  return rateAbove(remaining, gate.three, gate.two);
}

/** 过关时那句夸奖 */
export function towerWinLine(stars: 1 | 2 | 3, remaining: number, isLandlord: boolean): string {
  const who = isLandlord ? "两个农民" : "地主";
  if (stars === 3) return `${who}手上还剩 ${remaining} 张就被你走完啦,赢得真漂亮!`;
  if (stars === 2) return `稳稳拿下!${who}还剩 ${remaining} 张,再快一点就是三星。`;
  return "赢啦!这一局咬得挺紧,下次早点把长牌型走掉会更轻松。";
}

/** 输掉时那句安慰 */
export function towerLoseLine(remaining: number, isLandlord: boolean): string {
  if (remaining <= 3) return `就差 ${remaining} 张牌!再来一次一定能赢回来。`;
  if (isLandlord) return "当地主要一个人打两个,先把小牌顺出去,大牌留到最后。";
  return "农民要一起使劲:队友压住了就让他走,别自己人压自己人。";
}

// ---------------------------------------------------------------------------
// 无尽连胜
// ---------------------------------------------------------------------------

export interface EndlessRound {
  round: number;
  seed: number;
  aiLevel: AiLevel;
  base: number;
  playerIsLandlord: boolean;
}

/** 无尽连胜的第 n 轮:越往后电脑越厉害,底分也越高 */
export function buildEndlessRound(round: number): EndlessRound {
  const n = Math.max(1, Math.round(round));
  return {
    round: n,
    seed: 310000 + n * 7717,
    aiLevel: n <= 2 ? "easy" : n <= 5 ? "normal" : "hard",
    base: n <= 3 ? 1 : n <= 7 ? 2 : 3,
    playerIsLandlord: n % 2 === 1,
  };
}

/** 无尽模式结束时的一句话 */
export function endlessLine(streak: number, best: number): string {
  if (streak === 0) return "第一局就被拦下来啦,别急,再来一次!";
  if (streak >= best) return `连赢 ${streak} 局,刷新了自己的最好成绩!`;
  return `连赢 ${streak} 局,离最好成绩 ${best} 局还差一点点。`;
}
