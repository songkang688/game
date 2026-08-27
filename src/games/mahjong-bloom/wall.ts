/**
 * 花开麻将 · 牌墙与发牌（纯函数，同一个 seed 永远洗出同一副牌）。
 *
 * 牌墙分两段：正常摸牌从头部拿，杠后补牌与补花从**牌尾**拿（国标叫「海底」那一侧）。
 * 这样「妙手回春 / 海底捞月」判定才有意义：牌墙摸空那一张才是最后一张。
 */
import { mulberry32 } from "../level99";
import { DECK_SIZE, fullDeck, isFlower } from "./tiles";

/** 一家起手 13 张，庄家先摸第 14 张 */
export const HAND_SIZE = 13;

/** 四家 */
export const SEAT_COUNT = 4;

/** 洗牌：seed 相同结果就相同，便于关卡复现与 AI 对照实验 */
export function shuffleWall(seed: number): number[] {
  const rand = mulberry32(Math.round(seed) || 1);
  const deck = fullDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

export interface DealResult {
  /** 四家起手（庄家 dealer 那家 14 张，其余 13 张；花牌已补掉） */
  hands: number[][];
  /** 四家补到的花牌 */
  flowers: number[][];
  /** 剩下的牌墙（头部先摸） */
  wall: number[];
  /** 庄家座位号 0..3 */
  dealer: number;
}

/**
 * 发牌 + 补花。补花从牌尾拿，补到手里没有花牌为止；牌不够就停手（绝不死循环）。
 */
export function deal(wall: readonly number[], dealer = 0): DealResult {
  const rest = wall.slice();
  const hands: number[][] = [[], [], [], []];
  const flowers: number[][] = [[], [], [], []];
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let s = 0; s < SEAT_COUNT; s++) {
      const t = rest.shift();
      if (t === undefined) break;
      hands[(dealer + s) % SEAT_COUNT].push(t);
    }
  }
  const first = rest.shift();
  if (first !== undefined) hands[dealer % SEAT_COUNT].push(first);

  // 补花：从牌尾取，直到手里没有花
  for (let s = 0; s < SEAT_COUNT; s++) {
    let guard = 0;
    for (;;) {
      const idx = hands[s].findIndex((t) => isFlower(t));
      if (idx < 0 || rest.length === 0 || guard++ > 16) break;
      flowers[s].push(hands[s][idx]);
      const back = rest.pop();
      if (back === undefined) break;
      hands[s].splice(idx, 1, back);
    }
    hands[s].sort((a, b) => a - b);
  }
  return { hands, flowers, wall: rest, dealer: dealer % SEAT_COUNT };
}

/** 从牌墙头部摸一张；空了返回 null */
export function drawFront(wall: number[]): number | null {
  const t = wall.shift();
  return t === undefined ? null : t;
}

/** 从牌尾补一张（杠后 / 补花用）；空了返回 null */
export function drawBack(wall: number[]): number | null {
  const t = wall.pop();
  return t === undefined ? null : t;
}

/** 牌墙还剩几张 */
export function wallLeft(wall: readonly number[]): number {
  return wall.length;
}

/** 这一张是不是牌墙的最后一张（摸到它自摸叫「妙手回春」，打出去被和叫「海底捞月」） */
export function isLastTile(wallLeftCount: number): boolean {
  return wallLeftCount <= 0;
}

/** 校验一副牌是不是完整的 144 张（洗牌 / 关卡构造的自检） */
export function isCompleteDeck(wall: readonly number[]): boolean {
  if (wall.length !== DECK_SIZE) return false;
  const seen = new Map<number, number>();
  for (const t of wall) seen.set(t, (seen.get(t) ?? 0) + 1);
  for (const [id, n] of seen) {
    if (isFlower(id) ? n !== 1 : n !== 4) return false;
  }
  return true;
}
