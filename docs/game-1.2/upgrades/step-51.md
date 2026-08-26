# 1.2 升级第 51 步 / 共 57 步 —— 保龄球 · 跳棋 · 斗兽棋
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `bowling-lane` 保龄球小馆

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 51 步 / 共 57 步，角色 **A**，独占 `bowling-lane`「保龄球小馆」。

这是 1.2 **新游戏**精细化。暂定 id `bowling-lane`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/bowling-lane/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 1.1 第 7 步 C 曾规划但仓库无此游戏。本步按精细版落地。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 10 瓶、全中/补中/第十格加投。计分器纯函数，含 300 分。蓄力+路线+旋转。

结构参考：开源 bowling score 函数对照。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 目标分+特殊瓶型。 |
| 对战 | 轮流投。 |
| 无尽 | 连续低于目标结束。 |

- 球滚动时间线（不能瞬到瓶）
- 瓶连锁碰撞简化但合理

**2.5D / 3D 决策：** 2D 或简易 2.5D 球道透视（灭点在球道尽头）。不要 three.js。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 球道可见
- 旋转指示器

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/bowling-lane/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 计分 ≥20 含全中 300
- 第十格
- openLevel

不要做什么：
- 禁止商业保龄商标

与邻接游戏的冲突点：
- 蓄力空格

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `jump-chess` 跳跳棋

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 51 步 / 共 57 步，角色 **B**，独占 `jump-chess`「跳跳棋」。

这是 1.2 **新游戏**精细化。暂定 id `jump-chess`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/jump-chess/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。必须合法跳吃规则（中国跳棋：沿直线跳过邻子到空点，可连跳）。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 基地出发、到达对家营地全部子。不能进别人营地挡死（按选定规则写死）。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 残局过河。 |
| 对战 | 2–4 人。 |
| 无尽 | 连胜。 |

- 连跳路径高亮
- AI 三档贪心到搜索

**2.5D / 3D 决策：** 2D 六角或方格（中国跳棋六角星）。不要 3D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 可点格放大
- 落子滑动

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/jump-chess/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 连跳合法性
- 终局
- openLevel

不要做什么：
- 不要和飞行棋搞混

与邻接游戏的冲突点：
- 点选棋类前缀 `jc-`

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `animal-chess` 斗兽棋

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 51 步 / 共 57 步，角色 **C**，独占 `animal-chess`「斗兽棋」。

这是 1.2 **新游戏**精细化。暂定 id `animal-chess`，以 `docs/game-1.2/00-catalog.md` 为准；目录不存在就按本规格新建完整可玩版，禁止只做壳。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/animal-chess/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 新游戏。8 动物等级、河流、陷阱、兽穴。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 大象>狮>虎>豹>狼>狗>猫>鼠；鼠吃象；河；己方陷阱敌变弱；入穴胜。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 残局。 |
| 对战 | 人机+双人。 |
| 无尽 | 连胜。 |

- 6 档 AI
- 移动确认

**2.5D / 3D 决策：** 2D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 棋子 emoji+字
- 合法点

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/animal-chess/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 克制表
- 河马不可（按规则）
- 陷阱
- openLevel

不要做什么：
- 禁止血腥猎杀描写

与邻接游戏的冲突点：
- 与象棋棋盘 CSS

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
