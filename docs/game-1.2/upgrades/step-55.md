# 1.2 升级第 55 步 / 共 57 步 —— 冲突 / 串味 / 回归

> 游戏升级步已结束。本步三人**不改玩法规则**，专扫跨游戏冲突。每人独占路径互斥。

---

## A —— 存档 key · 全局 CSS · 快捷键

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 55 步角色 **A**。独占：新建 `src/games/__tests__/isolation-1.2.test.ts`（或同类新文件）、以及**你为修冲突而必须改的最小游戏内 CSS 类名/监听**——但每个被改游戏只许动「前缀/卸载」层面，不许改关卡。若必须改某游戏 index.ts 的监听，回复里列出清单。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查

全库搜 `localStorage`、`yiduo.`、`yiduo-yixing.`、未加前缀的 CSS 动画名、`window.addEventListener("keydown"`。

已知债：
- `yiduo.gomoku.campaign.v2`、`yiduo.candy-swing.campaign.v2`、`yiduo.bubble-aim.campaign.v2` 缺平台前缀，家长导出可能漏。
- 多款方向键/空格/WASD 若 destroy 失败会串到下一款。
- 全局 `.board` `.hp` `.combo` 会串味。

## 2. 通行规则对照

隔离原则：一款游戏的样式、键、存档、rAF 在 destroy 后必须为零泄漏。PWA 多游戏合集的工业实践：命名空间 + 成对注册注销。

## 3. 本步要做

1. 列出全部存档 key 表（只增不改语义）：平台钱包、l99、l99skip、collection、fav、recent、各游戏 campaign/endless/dex。旧 `yiduo.*` 读一次迁到 `yiduo-yixing.*`。
2. 快捷键清单：Esc 统一暂停（只读壳层）；游戏内键必须在 destroy 卸掉。写测试：mount A → destroy → mount B，A 的 handler 不再触发。
3. CSS：禁止无前缀的通用类进 `src/styles.css`（styles.css 本步尽量不改，发现全局污染则在报告里交给 C 或下一步；你优先给游戏内 style 加前缀）。

## 4. 视觉

不改玩法视觉，只修溢出/串类导致的错乱。

## 5. 跳关

只读检查：hash `?level=` 是否被某游戏误当成别的参数。

## 6. 文件所有权

新测试文件你独占。迁移函数可放各游戏内，但不要改 `save.ts` 字段含义；若必须动 `save.ts` 的导出扫描前缀，只加兼容、写清。

## 7. 测试 / 不要做什么 / 冲突

- 新增隔离测试 ≥ 15。
- 不要改关卡数字、不要改 AI 强度、不要 force。
- 与 B/C：你不改 BGM 图、不改 home 筛选。

完成后回复：key 全表、修了哪些泄漏、测试结果、**实际模型 slug**。
~~~~

---

## B —— BGM · root 跳关 API · 首页筛选

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 55 步角色 **B**。独占：`src/ui/home.ts`、`src/ui/homeFilters.ts`、`src/ui/homeFilters.test.ts`、`src/engine/types.ts`（仅 GameAPI 可选字段）、`src/ui/app.ts`（仅 hash 解析）、`src/ui/gameShell.ts`（仅把 initialLevel 注入 GameAPI）。**不要改各游戏玩法文件。** 若某游戏还不读 initialLevel，在报告里点名留给验收步。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查

- 路由只有 `#/game/:id`，没有 `?level=N`。
- GameAPI 无 `initialLevel`。
- 首页筛选芯片 1.1 第 12 步可能已有，1.2 新 21 款 meta.modes 可能没填。
- BGM：平台 `isBgmOn`；游戏内可能再造 AudioContext。

## 2. 通行规则对照

Deep link：打开即玩第 N 关是合集标配。密码门在壳层，游戏只消费关号。

## 3. 本步要做

1. 解析 `#/game/<id>?level=N` 与 `#/game/<id>?mode=endless|versus|campaign`。
2. `GameAPI.initialLevel?: number`（1 基）、`initialMode?: string` 可选，缺省不影响旧游戏。
3. 首页：新游戏出现在筛选里；搜索包含暂定中文名。
4. BGM：游戏 destroy 后不要留下振荡器；你只在壳层保证切游戏时停掉上一首（若壳层已有则写回归测试）。

密码 kangkang / 管理员号 / 1 小时自动关：**只接 A 档已实现的 API**，本步不要重做门。

## 4. 视觉

筛选芯片 360px 可横滑不溢出。

## 5. 跳关

这就是你的主业：壳层接线。

## 6. 文件所有权

见上。不要改 `src/games/*/index.ts`。

## 7. 测试

- homeFilters 新游戏 id（从 glob 动态，不要写死 21 个暂定名到会失败的测试；可测解析函数）。
- hash 解析单测 ≥ 10。
- 不要动存档语义。

完成后回复：API 字段、hash 格式、测试结果、**实际模型 slug**。
~~~~

---

## C —— destroy 泄漏 · 邻接串味

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 55 步角色 **C**。独占：新建 `scripts/smoke-destroy-1.2.mjs`（或 `src/games/__tests__/destroy-1.2.test.ts`）、以及 **styles.css 里与游戏串味相关的最小修复**（对比度/焦点已有则只补 1.2 新类）。不要改玩法逻辑。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查

抽 15 款（必须含 IO、方块、麻将、庄园、格斗两款、跑酷）：进→玩 2 秒→退→再进 ×5，监听器与 rAF 计数不增长。

串味：A 的粒子画到 B；A 的 `position:fixed` 遮住壳顶栏。

## 2. 通行规则对照

SPA 小游戏合集：每个 mount 返回 destroy，对称解除。

## 3. 本步要做

1. 自动化或半自动 destroy 探针。
2. 修你能在 styles.css / 壳层修的串味（z-index、overflow）。游戏内泄漏列给验收修复员，除非一行能修。
3. `prefers-reduced-motion` 抽查新 21 款是否还在闪。

## 4. 视觉

只修遮挡与溢出。

## 5. 跳关

配合冒烟：带 `?level=2` 打开 5 款自定义地图游戏。

## 6. 文件所有权

新脚本/测试你独占；styles.css 最小 diff。

## 7. 测试

报告 `docs/qa/1.2-isolation.md`（你独占）。量化泄漏。

不要改关卡。不要 force。

完成后回复：抽测清单、泄漏、测试结果、**实际模型 slug**。
~~~~
