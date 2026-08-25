/**
 * 本地存档:星星余额、音效开关、每个游戏的最好成绩。
 * 只写 localStorage,不联网、无账号。
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BestStars = 0 | 1 | 2 | 3;

export interface GameProgress {
  bestStars: BestStars;
  plays: number;
}

interface SaveData {
  stars: number;
  soundOn: boolean;
  games: Record<string, GameProgress>;
}

export const SAVE_KEY = "yiduo-yixing.save.v1";

function defaultData(): SaveData {
  return { stars: 0, soundOn: true, games: {} };
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    }
  };
}

function pickStorage(): StorageLike {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      // 有些环境(隐私模式)读写会抛异常,先探测一次
      const probe = "yiduo-yixing.probe";
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    // 落到内存存储
  }
  return createMemoryStorage();
}

function sanitize(raw: unknown): SaveData {
  const data = defaultData();
  if (typeof raw !== "object" || raw === null) return data;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.stars === "number" && Number.isFinite(obj.stars)) {
    data.stars = Math.max(0, Math.round(obj.stars));
  }
  if (typeof obj.soundOn === "boolean") data.soundOn = obj.soundOn;
  if (typeof obj.games === "object" && obj.games !== null) {
    for (const [id, value] of Object.entries(obj.games as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const v = value as Record<string, unknown>;
      const best = typeof v.bestStars === "number" ? v.bestStars : 0;
      const plays = typeof v.plays === "number" ? v.plays : 0;
      data.games[id] = {
        bestStars: (Math.min(3, Math.max(0, Math.round(best))) as BestStars) ?? 0,
        plays: Math.max(0, Math.round(plays))
      };
    }
  }
  return data;
}

export class SaveStore {
  private data: SaveData;
  private listeners = new Set<() => void>();

  constructor(private storage: StorageLike = pickStorage()) {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return defaultData();
      return sanitize(JSON.parse(raw));
    } catch {
      return defaultData();
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // 存储满/被禁用时静默失败,游戏仍可继续
    }
    for (const fn of this.listeners) fn();
  }

  /** 订阅存档变化(星星余额展示用),返回取消订阅函数 */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getStars(): number {
    return this.data.stars;
  }

  /** 增减星星,余额不会低于 0,返回最新余额 */
  addStars(n: number): number {
    if (!Number.isFinite(n)) return this.data.stars;
    this.data.stars = Math.max(0, Math.round(this.data.stars + n));
    this.persist();
    return this.data.stars;
  }

  isSoundOn(): boolean {
    return this.data.soundOn;
  }

  setSoundOn(on: boolean): void {
    this.data.soundOn = on;
    this.persist();
  }

  getGameProgress(id: string): GameProgress {
    return this.data.games[id] ?? { bestStars: 0, plays: 0 };
  }

  /** 记录一次开始游玩 */
  recordPlay(id: string): void {
    const p = this.getGameProgress(id);
    this.data.games[id] = { ...p, plays: p.plays + 1 };
    this.persist();
  }

  /** 记录一次胜利,保留历史最好星级 */
  recordWin(id: string, stars: BestStars): void {
    const p = this.getGameProgress(id);
    this.data.games[id] = {
      plays: p.plays,
      bestStars: Math.max(p.bestStars, stars) as BestStars
    };
    this.persist();
  }

  /** 家长面板里的「清空全部进度」 */
  resetAll(): void {
    this.data = defaultData();
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      // 忽略
    }
    for (const fn of this.listeners) fn();
  }
}

/** 全局单例,UI 与游戏共用 */
export const save = new SaveStore();
