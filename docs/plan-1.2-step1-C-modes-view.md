# 1.2 第 1 步 · C 档 —— 闯关 / 对战 / 无尽统一口径 + 2.5D 共享基建（接 1.1 第 6 步）

> 本文件只记录第 1 步 C 档的开工计划与**可整段复制的派发提示词**，不涉及 A / B 档的文件。
> 主管文档：[`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) · 登记表：[`plan-1.2-tracker.md`](./plan-1.2-tracker.md) · 目录：[`plan-1.2-index.md`](./plan-1.2-index.md)
> 同步进行：[A 档 · root 管理员门](./plan-1.2-step1-A-root-gate.md)、[B 档 · 手游/端游筛选](./plan-1.2-step1-B-platform-filter.md)。

## 目标

做两块**以后 76 款游戏都能 import 的共享基础设施**，本步一款游戏都不改：

1. `src/engine/playModes.ts` —— 「能闯关吗？能对战吗？能无尽吗？」的统一口径。
2. `src/engine/view25d.ts` —— 2.5D / 伪 3D 的透视数学，从 1.1 第 6 步的两份实现里抽出来。

## 一、为什么要统一模式口径

1.1 起 `GameMeta.modes` 已经存在（`campaign` / `versus` / `endless` / `coop` / `twoPlayer`），首页玩法芯片按它筛。
但**游戏内部**没有统一说法：有的游戏菜单写「单人 / 双人」，有的写「闯关 / 挑战」，有的干脆没菜单；
`meta.modes` 与实际做出来的模式对不对得上，全靠人肉记。1.2 有 18 个升级步要逐款加模式，
必须先有一个共同口径，否则 18 个子代理会发明 18 套菜单。

这一步只提供**纯函数工具**，不去改任何游戏的菜单 —— 升级步会来 `import` 它。

## 二、为什么 2.5D 要抽成引擎模块（接 1.1 第 6 步）

1.1 第 6 步已经做过两份伪 3D，都在游戏目录里，互相抄了一遍：

| 文件（`origin/game-1.1`） | 里面已有的东西 |
| --- | --- |
| `src/games/rainbow-run/view3d.ts` | `HORIZON_RATIO`、`CAM_DEPTH_RATIO`、`MAX_SCALE` / `MIN_SCALE`、`makeCamera`、`depthOf`、`scaleAtDepth`、`screenYAtDepth`、`projectTrack`、`groundGridDepths`、`fogAlpha`、`ParallaxLayer` |
| `src/games/duo-rush/view25d.ts` | 分屏 `splitLayout` / `stageSize` / `paneRects`，加上另一套 `depthScale`、`project`、`horizonY`、`groundY`、`fogAlpha` |

两套常量名字像、语义不完全一样，再来第三、第四款（`pool-stars` 桌球俯视透视、`bowling-lane` 球道、
卡丁类跑道）就会变成四套。本步把**可复用的数学**收进 `src/engine/view25d.ts`，
以后 `rainbow-run`（第 10 步 A）和 `duo-rush`（第 15 步 A）在自己的升级步里改成 import 引擎版本 —— **本步不许去改它们**。

> 前提：主管已经做完「步 0 · 对齐基线」，`origin/game-1.1` 已经合进 `game-1.2`，上面两个文件在你的工作区里能看到。
> 如果看不到，先停下来告诉主管，不要自己去把 1.1 的代码抄一遍。

**禁止引入 three.js 或任何 3D 库。** 这是离线 PWA，2.5D 只能用 Canvas 2D + 数学，或 CSS transform。

## 文件切分

| 文件 | 职责 |
| --- | --- |
| `src/engine/playModes.ts`（新建） | 模式兼容矩阵、菜单口径、中文描述句 |
| `src/engine/playModes.test.ts`（新建） | ≥ 16 例 |
| `src/engine/view25d.ts`（新建） | 相机、投影、路面梯形、雾化、`prefers-reduced-motion` 降级 |
| `src/engine/view25d.test.ts`（新建） | ≥ 18 例 |

## 红线自查

- 纯函数优先，不碰 DOM（唯一例外：可选的 `installView25dCss()` 注入一次 CSS 变量，带固定 id，重复调用不重复插入）。
- 不改 `src/engine/types.ts`（B 的文件，`GameMode` 已经在里面了，你只 import 类型）。
- 不改 `src/styles.css`、`src/ui/home.ts`、`src/games/level99.ts`、`src/games/quiz99.ts`。
- 不改 `rainbow-run` / `duo-rush` 的现有渲染（那是第 10 步 A 与第 15 步 A 的活）。
- 不新建演示页面 `/demo`，不加外部依赖，注释里不许出现商业商标或某个 3D 引擎的名字。
- 极端参数（`fov` 为 0 或 180、视口宽高为 0、`z` 为负、`NaN`）不许返回 `NaN`、不许抛异常。

## 验收

- `npm test` 全绿且只增不减；`npm run build` 全绿。
- 两个模块可以被任何游戏直接 import，无循环依赖，零外部运行时依赖。
- `playModes.test.ts` ≥ 16 例，`view25d.test.ts` ≥ 18 例。

---

## 完整派发提示词（整段复制给子代理）

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）。这是 1.2 版本的**第 1 步（共 30 步）**，你是 **C 档**。

## 分支纪律（先做这一步）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上：`git checkout -B <你的工作分支> origin/game-1.2`。
- 开工前先提交一条 git 记录（写上「1.2 第 1 步 / C · playModes 与 view25d」和你的工作计划），再动代码。
- 全部工作推 `game-1.2`。不要改 main、不要合并回 main、不要用 gh 开或合 PR。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase 重来，**禁止 force push**。

## 你是谁
C：做两块**以后 76 款游戏都会 import 的共享基建**。本步**一款游戏都不改**。
同一步 A 在做 root 管理员门，B 在做首页手游/端游筛选与手机文字。**别人的文件一个字都别动。**

## 独占文件（只许新建这四个）
- `src/engine/playModes.ts`、`src/engine/playModes.test.ts`
- `src/engine/view25d.ts`、`src/engine/view25d.test.ts`

明确不许碰：`src/engine/types.ts`（B 的，`GameMode` 已在里面，你只 import 类型）；
`src/ui/home.ts`、`src/styles.css`、`index.html`（B 的）；
`src/ui/rootGate.ts`、`src/ui/root12Contract.ts`、`src/games/level99.ts`、`src/games/quiz99.ts`（A 的）；
任何 `src/games/<某款游戏>/` 目录 —— 特别是 `rainbow-run` 和 `duo-rush`，它们改用引擎版本是第 10 步与第 15 步的活。

## 1）`src/engine/playModes.ts` —— 闯关 / 对战 / 无尽的统一口径

背景：`GameMeta.modes` 已有五种取值 `campaign | versus | endless | coop | twoPlayer`（见 `src/engine/types.ts`），
首页玩法芯片按它筛。但游戏内部菜单各写各的。1.2 有 18 个升级步要逐款补模式，先把口径定下来，避免 18 个人发明 18 套菜单。

至少导出：

- `type ModeKind = "campaign" | "versus" | "endless"` —— 三大类。双人同屏 / 双人合作都归到 `versus` 下面，用 `versusKind: "ai" | "hotseat" | "coop"` 细分。
- `interface ModeCompat { campaign: boolean; versus: boolean; endless: boolean; reason?: Partial<Record<ModeKind, string>> }`
- `compatFromMeta(meta: Pick<GameMeta, "modes" | "levels">): ModeCompat` —— 从已有 `modes` 推导：
  含 `campaign` → campaign 为真；含 `versus` / `twoPlayer` / `coop` → versus 为真；含 `endless` → endless 为真。
  `modes` 没填或为空数组时三者都 false，并在 `reason` 里写「升级步要补 modes」。
- `assertModeMenu(compat: ModeCompat, requested: ModeKind): boolean` —— 请求了不支持的模式返回 false，**不许抛异常**。
- `pickInitialMode(compat: ModeCompat, want?: ModeKind): ModeKind` —— `want` 合法就用它，否则按 `campaign > versus > endless` 取第一个为真的；全 false 时返回 `"campaign"` 作为兜底（并且不许抛）。
- `describeModes(compat: ModeCompat): string` —— 给攻略侧栏 / 暂停菜单用的一句中文，例如「可以闯关，也可以两个人对战；这款没有无尽模式」。
  语气面向约小学六年级：不低幼（不写「宝宝」「乖乖」），也不要生硬。

要求：
- 全是纯函数，不碰 DOM，不 import 任何 UI 或玩法代码；只从 `../engine/types` import 类型。
- `playModes.test.ts` **≥ 16 例**：覆盖有/无 campaign、只有 versus、只有 endless、`modes` 为 `undefined`、为空数组、
  含 `twoPlayer` 但不含 `versus`、含 `coop`、`assertModeMenu` 请求不支持的模式、`pickInitialMode` 的四种分支、
  以及一条**文案巡检**用例：`describeModes` 的输出不含低幼词与商标词（用一个小黑名单数组，例如 `/宝宝|乖乖|小笨蛋|Tetris|拳皇|超级玛丽/`）。

**本步不要**去改任何游戏的菜单，也不要去改 50 多个 `meta.ts`。工具放好就行，升级步会来 import。

## 2）`src/engine/view25d.ts` —— 2.5D / 伪 3D 共享数学（接 1.1 第 6 步）

1.1 第 6 步已经在两个游戏里各写过一份伪 3D，**先把它们读一遍**再动手：

- `src/games/rainbow-run/view3d.ts`：`HORIZON_RATIO`、`CAM_DEPTH_RATIO`、`MAX_SCALE` / `MIN_SCALE`、`LANE_SPREAD`、
  `makeCamera`、`depthOf`、`scaleAtDepth`、`screenYAtDepth`、`projectTrack`、`groundGridDepths`、`fogAlpha`、`ParallaxLayer`。
- `src/games/duo-rush/view25d.ts`：分屏 `splitLayout` / `stageSize` / `paneRects`，另一套 `depthScale`、`project`、`horizonY`、`groundY`、`fogAlpha`。

你的活是把**可复用的透视数学**收进引擎模块（分屏那部分是 duo-rush 自己的排版逻辑，不用搬）。
**禁止引入 three.js 或任何 3D 库**，只能 Canvas 2D + 数学，或 CSS transform。

至少导出：

```ts
export interface View25dCamera {
  kind: "flat" | "perspective";
  /** 视场角,度 */
  fov: number;
  /** 地平线在画布高度上的比例 0–1 */
  horizon: number;
  cameraY: number;
  cameraZ: number;
}

export function defaultCamera(kind?: View25dCamera["kind"]): View25dCamera;

/** 世界 (x, y, z) → 画布像素。y 向上,z 向前(越大越远) */
export function project(
  cam: View25dCamera, x: number, y: number, z: number, viewW: number, viewH: number
): { x: number; y: number; scale: number; visible: boolean };

/** 一段沿 z 轴的路面梯形,给跑酷 / 卡丁 / 球道画地面;不可见时返回 null */
export function roadQuad(
  cam: View25dCamera, z0: number, z1: number, halfWidth: number, viewW: number, viewH: number
): [number, number][] | null;

/** 远处雾化透明度,越远越淡 */
export function fogAlpha(scale: number, maxAlpha?: number): number;

/** 地面网格线的深度序列,给滚动地面用 */
export function groundGridDepths(scroll: number, spacing: number, maxDepth: number): number[];

/** prefers-reduced-motion 时降级成 flat:project 变正交,scale 恒为 1 */
export function respectReducedMotion(cam: View25dCamera, reduced: boolean): View25dCamera;
```

要求：
- 纯函数，不碰 DOM。唯一例外：可选的 `installView25dCss()` 注入一次 CSS 变量，`<style>` 带固定 id，重复调用不重复插入。
- `z` 越大 `scale` 越小；相机后面的点 `visible` 为 false。
- 极端输入不许炸：`fov` 为 0 或 180、`viewW` / `viewH` 为 0、`z` 为负、传进 `NaN` —— 都要给出有限数值或 `visible: false`，**不许返回 NaN、不许抛异常**。
- 文件头注释写清楚：这是「透视投影数学」，自己实现的，**注释里不许出现任何商业 3D 引擎或游戏商标的名字**。
- `view25d.test.ts` **≥ 18 例**：原点投影落在地平线附近、远处 scale 小于近处、`flat` 模式 scale 恒为 1、
  `respectReducedMotion` 生效、`roadQuad` 在相机后面返回 null、`roadQuad` 返回四个点且上边窄于下边、
  `fogAlpha` 单调且被 `maxAlpha` 夹住、`groundGridDepths` 递增且不超过 `maxDepth`、极端 fov 不 NaN、
  视口宽高为 0 时不抛。

## 不要做什么
- ❌ 改 `rainbow-run` / `duo-rush` 的现有渲染（第 10 步 A / 第 15 步 A 会来 import 你的函数）。
- ❌ 实现任何新游戏、改任何 `meta.ts`。
- ❌ 做 A 的 root 门、做 B 的首页筛选与 CSS。
- ❌ 引入 three.js、CDN 资源、任何外部运行时依赖。
- ❌ 新建 `/demo` 演示页面。
- ❌ 删测试、调低断言。

## 验收
- `npm test` 全绿，用例总数只增不减；`npm run build` 全绿（tsc 无错）。
- 两个模块可被任意游戏直接 import，无循环依赖，零外部运行时依赖。
- `git diff --name-only origin/game-1.2...HEAD` 只出现你的四个新文件。

完成后回复：你是 C、新建了哪些文件、各文件用例数与总用例数、推到 `origin/game-1.2` 的 SHA、以及**实际使用的模型 slug**。
~~~~
