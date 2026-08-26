/**
 * 识字小花园 1.2：错题本（只存在本机，不联网）。
 *
 * 存的是「哪个**字**错过几次」——够家长看出孩子卡在哪些字上，
 * 又不会把孩子的答题过程攒成一份档案。key 走平台统一的 `yiduo-yixing.` 前缀，
 * 和 188 关星级存档 `yiduo-yixing.l99.word-garden` 并存，互不覆盖。
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 错题本的存档 key */
export const MISTAKES_KEY = "yiduo-yixing.word-garden.mistakes";

/** 最多记这么多个字，攒满了就把错得最少的挤出去 */
export const MAX_ENTRIES = 200;

export type MistakeBook = Record<string, number>;

const memory = new Map<string, string>();

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    // 隐私模式等场景：错题本只留在本次会话里
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

/** 把任意来源的值整理成一本干净的错题本（纯函数，便于测试） */
export function migrateMistakes(parsed: unknown): MistakeBook {
  const out: MistakeBook = {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  const src = parsed as Record<string, unknown>;
  const rows: Array<[string, number]> = [];
  for (const [key, v] of Object.entries(src)) {
    // 只收单字，别的一律当脏数据丢掉
    if ([...key].length !== 1) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    rows.push([key, Math.min(9999, Math.round(v))]);
  }
  rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (const [key, n] of rows.slice(0, MAX_ENTRIES)) out[key] = n;
  return out;
}

/** 读一本错题本 */
export function loadMistakes(storage?: StorageLike | null): MistakeBook {
  const store = storage === undefined ? defaultStorage() : storage;
  const raw = read(store);
  if (!raw) return {};
  try {
    return migrateMistakes(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

/** 记下一批错字，返回最新的错题本 */
export function recordMistakes(chars: readonly string[], storage?: StorageLike | null): MistakeBook {
  const store = storage === undefined ? defaultStorage() : storage;
  const book = loadMistakes(store);
  for (const ch of chars) {
    if ([...ch].length !== 1) continue;
    book[ch] = Math.min(9999, (book[ch] ?? 0) + 1);
  }
  const trimmed = migrateMistakes(book);
  write(store, JSON.stringify(trimmed));
  return trimmed;
}

/** 错得最多的几个字（并列时按字典序），家长面板与复查提示语用 */
export function topMistakes(book: MistakeBook, n = 5): string[] {
  return Object.keys(book)
    .filter((c) => (book[c] ?? 0) > 0)
    .sort((a, b) => (book[b] ?? 0) - (book[a] ?? 0) || (a < b ? -1 : 1))
    .slice(0, Math.max(0, n));
}

/** 清空错题本（家长面板用） */
export function clearMistakes(storage?: StorageLike | null): void {
  write(storage === undefined ? defaultStorage() : storage, "{}");
}
