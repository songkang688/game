/**
 * 「最近玩过」列表:独立 localStorage key,与 save.ts 的存档结构互不影响。
 * 写入放在游戏壳(每次真正进入游戏时),这样无论从首页卡片、
 * 「最近玩过」、还是深链/PWA 恢复进入,列表都会更新。
 */

export const RECENT_KEY = "yiduo-yixing.recent.v1";

/** 列表最多保留的游戏数(首页展示时再截取) */
const RECENT_MAX = 8;

interface RecentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): RecentStorage | undefined {
  return (globalThis as { localStorage?: RecentStorage }).localStorage;
}

/** 读出最近玩过的游戏 id 列表(最新在前);读不到时返回空数组 */
export function loadRecentIds(storage: RecentStorage | undefined = defaultStorage()): string[] {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** 记录一次游玩:id 挪到最前,列表截断到上限 */
export function recordRecent(
  id: string,
  storage: RecentStorage | undefined = defaultStorage()
): void {
  try {
    const next = [id, ...loadRecentIds(storage).filter((x) => x !== id)].slice(0, RECENT_MAX);
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 存不进去(隐私模式等)就算了,不影响游玩
  }
}
