// 钓鱼小达人 · 鱼类图鉴 v2(纯函数,不碰 localStorage)。
//
// 1.1 的图鉴只是一串「认识的鱼 id」。1.2 要记得更细:
// 每一种鱼的**首次捕获时间**、**最大体长**、钓过几条、放生过几条。
//
// 存档形状刻意压得很短(`t/b/n/r` 四个字母),188 关加 25 种鱼也就几百字节;
// 读的时候一律走 `parseDexBook`:坏 JSON、缺字段、不认识的鱼 id、负数与 NaN
// 全部安静地降级成「这条还没见过」,绝不抛异常、绝不让一份坏存档卡住游戏。

import { FISH, GAME_ID, baseLengthCm, fishById, formatLength, tierIndexOf, type Fish } from "./logic";

/** 图鉴 v2 的存档 key(平台统一前缀,和 l99 星级、平台钱包互不影响) */
export const DEX2_KEY = `yiduo-yixing.${GAME_ID}.dex.v2`;

/** 存档格式版本:以后再扩字段就靠它认版本 */
export const DEX_VERSION = 2;

export interface DexEntry {
  id: string;
  /** 首次捕获的时间戳(毫秒);0 表示从老存档迁移过来、时间已经不可考 */
  firstAt: number;
  /** 钓到过的最大体长(厘米) */
  bestCm: number;
  /** 一共钓上来过几条 */
  caught: number;
  /** 一共放生过几条 */
  released: number;
}

export interface DexBook {
  entries: Record<string, DexEntry>;
}

export function emptyDex(): DexBook {
  return { entries: {} };
}

function num(v: unknown, max = 1e12): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(Math.round(v * 10) / 10, max);
}

function intOf(v: unknown, max = 999_999): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(Math.round(v), max);
}

function makeEntry(id: string, raw: unknown): DexEntry | null {
  if (!fishById(id)) return null;
  const base: DexEntry = { id, firstAt: 0, bestCm: 0, caught: 0, released: 0 };
  if (typeof raw !== "object" || raw === null) return base;
  const o = raw as Record<string, unknown>;
  return {
    id,
    firstAt: intOf(o.t, Number.MAX_SAFE_INTEGER),
    bestCm: num(o.b, 9999),
    caught: Math.max(1, intOf(o.n)),
    released: intOf(o.r),
  };
}

/**
 * 把任意来源的存档整理成图鉴。
 * `legacy` 传 1.1 那份 id 列表的原文,v2 缺项时自动补上(时间与体长记 0,只认得脸)。
 */
export function parseDexBook(raw: string | null | undefined, legacy?: string | null): DexBook {
  const book = emptyDex();

  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const body = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  const rows = body && typeof body.e === "object" && body.e !== null ? (body.e as Record<string, unknown>) : null;
  if (rows) {
    for (const [id, value] of Object.entries(rows)) {
      const entry = makeEntry(id, value);
      if (entry) book.entries[id] = entry;
    }
  }

  if (legacy) {
    let old: unknown = null;
    try {
      old = JSON.parse(legacy);
    } catch {
      old = null;
    }
    if (Array.isArray(old)) {
      for (const v of old as unknown[]) {
        if (typeof v !== "string" || book.entries[v] || !fishById(v)) continue;
        book.entries[v] = { id: v, firstAt: 0, bestCm: 0, caught: 1, released: 0 };
      }
    }
  }

  return book;
}

/** 写回存档:按图鉴顺序排好,同一份图鉴每次序列化出来的文本完全一样 */
export function serializeDexBook(book: DexBook): string {
  const e: Record<string, { t: number; b: number; n: number; r: number }> = {};
  for (const fish of FISH) {
    const row = book.entries[fish.id];
    if (!row) continue;
    e[fish.id] = { t: row.firstAt, b: row.bestCm, n: row.caught, r: row.released };
  }
  return JSON.stringify({ v: DEX_VERSION, e });
}

export function dexHas(book: DexBook, id: string): boolean {
  return Boolean(book.entries[id]);
}

export function dexEntry(book: DexBook, id: string): DexEntry | undefined {
  return book.entries[id];
}

export interface CatchRecord {
  /** 哪一种鱼 */
  id: string;
  /** 这一条多长(厘米) */
  cm: number;
  /** 捕获时间戳 */
  at: number;
  /** 放生了没有 */
  released?: boolean;
}

export interface DexUpdate {
  book: DexBook;
  /** 这一条是不是新鱼种 */
  isNew: boolean;
  /** 这一条是不是刷新了本种最大体长 */
  isBiggest: boolean;
  /** 这一种鱼是不是第一次被放生(第一次放生给一颗星星) */
  firstRelease: boolean;
}

/**
 * 记一条鱼(纯函数,返回新图鉴)。
 * 未知鱼 id 一律忽略;首次捕获时间只写一次,以后再钓也不覆盖。
 */
export function recordCatch(book: DexBook, rec: CatchRecord): DexUpdate {
  const fish = fishById(rec.id);
  if (!fish) return { book, isNew: false, isBiggest: false, firstRelease: false };

  const prev = book.entries[rec.id];
  const cm = num(rec.cm, 9999);
  const at = intOf(rec.at, Number.MAX_SAFE_INTEGER);
  const released = rec.released === true;
  const isNew = !prev;
  const isBiggest = cm > 0 && cm > (prev?.bestCm ?? 0);
  const firstRelease = released && (prev?.released ?? 0) === 0;

  const next: DexEntry = {
    id: rec.id,
    firstAt: prev && prev.firstAt > 0 ? prev.firstAt : at,
    bestCm: Math.max(prev?.bestCm ?? 0, cm),
    caught: (prev?.caught ?? 0) + 1,
    released: (prev?.released ?? 0) + (released ? 1 : 0),
  };

  return {
    book: { entries: { ...book.entries, [rec.id]: next } },
    isNew,
    isBiggest,
    firstRelease,
  };
}

/**
 * 把手上这一条放生(不再算一次捕获,只记一笔放生)。
 * 返回 firstRelease:这一种鱼是不是第一次被放回水里 —— 只有第一次给星星。
 */
export function markReleased(book: DexBook, id: string): { book: DexBook; firstRelease: boolean } {
  const prev = book.entries[id];
  if (!prev) return { book, firstRelease: false };
  const firstRelease = prev.released === 0;
  return {
    book: { entries: { ...book.entries, [id]: { ...prev, released: prev.released + 1 } } },
    firstRelease,
  };
}

export interface DexStats {
  found: number;
  total: number;
  /** 0..100 的整数 */
  percent: number;
  caught: number;
  released: number;
  /** 四档各收录了几种 */
  byTier: number[];
}

export function dexStats(book: DexBook): DexStats {
  const ids = Object.keys(book.entries).filter((id) => fishById(id));
  const byTier = [0, 0, 0, 0];
  let caught = 0;
  let released = 0;
  for (const id of ids) {
    const fish = fishById(id) as Fish;
    byTier[tierIndexOf(fish.rarity)] += 1;
    caught += book.entries[id].caught;
    released += book.entries[id].released;
  }
  const total = FISH.length;
  return {
    found: ids.length,
    total,
    percent: total > 0 ? Math.round((ids.length / total) * 100) : 0,
    caught,
    released,
    byTier,
  };
}

/** 图鉴卡片上「最大 42.1 厘米(比标准还大)」这一行 */
export function bestSizeText(fish: Fish, entry: DexEntry | undefined): string {
  if (!entry || entry.bestCm <= 0) return "最大尺寸:还没记录";
  const base = baseLengthCm(fish);
  const tag = entry.bestCm >= base ? "大个头" : "还能再大";
  return `最大 ${formatLength(entry.bestCm)}(${tag})`;
}

/** 首次捕获时间的中文写法;没有时间戳(老存档迁移)就说实话 */
export function firstCatchText(entry: DexEntry | undefined, now: number = Date.now()): string {
  if (!entry) return "首次捕获:还没见过";
  if (entry.firstAt <= 0) return "首次捕获:很早以前";
  const d = new Date(entry.firstAt);
  if (Number.isNaN(d.getTime())) return "首次捕获:很早以前";
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const md = `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  return `首次捕获:${sameYear ? md : `${d.getFullYear()} 年 ${md}`}`;
}
