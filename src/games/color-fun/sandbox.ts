/**
 * 涂色小屋 · 自由涂色沙盒的存档层（1.2 新增，纯函数，不碰 DOM）。
 *
 * 沙盒和闯关是两回事，所以存档也彻底分开：
 *  - 闯关进度还是框架的 `yiduo-yixing.l99.color-fun`（本文件一个字都不写它）；
 *  - 沙盒作品走 `yiduo-yixing.clf.sandbox.v1`。
 * 家长在设置里清进度不会连作品一起清掉，反过来也一样。
 *
 * 存的是「用了哪幅线稿 + 每一块填了什么颜色」，缩略图现画，
 * 不往 localStorage 里塞图片数据——十二张画也就几 KB。
 */

/** 存储接口：真环境是 localStorage，测试直接塞个 Map 进来 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** 沙盒作品存档 key（1.2 新增，走 `yiduo-yixing.` 前缀） */
export const SANDBOX_KEY = "yiduo-yixing.clf.sandbox.v1";

/** 最多留几张；满了提示替换，不静默丢掉最老的 */
export const MAX_WORKS = 12;

/** 一张作品 */
export interface SandboxWork {
  /** 用的是 `PICTURES` 里第几幅 */
  pic: number;
  /** 区域 id → 颜料名 */
  fills: Record<string, string>;
  /** 存下来的时刻（毫秒） */
  at: number;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 把任意来源的值整理成一张干净的作品；整不出来返回 null */
export function normalizeWork(raw: unknown): SandboxWork | null {
  if (!isPlainRecord(raw)) return null;
  const pic = raw.pic;
  if (typeof pic !== "number" || !Number.isFinite(pic) || pic < 0) return null;
  const fills: Record<string, string> = {};
  if (isPlainRecord(raw.fills)) {
    for (const [k, v] of Object.entries(raw.fills)) {
      if (typeof v === "string" && v.length > 0) fills[k] = v;
    }
  }
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : 0;
  return { pic: Math.round(pic), fills, at };
}

/** 把存档整理成一串作品：坏数据一律丢掉，超过上限只留最新的 12 张 */
export function normalizeWorks(raw: unknown): SandboxWork[] {
  if (!Array.isArray(raw)) return [];
  const out: SandboxWork[] = [];
  for (const item of raw) {
    const work = normalizeWork(item);
    if (work) out.push(work);
  }
  return out.slice(0, MAX_WORKS);
}

/** 读出全部作品；读不出来（隐私模式、数据坏了）就当一张都没有 */
export function loadWorks(store: StorageLike | null): SandboxWork[] {
  if (!store) return [];
  try {
    const raw = store.getItem(SANDBOX_KEY);
    return raw ? normalizeWorks(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

/** 写回全部作品；存不进去也不影响接着画 */
export function writeWorks(store: StorageLike | null, works: readonly SandboxWork[]): void {
  if (!store) return;
  try {
    store.setItem(SANDBOX_KEY, JSON.stringify(works.slice(0, MAX_WORKS)));
  } catch {
    // 配额满了 / 隐私模式：这一张就留在本次会话里
  }
}

/** 存一张的结果：`full` 为真时什么都没写，界面要问孩子替换哪一张 */
export interface SaveResult {
  saved: boolean;
  full: boolean;
  works: SandboxWork[];
}

/** 新存一张作品；已经满 12 张就原样返回并把 `full` 打起来 */
export function saveWork(store: StorageLike | null, work: SandboxWork): SaveResult {
  const works = loadWorks(store);
  if (works.length >= MAX_WORKS) return { saved: false, full: true, works };
  const next = [...works, work];
  writeWorks(store, next);
  return { saved: true, full: false, works: next };
}

/** 顶掉第 `at` 张（满了之后孩子自己挑一张换掉）；下标不对就当没这回事 */
export function replaceWork(store: StorageLike | null, at: number, work: SandboxWork): SaveResult {
  const works = loadWorks(store);
  if (!Number.isInteger(at) || at < 0 || at >= works.length) return { saved: false, full: works.length >= MAX_WORKS, works };
  const next = works.slice();
  next[at] = work;
  writeWorks(store, next);
  return { saved: true, full: false, works: next };
}

/** 删掉第 `at` 张 */
export function removeWork(store: StorageLike | null, at: number): SandboxWork[] {
  const works = loadWorks(store);
  if (!Number.isInteger(at) || at < 0 || at >= works.length) return works;
  const next = works.slice(0, at).concat(works.slice(at + 1));
  writeWorks(store, next);
  return next;
}

/** 画廊满了没有 */
export function isFull(works: readonly SandboxWork[]): boolean {
  return works.length >= MAX_WORKS;
}

/** 浏览器里能用的 localStorage；隐私模式等取不到就返回 null，沙盒照样能画只是不留档 */
export function browserStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!ls) return null;
    const probe = `${SANDBOX_KEY}.probe`;
    ls.setItem(probe, "1");
    ls.removeItem?.(probe);
    return ls;
  } catch {
    return null;
  }
}
