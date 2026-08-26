// 糖果秋千的闯关进度存档。存档 key 只增不改：
// 1.2 起主 key 用全站统一的 `yiduo-yixing.` 前缀，两代老 key 只读不写、读一次合并进来。
// 合并规则是「逐关取最大星数」，所以不管在哪一代打的星，都不会丢。
// 纯逻辑，不碰 localStorage 之外的东西，方便单测直接喂一个假 storage。

/** 1.2 起的主存档 key */
export const SAVE_KEY = "yiduo-yixing.candy-swing.campaign.v2";

/**
 * 历史上用过的两代老前缀（家长面板里能看到）。
 * 顺序无所谓，读的时候全部取出来一起取最大值。
 */
export const LEGACY_SAVE_KEYS: readonly string[] = [
  "yiduo.candy-swing.campaign.v2",
  "candy-swing.campaign.v2",
];

export interface Progress {
  /** 每关最佳星数 0-3（0 = 未通过） */
  stars: number[];
}

/** 最小 storage 接口：真 localStorage 和测试用的假对象都满足 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 把任意来源的星级数组洗成长度 total、每项 0-3 的整数数组 */
export function normalizeStars(raw: unknown, total: number): number[] {
  const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
  const out: number[] = [];
  for (let i = 0; i < total; i++) {
    const v = arr[i];
    out.push(typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(3, Math.round(v)))
      : 0);
  }
  return out;
}

/** 逐关取最大：迁移合并绝不允许把星星改小 */
export function mergeStars(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.max(a[i] ?? 0, b[i] ?? 0));
  return out;
}

function parseStars(raw: string | null, total: number): number[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { stars?: unknown };
    if (!Array.isArray(data.stars)) return null;
    return normalizeStars(data.stars, total);
  } catch {
    return null;
  }
}

/**
 * 读进度：主 key 与所有老 key 都读出来，逐关取最大合并。
 * 读不到（隐私模式 / 新玩家）就是一份全 0 的新档。
 */
export function readProgress(storage: StorageLike | null, total: number): Progress {
  let stars = normalizeStars([], total);
  if (!storage) return { stars };
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
    let parsed: number[] | null = null;
    try {
      parsed = parseStars(storage.getItem(key), total);
    } catch {
      parsed = null;
    }
    if (parsed) stars = mergeStars(stars, parsed);
  }
  return { stars };
}

/** 只往主 key 写。老 key 原样留着，装了旧版也不会看到一个空档。 */
export function writeProgress(storage: StorageLike | null, p: Progress): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ stars: p.stars }));
  } catch {
    // 存不了也不影响本次游玩
  }
}

/** 迁移是否真的发生过：老 key 里有分、而主 key 还没有或更少 */
export function needsMigration(storage: StorageLike | null, total: number): boolean {
  if (!storage) return false;
  const mine = parseStars(storage.getItem(SAVE_KEY), total) ?? normalizeStars([], total);
  for (const key of LEGACY_SAVE_KEYS) {
    const old = parseStars(storage.getItem(key), total);
    if (!old) continue;
    for (let i = 0; i < total; i++) {
      if ((old[i] ?? 0) > (mine[i] ?? 0)) return true;
    }
  }
  return false;
}
