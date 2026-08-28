/**
 * 1.2 新增:管理员(root)高权限门的公共契约。
 * 只有常量与会话读写纯逻辑,不 import 任何 UI / 玩法代码,
 * 关卡框架与首页都能安全依赖,不会把弹窗代码拖进游戏 chunk。
 *
 * 1.3 起支持「开多久」:默认 1 小时,可选更短/更长,也能选永久。
 * 落盘的永远只有 { expiresAt, mode },密码一个字都不进任何存储。
 */

/** 打开后默认 1 小时自动关闭(密码门里可以改时长或选永久) */
export const ROOT_TTL_MS = 60 * 60 * 1000;
/** 弹窗必须原样展示的联系方式 */
export const ROOT_ADMIN_PHONE = "18438037080";
/** 默认密码(本地全家桶,不联网、不做账号) */
export const ROOT_DEFAULT_PASSWORD = "kangkang";
/** 只存 { expiresAt, mode },绝不存密码 */
export const ROOT_STORAGE_KEY = "yiduo-yixing.root.v1";
/** 密码连错几次锁定 */
export const ROOT_MAX_WRONG = 3;
/** 锁定时长 */
export const ROOT_LOCK_MS = 120 * 1000;

/** 会话两种模式:限时(到点自动关)与永久(手动关闭前一直开着) */
export type RootMode = "timed" | "permanent";

/**
 * 「永久开启」落盘用的远未来时间戳(9999-01-01 UTC)。
 * 和显式的 mode:"permanent" 双保险:哪边先被别的代码读到都不会误判成已过期。
 */
export const ROOT_PERMANENT_EXPIRES_AT = Date.UTC(9999, 0, 1);

/** 密码门里的一个时长选项;ms 为 null 表示永久 */
export interface RootDurationChoice {
  key: RootDurationKey;
  label: string;
  ms: number | null;
}

export type RootDurationKey = "30m" | "1h" | "4h" | "forever";

/** 密码门展示的时长选项(顺序即展示顺序) */
export const ROOT_DURATION_CHOICES: readonly RootDurationChoice[] = [
  { key: "30m", label: "30 分钟", ms: 30 * 60 * 1000 },
  { key: "1h", label: "1 小时", ms: ROOT_TTL_MS },
  { key: "4h", label: "4 小时", ms: 4 * 60 * 60 * 1000 },
  { key: "forever", label: "永久", ms: null }
];

/** 没特意选就按 1 小时 */
export const ROOT_DEFAULT_DURATION: RootDurationKey = "1h";

/** 按 key 找时长选项;不认识的 key 一律退回默认 1 小时,绝不抛异常 */
export function rootDurationOf(key: string | null | undefined): RootDurationChoice {
  const found = ROOT_DURATION_CHOICES.find((c) => c.key === key);
  return found ?? (ROOT_DURATION_CHOICES.find((c) => c.key === ROOT_DEFAULT_DURATION) as RootDurationChoice);
}

export interface RootSession {
  /** 过期时间戳(ms);timed 模式下 now >= expiresAt 视为已关闭 */
  expiresAt: number;
  /** permanent 表示永久开启(手动关闭前不过期);老存档没有这个字段,按 timed 读 */
  mode: RootMode;
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

/** 读会话;坏数据、缺字段、限时且已过期一律当作「没开」并清掉 */
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
        const rawMode = (parsed as { mode?: unknown } | null)?.mode;
        // 老存档没有 mode 字段,读出来按 timed 处理;脏值也一律按 timed
        const mode: RootMode = rawMode === "permanent" ? "permanent" : "timed";
        session =
          typeof at === "number" && Number.isFinite(at) ? { expiresAt: at, mode } : null;
      }
    } catch {
      session = null;
    }
  }
  // 永久模式不看钟;限时模式到点即关
  if (!session || (session.mode !== "permanent" && nowMs >= session.expiresAt)) {
    if (session) clearRootSession(storage);
    return null;
  }
  return session;
}

export function writeRootSession(
  expiresAt: number,
  storage?: RootStorageLike | null,
  mode: RootMode = "timed"
): void {
  const session: RootSession = { expiresAt, mode };
  memorySession = session;
  const store = pickStorage(storage);
  try {
    store?.setItem(ROOT_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* 写不进就只靠内存 */
  }
}

/**
 * 输对密码后按所选时长开门(密码本身只在调用方参数里活一瞬,不进这里)。
 * duration 传时长选项的 key;不认识的 key 退回默认 1 小时。永久 = 远未来
 * 时间戳 + mode:"permanent" 双保险。
 */
export function openRootSession(
  nowMs: number,
  duration: RootDurationKey | string = ROOT_DEFAULT_DURATION,
  storage?: RootStorageLike | null
): RootSession {
  const choice = rootDurationOf(duration);
  const session: RootSession =
    choice.ms === null
      ? { expiresAt: ROOT_PERMANENT_EXPIRES_AT, mode: "permanent" }
      : { expiresAt: nowMs + choice.ms, mode: "timed" };
  writeRootSession(session.expiresAt, storage, session.mode);
  return session;
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

/**
 * 门开没开(限时到点自动算关,永久要手动关)。
 * 这就是「全关卡解锁」的统一开关:关卡解锁逻辑一律问它,
 * 不要在各个游戏里自己读存储、自己判过期。
 */
export function isRootOpen(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): boolean {
  return readRootSession(nowMs, storage) !== null;
}

/** 当前会话是不是「永久开启」;没开 / 限时都返回 false */
export function isRootPermanent(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): boolean {
  return readRootSession(nowMs, storage)?.mode === "permanent";
}

/** 还剩多少毫秒;没开返回 0;永久会话返回到远未来的剩余(一个巨大的有限数) */
export function rootRemainMs(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): number {
  const s = readRootSession(nowMs, storage);
  return s ? Math.max(0, s.expiresAt - nowMs) : 0;
}

/**
 * 管理员权限状态的统一文案(首页钥匙按钮、密码门、家长面板共用):
 * 关着一句话;永久开启不再报「还剩 X 分钟」;限时才报剩余分钟。
 */
export function rootStatusLine(
  nowMs: number = Date.now(),
  storage?: RootStorageLike | null
): string {
  const s = readRootSession(nowMs, storage);
  if (!s) return "管理员权限已关闭";
  if (s.mode === "permanent") return "管理员权限已永久开启";
  return `管理员权限已开,还剩 ${rootRemainMinutes(Math.max(0, s.expiresAt - nowMs))} 分钟`;
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
