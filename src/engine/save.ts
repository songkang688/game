/**
 * 本地存档:星星余额、音效开关、每个游戏的最好成绩。
 * 只写 localStorage,不联网、无账号。
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** 可选:枚举全部 key(导出进度用;真 localStorage 走 length/key,内存实现直接给数组) */
  keys?(): string[];
  readonly length?: number;
  key?(index: number): string | null;
}

export type BestStars = 0 | 1 | 2 | 3;

export interface GameProgress {
  bestStars: BestStars;
  plays: number;
  /**
   * 无尽模式最好成绩(1.1 新增)。老存档没有这个字段,读出来就是 0;
   * 不同游戏的单位自己定义(米数 / 得分 / 回合数),平台只负责保存最大值。
   */
  endlessBest: number;
}

interface SaveData {
  stars: number;
  soundOn: boolean;
  /** 背景音乐开关,默认关(尊重家长) */
  bgmOn: boolean;
  games: Record<string, GameProgress>;
}

export const SAVE_KEY = "yiduo-yixing.save.v1";

/** 本应用全部存档 key 的公共前缀(平台钱包、l99 关卡、各游戏 PROGRESS_KEY、最近玩过等) */
export const SAVE_PREFIX = "yiduo-yixing.";

/**
 * 三款经典游戏(五子棋/糖果秋千/泡泡瞄准手)历史上用的旧前缀。
 * 存档 key 不能改(老玩家进度不能丢),所以导出/导入/清空都必须同时覆盖两代前缀,
 * 否则备份会静默漏掉这三款的 99 关战役进度。
 */
export const LEGACY_SAVE_PREFIX = "yiduo.";

/** 是否属于本应用的存档 key(两代前缀都算) */
function isOwnSaveKey(key: string): boolean {
  return key.startsWith(SAVE_PREFIX) || key.startsWith(LEGACY_SAVE_PREFIX);
}

/** 隐私模式探测写下的临时 key(如 yiduo-yixing.l99.probe),不该进备份 */
function isProbeKey(key: string): boolean {
  return key.endsWith(".probe");
}

function defaultData(): SaveData {
  return { stars: 0, soundOn: true, bgmOn: false, games: {} };
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
    },
    keys: () => [...map.keys()]
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
  if (typeof obj.bgmOn === "boolean") data.bgmOn = obj.bgmOn;
  if (typeof obj.games === "object" && obj.games !== null) {
    for (const [id, value] of Object.entries(obj.games as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const v = value as Record<string, unknown>;
      const best = typeof v.bestStars === "number" ? v.bestStars : 0;
      const plays = typeof v.plays === "number" ? v.plays : 0;
      const endless = typeof v.endlessBest === "number" && Number.isFinite(v.endlessBest) ? v.endlessBest : 0;
      data.games[id] = {
        bestStars: (Math.min(3, Math.max(0, Math.round(best))) as BestStars) ?? 0,
        plays: Math.max(0, Math.round(plays)),
        endlessBest: Math.max(0, Math.round(endless))
      };
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// 导出 / 导入:带版本号与校验和的 Base64 文本,换设备或清缓存前备份用
// ---------------------------------------------------------------------------

/** 导出文本的版本头,一眼能认出是「一朵一星」的备份 */
const EXPORT_HEADER = "YDYX1.";
const EXPORT_VERSION = 1;

export type ImportResult = { ok: true; count: number } | { ok: false; error: string };

function listKeys(storage: StorageLike): string[] {
  if (typeof storage.keys === "function") return storage.keys();
  if (typeof storage.length === "number" && typeof storage.key === "function") {
    const out: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== null) out.push(k);
    }
    return out;
  }
  return [];
}

/** FNV-1a 32 位校验和,防备份文本被截断或改动 */
function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** UTF-8 安全的 Base64 编码(浏览器与 Node 都可用) */
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
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

  isBgmOn(): boolean {
    return this.data.bgmOn;
  }

  setBgmOn(on: boolean): void {
    this.data.bgmOn = on;
    this.persist();
  }

  getGameProgress(id: string): GameProgress {
    return this.data.games[id] ?? { bestStars: 0, plays: 0, endlessBest: 0 };
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
      ...p,
      bestStars: Math.max(p.bestStars, stars) as BestStars
    };
    this.persist();
  }

  /** 记录一次无尽模式成绩,保留历史最高分,返回保存后的最好成绩 */
  recordEndlessBest(id: string, score: number): number {
    const p = this.getGameProgress(id);
    if (!Number.isFinite(score)) return p.endlessBest;
    const next = Math.max(p.endlessBest, Math.max(0, Math.round(score)));
    if (next === p.endlessBest && this.data.games[id]) return p.endlessBest;
    this.data.games[id] = { ...p, endlessBest: next };
    this.persist();
    return next;
  }

  /**
   * 导出全部进度:收集所有 yiduo-yixing. 前缀的存档
   * (平台钱包、l99 关卡、各游戏 PROGRESS_KEY、最近玩过等),
   * 打包成带版本号与校验和的 Base64 文本。
   */
  exportAll(): string {
    const collected = new Map<string, string>();
    // 平台钱包一定带上(即使还没写进 storage)
    collected.set(SAVE_KEY, JSON.stringify(this.data));
    for (const key of listKeys(this.storage)) {
      if (!isOwnSaveKey(key) || isProbeKey(key)) continue;
      try {
        const value = this.storage.getItem(key);
        if (value !== null) collected.set(key, value);
      } catch {
        // 个别 key 读不出来就跳过,导出尽量多
      }
    }
    // 按 key 排序保证同一份进度导出的文本(与校验和)稳定
    const entries: Record<string, string> = {};
    for (const key of [...collected.keys()].sort()) {
      entries[key] = collected.get(key) as string;
    }
    const payload = JSON.stringify({
      v: EXPORT_VERSION,
      sum: checksum(JSON.stringify(entries)),
      entries
    });
    return EXPORT_HEADER + encodeBase64(payload);
  }

  /**
   * 导入进度:先整体校验(版本、格式、key 前缀、校验和),
   * 全部通过才写入;写入途中任何一步失败都会回滚,不留半套存档。
   */
  importAll(text: string): ImportResult {
    const failKeep = "没有导入,现有进度保持不变";
    const trimmed = (text ?? "").trim();
    if (!trimmed) return { ok: false, error: "先把备份文本粘贴进来哦" };
    if (!trimmed.startsWith(EXPORT_HEADER)) {
      return { ok: false, error: `这段文字不是「一朵一星」的进度备份,${failKeep}` };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(decodeBase64(trimmed.slice(EXPORT_HEADER.length)));
    } catch {
      return { ok: false, error: `备份文本好像缺了一块,请重新完整复制,${failKeep}` };
    }
    if (typeof payload !== "object" || payload === null) {
      return { ok: false, error: `备份内容不完整,${failKeep}` };
    }
    const obj = payload as Record<string, unknown>;
    if (obj.v !== EXPORT_VERSION) {
      return { ok: false, error: `备份版本不认识(可能来自其它版本),${failKeep}` };
    }
    if (
      typeof obj.sum !== "string" ||
      typeof obj.entries !== "object" ||
      obj.entries === null ||
      Array.isArray(obj.entries)
    ) {
      return { ok: false, error: `备份内容不完整,${failKeep}` };
    }
    const entries = obj.entries as Record<string, unknown>;
    for (const [key, value] of Object.entries(entries)) {
      if (!isOwnSaveKey(key) || typeof value !== "string") {
        return { ok: false, error: `备份里混进了不认识的内容,${failKeep}` };
      }
    }
    if (checksum(JSON.stringify(entries)) !== obj.sum) {
      return { ok: false, error: `备份校验没通过(内容可能被改动过),${failKeep}` };
    }

    // 校验全部通过,开始写入;先记住旧值,失败就整体回滚
    const list = Object.entries(entries) as [string, string][];
    const backup = new Map<string, string | null>();
    try {
      for (const [key, value] of list) {
        backup.set(key, this.storage.getItem(key));
        this.storage.setItem(key, value);
      }
    } catch {
      for (const [key, old] of backup) {
        try {
          const cur = this.storage.getItem(key);
          if (old === null) {
            if (cur !== null) this.storage.removeItem(key);
          } else if (cur !== old) {
            this.storage.setItem(key, old);
          }
        } catch {
          // 回滚尽力而为
        }
      }
      return { ok: false, error: `设备存储空间不够,${failKeep}` };
    }

    // 平台钱包重新从导入后的 storage 读一遍,并通知订阅方刷新
    this.data = this.load();
    for (const fn of this.listeners) fn();
    return { ok: true, count: list.length };
  }

  /**
   * 家长面板里的「清空全部进度」:
   * 除了平台钱包,还要清掉 l99 关卡、各游戏战役(含旧前缀)、最近玩过等全部进度 key。
   */
  resetAll(): void {
    this.data = defaultData();
    try {
      for (const key of listKeys(this.storage)) {
        if (!isOwnSaveKey(key)) continue;
        try {
          this.storage.removeItem(key);
        } catch {
          // 个别 key 删不掉就跳过,尽量清干净
        }
      }
      // storage 不支持枚举 key 时,至少把平台钱包清掉
      this.storage.removeItem(SAVE_KEY);
    } catch {
      // 忽略
    }
    for (const fn of this.listeners) fn();
  }
}

/** 全局单例,UI 与游戏共用 */
export const save = new SaveStore();
