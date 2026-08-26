/**
 * 朵星格斗王 —— 存档与平台接线（除了读写 localStorage，其余全是纯函数）。
 *
 *  · 无尽连胜的最好成绩统一走平台的 `save.recordEndlessBest("fight-king", n)`，
 *    本作**不新建任何 localStorage key**；1.1 之前散在外面的老 key 只读一次、只取最大值。
 *  · 格斗塔的「直开第 N 层」：认 `api.initialLevel`、地址栏 `?level=N`、hash 里的 `level=N`，
 *    统统是 1 基关号，越界一律 clamp。
 */
import { save, type StorageLike } from "../../engine/save";
import { TOTAL_LEVELS, chapterOf, chapterStart, furthestPlayable, loadSkips, loadStars } from "../level99";
import { CHAPTERS } from "./levels";
import { meta } from "./meta";

/* ------------------------------------------------------------------ */
/* 一、无尽连胜的最好成绩                                              */
/* ------------------------------------------------------------------ */

/**
 * 1.1 之前可能落在外面的老 key。只读一次、只取最大值，读完**不删** ——
 * 玩家自己导出的备份里还留着这几条，删了反而对不上。
 */
export const LEGACY_ENDLESS_KEYS: readonly string[] = [
  "yiduo-yixing.fight-king.endless",
  "yiduo-yixing.fight-king.streak",
  "yiduo.fight-king.endless"
];

function numberOf(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number" && Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
    if (parsed && typeof parsed === "object") {
      const rec = parsed as Record<string, unknown>;
      const n = Math.floor(Number(rec.streak ?? rec.best ?? rec.wins));
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
  } catch {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

/** 老 key 里记着的最长连胜是多少（纯函数，存储由调用方给） */
export function readLegacyStreak(store: StorageLike | null): number {
  if (!store) return 0;
  let best = 0;
  for (const key of LEGACY_ENDLESS_KEYS) {
    try {
      best = Math.max(best, numberOf(store.getItem(key)));
    } catch {
      // 某一条读不动不影响其它几条
    }
  }
  return best;
}

function defaultStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** 老 key 一个会话只搬一次，别每打完一场都去翻一遍 localStorage */
let migrated = false;

/** 单测之间要能把「搬过了」这个状态清掉 */
export function resetMigration(): void {
  migrated = false;
}

/**
 * 记一次连胜成绩，返回平台记着的最好成绩。
 * 第一次调用时顺手把老 key 搬进来 —— 只涨不降，老玩家一场纪录都不会丢。
 */
export function recordStreak(streak: number, store: StorageLike | null = defaultStorage()): number {
  if (!migrated) {
    migrated = true;
    const legacy = readLegacyStreak(store);
    if (legacy > 0) save.recordEndlessBest(meta.id, legacy);
  }
  return save.recordEndlessBest(meta.id, Math.max(0, Math.round(streak)));
}

/** 现在的最好成绩（顺带把老 key 搬一次，进无尽那一屏就看得到真实纪录） */
export function bestStreak(store: StorageLike | null = defaultStorage()): number {
  return recordStreak(0, store);
}

/** 无尽那一屏顶上的一行字 */
export function streakBadge(best: number): string {
  return best > 0 ? `🏅 最长连胜 ${best} 场` : "🏅 还没有连胜纪录，第一场就是你的纪录";
}

/* ------------------------------------------------------------------ */
/* 二、直开第 N 层                                                     */
/* ------------------------------------------------------------------ */

function levelFromText(text: string): number | null {
  const m = /[?&#/]level=(\d+)/.exec(text) ?? /[?&]level=(\d+)/.exec(text);
  if (m) return Number(m[1]);
  const slash = /#\/fight-king\/(\d+)/.exec(text);
  return slash ? Number(slash[1]) : null;
}

/**
 * 把壳层给的关号整理成 0 基下标；给不出就返回 -1（照常回选关地图）。
 * `api.initialLevel` 优先，其次地址栏 `?level=N`，最后 hash。三种都是 1 基。
 */
export function initialLevelOf(hint: unknown, search = "", hash = "", total: number = TOTAL_LEVELS): number {
  let raw: number | null = null;
  if (typeof hint === "number" && Number.isFinite(hint)) raw = hint;
  if (raw === null) raw = levelFromText(search);
  if (raw === null) raw = levelFromText(hash);
  if (raw === null) return -1;
  return Math.max(0, Math.min(total - 1, Math.round(raw) - 1));
}

/**
 * 在已经挂好的 188 关地图上，替玩家点开第 N 层（0 基）。
 * 还锁着的层就停在能玩的最远那一层 —— 直开不等于解锁，跳关得走家长授权那条路。
 */
export function openCampaignLevel(host: HTMLElement, level: number): boolean {
  const stars = loadStars(meta.id);
  const skips = loadSkips(meta.id);
  const want = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  const target = Math.min(want, furthestPlayable(stars, skips, TOTAL_LEVELS));
  const ci = chapterOf(CHAPTERS, target);
  const tabs = host.querySelectorAll?.(".l99-tab");
  const tab = tabs?.[ci] as HTMLButtonElement | undefined;
  tab?.click?.();
  const nodes = host.querySelectorAll?.(".l99-node");
  const node = nodes?.[target - chapterStart(CHAPTERS, ci)] as HTMLButtonElement | undefined;
  if (!node || node.disabled) return false;
  node.click();
  return true;
}

/** 地址栏与 hash 的安全读法（无头环境里没有 location 也不能崩） */
export function locationHints(): { search: string; hash: string } {
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  return { search: loc?.search ?? "", hash: loc?.hash ?? "" };
}
