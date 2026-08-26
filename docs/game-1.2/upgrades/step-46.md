# 1.2 升级第 46 步 / 共 57 步 —— 记忆翻 · 地鼠 · 拼图
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `memory-cards` 记忆翻翻乐

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 46 步 / 共 57 步，角色 **A**，独占 `memory-cards`「记忆翻翻乐」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/memory-cards/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 算式配对、三张一组、旋转干扰。翻牌若瞬换正反，必须有翻转动画。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 配对、错翻扣时或回翻。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 99/188。 |
| 对战 | 轮流翻。 |
| 无尽 | 限时记忆。 |

- 翻转 250ms 才能点下一张
- 对战轮次

**2.5D / 3D 决策：** 2D 卡片翻转即可（CSS 或 canvas 2.5D 翻转）。不要 3D 场景。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 卡片不太小
- 背面图案一致防透

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/memory-cards/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 配对逻辑
- 翻转锁输入

不要做什么：
- 不要偷看答案高亮（除提示限次）

与邻接游戏的冲突点：
- 点击与找不同

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `mole-pop` 地鼠嘭嘭

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 46 步 / 共 57 步，角色 **B**，独占 `mole-pop`「地鼠嘭嘭」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/mole-pop/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 算式鼠、铁盔、夜视。出洞若瞬现，补上升帧。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 时间窗内点中、错点惩罚温和。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 分洞抢。 |
| 无尽 | 已有则打磨曲线。 |

- 出洞 tween
- 无尽节奏

**2.5D / 3D 决策：** 2D。地鼠可有出入洞位移。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 洞不全挤底部
- 算式 ≥ 16px

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/mole-pop/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 时间窗
- 铁盔两击

不要做什么：
- 禁止打头血腥

与邻接游戏的冲突点：
- 点击与气球

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `puzzle-tiles` 拼图乐园

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 46 步 / 共 57 步，角色 **C**，独占 `puzzle-tiles`「拼图乐园」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/puzzle-tiles/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 5×5/6×6、旋转块。滑动若瞬换位，补滑动。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 滑动拼图，可解性（曼哈顿+校验）。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 比谁先拼完。 |
| 无尽 | 画廊。 |

- 滑块 120ms
- 旋转动画

**2.5D / 3D 决策：** 2D。不要 3D 碎片。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 块热区
- 参考图可折叠

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/puzzle-tiles/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 可解性
- 旋转

不要做什么：
- 不要用外链名画版权图，程序化图案

与邻接游戏的冲突点：
- 方向键

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
