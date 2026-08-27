/**
 * 时钟小屋 1.2：错题类型统计（只存在本机，不联网、不记具体题目）。
 *
 * 存的是「哪一类题型错过几次」，不是「哪一题错了」——够家长看出孩子卡在哪个知识点，
 * 又不会把孩子的答题记录攒成一份档案。key 走平台统一的 `yiduo-yixing.` 前缀，
 * 和 188 关星级存档 `yiduo-yixing.l99.clock-house` 并存，互不覆盖。
 */
import { CLOCK_TYPES, type ClockType } from "./kinds";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 错题统计的存档 key */
export const MISTAKES_KEY = "yiduo-yixing.clock-house.mistakes";

export type MistakeStats = Partial<Record<ClockType, number>>;

const memory = new Map<string, string>();

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    // 隐私模式等场景：统计只留在本次会话里
    return null;
  }
}

function read(store: StorageLike | null): string | null {
  try {
    return store ? store.getItem(MISTAKES_KEY) : memory.get(MISTAKES_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(store: StorageLike | null, raw: string): void {
  try {
    if (store) store.setItem(MISTAKES_KEY, raw);
    else memory.set(MISTAKES_KEY, raw);
  } catch {
    // 存不进去也不影响继续玩
  }
}

/** 把任意来源的值整理成一份干净的统计（纯函数，便于测试） */
export function migrateMistakes(parsed: unknown): MistakeStats {
  const out: MistakeStats = {};
  if (!parsed || typeof parsed !== "object") return out;
  const src = parsed as Record<string, unknown>;
  for (const type of CLOCK_TYPES) {
    const v = src[type];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[type] = Math.min(9999, Math.round(v));
  }
  return out;
}

/** 读一份错题统计 */
export function loadMistakes(storage?: StorageLike | null): MistakeStats {
  const store = storage === undefined ? defaultStorage() : storage;
  const raw = read(store);
  if (!raw) return {};
  try {
    return migrateMistakes(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

/** 累加一批错题类型，返回最新统计 */
export function recordMistakes(types: readonly ClockType[], storage?: StorageLike | null): MistakeStats {
  const store = storage === undefined ? defaultStorage() : storage;
  const stats = loadMistakes(store);
  for (const type of types) {
    if (!CLOCK_TYPES.includes(type)) continue;
    stats[type] = Math.min(9999, (stats[type] ?? 0) + 1);
  }
  write(store, JSON.stringify(stats));
  return stats;
}

/** 错得最多的几类（并列时按 CLOCK_TYPES 的顺序），家长面板与回顾提示语用 */
export function topMistakeTypes(stats: MistakeStats, n = 3): ClockType[] {
  return CLOCK_TYPES.filter((t) => (stats[t] ?? 0) > 0)
    .sort((a, b) => (stats[b] ?? 0) - (stats[a] ?? 0) || CLOCK_TYPES.indexOf(a) - CLOCK_TYPES.indexOf(b))
    .slice(0, Math.max(0, n));
}

/** 清空统计（家长面板用） */
export function clearMistakes(storage?: StorageLike | null): void {
  write(storage === undefined ? defaultStorage() : storage, "{}");
}
