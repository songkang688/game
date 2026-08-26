# 1.2 第 1 步 / 共 38 步 —— 平台基建（root 门 + 手游/端游与手机文字 + 模式/2.5D 基建）

> 派发：同时开 3 个云端子代理。**整份复制本文件**，在末尾加「你是 A」或「你是 B」或「你是 C」；也可以只复制下面三段 `~~~~text` 里属于你那一档的一整段。
> 本步只改平台，**不改任何一款游戏的玩法 / 关卡表**（`meta.ts` 也不许在本步批量改标题）。
> 上一步：无（这是 1.2 执行阶段第一步）。下一步：派发步 10（21 款新游戏接入，待 B 档文档）。

主管文档：[`00-supervisor.md`](./00-supervisor.md) · 基线：[`../upgrade-prompts/12-game-1.2-baseline.md`](../upgrade-prompts/12-game-1.2-baseline.md)

---

## 〇、本步三人拆分（文件所有权互不相交）

| 档 | 职责 | 独占文件 |
| --- | --- | --- |
| A | root 高权限门 + 直达任意关 | `src/ui/rootGate.ts`、`src/ui/rootGate.test.ts`、`src/games/level99.ts`、`src/games/level99.test.ts`、`src/games/quiz99.ts`、`src/games/quiz99.test.ts` |
| B | 手游/端游筛选 + 手机文字（360px） | `src/engine/types.ts`、`src/ui/homeFilters.ts`、`src/ui/homeFilters.test.ts`、`src/ui/home.ts`、`src/ui/mobileText.ts`、`src/ui/mobileText.test.ts`、`src/styles.css`、`index.html`（只动 viewport / 安全区相关 meta，不动 title 文案大改） |
| C | 闯关/对战/无尽兼容壳 + 2.5D/伪 3D 共享相机 | `src/engine/playModes.ts`、`src/engine/playModes.test.ts`、`src/engine/view25d.ts`、`src/engine/view25d.test.ts` |

三人都必须在自己的分支里**逐字创建** `src/ui/root12Contract.ts`（下一节）。内容完全相同的新文件 rebase 时自动跳过。

禁止碰：`docs/game-1.2/new-games/`、`docs/game-1.2/upgrades/`、任何 `src/games/<id>/` 玩法文件（A 的 `level99.ts` / `quiz99.ts` 除外）、`src/ui/parentAuth.ts` 的算术逻辑（B 若要在家长面板加管理员入口，只许改 `src/ui/home.ts` 里调用 `showParentGate` 的周围，用动态 import 调 rootGate；**不要改 `parentGate.ts`**，避免和 A 的门抢同一文件——管理员入口做在首页齿轮/家长按钮旁边的折叠段即可）。

---

## 契约：`src/ui/root12Contract.ts`（三人逐字同建）

~~~~ts
/**
 * 1.2 新增：root 高权限门的运行时契约。
 * 只放类型与注册表，不 import 任何 UI / 玩法代码，三方都能安全依赖。
 */
export const ROOT_TTL_MS = 60 * 60 * 1000;
export const ROOT_ADMIN_PHONE = "18438037080";
export const ROOT_DEFAULT_PASSWORD = "kangkang";
export const ROOT_STORAGE_KEY = "yiduo-yixing.root.v1";

export interface RootSession {
  /** 过期时间戳(ms)。now >= expiresAt 视为关闭 */
  expiresAt: number;
}

export interface Root12Extras {
  isRootOpen: () => boolean;
  remainingMs: () => number;
  requestRootOpen: (reason: string) => Promise<boolean>;
  closeRoot: () => void;
}

let extras: Root12Extras = {
  isRootOpen: () => false,
  remainingMs: () => 0,
  requestRootOpen: async () => false,
  closeRoot: () => {}
};

export function registerRoot12Extras(next: Partial<Root12Extras>): void {
  extras = { ...extras, ...next };
}

export function getRoot12Extras(): Root12Extras {
  return extras;
}

/** 仅供测试 */
export function resetRoot12Extras(): void {
  extras = {
    isRootOpen: () => false,
    remainingMs: () => 0,
    requestRootOpen: async () => false,
    closeRoot: () => {}
  };
}
~~~~

---

## 第 1 步 / A —— root 高权限门

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 1.2 版本的第 1 步（共 38 步），你是 **A**。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 上。
- 开工前先提交一条 git 记录（写上「1.2 步1 / A · root 门」与计划）。
- 全部工作推 `game-1.2`。不要改 main、不要合并回 main、不要用 gh 开或合 PR、禁止 force push。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase，绝不 force。

## 你是谁
A：实现 **root 高权限门**，并让 188 关框架 / 答题壳在门打开时可以「直达第 N 关」。B 做首页筛选和手机文字，C 做 2.5D 基建。别人的文件一个字都别动。

## 独占文件（只许改这些 + 三人同建契约）
- 新建 `src/ui/rootGate.ts`、`src/ui/rootGate.test.ts`
- `src/games/level99.ts`、`src/games/level99.test.ts`
- `src/games/quiz99.ts`、`src/games/quiz99.test.ts`
- 新建 `src/ui/root12Contract.ts`（内容必须与 docs/game-1.2/step-01.md 里「契约」节逐字一致）

## 产品规定（逐字实现）
- 默认密码：`kangkang`（用契约里的 `ROOT_DEFAULT_PASSWORD`，不要再抄一份不同的字符串）。
- 弹窗必须写：「要打开请联系管理员 18438037080」。
- 打开后：可任意跳关、可直接玩第 XX 关（绕过三星解锁与「只能打下一关」）。
- 可关闭：提供「关闭管理员权限」按钮，立刻清掉会话。
- **一小时后默认关闭**：`expiresAt = Date.now() + ROOT_TTL_MS`。每次 `isRootOpen()` 都用当前时间比较，过期视作关闭并删掉存档。
- 存档 key：只许 `yiduo-yixing.root.v1`，值 `{ expiresAt: number }`。**绝不把密码写入 localStorage / sessionStorage / cookie。**
- 1.1 的算术家长门 `parentAuth.ts` **原样保留**。root 开着时，`level99` 的跳关 / 直达不必再问算术题；root 关着时继续走原来的 `getLevelExtras().requestSkip`。
- 防暴力：密码连续错 3 次锁定 120 秒（假时钟可测，不要真 sleep）；输入框 `type="password"`；沿用 `dialog--shake`。
- 面向孩子的界面不要写「root」「高权限」这种吓人词，按钮文案用「管理员权限」。

## 实现要点
1. `rootGate.ts` 导出：
   - `isRootOpen(): boolean`
   - `remainingMs(): number`
   - `requestRootOpen(reason: string): Promise<boolean>`（弹窗：密码框 + 管理员电话 + 不同意 + 关闭权限）
   - `closeRoot(): void`
   - `resetRootGate(): void`（仅测试）
   - 模块加载时调用 `registerRoot12Extras({ isRootOpen, remainingMs, requestRootOpen, closeRoot })`
2. localStorage 读到坏数据（非对象 / 缺 expiresAt / 非数字）时当关闭，不许抛异常。隐私模式（localStorage 不可用）降级为内存会话，仍然 1 小时过期。
3. `level99.ts`：
   - 选关地图在 `getRoot12Extras().isRootOpen()` 为真时显示「直达关卡」数字框（1–188）+ 确认按钮；确认后把该关设为当前关并可立即开打，不改已有星级数组里其它关的值。
   - 直达的关如果还没解锁，允许进入，但**不要把未打过的关写成三星**；星级仍是 0，除非玩家真的打出星星。
   - root 关着时这些控件不渲染（和攻略按钮一样：没权限就隐藏）。
   - 不要改存档 key `yiduo-yixing.l99.<id>` 的语义；不要改 `TOTAL_LEVELS = 188`。
4. `quiz99.ts` 同步：root 开着时允许选择任意题号进入；关着时保持 1.1 行为。
5. 样式不要改 `src/styles.css`（B 的文件）。弹窗样式用现有 `showDialog` / 注入 scoped `<style>`（id 固定，重复 mount 不重复插入）。
6. 测试 `rootGate.test.ts` ≥ 20 个用例（用假时钟）：正确密码打开、错误密码、错 3 次锁定、1 小时过期自动关、手动关、坏数据降级、密码不落盘、`ROOT_STORAGE_KEY` 常量、电话文案出现在 DOM、未注册契约时 `getRoot12Extras().isRootOpen()` 仍是 false。
7. `level99.test.ts` 至少新增 8 个：root 开时可直达 188、直达不改其它关星级、root 关时没有直达控件、过期后直达消失。`quiz99.test.ts` 至少新增 4 个同类用例。

## 验收
- `npm test` 全绿，总用例数 ≥ 基线 3918 且只增不减；`npm run build` 全绿。
- 不引入外部依赖；不改 `yiduo-yixing.save.v1`；不在注释或文案里写商标。
- 不要做 B/C 的筛选、手机文字、2.5D。不要新建任何游戏。

完成后回复：你是 A、改了哪些文件、新增用例数、推到 `origin/game-1.2` 的 SHA、以及实际使用的模型 slug。
~~~~

---

## 第 1 步 / B —— 手游·端游筛选 + 手机文字

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 1.2 版本的第 1 步（共 38 步），你是 **B**。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 上。
- 开工前先提交一条 git 记录（写上「1.2 步1 / B · 平台筛选与手机文字」与计划）。
- 全部工作推 `game-1.2`。不要改 main、不要合并回 main、不要用 gh 开或合 PR、禁止 force push。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase，绝不 force。

## 你是谁
B：给 `GameMeta` 加上 `platform`，首页增加 **手游 / 端游** 条件过滤；并把全站手机文字（字号、换行、对比度、安全区、**360px**）做成可测试的约定。A 做 root 门，C 做 2.5D。别人的文件一个字都别动。

## 独占文件（只许改这些 + 三人同建契约）
- `src/engine/types.ts`
- `src/ui/homeFilters.ts`、`src/ui/homeFilters.test.ts`
- `src/ui/home.ts`
- 新建 `src/ui/mobileText.ts`、`src/ui/mobileText.test.ts`
- `src/styles.css`
- `index.html`（只许补 viewport-fit / env(safe-area-inset-*) 需要的 meta，不许改掉 `lang` 或乱改 description 商标）
- 新建 `src/ui/root12Contract.ts`（内容必须与 docs/game-1.2/step-01.md 里「契约」节逐字一致）

## 1）platform 字段与筛选
1. 在 `GameMeta` 增加可选字段：
   `platform?: "mobile" | "desktop" | "both"`
   并导出类型 `GamePlatform` 与常量 `GAME_PLATFORMS`。
2. **缺省当 `"both"`**：老游戏本步不要去改 50+ 个 `meta.ts`（那些文件属于以后的升级步）。筛选函数遇到 `undefined` / 缺字段必须当成 `both`，手游筛和端游筛都能命中。
3. `homeFilters.ts` 增加平台芯片，建议：
   - 类型 `PlatformChip = "all" | "mobile" | "desktop"`
   - `PLATFORM_CHIPS`：全部 / 手游 / 端游（emoji 自定，文案必须是这三个中文词）
   - `matchesPlatformChip(meta, chip)` 纯函数
   - `filterGames` 现有签名上叠加平台条件（分类页签 × 玩法芯片 × 平台芯片 × 搜索），不要拆掉 1.1 已有的玩法芯片。
4. `home.ts` 画出平台芯片，键盘可达，`aria-pressed`，与分类/玩法一样可组合。空结果用现有 `emptyStateText` 思路加一句「换个筛选试试」。
5. 首页放一个不显眼的「管理员权限」入口（家长按钮旁边即可）。用动态 import：
   `const m = await import("./rootGate").catch(() => null)`
   A 可能还没合进来：模块不存在就隐藏按钮，首页不得因此崩溃。打开后调用 `m.requestRootOpen("管理员要打开直达关卡")`。不要静态 import `rootGate.ts`，不要改 `parentAuth.ts` / `parentGate.ts`。

## 2）手机文字（360px 是硬验收）
新建 `mobileText.ts` 导出纯数据/纯函数（方便单测，不要在这里操作 DOM 除非是很小的 `applyMobileTextVars(root)`）：

- 正文字号下限：**16px**（按钮 / 关卡格子数字可以 14px，但说明文字不行）。
- 标题在窄屏用 `clamp`，360px 宽时标题不得小于 20px。
- 行高 ≥ 1.4；长文案必须换行：`overflow-wrap: anywhere` + `word-break: break-word`，禁止一条 hint 把卡片撑出屏幕。
- 对比度：正文对背景 ≥ 4.5:1。不要把 `--ink-soft` 改回更浅；若你动颜色，必须同步 `src/ui/contrast.ts` 不会红（`contrast.ts` 不是你的文件——**不要改它**；只许把 `styles.css` 调到现有 CONTRAST_CHECKS 仍然通过）。
- 安全区：`padding-bottom: max(12px, env(safe-area-inset-bottom))` 之类，首页底栏、暂停条、虚拟键不要贴物理 Home 条。
- **360px × 640px** 是验收视口：卡片两列（已有 380px 断点，检查 360 是否变成 1 列挤爆或 2 列溢出）。游戏名允许两行，禁止用 `nowrap` 把汉字切成竖条溢出。

`styles.css` 用一个清晰的区块注释 `/* 1.2 mobile text */` 包住你的新增规则，方便以后 QA 扫。已有 `.sr-only` / `:focus-visible` / `prefers-reduced-motion` 不许删。

`mobileText.test.ts` ≥ 15 个：字号下限常量、360 断点常量、`matchesPlatformChip` 的缺省 both、筛选组合、CSS 源码巡检（读 `styles.css` 文本）断言包含 `safe-area-inset`、`overflow-wrap`、360 媒体查询。`homeFilters.test.ts` 补平台芯片用例，至少 8 个。

## 不要做什么
- 不要改任何 `src/games/**` 玩法。
- 不要改 `level99.ts`（A 的）。
- 不要引入 three.js 或外链字体。
- 不要把 50 个 meta 的 platform 填掉（留给升级步）；只把类型和筛选做对。
- 文案禁止商标；不要写「iOS」「Android 商店」广告语，芯片就叫「手游」「端游」。

## 验收
- `npm test` 全绿，总用例 ≥ 3918 且只增不减；`npm run build` 全绿。
- 手动：把浏览器宽拖到 360px，首页卡片、搜索框、芯片、家长按钮都在视口内，文字不横溢。
- 平台芯片：造一个假 meta `platform:"mobile"` 的单测，端游筛选不到它。

完成后回复：你是 B、改了哪些文件、新增用例数、推到 `origin/game-1.2` 的 SHA、以及实际使用的模型 slug。
~~~~

---

## 第 1 步 / C —— 闯关 / 对战 / 无尽兼容与 2.5D 基建

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 1.2 版本的第 1 步（共 38 步），你是 **C**。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 上。
- 开工前先提交一条 git 记录（写上「1.2 步1 / C · playModes 与 view25d」与计划）。
- 全部工作推 `game-1.2`。不要改 main、不要合并回 main、不要用 gh 开或合 PR、禁止 force push。
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2` → `npm test && npm run build` 全绿 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase，绝不 force。

## 你是谁
C：做两块**以后每一款游戏都能 import 的共享基础设施**，本步不要改具体游戏。A 做 root 门，B 做首页。别人的文件一个字都别动。

## 独占文件（只许改这些 + 三人同建契约）
- 新建 `src/engine/playModes.ts`、`src/engine/playModes.test.ts`
- 新建 `src/engine/view25d.ts`、`src/engine/view25d.test.ts`
- 新建 `src/ui/root12Contract.ts`（内容必须与 docs/game-1.2/step-01.md 里「契约」节逐字一致）

不要改 `src/engine/types.ts`（B 的，里面已有 `GameMode`）。你只 import 类型。不要改 `styles.css`、`home.ts`、`level99.ts`。2.5D 的演示 CSS 若必须存在，在 `view25d.ts` 里注入带固定 id 的 `<style>`，重复调用不重复插入。

## 1）playModes.ts —— 三种模式是否兼容
给后续升级步一个统一口径，避免每款游戏自己发明一套菜单。

导出至少：

- `ModeKind = "campaign" | "versus" | "endless"`（对战含双人同屏；需要细分时另给 `versusKind: "ai" | "hotseat" | "twoPlayer"`）
- `ModeCompat`：`{ campaign: boolean; versus: boolean; endless: boolean; reason?: Partial<Record<ModeKind, string>> }`
- `compatFromMeta(meta: Pick<GameMeta, "modes" | "levels">): ModeCompat` —— 根据已有 `modes` 推导；没填 modes 时三者都 false 并在 reason 写「升级步补 modes」。
- `assertModeMenu(compat, requested: ModeKind): boolean` —— 请求了不支持的模式返回 false，不许抛。
- `describeModes(compat): string` —— 给 guide / 暂停菜单用的一句中文，例如「可闯关、可对战；这款不做无尽」。六年级语气，不低幼，无商标。
- 纯函数 `pickInitialMode(compat, want?: ModeKind): ModeKind`：want 合法就用 want，否则按 campaign > versus > endless 的第一个 true。

测试 ≥ 16 个：矩阵覆盖有/无 campaign、只有 versus、只有 endless、空 modes、describe 不含禁止词（可用一个小黑名单数组：`/宝宝|乖乖|Tetris|拳皇/`）。

本步**不要**去改 50 个游戏的菜单。只把工具放好。升级步会 import 它。

## 2）view25d.ts —— 2.5D / 伪 3D（禁止 three.js）
1.1 第 6 步已在 `rainbow-run` / `duo-rush` 做过跑道透视。本步把**可复用的数学**抽成引擎模块，供跑酷、卡丁、保龄、台球透视地面使用。禁止加 `three` 依赖，禁止外链模型。

导出至少：

```
export interface View25dCamera {
  kind: "flat" | "perspective";
  /** 视场，度 */
  fov: number;
  /** 地平线在画布高度上的比例 0–1 */
  horizon: number;
  cameraY: number;
  cameraZ: number;
}

export function defaultCamera(kind: View25dCamera["kind"] = "perspective"): View25dCamera

/** 世界 (x, y, z) → 画布像素。y 向上，z 向前 */
export function project(cam: View25dCamera, x: number, y: number, z: number, viewW: number, viewH: number): { x: number; y: number; scale: number; visible: boolean }

/** 一条沿 z 轴的路段梯形，给跑酷/卡丁画地面 */
export function roadQuad(cam, z0, z1, halfWidth, viewW, viewH): [number, number][] | null

/** prefers-reduced-motion 时改 flat，project 变成正交 */
export function respectReducedMotion(cam: View25dCamera, reduced: boolean): View25dCamera
```

要求：

- 纯函数，不碰 DOM（除可选的 `installView25dCss()` 可以装一次 CSS 变量）。
- `z` 越大 scale 越小；点在相机后面 `visible=false`。
- 单测 ≥ 18 个：原点投影在地平线附近、远处 scale < 近处、flat 模式 scale 恒 1、reduced motion、极端 fov 不 NaN、view 宽高为 0 时不抛。
- 在文件头注释写清：这是「透视投影数学」，不是某个商业 3D 引擎；注释里禁止商标。

## 不要做什么
- 不要改 rainbow-run / duo-rush 的现有渲染（那是升级步 32 的事，他们会来 import 你的函数）。
- 不要实现任何新游戏。
- 不要改 root 门、不要改首页。
- 不要为了「演示」去新建 `/demo` 页面。

## 验收
- `npm test` 全绿，总用例 ≥ 3918 且只增不减；`npm run build` 全绿。
- `src/engine/playModes.ts` 与 `view25d.ts` 可被别人直接 import，无循环依赖。
- 零外部运行时依赖。

完成后回复：你是 C、改了哪些文件、新增用例数、推到 `origin/game-1.2` 的 SHA、以及实际使用的模型 slug。
~~~~

---

## 本步共同验收（三人各自满足）

- `npm test` 全绿，用例只增不减（基线 3918）；`npm run build` 全绿。
- 不改存档 key 语义（root 只新增 `yiduo-yixing.root.v1`）。
- 不引入外部运行时依赖；无商标；失败只鼓励（本步几乎无失败文案，若有则遵守）。
- 独占文件无越界。
- 契约文件三人内容一致。

## 本步不要做什么（全体）

- ❌ 再用 Task 套娃派生云端子代理。
- ❌ 改 / 合 `main`；force push；用 `gh` 写操作。
- ❌ 新建 `src/games/<新id>/`（那是步 10–16）。
- ❌ 改 `docs/game-1.2/new-games/` 或 `upgrades/`。
- ❌ 把 1.1 算术家长门删掉或改成密码门。
- ❌ 引入 three.js / CDN / Socket 联网。
