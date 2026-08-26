# 1.2 第 1 步 · A 档 —— root 管理员门（密码 `kangkang` / 1 小时 / 直达第 N 关）

> 本文件只记录第 1 步 A 档的开工计划与**可整段复制的派发提示词**，不涉及 B / C 档的文件。
> 主管文档：[`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) · 登记表：[`plan-1.2-tracker.md`](./plan-1.2-tracker.md) · 目录：[`plan-1.2-index.md`](./plan-1.2-index.md)
> 上一步：步 0（主管把 `origin/game-1.1` 合进 `game-1.2`）。下一步：第 2 步（新游戏接入，B 档文档）。
> 同步进行：[B 档 · 手游/端游筛选](./plan-1.2-step1-B-platform-filter.md)、[C 档 · 模式与 2.5D](./plan-1.2-step1-C-modes-view.md)。

## 目标

给「一朵一星」加一道**家里管理员**用的高权限门：输入密码 `kangkang` 打开后，可以在任意游戏的选关地图上**直达第 N 关**（1–188），
绕过「必须打完上一关」的解锁限制；一小时后自动关闭，也可以随时手动关闭。

这道门**不替换** 1.1 的算术家长门，两者分工：

| | 1.1 算术门 `src/ui/parentAuth.ts` | 1.2 root 门（本档新建） |
| --- | --- | --- |
| 用途 | 孩子求助大人「帮我跳过这一关」 | 管理员自己要随便玩第 XX 关 |
| 验证方式 | 现场做算术题（`high` 档连对 2 道） | 输入密码 `kangkang` |
| 有效期 | 5 分钟，只在内存 | **1 小时**，`{ expiresAt }` 落盘 |
| 1.2 里的改动 | **一个字都不改，原样保留** | 新增 |

两者的关系：**root 开着时，跳关 / 直达不必再做算术题**；root 关着时，跳关继续走 1.1 原路
（`level99` → `getLevelExtras().requestSkip` → `gameShell.requestSkip` → `requestParentAuth("high")`）。

## 文件切分

| 文件 | 职责 |
| --- | --- |
| `src/ui/root12Contract.ts`（新建） | 常量 + 会话读写纯逻辑（localStorage / 内存降级），**不 import 任何 UI 或玩法代码**，谁都能安全依赖 |
| `src/ui/root12Contract.test.ts`（新建） | 会话过期、坏数据、隐私模式降级、key 与常量 |
| `src/ui/rootGate.ts`（新建） | 密码弹窗、错误锁定、「关闭管理员权限」按钮，向契约注册实现 |
| `src/ui/rootGate.test.ts`（新建） | 弹窗行为、错 3 次锁 120 秒、电话文案在 DOM、密码不落盘 |
| `src/games/level99.ts` | 选关地图与关内菜单增加「直达第 N 关」；root 开着时跳关免算术题 |
| `src/games/level99.test.ts` | 直达行为、root 关着时控件不渲染、直达不篡改星级 |
| `src/games/quiz99.ts` | 答题壳同步支持直达任意题号 |
| `src/games/quiz99.test.ts` | 同上 |

**为什么把会话逻辑放进契约文件而不是 `rootGate.ts`：** `level99.ts` 需要知道「门开没开」，
但它不该为了这个去加载弹窗 UI（那会把 dialog 代码拖进每个游戏的 chunk，也会让单测环境变脏）。
契约文件只有常量和纯逻辑，`level99` 直接 import 它即可；`rootGate.ts` 只负责「怎么问密码」。

## 契约（逐字创建，本档是权威版本）

`src/ui/root12Contract.ts`：

```ts
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
```

## 直达第 N 关的行为规定

- 只在 `isRootOpen()` 为真时渲染控件；关着 / 过期时**连 DOM 都不出现**（和 1.1 攻略按钮一样：没能力就隐藏，保证单测环境干净）。
- 控件形态：选关地图顶部一个 `<input type="number" min=1 max=188>` + 「直达」按钮，关内暂停菜单里也放一个。
- 直达一个还没解锁的关：**允许进入**，但星级数组一个字都不能动 —— 没打过就是 0 星，不许写成三星，也不许顺手标成「已跳过」。
- 存档 key 语义不许改：星级仍是 `yiduo-yixing.l99.<id>`，跳关标记仍是 `yiduo-yixing.l99skip.<id>`，`TOTAL_LEVELS` 仍是 188。
- 越界输入（0、189、空、`abc`、`1e9`）一律夹到 1–188 或直接忽略，不许抛异常、不许白屏。
- 孩子看得见的地方不写「root」「高权限」这类吓人词，按钮就叫「管理员权限」「直达第 N 关」。

## 红线自查

- 密码**绝不**写进 `localStorage` / `sessionStorage` / `cookie` / URL；落盘的只有 `{ expiresAt }`。
- 弹窗上必须有这句原话：**要打开请联系管理员 18438037080**。
- 密码连错 3 次锁 120 秒，锁定期间输入框与确认键禁用并显示倒计时；沿用现有 `dialog--shake` 抖动反馈。
- 时钟必须可注入（函数参数或模块级 `now()`），测试里用假时钟，**不许真 `setTimeout` 等 120 秒**。
- 不改 `src/ui/parentAuth.ts` / `parentGate.ts`（算术门原样保留），不改 `src/styles.css`（B 的文件），不改 `src/ui/home.ts`（B 的文件）。
- 不引入任何外部依赖；`destroy` / 弹窗关闭要清干净监听与定时器。

## 验收

- `npm test` 全绿且用例只增不减；`npm run build` 全绿。
- `root12Contract.test.ts` ≥ 12 例，`rootGate.test.ts` ≥ 20 例，`level99.test.ts` 新增 ≥ 8 例，`quiz99.test.ts` 新增 ≥ 4 例。
- 冒烟：密码对 → 直达第 188 关能开打；手动关 → 控件消失；假时钟推进 1 小时 → 控件消失且 `localStorage` 里的记录被清掉。

---

## 完整派发提示词（整段复制给子代理）

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）。这是 1.2 版本的**第 1 步（共 30 步）**，你是 **A 档**。

## 分支纪律（先做这一步）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上：`git checkout -B <你的工作分支> origin/game-1.2`。
- 开工前先提交一条 git 记录（写上「1.2 第 1 步 / A · root 管理员门」和你的工作计划），再动代码。
- 全部工作推 `game-1.2`。不要改 main、不要合并回 main、不要用 gh 开或合 PR（gh 只读，只用来看 CI 日志）。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase 重来，**禁止 force push**。

## 你是谁
A：实现 **root 管理员门**，并让 188 关框架与答题壳在门打开时能「直达第 N 关」。
同一步 B 在做首页手游/端游筛选与手机文字，C 在做模式口径与 2.5D 基建。**别人的文件一个字都别动。**

## 独占文件（只许改这些）
- 新建 `src/ui/root12Contract.ts`、`src/ui/root12Contract.test.ts`
- 新建 `src/ui/rootGate.ts`、`src/ui/rootGate.test.ts`
- `src/games/level99.ts`、`src/games/level99.test.ts`
- `src/games/quiz99.ts`、`src/games/quiz99.test.ts`

明确不许碰：`src/ui/home.ts`、`src/styles.css`、`index.html`、`src/engine/types.ts`（都是 B 的）；
`src/engine/playModes.ts`、`src/engine/view25d.ts`（C 的）；
`src/ui/parentAuth.ts`、`src/ui/parentGate.ts`、`src/ui/gameShell.ts`（1.1 的算术家长门，本步原样保留）；
任何 `src/games/<某款游戏>/` 目录。

## 产品规定（逐字实现，这是用户点名要的）
- 默认密码：`kangkang`（用契约里的 `ROOT_DEFAULT_PASSWORD` 常量，不要再抄一份不同的字符串）。
- 弹窗上必须有这句原话：**「要打开请联系管理员 18438037080」**。
- 打开后能做什么：任意跳关；选关地图出现「直达第 N 关」（1–188）；可以直接进还没解锁的关。
- **可以关闭**：弹窗里和家长面板旁边都要有「关闭管理员权限」，按下立刻失效。
- **1 小时默认关闭**：`expiresAt = Date.now() + ROOT_TTL_MS`（3600000）。每次判定都拿当前时间比，过期就当关闭并把存档记录删掉。
- 存档只写 `yiduo-yixing.root.v1` = `{ expiresAt: number }`。**密码绝不写进 localStorage / sessionStorage / cookie / URL。**
- 1.1 的算术家长门 `src/ui/parentAuth.ts` **一个字都不改**。root 开着时，跳关与直达**不必再做算术题**；root 关着时，跳关继续走原来的 `getLevelExtras().requestSkip`（`gameShell.ts` 里已接到 `requestParentAuth("high")`）。
- 防暴力：密码连错 3 次锁 120 秒，锁定期间输入框与确认键禁用并显示倒计时；输入框 `type="password"`；沿用现有 `dialog--shake`。
- 孩子界面不要出现「root」「高权限」这类吓人词，按钮文案用「管理员权限」。

## 1）新建 `src/ui/root12Contract.ts`（逐字照抄下面这份）
这份文件是 1.2 的公共契约，其它档以后也会 import 它。**内容以本提示词为准，不要自己发挥改名字。**
（会话逻辑放在契约里而不是 rootGate 里，是为了让 `level99.ts` 判断「门开没开」时不用加载弹窗 UI，避免把 dialog 代码拖进每个游戏的 chunk。）

```ts
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
```

## 2）新建 `src/ui/rootGate.ts`
只管「怎么问密码」，会话读写一律调契约里的函数。导出：

- `requestRootOpen(reason: string): Promise<boolean>` —— 弹窗：说明文字（含 reason）+ `type="password"` 输入框 + 「打开」+「不打开」+（已打开时）「关闭管理员权限」+ 那句管理员电话。密码对 → `writeRootSession(now + ROOT_TTL_MS)` → resolve(true)。
- `closeRoot(): void` —— 调 `clearRootSession()`，并把已挂着的倒计时清掉。
- `rootStatusText(nowMs?): string` —— 给家长面板显示「管理员权限已开，还剩 43 分钟」/「管理员权限已关闭」，六年级语气，别写吓人词。
- `resetRootGate(): void` —— 仅测试用，清锁定计数与会话。
- 模块加载时执行 `registerRoot12Extras({ requestRootOpen, closeRoot })`。

实现要点：
- 复用现有 `src/ui/dialogs.ts` 的 `showDialog`，不要自己造一套弹窗；不要改 `dialogs.ts` 本身。
- 锁定状态用模块内变量（错误次数、解锁时间戳）；时钟必须可注入（给这些函数一个可选 `nowMs` 参数或模块级可替换的 `now()`），**测试里用假时钟，不许真等 120 秒**。
- 若必须加样式，在本文件里注入带固定 id 的 `<style>`，重复调用不重复插入。**不要改 `src/styles.css`**（那是 B 的文件）。
- 弹窗关闭时清干净事件监听与倒计时定时器。

## 3）改 `src/games/level99.ts`
现状：`mountLevelGame` 里的 `attachSkip()` 通过 `getLevelExtras().requestSkip` 挂「跳过本关」按钮；`getLevelExtras()` 没注册就不显示。照这个套路加直达：

1. `import { isRootOpen, getRoot12Extras } from "../ui/root12Contract";`（契约无 UI 依赖，可以静态 import）。
2. 新增 `attachRootJump(host, curLevel, after)`：`isRootOpen()` 为 false 时**直接 return，不生成任何 DOM**；为 true 时生成
   `<input type="number" min="1" max="188">` + 「直达」按钮 + 一行小字「管理员权限还剩 XX 分钟」。
3. 选关地图顶部与关内暂停菜单各挂一个。
4. 直达行为：把当前关设为 `clamp(输入 - 1, 0, total - 1)` 并立即可开打，**不写任何星级、不写跳关标记**。没打过就是 0 星。
5. root 开着时，原来的「跳过本关」按钮**不再请求算术门**：直接 `markSkipped` 并解锁下一关（按钮文案可以加「（管理员）」提示）；root 关着时行为与 1.1 完全一致。
6. 非法输入（空、0、189、`abc`、`1e9`、负数）夹到 1–188 或忽略，绝不抛异常、绝不白屏。
7. 不改存档 key 语义（`yiduo-yixing.l99.<id>` / `yiduo-yixing.l99skip.<id>`），不改 `TOTAL_LEVELS = 188`，不改已有关卡地图分页与 `mapColumns` 行为。

## 4）改 `src/games/quiz99.ts`
同样接契约：root 开着时允许直接跳到任意题号；关着时保持 1.1 行为，控件不渲染。答错文案继续只鼓励不批评。

## 5）测试
- `src/ui/root12Contract.test.ts` **≥ 12 例**：常量值（TTL 3600000、电话、密码、key）、正常会话有效、`now >= expiresAt` 判过期并清存档、坏 JSON、`expiresAt` 不是数字、`NaN` / `Infinity`、`localStorage` 抛异常时降级到内存且仍然 1 小时过期、`clearRootSession` 后 `isRootOpen` 为 false、`rootRemainMs` 单调递减、未注册 extras 时 `getRoot12Extras()` 返回空对象不报错。
- `src/ui/rootGate.test.ts` **≥ 20 例**（全部用假时钟）：密码对就打开、密码错不打开、连错 3 次锁定 120 秒且输入禁用、锁定期满可再试、手动关闭立刻失效、1 小时后自动关、弹窗 DOM 里能查到字符串 `18438037080`、输入框 `type` 是 `password`、**`localStorage` 里搜不到 `kangkang`**（这条必须有）、`rootStatusText` 不含「root」字样也不含商标词、弹窗关闭后没有残留监听 / 定时器。
- `src/games/level99.test.ts` **新增 ≥ 8 例**：root 关时地图里查不到直达控件；root 开时能直达第 188 关；直达后星级数组仍是 0 且其它关星级不变；直达越界输入被夹住；假时钟推进 1 小时后控件消失；root 开时跳关不调用 `requestSkip`；root 关时跳关仍走 `requestSkip`；`TOTAL_LEVELS` 仍是 188。
- `src/games/quiz99.test.ts` **新增 ≥ 4 例**：同类行为。

## 验收
- `npm test` 全绿，用例总数只增不减；`npm run build` 全绿（tsc 无错）。
- 不引入任何外部运行时依赖；不改 `yiduo-yixing.save.v1` 等既有存档 key 的语义。
- 面向孩子的文案与**代码注释**里没有任何商业商标或官方角色名；失败 / 拒绝文案只鼓励不批评。
- 没有越界改 B / C 的文件（`git diff --name-only origin/game-1.2...HEAD` 自己核一遍）。
- 不要做 B 的筛选与手机文字，不要做 C 的 2.5D，不要新建任何游戏目录。

完成后回复：你是 A、改了哪些文件、各文件新增用例数与总用例数、推到 `origin/game-1.2` 的 SHA、以及**实际使用的模型 slug**。
~~~~
