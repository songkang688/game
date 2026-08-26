# 1.2 升级第 50 步 / 共 57 步 —— 红蓝赛跑 · 点点 · 拔河
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `red-blue-race` 红蓝赛跑

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 50 步 / 共 57 步，角色 **A**，独占 `red-blue-race`「红蓝赛跑」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/red-blue-race/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 道具/体力/节拍。键位可能与双人游戏冲突（本款是单人打电脑）。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 跑跳坑、体力。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 人机。 |
| 无尽 | 已有则打磨。 |

- 跑步循环动画
- 无尽节奏

**2.5D / 3D 决策：** 2D 或轻微 2.5D 跑道。不要 3D 赛车（那是 kart-dash）。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 角色居中
- 红蓝对比够

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/red-blue-race/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 体力
- 无尽分

不要做什么：
- 不要改 duo-rush

与邻接游戏的冲突点：
- D/方向键

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `red-blue-tap` 红蓝点点

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 50 步 / 共 57 步，角色 **B**，独占 `red-blue-tap`「红蓝点点」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/red-blue-tap/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 连击、序号拍。误点惩罚。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 点目标、躲陷阱。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 核心。 |
| 无尽 | 已有。 |

- 点中缩放反馈
- 无尽

**2.5D / 3D 决策：** 2D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 目标 ≥ 44px

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/red-blue-tap/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 序号顺序

不要做什么：
- 不要做成 duo-arena 换皮

与邻接游戏的冲突点：
- 点击类一堆，本游戏 CSS `rbt-`

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `red-blue-tug` 红蓝拔河

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 50 步 / 共 57 步，角色 **C**，独占 `red-blue-tug`「红蓝拔河」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/red-blue-tug/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 体力、红绿灯、号子。连点节奏。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 拉力条、抢点。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 核心。 |
| 无尽 | 连胜。 |

- 绳拉伸不是瞬移中点
- 连点防作弊（时间窗）

**2.5D / 3D 决策：** 2D。绳子拉伸可视化。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 绳在中屏
- 按钮大

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/red-blue-tug/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 拉力积分
- 连点窗

不要做什么：
- 不要真较劲伤害描写

与邻接游戏的冲突点：
- 连点与红蓝点点

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
