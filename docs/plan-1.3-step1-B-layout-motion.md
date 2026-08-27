# 1.3 第 1 步 · B 档 —— 首页 / 关卡壳 / 结算的布局与动效审美

> 本文件只记录第 1 步 B 档的开工计划与**可整段复制的派发提示词**，不涉及 A / C 档的文件。
> 主管文档：[`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md) · 登记表：[`plan-1.3-tracker.md`](./plan-1.3-tracker.md) ·
> 视觉宪法：[`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) · skills：[`plan-1.3-skills.md`](./plan-1.3-skills.md)
> 同步进行：[A 档 · 素材包](./plan-1.3-step1-A-art-kit.md)、[C 档 · 跑道套件](./plan-1.3-step1-C-3d-runner.md)。

## 目标

把 76 款游戏**共用的三层壳**升级到与「精美素材」相称的水平：

1. **首页**：卡片网格的层次、封面区、悬停 / 按压反馈、分类与筛选芯片的视觉节奏。
2. **关卡壳**（进关到出关之间的公共 UI）：入场「第 N 关 + 目标」卡、暂停面板、HUD 排版。
3. **结算画面**：星级逐颗点亮、分数滚动、鼓励文案的舞台感。

只动布局 / 样式 / 动效，**不改任何筛选逻辑、路由逻辑、家长门逻辑、游戏逻辑**。

## 为什么壳要单独一格

第 2–26 步的 75 格只改各自游戏目录，**都不许碰共享文件**（防 25 个并发格互撞 `styles.css`）。
所以壳层的视觉升级必须在第 1 步一次做完做好——这是全项目唯一一格可以动
`src/ui/home.ts` / `src/ui/gameShell.ts` / `src/styles.css` 的（直到第 27–29 步验收轮）。

## 文件切分

| 文件 | 职责 |
| --- | --- |
| `src/ui/motion.ts`（新建） | 动效工具：入场卡时序、星级点亮序列、数字滚动、按压回弹；全部带 reduced 降级 |
| `src/ui/motion.test.ts`（新建） | ≥ 16 例 |
| `src/ui/home.ts`（修改，只动视觉层） | 卡片 DOM 结构与 class，不动筛选 / 收藏 / 最近逻辑 |
| `src/ui/gameShell.ts`（修改，只动视觉层） | 入场卡 / 暂停面板 / 结算舞台的 DOM 与 class |
| `src/styles.css`（修改） | 版式、阴影、圆角、动效关键帧、`@media (prefers-reduced-motion)` 与 360px 断点 |

## 红线自查

- 现有测试一个都不许红：`homeFilters.test.ts`、`mobileText.test.ts`、`a11y.test.ts`、
  `rootGate.test.ts`、各游戏 smoke 测试都钉着行为——红了说明你动了逻辑。
- 不改 `src/ui/homeFilters.ts` / `parentAuth.ts` / `rootGate.ts` / `root12Contract.ts` 的任何逻辑。
- 不改任何 `src/games/**`、`src/art/**`、`src/engine/**`。
- 1.2 的手机文字硬标准（正文 ≥ 16px、对比度 ≥ 4.5:1、360 宽不溢出）**只升不降**。

## 验收

- `npm test` 全绿且只增不减；`npm run build` 全绿。
- 360 × 640 视口：首页、任一游戏入场卡、结算画面截图（或 DOM 断言）过宪法第七节门槛。
- `prefers-reduced-motion` 下所有新动效有静态降级。

---

## 完整派发提示词（整段复制给子代理）

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-fable-5-thinking-xhigh`。
请在独立功能分支上进行修改，叫 game-1.2-kk。以 origin/game-1.2 为审美对照基线。不要直接修改 main。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生。全部推 `game-1.2-kk`，不回 `main`，禁止 force。本步只改视觉/素材/布局，不改关卡数值与胜负规则。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）。
这是 1.3 视觉升级的**第 1 步（共 29 步）**，你是 **B 档：首页 / 关卡壳 / 结算的布局与动效**。

## 必读文件（动笔前先读完）
- docs/plan-1.3-visual-bible.md —— 视觉宪法（负面清单、密度与节奏、360px 门槛、reduced-motion）。
- .cursor/skills/1.3-visual/frontend-design/SKILL.md —— 核心方法论：拒绝「模板默认脸」，
  版式与字号刻度要有主张；本产品的「主题世界」是粉彩花园与星空，布局语言从这里长出来。
- .cursor/skills/1.3-visual/theme-factory/SKILL.md 与 themes/ —— 成套配色的组织方法（我们只借方法，色板自己定）。
- 现状对照：origin/game-1.2 的 src/ui/home.ts、src/ui/gameShell.ts、src/styles.css，
  以及钉行为的测试 src/ui/homeFilters.test.ts、src/ui/mobileText.test.ts、src/ui/a11y.test.ts。

## 分支纪律（先做这一步）
- `git fetch origin game-1.2 game-1.2-kk`，工作分支建立在 `origin/game-1.2-kk` 之上：
  `git checkout -B <你的工作分支> origin/game-1.2-kk`。`origin/game-1.2` 只作审美对照，不在它上面开工。
- 开工前先提交一条 git 记录（写上「1.3 第 1 步 / B · 布局动效」和你的工作计划），再动代码。
- 全部工作推 `game-1.2-kk`。不要 push 到 `game-1.2`、不要改 main、不要用 gh 开或合 PR。
- 收尾：`git fetch origin game-1.2-kk` → `git rebase origin/game-1.2-kk` → `npm test && npm run build` 全绿
  → `git push origin HEAD:game-1.2-kk`。被拒就再 fetch+rebase 重来，**禁止 force push**。

## 你是谁
B：升级 76 款共用的**壳层视觉**。这是全项目唯一可以动 `src/styles.css` / `src/ui/home.ts` /
`src/ui/gameShell.ts` 的一格（到第 27 步之前）。同一步 A 在做 `src/art/kit/**` 素材包，
C 在做 `src/art/runner/**` 跑道套件。**别人的文件一个字都别动。**

## 独占文件
- 新建：`src/ui/motion.ts`、`src/ui/motion.test.ts`。
- 修改（只动视觉层）：`src/ui/home.ts`、`src/ui/gameShell.ts`、`src/styles.css`、
  必要时 `src/ui/avatars.ts`（首页头像的呈现尺寸 / 描边，不改 URL 契约）。

明确不许碰：`src/ui/homeFilters.ts`、`parentAuth.ts`、`parentGate.ts`、`rootGate.ts`、`root12Contract.ts`、
`level188Contract.ts`（逻辑契约都在这些里）；`src/art/**`（A 与 C 的地盘）；`src/engine/**`；
任何 `src/games/<id>/` 目录；`index.html` 里的 PWA 配置。

## 1）首页布局（`home.ts` 视觉层 + `styles.css`）
- 卡片三层结构：封面区（渐变 + 分类图形语言）/ 标题行 / 元信息行（模式徽章、平台徽章）。
  徽章是「胶囊 + 图形」而不是纯文字灰块。
- 分类页签与筛选芯片：选中态要有形状变化（不只变色），滚动溢出有渐隐提示。
- 悬停 / 按压：卡片浮起（阴影 + 位移 ≤ 4px）+ 按压回弹；`prefers-reduced-motion` 时只变阴影不位移。
- 360px 单列 / 小屏两列断点检查：热区 ≥ 44px、字号不缩水、长中文名换行不截断。
- **不改** 筛选逻辑、收藏 / 最近逻辑、搜索逻辑；DOM 结构变化后 homeFilters.test.ts 必须原样全绿。

## 2）关卡壳（`gameShell.ts` 视觉层）
- 入场卡：「第 N 关」大字 + 一句目标文案 + 一个装饰图形，600ms 内自动让位（reduced 时立即静态显示）。
- 暂停面板：按钮组统一圆角胶囊、间距 ≥ 8px、热区 ≥ 44px。
- HUD 容器：统一的半透明底 + 圆角 + 1 行排布规范，供第 2–26 步各游戏往里放自己的 HUD。

## 3）结算舞台（`gameShell.ts` / `dialogs.ts` 视觉层）
- 星级逐颗点亮（间隔 ~250ms，弹性放大），分数从 0 滚动到实际值（≤ 800ms）；
  reduced 模式：星星直接亮、分数直接显示。
- 鼓励文案区沿用 1.2 文案（只鼓励不批评），不改文案内容，只改排版。

## 4）`motion.ts` —— 动效工具（新建，纯逻辑可测）
至少导出：
- `staggerDelays(count, stepMs, reduced)`：星级 / 列表入场的时序数组；reduced 时全 0。
- `tweenNumber(from, to, t, easing?)`：分数滚动的插值（t 0–1，夹住，NaN 安全）。
- `springScale(t)`：按压回弹曲线（0–1 → 缩放系数，峰值 ≤ 1.08）。
- `motionPref(mm?)`：包装 engine 的 prefersReducedMotion（可注入 matchMedia 桩）。
动效时序常量集中在此文件，CSS 关键帧引用同名注释，方便对账。

## 测试（`motion.test.ts` ≥ 16 例 + 既有测试全绿）
- staggerDelays 长度 / 递增 / reduced 全 0；tweenNumber 端点值、夹住、NaN 安全；
  springScale 峰值 ≤ 1.08 且首尾为 1 / 目标值；motionPref 注入桩后两种取值。
- 追加 DOM 断言（放 motion.test.ts 或 gameShell 既有测试旁的新文件均可，但不许改旧断言）：
  入场卡元素存在且含关卡号、结算星级容器有三个星位、按钮热区 ≥ 44px（计算样式或显式尺寸断言）。

## 不要做什么
- ❌ 改筛选 / 路由 / 家长门 / root 门 / 存档逻辑；改动任何游戏目录。
- ❌ 引入字体文件、图片、CSS 框架、动画库；一切动效用 CSS + 原生 JS。
- ❌ 删测试、调低断言、改旧测试的预期值来「适配」你的 DOM——DOM 结构变化要以不破坏旧断言为前提。
- ❌ 把文字对比度或字号降到 1.2 标准之下。

## 验收
- `npm test` 全绿，用例总数只增不减；`npm run build` 全绿。
- `git diff --name-only origin/game-1.2-kk...HEAD` 只出现你的独占文件。
- 回复里附 360×640 下首页 / 入场卡 / 结算的自检结论（逐条对照宪法第七节）。

完成后回复：你是 1.3 第 1 步 B、改了哪些文件、新增用例数与总用例数、
宪法自检结论、推到 `origin/game-1.2-kk` 的 SHA、以及**实际使用的模型 slug**。
~~~~
