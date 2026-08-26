# 1.2 升级第 35 步 / 共 57 步 —— 花园守卫 · 绿芽保卫 · 切果
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `garden-guard` 花园守卫

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 35 步 / 共 57 步，角色 **A**，独占 `garden-guard`「花园守卫」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/garden-guard/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 独立战役 `logic.ts` + `PROGRESS_KEY = yiduo-yixing.garden-guard.campaign.v2`，不走 l99 skip。
2. 塔种与 Boss 1.1 已加减速/毒雾/空中单位；常见缺口：射程圈在窄屏看不清、升级 UI 挡格子、模拟通关策略与实操手感脱节。
3. 没有无尽；没有直开第 N 关。
4. 种塔动画若是瞬现，要补『花苗长出』200ms。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 塔防通行：格子放塔、敌人沿路、资源击杀掉落、塔有造价与射程与冷却。
- 空中单位只被对空塔打中；减速改变到达时间必须进模拟器。
- 不能出现不可防守的关（固定策略模拟要过）——已有 sim.ts 则加强，不要删。

结构参考：开源 HTML5 TD 的格子+路径队列，自写。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 保留 188。本步不改前 99 关数值表，打磨手感与射程圈可读性。 |
| 对战 | 不做双人互拆家（节奏崩）。可做人机『谁守得更久』限时，可选。 |
| 无尽 | 必须补：波次无限，资源曲线有软上限，记最高波。 |

- 无尽波次生成器：每 10 波一个小 Boss，禁止三路同时塞满无法点击的密度。
- 塔升级预览：先看射程圈再确认，避免误点。
- AI 不需要；这是 PvE。

**2.5D / 3D 决策：** 保持 2D 俯视塔防。可加一层立体花盆阴影，不要 3D 摄像机（挡射程圈）。

## 4. 视觉 / 建模 / 动效（含手机）

- 射程圈半透明粉彩，对比草地 ≥ 3:1。
- 360px：底部塔栏可横滑，不挡最后一行格子。

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/garden-guard/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
不要改 sprout-defense / fruit-slice。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 无尽 50 波模拟可守或明确失败条件
- openCampaignLevel
- 射程圈纯函数
- destroy 后无 rAF

不要做什么：
- 不要改 sprout-defense 植物表
- 不要引入寻路库依赖

与邻接游戏的冲突点：
- 与 sprout-defense 都是守家：文案『塔/花』区分
- 不要全局 `.range` CSS

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `sprout-defense` 绿芽保卫战

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 35 步 / 共 57 步，角色 **B**，独占 `sprout-defense`「绿芽保卫战」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/sprout-defense/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. `PROGRESS_KEY = yiduo-yixing.sprout-defense.campaign.v2`；植物解锁写在关卡表。
2. 1.1 已加探测植物/昼夜/虫后。缺口：窄屏五路被 HUD 切掉（1.1 修过 monster-crisis 同类问题，本款复查）。
3. 无尽缺失；跳关未接。
4. 植物种下若瞬现，补生长帧。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 通行守家：阳光点种、冷却、行内碰撞、夜间视野。
- 水路过路需要荷叶类。被吃是『被啃成种子』卡通，禁止血腥。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 保留 188，前 99 一字不改。 |
| 对战 | 非对称出兵太复杂，本步不做。 |
| 无尽 | 必须补：阳光/露水经济有上限，虫潮密度软封顶。 |

- 无尽复用植物表，禁止新植物破坏前 99 平衡（新植物只在无尽/100+）
- 铲除误触要确认

**2.5D / 3D 决策：** 保持 2D 五路。不要 3D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 方向/植物栏必须整栏可见
- 昼夜滤镜 reduced-motion 减弱

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/sprout-defense/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
不要改 garden-guard。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 无尽 30 波 sim
- openLevel
- 夜间命中判定

不要做什么：
- 不要出现任何商业塔防植物名
- 不要改 garden-guard

与邻接游戏的冲突点：
- 植物 id 不要和花园守卫 tower id 字符串撞全局
- CSS `sd-`

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `fruit-slice` 水果切切乐

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 35 步 / 共 57 步，角色 **C**，独占 `fruit-slice`「水果切切乐」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/fruit-slice/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. `PROGRESS_KEY`/`BEST_KEY` 已带 yiduo-yixing 前缀。
2. 1.1 有连刀、指令果、硬壳、镜像。缺口：切片分离动画可能瞬切成两半无物理；炸弹惩罚过猛或过弱。
3. 手指滑动在 360px 易误切炸弹。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 通行切果：滑动轨迹与果的碰撞段；炸弹碰刀失败。
- 连刀：一条轨迹切中多果加分。
- 半果飞出要有速度与重力，不能瞬换成『已切』贴图。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188 回合战役保留。 |
| 对战 | 分屏比谁先到目标分，可选。 |
| 无尽 | 必须：果潮越来越密，炸弹比例缓升，记最高分。BEST_KEY 已有则沿用。 |

- 无尽成长：连击倍率上限封顶防爆分
- 炸弹先闪红圈 150ms（可关）降低误触

**2.5D / 3D 决策：** 保持 2D。刀光可用短拖尾，不要 3D 果盘。

## 4. 视觉 / 建模 / 动效（含手机）

- 切开后两半沿法线分开 300ms
- 360px 轨迹粗于 6px

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

平台密码（kangkang / 管理员 18438037080 / 1 小时自动关）由 A 档实现。游戏侧：
- 实现 `openCampaignLevel(n: number)`（1 基），越界 clamp。
- mount 时若 `api.initialLevel` 或 hash `?level=N` 存在，直接进第 N 关，不要卡在选关封面。
- 跳过按钮调 `getLevelExtras().requestSkip(id, n-1)`，成功则本关星 0、解锁下一关。
- 不要自己做密码框。

## 6. 文件所有权

只许碰 `src/games/fruit-slice/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 轨迹-圆相交
- 连刀倍率
- 无尽炸弹密度单调但不致死局前 20s

不要做什么：
- 禁止忍者/商业切果名
- 不要改 ocean-munch

与邻接游戏的冲突点：
- 滑动手势不要和首页返回抢
- 不要全局 touch-action 写在 styles.css

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
