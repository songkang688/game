# 1.2 升级第 53 步 / 共 57 步 —— 投篮 · 台球 · 彩虹卡丁
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `star-hoops` 朵星投篮

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 53 步 / 共 57 步，角色 **A**，独占 `star-hoops`「朵星投篮」。

这是 1.2 **新游戏**精细化。暂定 id `star-hoops`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/star-hoops/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 蓄力抛物线进筐、篮板、三分线简化。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 目标分/花式框。 |
| 对战 | 轮流投。 |
| 无尽 | 计时投。 |

- 进筐网兜动画
- 连击

**2.5D / 3D 决策：** 2D 侧视投篮抛物线，或 2.5D 半场。不要 3D NBA。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 蓄力条
- 球旋转

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/star-hoops/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 抛物线进筐几何
- openLevel

不要做什么：
- 禁止商业球星

与邻接游戏的冲突点：
- 蓄力与保龄/雪球

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `billiard-stars` 星星台球

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 53 步 / 共 57 步，角色 **B**，独占 `billiard-stars`「星星台球」。

这是 1.2 **新游戏**精细化。暂定 id `billiard-stars`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/billiard-stars/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。碰撞弹性。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 瞄准线、力度、碰库、进袋。儿童版：不要惩罚性犯规骂人，温和跳过。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 布局（清台/指定球）。 |
| 对战 | 轮流斯诺克简化或 8 球简化。 |
| 无尽 | 清台计时。 |

- 多球碰撞脉冲迭代稳定
- 瞄准虚线

**2.5D / 3D 决策：** 2D 俯视桌，球用径向高光。不要 3D 台球厅。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 整桌可见或拖
- 母球高亮

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/billiard-stars/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 两球碰撞交换速度近似
- 进袋
- openLevel

不要做什么：
- 禁止商业台球赛事名

与邻接游戏的冲突点：
- 瞄准与 bubble-aim

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `kart-dash` 彩虹卡丁

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 53 步 / 共 57 步，角色 **C**，独占 `kart-dash`「彩虹卡丁」。

这是 1.2 **新游戏**精细化。暂定 id `kart-dash`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/kart-dash/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。与 rainbow-run 差异：载具漂移、道具箱、圈数。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 加速、漂移补正、撞减速、道具（香蕉/加速/护盾）卡通。

结构参考：开源 kart 的漂移转向分离。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 杯赛赛道。 |
| 对战 | 人机 3 车或双人。 |
| 无尽 | 无尽公路。 |

- 漂移积攒小爆发
- AI 循路

**2.5D / 3D 决策：** 2.5D 三车道或俯视赛道。接 rainbow-run 透视经验但独立目录。不要真 3D、不要 three.js。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 车道可读
- 道具 HUD

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/kart-dash/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
不要改 rainbow-run。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 圈数
- 漂移
- openLevel
- 不 import rainbow-run

不要做什么：
- 禁止商业卡丁 IP

与邻接游戏的冲突点：
- 与 duo-rush/rainbow-run 键位，CSS `kd-`

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
