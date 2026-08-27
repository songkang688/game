/**
 * 花开麻将 · 胡牌型判定（纯函数）。
 *
 * 支持的牌型：
 * 1. 基本型：4 个面子 + 1 个将（副露占掉的面子从 4 里扣）；
 * 2. 七对：14 张凑成 7 个对子（四张一样的算两对），只在门前清时成立；
 * 3. 十三幺：13 种幺九牌各一张 + 其中任意一张成对；
 * 4. 不靠型：全不靠 / 七星不靠 —— 14 张全是单牌，数牌走 147 / 258 / 369
 *    三条「组合龙」轨道且三门各占一条，字牌互不重复。
 *
 * `huParses` 会把**所有**合法拆解都列出来，`fan.ts` 再按「就高不就低」挑分最高的一套。
 */
import { Meld } from "./melds";
import {
  THIRTEEN_ORPHANS,
  indexId,
  isHonor,
  isNumber,
  rankOf,
  suitOf,
  toCounts,
  type Suit
} from "./tiles";

export type SetKind = "chi" | "pon" | "kan";

export interface SetPart {
  kind: SetKind;
  /** 顺子记最小那张，刻子 / 杠记那张牌 */
  tile: number;
  /** 这一副是不是暗的（手里自己凑出来的） */
  concealed: boolean;
  /** 是不是副露区里的（吃碰杠出来的） */
  fromMeld: boolean;
}

export type HuForm = "standard" | "sevenPairs" | "thirteenOrphans" | "knitted" | "knittedDragon";

export interface HuParse {
  form: HuForm;
  /** 基本型的 4 个面子（其它牌型是空数组） */
  sets: SetPart[];
  /** 将牌；十三幺是成对的那张；不靠型没有将，记 0 */
  pair: number;
  /** 七对的 7 个对子 */
  pairs?: number[];
  /** 不靠型的 14 张单牌 */
  singles?: number[];
}

/** 顺子头 → 三张牌 */
export function chiTiles(head: number): number[] {
  return [head, head + 1, head + 2];
}

/** 一个面子摊成三张牌（杠也按三张算，计番时杠等价于刻子） */
export function setTiles(s: SetPart): number[] {
  return s.kind === "chi" ? chiTiles(s.tile) : [s.tile, s.tile, s.tile];
}

function collectStandard(counts: number[], need: number, acc: SetPart[], out: SetPart[][]): void {
  if (need === 0) {
    for (let i = 0; i < 34; i++) if (counts[i] !== 0) return;
    out.push(acc.slice());
    return;
  }
  let i = 0;
  while (i < 34 && counts[i] === 0) i++;
  if (i >= 34) return;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    acc.push({ kind: "pon", tile: indexId(i), concealed: true, fromMeld: false });
    collectStandard(counts, need - 1, acc, out);
    acc.pop();
    counts[i] += 3;
  }
  // 顺子只在数牌里找，且不能跨花色（i%9 <= 6 保证 i、i+1、i+2 同花色）
  if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    acc.push({ kind: "chi", tile: indexId(i), concealed: true, fromMeld: false });
    collectStandard(counts, need - 1, acc, out);
    acc.pop();
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
  }
}

/** 基本型的全部拆解（不含副露那几副，need = 4 - 副露数） */
export function standardParses(hand: readonly number[], meldCount: number): HuParse[] {
  const need = 4 - meldCount;
  if (need < 0) return [];
  const counts = toCounts(hand);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== need * 3 + 2) return [];
  const out: HuParse[] = [];
  for (let p = 0; p < 34; p++) {
    if (counts[p] < 2) continue;
    counts[p] -= 2;
    const sets: SetPart[][] = [];
    collectStandard(counts, need, [], sets);
    for (const s of sets) out.push({ form: "standard", sets: s, pair: indexId(p) });
    counts[p] += 2;
  }
  return out;
}

/** 七对：14 张、无副露、7 个对子（四张一样的算两对） */
export function sevenPairsParse(hand: readonly number[], meldCount: number): HuParse | null {
  if (meldCount !== 0 || hand.length !== 14) return null;
  const counts = toCounts(hand);
  const pairs: number[] = [];
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 0) continue;
    if (counts[i] % 2 !== 0) return null;
    for (let k = 0; k < counts[i] / 2; k++) pairs.push(indexId(i));
  }
  if (pairs.length !== 7) return null;
  return { form: "sevenPairs", sets: [], pair: pairs[0], pairs };
}

/** 十三幺：13 种幺九牌齐了，其中一张成对 */
export function thirteenOrphansParse(hand: readonly number[], meldCount: number): HuParse | null {
  if (meldCount !== 0 || hand.length !== 14) return null;
  const counts = toCounts(hand);
  let pair = 0;
  for (let i = 0; i < 34; i++) {
    const id = indexId(i);
    if (!THIRTEEN_ORPHANS.includes(id)) {
      if (counts[i] > 0) return null;
      continue;
    }
    if (counts[i] === 0) return null;
    if (counts[i] === 2) {
      if (pair) return null;
      pair = id;
    } else if (counts[i] !== 1) return null;
  }
  return pair ? { form: "thirteenOrphans", sets: [], pair, singles: [...THIRTEEN_ORPHANS] } : null;
}

/** 组合龙的三条轨道：147 / 258 / 369（按点数模 3 分类，1 和 4 和 7 都是 1） */
export function knittedTrack(id: number): number {
  return rankOf(id) % 3;
}

export interface KnittedInfo {
  /** 三门数牌各走一条轨道、字牌互不重复 */
  ok: boolean;
  honors: number[];
  numbers: number[];
  /** 七种字牌都在（七星不靠） */
  allSevenHonors: boolean;
  /** 147/258/369 九张全齐（组合龙） */
  fullDragon: boolean;
}

/** 不靠型解析：全不靠 / 七星不靠 */
export function knittedParse(hand: readonly number[], meldCount: number): HuParse | null {
  if (meldCount !== 0 || hand.length !== 14) return null;
  const info = knittedInfo(hand);
  if (!info.ok) return null;
  return { form: "knitted", sets: [], pair: 0, singles: [...hand].sort((a, b) => a - b) };
}

/** 拆一手牌的不靠结构（`fan.ts` 里判 全不靠 / 七星不靠 / 组合龙 都用它） */
export function knittedInfo(hand: readonly number[]): KnittedInfo {
  const bad: KnittedInfo = { ok: false, honors: [], numbers: [], allSevenHonors: false, fullDragon: false };
  const seen = new Set<number>();
  const honors: number[] = [];
  const numbers: number[] = [];
  for (const t of hand) {
    if (seen.has(t)) return bad;
    seen.add(t);
    if (isHonor(t)) honors.push(t);
    else if (isNumber(t)) numbers.push(t);
    else return bad;
  }
  const trackOf = new Map<Suit, number>();
  for (const t of numbers) {
    const s = suitOf(t);
    const tr = knittedTrack(t);
    const prev = trackOf.get(s);
    if (prev === undefined) trackOf.set(s, tr);
    else if (prev !== tr) return bad;
  }
  const tracks = [...trackOf.values()];
  if (new Set(tracks).size !== tracks.length) return bad;
  const fullDragon = tracks.length === 3 && numbers.length >= 9 && hasFullDragon(numbers);
  return { ok: true, honors, numbers, allSevenHonors: honors.length === 7, fullDragon };
}

/** 三门花色的 147 / 258 / 369 九张是不是都齐了（组合龙） */
export function hasFullDragon(tiles: readonly number[]): boolean {
  const set = new Set(tiles);
  const suits: Suit[] = ["m", "p", "s"];
  const base: Record<Suit, number> = { m: 0, p: 10, s: 20, z: 30, f: 40 };
  // 三条轨道分给三门，6 种排法试一遍
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0]
  ];
  const starts = [1, 2, 3];
  for (const p of perms) {
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      const s = suits[i];
      const st = starts[p[i]];
      for (let k = 0; k < 3; k++) {
        if (!set.has(base[s] + st + k * 3)) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return true;
  }
  return false;
}

/** 三条轨道的起点，配三门花色一共 6 种排法 */
const TRACK_PERMS = [
  [1, 2, 3],
  [1, 3, 2],
  [2, 1, 3],
  [2, 3, 1],
  [3, 1, 2],
  [3, 2, 1]
];

/**
 * 组合龙牌型：三色 147 / 258 / 369 九张 + 一副面子 + 一对将（国标承认的特殊和牌型）。
 * 副露一副时手上只剩 9 + 2 张，也照样成立。
 */
export function knittedDragonParse(hand: readonly number[], meldCount: number): HuParse[] {
  if (meldCount > 1) return [];
  const want = meldCount === 0 ? 14 : 11;
  if (hand.length !== want) return [];
  const base: Record<string, number> = { m: 0, p: 10, s: 20 };
  const suits: Array<"m" | "p" | "s"> = ["m", "p", "s"];
  const out: HuParse[] = [];
  for (const perm of TRACK_PERMS) {
    const nine: number[] = [];
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 3; k++) nine.push(base[suits[i]] + perm[i] + k * 3);
    }
    const rest = hand.slice();
    let ok = true;
    for (const t of nine) {
      const at = rest.indexOf(t);
      if (at < 0) {
        ok = false;
        break;
      }
      rest.splice(at, 1);
    }
    if (!ok) continue;
    if (meldCount === 1) {
      if (rest.length === 2 && rest[0] === rest[1]) {
        out.push({ form: "knittedDragon", sets: [], pair: rest[0], singles: nine.sort((a, b) => a - b) });
      }
      continue;
    }
    for (const p of standardParses(rest, 3)) {
      out.push({ form: "knittedDragon", sets: p.sets, pair: p.pair, singles: nine.sort((a, b) => a - b) });
    }
  }
  return out;
}

/**
 * 一手牌的全部胡牌拆解。
 * `hand` 是手上的牌（含和牌张），`melds` 是副露区。没胡就是空数组。
 */
export function huParses(hand: readonly number[], melds: readonly Meld[] = []): HuParse[] {
  const out: HuParse[] = [];
  const meldCount = melds.length;
  const need = 4 - meldCount;
  if (need >= 0 && hand.length === need * 3 + 2) {
    out.push(...standardParses(hand, meldCount));
  }
  const sp = sevenPairsParse(hand, meldCount);
  if (sp) out.push(sp);
  const to = thirteenOrphansParse(hand, meldCount);
  if (to) out.push(to);
  const kn = knittedParse(hand, meldCount);
  if (kn) out.push(kn);
  out.push(...knittedDragonParse(hand, meldCount));
  return out;
}

/**
 * 能不能胡。
 * `last` 传和牌张时表示「`hand` 还没把它算进去」；传 null 就当 `hand` 已经是完整的一手。
 */
export function isHu(hand: readonly number[], last: number | null = null, melds: readonly Meld[] = []): boolean {
  const full = last === null ? [...hand] : [...hand, last];
  return huParses(full.sort((a, b) => a - b), melds).length > 0;
}

/** 听哪些牌（把 34 种牌逐一试一遍），返回升序 id 数组 */
export function waitingTiles(hand: readonly number[], melds: readonly Meld[] = []): number[] {
  const out: number[] = [];
  const counts = toCounts(hand);
  for (let i = 0; i < 34; i++) {
    const id = indexId(i);
    // 场上一共只有 4 张，自己手里已经 4 张就不可能再来一张
    if (counts[i] >= 4) continue;
    if (isHu(hand, id, melds)) out.push(id);
  }
  return out;
}
