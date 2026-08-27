// 海底大胃王 · 平台接线(1.2 第 10 步新增)
//
// 这一款是自建海域地图,不走 level99 那套框架,所以「直开第 N 关」「家长跳关」
// 这两件事得自己接。全都收在这里,理由是它们每一条都能写成纯函数,
// 而 index.ts 那两千多行画布代码没法单测。
//
// 两条不许碰的线:
//  1. `PROGRESS_KEY`(`yiduo-yixing.ocean-munch.campaign.v2`)与图鉴 key 不改名——
//     改了等于把老玩家的进度清零;
//  2. 跳关只记「跳过了哪几关」,星级仍旧记 0——跳过去不是本事,不该冒出一颗星来。

import { LEVELS } from "./logic";

/** 战役总关数:1 基关号的上界。 */
export const CAMPAIGN_TOTAL = LEVELS.length;

/* ------------------------------------------------------------------ */
/* 直开第 N 关                                                          */
/* ------------------------------------------------------------------ */

/**
 * 1 基关号 → 0 基下标;越界夹到两端,读不成数字的当第 1 关。
 * `Infinity` 走的是「越界」这条路而不是「读不成数字」——那分明是想开最后一关。
 */
export function clampLevelIndex(n: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(CAMPAIGN_TOTAL - 1, Math.round(v) - 1));
}

/** 从 `?level=12` 这样的查询串里读 1 基关号;读不出来返回 null。 */
export function levelFromSearch(search: string | null | undefined): number | null {
  if (typeof search !== "string" || search === "") return null;
  const q = search.startsWith("?") ? search.slice(1) : search;
  for (const part of q.split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (decodeURIComponent(part.slice(0, eq)) !== "level") continue;
    const raw = decodeURIComponent(part.slice(eq + 1)).trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * mount 的时候该不该直接开某一关(0 基下标):
 * `api.initialLevel` 优先,其次 `?level=`,两个都没有就返回 null——
 * 那种情况才停在「先选玩法」的首屏。
 */
export function initialLevelIndex(
  initial: number | undefined | null,
  search: string | null | undefined,
): number | null {
  if (typeof initial === "number" && Number.isFinite(initial)) return clampLevelIndex(initial);
  const fromUrl = levelFromSearch(search);
  return fromUrl === null ? null : clampLevelIndex(fromUrl);
}

/* ------------------------------------------------------------------ */
/* 家长跳关                                                             */
/* ------------------------------------------------------------------ */

/** 家长面板读的那个并存小数组;和战役星级存档分开,互不影响。 */
export const SKIP_KEY = "yiduo-yixing.l99skip.ocean-munch";

/** 读已跳过的关(0 基);坏数据一律当没跳过。 */
export function parseSkipList(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out = new Set<number>();
    for (const v of arr) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const n = Math.floor(v);
      if (n >= 0 && n < CAMPAIGN_TOTAL) out.add(n);
    }
    return [...out].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function serializeSkipList(list: ReadonlyArray<number>): string {
  return JSON.stringify([...new Set(list)].sort((a, b) => a - b));
}

/** 把新跳过的一关并进去(0 基);越界的忽略。 */
export function mergeSkip(raw: string | null, level: number): number[] {
  const list = parseSkipList(raw);
  const n = Math.floor(level);
  if (n >= 0 && n < CAMPAIGN_TOTAL && !list.includes(n)) list.push(n);
  return list.sort((a, b) => a - b);
}

/**
 * 解锁口径:上一关有星**或者**上一关被跳过。
 * 和 188 关框架同一个口径——跳过的那关自己仍旧是 0 星。
 */
export function isUnlockedWith(
  stars: ReadonlyArray<number>,
  skips: ReadonlyArray<number>,
  idx: number,
): boolean {
  if (idx <= 0) return true;
  return (stars[idx - 1] ?? 0) > 0 || skips.includes(idx - 1);
}

/** 章节解锁也跟着跳关走:本章第一关解锁了,这一章就能点开。 */
export function isThemeUnlockedWith(
  stars: ReadonlyArray<number>,
  skips: ReadonlyArray<number>,
  themeStartIdx: number,
): boolean {
  return isUnlockedWith(stars, skips, themeStartIdx);
}
