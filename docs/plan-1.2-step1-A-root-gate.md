# 1.2 第 1 步 · A 档工作计划 —— root 高权限门

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 **1.2 版本第 1 步 / 共 30 步** 的 **A 档**。主管总则：`docs/plan-1.2-supervisor.md`。派发前先在 `docs/plan-1.2-tracker.md` 把 `1-A` 登记成进行中。

---

## 分支纪律（先做这一步）

- `git fetch origin game-1.2`，从 `origin/game-1.2` 拉工作分支。
- **开工前先提交一条 git 记录**（写上「1.2 第 1 步 A · root 门」工作计划），再改代码。
- 全部工作推 **`game-1.2`**，不要改 `main`，不要 merge 进 `main`，不要 force，不要用 `gh` 开/改/合 PR。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。
- 若 `origin/game-1.2` 还没有 `origin/game-1.1` @ `8867138` 的 55 款（缺 `bumper-cars`、缺 `src/games/rainbow-run/view3d.ts` 就是没合上），**先把该点合入 `game-1.2` 再开工**（仍禁止 force）。本档假设 1.1 已经做完。

---

## 本档目标

给家长 / 管理员一条**比 1.1 `parentAuth("high")` 更高**的会话：密码默认 `kangkang`，打开后一小时内可以**任意跳关、直达第 N 关**，可手动关掉，一小时到点自动关。孩子看见的文案是「打开请联系管理员 18438037080」，**界面上永远不要出现密码明文**。

**不许再发明一套和 1.1 打架的门。** 1.1 已经有：

| 能力 | 落点 | 你必须怎么接 |
| --- | --- | --- |
| 家长算术门 `basic` / `high` | `src/ui/parentAuth.ts` | 原样保留。单关「跳过」在 root **关闭**时仍走 `requestParentAuth("high")` |
| 5 分钟内存授权 | `AUTH_TTL_MS`，不写 localStorage | root 会话同样只存内存，TTL 改成 **1 小时**，不要复用 5 分钟常量把家长门变长 |
| 跳关存档 | `yiduo-yixing.l99skip.<id>`，`loadSkips` / `markSkipped` / `furthestPlayable`（`src/games/level99.ts`） | 直达第 N 关 = 对 `0 .. N-2` 里还没星、还没跳过的关调用 `markSkipped`，**不许写假星星**进 `yiduo-yixing.l99.<id>` |
| 跳关按钮 | `getLevelExtras().requestSkip` ← `gameShell.requestSkip` | `requestSkip` **先问 root 开没开**：开了直接 `true`；没开再动态 import `parentAuth` 走 high 档 |
| 家长面板 | `src/ui/parentGate.ts` | root 的开关 / 密码框只放在这里（已经过 `basic`），不要做首页常驻大按钮 |

读完再写：`src/ui/parentAuth.ts`、`src/ui/parentGate.ts`、`src/ui/gameShell.ts` 的 `requestSkip`、`src/games/level99.ts` 的 `attachSkip` / `furthestPlayable` / `markSkipped`、`src/ui/level188Contract.ts`。

---

## 独占文件（只许这些，B/C 的文件一个字别动）

| 文件 | 职责 |
| --- | --- |
| `src/ui/rootGate.ts` | **新建**。root 会话：密码、TTL、开关、`isRootOpen` / `unlockRoot` / `lockRoot` / `remainingMs` |
| `src/ui/rootGate.test.ts` | **新建**。假时钟，禁止真 `sleep` |
| `src/ui/level188Contract.ts` | 给 `LevelExtras` 增加可选 `requestJumpTo`（以及如需的 `isRootOpen` 探测）。**不要拆掉**已有的 `mountGuide` / `requestSkip` / `registerLevelExtras` |
| `src/games/level99.ts` | 选关地图增加「直达第 N 关」；`attachSkip` 行为保持「只有 requestSkip 放行才 `markSkipped`」 |
| `src/games/level99.test.ts` | 直达、跳关与星星互不污染、root 关闭时直达入口隐藏 |
| `src/ui/gameShell.ts` | `requestSkip` 先 root 后 high；注册 `requestJumpTo` |
| `src/ui/parentGate.ts` | 家长面板加「管理员通道」一段 |

**不要动：** `src/ui/home.ts`、`src/ui/homeFilters.ts`、`src/engine/types.ts`、`src/styles.css`、`src/engine/collection.ts`、`src/games/rainbow-run/**`、任何一款游戏的关卡表。样式用 `rootGate.ts` / `parentGate.ts` 自己注入带前缀的 `<style>`（学 `home.ts` 的 `HOME_EXTRA_CSS`），避免和 B 抢 `styles.css`。

---

## 模块约定（按这个写，测试才好写）

### `src/ui/rootGate.ts`

```ts
export const DEFAULT_ROOT_PASSWORD = "kangkang";
export const ROOT_TTL_MS = 60 * 60 * 1000; // 一小时
export const ROOT_MAX_WRONG = 2;
export const ROOT_LOCK_MS = 90_000;

export function isRootOpen(now?: number): boolean;
/** 关闭会话。可关。 */
export function lockRoot(): void;
/**
 * 尝试打开。密码对且未锁才开，成功后 TTL 从 now 起算 1 小时。
 * 界面文案由调用方写「打开请联系管理员 18438037080」，本模块不返回密码。
 */
export function unlockRoot(password: string, now?: number): "opened" | "wrong" | "locked" | "disabled";
export function remainingMs(now?: number): number;
/** 总开关：关掉以后 unlock 一律 disabled，直到 enableRootFeature()。默认启用功能、关闭会话。 */
export function disableRootFeature(): void;
export function enableRootFeature(): void;
export function isRootFeatureEnabled(): boolean;
/** 仅测试：重置内存 */
export function resetRootGate(): void;
```

硬规则：

1. 会话、密码比对、功能开关、错误次数 **全部只在模块内存**。`localStorage` 里不许出现 `kangkang`、不许出现 `root` 会话时间戳、不许出现「已授权」痕迹。刷新页面 = 会话消失 = 相当于关。
2. 默认密码 `kangkang`。允许测试注入 `setRootPasswordForTest`，生产 UI 没有改密入口（改密不在本步）。
3. 一小时用注入的 `now`（和 `parentAuth` 一样方便假时钟）。到期后 `isRootOpen` 为 false，不必等有人点关。
4. 答错 2 次锁 90 秒，期间 `unlockRoot` 返回 `"locked"`。不要去改 `parentAuth.ts` 的锁；两套锁独立。
5. `disableRootFeature()` 之后即使密码对也对打不开，直到 `enableRootFeature()`。家长面板上要有「关闭管理员通道」按钮。
6. **不要**把 root 做成第二个 `AuthLevel`。不要改 `requestParentAuth` 的签名。

管理员电话只出现在 UI 字符串：`打开请联系管理员 18438037080`。不要写进存档，不要当密码。

### `src/ui/level188Contract.ts`

在 `LevelExtras` 上追加，保持可选：

```ts
  /**
   * 直达第 N 关（0 基）。resolve(true) 后框架才 markSkipped 并跳转。
   * 未注册或 root 关闭时选关地图不渲染直达控件。
   */
  requestJumpTo?: (gameId: string, level: number) => Promise<boolean>;
```

`registerLevelExtras` 仍是浅合并。`resetLevelExtras` 行为不变。

### `src/ui/gameShell.ts`

现有 `requestSkip` 改成：

1. 动态 import `./rootGate`（学现有 `parentAuth` 的 `import.meta.glob`，文件不在时不能让构建炸掉）。
2. `isRootOpen()` 为 true → 直接 `true`（不再弹算术题）。
3. 否则保持今天的逻辑：`requestParentAuth("high", skipReason(...))`。
4. 新增 `requestJumpTo(gameId, level)`：只有 `isRootOpen()` 才返回 true；否则 false。不要为直达再弹一次 high 档——直达是管理员能力，没开 root 就没有这个按钮。
5. `registerLevelExtras({ mountGuide, requestSkip, requestJumpTo })`。`mountGuide` 原样保留。

### `src/games/level99.ts`

1. **保留** `attachSkip`。文案仍是需要家长确认；root 打开时点下去会立刻成功（因为 `requestSkip` 已放行），不要单独做一套「管理员跳过」按钮，以免孩子看见两个跳关。
2. **新增**直达控件，仅当 `getLevelExtras().requestJumpTo` 存在时渲染（root 关闭时 gameShell 仍可注册该函数，但函数返回 false——更好的做法：`requestJumpTo` 内部判断 root，地图用 `getLevelExtras().requestJumpTo` 是否存在来决定画不画；若你选择「始终注册、root 关则隐藏」，就在 `rootGate.isRootOpen()` 为 false 时不画。推荐：地图侧动态 import 会把 level99 和 UI 缠死，**不要在 level99 里 import rootGate**。用契约函数返回值 + 一个可选 `LevelExtras.rootJumpAvailable?: () => boolean`，或让 `requestJumpTo` 未开 root 时仍注册但地图先调一个纯探测。最干净：契约加 `canJumpTo?: () => boolean`，gameShell 注册为 `() => isRootOpen()`。选关地图 `canJumpTo?.() === true` 才画直达）。
3. 直达 UI：数字输入（1 基，范围 1..total）+ 按钮「直达这一关」。确认后：
   - `level = N - 1`（转 0 基）
   - `await requestJumpTo(id, level)`，false 则什么都不写
   - true 则对所有 `i < level`，若 `stars[i] === 0 && !isSkipped(skips, i)`，调用 `markSkipped(id, i)`
   - 然后 `showMap` 或直接 `playLevel(level)`（推荐直接进入第 N 关，失败仍可回地图）
   - **不要** `saveStar(..., 3)` 伪造通关
4. 跳过的关继续用灰色旗子，和真三星区分（1.1 已有，不许打坏）。
5. `quiz99.ts` **本档不要改**（独占表里没有它）。若直达也要覆盖答题壳，留给后续，不要越界。

### `src/ui/parentGate.ts`

在现有「跳关记录」附近加「管理员通道」：

- 说明：「打开请联系管理员 18438037080」
- 密码输入（`type="password"`），确认开启
- 显示剩余时间（开着的时候）
- 按钮：开启 / 关闭会话 / 关闭管理员通道（功能开关）
- 错误与锁定提示学现有 `dialog--shake`
- **不要**改说明 / 清空进度 / 导出 / 导入的既有文案
- **不要**动 `save.ts`

---

## 测试（`rootGate.test.ts` ≥ 18；`level99.test.ts` 本步新增 ≥ 12）

必须覆盖：

1. 默认密码 `kangkang` 能打开；错密码不能；打开后 `isRootOpen` 为 true
2. 假时钟 + 1 小时后自动关；59 分 59 秒仍开
3. `lockRoot` 立刻关；`disableRootFeature` 后对密码也打不开
4. 错 2 次锁定 90 秒，假时钟走完解锁
5. 内存不落盘：对假 `localStorage` 写入侦听器，unlock 前后 key 集合不变
6. `requestSkip` 在 root 开时不调用 `requestParentAuth`（给 parentAuth 插桩）
7. 直达第 10 关：`l99skip` 含 0..8 中原先未通关的关，`l99` 星级数组前 10 位凡是 0 的仍是 0
8. 直达越界（0、total+1）拒绝且不写存档
9. root 关闭时选关地图没有直达控件（jsdom 挂 `mountLevelGame`）
10. 老存档长度 99 的星星读出来仍补到 188，直达不打乱前 99 位已有星星

用假时钟，不要真 `sleep`。只增测试不删测试、不调低断言。

---

## 验收

- `npm test` 全绿且用例只增不减；`npm run build` 全绿（tsc 无错）。
- 手动冒烟：`npm run build && npx vite preview`
  - 进任意 188 关游戏，root 关：跳关仍弹 high 档算术，直达控件不可见
  - 打开家长面板（basic 乘法）→ 管理员通道 → 密码 `kangkang` → 回到选关地图出现直达 → 输入 128 → 进入第 128 关，地图上 1–127 未打过的是灰旗不是三星
  - 等不了一小时：单测已用假时钟覆盖 TTL；手动把 TTL 在 dev 临时改短验证后必须改回 1 小时再提交
  - 点关闭会话后直达消失，跳关重新要算术
- 不改存档 key 语义；不把密码写入 localStorage。
- 面向孩子的文案无商标；管理员电话只出现这一处说明。
- 完成后回复：改了哪些文件、新增用例数、推送 SHA、**实际使用的模型 slug**。

---

## 不要做什么

- ❌ 不要再派生云端子代理
- ❌ 不要改 `main`、不要 force、不要用 `gh` 写 PR
- ❌ 不要改 `src/ui/home.ts` / `homeFilters.ts` / `types.ts` / `styles.css`（B 的）
- ❌ 不要改 `src/engine/collection.ts`、不要抽 2.5D（C 的）
- ❌ 不要把 root 授权写进 `yiduo-yixing.save.v1`
- ❌ 不要在首页放「管理员」大按钮
- ❌ 不要在 UI 上展示 `kangkang`
- ❌ 不要删除 1.1 的 high 档跳关
