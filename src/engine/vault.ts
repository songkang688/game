/**
 * 存档保险箱:把进度多存一份到「应用沙盒之外」的固定位置,卸载重装也不丢。
 *
 * 病根:星星和关卡进度只在 localStorage 里,而 localStorage 属于应用私有数据——
 * 卸载桌面版 / 卸载安卓包 / 卸载 PWA 时会被系统连锅端走,重装回来就是一片空白。
 * 保险箱把同一份备份文本(复用 `save.exportAll()` 的 YDYX1 格式)另写一份到用户自己的
 * 文件里,重装后本地是空的,开机自检读回来就行。
 *
 * 三条通道,按能力探测挑一条,都不成就安静降级回家长面板里的手动导出/导入:
 *  1. electron  —— 桌面安装版。主进程写「文档/一朵一星存档」,卸载器不碰文档目录;
 *  2. capacitor —— 安卓包。写公共 Documents(拿不到就退外部存储),卸载后文件仍在;
 *  3. fsaccess  —— 桌面浏览器 / PWA。家长选一个文件夹,句柄记在 IndexedDB,
 *                  浏览器数据被清掉后重新选同一个文件夹即可接回。
 *
 * 铁律:
 *  - 只增不改:保险箱只是多写一份,localStorage 仍是唯一的实时读写源;
 *  - 不覆盖:只有本地确实是空的(新装/刚清空)才自动恢复,本地有进度时绝不自动盖掉,
 *    改由家长面板给一个「从备份恢复」的按钮,由家长自己决定;
 *  - 绝不抛异常:任何一步失败都返回失败态,游戏照常玩。
 */
import { LEGACY_SAVE_PREFIX, SAVE_KEY, SAVE_PREFIX, save, type StorageLike } from "./save";
import { forgetDirHandle, recallDirHandle, rememberDirHandle } from "./vaultHandle";

/** 存档文件夹名(桌面/安卓通道自己建;浏览器通道由家长自己挑) */
export const VAULT_DIR_NAME = "一朵一星存档";
/** 存档文件名。改名等于旧备份认不出来,别动 */
export const VAULT_FILE_NAME = "一朵一星存档.json";

/** 信封版本:外面这层记时间戳,里面 payload 还是 YDYX1 备份文本 */
const ENVELOPE_VERSION = 1;
const ENVELOPE_APP = "yiduo-yixing";

/** 自动备份的轮询间隔:进度是各游戏各自写 localStorage 的,统一在这儿收口 */
const AUTO_BACKUP_INTERVAL_MS = 20_000;

export type VaultKind = "electron" | "capacitor" | "fsaccess" | "none";

export interface VaultEnvelope {
  savedAt: string;
  payload: string;
}

export interface VaultAdapter {
  kind: VaultKind;
  /** 家长面板上给人看的位置说明 */
  location: string;
  /** 现在就能读写吗(浏览器通道要家长先选过文件夹) */
  ready(): Promise<boolean>;
  /** 需要用户手势的授权步骤;桌面/安卓通道不需要,返回 true */
  connect(): Promise<boolean>;
  read(): Promise<string | null>;
  write(text: string): Promise<boolean>;
  /** 断开(只忘掉位置,不删已经写出去的存档文件) */
  forget(): Promise<void>;
}

// ---------------------------------------------------------------------------
// 信封:给备份文本套一层时间戳,方便比谁新
// ---------------------------------------------------------------------------

export function wrapEnvelope(payload: string, now: Date = new Date()): string {
  return JSON.stringify({ v: ENVELOPE_VERSION, app: ENVELOPE_APP, savedAt: now.toISOString(), payload }, null, 2);
}

/** 解信封;老的裸 YDYX1 文本也认(早期手动导出的备份直接丢进文件夹也能恢复) */
export function readEnvelope(text: string | null): VaultEnvelope | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("YDYX1.")) return { savedAt: "", payload: trimmed };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.app !== ENVELOPE_APP || obj.v !== ENVELOPE_VERSION) return null;
  if (typeof obj.payload !== "string" || !obj.payload.startsWith("YDYX1.")) return null;
  return { savedAt: typeof obj.savedAt === "string" ? obj.savedAt : "", payload: obj.payload };
}

// ---------------------------------------------------------------------------
// 「本地是不是一片空白」:决定开机要不要自动恢复
// ---------------------------------------------------------------------------

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

/**
 * 本地进度是否为空。
 * 空 = 除了平台钱包没有别的存档 key,且钱包里既没星星也没玩过任何游戏。
 * 刚装好、刚清空都会命中;只要玩过一关就不算空,自动恢复就不会去盖它。
 */
export function isLocalProgressEmpty(storage: StorageLike): boolean {
  try {
    for (const key of listKeys(storage)) {
      if (key.endsWith(".probe")) continue;
      if (key === SAVE_KEY) continue;
      if (key.startsWith(SAVE_PREFIX) || key.startsWith(LEGACY_SAVE_PREFIX)) return false;
    }
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return true;
    const data = JSON.parse(raw) as { stars?: unknown; games?: unknown };
    const stars = typeof data.stars === "number" ? data.stars : 0;
    const games = typeof data.games === "object" && data.games !== null ? Object.keys(data.games).length : 0;
    return stars === 0 && games === 0;
  } catch {
    // 读不出来就当作「有东西」,宁可不自动恢复也不误盖
    return false;
  }
}

// ---------------------------------------------------------------------------
// 通道一:Electron 桌面版(preload 通过 contextBridge 递进来)
// ---------------------------------------------------------------------------

interface ElectronVaultBridge {
  read(): Promise<string | null>;
  write(text: string): Promise<boolean>;
  where(): Promise<string>;
}

function electronBridge(): ElectronVaultBridge | null {
  const bridge = (globalThis as { yiduoVault?: unknown }).yiduoVault as ElectronVaultBridge | undefined;
  if (!bridge || typeof bridge.read !== "function" || typeof bridge.write !== "function") return null;
  return bridge;
}

function makeElectronAdapter(bridge: ElectronVaultBridge): VaultAdapter {
  let where = `文档 / ${VAULT_DIR_NAME}`;
  void Promise.resolve()
    .then(() => bridge.where?.())
    .then((p) => {
      if (typeof p === "string" && p) where = p;
    })
    .catch(() => undefined);
  return {
    kind: "electron",
    get location() {
      return where;
    },
    ready: () => Promise.resolve(true),
    connect: () => Promise.resolve(true),
    read: () => Promise.resolve().then(() => bridge.read()).catch(() => null),
    write: (text) =>
      Promise.resolve()
        .then(() => bridge.write(text))
        .then((ok) => ok !== false)
        .catch(() => false),
    forget: () => Promise.resolve()
  };
}

// ---------------------------------------------------------------------------
// 通道二:Capacitor 安卓包
//
// 不静态依赖 @capacitor/filesystem:插件装了就从 Capacitor.Plugins 上取,没装就当没有,
// 这样 web 构建不会因为少一个原生插件而编译失败。
// Android 的公共 Documents 在分区存储下不一定写得进去,写不进就退到外部存储根目录;
// 两个都不行就整条通道判负,交给手动导出/导入兜底。
// ---------------------------------------------------------------------------

interface CapFilesystem {
  readFile(o: { path: string; directory: string; encoding: string }): Promise<{ data: string }>;
  writeFile(o: {
    path: string;
    directory: string;
    encoding: string;
    data: string;
    recursive?: boolean;
  }): Promise<unknown>;
  checkPermissions?(): Promise<{ publicStorage?: string }>;
  requestPermissions?(): Promise<{ publicStorage?: string }>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { Filesystem?: CapFilesystem };
}

function capacitorFs(): { fs: CapFilesystem; platform: string } | null {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) return null;
  const fs = cap.Plugins?.Filesystem;
  if (!fs || typeof fs.readFile !== "function" || typeof fs.writeFile !== "function") return null;
  return { fs, platform: typeof cap.getPlatform === "function" ? cap.getPlatform() : "native" };
}

function makeCapacitorAdapter(fs: CapFilesystem): VaultAdapter {
  const path = `${VAULT_DIR_NAME}/${VAULT_FILE_NAME}`;
  // Documents 卸载后仍在;分区存储写不进时退 ExternalStorage
  const dirs = ["DOCUMENTS", "EXTERNAL_STORAGE"];
  let picked: string | null = null;

  /** 老安卓写公共目录要先要权限;新安卓这两个方法直接返回 granted */
  function ensurePermission(): Promise<boolean> {
    const check = fs.checkPermissions?.bind(fs);
    if (!check) return Promise.resolve(true);
    return check()
      .then((r) => {
        if (r?.publicStorage === "granted") return true;
        const request = fs.requestPermissions?.bind(fs);
        if (!request) return false;
        return request().then((rr) => rr?.publicStorage === "granted");
      })
      .catch(() => true);
  }

  function tryWrite(text: string, index: number): Promise<boolean> {
    const dir = dirs[index];
    if (!dir) return Promise.resolve(false);
    return Promise.resolve()
      .then(() => fs.writeFile({ path, directory: dir, encoding: "utf8", data: text, recursive: true }))
      .then(() => {
        picked = dir;
        return true;
      })
      .catch(() => tryWrite(text, index + 1));
  }

  function tryRead(index: number): Promise<string | null> {
    const dir = picked ?? dirs[index];
    if (!dir) return Promise.resolve(null);
    return Promise.resolve()
      .then(() => fs.readFile({ path, directory: dir, encoding: "utf8" }))
      .then((r) => {
        picked = dir;
        return typeof r?.data === "string" ? r.data : null;
      })
      .catch(() => (picked ? null : tryRead(index + 1)));
  }

  return {
    kind: "capacitor",
    get location() {
      return picked === "EXTERNAL_STORAGE" ? `手机存储 / ${VAULT_DIR_NAME}` : `手机「文档」/ ${VAULT_DIR_NAME}`;
    },
    ready: () => ensurePermission(),
    connect: () => ensurePermission(),
    read: () => ensurePermission().then((ok) => (ok ? tryRead(0) : null)),
    write: (text) => ensurePermission().then((ok) => (ok ? tryWrite(text, 0) : false)),
    forget: () => Promise.resolve()
  };
}

// ---------------------------------------------------------------------------
// 通道三:桌面浏览器 / PWA 的 File System Access
// ---------------------------------------------------------------------------

interface FsFileHandle {
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

interface FsDirHandle {
  name?: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  queryPermission?(opts: { mode: string }): Promise<string>;
  requestPermission?(opts: { mode: string }): Promise<string>;
}

interface DirPickerWindow {
  showDirectoryPicker?: (opts?: { id?: string; mode?: string }) => Promise<FsDirHandle>;
}

function dirPicker(): DirPickerWindow["showDirectoryPicker"] | null {
  const w = globalThis as DirPickerWindow;
  return typeof w.showDirectoryPicker === "function" ? w.showDirectoryPicker.bind(w) : null;
}

function permissionOk(handle: FsDirHandle, ask: boolean): Promise<boolean> {
  const query = handle.queryPermission?.bind(handle);
  const request = handle.requestPermission?.bind(handle);
  if (!query) return Promise.resolve(true);
  return query({ mode: "readwrite" })
    .then((state) => {
      if (state === "granted") return true;
      if (!ask || !request) return false;
      return request({ mode: "readwrite" }).then((s) => s === "granted");
    })
    .catch(() => false);
}

function makeFsAccessAdapter(pick: NonNullable<DirPickerWindow["showDirectoryPicker"]>): VaultAdapter {
  let handle: FsDirHandle | null = null;
  let name = "";

  function recall(): Promise<FsDirHandle | null> {
    if (handle) return Promise.resolve(handle);
    return recallDirHandle()
      .then((h) => {
        const dir = h as FsDirHandle | null;
        if (!dir || typeof dir.getFileHandle !== "function") return null;
        handle = dir;
        name = dir.name ?? "";
        return dir;
      })
      .catch(() => null);
  }

  return {
    kind: "fsaccess",
    get location() {
      return name ? `${name} / ${VAULT_FILE_NAME}` : "还没选存档文件夹";
    },
    ready: () =>
      recall().then((dir) => {
        if (!dir) return false;
        return permissionOk(dir, false);
      }),
    connect: () =>
      Promise.resolve()
        .then(() => pick({ id: "yiduo-yixing-vault", mode: "readwrite" }))
        .then((dir) => {
          if (!dir) return false;
          return permissionOk(dir, true).then((ok) => {
            if (!ok) return false;
            handle = dir;
            name = dir.name ?? "";
            return rememberDirHandle(dir).then(() => true);
          });
        })
        .catch(() => false),
    read: () =>
      recall()
        .then((dir) => {
          if (!dir) return null;
          return permissionOk(dir, false).then((ok) => {
            if (!ok) return null;
            return dir
              .getFileHandle(VAULT_FILE_NAME, { create: false })
              .then((fh) => fh.getFile())
              .then((f) => f.text());
          });
        })
        .catch(() => null),
    write: (text) =>
      recall()
        .then((dir) => {
          if (!dir) return false;
          return permissionOk(dir, false).then((ok) => {
            if (!ok) return false;
            return dir
              .getFileHandle(VAULT_FILE_NAME, { create: true })
              .then((fh) => fh.createWritable())
              .then((w) => w.write(text).then(() => w.close()))
              .then(() => true);
          });
        })
        .catch(() => false),
    forget: () =>
      forgetDirHandle()
        .then(() => {
          handle = null;
          name = "";
        })
        .catch(() => undefined)
  };
}

// ---------------------------------------------------------------------------
// 挑通道 + 对外的几件事
// ---------------------------------------------------------------------------

const NO_VAULT: VaultAdapter = {
  kind: "none",
  location: "这台设备只能手动导出备份",
  ready: () => Promise.resolve(false),
  connect: () => Promise.resolve(false),
  read: () => Promise.resolve(null),
  write: () => Promise.resolve(false),
  forget: () => Promise.resolve()
};

let cached: VaultAdapter | null = null;

/** 探测这台设备能用哪条通道(结果缓存,壳环境一次启动内不会变) */
export function getVault(): VaultAdapter {
  if (cached) return cached;
  const bridge = electronBridge();
  if (bridge) {
    cached = makeElectronAdapter(bridge);
    return cached;
  }
  const cap = capacitorFs();
  if (cap) {
    cached = makeCapacitorAdapter(cap.fs);
    return cached;
  }
  const pick = dirPicker();
  cached = pick ? makeFsAccessAdapter(pick) : NO_VAULT;
  return cached;
}

/** 测试用:换一个通道进来 */
export function setVaultForTest(adapter: VaultAdapter | null): void {
  cached = adapter;
}

export type RestoreOutcome =
  | { ok: true; count: number; savedAt: string }
  | { ok: false; reason: "no-vault" | "no-file" | "bad-file" | "import-failed" | "local-not-empty"; error?: string };

/**
 * 从保险箱恢复。
 * `force` 为假时只在本地一片空白时才动手(开机自检就走这条,不会盖掉正在玩的进度);
 * 家长面板上的「从备份恢复」按钮传 true。
 */
export function restoreFromVault(force = false, storage?: StorageLike): Promise<RestoreOutcome> {
  const vault = getVault();
  const store = storage ?? (globalThis as { localStorage?: StorageLike }).localStorage;
  return vault
    .ready()
    .then((ok) => {
      if (!ok) return { ok: false, reason: "no-vault" } as RestoreOutcome;
      if (!force && store && !isLocalProgressEmpty(store)) {
        return { ok: false, reason: "local-not-empty" } as RestoreOutcome;
      }
      return vault.read().then((text) => {
        const envelope = readEnvelope(text);
        if (text === null) return { ok: false, reason: "no-file" } as RestoreOutcome;
        if (!envelope) return { ok: false, reason: "bad-file" } as RestoreOutcome;
        const result = save.importAll(envelope.payload);
        if (!result.ok) {
          return { ok: false, reason: "import-failed", error: result.error } as RestoreOutcome;
        }
        return { ok: true, count: result.count, savedAt: envelope.savedAt } as RestoreOutcome;
      });
    })
    .catch(() => ({ ok: false, reason: "no-vault" }) as RestoreOutcome);
}

/** 立刻把当前进度写进保险箱 */
export function backupToVault(now: Date = new Date()): Promise<boolean> {
  const vault = getVault();
  return vault
    .ready()
    .then((ok) => {
      if (!ok) return false;
      return vault.write(wrapEnvelope(save.exportAll(), now));
    })
    .catch(() => false);
}

export interface AutoBackupHandle {
  /** 立刻写一次(切后台/关窗口时用) */
  flush(): Promise<boolean>;
  stop(): void;
}

interface AutoBackupDeps {
  intervalMs?: number;
  /** 排一个定时任务,返回取消它的函数(测试用假的替掉) */
  schedule?: (fn: () => void, ms: number) => () => void;
  addPageHooks?: (flush: () => void) => () => void;
}

function defaultSchedule(fn: () => void, ms: number): () => void {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}

/**
 * 开自动备份。
 *
 * 为什么是轮询而不是订阅:进度分散在几十个游戏里各写各的 localStorage,
 * `save.onChange` 只盖得住平台钱包。这里定期把 `exportAll()` 的文本和上次比一比,
 * 变了才写文件——一次比对就是几十个 key 的字符串拼接,便宜得很,也不用去动 76 个游戏。
 */
export function startAutoBackup(deps: AutoBackupDeps = {}): AutoBackupHandle {
  const every = deps.intervalMs ?? AUTO_BACKUP_INTERVAL_MS;
  const schedule = deps.schedule ?? defaultSchedule;
  let last = "";
  let busy = false;
  let stopped = false;

  function flush(): Promise<boolean> {
    if (stopped || busy) return Promise.resolve(false);
    let text: string;
    try {
      text = save.exportAll();
    } catch {
      return Promise.resolve(false);
    }
    if (text === last) return Promise.resolve(false);
    busy = true;
    const vault = getVault();
    return vault
      .ready()
      .then((ok) => (ok ? vault.write(wrapEnvelope(text)) : false))
      .then((ok) => {
        if (ok) last = text;
        busy = false;
        return ok;
      })
      .catch(() => {
        busy = false;
        return false;
      });
  }

  const cancelTimer = schedule(() => {
    void flush();
  }, every);

  const unhook = (deps.addPageHooks ?? defaultPageHooks)(() => {
    void flush();
  });

  // 开机先写一次:把「上次退出后手动改过的东西」也落进文件
  void flush();

  return {
    flush,
    stop() {
      stopped = true;
      cancelTimer();
      unhook();
    }
  };
}

/** 切后台 / 关窗口时补写一次,别让最后几关白玩 */
function defaultPageHooks(flush: () => void): () => void {
  const doc = (globalThis as { document?: Document }).document;
  const win = globalThis as { addEventListener?: Window["addEventListener"]; removeEventListener?: Window["removeEventListener"] };
  const onHide = (): void => {
    if (!doc || doc.visibilityState === "hidden") flush();
  };
  doc?.addEventListener("visibilitychange", onHide);
  win.addEventListener?.("pagehide", onHide);
  return () => {
    doc?.removeEventListener("visibilitychange", onHide);
    win.removeEventListener?.("pagehide", onHide);
  };
}
