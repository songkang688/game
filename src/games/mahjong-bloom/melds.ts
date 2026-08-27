/**
 * 花开麻将 · 吃 / 碰 / 杠的合法性（纯函数）。
 *
 * 国标里这三件事的边界：
 * - 吃：**只能吃上家**打出的牌，且只能组顺子（数牌，不跨花色）。
 * - 碰：任何一家打出的牌都能碰，手里得有两张一样的；碰完必须打一张出去。
 * - 杠：明杠（别人打出第 4 张）、暗杠（自己手里 4 张）、加杠（已碰的刻子摸到第 4 张）。
 *   杠完从牌尾补一张，所以杠不会让手牌变少。
 */
import { countOf, isNumber, rankOf, suitOf, type Suit } from "./tiles";

export type MeldKind = "chi" | "pon" | "minkan" | "ankan" | "kakan";

export interface Meld {
  kind: MeldKind;
  /** 这一副的牌（顺子是三张升序，刻子三张相同，杠四张相同） */
  tiles: number[];
  /** 来自哪一家（自己暗杠时等于自己的座位） */
  from: number;
  /** 被吃碰杠的那张牌（暗杠没有） */
  claimed?: number;
}

/** 面子是不是暗的（暗杠算暗，其余副露都算明） */
export function isConcealedMeld(m: Meld): boolean {
  return m.kind === "ankan";
}

/** 是不是杠（三种杠都算） */
export function isKan(m: Meld): boolean {
  return m.kind === "minkan" || m.kind === "ankan" || m.kind === "kakan";
}

/** 明杠：明杠与加杠都按「明杠」计番 */
export function isOpenKan(m: Meld): boolean {
  return m.kind === "minkan" || m.kind === "kakan";
}

/** 这一副折成 3 张的「等价面子」：杠在算番时按刻子看 */
export function meldTriple(m: Meld): number[] {
  if (isKan(m)) return [m.tiles[0], m.tiles[0], m.tiles[0]];
  return m.tiles.slice(0, 3);
}

/** 座位 seat 的上家（逆时针，上家是 seat-1） */
export function upperSeat(seat: number): number {
  return (seat + 3) % 4;
}

/** 座位 seat 的下家 */
export function lowerSeat(seat: number): number {
  return (seat + 1) % 4;
}

/** 打牌人 discarder 相对 seat 是不是上家（只有上家打的才能吃） */
export function isUpperOf(seat: number, discarder: number): boolean {
  return upperSeat(seat) === discarder;
}

/**
 * 吃牌方案：返回手里要拿出来的两张的组合列表。
 * 只有上家打出的数牌才能吃；`discarder` 传 -1 表示不检查来源（给单测与提示用）。
 */
export function chiOptions(
  hand: readonly number[],
  tile: number,
  seat = 0,
  discarder = -1
): number[][] {
  if (!isNumber(tile)) return [];
  if (discarder >= 0 && !isUpperOf(seat, discarder)) return [];
  const s: Suit = suitOf(tile);
  const r = rankOf(tile);
  const has = (rank: number): boolean => rank >= 1 && rank <= 9 && countOf(hand, tileFrom(s, rank)) > 0;
  const out: number[][] = [];
  // 三种搭法：tile 当顺子的第三张 / 中间 / 第一张
  if (has(r - 2) && has(r - 1)) out.push([tileFrom(s, r - 2), tileFrom(s, r - 1)]);
  if (has(r - 1) && has(r + 1)) out.push([tileFrom(s, r - 1), tileFrom(s, r + 1)]);
  if (has(r + 1) && has(r + 2)) out.push([tileFrom(s, r + 1), tileFrom(s, r + 2)]);
  return out;
}

function tileFrom(s: Suit, rank: number): number {
  const base = s === "m" ? 0 : s === "p" ? 10 : s === "s" ? 20 : s === "z" ? 30 : 40;
  return base + rank;
}

/** 能不能碰：手里有两张一样的就行，任何一家打的都可以 */
export function ponOk(hand: readonly number[], tile: number, seat = 0, discarder = -1): boolean {
  if (discarder >= 0 && discarder === seat) return false;
  return countOf(hand, tile) >= 2;
}

export interface KanOption {
  kind: "minkan" | "ankan" | "kakan";
  tile: number;
}

/**
 * 杠的全部选项。
 * - 传 `tile`（别人刚打出的牌）时只看明杠。
 * - 不传 `tile`（自己摸完牌）时看暗杠与加杠。
 */
export function kanOptions(
  hand: readonly number[],
  melds: readonly Meld[],
  tile?: number,
  seat = 0,
  discarder = -1
): KanOption[] {
  const out: KanOption[] = [];
  if (tile !== undefined) {
    if (discarder >= 0 && discarder === seat) return out;
    if (countOf(hand, tile) >= 3) out.push({ kind: "minkan", tile });
    return out;
  }
  const seen = new Set<number>();
  for (const t of hand) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (countOf(hand, t) === 4) out.push({ kind: "ankan", tile: t });
  }
  for (const m of melds) {
    if (m.kind !== "pon") continue;
    if (countOf(hand, m.tiles[0]) >= 1) out.push({ kind: "kakan", tile: m.tiles[0] });
  }
  return out;
}

/** 组一副吃 */
export function makeChi(tile: number, pair: readonly number[], from: number): Meld {
  return { kind: "chi", tiles: [...pair, tile].sort((a, b) => a - b), from, claimed: tile };
}

/** 组一副碰 */
export function makePon(tile: number, from: number): Meld {
  return { kind: "pon", tiles: [tile, tile, tile], from, claimed: tile };
}

/** 组一副杠 */
export function makeKan(tile: number, kind: KanOption["kind"], from: number): Meld {
  return { kind, tiles: [tile, tile, tile, tile], from, claimed: kind === "ankan" ? undefined : tile };
}

/** 副露区里这一副的中文说法，给无障碍标签用 */
export function meldLabel(m: Meld): string {
  if (m.kind === "chi") return "吃";
  if (m.kind === "pon") return "碰";
  if (m.kind === "ankan") return "暗杠";
  if (m.kind === "kakan") return "加杠";
  return "明杠";
}

/** 手牌 + 副露一共代表多少张牌（杠按 3 张算，用来校验手牌张数） */
export function meldTileCount(melds: readonly Meld[]): number {
  return melds.length * 3;
}
