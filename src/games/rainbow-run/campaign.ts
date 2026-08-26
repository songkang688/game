// 彩虹跑跑 · 平台接线(1.2 第 9 步新增)
//
// 这一款是自建世界地图,不走 level99 那套框架,所以「直开第 N 关」「跳关」
// 「无尽成绩上报」「收藏册加成」这四件事得自己接。全都收在这里,理由是
// 它们每一条都能写成纯函数,而 index.ts 那 2000 行画布代码没法单测。
//
// 三条不许碰的线:
//  1. `PROGRESS_KEY` 与无尽纪录 key 不改名——改了等于把老玩家的进度清零;
//  2. `src/engine/collection.ts` 只读——只调 `collectionEffects()` 拿加成;
//  3. 收藏册加成必须封顶——收藏册自己承诺过「全套满级也不超过 +35%」,
//     跑酷这边再夹一道,免得哪天那边放宽了这边跟着失衡。

import { collectionEffects, BONUS_CAP_PERMILLE, MAX_LEVEL, START_SHIELD_MS_PER_LEVEL } from "../../engine/collection";
import type { CollectionEffects } from "../../engine/collection";
import { LEVELS } from "./logic";
import type { EndlessRecord } from "./endless";

/** 战役总关数:1 基关号的上界。 */
export const CAMPAIGN_TOTAL = LEVELS.length;

export interface KeyStore {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

/* ------------------------------------------------------------------ */
/* 直开第 N 关                                                          */
/* ------------------------------------------------------------------ */

/** 1 基关号 → 0 基下标;越界夹到两端,不合法的数字当第 1 关。 */
export function clampLevelIndex(n: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(CAMPAIGN_TOTAL - 1, v - 1));
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
 * mount 的时候到底该直接开哪一关(0 基下标):
 * `api.initialLevel` 优先,其次 `?level=`,两个都没有就返回 null——
 * 那种情况才走「先选世界」的老路子。
 */
export function initialLevelIndex(
  initial: number | undefined,
  search: string | null | undefined,
): number | null {
  if (typeof initial === "number" && Number.isFinite(initial)) return clampLevelIndex(initial);
  const fromUrl = levelFromSearch(search);
  return fromUrl === null ? null : clampLevelIndex(fromUrl);
}

/* ------------------------------------------------------------------ */
/* 跳关                                                                 */
/* ------------------------------------------------------------------ */

/** 家长面板读的那个并存小数组;和战役星级存档分开,互不影响。 */
export const SKIP_KEY = "yiduo-yixing.l99skip.rainbow-run";

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
 * 跳过的关星级仍旧记 0——跳过去不是本事,不该冒出一颗星来。
 * 解锁靠的是「上一关有星**或者**上一关被跳过」,和 level99 框架同一个口径。
 */
export function isUnlockedWith(
  stars: ReadonlyArray<number>,
  skips: ReadonlyArray<number>,
  idx: number,
): boolean {
  if (idx <= 0) return true;
  return (stars[idx - 1] ?? 0) > 0 || skips.includes(idx - 1);
}

/* ------------------------------------------------------------------ */
/* 无尽成绩:统一走 save.recordEndlessBest                              */
/* ------------------------------------------------------------------ */

/**
 * 1.1 之前散在各处的老 key。只读一次、只取最大值,
 * 读完也不删——玩家自己导出的备份里还留着这几条,删了反而对不上。
 */
export const LEGACY_ENDLESS_KEYS: readonly string[] = [
  "yiduo-yixing.rainbow-run.endless",
  "yiduo-yixing.rainbow-run.endless-best",
  "yiduo-yixing.rainbow-run.endless-record",
];

function metersOf(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number") return Math.max(0, Math.floor(parsed));
    if (parsed && typeof parsed === "object") {
      const m = Math.floor(Number((parsed as Record<string, unknown>).meters));
      return Number.isFinite(m) && m > 0 ? m : 0;
    }
  } catch {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

/** 老 key 里最好那一趟跑了多少米。 */
export function readLegacyMeters(store: KeyStore | null): number {
  if (!store) return 0;
  let best = 0;
  for (const key of LEGACY_ENDLESS_KEYS) {
    try {
      best = Math.max(best, metersOf(store.getItem(key)));
    } catch {
      // 某一条读不动不影响其它几条
    }
  }
  return best;
}

/**
 * 这一趟之后,平台该记的无尽最好成绩是多少米。
 * 三个来源取最大值:本作自己的两项纪录、老 key、平台已经记着的那个数。
 * 只涨不降——迁移绝不会把谁的纪录清零。
 */
export function bestEndlessMeters(
  record: EndlessRecord,
  legacyMeters: number,
  platformBest: number,
): number {
  const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return Math.max(safe(record.meters), safe(legacyMeters), safe(platformBest));
}

/* ------------------------------------------------------------------ */
/* 收藏册加成                                                           */
/* ------------------------------------------------------------------ */

/** 单项加成的上限:和收藏册自己承诺的 +35% 同一个数。 */
export const BOOST_CAP = BONUS_CAP_PERMILLE / 1000;
/** 起步无敌最多这么久(收藏册那边全套满级正好这个数)。 */
export const START_SHIELD_CAP_MS = START_SHIELD_MS_PER_LEVEL * MAX_LEVEL;

export interface RunnerBoosts {
  /** 无尽模式的基础速度倍率(战役不用,不然 188 关的配平就漂了) */
  speedMul: number;
  /** 磁铁吸附半径与时长 */
  magnetMul: number;
  /** 糖果得分 */
  coinMul: number;
  /** 跳跃在画面上的高度(只是好看,不动滞空时长) */
  jumpMul: number;
  /** 宠物「绵绵」:摔倒时白接你一次,不花星星 */
  reviveOnce: boolean;
  /** 宠物「泡泡」:起步多罩这么久的无敌 */
  startShieldMs: number;
}

export function neutralBoosts(): RunnerBoosts {
  return {
    speedMul: 1,
    magnetMul: 1,
    coinMul: 1,
    jumpMul: 1,
    reviveOnce: false,
    startShieldMs: 0,
  };
}

/** 倍率一律夹在 [1, 1 + BOOST_CAP]:不倒扣,也不许超过上限。 */
export function clampBoost(mul: number): number {
  if (!Number.isFinite(mul)) return 1;
  return Math.max(1, Math.min(1 + BOOST_CAP, mul));
}

/** 收藏册的加成翻译成跑酷真正用得上的那几个数。 */
export function runnerBoosts(effects: CollectionEffects): RunnerBoosts {
  return {
    speedMul: clampBoost(effects.speedMul),
    magnetMul: clampBoost(effects.magnetMul),
    coinMul: clampBoost(effects.coinMul),
    jumpMul: clampBoost(effects.jumpMul),
    reviveOnce: effects.reviveOnce === true,
    startShieldMs: Math.max(
      0,
      Math.min(START_SHIELD_CAP_MS, Math.round(Number(effects.startShieldMs) || 0)),
    ),
  };
}

/** 读一次收藏册;读不动(比如面板还没进仓库)就当没穿任何东西。 */
export function readRunnerBoosts(): RunnerBoosts {
  try {
    return runnerBoosts(collectionEffects());
  } catch {
    return neutralBoosts();
  }
}

/** 开跑前那一行小字:身上这一套到底帮了什么忙。 */
export function describeBoosts(b: RunnerBoosts): string {
  const parts: string[] = [];
  const pct = (mul: number): string => `${Math.round((mul - 1) * 100)}%`;
  if (b.speedMul > 1) parts.push(`速度 +${pct(b.speedMul)}`);
  if (b.magnetMul > 1) parts.push(`吸金 +${pct(b.magnetMul)}`);
  if (b.coinMul > 1) parts.push(`糖果 +${pct(b.coinMul)}`);
  if (b.jumpMul > 1) parts.push(`弹跳 +${pct(b.jumpMul)}`);
  if (b.reviveOnce) parts.push("摔倒接住一次");
  if (b.startShieldMs > 0) parts.push(`起步无敌 ${(b.startShieldMs / 1000).toFixed(1)} 秒`);
  return parts.length > 0 ? `🎁 ${parts.join(" · ")}` : "";
}
