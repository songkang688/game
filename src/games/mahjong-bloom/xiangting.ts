/**
 * 花开麻将 · 向听数（还差几张就听牌）。
 *
 * 0 = 已听牌，-1 = 已经胡了。AI 选牌和「听牌提示」都靠它。
 *
 * 算法分两步，都做了记忆化，所以 AI 连打几百局也不卡：
 * 1. 每一门花色（万 / 筒 / 条 / 字）单独枚举「能凑出几个面子 + 几个搭子 + 几个对子」，
 *    结果按 9 位（字牌 7 位）计数字符串缓存；
 * 2. 四门的结果组合起来，套国标通用公式 `8 - 2*面子 - 搭子`，
 *    面子 + 搭子超过 5 就砍到 5，凑不出将再 +1。
 *
 * 七对与十三幺另算，最后取三者最小值。
 */
import { THIRTEEN_ORPHANS, idIndex, toCounts } from "./tiles";

interface Block {
  sets: number;
  partials: number;
  pairs: number;
}

const suitCache = new Map<string, Block[]>();

function keyOf(cnt: readonly number[], honor: boolean): string {
  return (honor ? "z" : "n") + cnt.join("");
}

/** 一门花色能拆出的全部（面子, 搭子, 对子）组合 */
function suitBlocks(cnt: number[], honor: boolean): Block[] {
  const key = keyOf(cnt, honor);
  const hit = suitCache.get(key);
  if (hit) return hit;

  const seen = new Set<string>();
  const found: Block[] = [];
  const work = cnt.slice();

  const push = (sets: number, partials: number, pairs: number): void => {
    const k = `${sets},${partials},${pairs}`;
    if (seen.has(k)) return;
    seen.add(k);
    found.push({ sets, partials, pairs });
  };

  const n = work.length;
  const rec = (i: number, sets: number, partials: number, pairs: number): void => {
    let idx = i;
    while (idx < n && work[idx] === 0) idx++;
    if (idx >= n) {
      push(sets, partials, pairs);
      return;
    }
    // 刻子
    if (work[idx] >= 3) {
      work[idx] -= 3;
      rec(idx, sets + 1, partials, pairs);
      work[idx] += 3;
    }
    // 顺子（字牌没有顺子）
    if (!honor && idx + 2 < n && work[idx + 1] > 0 && work[idx + 2] > 0) {
      work[idx]--;
      work[idx + 1]--;
      work[idx + 2]--;
      rec(idx, sets + 1, partials, pairs);
      work[idx]++;
      work[idx + 1]++;
      work[idx + 2]++;
    }
    // 对子
    if (work[idx] >= 2) {
      work[idx] -= 2;
      rec(idx, sets, partials + 1, pairs + 1);
      work[idx] += 2;
    }
    // 两面 / 坎张搭子
    if (!honor && idx + 1 < n && work[idx + 1] > 0) {
      work[idx]--;
      work[idx + 1]--;
      rec(idx, sets, partials + 1, pairs);
      work[idx]++;
      work[idx + 1]++;
    }
    if (!honor && idx + 2 < n && work[idx + 2] > 0) {
      work[idx]--;
      work[idx + 2]--;
      rec(idx, sets, partials + 1, pairs);
      work[idx]++;
      work[idx + 2]++;
    }
    // 这张牌不要了
    work[idx]--;
    rec(idx, sets, partials, pairs);
    work[idx]++;
  };

  rec(0, 0, 0, 0);
  suitCache.set(key, found);
  return found;
}

const stdCache = new Map<string, number>();

/**
 * 基本型（4 面子 + 1 将）的向听数，`meldCount` 是已经副露的面子数。
 * 四门的结果用状态集合合并：面子最多 4、搭子最多 6、有没有对子只记 0/1，
 * 状态数封顶在两位数，所以合并这一步是常数级的。
 */
export function standardXiangting(hand: readonly number[], meldCount = 0): number {
  const counts = toCounts(hand);
  const ck = `${meldCount}|${counts.join("")}`;
  const hit = stdCache.get(ck);
  if (hit !== undefined) return hit;

  const groups: Block[][] = [
    suitBlocks(counts.slice(0, 9), false),
    suitBlocks(counts.slice(9, 18), false),
    suitBlocks(counts.slice(18, 27), false),
    suitBlocks(counts.slice(27, 34), true)
  ];

  let states = new Set<number>([0]);
  for (const g of groups) {
    const next = new Set<number>();
    for (const st of states) {
      const S = Math.floor(st / 100);
      const P = Math.floor(st / 10) % 10;
      const Q = st % 10;
      for (const b of g) {
        const s2 = Math.min(4, S + b.sets);
        const p2 = Math.min(6, P + b.partials);
        const q2 = Math.min(1, Q + b.pairs);
        next.add(s2 * 100 + p2 * 10 + q2);
      }
    }
    states = next;
  }

  let best = 8;
  for (const st of states) {
    const s = Math.min(4, Math.floor(st / 100) + meldCount);
    const P = Math.floor(st / 10) % 10;
    const hasPairBlock = st % 10 > 0;
    const cap = Math.max(0, 5 - s);
    const p = Math.min(P, cap);
    const hasPair = hasPairBlock && p >= 1;
    let x = 8 - 2 * s - p;
    if (s + p === 5 && !hasPair) x += 1;
    if (x < best) best = x;
  }
  stdCache.set(ck, best);
  return best;
}

/** 七对的向听数（有副露就不成立，返回一个很大的数） */
export function sevenPairsXiangting(hand: readonly number[], meldCount = 0): number {
  if (meldCount > 0) return 99;
  const counts = toCounts(hand);
  let pairs = 0;
  let kinds = 0;
  for (const c of counts) {
    if (c > 0) kinds++;
    pairs += Math.floor(c / 2);
  }
  return 6 - Math.min(7, pairs) + Math.max(0, 7 - kinds);
}

/** 十三幺的向听数（有副露就不成立） */
export function thirteenOrphansXiangting(hand: readonly number[], meldCount = 0): number {
  if (meldCount > 0) return 99;
  const counts = toCounts(hand);
  let kinds = 0;
  let hasPair = false;
  for (const id of THIRTEEN_ORPHANS) {
    const c = counts[idIndex(id)];
    if (c > 0) kinds++;
    if (c >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

/**
 * 向听数：基本型 / 七对 / 十三幺 取最小。
 * 已经胡了返回 -1，听牌返回 0。
 */
export function xiangting(hand: readonly number[], meldCount = 0): number {
  const a = standardXiangting(hand, meldCount);
  const b = sevenPairsXiangting(hand, meldCount);
  const c = thirteenOrphansXiangting(hand, meldCount);
  return Math.min(a, b, c);
}

/** 打掉哪张牌向听数最低：返回 `{ tile, xiangting }` 列表（按向听数升序） */
export function discardRanking(
  hand: readonly number[],
  meldCount = 0
): Array<{ tile: number; xiangting: number }> {
  const seen = new Set<number>();
  const out: Array<{ tile: number; xiangting: number }> = [];
  for (const t of hand) {
    if (seen.has(t)) continue;
    seen.add(t);
    const rest = hand.slice();
    rest.splice(rest.indexOf(t), 1);
    out.push({ tile: t, xiangting: xiangting(rest, meldCount) });
  }
  out.sort((a, b) => a.xiangting - b.xiangting || a.tile - b.tile);
  return out;
}

/** 清掉记忆化缓存（长时间跑模拟时用得上，平时不必调用） */
export function clearXiangtingCache(): void {
  suitCache.clear();
  stdCache.clear();
}
