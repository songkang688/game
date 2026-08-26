# 1.2 升级第 36 步 / 共 57 步 —— 弹鸟 · 秋千 · 泡泡瞄准
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `sling-birds` 弹弹小鸟

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 36 步 / 共 57 步，角色 **A**，独占 `sling-birds`「弹弹小鸟」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/sling-birds/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. STORE_KEY 仍可能是战役自定义 key，确认带 yiduo-yixing 或做迁移。
2. 竖屏被压扁是历史痛点，新动画不能再压弹弓。
3. 1.1 有第二角色/风力/传送门，检查是否真正接到发射手感。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 弹道抛物线、碰撞箱、木石玻璃破坏阈值。
- 一次发射后等世界静止再结算星。

结构参考：自写弹簧+冲量，可看开源 slingshot 数值分离。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 保留，physics.ts 老断言不许改弱。 |
| 对战 | 不做同屏互弹（不公平）。 |
| 无尽 | 随机结构生存，可选但推荐。 |

- 补『拉弓橡皮筋拉伸』视觉，不要瞬射。
- 无尽：结构生成可解（至少一鸟能打到猪型目标）。

**2.5D / 3D 决策：** 保持 2D 侧视物理。不要 3D 弹弓。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 弹弓完整拉满
- 击碎有碎块粒子，reduced-motion 降量

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/sling-birds/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- physics 老断言全在
- openLevel
- 世界静止判定

不要做什么：
- 禁止商业弹鸟商标与角色
- 不要改 candy-swing 绳物理

与邻接游戏的冲突点：
- 空格发射 vs 平台暂停
- 前缀 `sb-`

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `candy-swing` 糖果秋千

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 36 步 / 共 57 步，角色 **B**，独占 `candy-swing`「糖果秋千」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/candy-swing/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. SAVE_KEY 曾是 `yiduo.candy-swing.campaign.v2`（缺前缀）——必须迁移到 yiduo-yixing。
2. 注释商标词 1.0 就要求改过，复查。
3. 剪绳若瞬断无抖动，要补弹性。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 划断绳子、糖果受重力、钩钉、目标嘴。
- 新机制伸缩/磁铁/风扇已在 1.1 则打磨手感。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 保留，绳物理老断言不许改。 |
| 对战 | 不做。 |
| 无尽 | 随机钉点，可解性检测。 |

- 剪断要有绳索回弹帧
- 无尽钉点生成保证有路径到嘴

**2.5D / 3D 决策：** 2D。绳子不要 3D 布料。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 剪刀手势不挡钉
- 糖果旋转跟随速度

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/candy-swing/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 旧 key 迁移
- 物理老断言
- openLevel

不要做什么：
- 禁止割绳商标
- 不要改 sling-birds

与邻接游戏的冲突点：
- 滑动剪与切果手势：本游戏只在 mount 时监听

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `bubble-aim` 泡泡瞄准手

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 36 步 / 共 57 步，角色 **C**，独占 `bubble-aim`「泡泡瞄准手」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/bubble-aim/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. SAVE_KEY 可能仍是 `yiduo.bubble-aim.campaign.v2`，要迁移。
2. `simulateShot` 指哪打哪不许破坏。
3. 消除后泡泡下落若瞬填，必须补下落。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 射线反弹、同色 ≥3 消、重力下落、顶行死线。
- 彩虹泡/限弹若已有则接动画时间线。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 或 99（以代码为准，补到与 meta.levels 一致）。 |
| 对战 | 轮流清盘比步数。 |
| 无尽 | 顶板下压生存。 |

- 与 match-stars 同样禁止瞬变重力
- 无尽顶板每 N 发下压一格

**2.5D / 3D 决策：** 2D。瞄准线不要 3D 折射。

## 4. 视觉 / 建模 / 动效（含手机）

- 瞄准虚线在 360px 仍清晰
- 消泡缩放 180ms 再下落

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/bubble-aim/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- simulateShot 老断言
- 重力计划函数
- key 迁移

不要做什么：
- 禁止商业泡泡龙名

与邻接游戏的冲突点：
- 与 bubble-pop 都是泡泡：标题必须能区分

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
