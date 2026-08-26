# 1.2 第 1 步 · B 档 —— 手游 / 端游筛选 + 手机文字（360px 硬验收）

> 本文件只记录第 1 步 B 档的开工计划与**可整段复制的派发提示词**，不涉及 A / C 档的文件。
> 主管文档：[`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) · 登记表：[`plan-1.2-tracker.md`](./plan-1.2-tracker.md) · 目录：[`plan-1.2-index.md`](./plan-1.2-index.md)
> 同步进行：[A 档 · root 管理员门](./plan-1.2-step1-A-root-gate.md)、[C 档 · 模式与 2.5D](./plan-1.2-step1-C-modes-view.md)。

## 目标

两件事，都属于「平台能力」，本步不碰任何一款游戏的玩法：

1. **手游 / 端游**：`GameMeta` 加 `platform` 字段，首页多一排芯片，能和已有的分类页签、玩法芯片（闯关 / 对战 / 无尽 / 双人）、搜索自由组合。
2. **手机文字**：把「在 360px 宽的手机上，字看得清、不溢出、不贴 Home 条」变成一组**可单测的常量与规则**，而不是靠肉眼调。

顺带在首页放一个不显眼的「管理员权限」入口（A 档做的 root 门），用**懒加载**接，A 还没合进来也不能让首页崩。

## 为什么要分「手游 / 端游」

这个合集同时跑在手机 PWA、平板、桌面浏览器和 Electron 壳里。有些游戏天生适合手指（点、划、拖），
有些天生适合键盘（双人同屏 `WASD` vs 方向键、需要精确微调的射击）。1.1 的玩法芯片答不了「我现在拿着手机，玩哪个顺手」，
所以 1.2 补一个平台维度：

| `platform` | 含义 | 典型 |
| --- | --- | --- |
| `"mobile"` | 手指玩最顺，键盘可能没有等价操作 | 点消、滑动合并、拖拽拼图 |
| `"desktop"` | 需要键盘 / 鼠标精度，手机上勉强 | 同屏双人格斗、需要微调准星的射击 |
| `"both"` | 两边都顺手（**缺省值**） | 绝大多数 |

**本步不填那 55 个 `meta.ts`**（那是第 27 步 B 的活）。本步只把类型、缺省语义、筛选函数和 UI 做对：
读到 `undefined` 一律当 `"both"`，所以老游戏在「手游」和「端游」两个筛选下都能被找到，不会有游戏因此消失。

## 文件切分

| 文件 | 职责 |
| --- | --- |
| `src/engine/types.ts` | 加 `GamePlatform` 类型、`GameMeta.platform?`、`GAME_PLATFORMS` 常量、缺省语义写进注释 |
| `src/ui/homeFilters.ts` | `PlatformChip` / `PLATFORM_CHIPS` / `matchesPlatformChip`，`HomeFilter` 加一维，`filterGames`、`isFiltering`、`emptyStateText` 同步 |
| `src/ui/homeFilters.test.ts` | 平台芯片用例（≥ 8） |
| `src/ui/home.ts` | 画平台芯片；「管理员权限」入口（懒加载 A 的 `rootGate`） |
| `src/ui/mobileText.ts`（新建） | 手机文字的常量与纯函数（字号下限、断点、CSS 源码巡检用的关键字） |
| `src/ui/mobileText.test.ts`（新建） | ≥ 15 例，含读 `styles.css` 文本做巡检 |
| `src/styles.css` | `/* 1.2 mobile text */` 区块：360px 媒体查询、换行、安全区 |
| `index.html` | 只补 `viewport-fit=cover` 之类的 meta，不动 `lang`、不改 description |

## 手机文字硬指标（360 × 640 是验收视口）

| 项 | 规定 |
| --- | --- |
| 正文字号 | ≥ **16px**（按钮文字、关卡格子数字可以 14px，说明文字不行） |
| 标题 | 用 `clamp()`；360px 宽时不得小于 **20px** |
| 行高 | ≥ **1.4** |
| 换行 | 长文案 `overflow-wrap: anywhere` + `word-break: break-word`；**禁止**用 `nowrap` 把汉字挤成竖条或撑出屏幕 |
| 对比度 | 正文对背景 ≥ **4.5:1**（现有 `src/ui/contrast.ts` 的检查必须继续通过，**但那个文件不是你的，不许改**） |
| 安全区 | 底栏 / 暂停条 / 虚拟按键 `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| 卡片布局 | 360px 下不许挤爆也不许横向溢出；游戏名允许折两行 |

## 红线自查

- 芯片文案就是三个中文词：**全部 / 手游 / 端游**。不要写「iOS」「安卓」「应用商店」这类词，也不要写任何商标。
- 不许为了「让筛选有效果」去批量改 55 个 `meta.ts` —— 那会和以后的升级步抢文件。
- 不许静态 `import` A 档的 `rootGate.ts`（A 可能还没合进来，会构建失败）。用 `import.meta.glob` 懒加载，模块不在就把按钮藏起来。
- 不许删 `.sr-only`、`:focus-visible`、`prefers-reduced-motion` 相关样式。
- 不引入外链字体或任何外部资源。

## 验收

- `npm test` 全绿且只增不减；`npm run build` 全绿。
- 造一个 `platform: "mobile"` 的假 meta：「端游」筛选选不到它，「手游」和「全部」都能选到；不填 `platform` 的假 meta 三种筛选都能选到。
- 把浏览器宽拖到 360px：首页卡片、搜索框、三排芯片、家长按钮全在视口内，文字不横向溢出。

---

## 完整派发提示词（整段复制给子代理）

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）。这是 1.2 版本的**第 1 步（共 30 步）**，你是 **B 档**。

## 分支纪律（先做这一步）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上：`git checkout -B <你的工作分支> origin/game-1.2`。
- 开工前先提交一条 git 记录（写上「1.2 第 1 步 / B · 手游端游筛选与手机文字」和你的工作计划），再动代码。
- 全部工作推 `game-1.2`。不要改 main、不要合并回 main、不要用 gh 开或合 PR。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase 重来，**禁止 force push**。

## 你是谁
B：给游戏加 **手游 / 端游** 这个维度并接到首页筛选上；同时把**手机上的文字**（字号、换行、对比度、安全区、360px）做成可测试的平台约定。
同一步 A 在做 root 管理员门（`src/ui/rootGate.ts` + `level99.ts`），C 在做模式口径与 2.5D 基建（`src/engine/playModes.ts` + `view25d.ts`）。**别人的文件一个字都别动。**

## 独占文件（只许改这些）
- `src/engine/types.ts`
- `src/ui/homeFilters.ts`、`src/ui/homeFilters.test.ts`
- `src/ui/home.ts`
- 新建 `src/ui/mobileText.ts`、`src/ui/mobileText.test.ts`
- `src/styles.css`
- `index.html`（只许补 viewport / 安全区相关 meta，不许改 `lang`，不许改 description 文案）

明确不许碰：`src/ui/rootGate.ts`、`src/ui/root12Contract.ts`、`src/games/level99.ts`、`src/games/quiz99.ts`（A 的）；
`src/engine/playModes.ts`、`src/engine/view25d.ts`（C 的）；
`src/ui/contrast.ts`、`src/ui/parentAuth.ts`、`src/ui/parentGate.ts`、`src/ui/gameShell.ts`、`src/ui/dialogs.ts`；
任何 `src/games/<某款游戏>/` 目录（包括那 50 多个 `meta.ts`，**本步一个都不许改**）。

## 1）`platform` 字段（`src/engine/types.ts`）
1. 新增：

```ts
/** 这款游戏在哪种设备上玩着顺手:mobile=手游 desktop=端游 both=都行 */
export type GamePlatform = "mobile" | "desktop" | "both";

/** 全部取值(校验与遍历用) */
export const GAME_PLATFORMS: GamePlatform[] = ["mobile", "desktop", "both"];
```

2. `GameMeta` 加可选字段 `platform?: GamePlatform`，注释里写清楚：**不填按 `"both"` 处理**，老游戏在 1.2 第 27 步统一补。
3. 不要改 `GameMode` / `GAME_MODES` / `CATEGORY_LABELS` 等既有导出的语义，只做加法。

## 2）首页筛选（`src/ui/homeFilters.ts`）
1. 新增：

```ts
export type PlatformChip = "all" | "mobile" | "desktop";
export const PLATFORM_CHIPS: { key: PlatformChip; emoji: string; label: string }[] = [ ... ];
export function matchesPlatformChip(meta: Pick<GameMeta, "platform">, chip: PlatformChip): boolean;
```

   芯片文案必须就是这三个中文词：**全部 / 手游 / 端游**（emoji 你自己挑，粉彩萌系）。
2. `matchesPlatformChip` 规则：`chip === "all"` → true；`meta.platform` 是 `undefined` 或 `"both"` → **手游、端游都命中**；
   `"mobile"` 只命中手游芯片；`"desktop"` 只命中端游芯片；遇到脏值（不在 `GAME_PLATFORMS` 里）当 `"both"`，不许抛。
3. `HomeFilter` 加一维 `platform: PlatformChip`；`filterGames` 变成**分类页签 × 玩法芯片 × 平台芯片 × 搜索**四条件叠加。
   1.1 已有的 `matchesTab` / `matchesModeChip` / `matchesSearch` 行为一个字都不许改。
4. `isFiltering` 与 `emptyStateText` 同步支持平台维度（空态多一句「换个筛选试试」的口吻，六年级语气，不低幼）。
5. `homeFilters.test.ts` 新增 **≥ 8 例**：缺省当 both、`"mobile"` 被端游筛掉、脏值当 both、四条件组合、空态文案、`PLATFORM_CHIPS` 顺序与文案。

## 3）首页 UI（`src/ui/home.ts`）
1. 在玩法芯片那一排下面（或同一容器里另起一行）画平台芯片：键盘可达（Tab / 方向键）、`aria-pressed` 正确、
   `:focus-visible` 有可见描边、选中态和已有芯片风格一致。
2. 平台芯片与分类页签、玩法芯片、搜索**可以任意组合**；组合后没有结果时显示 `emptyStateText`。
3. 「管理员权限」入口：放在家长按钮旁边，做成不显眼的小按钮（文案就叫「管理员权限」，**不要写 root**）。
   A 档的 `rootGate.ts` 可能还没合进来，**必须懒加载**，照抄仓库里 `src/ui/gameShell.ts` 已经在用的写法：

```ts
const rootGateModules = import.meta.glob("./rootGate.ts") as Record<string, () => Promise<unknown>>;
// 没有这个模块就把按钮藏起来,首页绝不能因此崩
```

   加载到了就调 `requestRootOpen("管理员要打开直达关卡")`。**不要静态 import `rootGate.ts`，不要改 `parentAuth.ts` / `parentGate.ts` / `gameShell.ts`。**

## 4）手机文字（新建 `src/ui/mobileText.ts`）
导出常量与纯函数，方便单测（DOM 操作最多只留一个很小的 `applyMobileTextVars(root)`）：

- `MIN_BODY_PX = 16`（正文字号下限）、`MIN_CONTROL_PX = 14`（按钮 / 关卡格子数字下限）、`MIN_TITLE_PX_AT_360 = 20`、`MIN_LINE_HEIGHT = 1.4`、`NARROW_BREAKPOINT = 360`。
- `clampBodyPx(px: number): number`、`titleClamp(): string`（返回 `clamp(...)` 字符串）之类的小工具。
- `MOBILE_CSS_MARKERS: string[]` —— 巡检 `styles.css` 时要求出现的关键字，至少包含 `safe-area-inset`、`overflow-wrap`、`360px`。

`mobileText.test.ts` **≥ 15 例**，其中必须有**读 `src/styles.css` 源码文本**做巡检的用例（`readFileSync` 即可）：
断言包含 `env(safe-area-inset-bottom)`、`overflow-wrap`、`@media` 里有 360px 分支；断言没有出现 `white-space: nowrap` 用在游戏名上的写法。

## 5）`src/styles.css`
用一个清晰的区块注释 `/* 1.2 mobile text */` 包住你新增的规则，方便以后 QA 一眼扫到。要覆盖：

- 正文 ≥ 16px、行高 ≥ 1.4；标题 `clamp()` 且 360px 下 ≥ 20px。
- 长文案 `overflow-wrap: anywhere; word-break: break-word;`。
- 底部安全区 `padding-bottom: max(12px, env(safe-area-inset-bottom));`（首页底栏、暂停条、虚拟按键）。
- 360px 媒体查询：卡片不横向溢出、游戏名可折两行。
- **不许**把 `--ink-soft` 之类的颜色改浅（`src/ui/contrast.ts` 里的 CONTRAST_CHECKS 必须继续通过，而且那个文件不是你的，不许改）。
- **不许**删已有的 `.sr-only`、`:focus-visible`、`prefers-reduced-motion` 规则。

## 6）`index.html`
只许补 viewport / 安全区相关的 meta（例如 `viewport-fit=cover`）。不要改 `lang`，不要改标题与 description 文案，不要加外链资源。

## 不要做什么
- ❌ 改任何 `src/games/**`（含 50 多个 `meta.ts` —— 平台字段留到第 27 步统一填）。
- ❌ 做 A 的 root 门本体、做 C 的 2.5D。
- ❌ 引入 three.js、CDN 字体、任何外部运行时依赖。
- ❌ 在文案或注释里写商业商标 / 官方角色名。
- ❌ 删测试、调低断言。

## 验收
- `npm test` 全绿，用例总数只增不减；`npm run build` 全绿。
- 平台筛选：`platform: "mobile"` 的假 meta 在端游筛选下查不到；不填 platform 的三种筛选都能查到。
- 手动把浏览器宽拖到 360px：首页卡片、搜索框、三排芯片、家长与管理员按钮都在视口内，文字不横向溢出，底部不贴 Home 条。
- `git diff --name-only origin/game-1.2...HEAD` 只出现你的独占文件。

完成后回复：你是 B、改了哪些文件、各文件新增用例数与总用例数、推到 `origin/game-1.2` 的 SHA、以及**实际使用的模型 slug**。
~~~~
