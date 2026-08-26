/**
 * 1.2 新增:管理员(root)高权限门的公共契约。
 * 只有常量与会话读写纯逻辑,不 import 任何 UI / 玩法代码,
 * 关卡框架与首页都能安全依赖,不会把弹窗代码拖进游戏 chunk。
 */

/** 打开后 1 小时自动关闭 */
export const ROOT_TTL_MS = 60 * 60 * 1000;
/** 弹窗必须原样展示的联系方式 */
export const ROOT_ADMIN_PHONE = "18438037080";
/** 默认密码(本地全家桶,不联网、不做账号) */
export const ROOT_DEFAULT_PASSWORD = "kangkang";
/** 只存 { expiresAt },绝不存密码 */
export const ROOT_STORAGE_KEY = "yiduo-yixing.root.v1";
/** 密码连错几次锁定 */
export const ROOT_MAX_WRONG = 3;
/** 锁定时长 */
export const ROOT_LOCK_MS = 120 * 1000;

export interface RootSession {
  /** 过期时间戳(ms);now >= expiresAt 视为已关闭 */
  expiresAt: number;
}

export interface RootStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** 隐私模式(localStorage 不可用)时的内存降级会话 */
let memorySession: RootSession | null = null;

function pickStorage(storage?: RootStorageLike | null): RootStorageLike | null {
  if (storage) return storage;
  try {
    const ls = (globalThis as { localStorage?: RootStorageLike }).localStorage;
    if (ls) {
      ls.getItem(ROOT_STORAGE_KEY);
      return ls;
    }
  } catch {
    /* 隐私模式:降级到内存 */
  }
  return null;
}

/** 读会话;坏数据、缺字段、已过期一律当作「没开」并清掉 */
export function readRootSession(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): RootSession | null {
  const store = pickStorage(storage);
  let session: RootSession | null = memorySession;
  if (store) {
    try {
      const raw = store.getItem(ROOT_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        const at = (parsed as { expiresAt?: unknown } | null)?.expiresAt;
        session = typeof at === "number" && Number.isFinite(at) ? { expiresAt: at } : null;
      }
    } catch {
      session = null;
    }
  }
  if (!session || nowMs >= session.expiresAt) {
    if (session) clearRootSession(storage);
    return null;
  }
  return session;
}

export function writeRootSession(
  expiresAt: number,
  storage?: RootStorageLike | null
): void {
  memorySession = { expiresAt };
  const store = pickStorage(storage);
  try {
    store?.setItem(ROOT_STORAGE_KEY, JSON.stringify({ expiresAt }));
  } catch {
    /* 写不进就只靠内存 */
  }
}

export function clearRootSession(storage?: RootStorageLike | null): void {
  memorySession = null;
  const store = pickStorage(storage);
  try {
    store?.removeItem(ROOT_STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}

/** 门开没开(过期自动算关) */
export function isRootOpen(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): boolean {
  return readRootSession(nowMs, storage) !== null;
}

/** 还剩多少毫秒;没开返回 0 */
export function rootRemainMs(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): number {
  const s = readRootSession(nowMs, storage);
  return s ? Math.max(0, s.expiresAt - nowMs) : 0;
}

export interface Root12Extras {
  /** 弹密码框请求打开;resolve(true) 表示已打开 */
  requestRootOpen?: (reason: string) => Promise<boolean>;
  /** 立刻关闭管理员权限 */
  closeRoot?: () => void;
}

let extras: Root12Extras = {};

/** 由 rootGate.ts 在模块加载时注册;没注册时调用方要自己降级 */
export function registerRoot12Extras(next: Root12Extras): void {
  extras = { ...extras, ...next };
}

export function getRoot12Extras(): Root12Extras {
  return extras;
}

/** 仅供测试 */
export function resetRoot12Extras(): void {
  extras = {};
  memorySession = null;
}

// ---------------------------------------------------------------------------
// 直达第 N 关的公共小工具(level99 / quiz99 都用它,避免各写一套夹取规则)
// ---------------------------------------------------------------------------

/**
 * 把输入框里的字符串收拾成合法的「第 N 关」(1 基)。
 * 空、`abc`、负数、0、超上限、`1e9` 一律夹到 1..total;完全读不出数字时返回 null。
 */
export function clampJumpTarget(raw: string, total: number): number | null {
  const max = Number.isFinite(total) && total >= 1 ? Math.floor(total) : 1;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(max, Math.round(n)));
}

/** 「管理员权限还剩 XX 分钟」里的那个分钟数(不足一分钟按 1 分钟报) */
export function rootRemainMinutes(remainMs: number): number {
  if (!Number.isFinite(remainMs) || remainMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainMs / 60000));
}
