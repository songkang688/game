# 1.2 升级第 52 步 / 共 57 步 —— 合合星 · 数独 · 足球
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `merge-stars` 合合星

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 52 步 / 共 57 步，角色 **A**，独占 `merge-stars`「合合星」。

这是 1.2 **新游戏**精细化。暂定 id `merge-stars`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/merge-stars/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 2048 规则。新游戏。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 同数碰撞合并加倍、滑向、新块出现。失败=无移动。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 目标合成。 |
| 对战 | 比谁先到 2048 星。 |
| 无尽 | 经典滑到死。 |

- 滑并移动画（不能瞬变）
- 新块 pop

**2.5D / 3D 决策：** 2D 格子。合成时缩放弹，不要 3D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 4×4
- 数字对比度

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/merge-stars/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 合并不连锁一次滑多次错误
- 无移动检测
- openLevel

不要做什么：
- 禁止商业 2048 皮肤商标

与邻接游戏的冲突点：
- 滑动与跑酷手势：本游戏仅棋盘区

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `sudoku-house` 数独小屋

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 52 步 / 共 57 步，角色 **B**，独占 `sudoku-house`「数独小屋」。

这是 1.2 **新游戏**精细化。暂定 id `sudoku-house`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/sudoku-house/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。必须唯一解生成。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 行列表宫 1–9。笔记候选。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 由易到难（6 宫教学→9 宫）。 |
| 对战 | 抢填对。 |
| 无尽 | 每日盘。 |

- 提示限次
- 冲突高亮
- 6 档生成难度

**2.5D / 3D 决策：** 2D 九宫。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 格子可点，数字键盘
- 宫线更粗

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/sudoku-house/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 唯一解
- 非法填入
- openLevel

不要做什么：
- 攻略直接填答案

与邻接游戏的冲突点：
- 数字键盘与 math-farm

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `star-soccer` 朵星足球

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 52 步 / 共 57 步，角色 **C**，独占 `star-soccer`「朵星足球」。

这是 1.2 **新游戏**精细化。暂定 id `star-soccer`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/star-soccer/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 简化：带球、传、射、门将扑。无恶铲伤害。进球卡通。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 训练+比赛脚本。 |
| 对战 | 双人或人机。 |
| 无尽 | 点球大战不间断。 |

- 体力条
- AI 三档站位
- 点球小游戏

**2.5D / 3D 决策：** 2.5D 球场（透视草地）推荐。真 3D 不必。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 虚拟摇杆+射门
- 球影

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/star-soccer/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 进球判定
- 出界
- openLevel

不要做什么：
- 禁止商业俱乐部名

与邻接游戏的冲突点：
- 摇杆与格斗

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
