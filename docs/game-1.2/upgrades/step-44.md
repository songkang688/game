# 1.2 升级第 44 步 / 共 57 步 —— 气球 · 砖块 · 泡泡噗噗
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `balloon-pop` 气球砰砰

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 44 步 / 共 57 步，角色 **A**，独占 `balloon-pop`「气球砰砰」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/balloon-pop/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 连锁/护盾/算式/镜像 1.1 已加。缺口：破气球瞬消失。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 点破、连锁、风向。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 分屏抢戳。 |
| 无尽 | 风越来越大。 |

- 破裂粒子 200ms
- 无尽风力曲线

**2.5D / 3D 决策：** 2D。气球有轻微椭圆呼吸即可。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 气球热区
- 算式字 ≥ 16px

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/balloon-pop/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 连锁
- openLevel 走框架

不要做什么：
- 不要改 brick-break

与邻接游戏的冲突点：
- 点击与 mole-pop

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `brick-break` 碰碰砖块

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 44 步 / 共 57 步，角色 **B**，独占 `brick-break`「碰碰砖块」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/brick-break/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 多球/传送门 1.1。球与板碰撞若穿模要修。下落碎片瞬没。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 板反弹角、砖血、底板掉球失败。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 轮流清砖。 |
| 无尽 | 砖潮。 |

- 碎砖粒子
- 无尽

**2.5D / 3D 决策：** 2D。不要 3D 砖墙。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 板够宽热区
- 球对比背景

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/brick-break/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 反弹角
- 多球

不要做什么：
- 禁止商业打砖块商标

与邻接游戏的冲突点：
- 方向键移板

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `bubble-pop` 泡泡噗噗

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 44 步 / 共 57 步，角色 **C**，独占 `bubble-pop`「泡泡噗噗」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/bubble-pop/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 与 bubble-aim 区分：这是点破不是瞄准射。重力翻转新机制打磨。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 点破、变色、限步。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 可选。 |
| 无尽 | 重力翻转生存。 |

- 破泡下落时间线（同三消精神）

**2.5D / 3D 决策：** 2D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/bubble-pop/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 重力翻转合法性

不要做什么：
- 不要改 bubble-aim

与邻接游戏的冲突点：
- 命名相近，meta.blurb 必须写清玩法

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
