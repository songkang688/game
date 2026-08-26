# 1.2 升级第 38 步 / 共 57 步 —— 斗地主 · 金矿钩 · 碰碰车
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `landlord-cards` 朵朵抢地主

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 38 步 / 共 57 步，角色 **A**，独占 `landlord-cards`「朵朵抢地主」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/landlord-cards/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 牌型纯函数应很强；缺口常在 UI：非法出牌反馈弱、倒计时、手牌 20 张在 360px 叠死。
2. AI 三档配合农民是否真的存在。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 54 张、叫分、底牌、牌型大小、炸弹/王炸、春天。不要创新牌型破坏规则。

结构参考：开源斗地主牌型判断，只看用例分类。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 地主塔。 |
| 对战 | 1v2 人机。 |
| 无尽 | 连胜。 |

- 出牌提示『可出这些』高亮
- 6 档太重则保持 3 档但修配合

**2.5D / 3D 决策：** 2D 手牌扇形。不要 3D 牌桌。

## 4. 视觉 / 建模 / 动效（含手机）

- 手牌可横滑，选中上浮
- 360px 按钮『出/不要/提示』

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/landlord-cards/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 牌型回归不许弱
- openLevel 地主塔
- 春天翻倍

不要做什么：
- 禁止赌博话术

与邻接游戏的冲突点：
- 与麻将/英雄卡牌都有出牌按钮，前缀 `ll-`

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `gold-hook` 金矿钩钩

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 38 步 / 共 57 步，角色 **B**，独占 `gold-hook`「金矿钩钩」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/gold-hook/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 钩摆角度纯函数；destroy 曾漏 cancelAnimationFrame（1.1 修过）回归。
2. 商店浮层窄屏。
3. 钩到物体回收若瞬拉，补速度按重量。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 摆动放绳、质量影响回收速度、炸药/力量。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 目标金额。 |
| 对战 | 不做同钩。 |
| 无尽 | 矿层下探。 |

- 重量-速度曲线单测
- 无尽深度与密度

**2.5D / 3D 决策：** 2D 横矿洞（1.1 已改横画布则保持）。不要 3D 矿井。

## 4. 视觉 / 建模 / 动效（含手机）

- 矿石矢量不要 emoji 字体依赖
- 360px 商店一屏

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/gold-hook/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
不要改 fishing-star。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 回收时间与质量单调
- destroy 无泄漏
- openLevel

不要做什么：
- 禁止商业矿工名

与邻接游戏的冲突点：
- 与 fishing-star 都有『放线』，手感参数不要写成全局常量

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `bumper-cars` 碰碰车大乱斗

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 38 步 / 共 57 步，角色 **C**，独占 `bumper-cars`「碰碰车大乱斗」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/bumper-cars/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 弹性碰撞纯函数应有动量守恒测试。
2. 1.1 新游戏，精细化：AI 贴边转圈、窄屏场地被 HUD 吃掉。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 动量+阻尼、出界得分、加速带。无血撞击。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 场地。 |
| 对战 | 双人同屏。 |
| 无尽 | 车海。 |

- 土狼转向
- 无尽车辆数软顶+对象池

**2.5D / 3D 决策：** 2D 俯视。车体可用圆角 2.5D 高光。不要 3D 物理引擎库。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 场地完整
- 撞击星星爆

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/bumper-cars/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 动量守恒近似
- 键位不抢
- 对象池不泄漏

不要做什么：
- 不要引入 box2d 依赖

与邻接游戏的冲突点：
- 方向键与坦克大战

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
