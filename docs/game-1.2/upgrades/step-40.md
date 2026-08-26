# 1.2 升级第 40 步 / 共 57 步 —— 推箱仓鼠 · 便便超人 · 勇者小路
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `box-hamster` 推箱小仓鼠

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 40 步 / 共 57 步，角色 **A**，独占 `box-hamster`「推箱小仓鼠」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/box-hamster/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. BFS/IDA* 可解测试是硬性。冰面/传送门后段。
2. 撤销若无，必须补（推箱体验核心）。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 箱子不可拉除非关卡声明、不可顶死目标（可解性）。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 全可解硬性。 |
| 对战 | 可双仓鼠关，非对抗。 |
| 无尽 | 不适合，改『每日随机可解箱』。 |

- 撤销栈、重开本关
- 三星=最优步数附近

**2.5D / 3D 决策：** 2D 格子。不要 3D 仓库。

## 4. 视觉 / 建模 / 动效（含手机）

- 箱子滑动 120ms 不能瞬移
- 360px 网格自适应

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/box-hamster/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 188 可解
- 撤销
- 冰面滑行

不要做什么：
- 不要随机出不可解关

与邻接游戏的冲突点：
- 方向键

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `poop-hero` 便便超人

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 40 步 / 共 57 步，角色 **B**，独占 `poop-hero`「便便超人」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/poop-hero/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 题材必须干净可爱。复查文案与造型。
2. 跳跃冲刺手感。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 踩怪变花、收集香香星。严禁生理细节。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 双人合作清臭。 |
| 无尽 | 清洁马拉松。 |

- 无尽垃圾密度曲线
- 双人分工

**2.5D / 3D 决策：** 2D 横版。不要 3D。

## 4. 视觉 / 建模 / 动效（含手机）

- 棕色小云朵不是写实
- 360px

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/poop-hero/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 文案黑名单（恶心词）
- openLevel

不要做什么：
- 任何低俗

与邻接游戏的冲突点：
- 不要污染全局滤镜

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `brave-path` 勇者小路

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 40 步 / 共 57 步，角色 **C**，独占 `brave-path`「勇者小路」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/brave-path/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 回合战斗纯函数应 ≥25 用例。SAVE_KEY `yiduo-yixing.bravepath` 前缀对但缺分段，可迁到 `.brave-path.v1` 并兼容旧 key。
2. 数值肝要继续克制。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 五系克制、冷却、Boss 读条。无血：元气。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 配装镜像打星星队。 |
| 无尽 | 深渊。 |

- 战斗动画：跳数字前要有出手帧
- 无尽衰减防无限刷

**2.5D / 3D 决策：** 2D。战斗可小立绘 bob，不要 3D RPG。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 四按钮攻击技能防御道具
- 克制颜色+图标

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/brave-path/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 克制表
- 旧存档迁移
- openLevel

不要做什么：
- 禁止商业 RPG 技能名

与邻接游戏的冲突点：
- 养成不要写进 collection.ts（那是跑酷小屋）

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
