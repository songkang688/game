# 1.2 升级第 42 步 / 共 57 步 —— 小怪物危机 · 坦克 · 雪球
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `monster-crisis` 小怪物危机

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 42 步 / 共 57 步，角色 **A**，独占 `monster-crisis`「小怪物危机」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/monster-crisis/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 颜料怪卡通化。攻略用语『吸颜料』不是血。
2. 可守住性模拟。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 波次、路障、炮台、主角射击。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 非对称出兵若已有则打磨。 |
| 无尽 | 无限波。 |

- 无尽科技三线封顶
- 方向盘必须留在舞台内（已有冒烟则加强）

**2.5D / 3D 决策：** 2D。1.1 已修窄屏方向盘，回归测试不许删。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 缩放战场
- 上色进度条不是血条

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/monster-crisis/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 舞台裁切回归
- 可守住模拟
- openLevel

不要做什么：
- 禁止僵尸商业 IP、禁止血

与邻接游戏的冲突点：
- 方向盘 CSS 不要写进全局

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `tank-battle` 铁皮坦克大战

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 42 步 / 共 57 步，角色 **B**，独占 `tank-battle`「铁皮坦克大战」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/tank-battle/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 砖/钢/水/草。基地星星堡垒。
2. 子弹与坦克重叠判定。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 可摧毁墙、保护基地。击中冒烟，无爆炸血腥。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 互打。 |
| 无尽 | 敌潮。 |

- AI 四种行为回归
- 双人合作别挡彼此

**2.5D / 3D 决策：** 2D 俯视格子。不要 3D 坦克。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 地图完整
- 子弹拖尾短

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/tank-battle/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 基地可护模拟
- 键位两套
- openLevel

不要做什么：
- 禁止商业坦克 IP

与邻接游戏的冲突点：
- 方向键与碰碰车

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `snow-fight` 雪球大作战

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 42 步 / 共 57 步，角色 **C**，独占 `snow-fight`「雪球大作战」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/snow-fight/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 抛物线+风偏纯函数。
2. 掩体打碎。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 蓄力、风向、堆墙。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 双人。 |
| 无尽 | 雪怪车轮。 |

- AI 高档会算风偏
- 蓄力条 360px 可见

**2.5D / 3D 决策：** 2D 侧视或俯视选一种写死。抛物线不要 3D 引擎。

## 4. 视觉 / 建模 / 动效（含手机）

- 球影帮助判落点
- 命中星星爆

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/snow-fight/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 风偏
- 键位
- openLevel

不要做什么：
- 禁止打人写实

与邻接游戏的冲突点：
- 空格投掷

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
