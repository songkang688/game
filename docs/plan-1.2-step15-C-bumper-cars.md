# 1.2 第 15 步 · C 档 —— `bumper-cars`「碰碰车大乱斗」先同步 1.1 再升级撞击物理

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2`，不要改 `main`，不要 force。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.2 第 15 步（共 29 步）· C 档**：升级已有游戏 `bumper-cars`「碰碰车大乱斗」。
本步是派对乱斗三连：A `bomb-buddies`、B `snow-fight`、C `bumper-cars`。别人的目录你一个字都不许碰。

## 一、分支纪律

- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- **动代码前先提交一条「C 档 + 本款升级计划」的 commit**。
- 只在 `game-1.2` 线上干活；收尾 fetch → rebase → `npm test` 与 `npm run build` 全绿 → 普通 push。**禁止 force、不改 `main`、不用 `gh` 开 PR。**

## 二、开工第一件事：确认目录在不在（本款特殊）

`bumper-cars` 是 1.1 第 7 步 C 做的，**它在 `origin/game-1.1` 上，历史上一度不在 `game-1.2` 上**。

1. `git fetch origin game-1.1`，跑 `git diff --stat origin/game-1.2 origin/game-1.1 -- src/games/bumper-cars`。
2. 如果 `game-1.2` 上没有这个目录或版本更旧，**先把 1.1 的整套搬过来对齐**（`git checkout origin/game-1.1 -- src/games/bumper-cars`），单独一条 commit「同步 1.1 的 bumper-cars」，跑通 `npm test` 与 `npm run build` 之后再做 1.2 升级。
3. **不许重写**，1.1 的 `logic.ts` / `ai.ts` / `levels.ts` / `guide.ts` / `smoke.test.ts` 都是既有资产。
4. 在回复里写清楚：本步是「同步 + 升级」还是「只升级」。

1.1 的事实：`category: "party"`、`modes: ["campaign","versus","endless","twoPlayer"]`、`levels: 188`；目录 `ai.ts` `logic.ts` `levels.ts` `index.ts` `meta.ts` `guide.ts` + `smoke.test.ts` 等测试。
其余基线：188 框架、收藏册只读、家长门、`save.recordEndlessBest`；**不引入任何依赖**。

## 三、现状审查（回复里逐条回答）

1. 撞击用的是弹性碰撞（动量 + 恢复系数）还是简单反向？质量差有没有体现？
2. 出界 / 击倒判定是什么？会不会「一撞出局」？
3. 转向手感：是坦克式（原地转）还是有转弯半径？漂移有没有？
4. AI 会不会一直贴着墙转圈？
5. 四种模式是否都能玩到结算？
6. 触屏是摇杆还是左右转 + 油门？

## 四、1.2 玩法升级

| 项 | 规格 |
| --- | --- |
| **撞击物理** | 圆形刚体 + 质量 + 恢复系数 e（0.6–0.8），冲量沿连心线；被撞后有 0.3 秒失控旋转。全部常量化并写单测（动量守恒断言）。 |
| **蓄力冲撞** | 按住蓄力 0.8 秒放出一次强撞（有冷却与明显前摇），给对手躲避窗口。 |
| **场地机关** | 三种：弹簧墙（反弹加成）、旋转盘（改变朝向）、油渍（降低摩擦）。各写纯函数 + 用例。 |
| **淘汰规则** | 出界不是直接淘汰：先「打转 2 秒」，再被撞出才算出局，避免开局秒退场；无尽模式下可复活 3 次。 |
| **AI 四档** | 会瞎撞 / 会追 / 会预判走位 / 会卡边角逼出界；固定 seed 胜率断言。 |

## 五、模式矩阵

四模式全保留（玩不了就修好或删声明）；闯关 **前段关卡数据不改**；无尽成绩 `save.recordEndlessBest("bumper-cars", n)`。

## 六、2.5D / 3D 决策

**保持 2D 俯视**，车身可有轻微斜投影厚度。**不做真 3D**（碰撞判定必须一眼可读）。

## 七、视觉 · 建模 · 手感

- 撞击有形变（车身压扁 8%）+ 火花状彩纸 + 顿帧 3–5 帧。
- 出界是「滑出场外，工作人员小人推回来」，**不是坠毁**。
- 车用原创卡通造型与角色配色，不要出现任何真实车厂标识。
- `prefers-reduced-motion`：关屏震与形变。

## 八、手机 360px

- 双人同屏时左右各一套控件，热区 ≥ 44px；比分 / 剩余车数一行显示，字号 ≥ 14px。
- 场地整屏可见，不许滚动找车。

## 九、平台接线

- `openCampaignLevel(n)` / `initialLevel` / `?level=` 直开第 N 关；Skip 走 `requestSkip`。
- `meta.platform` 按实测填；`blurb` 与事实对齐。

## 十、独占文件与冲突

只许改 `src/games/bumper-cars/**`。不要碰 `bomb-buddies` / `snow-fight` / `tank-battle`。CSS 类名 `bpc-` 前缀；两套键位 `destroy` 时全卸。

## 十一、测试（新增 ≥ 18 个用例，同步进来的既有测试一个都不许删）

弹性碰撞动量守恒、恢复系数边界、蓄力冷却、三种机关、淘汰两段式、四档 AI 强度、无尽复活次数、双人输入不串、`destroy` 归零。

## 十二、分级红线与回复

无伤害、无坠毁、无死亡；失败只鼓励；无商标（不许出现真实汽车品牌）。完成后回复：你是 C 档、`bumper-cars`；是否需要先同步 1.1；物理常量；AI 四档数据；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
